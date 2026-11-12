'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { crearCliente } = require('../lib/sfmc');
const S = require('../lib/snapshot');
const { cred, fakeHttp, conToken, SECRETO } = require('./_utils');

const G = (n) => `${String(n).padStart(8, '0')}-aaaa-bbbb-cccc-000000000000`;
const ID = { vol: G(101), detalle: G(102), piezas: G(103), auditoria: G(104), links: G(105) };
const AUTO = G(900);
const CFG = () => ({ version: 1, prefijoTemporales: 'CRM_Tmp_', carpetas: { de: 1, query: 2 }, bu: { offsetUtcHoras: -6 }, esquema: { llavePieza: 'auto' },
  des: { catalogo: { nombre: 'CRM_Reporte_Config', key: G(1) }, audiencias: { nombre: 'CRM_Audiencias', key: G(2) }, detalle: { nombre: 'CRM_Email_Detalle', key: G(3) },
    piezas: { nombre: 'CRM_Email_Piezas', key: G(4) }, auditoria: { nombre: 'CRM_Reporte_Auditoria', key: G(5) }, links: { nombre: 'CRM_Email_Links', key: G(6) } },
  queries: { vol: { nombre: 'Vol', id: ID.vol }, detalle: { nombre: 'Det', id: ID.detalle }, piezas: { nombre: 'Pz', id: ID.piezas }, auditoria: { nombre: 'Aud', id: ID.auditoria }, links: { nombre: 'Lk', id: ID.links } },
  automation: { nombre: 'CRM_Reporte_Diario', id: AUTO, pasosEsperados: [['vol', 'links'], ['detalle'], ['piezas'], ['auditoria']] } });

const COLS = {
  CRM_Reporte_Config: [['ConfigKey', 'Text', 50, true], ['EmailName', 'Text', 200], ['Activo', 'Text', 3]],
  CRM_Audiencias: [['ConfigKey', 'Text', 50, true], ['Audience_DE', 'Text', 200], ['Audience_Volume', 'Number', 0]],
  CRM_Email_Detalle: [['RowKey', 'Text', 50, true], ['EmailName', 'Text', 200]], CRM_Email_Piezas: [['ConfigKey', 'Text', 50, true], ['EmailName', 'Text', 200]],
  CRM_Reporte_Auditoria: [['ConfigKey', 'Text', 50, true], ['EmailName', 'Text', 200]], CRM_Email_Links: [['RowKey', 'Text', 50, true], ['EmailName', 'Text', 200]],
};
const FILAS = { CRM_Reporte_Config: 3, CRM_Audiencias: 2, CRM_Email_Detalle: 5, CRM_Email_Piezas: 3, CRM_Reporte_Auditoria: 3, CRM_Email_Links: 4 };
const NOMBRE_Q = { [ID.vol]: ['CRM_Audiencias_Vol_Load', 'CRM_Audiencias', 1], [ID.detalle]: ['CRM_Email_Detalle_Load', 'CRM_Email_Detalle', 1], [ID.piezas]: ['CRM_Email_Piezas_Load', 'CRM_Email_Piezas', 0],
  [ID.auditoria]: ['CRM_Reporte_Auditoria_Load', 'CRM_Reporte_Auditoria', 0], [ID.links]: ['CRM_Email_Links_Load', 'CRM_Email_Links', 0] };
const SQL = (n) => `/* ${n} */\r\nSELECT 1 AS a\r\nFROM t `;

const xmlOk = '<r><OverallStatus>OK</OverallStatus></r>';
const celda = (k, v) => `<Property><Name>${k}</Name><Value>${v}</Value></Property>`;
const mundo = (opts = {}) => {
  const calls = [];
  const handler = conToken(async (c) => {
    calls.push(c.path === '/Service.asmx' ? `SOAP ${c.headers.SOAPAction}` : `${c.method} ${c.path}`);
    if (c.path === '/Service.asmx') {
      const b = c.body;
      if (/<ObjectType>DataExtension<\/ObjectType>/.test(b)) { const n = /<Value>([^<]+)<\/Value>/.exec(b)[1]; return { text: `<r><OverallStatus>OK</OverallStatus><Results><Name>${n}</Name><CustomerKey>KEY-${n}</CustomerKey><CategoryID>445199</CategoryID><CreatedDate>2026-08-19T10:00:00</CreatedDate></Results></r>` }; }
      if (/<ObjectType>DataExtensionField<\/ObjectType>/.test(b)) { const k = /<Value>([^<]+)<\/Value>/.exec(b)[1]; const n = Object.keys(COLS).find(x => 'KEY-' + x === k); return { text: `<r><OverallStatus>OK</OverallStatus>${COLS[n].map(([nm, t, l, pk], i) => `<Results><Name>${nm}</Name><FieldType>${t}</FieldType><MaxLength>${l || 0}</MaxLength><Ordinal>${i + 1}</Ordinal><IsPrimaryKey>${!!pk}</IsPrimaryKey><IsRequired>${!!pk}</IsRequired></Results>`).join('')}</r>` }; }
      const mo = /DataExtensionObject\[([^\]]+)\]/.exec(b);
      if (mo) { const pedidas = [...b.matchAll(/<Properties>([^<]+)<\/Properties>/g)].map(m => m[1]); const hayMas = opts.siempreMas === mo[1]; return { text: `<r><OverallStatus>${hayMas ? 'MoreDataAvailable' : 'OK'}</OverallStatus>${hayMas ? '<RequestID>R1</RequestID>' : ''}${Array.from({ length: FILAS[mo[1]] }, (_, i) => `<Results xsi:type="DataExtensionObject"><Properties>${pedidas.map(p => celda(p, p + i)).join('')}</Properties></Results>`).join('')}</r>` }; }
      return { text: xmlOk };
    }
    let m;
    if ((m = /^\/automation\/v1\/queries\/([0-9a-f-]{36})$/.exec(c.path))) { const [n, destino, tipo] = NOMBRE_Q[m[1]]; return { json: { queryDefinitionId: m[1], name: n, key: n, categoryId: 460279, targetName: destino, targetKey: 'KEY-' + destino, targetUpdateTypeId: tipo, targetUpdateTypeName: tipo ? 'Update' : 'Overwrite', modifiedDate: '2026-08-21T12:00:00', queryText: SQL(n) } }; }
    if (c.path === `/automation/v1/automations/${AUTO}`) return { json: { id: AUTO, name: 'CRM_Reporte_Diario', status: 'Scheduled', statusId: 6, typeId: 1, lastRunTime: '2026-10-02T00:08:01.13',
      schedule: { typeId: 3, startDate: '2026-08-21T00:08:00', endDate: '2079-06-06T00:00:00', scheduledTime: '2026-10-03T00:08:00', rangeTypeId: 1, occurrences: 19282, pattern: '<Pattern/>', icalRecur: 'FREQ=DAILY;UNTIL=20790606;INTERVAL=1', timezoneName: 'Central Standard Time (no DST)', scheduleStatus: 'active' },
      steps: [{ step: 1, activities: [{ name: 'CRM_Audiencias_Vol_Load', objectTypeId: 300, activityObjectId: ID.vol }, { name: 'CRM_Email_Links_Load', objectTypeId: 300, activityObjectId: ID.links }] },
        { step: 2, activities: [{ name: 'CRM_Email_Detalle_Load', objectTypeId: 300, activityObjectId: ID.detalle }] }, { step: 3, activities: [{ name: 'CRM_Email_Piezas_Load', objectTypeId: 300, activityObjectId: ID.piezas }] },
        { step: 4, activities: [{ name: 'CRM_Reporte_Auditoria_Load', objectTypeId: 300, activityObjectId: ID.auditoria }] }] } };
    return { json: {} };
  });
  return { calls, cli: crearCliente({ cred: cred(), cfg: null, httpsRequest: fakeHttp(handler), ahora: () => Date.UTC(2026, 9, 2, 18, 0, 0), dormir: async () => {} }) };
};
const clon = (o) => JSON.parse(JSON.stringify(o));

// ---------- capturar ----------
test('capturar: 6 DEs (campos, PK, filas), 5 queries (SQL completo + hash) y la automation; sin pedir nada que no sea lectura', async () => {
  const { cli, calls } = mundo(); const s = await S.capturar(cli, CFG());
  assert.equal(s.formato, 1); assert.equal(s.mid, '1234567'); assert.equal(s.capturado, '2026-10-02T18:00:00.000Z');
  assert.deepEqual(Object.keys(s.des).sort(), ['CRM_Audiencias', 'CRM_Email_Detalle', 'CRM_Email_Links', 'CRM_Email_Piezas', 'CRM_Reporte_Auditoria', 'CRM_Reporte_Config']);
  assert.deepEqual(s.des.CRM_Reporte_Config.pk, ['ConfigKey']); assert.equal(s.des.CRM_Reporte_Config.filas, 3); assert.equal(s.des.CRM_Email_Detalle.pk[0], 'RowKey'); assert.equal(s.des.CRM_Email_Detalle.filas, 5);
  assert.deepEqual(s.des.CRM_Audiencias.campos[2], { name: 'Audience_Volume', type: 'Number', length: null, ordinal: 3, pk: false, required: false });
  assert.equal(s.des.CRM_Reporte_Config.rol, 'catalogo'); assert.equal(s.roles.des.piezas, 'CRM_Email_Piezas'); assert.equal(s.roles.queries.vol, 'CRM_Audiencias_Vol_Load');
  const q = s.queries.CRM_Email_Detalle_Load; assert.equal(q.targetName, 'CRM_Email_Detalle'); assert.equal(q.targetUpdateTypeId, 1); assert.equal(q.queryText, SQL('CRM_Email_Detalle_Load')); assert.equal(q.sha256, S.sha(q.queryText)); assert.equal(q.sqlLen, q.queryText.length);
  assert.ok(Object.values(s.queries).every(x => x.enRutinaDeAutomation === true), 'las 5 estan en un paso de la automation');
  assert.deepEqual(S.pasosDe(s), [['CRM_Audiencias_Vol_Load', 'CRM_Email_Links_Load'], ['CRM_Email_Detalle_Load'], ['CRM_Email_Piezas_Load'], ['CRM_Reporte_Auditoria_Load']]);
  assert.equal(s.automation.schedule.icalRecur, 'FREQ=DAILY;UNTIL=20790606;INTERVAL=1');
  for (const c of calls) assert.ok(c === 'POST /v2/token' || c.startsWith('GET ') || c === 'SOAP Retrieve', `escritura inesperada: ${c}`);
  assert.equal(S.contieneSecreto(s), false, 'la foto no lleva secretos');
});
test('capturar --sin-filas: no lee las filas (filas = null) y hace menos peticiones', async () => {
  const a = mundo(); const con = await S.capturar(a.cli, CFG()); const b = mundo(); const sin = await S.capturar(b.cli, CFG(), { conFilas: false });
  assert.ok(Object.values(sin.des).every(d => d.filas === null)); assert.ok(b.calls.length < a.calls.length); assert.equal(S.compararSnapshots(con, sin).identica, true, 'las filas son informativas, no estructura');
});
test('contieneSecreto: detecta un secret o un token pegado en la foto (el script se niega a guardarla)', () => {
  const s = { des: {}, queries: { x: { queryText: 'SELECT 1' } } }; assert.equal(S.contieneSecreto(s), false);
  assert.equal(S.contieneSecreto({ ...s, nota: 'secret: ' + SECRETO }), true); assert.equal(S.contieneSecreto({ ...s, nota: 'Bearer abcdefghijklmnop' }), true);
  assert.equal(S.contieneSecreto({ ...s, nota: 'TD_SFMC_GLOBAL_IPG_MEX_RN_CARRER FOCUSED_MX_022026_FILTERED' }), false, 'un nombre de DE con SFMC_ no es un secreto');
  assert.equal(S.contieneSecreto({ ...s, nota: 'TD-SFMC_IPG_MEX_RN_SNM_Femenil_Octubre_101026_FILTRADO' }), false, 'ni con guion antes de SFMC_ (nombre real de una DE de audiencia, 22-oct-2026): la foto de ese dia se negaba a guardarse');
  for (const antes of ['secret=', 'secret: "', '(', ' ', '\n']) assert.equal(S.contieneSecreto({ ...s, nota: antes + SECRETO }), true, `un secret tras ${JSON.stringify(antes)} se sigue detectando`);
});

// ---------- comparar ----------
const base = async () => (await S.capturar(mundo().cli, CFG()));
test('comparar: lo que cambia con el USO DIARIO es informativo y la estructura sigue idéntica (filas, ultima corrida, estado, posicion de un campo)', async () => {
  const a = await base(); const b = clon(a);
  b.des.CRM_Reporte_Config.filas = 4; b.automation.lastRunTime = '2026-10-03T00:08:01'; b.automation.status = 'Running'; b.automation.statusId = 3; b.automation.schedule.scheduledTime = '2026-10-04T00:08:00'; b.automation.schedule.occurrences = 19283;
  b.des.CRM_Reporte_Config.campos[1].ordinal = 9; b.capturado = 'otra';
  const d = S.compararSnapshots(a, b);
  assert.equal(d.identica, true, JSON.stringify(d.estructurales)); assert.ok(d.informativas.length >= 4);
  assert.match(S.formatearDiferencias(d), /La ESTRUCTURA es idéntica/);
});
test('comparar DEs: campo agregado/quitado, cambio de tipo, de largo y de PK, DE nueva/desaparecida/recreada/movida => ESTRUCTURAL', async () => {
  const a = await base(); const b = clon(a); const de = b.des.CRM_Email_Piezas;
  de.campos.push({ name: 'Nuevo', type: 'Number', length: null, ordinal: 3, pk: false, required: false });
  de.campos = de.campos.filter(c => c.name !== 'EmailName'); b.des.CRM_Audiencias.campos[1].type = 'Number'; b.des.CRM_Audiencias.campos[1].length = 100;
  b.des.CRM_Email_Links.pk = ['EmailName']; b.des.CRM_Email_Links.campos[0].pk = false; b.des.CRM_Email_Links.campos[1].pk = true;
  b.des.CRM_Reporte_Config.key = 'OTRA-KEY'; b.des.CRM_Email_Detalle.categoryId = '999'; b.des.NUEVA = clon(b.des.CRM_Email_Links); delete b.des.CRM_Reporte_Auditoria;
  const t = S.compararSnapshots(a, b).estructurales.map(x => `${x.objeto}: ${x.cambio}`).join('\n');
  for (const esperado of ['DE CRM_Email_Piezas: campo AGREGADO: Nuevo (Number)', 'DE CRM_Email_Piezas: campo QUITADO: EmailName (Text 200)', 'DE CRM_Audiencias: campo Audience_DE: cambio de tipo Text -> Number',
    'DE CRM_Audiencias: campo Audience_DE: cambio de largo 200 -> 100', 'DE CRM_Email_Links: cambio la llave primaria: [RowKey] -> [EmailName]', 'DE CRM_Email_Links: campo EmailName: ahora ES llave primaria',
    'DE CRM_Reporte_Config: cambio su CustomerKey: la DE fue RECREADA', 'DE CRM_Email_Detalle: cambio de carpeta', 'DE NUEVA: NUEVA (no estaba', 'DE CRM_Reporte_Auditoria: DESAPARECIO']) assert.ok(t.includes(esperado), 'falta: ' + esperado + '\n' + t);
});
test('comparar queries: el SQL distinto se detecta (con la 1a linea que cambia); CRLF y espacios finales NO cuentan; destino, tipo, ID y automation tambien', async () => {
  const a = await base(); const b = clon(a); const q = 'CRM_Email_Detalle_Load';
  b.queries[q].queryText = b.queries[q].queryText.replace(/\r\n/g, '\n').trimEnd() + '\n'; b.queries[q].sha256 = S.sha(b.queries[q].queryText);
  assert.equal(S.compararSnapshots(a, b).identica, true, 'solo cambian los saltos de linea y el espacio final: no es un cambio');
  b.queries[q].queryText = 'SELECT 2 AS a\nFROM t'; b.queries[q].sha256 = S.sha(b.queries[q].queryText); b.queries[q].sqlLen = b.queries[q].queryText.length;
  let d = S.compararSnapshots(a, b).estructurales; assert.equal(d.length, 1); assert.match(d[0].cambio, /el SQL CAMBIO .* primera diferencia en la linea 1/); assert.equal(d[0].despues, 'SELECT 2 AS a');
  const c = clon(a); c.queries['CRM_Email_Piezas_Load'].targetName = 'OTRA'; c.queries['CRM_Email_Links_Load'].targetUpdateTypeId = 1; c.queries['CRM_Audiencias_Vol_Load'].id = G(555); c.queries['CRM_Reporte_Auditoria_Load'].enRutinaDeAutomation = false;
  const t = S.compararSnapshots(a, c).estructurales.map(x => `${x.objeto}: ${x.cambio}`).join('\n');
  assert.match(t, /CRM_Email_Piezas_Load: cambio su DE destino: CRM_Email_Piezas -> OTRA/); assert.match(t, /CRM_Email_Links_Load: cambio su tipo de actualizacion: 0 -> 1/);
  assert.match(t, /CRM_Audiencias_Vol_Load: cambio su ID: la query fue RECREADA/); assert.match(t, /CRM_Reporte_Auditoria_Load: YA NO esta en la automation/);
});
test('comparar automation: pasos distintos (el ORDEN de los pasos importa; el de las actividades dentro de un paso no), programacion y nombre', async () => {
  const a = await base(); const b = clon(a);
  b.automation.steps[0].activities.reverse(); assert.equal(S.compararSnapshots(a, b).identica, true, 'el orden dentro del paso no importa');
  [b.automation.steps[1], b.automation.steps[2]] = [b.automation.steps[2], b.automation.steps[1]];
  assert.match(S.compararSnapshots(a, b).estructurales[0].cambio, /cambiaron sus PASOS/);
  const c = clon(a); c.automation.schedule.icalRecur = 'FREQ=DAILY;INTERVAL=2'; c.automation.schedule.timezoneName = 'UTC'; c.automation.name = 'Otra';
  const t = S.compararSnapshots(a, c).estructurales.map(x => x.cambio).join('|'); assert.match(t, /programacion: cambio icalRecur/); assert.match(t, /programacion: cambio timezoneName/); assert.match(t, /cambio su nombre/);
});
test('comparar: un MID distinto es estructural (no son la misma BU)', async () => {
  const a = await base(); const b = clon(a); b.mid = '999'; assert.match(S.compararSnapshots(a, b).estructurales[0].cambio, /MID distinto/);
});

// ---------- contra la foto E0 (hecha por un script aparte el 2-oct-2026) ----------
test('la foto E0 se compara consigo misma = identica, y un cambio sembrado en ella se detecta (la normalizacion le calcula el hash que no trae)', () => {
  const e0 = S.normalizar(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'arquitectura-nestle-2026-10-02.json'), 'utf8')));
  assert.equal(S.compararSnapshots(e0, clon(e0)).identica, true); assert.equal(Object.keys(e0.queries).length, 5); assert.ok(Object.values(e0.queries).every(q => /^[0-9a-f]{64}$/.test(q.sha256)));
  const x = clon(e0); x.queries.CRM_Email_Detalle_Load.queryText += '\n-- cambio'; x.queries.CRM_Email_Detalle_Load.sha256 = S.sha(x.queries.CRM_Email_Detalle_Load.queryText);
  x.des.CRM_Email_Piezas.campos[0].type = 'Number'; x.automation.steps.pop();
  const d = S.compararSnapshots(e0, x); assert.equal(d.identica, false); assert.equal(d.estructurales.length, 3);
});

// ---------- --con-datos: el respaldo de lo que NO se recalcula (catalogo y audiencias) ----------
const conDatos = async () => S.capturar(mundo().cli, CFG(), { conDatos: true });
const lineasDatos = (d) => ({ est: d.estructurales.filter(x => x.objeto.startsWith('datos ')), inf: d.informativas.filter(x => x.objeto.startsWith('datos ')) });

test('capturar --con-datos: trae las filas del catalogo y de audiencias (lo unico que no se recalcula) y nada mas; sin la bandera no hay datos', async () => {
  const s = await conDatos();
  assert.deepEqual(Object.keys(s.datos), ['catalogo', 'audiencias']); assert.equal(S.contieneSecreto(s), false);
  assert.equal(s.datos.catalogo.nombre, 'CRM_Reporte_Config'); assert.deepEqual(s.datos.catalogo.columnas, ['ConfigKey', 'EmailName', 'Activo']); assert.deepEqual(s.datos.catalogo.pk, ['ConfigKey']);
  assert.equal(s.datos.catalogo.filas.length, 3); assert.equal(s.datos.catalogo.filas[0].EmailName, 'EmailName0'); assert.equal(s.datos.audiencias.filas.length, 2);
  assert.ok(!('datos' in await S.capturar(mundo().cli, CFG())));
});
test('comparar datos: iguales => una linea informativa con ceros y la estructura identica', async () => {
  const a = await conDatos(); const d = S.compararSnapshots(a, clon(a)); const { est, inf } = lineasDatos(d);
  assert.equal(d.identica, true); assert.deepEqual(est, []);
  assert.ok(inf.some(x => /CRM_Reporte_Config/.test(x.objeto) && /3 -> 3 filas · 0 desaparecidas · 0 cambiadas · 0 nuevas/.test(x.cambio)), JSON.stringify(inf));
});
test('comparar datos: fila CAMBIADA y fila NUEVA son informativas (con la columna que cambio); las columnas volatiles no cuentan', async () => {
  const a = await conDatos(); const b = clon(a);
  b.datos.catalogo.filas[1].Activo = 'No'; b.datos.catalogo.filas.push({ ConfigKey: 'K9', EmailName: 'NUEVA', Activo: 'Si' });
  b.datos.audiencias.filas[0].Audience_Volume = '99999'; b.datos.audiencias.filas[0].LastRefresh = 'otra';
  const { est, inf } = lineasDatos(S.compararSnapshots(a, b)); const t = inf.map(x => `${x.objeto}: ${x.cambio}`).join('\n');
  assert.deepEqual(est, []); assert.match(t, /CRM_Reporte_Config: 3 -> 4 filas · 0 desaparecidas · 1 cambiadas · 1 nuevas/); assert.match(t, /fila cambiada …EmailName1: Activo/);
  assert.match(t, /CRM_Audiencias: 2 -> 2 filas · 0 desaparecidas · 0 cambiadas · 0 nuevas/, 'volumen y LastRefresh cambian solos: no son cambio');
});
test('comparar datos: una fila que DESAPARECIO es ESTRUCTURAL (perder datos nunca es uso normal)', async () => {
  const a = await conDatos(); const b = clon(a); b.datos.catalogo.filas.splice(0, 1);
  const d = S.compararSnapshots(a, b); const { est } = lineasDatos(d);
  assert.equal(d.identica, false); assert.equal(est.length, 1); assert.match(est[0].cambio, /1 fila\(s\) DESAPARECIERON \(…EmailName0\)/);
});
test('comparar datos: cruce ANTES/DESPUES de migrar la llave — el catalogo se compara por EmailName y solo en columnas comunes; audiencias (sin EmailName antes) avisa que no se puede', async () => {
  const a = await conDatos(); const b = clon(a);
  b.datos.catalogo.columnas = ['EmailName', 'Activo']; b.datos.catalogo.pk = ['EmailName']; b.datos.catalogo.filas = b.datos.catalogo.filas.map(({ ConfigKey, ...r }) => r);
  b.datos.audiencias.columnas = ['EmailName', 'Audience_DE']; b.datos.audiencias.pk = ['EmailName']; b.datos.audiencias.filas = [{ EmailName: 'x', Audience_DE: 'y' }];
  const { est, inf } = lineasDatos(S.compararSnapshots(a, b)); const t = inf.map(x => `${x.objeto}: ${x.cambio}`).join('\n');
  assert.deepEqual(est, []); assert.match(t, /CRM_Reporte_Config: 3 -> 3 filas · 0 desaparecidas · 0 cambiadas · 0 nuevas \(sobre 2 columnas comunes\)/);
  assert.match(t, /CRM_Audiencias: la llave cambio y la tabla no trae EmailName: no se compara fila a fila/);
});
test('comparar datos: si SOLO una de las fotos trae datos, no se compara nada de datos', async () => {
  const a = await conDatos(); const b = clon(a); delete b.datos;
  const d = S.compararSnapshots(a, b); assert.deepEqual(lineasDatos(d), { est: [], inf: [] }); assert.equal(d.identica, true);
});
test('capturar --con-datos: si una tabla NO se pudo leer completa, falla (un respaldo incompleto es peor que ninguno); sin la bandera no se exige', async () => {
  await assert.rejects(S.capturar(mundo({ siempreMas: 'CRM_Reporte_Config' }).cli, CFG(), { conDatos: true, conFilas: false }), /CRM_Reporte_Config.*respaldo quedaría incompleto/);
  await assert.doesNotReject(S.capturar(mundo({ siempreMas: 'CRM_Reporte_Config' }).cli, CFG(), { conDatos: false, conFilas: false }));
});
test('comparar datos: espacios al borde y vacio-vs-null NO son cambio (la migracion puede recortar valores o devolver null donde habia vacio)', async () => {
  const a = await conDatos(); const b = clon(a);
  b.datos.catalogo.filas[0].EmailName = '  ' + b.datos.catalogo.filas[0].EmailName + ' '; b.datos.catalogo.filas[1].Activo = null; a.datos.catalogo.filas[1].Activo = '';
  const { est, inf } = lineasDatos(S.compararSnapshots(a, b)); const t = inf.map(x => `${x.objeto}: ${x.cambio}`).join('\n');
  assert.deepEqual(est, []); assert.match(t, /CRM_Reporte_Config: 3 -> 3 filas · 0 desaparecidas · 0 cambiadas · 0 nuevas/);
});
test('comparar datos: la foto no se contamina — comparar NO modifica ninguna de las dos fotos', async () => {
  const a = await conDatos(); const b = clon(a); b.datos.catalogo.filas[2].Activo = 'No'; const antes = JSON.stringify([a, b]);
  S.compararSnapshots(a, b); assert.equal(JSON.stringify([a, b]), antes);
});
