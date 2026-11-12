'use strict';
// Texto de SFMC que se imprime o se pega en un comando (lib/textoseguro.js). Un EmailName / asunto / nombre de journey lo escribe cualquiera con acceso a la BU.
// Los caracteres hostiles se arman con fromCodePoint (NUNCA como texto "backslash-u" en este archivo: en el pasado un escape asi termino convertido en el caracter real).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');
const T = require('../lib/textoseguro');
const R = require('../lib/resolver');
const A = require('../lib/agregar');

const cp = (...n) => String.fromCodePoint(...n);
const BS = String.fromCharCode(92);
const esc = (hexa) => BS + 'u' + hexa;                                   // la forma visible \uXXXX
const ESC = cp(27), BEL = cp(7), RLO = cp(0x202e), ZWSP = cp(0x200b), NBSP = cp(0xa0), TAGS = cp(0xe0041, 0xe0042);

// ORACULOS independientes del modulo (propiedades Unicode, no su regex): lo que una persona no ve o la terminal interpreta.
const RARO = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cn}\p{Cs}]|(?! )\p{Zs}/u;
const RARO_EN_JSON = /(?!\n)\p{Cc}|[\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cn}\p{Cs}]|(?! )\p{Zs}/u;             // en un JSON el salto de linea de la sangria es estructura

const HOSTILES = {
  esc: 'x' + ESC + '[2J' + ESC + ']0;PWNED' + BEL + 'y',
  saltos: 'a\nb\r\nc\td',
  bidi: 'harmless' + RLO + 'gnp.exe',
  cero: 'a' + ZWSP + 'b',
  nbsp: 'a' + NBSP + 'b',
  tags: 'ok' + TAGS,
  ls_ps: 'a' + cp(0x2028) + 'b' + cp(0x2029) + 'c',
  c1_del: 'a' + cp(0x85) + 'b' + cp(0x7f) + 'c',
  suelto: 'a' + cp(0xd800) + 'b',
};
const LIMPIOS = ['NC001234_MAGGI_Mundial_E-P1', 'Maggi Café É Ñ ü 100.0', cp(0x26a0, 0xfe0f) + ' alerta ' + cp(0x1f600), 'a;b&c|d<e>f(g)h{i}j[k]l*m?n~o#p^q\'r'];

// ---------- sinBom ----------
test('sinBom: quita UN BOM del principio (el que dejan Notepad y PowerShell), no los del medio ni del final, y tolera lo que no es texto', () => {
  const BOM = cp(0xfeff);
  assert.equal(T.sinBom(BOM + 'x'), 'x');
  assert.equal(T.sinBom('x' + BOM), 'x' + BOM);
  assert.equal(T.sinBom(BOM + BOM + 'x'), BOM + 'x', 'solo uno: como el regex que reemplazo');
  assert.equal(T.sinBom('x'), 'x'); assert.equal(T.sinBom(''), ''); assert.equal(T.sinBom(null), ''); assert.equal(T.sinBom(undefined), '');
});

// ---------- paraMostrar ----------
test('paraMostrar: lo normal NO cambia (letras, acentos, emojis con su selector, signos, espacio)', () => {
  for (const s of LIMPIOS) assert.equal(T.paraMostrar(s), s);
  assert.equal(T.paraMostrar(null), ''); assert.equal(T.paraMostrar(undefined), ''); assert.equal(T.paraMostrar(42), '42');
});
test('paraMostrar: ESC, BEL, saltos de linea, bidi, ancho cero, NBSP, tag characters y surrogates sueltos se vuelven texto VISIBLE', () => {
  assert.equal(T.paraMostrar(HOSTILES.esc), 'x' + esc('001b') + '[2J' + esc('001b') + ']0;PWNED' + esc('0007') + 'y');
  assert.equal(T.paraMostrar(HOSTILES.saltos), 'a' + BS + 'nb' + BS + 'r' + BS + 'nc' + BS + 'td', 'un nombre con saltos NO puede falsificar otras lineas');
  assert.equal(T.paraMostrar(HOSTILES.bidi), 'harmless' + esc('202e') + 'gnp.exe');
  assert.equal(T.paraMostrar(HOSTILES.cero), 'a' + esc('200b') + 'b');
  assert.equal(T.paraMostrar(HOSTILES.nbsp), 'a' + esc('00a0') + 'b', 'el NBSP parece un espacio y NO casa con el nombre real: tiene que verse');
  assert.equal(T.paraMostrar(HOSTILES.tags), 'ok' + BS + 'u{e0041}' + BS + 'u{e0042}');
  assert.equal(T.paraMostrar(HOSTILES.ls_ps), 'a' + esc('2028') + 'b' + esc('2029') + 'c');
  assert.equal(T.paraMostrar(HOSTILES.c1_del), 'a' + esc('0085') + 'b' + esc('007f') + 'c');
  assert.equal(T.paraMostrar(HOSTILES.suelto), 'a' + esc('d800') + 'b');
  assert.equal(T.paraMostrar('a' + cp(0xe0100) + 'b'), 'a' + BS + 'u{e0100}b', 'los selectores de variacion suplementarios tambien esconden datos: se ven');
  assert.equal(T.jsonSeguro({ s: cp(0xe0100) }), '{\n  "s": "' + esc('db40') + esc('dd00') + '"\n}', 'y en JSON salen como par de surrogates');
});
test('paraMostrar: es idempotente (pasarlo dos veces da lo mismo) y deja un solo renglon', () => {
  for (const s of Object.values(HOSTILES)) { const una = T.paraMostrar(s); assert.equal(T.paraMostrar(una), una); assert.ok(!una.includes('\n')); }
});
test('paraMostrar y jsonSeguro, punto de codigo por punto de codigo: nada invisible sobrevive y nada visible se toca (BMP completo + tags, uso privado y emojis)', () => {
  const puntos = [];
  for (let n = 0; n <= 0xffff; n++) puntos.push(n);
  for (let n = 0xe0000; n <= 0xe0fff; n++) puntos.push(n);                                // tags y selectores de variacion suplementarios
  for (let n = 0x1f000; n <= 0x1faff; n++) puntos.push(n);                                // emojis
  for (const base of [0xf0000, 0x10ff00]) for (let n = base; n <= base + 0xff; n++) puntos.push(n);   // uso privado (planos 15 y 16)
  const malMostrar = [], malJson = [], sobreEscapa = [];
  for (const n of puntos) {
    const ch = n >= 0xd800 && n <= 0xdfff ? String.fromCharCode(n) : String.fromCodePoint(n);
    const m = T.paraMostrar(ch);
    if (RARO.test(m)) malMostrar.push(n.toString(16));
    const suplementario = n >= 0xe0100 && n <= 0xe01ef;
    if (!RARO.test(ch) && !suplementario && m !== ch) sobreEscapa.push(n.toString(16));
    const j = T.jsonSeguro({ s: ch });
    if (RARO_EN_JSON.test(j) || JSON.parse(j).s !== ch) malJson.push(n.toString(16));
  }
  assert.deepEqual(malMostrar, [], 'paraMostrar dejo estos puntos de codigo invisibles');
  assert.deepEqual(sobreEscapa, [], 'paraMostrar escapo estos puntos de codigo que SI se ven');
  assert.deepEqual(malJson, [], 'jsonSeguro dejo invisible (o cambio el valor de) estos puntos de codigo');
});

// ---------- jsonSeguro ----------
test('jsonSeguro: lo invisible sale como \\uXXXX pero JSON.parse devuelve EXACTAMENTE el mismo valor', () => {
  const obj = { nombre: HOSTILES.bidi, esc: HOSTILES.esc, tags: HOSTILES.tags, lista: [HOSTILES.cero, 'normal', { x: HOSTILES.saltos }], suelto: HOSTILES.suelto, n: 7, nulo: null, ok: true };
  const t = T.jsonSeguro(obj);
  assert.ok(!RARO_EN_JSON.test(t));
  assert.deepEqual(JSON.parse(t), obj);
  assert.match(t, new RegExp(BS + BS + 'u202e'), 'el RLO queda escrito como texto');
});
test('jsonSeguro: no toca la estructura (misma sangria y saltos que JSON.stringify) ni lo que se ve; undefined sigue siendo undefined', () => {
  const obj = { a: 1, b: [1, 2, { c: 'x' }], d: LIMPIOS };
  assert.equal(T.jsonSeguro(obj), JSON.stringify(obj, null, 2));
  assert.equal(T.jsonSeguro(obj, 0), JSON.stringify(obj));
  assert.equal(T.jsonSeguro(undefined), undefined);
});

// ---------- neutralizarSalida ----------
test('neutralizarSalida: respeta el salto de linea y el tabulador del propio kit pero no deja pasar ESC, retorno de carro, bidi ni invisibles; es idempotente', () => {
  assert.equal(T.neutralizarSalida('a\nb\tc'), 'a\nb\tc');
  for (const s of Object.values(HOSTILES)) {
    const o = T.neutralizarSalida(s);
    assert.ok(!RARO.test(o.replace(/[\n\t]/g, '')), 'quedo algo invisible en la salida');
    assert.equal(T.neutralizarSalida(o), o);
  }
  assert.equal(T.neutralizarSalida('x' + ESC + '[2Jy'), 'x' + esc('001b') + '[2Jy');
  assert.equal(T.neutralizarSalida('a\r\nb'), 'a' + BS + 'r\nb');
});
test('instalarSalidaSegura: filtra console.log/info/warn/error, no toca lo que no es texto, es idempotente y se puede deshacer', () => {
  const cap = []; const fake = {}; for (const m of ['log', 'info', 'warn', 'error']) fake[m] = function (...a) { cap.push([m, this === fake, a]); };
  const originales = { ...fake };
  const deshacer = T.instalarSalidaSegura(fake);
  const envuelto = fake.log;
  const segunda = T.instalarSalidaSegura(fake);                                              // no envuelve dos veces
  assert.equal(fake.log, envuelto, 'la segunda instalacion volvio a envolver console.log');
  const objeto = { a: 1 };
  fake.log('x' + ESC + '[2J', 42, objeto); fake.error(HOSTILES.bidi); fake.warn('a\nb'); fake.info('ok');
  assert.deepEqual(cap.map(c => c[0]), ['log', 'error', 'warn', 'info']);
  assert.ok(cap.every(c => c[1]), 'conserva el this de console');
  assert.deepEqual(cap[0][2], ['x' + esc('001b') + '[2J', 42, objeto]); assert.equal(cap[0][2][2], objeto);
  assert.deepEqual(cap[1][2], ['harmless' + esc('202e') + 'gnp.exe']); assert.deepEqual(cap[2][2], ['a\nb']);
  segunda(); fake.log(HOSTILES.esc); assert.ok(!RARO.test(cap[4][2][0]), 'deshacer la SEGUNDA instalacion no debe quitar la primera');
  deshacer();
  for (const m of ['log', 'info', 'warn', 'error']) assert.equal(fake[m], originales[m], m + ' no volvio a la original');
  assert.equal(fake.__salidaSegura, undefined);
});

// ---------- especiales de shell ----------
test('cabeEntreComillasDobles: lo que bash, PowerShell y cmd interpretan DENTRO de comillas dobles ($ ` " \\ ! % y las comillas dobles inteligentes) se rechaza', () => {
  for (const c of ['$', '`', '"', BS, '!', '%', cp(0x201c), cp(0x201d), cp(0x201e), cp(0x201f)]) {
    assert.equal(T.cabeEntreComillasDobles('a' + c + 'b'), false, `U+${c.codePointAt(0).toString(16)} debe rechazarse`);
    assert.equal(T.argumentoPegable('a' + c + 'b'), null);
  }
  assert.equal(T.cabeEntreComillasDobles('x$(calc)y'), false); assert.equal(T.cabeEntreComillasDobles('x`calc`y'), false);
});
test('cabeEntreComillasDobles: lo que es inerte entre comillas dobles se acepta (; & | < > ( ) { } [ ] * ? ~ # ^ \' y espacios) pero especialesDeShell lo SENALA para quien lo pegue suelto', () => {
  for (const c of [';', '&', '|', '<', '>', '(', ')', '{', '}', '[', ']', '*', '?', '~', '#', '^', "'", ' ']) {
    assert.equal(T.cabeEntreComillasDobles('a' + c + 'b'), true, `${c} es inerte entre comillas dobles`);
    assert.equal(T.argumentoPegable('a' + c + 'b'), `"a${c}b"`);
    assert.deepEqual(T.especialesDeShell('a' + c + 'b'), c === ' ' ? [] : [c], `${c} debe senalarse`);
  }
});
test('cabeEntreComillasDobles: ningun invisible ni de control (la terminal no los reproduce al copiar)', () => {
  for (const s of Object.values(HOSTILES)) assert.equal(T.cabeEntreComillasDobles(s), false);
  for (const s of LIMPIOS) assert.equal(T.cabeEntreComillasDobles(s), true);
});
test('argumentoPegable: el nombre limpio queda entre comillas dobles, tal cual', () => {
  assert.equal(T.argumentoPegable('NC001234_MAGGI_Mundial_E-P1'), '"NC001234_MAGGI_Mundial_E-P1"');
  assert.equal(T.argumentoPegable(''), '""');
});
test('especialesDeShell: sin repetir, en orden de aparicion; nada para un nombre real; las comillas inteligentes cuentan', () => {
  assert.deepEqual(T.especialesDeShell('NC001234_MAGGI_Mundial_E-P1'), []);
  assert.deepEqual(T.especialesDeShell('a$b$c(d)$'), ['$', '(', ')']);
  assert.deepEqual(T.especialesDeShell('a' + cp(0x201c) + cp(0x2019)), [cp(0x201c), cp(0x2019)]);
});
test('avisoDeNombre: nada si es limpio; cuenta los invisibles; lista los especiales y las comillas inteligentes con su codigo', () => {
  assert.equal(T.avisoDeNombre('NC001234_MAGGI_Mundial_E-P1'), null);
  assert.match(T.avisoDeNombre(HOSTILES.bidi), /lleva 1 carácter invisible o de control/);
  assert.match(T.avisoDeNombre('a' + ZWSP + 'b' + RLO), /lleva 2 caracteres invisibles/);
  const a = T.avisoDeNombre('x$(calc)y'); assert.match(a, /\$ \( \)/); assert.match(a, /comillas simples/);
  assert.match(T.avisoDeNombre('a' + cp(0x201c) + 'b'), /U\+201C/);
  assert.match(T.avisoDeNombre(HOSTILES.esc), /invisible.*·.*interpreta/s, 'trae las dos cosas: ESC invisible y especiales de shell');
});

// ---------- contra shells de verdad ----------
// Lo que prometen cabeEntreComillasDobles / argumentoPegable se comprueba CON bash y PowerShell reales (si hay): el nombre llega como UN argumento, sin cambios.
// Cada shell se arranca UNA vez con todas las lineas (PowerShell tarda segundos en arrancar). cmd.exe NO se prueba (sus reglas de comillas son otras):
// la exclusion de % y ! sale de su documentacion, no de una corrida.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'textoseguro-'));
(test.after || (() => {}))(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ya no esta */ } });
// eco.js imprime los argumentos que RECIBIO, en hexadecimal de sus bytes UTF-8 (solo ASCII: asi la pagina de codigos de la consola de PowerShell no puede deformar un acento).
const eco = path.join(tmp, 'eco.js'); fs.writeFileSync(eco, "console.log(Buffer.from(JSON.stringify(process.argv.slice(2)), 'utf8').toString('hex'));");
const recibido = (salida) => JSON.parse(Buffer.from(salida.trim(), 'hex').toString('utf8'));
const adelante = (p) => p.replace(/\\/g, '/');
const NODO = adelante(process.execPath), ECO = adelante(eco);
const entorno = { ...process.env, MSYS_NO_PATHCONV: '1', MSYS2_ARG_CONV_EXCL: '*' };
const corre = (cmd, args) => { try { return spawnSync(cmd, args, { encoding: 'utf8', timeout: 60000, env: entorno }); } catch (e) { return { error: e }; } };
/**
 * Corre UNA linea en el shell (un solo arranque de shell y de node: en esta maquina cada exec cuesta segundos) con todos los argumentos YA entrecomillados y devuelve los que
 * node RECIBIO, en orden; null si ese shell no esta (la primera linea, `echo ok`, es la sonda).
 */
function enShell(shell, argumentos) {
  const linea = `"${NODO}" "${ECO}" ${argumentos.join(' ')}`;
  const guion = `echo ok\n${shell === 'bash' ? '' : '& '}${linea}\n`;
  let r;
  if (shell === 'bash') { const f = path.join(tmp, 'linea.sh'); fs.writeFileSync(f, guion); r = corre('bash', [adelante(f)]); }
  else r = corre(shell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(guion, 'utf16le').toString('base64')]);
  if (r.error || !r.stdout || r.stdout.split(/\r?\n/)[0].trim() !== 'ok') return null;
  assert.equal(r.status, 0, `${shell} fallo: ${String(r.stderr).slice(0, 300)}`);
  return recibido(r.stdout.trim().split(/\r?\n/)[1]);
}
const ENTRADAS_INERTES = [...LIMPIOS, 'a --b c', 'x ; y & z | w', 'a<b>c(d){e}[f]*?~#^\'g', 'dos  espacios  seguidos'];
const pegables = () => ENTRADAS_INERTES.map(s => T.argumentoPegable(s));

test('con bash REAL: lo que argumentoPegable acepta llega como UN argumento, sin cambios; y $(…) dentro de comillas dobles SI se ejecuta (por eso se rechaza)', (t) => {
  const r = enShell('bash', [...pegables(), '"x$(echo PWNED)y"', '"x`echo PWNED`y"']);
  if (!r) return t.skip('no hay bash');
  assert.equal(r.length, ENTRADAS_INERTES.length + 2, 'bash partio o junto argumentos');
  ENTRADAS_INERTES.forEach((s, i) => assert.equal(r[i], s, `bash cambio ${JSON.stringify(s)}`));
  assert.equal(r[ENTRADAS_INERTES.length], 'xPWNEDy', 'control negativo: $(…) entre comillas dobles se ejecuta');
  assert.equal(r[ENTRADAS_INERTES.length + 1], 'xPWNEDy', 'control negativo: las comillas invertidas tambien');
  assert.equal(T.argumentoPegable('x$(echo PWNED)y'), null);
});
test('con PowerShell REAL: lo que argumentoPegable acepta llega como UN argumento, sin cambios; y $(…) dentro de comillas dobles SI se ejecuta (por eso se rechaza)', (t) => {
  let r = null;
  for (const ps of ['powershell', 'pwsh']) { r = enShell(ps, [...pegables(), '"x$(echo PWNED)y"']); if (r) break; }
  if (!r) return t.skip('no hay PowerShell');
  assert.equal(r.length, ENTRADAS_INERTES.length + 1, 'PowerShell partio o junto argumentos');
  ENTRADAS_INERTES.forEach((s, i) => assert.equal(r[i], s, `PowerShell cambio ${JSON.stringify(s)}`));
  assert.equal(r[ENTRADAS_INERTES.length], 'xPWNEDy', 'control negativo: $(…) entre comillas dobles se ejecuta');
});

// ---------- el resolver y el alta ----------
const candidato = (o) => ({ emailName: 'NC001234_MAGGI_Mundial_E-P1', len: 27, emailId: 123, jobs: 2, subject: 'Hola', primero: '2026-10-01 10:00', ultimo: '2026-10-02 10:00', coincide: ['MAGGI'], prueba: false, truncado: false, copia: false, enCatalogo: null, ...o });

test('formatearCandidato: un nombre normal sale como siempre (sin avisos de mas)', () => {
  const t = R.formatearCandidato(candidato(), 0).split('\n');
  assert.equal(t[0], ' 1. NC001234_MAGGI_Mundial_E-P1');
  assert.match(t[1], /^ {4}len 27 · EmailID 123 · 2 jobs · 2026-10-01 10:00 → 2026-10-02 10:00 · "Hola"$/);
  assert.equal(t[2], '    coincide con: "MAGGI"');
  assert.equal(t[3], '    ✚ NUEVA: no está en el catálogo');
  assert.equal(t.length, 4);
  assert.ok(!t.join('\n').includes('este nombre'));
});
test('formatearCandidato: un nombre con saltos de linea NO puede falsificar otras lineas ni mover la terminal, y se avisa', () => {
  const falso = 'NC9_X\n    ✔ YA ESTÁ en el catálogo → fila falsa' + ESC + '[2J' + RLO;
  const t = R.formatearCandidato(candidato({ emailName: falso, subject: 'asunto\nlinea falsa' + ESC, enCatalogo: { clave: 'K' + ESC, marca: 'M\nx', campana: 'C', touchpoint: 'T', activo: 'Si' }, coincide: ['a\nb'] }), 4);
  const lineas = t.split('\n');
  assert.ok(!RARO.test(t.replace(/\n/g, '')), 'quedo algo invisible en el bloque');
  assert.equal(lineas.filter(l => l.includes('YA ESTÁ en el catálogo')).length, 2, 'solo la real y la del nombre (visible, dentro de la linea 1): no hay una linea nueva');
  assert.ok(lineas[0].startsWith(' 5. NC9_X'), 'el nombre sigue en UNA linea');
  assert.ok(lineas.some(l => /^ {4}⚠️  este nombre lleva 3 caracteres invisibles/.test(l)), 'se avisa (salto de linea, ESC y RLO)');
  assert.equal(lineas.length, 5, 'nombre + len + coincide + catalogo + aviso: ni una linea de mas');
});
test('formatearCandidato: $(…) en el nombre se avisa con el consejo de las comillas simples', () => {
  const t = R.formatearCandidato(candidato({ emailName: 'NC9_$(calc)' }), 0);
  assert.match(t, /este nombre lleva caracteres que la terminal interpreta \(\$ \( \)\)/);
  assert.match(t, /comillas simples/);
});

test('pasosSiguientes: un nombre normal queda entre comillas dobles, como siempre; el paso 2 solo si es de journey', () => {
  assert.deepEqual(A.pasosSiguientes('NC001234_MAGGI_Mundial_E-P1'), ['  1) node scripts/refrescar-pieza.js --email-name "NC001234_MAGGI_Mundial_E-P1"     (si no, aparece en el reporte hasta la próxima corrida de las 00:08)']);
  const j = A.pasosSiguientes('NC001234_MAGGI_Mundial_E-P1', { journey: true });
  assert.equal(j.length, 2); assert.match(j[1], /^ {2}2\) node scripts\/audiencias\.js --email-name "NC001234_MAGGI_Mundial_E-P1" /);
});
test('pasosSiguientes: con $(…) en el nombre el comando NO lo lleva (se EJECUTARIA al pegarlo): va un marcador y se explica por que', () => {
  for (const nombre of ['NC9_$(calc)', 'NC9_`calc`', 'NC9_"; calc; "', 'NC9_' + RLO, 'a\nb']) {
    const l = A.pasosSiguientes(nombre, { journey: true });
    const comandos = l.filter(x => /^ {2}\d\) /.test(x));
    assert.equal(comandos.length, 2);
    for (const c of comandos) { assert.ok(c.includes('"<EmailName de arriba>"'), 'usa el marcador'); assert.ok(!c.includes('calc') && !c.includes(RLO) && !c.includes('\n'), 'el texto hostil NO esta en el comando'); }
    assert.ok(l.some(x => /El EmailName lleva/.test(x) && /comillas simples/.test(x)), 'explica por que');
    assert.ok(!RARO.test(l.join('').replace(/\n/g, '')), 'y no deja nada invisible');
  }
});

// ---------- lo que imprime un alta ----------
const FILA = { ConfigKey: 'TMP-MAGGI-E-P1', PiezaID: '*por definir', EmailName: 'NC001234_MAGGI_Mundial_E-P1', ContentName: 'NC001234_MAGGI_Mundial_E-P1', BU: 'Nestle Mexico', Marca: 'Maggi', Campana: 'Mundial 2026',
  Touchpoint: 'E-P1', Segmento: '*por definir', EmailType: 'Principal', Estado: 'Pendiente', Activo: 'Si', CodigoNC: 'NC001234', EmailID: 12345, Notas: 'PROVISIONAL.' };
const SONDEO = { segundos: 41, jobs: 3, emailId: 12345, primero: '2026-10-01 10:00', ultimo: '2026-10-02 10:05', subject: 'Hola Mundial', journeyId: null, journeyName: null };
const DERIVADOS = { configKey: 'TMP-MAGGI-E-P1', bu: 'la del catalogo', codigoNC: 'NC001234' };
const EXISTENTE = { clave: 'TMP-MAGGI-E-P1', marca: 'Maggi', campana: 'Mundial 2026', touchpoint: 'E-P1', emailType: 'Principal', activo: 'Si', emailId: 12345, emailName: FILA.EmailName };
const alta = (estado, o = {}) => ({ estado, sondeo: SONDEO, filasCatalogo: 113, modo: 'configkey', fila: FILA, derivados: DERIVADOS, avisos: [], errores: [], ...o });
const fisicas = (lineas) => lineas.join('\n').split('\n');                  // lo que la terminal ve: cada \n parte una linea

test('formatearResultado: el codigo de salida de cada estado (0 simulacro/alta verificada · 1 error o rechazo · 2 no existe en _Job · 3 ya esta)', () => {
  const casos = [['simulacro', 0], ['escrita', 0], ['escrita-con-diferencias', 1, { diferencias: [{ campo: 'Marca', esperado: 'a', real: 'b' }] }], ['escrita-sin-releer', 1], ['rechazada', 1],
    ['duplicado', 3, { existente: EXISTENTE }], ['duplicado', 3, { existente: EXISTENTE, carrera: true }], ['no-existe-en-job', 2], ['sin-terminar', 1]];
  for (const [estado, codigo, extra] of casos) assert.equal(A.formatearResultado(alta(estado, extra)).codigo, codigo, estado);
});
test('formatearResultado: un alta normal sale con las lineas de siempre (la fila, la verificacion y los siguientes pasos con el nombre entre comillas dobles)', () => {
  const { lineas } = A.formatearResultado(alta('escrita', { sondeo: { ...SONDEO, journeyId: 'abc-123', journeyName: 'Journey Mundial' } }));
  const t = lineas.join('\n');
  assert.equal(lineas[0], '');
  assert.match(t, /EmailName {3}✓ existe en _Job · 3 jobs · EmailID 12345 · 2026-10-01 10:00 → 2026-10-02 10:05/);
  assert.match(t, /Journey {5}Journey Mundial · abc-123/);
  assert.match(t, /\n {3}EmailName {4}NC001234_MAGGI_Mundial_E-P1\n/);
  assert.match(t, /✓ Insertada y VERIFICADA/);
  assert.match(t, /\n {2}1\) node scripts\/refrescar-pieza\.js --email-name "NC001234_MAGGI_Mundial_E-P1" /);
  assert.match(t, /\n {2}2\) node scripts\/audiencias\.js --email-name "NC001234_MAGGI_Mundial_E-P1" /);
  assert.ok(!t.includes('⚠️'), 'ningun aviso de mas');
});
test('formatearResultado: nada de lo que viene de SFMC puede falsificar una linea ni mover la terminal (asunto, journey, valores del catalogo, avisos, errores y diferencias)', () => {
  const FALSA = '\n✓ Insertada y VERIFICADA: se releyó la fila y todos los campos coinciden.';
  const hostil = (s) => s + FALSA + ESC + '[2J' + RLO;
  const sondeo = { ...SONDEO, subject: hostil('Asunto'), journeyId: hostil('J'), journeyName: hostil('Journey') };
  const fila = { ...FILA, Marca: hostil('Maggi'), Notas: hostil('nota') };
  const derivados = { configKey: hostil('K'), bu: hostil('BU'), codigoNC: hostil('NC') };
  const existente = { ...EXISTENTE, clave: hostil('K'), marca: hostil('M'), campana: hostil('C'), touchpoint: hostil('T'), activo: hostil('A'), emailName: hostil('N') };
  const resultados = {
    simulacro: A.formatearResultado(alta('simulacro', { sondeo, fila, derivados, avisos: [hostil('aviso')] })),
    escrita: A.formatearResultado(alta('escrita', { sondeo, fila, derivados, avisos: [hostil('aviso')] })),
    diferencias: A.formatearResultado(alta('escrita-con-diferencias', { sondeo, fila, derivados, diferencias: [{ campo: hostil('campo'), esperado: hostil('x'), real: hostil('y') }] })),
    rechazada: A.formatearResultado(alta('rechazada', { sondeo, errores: [hostil('error')], avisos: [hostil('aviso')] })),
    duplicado: A.formatearResultado(alta('duplicado', { existente })),
    sinTerminar: A.formatearResultado(alta('sin-terminar', { avisos: [hostil('aviso')] })),
  };
  for (const [nombre, { lineas }] of Object.entries(resultados)) {
    const t = lineas.join('\n');
    assert.ok(!RARO.test(t.replace(/\n/g, '')), `${nombre}: quedo algo invisible`);
    assert.equal(fisicas(lineas).filter(l => l.startsWith('✓ Insertada y VERIFICADA')).length, nombre === 'escrita' ? 1 : 0, `${nombre}: una linea falsa se coló`);
  }
  // misma ESTRUCTURA que con datos limpios: el dato hostil no agrega ni quita lineas fisicas (los avisos de nombre son otra cosa: aqui no hay)
  for (const estado of ['simulacro', 'escrita']) {
    const limpio = fisicas(A.formatearResultado(alta(estado, { sondeo: { ...SONDEO, journeyId: 'J', journeyName: 'Journey' }, avisos: ['aviso'] })).lineas).length;   // gemelo limpio, tambien de journey
    const sucio = fisicas(A.formatearResultado(alta(estado, { sondeo, fila, derivados, avisos: [hostil('aviso')] })).lineas).length;
    assert.equal(sucio, limpio, `${estado}: el dato hostil cambio el numero de lineas`);
  }
});
test('formatearResultado: tras un alta con un EmailName con $(…), "Siguiente" no pega ese nombre en ningun comando', () => {
  const nombre = 'NC9_$(calc)_E-P1';
  const { lineas } = A.formatearResultado(alta('escrita', { fila: { ...FILA, EmailName: nombre }, sondeo: { ...SONDEO, journeyId: 'abc' } }));
  const comandos = lineas.filter(l => /^ {2}\d\) node /.test(l));
  assert.equal(comandos.length, 2);
  for (const c of comandos) assert.ok(c.includes('"<EmailName de arriba>"') && !c.includes('calc'));
  assert.ok(lineas.some(l => /El EmailName lleva caracteres que la terminal interpreta/.test(l)));
});

// ---------- de punta a punta, con un proceso real ----------
test('ejecutar(): lo que main imprime (y el error con que termina) sale por la salida segura; con un proceso REAL, ni un ESC ni un RLO llegan a stdout/stderr', () => {
  const kitCli = JSON.stringify(path.resolve(__dirname, '..', 'lib', 'cli.js'));
  const guion = path.join(tmp, 'ejecutar.js');
  fs.writeFileSync(guion, [
    `const { ejecutar, salidaJson } = require(${kitCli});`,
    'const ESC = String.fromCharCode(27), RLO = String.fromCharCode(0x202e), TAGS = String.fromCodePoint(0xe0041, 0xe0042);',
    'ejecutar(async () => {',
    "  console.log('x' + ESC + '[2Jy');",
    "  console.log(salidaJson({ nombre: 'a' + RLO + 'b' + TAGS }));",
    "  console.error('e' + RLO + 'f');",
    "  throw new Error('boom' + ESC + '[0m');",
    '});',
  ].join('\n'));
  const r = spawnSync(process.execPath, [guion], { encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 1, 'termina con error: ' + r.stderr);
  const crudos = [ESC, RLO].map(c => r.stdout.includes(c) || r.stderr.includes(c));
  assert.deepEqual(crudos, [false, false], 'llego un ESC o un RLO crudo a la terminal');
  assert.ok(r.stdout.includes('x' + esc('001b') + '[2Jy'), 'el ESC se ve como texto');
  // El filtro de la terminal tambien escaparia lo invisible, pero con la forma de TEXTO (\u{e0041} para lo que no cabe en 16 bits), que NO es un escape de JSON valido:
  // por eso el JSON tiene que salir ya escapado por salidaJson, y al parsearlo (con un caracter fuera de 16 bits) el valor tiene que ser el mismo.
  assert.ok(r.stdout.includes(esc('202e')), 'el JSON escapa el RLO');
  assert.deepEqual(JSON.parse(r.stdout.split('\n').slice(1).join('\n').trim()), { nombre: 'a' + RLO + 'b' + TAGS }, 'y al parsearlo, el valor es el mismo (tags incluidos)');
  assert.ok(r.stderr.includes('e' + esc('202e') + 'f') && r.stderr.includes('boom' + esc('001b') + '[0m'), 'stderr y el mensaje de error tambien');
});
