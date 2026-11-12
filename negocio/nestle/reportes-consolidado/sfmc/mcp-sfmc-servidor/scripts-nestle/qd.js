// Libreria para manejar QueryDefinitions de SFMC por REST.
// Uso: const Q = require('./qd.js'); await Q.init(); Q.crear/actualizar/correr/estado/borrar/filas
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const env = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'))
  .mcpServers['sfmc-nestle'].env;
const H = (u) => new URL(u).host;

let TOKEN = null;

function http(host, p, method, headers, body) {
  return new Promise((resolve) => {
    const h = { ...headers };
    if (body) h['Content-Length'] = Buffer.byteLength(body);
    const r = https.request({ host, path: p, method, timeout: 120000, headers: h }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch {} resolve({ status: res.statusCode, json: j, raw: d }); });
    });
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, raw: 'timeout' }); });
    r.on('error', (e) => resolve({ status: 0, raw: e.code + ' ' + e.message }));
    if (body) r.write(body);
    r.end();
  });
}

async function init() {
  const t = await http(H(env.SFMC_AUTH_URL), '/v2/token', 'POST', { 'Content-Type': 'application/json' },
    JSON.stringify({ grant_type: 'client_credentials', client_id: env.SFMC_CLIENT_ID,
      client_secret: env.SFMC_CLIENT_SECRET, account_id: env.SFMC_ACCOUNT_ID }));
  TOKEN = t.json?.access_token;
  if (!TOKEN) throw new Error('no hubo token: ' + t.raw.slice(0, 200));
  return TOKEN;
}

const REST = () => H(env.SFMC_REST_URL);
const auth = () => ({ Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' });

const rest = (p, method, body) =>
  http(REST(), p, method, auth(), body ? JSON.stringify(body) : null);

// --- QueryDefinitions ---
const listar = (filtroNombre) => rest('/automation/v1/queries?$pagesize=50', 'GET');

async function buscarPorKey(key) {
  for (let pag = 1; pag <= 40; pag++) {
    const r = await rest(`/automation/v1/queries?$page=${pag}&$pagesize=50`, 'GET');
    const it = r.json?.items || [];
    if (!it.length) break;
    const hit = it.find(q => q.key === key || q.name === key);
    if (hit) return hit;
    if (pag * 50 >= (r.json?.count || 0)) break;
  }
  return null;
}

const crear = (def) => rest('/automation/v1/queries', 'POST', def);
const actualizar = (id, def) => rest(`/automation/v1/queries/${id}`, 'PATCH', def);
const obtener = (id) => rest(`/automation/v1/queries/${id}`, 'GET');
const borrar = (id) => rest(`/automation/v1/queries/${id}`, 'DELETE');
const correr = (id) => rest(`/automation/v1/queries/${id}/actions/start/`, 'POST', {});

// --- filas de una DE ---
const filas = (key, pageSize = 10, page = 1) =>
  rest(`/data/v1/customobjectdata/key:${encodeURIComponent(key)}/rowset?$page=${page}&$pagesize=${pageSize}`, 'GET');

// espera activa: reintenta leer la DE hasta que cambie el conteo o se agote
async function esperar(deKey, segundos = 180, desde = -1) {
  const t0 = Date.now();
  let ultimo = desde;
  while ((Date.now() - t0) / 1000 < segundos) {
    const r = await filas(deKey, 1);
    const n = r.json?.count;
    if (typeof n === 'number' && n !== desde) return { listo: true, filas: n, seg: ((Date.now() - t0) / 1000).toFixed(0) };
    ultimo = n;
    await new Promise(res => setTimeout(res, 6000));
  }
  return { listo: false, filas: ultimo, seg: segundos };
}

module.exports = { init, rest, listar, buscarPorKey, crear, actualizar, obtener, borrar, correr, filas, esperar, env };
