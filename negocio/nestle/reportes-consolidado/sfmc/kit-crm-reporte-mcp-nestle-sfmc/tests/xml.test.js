'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../lib/xml');

test('decodificar: entidades nombradas y numericas (el lector viejo devolvia "marzo-&gt;abril")', () => {
  assert.equal(X.decodificar('marzo-&gt;abril &amp; m&#225;s &#xE9; &quot;x&quot; &apos;y&apos; &lt;z&gt;'), 'marzo->abril & más é "x" \'y\' <z>');
  assert.equal(X.decodificar(undefined), '');
  assert.equal(X.decodificar('&desconocida;'), '&desconocida;');
});

test('esc/decodificar son inversas', () => {
  const s = `O_Maggi & "Liga" <J8> it's`;
  assert.equal(X.decodificar(X.esc(s)), s);
});

test('pares: <Name>/<Value>, valores vacios (<Value />) y entidades', () => {
  const bl = '<Properties><Property><Name>EmailName</Name><Value>A &amp; B</Value></Property><Property><Name>Notas</Name><Value /></Property><Property><Name>N</Name><Value>7</Value></Property></Properties>';
  assert.deepEqual(X.pares(bl), { EmailName: 'A & B', Notas: '', N: '7' });
});

test('bloques/etiqueta/resumen sobre un Retrieve con mas paginas', () => {
  const xml = '<x><OverallStatus>MoreDataAvailable</OverallStatus><RequestID>abc-123</RequestID><Results xsi:type="DataExtensionObject"><CustomerKey>K</CustomerKey><Properties/></Results><Results xsi:type="DataExtensionObject"><CustomerKey>K2</CustomerKey></Results></x>';
  const b = X.bloques(xml);
  assert.equal(b.length, 2); assert.equal(X.etiqueta(b[1], 'CustomerKey'), 'K2'); assert.equal(X.etiqueta(b[0], 'Nada'), undefined);
  const r = X.resumen(xml);
  assert.equal(r.estado, 'MoreDataAvailable'); assert.equal(r.ok, true); assert.equal(r.hayMas, true); assert.equal(r.requestId, 'abc-123');
});

test('resumen: error de Create (StatusMessage) y Fault', () => {
  const err = X.resumen('<r><OverallStatus>Error</OverallStatus><Results><StatusCode>Error</StatusCode><StatusMessage>Violation of PRIMARY KEY &amp; algo</StatusMessage></Results></r>');
  assert.equal(err.ok, false); assert.deepEqual(err.mensajes, ['Violation of PRIMARY KEY & algo']);
  const f = X.resumen('<soap:Envelope><soap:Body><soap:Fault><faultstring>Token expired</faultstring></soap:Fault></soap:Body></soap:Envelope>');
  assert.equal(f.fault, 'Token expired'); assert.equal(f.ok, false);
});

test('filtros: simple escapa valores; compuesto usa LeftOperand/RightOperand', () => {
  const a = X.filtroSimple('Name', 'equals', `a&b'c`);
  assert.match(a, /<Value>a&amp;b&apos;c<\/Value>/);
  const c = X.filtroCompuesto(X.filtroSimple('A', 'equals', '1'), 'OR', X.filtroSimple('B', 'equals', '2'));
  assert.match(c, /^<Filter xsi:type="ComplexFilterPart"><LeftOperand xsi:type="SimpleFilterPart">/);
  assert.match(c, /<LogicalOperator>OR<\/LogicalOperator><RightOperand xsi:type="SimpleFilterPart">/);
  assert.ok(c.endsWith('</RightOperand></Filter>'));
});

// ---------- texto hostil: lo que SALE hacia SFMC (esc) y lo que ENTRA de sus respuestas (decodificar) ----------
// Los caracteres raros se arman con codigos (no con escapes escritos) para que este archivo se quede en ASCII.
const ch = (n) => String.fromCharCode(n);
const hex = (n) => 'U+' + n.toString(16).toUpperCase().padStart(4, '0');
const ALTO = ch(0xD83D), BAJO = ch(0xDE00);          // las dos mitades de un emoji

test('decodificar: una referencia numerica fuera de rango o un sustituto suelto NO lanza (fromCodePoint lanzaria RangeError): se queda como texto', () => {
  for (const t of ['&#x110000;', '&#1114112;', '&#99999999999999999999;', '&#xFFFFFFFFFF;', '&#xD800;', '&#55296;', '&#xDFFF;', '&#xDBFF;']) assert.equal(X.decodificar(t), t, t);
  assert.equal(X.decodificar('&#x10FFFF;'), String.fromCodePoint(0x10FFFF), 'el ultimo codigo valido si');
  assert.equal(X.decodificar('&#xD7FF;&#xE000;'), ch(0xD7FF) + ch(0xE000), 'los vecinos del rango de sustitutos si');
  assert.equal(X.decodificar('&#0;'), ch(0));
  assert.equal(X.decodificar('x&amp;#x110000;y'), 'x&#x110000;y', 'un &amp; delante no se decodifica dos veces');
  assert.equal(X.decodificar('a&#x110000;b&#65;c'), 'a&#x110000;bAc', 'lo malo no estorba a lo bueno de al lado');
});

test('esc: un caracter que XML 1.0 no admite se RECHAZA con un mensaje claro (no se manda, no se cambia en silencio, y el mensaje no repite el valor)', () => {
  const malos = []; for (let n = 0; n < 0x20; n++) if (![9, 10, 13].includes(n)) malos.push(n); malos.push(0xFFFE, 0xFFFF);
  assert.equal(malos.length, 29 + 2);
  for (const n of malos) {
    const valor = 'ab' + ch(n) + 'cd-SECRETO';
    assert.throws(() => X.esc(valor), (e) => e instanceof X.ErrorXml && e.message.includes(hex(n)) && e.message.includes('posición 3') && !e.message.includes('SECRETO') && !e.message.includes('abcd'), hex(n));
  }
  for (const v of [ALTO, BAJO, 'x' + ALTO, ALTO + 'x', BAJO + ALTO, 'x' + BAJO + 'y', ALTO + ALTO + BAJO + BAJO]) assert.throws(() => X.esc(v), X.ErrorXml, 'sustituto suelto: ' + v.length);
  assert.throws(() => X.filtroSimple('Name', 'equals', 'a' + ch(11) + 'b'), X.ErrorXml, 'un filtro con un valor asi se rechaza ANTES de armar la peticion');
  assert.throws(() => X.filtroSimple('Name' + ch(1), 'equals', 'ok'), X.ErrorXml, 'tambien en el nombre de la propiedad');
});

test('esc: lo legitimo pasa — tab/LF/CR, acentos, un emoji ENTERO, U+FEFF y U+FFFD — y los 5 caracteres de XML se escapan', () => {
  const ok = 'a' + ch(9) + 'b' + ch(10) + 'c' + ch(13) + 'd, Nescafé, ' + ALTO + BAJO + ', ' + ch(0xFEFF) + ch(0xFFFD) + ch(0xA0);
  assert.equal(X.esc(ok), ok);
  assert.equal(X.esc(`&<>"'`), '&amp;&lt;&gt;&quot;&apos;');
  assert.equal(X.esc(null), ''); assert.equal(X.esc(undefined), ''); assert.equal(X.esc(0), '0'); assert.equal(X.esc(false), 'false');
  assert.equal(X.primerIlegalXml(ok), -1); assert.equal(X.primerIlegalXml('xy' + ch(0)), 2);
});

test('esc: 300 cadenas al azar con caracteres peligrosos — nunca queda un <, >, " o \' sin escapar, todo & abre una entidad, y decodificar(esc(s)) == s', () => {
  let semilla = 20261002; const azar = () => { semilla = (semilla * 1664525 + 1013904223) >>> 0; return semilla / 4294967296; };
  const piezas = ['&', '<', '>', '"', "'", ']]>', '<![CDATA[', '&amp;', '&#x41;', '&lt;', '<!--', '-->', '</Objects>', '<Objects xsi:type="Automation">', ' ', 'é', 'Ñ', ALTO + BAJO, ch(0x200B), ch(0x202E), ch(9), ch(10), 'NC000817', '_', '-'];
  for (let i = 0; i < 300; i++) {
    let s = ''; const largo = Math.floor(azar() * 12); for (let j = 0; j < largo; j++) s += piezas[Math.floor(azar() * piezas.length)];
    const e = X.esc(s);
    assert.ok(!/[<>"']/.test(e), 'sin metacaracteres crudos: ' + JSON.stringify(s));
    assert.ok(!/&(?!(amp|lt|gt|quot|apos);)/.test(e), 'todo & abre una entidad: ' + JSON.stringify(s));
    assert.equal(X.decodificar(e), s, 'ida y vuelta: ' + JSON.stringify(s));
  }
});
