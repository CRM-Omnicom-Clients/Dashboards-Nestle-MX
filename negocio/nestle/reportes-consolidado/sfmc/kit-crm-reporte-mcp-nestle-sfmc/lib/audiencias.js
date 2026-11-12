'use strict';
// Mapeo de AUDIENCIA: pieza -> journey -> DE de entrada del journey -> volumen -> fila en CRM_Audiencias, y la query Vol regenerada.
//
// Por que existe: la query Vol (CRM_Audiencias_Vol_Load) trae escrita a mano la LISTA de DEs de audiencia que cuenta. Una pieza
// cuya audiencia no esta en CRM_Audiencias ni en esa lista sale con Audience_Volume = 0 en el reporte. Cuando entra un journey
// nuevo hay que (1) resolver su DE, (2) registrar la fila, (3) agregar la DE a la lista de Vol. Esto lo hace de punta a punta.
//
// Seguridad: por defecto es SIMULACRO. Con --escribir solo toca (a) filas de CRM_Audiencias y (b) el SQL de la query Vol, y esta
// ultima SOLO despues de ejecutar el SQL nuevo en una query TEMPORAL (si no corre, no se toca la de produccion) y con rollback.
const D = require('./de');
const E = require('./esquema');
const { filtroSimple } = require('./xml');
const { leerCatalogoFilas } = require('./catalogo');

class ErrorAudiencia extends Error { constructor(msg) { super(msg); this.name = 'ErrorAudiencia'; } }

const LOTE_COUNT = 8;                       // DEs por query de conteo (un UNION ALL de mas es lento y un fallo tumba todo el lote)
const idCorchetes = (n) => String(n).replace(/]/g, ']]');
const lit = (s) => String(s).replace(/'/g, "''");
const norm = (s) => String(s == null ? '' : s).replace(/\r\n/g, '\n').trim();
const activo = (f) => String(f.Activo == null ? '' : f.Activo).trim().toLowerCase() === 'si';

// ---------- contexto ----------
/** Todo lo que hace falta leer para decidir: catalogo, piezas (de ahi sale el journey) y el mapa de audiencias actual. */
async function leerContexto(cli, cfg) {
  const cat = await leerCatalogoFilas(cli, cfg, ['Activo']);
  const colsAud = await D.columnas(cli, cfg.des.audiencias.nombre);
  const modoAud = E.detectarModo(colsAud, cfg.esquema && cfg.esquema.llavePieza);
  const pkAud = E.columnaClave(modoAud);
  const pedirAud = [pkAud, ...['Journey_UUID', 'Audience_DE', 'Audience_Volume'].filter(c => colsAud.some(x => x.name === c))];
  const aud = await D.leerFilas(cli, cfg.des.audiencias.nombre, pedirAud);
  const piezas = await D.leerFilas(cli, cfg.des.piezas.nombre, ['EmailName', 'Journey_UUID']);
  if (cat.filas.truncado || aud.truncado || piezas.truncado) throw new ErrorAudiencia('No pude leer completas las DEs (demasiadas filas): sin eso no se puede decidir con seguridad.');
  if (modoAud === 'configkey' && cat.modo !== 'configkey') throw new ErrorAudiencia('Esquemas inconsistentes: audiencias usa ConfigKey pero el catálogo ya no. Migra las dos juntas.');
  return { cat, colsAud, modoAud, pkAud, aud, piezas };
}

/**
 * Que piezas se mapean. emailNames explicitos (cada uno debe estar en el catalogo y tener journey) o `pendientes`:
 * piezas ACTIVAS del catalogo con journey y sin fila (o sin DE) en audiencias. Un envio sin journey no es "pendiente": no tiene audiencia que mapear.
 */
function elegirObjetivos(ctx, { emailNames = [], pendientes = false, journeyUUID = null } = {}) {
  const porNombre = new Map(ctx.cat.filas.map(f => [String(f.EmailName).trim(), f]));
  const jDe = new Map(ctx.piezas.map(p => [String(p.EmailName).trim(), String(p.Journey_UUID || '').trim()]));
  const audPorClave = new Map(ctx.aud.map(a => [a[ctx.pkAud], a]));
  const lista = pendientes ? ctx.cat.filas.filter(activo).map(f => String(f.EmailName).trim()) : [...new Set(emailNames.map(s => String(s).trim()).filter(Boolean))];
  const objetivos = [], sinJourney = [], noEnCatalogo = [], yaMapeadas = []; let unicoEnvio = 0;
  for (const nombre of lista) {
    const fila = porNombre.get(nombre);
    if (!fila) { noEnCatalogo.push(nombre); continue; }
    const clave = ctx.pkAud === 'ConfigKey' ? fila.ConfigKey : nombre;
    const existente = audPorClave.get(clave) || null;
    const j = (journeyUUID && !pendientes ? journeyUUID : jDe.get(nombre)) || '';
    if (pendientes) {
      if (existente && String(existente.Audience_DE || '').trim()) { yaMapeadas.push(nombre); continue; }
      if (!j) { unicoEnvio++; continue; }
    } else if (!j) { sinJourney.push(nombre); continue; }
    objetivos.push({ emailName: nombre, clave, journeyUUID: j, existente });
  }
  return { objetivos, sinJourney, noEnCatalogo, yaMapeadas, unicoEnvio };
}

// ---------- journey -> DE de entrada (Interaction API) ----------
/** Map(journeyId -> { deNombre, estado, tipo, error }). Cachea journey y event definition (varias piezas comparten journey). */
async function resolverJourneys(cli, ids) {
  const out = new Map(); const edCache = new Map();
  for (const id of [...new Set(ids)]) {
    const it = await cli.rest(`/interaction/v1/interactions/${encodeURIComponent(id)}?extras=all`);
    if (it.status === 401 || it.status === 403) throw new ErrorAudiencia(`Tu package no puede leer journeys (HTTP ${it.status}): agrégale el scope journeys_read al Installed Package (docs/CONEXION.md).`);
    if (it.status === 404) { out.set(id, { deNombre: null, error: 'el journey no existe (¿se borró?)' }); continue; }
    if (it.status !== 200 || !it.json) { out.set(id, { deNombre: null, error: `HTTP ${it.status} al leer el journey` }); continue; }
    const j = it.json; const trig = (j.triggers || [])[0] || {};
    const edId = trig.metaData && trig.metaData.eventDefinitionId;
    const base = { estado: j.status || null, nombre: j.name || null, tipo: trig.type || null };
    if (!edId) { out.set(id, { ...base, deNombre: null, error: 'el journey no tiene una fuente de entrada (entry source) con DE' }); continue; }
    if (!edCache.has(edId)) { const ed = await cli.rest(`/interaction/v1/eventDefinitions/${encodeURIComponent(edId)}`); edCache.set(edId, ed.status === 200 && ed.json ? (ed.json.dataExtensionName || null) : null); }
    const de = edCache.get(edId);
    out.set(id, de ? { ...base, deNombre: de, error: null } : { ...base, deNombre: null, error: 'la fuente de entrada no es una Data Extension' });
  }
  return out;
}

/** Map(nombre -> true|false): ¿existe la DE? Una DE borrada dentro de la lista de Vol tumbaria TODA la query. */
async function verificarExistencia(cli, nombres) {
  const out = new Map();
  for (const n of [...new Set(nombres)]) { try { await D.infoDe(cli, n); out.set(n, true); } catch (e) { if (/no existe/i.test(e.message)) out.set(n, false); else throw e; } }
  return out;
}

// ---------- volumen ----------
const sqlConteo = (lote) => lote.map((n, i) => `SELECT '${i}' AS DEName, COUNT(*) AS N FROM [${idCorchetes(n)}]`).join('\nUNION ALL\n');
/** Map(nombre -> numero|null). Lotes de LOTE_COUNT; si un lote no termina, se reintenta DE por DE. null = no se pudo contar. */
async function contarVolumenes(cli, cfg, nombres, { consultar = D.consultarTemp, log = () => {}, timeoutLote = 300, timeoutUno = 240 } = {}) {
  const out = new Map(); const todos = [...new Set(nombres)];
  const CAMPOS = [{ name: 'DEName', type: 'Text', length: 10 }, { name: 'N', type: 'Number' }];
  const correr = async (lote, timeoutS) => {
    const r = await consultar(cli, cfg, { etiqueta: 'conteo', sql: sqlConteo(lote), campos: CAMPOS, timeoutS, pollMs: 6000, log });
    if (!r.completo) return null;
    const m = new Map(r.filas.map(f => [String(f.DEName), Number(f.N)]));
    return lote.every((_, i) => m.has(String(i))) ? lote.map((_, i) => m.get(String(i))) : null;
  };
  for (let i = 0; i < todos.length; i += LOTE_COUNT) {
    const lote = todos.slice(i, i + LOTE_COUNT);
    log(`  contando ${lote.length} DE(s) (${i + 1}-${i + lote.length} de ${todos.length}) …`);
    const v = await correr(lote, timeoutLote);
    if (v) lote.forEach((n, k) => out.set(n, v[k]));
    else for (const n of lote) { const u = lote.length === 1 ? null : await correr([n], timeoutUno); out.set(n, u ? u[0] : null); }
  }
  return out;
}

// ---------- la query Vol ----------
/** Las DEs que el SQL de Vol ya cuenta ("FROM [nombre]" dentro del LEFT JOIN). */
function extraerDesDelSql(sql) {
  const re = /COUNT\(\*\)\s+AS\s+N\s+FROM\s+\[((?:[^\]]|\]\])+)\]/gi; const out = []; let m;
  while ((m = re.exec(String(sql)))) out.push(m[1].replace(/\]\]/g, ']'));
  return out;
}
/** El SQL de Vol, en el MISMO formato del vigente: una fila por cada fila de audiencias + el conteo de su DE (ISNULL(...,0) si no esta en la lista). */
function generarSqlVol({ nombreVol, nombreDeAud, pk, nombresDe, fecha }) {
  const cuentas = nombresDe.map(n => `    SELECT '${lit(n)}' AS DEName, COUNT(*) AS N FROM [${idCorchetes(n)}]`).join('\n    UNION ALL\n');
  return `/* ${nombreVol} — volumen por COUNT estatico. Regenerado por audiencias.js el ${fecha}. */\n` +
    `SELECT m.${pk} AS ${pk}, m.Journey_UUID AS Journey_UUID, m.Audience_DE AS Audience_DE, ISNULL(cnt.N,0) AS Audience_Volume, GETDATE() AS LastRefresh\n` +
    `FROM ${nombreDeAud} m\nLEFT JOIN (\n${cuentas}\n) cnt ON cnt.DEName = m.Audience_DE`;
}

// ---------- el plan (puro) ----------
/**
 * objetivos + lo resuelto -> filas a escribir y SQL de Vol. `resueltos`: Map(journey -> {deNombre,error,estado}), `existe`: Map(DE -> bool),
 * `volumenes`: Map(DE -> n|null). Devuelve { filas, problemas, avisos, desNuevas, sqlNuevo }.
 */
function planificar({ ctx, cfg, objetivos, resueltos, existe, volumenes, sqlVolActual, nombreVol, fecha }) {
  const filas = [], problemas = [], avisos = [];
  const yaEnSql = new Set(extraerDesDelSql(sqlVolActual));
  for (const o of objetivos) {
    const r = resueltos.get(o.journeyUUID) || { deNombre: null, error: 'sin resolver' };
    if (!r.deNombre) { problemas.push({ emailName: o.emailName, journeyUUID: o.journeyUUID, motivo: r.error }); continue; }
    if (existe.get(r.deNombre) === false) { problemas.push({ emailName: o.emailName, journeyUUID: o.journeyUUID, deNombre: r.deNombre, motivo: 'la DE de entrada del journey ya no existe' }); continue; }
    if (r.estado && !/published|running/i.test(r.estado)) avisos.push(`${o.emailName.slice(-40)}: el journey está "${r.estado}" (no Published)`);
    const vol = volumenes.get(r.deNombre);
    if (vol == null) avisos.push(`No pude contar la DE "${r.deNombre}": la fila va SIN volumen (la query Vol lo llenará en su próxima corrida si la DE está en su lista).`);
    const f = E.construirFilaAudiencia(ctx.colsAud, { configKey: o.clave, emailName: o.emailName, journeyUUID: o.journeyUUID, audienciaDe: r.deNombre, volumen: vol == null ? undefined : String(vol) }, { modo: ctx.modoAud });
    if (f.errores.length) { problemas.push({ emailName: o.emailName, journeyUUID: o.journeyUUID, deNombre: r.deNombre, motivo: f.errores.join('; ') }); continue; }
    const ex = o.existente;
    const accion = !ex ? 'nueva' : (String(ex.Audience_DE || '') === r.deNombre && String(ex.Journey_UUID || '') === o.journeyUUID && (vol == null || String(ex.Audience_Volume || '') === String(vol))) ? 'igual' : 'actualiza';
    filas.push({ emailName: o.emailName, clave: o.clave, journeyUUID: o.journeyUUID, deNombre: r.deNombre, volumen: vol ?? null, accion, claves: f.claves, props: f.props, antes: ex ? { Audience_DE: ex.Audience_DE, Audience_Volume: ex.Audience_Volume } : null });
  }
  // La lista de Vol NUNCA pierde una DE: lo que ya cuenta + lo que ya esta en audiencias + lo nuevo.
  const enAud = ctx.aud.map(a => String(a.Audience_DE || '').trim()).filter(Boolean);
  const nuevasDe = filas.map(f => f.deNombre);
  const lista = [...new Set([...extraerDesDelSql(sqlVolActual), ...enAud, ...nuevasDe])];
  const desNuevas = lista.filter(n => !yaEnSql.has(n));
  const sqlNuevo = desNuevas.length ? generarSqlVol({ nombreVol, nombreDeAud: cfg.des.audiencias.nombre, pk: ctx.pkAud, nombresDe: lista, fecha }) : null;
  return { filas, problemas, avisos, desNuevas, sqlNuevo, listaVol: lista };
}

// ---------- validar y aplicar ----------
const CAMPOS_VOL = (pk) => [{ name: pk, type: 'Text', length: 200 }, { name: 'Journey_UUID', type: 'Text', length: 60 }, { name: 'Audience_DE', type: 'Text', length: 200 }, { name: 'Audience_Volume', type: 'Number' }, { name: 'LastRefresh', type: 'Date' }];
/** Corre el SQL nuevo de Vol en una query TEMPORAL: si no se ejecuta (DE que no existe, sintaxis), la query de produccion no se toca. */
async function validarSqlVol(cli, cfg, ctx, sql, { consultar = D.consultarTemp, log = () => {} } = {}) {
  const r = await consultar(cli, cfg, { etiqueta: 'volval', sql, campos: CAMPOS_VOL(ctx.pkAud), timeoutS: 480, pollMs: 6000, log });
  if (!r.completo) return { ok: false, motivo: 'el SQL nuevo no terminó en 8 min (¿falla? ¿una DE inexistente? ¿motor lento?)', segundos: r.segundos };
  if (r.filas.length !== ctx.aud.length) return { ok: false, motivo: `el SQL nuevo devolvió ${r.filas.length} filas y audiencias tiene ${ctx.aud.length}: el JOIN duplica o pierde filas`, segundos: r.segundos };
  return { ok: true, filas: r.filas.length, segundos: r.segundos };
}

async function parchearVol(cli, cfg, sqlNuevo) {
  const id = cfg.queries.vol.id;
  const g = await cli.restOk(`/automation/v1/queries/${id}`); const d = g.json;
  const cuerpo = (queryText) => ({ queryDefinitionId: d.queryDefinitionId, name: d.name, key: d.key, description: d.description, queryText, targetName: d.targetName, targetKey: d.targetKey, targetUpdateTypeId: d.targetUpdateTypeId, categoryId: d.categoryId });
  await cli.restOk(`/automation/v1/queries/${id}`, 'PATCH', cuerpo(sqlNuevo));
  const v = await cli.restOk(`/automation/v1/queries/${id}`);
  if (norm(v.json.queryText) === norm(sqlNuevo)) return { ok: true };
  await cli.restOk(`/automation/v1/queries/${id}`, 'PATCH', cuerpo(d.queryText));          // rollback al SQL que estaba
  return { ok: false, motivo: 'SFMC guardó un SQL distinto al enviado; se restauró el anterior' };
}

/**
 * Entrada principal. opts: { emailNames, pendientes, journeyUUID, escribir, validarVol, log }. Estados:
 * 'nada' | 'simulacro' | 'aplicado' | 'aplicado-parcial' | 'rechazado'.
 */
async function mapearAudiencias(cli, cfg, opts, { consultar = D.consultarTemp } = {}) {
  const { emailNames = [], pendientes = false, journeyUUID = null, escribir = false, validarVol = true, log = () => {} } = opts;
  if (!pendientes && !emailNames.length) throw new ErrorAudiencia('Indica --email-name "<EXACTO>" (una o varias veces) o --pendientes.');
  if (journeyUUID && (pendientes || emailNames.length !== 1)) throw new ErrorAudiencia('--journey-uuid solo aplica con UN --email-name.');
  const ctx = await leerContexto(cli, cfg);
  const sel = elegirObjetivos(ctx, { emailNames, pendientes, journeyUUID });
  const base = { modo: ctx.modoAud, filasAudiencias: ctx.aud.length, ...sel, filas: [], problemas: [], avisos: [], desNuevas: [], sqlNuevo: null, validacion: null };
  if (sel.noEnCatalogo.length) return { ...base, estado: 'rechazado', motivo: `no están en el catálogo (el EmailName debe ser EXACTO; agrégalas con agregar-pieza.js): ${sel.noEnCatalogo.join(' | ')}` };
  if (!sel.objetivos.length) return { ...base, estado: 'nada' };

  log(`Resolviendo ${new Set(sel.objetivos.map(o => o.journeyUUID)).size} journey(s) …`);
  const resueltos = await resolverJourneys(cli, sel.objetivos.map(o => o.journeyUUID));
  const des = [...new Set([...resueltos.values()].map(r => r.deNombre).filter(Boolean))];
  const existe = await verificarExistencia(cli, des);
  const q = await cli.restOk(`/automation/v1/queries/${cfg.queries.vol.id}`); const sqlVolActual = String(q.json.queryText);
  const enSql = new Set(extraerDesDelSql(sqlVolActual));
  const aContar = des.filter(n => existe.get(n));
  const volumenes = aContar.length ? await contarVolumenes(cli, cfg, aContar, { consultar, log }) : new Map();
  const fecha = new Date(cli.ahora() + (cfg.bu && cfg.bu.offsetUtcHoras != null ? Number(cfg.bu.offsetUtcHoras) : -6) * 3600e3).toISOString().slice(0, 10);
  const plan = planificar({ ctx, cfg, objetivos: sel.objetivos, resueltos, existe, volumenes, sqlVolActual, nombreVol: cfg.queries.vol.nombre, fecha });
  const res = { ...base, ...plan, resueltos: Object.fromEntries(resueltos), enSqlAntes: enSql.size };

  if (plan.sqlNuevo && validarVol) { log('Validando el SQL nuevo de Vol en una query temporal …'); res.validacion = await validarSqlVol(cli, cfg, ctx, plan.sqlNuevo, { consultar, log }); }
  if (!escribir) return { ...res, estado: 'simulacro' };
  if (res.validacion && !res.validacion.ok) return { ...res, estado: 'rechazado', motivo: 'El SQL nuevo de Vol NO pasó la validación: no se escribió nada (ni filas ni la query de producción). ' + res.validacion.motivo };

  const escritas = [];
  for (const f of plan.filas.filter(x => x.accion !== 'igual')) {
    await D.upsertarFila(cli, cfg, 'audiencias', f.claves, f.props);
    const [real] = await D.leerFilas(cli, cfg.des.audiencias.nombre, [ctx.pkAud, 'Audience_DE', 'Audience_Volume'], { filtro: filtroSimple(ctx.pkAud, 'equals', f.claves[ctx.pkAud]), validar: false });
    const okFila = !!real && real.Audience_DE === f.deNombre && (f.volumen == null || String(real.Audience_Volume) === String(f.volumen));
    escritas.push({ emailName: f.emailName, accion: f.accion, verificada: okFila });
  }
  res.escritas = escritas;
  if (plan.sqlNuevo) { res.vol = await parchearVol(cli, cfg, plan.sqlNuevo); }
  const todoOk = escritas.every(e => e.verificada) && (!plan.sqlNuevo || res.vol.ok);
  return { ...res, estado: todoOk && !plan.problemas.length ? 'aplicado' : 'aplicado-parcial' };
}

module.exports = { ErrorAudiencia, LOTE_COUNT, leerContexto, elegirObjetivos, resolverJourneys, verificarExistencia, contarVolumenes, extraerDesDelSql, generarSqlVol, planificar, validarSqlVol, parchearVol, mapearAudiencias };
