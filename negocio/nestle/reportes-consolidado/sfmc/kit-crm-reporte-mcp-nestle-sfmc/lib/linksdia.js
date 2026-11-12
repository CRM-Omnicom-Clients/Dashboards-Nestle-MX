'use strict';
// CRM_Email_Links_Dia — clicks por link CON FECHA DEL CLICK (y fecha de envio), cargada cada noche por su PROPIA automation.
//
// Por que existe: CRM_Email_Links (clicks por link y pieza) NO dice cuando ocurrio cada click. Una pieza que manda en varias quincenas ocupa varias filas del reporte y el desglose
// de clicks (CTA, baja, redes+navegador+legal, medidos) repetia el total de la pieza en TODAS (22-oct-2026: +71 % de clicks "medidos"). Esta tabla trae el dia del click (ClickDay) y el dia
// en que salio ese correo (SendDay, el mismo que usa CRM_Email_Detalle), asi quien la consume elige a que fila-quincena lo asigna.
//
// Grano: JobID x SendDay x ClickDay x link. Update type: las filas de dias que las vistas de datos de SFMC ya olvidaron (6 meses) se CONSERVAN (un Overwrite las perderia).
// SendDay queda vacio cuando el envio ya salio de las vistas pero el click sigue ahi: el click no se pierde (la suma total cuadra con CRM_Email_Links).
// La query reusa EXACTO el Link_Name / Link_URL de la query vigente de Links (se leen de ella al instalar): las dos tablas clasifican igual.
//
// Seguridad: este modulo solo escribe a traves de la guardia en MODO INSTALACION (lib/guardia.js): tres objetos con nombre escrito aqui y registrados en esta corrida. Si algo no cuadra se REVIERTE
// lo que esta corrida creo. Por defecto es SIMULACRO.
const D = require('./de');
const { parseFechaSfmc } = require('./fechas');
const { redact } = require('./credenciales');
const { esc } = require('./xml');

class ErrorInstalacion extends Error { constructor(msg, extra) { super(msg); this.name = 'ErrorInstalacion'; Object.assign(this, extra || {}); } }

const NOMBRES = Object.freeze({ de: 'CRM_Email_Links_Dia', query: 'CRM_Email_Links_Dia_Load', automation: 'CRM_Reporte_Links_Dia' });
const HORA_DEFECTO = '00:50';                       // Central, despues de la automation del reporte (00:08, ~15 min): no compiten por el motor
const TIPO_UPDATE = 1;
const CAMPOS = Object.freeze([
  { name: 'RowKey', type: 'Text', length: 200, pk: true },
  { name: 'JobID', type: 'Number' }, { name: 'SendDay', type: 'Date' }, { name: 'ClickDay', type: 'Date' },
  { name: 'ConfigKey', type: 'Text', length: 50 }, { name: 'EmailName', type: 'Text', length: 200 }, { name: 'Email_ID', type: 'Number' },
  { name: 'Link_Name', type: 'Text', length: 200 }, { name: 'Link_URL', type: 'Text', length: 500 },
  { name: 'Clicks_Total', type: 'Number' }, { name: 'Clicks_Unique', type: 'Number' }, { name: 'LastRefresh', type: 'Date' },
]);

const norm = (s) => String(s == null ? '' : s).replace(/\r\n/g, '\n').trim();
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fechaDia = (v) => { const s = String(v == null ? '' : v).trim(); if (!s) return ''; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`; const ms = parseFechaSfmc(s, 0); return ms == null ? s : new Date(ms).toISOString().slice(0, 10); };

// ---------- el SQL ----------
/** Del SQL vigente de la query de Links: las expresiones de Link_Name y de Link_URL (largas, con AMPscript y URLs: se reusan tal cual, no se reescriben). Lanza si ya no las reconoce. */
function extraerExpresiones(sqlLinks) {
  const s = String(sqlLinks == null ? '' : sqlLinks);
  const iNombre = s.indexOf('CASE WHEN MAX(RTRIM(k.LinkName))'), finNombre = s.indexOf('AS Link_Name,'), finUrl = s.indexOf('AS Link_URL,');
  if (iNombre < 0 || finNombre <= iNombre || finUrl <= finNombre) throw new ErrorInstalacion('No reconozco la query de Links vigente (no encuentro las expresiones de Link_Name y Link_URL): no se instala nada. Si alguien la reescribio, hay que actualizar lib/linksdia.js.');
  const nombre = s.slice(iNombre, finNombre).trim(), url = s.slice(finNombre + 'AS Link_Name,'.length, finUrl).trim();
  for (const [que, e] of [['Link_Name', nombre], ['Link_URL', url]]) {
    if ((e.match(/\(/g) || []).length !== (e.match(/\)/g) || []).length || /\bFROM\b/i.test(e) || !e) throw new ErrorInstalacion(`La expresion de ${que} de la query de Links no tiene la forma esperada (parentesis desbalanceados o trae un FROM): no se instala nada.`);
  }
  return { nombre, url };
}

const LLAVE = "CONVERT(varchar(20), k.JobID) + '_' + ISNULL(CONVERT(varchar(8), s.EventDate, 112), '00000000') + '_' + CONVERT(varchar(8), k.EventDate, 112) + '|' + c.ConfigKey + '|' + CONVERT(varchar(40), HASHBYTES('SHA1', ISNULL(LEFT(RTRIM(k.URL), 500), '')), 2)";

/** El SQL de la query de carga. La llave es un HASH de la URL: la URL entera (AMPscript de ~400 caracteres) se truncaba a la mitad de la llave y dos URLs con el mismo comienzo habrian chocado. */
function construirSql(sqlLinks) {
  const { nombre, url } = extraerExpresiones(sqlLinks);
  return `/*  ${NOMBRES.de} — clicks por link CON FECHA DEL CLICK. Grano: 1 renglon por JobID x dia de ENVIO x dia del CLICK x link.
    ClickDay = el dia en que la persona hizo click (_Click.EventDate). SendDay = el dia en que SALIO ese correo (_Sent.EventDate, el mismo que usa CRM_Email_Detalle);
    queda VACIO cuando el envio ya salio de las vistas de datos (6 meses) pero el click sigue ahi: el click no se pierde.
    Sumando Clicks_Total por JobID y SendDay se obtiene Email_Total_Clicks del Detalle; sumando todo, el total de CRM_Email_Links.
    RowKey lleva un HASH de la URL (no la URL). Update type: las filas de dias que las vistas de datos ya olvidaron se conservan. */
SELECT
    ${LLAVE}                                    AS RowKey,
    k.JobID                                     AS JobID,
    CONVERT(date, s.EventDate)                  AS SendDay,
    CONVERT(date, k.EventDate)                  AS ClickDay,
    MAX(c.ConfigKey)                            AS ConfigKey,
    MAX(RTRIM(j.EmailName))                     AS EmailName,
    MAX(j.EmailID)                              AS Email_ID,
    ${nombre} AS Link_Name,
    ${url} AS Link_URL,
    COUNT(*)                                    AS Clicks_Total,
    COUNT(DISTINCT k.SubscriberID)              AS Clicks_Unique,
    GETDATE()                                   AS LastRefresh
FROM _Click k
LEFT JOIN _Sent s ON s.JobID = k.JobID AND s.ListID = k.ListID AND s.BatchID = k.BatchID AND s.SubscriberID = k.SubscriberID
INNER JOIN _Job j ON j.JobID = k.JobID
INNER JOIN CRM_Reporte_Config c ON RTRIM(j.EmailName) = c.EmailName AND c.Activo = 'Si'
WHERE k.EventDate >= '2026-03-01'
GROUP BY k.JobID, CONVERT(date, s.EventDate), CONVERT(date, k.EventDate), c.ConfigKey, LEFT(RTRIM(k.URL), 500), ${LLAVE}`;
}
const camposTemp = () => CAMPOS.map(({ pk, ...c }) => ({ ...c }));          // consultarTemp agrega su propia llave

// ---------- cuerpos de las peticiones ----------
const hoyTexto = (ahoraMs, offsetHoras) => new Date(ahoraMs + offsetHoras * 3600e3).toISOString().slice(0, 10);
function cuerpoDe(cfg, hoy) {
  return { name: NOMBRES.de, key: NOMBRES.de, description: `Clicks por link con fecha del click y fecha de envio (grano JobID x dia de envio x dia del click x link). La carga ${NOMBRES.query} (Update) cada noche. Creada el ${hoy} por crm-reporte-mcp-nestle-sfmc.`, isSendable: false, categoryId: Number(cfg.carpetas.de), fields: CAMPOS.map(D.campoRest) };
}
function cuerpoQuery(cfg, sql, deKey, hoy) {
  return { name: NOMBRES.query, key: NOMBRES.query, description: `Carga ${NOMBRES.de} (Update): clicks por link con fecha del click. Creada el ${hoy} por crm-reporte-mcp-nestle-sfmc.`, queryText: sql, targetName: NOMBRES.de, targetKey: deKey, targetUpdateTypeId: TIPO_UPDATE, categoryId: Number(cfg.carpetas.query) };
}
function cuerpoAutomation(queryId, carpeta, hoy) {
  return { name: NOMBRES.automation, key: NOMBRES.automation, description: `Carga nocturna de ${NOMBRES.de}: UNA actividad, la query ${NOMBRES.query}. Aparte de CRM_Reporte_Diario a proposito (si falla no frena el reporte). Creada el ${hoy} por crm-reporte-mcp-nestle-sfmc.`, categoryId: Number(carpeta),
    steps: [{ name: '', step: 1, activities: [{ name: NOMBRES.query, activityObjectId: queryId, objectTypeId: 300, displayOrder: 1 }] }] };
}
/** Proxima ocurrencia de `hora` (HH:MM) en la zona de la CUENTA, al menos 15 min en el futuro, como 'AAAA-MM-DDTHH:MM:SS' (sin zona: es la de la cuenta). */
function proximaCorrida({ ahoraMs, offsetHoras = -6, hora = HORA_DEFECTO }) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora)); if (!m || +m[1] > 23 || +m[2] > 59) throw new ErrorInstalacion(`--hora debe ser HH:MM (00:00 a 23:59); recibi ${JSON.stringify(hora)}`);
  const local = ahoraMs + offsetHoras * 3600e3; const d = new Date(local);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), +m[1], +m[2], 0);
  if (t <= local + 15 * 60e3) t += 86400e3;
  return new Date(t).toISOString().slice(0, 19);
}
/** El horario de la nueva automation: el de la automation del reporte (misma zona, mismo patron diario, mismo fin), con otra hora de arranque. */
function cuerpoHorario(base, { ahoraMs, offsetHoras, hora }) {
  if (!base || !base.icalRecur || !base.timezoneName) throw new ErrorInstalacion('La automation del reporte no trae un horario que copiar (icalRecur / timezoneName): programa la nueva a mano en Automation Studio.');
  // Sin scheduleStatus: SFMC lo ignora al crear (probado en vivo el 22-oct-2026: con 'active' la automation igual nace en PausedSchedule). El horario se ACTIVA despues, ver activarHorario().
  const s = { typeId: base.typeId, startDate: proximaCorrida({ ahoraMs, offsetHoras, hora }), endDate: base.endDate, rangeTypeId: base.rangeTypeId, icalRecur: base.icalRecur, timezoneName: base.timezoneName, timezoneId: base.timezoneId };
  if (base.pattern) s.pattern = base.pattern;
  return s;
}
/**
 * Cuerpos para CREAR la automation YA CON su horario, en el orden en que se prueban (el 2o solo si SFMC rechaza el 1o con un 4xx).
 * El horario va en startSource.schedule (con `schedule` suelto SFMC lo ignora y la deja en Ready; probado en vivo el 22-oct-2026). Nace en PausedSchedule: activarHorario() la deja en Scheduled.
 */
const cuerposCreacion = (base, horario) => [{ ...base, startSource: { typeId: 1, schedule: horario } }, { ...base, typeId: 1, type: 'scheduled', startSource: { typeId: 1, schedule: horario } }];

// ---------- comparaciones puras ----------
/** Diferencias entre los campos reales de una DE y los esperados (nombre, tipo, llave primaria, largo del texto). [] = igual. */
function difCampos(reales, esperados = CAMPOS) {
  const R = new Map(reales.map(c => [c.name, c])); const out = [];
  for (const e of esperados) {
    const r = R.get(e.name); if (!r) { out.push(`falta el campo ${e.name}`); continue; }
    if (String(r.type).toLowerCase() !== e.type.toLowerCase()) out.push(`${e.name}: tipo ${r.type} (se esperaba ${e.type})`);
    if (!!r.pk !== !!e.pk) out.push(`${e.name}: ${e.pk ? 'deberia ser' : 'no deberia ser'} llave primaria`);
    if (e.type === 'Text' && e.length && Number(r.length) !== e.length) out.push(`${e.name}: largo ${r.length} (se esperaba ${e.length})`);
  }
  for (const r of reales) if (!esperados.some(e => e.name === r.name)) out.push(`sobra el campo ${r.name}`);
  return out;
}
/**
 * Concilia la tabla nueva contra lo que ya existe en SFMC, sin red.
 *   nuevas: filas de CRM_Email_Links_Dia · links: filas de CRM_Email_Links (viejo) · detalle: filas de CRM_Email_Detalle (RowKey = JobID_AAAAMMDD, Email_Total_Clicks)
 * Tolerancias: los clicks siguen llegando entre una lectura y otra (clicks tardios en correos viejos), asi que el total puede diferir un poco; lo que NO puede pasar es una llave repetida,
 * un click antes del envio o una diferencia grande. Devuelve { ok, problemas[], ...numeros }.
 */
function conciliar({ nuevas, links, detalle }) {
  const r = { filas: nuevas.length, problemas: [] };
  r.llaveUnica = new Set(nuevas.map(f => f.RowKey)).size === nuevas.length;
  const norm1 = nuevas.map(f => ({ ...f, SendDay: fechaDia(f.SendDay), ClickDay: fechaDia(f.ClickDay) }));
  const sinEnvio = norm1.filter(f => !f.SendDay); r.sinEnvio = { filas: sinEnvio.length, clicks: sinEnvio.reduce((a, f) => a + num(f.Clicks_Total), 0) };
  r.clickAntesDelEnvio = norm1.filter(f => f.SendDay && f.ClickDay < f.SendDay).length;
  const vj = new Map(); for (const v of links) { const k = v.ConfigKey + '|' + v.Link_URL; vj.set(k, (vj.get(k) || 0) + num(v.Clicks_Total)); }
  const nv = new Map(); for (const f of norm1) { const k = f.ConfigKey + '|' + f.Link_URL; nv.set(k, (nv.get(k) || 0) + num(f.Clicks_Total)); }
  let totV = 0, totN = 0, dist = 0, soloV = 0, soloN = 0;
  for (const k of new Set([...vj.keys(), ...nv.keys()])) { const a = vj.get(k), b = nv.get(k); if (a === undefined) { soloN++; totN += b; } else if (b === undefined) { soloV++; totV += a; } else { totV += a; totN += b; if (a !== b) dist++; } }
  r.links = { totalViejo: totV, totalNuevo: totN, diferencia: totN - totV, linksDistintos: dist, soloEnViejo: soloV, soloEnNuevo: soloN };
  const nvJD = new Map(); for (const f of norm1) if (f.SendDay) { const k = String(f.JobID) + '_' + f.SendDay.replace(/-/g, ''); nvJD.set(k, (nvJD.get(k) || 0) + num(f.Clicks_Total)); }
  const dt = new Map(detalle.map(d => [String(d.RowKey), num(d.Email_Total_Clicks)]));
  const malos = []; let iguales = 0; for (const [k, v] of nvJD) { if (dt.get(k) === v) iguales++; else malos.push({ llave: k, nuevo: v, detalle: dt.has(k) ? dt.get(k) : null }); }
  r.detalle = { combinaciones: nvJD.size, iguales, distintas: malos.length, ejemplos: malos.slice(0, 6) };
  if (!r.filas) r.problemas.push('la tabla nueva quedo VACIA');
  if (!r.llaveUnica) r.problemas.push('hay RowKey repetidas');
  if (r.clickAntesDelEnvio) r.problemas.push(`${r.clickAntesDelEnvio} fila(s) con el click ANTES del envio`);
  const tolTotal = Math.max(10, Math.ceil(0.005 * totV)); if (Math.abs(r.links.diferencia) > tolTotal) r.problemas.push(`el total de clicks difiere ${r.links.diferencia} del de CRM_Email_Links (tolerancia ${tolTotal})`);
  if (soloN > Math.max(3, Math.ceil(0.01 * nv.size))) r.problemas.push(`${soloN} links aparecen solo en la tabla nueva`);
  // El Detalle se refresca de noche (o a mano) y esta tabla se lee despues: en esas horas siguen llegando clicks tardios a correos viejos (22-oct-2026: 6 combinaciones difirieron 2 a 5 clicks tras 75 min). Se juzga por TAMAÑO, no por cuantas.
  const grandes = malos.filter(x => x.detalle === null || Math.abs(x.nuevo - x.detalle) > Math.max(10, 0.01 * x.detalle)); if (grandes.length) r.problemas.push(`${grandes.length} combinacion(es) job x dia de envio difieren en mas de 10 clicks (o 1 %) o no existen en el Detalle`);
  r.detalle.diferenciaAbsoluta = malos.reduce((a, x) => a + (x.detalle === null ? x.nuevo : Math.abs(x.nuevo - x.detalle)), 0);
  const totDet = [...dt.values()].reduce((a, v) => a + v, 0), tolSuma = Math.max(25, Math.ceil(0.005 * totDet));
  if (r.detalle.diferenciaAbsoluta > tolSuma) r.problemas.push(`las diferencias job x dia de envio suman ${r.detalle.diferenciaAbsoluta} clicks (tolerancia ${tolSuma})`);
  r.ok = r.problemas.length === 0;
  return r;
}

// ---------- SFMC ----------
const buscarUno = (lista, que) => { if (lista.length > 1) throw new ErrorInstalacion(`Hay ${lista.length} ${que} con ese nombre: no se cual adoptar, revisa Automation Studio.`); return lista[0] || null; };
/** Lo que YA existe en la BU con los nombres de esta instalacion: { de:{key,campos}|null, query:{id,json}|null, automation:{id,json}|null }. */
async function inspeccionar(cli, cfg, d) {
  const out = { de: null, query: null, automation: null };
  try { const info = await d.infoDe(cli, NOMBRES.de); out.de = { key: info.key, campos: await d.columnas(cli, NOMBRES.de) }; } catch (e) { if (!/no existe/i.test(e.message)) throw e; }
  const q = buscarUno((await cli.paginar('/automation/v1/queries')).filter(x => x.name === NOMBRES.query), 'queries');
  if (q) out.query = { id: q.queryDefinitionId, json: (await cli.restOk(`/automation/v1/queries/${q.queryDefinitionId}`)).json };
  const a = buscarUno((await cli.paginar('/automation/v1/automations', { tam: 50, max: 80 })).filter(x => x.name === NOMBRES.automation), 'automations');
  if (a) out.automation = { id: a.id, json: (await cli.restOk(`/automation/v1/automations/${a.id}`)).json };
  return out;
}
const horaDe = (s) => String(s || '').slice(11, 16);
/** Scheduled (statusId 6) y, si se pide una hora, con su proxima corrida a esa hora (HH:MM de la zona de la cuenta). */
const estaProgramada = (a, hora) => !!a && (a.status === 'Scheduled' || Number(a.statusId) === 6) && !!a.schedule && (!hora || horaDe(a.schedule.scheduledTime || a.schedule.startDate) === hora);

const RUTA_LEGACY = '/legacy/v1/beta/bulk/automations/automation/definition';
/**
 * Activa el horario de la automation PROPIA recien creada. Por la API, SFMC la crea SIEMPRE en PausedSchedule, y ni PATCH (status, statusId, schedule, scheduleStatus) ni las rutas /actions/*
 * (resume, resumeschedule, startschedule, activate: 404) la activan (probado en vivo el 22-oct-2026). Lo que SI funciona es el endpoint "legacy" que usan Automation Studio y SFMC DevTools:
 *   POST /legacy/v1/beta/bulk/automations/automation/definition/?action=schedule   { id: <id legacy>, scheduleObject: { id: <id del horario> } }   ->  201 { id: <id legacy> }
 * El id legacy viene en la respuesta de la CREACION (`legacyId`, base64 distinto del GUID); el id del horario sale de la definicion legacy (GET). Antes de registrar el id en la guardia y de activar nada
 * se COMPRUEBA que esa definicion es la nuestra (nombre y key). Devuelve { ok: true } | { ok: false, motivo }; nunca lanza: una automation sin activar no es motivo para revertir una tabla ya cargada y conciliada.
 */
async function activarHorario(cli, legacyId) {
  try {
    if (!legacyId) return { ok: false, motivo: 'SFMC no devolvio el id legacy de la automation al crearla' };
    const g = await cli.rest(`${RUTA_LEGACY}/${encodeURIComponent(legacyId)}`);
    if (g.status >= 300 || !g.json) return { ok: false, motivo: `no pude leer su definicion legacy: HTTP ${g.status} ${redact(String(g.raw || g.error || '')).slice(0, 160)}` };
    if (g.json.name !== NOMBRES.automation || g.json.key !== NOMBRES.automation) return { ok: false, motivo: `el id legacy apunta a "${redact(String(g.json.name))}" y no a ${NOMBRES.automation}: no se activa nada` };
    const sid = g.json.scheduleObject && g.json.scheduleObject.id;
    if (!sid) return { ok: false, motivo: 'su definicion legacy no trae el id del horario (scheduleObject.id)' };
    cli.registro.instalarAutomationLegacy(legacyId);
    const p = await cli.rest(`${RUTA_LEGACY}/?action=schedule`, 'POST', { id: legacyId, scheduleObject: { id: sid } });
    if (p.status >= 300 || !p.json || p.json.id !== legacyId) return { ok: false, motivo: `SFMC no activo el horario: HTTP ${p.status} ${redact(String(p.raw || p.error || '')).slice(0, 160)}` };
    return { ok: true };
  } catch (e) { return { ok: false, motivo: redact(e.message) }; }
}

async function esperarCarga(cli, d, { timeoutS = 1500, pollMs = 15000, estable = 3, log = () => {} } = {}) {
  const t0 = cli.ahora(); let ultimo = -1, iguales = 0;
  while (cli.ahora() - t0 < timeoutS * 1000) {
    await d.dormir(pollMs);
    let n; try { n = (await d.leerFilas(cli, NOMBRES.de, ['RowKey'], { validar: false })).length; } catch { continue; }
    iguales = n > 0 && n === ultimo ? iguales + 1 : 0; ultimo = n; log(`  carga: ${n} filas`);
    if (n > 0 && iguales >= estable) return { filas: n, segundos: Math.round((cli.ahora() - t0) / 1000) };
  }
  throw new ErrorInstalacion(`La carga no se estabilizo en ${timeoutS} s (ultimo conteo: ${ultimo}).`);
}
async function esperarAutomation(cli, id, antes, d, { timeoutS = 1500, pollMs = 15000, log = () => {} } = {}) {
  const t0 = cli.ahora(); let vioCorrer = false;
  while (cli.ahora() - t0 < timeoutS * 1000) {
    await d.dormir(pollMs);
    const a = (await cli.restOk(`/automation/v1/automations/${id}`)).json; const corriendo = /running/i.test(String(a.status));
    log(`  automation: ${a.status}`);
    if (corriendo) { vioCorrer = true; continue; }
    if (/error|stopped/i.test(String(a.status))) throw new ErrorInstalacion(`La automation termino en estado "${a.status}": revisa su historial en Automation Studio.`);
    if (vioCorrer || (a.lastRunTime && a.lastRunTime !== antes)) return { status: a.status, lastRunTime: a.lastRunTime, segundos: Math.round((cli.ahora() - t0) / 1000) };
  }
  throw new ErrorInstalacion(`La automation no termino de correr en ${timeoutS} s.`);
}

/**
 * Borra la automation PROPIA. SFMC no acepta DELETE de una automation por REST (404; medido en vivo el 22-oct-2026): se prueba REST y, si no, SOAP Delete por su key (= su nombre).
 * Comprueba despues que ya no existe y lanza si sigue ahi. Devuelve 'rest' | 'soap'.
 */
async function borrarAutomation(cli, id) {
  const r = await cli.rest(`/automation/v1/automations/${id}`, 'DELETE');
  let via = 'rest';
  if (r.status >= 300) { await cli.soapOk('Delete', `<Objects xsi:type="Automation"><CustomerKey>${esc(NOMBRES.automation)}</CustomerKey></Objects>`); via = 'soap'; }
  const g = await cli.rest(`/automation/v1/automations/${id}`);
  if (g.status !== 404 && !(g.json && /delet/i.test(String(g.json.status)))) throw new ErrorInstalacion(`La automation ${NOMBRES.automation} sigue existiendo tras intentar borrarla (por ${via}): borrala a mano en Automation Studio.`);
  cli.registro.quitarInstaladaAutomation(id);
  return via;
}

/**
 * Instala (o verifica) las tres piezas. opts: { escribir, hora, actualizar, conservar, probarAutomation, log }.
 * `hora` (HH:MM de la cuenta): si se pasa, la automation debe quedar programada a esa hora (una que ya existe a otra hora se vuelve a crear); si no, 00:50 al crearla y una ya programada a otra hora se respeta.
 * deps (para pruebas): { consultar, leerFilas, columnas, infoDe, iniciarQuery, dormir }.
 * Estados: 'simulacro' | 'instalado' | 'ya-instalado' | 'sin-programar' | 'rechazado' | 'revertido'.
 *   'sin-programar': la tabla y la query quedaron cargadas y conciliadas, la automation existe pero NO se pudo activar su horario: NO se revierte (se activa a mano o se repite el script, que la borra y la vuelve a crear).
 * La automation se crea YA CON su horario (nace en PausedSchedule), se corre UNA vez (SFMC solo deja «run once» en Ready o PausedSchedule) y despues se activa con activarHorario(); una automation propia que existe SIN programar,
 * apuntando a una query que ya no existe o a otra hora pedida, se borra y se vuelve a crear (es la unica forma de conseguir su id legacy, que solo devuelve la creacion).
 */
async function instalar(cli, cfg, opts = {}, deps = {}) {
  const { escribir = false, hora: horaPedida, actualizar = false, conservar = false, probarAutomation = true, log = () => {} } = opts;
  const hora = horaPedida || HORA_DEFECTO;
  const d = { consultar: D.consultarTemp, leerFilas: D.leerFilas, columnas: D.columnas, infoDe: D.infoDe, iniciarQuery: D.iniciarQuery, dormir: (ms) => cli.dormir(ms), ...deps };
  const offset = cfg.bu && cfg.bu.offsetUtcHoras != null ? Number(cfg.bu.offsetUtcHoras) : -6;
  const hoy = hoyTexto(cli.ahora(), offset);
  const rechazo = (motivo, extra) => ({ estado: 'rechazado', motivo, ...(extra || {}) });

  await cli.token();
  for (const sc of ['automations_write', 'data_extensions_write', 'automations_read']) if (!cli.scopes.includes(sc)) return rechazo(`Al package le falta el permiso ${sc} (docs/CONEXION.md).`);
  if (!cfg.carpetas || !cfg.carpetas.de || !cfg.carpetas.query) return rechazo('Falta carpetas.de / carpetas.query en la config del pipeline: corre scripts/descubrir.js.');
  if (!/^\d{1,2}:\d{2}$/.test(String(hora))) return rechazo(`--hora debe ser HH:MM; recibi ${JSON.stringify(hora)}`);

  const links = (await cli.restOk(`/automation/v1/queries/${cfg.queries.links.id}`)).json;
  const diaria = (await cli.restOk(`/automation/v1/automations/${cfg.automation.id}`)).json;
  let sql; try { sql = construirSql(links.queryText); } catch (e) { return rechazo(e.message); }
  const existente = await inspeccionar(cli, cfg, d);

  // lo que ya existe debe ser IGUAL a lo que se instalaria (o se rechaza: nunca se pisa algo ajeno)
  const problemas = [];
  if (existente.de) { const dif = difCampos(existente.de.campos); if (dif.length) problemas.push(`La DE ${NOMBRES.de} ya existe con otra estructura: ${dif.join('; ')}.`); }
  if (existente.query) {
    const q = existente.query.json;
    if (q.targetName !== NOMBRES.de) problemas.push(`La query ${NOMBRES.query} ya existe pero carga "${q.targetName}", no ${NOMBRES.de}.`);
    if (Number(q.targetUpdateTypeId) !== TIPO_UPDATE) problemas.push(`La query ${NOMBRES.query} ya existe pero no es de tipo Update (es ${q.targetUpdateTypeName || q.targetUpdateTypeId}).`);
  }
  let recrear = null;                             // por que la automation propia que ya existe se BORRA y se vuelve a crear: 'obsoleta' | 'sin-programar' | 'otra-hora'
  if (existente.automation) {
    const pasos = existente.automation.json.steps || []; const act = (pasos[0] || {}).activities || [];
    if (/running/i.test(String(existente.automation.json.status))) problemas.push(`La automation ${NOMBRES.automation} esta CORRIENDO ahora mismo: no se toca; repite en unos minutos.`);
    else if (pasos.length !== 1 || act.length !== 1) problemas.push(`La automation ${NOMBRES.automation} ya existe pero no tiene UN paso con UNA actividad.`);
    else if (act[0].name !== NOMBRES.query) problemas.push(`La automation ${NOMBRES.automation} ya existe pero su unica actividad no es ${NOMBRES.query} (es "${act[0].name}").`);
    else if (!existente.query || act[0].activityObjectId !== existente.query.id) recrear = 'obsoleta';                         // la de un intento anterior: apunta a una query que ya no existe
    else if (!estaProgramada(existente.automation.json)) recrear = 'sin-programar';                                          // nacio en PausedSchedule y nadie la activo (o alguien la pauso)
    else if (horaPedida && !estaProgramada(existente.automation.json, horaPedida)) recrear = 'otra-hora';
  }
  if (problemas.length) return rechazo(problemas.join(' '), { existente });
  const sqlDifiere = !!existente.query && norm(existente.query.json.queryText) !== norm(sql);
  if (sqlDifiere && !actualizar) return rechazo(`La query ${NOMBRES.query} ya existe con un SQL distinto del que se instalaria. Vuelve a correr con --actualizar para reemplazarlo (se prueba antes en una query temporal).`, { existente });

  // el SQL se PRUEBA en una query temporal antes de crear nada
  log('Probando el SQL en una query temporal …');
  const prueba = await d.consultar(cli, cfg, { etiqueta: 'lnkdia', sql, campos: camposTemp(), timeoutS: 1800, pollMs: 10000, log });
  if (!prueba.completo) return rechazo('El SQL no termino en 30 min en la query temporal: no se instala nada.');
  if (!prueba.filas.length) return rechazo('El SQL termino pero no devolvio ninguna fila: no se instala nada.');
  let horario; try { horario = cuerpoHorario(diaria.schedule, { ahoraMs: cli.ahora(), offsetHoras: offset, hora }); } catch (e) { return rechazo(e.message); }
  const plan = { sql, sqlCaracteres: sql.length, filasDePrueba: prueba.filas.length, segundosDePrueba: prueba.segundos, hora, existente: { de: !!existente.de, query: !!existente.query, automation: !!existente.automation }, actualizarSql: sqlDifiere, automationObsoleta: recrear === 'obsoleta', automationRecrear: recrear, horario };
  if (!escribir) return { estado: 'simulacro', plan };
  if (existente.de && existente.query && existente.automation && !recrear && !sqlDifiere) return { estado: 'ya-instalado', plan };

  // ---- la automation propia que hay que rehacer se borra antes de crear nada (si no se puede borrar, no se toca nada mas) ----
  if (recrear) {
    const porque = { obsoleta: 'de un intento anterior: apunta a una query que ya no existe', 'sin-programar': 'esta sin programar (PausedSchedule)', 'otra-hora': `esta programada a otra hora que la pedida (${hora})` }[recrear];
    log(`Borrando la automation ${NOMBRES.automation} (${porque}) para volver a crearla con su horario …`);
    try { cli.registro.instalarAutomation(existente.automation.id); const via = await borrarAutomation(cli, existente.automation.id); existente.automation = null; log(`  borrada (por ${via})`); }
    catch (e) { return rechazo(`No pude borrar la automation ${NOMBRES.automation} (${porque}): ${redact(e.message)} Borrala a mano en Automation Studio y repite el script.`); }
  }

  // ---- escritura, con rollback de lo que ESTA corrida creo ----
  const creados = []; const registros = [];
  const deshacer = async () => {
    const fallos = [], borrados = [];
    for (const o of creados.slice().reverse()) {
      try {
        if (o.tipo === 'automation') { await borrarAutomation(cli, o.id); if (o.legacyId) cli.registro.quitarInstaladaAutomationLegacy(o.legacyId); }
        else if (o.tipo === 'query') { await cli.restOk(`/automation/v1/queries/${o.id}`, 'DELETE'); cli.registro.quitarInstaladaQuery(o.id); }
        else { await cli.soapOk('Delete', `<Objects xsi:type="DataExtension"><CustomerKey>${esc(o.key)}</CustomerKey></Objects>`); cli.registro.quitarInstaladaDe(o.key); }
        borrados.push(o.tipo);
      } catch (e) {
        fallos.push(`${o.tipo} ${o.id || o.key}: ${redact(e.message).slice(0, 200)}`);
        if (o.tipo === 'automation') { fallos.push('Se DEJARON la query y la DE para no dejar la automation apuntando a nada: borra los tres a mano en Automation Studio / Contact Builder, o repite el script (adopta lo que existe).'); break; }
      }
    }
    return { fallos, borrados };
  };
  try {
    let deKey = existente.de ? existente.de.key : null, queryId = existente.query ? existente.query.id : null, autoId = existente.automation ? existente.automation.id : null;
    if (deKey) { cli.registro.instalarDe(deKey); registros.push('DE adoptada'); }
    else {
      log(`Creando la DE ${NOMBRES.de} …`);
      const r = await cli.rest('/data/v1/customobjects', 'POST', cuerpoDe(cfg, hoy));
      if (r.status >= 300 || !r.json || !r.json.key) throw new ErrorInstalacion(`No pude crear la DE: HTTP ${r.status} ${redact(String(r.raw)).slice(0, 300)}`);
      deKey = r.json.key; cli.registro.instalarDe(deKey); creados.push({ tipo: 'de', key: deKey });
      let campos = null; for (let i = 0; i < 8 && !campos; i++) { if (i) await d.dormir(5000); try { campos = await d.columnas(cli, NOMBRES.de); } catch (e) { if (!/no existe/i.test(e.message) || i === 7) throw e; } }          // la DE recien creada puede tardar en verse
      const dif = difCampos(campos); if (dif.length) throw new ErrorInstalacion(`La DE se creo con otra estructura: ${dif.join('; ')}`);
      registros.push('DE creada');
    }
    if (queryId) {
      cli.registro.instalarQuery(queryId);
      if (sqlDifiere) {
        log(`Actualizando el SQL de ${NOMBRES.query} …`);
        const q = existente.query.json;
        await cli.restOk(`/automation/v1/queries/${queryId}`, 'PATCH', { queryDefinitionId: q.queryDefinitionId, name: q.name, key: q.key, description: q.description, queryText: sql, targetName: NOMBRES.de, targetKey: deKey, targetUpdateTypeId: TIPO_UPDATE, categoryId: q.categoryId });
        registros.push('SQL actualizado');
      } else registros.push('query adoptada');
    } else {
      log(`Creando la query ${NOMBRES.query} …`);
      let r = null;
      for (let i = 0; i < 4; i++) {                                                  // un 400/404 (la DE recien creada aun no se ve para las queries) no creo nada: se puede repetir; cualquier otro error NO se repite (podria haberse creado)
        if (i) await d.dormir(8000);
        r = await cli.rest('/automation/v1/queries', 'POST', cuerpoQuery(cfg, sql, deKey, hoy));
        if (r.status < 300 || ![400, 404].includes(r.status)) break;
      }
      if (r.status >= 300 || !r.json || !r.json.queryDefinitionId) throw new ErrorInstalacion(`No pude crear la query: HTTP ${r.status} ${redact(String(r.raw)).slice(0, 300)}`);
      queryId = r.json.queryDefinitionId; cli.registro.instalarQuery(queryId); creados.push({ tipo: 'query', id: queryId }); registros.push('query creada');
    }
    const vq = (await cli.restOk(`/automation/v1/queries/${queryId}`)).json;
    if (norm(vq.queryText) !== norm(sql) || vq.targetName !== NOMBRES.de || Number(vq.targetUpdateTypeId) !== TIPO_UPDATE) throw new ErrorInstalacion(`SFMC guardo la query distinta de lo enviado (destino ${vq.targetName}, tipo ${vq.targetUpdateTypeName || vq.targetUpdateTypeId}, SQL ${norm(vq.queryText) === norm(sql) ? 'igual' : 'distinto'}).`);

    log('Corriendo la query una vez para llenar la tabla …');
    await d.iniciarQuery(cli, queryId);
    const carga = await esperarCarga(cli, d, { log });
    const [nuevas, viejas, detalle] = [await d.leerFilas(cli, NOMBRES.de, CAMPOS.map(c => c.name), { validar: false }), await d.leerFilas(cli, cfg.des.links.nombre, ['ConfigKey', 'Link_URL', 'Clicks_Total'], { validar: false }), await d.leerFilas(cli, cfg.des.detalle.nombre, ['RowKey', 'Email_Total_Clicks'], { validar: false })];
    const conciliacion = conciliar({ nuevas, links: viejas, detalle });
    if (!conciliacion.ok) throw new ErrorInstalacion(`La tabla cargada NO cuadra: ${conciliacion.problemas.join(' · ')}`, { conciliacion });

    let automation = existente.automation ? existente.automation.json : null;
    let horaVerificar = horaPedida, legacyId = null, creadaAhora = false;          // una automation adoptada (ya Scheduled) se respeta tal cual; la que se crea ahora debe quedar a `hora`
    if (autoId) { cli.registro.instalarAutomation(autoId); registros.push('automation adoptada'); }
    else {
      log(`Creando la automation ${NOMBRES.automation} (con su horario diario a las ${hora}) …`);
      const carpeta = diaria.categoryId; const base = cuerpoAutomation(queryId, carpeta, hoy); let ultimoError = null, r = null;
      for (const cuerpo of cuerposCreacion(base, plan.horario)) {
        r = await cli.rest('/automation/v1/automations', 'POST', cuerpo);
        if (r.status < 300 && r.json && r.json.id) break; ultimoError = `HTTP ${r.status} ${redact(String(r.raw)).slice(0, 300)}`; r = null;
      }
      if (!r) throw new ErrorInstalacion(`No pude crear la automation: ${ultimoError}`);
      autoId = r.json.id; legacyId = r.json.legacyId || null; cli.registro.instalarAutomation(autoId); creados.push({ tipo: 'automation', id: autoId, legacyId }); registros.push('automation creada'); horaVerificar = hora; creadaAhora = true;
    }
    automation = (await cli.restOk(`/automation/v1/automations/${autoId}`)).json;
    const pasos = automation.steps || []; const act = (pasos[0] || {}).activities || [];
    if (pasos.length !== 1 || act.length !== 1 || act[0].activityObjectId !== queryId) throw new ErrorInstalacion('SFMC guardo la automation con pasos distintos de UN paso con UNA actividad (la query).');
    // ---- se corre UNA vez ANTES de activar el horario: SFMC solo deja «run once» a una automation en Ready o PausedSchedule (una Scheduled da HTTP 400; medido en vivo el 22-oct-2026) ----
    //      /actions/start NO sirve para esto: exige los pasos y sus actividades en el cuerpo. Que SFMC no deje correrla no es un fallo de la automation: la prueba se OMITE y se dice; que corra y termine en Error SI revierte.
    let prueba2 = null;
    if (probarAutomation) {
      if (!creadaAhora) prueba2 = { omitida: true, motivo: 'la automation ya estaba programada y SFMC solo deja correr una vez una que esta en Ready o PausedSchedule' };
      else {
        log('Corriendo la automation una vez (antes de activar su horario) para comprobar que funciona de punta a punta …');
        const antes = automation.lastRunTime;
        const inicio = await cli.rest(`/automation/v1/automations/${autoId}/actions/runallonce`, 'POST', {});
        if (inicio.status >= 300) prueba2 = { omitida: true, motivo: `SFMC no dejo correrla una vez: HTTP ${inicio.status} ${redact(String(inicio.raw || inicio.error || '')).slice(0, 200)}` };
        else { prueba2 = await esperarAutomation(cli, autoId, antes, d, { log }); registros.push('automation probada'); }
        automation = (await cli.restOk(`/automation/v1/automations/${autoId}`)).json;
      }
    }
    // ---- activar el horario ----
    if (!estaProgramada(automation, horaVerificar)) {
      log(`Activando el horario de la automation (diaria a las ${hora}) …`);
      const activacion = await activarHorario(cli, legacyId);
      if (activacion.ok) automation = (await cli.restOk(`/automation/v1/automations/${autoId}`)).json;
      if (!activacion.ok || !estaProgramada(automation, horaVerificar)) {
        const motivo = activacion.ok ? `SFMC acepto activarla pero la automation quedo "${automation.status}"` : activacion.motivo;
        return { estado: 'sin-programar', motivo: `La tabla esta cargada y conciliada y la automation existe, pero NO pude activar su horario (${motivo}). Activala a mano: Automation Studio > ${NOMBRES.automation} > Schedule > Active (diaria ${hora}, ${diaria.schedule.timezoneName}); o repite el script, que la borra y la vuelve a crear.`, plan, carga, conciliacion, registros, ids: { de: deKey, query: queryId, automation: autoId }, automation: { status: automation.status }, pruebaAutomation: prueba2 };
      }
      registros.push('automation programada');
    }
    return { estado: 'instalado', plan, carga, conciliacion, registros, ids: { de: deKey, query: queryId, automation: autoId }, automation: { status: automation.status, proxima: automation.schedule && automation.schedule.scheduledTime }, pruebaAutomation: prueba2 };
  } catch (e) {
    if (conservar) throw e;
    const { fallos, borrados } = await deshacer();
    return { estado: 'revertido', motivo: redact(e.message), conciliacion: e.conciliacion || null, creadosYBorrados: borrados, fallosAlRevertir: fallos, plan, registros };
  }
}

module.exports = { ErrorInstalacion, NOMBRES, CAMPOS, HORA_DEFECTO, TIPO_UPDATE, RUTA_LEGACY, extraerExpresiones, construirSql, camposTemp, cuerpoDe, cuerpoQuery, cuerpoAutomation, proximaCorrida, cuerpoHorario, cuerposCreacion, difCampos, conciliar, inspeccionar, estaProgramada, activarHorario, esperarCarga, esperarAutomation, borrarAutomation, instalar, fechaDia };
