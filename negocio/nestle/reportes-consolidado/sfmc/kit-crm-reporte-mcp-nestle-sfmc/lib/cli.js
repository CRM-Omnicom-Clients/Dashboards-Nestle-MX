'use strict';
// Infraestructura comun de los scripts: argumentos, contexto (credenciales + config + cliente) y salida segura.
const fs = require('fs');
const { resolverCredenciales, redact, vistaSegura } = require('./credenciales');
const { jsonSeguro, instalarSalidaSegura } = require('./textoseguro');
const { crearCliente } = require('./sfmc');
const { cargarConfig, cargarEjemplo } = require('./config');
const { rutaConfig } = require('./paths');
const { instalarLimpiezaAlSalir } = require('./de');

const abiertos = [];

class ErrorUso extends Error { constructor(msg) { super(msg); this.name = 'ErrorUso'; } }

/**
 * Las opciones (--algo) que declara el texto de ayuda de un script. Ese texto es el CONTRATO: una opcion que no figure ahi es un error de escritura, no algo que se ignora.
 * Importa porque una opcion de seguridad mal escrita (--dryrun por --dry-run) corria igual, y en refrescar-pieza correr es EJECUTAR las queries de produccion.
 */
function opcionesDeAyuda(ayuda) { return new Set([...String(ayuda).matchAll(/(?<![\w-])--([a-z][a-z0-9-]*)/g)].map((m) => m[1])); }
function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** La opcion valida mas parecida a `k`, o null si ninguna se le parece lo bastante (dryrun -> dry-run). */
function sugerir(k, validas) {
  let mejor = null, dm = Infinity;
  for (const v of validas) { const d = distancia(k, v); if (d < dm) { dm = d; mejor = v; } }
  return mejor !== null && dm <= Math.max(2, Math.floor(k.length / 3)) ? mejor : null;
}
function opcionDesconocida(token, k, validas) {
  const lista = [...validas].sort().map((v) => '--' + v).join(', ');
  const s = k && sugerir(k, validas);
  return new ErrorUso(`Opción desconocida "${token}".${s ? ` ¿Quisiste decir --${s}?` : ''}\nOpciones de este script: ${lista}.\nNo se hizo nada: una opción mal escrita no se ignora (podría ser justo la que impide un cambio).`);
}

/**
 * --flag · --k=v · --k v · --k (booleano) · repetible (array) · todo lo demas va a _.
 * Con `ayuda` (el texto de --help del script), una opcion que ese texto no declara LANZA ErrorUso en vez de ignorarse, y tambien una letra suelta como -n (los scripts usan dos guiones).
 */
function parseArgs(argv, { booleanos = [], alias = {}, ayuda = null } = {}) {
  const out = { _: [] };
  const validas = ayuda == null ? null : new Set([...opcionesDeAyuda(ayuda), 'help', ...booleanos, ...Object.keys(alias), ...Object.values(alias)]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { out._.push(...argv.slice(i + 1)); break; }
    if (validas && /^-[A-Za-z]$/.test(a)) throw opcionDesconocida(a, null, validas);          // -n, -h, -f…: una letra suelta nunca es un fragmento ni un valor valido de estos scripts
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    let k = a.slice(2, eq > 0 ? eq : undefined); let v = eq > 0 ? a.slice(eq + 1) : undefined;
    k = alias[k] || k;
    if (validas && !validas.has(k)) throw opcionDesconocida(a.slice(0, 40), k, validas);
    if (v === undefined) {
      if (booleanos.includes(k)) v = true;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) v = argv[++i];
      else v = true;
    }
    if (booleanos.includes(k) && typeof v === 'string') v = !(v === 'false' || v === '0');
    out[k] = k in out ? [].concat(out[k], v) : v;
  }
  return out;
}

/**
 * Arma lo que casi todo script necesita.
 *   soloLectura:true  => cliente SIN guardia de escritura (descubrir, doctor en modo lectura): no puede escribir NADA.
 *   soloLectura:false => exige config valida y descubierta; el cliente escribe solo lo que la guardia permite.
 */
async function contexto({ soloLectura = false, exigirDescubierta = true, rutaConfigArg, instalacion = null } = {}) {
  const ruta = (typeof rutaConfigArg === 'string' && rutaConfigArg) || rutaConfig();
  let cfg = null;
  if (fs.existsSync(ruta)) cfg = cargarConfig({ ruta, exigirDescubierta });
  else if (!soloLectura) cargarConfig({ ruta, exigirDescubierta });          // lanza el error accionable
  const base = cfg || cargarEjemplo();
  const cred = resolverCredenciales({ mcpServerName: base.mcpServerName || 'sfmc-nestle' });
  const cli = crearCliente({ cred, cfg: soloLectura ? null : cfg, instalacion: soloLectura ? null : instalacion });
  abiertos.push(cli);
  if (!soloLectura) instalarLimpiezaAlSalir(cli);
  return { cred, cli, cfg, base, ruta, vista: vistaSegura(cred) };
}

/** Para scripts que arman sus clientes a mano (doctor): asegura que `ejecutar` los cierre al terminar. */
const registrarCliente = (cli) => { abiertos.push(cli); return cli; };

/** JSON para --json: sin secretos (redact) y con lo invisible como \uXXXX (el valor al parsearlo es el mismo). Usarlo en TODA salida --json. */
const salidaJson = (valor) => redact(jsonSeguro(valor));

/**
 * Corre main() (debe devolver el codigo de salida), imprime errores REDACTADOS y cierra los clientes.
 * Instala la salida segura: nada de lo que venga de SFMC (nombres, asuntos, errores) puede mandar secuencias de escape a la terminal (lib/textoseguro.js).
 */
function ejecutar(main) {
  instalarSalidaSegura();
  Promise.resolve().then(main)
    .then((codigo) => { process.exitCode = Number.isInteger(codigo) ? codigo : 0; })
    .catch((e) => {
      const msg = redact(e && e.message ? e.message : String(e));
      console.error('\nERROR' + (e && e.name && e.name !== 'Error' ? ' (' + e.name + ')' : '') + ': ' + msg);
      process.exitCode = 1;
    })
    .finally(() => { for (const c of abiertos) { try { c.cerrar(); } catch { /* ya cerrado */ } } });
}

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = { parseArgs, ErrorUso, opcionesDeAyuda, sugerir, contexto, ejecutar, registrarCliente, dormir, salidaJson };
