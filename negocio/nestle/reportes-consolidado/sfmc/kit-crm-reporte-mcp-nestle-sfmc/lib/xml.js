'use strict';
// Utilidades XML/SOAP puras (sin red). El SOAP de SFMC devuelve entidades escapadas (&gt; &amp; …): se DECODIFICAN aqui
// (el lector viejo no lo hacia y devolvia "marzo-&gt;abril").

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodificar(s) {
  return String(s == null ? '' : s).replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isInteger(n) && n >= 0 && n <= 0x10FFFF && !(n >= 0xD800 && n <= 0xDFFF) ? String.fromCodePoint(n) : m;          // fuera de rango o un sustituto suelto: se deja como texto (fromCodePoint lanzaria RangeError)
    }
    return ENT[e];
  });
}

class ErrorXml extends Error { constructor(msg) { super(msg); this.name = 'ErrorXml'; } }
/** Posicion del primer caracter que XML 1.0 NO admite en ningun lado (ni como referencia numerica): controles C0 salvo tab/LF/CR, U+FFFE/U+FFFF y sustitutos UTF-16 sueltos. -1 si no hay. */
function primerIlegalXml(t) {
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c < 0x20 ? (c !== 9 && c !== 10 && c !== 13) : (c === 0xFFFE || c === 0xFFFF)) return i;
    if (c >= 0xD800 && c <= 0xDBFF) { const d = t.charCodeAt(i + 1); if (d >= 0xDC00 && d <= 0xDFFF) { i++; continue; } return i; }        // un par valido (emoji) se salta; uno cortado a la mitad no
    if (c >= 0xDC00 && c <= 0xDFFF) return i;
  }
  return -1;
}
/** Escapa texto para meterlo en XML. Un caracter que XML no admite NO se envia (SFMC lo rechazaria con un Fault enigmatico) ni se cambia en silencio (cambiaria una clave): se rechaza con un mensaje claro que no repite el valor. */
const esc = (s) => {
  const t = String(s == null ? '' : s);
  const i = primerIlegalXml(t);
  if (i >= 0) {
    const n = t.charCodeAt(i);
    throw new ErrorXml(`No envío a SFMC un valor con el carácter U+${n.toString(16).toUpperCase().padStart(4, '0')} (posición ${i + 1}): XML 1.0 no lo admite y SFMC lo rechazaría. Suele venir de copiar desde Word o un PDF; quítalo del valor.`);
  }
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
};

/** Los bloques <Results …>…</Results> de una respuesta Retrieve. */
function bloques(xml) { return String(xml).split(/<Results[^>]*>/).slice(1); }
/** Texto (decodificado) de la primera etiqueta <tag>…</tag> del bloque; undefined si no esta. */
function etiqueta(bl, tag) { const m = new RegExp('<' + tag + '>([^<]*)</' + tag + '>').exec(bl); return m ? decodificar(m[1]) : undefined; }
/** Pares <Name>/<Value> de un bloque DataExtensionObject -> objeto. <Value /> vacio => ''. */
function pares(bl) {
  const o = {}; const rx = /<Name>([^<]*)<\/Name>\s*(?:<Value>([^<]*)<\/Value>|<Value\s*\/>)/g; let m;
  while ((m = rx.exec(bl))) o[decodificar(m[1])] = decodificar(m[2] === undefined ? '' : m[2]);
  return o;
}
/** Resumen de una respuesta SOAP: estado global, mensajes, y si fue un Fault. */
function resumen(xml) {
  const t = String(xml);
  const falla = /<(?:\w+:)?faultstring>([^<]*)<\/(?:\w+:)?faultstring>/i.exec(t);
  const estado = (/<OverallStatus>([^<]*)<\/OverallStatus>/.exec(t) || [])[1];
  const mensajes = []; const rx = /<StatusMessage>([^<]*)<\/StatusMessage>/g; let m; while ((m = rx.exec(t))) mensajes.push(decodificar(m[1]));
  const global = (/<OverallStatusMessage>([^<]*)<\/OverallStatusMessage>/.exec(t) || [])[1];
  if (global) mensajes.unshift(decodificar(global));
  return { estado, mensajes, fault: falla ? decodificar(falla[1]) : null, ok: estado === 'OK' || estado === 'MoreDataAvailable', hayMas: estado === 'MoreDataAvailable', requestId: (/<RequestID>([^<]*)<\/RequestID>/.exec(t) || [])[1] };
}

// ---- filtros del Retrieve ----
function filtroSimple(prop, op, valor) {
  return `<Filter xsi:type="SimpleFilterPart"><Property>${esc(prop)}</Property><SimpleOperator>${esc(op)}</SimpleOperator><Value>${esc(valor)}</Value></Filter>`;
}
/** a OP b, con OP = AND | OR. a y b son filtros simples (salida de filtroSimple). */
function filtroCompuesto(a, op, b) {
  const como = (f, lado) => f.replace(/^<Filter /, `<${lado} `).replace(/<\/Filter>$/, `</${lado}>`);
  return `<Filter xsi:type="ComplexFilterPart">${como(a, 'LeftOperand')}<LogicalOperator>${esc(op)}</LogicalOperator>${como(b, 'RightOperand')}</Filter>`;
}

module.exports = { decodificar, esc, ErrorXml, primerIlegalXml, bloques, etiqueta, pares, resumen, filtroSimple, filtroCompuesto };
