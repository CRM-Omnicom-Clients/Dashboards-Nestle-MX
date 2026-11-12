'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { crearCliente } = require('../lib/sfmc');
const Dr = require('../lib/doctor');
const { cred, fakeHttp } = require('./_utils');

const ejemplo = () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'pipeline.config.example.json'), 'utf8'));
const G = (n) => `${String(n).padStart(8, '0')}-aaaa-bbbb-cccc-000000000000`;
const AUTO = '8a8a7b31-f99c-45fb-8482-e7b75858968b';
const AHORA = Date.UTC(2026, 9, 2, 18, 0, 0);                      // 12:00 hora de la cuenta (UTC-6)
const TODOS = 'data_extensions_read data_extensions_write automations_read automations_write automations_execute journeys_read';

function cfgCompleta() {
  const c = ejemplo(); let n = 1;
  for (const d of Object.values(c.des)) d.key = G(n++);
  for (const q of Object.values(c.queries)) q.id = G(100 + n++);
  c.automation.id = AUTO; c.carpetas = { de: 445199, query: 460279 }; c.bu.mid = '1234567';
  return c;
}
const celda = (k, v) => `<Property><Name>${k}</Name><Value>${v}</Value></Property>`;
const filaXml = (o) => `<Results xsi:type="DataExtensionObject"><Properties>${Object.entries(o).map(([k, v]) => celda(k, v)).join('')}</Properties></Results>`;
const campoXml = ([n, t, l, o, pk]) => `<Results><Name>${n}</Name><FieldType>${t}</FieldType><MaxLength>${l}</MaxLength><Ordinal>${o}</Ordinal><IsPrimaryKey>${pk}</IsPrimaryKey><IsRequired>${pk}</IsRequired></Results>`;
const ok = (extra = '') => `<r><OverallStatus>OK</OverallStatus>${extra}</r>`;

/** Una BU simulada. Cada opcion rompe algo concreto. */
function mundo(cfg, o = {}) {
  const { scopes = TODOS, statusId = 6, status = 'Scheduled', lastRun = '2026-10-02T00:08:01', refresh = '10/2/2026 12:23:05 AM', queryFalta = null,
    columnasCatalogo = null, temporales = { des: [], queries: [] }, pasos = null, tokenFalla = false, latenciaPolls = 0, reloj = () => AHORA } = o;
  const calls = []; const st = { borradasDe: [], borradasQ: [], deCreadas: [], lecturasTemp: 0 };
  const rolDeKey = {}; for (const [rol, d] of Object.entries(cfg.des)) rolDeKey[d.key] = rol;
  const rolDeNombre = {}; for (const [rol, d] of Object.entries(cfg.des)) rolDeNombre[d.nombre] = rol;
  const nombreQ = {}; for (const q of Object.values(cfg.queries)) nombreQ[q.id] = q.nombre;
  const camposDe = (rol) => {
    if (rol === 'catalogo') { const cols = columnasCatalogo || ['EmailName', 'Marca', 'Campana', 'Touchpoint', 'EmailType', 'Activo', 'Estado', 'EmailID']; return [['ConfigKey', 'Text', 50, 1, true], ...cols.map((n, i) => [n, 'Text', 60, i + 2, false])]; }
    if (rol === 'audiencias') return [['ConfigKey', 'Text', 50, 1, true], ['Audience_DE', 'Text', 200, 2, false], ['Audience_Volume', 'Number', 0, 3, false]];
    if (rol === 'piezas') return [['ConfigKey', 'Text', 50, 1, true], ['EmailName', 'Text', 200, 2, false], ['LastRefresh', 'Date', 0, 3, false]];
    return [['RowKey', 'Text', 50, 1, true], ['EmailName', 'Text', 200, 2, false]];
  };
  const pasosRoles = pasos || cfg.automation.pasosEsperados;
  const handler = async (c) => {
    if (c.path === '/v2/token') return tokenFalla ? { status: 401, json: { error: 'invalid_client', error_description: 'Invalid client ID.' } } : { json: { access_token: 'tok', expires_in: 1080, scope: scopes } };
    if (c.method === 'GET') {
      let m = /^\/automation\/v1\/queries\/([0-9a-f-]{36})$/.exec(c.path);
      if (m) return m[1] === queryFalta || !nombreQ[m[1]] ? { status: 404, json: {} } : { json: { name: nombreQ[m[1]] } };
      if (c.path === `/automation/v1/automations/${AUTO}`) return { json: { name: cfg.automation.nombre, statusId, status, lastRunTime: lastRun, schedule: { scheduledTime: '2026-10-03T00:08:00' },
        steps: pasosRoles.map((p, i) => ({ step: i + 1, activities: p.map(rol => ({ name: cfg.queries[rol].nombre, activityObjectId: cfg.queries[rol].id })) })) } };
      if (c.path.startsWith('/automation/v1/queries?')) return { json: { count: temporales.queries.length, items: temporales.queries } };
    }
    if (c.method === 'POST' && c.path === '/data/v1/customobjects') { const b = JSON.parse(c.body); const key = 'PROBE-' + (st.deCreadas.length + 1); st.deCreadas.push({ ...b, key }); return { json: { key } }; }
    if (c.method === 'POST' && c.path === '/automation/v1/queries') return { json: { queryDefinitionId: 'aaaaaaaa-bbbb-cccc-dddd-00000000abcd' } };
    if (c.method === 'POST' && /actions\/start\/$/.test(c.path)) return { json: {} };
    if (c.method === 'DELETE' && c.path.startsWith('/automation/v1/queries/')) { st.borradasQ.push(c.path.split('/').pop()); return { json: {} }; }
    if (c.path === '/Service.asmx') {
      if (/<DeleteRequest /.test(c.body)) { st.borradasDe.push(/<CustomerKey>([^<]+)</.exec(c.body)[1]); return { text: ok() }; }
      if (/<ObjectType>DataExtensionField<\/ObjectType>/.test(c.body)) { const rol = rolDeKey[/<Value>([^<]+)<\/Value>/.exec(c.body)[1]]; return { text: ok(camposDe(rol).map(campoXml).join('')) }; }
      if (/<SimpleOperator>like<\/SimpleOperator>/.test(c.body)) return { text: ok(temporales.des.map(d => `<Results><Name>${d.nombre}</Name><CustomerKey>${d.key}</CustomerKey><CreatedDate>${d.creada}</CreatedDate></Results>`).join('')) };
      if (/<ObjectType>DataExtension<\/ObjectType>/.test(c.body)) {
        const nombre = /<Value>([^<]+)<\/Value>/.exec(c.body)[1];
        const sonda = st.deCreadas.find(d => d.name === nombre);
        if (sonda) return { text: ok(`<Results><Name>${nombre}</Name><CustomerKey>${sonda.key}</CustomerKey><CategoryID>445199</CategoryID><CreatedDate>${new Date(reloj() - 6 * 3600e3).toISOString().slice(0, 23)}</CreatedDate></Results>`) };
        const rol = rolDeNombre[nombre]; return { text: ok(rol ? `<Results><Name>${nombre}</Name><CustomerKey>${cfg.des[rol].key}</CustomerKey><CategoryID>445199</CategoryID><CreatedDate>2026-08-19T10:00:00</CreatedDate></Results>` : '') };
      }
      const mo = /DataExtensionObject\[([^\]]+)\]/.exec(c.body);
      if (mo) {
        if (mo[1] === cfg.des.piezas.nombre) return { text: ok(['a', 'b', 'c'].map(k => filaXml({ LastRefresh: refresh })).join('')) };
        if (mo[1].startsWith(cfg.prefijoTemporales)) { st.lecturasTemp++; return { text: ok(st.lecturasTemp > latenciaPolls ? [filaXml({ ClaveTmp: 'a1', JobID: '1' }), filaXml({ ClaveTmp: '__FIN__' })].join('') : '') }; }
        return { text: ok() };
      }
      return { text: ok() };
    }
    return { json: {} };
  };
  return { handler, calls, st };
}
function clientes(cfg, o = {}) {
  const m = mundo(cfg, { ...o, reloj: () => t });
  let t = AHORA;
  const mk = (conCfg) => crearCliente({ cred: cred({ accountId: '1234567' }), cfg: conCfg ? cfg : null, httpsRequest: fakeHttp(m.handler, m.calls), ahora: () => t, dormir: async (ms) => { t += ms; } });
  return { cli: mk(false), cliW: mk(true), ...m };
}
const vista = { detalleFuente: 'prueba', clientId: 'abcd1234efgh5678ijkl9012', secret: '64 caracteres, prefijo SFMC_' };
const correr = (cl, cfg, { opciones = {}, errorCfg = null, nodeVersion = '24.14.1' } = {}) =>
  Dr.ejecutarChequeos({ cred: cred(), cli: cl.cli, cliW: cl.cliW, cfg, opciones, ahoraMs: AHORA, nodeVersion, vista, errorCfg });
const por = (res) => Object.fromEntries(res.map(x => [x.id, x]));

// ---------- clasificadores puros ----------
test('clasificarScopes: requeridos vs opcionales', () => {
  assert.deepEqual(Dr.clasificarScopes(TODOS.split(' ')), { faltanRequeridos: [], faltanOpcionales: [] });
  const c = Dr.clasificarScopes(['data_extensions_read', 'automations_read']);
  assert.deepEqual(c.faltanRequeridos, ['data_extensions_write', 'automations_write', 'automations_execute']);
  assert.equal(c.faltanOpcionales[0].scope, 'journeys_read');
});

test('clasificarAutomation: Scheduled reciente ok; Running aviso (no refrescar a mano); Paused/Error falla; sin corrida o atrasada aviso', () => {
  const det = (extra) => ({ statusId: 6, status: 'Scheduled', lastRunTime: '2026-10-02T00:08:01', schedule: { scheduledTime: '2026-10-03T00:08:00' }, ...extra });
  const c = (d) => Dr.clasificarAutomation(d, { ahoraMs: AHORA });
  assert.equal(c(det()).estado, 'ok');
  assert.match(c(det({ statusId: 3, status: 'Running' })).detalle, /CORRIDA EN CURSO/); assert.equal(c(det({ statusId: 3, status: 'Running' })).estado, 'aviso');
  assert.equal(c(det({ statusId: 4, status: 'Paused' })).estado, 'falla'); assert.equal(c(det({ statusId: -1, status: 'Error' })).estado, 'falla');
  assert.equal(c(det({ lastRunTime: undefined })).estado, 'aviso');
  const v = c(det({ lastRunTime: '2026-09-30T00:08:01' })); assert.equal(v.estado, 'aviso'); assert.match(v.detalle, /36 h/);
});

// ---------- el doctor completo ----------
test('BU sana: todo ok, y por defecto NO ESCRIBE NADA (solo GET, token o SOAP Retrieve)', async () => {
  const cfg = cfgCompleta(); const cl = clientes(cfg);
  const res = await correr(cl, cfg);
  assert.deepEqual(res.filter(x => x.estado !== 'ok').map(x => `${x.id}:${x.detalle}`), []);
  assert.deepEqual(res.map(x => x.id), ['runtime', 'credenciales', 'token', 'scopes', 'config', 'objetos', 'esquema', 'automation', 'frescura', 'temporales']);
  for (const c of cl.calls) assert.ok(c.path === '/v2/token' || c.method === 'GET' || (c.path === '/Service.asmx' && c.headers.SOAPAction === 'Retrieve'), `escritura inesperada: ${c.method} ${c.path}`);
});

test('token caido: falla con guia y el resto se OMITE (no se inventan chequeos sin token)', async () => {
  const cfg = cfgCompleta(); const res = por(await correr(clientes(cfg, { tokenFalla: true }), cfg));
  assert.equal(res.token.estado, 'falla'); assert.match(res.token.detalle, /CLIENT_ID no existe/); assert.equal(res.resto.estado, 'omitido'); assert.ok(!res.scopes);
});

test('scopes: faltar uno requerido es falla; faltar solo journeys_read es aviso', async () => {
  const cfg = cfgCompleta();
  let res = por(await correr(clientes(cfg, { scopes: 'data_extensions_read data_extensions_write automations_read automations_write journeys_read' }), cfg));
  assert.equal(res.scopes.estado, 'falla'); assert.match(res.scopes.detalle, /automations_execute/);
  res = por(await correr(clientes(cfg, { scopes: TODOS.replace(' journeys_read', '') }), cfg));
  assert.equal(res.scopes.estado, 'aviso'); assert.match(res.scopes.detalle, /journeys_read/);
});

test('sin config: falla con la instruccion y el resto se omite', async () => {
  const res = por(await correr(clientes(cfgCompleta()), null, { errorCfg: null }));
  assert.equal(res.config.estado, 'falla'); assert.match(res.config.detalle, /descubrir\.js/); assert.equal(res.resto.estado, 'omitido');
});

test('MID de la config distinto al del token => aviso (otra BU)', async () => {
  const cfg = cfgCompleta(); cfg.bu.mid = '999';
  const res = por(await correr(clientes(cfg), cfg)); assert.equal(res.token.estado, 'aviso'); assert.match(res.token.detalle, /otra BU/);
});

test('objetos: una query borrada o recreada se detecta y manda a descubrir.js', async () => {
  const cfg = cfgCompleta(); const res = por(await correr(clientes(cfg, { queryFalta: cfg.queries.piezas.id }), cfg));
  assert.equal(res.objetos.estado, 'falla'); assert.match(res.objetos.detalle, /query piezas.*HTTP 404.*descubrir\.js/);
});

test('esquema: al catalogo le falta una columna que el kit necesita => falla que la nombra', async () => {
  const cfg = cfgCompleta(); const res = por(await correr(clientes(cfg, { columnasCatalogo: ['EmailName', 'Marca'] }), cfg));
  assert.equal(res.esquema.estado, 'falla'); assert.match(res.esquema.detalle, /catálogo sin: Campana, Touchpoint, EmailType, Activo, Estado, EmailID/);
});

test('automation: pausada = falla; pasos distintos = aviso con esperados y reales; atrasada = aviso', async () => {
  const cfg = cfgCompleta();
  assert.equal(por(await correr(clientes(cfg, { statusId: 4, status: 'Paused' }), cfg)).automation.estado, 'falla');
  const p = por(await correr(clientes(cfg, { pasos: [['detalle'], ['vol', 'links'], ['piezas'], ['auditoria']] }), cfg)).automation;
  assert.equal(p.estado, 'aviso'); assert.match(p.detalle, /pasos distintos a los esperados/);
  assert.equal(por(await correr(clientes(cfg, { lastRun: '2026-09-29T00:08:01' }), cfg)).automation.estado, 'aviso');
});

test('frescura: datos de hace >36 h => aviso que culpa a la automation', async () => {
  const cfg = cfgCompleta(); const res = por(await correr(clientes(cfg, { refresh: '9/28/2026 12:23:05 AM' }), cfg));
  assert.equal(res.frescura.estado, 'aviso'); assert.match(res.frescura.detalle, /no está llenando las DEs/);
});

test('temporales huerfanos: se AVISAN (sin tocarlos) y con --limpiar-tmp se borran los viejos midiendo la zona', async () => {
  const cfg = cfgCompleta();
  const temporales = { des: [{ nombre: 'CRM_Tmp_x_111111', key: 'K1', creada: '2026-10-01T10:00:00' }, { nombre: 'CRM_Tmp_y_222222', key: 'K2', creada: '2026-10-02T11:50:00' }],
    queries: [{ name: 'CRM_Tmp_x_111111_Load', queryDefinitionId: 'aaaaaaaa-bbbb-cccc-dddd-000000000001', createdDate: '2026-10-01T10:00:00' }] };
  const a = clientes(cfg, { temporales }); const r1 = por(await correr(a, cfg));
  assert.equal(r1.temporales.estado, 'aviso'); assert.match(r1.temporales.detalle, /--limpiar-tmp/); assert.deepEqual(a.st.borradasDe, [], 'sin la bandera NO se borra nada');
  const b = clientes(cfg, { temporales }); const r2 = por(await correr(b, cfg, { opciones: { limpiarTmp: true } }));
  assert.equal(r2.temporales.estado, 'ok'); assert.match(r2.temporales.detalle, /UTC-6/); assert.match(r2.temporales.detalle, /borrados 2 \(1 DEs, 1 queries\)/); assert.match(r2.temporales.detalle, /CRM_Tmp_y_222222/);
  assert.ok(b.st.borradasDe.includes('K1') && !b.st.borradasDe.includes('K2'));
});

test('latencia: rapido = ok; motor lento (>240 s) = aviso que avisa de tiempos largos; y limpia lo que crea', async () => {
  const cfg = cfgCompleta();
  const rapido = clientes(cfg); const r1 = por(await correr(rapido, cfg, { opciones: { latencia: true } }));
  assert.equal(r1.latencia.estado, 'ok'); assert.match(r1.latencia.detalle, /normal/);
  const lento = clientes(cfg, { latenciaPolls: 70 }); const r2 = por(await correr(lento, cfg, { opciones: { latencia: true } }));
  assert.equal(r2.latencia.estado, 'aviso'); assert.match(r2.latencia.detalle, /LENTO/);
  assert.ok(lento.st.borradasQ.length >= 1 && lento.st.borradasDe.length >= 1, 'la DE y la query temporales de la prueba se borraron');
});

test('fuentes: dos packages distintos => aviso que nombra cual se usa; el mismo package o una sola fuente => ok; sin pasar fuentes no hay chequeo', async () => {
  const cfg = cfgCompleta();
  const f = (fuente, estado, clientId) => ({ fuente, estado, clientId, detalle: fuente });
  const corre = (fuentes, forzada = null) => Dr.ejecutarChequeos({ cred: cred({ fuente: 'claude.json' }), cli: clientes(cfg).cli, cliW: null, cfg, opciones: {}, ahoraMs: AHORA, vista, fuentes, forzada });
  const distintos = por(await corre([f('env', 'ausente'), f('claude.json', 'ok', 'AAA'), f('conexion.txt', 'ok', 'BBB')]));
  assert.equal(distintos.fuentes.estado, 'aviso'); assert.match(distintos.fuentes.detalle, /"claude\.json".*SFMC_FUENTE=conexion\.txt/);
  const mismo = por(await corre([f('env', 'ausente'), f('claude.json', 'ok', 'AAA'), f('conexion.txt', 'ok', 'AAA')]));
  assert.equal(mismo.fuentes.estado, 'ok'); assert.match(mismo.fuentes.detalle, /mismo package/);
  const una = por(await corre([f('env', 'ausente'), f('claude.json', 'ok', 'AAA'), f('conexion.txt', 'ausente')]));
  assert.equal(una.fuentes.estado, 'ok'); assert.match(una.fuentes.detalle, /única configurada/);
  const forzada = por(await corre([f('env', 'ausente'), f('claude.json', 'ok', 'AAA'), f('conexion.txt', 'ok', 'BBB')], 'conexion.txt'));
  assert.equal(forzada.fuentes.estado, 'ok'); assert.match(forzada.fuentes.detalle, /forzada/);
  const rota = por(await corre([f('env', 'ausente'), f('claude.json', 'ok', 'AAA'), { fuente: 'conexion.txt', estado: 'incompleta', detalle: 'conexion.txt existe pero está incompleto: falta CLIENT_SECRET' }]));
  assert.equal(rota.fuentes.estado, 'aviso'); assert.match(rota.fuentes.detalle, /conexion\.txt existe pero no se puede usar/);
  assert.ok(!por(await Dr.ejecutarChequeos({ cred: cred(), cli: clientes(cfg).cli, cfg, opciones: {}, ahoraMs: AHORA, vista })).fuentes);
});

test('runtime: Node < 18 es falla', async () => {
  const cfg = cfgCompleta(); assert.equal(por(await correr(clientes(cfg), cfg, { nodeVersion: '16.20.0' })).runtime.estado, 'falla');
});
