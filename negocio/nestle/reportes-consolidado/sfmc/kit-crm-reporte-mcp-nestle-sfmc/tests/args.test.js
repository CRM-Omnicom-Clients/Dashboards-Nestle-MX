'use strict';
// parseArgs con el texto de --help como CONTRATO: una opcion mal escrita no se ignora. Antes, `refrescar-pieza.js --dryrun` (o -n, o --simulacro) corria igual, y en ese
// script correr es EJECUTAR las queries de produccion (Piezas, Auditoria y Links son Overwrite y tardan casi una hora).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseArgs, ErrorUso, opcionesDeAyuda, sugerir } = require('../lib/cli');

const AYUDA = `x.js — algo
Uso:  node x.js --email-name "<n>" [--sin-vol] [--dry-run] [--json]
  --forzar      fuerza
  --min-edad <min>   un numero
(a--b, ---c y -d no son opciones)`;

test('opcionesDeAyuda: saca las --opciones que declara el texto (con guiones en medio) y no confunde a--b, ---c ni -d', () => {
  assert.deepEqual([...opcionesDeAyuda(AYUDA)].sort(), ['dry-run', 'email-name', 'forzar', 'json', 'min-edad', 'sin-vol']);
  assert.deepEqual([...opcionesDeAyuda('sin opciones')], []);
});

test('parseArgs con ayuda: lo declarado funciona igual que siempre (booleanas, valor separado, =valor, repetidas, posicionales, -- y alias)', () => {
  const a = parseArgs(['--dry-run', '--email-name', 'NC000817', '--min-edad=30', 'sobrante', '--forzar=false', '--json'], { booleanos: ['dry-run', 'forzar', 'json'], ayuda: AYUDA });
  assert.equal(a['dry-run'], true); assert.equal(a['email-name'], 'NC000817'); assert.equal(a['min-edad'], '30'); assert.equal(a.forzar, false); assert.equal(a.json, true); assert.deepEqual(a._, ['sobrante']);
  assert.deepEqual(parseArgs(['--email-name', 'a', '--email-name', 'b'], { ayuda: AYUDA })['email-name'], ['a', 'b'], 'repetida => arreglo');
  assert.deepEqual(parseArgs(['--', '--cualquier-cosa', '-x'], { ayuda: AYUDA })._, ['--cualquier-cosa', '-x'], 'despues de -- todo es posicional, aunque parezca opcion');
  assert.equal(parseArgs(['--n', 'a'], { alias: { n: 'email-name' }, ayuda: AYUDA })['email-name'], 'a', 'un alias declarado se acepta');
  assert.equal(parseArgs(['--help'], { ayuda: 'sin opciones' }).help, true, '--help se acepta aunque el texto no lo mencione');
  assert.deepEqual(parseArgs(['-V2', '-', 'texto'], { ayuda: AYUDA })._, ['-V2', '-', 'texto'], 'un fragmento que empieza con guion (-V2) o un guion solo siguen siendo posicionales');
});

test('parseArgs con ayuda: una opcion que el texto no declara LANZA ErrorUso — con la sugerencia, la lista de las validas y la aclaracion de que no se hizo nada', () => {
  for (const mal of [['--dryrun'], ['--dry_run'], ['--DRY-RUN'], ['--simulacro'], ['--forzr', 'x'], ['--no-existe=1'], ['--='], ['--sin-vol', '--zzz'], ['--email-name', 'a', '--email-nmae', 'b']]) {
    assert.throws(() => parseArgs(mal, { booleanos: ['dry-run'], ayuda: AYUDA }), (e) => e instanceof ErrorUso && /Opción desconocida/.test(e.message) && /Opciones de este script: --dry-run, --email-name, --forzar, --help, --json, --min-edad, --sin-vol\./.test(e.message) && /No se hizo nada/.test(e.message), JSON.stringify(mal));
  }
  assert.throws(() => parseArgs(['--dryrun'], { ayuda: AYUDA }), /¿Quisiste decir --dry-run\?/);
  assert.throws(() => parseArgs(['--forzr'], { ayuda: AYUDA }), /¿Quisiste decir --forzar\?/);
  assert.throws(() => parseArgs(['--email-nmae', 'a'], { ayuda: AYUDA }), /¿Quisiste decir --email-name\?/);
  assert.throws(() => parseArgs(['--simulacro'], { ayuda: AYUDA }), (e) => !/Quisiste decir/.test(e.message), 'si nada se parece, no inventa una sugerencia');
  assert.throws(() => parseArgs(['--x'.repeat(40)], { ayuda: AYUDA }), (e) => e.message.length < 700, 'un argumento enorme no se repite entero');
});

test('parseArgs con ayuda: una letra suelta (-n, -h, -f…) tambien se rechaza: los scripts usan dos guiones, y -n por --dry-run ejecutaba produccion', () => {
  for (const l of ['-n', '-h', '-f', '-d', '-y', 'N', '-N'].filter(x => x.startsWith('-'))) assert.throws(() => parseArgs([l], { ayuda: AYUDA }), (e) => e instanceof ErrorUso && /dos guiones|Opción desconocida/.test(e.message), l);
  assert.throws(() => parseArgs(['--dry-run', '-n'], { booleanos: ['dry-run'], ayuda: AYUDA }), ErrorUso);
});

test('sugerir: la opcion valida mas parecida, o nada si ninguna se parece', () => {
  const v = new Set(['dry-run', 'email-name', 'forzar', 'json']);
  assert.equal(sugerir('dryrun', v), 'dry-run'); assert.equal(sugerir('forzr', v), 'forzar'); assert.equal(sugerir('jsno', v), 'json'); assert.equal(sugerir('simulacro', v), null); assert.equal(sugerir('', v), null);
});

test('parseArgs SIN ayuda conserva el comportamiento de antes (compatibilidad): lo desconocido se acepta', () => {
  assert.equal(parseArgs(['--lo-que-sea'])['lo-que-sea'], true); assert.deepEqual(parseArgs(['-n'])._, ['-n']);
});

// ---------- los scripts de verdad ----------
const RAIZ = path.resolve(__dirname, '..');
const SCRIPTS = fs.readdirSync(path.join(RAIZ, 'scripts')).filter(f => f.endsWith('.js')).sort();
const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'args-'));
const ENTORNO = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(SFMC_|XDG_)/.test(k))), USERPROFILE: casa, HOME: casa, LOCALAPPDATA: casa, APPDATA: casa };
const correr = (script, args) => spawnSync(process.execPath, [path.join(RAIZ, 'scripts', script), ...args], { encoding: 'utf8', env: ENTORNO, cwd: RAIZ, timeout: 30000 });
process.on('exit', () => { try { fs.rmSync(casa, { recursive: true, force: true }); } catch (e) { /* ya no esta */ } });

test('los 9 scripts pasan su texto de ayuda a parseArgs (si uno se olvida, una opcion mal escrita volveria a ignorarse)', () => {
  assert.equal(SCRIPTS.length, 9);
  for (const s of SCRIPTS) assert.match(fs.readFileSync(path.join(RAIZ, 'scripts', s), 'utf8'), /parseArgs\(process\.argv\.slice\(2\),\s*\{[^}]*\bayuda:\s*(?:AYUDA|ayuda\(\))/, s + ' no pasa ayuda: a parseArgs');
});

test('toda opcion que un script LEE del codigo esta declarada en su --help (si no, la nueva regla la rechazaria y dejaria de funcionar)', () => {
  for (const s of SCRIPTS) {
    const ayuda = correr(s, ['--help']); assert.equal(ayuda.status, 0, s + ' --help'); const declaradas = opcionesDeAyuda(ayuda.stdout);
    const codigo = fs.readFileSync(path.join(RAIZ, 'scripts', s), 'utf8'); const leidas = new Set();
    for (const m of codigo.matchAll(/\bargs(?:\.([A-Za-z_]\w*)|\['([a-z][a-z0-9-]*)'\])/g)) leidas.add(m[1] || m[2]);
    leidas.delete('_'); leidas.delete('help');
    for (const o of leidas) assert.ok(declaradas.has(o), `${s} lee --${o} y su --help no la declara`);
  }
});

test('cada script rechaza una opcion desconocida ANTES de tocar credenciales, config o red (sin HOME, sin credenciales: el error es el de la opcion, no otro)', () => {
  for (const s of SCRIPTS) {
    const r = correr(s, ['--opcion-que-no-existe-zz']); const t = (r.stdout || '') + (r.stderr || '');
    assert.equal(r.status, 1, s); assert.match(t, /Opción desconocida "--opcion-que-no-existe-zz"/, s); assert.match(t, /No se hizo nada/, s);
    assert.ok(!/credencial|token|Credenciales|conexion\.txt|ENOENT/i.test(t.split('Opciones de este script')[0]), s + ': fallo por otra cosa antes de revisar las opciones');
  }
});

test('refrescar-pieza.js: --dryrun, --simulacro y -n NO ejecutan nada (rechazados con la sugerencia); --dry-run y --help siguen valiendo', () => {
  const a = correr('refrescar-pieza.js', ['--email-name', 'x', '--dryrun']); assert.equal(a.status, 1); assert.match(a.stderr, /Opción desconocida "--dryrun"\. ¿Quisiste decir --dry-run\?/);
  const b = correr('refrescar-pieza.js', ['--email-name', 'x', '-n']); assert.equal(b.status, 1); assert.match(b.stderr, /Opción desconocida "-n"/);
  const c = correr('refrescar-pieza.js', ['--email-name', 'x', '--simulacro']); assert.equal(c.status, 1); assert.match(c.stderr, /Opción desconocida "--simulacro"/);
  const d = correr('refrescar-pieza.js', ['--dry-run', '--help']); assert.equal(d.status, 0); assert.match(d.stdout, /refrescar-pieza\.js/);
});
