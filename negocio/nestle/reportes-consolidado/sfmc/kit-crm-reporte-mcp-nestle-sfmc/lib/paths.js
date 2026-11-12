'use strict';
// Rutas dependientes del sistema operativo. Todo recibe env/plataforma/home inyectables para poder probarse
// sin tocar la maquina real.
const fs = require('fs');
const os = require('os');
const path = require('path');

/** Carpeta de credenciales: FUERA de OneDrive y de todo repo git. */
function dirCredenciales({ env = process.env, plataforma = process.platform, home = os.homedir() } = {}) {
  if (env.SFMC_CONEXION_DIR) return env.SFMC_CONEXION_DIR;
  if (plataforma === 'win32') return path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'sfmc-mcp');
  return path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'sfmc-mcp');
}

/** El archivo que EL USUARIO edita (pega el volcado del Installed Package). El kit solo lo LEE. */
const rutaConexionTxt = (opts) => path.join(dirCredenciales(opts), 'conexion.txt');

const NOMBRE_ESTADO = 'crm-reporte-mcp-nestle-sfmc';
/**
 * Carpeta del ESTADO LOCAL de esta instalacion: la config con los IDs de tu BU y las fotos de la arquitectura (que con --con-datos traen filas del cliente).
 * Vive FUERA de la carpeta del kit a proposito: esa carpeta se copia, se comprime, se sincroniza y la barren otras herramientas del sistema de reportes,
 * asi que lo unico que lleva es codigo y guias. Tampoco es la de las credenciales (esa el kit solo la LEE). Se puede mover con SFMC_PIPELINE_DIR.
 */
function dirEstado({ env = process.env, plataforma = process.platform, home = os.homedir() } = {}) {
  if (env.SFMC_PIPELINE_DIR) return env.SFMC_PIPELINE_DIR;
  if (plataforma === 'win32') return path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), NOMBRE_ESTADO);
  return path.join(env.XDG_DATA_HOME || path.join(home, '.local', 'share'), NOMBRE_ESTADO);
}
/** Donde se guardan por defecto las fotos de snapshot.js. */
const dirFotos = (opts) => path.join(dirEstado(opts), 'snapshot');

/** Config de Claude Code (donde conectar.js del MCP guarda el bloque env). Solo se LEE. */
const rutaClaudeJson = ({ home = os.homedir() } = {}) => path.join(home, '.claude.json');

class ErrorRutaProtegida extends Error { constructor(msg) { super(msg); this.name = 'ErrorRutaProtegida'; } }

/**
 * La ruta tal como la ve el sistema de archivos, para COMPARAR. Dos textos distintos pueden ser la misma carpeta: un enlace simbolico o junction, un nombre corto 8.3 (CRM-RE~1).
 * Del tramo que YA existe se toma la ruta real (sigue enlaces, expande nombres cortos y mayusculas) y lo que aun no existe se le pega tal cual.
 * Un enlace roto (existe pero no lleva a ningun lado) no se puede comparar, y escribir a traves de el crearia el destino donde apunte: se rechaza.
 */
function rutaReal(ruta, { realpath = fs.realpathSync.native, lstat = fs.lstatSync } = {}) {
  const abs = path.resolve(String(ruta));
  const resto = [];
  for (let actual = abs; ;) {
    try { return resto.length ? path.join(realpath(actual), ...resto) : realpath(actual); } catch { /* no existe o no se puede resolver: se mira un nivel arriba */ }
    let hay = false; try { lstat(actual); hay = true; } catch { /* no existe */ }
    if (hay) throw new ErrorRutaProtegida(`No escribo "${abs}": "${actual}" es un enlace roto o no se puede resolver, y no sé dónde caería lo escrito.`);
    const padre = path.dirname(actual);
    if (padre === actual) return abs;                                   // llego a la raiz sin encontrar nada que exista
    resto.unshift(path.basename(actual)); actual = padre;
  }
}

// Lo que este kit ESCRIBE en disco son solo dos cosas: la config (descubrir.js) y las fotos (snapshot.js). Ambas se identifican por su contenido.
const ES_CONFIG = (j) => !!(j && j.version === 1 && j.des && j.queries && j.automation);
const ES_FOTO = (j) => !!(j && j.formato != null && j.des && j.queries);
const MARCA = { config: ES_CONFIG, foto: ES_FOTO };
const NOMBRE_TIPO = { config: 'una config', foto: 'una foto' };

/**
 * 🔴 "Nunca escribe ni borra conexion.txt" hecho CODIGO. Todo lo que el kit escribe en disco pasa por aqui. Rechaza escribir:
 *   · algo que no sea .json (credenciales, .env, .pem, .txt…)
 *   · dentro de la carpeta de credenciales, o en ~/.claude.json (la config de Claude Code, que lleva el bloque del MCP con el secret)
 *   · sobre un archivo que YA existe y no es una config / foto de este kit (un --out mal puesto no pisa un settings.json ni un package.json)
 *   · una ruta de RED (\\servidor\recurso o //servidor/recurso): ni una foto con filas del cliente ni la config deben salir de esta maquina
 *   · NADA dentro de la carpeta del propio kit (ni config/ ni snapshot/): es una carpeta que se copia, se sincroniza y la barren otras herramientas; lo local vive en dirEstado()
 * Escribir donde no hay nada, o sobre una config/foto propia, esta permitido. Devuelve la ruta absoluta.
 * Las carpetas protegidas se comparan por su RUTA REAL (rutaReal): ni un enlace/junction, ni un nombre corto 8.3, ni mayusculas distintas esquivan la guardia.
 */
function exigirEscrituraSegura(ruta, tipo, { env = process.env, plataforma = process.platform, home = os.homedir(), existe = fs.existsSync, leer = (p) => fs.readFileSync(p, 'utf8'), raiz = raizKit(), realpath = fs.realpathSync.native, lstat = fs.lstatSync } = {}) {
  if (!MARCA[tipo]) throw new Error(`exigirEscrituraSegura: tipo desconocido "${tipo}"`);
  const abs = path.resolve(String(ruta));
  const plano = (p) => (plataforma === 'linux' ? p : p.toLowerCase());          // Windows y Mac no distinguen mayusculas
  const dePadre = (p) => { try { return rutaReal(p, { realpath, lstat }); } catch { return path.resolve(p); } };          // una carpeta protegida rota no impide escribir en otro lado
  if (/^[\\/]{2}[^\\/]/.test(String(ruta)) || /^[\\/]{2}[^\\/]/.test(abs)) throw new ErrorRutaProtegida(`No escribo "${abs}": es una ruta de red; la config y las fotos no deben salir de esta máquina.`);
  if (plataforma === 'win32' && /:/.test(abs.replace(/^[A-Za-z]:/, ''))) throw new ErrorRutaProtegida(`No escribo "${abs}": lleva ":" después de la unidad (en NTFS es un flujo alterno de datos: escribiría un archivo OCULTO dentro de otra carpeta o archivo, p. ej. la del kit o la de las credenciales).`);
  if (!/\.json$/i.test(abs)) throw new ErrorRutaProtegida(`No escribo "${abs}": este kit solo escribe archivos .json suyos (config o foto), nunca credenciales ni otros formatos.`);
  if (/^(conexion|\.env)/i.test(path.basename(abs))) throw new ErrorRutaProtegida(`No escribo "${abs}": el nombre es el de un archivo de credenciales.`);
  const real = rutaReal(abs, { realpath, lstat });          // estricto: un enlace roto se rechaza aqui
  const dentro = (padre) => { const r = path.relative(plano(dePadre(padre)), plano(real)); return r === '' || (r !== '..' && !r.startsWith('..' + path.sep) && !path.isAbsolute(r)); };          // "..x.json" es un hijo, no el padre
  if (dentro(dirCredenciales({ env, plataforma, home }))) throw new ErrorRutaProtegida(`No escribo "${abs}": está en la carpeta de credenciales, que el kit solo LEE.`);
  if (plano(dePadre(rutaClaudeJson({ home }))) === plano(real)) throw new ErrorRutaProtegida(`No escribo "${abs}": es la config de Claude Code (lleva credenciales del MCP) y el kit solo la LEE.`);
  if (dentro(raiz)) throw new ErrorRutaProtegida(`No escribo "${abs}": está dentro de la carpeta del propio kit, que solo lleva código y guías (se copia, se sincroniza y se comparte). La config y las fotos viven en ${dirEstado({ env, plataforma, home })}.`);
  if (existe(abs)) {
    let j = null;
    try { j = JSON.parse(String(leer(abs)).replace(new RegExp('^' + String.fromCharCode(0xFEFF)), '')); } catch { /* no es JSON: se rechaza abajo */ }   // quita el BOM de UTF-8
    if (!MARCA[tipo](j)) throw new ErrorRutaProtegida(`"${abs}" ya existe y no parece ${NOMBRE_TIPO[tipo]} de este kit: no la piso. Elige otra ruta, o bórrala tú si es tuya.`);
  }
  return abs;
}

/** Raiz del kit (la carpeta que contiene lib/, scripts/, config/). Es SOLO codigo y guias: nada se escribe aqui. */
const raizKit = () => path.resolve(__dirname, '..');

/** Config de ESTA instalacion (IDs descubiertos), en la carpeta de estado local. Se puede apuntar a otra con SFMC_PIPELINE_CONFIG. */
const rutaConfig = (opts = {}) => (opts.env || process.env).SFMC_PIPELINE_CONFIG || path.join(dirEstado(opts), 'pipeline.config.json');
/** La plantilla versionada (esa SI viaja con el kit y no se escribe nunca). */
const rutaConfigEjemplo = () => path.join(raizKit(), 'config', 'pipeline.config.example.json');

/**
 * Restos LOCALES dentro de la carpeta del kit (de una version anterior, que guardaba ahi la config y las fotos, o de un archivo de credenciales pegado por error).
 * Esa carpeta se copia y la barren otras herramientas: lo que haya ahi puede acabar en una carpeta compartida. Devuelve nombres relativos; [] = limpia.
 */
function restosLocalesEnElKit({ raiz = raizKit(), existe = fs.existsSync, listar = (d) => fs.readdirSync(d) } = {}) {
  const hallados = [];
  if (existe(path.join(raiz, 'config', 'pipeline.config.json'))) hallados.push('config/pipeline.config.json');
  if (existe(path.join(raiz, 'snapshot'))) hallados.push('snapshot/');
  for (const [dir, prefijo] of [[raiz, ''], [path.join(raiz, 'config'), 'config/']]) {
    let nombres = []; try { nombres = listar(dir); } catch { /* la carpeta no existe */ }
    for (const n of nombres) if (/^(conexion|\.env)/i.test(n) || /\.(pem|key|pfx|p12|secret)$/i.test(n)) hallados.push(prefijo + n);
  }
  return hallados;
}

/** Para --comparar: acepta una ruta, o solo el NOMBRE de una foto (la busca en la carpeta de fotos). Si no la encuentra, devuelve lo que se escribio (para que el error lo muestre). */
function resolverFoto(ruta, { existe = fs.existsSync, opts = {} } = {}) {
  if (existe(ruta)) return ruta;
  const candidata = path.join(dirFotos(opts), path.basename(String(ruta)));
  return existe(candidata) ? candidata : ruta;
}

module.exports = { dirCredenciales, rutaConexionTxt, rutaClaudeJson, dirEstado, dirFotos, raizKit, rutaConfig, rutaConfigEjemplo, restosLocalesEnElKit, resolverFoto, ErrorRutaProtegida, rutaReal, exigirEscrituraSegura };
