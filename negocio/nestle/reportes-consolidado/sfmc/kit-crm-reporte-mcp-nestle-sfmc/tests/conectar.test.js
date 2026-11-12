'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { crearCliente } = require('../lib/sfmc');
const { dirCredenciales } = require('../lib/paths');
const { diagnosticarConexion, veredicto } = require('../lib/conectar');
const { analizarFuentes, inspeccionarFuentes } = require('../lib/credenciales');
const { SECRETO, TEN, fakeHttp } = require('./_utils');

const CID_NUEVO = 'nuevo1234nuevo5678nuevo9012';
const CID_VIEJO = 'viejo1234viejo5678viejo9012';
const TODOS = 'data_extensions_read data_extensions_write automations_read automations_write automations_execute journeys_read';
const HOME = path.join('/h', 'u');
const CT = path.join(dirCredenciales({ env: {}, plataforma: 'linux', home: HOME }), 'conexion.txt');

const volcado = (cid) => `Client Id\n${cid}\nClient Secret\n${SECRETO}\nAuthentication Base URI\nhttps://${TEN}.auth.marketingcloudapis.com/\nDescription: ${cid} - 1\n`;
const jsonMcp = (cid) => JSON.stringify({ mcpServers: { 'sfmc-nestle': { env: { SFMC_CLIENT_ID: cid, SFMC_CLIENT_SECRET: SECRETO, SFMC_SUBDOMAIN: TEN } } } });

/** Un disco falso (claude.json y conexion.txt) + una SFMC falsa donde solo los client ids de `validos` obtienen token. */
function escenario({ claude = null, conexion = null, env = {}, validos = [CID_NUEVO], scopes = TODOS, mid = '1234567' } = {}) {
  const calls = [];
  const archivos = { [path.join(HOME, '.claude.json')]: claude && jsonMcp(claude), [CT]: conexion && volcado(conexion) };
  const opts = { env, plataforma: 'linux', home: HOME, existe: (p) => archivos[p] != null, leerArchivo: (p) => archivos[p] };
  const handler = async (c) => {
    if (c.path === '/v2/token') {
      const b = JSON.parse(c.body);
      // El servidor "eco" el secret en el error (peor caso): la salida de conectar no debe llevarlo.
      if (!validos.includes(b.client_id)) return { status: 401, json: { error: 'invalid_client', error_description: `Invalid client ID. (recibido secret ${b.client_secret})` } };
      return { json: { access_token: 'tok-secreto-' + b.client_id, expires_in: 1080, scope: scopes } };
    }
    if (c.path === '/platform/v1/tokenContext') return { json: { organization: { id: mid } } };
    return { json: {} };
  };
  const crear = (cred) => crearCliente({ cred, httpsRequest: fakeHttp(handler, calls) });
  return { opts, crear, calls };
}

test('el caso REAL: claude.json con un package viejo tapa al nuevo de conexion.txt => se detecta, se explica y se propone SFMC_FUENTE', async () => {
  const e = escenario({ claude: CID_VIEJO, conexion: CID_NUEVO });
  const d = await diagnosticarConexion(e.opts, e.crear);
  assert.equal(d.activa, 'claude.json');
  assert.equal(d.funciona, false);
  assert.match(d.problema, /"claude\.json" y esa fuente NO obtiene token/);
  assert.match(d.consejos.join(' '), /conexion\.txt.*SÍ obtiene token.*SFMC_FUENTE=conexion\.txt/);
  assert.deepEqual(d.avisos, [], 'el problema + consejo ya lo dicen todo: no se repite como aviso');
  const porFuente = Object.fromEntries(d.resultados.map(r => [r.fuente, r]));
  assert.equal(porFuente['claude.json'].token.ok, false);
  assert.equal(porFuente['conexion.txt'].token.ok, true);
  assert.equal(porFuente['conexion.txt'].token.mid, '1234567');
});

test('el caso INVERSO (la maquina de Rick hoy): claude.json vigente + conexion.txt viejo => funciona, y avisa que conexion.txt esta desactualizado', async () => {
  const e = escenario({ claude: CID_NUEVO, conexion: CID_VIEJO, validos: [CID_NUEVO] });
  const d = await diagnosticarConexion(e.opts, e.crear);
  assert.equal(d.funciona, true); assert.equal(d.activa, 'claude.json'); assert.deepEqual(d.consejos, []);
  assert.equal(d.avisos.length, 1);
  assert.match(d.avisos[0], /"conexion\.txt" tiene un package \(client viejo1234viejo5678viejo9012\) que ya NO conecta/);
  assert.match(d.avisos[0], /vigente o bórralo/);
});

test('dos packages DISTINTOS que conectan los dos: funciona con el de mayor prioridad y avisa cual se usa', async () => {
  const e = escenario({ claude: CID_VIEJO, conexion: CID_NUEVO, validos: [CID_VIEJO, CID_NUEVO] });
  const d = await diagnosticarConexion(e.opts, e.crear);
  assert.equal(d.funciona, true); assert.equal(d.activa, 'claude.json');
  assert.equal(d.avisos.length, 1); assert.match(d.avisos[0], /conectan, pero son DISTINTOS.*usan "claude\.json".*SFMC_FUENTE=<fuente>/);
});

test('forzar con SFMC_FUENTE=conexion.txt arregla el caso: funciona y ya no avisa de ambiguedad', async () => {
  const e = escenario({ claude: CID_VIEJO, conexion: CID_NUEVO, env: { SFMC_FUENTE: 'conexion.txt' } });
  const d = await diagnosticarConexion(e.opts, e.crear);
  assert.equal(d.activa, 'conexion.txt'); assert.equal(d.forzada, 'conexion.txt');
  assert.equal(d.funciona, true); assert.equal(d.problema, null);
  assert.deepEqual(d.avisos, []);
});

test('un solo package (el caso del operador nuevo): funciona, el MID se DESCUBRE y no hay avisos', async () => {
  const e = escenario({ conexion: CID_NUEVO });
  const d = await diagnosticarConexion(e.opts, e.crear);
  assert.equal(d.funciona, true); assert.equal(d.activa, 'conexion.txt');
  assert.equal(d.resultados.find(r => r.fuente === 'conexion.txt').token.midDeclarado, false);
  assert.deepEqual(d.avisos, []);
  assert.deepEqual(d.resultados.filter(r => r.estado === 'ausente').map(r => r.fuente), ['env', 'claude.json']);
});

test('dos fuentes con el MISMO package: sin ambiguedad', async () => {
  const e = escenario({ claude: CID_NUEVO, conexion: CID_NUEVO });
  const d = await diagnosticarConexion(e.opts, e.crear);
  assert.equal(d.funciona, true); assert.deepEqual(d.avisos, []);
});

test('sin ninguna credencial: no funciona y no se pide ni un token', async () => {
  const e = escenario({});
  const d = await diagnosticarConexion(e.opts, e.crear);
  assert.equal(d.funciona, false); assert.equal(d.activa, null); assert.match(d.problema, /ninguna fuente/);
  assert.equal(e.calls.length, 0, 'sin credenciales no hay peticion alguna');
});

test('conexion.txt incompleto (secret sin la S inicial): se reporta con su pista, y NO se prueba', async () => {
  const e = escenario({ conexion: CID_NUEVO }); const dir = path.dirname(CT);
  e.opts.leerArchivo = (p) => (p === CT ? volcado(CID_NUEVO).replace(SECRETO, SECRETO.slice(1)) : null);
  const d = await diagnosticarConexion(e.opts, e.crear);
  const ct = d.resultados.find(r => r.fuente === 'conexion.txt');
  assert.equal(ct.estado, 'incompleta'); assert.match(ct.detalle, /FMC_|incompleto/); assert.equal(ct.token, null);
  assert.equal(d.funciona, false); assert.equal(e.calls.length, 0); assert.ok(dir);
});

test('faltan scopes requeridos: conecta pero NO esta lista, y dice cuales y donde se editan', async () => {
  const e = escenario({ conexion: CID_NUEVO, scopes: 'data_extensions_read automations_read' });
  const d = await diagnosticarConexion(e.opts, e.crear);
  assert.equal(d.funciona, false);
  assert.match(d.problema, /FALTAN scopes requeridos|le FALTAN scopes requeridos/);
  assert.match(d.problema, /data_extensions_write, automations_write, automations_execute/);
  assert.match(d.consejos.join(' '), /Installed Package/);
});

test('falta solo journeys_read (opcional): sigue funcionando', async () => {
  const e = escenario({ conexion: CID_NUEVO, scopes: TODOS.replace(' journeys_read', '') });
  const d = await diagnosticarConexion(e.opts, e.crear);
  assert.equal(d.funciona, true);
  assert.equal(d.resultados.find(r => r.fuente === 'conexion.txt').token.faltanOpcionales[0].scope, 'journeys_read');
});

test('SFMC_FUENTE apuntando a una fuente vacia: no funciona y sugiere quitarla si otra si sirve', async () => {
  const e = escenario({ conexion: CID_NUEVO, env: { SFMC_FUENTE: 'claude.json' } });
  const d = await diagnosticarConexion(e.opts, e.crear);
  assert.equal(d.funciona, false); assert.match(d.problema, /SFMC_FUENTE=claude\.json/);
  assert.match(d.consejos.join(' '), /conexion\.txt sí funciona: quita SFMC_FUENTE/);
});

test('NINGUN secreto ni token en el resultado, ni siquiera serializado (aunque el servidor lo eco en el error)', async () => {
  const e = escenario({ claude: CID_VIEJO, conexion: CID_NUEVO });
  const d = await diagnosticarConexion(e.opts, e.crear);
  const todo = JSON.stringify(d);
  assert.ok(d.resultados.find(r => r.fuente === 'claude.json').token.error.includes('Invalid client ID'), 'el error del servidor si llega (prueba que el eco existio)');
  assert.ok(!todo.includes(SECRETO), 'el secret no aparece'); assert.ok(!todo.includes(SECRETO.slice(5, 30)), 'ni un fragmento largo');
  assert.ok(!todo.includes('tok-secreto-'), 'ni el access token');
});

test('segunda capa: si el cliente lanza un error con el secret adentro (no pasa por sfmc.js), conectar igual lo redacta', async () => {
  const e = escenario({ conexion: CID_NUEVO });
  const crearRaro = (cred) => ({ token: async () => { throw new Error('fallo inesperado con ' + cred.clientSecret); }, cerrar() {} });
  const d = await diagnosticarConexion(e.opts, crearRaro);
  const ct = d.resultados.find(r => r.fuente === 'conexion.txt');
  assert.equal(ct.token.ok, false); assert.match(ct.token.error, /fallo inesperado/);
  assert.ok(!JSON.stringify(d).includes(SECRETO.slice(5, 30)), 'el secret no sobrevive en el resultado');
});

test('conectar es de SOLO LECTURA: las unicas peticiones son token y tokenContext', async () => {
  const e = escenario({ claude: CID_VIEJO, conexion: CID_NUEVO });
  await diagnosticarConexion(e.opts, e.crear);
  for (const c of e.calls) assert.ok(c.path === '/v2/token' || c.path === '/platform/v1/tokenContext', `peticion inesperada ${c.method} ${c.path}`);
  assert.ok(e.calls.some(c => c.path === '/platform/v1/tokenContext'), 'descubrio el MID');
});

test('analizarFuentes (pura): activa por prioridad, forzada gana, y la ambiguedad solo avisa si NO se forzo', () => {
  const f = (fuente, estado, clientId) => ({ fuente, estado, clientId, detalle: fuente });
  const todas = [f('env', 'ausente'), f('claude.json', 'ok', 'A'), f('conexion.txt', 'ok', 'B')];
  let r = analizarFuentes(todas); assert.equal(r.activa.fuente, 'claude.json'); assert.equal(r.avisos.length, 1); assert.match(r.ambiguedad, /packages DISTINTOS/); assert.deepEqual(r.incompletas, []);
  r = analizarFuentes([f('env', 'ausente'), f('claude.json', 'ok', 'A'), { fuente: 'conexion.txt', estado: 'incompleta', detalle: 'falta algo\nlinea 2' }]);
  assert.equal(r.ambiguedad, null); assert.deepEqual(r.incompletas, ['conexion.txt existe pero no se puede usar: falta algo']); assert.equal(r.avisos.length, 1);
  r = analizarFuentes(todas, { forzada: 'conexion.txt' }); assert.equal(r.activa.fuente, 'conexion.txt'); assert.deepEqual(r.avisos, []);
  r = analizarFuentes([f('env', 'ausente'), f('claude.json', 'ok', 'A'), f('conexion.txt', 'ok', 'A')]); assert.deepEqual(r.avisos, []);
  r = analizarFuentes([f('env', 'ausente'), f('claude.json', 'ausente'), f('conexion.txt', 'ausente')]); assert.equal(r.activa, null);
});

test('veredicto (pura): activa utilizable pero sin token y SIN alternativa => problema sin consejo falso', () => {
  const v = veredicto([{ fuente: 'conexion.txt', estado: 'ok', clientId: 'X', token: { ok: false, error: 'x' } }]);
  assert.equal(v.funciona, false); assert.deepEqual(v.consejos, []);
});

test('inspeccionarFuentes conserva el mensaje COMPLETO de una fuente incompleta (con sus pistas)', () => {
  const e = escenario({ conexion: CID_NUEVO });
  const f = inspeccionarFuentes({ ...e.opts, leerArchivo: () => 'Client Secret ********\n' }).find(x => x.fuente === 'conexion.txt');
  assert.equal(f.estado, 'incompleta'); assert.match(f.detalle, /enmascarado|falta/); assert.ok(f.detalle.split('\n').length > 1);
});
