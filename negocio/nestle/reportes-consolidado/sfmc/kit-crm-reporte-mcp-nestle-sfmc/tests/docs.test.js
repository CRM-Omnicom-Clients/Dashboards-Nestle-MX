'use strict';
// LINT DE LAS GUIAS: que lo que dicen SKILL.md y docs/ siga siendo verdad. Una guia que miente es peor que no tener guia:
// cada prueba de aqui atrapa una forma real de que se desactualice (un script que cambia de flag, un doc huerfano, una tabla rota,
// un permiso inventado, una ruta con el usuario de alguien). Sin red: los --help se piden con HOME vacio y sin credenciales.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { redact } = require('../lib/credenciales');
const { REQUERIDOS, OPCIONALES } = require('../lib/scopes');
const { MINUTOS_PREVIOS_A_LA_AUTOMATION } = require('../lib/refresco');

const RAIZ = path.resolve(__dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const DOCS = fs.readdirSync(path.join(RAIZ, 'docs')).filter(f => f.endsWith('.md')).sort();
const ARCHIVOS = ['SKILL.md', 'LEEME.md', ...DOCS.map(f => 'docs/' + f)];
const TEXTO = Object.fromEntries(ARCHIVOS.map(f => [f, leer(f)]));
const SCRIPTS = fs.readdirSync(path.join(RAIZ, 'scripts')).filter(f => f.endsWith('.js')).map(f => f.replace(/\.js$/, '')).sort();
const sinBloques = (md) => md.replace(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm, '');

// ---------- funciones puras (con sus propias pruebas abajo) ----------
/** [{ linea, script, flags }]: cada `node scripts/X.js` y los --flags que le siguen en esa linea (hasta el siguiente comando). */
function comandosDe(md) {
  const out = [];
  md.split('\n').forEach((l, i) => {
    const hits = [...l.matchAll(/node\s+scripts\/([a-z0-9-]+)\.js/g)];
    hits.forEach((h, k) => {
      const seg = l.slice(h.index + h[0].length, k + 1 < hits.length ? hits[k + 1].index : l.length);
      out.push({ linea: i + 1, script: h[1], flags: [...seg.matchAll(/(?<![\w-])(--[a-z][a-z0-9-]*)/g)].map(m => m[1]) });
    });
  });
  return out;
}
/** Problemas de las tablas markdown: filas con otro numero de separadores que el encabezado (un "|" sin escapar dentro de una celda) o sin fila de separacion. */
function tablasMalFormadas(md) {
  const L = md.split('\n'); const problemas = []; let dentro = false;
  const barras = (s) => s.replace(/\\\|/g, '').split('|').length - 1;
  for (let i = 0; i < L.length; i++) {
    if (/^```/.test(L[i])) { dentro = !dentro; continue; }
    if (dentro || !L[i].startsWith('|')) continue;
    let j = i; while (j < L.length && L[j].startsWith('|')) j++;
    const filas = L.slice(i, j); const n = barras(filas[0]);
    if (!/^\|[\s:|-]+\|?\s*$/.test(filas[1] || '')) problemas.push(`línea ${i + 2}: falta la fila de separación de la tabla`);
    filas.forEach((f, k) => { if (barras(f) !== n) problemas.push(`línea ${i + k + 1}: ${barras(f)} separadores "|" y el encabezado tiene ${n} (¿un "|" sin escapar dentro de una celda? usa "\\|")`); });
    i = j - 1;
  }
  return problemas;
}
/** Menciones de otro doc: `NOMBRE.md` o `docs/NOMBRE.md` entre comillas invertidas. */
const mencionesDeDocs = (md) => [...md.matchAll(/`((?:docs\/)?[A-Z][A-Z0-9_-]*\.md)`/g)].map(m => m[1]);

test('comandosDe: asocia cada flag con SU comando aunque haya dos en la misma linea, y no confunde flags de node', () => {
  const md = '| a | `node scripts/audiencias.js --email-name "x"` o `--pendientes` → `--escribir` |\n`node scripts/doctor.js` (`--latencia`) · `node scripts/snapshot.js --comparar <f>`\nnode --test y --otra-cosa';
  assert.deepEqual(comandosDe(md), [{ linea: 1, script: 'audiencias', flags: ['--email-name', '--pendientes', '--escribir'] }, { linea: 2, script: 'doctor', flags: ['--latencia'] }, { linea: 2, script: 'snapshot', flags: ['--comparar'] }]);
});
test('tablasMalFormadas: detecta el "|" sin escapar dentro de una celda y la tabla sin separador; acepta el "\\|" y lo que esta en bloques de codigo', () => {
  const bien = '| a | b |\n|---|---:|\n| `x\\|y` | 2 |\n';
  assert.deepEqual(tablasMalFormadas(bien), []);
  const mal = '| a | b |\n|---|---|\n| `x|y` | 2 |\n';
  assert.match(tablasMalFormadas(mal)[0], /línea 3: 4 separadores "\|" y el encabezado tiene 3/);
  assert.match(tablasMalFormadas('| a | b |\n| 1 | 2 |\n')[0], /falta la fila de separación/);
  assert.deepEqual(tablasMalFormadas('```\n| a | b |\n| 1 |\n```\n'), [], 'dentro de un bloque de código no cuenta');
});
test('mencionesDeDocs y sinBloques', () => {
  assert.deepEqual(mencionesDeDocs('ver `CONEXION.md` y `docs/PROCESOS.md`, no `README`, no `foo.md`'), ['CONEXION.md', 'docs/PROCESOS.md']);
  assert.equal(sinBloques('a\n```bash\nnode x\n```\nb'), 'a\n\nb');
});

// ---------- las guias reales ----------
test('SKILL.md: frontmatter válido (name y description útil, dentro del límite) y se mantiene corto', () => {
  const t = TEXTO['SKILL.md']; const m = /^---\n([\s\S]*?)\n---\n/.exec(t);
  assert.ok(m, 'SKILL.md debe empezar con un bloque frontmatter --- … ---');
  assert.match(m[1], /^name: crm-reporte-mcp-nestle-sfmc$/m);
  const d = /^description: (.+)$/m.exec(m[1]);
  assert.ok(d, 'falta description'); assert.ok(d[1].length >= 150, `description muy corta (${d[1].length})`); assert.ok(d[1].length <= 1024, `description demasiado larga (${d[1].length} > 1024): el sistema de skills la recorta`);
  assert.ok(t.split('\n').length <= 120, `SKILL.md mide ${t.split('\n').length} líneas: el detalle va en docs/`);
});
test('cada doc de docs/ se nombra en SKILL.md, y cada doc que SKILL.md nombra existe', () => {
  const skill = TEXTO['SKILL.md'];
  for (const f of DOCS) assert.ok(skill.includes(f.replace(/\.md$/, '')), `docs/${f} no se menciona en SKILL.md (guía huérfana)`);
  for (const m of skill.matchAll(/docs\/([A-Z0-9-]+)\.md/g)) assert.ok(DOCS.includes(m[1] + '.md'), `SKILL.md cita docs/${m[1]}.md y no existe`);
  const mapa = /^docs\/\s+(.+)$/m.exec(skill); assert.ok(mapa, 'falta la línea "docs/" del Mapa del kit');
  for (const n of mapa[1].split('·').map(s => s.trim()).filter(Boolean)) assert.ok(DOCS.includes(n + '.md'), `el Mapa del kit lista ${n} y no existe docs/${n}.md`);
});
test('los enlaces markdown relativos y las menciones `NOMBRE.md` de todas las guías resuelven a un archivo que existe', () => {
  for (const f of ARCHIVOS) {
    const dir = path.dirname(path.join(RAIZ, f));
    for (const m of sinBloques(TEXTO[f]).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const dest = m[1]; if (/^(https?:|mailto:|#)/.test(dest)) continue;
      assert.ok(fs.existsSync(path.resolve(dir, dest.split('#')[0])), `${f}: el enlace "${dest}" no apunta a un archivo que exista`);
    }
    for (const nombre of mencionesDeDocs(TEXTO[f])) {
      const candidatos = [path.join(RAIZ, nombre), path.join(RAIZ, 'docs', nombre)];
      assert.ok(candidatos.some(c => fs.existsSync(c)), `${f}: menciona \`${nombre}\` y no existe`);
    }
  }
});
test('cada script del kit está documentado en SKILL.md', () => {
  for (const s of SCRIPTS) assert.ok(TEXTO['SKILL.md'].includes(s), `scripts/${s}.js no aparece en SKILL.md`);
});

// Un --help por script (una sola vez), con HOME vacio y sin credenciales: tambien prueba que el --help NO necesita conexion.
const AYUDAS = {};
function ayudaDe(script) {
  if (AYUDAS[script]) return AYUDAS[script];
  const vacio = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-help-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^SFMC_/.test(k)));
  Object.assign(env, { USERPROFILE: vacio, HOME: vacio, LOCALAPPDATA: vacio, APPDATA: vacio, XDG_CONFIG_HOME: vacio, SFMC_PIPELINE_CONFIG: path.join(vacio, 'no-existe.json') });
  try {
    const r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', script + '.js'), '--help'], { encoding: 'utf8', env, cwd: RAIZ, timeout: 30000 });
    return (AYUDAS[script] = { status: r.status, texto: (r.stdout || '') + (r.stderr || '') });
  } finally { fs.rmSync(vacio, { recursive: true, force: true }); }
}
test('cada script imprime su --help con exit 0 aunque no haya credenciales ni config (lo que ve quien instala)', () => {
  for (const s of SCRIPTS) { const a = ayudaDe(s); assert.equal(a.status, 0, `${s}.js --help salió con ${a.status}: ${a.texto.slice(0, 200)}`); assert.ok(a.texto.length > 100, `${s}.js --help casi no dice nada`); }
});
test('los comandos `node scripts/X.js` de las guías existen, y cada --flag que se les atribuye aparece en el --help de ese script', () => {
  let revisados = 0;
  for (const f of ARCHIVOS) {
    for (const c of comandosDe(TEXTO[f])) {
      assert.ok(SCRIPTS.includes(c.script), `${f}:${c.linea}: cita scripts/${c.script}.js y no existe`);
      const ayuda = ayudaDe(c.script).texto;
      for (const flag of c.flags) { revisados++; assert.ok(new RegExp('(?<![\\w-])' + flag + '(?![\\w-])').test(ayuda), `${f}:${c.linea}: ${c.script}.js no tiene ${flag} en su --help (¿la guía se desactualizó?)`); }
    }
  }
  assert.ok(revisados >= 25, `solo se revisaron ${revisados} flags: ¿cambió el formato de las guías?`);
});

test('las tablas markdown de todas las guías están bien formadas', () => {
  for (const f of ARCHIVOS) assert.deepEqual(tablasMalFormadas(TEXTO[f]), [], `${f} tiene una tabla rota`);
});
test('los bloques de código de todas las guías están balanceados', () => {
  for (const f of ARCHIVOS) assert.equal(TEXTO[f].split('\n').filter(l => /^```/.test(l)).length % 2, 0, `${f}: hay un bloque de código sin cerrar`);
});
test('sin secretos: el redactor no cambia ni una letra de ninguna guía', () => {
  for (const f of ARCHIVOS) assert.equal(redact(TEXTO[f]), TEXTO[f], `${f} contiene algo con forma de secreto o de token`);
});

test('lo que las guías citan del código coincide con el código: 20 min de la automation, permisos del package, prefijo temporal, nombres de los objetos', () => {
  const N = MINUTOS_PREVIOS_A_LA_AUTOMATION;
  assert.match(TEXTO['SKILL.md'], new RegExp(`${N} min previos`), `SKILL.md debe decir "${N} min previos" (lib/refresco.js: MINUTOS_PREVIOS_A_LA_AUTOMATION)`);
  assert.match(TEXTO['docs/PROCESOS.md'], new RegExp(`< ${N} min`), `PROCESOS.md debe decir "< ${N} min"`);
  const conexion = TEXTO['docs/CONEXION.md'];
  const citados = new Set([...conexion.matchAll(/`([a-z_]+_(?:read|write|execute))`/g)].map(m => m[1]));
  const reales = new Set([...REQUERIDOS, ...Object.keys(OPCIONALES)]);
  assert.deepEqual([...citados].sort(), [...reales].sort(), 'CONEXION.md debe listar EXACTAMENTE los permisos de lib/scopes.js (ni uno inventado ni uno faltante)');
  const ejemplo = JSON.parse(leer('config/pipeline.config.example.json'));
  assert.ok(TEXTO['docs/SEGURIDAD.md'].includes(ejemplo.prefijoTemporales), 'SEGURIDAD.md debe nombrar el prefijo temporal de la config de ejemplo');
  const nombres = [...Object.values(ejemplo.des).map(o => o.nombre), ...Object.values(ejemplo.queries).map(o => o.nombre), ejemplo.automation.nombre];
  for (const n of nombres) assert.ok(TEXTO['docs/ARQUITECTURA.md'].includes(n), `ARQUITECTURA.md no menciona ${n} (¿cambió el nombre en la config?)`);
});
test('INSTALAR.md lleva los pasos en el orden que funciona: conectar → descubrir → doctor', () => {
  const t = TEXTO['docs/INSTALAR.md'];
  const i = ['scripts/conectar.js', 'scripts/descubrir.js', 'scripts/doctor.js'].map(s => t.indexOf(s));
  assert.ok(i.every(x => x >= 0) && i[0] < i[1] && i[1] < i[2], `orden de los pasos: ${JSON.stringify(i)}`);
});

test('portabilidad: ninguna guía, script, módulo ni config lleva una ruta de la máquina o el usuario de alguien', () => {
  const rutas = [];
  const agregar = (dir, ext) => { for (const f of fs.readdirSync(path.join(RAIZ, dir))) if (ext.test(f)) rutas.push(path.join(dir, f)); };
  agregar('lib', /\.js$/); agregar('scripts', /\.js$/); agregar('config', /\.json$/); agregar('docs', /\.md$/); rutas.push('SKILL.md', 'LEEME.md', 'package.json');
  const MALOS = [[/[A-Za-z]:\\Users\\[A-Za-z0-9._+-]+/, 'ruta de Windows con usuario'], [/\/Users\/[A-Za-z][\w.-]*\//, 'ruta de Mac con usuario'], [/\/home\/[a-z][\w.-]*\//, 'ruta de Linux con usuario'],
    [/OneDrive - [A-Za-z]/, 'carpeta de OneDrive corporativo'], [/Interpublic|oneds\+|Ricardo\.Aguilar/, 'identidad de una cuenta']];
  for (const r of rutas) { const t = leer(r.replace(/\\/g, '/')); for (const [rx, que] of MALOS) { const m = rx.exec(t); assert.ok(!m, `${r}: ${que} («${m && m[0]}»)`); } }
});
