'use strict';
// Config de ESTA instalacion (pipeline.config.json, en la carpeta de estado local: paths.dirEstado): nombres de los objetos del reporte + los IDs que los
// descubre scripts/descubrir.js. Sin secretos. Se valida al cargar: un config mal formado no debe llegar a la guardia.
const fs = require('fs');
const path = require('path');
const { rutaConfig, rutaConfigEjemplo, exigirEscrituraSegura } = require('./paths');
const { errorDeArchivoSeguro } = require('./credenciales');
const { sinBom } = require('./textoseguro');

class ErrorConfig extends Error { constructor(msg, errores) { super(msg); this.name = 'ErrorConfig'; this.errores = errores || []; } }

const ROLES_DE = ['catalogo', 'audiencias', 'detalle', 'piezas', 'auditoria', 'links'];
const ROLES_QUERY = ['vol', 'detalle', 'piezas', 'auditoria', 'links'];
const LLAVES_PIEZA = ['auto', 'ConfigKey', 'EmailName'];
const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** { errores:[], avisos:[] }. exigirDescubierta: todos los key/id/carpetas deben estar llenos. */
function validar(cfg, { exigirDescubierta = false } = {}) {
  const errores = [], avisos = [];
  if (!cfg || typeof cfg !== 'object') return { errores: ['la config no es un objeto JSON'], avisos };
  if (cfg.version !== 1) errores.push(`version debe ser 1 (es ${JSON.stringify(cfg.version)})`);
  const pre = cfg.prefijoTemporales;
  if (typeof pre !== 'string' || !/^[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]*$/.test(pre) || pre.length < 5) errores.push('prefijoTemporales debe ser un texto tipo "CRM_Tmp_" (letra inicial, con "_", >=5 caracteres)');
  else if (!/(tmp|temp|scratch|sbx|sandbox|test|prueba)/i.test(pre)) errores.push(`prefijoTemporales "${pre}" no delata que es TEMPORAL (debe contener Tmp, Temp, Scratch, Sbx, Sandbox, Test o Prueba, p. ej. "CRM_Tmp_"): la limpieza de huérfanos borra TODO lo que empiece con él`);
  for (const [seccion, roles] of [['des', ROLES_DE], ['queries', ROLES_QUERY]]) {
    const s = cfg[seccion];
    if (!s || typeof s !== 'object') { errores.push(`falta la sección "${seccion}"`); continue; }
    for (const r of roles) {
      const o = s[r];
      if (!o || typeof o.nombre !== 'string' || !o.nombre) { errores.push(`${seccion}.${r}.nombre falta`); continue; }
      if (typeof pre === 'string' && o.nombre.startsWith(pre)) errores.push(`${seccion}.${r}.nombre "${o.nombre}" empieza con el prefijo temporal "${pre}": la guardia lo trataría como temporal y permitiría borrarlo`);
      const id = seccion === 'des' ? o.key : o.id;
      if (id != null && !GUID.test(String(id))) errores.push(`${seccion}.${r}.${seccion === 'des' ? 'key' : 'id'} no es un GUID: ${JSON.stringify(id)}`);
      if (exigirDescubierta && id == null) errores.push(`${seccion}.${r} sin ${seccion === 'des' ? 'key' : 'id'}: corre scripts/descubrir.js`);
    }
  }
  const a = cfg.automation;
  if (!a || typeof a.nombre !== 'string' || !a.nombre) errores.push('automation.nombre falta');
  else {
    if (a.id != null && !GUID.test(String(a.id))) errores.push('automation.id no es un GUID');
    if (exigirDescubierta && a.id == null) errores.push('automation sin id: corre scripts/descubrir.js');
    if (!Array.isArray(a.pasosEsperados) || a.pasosEsperados.some(p => !Array.isArray(p) || p.some(x => !ROLES_QUERY.includes(x)))) errores.push('automation.pasosEsperados debe ser una lista de pasos, cada uno una lista de roles de query');
  }
  const c = cfg.carpetas || {};
  for (const k of ['de', 'query']) {
    if (c[k] != null && !(Number.isInteger(Number(c[k])) && Number(c[k]) > 0)) errores.push(`carpetas.${k} debe ser un entero positivo`);
    if (exigirDescubierta && c[k] == null) errores.push(`carpetas.${k} sin descubrir: corre scripts/descubrir.js`);
  }
  if (!cfg.esquema || !LLAVES_PIEZA.includes(cfg.esquema.llavePieza)) errores.push(`esquema.llavePieza debe ser uno de: ${LLAVES_PIEZA.join(', ')}`);
  if (cfg.bu && cfg.bu.offsetUtcHoras != null && !(Number(cfg.bu.offsetUtcHoras) >= -12 && Number(cfg.bu.offsetUtcHoras) <= 14)) errores.push('bu.offsetUtcHoras debe ser un número entre -12 y 14 (la zona de tu BU respecto a UTC)');
  if (exigirDescubierta && !(cfg.bu && cfg.bu.mid)) avisos.push('bu.mid vacío (se descubre al conectar)');
  return { errores, avisos };
}

function leerJson(ruta) {
  try { return JSON.parse(sinBom(fs.readFileSync(ruta, 'utf8'))); }
  catch (e) { throw new ErrorConfig(`No pude leer ${ruta}: ${errorDeArchivoSeguro(e)}`); }
}

/** Carga y VALIDA la config. Si falta el archivo: error que dice que hacer. */
function cargarConfig({ ruta = rutaConfig(), exigirDescubierta = true } = {}) {
  if (!fs.existsSync(ruta)) throw new ErrorConfig(`No existe la config de esta instalación:\n  ${ruta}\nCorre primero:  node scripts/descubrir.js   (necesita credenciales; ver docs/CONEXION.md)`);
  const cfg = leerJson(ruta);
  const { errores } = validar(cfg, { exigirDescubierta });
  if (errores.length) throw new ErrorConfig(`Config inválida (${ruta}):\n  - ${errores.join('\n  - ')}`, errores);
  return cfg;
}
/** La plantilla (solo nombres) para descubrir cuando aun no hay config. */
function cargarEjemplo() { return leerJson(rutaConfigEjemplo()); }

/**
 * Una version nueva del kit puede agregar campos a la plantilla (p. ej. bu.offsetUtcHoras). Una config YA generada no los trae.
 * Devuelve { cfg, agregados }: `cfg` es una copia de la config con lo que le falta tomado de la plantilla; `agregados` lista las rutas
 * agregadas ("bu.offsetUtcHoras"). NUNCA pisa un valor que la config ya tiene (ni listas: se toman completas o no se tocan).
 */
function completarConEjemplo(cfg, ejemplo = cargarEjemplo()) {
  const agregados = []; const clon = (o) => JSON.parse(JSON.stringify(o));
  const objeto = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const fusion = (a, b, ruta) => {
    if (a === undefined) { agregados.push(ruta); return b; }
    if (objeto(a) && objeto(b)) { const out = { ...a }; for (const k of Object.keys(b)) out[k] = fusion(a[k], b[k], ruta ? `${ruta}.${k}` : k); return out; }
    return a;
  };
  return { cfg: clon(fusion(cfg, ejemplo, '')), agregados: agregados.filter(r => r !== '') };
}

function guardarConfig(cfg, ruta = rutaConfig()) {
  const { errores } = validar(cfg, { exigirDescubierta: false });
  if (errores.length) throw new ErrorConfig('No guardo una config inválida:\n  - ' + errores.join('\n  - '), errores);
  const destino = exigirEscrituraSegura(ruta, 'config');            // nunca credenciales, ~/.claude.json ni un .json ajeno
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  return ruta;
}

const deDe = (cfg, rol) => { const d = cfg.des[rol]; if (!d) throw new ErrorConfig(`rol de DE desconocido: ${rol}`); return d; };
const queryDe = (cfg, rol) => { const q = cfg.queries[rol]; if (!q) throw new ErrorConfig(`rol de query desconocido: ${rol}`); return q; };

module.exports = { ErrorConfig, ROLES_DE, ROLES_QUERY, LLAVES_PIEZA, GUID, validar, cargarConfig, cargarEjemplo, completarConEjemplo, guardarConfig, deDe, queryDe };
