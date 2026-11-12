'use strict';
// Resuelve el/los EmailName REALES de _Job para uno o varios fragmentos de texto.
//
// 🔴 REGLA DURA DEL PIPELINE: la identidad de una pieza es el EmailName EXACTO de _Job. NUNCA el codigo de asset del brief
//    (casi nunca coincide: 069127 no existia, 048423 era 035275, 0242434 era 024243...) ni el asset de Content Builder (no es
//    la identidad, y la API de assets rebota 403 con el scope de lectura). Esto va ANTES de agregar / actualizar / reportar.
//
// _Job.EmailName se trunca a 100 caracteres y SFMC le pega un sufijo " - AAAAMM" cuando el email se copio o reenvio.
// El nombre que sale de aqui ES el que hay que usar como llave: contra el casa el JOIN del reporte (RTRIM(j.EmailName)=c.EmailName).
const D = require('./de');
const { leerCatalogoFilas } = require('./catalogo');
const { parseFechaSfmc, fechaCuenta } = require('./fechas');
const { paraMostrar, avisoDeNombre } = require('./textoseguro');

class ErrorResolver extends Error { constructor(msg) { super(msg); this.name = 'ErrorResolver'; } }

const MIN_FRAGMENTO = 3;          // menos que eso casa con casi todo _Job
const MAX_FRAGMENTOS = 20;
const LARGO_SFMC = 100;
const RE_SUFIJO_FECHA = /\s-\s\d{4,8}\s*$/;
// Fechas: _Job.DeliveredTime viene VACIO en la mayoria de los jobs de journey (medido en vivo 2-oct-2026); SchedTime siempre esta.
const CAMPOS = [
  { name: 'EmailName', type: 'Text', length: 250 }, { name: 'EmailID', type: 'Number' }, { name: 'Len', type: 'Number' },
  { name: 'Jobs', type: 'Number' }, { name: 'Subject', type: 'Text', length: 250 },
  { name: 'Primero', type: 'Date' }, { name: 'Ultimo', type: 'Date' },
];

/** Limpia, quita duplicados (sin distinguir mayusculas) y valida. Lanza ErrorResolver con la lista de lo que esta mal. */
function validarFragmentos(frags) {
  const vistos = new Set(), limpios = [];
  for (const f of [].concat(frags || [])) {
    const t = String(f == null ? '' : f).trim();
    if (!t || vistos.has(t.toLowerCase())) continue;
    vistos.add(t.toLowerCase()); limpios.push(t);
  }
  if (!limpios.length) throw new ErrorResolver('Falta al menos un fragmento del nombre a buscar.');
  if (limpios.length > MAX_FRAGMENTOS) throw new ErrorResolver(`Máximo ${MAX_FRAGMENTOS} fragmentos por consulta (llegaron ${limpios.length}).`);
  const cortos = limpios.filter(f => f.length < MIN_FRAGMENTO);
  if (cortos.length) throw new ErrorResolver(`Fragmento demasiado corto (mínimo ${MIN_FRAGMENTO} caracteres, casaría con casi todos los envíos): ${cortos.map(c => JSON.stringify(c)).join(', ')}`);
  return limpios;
}

/** Texto LITERAL para un LIKE de T-SQL: escapa la comilla y los comodines % _ [ (el fragmento nunca es un patron). */
const likeLiteral = (s) => String(s).replace(/\[/g, '[[]').replace(/%/g, '[%]').replace(/_/g, '[_]').replace(/'/g, "''");

/** desde = piso de JobID (acelera mucho: sin el se escanea todo _Job). */
function construirSql(frags, { desde = null } = {}) {
  if (desde != null && !(Number.isInteger(Number(desde)) && Number(desde) >= 0)) throw new ErrorResolver(`--desde debe ser un JobID (entero >= 0), no ${JSON.stringify(desde)}`);
  const cond = frags.map(f => `RTRIM(j.EmailName) LIKE '%${likeLiteral(f)}%'`).join('\n        OR ');
  const piso = desde != null ? `j.JobID > ${Number(desde)} AND ` : '';
  return `SELECT RTRIM(j.EmailName) AS EmailName, MAX(j.EmailID) AS EmailID, MAX(LEN(RTRIM(j.EmailName))) AS Len, COUNT(*) AS Jobs,
       LEFT(MAX(RTRIM(j.EmailSubject)), 250) AS Subject, MIN(j.SchedTime) AS Primero, MAX(j.SchedTime) AS Ultimo
FROM _Job j
WHERE ${piso}(${cond})
GROUP BY RTRIM(j.EmailName)`;
}

const limpiarAsunto = (s) => String(s || '').replace(/%%\[[\s\S]*?\]%%/g, '').replace(/\s+/g, ' ').trim();
/** Fecha de la cuenta tal cual viene (sin zona) -> texto 'AAAA-MM-DD HH:MM' + ms comparables entre si. */
const fecha = (s) => ({ texto: fechaCuenta(s), ms: parseFechaSfmc(s, 0) });

/**
 * Convierte las filas crudas en candidatos listos para mostrar. Pura.
 *   catalogo: Map(EmailName -> { clave, marca, campana, touchpoint, activo }) | null (no se pudo leer)
 */
function enriquecer(filas, frags, catalogo = null) {
  const out = filas.map((f) => {
    const nombre = String(f.EmailName == null ? '' : f.EmailName).trim();
    const len = Number(f.Len) || nombre.length;
    const subject = limpiarAsunto(f.Subject);
    const p = fecha(f.Primero), u = fecha(f.Ultimo);
    return {
      emailName: nombre, len, emailId: f.EmailID == null || f.EmailID === '' ? null : Number(f.EmailID), jobs: Number(f.Jobs) || 0,
      subject: subject.slice(0, 70), primero: p.texto, ultimo: u.texto, _ms: u.ms,
      coincide: frags.filter(fr => nombre.toLowerCase().includes(fr.toLowerCase())),
      prueba: /\[test|\btest\b/i.test(subject),
      truncado: len >= LARGO_SFMC,
      copia: RE_SUFIJO_FECHA.test(nombre),
      enCatalogo: catalogo ? (catalogo.get(nombre) || null) : undefined,
    };
  });
  out.sort((a, b) => (b._ms ?? -1) - (a._ms ?? -1) || b.jobs - a.jobs || a.emailName.localeCompare(b.emailName));
  return out.map(({ _ms, ...c }) => c);
}

/**
 * Un candidato listo para imprimir (varias lineas). Un nombre de _Job es texto AJENO: todo lo que viene de SFMC pasa por paraMostrar, asi que no puede falsificar otras lineas
 * ni mover la terminal, y si trae caracteres que el shell interpreta ($(…), comillas…) o invisibles, se avisa en el mismo bloque.
 */
function formatearCandidato(c, i) {
  const v = paraMostrar;
  const marcas = [];
  if (c.copia) marcas.push('⚠️  copia/reenvío (sufijo de fecha): es OTRO nombre que el original');
  if (c.truncado) marcas.push('⚠️  100 caracteres: SFMC lo truncó, úsalo tal cual');
  if (c.prueba) marcas.push('⚠️  parece un envío de PRUEBA ([TEST] en el asunto)');
  const aviso = avisoDeNombre(c.emailName);
  if (aviso) marcas.push('⚠️  este nombre ' + aviso);
  const cat = c.enCatalogo === undefined ? null
    : c.enCatalogo ? `✔ YA ESTÁ en el catálogo → ${[c.enCatalogo.clave, c.enCatalogo.marca, c.enCatalogo.campana, c.enCatalogo.touchpoint, 'Activo=' + c.enCatalogo.activo].filter(Boolean).map(v).join(' · ')}`
      : '✚ NUEVA: no está en el catálogo';
  const ventana = c.primero ? (c.primero === c.ultimo ? c.primero : `${c.primero} → ${c.ultimo}`) : 'sin fecha';
  return [
    `${String(i + 1).padStart(2)}. ${v(c.emailName)}`,
    `    len ${c.len} · EmailID ${c.emailId ?? '?'} · ${c.jobs} job${c.jobs === 1 ? '' : 's'} · ${ventana}${c.subject ? ' · "' + v(String(c.subject).slice(0, 45)) + '"' : ''}`,
    `    coincide con: ${c.coincide.map(f => '"' + v(f) + '"').join(', ')}`,
    ...(cat ? ['    ' + cat] : []),
    ...marcas.map(m => '    ' + m),
  ].join('\n');
}

/** EmailName -> datos del catalogo. Lanza si no se puede leer (quien llama decide: el resolver sigue funcionando sin eso). */
async function leerCatalogo(cli, cfg) {
  const { pk, filas } = await leerCatalogoFilas(cli, cfg, ['Marca', 'Campana', 'Touchpoint', 'Activo']);
  return new Map(filas.map(f => [String(f.EmailName).trim(), { clave: f[pk], marca: f.Marca, campana: f.Campana, touchpoint: f.Touchpoint, activo: f.Activo }]));
}

/**
 * Entrada principal. Devuelve { frags, desde, sql, completo, segundos, candidatos, sinCoincidencia, avisos }.
 *   completo:false => se acabo el tiempo SIN que la consulta termine: NO se puede concluir que el envio "no existe".
 *   completo:true y candidatos:[] => negativo REAL (ningun _Job.EmailName contiene esos fragmentos).
 * inyectables (pruebas): consultar, leerCatalogo.
 */
async function resolverEmailNames(cli, cfg, { frags, desde = null, timeoutS = 600, pollMs = 6000, log = () => {} },
  { consultar = D.consultarTemp, leerCat = leerCatalogo } = {}) {
  const fr = validarFragmentos(frags);
  const sql = construirSql(fr, { desde });
  const r = await consultar(cli, cfg, { etiqueta: 'resolver', sql, campos: CAMPOS, timeoutS, pollMs, log });
  const avisos = [];
  if (!r.completo) {
    avisos.push(`La consulta NO terminó en ${timeoutS} s${r.ultimoError ? ' (último error: ' + r.ultimoError + ')' : ''}. NO concluyas que el envío no existe: reintenta (--desde <JobID reciente> reduce lo que se escanea) o mide la latencia del motor con scripts/doctor.js --latencia.`);
    return { frags: fr, desde, sql, completo: false, segundos: r.segundos, candidatos: [], sinCoincidencia: [], avisos };
  }
  let catalogo = null;
  try { catalogo = await leerCat(cli, cfg); } catch (e) { avisos.push('No pude leer el catálogo para marcar cuáles ya están registradas: ' + e.message); }
  const candidatos = enriquecer(r.filas, fr, catalogo);
  const sinCoincidencia = fr.filter(f => !candidatos.some(c => c.coincide.includes(f)));
  if (candidatos.some(c => c.truncado)) avisos.push(`Hay nombres de ${LARGO_SFMC} caracteres: SFMC trunca _Job.EmailName a ${LARGO_SFMC}. Úsalos tal cual salen (así casa el JOIN).`);
  return { frags: fr, desde, sql, completo: true, segundos: r.segundos, candidatos, sinCoincidencia, avisos };
}

module.exports = { ErrorResolver, MIN_FRAGMENTO, MAX_FRAGMENTOS, LARGO_SFMC, RE_SUFIJO_FECHA, CAMPOS, validarFragmentos, likeLiteral, construirSql, enriquecer, formatearCandidato, leerCatalogo, resolverEmailNames };
