'use strict';
// Texto que viene de SFMC (nombres de envios y de journeys, asuntos, valores del catalogo) y que el kit IMPRIME o deja listo para pegar en un comando.
// Lo escribe cualquiera con acceso a la BU: no es de confianza. Son dos riesgos distintos y cada uno tiene su defensa:
//   1) Que la TERMINAL (o quien lea la salida) lo interprete: secuencias ESC, saltos de linea que falsifican lineas, texto bidireccional que reordena lo que se ve,
//      caracteres de ancho cero y "tag characters" (invisibles para una persona, legibles para un modelo).
//        -> paraMostrar() los vuelve texto visible (\u001b). jsonSeguro() hace lo mismo SIN cambiar el valor: JSON.parse devuelve exactamente el mismo texto.
//        -> neutralizarSalida() es la red de seguridad de TODO lo que imprimen los scripts (lib/cli.js la instala en ejecutar()).
//   2) Que el SHELL lo interprete al pegarlo: $(…) y `…` se EJECUTAN dentro de comillas dobles, en bash y en PowerShell; %VAR% se expande en cmd.
//        -> especialesDeShell() los detecta y argumentoPegable() solo da la forma "entre comillas dobles" si el nombre es limpio.
// Calibrado el 2-oct-2026 con los 113 EmailName del catalogo: ninguno trae un especial de shell ni un invisible (solo letras, digitos, _ - . y espacio),
// asi que el aviso no es ruido: si aparece, es porque pasa algo raro.

// Lo que una persona no ve o la terminal interpreta: controles C0/C1 y DEL (Cc), formato (Cf: bidi, ancho cero, tag characters), surrogates sueltos (Cs),
// uso privado (Co), sin asignar (Cn), separadores de linea y de parrafo (Zl, Zp), selectores de variacion suplementarios y todo espacio que no sea el ASCII 32 (NBSP…).
// El selector de variacion U+FE0F (el de "⚠️") es Mn y no se toca: los emojis de un asunto se siguen viendo.
const INVISIBLES = /[\p{C}\p{Zl}\p{Zp}\u{E0100}-\u{E01EF}]|(?! )\p{Zs}/gu;
const HAY_INVISIBLES = new RegExp(INVISIBLES.source, 'u');
// Dentro de un JSON todo lo estructural es ASCII (llaves, comas, saltos y sangria) y JSON.stringify ya escapo los controles < 0x20: solo se tocan el DEL y lo que no es ASCII.
const INVISIBLES_JSON = /[\u007f-\u009f\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\u{E0100}-\u{E01EF}]|(?! )\p{Zs}/gu;

// Lo que una terminal puede interpretar (sin comillas, o al cambiar de comillas). Incluye las comillas "inteligentes", que PowerShell trata como comillas de verdad.
const ESPECIALES_DE_SHELL = /[$`"'\\!%;&|<>(){}[\]*?~#^\u2018-\u201f]/gu;
// Lo que se interpreta DENTRO de comillas dobles: $ (variables y $(…)), ` (sustitucion en bash, escape en PowerShell), " (cierra), \ (escapa en bash y en la linea de
// comandos de Windows), ! (historial de bash), % (%VAR% de cmd) y las comillas dobles "inteligentes" (PowerShell las toma por comillas dobles).
const ROMPEN_COMILLAS_DOBLES = /[$`"\\!%\u201c\u201d\u201e\u201f]/u;

const aCadena = (s) => String(s == null ? '' : s);
const hex = (n, ancho = 4) => n.toString(16).padStart(ancho, '0');
const ABREVIADOS = { 9: '\\t', 10: '\\n', 13: '\\r' };
/** Forma visible de UN caracter: \t \n \r, \u202e, o \u{e0041} si no cabe en 16 bits. */
const aTexto = (ch) => { const cp = ch.codePointAt(0); return ABREVIADOS[cp] || (cp > 0xffff ? `\\u{${hex(cp, 5)}}` : `\\u${hex(cp)}`); };
/** Escape de JSON de UN caracter (los de fuera de 16 bits van como par de surrogates, que es lo que JSON.parse espera). */
const aJson = (ch) => {
  const cp = ch.codePointAt(0);
  if (cp <= 0xffff) return '\\u' + hex(cp);
  const v = cp - 0x10000;
  return '\\u' + hex(0xd800 + (v >> 10)) + '\\u' + hex(0xdc00 + (v & 0x3ff));
};

/** Quita el BOM (U+FEFF) del principio: Notepad y PowerShell lo agregan a los archivos "UTF-8". Se arma con el codigo del caracter, no con el caracter: el fuente no lleva ningun invisible. */
const sinBom = (t) => { const s = aCadena(t); return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s; };

/** true si el texto trae algo invisible o de control (incluidos los saltos de linea y los espacios que no son el ASCII 32). */
const tieneInvisibles = (s) => HAY_INVISIBLES.test(aCadena(s));

/** Para un dato de UNA linea (nombre, asunto…): lo invisible y los saltos de linea se vuelven texto visible (\u202e, \n). */
const paraMostrar = (s) => aCadena(s).replace(INVISIBLES, aTexto);

/** Red de seguridad para TODO lo que sale por la terminal: como paraMostrar pero respeta \n y \t (el kit imprime varias lineas). Idempotente. */
const neutralizarSalida = (s) => aCadena(s).replace(INVISIBLES, (ch) => (ch === '\n' || ch === '\t' ? ch : aTexto(ch)));

/** JSON.stringify que escribe lo invisible como \uXXXX. El VALOR no cambia (JSON.parse devuelve lo mismo); solo deja de colarse en una terminal o en un modelo que lea la salida. */
function jsonSeguro(valor, espacios = 2) {
  const t = JSON.stringify(valor, null, espacios);
  return t === undefined ? t : t.replace(INVISIBLES_JSON, aJson);
}

/** Los caracteres que una terminal puede interpretar, sin repetir y en el orden en que aparecen. [] = ninguno. */
const especialesDeShell = (s) => [...new Set(aCadena(s).match(ESPECIALES_DE_SHELL) || [])];

/** true si el texto se puede pegar ENTRE COMILLAS DOBLES sin que bash, PowerShell ni cmd interpreten nada (y sin invisibles que la terminal no reproduce). */
const cabeEntreComillasDobles = (s) => !HAY_INVISIBLES.test(aCadena(s)) && !ROMPEN_COMILLAS_DOBLES.test(aCadena(s));

/** "<texto>" listo para pegar en un comando, o null si NO es seguro hacerlo (quien llama pone un marcador y muestra avisoDeNombre). */
const argumentoPegable = (s) => (cabeEntreComillasDobles(s) ? `"${aCadena(s)}"` : null);

/** Como mostrar un especial en un aviso: tal cual si es ASCII; con su codigo si no (la comilla “ se parece mucho a "). */
const verEspecial = (c) => (c.codePointAt(0) > 126 ? `${c} (U+${hex(c.codePointAt(0)).toUpperCase()})` : c);

/** Aviso para una persona sobre un nombre ("lleva …"); null si el nombre es limpio. */
function avisoDeNombre(s) {
  const t = aCadena(s); const partes = [];
  const n = (t.match(INVISIBLES) || []).length;
  if (n) partes.push(`lleva ${n} ${n === 1 ? 'carácter invisible' : 'caracteres invisibles'} o de control (arriba se ven como \\uXXXX y al copiar de esta pantalla NO se reproducen): cópialo de SFMC o pide que lo renombren`);
  const e = especialesDeShell(t);
  if (e.length) partes.push(`lleva caracteres que la terminal interpreta (${e.map(verEspecial).join(' ')}): pégalo SIEMPRE entre comillas simples ('…'), nunca suelto ni entre comillas dobles; si lleva una comilla simple, duplícala en PowerShell ('') o escríbela '\\'' en bash`);
  return partes.length ? partes.join(' · ') : null;
}

/**
 * Pasa neutralizarSalida por console.log/info/warn/error (los scripts imprimen con console.*): nada de lo que venga de SFMC puede mandar secuencias de escape a la terminal.
 * Idempotente. Devuelve una funcion que lo deshace (las pruebas). `consola` es inyectable.
 */
function instalarSalidaSegura(consola = console) {
  if (consola.__salidaSegura) return () => {};
  const originales = {};
  for (const m of ['log', 'info', 'warn', 'error']) {
    const orig = consola[m]; originales[m] = orig;
    consola[m] = (...args) => orig.apply(consola, args.map((a) => (typeof a === 'string' ? neutralizarSalida(a) : a)));
  }
  consola.__salidaSegura = true;
  return () => { for (const m of Object.keys(originales)) consola[m] = originales[m]; delete consola.__salidaSegura; };
}

module.exports = { INVISIBLES, sinBom, tieneInvisibles, paraMostrar, neutralizarSalida, jsonSeguro, especialesDeShell, cabeEntreComillasDobles, argumentoPegable, avisoDeNombre, instalarSalidaSegura };
