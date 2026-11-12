'use strict';
// Helpers de Data Extensions: lectura VALIDADA, filas del catalogo/audiencias, y CONSULTAS TEMPORALES con centinela.
//
// 🔴 Por que el centinela: antes, "la query temporal no devolvio filas" significaba DOS cosas indistinguibles —
//    "termino y no hay nada" o "aun no termina / se acabo el tiempo". Ya costo diagnosticos falsos ("el envio no existe"
//    cuando solo era una query lenta). Aqui cada consulta temporal agrega una fila `__FIN__` al resultado: si la vemos,
//    la query TERMINO; y entonces cero filas utiles es un negativo REAL. Sin `__FIN__` => completo:false (no concluyas nada).
const { esc, bloques, etiqueta, pares, filtroSimple } = require('./xml');
const { ErrorSfmc } = require('./sfmc');
const { redact } = require('./credenciales');
const { nombreTemp } = require('./temp');
const { parseFechaSfmc } = require('./fechas');

class ErrorColumna extends Error { constructor(msg, disponibles) { super(msg); this.name = 'ErrorColumna'; this.disponibles = disponibles; } }
class ErrorSql extends Error { constructor(msg) { super(msg); this.name = 'ErrorSql'; } }

const memo = (cli, nombre) => (cli[nombre] = cli[nombre] || new Map());

// ---------- metadatos ----------
/** { key, categoryId, creada } de una DE por NOMBRE. Lanza si no existe. */
async function infoDe(cli, nombre) {
  const m = memo(cli, '_cacheInfoDe');
  if (m.has(nombre)) return m.get(nombre);
  const { xml } = await cli.soapOk('Retrieve', `<RetrieveRequest><ObjectType>DataExtension</ObjectType><Properties>Name</Properties><Properties>CustomerKey</Properties><Properties>CategoryID</Properties><Properties>CreatedDate</Properties>${filtroSimple('Name', 'equals', nombre)}</RetrieveRequest>`);
  const b = bloques(xml)[0];
  const key = b && etiqueta(b, 'CustomerKey');
  if (!key) throw new ErrorSfmc(`La DE "${nombre}" no existe en esta BU (¿nombre mal escrito, o tu package no tiene permiso?).`);
  const info = { nombre, key, categoryId: etiqueta(b, 'CategoryID'), creada: etiqueta(b, 'CreatedDate') };
  m.set(nombre, info);
  return info;
}
const claveDe = async (cli, nombre) => (await infoDe(cli, nombre)).key;

/** Campos reales de una DE: [{name,type,length,ordinal,pk,required}] ordenados. */
async function columnas(cli, nombreDe) {
  const m = memo(cli, '_cacheCols');
  if (m.has(nombreDe)) return m.get(nombreDe);
  const key = await claveDe(cli, nombreDe);
  const { xml } = await cli.soapOk('Retrieve', `<RetrieveRequest><ObjectType>DataExtensionField</ObjectType><Properties>Name</Properties><Properties>FieldType</Properties><Properties>MaxLength</Properties><Properties>Ordinal</Properties><Properties>IsPrimaryKey</Properties><Properties>IsRequired</Properties>${filtroSimple('DataExtension.CustomerKey', 'equals', key)}</RetrieveRequest>`);
  const cols = bloques(xml).map(bl => ({ name: etiqueta(bl, 'Name'), type: etiqueta(bl, 'FieldType'), length: Number(etiqueta(bl, 'MaxLength') || 0) || null, ordinal: Number(etiqueta(bl, 'Ordinal') || 0), pk: etiqueta(bl, 'IsPrimaryKey') === 'true', required: etiqueta(bl, 'IsRequired') === 'true' }))
    .filter(c => c.name).sort((a, b) => a.ordinal - b.ordinal);
  m.set(nombreDe, cols);
  return cols;
}

// ---------- lectura ----------
/**
 * Lee filas (objetos) de una DE por SOAP, paginando. Con validar:true (por defecto) comprueba ANTES que cada campo
 * pedido exista en la DE: pedir una columna que no existe hace fallar el Retrieve ENTERO y el error engaña
 * ("Piezas no tiene EmailType", "Email_Opens no existe"…). Lanza ErrorColumna con las columnas disponibles.
 */
async function leerFilas(cli, nombreDe, campos, { filtro = '', validar = true, maxPaginas = 60 } = {}) {
  if (validar) {
    const cols = await columnas(cli, nombreDe);
    const reales = new Set(cols.map(c => c.name));
    const faltan = campos.filter(c => !reales.has(c));
    if (faltan.length) throw new ErrorColumna(`La DE ${nombreDe} NO tiene la(s) columna(s): ${faltan.join(', ')}. Disponibles: ${cols.map(c => c.name).join(', ')}`, cols.map(c => c.name));
  }
  const props = campos.map(c => `<Properties>${esc(c)}</Properties>`).join('');
  const objeto = `<ObjectType>DataExtensionObject[${esc(nombreDe)}]</ObjectType>`;
  const filas = []; let cont = null, pag = 0;
  do {
    const interior = `<RetrieveRequest>${cont ? `<ContinueRequest>${esc(cont)}</ContinueRequest>` : ''}${objeto}${props}${cont ? '' : filtro}</RetrieveRequest>`;
    const { xml, res } = await cli.soapOk('Retrieve', interior);
    for (const bl of bloques(xml)) { const o = pares(bl); if (Object.keys(o).length) filas.push(o); }
    cont = res.hayMas ? res.requestId : null;
  } while (cont && ++pag < maxPaginas);
  if (cont) filas.truncado = true;
  return filas;
}
async function contarFilas(cli, nombreDe, campoPk) { return (await leerFilas(cli, nombreDe, [campoPk])).length; }

// ---------- escritura de FILAS (solo catalogo / audiencias: la guardia lo exige) ----------
function propsXml(props) { return Object.entries(props).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `<Property><Name>${esc(k)}</Name><Value>${esc(v)}</Value></Property>`).join(''); }
function keyDeRol(cfg, rol) {
  if (rol !== 'catalogo' && rol !== 'audiencias') throw new ErrorSfmc(`Solo se escriben filas en el catálogo y en audiencias (pediste "${rol}").`);
  const d = cfg.des && cfg.des[rol];
  if (!d || !d.key) throw new ErrorSfmc(`Falta la key de la DE "${rol}" en la config: corre scripts/descubrir.js.`);
  return d.key;
}
/** INSERT (SOAP Create). Falla si la PK ya existe. */
async function insertarFila(cli, cfg, rol, props) {
  const key = keyDeRol(cfg, rol);
  const { res } = await cli.soapOk('Create', `<Objects xsi:type="DataExtensionObject"><CustomerKey>${esc(key)}</CustomerKey><Properties>${propsXml(props)}</Properties></Objects>`);
  return res;
}
/** UPSERT (SOAP Update + UpdateAdd). `claves` = { campoPk: valor }; `props` = resto de columnas a escribir. */
async function upsertarFila(cli, cfg, rol, claves, props) {
  const key = keyDeRol(cfg, rol);
  const keys = Object.entries(claves).map(([k, v]) => `<Key><Name>${esc(k)}</Name><Value>${esc(v)}</Value></Key>`).join('');
  const opts = '<Options><SaveOptions><SaveOption><PropertyName>*</PropertyName><SaveAction>UpdateAdd</SaveAction></SaveOption></SaveOptions></Options>';
  const { res } = await cli.soapOk('Update', `${opts}<Objects xsi:type="DataExtensionObject"><CustomerKey>${esc(key)}</CustomerKey><Keys>${keys}</Keys><Properties>${propsXml(props)}</Properties></Objects>`);
  return res;
}

// ---------- objetos TEMPORALES ----------
function campoRest(f, i) {
  const o = { name: f.name, type: f.type, ordinal: i + 1, IsPrimaryKey: !!f.pk, isNullable: !f.pk, isTemplateField: false, isInheritable: true, isOverridable: true, isHidden: false, isReadOnly: false, mustOverride: false };
  if (f.length) o.length = f.length;
  if (f.scale !== undefined) o.scale = f.scale;
  return o;
}
function exigirCarpetas(cfg) {
  if (!cfg || !cfg.carpetas || !cfg.carpetas.de || !cfg.carpetas.query) throw new ErrorSfmc('Falta carpetas.de / carpetas.query en la config del pipeline (pipeline.config.json): corre scripts/descubrir.js.');
}
async function crearDeTemp(cli, cfg, nombre, campos) {
  exigirCarpetas(cfg);
  const r = await cli.rest('/data/v1/customobjects', 'POST', { name: nombre, key: '', isSendable: false, categoryId: Number(cfg.carpetas.de), fields: campos.map(campoRest) });
  if (r.status >= 300 || !r.json || !r.json.key) throw new ErrorSfmc(`No pude crear la DE temporal ${nombre}: HTTP ${r.status} ${redact(String(r.raw)).slice(0, 200)}`);
  cli.registro.addDe(r.json.key, nombre);
  return { nombre, key: r.json.key };
}
// 🔴 Estas queries temporales son Overwrite hacia una DE DISTINTA a las que leen. SFMC rechaza (HTTP 400) una query Overwrite que lea su propia
//    DE destino: "Update Type must be 'Update' or the target data extension … cannot appear in the query" (medido en vivo el 2-oct-2026).
async function crearQueryTemp(cli, cfg, nombre, sql, deNombre, deKey) {
  exigirCarpetas(cfg);
  const r = await cli.rest('/automation/v1/queries', 'POST', { name: nombre, key: nombre, description: 'temporal de crm-reporte-mcp-nestle-sfmc; se borra sola', queryText: sql, targetName: deNombre, targetKey: deKey, targetUpdateTypeId: 0, categoryId: Number(cfg.carpetas.query) });
  if (r.status >= 300 || !r.json || !r.json.queryDefinitionId) throw new ErrorSfmc(`No pude crear la query temporal ${nombre}: HTTP ${r.status} ${redact(String(r.raw)).slice(0, 300)}`);
  cli.registro.addQuery(r.json.queryDefinitionId, nombre);
  return { nombre, id: r.json.queryDefinitionId };
}
async function iniciarQuery(cli, id) {
  const r = await cli.rest(`/automation/v1/queries/${id}/actions/start/`, 'POST', {});
  if (r.status >= 300) throw new ErrorSfmc(`No pude iniciar la query ${id}: HTTP ${r.status} ${redact(String(r.raw)).slice(0, 200)}`);
  return r.json;
}
async function borrarQueryTemp(cli, id) {
  const r = await cli.rest(`/automation/v1/queries/${id}`, 'DELETE');
  if (r.status >= 300 && r.status !== 404) throw new ErrorSfmc(`No pude borrar la query temporal ${id}: HTTP ${r.status} ${redact(String(r.raw)).slice(0, 200)}`);
  cli.registro.quitarQuery(id);
}
async function borrarDeTemp(cli, key) {
  await cli.soapOk('Delete', `<Objects xsi:type="DataExtension"><CustomerKey>${esc(key)}</CustomerKey></Objects>`);
  cli.registro.quitarDe(key);
}
/** Borra TODO lo que este CLIENTE registro (queries primero, luego DEs). Devuelve { fallos:[texto] }; nunca lanza.
 *  Es para el cierre del proceso (Ctrl+C) y para doctor; consultarTemp limpia solo lo suyo. */
async function limpiarTemporales(cli) {
  const fallos = [];
  for (const q of cli.registro.listaQueries()) { try { await borrarQueryTemp(cli, q.id); } catch (e) { fallos.push(`query ${q.nombre}: ${e.message}`); } }
  for (const d of cli.registro.listaDes()) { try { await borrarDeTemp(cli, d.key); } catch (e) { fallos.push(`DE ${d.nombre}: ${e.message}`); } }
  return { fallos };
}
/** Si el usuario hace Ctrl+C a mitad de una consulta, no deja basura en SFMC. */
function instalarLimpiezaAlSalir(cli) {
  if (cli._limpiezaInstalada) return;
  cli._limpiezaInstalada = true;
  const salir = (codigo) => async () => { try { await limpiarTemporales(cli); } finally { process.exit(codigo); } };
  process.once('SIGINT', salir(130));
  process.once('SIGTERM', salir(143));
}
/** Temporales (con el prefijo) que HAY en la BU, de cualquier corrida: { des:[{nombre,key,creada}], queries:[{nombre,id}] }. */
async function listarTemporales(cli, cfg) {
  const pre = cfg.prefijoTemporales;
  const { xml } = await cli.soapOk('Retrieve', `<RetrieveRequest><ObjectType>DataExtension</ObjectType><Properties>Name</Properties><Properties>CustomerKey</Properties><Properties>CreatedDate</Properties>${filtroSimple('Name', 'like', pre + '%')}</RetrieveRequest>`);
  const des = bloques(xml).map(bl => ({ nombre: etiqueta(bl, 'Name'), key: etiqueta(bl, 'CustomerKey'), creada: etiqueta(bl, 'CreatedDate') })).filter(d => d.nombre && d.nombre.startsWith(pre));
  const qs = (await cli.paginar('/automation/v1/queries')).filter(q => q.name && q.name.startsWith(pre)).map(q => ({ nombre: q.name, id: q.queryDefinitionId, creada: q.createdDate }));
  return { des, queries: qs };
}

/**
 * Offset (horas vs UTC) de la zona de la CUENTA, MEDIDO: crea una DE sonda, lee su CreatedDate y lo compara con "ahora".
 * Se mide en vez de suponerlo porque de el depende la EDAD de un temporal huerfano, y borrar uno que otro operador
 * esta usando seria peor que dejar basura. Redondea al cuarto de hora. Lanza si no logra leer la fecha de la sonda.
 */
async function medirOffsetCuenta(cli, cfg) {
  const nombre = nombreTemp(cfg.prefijoTemporales, 'sonda');
  const de = await crearDeTemp(cli, cfg, nombre, [{ name: COL_CLAVE, type: 'Text', length: 10, pk: true }]);
  try {
    const ahora = cli.ahora();
    let creada = null;
    for (let i = 0; i < 4 && !creada; i++) {
      if (i) await cli.dormir(3000);
      try { creada = (await infoDe(cli, nombre)).creada; } catch { /* aun no se ve */ }
      if (!creada) memo(cli, '_cacheInfoDe').delete(nombre);
    }
    const t = creada && parseFechaSfmc(creada, 0);          // el texto de la cuenta leido "como si fuera UTC"
    if (t == null) throw new ErrorSfmc('No pude medir la zona horaria de la cuenta (la DE sonda no devolvió CreatedDate).');
    return Math.round(((t - ahora) / 3600e3) * 4) / 4;      // cuenta = UTC + offset
  } finally { try { await borrarDeTemp(cli, de.key); } catch { /* lo recogera doctor --limpiar-tmp */ } }
}

class ErrorLimpieza extends Error { constructor(msg) { super(msg); this.name = 'ErrorLimpieza'; } }
const MIN_EDAD_PERMITIDA_MIN = 15, MAX_EDAD_PERMITIDA_MIN = 10080;
/**
 * --min-edad: un NUMERO de minutos entre 15 y 10080. Un valor invalido (texto -> NaN, una bandera sola -> true -> 1 minuto) hacia que la limpieza considerara
 * "huerfano" TODO lo temporal, incluso lo de otro operador en curso. 15 min porque ninguna operacion del kit mantiene un temporal vivo mas de ~10 min.
 */
function validarMinEdad(v) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN);
  if (!Number.isFinite(n) || n < MIN_EDAD_PERMITIDA_MIN || n > MAX_EDAD_PERMITIDA_MIN) {
    throw new ErrorLimpieza(`--min-edad debe ser un número de minutos entre ${MIN_EDAD_PERMITIDA_MIN} y ${MAX_EDAD_PERMITIDA_MIN} (recibí ${JSON.stringify(v)}): un temporal más reciente puede ser de otro operador en curso.`);
  }
  return n;
}

/**
 * Borra temporales HUERFANOS (de corridas que murieron sin limpiar): solo con el prefijo Y con edad >= minEdadMin (15 a 10080 min; 60 por defecto).
 * La edad usa el offset MEDIDO. Lo que no se pueda datar o sea mas reciente se OMITE (puede ser de otro operador en curso).
 * NUNCA adopta un objeto del propio reporte (por nombre, key o id de la config), aunque su nombre empiece con el prefijo.
 * Registra lo elegido en el cliente (la guardia solo deja borrar lo registrado) y lo borra.
 */
async function limpiarHuerfanos(cli, cfg, { minEdadMin = 60, offsetHoras } = {}) {
  const minEdad = validarMinEdad(minEdadMin);                                              // ANTES de tocar SFMC
  const off = offsetHoras != null ? offsetHoras : await medirOffsetCuenta(cli, cfg);
  const { des, queries } = await listarTemporales(cli, cfg);
  const ahora = cli.ahora();
  const omitidos = []; const elegidos = { des: [], queries: [] };
  const edad = (s) => { const t = parseFechaSfmc(s, off); return t == null ? null : (ahora - t) / 60000; };
  const nombresReporte = new Set([...Object.values(cfg.des || {}).map(d => d && d.nombre), ...Object.values(cfg.queries || {}).map(q => q && q.nombre)].filter(Boolean));
  const keysReporte = new Set(Object.values(cfg.des || {}).map(d => d && d.key).filter(Boolean).map(s => String(s).toUpperCase()));
  const idsReporte = new Set(Object.values(cfg.queries || {}).map(q => q && q.id).filter(Boolean).map(s => String(s).toLowerCase()));
  for (const q of queries) {
    const e = edad(q.creada);
    if (nombresReporte.has(q.nombre) || idsReporte.has(String(q.id).toLowerCase())) omitidos.push({ tipo: 'query', nombre: q.nombre, edadMin: e, motivo: 'es del reporte' });
    else if (e == null || e < minEdad) omitidos.push({ tipo: 'query', nombre: q.nombre, edadMin: e });
    else { cli.registro.addQuery(q.id, q.nombre); elegidos.queries.push(q.nombre); }
  }
  for (const d of des) {
    const e = edad(d.creada);
    if (nombresReporte.has(d.nombre) || keysReporte.has(String(d.key).toUpperCase())) omitidos.push({ tipo: 'DE', nombre: d.nombre, edadMin: e, motivo: 'es del reporte' });
    else if (e == null || e < minEdad) omitidos.push({ tipo: 'DE', nombre: d.nombre, edadMin: e });
    else { cli.registro.addDe(d.key, d.nombre); elegidos.des.push(d.nombre); }
  }
  const { fallos } = await limpiarTemporales(cli);
  return { offsetHoras: off, borrados: elegidos, omitidos, fallos };
}

// ---------- consulta temporal CON CENTINELA ----------
// 🔴 SFMC rechaza campos que empiecen con "_" (HTTP 400 "Field name cannot begin with an underscore"; lo destapo la
//    primera corrida en vivo — la simulacion no lo sabia). Por eso la PK se llama ClaveTmp. El VALOR __FIN__ si puede.
const COL_CLAVE = 'ClaveTmp';
const CENTINELA = '__FIN__';

/**
 * Quita los comentarios SQL (/* … *\/ y -- …) respetando las cadenas '…' y los identificadores […].
 * 🔴 SFMC RECHAZA un comentario dentro de una subconsulta (HTTP 400 "Incorrect syntax near the keyword 'SELECT'"; medido en vivo el
 *    2-oct-2026 con el SQL de la query Vol: con comentario inicial falla, sin el pasa — y no es el guion largo, un comentario ASCII
 *    tambien falla). El envoltorio con centinela mete el SQL del usuario en una subconsulta, asi que hay que quitarlos.
 */
function quitarComentariosSql(sql) {
  const s = String(sql); let out = ''; let i = 0;
  const cierre = (ini, ch) => { let j = ini + 1; while (j < s.length) { if (s[j] === ch && s[j + 1] === ch) j += 2; else if (s[j] === ch) return j + 1; else j++; } return j; };   // '' y ]] son escapes
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (c === "'") { const j = cierre(i, "'"); out += s.slice(i, j); i = j; }
    else if (c === '[') { const j = cierre(i, ']'); out += s.slice(i, j); i = j; }
    else if (c === '-' && d === '-') { let j = i + 2; while (j < s.length && s[j] !== '\n') j++; out += ' '; i = j; }
    else if (c === '/' && d === '*') { const j = s.indexOf('*/', i + 2); out += ' '; i = j < 0 ? s.length : j + 2; }
    else { out += c; i++; }
  }
  return out;
}

/**
 * Envuelve `sql` para que su resultado lleve una PK unica `ClaveTmp` y termine con la fila `__FIN__`.
 * `campos` = los nombres de las columnas que `sql` devuelve (se re-seleccionan en ese orden).
 * Limites: `sql` no puede empezar con WITH (CTE) ni traer ORDER BY sin TOP; un `;` final se quita; los comentarios se quitan.
 */
function construirSqlCentinela(sql, campos) {
  if (!Array.isArray(campos) || !campos.length) throw new ErrorSql('construirSqlCentinela: faltan los campos de salida.');
  if (campos.includes(COL_CLAVE)) throw new ErrorSql(`El nombre de columna "${COL_CLAVE}" está reservado para la clave de la consulta temporal.`);
  const malos = campos.filter(c => String(c).startsWith('_'));
  if (malos.length) throw new ErrorSql(`SFMC no admite columnas que empiecen con "_": ${malos.join(', ')}.`);
  const limpio = quitarComentariosSql(sql).replace(/;\s*$/, '').trim();
  if (!limpio) throw new ErrorSql('SQL vacío.');
  if (/^\s*WITH\b/i.test(limpio)) throw new ErrorSql('consultarTemp no admite CTE (WITH …): reescribe con subconsultas.');
  const cols = campos.map(c => `q.[${String(c).replace(/]/g, ']]')}] AS [${String(c).replace(/]/g, ']]')}]`).join(', ');
  const nulos = campos.map(() => 'NULL').join(', ');
  return `SELECT CONVERT(varchar(36), NEWID()) AS ${COL_CLAVE}, ${cols}\nFROM (\n${limpio}\n) q\nUNION ALL\nSELECT '${CENTINELA}', ${nulos}`;
}

/**
 * Ejecuta `sql` en una DE + query TEMPORALES (nombres unicos), espera el centinela y limpia SIEMPRE (finally).
 *   campos: [{ name, type:'Text'|'Number'|'Date'|'Decimal'|'Boolean', length? }]   — las columnas que devuelve el SQL
 * Devuelve { filas, completo, segundos, ultimoError }.
 *   completo:true  => la query TERMINO; filas:[] es un NEGATIVO REAL.
 *   completo:false => se acabo el tiempo SIN centinela: NO concluyas nada (ni "no existe").
 */
async function consultarTemp(cli, cfg, { etiqueta: etq, sql, campos, timeoutS = 360, pollMs = 6000, estabilidadMs = 3000, log = () => {} }) {
  exigirCarpetas(cfg);
  const nombre = nombreTemp(cfg.prefijoTemporales, etq);
  const cols = campos.map(c => c.name);
  const envuelta = construirSqlCentinela(sql, cols);
  const t0 = cli.ahora();
  let de = null, q = null;
  try {
    de = await crearDeTemp(cli, cfg, nombre, [{ name: COL_CLAVE, type: 'Text', length: 40, pk: true }, ...campos]);
    q = await crearQueryTemp(cli, cfg, `${nombre}_Load`, envuelta, de.nombre, de.key);
    await iniciarQuery(cli, q.id);
    log(`  consulta temporal ${nombre}: iniciada`);
    const leer = () => leerFilas(cli, de.nombre, [COL_CLAVE, ...cols], { validar: false });
    let ultimoError = null;
    while (cli.ahora() - t0 < timeoutS * 1000) {
      await cli.dormir(pollMs);
      let filas; try { filas = await leer(); } catch (e) { ultimoError = e.message; continue; }     // la DE recien creada puede tardar en verse
      if (!filas.some(f => f[COL_CLAVE] === CENTINELA)) continue;
      let estable = filas, confirmada = false;                                                   // lectura de estabilidad: la carga puede venir en lotes
      for (let i = 0; i < 5 && !confirmada; i++) {
        await cli.dormir(estabilidadMs); let otra;
        try { otra = await leer(); } catch (e) { ultimoError = 'no pude confirmar que la carga terminó: ' + e.message; break; }
        confirmada = otra.length === estable.length; estable = otra;
      }
      if (!confirmada) continue;       // la carga sigue creciendo, o no se pudo releer: NO se da por completa (un negativo falso es peor que esperar); se sigue sondeando hasta el tiempo limite
      return { filas: estable.filter(f => f[COL_CLAVE] !== CENTINELA).map(({ [COL_CLAVE]: _clave, ...r }) => r), completo: true, segundos: Math.round((cli.ahora() - t0) / 1000), ultimoError: null };
    }
    return { filas: [], completo: false, segundos: Math.round((cli.ahora() - t0) / 1000), ultimoError };
  } finally {
    // 🔴 Limpia SOLO lo de ESTA consulta. limpiarTemporales(cli) borra TODO lo registrado en el cliente: con dos consultas
    //    en curso, la primera en terminar se llevaba la DE y la query de la otra (lo destapo una corrida en vivo).
    const fallos = [];
    if (q) { try { await borrarQueryTemp(cli, q.id); } catch (e) { fallos.push(`query ${q.nombre}: ${e.message}`); } }
    if (de) { try { await borrarDeTemp(cli, de.key); } catch (e) { fallos.push(`DE ${de.nombre}: ${e.message}`); } }
    for (const f of fallos) log('  ⚠️ no pude limpiar: ' + f + '  (corre: node scripts/doctor.js --limpiar-tmp)');
  }
}

module.exports = { ErrorColumna, ErrorSql, ErrorLimpieza, validarMinEdad, MIN_EDAD_PERMITIDA_MIN, COL_CLAVE, CENTINELA, infoDe, claveDe, columnas, leerFilas, contarFilas, insertarFila, upsertarFila, crearDeTemp, crearQueryTemp, iniciarQuery, borrarQueryTemp, borrarDeTemp, limpiarTemporales, instalarLimpiezaAlSalir, listarTemporales, medirOffsetCuenta, limpiarHuerfanos, quitarComentariosSql, construirSqlCentinela, consultarTemp, campoRest };
