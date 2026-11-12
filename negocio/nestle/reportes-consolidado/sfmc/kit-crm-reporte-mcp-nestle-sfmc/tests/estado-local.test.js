'use strict';
// El kit es una carpeta que se COPIA, se comprime, se sincroniza (OneDrive / SharePoint) y que otras herramientas del sistema crm-reporte-* barren ENTERA.
// Por eso no guarda nada local dentro de ella: la config con los IDs de la BU y las fotos (que con --con-datos traen filas del cliente) viven en una carpeta
// de estado aparte (paths.dirEstado), fuera del kit, de OneDrive y de la carpeta de credenciales.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const P = require('../lib/paths');
const Dr = require('../lib/doctor');

const RAIZ = path.resolve(__dirname, '..');
const NOMBRE = 'crm-reporte-mcp-nestle-sfmc';
const dentro = (hijo, padre) => { const r = path.relative(path.resolve(padre), path.resolve(hijo)); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('dirEstado: Windows usa %LOCALAPPDATA% (o AppData\\Local del home); Mac y Linux usan XDG_DATA_HOME (o ~/.local/share); SFMC_PIPELINE_DIR manda sobre todo', () => {
  assert.equal(P.dirEstado({ env: { LOCALAPPDATA: 'D:/Datos/Local' }, plataforma: 'win32', home: 'C:/Users/ana' }), path.join('D:/Datos/Local', NOMBRE));
  assert.equal(P.dirEstado({ env: {}, plataforma: 'win32', home: 'C:/Users/ana' }), path.join('C:/Users/ana', 'AppData', 'Local', NOMBRE));
  assert.equal(P.dirEstado({ env: { XDG_DATA_HOME: '/datos' }, plataforma: 'linux', home: '/home/ana' }), path.join('/datos', NOMBRE));
  assert.equal(P.dirEstado({ env: {}, plataforma: 'linux', home: '/home/ana' }), path.join('/home/ana', '.local', 'share', NOMBRE));
  assert.equal(P.dirEstado({ env: {}, plataforma: 'darwin', home: '/Users/ana' }), path.join('/Users/ana', '.local', 'share', NOMBRE));
  assert.equal(P.dirEstado({ env: { SFMC_PIPELINE_DIR: '/mi/estado', LOCALAPPDATA: 'X', XDG_DATA_HOME: 'Y' }, plataforma: 'win32', home: '/h' }), '/mi/estado');
});
test('rutaConfig y dirFotos cuelgan de la carpeta de estado; SFMC_PIPELINE_CONFIG manda sobre la config y SFMC_PIPELINE_DIR mueve las dos', () => {
  const o = { env: {}, plataforma: 'linux', home: '/home/ana' };
  const base = path.join('/home/ana', '.local', 'share', NOMBRE);
  assert.equal(P.rutaConfig(o), path.join(base, 'pipeline.config.json'));
  assert.equal(P.dirFotos(o), path.join(base, 'snapshot'));
  assert.equal(P.rutaConfig({ ...o, env: { SFMC_PIPELINE_CONFIG: '/otra/config.json' } }), '/otra/config.json');
  assert.equal(P.rutaConfig({ ...o, env: { SFMC_PIPELINE_DIR: '/e' } }), path.join('/e', 'pipeline.config.json'));
  assert.equal(P.dirFotos({ ...o, env: { SFMC_PIPELINE_DIR: '/e' } }), path.join('/e', 'snapshot'));
});
test('con el entorno REAL de quien corre las pruebas: ni la config ni las fotos ni la carpeta de estado caen dentro del kit, y la de estado no es la de credenciales', () => {
  for (const [que, ruta] of [['config', P.rutaConfig()], ['fotos', P.dirFotos()], ['estado', P.dirEstado()]]) assert.ok(!dentro(ruta, RAIZ), `${que} (${ruta}) cae dentro de la carpeta del kit`);
  assert.ok(!dentro(P.dirEstado(), P.dirCredenciales()) && !dentro(P.dirCredenciales(), P.dirEstado()), 'la carpeta de estado y la de credenciales deben ser distintas (en la de credenciales el kit solo LEE)');
});
test('rutaConfigEjemplo: la plantilla SI viaja con el kit (esa se lee, no se escribe)', () => {
  assert.equal(P.rutaConfigEjemplo(), path.join(RAIZ, 'config', 'pipeline.config.example.json'));
  assert.ok(fs.existsSync(P.rutaConfigEjemplo()));
});

test('restosLocalesEnElKit: encuentra una config vieja, una carpeta de fotos y archivos de credenciales; la plantilla .example no cuenta; limpia = []', () => {
  const raiz = path.resolve('/kit');
  const mundo = ({ archivos = [], listados = {} }) => ({ raiz, existe: (p) => archivos.map((a) => path.join(raiz, a)).includes(p), listar: (d) => { const k = path.relative(raiz, d).split(path.sep).join('/'); if (!(k in listados)) throw new Error('no existe'); return listados[k]; } });
  assert.deepEqual(P.restosLocalesEnElKit(mundo({ listados: { '': ['lib', 'SKILL.md'], config: ['pipeline.config.example.json'] } })), []);
  assert.deepEqual(P.restosLocalesEnElKit(mundo({ archivos: ['config/pipeline.config.json'], listados: { '': [], config: ['pipeline.config.json'] } })), ['config/pipeline.config.json']);
  assert.deepEqual(P.restosLocalesEnElKit(mundo({ archivos: ['snapshot'], listados: { '': ['snapshot'] } })), ['snapshot/']);
  assert.deepEqual(P.restosLocalesEnElKit(mundo({ listados: { '': ['conexion.txt', '.env', 'clave.pem', 'x.secret', 'README.md'], config: ['conexion.json', 'pipeline.config.example.json'] } })).sort(),
    ['.env', 'clave.pem', 'config/conexion.json', 'conexion.txt', 'x.secret'].sort());
  assert.deepEqual(P.restosLocalesEnElKit(mundo({ listados: {} })), [], 'una carpeta que no se puede listar no inventa hallazgos');
});
test('resolverFoto: una ruta que existe se respeta; un simple NOMBRE se busca en la carpeta de fotos; si no esta en ninguna parte, se devuelve lo escrito', () => {
  const o = { env: {}, plataforma: 'linux', home: '/home/ana' };
  const fotos = P.dirFotos(o);
  const existe = (...ps) => (p) => ps.includes(p);
  assert.equal(P.resolverFoto('/x/foto.json', { existe: existe('/x/foto.json'), opts: o }), '/x/foto.json');
  assert.equal(P.resolverFoto('snapshot-1.json', { existe: existe(path.join(fotos, 'snapshot-1.json')), opts: o }), path.join(fotos, 'snapshot-1.json'));
  assert.equal(P.resolverFoto('snapshot/snapshot-1.json', { existe: existe(path.join(fotos, 'snapshot-1.json')), opts: o }), path.join(fotos, 'snapshot-1.json'), 'tambien la forma vieja snapshot/<foto>');
  assert.equal(P.resolverFoto('no-esta.json', { existe: existe(), opts: o }), 'no-esta.json');
});

test('chequeoEstadoLocal (doctor): sin estado no hay chequeo; limpio = ok con la ruta; con restos = aviso que nombra los archivos y a donde moverlos', () => {
  assert.equal(Dr.chequeoEstadoLocal(null), null);
  const ok = Dr.chequeoEstadoLocal({ dir: '/estado', restos: [] });
  assert.deepEqual([ok.id, ok.estado], ['estado-local', 'ok']); assert.match(ok.detalle, /fuera de la carpeta del kit: \/estado/);
  const aviso = Dr.chequeoEstadoLocal({ dir: '/estado', restos: ['config/pipeline.config.json', 'snapshot/'] });
  assert.equal(aviso.estado, 'aviso'); assert.match(aviso.detalle, /config\/pipeline\.config\.json, snapshot\//); assert.match(aviso.detalle, /Muévelos a \/estado/);
});
test('doctor.js de punta a punta (sin credenciales, HOME de mentira): la config se busca en la carpeta de estado y el chequeo "Estado local" aparece', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'estado-'));
  try {
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^SFMC_/.test(k)));
    Object.assign(env, { USERPROFILE: d, HOME: d, LOCALAPPDATA: d, APPDATA: d, XDG_CONFIG_HOME: d, XDG_DATA_HOME: d });
    const r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'doctor.js')], { encoding: 'utf8', env, cwd: RAIZ, timeout: 60000 });
    const t = (r.stdout || '') + (r.stderr || '');
    assert.equal(r.status, 1, 'sin credenciales falla');
    assert.ok(t.includes(path.join(d, NOMBRE, 'pipeline.config.json')), 'busca la config en la carpeta de estado (no dentro del kit)');
    assert.match(t, /Estado local/, 'el chequeo aparece (ok si el kit esta limpio, aviso si quedaron restos locales dentro de su carpeta: depende de la maquina, no del codigo)');
    assert.match(t, /Credenciales/);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('doctor.js pasa el estado local a los chequeos TAMBIEN en el camino normal (con credenciales), no solo cuando faltan: sin red no se puede correr, asi que se revisa el codigo', () => {
  const t = sinComentarios(fs.readFileSync(path.join(RAIZ, 'scripts', 'doctor.js'), 'utf8'));
  assert.match(t, /ejecutarChequeos\(\{[\s\S]{0,300}?\bestadoLocal\b/, 'la llamada a ejecutarChequeos debe llevar estadoLocal');
  assert.match(t, /chequeoEstadoLocal\(estadoLocal\)/, 'y el camino sin credenciales tambien lo muestra');
});

test('NINGUN modulo ni script calcula rutas a partir de la ubicacion del kit (raizKit / __dirname): el estado local no puede volver a caer dentro de su carpeta', () => {
  const malos = [];
  for (const dir of ['lib', 'scripts']) for (const f of fs.readdirSync(path.join(RAIZ, dir)).filter((x) => x.endsWith('.js'))) {
    if (dir === 'lib' && f === 'paths.js') continue;                                           // el unico que sabe donde esta el kit (y solo para rechazar escrituras dentro y leer la plantilla)
    const t = sinComentarios(fs.readFileSync(path.join(RAIZ, dir, f), 'utf8'));
    if (/raizKit\s*\(|__dirname/.test(t)) malos.push(`${dir}/${f}`);
  }
  assert.deepEqual(malos, [], 'estos archivos resuelven rutas desde la ubicacion del kit: usa paths.dirEstado / rutaConfig / dirFotos');
});
