'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { crearCliente } = require('../lib/sfmc');
const A = require('../lib/audiencias');
const { decodificar } = require('../lib/xml');
const { cred, fakeHttp, conToken } = require('./_utils');

const G = (n) => `${String(n).padStart(8, '0')}-aaaa-bbbb-cccc-000000000000`;
const VOLID = G(105);
const CFG = () => ({ version: 1, prefijoTemporales: 'CRM_Tmp_', carpetas: { de: 1, query: 2 }, bu: { offsetUtcHoras: -6 }, esquema: { llavePieza: 'auto' },
  des: { catalogo: { nombre: 'CRM_Reporte_Config', key: G(1) }, audiencias: { nombre: 'CRM_Audiencias', key: G(2) }, detalle: { nombre: 'CRM_Email_Detalle', key: G(3) },
    piezas: { nombre: 'CRM_Email_Piezas', key: G(4) }, auditoria: { nombre: 'CRM_Reporte_Auditoria', key: G(5) }, links: { nombre: 'CRM_Email_Links', key: G(6) } },
  queries: { vol: { nombre: 'CRM_Audiencias_Vol_Load', id: VOLID }, detalle: { nombre: 'Det', id: G(102) }, piezas: { nombre: 'Pz', id: G(103) }, auditoria: { nombre: 'Aud', id: G(104) }, links: { nombre: 'Lk', id: G(106) } },
  automation: { nombre: 'CRM_Reporte_Diario', id: G(900), pasosEsperados: [['vol', 'links'], ['detalle'], ['piezas'], ['auditoria']] } });

const xmlOk = '<r><OverallStatus>OK</OverallStatus></r>';
const celda = (k, v) => `<Property><Name>${k}</Name><Value>${v}</Value></Property>`;
const xmlFilas = (filas) => `<r><OverallStatus>OK</OverallStatus>${filas.map(o => `<Results xsi:type="DataExtensionObject"><Properties>${Object.entries(o).map(([k, v]) => celda(k, v)).join('')}</Properties></Results>`).join('')}</r>`;
const xmlInfo = (n) => `<r><OverallStatus>OK</OverallStatus><Results><Name>${n}</Name><CustomerKey>KEY-${n}</CustomerKey><CategoryID>1</CategoryID><CreatedDate>2026-08-19T10:00:00</CreatedDate></Results></r>`;
const colsDe = (n, pk) => `<r><OverallStatus>OK</OverallStatus>${n.map((c, i) => `<Results><Name>${c}</Name><FieldType>Text</FieldType><MaxLength>200</MaxLength><Ordinal>${i + 1}</Ordinal><IsPrimaryKey>${c === pk}</IsPrimaryKey><IsRequired>${c === pk}</IsRequired></Results>`).join('')}</r>`;

const SQL_INICIAL = (pk = 'ConfigKey') => A.generarSqlVol({ nombreVol: 'CRM_Audiencias_Vol_Load', nombreDeAud: 'CRM_Audiencias', pk, nombresDe: ['DE_A', 'DE_C'], fecha: '2026-08-26' });
const ED = (de) => ({ json: { dataExtensionName: de } });

/**
 * SFMC simulado: catalogo, piezas, audiencias (con Update/upsert), Interaction API, DEs de audiencia (existencia) y la query Vol (GET/PATCH).
 * modo 'emailname' = esquema migrado (PK EmailName, sin ConfigKey).
 */
function mundo(o = {}) {
  const { modo = 'configkey', patchAlterado = null, sinScope = false, alteraUpdate = null } = o;
  const ck = modo === 'configkey';
  const cat = [['N1', 'K1', 'Si'], ['N2', 'K2', 'Si'], ['N3', 'K3', 'Si'], ['N4', 'K4', 'Si'], ['N5', 'K5', 'Si'], ['N6', 'K6', 'Si'], ['N7', 'K7', 'No']]
    .map(([n, k, a]) => ({ ...(ck ? { ConfigKey: k } : {}), EmailName: n, Activo: a }));
  const jDe = { N1: 'J1', N2: 'J2', N3: 'J3', N4: '', N5: 'J5', N6: 'J6', N7: 'J7' };
  const piezas = Object.entries(jDe).map(([n, j]) => ({ EmailName: n, Journey_UUID: j }));
  const aud = [{ ...(ck ? { ConfigKey: 'K6' } : { EmailName: 'N6' }), Journey_UUID: 'J6', Audience_DE: 'DE_C', Audience_Volume: '10' },
    { ...(ck ? { ConfigKey: 'K8' } : { EmailName: 'N8' }), Journey_UUID: 'J8', Audience_DE: 'DE_A', Audience_Volume: '900' }];
  const w = { sqlVol: SQL_INICIAL(ck ? 'ConfigKey' : 'EmailName'), patches: [], updates: [], calls: [], aud, jornadas: 0 };
  const existentes = new Set(['CRM_Reporte_Config', 'CRM_Audiencias', 'CRM_Email_Piezas', 'DE_A', 'DE_B', 'DE_C']);
  const COLS = { CRM_Reporte_Config: [ck ? ['ConfigKey', 'EmailName', 'Activo'] : ['EmailName', 'Activo'], ck ? 'ConfigKey' : 'EmailName'],
    CRM_Email_Piezas: [['EmailName', 'Journey_UUID'], 'EmailName'], CRM_Audiencias: [[ck ? 'ConfigKey' : 'EmailName', 'Journey_UUID', 'Audience_DE', 'Audience_Volume', 'LastRefresh'], ck ? 'ConfigKey' : 'EmailName'] };
  const journeys = { J1: 'ED1', J2: 'ED2', J3: 'ED3', J5: 'ED5', J6: 'ED6', J7: 'ED7' };
  const eds = { ED1: ED('DE_A'), ED2: ED('DE_B'), ED3: { json: { type: 'EmailAudience' } }, ED5: ED('DE_GONE'), ED6: ED('DE_C'), ED7: ED('DE_A') };
  const soap = (c) => {
    const b = c.body;
    if (/<UpdateRequest/.test(b)) {
      const pk = ck ? 'ConfigKey' : 'EmailName';
      const clave = decodificar(new RegExp(`<Key><Name>${pk}</Name><Value>([^<]*)</Value></Key>`).exec(b)[1]);
      const props = Object.fromEntries([...b.matchAll(/<Property><Name>([^<]+)<\/Name><Value>([^<]*)<\/Value><\/Property>/g)].map(m => [m[1], decodificar(m[2])]));
      w.updates.push({ clave, props, customerKey: /<CustomerKey>([^<]+)</.exec(b)[1] });
      const guardado = alteraUpdate ? alteraUpdate({ ...props }) : props;                     // SFMC "guarda" algo distinto a lo enviado
      const i = w.aud.findIndex(r => r[pk] === clave); if (i >= 0) Object.assign(w.aud[i], guardado); else w.aud.push({ [pk]: clave, ...guardado });
      return { text: xmlOk };
    }
    if (/<ObjectType>DataExtension<\/ObjectType>/.test(b)) { const n = /<Value>([^<]+)<\/Value>/.exec(b)[1]; return { text: COLS[n] || existentes.has(n) ? xmlInfo(n) : xmlOk }; }
    if (/<ObjectType>DataExtensionField<\/ObjectType>/.test(b)) { const k = /<Value>([^<]+)<\/Value>/.exec(b)[1]; const n = Object.keys(COLS).find(x => 'KEY-' + x === k); return { text: colsDe(COLS[n][0], COLS[n][1]) }; }
    const mo = /DataExtensionObject\[([^\]]+)\]/.exec(b);
    if (mo) {
      const pedidas = [...b.matchAll(/<Properties>([^<]+)<\/Properties>/g)].map(m => m[1]);
      const f = /<Property>([^<]+)<\/Property><SimpleOperator>equals<\/SimpleOperator><Value>([^<]*)<\/Value>/.exec(b);
      let rows = { CRM_Reporte_Config: cat, CRM_Email_Piezas: piezas, CRM_Audiencias: w.aud }[mo[1]] || [];
      if (f) rows = rows.filter(r => String(r[f[1]]) === decodificar(f[2]));
      return { text: xmlFilas(rows.map(r => Object.fromEntries(pedidas.map(p => [p, r[p] === undefined ? '' : r[p]])))) };
    }
    return { text: xmlOk };
  };
  const handler = conToken(async (c) => {
    w.calls.push(c.path === '/Service.asmx' ? `SOAP ${c.headers.SOAPAction}` : `${c.method} ${c.path}`);
    if (c.path === '/Service.asmx') return soap(c);
    let m;
    if ((m = /^\/interaction\/v1\/interactions\/([^?]+)/.exec(c.path))) {
      w.jornadas++; if (sinScope) return { status: 403, json: { message: 'not authorized' } };
      const ed = journeys[m[1]]; return ed ? { json: { name: 'Journey ' + m[1], status: 'Published', triggers: [{ type: 'EmailAudience', metaData: { eventDefinitionId: ed } }] } } : { status: 404, json: {} };
    }
    if ((m = /^\/interaction\/v1\/eventDefinitions\/(.+)$/.exec(c.path))) return eds[m[1]] || { status: 404, json: {} };
    if (c.path === `/automation/v1/queries/${VOLID}`) {
      if (c.method === 'PATCH') { const b = JSON.parse(c.body); w.patches.push(b); w.sqlVol = patchAlterado && w.patches.length === 1 ? patchAlterado(b.queryText) : b.queryText; return { json: {} }; }
      return { json: { queryDefinitionId: VOLID, name: 'CRM_Audiencias_Vol_Load', key: 'CRM_Audiencias_Vol_Load', description: 'volumen', queryText: w.sqlVol, targetName: 'CRM_Audiencias', targetKey: G(2), targetUpdateTypeId: 1, categoryId: 460279 } };
    }
    return { json: {} };
  });
  const mk = (conCfg) => crearCliente({ cred: cred(), cfg: conCfg ? CFG() : null, httpsRequest: fakeHttp(handler), ahora: () => Date.UTC(2026, 9, 2, 18, 0, 0), dormir: async () => {} });
  return { w, cli: mk(true), cliLectura: mk(false) };
}
/** consultarTemp falso: conteos por nombre y validacion del SQL de Vol. */
function consulta({ conteos = { DE_A: 1000, DE_B: 2500, DE_C: 77 }, fallaConteo = [], validaOk = true, filasVal = 2 } = {}) {
  const llamadas = [];
  const fn = async (cli, cfg, op) => {
    llamadas.push(op);
    if (op.etiqueta === 'conteo') {
      const items = [...op.sql.matchAll(/'(\d+)' AS DEName, COUNT\(\*\) AS N FROM \[((?:[^\]]|\]\])+)\]/g)].map(m => ({ i: m[1], n: m[2].replace(/\]\]/g, ']') }));
      if (items.some(x => fallaConteo.includes(x.n))) return { completo: false, filas: [], segundos: op.timeoutS };
      return { completo: true, segundos: 8, filas: items.map(x => ({ DEName: x.i, N: String(conteos[x.n] ?? 0) })) };
    }
    if (op.etiqueta === 'volval') return validaOk ? { completo: true, segundos: 20, filas: Array.from({ length: filasVal }, (_, i) => ({ Audience_DE: 'x' + i })) } : { completo: false, filas: [], segundos: 480 };
    throw new Error('consulta inesperada: ' + op.etiqueta);
  };
  fn.llamadas = llamadas; return fn;
}
const correr = (m, opts, c = consulta()) => A.mapearAudiencias(m.cli, CFG(), { log: () => {}, ...opts }, { consultar: c });
const escrituras = (w) => w.calls.filter(x => /^(PATCH|PUT|DELETE) /.test(x) || x === 'SOAP Update' || x === 'SOAP Create');

// ---------- el SQL de Vol ----------
test('extraerDesDelSql / generarSqlVol: ida y vuelta, con nombres raros (espacios, corchete ], comilla) y el MISMO formato del vigente', () => {
  const nombres = ['TD_SFMC_GLOBAL_IPG_MEX_RN_CARRER FOCUSED_MX_022026_FILTERED', 'E-J5 Liga MX SIN REGION filtrado PARTICION B', 'raro]nombre', "con'comilla"];
  const sql = A.generarSqlVol({ nombreVol: 'Vol', nombreDeAud: 'CRM_Audiencias', pk: 'ConfigKey', nombresDe: nombres, fecha: '2026-10-02' });
  assert.deepEqual(A.extraerDesDelSql(sql), nombres);
  assert.match(sql, /^\/\* Vol — volumen por COUNT estatico\. Regenerado por audiencias\.js el 2026-10-02\. \*\/\nSELECT m\.ConfigKey AS ConfigKey, m\.Journey_UUID AS Journey_UUID, m\.Audience_DE AS Audience_DE, ISNULL\(cnt\.N,0\) AS Audience_Volume, GETDATE\(\) AS LastRefresh\nFROM CRM_Audiencias m\nLEFT JOIN \(\n/);
  assert.match(sql, /FROM \[raro\]\]nombre\]/); assert.match(sql, /SELECT 'con''comilla' AS DEName/); assert.match(sql, /\) cnt ON cnt\.DEName = m\.Audience_DE$/);
});
test('el SQL de Vol REAL de Nestle (foto del 2-oct-2026): se extraen sus 44 DEs y se regenera con el mismo conjunto', () => {
  const f = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'arquitectura-nestle-2026-10-02.json'), 'utf8'));
  const q = f.queries.CRM_Audiencias_Vol_Load; const sql = q.sql || q.queryText || q.query;
  const des = A.extraerDesDelSql(sql); assert.equal(des.length, 44); assert.equal(new Set(des).size, 44);
  assert.ok(des.includes('E-J5 Liga MX SIN REGION filtrado PARTICION B'));
  const otra = A.generarSqlVol({ nombreVol: 'CRM_Audiencias_Vol_Load', nombreDeAud: 'CRM_Audiencias', pk: 'ConfigKey', nombresDe: des, fecha: '2026-10-02' });
  assert.deepEqual(A.extraerDesDelSql(otra), des, 'regenerar con el mismo conjunto no pierde ninguna DE');
});
test('generarSqlVol en el esquema migrado usa m.EmailName', () => {
  assert.match(A.generarSqlVol({ nombreVol: 'V', nombreDeAud: 'CRM_Audiencias', pk: 'EmailName', nombresDe: ['X'], fecha: 'f' }), /SELECT m\.EmailName AS EmailName, m\.Journey_UUID/);
});

// ---------- elegir objetivos ----------
test('--pendientes: piezas ACTIVAS con journey y sin fila de audiencia; ignora la ya mapeada, la inactiva y el envio sin journey (se cuenta aparte)', async () => {
  const m = mundo(); const ctx = await A.leerContexto(m.cli, CFG());
  const s = A.elegirObjetivos(ctx, { pendientes: true });
  assert.deepEqual(s.objetivos.map(o => o.emailName), ['N1', 'N2', 'N3', 'N5']); assert.deepEqual(s.yaMapeadas, ['N6']); assert.equal(s.unicoEnvio, 1);
  assert.deepEqual(s.objetivos.map(o => o.clave), ['K1', 'K2', 'K3', 'K5'], 'la clave de audiencias es la ConfigKey del catalogo');
});
test('--email-name: fuera del catalogo => noEnCatalogo; sin journey => sinJourney; con --journey-uuid se fuerza; una ya mapeada SI se re-resuelve', async () => {
  const m = mundo(); const ctx = await A.leerContexto(m.cli, CFG());
  const s = A.elegirObjetivos(ctx, { emailNames: ['N4', 'NO-EXISTE', 'N6', 'N6'] });
  assert.deepEqual(s.noEnCatalogo, ['NO-EXISTE']); assert.deepEqual(s.sinJourney, ['N4']); assert.deepEqual(s.objetivos.map(o => o.emailName), ['N6'], 'sin duplicados');
  assert.equal(s.objetivos[0].existente.Audience_DE, 'DE_C');
  assert.equal(A.elegirObjetivos(ctx, { emailNames: ['N4'], journeyUUID: 'J2' }).objetivos[0].journeyUUID, 'J2');
});
test('esquema migrado (PK EmailName): la clave de audiencias es el EmailName', async () => {
  const m = mundo({ modo: 'emailname' }); const ctx = await A.leerContexto(m.cli, CFG());
  assert.equal(ctx.modoAud, 'emailname'); assert.deepEqual(A.elegirObjetivos(ctx, { pendientes: true }).objetivos.map(o => o.clave), ['N1', 'N2', 'N3', 'N5']);
});

// ---------- journey -> DE ----------
test('resolverJourneys: journey -> DE de entrada; cachea; distingue 404, sin fuente de entrada y sin DE', async () => {
  const m = mundo(); const r = await A.resolverJourneys(m.cli, ['J1', 'J1', 'J2', 'J3', 'J9']);
  assert.equal(r.get('J1').deNombre, 'DE_A'); assert.equal(r.get('J2').deNombre, 'DE_B'); assert.equal(m.w.jornadas, 4, 'J1 repetido = una sola consulta');
  assert.match(r.get('J3').error, /no es una Data Extension/); assert.match(r.get('J9').error, /no existe/);
  assert.equal(r.get('J1').estado, 'Published');
});
test('resolverJourneys: sin el scope journeys_read (403) => error CLARO que dice que scope agregar', async () => {
  const m = mundo({ sinScope: true }); await assert.rejects(() => A.resolverJourneys(m.cli, ['J1']), /journeys_read/);
});
test('verificarExistencia: una DE borrada se detecta (tumbaria TODA la query Vol)', async () => {
  const m = mundo(); const e = await A.verificarExistencia(m.cli, ['DE_A', 'DE_GONE']); assert.equal(e.get('DE_A'), true); assert.equal(e.get('DE_GONE'), false);
});

// ---------- volumen ----------
test('contarVolumenes: lotes de 8 (10 DEs = 2 consultas) y el indice del lote se mapea bien al nombre', async () => {
  const m = mundo(); const nombres = Array.from({ length: 10 }, (_, i) => 'DE_' + i); const conteos = Object.fromEntries(nombres.map((n, i) => [n, i * 100]));
  const c = consulta({ conteos }); const v = await A.contarVolumenes(m.cli, CFG(), nombres, { consultar: c });
  assert.equal(c.llamadas.length, 2); assert.equal(v.get('DE_0'), 0); assert.equal(v.get('DE_7'), 700); assert.equal(v.get('DE_9'), 900);
});
test('contarVolumenes: si un lote NO termina se reintenta DE por DE; la que sigue fallando queda null (las demas se salvan)', async () => {
  const m = mundo(); const c = consulta({ fallaConteo: ['DE_B'] });
  const v = await A.contarVolumenes(m.cli, CFG(), ['DE_A', 'DE_B', 'DE_C'], { consultar: c });
  assert.equal(v.get('DE_A'), 1000); assert.equal(v.get('DE_C'), 77); assert.equal(v.get('DE_B'), null);
  assert.equal(c.llamadas.length, 1 + 3, 'el lote + 3 reintentos individuales');
});
test('contarVolumenes: comilla y corchete en el nombre de la DE no rompen el SQL', async () => {
  const m = mundo(); const c = consulta({ conteos: { "raro]'nombre": 5 } });
  const v = await A.contarVolumenes(m.cli, CFG(), ["raro]'nombre"], { consultar: c }); assert.equal(v.get("raro]'nombre"), 5); assert.match(c.llamadas[0].sql, /FROM \[raro\]\]'nombre\]/);
});

// ---------- el plan ----------
test('planificar: nueva / actualiza / igual; la DE nueva entra al SQL de Vol y NINGUNA de las que ya contaba se pierde', async () => {
  const m = mundo(); const ctx = await A.leerContexto(m.cli, CFG());
  const objetivos = A.elegirObjetivos(ctx, { emailNames: ['N1', 'N2', 'N6'] }).objetivos;
  const resueltos = await A.resolverJourneys(m.cli, objetivos.map(o => o.journeyUUID));
  const p = A.planificar({ ctx, cfg: CFG(), objetivos, resueltos, existe: new Map([['DE_A', true], ['DE_B', true], ['DE_C', true]]), volumenes: new Map([['DE_A', 1000], ['DE_B', 2500], ['DE_C', 10]]), sqlVolActual: m.w.sqlVol, nombreVol: 'CRM_Audiencias_Vol_Load', fecha: '2026-10-02' });
  assert.deepEqual(p.filas.map(f => [f.emailName, f.accion]), [['N1', 'nueva'], ['N2', 'nueva'], ['N6', 'igual']]);
  assert.deepEqual(p.desNuevas, ['DE_B'], 'DE_A ya estaba en el SQL; solo DE_B es nueva');
  assert.deepEqual(A.extraerDesDelSql(p.sqlNuevo).sort(), ['DE_A', 'DE_B', 'DE_C'], 'el SQL nuevo = las que habia + la nueva');
  assert.equal(p.filas[0].props.Audience_DE, 'DE_A'); assert.equal(p.filas[0].props.Audience_Volume, '1000'); assert.deepEqual(p.filas[0].claves, { ConfigKey: 'K1' });
});
test('planificar: si TODAS las DEs ya estan en el SQL, no se regenera la query (solo se registran filas)', async () => {
  const m = mundo(); const ctx = await A.leerContexto(m.cli, CFG()); const objetivos = A.elegirObjetivos(ctx, { emailNames: ['N1'] }).objetivos;
  const p = A.planificar({ ctx, cfg: CFG(), objetivos, resueltos: await A.resolverJourneys(m.cli, ['J1']), existe: new Map([['DE_A', true]]), volumenes: new Map([['DE_A', 1000]]), sqlVolActual: m.w.sqlVol, nombreVol: 'V', fecha: 'f' });
  assert.equal(p.sqlNuevo, null); assert.deepEqual(p.desNuevas, []); assert.equal(p.filas.length, 1);
});
test('planificar: lo que no se puede mapear va a "problemas" con el motivo (journey sin DE, DE inexistente); volumen sin contar => aviso', async () => {
  const m = mundo(); const ctx = await A.leerContexto(m.cli, CFG()); const objetivos = A.elegirObjetivos(ctx, { emailNames: ['N2', 'N3', 'N5'] }).objetivos;
  const resueltos = await A.resolverJourneys(m.cli, objetivos.map(o => o.journeyUUID));
  const p = A.planificar({ ctx, cfg: CFG(), objetivos, resueltos, existe: new Map([['DE_B', true], ['DE_GONE', false]]), volumenes: new Map([['DE_B', null]]), sqlVolActual: m.w.sqlVol, nombreVol: 'V', fecha: 'f' });
  assert.deepEqual(p.filas.map(f => f.emailName), ['N2']); assert.equal(p.filas[0].volumen, null); assert.ok(!('Audience_Volume' in p.filas[0].props));
  assert.deepEqual(p.problemas.map(x => [x.emailName, x.motivo]), [['N3', 'la fuente de entrada no es una Data Extension'], ['N5', 'la DE de entrada del journey ya no existe']]);
  assert.match(p.avisos.join('|'), /No pude contar la DE "DE_B"/);
});

// ---------- mapearAudiencias de punta a punta (cliente real + guardia real) ----------
test('SIMULACRO (por defecto): resuelve, cuenta y VALIDA el SQL nuevo, pero NO escribe nada (ni filas ni la query)', async () => {
  const m = mundo(); const c = consulta();
  const r = await correr(m, { emailNames: ['N1', 'N2'] }, c);
  assert.equal(r.estado, 'simulacro'); assert.deepEqual(r.filas.map(f => f.accion), ['nueva', 'nueva']); assert.deepEqual(r.desNuevas, ['DE_B']);
  assert.deepEqual(r.validacion, { ok: true, filas: 2, segundos: 20 }); assert.deepEqual(c.llamadas.map(x => x.etiqueta), ['conteo', 'volval']);
  assert.deepEqual(escrituras(m.w), [], 'ni un Update ni un PATCH'); assert.equal(m.w.sqlVol, SQL_INICIAL());
});
test('--escribir: upsert de las filas verificado por relectura + SQL de Vol parcheado y verificado; luego "--pendientes" ya no tiene nada', async () => {
  const m = mundo(); const r = await correr(m, { emailNames: ['N1', 'N2'], escribir: true });
  assert.equal(r.estado, 'aplicado'); assert.deepEqual(r.escritas.map(e => e.verificada), [true, true]); assert.equal(r.vol.ok, true);
  assert.equal(m.w.updates.length, 2); assert.ok(m.w.updates.every(u => u.customerKey === G(2)), 'solo en la DE de audiencias');
  assert.deepEqual(m.w.updates.map(u => u.clave), ['K1', 'K2']); assert.equal(m.w.updates[1].props.Audience_DE, 'DE_B'); assert.equal(m.w.updates[1].props.Audience_Volume, '2500');
  assert.equal(m.w.patches.length, 1); assert.deepEqual(A.extraerDesDelSql(m.w.sqlVol).sort(), ['DE_A', 'DE_B', 'DE_C']);
  assert.equal(m.w.patches[0].name, 'CRM_Audiencias_Vol_Load'); assert.equal(m.w.patches[0].targetUpdateTypeId, 1, 'sigue siendo Update, como estaba');
  assert.deepEqual(escrituras(m.w).sort(), ['PATCH /automation/v1/queries/' + VOLID, 'SOAP Update', 'SOAP Update'].sort());
  const otra = await correr(m, { pendientes: true }); assert.equal(otra.estado, 'simulacro'); assert.deepEqual(otra.objetivos.map(o => o.emailName), ['N3', 'N5'], 'quedan solo las que no se pueden mapear');
});
test('si SFMC guarda una fila DISTINTA a la enviada, la relectura lo delata: "aplicado-parcial" con la fila marcada como no verificada', async () => {
  const m = mundo({ alteraUpdate: (p) => ({ ...p, Audience_DE: 'OTRA_DE' }) }); const r = await correr(m, { emailNames: ['N1'], escribir: true });
  assert.equal(r.estado, 'aplicado-parcial'); assert.deepEqual(r.escritas.map(e => e.verificada), [false]);
});
test('si el SQL nuevo NO valida, NO se escribe NADA (ni las filas): la query de produccion queda intacta', async () => {
  const m = mundo(); const r = await correr(m, { emailNames: ['N2'], escribir: true }, consulta({ validaOk: false }));
  assert.equal(r.estado, 'rechazado'); assert.match(r.motivo, /NO pasó la validación: no se escribió nada/); assert.deepEqual(escrituras(m.w), []); assert.equal(m.w.sqlVol, SQL_INICIAL());
});
test('si el SQL nuevo devuelve distinto numero de filas que audiencias (JOIN que duplica) => no valida', async () => {
  const m = mundo(); const r = await correr(m, { emailNames: ['N2'], escribir: true }, consulta({ filasVal: 5 }));
  assert.equal(r.estado, 'rechazado'); assert.match(r.motivo, /devolvió 5 filas y audiencias tiene 2/); assert.deepEqual(escrituras(m.w), []);
});
test('si SFMC guarda un SQL DISTINTO al enviado: se RESTAURA el anterior y el resultado es "aplicado-parcial" (nunca se deja la query rota)', async () => {
  const m = mundo({ patchAlterado: (t) => t.replace('DE_B', 'OTRA') }); const r = await correr(m, { emailNames: ['N2'], escribir: true });
  assert.equal(r.estado, 'aplicado-parcial'); assert.equal(r.vol.ok, false); assert.match(r.vol.motivo, /se restauró el anterior/);
  assert.equal(m.w.patches.length, 2, 'PATCH nuevo + PATCH de rollback'); assert.equal(m.w.sqlVol, SQL_INICIAL(), 'la query quedo EXACTAMENTE como estaba');
});
test('una pieza que no esta en el catalogo => rechazado sin consultar journeys ni escribir', async () => {
  const m = mundo(); const r = await correr(m, { emailNames: ['NO-EXISTE'], escribir: true });
  assert.equal(r.estado, 'rechazado'); assert.match(r.motivo, /no están en el catálogo.*agregar-pieza\.js/); assert.equal(m.w.jornadas, 0); assert.deepEqual(escrituras(m.w), []);
});
test('--pendientes sin nada que mapear => estado "nada" (idempotente) y no toca nada', async () => {
  const m = mundo(); m.w.aud.push(...['K1', 'K2', 'K3', 'K5'].map(k => ({ ConfigKey: k, Journey_UUID: 'x', Audience_DE: 'DE_A', Audience_Volume: '1' })));
  const r = await correr(m, { pendientes: true }); assert.equal(r.estado, 'nada'); assert.equal(m.w.jornadas, 0); assert.deepEqual(escrituras(m.w), []);
});
test('esquema MIGRADO (PK EmailName): filas con clave EmailName y SQL con m.EmailName', async () => {
  const m = mundo({ modo: 'emailname' }); const r = await correr(m, { emailNames: ['N2'], escribir: true });
  assert.equal(r.estado, 'aplicado'); assert.deepEqual(m.w.updates.map(u => u.clave), ['N2']); assert.match(m.w.sqlVol, /SELECT m\.EmailName AS EmailName/);
});
test('GUARDIA: con un cliente de SOLO LECTURA --escribir no puede escribir (lo frena el cliente, no la buena voluntad)', async () => {
  const m = mundo();
  await assert.rejects(() => A.mapearAudiencias(m.cliLectura, CFG(), { emailNames: ['N1'], escribir: true, log: () => {} }, { consultar: consulta() }), /SOLO LECTURA/);
  assert.deepEqual(escrituras(m.w), []);
});
test('--journey-uuid solo con UN --email-name; sin nada que mapear pedido => error de uso', async () => {
  const m = mundo();
  await assert.rejects(() => correr(m, { emailNames: ['N1', 'N2'], journeyUUID: 'J1' }), /--journey-uuid solo aplica con UN --email-name/);
  await assert.rejects(() => correr(m, { pendientes: true, journeyUUID: 'J1' }), /--journey-uuid solo aplica/);
  await assert.rejects(() => correr(m, {}), /Indica --email-name/);
});
test('una DE de entrada que ya NO existe se reporta como problema y NUNCA se cuenta ni entra a la query Vol (tumbaria toda la query)', async () => {
  const m = mundo(); const c = consulta(); const r = await correr(m, { emailNames: ['N5', 'N2'], escribir: true }, c);
  assert.equal(r.estado, 'aplicado-parcial'); assert.deepEqual(r.problemas.map(p => [p.emailName, p.motivo]), [['N5', 'la DE de entrada del journey ya no existe']]);
  const conteo = c.llamadas.find(x => x.etiqueta === 'conteo'); assert.ok(!/DE_GONE/.test(conteo.sql), 'no se intento contar la DE borrada');
  assert.ok(!A.extraerDesDelSql(m.w.sqlVol).includes('DE_GONE')); assert.deepEqual(m.w.updates.map(u => u.clave), ['K2'], 'solo se escribio la pieza que si se pudo mapear');
});
test('--sin-validar omite la query temporal de validacion (y se dice)', async () => {
  const m = mundo(); const c = consulta(); const r = await correr(m, { emailNames: ['N2'], validarVol: false }, c);
  assert.equal(r.validacion, null); assert.deepEqual(c.llamadas.map(x => x.etiqueta), ['conteo']);
});
