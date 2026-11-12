'use strict';
// CRM_Email_Links_Dia: el SQL, los cuerpos de las peticiones, la conciliacion y el flujo de instalacion completo contra un SFMC simulado — con la guardia REAL en medio
// (si el instalador intentara algo fuera de su lista, la guardia lo rechazaria y la prueba fallaria).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { crearCliente } = require('../lib/sfmc');
const { crearGuardia, ErrorEscritura } = require('../lib/guardia');
const { RegistroTemp } = require('../lib/temp');
const L = require('../lib/linksdia');
const { cred, fakeHttp, conToken } = require('./_utils');

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'arquitectura-nestle-2026-10-02.json'), 'utf8'));
const SQL_LINKS = FIXTURE.queries.CRM_Email_Links_Load.queryText;

// ---------- el SQL ----------
test('extraerExpresiones / construirSql: reusa EXACTO el Link_Name y el Link_URL de la query de Links vigente (la fixture real de Nestle)', () => {
  const e = L.extraerExpresiones(SQL_LINKS);
  const sql = L.construirSql(SQL_LINKS);
  assert.ok(sql.includes(e.nombre) && sql.includes(e.url), 'las expresiones largas van tal cual');
  assert.ok(SQL_LINKS.includes(e.nombre) && SQL_LINKS.includes(e.url), 'y salen de la query vigente, no se reescriben');
  assert.match(sql, /LEFT JOIN _Sent s ON s\.JobID = k\.JobID AND s\.ListID = k\.ListID AND s\.BatchID = k\.BatchID AND s\.SubscriberID = k\.SubscriberID/, 'el envio se une como en el Detalle, pero LEFT: un click cuyo envio ya caduco no se pierde');
  assert.match(sql, /WHERE k\.EventDate >= '2026-03-01'/, 'el filtro es por fecha del click, como el Links vigente');
  assert.match(sql, /CONVERT\(date, k\.EventDate\)\s+AS ClickDay/); assert.match(sql, /CONVERT\(date, s\.EventDate\)\s+AS SendDay/);
  assert.match(sql, /HASHBYTES\('SHA1'/, 'la llave lleva un hash de la URL, no la URL (se truncaba a 400)');
  assert.doesNotMatch(sql, /RTRIM\(k\.URL\), 400\)/, 'la URL entera ya no va en la llave');
  assert.match(sql, /GROUP BY k\.JobID, CONVERT\(date, s\.EventDate\), CONVERT\(date, k\.EventDate\), c\.ConfigKey, LEFT\(RTRIM\(k\.URL\), 500\)/);
  const columnas = [...sql.matchAll(/\bAS (\w+),?\n/g)].map(m => m[1]);
  for (const c of L.CAMPOS.map(x => x.name)) assert.ok(columnas.includes(c) || sql.includes('AS ' + c), `el SQL devuelve ${c}`);
  assert.doesNotMatch(sql, /--|;\s*$/, 'sin comentarios de linea ni punto y coma final');
});
test('construirSql: si la query de Links vigente ya no tiene la forma esperada NO se instala nada (en vez de adivinar)', () => {
  for (const mal of ['', 'SELECT 1', SQL_LINKS.replace('AS Link_Name,', 'AS Nombre,'), SQL_LINKS.replace('CASE WHEN MAX(RTRIM(k.LinkName))', 'CASE WHEN MAX(k.LinkName)'), SQL_LINKS.replace('AS Link_URL,', 'FROM x AS Link_URL,'), SQL_LINKS.replace('REPLACE(REPLACE(REPLACE(', 'REPLACE(REPLACE(REPLACE((')])
    assert.throws(() => L.construirSql(mal), L.ErrorInstalacion);
});

// ---------- cuerpos, horario y comparaciones puras ----------
const CFG = () => ({ version: 1, prefijoTemporales: 'CRM_Tmp_', carpetas: { de: 445199, query: 460279 }, bu: { offsetUtcHoras: -6 }, esquema: { llavePieza: 'auto' },
  des: { catalogo: { nombre: 'CRM_Reporte_Config', key: 'K1' }, audiencias: { nombre: 'CRM_Audiencias', key: 'K2' }, detalle: { nombre: 'CRM_Email_Detalle', key: 'K3' }, piezas: { nombre: 'CRM_Email_Piezas', key: 'K4' }, auditoria: { nombre: 'CRM_Reporte_Auditoria', key: 'K5' }, links: { nombre: 'CRM_Email_Links', key: 'K6' } },
  queries: { vol: { nombre: 'CRM_Audiencias_Vol_Load', id: 'ee50e83c-f2c1-4389-b63f-2690cfcec8f9' }, detalle: { nombre: 'Det', id: '452234b4-4939-42a7-bc34-9b628782c896' }, piezas: { nombre: 'Pz', id: '27da9759-b444-4657-ade5-abcaeb940435' }, auditoria: { nombre: 'Aud', id: 'bfea3a5b-8324-409c-b6ec-28e520bcd0cf' }, links: { nombre: 'CRM_Email_Links_Load', id: '9f4c9f45-d08a-43df-afc7-6d511157c7cd' } },
  automation: { nombre: 'CRM_Reporte_Diario', id: '8a8a7b31-f99c-45fb-8482-e7b75858968b', pasosEsperados: [['vol', 'links'], ['detalle'], ['piezas'], ['auditoria']] } });
const INST = { de: { nombre: L.NOMBRES.de }, query: { nombre: L.NOMBRES.query }, automation: { nombre: L.NOMBRES.automation, carpeta: 708 } };
const DIARIA = { id: CFG().automation.id, name: 'CRM_Reporte_Diario', categoryId: 708, status: 'Scheduled', statusId: 6, lastRunTime: '2026-10-22T00:08:01.243',
  schedule: { id: 'x', typeId: 3, startDate: '2026-08-21T00:08:00', endDate: '2079-06-06T00:00:00', scheduledTime: '2026-10-23T00:08:00', rangeTypeId: 1, occurrences: 19282, pattern: '<Pattern><PatternType>0</PatternType><DayInterval>1</DayInterval></Pattern>', icalRecur: 'FREQ=DAILY;UNTIL=20790606;INTERVAL=1', timezoneName: 'Central Standard Time (no DST)', scheduleStatus: 'active', timezoneId: 1 } };
const AHORA = Date.UTC(2026, 9, 22, 23, 30, 0);
const LEGACY = 'dDZjVVh6NkRMME9aMV8tOFNMYlptdzoyNTow', LEGACY_H = 'MEJ0MGpWWkVmMENwUnp3dVl0allNQTozNjow';          // ids legacy reales (base64url): el de la automation y el de su horario

test('proximaCorrida: la hora de la cuenta siguiente, al menos 15 min en el futuro; y rechaza horas mal escritas', () => {
  assert.equal(L.proximaCorrida({ ahoraMs: AHORA, offsetHoras: -6, hora: '00:50' }), '2026-10-23T00:50:00');
  assert.equal(L.proximaCorrida({ ahoraMs: Date.UTC(2026, 9, 22, 5, 0, 0), offsetHoras: -6, hora: '00:50' }), '2026-10-22T00:50:00', 'si falta mas de 15 min, es hoy');
  assert.equal(L.proximaCorrida({ ahoraMs: Date.UTC(2026, 9, 22, 6, 40, 0), offsetHoras: -6, hora: '00:50' }), '2026-10-23T00:50:00', 'si faltan menos de 15 min, es manana');
  for (const mal of ['25:00', '0:5', 'medianoche', '12:60', '']) assert.throws(() => L.proximaCorrida({ ahoraMs: AHORA, hora: mal }), L.ErrorInstalacion, mal);
});
test('cuerpoHorario copia el horario de la automation del reporte (zona, patron diario, fin) con otra hora; sin horario que copiar lanza', () => {
  const s = L.cuerpoHorario(DIARIA.schedule, { ahoraMs: AHORA, offsetHoras: -6, hora: '00:50' });
  assert.deepEqual(s, { typeId: 3, startDate: '2026-10-23T00:50:00', endDate: '2079-06-06T00:00:00', rangeTypeId: 1, icalRecur: 'FREQ=DAILY;UNTIL=20790606;INTERVAL=1', timezoneName: 'Central Standard Time (no DST)', timezoneId: 1, pattern: DIARIA.schedule.pattern });
  assert.equal(s.id, undefined); assert.equal(s.scheduledTime, undefined); assert.equal(s.occurrences, undefined);
  assert.equal(s.scheduleStatus, undefined, 'SFMC lo ignora al crear (la automation nace en PausedSchedule con o sin el): el horario se ACTIVA despues, por el endpoint legacy');
  assert.throws(() => L.cuerpoHorario(undefined, { ahoraMs: AHORA, hora: '00:50' }), L.ErrorInstalacion);
});
test('cuerposCreacion: el horario va en startSource.schedule (con `schedule` suelto SFMC lo ignora y la deja en Ready); el 2o cuerpo solo agrega typeId/type', () => {
  const s = L.cuerpoHorario(DIARIA.schedule, { ahoraMs: AHORA, offsetHoras: -6, hora: '00:50' });
  const [a, b] = L.cuerposCreacion(L.cuerpoAutomation(IDQ, 708, 'x'), s);
  assert.deepEqual(a.startSource, { typeId: 1, schedule: s }); assert.equal(a.schedule, undefined); assert.equal(a.typeId, undefined);
  assert.deepEqual(b.startSource, { typeId: 1, schedule: s }); assert.equal(b.typeId, 1); assert.equal(b.type, 'scheduled');
  assert.equal(a.steps[0].activities.length, 1, 'una sola actividad: la query');
});
test('estaProgramada: Scheduled (o statusId 6) y, si se pide una hora, con su proxima corrida a esa hora; PausedSchedule, Ready o sin horario no cuentan', () => {
  const ok = { status: 'Scheduled', statusId: 6, schedule: { scheduledTime: '2026-10-23T00:50:00' } };
  assert.equal(L.estaProgramada(ok), true); assert.equal(L.estaProgramada(ok, '00:50'), true); assert.equal(L.estaProgramada(ok, '03:00'), false);
  assert.equal(L.estaProgramada({ statusId: 6, schedule: { startDate: '2026-10-23T03:00:00' } }, '03:00'), true, 'sin scheduledTime se usa startDate');
  for (const mal of [{ status: 'PausedSchedule', statusId: 4, schedule: { scheduledTime: '0001-01-01T00:00:00' } }, { status: 'Ready', statusId: 2 }, { status: 'Scheduled', statusId: 6 }, null, undefined]) assert.equal(L.estaProgramada(mal), false, JSON.stringify(mal));
});
test('difCampos: igual => []; detecta campo que falta, que sobra, otro tipo, otra llave y otro largo', () => {
  const reales = L.CAMPOS.map(c => ({ name: c.name, type: c.type, length: c.length || null, pk: !!c.pk }));
  assert.deepEqual(L.difCampos(reales), []);
  assert.match(L.difCampos(reales.filter(c => c.name !== 'ClickDay')).join('|'), /falta el campo ClickDay/);
  assert.match(L.difCampos([...reales, { name: 'Extra', type: 'Text' }]).join('|'), /sobra el campo Extra/);
  assert.match(L.difCampos(reales.map(c => (c.name === 'SendDay' ? { ...c, type: 'Text' } : c))).join('|'), /SendDay: tipo Text/);
  assert.match(L.difCampos(reales.map(c => (c.name === 'RowKey' ? { ...c, pk: false } : c))).join('|'), /RowKey: deberia ser llave primaria/);
  assert.match(L.difCampos(reales.map(c => (c.name === 'Link_URL' ? { ...c, length: 100 } : c))).join('|'), /Link_URL: largo 100/);
});

const fila = (o) => ({ RowKey: 'k' + Math.random(), JobID: '1', SendDay: '2026-10-01', ClickDay: '2026-10-02', ConfigKey: 'C1', Link_URL: 'u1', Clicks_Total: '5', ...o });
test('conciliar: un caso que cuadra (con un click cuyo envio ya caduco) es ok', () => {
  const nuevas = [fila({ RowKey: 'a', Clicks_Total: '5' }), fila({ RowKey: 'b', ClickDay: '2026-10-03', Clicks_Total: '3' }), fila({ RowKey: 'c', SendDay: '', ClickDay: '2026-05-02', JobID: '2', ConfigKey: 'C2', Link_URL: 'u2', Clicks_Total: '4' })];
  const links = [{ ConfigKey: 'C1', Link_URL: 'u1', Clicks_Total: '8' }, { ConfigKey: 'C2', Link_URL: 'u2', Clicks_Total: '4' }];
  const detalle = [{ RowKey: '1_20261001', Email_Total_Clicks: '8' }];
  const r = L.conciliar({ nuevas, links, detalle });
  assert.equal(r.ok, true, r.problemas.join('|')); assert.deepEqual(r.sinEnvio, { filas: 1, clicks: 4 });
  assert.deepEqual(r.detalle, { combinaciones: 1, iguales: 1, distintas: 0, ejemplos: [], diferenciaAbsoluta: 0 }); assert.equal(r.links.diferencia, 0);
  assert.equal(L.conciliar({ nuevas, links, detalle: [{ RowKey: '1_20261001', Email_Total_Clicks: '9' }] }).ok, true, 'un click de diferencia por llegada tardia entra en la tolerancia');
});
test('conciliar: varias combinaciones job x dia que difieren POCO (clicks tardios, 22-oct-2026: 6 combinaciones de 2 a 5 clicks) son ok; lo que no se perdona es el tamaño', () => {
  const links = [{ ConfigKey: 'C1', Link_URL: 'u1', Clicks_Total: '3000' }];
  const nuevas = Array.from({ length: 6 }, (_, i) => fila({ RowKey: 'k' + i, JobID: String(i + 1), Clicks_Total: String(500) }));
  const detalle = nuevas.map((f, i) => ({ RowKey: `${i + 1}_20261001`, Email_Total_Clicks: String(500 - (i + 1)) }));
  const r = L.conciliar({ nuevas, links, detalle }); assert.equal(r.ok, true, r.problemas.join('|')); assert.equal(r.detalle.distintas, 6); assert.equal(r.detalle.diferenciaAbsoluta, 1 + 2 + 3 + 4 + 5 + 6);
  const mal = L.conciliar({ nuevas, links, detalle: detalle.map((d, i) => (i === 0 ? { ...d, Email_Total_Clicks: '400' } : d)) }); assert.equal(mal.ok, false); assert.match(mal.problemas.join('|'), /difieren en mas de 10 clicks/);
});
test('conciliar: llave repetida, click antes del envio, tabla vacia, total muy distinto, job x dia que no cuadra: cada uno es un problema', () => {
  const links = [{ ConfigKey: 'C1', Link_URL: 'u1', Clicks_Total: '1000' }]; const detalle = [{ RowKey: '1_20261001', Email_Total_Clicks: '1000' }];
  const buena = [fila({ RowKey: 'a', Clicks_Total: '1000' })];
  assert.equal(L.conciliar({ nuevas: buena, links, detalle }).ok, true);
  assert.match(L.conciliar({ nuevas: [], links, detalle }).problemas.join('|'), /VACIA/);
  assert.match(L.conciliar({ nuevas: [fila({ RowKey: 'a', Clicks_Total: '500' }), fila({ RowKey: 'a', ClickDay: '2026-10-03', Clicks_Total: '500' })], links, detalle }).problemas.join('|'), /RowKey repetidas/);
  assert.match(L.conciliar({ nuevas: [fila({ RowKey: 'a', ClickDay: '2026-09-30', Clicks_Total: '1000' })], links, detalle }).problemas.join('|'), /ANTES del envio/);
  assert.match(L.conciliar({ nuevas: [fila({ RowKey: 'a', Clicks_Total: '900' })], links, detalle }).problemas.join('|'), /total de clicks difiere -100/);
  assert.match(L.conciliar({ nuevas: [fila({ RowKey: 'a', Clicks_Total: '1000' })], links, detalle: [{ RowKey: '1_20261001', Email_Total_Clicks: '700' }] }).problemas.join('|'), /difieren en mas de 10 clicks/);
});

// ---------- que los cuerpos que arma el modulo PASAN la guardia (y los de otro nombre no) ----------
test('los cuerpos que arma linksdia.js pasan la guardia en modo instalacion; el mismo cuerpo con otro nombre o destino NO', () => {
  const registro = new RegistroTemp(); const g = crearGuardia({ cfg: CFG(), registro, instalacion: INST });
  const KEY = 'AAAAAAAA-1111-2222-3333-444444444444', QID = 'bbbbbbbb-1111-2222-3333-444444444444', AID = 'cccccccc-1111-2222-3333-444444444444';
  const rest = (metodo, ruta, cuerpo) => ({ canal: 'rest', metodo, ruta, cuerpo });
  assert.ok(g.verificar(rest('POST', '/data/v1/customobjects', L.cuerpoDe(CFG(), '2026-10-22'))));
  registro.instalarDe(KEY); assert.ok(g.verificar(rest('POST', '/automation/v1/queries', L.cuerpoQuery(CFG(), 'SELECT 1', KEY, '2026-10-22'))));
  registro.instalarQuery(QID); assert.ok(g.verificar(rest('POST', '/automation/v1/automations', L.cuerpoAutomation(QID, 708, '2026-10-22'))));
  const horario = L.cuerpoHorario(DIARIA.schedule, { ahoraMs: AHORA, offsetHoras: -6, hora: '00:50' });
  for (const cuerpo of L.cuerposCreacion(L.cuerpoAutomation(QID, 708, '2026-10-22'), horario)) assert.ok(g.verificar(rest('POST', '/automation/v1/automations', cuerpo)), 'crearla YA CON su horario: ' + JSON.stringify(Object.keys(cuerpo)));
  registro.instalarAutomation(AID);
  assert.throws(() => g.verificar(rest('POST', `${L.RUTA_LEGACY}/?action=schedule`, { id: LEGACY, scheduleObject: { id: LEGACY_H } })), ErrorEscritura, 'el id legacy debe estar registrado ANTES');
  registro.instalarAutomationLegacy(LEGACY); assert.ok(g.verificar(rest('POST', `${L.RUTA_LEGACY}/?action=schedule`, { id: LEGACY, scheduleObject: { id: LEGACY_H } })), 'activar su horario');
  assert.throws(() => g.verificar(rest('POST', '/automation/v1/queries', { ...L.cuerpoQuery(CFG(), 'SELECT 1', KEY, 'x'), targetName: 'CRM_Email_Links' })), ErrorEscritura);
  assert.throws(() => g.verificar(rest('POST', '/automation/v1/automations', { ...L.cuerpoAutomation(QID, 708, 'x'), name: 'CRM_Reporte_Diario' })), ErrorEscritura);
  assert.equal(L.cuerpoAutomation(QID, 708, 'x').steps[0].activities.length, 1);
  assert.equal(L.cuerpoQuery(CFG(), 'SELECT 1', KEY, 'x').targetUpdateTypeId, 1, 'Update: un Overwrite perderia las filas de dias que las vistas de datos ya olvidaron');
  assert.ok(L.cuerpoDe(CFG(), 'x').fields.find(f => f.name === 'RowKey').IsPrimaryKey);
});

// ---------- el flujo completo contra un SFMC simulado ----------
const IDQ = 'bbbbbbbb-1111-2222-3333-444444444444', IDA = 'cccccccc-1111-2222-3333-444444444444', KEYDE = L.NOMBRES.de;          // la DE se crea con key = su nombre
const xmlOk = '<r><OverallStatus>OK</OverallStatus></r>';
/**
 * SFMC simulado SOLO para lo que escribe y lee el instalador por REST (las lecturas de DEs y la query temporal se inyectan como deps).
 * opciones: previo { de, query, automation } (ya existen), activacion ('ok' | 'no-activa' = el endpoint legacy responde 201 pero no hace nada | 'falla' = HTTP 500 | 'sin-legacyid' = la creacion no devuelve legacyId | 'ajeno' = el id legacy es de otra automation),
 *   automationTermina ('ok'|'Error': como termina su corrida unica), noDejaCorrer (SFMC rechaza el run once con 400), alteraQuery.
 * Como SFMC en vivo (22-oct-2026): POST con startSource.schedule => nace en PausedSchedule (con `schedule` suelto, en Ready y sin horario); PATCH / status / actions de activacion NO activan; el endpoint legacy SI.
 * /actions/runallonce solo funciona en Ready o PausedSchedule (en Scheduled da 400) y la automation vuelve a su estado de antes; /actions/start da 400 "Steps requerido".
 */
function mundo(o = {}) {
  const { previo = {}, activacion = 'ok', automationTermina = 'ok', noDejaCorrer = false, scopes = 'data_extensions_read data_extensions_write automations_read automations_write', rechazaPrimerCuerpoAutomation = false, alteraQuery = null, noPuedeBorrarAutomation = false, borraAutomationPorRest = false } = o;
  const w = { calls: [], de: previo.de ? { key: KEYDE } : null, query: previo.query ? { ...previo.query } : null, auto: previo.automation ? JSON.parse(JSON.stringify(previo.automation)) : null, cargaIniciada: false, getsAuto: 0, borrados: [], cuerposAuto: 0, escritos: [], legacyPosts: [] };
  const handler = conToken(async (c) => {
    const b = c.body ? (() => { try { return JSON.parse(c.body); } catch { return null; } })() : null;
    w.calls.push(c.path === '/Service.asmx' ? `SOAP ${c.headers.SOAPAction}` : `${c.method} ${c.path}`);
    if (c.method !== 'GET' && c.path !== '/v2/token') w.escritos.push(`${c.method} ${c.path}`);
    if (c.path === '/Service.asmx') {
      if (/<DeleteRequest/.test(c.body)) {
        if (/xsi:type="Automation"/.test(c.body)) { if (noPuedeBorrarAutomation) return { text: '<r><OverallStatus>Error</OverallStatus><Results><StatusMessage>no se puede borrar</StatusMessage></Results></r>' }; w.borrados.push('automation'); w.auto = null; }
        else { w.borrados.push('DE'); w.de = null; }
      }
      return { text: xmlOk };
    }
    let m;
    if (c.method === 'GET' && c.path === `/automation/v1/queries/${CFG().queries.links.id}`) return { json: { queryDefinitionId: CFG().queries.links.id, name: 'CRM_Email_Links_Load', queryText: SQL_LINKS, targetName: 'CRM_Email_Links', targetUpdateTypeId: 0 } };
    if (c.method === 'GET' && c.path === `/automation/v1/automations/${DIARIA.id}`) return { json: DIARIA };
    if (c.method === 'GET' && c.path.startsWith('/automation/v1/queries?')) return { json: { count: w.query ? 1 : 0, items: w.query ? [{ name: L.NOMBRES.query, queryDefinitionId: IDQ }] : [] } };
    if (c.method === 'GET' && c.path.startsWith('/automation/v1/automations?')) return { json: { count: w.auto ? 1 : 0, items: w.auto ? [{ name: L.NOMBRES.automation, id: IDA }] : [] } };
    if (c.method === 'POST' && c.path === '/data/v1/customobjects') { w.de = { key: b.key || KEYDE, campos: b.fields }; return { status: 201, json: { key: w.de.key } }; }
    if (c.method === 'POST' && c.path === '/automation/v1/queries') { w.query = { queryDefinitionId: IDQ, name: b.name, queryText: alteraQuery ? alteraQuery(b.queryText) : b.queryText, targetName: b.targetName, targetKey: b.targetKey, targetUpdateTypeId: b.targetUpdateTypeId, targetUpdateTypeName: 'Update', categoryId: b.categoryId, key: b.key, description: b.description }; return { status: 201, json: { queryDefinitionId: IDQ } }; }
    if ((m = /^\/automation\/v1\/queries\/([0-9a-f-]{36})(\/actions\/start\/?)?$/.exec(c.path))) {
      if (m[2]) { w.cargaIniciada = true; return { json: {} }; }
      if (c.method === 'GET') return { json: w.query };
      if (c.method === 'PATCH') { w.query = { ...w.query, ...b }; return { json: {} }; }
      if (c.method === 'DELETE') { w.borrados.push('query'); w.query = null; return { status: 200, json: {} }; }
    }
    if (c.method === 'POST' && c.path === '/automation/v1/automations') {
      w.cuerposAuto++; if (rechazaPrimerCuerpoAutomation && w.cuerposAuto === 1) return { status: 400, json: { message: 'typeId requerido' } };
      w.cuerpoAutomation = b;
      const conHorario = !!(b.startSource && b.startSource.schedule);                  // el horario solo se entiende dentro de startSource: con `schedule` suelto la automation queda en Ready, sin horario
      w.auto = { id: IDA, name: b.name, key: b.key, categoryId: b.categoryId, status: conHorario ? 'PausedSchedule' : 'Ready', statusId: conHorario ? 4 : 2, steps: b.steps, lastRunTime: null,
        schedule: conHorario ? { id: 'sch-1', ...b.startSource.schedule, scheduledTime: '0001-01-01T00:00:00', scheduleStatus: 'paused' } : { scheduleStatus: 'none' } };
      return { status: 201, json: { id: IDA, ...(activacion === 'sin-legacyid' ? {} : { legacyId: LEGACY }) } };
    }
    if (c.path.startsWith('/legacy/v1/beta/bulk/automations/automation/definition')) {
      if (c.method === 'GET') {
        if (!w.auto || c.path !== `/legacy/v1/beta/bulk/automations/automation/definition/${LEGACY}`) return { status: 404, json: { message: 'no existe' } };
        const nombre = activacion === 'ajeno' ? 'CRM_Reporte_Diario' : w.auto.name;
        return { json: { id: LEGACY, name: nombre, key: nombre, status: w.auto.status, scheduleObject: { id: LEGACY_H, scheduleStatus: 'paused' } } };
      }
      w.legacyPosts.push({ ruta: c.path, cuerpo: b });
      if (activacion === 'falla') return { status: 500, json: { message: 'error interno' } };
      if (activacion !== 'no-activa' && w.auto && w.auto.schedule && w.auto.schedule.startDate) { w.auto.status = 'Scheduled'; w.auto.statusId = 6; w.auto.schedule = { ...w.auto.schedule, scheduleStatus: 'active', scheduledTime: w.auto.schedule.startDate }; }
      return { status: 201, json: { id: b.id } };
    }
    if ((m = /^\/automation\/v1\/automations\/([0-9a-f-]{36})(\/actions\/(start|runallonce)\/?)?$/.exec(c.path))) {
      if (!w.auto) return { status: 404, json: { message: 'no existe' } };
      if (m[2]) {
        if (m[3] === 'start') return { status: 400, json: { errors: [{ message: "The following field is required: 'Steps'." }] } };
        if (noDejaCorrer || !['Ready', 'PausedSchedule'].includes(w.auto.status)) return { status: 400, json: { errors: [{ message: 'The automation is in the wrong status for a run once. It must either be in a ready or paused schedule status.' }] } };
        w.estadoAntes = { status: w.auto.status, statusId: w.auto.statusId }; w.auto.status = 'Running'; w.auto.statusId = 3; w.getsAuto = 0; return { json: {} };
      }
      if (c.method === 'GET') {
        if (w.auto.status === 'Running') { w.getsAuto++; if (w.getsAuto >= 2) { w.auto.status = automationTermina === 'Error' ? 'Error' : w.estadoAntes.status; w.auto.statusId = automationTermina === 'Error' ? 9 : w.estadoAntes.statusId; w.auto.lastRunTime = '2026-10-22T18:50:30.000'; } }
        return { json: w.auto };
      }
      if (c.method === 'PATCH') return { json: {} };                                     // como SFMC en vivo: responde 200 y NO cambia nada (ni status, ni statusId, ni schedule)
      if (c.method === 'DELETE') { if (!borraAutomationPorRest) return { status: 404, json: { message: 'no encontrado' } }; w.borrados.push('automation'); w.auto = null; return { json: {} }; }          // en vivo: DELETE de una automation por REST da 404
    }
    return { status: 404, json: { message: 'no simulado: ' + c.method + ' ' + c.path } };
  }, { scope: scopes });
  let t = AHORA;
  const cli = crearCliente({ cred: cred(), cfg: CFG(), instalacion: INST, httpsRequest: fakeHttp(handler), ahora: () => t, dormir: async (ms) => { t += ms; } });
  return { w, cli, avanzar: (ms) => { t += ms; } };
}
const CAMPOS_REALES = () => L.CAMPOS.map(c => ({ name: c.name, type: c.type, length: c.length || null, pk: !!c.pk }));
/** las dependencias de datos: todo en memoria. `nuevas` = lo que la query cargaria. */
function deps(m, { nuevas = null, conteos = null, prueba = 'ok' } = {}) {
  const base = [fila({ RowKey: 'a', Clicks_Total: '5' }), fila({ RowKey: 'b', ClickDay: '2026-10-03', Clicks_Total: '3' })];
  const cuerpo = nuevas || base;
  return {
    dormir: async (ms) => m.avanzar(ms),
    consultar: async () => (prueba === 'ok' ? { completo: true, filas: cuerpo, segundos: 12 } : prueba === 'vacia' ? { completo: true, filas: [], segundos: 12 } : { completo: false, filas: [], segundos: 1800 }),
    infoDe: async () => { if (!m.w.de) throw new Error('La DE "x" no existe en esta BU'); return { key: m.w.de.key }; },
    columnas: async () => { if (!m.w.de) throw new Error('La DE "x" no existe en esta BU'); return m.w.deCamposReales || CAMPOS_REALES(); },
    leerFilas: async (cli, nombre) => {
      if (nombre === L.NOMBRES.de) { if (!m.w.cargaIniciada) return []; return conteos ? conteos() : cuerpo; }
      if (nombre === 'CRM_Email_Links') return [{ ConfigKey: 'C1', Link_URL: 'u1', Clicks_Total: '8' }];
      if (nombre === 'CRM_Email_Detalle') return [{ RowKey: '1_20261001', Email_Total_Clicks: '8' }];
      return [];
    },
    iniciarQuery: async (cli, id) => { await cli.rest(`/automation/v1/queries/${id}/actions/start/`, 'POST', {}); },
  };
}
const correr = (m, opts = {}, d = {}) => L.instalar(m.cli, CFG(), { log: () => {}, ...opts }, { ...deps(m, d.cfg || {}), ...(d.sobre || {}) });
const escrituras = (w) => w.escritos;
const previoCompleto = () => ({ de: true, query: { queryDefinitionId: IDQ, name: L.NOMBRES.query, queryText: L.construirSql(SQL_LINKS), targetName: L.NOMBRES.de, targetKey: KEYDE, targetUpdateTypeId: 1, targetUpdateTypeName: 'Update', categoryId: 460279 },
  automation: { id: IDA, name: L.NOMBRES.automation, status: 'Scheduled', statusId: 6, lastRunTime: '2026-10-22T00:50:01.000', steps: [{ step: 1, activities: [{ name: L.NOMBRES.query, activityObjectId: IDQ, objectTypeId: 300 }] }], schedule: { typeId: 3, scheduledTime: '2026-10-23T00:50:00' } } });

test('SIMULACRO: prueba el SQL en una query temporal, cuenta lo que existe y NO escribe nada (cero POST/PATCH/DELETE)', async () => {
  const m = mundo(); const r = await correr(m);
  assert.equal(r.estado, 'simulacro'); assert.equal(r.plan.filasDePrueba, 2); assert.deepEqual(r.plan.existente, { de: false, query: false, automation: false });
  assert.equal(r.plan.horario.startDate, '2026-10-23T00:50:00'); assert.deepEqual(escrituras(m.w), [], 'un simulacro no escribe');
});
test('INSTALA: crea DE, query (Update) y automation YA CON su horario (nace PausedSchedule), corre la query, concilia, corre la automation UNA vez (run once solo en Ready/PausedSchedule), activa el horario por el endpoint legacy y queda Scheduled', async () => {
  const m = mundo(); const r = await correr(m, { escribir: true });
  assert.equal(r.estado, 'instalado', JSON.stringify(r).slice(0, 300));
  assert.deepEqual(r.registros, ['DE creada', 'query creada', 'automation creada', 'automation probada', 'automation programada']);
  assert.equal(r.pruebaAutomation.status, 'PausedSchedule', 'la corrida unica devuelve la automation a su estado de antes, y recien despues se activa');
  assert.deepEqual(r.ids, { de: KEYDE, query: IDQ, automation: IDA }); assert.equal(r.automation.status, 'Scheduled'); assert.equal(r.automation.proxima, '2026-10-23T00:50:00'); assert.equal(r.carga.filas, 2);
  assert.equal(r.conciliacion.ok, true);
  assert.equal(m.w.query.targetUpdateTypeId, 1); assert.equal(m.w.query.targetName, L.NOMBRES.de); assert.equal(m.w.auto.steps[0].activities[0].activityObjectId, IDQ);
  const orden = escrituras(m.w).map(x => x.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/, 'ID'));
  assert.deepEqual(orden.slice(0, 3), ['POST /data/v1/customobjects', 'POST /automation/v1/queries', 'POST /automation/v1/queries/ID/actions/start/'], 'primero la DE, despues la query, despues se corre');
  assert.deepEqual(orden.slice(3), ['POST /automation/v1/automations', 'POST /automation/v1/automations/ID/actions/runallonce', 'POST /legacy/v1/beta/bulk/automations/automation/definition/?action=schedule'], 'se crea con su horario, se corre una vez ANTES de activarla (Scheduled no la deja) y se activa por el endpoint legacy; NINGUN PATCH y NUNCA /actions/start');
  assert.deepEqual(m.w.cuerpoAutomation.startSource, { typeId: 1, schedule: L.cuerpoHorario(DIARIA.schedule, { ahoraMs: AHORA, offsetHoras: -6, hora: '00:50' }) }, 'el horario va en startSource.schedule');
  assert.deepEqual(m.w.legacyPosts, [{ ruta: '/legacy/v1/beta/bulk/automations/automation/definition/?action=schedule', cuerpo: { id: LEGACY, scheduleObject: { id: LEGACY_H } } }], 'cuerpo minimo: el id legacy y el id de su horario');
  assert.equal(m.w.borrados.length, 0);
});
test('si SFMC rechaza el primer cuerpo de la automation, reintenta con typeId/type (sin perder el horario)', async () => {
  const m = mundo({ rechazaPrimerCuerpoAutomation: true }); const r = await correr(m, { escribir: true, probarAutomation: false });
  assert.equal(r.estado, 'instalado'); assert.equal(m.w.cuerposAuto, 2); assert.equal(m.w.cuerpoAutomation.typeId, 1); assert.equal(m.w.cuerpoAutomation.type, 'scheduled'); assert.ok(m.w.cuerpoAutomation.startSource.schedule);
  assert.equal(r.pruebaAutomation, null, '--sin-prueba no corre la automation');
});
test('IDEMPOTENTE: si todo ya existe, es igual y esta programada a esa hora, no escribe nada', async () => {
  const m = mundo({ previo: previoCompleto() }); const r = await correr(m, { escribir: true });
  assert.equal(r.estado, 'ya-instalado'); assert.deepEqual(escrituras(m.w), []);
});
test('ADOPTA lo que ya existe: con la DE y la query puestas crea solo la automation', async () => {
  const p = previoCompleto(); const m = mundo({ previo: { de: true, query: p.query } }); const r = await correr(m, { escribir: true, probarAutomation: false });
  assert.equal(r.estado, 'instalado'); assert.deepEqual(r.registros, ['DE adoptada', 'query adoptada', 'automation creada', 'automation programada']);
  assert.ok(!escrituras(m.w).includes('POST /data/v1/customobjects')); assert.equal(m.w.borrados.length, 0);
});
test('SQL distinto en la query existente: se RECHAZA sin --actualizar; con --actualizar la reemplaza (PATCH) y sigue', async () => {
  const p = previoCompleto(); p.query.queryText = 'SELECT 1'; p.automation = undefined;
  const m = mundo({ previo: { de: true, query: p.query } }); const r = await correr(m, { escribir: true });
  assert.equal(r.estado, 'rechazado'); assert.match(r.motivo, /--actualizar/); assert.deepEqual(escrituras(m.w), []);
  const m2 = mundo({ previo: { de: true, query: { ...p.query } } }); const r2 = await correr(m2, { escribir: true, actualizar: true, probarAutomation: false });
  assert.equal(r2.estado, 'instalado'); assert.ok(r2.registros.includes('SQL actualizado')); assert.equal(norm(m2.w.query.queryText), norm(L.construirSql(SQL_LINKS)));
});
const norm = (s) => String(s).replace(/\r\n/g, '\n').trim();
test('RECHAZA sin escribir: faltan permisos, la query existente carga otra DE o es Overwrite, la DE existente tiene otra estructura, la automation existente tiene otra actividad', async () => {
  let m = mundo({ scopes: 'data_extensions_read automations_read' }); let r = await correr(m, { escribir: true });
  assert.equal(r.estado, 'rechazado'); assert.match(r.motivo, /automations_write/); assert.deepEqual(escrituras(m.w), []);
  const p = previoCompleto();
  m = mundo({ previo: { de: true, query: { ...p.query, targetName: 'CRM_Email_Links' } } }); r = await correr(m, { escribir: true }); assert.equal(r.estado, 'rechazado'); assert.match(r.motivo, /carga "CRM_Email_Links"/);
  m = mundo({ previo: { de: true, query: { ...p.query, targetUpdateTypeId: 0, targetUpdateTypeName: 'Overwrite' } } }); r = await correr(m, { escribir: true }); assert.equal(r.estado, 'rechazado'); assert.match(r.motivo, /no es de tipo Update/);
  m = mundo({ previo: { de: true } }); m.w.deCamposReales = CAMPOS_REALES().filter(c => c.name !== 'ClickDay'); r = await correr(m, { escribir: true }); assert.equal(r.estado, 'rechazado'); assert.match(r.motivo, /falta el campo ClickDay/);
  m = mundo({ previo: { de: true, query: p.query, automation: { ...p.automation, steps: [{ step: 1, activities: [{ activityObjectId: 'otra' }, { activityObjectId: IDQ }] }] } } }); r = await correr(m, { escribir: true }); assert.equal(r.estado, 'rechazado'); assert.match(r.motivo, /UN paso con UNA actividad/);
  for (const x of [m]) assert.deepEqual(escrituras(x.w), []);
});
test('RECHAZA si el SQL no termina o no devuelve filas en la query temporal: no crea nada', async () => {
  for (const prueba of ['vacia', 'incompleta']) { const m = mundo(); const r = await correr(m, { escribir: true }, { cfg: { prueba } }); assert.equal(r.estado, 'rechazado', prueba); assert.deepEqual(escrituras(m.w), []); }
});
test('REVIERTE todo lo que creo si la tabla cargada no cuadra (llaves repetidas): borra la query y la DE, y dice por que', async () => {
  const m = mundo(); const repetidas = [fila({ RowKey: 'a', Clicks_Total: '5' }), fila({ RowKey: 'a', ClickDay: '2026-10-03', Clicks_Total: '3' })];
  const r = await correr(m, { escribir: true }, { cfg: { nuevas: repetidas } });
  assert.equal(r.estado, 'revertido'); assert.match(r.motivo, /NO cuadra/); assert.match(r.motivo, /RowKey repetidas/); assert.deepEqual(r.creadosYBorrados.sort(), ['de', 'query']); assert.deepEqual(m.w.borrados, ['query', 'DE']);
  assert.equal(m.w.de, null); assert.equal(m.w.query, null); assert.equal(m.w.auto, null); assert.deepEqual(r.fallosAlRevertir, []);
});
test('SIN PROGRAMAR: si no se puede activar el horario la tabla NO se revierte (ya esta cargada y conciliada): se queda todo, el mensaje dice como activarla a mano, y repetir el script la borra y la vuelve a crear', async () => {
  const casos = { 'falla': /no activo el horario: HTTP 500/, 'sin-legacyid': /no devolvio el id legacy/, 'ajeno': /apunta a "CRM_Reporte_Diario" y no a CRM_Reporte_Links_Dia: no se activa nada/, 'no-activa': /acepto activarla pero la automation quedo "PausedSchedule"/ };
  for (const [activacion, esperado] of Object.entries(casos)) {
    const m = mundo({ activacion }); const r = await correr(m, { escribir: true });
    assert.equal(r.estado, 'sin-programar', activacion); assert.match(r.motivo, esperado, activacion); assert.match(r.motivo, /Automation Studio > CRM_Reporte_Links_Dia > Schedule > Active/); assert.deepEqual(m.w.borrados, [], 'no borra nada');
    assert.ok(m.w.de && m.w.query && m.w.auto); assert.equal(r.ids.automation, IDA); assert.equal(r.conciliacion.ok, true); assert.deepEqual(r.registros, ['DE creada', 'query creada', 'automation creada', 'automation probada']); assert.equal(r.automation.status, 'PausedSchedule');
    if (activacion === 'ajeno') assert.deepEqual(m.w.legacyPosts, [], 'si el id legacy no es el nuestro NO se activa nada');
  }
  const m = mundo({ activacion: 'falla' }); await correr(m, { escribir: true });
  const m2 = mundo({ previo: { de: true, query: m.w.query, automation: m.w.auto } }); const r2 = await correr(m2, { escribir: true, probarAutomation: false });          // se repite el script: la automation sigue en PausedSchedule
  assert.equal(r2.estado, 'instalado', JSON.stringify(r2).slice(0, 300)); assert.deepEqual(r2.registros, ['DE adoptada', 'query adoptada', 'automation creada', 'automation programada']);
  assert.deepEqual(m2.w.borrados, ['automation'], 'la que quedo sin activar se borra (por SOAP: REST da 404) y se vuelve a crear, que es lo que devuelve el id legacy'); assert.equal(m2.w.auto.status, 'Scheduled');
});
test('una automation propia que ya existe: Scheduled => se respeta (aunque este a otra hora); PausedSchedule o a otra hora PEDIDA con --hora => se borra y se vuelve a crear; CORRIENDO => no se toca', async () => {
  const p = previoCompleto();
  const m1 = mundo({ previo: { ...p, automation: { ...p.automation, schedule: { typeId: 3, scheduledTime: '2026-10-23T03:00:00' } } } }); const r1 = await correr(m1, { escribir: true });
  assert.equal(r1.estado, 'ya-instalado', 'programada a las 03:00 sin pedir hora: alguien la movio a mano y no se le contradice'); assert.deepEqual(escrituras(m1.w), []);
  const m1b = mundo({ previo: { ...p, automation: { ...p.automation, schedule: { typeId: 3, scheduledTime: '2026-10-23T03:00:00' } } } }); const r1b = await correr(m1b, { escribir: true, hora: '00:50', probarAutomation: false });
  assert.equal(r1b.estado, 'instalado', JSON.stringify(r1b).slice(0, 300)); assert.equal(r1b.plan.automationRecrear, 'otra-hora'); assert.deepEqual(m1b.w.borrados, ['automation']); assert.equal(m1b.w.auto.schedule.scheduledTime, '2026-10-23T00:50:00');
  const m2 = mundo({ previo: { ...p, automation: { ...p.automation, status: 'PausedSchedule', statusId: 4, schedule: { typeId: 3, scheduledTime: '0001-01-01T00:00:00' } } } });
  const sim = await correr(m2); assert.equal(sim.estado, 'simulacro'); assert.equal(sim.plan.automationRecrear, 'sin-programar'); assert.equal(sim.plan.automationObsoleta, false); assert.deepEqual(escrituras(m2.w), [], 'el simulacro avisa y no borra');
  const r2 = await correr(m2, { escribir: true, probarAutomation: false }); assert.equal(r2.estado, 'instalado'); assert.deepEqual(m2.w.borrados, ['automation']); assert.equal(m2.w.auto.status, 'Scheduled');
  const m3 = mundo({ previo: { ...p, automation: { ...p.automation, status: 'Running', statusId: 3 } } }); const r3 = await correr(m3, { escribir: true });
  assert.equal(r3.estado, 'rechazado'); assert.match(r3.motivo, /CORRIENDO ahora mismo/); assert.deepEqual(escrituras(m3.w), []);
});
test('SFMC nace toda automation de la API en PausedSchedule y PATCH no la activa (probado en vivo el 22-oct-2026): el instalador NUNCA manda un PATCH a la automation ni intenta rutas de activacion que no existen', async () => {
  const m = mundo(); await correr(m, { escribir: true });
  assert.ok(!escrituras(m.w).some((x) => /^PATCH \/automation\/v1\/automations/.test(x)), escrituras(m.w).join(' | '));
  assert.ok(!escrituras(m.w).some((x) => /\/actions\/(resume|resumeschedule|startschedule|activate|start)\/?$/.test(x) && /\/automations\//.test(x)), 'ni /actions/start (exige los pasos en el cuerpo) ni las de activacion');
});
test('"run once" solo funciona en Ready o PausedSchedule: si SFMC no deja correrla, la prueba se OMITE y se dice (la instalacion sigue y queda Scheduled); una automation adoptada que ya esta Scheduled tampoco se puede correr y se omite sin intentarlo', async () => {
  const m = mundo({ noDejaCorrer: true }); const r = await correr(m, { escribir: true });
  assert.equal(r.estado, 'instalado', JSON.stringify(r).slice(0, 300)); assert.equal(r.pruebaAutomation.omitida, true); assert.match(r.pruebaAutomation.motivo, /no dejo correrla una vez: HTTP 400.*wrong status/);
  assert.deepEqual(r.registros, ['DE creada', 'query creada', 'automation creada', 'automation programada']); assert.equal(r.automation.status, 'Scheduled'); assert.deepEqual(m.w.borrados, []);
  const p = previoCompleto(); p.query.queryText = 'SELECT 1';                          // con otro SQL no es 'ya-instalado': la query se actualiza y la automation Scheduled se adopta
  const m2 = mundo({ previo: p }); const r2 = await correr(m2, { escribir: true, actualizar: true });
  assert.equal(r2.estado, 'instalado', JSON.stringify(r2).slice(0, 300)); assert.equal(r2.pruebaAutomation.omitida, true); assert.match(r2.pruebaAutomation.motivo, /ya estaba programada/);
  assert.ok(!escrituras(m2.w).some((x) => /\/automations\/.*\/actions\//.test(x)), 'no intenta correr una automation Scheduled');
});
test('AUTOMATION OBSOLETA de un intento anterior (apunta a una query que ya no existe): se borra por SOAP (REST da 404) y se vuelve a crear todo; en simulacro solo se avisa', async () => {
  const vieja = { id: IDA, name: L.NOMBRES.automation, status: 'PausedSchedule', statusId: 4, steps: [{ step: 1, activities: [{ name: L.NOMBRES.query, activityObjectId: '374dceae-17c6-401f-80c0-607f1093a63c', objectTypeId: 300 }] }] };
  const m0 = mundo({ previo: { automation: vieja } }); const sim = await correr(m0); assert.equal(sim.estado, 'simulacro'); assert.equal(sim.plan.automationObsoleta, true); assert.deepEqual(escrituras(m0.w), []);
  const m = mundo({ previo: { automation: vieja } }); const r = await correr(m, { escribir: true, probarAutomation: false });
  assert.equal(r.estado, 'instalado', JSON.stringify(r).slice(0, 300)); assert.deepEqual(r.registros, ['DE creada', 'query creada', 'automation creada', 'automation programada']);
  assert.deepEqual(m.w.borrados, ['automation'], 'la vieja se borro una vez, antes de crear nada'); assert.equal(m.w.auto.steps[0].activities[0].activityObjectId, IDQ, 'la nueva apunta a la query nueva');
  const orden = escrituras(m.w); assert.ok(orden.indexOf('POST /Service.asmx') >= 0 && orden.indexOf('POST /Service.asmx') < orden.indexOf('POST /data/v1/customobjects'), 'primero se limpia (SOAP Delete), despues se crea');
});
test('si la automation obsoleta no se puede borrar (ni por REST ni por SOAP) se RECHAZA sin crear nada y se dice que se borre a mano', async () => {
  const vieja = { id: IDA, name: L.NOMBRES.automation, status: 'PausedSchedule', steps: [{ step: 1, activities: [{ name: L.NOMBRES.query, activityObjectId: '374dceae-17c6-401f-80c0-607f1093a63c', objectTypeId: 300 }] }] };
  const m = mundo({ previo: { automation: vieja }, noPuedeBorrarAutomation: true }); const r = await correr(m, { escribir: true });
  assert.equal(r.estado, 'rechazado'); assert.match(r.motivo, /Borrala a mano en Automation Studio/); assert.ok(!m.w.escritos.includes('POST /data/v1/customobjects'), 'no creo nada');
});
test('ROLLBACK: si la automation no se puede borrar, se DEJAN la query y la DE (no dejar una automation apuntando a nada) y se dice', async () => {
  const m = mundo({ automationTermina: 'Error', noPuedeBorrarAutomation: true }); const r = await correr(m, { escribir: true });
  assert.equal(r.estado, 'revertido'); assert.deepEqual(r.creadosYBorrados, []); assert.ok(r.fallosAlRevertir.some(x => /Se DEJARON la query y la DE/.test(x)));
  assert.deepEqual(m.w.borrados, [], 'ni la query ni la DE se tocaron'); assert.ok(m.w.de && m.w.query && m.w.auto);
});
test('REVIERTE si la automation termina en Error al probarla; y con --conservar NO borra nada y relanza el error', async () => {
  const m = mundo({ automationTermina: 'Error' }); const r = await correr(m, { escribir: true });
  assert.equal(r.estado, 'revertido'); assert.match(r.motivo, /termino en estado "Error"/); assert.deepEqual(m.w.borrados, ['automation', 'query', 'DE']);
  const m2 = mundo({ automationTermina: 'Error' });
  await assert.rejects(() => correr(m2, { escribir: true, conservar: true }), /termino en estado "Error"/); assert.deepEqual(m2.w.borrados, []);
});
test('REVIERTE si SFMC guarda la query distinta de lo enviado (otro SQL)', async () => {
  const m = mundo({ alteraQuery: (sql) => sql + '\n-- alterado' }); const r = await correr(m, { escribir: true });
  assert.equal(r.estado, 'revertido'); assert.match(r.motivo, /guardo la query distinta/); assert.deepEqual(m.w.borrados, ['query', 'DE']);
});
test('esperarCarga: espera a que el conteo se repita 3 veces seguidas (la carga llega por lotes) y falla si nunca se estabiliza', async () => {
  const m = mundo(); const lotes = [0, 500, 1200, 1200, 1900, 1900, 1900, 1900]; let i = 0;
  const d = { dormir: async (ms) => m.avanzar(ms), leerFilas: async () => Array.from({ length: lotes[Math.min(i++, lotes.length - 1)] }, () => ({})) };
  const r = await L.esperarCarga(m.cli, d, { pollMs: 1000, timeoutS: 600 }); assert.equal(r.filas, 1900);
  let k = 0; const crece = { dormir: d.dormir, leerFilas: async () => Array.from({ length: ++k }, () => ({})) };
  await assert.rejects(() => L.esperarCarga(m.cli, crece, { pollMs: 1000, timeoutS: 30 }), /no se estabilizo/);
});
