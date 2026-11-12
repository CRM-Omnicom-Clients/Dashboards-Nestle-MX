'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { crearCliente } = require('../lib/sfmc');
const { descubrir } = require('../lib/descubrir');
const { cred, fakeHttp, conToken, sinEspera } = require('./_utils');

const ejemplo = () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'pipeline.config.example.json'), 'utf8'));
const G = (n) => `${String(n).padStart(8, '0')}-aaaa-bbbb-cccc-000000000000`;
const AUTO = '8a8a7b31-f99c-45fb-8482-e7b75858968b';

/** Una BU simulada con el reporte instalado. Opciones para romperla de formas concretas. */
function mundo({ sinDe = [], sinAutomation = false, duplicarQuery = null, pasos = null } = {}) {
  const ex = ejemplo(); const calls = [];
  const idQ = Object.fromEntries(Object.entries(ex.queries).map(([rol], i) => [rol, G(100 + i)]));
  const itemsQ = Object.entries(ex.queries).map(([rol, q]) => ({ name: q.nombre, queryDefinitionId: idQ[rol], categoryId: 460279 }));
  itemsQ.push({ name: 'CRM_Nido_Yogu', queryDefinitionId: G(999), categoryId: 111 });
  if (duplicarQuery) itemsQ.push({ name: ex.queries[duplicarQuery].nombre, queryDefinitionId: G(998), categoryId: 460279 });
  const pasosPorDefecto = ex.automation.pasosEsperados;
  const handler = conToken(async (c) => {
    if (c.method === 'GET' && c.path.startsWith('/automation/v1/queries?')) return { json: { count: itemsQ.length, items: itemsQ } };
    if (c.method === 'GET' && c.path.startsWith('/automation/v1/automations?')) return { json: { count: 2, items: sinAutomation ? [{ id: G(5), name: 'Otra' }] : [{ id: G(5), name: 'Otra' }, { id: AUTO, name: ex.automation.nombre }] } };
    if (c.method === 'GET' && c.path === `/automation/v1/automations/${AUTO}`) {
      return { json: { steps: (pasos || pasosPorDefecto).map((p, i) => ({ step: i + 1, activities: p.map(rol => ({ name: ex.queries[rol].nombre, activityObjectId: idQ[rol] })) })) } };
    }
    if (c.path === '/Service.asmx') {
      const nombre = (/<Value>([^<]+)<\/Value>/.exec(c.body) || [])[1];
      const de = Object.entries(ex.des).find(([, d]) => d.nombre === nombre);
      if (!de || sinDe.includes(nombre)) return { text: '<r><OverallStatus>OK</OverallStatus></r>' };
      const i = Object.keys(ex.des).indexOf(de[0]);
      return { text: `<r><OverallStatus>OK</OverallStatus><Results><Name>${nombre}</Name><CustomerKey>${G(i + 1)}</CustomerKey><CategoryID>445199</CategoryID></Results></r>` };
    }
    return { json: {} };
  });
  const cli = crearCliente({ cred: cred({ accountId: '1234567' }), httpsRequest: fakeHttp(handler, calls), dormir: sinEspera });
  return { cli, calls, ex, idQ };
}

test('BU completa: encuentra los 6 DEs, 5 queries, la automation y las carpetas; sin avisos', async () => {
  const { cli, ex } = mundo();
  const r = await descubrir({ cli, base: ex });
  assert.equal(r.completo, true); assert.deepEqual(r.faltan, []); assert.deepEqual(r.avisos, []);
  assert.ok(Object.values(r.cfg.des).every(d => /^\d{8}-aaaa/.test(d.key)));
  assert.ok(Object.values(r.cfg.queries).every(q => /^\d{8}-aaaa/.test(q.id)));
  assert.equal(r.cfg.automation.id, AUTO); assert.equal(r.cfg.bu.mid, '1234567');
  assert.deepEqual(r.cfg.carpetas, { de: 445199, query: 460279 });
  assert.ok(r.cambios.length >= 14);
});

test('es IDEMPOTENTE (segunda corrida => cero cambios) y NO muta la config base', async () => {
  const { cli, ex } = mundo();
  const base = JSON.parse(JSON.stringify(ex));
  const r1 = await descubrir({ cli, base: ex });
  assert.deepEqual(ex, base, 'la base no se toca');
  const r2 = await descubrir({ cli, base: r1.cfg });
  assert.deepEqual(r2.cambios, []); assert.deepEqual(r2.cfg, r1.cfg);
});

test('objeto faltante: se reporta, el resto se descubre, completo=false', async () => {
  const { cli, ex } = mundo({ sinDe: ['CRM_Email_Links'], sinAutomation: true });
  const r = await descubrir({ cli, base: ex });
  assert.equal(r.completo, false);
  assert.ok(r.faltan.some(x => /DE links: "CRM_Email_Links" no existe/.test(x)));
  assert.ok(r.faltan.some(x => /automation: "CRM_Reporte_Diario" no existe/.test(x)));
  assert.equal(r.cfg.des.links.key, null); assert.ok(r.cfg.des.catalogo.key);
});

test('query con nombre DUPLICADO: no adivina, lo reporta con los IDs', async () => {
  const { cli, ex } = mundo({ duplicarQuery: 'piezas' });
  const r = await descubrir({ cli, base: ex });
  assert.ok(r.faltan.some(x => /query piezas.*DUPLICADA/.test(x))); assert.equal(r.cfg.queries.piezas.id, null);
});

test('automation con pasos distintos a los esperados => aviso con esperados y reales', async () => {
  const { cli, ex } = mundo({ pasos: [['detalle'], ['vol', 'links'], ['piezas'], ['auditoria']] });
  const r = await descubrir({ cli, base: ex });
  assert.equal(r.completo, true); assert.equal(r.avisos.length, 1); assert.match(r.avisos[0], /no son los esperados/);
});

test('MID de la config distinto al del token => aviso (otra BU) y se actualiza', async () => {
  const { cli, ex } = mundo(); ex.bu.mid = '999';
  const r = await descubrir({ cli, base: ex });
  assert.ok(r.avisos.some(x => /NO coincide con el del token/.test(x))); assert.equal(r.cfg.bu.mid, '1234567');
});

test('SOLO LECTURA: ninguna peticion de escritura (todo GET, token, o SOAP Retrieve)', async () => {
  const { cli, calls, ex } = mundo();
  await descubrir({ cli, base: ex });
  for (const c of calls) {
    const ok = c.path === '/v2/token' || c.method === 'GET' || (c.path === '/Service.asmx' && c.headers.SOAPAction === 'Retrieve');
    assert.ok(ok, `peticion no de lectura: ${c.method} ${c.path}`);
  }
  assert.ok(calls.length > 5);
});

test('config de una version ANTERIOR del kit: descubrir le agrega los campos nuevos de la plantilla (los lista), sin pisar los suyos ni los IDs ya descubiertos', async () => {
  const { cli, ex } = mundo();
  const vieja = ejemplo(); delete vieja.bu.offsetUtcHoras; delete vieja.mcpServerName; vieja.prefijoTemporales = 'Mi_Tmp_'; vieja.bu.nombre = 'Otra BU';
  const r = await descubrir({ cli, base: vieja });
  assert.deepEqual(r.agregados.sort(), ['bu.offsetUtcHoras', 'mcpServerName']);
  assert.equal(r.cfg.bu.offsetUtcHoras, -6); assert.equal(r.cfg.mcpServerName, ex.mcpServerName);
  assert.equal(r.cfg.prefijoTemporales, 'Mi_Tmp_', 'lo que la config ya tenía no se pisa'); assert.equal(r.cfg.bu.nombre, 'Otra BU');
  assert.equal(r.completo, true);
  assert.ok(!('offsetUtcHoras' in vieja.bu), 'la config recibida no se modifica');
  const r2 = await descubrir({ cli: mundo().cli, base: r.cfg }); assert.deepEqual(r2.agregados, [], 'segunda corrida: ya no hay nada que agregar (idempotente)'); assert.deepEqual(r2.cfg, r.cfg);
});
