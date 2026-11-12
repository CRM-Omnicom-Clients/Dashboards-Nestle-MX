'use strict';
// "Nunca escribe ni borra conexion.txt" HECHO CODIGO: lo unico que el kit escribe en disco es su config y sus fotos, y las dos pasan por
// paths.exigirEscrituraSegura. Estas pruebas intentan lo que un --out mal puesto o una variable de entorno equivocada haria.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const P = require('../lib/paths');
const C = require('../lib/config');
const S = require('../lib/snapshot');
const { SECRETO } = require('./_utils');

const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), 'esc-'));
const rm = (d) => fs.rmSync(d, { recursive: true, force: true });
const FOTO = () => ({ formato: 1, mid: '1234567', capturado: '2026-10-02T00:00:00.000Z', roles: {}, des: {}, queries: {}, automation: null });
// Entorno inyectado: la "carpeta de credenciales" y el "home" son de mentira y no tocan el disco.
const POSIX = { env: { SFMC_CONEXION_DIR: '/cred/sfmc-mcp' }, plataforma: 'linux', home: '/home/ana', existe: () => false };
const con = (existentes) => ({ ...POSIX, existe: (p) => p in existentes, leer: (p) => existentes[p] });
const ABS = (p) => path.resolve(p);

test('exigirEscrituraSegura: deja escribir donde no hay nada (config y foto) y devuelve la ruta absoluta', () => {
  assert.equal(P.exigirEscrituraSegura('/trabajo/config/pipeline.config.json', 'config', POSIX), ABS('/trabajo/config/pipeline.config.json'));
  assert.equal(P.exigirEscrituraSegura('/trabajo/snapshot/foto.JSON', 'foto', POSIX), ABS('/trabajo/snapshot/foto.JSON'), 'la extensión no distingue mayúsculas');
});
test('exigirEscrituraSegura: deja ACTUALIZAR una config o una foto propias (idempotente), con o sin BOM', () => {
  const cfg = JSON.stringify({ version: 1, des: {}, queries: {}, automation: {} });
  assert.doesNotThrow(() => P.exigirEscrituraSegura('/t/c.json', 'config', con({ [ABS('/t/c.json')]: cfg })));
  assert.doesNotThrow(() => P.exigirEscrituraSegura('/t/c.json', 'config', con({ [ABS('/t/c.json')]: '\uFEFF' + cfg })));
  assert.doesNotThrow(() => P.exigirEscrituraSegura('/t/f.json', 'foto', con({ [ABS('/t/f.json')]: JSON.stringify(FOTO()) })));
});
test('exigirEscrituraSegura: NO escribe credenciales ni nada que no sea .json (conexion.txt, .env, .pem, .js…)', () => {
  for (const ruta of ['/cred/sfmc-mcp/conexion.txt', '/home/ana/conexion.txt', '/t/.env', '/t/clave.pem', '/t/x.secret', '/t/script.js', '/t/sin-extension']) {
    assert.throws(() => P.exigirEscrituraSegura(ruta, 'config', POSIX), P.ErrorRutaProtegida, ruta);
  }
  assert.throws(() => P.exigirEscrituraSegura('/t/conexion.json', 'config', POSIX), /nombre es el de un archivo de credenciales/);
  assert.throws(() => P.exigirEscrituraSegura('/t/.env.json', 'foto', POSIX), /archivo de credenciales/);
});
test('exigirEscrituraSegura: NO escribe dentro de la carpeta de credenciales (ni con "..") ni en ~/.claude.json', () => {
  assert.throws(() => P.exigirEscrituraSegura('/cred/sfmc-mcp/perfil.json', 'config', POSIX), /carpeta de credenciales/);
  assert.throws(() => P.exigirEscrituraSegura('/cred/sfmc-mcp/sub/x.json', 'foto', POSIX), /carpeta de credenciales/);
  assert.throws(() => P.exigirEscrituraSegura('/trabajo/../cred/sfmc-mcp/x.json', 'config', POSIX), /carpeta de credenciales/);
  assert.throws(() => P.exigirEscrituraSegura('/home/ana/.claude.json', 'config', con({ [ABS('/home/ana/.claude.json')]: '{"mcpServers":{}}' })), /config de Claude Code/);
  assert.throws(() => P.exigirEscrituraSegura('/home/ana/.claude.json', 'foto', POSIX), /config de Claude Code/, 'aunque no existiera');
  assert.doesNotThrow(() => P.exigirEscrituraSegura('/cred/otra-carpeta/x.json', 'config', POSIX), 'una carpeta hermana sí');
});
test('exigirEscrituraSegura: NO pisa un archivo que ya existe y no es de este kit (otro .json, texto, JSON de otro tipo)', () => {
  const ajeno = (txt) => con({ [ABS('/t/settings.json')]: txt });
  assert.throws(() => P.exigirEscrituraSegura('/t/settings.json', 'config', ajeno('{"theme":"dark"}')), /ya existe y no parece una config de este kit/);
  assert.throws(() => P.exigirEscrituraSegura('/t/settings.json', 'foto', ajeno('{"theme":"dark"}')), /ya existe y no parece una foto de este kit/);
  assert.throws(() => P.exigirEscrituraSegura('/t/settings.json', 'config', ajeno('esto no es json')), P.ErrorRutaProtegida);
  assert.throws(() => P.exigirEscrituraSegura('/t/settings.json', 'config', ajeno('')), P.ErrorRutaProtegida);
  assert.throws(() => P.exigirEscrituraSegura('/t/settings.json', 'config', ajeno('null')), P.ErrorRutaProtegida);
  assert.throws(() => P.exigirEscrituraSegura('/t/settings.json', 'config', ajeno(JSON.stringify(FOTO()))), /no parece una config/, 'una foto no es una config');
  assert.throws(() => P.exigirEscrituraSegura('/t/settings.json', 'foto', ajeno(JSON.stringify({ version: 1, des: {}, queries: {}, automation: {} }))), /no parece una foto/, 'una config no es una foto');
});
test('exigirEscrituraSegura: tipo desconocido es un error de programación, no un permiso', () => {
  assert.throws(() => P.exigirEscrituraSegura('/t/x.json', 'otro', POSIX), /tipo desconocido/);
});
test('exigirEscrituraSegura (Windows): la carpeta de credenciales por defecto es %LOCALAPPDATA%\\sfmc-mcp', { skip: process.platform !== 'win32' }, () => {
  const env = { LOCALAPPDATA: 'C:\\Users\\ana\\AppData\\Local' }; const o = { env, plataforma: 'win32', home: 'C:\\Users\\ana', existe: () => false };
  assert.throws(() => P.exigirEscrituraSegura('C:\\Users\\ana\\AppData\\Local\\sfmc-mcp\\x.json', 'config', o), /carpeta de credenciales/);
  assert.throws(() => P.exigirEscrituraSegura('c:\\users\\ANA\\appdata\\local\\SFMC-MCP\\x.json', 'config', o), /carpeta de credenciales/, 'Windows no distingue mayúsculas');
  assert.throws(() => P.exigirEscrituraSegura('C:\\Users\\ana\\.claude.json', 'config', o), /config de Claude Code/);
});

// ---------- integracion con los dos escritores reales, sobre el disco ----------
function conCredenciales(fn) {                       // una "carpeta de credenciales" real (temporal) con un conexion.txt real
  const d = mk(); const cred = path.join(d, 'cred'); fs.mkdirSync(cred); const txt = path.join(cred, 'conexion.txt');
  fs.writeFileSync(txt, `CLIENT_ID=abcd\nCLIENT_SECRET=${SECRETO}\n`);
  const antes = process.env.SFMC_CONEXION_DIR; process.env.SFMC_CONEXION_DIR = cred;
  try { return fn({ d, cred, txt }); } finally { if (antes === undefined) delete process.env.SFMC_CONEXION_DIR; else process.env.SFMC_CONEXION_DIR = antes; rm(d); }
}
test('guardarConfig: pedirle escribir sobre conexion.txt (o en su carpeta) falla y el archivo queda BYTE A BYTE igual', () => {
  conCredenciales(({ cred, txt }) => {
    const antes = fs.readFileSync(txt); const cfg = C.cargarEjemplo();
    assert.throws(() => C.guardarConfig(cfg, txt), P.ErrorRutaProtegida);
    assert.throws(() => C.guardarConfig(cfg, path.join(cred, 'pipeline.config.json')), /carpeta de credenciales/);
    assert.deepEqual(fs.readFileSync(txt), antes, 'conexion.txt no se tocó');
    assert.deepEqual(fs.readdirSync(cred), ['conexion.txt'], 'no apareció ningún archivo nuevo junto a las credenciales');
  });
});
test('guardarConfig: no pisa un .json ajeno, y sí crea la config nueva y la actualiza después', () => {
  const d = mk();
  try {
    const ajeno = path.join(d, 'settings.json'); fs.writeFileSync(ajeno, '{"theme":"dark"}');
    assert.throws(() => C.guardarConfig(C.cargarEjemplo(), ajeno), /no parece una config/);
    assert.equal(fs.readFileSync(ajeno, 'utf8'), '{"theme":"dark"}');
    const mia = path.join(d, 'sub', 'pipeline.config.json');
    assert.equal(C.guardarConfig(C.cargarEjemplo(), mia), mia); assert.equal(JSON.parse(fs.readFileSync(mia, 'utf8')).version, 1);
    const cfg2 = C.cargarEjemplo(); cfg2.bu.mid = '999'; assert.doesNotThrow(() => C.guardarConfig(cfg2, mia));
    assert.equal(JSON.parse(fs.readFileSync(mia, 'utf8')).bu.mid, '999', 'una config propia sí se actualiza');
  } finally { rm(d); }
});
test('guardarFoto: se niega con credenciales, con un archivo ajeno y con algo con forma de secreto; guarda y devuelve ruta y bytes', () => {
  conCredenciales(({ d, cred, txt }) => {
    const antes = fs.readFileSync(txt);
    assert.throws(() => S.guardarFoto(FOTO(), txt), P.ErrorRutaProtegida);
    assert.throws(() => S.guardarFoto(FOTO(), path.join(cred, 'foto.json')), /carpeta de credenciales/);
    assert.deepEqual(fs.readFileSync(txt), antes);
    const ajeno = path.join(d, 'package.json'); fs.writeFileSync(ajeno, '{"name":"x"}');
    assert.throws(() => S.guardarFoto(FOTO(), ajeno), /no parece una foto/); assert.equal(fs.readFileSync(ajeno, 'utf8'), '{"name":"x"}');
    const sucia = FOTO(); sucia.queries = { q: { queryText: `SELECT '${SECRETO}'` } };
    const destino = path.join(d, 'out', 'foto.json');
    assert.throws(() => S.guardarFoto(sucia, destino), /forma de secreto/); assert.equal(fs.existsSync(destino), false, 'ni siquiera creó el archivo');
    const r = S.guardarFoto(FOTO(), destino); assert.equal(r.ruta, destino); assert.equal(r.bytes, fs.statSync(destino).size);
    assert.equal(JSON.parse(fs.readFileSync(destino, 'utf8')).formato, 1);
    assert.doesNotThrow(() => S.guardarFoto(FOTO(), destino), 'una foto propia se puede volver a guardar');
  });
});

// ---------- un error de lectura NUNCA repite el contenido del archivo (podria ser el de credenciales) ----------
const { errorDeArchivoSeguro, resolverCredenciales, ErrorCredenciales } = require('../lib/credenciales');
const CONTENIDO = `CLIENT_ID=abcd1234efgh5678\nCLIENT_SECRET=${SECRETO}\n`;
const sinRastro = (texto) => { for (const trozo of ['CLIENT_SECRET', 'CLIENT_ID', 'abcd1234', SECRETO.slice(0, 12), SECRETO.slice(8, 20)]) assert.ok(!String(texto).includes(trozo), `el mensaje repite «${trozo}» del archivo`); };

test('errorDeArchivoSeguro: un SyntaxError dice solo QUE no es JSON; otros errores pasan por el redactor', () => {
  let sx; try { JSON.parse(CONTENIDO); } catch (e) { sx = e; }
  assert.equal(errorDeArchivoSeguro(sx), 'no es un JSON válido');
  assert.ok(!errorDeArchivoSeguro(new Error('falla con ' + SECRETO)).includes(SECRETO));
  assert.equal(errorDeArchivoSeguro(new Error('EACCES: permission denied')), 'EACCES: permission denied');
  assert.equal(errorDeArchivoSeguro('texto suelto'), 'texto suelto');
});
test('cargarConfig apuntada a un archivo de credenciales: falla SIN repetir su contenido', () => {
  const d = mk();
  try {
    const f = path.join(d, 'conexion.txt'); fs.writeFileSync(f, CONTENIDO);
    let err; try { C.cargarConfig({ ruta: f, exigirDescubierta: false }); } catch (e) { err = e; }
    assert.ok(err instanceof C.ErrorConfig); assert.match(err.message, /no es un JSON válido/); sinRastro(err.message);
    fs.writeFileSync(f, String.fromCharCode(0xfeff) + '{ "version": '); let err2; try { C.cargarConfig({ ruta: f, exigirDescubierta: false }); } catch (e) { err2 = e; } assert.match(err2.message, /no es un JSON válido/);
  } finally { rm(d); }
});
test('leerFotoArchivo: no existe / no es JSON (sin repetir el contenido) / foto valida con BOM', () => {
  const d = mk();
  try {
    assert.throws(() => S.leerFotoArchivo(path.join(d, 'nada.json')), /No existe la foto/);
    const f = path.join(d, 'x.json'); fs.writeFileSync(f, CONTENIDO);
    let err; try { S.leerFotoArchivo(f); } catch (e) { err = e; }
    assert.match(err.message, /No pude leer .* como foto: no es un JSON válido/); sinRastro(err.message);
    fs.writeFileSync(f, String.fromCharCode(0xfeff) + JSON.stringify(FOTO())); assert.equal(S.leerFotoArchivo(f).formato, 1);
  } finally { rm(d); }
});
test('resolverCredenciales con un ~/.claude.json roto que contiene el secret: el error no lo repite', () => {
  const roto = `{"mcpServers": {"sfmc-nestle": {"env": {"SFMC_CLIENT_ID": "abcd1234efgh5678", "SFMC_CLIENT_SECRET": "${SECRETO}"`;      // JSON truncado
  const pj = path.join('/h', 'u', '.claude.json');
  let err; try { resolverCredenciales({ env: {}, home: path.join('/h', 'u'), plataforma: 'linux', leerArchivo: () => roto, existe: (p) => p === pj }); } catch (e) { err = e; }
  assert.ok(err instanceof ErrorCredenciales); assert.match(err.message, /no se pudo leer \(no es un JSON válido\)/);
  for (const trozo of [SECRETO, SECRETO.slice(0, 14), 'abcd1234efgh5678']) assert.ok(!err.message.includes(trozo), `el mensaje repite «${trozo}»`);
});

// ---------- los scripts de verdad (proceso aparte, sin red: el destino prohibido se rechaza ANTES de conectar) ----------
const { spawnSync } = require('child_process');
const RAIZ = path.resolve(__dirname, '..');
function correrScript(script, args, { dir, extraEnv = {} }) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^SFMC_/.test(k)));
  Object.assign(env, { USERPROFILE: dir, HOME: dir, LOCALAPPDATA: dir, APPDATA: dir, XDG_CONFIG_HOME: dir }, extraEnv);
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', script), ...args], { encoding: 'utf8', env, cwd: RAIZ, timeout: 60000 });
  return { code: r.status, texto: (r.stdout || '') + (r.stderr || '') };
}
test('snapshot.js --out hacia credenciales, una carpeta de credenciales o un archivo ajeno: sale con 1 al instante, sin red, y no toca nada', () => {
  const d = mk();
  try {
    const cred = path.join(d, 'cred'); fs.mkdirSync(cred); const txt = path.join(cred, 'conexion.txt'); fs.writeFileSync(txt, CONTENIDO);
    const ajeno = path.join(d, 'ajeno.json'); fs.writeFileSync(ajeno, '{"a":1}');
    const casos = [[txt, /No escribo/], [path.join(cred, 'foto.json'), /carpeta de credenciales/], [ajeno, /no parece una foto/]];
    for (const [destino, esperado] of casos) {
      const r = correrScript('snapshot.js', ['--out', destino], { dir: d, extraEnv: { SFMC_CONEXION_DIR: cred } });
      assert.equal(r.code, 1, destino); assert.match(r.texto, esperado); sinRastro(r.texto);
    }
    assert.equal(fs.readFileSync(txt, 'utf8'), CONTENIDO, 'conexion.txt intacto'); assert.equal(fs.readFileSync(ajeno, 'utf8'), '{"a":1}');
    assert.deepEqual(fs.readdirSync(cred), ['conexion.txt']);
  } finally { rm(d); }
});
test('snapshot.js --out hacia el ~/.claude.json de quien lo corre: rechazado (con un home de mentira, sin tocar el real)', () => {
  const d = mk();
  try {
    const home = path.join(d, 'home'); fs.mkdirSync(home); const cj = path.join(home, '.claude.json'); fs.writeFileSync(cj, '{"mcpServers":{"x":1}}');
    const r = correrScript('snapshot.js', ['--out', cj], { dir: home });
    assert.equal(r.code, 1); assert.match(r.texto, /config de Claude Code/); assert.equal(fs.readFileSync(cj, 'utf8'), '{"mcpServers":{"x":1}}');
  } finally { rm(d); }
});
test('descubrir.js --out hacia la carpeta de credenciales o un archivo de credenciales: rechazado antes de listar la BU y sin repetir el contenido', () => {
  const d = mk();
  try {
    const cred = path.join(d, 'cred'); fs.mkdirSync(cred); const txt = path.join(cred, 'conexion.txt'); fs.writeFileSync(txt, CONTENIDO);
    const falsas = { SFMC_CLIENT_ID: 'abcd1234efgh5678ijkl9012', SFMC_CLIENT_SECRET: SECRETO, SFMC_SUBDOMAIN: 'mcfakeaaaaaaaaaaaaaaaaaaaaaa', SFMC_CONEXION_DIR: cred };
    const r1 = correrScript('descubrir.js', ['--out', path.join(cred, 'pipeline.config.json')], { dir: d, extraEnv: falsas });
    assert.equal(r1.code, 1); assert.match(r1.texto, /carpeta de credenciales/);
    const r2 = correrScript('descubrir.js', ['--out', txt], { dir: d, extraEnv: falsas });
    assert.equal(r2.code, 1); assert.match(r2.texto, /no es un JSON válido/); sinRastro(r2.texto);
    assert.equal(fs.readFileSync(txt, 'utf8'), CONTENIDO); assert.deepEqual(fs.readdirSync(cred), ['conexion.txt']);
  } finally { rm(d); }
});

// ---------- mas rutas peligrosas: red, el propio kit, mayusculas ----------
test('exigirEscrituraSegura: NO escribe en una ruta de RED (UNC), con barras de Windows o de Unix (una foto con filas del cliente no sale de la maquina)', () => {
  const B = String.fromCharCode(92);
  for (const r of [B + B + 'servidor' + B + 'recurso' + B + 'foto.json', '//servidor/recurso/foto.json']) assert.throws(() => P.exigirEscrituraSegura(r, 'foto', POSIX), /ruta de red/, r);
});
test('exigirEscrituraSegura: NADA se escribe dentro de la carpeta del propio kit (ni config/ ni snapshot/): lo local vive en la carpeta de estado, fuera de ella', () => {
  const raiz = path.resolve('/kit'); const o = { ...POSIX, raiz };
  for (const mal of ['lib/x.json', 'scripts/x.json', 'docs/x.json', 'tests/fixtures/arquitectura.json', 'config/pipeline.config.example.json', 'config/pipeline.config.json', 'config/otra.config.json',
    'snapshot/foto.json', 'snapshot/sub/foto.json', 'package.json', 'x.json']) assert.throws(() => P.exigirEscrituraSegura(path.join(raiz, mal), 'foto', o), /dentro de la carpeta del propio kit/, mal);
  assert.throws(() => P.exigirEscrituraSegura(path.join(raiz, 'config', 'pipeline.config.json'), 'config', o), /La config y las fotos viven en .*crm-reporte-mcp-nestle-sfmc/, 'y el mensaje dice DONDE viven');
  assert.doesNotThrow(() => P.exigirEscrituraSegura(path.resolve('/otra/lib/x.json'), 'foto', o), 'fuera del kit no aplica');
  assert.doesNotThrow(() => P.exigirEscrituraSegura(path.resolve('/kit2/lib/x.json'), 'foto', o), 'una carpeta hermana con el mismo prefijo no es el kit');
  assert.doesNotThrow(() => P.exigirEscrituraSegura(path.join(P.dirEstado(POSIX), 'pipeline.config.json'), 'config', o), 'la carpeta de estado SI se puede escribir');
  assert.doesNotThrow(() => P.exigirEscrituraSegura(path.join(P.dirFotos(POSIX), 'foto.json'), 'foto', o), 'y la de fotos tambien');
});
test('exigirEscrituraSegura: ~/.claude.json se reconoce SIN distinguir mayusculas en Windows y Mac (y distinguiendolas en Linux)', () => {
  const home = path.resolve('/home/ana'); const distinta = path.join(home, '.CLAUDE.JSON');
  assert.throws(() => P.exigirEscrituraSegura(distinta, 'config', { ...POSIX, home, plataforma: 'win32' }), /config de Claude Code/);
  assert.throws(() => P.exigirEscrituraSegura(distinta, 'config', { ...POSIX, home, plataforma: 'darwin' }), /config de Claude Code/);
  assert.doesNotThrow(() => P.exigirEscrituraSegura(distinta, 'config', { ...POSIX, home, plataforma: 'linux' }));
});

// ---------- la misma carpeta con otro nombre: enlaces, nombres cortos 8.3, nombres que empiezan con dos puntos ----------
// La guardia compara por la ruta REAL. Estas pruebas usan enlaces y nombres cortos de verdad (no simulados): antes de arreglarla, cada uno dejaba escribir dentro del kit.
const PLATAFORMA = process.platform === 'win32' ? 'win32' : 'linux';
test('exigirEscrituraSegura: un nombre que EMPIEZA con dos puntos ("..x.json", "..d/x.json") dentro del kit o de las credenciales es un hijo, no "salir": se rechaza', () => {
  const raiz = path.resolve('/kit'); const o = { ...POSIX, raiz };
  for (const mal of ['..x.json', path.join('..d', 'x.json'), path.join('lib', '..x.json'), path.join('..lib', '..x.json')]) assert.throws(() => P.exigirEscrituraSegura(path.join(raiz, mal), 'foto', o), /dentro de la carpeta del propio kit/, mal);
  assert.throws(() => P.exigirEscrituraSegura('/cred/sfmc-mcp/..x.json', 'config', POSIX), /carpeta de credenciales/);
  assert.throws(() => P.exigirEscrituraSegura(path.join(raiz, '.', '..x.json'), 'config', o), /dentro de la carpeta del propio kit/, 'con un . en medio');
  assert.doesNotThrow(() => P.exigirEscrituraSegura(path.join(raiz, '..', 'x.json'), 'foto', o), 'salir de verdad (..) sí es fuera del kit');
  assert.doesNotThrow(() => P.exigirEscrituraSegura(path.resolve('/..kit/x.json'), 'foto', o), 'una carpeta hermana cuyo nombre empieza con puntos no es el kit');
});
test('exigirEscrituraSegura: la comparación usa la ruta que devuelve el sistema (realpath), no el texto escrito (prueba sin depender del sistema operativo)', () => {
  const alias = path.resolve('/alias/kit'), raiz = path.resolve('/real/kit');
  const noExiste = () => { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; };          // un disco imaginario donde solo existe el alias: realpath y lstat coherentes entre si
  const realpath = (p) => { const a = path.resolve(p); if (a === alias || a.startsWith(alias + path.sep)) return path.join(raiz, a.slice(alias.length)); return noExiste(); };
  const o = { ...POSIX, raiz, realpath, lstat: noExiste };
  assert.throws(() => P.exigirEscrituraSegura(path.join(alias, 'x.json'), 'foto', o), /dentro de la carpeta del propio kit/);
  assert.throws(() => P.exigirEscrituraSegura(path.join(alias, 'lib', 'sub', 'x.json'), 'foto', o), /dentro de la carpeta del propio kit/);
  assert.throws(() => P.exigirEscrituraSegura(path.join(raiz, 'x.json'), 'foto', { ...o, raiz: alias }), /dentro de la carpeta del propio kit/, 'y al revés: la raíz del kit llega por el alias');
  assert.doesNotThrow(() => P.exigirEscrituraSegura(path.resolve('/alias/otra/x.json'), 'foto', { ...o, realpath: noExiste }), 'sin alias no se estorba');
  assert.throws(() => P.exigirEscrituraSegura(path.join(alias, 'x.json'), 'foto', { ...o, lstat: () => ({}), realpath: noExiste }), /enlace roto|no se puede resolver/, 'existe (lstat) pero no se resuelve (realpath): se rechaza en vez de adivinar');
});
test('rutaReal: sigue el enlace del tramo que existe y pega el resto tal cual; lo que no existe en absoluto queda igual', () => {
  const d = mk();
  try {
    const real = fs.realpathSync.native(d); const v = path.join(real, 'a'); fs.mkdirSync(v);
    assert.equal(P.rutaReal(v), v);
    assert.equal(P.rutaReal(path.join(v, 'no', 'existe', 'x.json')), path.join(v, 'no', 'existe', 'x.json'), 'el tramo inexistente se conserva');
    assert.equal(P.rutaReal(path.join(v, 'sub', '..', 'x.json')), path.join(v, 'x.json'), 'resuelve los ..');
    const raizDisco = path.parse(real).root; assert.equal(P.rutaReal(raizDisco), fs.realpathSync.native(raizDisco), 'la raíz del disco');
  } finally { rm(d); }
});
test('exigirEscrituraSegura: un ENLACE (junction/symlink) hacia el kit, hacia una carpeta de dentro, hacia las credenciales o como carpeta de estado NO esquiva la guardia; hacia un lugar inocente sí se puede', (t) => {
  const d = mk();
  try {
    const kit = path.join(d, 'kit'); fs.mkdirSync(path.join(kit, 'lib'), { recursive: true });
    const cred = path.join(d, 'cred'); fs.mkdirSync(cred); const fuera = path.join(d, 'fuera'); fs.mkdirSync(fuera);
    const enlazar = (destino, nombre) => { const l = path.join(d, nombre); fs.symlinkSync(destino, l, 'junction'); return l; };      // 'junction' no pide permisos de administrador en Windows; en Linux/Mac es un enlace simbólico normal
    let alKit, aLib, aCred, aFuera;
    try { alKit = enlazar(kit, 'al-kit'); aLib = enlazar(path.join(kit, 'lib'), 'a-lib'); aCred = enlazar(cred, 'a-cred'); aFuera = enlazar(fuera, 'a-fuera'); }
    catch (e) { t.skip('no se pudo crear un enlace en esta máquina (' + e.code + ')'); return; }
    const o = { env: { SFMC_CONEXION_DIR: cred }, plataforma: PLATAFORMA, home: path.join(d, 'home'), existe: () => false, raiz: kit };
    const kitErr = /dentro de la carpeta del propio kit/;
    assert.throws(() => P.exigirEscrituraSegura(path.join(alKit, 'x.json'), 'foto', o), kitErr, 'enlace al kit');
    assert.throws(() => P.exigirEscrituraSegura(path.join(alKit, 'lib', 'sub', 'x.json'), 'foto', o), kitErr, 'enlace al kit, carpeta que aún no existe');
    assert.throws(() => P.exigirEscrituraSegura(path.join(aLib, 'x.json'), 'foto', o), kitErr, 'enlace a lib/ del kit');
    assert.throws(() => P.exigirEscrituraSegura(path.join(aCred, 'perfil.json'), 'config', o), /carpeta de credenciales/, 'enlace a las credenciales');
    assert.throws(() => P.exigirEscrituraSegura(path.join(kit, 'x.json'), 'foto', { ...o, raiz: alKit }), kitErr, 'la raíz del kit dada por el enlace');
    assert.throws(() => P.exigirEscrituraSegura(P.rutaConfig({ env: { SFMC_PIPELINE_DIR: alKit } }), 'config', o), kitErr, 'SFMC_PIPELINE_DIR apuntando a un enlace hacia el kit');
    assert.throws(() => P.exigirEscrituraSegura(P.rutaConfig({ env: { SFMC_PIPELINE_DIR: fuera, SFMC_PIPELINE_CONFIG: path.join(alKit, 'c.json') } }), 'config', o), kitErr, 'SFMC_PIPELINE_CONFIG dentro del enlace');
    assert.doesNotThrow(() => P.exigirEscrituraSegura(path.join(aFuera, 'foto.json'), 'foto', o), 'un enlace a un lugar inocente no se estorba');
    assert.doesNotThrow(() => P.exigirEscrituraSegura(path.join(fuera, 'nueva', 'foto.json'), 'foto', o), 'ni la ruta directa');
  } finally { rm(d); }
});
test('exigirEscrituraSegura: un enlace ROTO se rechaza (escribir a través de él crearía el destino donde apunte)', (t) => {
  const d = mk();
  try {
    const kit = path.join(d, 'kit'); fs.mkdirSync(kit); const roto = path.join(d, 'roto');
    try { fs.symlinkSync(path.join(kit, 'aun-no-existe'), roto, 'junction'); } catch (e) { t.skip('no se pudo crear un enlace en esta máquina (' + e.code + ')'); return; }
    const o = { env: { SFMC_CONEXION_DIR: path.join(d, 'cred') }, plataforma: PLATAFORMA, home: path.join(d, 'home'), existe: () => false, raiz: kit };
    assert.throws(() => P.exigirEscrituraSegura(path.join(roto, 'x.json'), 'foto', o), /enlace roto|no se puede resolver/);
    assert.throws(() => P.exigirEscrituraSegura(path.join(roto, 'sub', 'x.json'), 'foto', o), /enlace roto|no se puede resolver/, 'tampoco con carpetas más adentro');
    assert.equal(fs.existsSync(path.join(kit, 'aun-no-existe')), false, 'y la guardia no creó el destino del enlace');
  } finally { rm(d); }
});
test('exigirEscrituraSegura (Windows): el nombre corto 8.3 del kit, de las credenciales o del home NO esquiva la guardia', { skip: process.platform !== 'win32' }, (t) => {
  const corto = (ruta) => {         // el nombre 8.3 de una carpeta que existe (null si el volumen no los genera)
    const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', `(New-Object -ComObject Scripting.FileSystemObject).GetFolder('${ruta.replace(/'/g, "''")}').ShortPath`], { encoding: 'utf8', timeout: 30000 });
    const s = (r.stdout || '').trim(); return s && s.toLowerCase() !== ruta.toLowerCase() ? s : null;
  };
  const d = mk();
  try {
    const base = fs.realpathSync.native(d); const kit = path.join(base, 'carpeta-con-un-nombre-muy-largo-del-kit'); const cred = path.join(base, 'credenciales-con-nombre-largo'); const home = path.join(base, 'casa-con-nombre-largo');
    for (const c of [kit, cred, home]) fs.mkdirSync(c);
    const kitCorto = corto(kit), credCorto = corto(cred), homeCorto = corto(home);
    if (!kitCorto || !credCorto || !homeCorto) { t.skip('este volumen no genera nombres cortos 8.3'); return; }
    const o = { env: { SFMC_CONEXION_DIR: cred }, plataforma: 'win32', home, raiz: kit };
    assert.throws(() => P.exigirEscrituraSegura(path.join(kitCorto, 'x.json'), 'foto', o), /dentro de la carpeta del propio kit/, 'kit por su nombre corto: ' + kitCorto);
    assert.throws(() => P.exigirEscrituraSegura(path.join(credCorto, 'perfil.json'), 'config', o), /carpeta de credenciales/, 'credenciales por su nombre corto: ' + credCorto);
    // ~/.claude.json por el nombre corto del home: el archivo es una config válida a propósito, para que SOLO la identidad de la ruta pueda rechazarlo
    fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ version: 1, des: {}, queries: {}, automation: {} }));
    assert.throws(() => P.exigirEscrituraSegura(path.join(homeCorto, '.claude.json'), 'config', o), /config de Claude Code/, '.claude.json por el nombre corto del home');
    // y al revés: la carpeta PROTEGIDA es la que llega en nombre corto (un USERPROFILE o un SFMC_CONEXION_DIR escritos así) y la ruta a escribir va en largo
    assert.throws(() => P.exigirEscrituraSegura(path.join(home, '.claude.json'), 'config', { ...o, home: homeCorto }), /config de Claude Code/, 'home dado por su nombre corto');
    assert.throws(() => P.exigirEscrituraSegura(path.join(cred, 'perfil.json'), 'config', { ...o, env: { SFMC_CONEXION_DIR: credCorto } }), /carpeta de credenciales/, 'credenciales dadas por su nombre corto');
    assert.throws(() => P.exigirEscrituraSegura(path.join(kit, 'x.json'), 'foto', { ...o, raiz: kitCorto }), /dentro de la carpeta del propio kit/, 'raíz del kit dada por su nombre corto');
    assert.doesNotThrow(() => P.exigirEscrituraSegura(path.join(base, 'afuera', 'x.json'), 'foto', o), 'control: fuera de todo se puede');
  } finally { rm(d); }
});
