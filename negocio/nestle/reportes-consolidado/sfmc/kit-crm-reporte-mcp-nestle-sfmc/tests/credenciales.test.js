'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { parsearConexion, validarSecret, redact, resolverCredenciales, inspeccionarFuentes, vistaSegura, esFormaDeSecreto, tenantDe, derivarUrls, ErrorCredenciales } = require('../lib/credenciales');
const { dirCredenciales } = require('../lib/paths');

// Secreto SINTETICO armado en runtime: el codigo fuente nunca contiene un "SFMC_…" contiguo.
const PRE = 'SFMC' + '_';
const SECRETO = PRE + 'Zq3Lm9Tr8Xv2Ab7Cd4Ef1Gh6Jk5Np0Qw2Rs9Tu3Vw8Xy1Za4Bc7De0Fg5Hi';
const CID = 'abcd1234efgh5678ijkl9012';
const TENANT = 'mcfakeaaaaaaaaaaaaaaaaaaaaaa';
const AUTH = `https://${TENANT}.auth.marketingcloudapis.com/`;

const VOLCADO = [
  SECRETO, '', 'Summary', 'Name', 'CRM Test', 'Package Id', '11111111-2222-3333-4444-555555555555',
  'JWT Signing Secret', 'Jwt' + 'SigningSecretNoEmpiezaConPrefijo_abcdefghijklmnopqrstuvwxyz0123456789', '',
  'Components', 'API Integration', 'Client Id', CID, 'Integration Type', 'Server-to-Server',
  'Active Secret Information', 'Client Secret: *******', `Description: ${CID} - 1`,
  'Authentication Base URI ', 'Information', AUTH, 'REST Base URI', `https://${TENANT}.rest.marketingcloudapis.com/`,
].join('\n');

const sinArchivos = { leerArchivo: () => { throw new Error('no debia leer archivos'); }, existe: () => false };

test('parsearConexion: formato KEY=VALUE (con CRLF de Windows)', () => {
  const p = parsearConexion(`CLIENT_ID=${CID}\r\nCLIENT_SECRET=${SECRETO}\r\nAUTH_URI=${AUTH}\r\nMID=10966050\r\n`);
  assert.equal(p.clientId, CID); assert.equal(p.secret, SECRETO); assert.equal(p.authUri, AUTH); assert.equal(p.mid, '10966050');
  assert.deepEqual(p.faltan, []); assert.equal(p.formato, 'campos KEY=VALUE');
});

test('parsearConexion: un conexion.txt guardado por Notepad o por PowerShell (UTF-8 con BOM) se lee igual, en los dos formatos', () => {
  const BOM = String.fromCharCode(0xfeff);
  const clave = `CLIENT_ID=${CID}\nCLIENT_SECRET=${SECRETO}\nAUTH_URI=${AUTH}\n`;
  for (const texto of [clave, VOLCADO]) {
    const con = parsearConexion(BOM + texto), sin = parsearConexion(texto);
    assert.deepEqual(con, sin, 'el BOM no debe cambiar nada');
    assert.deepEqual(con.faltan, []); assert.equal(con.clientId, CID); assert.equal(con.secret, SECRETO);
  }
});

test('parsearConexion: volcado de la pagina del package (el JWT Signing Secret NO se confunde con el secret)', () => {
  const p = parsearConexion(VOLCADO);
  assert.equal(p.secret, SECRETO); assert.equal(p.clientId, CID); assert.equal(p.authUri, AUTH);
  assert.deepEqual(p.faltan, []); assert.match(p.formato, /volcado/);
});

test('parsearConexion: "Client Id" pegado al valor (sin salto de linea) tambien se lee', () => {
  const p = parsearConexion(VOLCADO.replace('Client Id\n' + CID, 'Client Id' + CID));
  assert.equal(p.clientId, CID);
});

test('parsearConexion: se perdio la S inicial -> falta el secret y la pista lo dice', () => {
  const p = parsearConexion(VOLCADO.replace(SECRETO, SECRETO.slice(1)));
  assert.ok(p.faltan.includes('CLIENT_SECRET'));
  assert.ok(p.pistas.some(x => /"S" inicial/.test(x)), 'debe explicar que se perdio la S');
});

test('parsearConexion: secret enmascarado (*******) -> pista de usar el icono Copy', () => {
  const p = parsearConexion('Client Id\n' + CID + '\nClient Secret: *******\n' + AUTH);
  assert.ok(p.faltan.includes('CLIENT_SECRET'));
  assert.ok(p.pistas.some(x => /Copy/.test(x)));
});

test('validarSecret: espacios, asteriscos, corto, y aviso (no error) si no empieza con SFMC_', () => {
  assert.match(validarSecret(CID + ' - 1').error, /espacios/);
  assert.match(validarSecret('*******').error, /asteriscos/);
  assert.match(validarSecret('abc').error, /corto/);
  assert.equal(validarSecret(SECRETO).error, null);
  const v = validarSecret('a'.repeat(24));
  assert.equal(v.error, null); assert.equal(v.avisos.length, 1);
});

test('esFormaDeSecreto: positivo en secreto, negativo en nombre de DE y en cadenas sin mezcla', () => {
  assert.equal(esFormaDeSecreto(SECRETO), true);
  assert.equal(esFormaDeSecreto('TD_' + PRE + 'GLOBAL_IPG_MEX_PURINA_PROPLAN_180626'), false);
  assert.equal(esFormaDeSecreto(PRE + 'A'.repeat(40)), false);
});

test('redact: quita el secreto, el Bearer, access_token y JWT; deja intacto un nombre de DE', () => {
  const deNombre = 'TD_' + PRE + 'GLOBAL_IPG_MEX_PURINA_PROPLAN_180626';
  const jwt = 'eyJ' + 'hbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcDEF123_-xyz456';
  const t = redact(`fallo con ${SECRETO} y Authorization: Bearer ${jwt} {"access_token":"${jwt}"} y ${jwt} DE=${deNombre}`);
  assert.ok(!t.includes(SECRETO.slice(5, 25)), 'no debe quedar parte del secreto');
  assert.ok(!t.includes('hbGciOiJIUzI1NiJ9'), 'no debe quedar el JWT');
  assert.ok(t.includes(deNombre), 'el nombre de DE NO se redacta');
  assert.ok(redact('x ' + 'otroValorLiteral1234', ['otroValorLiteral1234']).includes('***'), 'secretos explicitos se redactan');
});

test('tenantDe / derivarUrls', () => {
  assert.equal(tenantDe(AUTH), TENANT);
  assert.equal(tenantDe(TENANT + '.auth.marketingcloudapis.com'), TENANT);
  const u = derivarUrls(TENANT);
  assert.equal(u.authUrl, `https://${TENANT}.auth.marketingcloudapis.com/v2/token`);
  assert.equal(u.restUrl, `https://${TENANT}.rest.marketingcloudapis.com`);
  assert.equal(u.soapUrl, `https://${TENANT}.soap.marketingcloudapis.com`);
});

test('resolver: el ENTORNO gana y no se leen archivos', () => {
  const c = resolverCredenciales({ env: { SFMC_CLIENT_ID: CID, SFMC_CLIENT_SECRET: SECRETO, SFMC_SUBDOMAIN: TENANT, SFMC_ACCOUNT_ID: '123456' }, ...sinArchivos });
  assert.equal(c.fuente, 'env'); assert.equal(c.clientId, CID); assert.equal(c.accountId, '123456'); assert.equal(c.tenant, TENANT);
});

test('resolver: segundo lugar = ~/.claude.json (con el nombre de servidor configurable)', () => {
  const json = JSON.stringify({ mcpServers: { otro: { env: { SFMC_CLIENT_ID: CID, SFMC_CLIENT_SECRET: SECRETO, SFMC_AUTH_URL: derivarUrls(TENANT).authUrl, SFMC_ACCOUNT_ID: '999999' } } } });
  const base = { env: {}, home: path.join('/h', 'u'), leerArchivo: () => json, existe: p => p.endsWith('.claude.json') };
  const c = resolverCredenciales({ ...base, mcpServerName: 'otro' });
  assert.equal(c.fuente, 'claude.json'); assert.equal(c.accountId, '999999'); assert.equal(c.restUrl, `https://${TENANT}.rest.marketingcloudapis.com`);
  assert.throws(() => resolverCredenciales({ ...base, mcpServerName: 'sfmc-nestle' }), ErrorCredenciales, 'otro nombre de servidor no se ve');
});

test('resolver: tercer lugar = conexion.txt (volcado) y deriva las URLs del tenant', () => {
  const home = path.join('/h', 'u');
  const ct = path.join(dirCredenciales({ env: {}, plataforma: 'linux', home }), 'conexion.txt');
  const c = resolverCredenciales({ env: {}, plataforma: 'linux', home, leerArchivo: p => { assert.equal(p, ct); return VOLCADO; }, existe: p => p === ct });
  assert.equal(c.fuente, 'conexion.txt'); assert.equal(c.clientId, CID); assert.equal(c.clientSecret, SECRETO);
  assert.equal(c.authUrl, derivarUrls(TENANT).authUrl); assert.equal(c.accountId, null);
});

test('resolver: sin nada -> error accionable, lista los 3 lugares y NO contiene secretos', () => {
  let err; try { resolverCredenciales({ env: {}, home: path.join('/h', 'u'), plataforma: 'linux', ...sinArchivos }); } catch (e) { err = e; }
  assert.ok(err instanceof ErrorCredenciales);
  assert.match(err.message, /variables de entorno/); assert.match(err.message, /\.claude\.json/); assert.match(err.message, /conexion\.txt/); assert.match(err.message, /docs\/CONEXION\.md/);
  assert.ok(!redact(err.message).includes('***SECRETO***'));
});

test('resolver: conexion.txt incompleto (sin S inicial) -> error con la pista, sin imprimir el secreto', () => {
  const home = path.join('/h', 'u');
  const mal = VOLCADO.replace(SECRETO, SECRETO.slice(1));
  let err; try { resolverCredenciales({ env: {}, plataforma: 'linux', home, leerArchivo: () => mal, existe: p => p.endsWith('conexion.txt') }); } catch (e) { err = e; }
  assert.ok(err instanceof ErrorCredenciales); assert.match(err.message, /"S" inicial/);
  assert.ok(!err.message.includes(SECRETO.slice(8, 30)), 'el mensaje no debe contener el secreto');
});

test('SFMC_FUENTE / opts.fuente: fuerza UNA fuente aunque otra de mayor prioridad exista', () => {
  const home = path.join('/h', 'u');
  const json = JSON.stringify({ mcpServers: { 'sfmc-nestle': { env: { SFMC_CLIENT_ID: 'viejoviejoviejoviejo1234', SFMC_CLIENT_SECRET: SECRETO, SFMC_SUBDOMAIN: TENANT } } } });
  const ct = path.join(dirCredenciales({ env: {}, plataforma: 'linux', home }), 'conexion.txt');
  const base = { env: {}, plataforma: 'linux', home, leerArchivo: (p) => (p === ct ? VOLCADO : json), existe: () => true };
  assert.equal(resolverCredenciales(base).clientId, 'viejoviejoviejoviejo1234', 'por defecto manda claude.json (prioridad 2)');
  assert.equal(resolverCredenciales({ ...base, fuente: 'conexion.txt' }).clientId, CID, 'forzando conexion.txt usa el nuevo package');
  assert.equal(resolverCredenciales({ ...base, env: { SFMC_FUENTE: 'conexion.txt' } }).fuente, 'conexion.txt', 'tambien por la variable SFMC_FUENTE');
  assert.throws(() => resolverCredenciales({ ...base, fuente: 'otra' }), /no es válida/);
  assert.throws(() => resolverCredenciales({ ...base, existe: () => false, fuente: 'conexion.txt' }), /fuente forzada "conexion\.txt"/);
});

test('inspeccionarFuentes: muestra las tres sin red, y delata packages DISTINTOS', () => {
  const home = path.join('/h', 'u');
  const json = JSON.stringify({ mcpServers: { 'sfmc-nestle': { env: { SFMC_CLIENT_ID: 'viejoviejoviejoviejo1234', SFMC_CLIENT_SECRET: SECRETO, SFMC_SUBDOMAIN: TENANT } } } });
  const ct = path.join(dirCredenciales({ env: {}, plataforma: 'linux', home }), 'conexion.txt');
  const f = inspeccionarFuentes({ env: {}, plataforma: 'linux', home, leerArchivo: (p) => (p === ct ? VOLCADO : json), existe: () => true });
  assert.deepEqual(f.map(x => [x.fuente, x.estado]), [['env', 'ausente'], ['claude.json', 'ok'], ['conexion.txt', 'ok']]);
  assert.notEqual(f[1].clientId, f[2].clientId);
  assert.ok(!JSON.stringify(f).includes(SECRETO.slice(5, 25)), 'la inspeccion jamas lleva el secreto');
  const roto = inspeccionarFuentes({ env: {}, plataforma: 'linux', home, leerArchivo: () => VOLCADO.replace(SECRETO, SECRETO.slice(1)), existe: (p) => p === ct });
  assert.equal(roto[2].estado, 'incompleta'); assert.match(roto[2].detalle, /incompleto/);
});

test('vistaSegura: nunca contiene el secreto', () => {
  const c = resolverCredenciales({ env: { SFMC_CLIENT_ID: CID, SFMC_CLIENT_SECRET: SECRETO, SFMC_SUBDOMAIN: TENANT }, ...sinArchivos });
  const s = JSON.stringify(vistaSegura(c));
  assert.ok(!s.includes(SECRETO.slice(5, 20))); assert.match(s, /caracteres/);
});

test('paths: carpeta de credenciales por SO y override', () => {
  assert.equal(dirCredenciales({ env: { LOCALAPPDATA: path.join('/L', 'AD') }, plataforma: 'win32', home: '/h' }), path.join('/L', 'AD', 'sfmc-mcp'));
  assert.equal(dirCredenciales({ env: {}, plataforma: 'win32', home: path.join('/h', 'u') }), path.join('/h', 'u', 'AppData', 'Local', 'sfmc-mcp'));
  assert.equal(dirCredenciales({ env: { XDG_CONFIG_HOME: '/x' }, plataforma: 'linux', home: '/h' }), path.join('/x', 'sfmc-mcp'));
  assert.equal(dirCredenciales({ env: {}, plataforma: 'darwin', home: path.join('/h', 'u') }), path.join('/h', 'u', '.config', 'sfmc-mcp'));
  assert.equal(dirCredenciales({ env: { SFMC_CONEXION_DIR: '/custom' }, plataforma: 'win32', home: '/h' }), '/custom');
});

// ---------- A DONDE se mandan las credenciales: solo <tenant>.(auth|rest|soap).marketingcloudapis.com ----------
const { desdeEnv } = require('../lib/credenciales');
const envBase = (extra = {}) => ({ SFMC_CLIENT_ID: CID, SFMC_CLIENT_SECRET: SECRETO, SFMC_SUBDOMAIN: TENANT, ...extra });

test('URLs del entorno: SOLO se aceptan si son EXACTAMENTE <tenant>.(auth|rest|soap).marketingcloudapis.com por https; si no, error que NO repite el secret', () => {
  const malas = [
    ['SFMC_AUTH_URL', 'https://evil.example.com/v2/token', /no es un dominio de SFMC/],
    ['SFMC_AUTH_URL', `https://${TENANT}.auth.marketingcloudapis.com.evil.com/v2/token`, /no es un dominio de SFMC/],        // sufijo engañoso
    ['SFMC_REST_URL', `http://${TENANT}.rest.marketingcloudapis.com`, /no es un dominio de SFMC/],                           // sin https
    ['SFMC_SOAP_URL', `https://usuario:clave@${TENANT}.soap.marketingcloudapis.com`, /no es un dominio de SFMC/],            // con usuario y clave
    ['SFMC_REST_URL', `https://${TENANT}.rest.marketingcloudapis.com:8443`, /no es un dominio de SFMC/],                     // otro puerto
    ['SFMC_REST_URL', 'https://otrotenantxxxxxxxxxxxxxxxxxx.rest.marketingcloudapis.com', /NO es el host de tu tenant/],      // de SFMC, pero de OTRO tenant
    ['SFMC_SOAP_URL', `https://${TENANT}.rest.marketingcloudapis.com`, /NO es el host de tu tenant/],                        // el servicio equivocado
    ['SFMC_AUTH_URL', 'esto no es una url', /no es un dominio de SFMC/],
  ];
  for (const [clave, valor, esperado] of malas) {
    let err; try { desdeEnv(envBase({ [clave]: valor })); } catch (e) { err = e; }
    assert.ok(err instanceof ErrorCredenciales, `${clave}=${valor} debió rechazarse`); assert.match(err.message, esperado); assert.ok(!err.message.includes(SECRETO), 'el mensaje no repite el secret');
  }
});
test('URLs del entorno: las correctas se aceptan (mayúsculas, con ruta), y las URLs FINALES salen siempre del tenant', () => {
  const c = desdeEnv(envBase({ SFMC_AUTH_URL: `https://${TENANT.toUpperCase()}.AUTH.marketingcloudapis.com/v2/token`, SFMC_REST_URL: `https://${TENANT}.rest.marketingcloudapis.com/`, SFMC_SOAP_URL: `https://${TENANT}.soap.marketingcloudapis.com/Service.asmx` }));
  const d = derivarUrls(TENANT); assert.deepEqual({ a: c.authUrl, r: c.restUrl, s: c.soapUrl }, { a: d.authUrl, r: d.restUrl, s: d.soapUrl });
});
test('el subdominio debe ser UNA etiqueta de DNS: sin puntos, "/" ni ":" (no se interpola tal cual en una URL)', () => {
  for (const malo of ['evil.example.com/x', 'aaaaaaaaaaaa.evil.com', 'tenant/../x1234567', 'tenant:8443abcdef', 'tenant abcdefghij', '-aaaaaaaaaaaa']) assert.throws(() => desdeEnv(envBase({ SFMC_SUBDOMAIN: malo })), /no tiene forma de subdominio/, malo);
  assert.equal(desdeEnv(envBase({ SFMC_SUBDOMAIN: 'Mc-Tenant-123456' })).tenant, 'Mc-Tenant-123456');
});
test('conexion.txt con un AUTH_URI de otro dominio: el host NO se usa; solo su primera etiqueta como tenant, y las URLs salen de marketingcloudapis.com', () => {
  const home = path.join('/h', 'u'); const ct = path.join(dirCredenciales({ env: {}, plataforma: 'linux', home }), 'conexion.txt');
  const cargar = (authUri) => resolverCredenciales({ env: {}, home, plataforma: 'linux', leerArchivo: () => `CLIENT_ID=${CID}\nCLIENT_SECRET=${SECRETO}\nAUTH_URI=${authUri}\n`, existe: (p) => p === ct });
  const c = cargar('https://abcdefghijklmnop.evil.example.com/');
  assert.equal(c.tenant, 'abcdefghijklmnop');
  for (const u of [c.authUrl, c.restUrl, c.soapUrl]) assert.match(u, /^https:\/\/abcdefghijklmnop\.(auth|rest|soap)\.marketingcloudapis\.com/);
  assert.ok(![c.authUrl, c.restUrl, c.soapUrl].some(u => /evil/.test(u)));
  assert.throws(() => cargar('https://evil.example.com/'), /No pude sacar el tenant/);
  assert.throws(() => cargar('https://-bad-tenant-label-xx.example.com/'), /no tiene forma de subdominio/);
});

// ---------- secretos conocidos: se redactan aunque no tengan forma de secret de SFMC ----------
test('un secret SIN la forma de SFMC (package antiguo de 24 caracteres) tambien se redacta en cuanto el kit lo ve, venga de donde venga', () => {
  const viejo = 'q1w2e3r4t5y6u7i8o9p0abcd';
  assert.equal(redact('fallo con ' + viejo + ' fin'), 'fallo con ' + viejo + ' fin', 'antes de verlo no hay como saber que es un secret');
  desdeEnv({ SFMC_CLIENT_ID: CID, SFMC_CLIENT_SECRET: viejo, SFMC_SUBDOMAIN: TENANT });
  assert.equal(redact('fallo con ' + viejo + ' fin'), 'fallo con *** fin');
  const otro = 'zxcvbnm1234567890asdfghj'; parsearConexion(`CLIENT_ID=${CID}\nCLIENT_SECRET=${otro}\nAUTH_URI=${AUTH}\n`);
  assert.equal(redact('x ' + otro), 'x ***', 'parsearConexion tambien lo registra');
});

// ---------- secretos que se contienen o se solapan: no debe quedar la COLA de ninguno, sin importar el orden ----------
// (reemplazarlos de uno en uno dejaba a la vista lo que sobraba del mas largo cuando el corto iba primero en la lista)
test('redact: un secreto que contiene a otro (prefijo, sufijo, parte) o que se solapa con otro NO deja a la vista ninguna cola — en cualquier orden de la lista', () => {
  const largo = 'Zq3Lm9Tr8Xv2Ab7Cd4Ef1Gh6';
  for (const corto of [largo.slice(0, 10), largo.slice(-10), largo.slice(6, 16)]) {
    for (const orden of [[corto, largo], [largo, corto]]) assert.equal(redact('x ' + largo + ' y', orden), 'x *** y', corto + ' / ' + (orden[0] === corto ? 'corto primero' : 'largo primero'));
  }
  const A = 'AAAAAAAAbbbbbbbb', B = 'bbbbbbbbCCCCCCCC';                                                      // se pisan en "bbbbbbbb"
  for (const orden of [[A, B], [B, A]]) assert.equal(redact('[AAAAAAAAbbbbbbbbCCCCCCCC]', orden), '[***]', 'solapados');
  assert.equal(redact('xaaaaaaaaaaaay', ['aaaaaaaa']), 'x***y', 'un secreto que se solapa consigo mismo');
  assert.equal(redact('a SECRETO1 b SECRETO2 c', ['SECRETO1', 'SECRETO2']), 'a *** b *** c', 'separados: una marca cada uno');
  assert.equal(redact('SECRETO1SECRETO2', ['SECRETO1', 'SECRETO2']), '***', 'pegados: una sola marca');
  assert.equal(redact('SECRETO1 y SECRETO1', ['SECRETO1']), '*** y ***', 'el mismo secreto varias veces');
  assert.equal(redact('nada que ocultar', ['SECRETO1']), 'nada que ocultar'); assert.equal(redact('', ['SECRETO1']), ''); assert.equal(redact(null, ['SECRETO1']), ''); assert.equal(redact('x', [null, undefined, '', 'SECRETO1']), 'x');
  assert.equal(redact('corto abcdefg', ['abcdefg']), 'corto abcdefg', 'menos de 8 caracteres no se considera secreto (casaria con medio texto)');
  assert.equal(redact('largo abcdefgh', ['abcdefgh']), 'largo ***', 'con 8 si');
});
test('redact: 300 casos al azar de secretos solapados (prefijo, sufijo, parte), en los dos ordenes — nunca queda un trozo de 6 caracteres del secreto largo', () => {
  let semilla = 7; const azar = () => { semilla = (semilla * 1664525 + 1013904223) >>> 0; return semilla / 4294967296; };
  const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const cad = (n) => Array.from({ length: n }, () => AL[Math.floor(azar() * AL.length)]).join('');
  for (let i = 0; i < 300; i++) {
    const largo = cad(24 + Math.floor(azar() * 20)); const n = 8 + Math.floor(azar() * 6);
    const corto = i % 3 === 0 ? largo.slice(0, n) : i % 3 === 1 ? largo.slice(-n) : largo.slice(5, 5 + n);
    for (const orden of [[corto, largo], [largo, corto]]) {
      const r = redact('x ' + largo + ' y', orden);
      for (let a = 0; a + 6 <= largo.length; a++) assert.ok(!r.includes(largo.slice(a, a + 6)), `caso ${i}: queda a la vista un trozo del secreto largo`);
    }
  }
});
