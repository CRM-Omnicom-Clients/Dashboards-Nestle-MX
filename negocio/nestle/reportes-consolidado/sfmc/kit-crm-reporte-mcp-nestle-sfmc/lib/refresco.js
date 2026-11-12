'use strict';
// Refresco MANUAL de las DEs del reporte para UNA pieza, con senales ROBUSTAS de que cada query termino.
//
// 🔴 Una query de SFMC NO expone su estado por REST (la definicion no trae "status"). La unica evidencia de que corrio es lo que
//    ESCRIBE en su DE destino: cada fila lleva un sello GETDATE() (LastRefresh / LastRun). Por eso la senal es ANTES/DESPUES:
//    todas las filas de la pieza deben traer un sello POSTERIOR al mayor que habia antes de iniciar la query.
//    NO se usa "LastRefresh uniforme": Detalle es Update (upsert) y con el motor cargado nunca queda uniforme aunque la pieza ya
//    aterrizo (mordio el 14-sep con J8). La pieza se busca por EmailName (existe en las 4 DEs de salida, antes y despues de la migracion).
//
// Lag de propagacion: tras insertar la pieza en el catalogo, la primera corrida de Detalle puede NO verla. Si la corrida TERMINO
// (el sello de la DE avanzo y se quedo quieto) y la pieza sigue ausente, se re-corre.
//
// Seguridad: no se corre mientras la automation del reporte esta corriendo o por arrancar (se pisarian las queries): --forzar lo salta.
//   FAIL-CLOSED: si no se puede LEER la automation, o su proxima corrida no se entiende, tampoco se corre (no se sabe si hay peligro). Y se vuelve a mirar
//   ANTES DE CADA (RE)INICIO de una query: un refresco con reintentos puede durar mas de una hora y cruzarse con la corrida de las 00:08.
const D = require('./de');
const { filtroSimple } = require('./xml');
const { parseFechaSfmc, edadMinutos, formatoEdad } = require('./fechas');
const { leerCatalogoFilas } = require('./catalogo');

// rol de query -> (DE que llena, columna con su sello de tiempo, y si la senal se busca por pieza o en toda la DE)
const PASOS = {
  vol:       { de: 'audiencias', ts: 'LastRefresh', alcance: 'de' },
  detalle:   { de: 'detalle',    ts: 'LastRefresh', alcance: 'pieza' },
  piezas:    { de: 'piezas',     ts: 'LastRefresh', alcance: 'pieza' },
  auditoria: { de: 'auditoria',  ts: 'LastRun',     alcance: 'pieza' },
  links:     { de: 'links',      ts: 'LastRefresh', alcance: 'de' },
};
// Tiempo maximo por intento y numero de intentos. Medido EN VIVO el 2-oct-2026 con el motor sin carga: vol 55 s · links 59 s ·
// detalle 7 min · piezas 35 s · auditoria 24 s (9 min en total). Los topes dejan >= 5x de margen, y 2.8x en detalle (el paso lento):
// un tope corto no ahorra nada y provoca un re-inicio de una query que sigue corriendo.
const DEFECTOS = {
  vol: { timeoutS: 300, intentos: 2 }, links: { timeoutS: 360, intentos: 2 }, detalle: { timeoutS: 1200, intentos: 4 },
  piezas: { timeoutS: 420, intentos: 3 }, auditoria: { timeoutS: 300, intentos: 2 },
};
const MINUTOS_PREVIOS_A_LA_AUTOMATION = 20;
const YA_EN_CURSO = /already|running|in progress|queued|busy|en curso|ejecuci/i;
const POLLS_QUIETOS = 2;

class ErrorRefresco extends Error { constructor(msg) { super(msg); this.name = 'ErrorRefresco'; } }

/** Sellos de tiempo de una columna: { n, minMs, maxMs }. Con `emailName`, solo las filas de esa pieza. */
async function leerSello(cli, nombreDe, ts, emailName = null) {
  const campos = emailName ? ['EmailName', ts] : [ts];
  const filas = await D.leerFilas(cli, nombreDe, campos, { filtro: emailName ? filtroSimple('EmailName', 'equals', emailName) : '' });
  let n = 0, minMs = null, maxMs = null;
  for (const f of filas) {
    const ms = parseFechaSfmc(f[ts], 0);                 // misma zona en todas: solo se comparan entre si
    if (ms == null) continue;
    n++; if (minMs == null || ms < minMs) minMs = ms; if (maxMs == null || ms > maxMs) maxMs = ms;
  }
  return { n, minMs, maxMs };
}
const aterrizo = (despues, antes) => despues != null && despues.n > 0 && despues.minMs > (antes && antes.maxMs != null ? antes.maxMs : -Infinity);
const avanzo = (despues, antes) => despues != null && despues.maxMs != null && despues.maxMs > (antes && antes.maxMs != null ? antes.maxMs : -Infinity);
const seg = (cli, t0) => Math.round((cli.ahora() - t0) / 1000);

/**
 * Inicia la query del rol y espera la senal. Devuelve { rol, estado: 'ok' | 'sin-aterrizar' | 'timeout' | 'error', intentos, segundos, … }.
 *   'sin-aterrizar': la query TERMINO (el sello avanzo y se quedo quieto) pero la pieza no aparecio — todos los intentos.
 *   'timeout': no hubo evidencia de que terminara.
 */
async function correrPaso(cli, cfg, rol, { emailName, pollMs, timeoutS, intentos, log, reverificar = null }) {
  const { de: rolDe, ts, alcance } = PASOS[rol];
  const nombreDe = cfg.des[rolDe].nombre; const pieza = alcance === 'pieza' ? emailName : null;
  const t0 = cli.ahora();
  const antesDe = await leerSello(cli, nombreDe, ts);
  const antesPz = pieza ? await leerSello(cli, nombreDe, ts, pieza) : null;
  let terminoAlgunaVez = false;                                                     // ¿alguna corrida TERMINO sin que la pieza aterrizara?
  for (let intento = 1; intento <= intentos; intento++) {
    // "¿esta corrida ya escribio algo?" se mide contra el estado de la DE justo ANTES de iniciar ESTE intento. Contra el del paso entero,
    // la corrida anterior (ya terminada) haria parecer que el siguiente intento termino en cuanto arranca (y se re-correria sin esperar).
    const baseIntento = intento === 1 ? antesDe : await leerSello(cli, nombreDe, ts);
    if (reverificar) {                                                                // ¿sigue siendo seguro iniciar la query? (la automation pudo arrancar mientras tanto)
      const est = await reverificar();
      if (est.bloqueos.length) return { rol, estado: 'bloqueado', bloqueos: est.bloqueos, intentos: intento - 1, segundos: seg(cli, t0), antesDe, antesPz };
    }
    let enCurso = false;
    try { await D.iniciarQuery(cli, cfg.queries[rol].id); }
    catch (e) { if (YA_EN_CURSO.test(e.message)) enCurso = true; else return { rol, estado: 'error', error: e.message, intentos: intento, segundos: seg(cli, t0), antesDe, antesPz }; }
    log(`  ${rol}: intento ${intento}/${intentos} ${enCurso ? '— la query YA estaba corriendo: espero a que termine' : 'iniciado'}`);
    const ti = cli.ahora(); let previo = null, quietos = 0, ultimoLog = ti, esteTermino = false;
    while (cli.ahora() - ti < timeoutS * 1000) {
      await cli.dormir(pollMs);
      let de1, pz1 = null;
      try { de1 = await leerSello(cli, nombreDe, ts); if (pieza) pz1 = await leerSello(cli, nombreDe, ts, pieza); }
      catch { continue; }                                                           // una lectura que falla no es el fin: se reintenta
      if (pieza ? aterrizo(pz1, antesPz) : aterrizo(de1, antesDe)) return { rol, estado: 'ok', intentos: intento, segundos: seg(cli, t0), antesDe, antesPz, despuesDe: de1, despuesPz: pz1 };
      if (pieza && avanzo(de1, baseIntento)) {                                      // la corrida ya escribio en la DE...
        quietos = previo && previo.maxMs === de1.maxMs && previo.n === de1.n ? quietos + 1 : 0; previo = de1;
        if (quietos >= POLLS_QUIETOS) { esteTermino = terminoAlgunaVez = true; break; }   // ...y se quedo quieta: termino y la pieza NO esta
      }
      if (cli.ahora() - ultimoLog >= 60000) { ultimoLog = cli.ahora(); log(`  ${rol}: ${Math.round((cli.ahora() - ti) / 1000)} s esperando${pieza ? ` (filas de la pieza: ${pz1 ? pz1.n : '?'})` : ''}`); }
    }
    if (intento < intentos) log(esteTermino ? `  ${rol}: la query TERMINO pero la pieza no aparece (lag de propagacion del catalogo); la vuelvo a correr`
      : `  ${rol}: no vi evidencia de que terminara en ${timeoutS} s; la vuelvo a correr`);
  }
  return { rol, estado: terminoAlgunaVez ? 'sin-aterrizar' : 'timeout', intentos, segundos: seg(cli, t0), antesDe, antesPz };
}

/**
 * ¿Es seguro refrescar a mano AHORA? Lee la automation. FAIL-CLOSED: si no se puede leer, o su proxima corrida existe pero no se entiende, devuelve un bloqueo (forzable).
 * Devuelve { automation, bloqueos }. Una automation SIN proxima corrida programada no bloquea por fecha (nada puede cruzarse).
 */
async function estadoAutomation(cli, cfg) {
  const offset = cfg.bu && cfg.bu.offsetUtcHoras != null ? Number(cfg.bu.offsetUtcHoras) : -6;
  const ilegible = (motivo) => ({ automation: null, bloqueos: [{ codigo: 'automation-ilegible', texto: `No pude leer la automation (${motivo}): no sé si está corriendo. Por seguridad no refresco; si estás SEGURO de que no corre, usa --forzar.`, forzable: true }] });
  let r; try { r = await cli.rest(`/automation/v1/automations/${cfg.automation.id}`); } catch (e) { return ilegible(String(e.message).slice(0, 120)); }
  if (r.status !== 200) return ilegible(`HTTP ${r.status}`);
  // 🔴 FAIL-CLOSED de verdad: un 200 cuyo cuerpo no es una automation (vacio, null, una pagina HTML de un proxy, "Running" sin statusId) NO significa "libre": sin un statusId entero no se sabe si corre.
  const sid = r.json && r.json.statusId;
  if (!(Number.isInteger(sid) || (typeof sid === 'string' && /^\d+$/.test(sid)))) return ilegible('la respuesta no trae un statusId válido (¿una página de un proxy?)');
  const a = r.json; const prox = a.schedule && a.schedule.scheduledTime;
  const edadProx = prox ? edadMinutos(prox, cli.ahora(), offset) : null;                  // negativa = en el futuro; null = fecha ilegible
  const minutosHasta = edadProx == null ? null : -edadProx;
  const automation = { nombre: a.name, status: a.status, statusId: Number(a.statusId), proxima: prox || null, minutosHasta };
  const bloqueos = [];
  if (Number(a.statusId) === 3) bloqueos.push({ codigo: 'automation-corriendo', texto: `La automation "${a.name}" está CORRIENDO ahora: refrescar a mano pisaría sus queries. Espera a que termine (o usa --forzar bajo tu riesgo).`, forzable: true });
  else if (prox && minutosHasta == null) bloqueos.push({ codigo: 'automation-fecha-ilegible', texto: `No pude interpretar la próxima corrida de la automation ("${String(prox).slice(0, 40)}"): no sé si está por arrancar. Por seguridad no refresco; si estás SEGURO de que no arranca pronto, usa --forzar.`, forzable: true });
  else if (minutosHasta != null && minutosHasta >= 0 && minutosHasta < MINUTOS_PREVIOS_A_LA_AUTOMATION) bloqueos.push({ codigo: 'automation-inminente', texto: `La automation arranca en ${formatoEdad(minutosHasta)} (${prox}): un refresco a mano se cruzaría con ella. Espera a que pase (o --forzar).`, forzable: true });
  return { automation, bloqueos };
}

/** Catalogo (¿esta y esta activa?) y automation (¿corriendo o por arrancar?). Solo lectura. */
async function verificarPrecondiciones(cli, cfg, emailName) {
  const out = { catalogo: null, automation: null, bloqueos: [], avisos: [] };
  const cat = await leerCatalogoFilas(cli, cfg, ['Activo', 'Marca', 'Campana', 'Touchpoint']);
  const fila = cat.filas.find(f => String(f.EmailName).trim() === emailName) || null;
  out.catalogo = fila ? { clave: fila[cat.pk], activo: fila.Activo, marca: fila.Marca, campana: fila.Campana, touchpoint: fila.Touchpoint, modo: cat.modo } : null;
  if (!fila) out.bloqueos.push({ codigo: 'no-en-catalogo', texto: 'La pieza NO está en el catálogo (el EmailName debe ser EXACTO). Agrégala con scripts/agregar-pieza.js; Detalle solo carga lo que está en el catálogo.', forzable: false });
  else if (String(fila.Activo).trim().toLowerCase() !== 'si') out.bloqueos.push({ codigo: 'inactiva', texto: `La pieza está en el catálogo con Activo="${fila.Activo}": Detalle solo toma Activo="Si", así que nunca aterrizaría.`, forzable: false });

  const est = await estadoAutomation(cli, cfg);
  out.automation = est.automation; out.bloqueos.push(...est.bloqueos);
  return out;
}

/** Resumen de la pieza ya refrescada (Piezas y Auditoria), con las columnas que EXISTAN. */
async function resumenPieza(cli, cfg, emailName) {
  const leer = async (rol, deseadas) => {
    const nombre = cfg.des[rol].nombre; const cols = new Set((await D.columnas(cli, nombre)).map(c => c.name));
    const pedir = deseadas.filter(c => cols.has(c));
    const filas = await D.leerFilas(cli, nombre, pedir, { filtro: filtroSimple('EmailName', 'equals', emailName) });
    return filas[0] || null;
  };
  const piezas = await leer('piezas', ['Marca', 'Campana', 'Touchpoint', 'N_Jobs', 'Dias_Con_Envio', 'Fecha_Primer_Envio', 'Fecha_Ultimo_Envio', 'Email_Sends', 'Email_Deliveries', 'Email_Unique_Opens', 'Open_Rate', 'Email_Unique_Clicks', 'Click_Rate', 'Audience_Volume', 'LastRefresh']);
  const auditoria = await leer('auditoria', ['Estado', 'Asset_Declarado', 'Asset_Real', 'JobsEncontrados', 'EnviosTotales', 'LastRun']);
  return { piezas, auditoria };
}

/** Si Detalle nunca la cargo: ¿tiene envios en _Sent? (el motivo mas comun). Devuelve null si no se pudo averiguar. */
async function diagnosticarEnvios(cli, cfg, emailName, { consultar = D.consultarTemp, log = () => {} } = {}) {
  let desde = null;
  try { const q = await cli.rest(`/automation/v1/queries/${cfg.queries.detalle.id}`); const m = /EventDate\s*>=\s*'(\d{4}-\d{2}-\d{2})'/i.exec(String(q.json && q.json.queryText)); desde = m ? m[1] : null; } catch { /* sin ventana */ }
  const lit = emailName.replace(/'/g, "''");
  const sql = `SELECT COUNT(*) AS Envios, SUM(CASE WHEN ${desde ? `s.EventDate >= '${desde}'` : '1 = 1'} THEN 1 ELSE 0 END) AS EnVentana, CONVERT(date, MIN(s.EventDate)) AS Primero, CONVERT(date, MAX(s.EventDate)) AS Ultimo
FROM _Sent s INNER JOIN _Job j ON j.JobID = s.JobID WHERE RTRIM(j.EmailName) = '${lit}'`;
  const r = await consultar(cli, cfg, { etiqueta: 'diag', sql, campos: [{ name: 'Envios', type: 'Number' }, { name: 'EnVentana', type: 'Number' }, { name: 'Primero', type: 'Date' }, { name: 'Ultimo', type: 'Date' }], timeoutS: 480, pollMs: 6000, log });
  if (!r.completo) return null;
  const f = r.filas[0] || {};
  return { envios: Number(f.Envios) || 0, enVentana: Number(f.EnVentana) || 0, desde, primero: f.Primero || null, ultimo: f.Ultimo || null };
}

/**
 * Entrada principal. opts: { emailName, sinVol, sinLinks, forzar, dryRun, pollMs, tiempos:{rol:{timeoutS,intentos}}, log }.
 * estado: 'ok' | 'rechazado' (precondicion) | 'plan' (dryRun) | 'fallo' (un paso no termino / no aterrizo).
 */
async function refrescarPieza(cli, cfg, opts, { diagnosticar = diagnosticarEnvios } = {}) {
  const { sinVol = false, sinLinks = false, forzar = false, dryRun = false, pollMs = 10000, tiempos = {}, log = () => {} } = opts;
  const emailName = String(opts.emailName || '').trim();
  if (!emailName) throw new ErrorRefresco('Falta el EmailName EXACTO de la pieza (encuéntralo con scripts/resolver-emailname.js).');
  const t0 = cli.ahora();
  const pre = await verificarPrecondiciones(cli, cfg, emailName);
  const bloqueos = pre.bloqueos.filter(b => !(forzar && b.forzable));
  const grupos = cfg.automation.pasosEsperados.map(g => g.filter(r => !(r === 'vol' && sinVol) && !(r === 'links' && sinLinks))).filter(g => g.length);
  const base = { emailName, precondiciones: pre, grupos, avisos: [...pre.avisos], pasos: [] };
  if (forzar) for (const b of pre.bloqueos.filter(x => x.forzable)) base.avisos.push(`--forzar: se ignora el bloqueo "${b.codigo}" (${b.texto})`);
  if (bloqueos.length) return { ...base, estado: 'rechazado', bloqueos };
  if (dryRun) return { ...base, estado: 'plan' };

  for (const [i, grupo] of grupos.entries()) {
    log(`Paso ${i + 1}/${grupos.length}: ${grupo.join(' + ')}`);
    // Un paso que LANZA (p. ej. la lectura inicial falla) se vuelve resultado "error": si no, Promise.all rechazaria y su hermano del
    // mismo grupo seguiria sondeando a escondidas, ya sin nadie que mire su resultado.
    const res = await Promise.all(grupo.map(rol => correrPaso(cli, cfg, rol, { emailName, pollMs, log, reverificar: forzar ? null : () => estadoAutomation(cli, cfg), ...DEFECTOS[rol], ...(tiempos[rol] || {}) })
      .catch(e => ({ rol, estado: 'error', error: e.message, intentos: 0, segundos: seg(cli, t0) }))));
    base.pasos.push(...res);
    const mal = res.find(r => r.estado !== 'ok');
    if (mal) {
      const out = { ...base, estado: 'fallo', fallo: mal, segundos: seg(cli, t0) };
      if (mal.rol === 'detalle' && mal.estado !== 'error' && mal.estado !== 'bloqueado') { try { out.diagnostico = await diagnosticar(cli, cfg, emailName, { log }); } catch (e) { out.avisos.push('No pude diagnosticar los envíos: ' + e.message); } }
      return out;
    }
  }
  let resumen = null; try { resumen = await resumenPieza(cli, cfg, emailName); } catch (e) { base.avisos.push('No pude leer el resumen de la pieza: ' + e.message); }
  return { ...base, estado: 'ok', resumen, segundos: seg(cli, t0) };
}

module.exports = { ErrorRefresco, PASOS, DEFECTOS, MINUTOS_PREVIOS_A_LA_AUTOMATION, estadoAutomation, leerSello, aterrizo, avanzo, correrPaso, verificarPrecondiciones, resumenPieza, diagnosticarEnvios, refrescarPieza };
