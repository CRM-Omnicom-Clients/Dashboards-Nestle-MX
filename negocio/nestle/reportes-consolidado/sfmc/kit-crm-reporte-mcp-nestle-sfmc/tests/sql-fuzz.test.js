'use strict';
// FUZZ del SQL que el kit arma con texto AJENO (nombres de envio de _Job, nombres de DE de los journeys, nombres de columna): comillas, corchetes, comodines de LIKE,
// marcas de comentario, saltos de linea, controles, invisibles. Cada comprobacion usa un ORACULO ESCRITO APARTE (otro lexer de T-SQL, otro LIKE, otro quita-comentarios):
// si el kit y el oraculo coinciden sobre miles de nombres hostiles, el texto no puede salirse de su literal ni cambiar la FORMA de la consulta. Semilla fija: se repite igual.
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../lib/agregar');
const R = require('../lib/resolver');
const D = require('../lib/de');
const AUD = require('../lib/audiencias');

let estado = 20261002; const azar = () => { estado = (estado * 1664525 + 1013904223) >>> 0; return estado / 4294967296; };
const ent = (a, b) => a + Math.floor(azar() * (b - a + 1)); const elige = (arr) => arr[Math.floor(azar() * arr.length)];
const ch = (n) => String.fromCharCode(n);
const PIEZAS = ["'", "''", "'''", '"', '`', '\\', '%', '_', '[', ']', '[[', ']]', '[]', '^', '-', '--', '/*', '*/', ';', ' ', '\n', '\r\n', '\t', '(', ')', '=', '<', '>', '&', '$', '@', '#', ':',
  "'; DROP TABLE x; --", "' OR 1=1 --", "' UNION SELECT 1 --", 'Nescafé', 'ñ', String.fromCodePoint(0x1F600), ch(0x2019), ch(0x02BC), ch(0xFF07), ch(0x200B), ch(0x202E), ch(0xFEFF), ch(0), ch(7), 'NC000817', 'a', 'Z', '9'];
const hostil = (max) => { let t = ''; const n = ent(0, max); for (let i = 0; i < n; i++) t += elige(PIEZAS); return t; };
const J = (s) => JSON.stringify(s).slice(0, 100);

// ---------- ORACULO 1: un lexer de T-SQL escrito aparte (cadenas, [identificadores], comentarios, palabras) ----------
function lexTsql(sql) {
  const out = []; let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'") { let v = '', j = i + 1, ok = false; for (; j < sql.length; j++) { if (sql[j] === "'") { if (sql[j + 1] === "'") { v += "'"; j++; } else { ok = true; break; } } else v += sql[j]; } if (!ok) return null; out.push({ t: 'str', v }); i = j + 1; }
    else if (c === '[') { let v = '', j = i + 1, ok = false; for (; j < sql.length; j++) { if (sql[j] === ']') { if (sql[j + 1] === ']') { v += ']'; j++; } else { ok = true; break; } } else v += sql[j]; } if (!ok) return null; out.push({ t: 'id', v }); i = j + 1; }
    else if (c === '-' && sql[i + 1] === '-') { let j = i; while (j < sql.length && sql[j] !== '\n') j++; out.push({ t: 'com', v: sql.slice(i, j) }); i = j; }
    else if (c === '/' && sql[i + 1] === '*') { const j = sql.indexOf('*/', i + 2); const f = j < 0 ? sql.length : j + 2; out.push({ t: 'com', v: sql.slice(i, f) }); i = f; }
    else if (/\s/.test(c)) { let j = i; while (j < sql.length && /\s/.test(sql[j])) j++; i = j; }
    else if (/[A-Za-z_@#]/.test(c)) { let j = i; while (j < sql.length && /[A-Za-z0-9_@#$]/.test(sql[j])) j++; out.push({ t: 'w', v: sql.slice(i, j).toUpperCase() }); i = j; }
    else if (/[0-9]/.test(c)) { let j = i; while (j < sql.length && /[0-9.]/.test(sql[j])) j++; out.push({ t: 'n', v: sql.slice(i, j) }); i = j; }
    else { out.push({ t: 'sym', v: c }); i++; }
  }
  return out;
}
const forma = (toks) => toks.map(t => t.t + (t.t === 'w' || t.t === 'sym' || t.t === 'n' ? ':' + t.v : '')).join(' ');

test('fuzz: el nombre de envio hostil queda en UN solo literal, con su valor EXACTO, y no cambia la forma de la consulta de _Job (agregar.construirSondeoSql)', () => {
  const base = forma(lexTsql(A.construirSondeoSql('NC000817')));
  for (let i = 0; i < 1500; i++) {
    const nombre = hostil(12); const t = lexTsql(A.construirSondeoSql(nombre));
    assert.ok(t, 'el literal no cierra con ' + J(nombre));
    const lits = t.filter(x => x.t === 'str'); assert.equal(lits.length, 1, 'mas de un literal con ' + J(nombre)); assert.equal(lits[0].v, nombre);
    assert.equal(forma(t), base, 'la FORMA cambio con ' + J(nombre));
  }
});

// ---------- ORACULO 2: un LIKE de T-SQL escrito aparte (sin ESCAPE: % cualquier cosa, _ un caracter, [abc] [a-c] [^abc], el resto literal) ----------
function likeCasa(patron, texto) {
  const toks = [];
  for (let i = 0; i < patron.length; i++) {
    const c = patron[i];
    if (c === '%') toks.push({ k: 'any' }); else if (c === '_') toks.push({ k: 'one' });
    else if (c === '[') { const j = patron.indexOf(']', i + 2); if (j < 0) toks.push({ k: 'lit', c }); else { let set = patron.slice(i + 1, j), neg = false; if (set[0] === '^') { neg = true; set = set.slice(1); } toks.push({ k: 'set', set, neg }); i = j; } }
    else toks.push({ k: 'lit', c });
  }
  const m = (ti, si) => {
    if (ti === toks.length) return si === texto.length; const t = toks[ti];
    if (t.k === 'any') { for (let k = si; k <= texto.length; k++) if (m(ti + 1, k)) return true; return false; }
    if (si >= texto.length) return false;
    if (t.k === 'one') return m(ti + 1, si + 1);
    if (t.k === 'lit') return texto[si] === t.c && m(ti + 1, si + 1);
    let dentro = false; const s = t.set; for (let q = 0; q < s.length; q++) { if (s[q + 1] === '-' && q + 2 < s.length) { if (texto[si] >= s[q] && texto[si] <= s[q + 2]) dentro = true; q += 2; } else if (s[q] === texto[si]) dentro = true; }
    return (t.neg ? !dentro : dentro) && m(ti + 1, si + 1);
  };
  return m(0, 0);
}
test('fuzz: un fragmento de busqueda NUNCA es un patron — un LIKE implementado aparte casa EXACTAMENTE lo que contiene el fragmento (resolver.construirSql)', () => {
  for (let i = 0; i < 1000; i++) {
    const frag = (hostil(6) + 'ab').slice(0, 14);
    const t = lexTsql(R.construirSql([frag])); assert.ok(t, 'SQL mal formado con ' + J(frag));
    const lits = t.filter(x => x.t === 'str'); assert.equal(lits.length, 1, 'se esperaba UN literal con ' + J(frag));
    const patron = lits[0].v;
    for (const texto of [frag, 'x' + frag + 'y', 'zz' + frag, frag + 'zz']) assert.ok(likeCasa(patron, texto), `el patron ${J(patron)} no casa un texto que contiene ${J(frag)}`);
    for (const texto of [frag.slice(0, -1), frag.replace(/./u, 'Q'), frag.length > 1 ? frag.slice(1) : 'QQ'].filter(x => !x.includes(frag))) assert.ok(!likeCasa(patron, texto), `el patron ${J(patron)} casa ${J(texto)}, que NO contiene ${J(frag)}: se comporta como patron`);
  }
});

test('fuzz: nombres de DE hostiles en el SQL de Vol (audiencias.generarSqlVol) — literal e identificador EXACTOS, misma forma, y extraerDesDelSql los devuelve idénticos', () => {
  const arma = (nombresDe) => AUD.generarSqlVol({ nombreVol: 'CRM_Audiencias_Vol_Load', nombreDeAud: 'CRM_Audiencias', pk: 'ConfigKey', nombresDe, fecha: '2026-10-02' });
  const base = forma(lexTsql(arma(['DE_uno', 'DE_dos'])));
  for (let i = 0; i < 1500; i++) {
    const n1 = hostil(10) + 'x', n2 = hostil(10) + 'y'; const sql = arma([n1, n2]); const t = lexTsql(sql);
    assert.ok(t, 'el SQL no se puede leer con ' + J([n1, n2]));
    const strs = t.filter(x => x.t === 'str').map(x => x.v), ids = t.filter(x => x.t === 'id').map(x => x.v);
    assert.deepEqual(strs.slice(0, 2), [n1, n2]); assert.ok(ids.includes(n1) && ids.includes(n2), 'un identificador [..] no es el nombre ' + J([n1, n2]));
    assert.equal(forma(t), base, 'la FORMA cambio con ' + J([n1, n2]));
    assert.deepEqual(AUD.extraerDesDelSql(sql), [n1, n2], 'extraerDesDelSql no devuelve lo mismo con ' + J([n1, n2]));
  }
});

test('fuzz: un nombre de columna hostil en el envoltorio con centinela (de.construirSqlCentinela) sigue siendo UN identificador [..] y la forma no cambia', () => {
  const base = forma(lexTsql(D.construirSqlCentinela('SELECT 1 AS [x]', ['c1', 'otra'])));
  let probados = 0;
  for (let i = 0; i < 1500; i++) {
    const col = hostil(8) + 'c'; if (col.startsWith('_') || col === 'ClaveTmp') continue; probados++;
    const t = lexTsql(D.construirSqlCentinela('SELECT 1 AS [x]', [col, 'otra'])); assert.ok(t, 'mal formado con ' + J(col));
    const ids = t.filter(x => x.t === 'id').map(x => x.v);          // orden: q.[col] AS [col], q.[otra] AS [otra], ...
    assert.deepEqual(ids.slice(0, 4), [col, col, 'otra', 'otra'], 'la columna no sobrevivio como identificador: ' + J(col));
    assert.equal(forma(t), base, 'la FORMA cambio con la columna ' + J(col));
  }
  assert.ok(probados > 1000);
});

// ---------- ORACULO 3: otro quita-comentarios, con regex, que debe coincidir con el del kit sobre cualquier mezcla de comillas, corchetes y marcas ----------
const quitarConRegex = (sql) => String(sql).replace(/'(?:[^']|'')*(?:'|$)|\[(?:[^\]]|\]\])*(?:\]|$)|--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|[\s\S]/g, (m) => (m.startsWith('--') || m.startsWith('/*') ? ' ' : m));
test('fuzz: quitarComentariosSql coincide con una implementacion distinta (regex) sobre 3000 mezclas de comillas, corchetes y marcas de comentario, y es idempotente', () => {
  for (let i = 0; i < 3000; i++) {
    let s = ''; const n = ent(0, 25); for (let j = 0; j < n; j++) s += elige(["'", "''", '[', ']', ']]', '--', '/*', '*/', '\n', ' ', 'a', 'SELECT ', '-', '/', '*', '"', 'x', 'é']);
    const a = D.quitarComentariosSql(s); assert.equal(a, quitarConRegex(s), 'difieren sobre ' + J(s));
    if (!/--|\/\*/.test(a)) assert.equal(D.quitarComentariosSql(a), a, 'no es idempotente sobre ' + J(s));
  }
});
