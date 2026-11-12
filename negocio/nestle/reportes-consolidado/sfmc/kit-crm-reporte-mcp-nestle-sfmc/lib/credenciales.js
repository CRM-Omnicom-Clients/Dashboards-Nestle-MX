'use strict';
// Resolucion de credenciales SFMC — PURA (sin red). Orden de prioridad (SFMC_FUENTE fuerza UNA sola):
//   1) env           variables SFMC_CLIENT_ID + SFMC_CLIENT_SECRET (+ SFMC_AUTH_URL | SFMC_SUBDOMAIN, SFMC_ACCOUNT_ID opcional)
//   2) claude.json   ~/.claude.json -> mcpServers.<mcpServerName>.env   (lo que escribe el conectar.js del MCP)
//   3) conexion.txt  SOLO LECTURA. Ese archivo lo edita el usuario; este codigo NUNCA lo escribe ni lo borra.
//
// 🔴 Ningun secreto sale de aqui por consola: todo mensaje de error y toda vista pasan por redact()/vistaSegura().
const fs = require('fs');
const os = require('os');
const { dirCredenciales, rutaConexionTxt, rutaClaudeJson } = require('./paths');
const { sinBom } = require('./textoseguro');

class ErrorCredenciales extends Error {}
const FUENTES = ['env', 'claude.json', 'conexion.txt'];

// ---------- secretos: forma y redaccion ----------
// Un secret de SFMC empieza por SFMC_, mide >=40, NO va pegado a un identificador (TD_SFMC_… es un nombre de DE)
// y mezcla mayusculas + minusculas + digitos.
function esFormaDeSecreto(s) {
  return /^SFMC_/.test(s) && s.length >= 40 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /[0-9]/.test(s);
}
// Secretos VISTOS en esta ejecucion, de cualquier fuente: redact() los borra aunque no tengan la forma de un secret de SFMC (p. ej. un package antiguo
// de 24 caracteres). Asi tambien los borran las salidas que no conocen al cliente (errores de los scripts, --json, la revision de las fotos).
const CONOCIDOS = new Set();
function registrarSecreto(s) { const v = s == null ? '' : String(s); if (v.length >= 8) CONOCIDOS.add(v); }
/**
 * Borra TODA aparicion de cada secreto (aun las que se solapan entre si o con otro secreto) y devuelve el texto. Un secreto puede contener a otro (uno que es prefijo, sufijo o
 * parte de otro): reemplazarlos de uno en uno segun el orden de la lista deja a la vista la COLA del mas largo. Aqui se buscan todas las apariciones en el texto ORIGINAL, se funden
 * los rangos que se tocan o se solapan y cada rango fundido se enmascara una sola vez.
 */
function borrarSecretos(t, secretos) {
  const rangos = [];
  for (const s of secretos) { const v = String(s); if (v.length < 8) continue; for (let i = t.indexOf(v); i !== -1; i = t.indexOf(v, i + 1)) rangos.push([i, i + v.length]); }
  if (!rangos.length) return t;
  rangos.sort((a, b) => a[0] - b[0]);
  let out = '', pos = 0, ini = rangos[0][0], fin = rangos[0][1];
  for (let k = 1; k <= rangos.length; k++) {
    if (k < rangos.length && rangos[k][0] <= fin) { if (rangos[k][1] > fin) fin = rangos[k][1]; continue; }          // se toca o se solapa con el grupo actual: se funde
    out += t.slice(pos, ini) + '***'; pos = fin;
    if (k < rangos.length) { ini = rangos[k][0]; fin = rangos[k][1]; }
  }
  return out + t.slice(pos);
}
function redact(texto, secretos = []) {
  let t = String(texto == null ? '' : texto);
  t = borrarSecretos(t, [...secretos.filter(Boolean), ...CONOCIDOS]);
  // El guion cuenta como "pegado a un identificador": TD-SFMC_IPG_MEX_… (un nombre de DE real, 22-oct-2026) no es un secreto. Un secret de verdad va tras espacio, comilla, ":" o "=".
  t = t.replace(/(^|[^A-Za-z0-9_-])(SFMC_[A-Za-z0-9_-]{34,})/g, (m, pre, sec) => (esFormaDeSecreto(sec) ? pre + '***SECRETO***' : m));
  t = t.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer ***');
  t = t.replace(/("(?:access_token|client_secret|refresh_token)"\s*:\s*")[^"]+(")/gi, '$1***$2');
  // (?<!…) y no \b: un JWT empieza donde NO hay otro caracter de token antes. Con \b cada "-eyJ" de un texto hostil era un candidato que recorria el resto del texto: cuadratico (96 KB = 19 s).
  t = t.replace(/(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '***JWT***');
  return t;
}

/**
 * Texto SEGURO de un error al leer o parsear un archivo. El mensaje de un SyntaxError de JSON.parse puede traer un trozo del contenido
 * ("Unexpected token 'C', "CLIENT_SECRET=SFMC_…" is not valid JSON"): si alguien apunta un --out o una ruta al archivo de credenciales, eso
 * saldria por pantalla. Aqui nunca: solo se dice QUE no es JSON, jamas CUAL es su contenido.
 */
function errorDeArchivoSeguro(e) { return e instanceof SyntaxError ? 'no es un JSON válido' : redact(e && e.message ? e.message : String(e)); }

/** Valida la FORMA del secret. {error} corta; {avisos} informan. Mensajes en lenguaje de operador. */
function validarSecret(s) {
  const avisos = [];
  if (!s) return { error: 'vacío', avisos };
  if (/\s/.test(s)) return { error: 'trae espacios: copiaste la etiqueta ("<clientId> - 1") y no el valor del secret', avisos };
  if (s.includes('*')) return { error: 'trae asteriscos: copiaste el valor enmascarado; usa el ícono "Copy" de la página del package', avisos };
  if (s.length < 20) return { error: 'mide ' + s.length + ' caracteres: se ve corto', avisos };
  if (!/^SFMC_/.test(s)) avisos.push('no empieza con SFMC_ (normal en packages antiguos; si pegaste de la UI nueva y falta la "S" inicial, vuelve a copiar)');
  return { error: null, avisos };
}

// ---------- conexion.txt ----------
function campo(texto, k) {
  const m = new RegExp('^\\s*' + k + '\\s*=\\s*(.+)$', 'mi').exec(texto);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}
/** Acepta KEY=VALUE o el VOLCADO de la pagina del Installed Package pegado tal cual. */
function parsearConexion(crudo) {
  const t = sinBom(String(crudo == null ? '' : crudo));
  let clientId = campo(t, 'CLIENT_ID');
  let secret = campo(t, 'CLIENT_SECRET') || campo(t, 'SECRET');
  let mid = campo(t, 'MID');
  let authUri = campo(t, 'AUTH_URI') || campo(t, 'TENANT');
  let formato = 'campos KEY=VALUE';
  if (!clientId || !secret || !authUri) {
    formato = 'volcado de la página de SFMC';
    if (!secret) secret = (/(^|[^A-Za-z0-9_])(SFMC_[A-Za-z0-9_-]{20,})/.exec(t) || [])[2] || '';
    if (!clientId) {
      // "Client Id" + valor en la linea siguiente, o pegado ("Client Idabc…"). El Description del secret repite el id.
      const m = /Client\s*Id\s*[:=]?\s*([A-Za-z0-9]{20,40})(?![A-Za-z0-9])/i.exec(t) || /Description\s*:\s*([A-Za-z0-9]{20,40})\s*-\s*\d+/i.exec(t);
      clientId = m ? m[1] : '';
    }
    if (!authUri) authUri = (/https?:\/\/[a-z0-9]+\.auth\.marketingcloudapis\.com\/?/i.exec(t) || [])[0] || '';
    if (!mid) mid = (/\bMID\s*[:=]?\s*(\d{6,})\b/i.exec(t) || [])[1] || '';
  }
  registrarSecreto(secret);
  const faltan = [];
  if (!clientId) faltan.push('CLIENT_ID');
  if (!secret) faltan.push('CLIENT_SECRET');
  if (!authUri) faltan.push('AUTH_URI (Authentication Base URI)');
  const pistas = [];
  if (!secret) {
    if (/(^|[^A-Za-z0-9_])FMC_[A-Za-z0-9_-]{30,}/.test(t)) pistas.push('Hay una línea que empieza con "FMC_…": se perdió la "S" inicial al pegar (debe empezar con SFMC_). Pégala de nuevo completa.');
    if (/Client\s*Secret\s*[:=]?\s*\*+/i.test(t)) pistas.push('El secret aparece enmascarado (*******): usa el ícono "Copy" de la página del package, no selecciones el texto.');
  }
  return { clientId, secret, mid, authUri, formato, faltan, pistas };
}

// ---------- URLs ----------
// 🔴 A DONDE se mandan las credenciales: el kit solo habla con <tenant>.(auth|rest|soap).marketingcloudapis.com. El tenant es UNA etiqueta de DNS;
//    las tres URLs se DERIVAN de ella. Si el entorno o el ~/.claude.json traen URLs propias, deben apuntar a ESE host exacto: nunca un secret a otro dominio.
const DOMINIO_SFMC = 'marketingcloudapis.com';
const TENANT_VALIDO = /^[a-z0-9][a-z0-9-]{8,62}$/i;
function tenantDe(authUriOUrl) {
  try { return new URL(/^https?:/i.test(authUriOUrl) ? authUriOUrl : 'https://' + authUriOUrl).hostname.split('.')[0]; } catch { return ''; }
}
function derivarUrls(tenant) {
  return {
    authUrl: `https://${tenant}.auth.marketingcloudapis.com/v2/token`,
    restUrl: `https://${tenant}.rest.marketingcloudapis.com`,
    soapUrl: `https://${tenant}.soap.marketingcloudapis.com`,
  };
}
const hostDe = (url) => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } };
/** ¿Es una URL https de un host de SFMC (…marketingcloudapis.com), sin usuario/clave ni puerto raro? */
function esUrlSfmc(url) {
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && u.hostname.toLowerCase().endsWith('.' + DOMINIO_SFMC); } catch { return false; }
}
/** Lanza ErrorCredenciales si `url` no apunta EXACTAMENTE a <tenant>.<tipo>.marketingcloudapis.com por https. */
function exigirHostDelTenant(url, tipo, tenant, etiqueta) {
  const esperado = `${tenant}.${tipo}.${DOMINIO_SFMC}`.toLowerCase();
  if (!esUrlSfmc(url) || hostDe(url) !== esperado) {
    throw new ErrorCredenciales(`${etiqueta} apunta a "${hostDe(url).slice(0, 80) || String(url).slice(0, 40)}", que NO es el host de tu tenant (${esperado}): el kit nunca envía credenciales a otro dominio.`);
  }
}

/** Normaliza un objeto tipo env (variables SFMC_*) a una credencial. null si faltan lo minimo. Las URLs salen SIEMPRE del tenant (ver arriba). */
function desdeEnv(e) {
  if (!e || !e.SFMC_CLIENT_ID || !e.SFMC_CLIENT_SECRET) return null;
  registrarSecreto(e.SFMC_CLIENT_SECRET);
  for (const clave of ['SFMC_AUTH_URL', 'SFMC_REST_URL', 'SFMC_SOAP_URL']) {
    if (e[clave] && !esUrlSfmc(e[clave])) throw new ErrorCredenciales(`${clave} apunta a "${hostDe(e[clave]).slice(0, 80) || String(e[clave]).slice(0, 40)}", que no es un dominio de SFMC (…${DOMINIO_SFMC}): el kit nunca envía credenciales a otro dominio.`);
  }
  const tenant = String(e.SFMC_SUBDOMAIN || tenantDe(e.SFMC_AUTH_URL || '') || '');
  if (!tenant || tenant.length < 10) return null;
  if (!TENANT_VALIDO.test(tenant)) throw new ErrorCredenciales(`El subdominio de SFMC "${tenant.slice(0, 40)}" no tiene forma de subdominio (solo letras, números y guiones; sin puntos, "/" ni ":").`);
  const u = derivarUrls(tenant);
  for (const [clave, tipo] of [['SFMC_AUTH_URL', 'auth'], ['SFMC_REST_URL', 'rest'], ['SFMC_SOAP_URL', 'soap']]) if (e[clave]) exigirHostDelTenant(e[clave], tipo, tenant, clave);
  return { clientId: e.SFMC_CLIENT_ID, clientSecret: e.SFMC_CLIENT_SECRET, accountId: e.SFMC_ACCOUNT_ID || null, tenant, authUrl: u.authUrl, restUrl: u.restUrl, soapUrl: u.soapUrl };
}

// ---------- una funcion por fuente: devuelven { cred } o { nota } (o lanzan si el archivo existe pero esta incompleto) ----------
function intentarEnv({ env }) {
  const c = desdeEnv(env);
  return c ? { cred: { ...c, fuente: 'env', detalleFuente: 'variables de entorno SFMC_*' } }
    : { nota: 'variables de entorno SFMC_CLIENT_ID + SFMC_CLIENT_SECRET (+ SFMC_AUTH_URL o SFMC_SUBDOMAIN): no definidas' };
}
function intentarClaudeJson({ home, mcpServerName, leerArchivo, existe }) {
  const pj = rutaClaudeJson({ home });
  if (!existe(pj)) return { nota: pj + ': no existe' };
  try {
    const j = JSON.parse(leerArchivo(pj));
    const c = desdeEnv(j && j.mcpServers && j.mcpServers[mcpServerName] && j.mcpServers[mcpServerName].env);
    if (c) return { cred: { ...c, fuente: 'claude.json', detalleFuente: pj + ' → mcpServers.' + mcpServerName + '.env' } };
    return { nota: pj + ': no tiene mcpServers.' + mcpServerName + '.env con credenciales' };
  } catch (e) { return { nota: pj + ': no se pudo leer (' + errorDeArchivoSeguro(e) + ')' }; }
}
function intentarConexion({ env, home, plataforma, leerArchivo, existe }) {
  const ct = rutaConexionTxt({ env, plataforma, home });
  if (!existe(ct)) return { nota: ct + ': no existe' };
  const p = parsearConexion(leerArchivo(ct));
  if (p.faltan.length) {
    throw new ErrorCredenciales('conexion.txt existe pero está incompleto: falta ' + p.faltan.join(', ') + '.\n  ' + ct +
      (p.pistas.length ? '\n  → ' + p.pistas.join('\n  → ') : '') + '\n  Pega el volcado completo del Installed Package (ver docs/CONEXION.md).');
  }
  const v = validarSecret(p.secret);
  if (v.error) throw new ErrorCredenciales('El secret en conexion.txt ' + v.error + '.\n  ' + ct);
  const tenant = tenantDe(p.authUri);
  if (!tenant || tenant.length < 10) throw new ErrorCredenciales('No pude sacar el tenant de AUTH_URI "' + String(p.authUri).slice(0, 80) + '"');
  if (!TENANT_VALIDO.test(tenant)) throw new ErrorCredenciales('El tenant de AUTH_URI no tiene forma de subdominio de SFMC (solo letras, números y guiones): "' + tenant.slice(0, 40) + '"');
  return { cred: { clientId: p.clientId, clientSecret: p.secret, accountId: p.mid || null, tenant, ...derivarUrls(tenant),
    fuente: 'conexion.txt', detalleFuente: ct + ' (' + p.formato + ')', avisos: v.avisos } };
}
const INTENTAR = { env: intentarEnv, 'claude.json': intentarClaudeJson, 'conexion.txt': intentarConexion };

function contextoDe({ env = process.env, home = os.homedir(), plataforma = process.platform, mcpServerName = 'sfmc-nestle',
  leerArchivo = (p) => fs.readFileSync(p, 'utf8'), existe = fs.existsSync } = {}) {
  return { env, home, plataforma, mcpServerName, leerArchivo, existe };
}

/**
 * Resuelve las credenciales. Lanza ErrorCredenciales (con mensaje accionable y SIN secretos) si no hay ninguna.
 * opts: env, home, plataforma, mcpServerName, leerArchivo(ruta), existe(ruta) — todos inyectables.
 *       fuente: 'env' | 'claude.json' | 'conexion.txt' fuerza UNA sola fuente (por defecto lo toma de $SFMC_FUENTE).
 */
function resolverCredenciales(opts = {}) {
  const ctx = contextoDe(opts);
  const fuente = opts.fuente !== undefined ? opts.fuente : ctx.env.SFMC_FUENTE;
  if (fuente && !FUENTES.includes(fuente)) throw new ErrorCredenciales(`SFMC_FUENTE="${fuente}" no es válida. Usa una de: ${FUENTES.join(' | ')}`);
  const notas = [];
  for (const f of (fuente ? [fuente] : FUENTES)) {
    const r = INTENTAR[f](ctx);
    if (r.cred) return r.cred;
    notas.push(`${FUENTES.indexOf(f) + 1}) ${r.nota}`);
  }
  if (fuente) throw new ErrorCredenciales(`La fuente forzada "${fuente}" no tiene credenciales:\n  ${notas[0]}`);
  throw new ErrorCredenciales('No encontré credenciales de SFMC. Probé, en este orden:\n  ' + notas.join('\n  ') +
    '\n\nLo más simple: crea tu Installed Package, pega su volcado en el archivo del punto 3 y corre  node scripts/conectar.js\n(ver docs/CONEXION.md). Nunca pegues el secret en un chat.');
}

/**
 * Estado de las TRES fuentes, sin red: [{ fuente, estado: 'ok'|'ausente'|'incompleta', clientId?, tenant?, detalle }].
 * Sirve para avisar cuando dos fuentes tienen packages DISTINTOS (los scripts usan la primera por prioridad).
 */
function inspeccionarFuentes(opts = {}) {
  const ctx = contextoDe(opts);
  return FUENTES.map((f) => {
    try {
      const r = INTENTAR[f](ctx);
      return r.cred ? { fuente: f, estado: 'ok', clientId: r.cred.clientId, tenant: r.cred.tenant, detalle: r.cred.detalleFuente } : { fuente: f, estado: 'ausente', detalle: r.nota };
    } catch (e) { return { fuente: f, estado: 'incompleta', detalle: e.message }; }
  });
}

/**
 * Que fuente usaran los scripts y que alertas hay (sin red). `fuentes` viene de inspeccionarFuentes().
 * activa = la forzada (SFMC_FUENTE) o la primera utilizable por prioridad; puede no ser utilizable (null si no hay).
 * ambiguedad = dos packages DISTINTOS configurados a la vez (sin forzar) · incompletas = archivos que existen pero no sirven.
 * avisos = ambas cosas juntas (lo que muestra el doctor; conectar.js las compone con lo que aprende del token).
 */
function analizarFuentes(fuentes, { forzada = null } = {}) {
  const utilizables = fuentes.filter(f => f.estado === 'ok');
  const activa = (forzada ? fuentes.find(f => f.fuente === forzada) : utilizables[0]) || null;
  const ambiguedad = !forzada && utilizables.length > 1 && new Set(utilizables.map(f => f.clientId)).size > 1
    ? 'Hay packages DISTINTOS en varias fuentes (' + utilizables.map(f => `${f.fuente} → client ${f.clientId}`).join(' · ') + '). ' +
      `Los scripts usan "${activa.fuente}" (prioridad: env > claude.json > conexion.txt). Si pegaste un package NUEVO y ves "invalid_client", ` +
      'casi seguro se está usando el viejo: fuerza el nuevo con SFMC_FUENTE=conexion.txt (PowerShell: $env:SFMC_FUENTE = "conexion.txt") o borra/actualiza el viejo. ' +
      'Para saber cuál de las fuentes sirve: node scripts/conectar.js.'
    : null;
  const incompletas = fuentes.filter(x => x.estado === 'incompleta').map(f => `${f.fuente} existe pero no se puede usar: ${String(f.detalle).split('\n')[0]}`);
  return { activa, ambiguedad, incompletas, avisos: [ambiguedad, ...incompletas].filter(Boolean) };
}

/** Vista SIN el secret, apta para imprimir/loggear. */
function vistaSegura(c) {
  const s = c.clientSecret || '';
  return { fuente: c.fuente, detalleFuente: c.detalleFuente, clientId: c.clientId, accountId: c.accountId, tenant: c.tenant,
    secret: s.length + ' caracteres' + (/^SFMC_/.test(s) ? ', prefijo SFMC_' : '') };
}

module.exports = { ErrorCredenciales, FUENTES, DOMINIO_SFMC, esFormaDeSecreto, redact, registrarSecreto, errorDeArchivoSeguro, esUrlSfmc, validarSecret, parsearConexion, tenantDe, derivarUrls, desdeEnv, resolverCredenciales, inspeccionarFuentes, analizarFuentes, vistaSegura, dirCredenciales };
