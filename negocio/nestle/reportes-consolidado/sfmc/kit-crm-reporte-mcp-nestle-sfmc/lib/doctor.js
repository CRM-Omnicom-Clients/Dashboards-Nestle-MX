'use strict';
// Diagnostico del pipeline: cada chequeo devuelve { id, estado: ok|aviso|falla|omitido, titulo, detalle }.
// Por defecto es de SOLO LECTURA. Solo crea/borra objetos temporales si se piden --limpiar-tmp o --latencia.
const D = require('./de');
const E = require('./esquema');
const { ROLES_DE, ROLES_QUERY } = require('./config');
const { validarSecret, analizarFuentes } = require('./credenciales');
const { edadMinutos, formatoEdad, parseFechaSfmc } = require('./fechas');
const { REQUERIDOS, OPCIONALES, clasificarScopes } = require('./scopes');

const HORAS_FRESCURA = 36;
const COLUMNAS_CATALOGO = ['EmailName', 'Marca', 'Campana', 'Touchpoint', 'EmailType', 'Activo', 'Estado', 'EmailID'];
const COLUMNAS_AUDIENCIAS = ['Audience_DE', 'Audience_Volume'];
// statusId de una Automation: -1 Error · 0 BuildingError · 1 Building · 2 Ready · 3 Running · 4 Paused · 5 Stopped · 6 Scheduled · 7 AwaitingTrigger · 8 InactiveTrigger
const STATUS_OK = [2, 6, 7];
const STATUS_CORRIENDO = [3];

const r = (id, estado, titulo, detalle = '') => ({ id, estado, titulo, detalle });

/** Estado de la automation a partir de su detalle REST. */
function clasificarAutomation(det, { ahoraMs, offsetHoras = -6, horasMax = HORAS_FRESCURA } = {}) {
  const id = Number(det.statusId);
  const edad = edadMinutos(det.lastRunTime, ahoraMs, offsetHoras);
  const prox = det.schedule && det.schedule.scheduledTime;
  const base = `${det.status} (${id}) · última corrida: ${det.lastRunTime ? formatoEdad(edad) + ' atrás' : 'nunca'}${prox ? ' · próxima: ' + prox : ''}`;
  if (STATUS_CORRIENDO.includes(id)) return { estado: 'aviso', detalle: base + ' · HAY UNA CORRIDA EN CURSO: no refresques a mano ahora (se pisarían las queries)' };
  if (!STATUS_OK.includes(id)) return { estado: 'falla', detalle: base + ' · la automation NO está activa (¿pausada, detenida o con error?). Revísala en Automation Studio.' };
  if (edad == null) return { estado: 'aviso', detalle: base + ' · nunca ha corrido' };
  if (edad > horasMax * 60) return { estado: 'aviso', detalle: base + ` · hace más de ${horasMax} h que no corre: ¿se saltó una noche?` };
  return { estado: 'ok', detalle: base };
}

/** Pasos reales de la automation como roles de query, para compararlos con los esperados. */
function pasosComoRoles(det, cfg) {
  const porId = {}; for (const [rol, q] of Object.entries(cfg.queries)) porId[String(q.id).toLowerCase()] = rol;
  return (det.steps || []).map(s => (s.activities || []).map(x => porId[String(x.activityObjectId).toLowerCase()] || `?${x.name}`).sort());
}

/** El chequeo de "estado local": ¿hay archivos locales (config, fotos, credenciales) dentro de la carpeta del kit? `estado` = { dir, restos } o null. */
function chequeoEstadoLocal(estado) {
  if (!estado) return null;
  const restos = estado.restos || [];
  return r('estado-local', restos.length ? 'aviso' : 'ok', 'Estado local',
    restos.length ? `hay archivos locales DENTRO de la carpeta del kit (${restos.join(', ')}): esa carpeta se copia y se sincroniza, y otras herramientas la barren entera. Muévelos a ${estado.dir} (o borra la config vieja y corre de nuevo scripts/descubrir.js)`
      : `fuera de la carpeta del kit: ${estado.dir}`);
}

async function ejecutarChequeos({ cred, cli, cliW = null, cfg = null, errorCfg = null, opciones = {}, ahoraMs = Date.now(), nodeVersion = process.versions.node, vista, fuentes = null, forzada = null, estadoLocal = null }) {
  const out = [];
  const add = (x) => { out.push(x); return x; };

  const mayor = Number(String(nodeVersion).split('.')[0]);
  add(r('runtime', mayor >= 18 ? 'ok' : 'falla', 'Node.js', `v${nodeVersion}` + (mayor >= 18 ? '' : ' — se requiere >= 18')));
  const el = chequeoEstadoLocal(estadoLocal); if (el) add(el);

  const v = validarSecret(cred.clientSecret);
  add(r('credenciales', v.error ? 'falla' : v.avisos.length ? 'aviso' : 'ok', 'Credenciales',
    `${vista.detalleFuente} · client ${vista.clientId} · secret ${vista.secret}${v.error ? ' — ' + v.error : ''}${v.avisos.length ? ' — ' + v.avisos.join('; ') : ''}`));

  // Dos packages distintos en dos fuentes: los scripts usan el de mayor prioridad (si es el viejo, fallan con invalid_client).
  if (fuentes) {
    const { avisos } = analizarFuentes(fuentes, { forzada });          // ambiguedad + archivos incompletos
    const utilizables = fuentes.filter(f => f.estado === 'ok').length;
    add(r('fuentes', avisos.length ? 'aviso' : 'ok', 'Fuentes de credenciales',
      avisos.length ? avisos.join('\n') : `se usa ${cred.fuente}${forzada ? ' (forzada con SFMC_FUENTE)' : ''} · ${utilizables === 1 ? 'es la única configurada' : 'las ' + utilizables + ' fuentes configuradas son del mismo package'}`));
  }

  try {
    await cli.token();
    const dif = cfg && cfg.bu && cfg.bu.mid && String(cfg.bu.mid) !== String(cli.mid);
    add(r('token', dif ? 'aviso' : 'ok', 'Token SFMC', `MID ${cli.mid} · ${cli.scopes.length} scopes${dif ? ` — ¡la config es del MID ${cfg.bu.mid}! ¿te conectaste a otra BU? (corre descubrir.js)` : ''}`));
  } catch (e) {
    add(r('token', 'falla', 'Token SFMC', e.message));
    add(r('resto', 'omitido', 'Demás chequeos', 'requieren un token válido'));
    return out;
  }

  const sc = clasificarScopes(cli.scopes);
  add(r('scopes', sc.faltanRequeridos.length ? 'falla' : sc.faltanOpcionales.length ? 'aviso' : 'ok', 'Scopes del package',
    sc.faltanRequeridos.length ? `FALTAN: ${sc.faltanRequeridos.join(', ')} — sin ellos el kit no puede crear temporales ni disparar queries (lista completa en docs/CONEXION.md)`
      : sc.faltanOpcionales.length ? sc.faltanOpcionales.map(o => `falta ${o.scope}: no podrás ${o.para}`).join('; ')
        : `los ${REQUERIDOS.length} requeridos presentes`));

  if (!cfg) {
    add(r('config', 'falla', 'Config del pipeline', errorCfg || 'falta la config del pipeline (pipeline.config.json, en la carpeta de estado local): corre  node scripts/descubrir.js'));
    add(r('resto', 'omitido', 'Objetos, esquema, automation, frescura y temporales', 'requieren la config'));
    return out;
  }
  const offset = cfg.bu && cfg.bu.offsetUtcHoras != null ? Number(cfg.bu.offsetUtcHoras) : -6;
  add(r('config', 'ok', 'Config del pipeline', `carpetas: DEs ${cfg.carpetas.de} · queries ${cfg.carpetas.query} · zona de la cuenta asumida UTC${offset >= 0 ? '+' : ''}${offset} (ajusta bu.offsetUtcHoras si tu BU es otra)`));

  // --- objetos ---
  const problemas = [];
  for (const rol of ROLES_DE) {
    const d = cfg.des[rol];
    try { const info = await D.infoDe(cli, d.nombre); if (info.key.toUpperCase() !== d.key.toUpperCase()) problemas.push(`DE ${rol}: la key cambió (${d.key} → ${info.key}); corre descubrir.js`); }
    catch (e) { problemas.push(`DE ${rol} "${d.nombre}": ${e.message}`); }
  }
  for (const rol of ROLES_QUERY) {
    const q = cfg.queries[rol];
    const x = await cli.rest(`/automation/v1/queries/${q.id}`);
    if (x.status !== 200) problemas.push(`query ${rol} "${q.nombre}": HTTP ${x.status} (¿se borró o se recreó? corre descubrir.js)`);
    else if (x.json.name !== q.nombre) problemas.push(`query ${rol}: el nombre cambió ("${q.nombre}" → "${x.json.name}")`);
  }
  const au = await cli.rest(`/automation/v1/automations/${cfg.automation.id}`);
  if (au.status !== 200) problemas.push(`automation "${cfg.automation.nombre}": HTTP ${au.status}`);
  else if (au.json.name !== cfg.automation.nombre) problemas.push(`automation: el nombre cambió ("${cfg.automation.nombre}" → "${au.json.name}")`);
  add(r('objetos', problemas.length ? 'falla' : 'ok', 'Objetos del reporte', problemas.length ? problemas.join('\n') : `${ROLES_DE.length} DEs, ${ROLES_QUERY.length} queries y la automation existen y coinciden con la config`));

  // --- esquema ---
  try {
    const colsCat = await D.columnas(cli, cfg.des.catalogo.nombre), colsAud = await D.columnas(cli, cfg.des.audiencias.nombre);
    const faltCat = COLUMNAS_CATALOGO.filter(c => !colsCat.some(x => x.name === c));
    const faltAud = COLUMNAS_AUDIENCIAS.filter(c => !colsAud.some(x => x.name === c));
    const sinId = [];
    for (const rol of ['detalle', 'piezas', 'auditoria', 'links']) { const c = await D.columnas(cli, cfg.des[rol].nombre); if (!c.some(x => x.name === E.COL_IDENTIDAD)) sinId.push(cfg.des[rol].nombre); }
    let modo = null; try { modo = E.detectarModo(colsCat, cfg.esquema.llavePieza); } catch (e) { faltCat.push('(' + e.message + ')'); }
    const mal = [faltCat.length ? `catálogo sin: ${faltCat.join(', ')}` : '', faltAud.length ? `audiencias sin: ${faltAud.join(', ')}` : '', sinId.length ? `sin EmailName: ${sinId.join(', ')}` : ''].filter(Boolean);
    add(r('esquema', mal.length ? 'falla' : 'ok', 'Esquema de las DEs', mal.length ? mal.join(' · ') : `modo de llave: ${modo} (PK ${E.columnaClave(modo)}) · el catálogo, audiencias y las 4 DEs de salida traen las columnas necesarias`));
  } catch (e) { add(r('esquema', 'falla', 'Esquema de las DEs', e.message)); }

  // --- automation ---
  if (au.status === 200) {
    const c = clasificarAutomation(au.json, { ahoraMs, offsetHoras: offset });
    const reales = pasosComoRoles(au.json, cfg), esperados = cfg.automation.pasosEsperados.map(p => [...p].sort());
    const pasosOk = JSON.stringify(reales) === JSON.stringify(esperados);
    add(r('automation', c.estado === 'ok' && !pasosOk ? 'aviso' : c.estado, 'Automation ' + cfg.automation.nombre, c.detalle + (pasosOk ? '' : `\n  pasos distintos a los esperados — esperados ${JSON.stringify(cfg.automation.pasosEsperados)} · reales ${JSON.stringify(reales)}`)));
  }

  // --- frescura de los datos ---
  try {
    const filas = await D.leerFilas(cli, cfg.des.piezas.nombre, ['LastRefresh']);
    const ms = filas.map(f => parseFechaSfmc(f.LastRefresh, offset)).filter(x => x != null);
    if (!ms.length) add(r('frescura', 'aviso', 'Frescura de los datos', 'CRM_Email_Piezas no trae LastRefresh legible'));
    else {
      const min = (ahoraMs - Math.max(...ms)) / 60000;
      add(r('frescura', min > HORAS_FRESCURA * 60 ? 'aviso' : 'ok', 'Frescura de los datos', `CRM_Email_Piezas se refrescó hace ${formatoEdad(min)} (${filas.length} piezas)${min > HORAS_FRESCURA * 60 ? ` — más de ${HORAS_FRESCURA} h: la automation no está llenando las DEs` : ''}`));
    }
  } catch (e) { add(r('frescura', 'falla', 'Frescura de los datos', e.message)); }

  // --- temporales huerfanos ---
  try {
    const t = await D.listarTemporales(cli, cfg); const n = t.des.length + t.queries.length;
    if (!n) add(r('temporales', 'ok', 'Temporales huérfanos', `ninguno (${cfg.prefijoTemporales}*)`));
    else if (opciones.limpiarTmp) {
      if (!cliW) add(r('temporales', 'falla', 'Temporales huérfanos', 'para limpiar hace falta una config válida'));
      else {
        const lr = await D.limpiarHuerfanos(cliW, cfg, { minEdadMin: opciones.minEdad != null ? opciones.minEdad : 60 });
        const b = lr.borrados.des.length + lr.borrados.queries.length;
        add(r('temporales', lr.fallos.length ? 'aviso' : 'ok', 'Temporales huérfanos',
          `zona de la cuenta medida: UTC${lr.offsetHoras >= 0 ? '+' : ''}${lr.offsetHoras} · borrados ${b} (${lr.borrados.des.length} DEs, ${lr.borrados.queries.length} queries)` +
          (lr.omitidos.length ? `\n  omitidos (recientes, sin fecha —¿otro operador en curso?— o del propio reporte): ${lr.omitidos.map(o => `${o.nombre} [${o.motivo || (o.edadMin == null ? 'sin fecha' : formatoEdad(o.edadMin))}]`).join(', ')}` : '') +
          (lr.fallos.length ? '\n  no pude borrar: ' + lr.fallos.join(' | ') : '')));
      }
    } else add(r('temporales', 'aviso', 'Temporales huérfanos', `${t.des.length} DEs y ${t.queries.length} queries con el prefijo ${cfg.prefijoTemporales} (de una corrida interrumpida). Límpialos con:  node scripts/doctor.js --limpiar-tmp\n  ${[...t.des.map(d => d.nombre), ...t.queries.map(q => q.nombre)].join(', ')}`));
  } catch (e) { add(r('temporales', 'falla', 'Temporales huérfanos', e.message)); }

  // --- latencia del motor (opcional: crea y borra una DE+query temporales) ---
  if (opciones.latencia) {
    if (!cliW) add(r('latencia', 'falla', 'Latencia del motor', 'requiere una config válida'));
    else {
      try {
        const q = await D.consultarTemp(cliW, cfg, { etiqueta: 'latencia', sql: 'SELECT TOP 1 JobID AS JobID FROM _Job', campos: [{ name: 'JobID', type: 'Number' }], timeoutS: 600, pollMs: 5000 });
        add(r('latencia', !q.completo ? 'falla' : q.segundos > 240 ? 'aviso' : 'ok', 'Latencia del motor de queries',
          !q.completo ? 'una consulta trivial NO terminó en 10 min: el motor de SFMC está muy degradado' : `consulta trivial: ${q.segundos} s${q.segundos > 240 ? ' — LENTO: espera tiempos largos (un refresco puede tardar >15 min)' : q.segundos > 90 ? ' — algo lento' : ' — normal'}`));
      } catch (e) { add(r('latencia', 'falla', 'Latencia del motor de queries', e.message)); }
    }
  }
  return out;
}

module.exports = { REQUERIDOS, OPCIONALES, HORAS_FRESCURA, clasificarScopes, clasificarAutomation, pasosComoRoles, chequeoEstadoLocal, ejecutarChequeos };
