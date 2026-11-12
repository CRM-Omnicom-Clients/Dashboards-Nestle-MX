'use strict';
// MAPA DE CAMBIOS DE SQL, escrito en la guia como bloques ```diff-sql <query> y APLICABLE por codigo.
// Asi la guia de la migracion (docs/MIGRACION-EMAILNAME-PK.md) no es prosa que puede mentir: las pruebas la aplican al SQL real
// y fallan si una query cambio. El formato de cada bloque:
//
//   @@ L17                  <- linea (1-based) donde EMPIEZA el cambio en el SQL de referencia
//   - texto que hay         <- una o varias lineas; se comparan sin espacios sobrantes
//   + texto que pasa a haber   <- cero o mas lineas (sin "+" = se borra)
//
// Este modulo NO escribe nada en SFMC: solo parsea texto y transforma texto.

class ErrorDif extends Error { constructor(msg) { super(msg); this.name = 'ErrorDif'; } }

const norm = (l) => String(l).replace(/\s+/g, ' ').trim();
const lineas = (sql) => String(sql).replace(/\r\n/g, '\n').split('\n');

/** Extrae { [query]: [{ linea, viejas:[...], nuevas:[...] }] } de los bloques ```diff-sql <query> del markdown. */
function parsearBloques(md) {
  const out = {};
  const re = /^```diff-sql[ \t]+(\S+)[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm;
  let m;
  while ((m = re.exec(String(md)))) {
    const query = m[1]; const hunks = []; let h = null;
    for (const raw of m[2].replace(/\r\n/g, '\n').split('\n')) {
      if (!raw.trim()) continue;
      const cab = /^@@ L(\d+)\s*$/.exec(raw);
      if (cab) { h = { linea: Number(cab[1]), viejas: [], nuevas: [] }; hunks.push(h); continue; }
      if (!h) throw new ErrorDif(`${query}: una línea del bloque aparece antes de su "@@ L<n>": ${raw.slice(0, 60)}`);
      const cuerpo = raw.slice(raw[1] === ' ' ? 2 : 1);                           // el marcador y UN espacio; el resto conserva su sangria
      if (raw[0] === '-') { if (h.nuevas.length) throw new ErrorDif(`${query} L${h.linea}: las líneas "-" van antes que las "+"`); h.viejas.push(cuerpo); }
      else if (raw[0] === '+') h.nuevas.push(cuerpo);
      else throw new ErrorDif(`${query} L${h.linea}: línea que no empieza con "-" ni "+": ${raw.slice(0, 60)}`);
    }
    for (const x of hunks) if (!x.viejas.length) throw new ErrorDif(`${query} L${x.linea}: un cambio sin líneas "-" (solo se soportan reemplazos y borrados)`);
    if (out[query]) throw new ErrorDif(`la query ${query} aparece en dos bloques`);
    out[query] = hunks;
  }
  return out;
}

/**
 * Aplica los cambios de una query a su SQL. Cada hunk debe coincidir EXACTAMENTE (sin espacios sobrantes) en la linea que dice;
 * si no, lanza ErrorDif con lo que esperaba y lo que encontro: nada se aplica a medias. Devuelve el SQL nuevo (saltos \n).
 */
function aplicarHunks(sql, hunks, { query = '' } = {}) {
  const L = lineas(sql); const previo = [...hunks].sort((a, b) => a.linea - b.linea);
  for (let i = 1; i < previo.length; i++) if (previo[i].linea < previo[i - 1].linea + previo[i - 1].viejas.length) throw new ErrorDif(`${query}: los cambios en L${previo[i - 1].linea} y L${previo[i].linea} se pisan`);
  for (const h of previo) {
    h.viejas.forEach((v, k) => {
      const hay = L[h.linea - 1 + k];
      if (hay === undefined || norm(hay) !== norm(v)) throw new ErrorDif(`${query} L${h.linea + k}: esperaba «${norm(v).slice(0, 90)}» y hay «${norm(hay === undefined ? '(no hay línea)' : hay).slice(0, 90)}»`);
    });
  }
  const R = [...L];
  for (const h of [...previo].reverse()) R.splice(h.linea - 1, h.viejas.length, ...h.nuevas);   // de abajo hacia arriba: los numeros de las de arriba no se mueven
  return R.join('\n');
}

/** Lineas del SQL (1-based) que mencionan alguno de los tokens, sin distinguir mayusculas: [{ linea, token }]. */
function menciones(sql, tokens) {
  const out = [];
  lineas(sql).forEach((l, i) => { for (const t of tokens) if (l.toLowerCase().includes(String(t).toLowerCase())) { out.push({ linea: i + 1, token: t }); break; } });
  return out;
}

module.exports = { ErrorDif, parsearBloques, aplicarHunks, menciones, norm };
