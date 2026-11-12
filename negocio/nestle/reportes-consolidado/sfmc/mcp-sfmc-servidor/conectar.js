#!/usr/bin/env node
/**
 * conectar.js — enciende el MCP sfmc-nestle con lo que Rick puso en conexion.txt.
 *
 * 🔴 REGLA DE ORO: este script NUNCA escribe ni borra conexion.txt. Ese archivo es de
 *    Rick; aquí solo se lee. Se aprendió por las malas — un borrado "de limpieza" tiró
 *    credenciales que él ya había pegado.
 *
 * En Nestlé se crea un Installed Package NUEVO cada vez, así que cambian TODOS los
 * valores, no solo el secret.
 *
 * Acepta dos formatos, sin que Rick tenga que acordarse de cuál:
 *   (a) CLIENT_ID= / CLIENT_SECRET= / MID= / AUTH_URI=
 *   (b) el VOLCADO de la página del Installed Package, pegado tal cual
 *
 * Y el MID es OPCIONAL: si no viene, se descubre pidiendo el token sin `account_id`
 * y leyendo /platform/v1/tokenContext, que devuelve el MID real de la BU dueña.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';

const DIR = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'sfmc-mcp');
const TXT = path.join(DIR, 'conexion.txt');
const REGISTRO = path.join(DIR, 'ultima-conexion.json');
const CFG = path.join(os.homedir(), '.claude.json');
const SERVIDOR = 'sfmc-nestle';

const salir = (msg) => { console.log(msg); process.exit(1); };

if (!fs.existsSync(TXT)) salir('No existe:\n  ' + TXT);

// ---------- leer. SOLO leer. ----------
const crudo = fs.readFileSync(TXT, 'utf8').replace(/^﻿/, '');
const campo = (k) => {
  const m = new RegExp('^\\s*' + k + '\\s*=\\s*(.+)$', 'm').exec(crudo);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
};

let clientId = campo('CLIENT_ID');
let secret   = campo('CLIENT_SECRET') || campo('SECRET');
let mid      = campo('MID');
let authUri  = campo('AUTH_URI') || campo('TENANT');
let formato  = 'campos KEY=VALUE';

// ---------- fallback: volcado de la página del package ----------
if (!clientId || !secret || !authUri) {
  formato = 'volcado de la página de SFMC';

  // El secret es lo único con prefijo SFMC_. El JWT Signing Secret es largo pero
  // NO lleva ese prefijo, así que no se confunden.
  if (!secret) secret = (/\bSFMC_[A-Za-z0-9_\-]{20,}/.exec(crudo) || [])[0] || '';

  // "Client Id" y en la línea siguiente el valor. Se prefiere esto sobre buscar
  // un token de 24 chars, porque el "Description" del secret contiene el mismo id.
  if (!clientId) {
    const m = /^\s*Client\s*Id\s*$\r?\n\s*([A-Za-z0-9]{16,40})\s*$/mi.exec(crudo);
    clientId = m ? m[1] : '';
  }

  if (!authUri) authUri = (/https?:\/\/[a-z0-9]+\.auth\.marketingcloudapis\.com\/?/i.exec(crudo) || [])[0] || '';

  // el MID rara vez sale en ese volcado; si no está, se descubre solo más abajo
  if (!mid) mid = (/\bMID\s*[:=]?\s*(\d{6,})\b/i.exec(crudo) || [])[1] || '';
}

// ---------- validar diciendo CUÁL falta ----------
const faltan = [];
if (!clientId) faltan.push('CLIENT_ID');
if (!secret)   faltan.push('CLIENT_SECRET');
if (!authUri)  faltan.push('AUTH_URI (Authentication Base URI)');
if (faltan.length) {
  salir('No encontré en el txt: ' + faltan.join(', ') +
    '\n  ' + TXT +
    '\n\nPuedes pegar el volcado completo de la página del package, o usar\n' +
    'las líneas CLIENT_ID= / CLIENT_SECRET= / AUTH_URI=');
}

const tenant = (/^https?:\/\/([^.]+)\./i.exec(authUri) || [])[1]
  || authUri.replace(/^https?:\/\//i, '').split('.')[0];
if (!tenant || tenant.length < 10) salir('No pude sacar el tenant de "' + authUri + '"');

if (/\s/.test(secret)) salir('El secret trae espacios: copiaste la etiqueta ("<clientId> - 1"), no el valor.');
if (secret.includes('*')) salir('El secret trae asteriscos: copiaste el valor enmascarado.');
if (secret.length < 20) salir('El secret mide ' + secret.length + ' caracteres. Se ve corto.');

console.log('formato detectado: ' + formato);
console.log('  CLIENT_ID : ' + clientId);
console.log('  SECRET    : ' + secret.length + ' chars, prefijo ' + secret.slice(0, 5));
console.log('  tenant    : ' + tenant);
console.log('  MID       : ' + (mid || '(no venía — lo descubro)'));

// ---------- helpers de red ----------
const post = (host, ruta, payload) => new Promise((res) => {
  const b = JSON.stringify(payload);
  const r = https.request({ host, path: ruta, method: 'POST', timeout: 30000,
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) } },
    (rr) => { let d = ''; rr.on('data', c => d += c);
      rr.on('end', () => { let j = {}; try { j = JSON.parse(d); } catch {} res({ st: rr.statusCode, j, raw: d }); }); });
  r.on('timeout', () => { r.destroy(); res({ st: 0, j: {}, raw: 'timeout' }); });
  r.on('error', (e) => res({ st: 0, j: {}, raw: e.code }));
  r.write(b); r.end();
});

const get = (host, ruta, token) => new Promise((res) => {
  const r = https.request({ host, path: ruta, method: 'GET', timeout: 30000,
    headers: { Authorization: 'Bearer ' + token } },
    (rr) => { let d = ''; rr.on('data', c => d += c);
      rr.on('end', () => { let j = {}; try { j = JSON.parse(d); } catch {} res({ st: rr.statusCode, j }); }); });
  r.on('timeout', () => { r.destroy(); res({ st: 0, j: {} }); });
  r.on('error', () => res({ st: 0, j: {} }));
  r.end();
});

const AUTH = tenant + '.auth.marketingcloudapis.com';
const REST = tenant + '.rest.marketingcloudapis.com';
const base = { grant_type: 'client_credentials', client_id: clientId, client_secret: secret };

const explicar = (j, raw) => {
  const desc = String(j.error_description || raw).slice(0, 140);
  console.log('  "' + desc + '"');
  if (/client ID/i.test(desc)) {
    console.log('  → El CLIENT_ID no existe en este tenant; el secret ni se evalúa.');
    console.log('    Revisa CLIENT_ID y que el AUTH_URI sea el del mismo package.');
  } else if (/business unit|account/i.test(desc)) {
    console.log('  → Apunta al MID.');
  } else {
    console.log('  → Mensaje genérico: no distingue entre secret y MID equivocados.');
  }
};

(async () => {
  // ---------- descubrir el MID si no vino ----------
  if (!mid) {
    console.log('\ndescubriendo el MID (token sin account_id → tokenContext)...');
    const t0 = await post(AUTH, '/v2/token', base);
    if (!t0.j.access_token) {
      console.log('FALLA al pedir token sin MID: HTTP ' + t0.st + ' ' + (t0.j.error || ''));
      explicar(t0.j, t0.raw);
      salir('\nNo escribí nada; el txt sigue intacto.');
    }
    const ctx = await get(REST, '/platform/v1/tokenContext', t0.j.access_token);
    mid = String(ctx.j?.organization?.id || '');
    if (!mid) salir('No pude leer el MID de tokenContext. Pégalo a mano con  MID=  en el txt.');
    console.log('  MID descubierto: ' + mid + '   (enterprise ' + (ctx.j?.enterprise?.id ?? '?') + ')');
  }

  // ---------- probar con el MID, ANTES de escribir ----------
  console.log('\nprobando con account_id=' + mid + '...');
  const t = await post(AUTH, '/v2/token', { ...base, account_id: mid });
  if (!t.j.access_token) {
    console.log('FALLA: HTTP ' + t.st + '  ' + (t.j.error || ''));
    explicar(t.j, t.raw);
    salir('\nNo escribí nada; el txt sigue intacto.');
  }
  console.log('AUTENTICA ✓');

  // ---------- qué scopes quedaron ----------
  const scopes = String(t.j.scope || '').split(/\s+/).filter(Boolean);
  const tiene = (s) => scopes.includes(s);
  console.log('\nscopes concedidos: ' + scopes.length);
  const NECESARIOS = [
    ['data_extensions_read',  'leer DEs',                    true],
    ['data_extensions_write', 'CREAR las DEs de reportería',  true],
    ['automations_read',      'ver Query Activities',        true],
    ['automations_write',     'crear la query y la automation', true],
    ['automations_execute',   'disparar la query',           true],
    ['tracking_events_read',  'métricas de envío',           true],
    ['journeys_read',         'nombres de journey',          true],
    ['email_read',            'leer assets',                 false],
  ];
  for (const [s, para, critico] of NECESARIOS) {
    console.log('  ' + (tiene(s) ? '✓' : (critico ? '✗ FALTA' : '·')) + '  ' + s.padEnd(22) + para);
  }
  const faltantes = NECESARIOS.filter(([s, , c]) => c && !tiene(s)).map(([s]) => s);

  // ---------- escribir la config ----------
  const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
  const otrosAntes = Object.keys(cfg.mcpServers || {}).filter(s => s !== SERVIDOR);
  const proyAntes = Object.keys(cfg.projects || {}).length;

  cfg.mcpServers = cfg.mcpServers || {};
  cfg.mcpServers[SERVIDOR] = {
    command: path.join(os.homedir(), '.claude', 'tools', 'node', 'node.exe'),
    args: [path.join(os.homedir(), '.claude', 'tools', '_mcp-sfmc', 'index.js')],
    env: {
      SFMC_CLIENT_ID: clientId,
      SFMC_CLIENT_SECRET: secret,
      SFMC_ACCOUNT_ID: mid,
      SFMC_AUTH_URL: `https://${tenant}.auth.marketingcloudapis.com/v2/token`,
      SFMC_REST_URL: `https://${tenant}.rest.marketingcloudapis.com`,
      SFMC_SOAP_URL: `https://${tenant}.soap.marketingcloudapis.com`,
    },
  };
  fs.writeFileSync(CFG, JSON.stringify(cfg, null, 2), { encoding: 'utf8' });

  const raw = fs.readFileSync(CFG);
  const back = JSON.parse(raw.toString('utf8'));
  const env = back.mcpServers[SERVIDOR]?.env || {};
  const otrosDespues = Object.keys(back.mcpServers).filter(s => s !== SERVIDOR);

  fs.writeFileSync(REGISTRO, JSON.stringify({
    _nota: 'Ultima conexion que funciono. NO es fuente: la fuente es conexion.txt.',
    cuando: new Date().toISOString(), clientId, mid, tenant,
    secretChars: secret.length, scopes,
  }, null, 2), 'utf8');

  console.log('\n--- config escrita ---');
  console.log('  primer byte    : ' + raw[0] + (raw[0] === 123 ? ' (ok, sin BOM)' : ' !! BOM'));
  console.log('  secret         : ' + (env.SFMC_CLIENT_SECRET === secret ? 'verificado' : '!! REVISAR'));
  console.log('  otros servidores intactos : ' +
    (otrosAntes.length === otrosDespues.length ? 'sí (' + otrosDespues.join(', ') + ')' : '!! REVISAR'));
  console.log('  proyectos      : ' + proyAntes + ' -> ' + Object.keys(back.projects || {}).length);
  console.log('  conexion.txt   : SIN TOCAR');

  if (faltantes.length) {
    console.log('\n⚠  Faltan scopes críticos: ' + faltantes.join(', '));
    console.log('   El MCP conecta, pero esas operaciones van a rebotar.');
  }
  console.log('\nReinicia Claude Code para que cargue el MCP.');
})();
