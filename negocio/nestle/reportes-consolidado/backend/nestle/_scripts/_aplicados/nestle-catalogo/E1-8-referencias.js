// E1.8 + E1.9 · `Catalogo_Referencias` — JSON autoridad, hoja vista, guardián que bloquea.
//
// 🔴 LA PREGUNTA DE RICK, y su respuesta técnica: «todo a un solo catálogo, a menos que me
//    asegures que no se va a perder el skill entre esos dos catálogos».
//
//    Fusionar TODO en `Catalogo_Piezas` no se puede sin romper algo: de las 265 filas, **178 son
//    N:M** — un alias como `aon-rn-marzo-purchase → AON` pertenece a la CAMPAÑA, no a una pieza.
//    Meterlo como columna lo repetiría en 77 filas y **no habría un solo lugar donde corregirlo**.
//    Eso es la definición de dato duplicado, y es justo lo que costó las 16 discrepancias entre
//    `Content_Name` y `EmailName`.
//
// 🔴 LA GARANTÍA QUE SÍ SE PUEDE DAR: **un dato, una autoridad.** Los skills leen SOLO el JSON, así
//    que nunca eligen entre dos catálogos porque solo conocen uno. La hoja se conserva como el
//    tablero de Rick, y un guardián BLOQUEA si hoja y JSON no dicen lo mismo.
//
// 🔴 Y LAS EXCLUSIONES SALEN (1.9): 21 filas de «excluido» NO son referencias, son DECISIONES de
//    qué no cuenta. Van a su propio contrato, con motivo y fecha — nunca se excluye en silencio.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var XLSX = require('xlsx');
var CB = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-cambios.js');
var L = require(os.homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-flexible.js');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var PROY = os.homedir() + '/OneDrive - OneWorkplace/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

console.log('════════ E1.8+1.9 · REFERENCIAS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var R = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Referencias'], { defval: '', blankrows: false });
console.log('  la hoja: ' + R.length + ' filas');

// ── clasificar por naturaleza
var alias = [], vocab = [], excl = [], otras = [];
R.forEach(function (r, i) {
  var tipo = t(r['Tipo']).toLowerCase();
  var fila = { fila: i + 2, tipo: t(r['Tipo']), dimension: t(r['Dimension']),
    valor_crudo: t(r['Valor_Crudo']), valor_canonico: t(r['Valor_Canonico']),
    contexto: t(r['Contexto']), fuente: t(r['Fuente']), notas: t(r['Notas']),
    n_piezas: Number(r['N_Piezas']) || 0, pieza_ids: t(r['Pieza_IDs']).split(/\s+/).filter(Boolean) };
  if (tipo === 'excluido') excl.push(fila);
  else if (tipo === 'alias') alias.push(fila);
  else if (tipo === 'vocabulario') vocab.push(fila);
  else otras.push(fila);
});
console.log('     alias (crudo→canónico): ' + alias.length);
console.log('     vocabulario (listas cerradas): ' + vocab.length);
console.log('     🔴 exclusiones (DECISIONES, no referencias): ' + excl.length);
console.log('     otras: ' + otras.length);

// ── cuántas son 1:1 y cuántas N:M — el dato que decide qué se puede fusionar
var unoAUno = R.filter(function (r) { return t(r['Pieza_IDs']).split(/\s+/).filter(Boolean).length === 1; }).length;
var nAM = R.filter(function (r) { return t(r['Pieza_IDs']).split(/\s+/).filter(Boolean).length > 1; }).length;
console.log('\n  1:1 con UNA pieza: ' + unoAUno + '   ·   N:M (varias): ' + nAM);
console.log('  → las N:M no caben como columna: repetir el valor destruye el único lugar donde corregirlo');

// ══ EL JSON AUTORIDAD ══
var normalizacion = {
  paso: 'E1.8', fecha: '2026-08-24',
  que_es: 'La AUTORIDAD UNICA de normalizacion: crudo -> canonico. Los skills leen SOLO de aqui.',
  garantia: 'Un skill nunca elige entre dos catalogos porque solo conoce uno. La hoja Catalogo_Referencias es una VISTA, y un guardian bloquea si no coinciden.',
  puente_con_el_catalogo: ['Pieza_IDs', 'Dimension', 'Valor_Canonico'],
  ojo_pieza_ids: 'La columna Pieza_IDs de la hoja esta TRUNCADA en 25 de 265 filas (dice N_Piezas=77 y lista 9). ' +
    'Es una MUESTRA para leer, no una llave foranea: el puente real se reconstruye desde el catalogo ' +
    'buscando que piezas tienen ese Valor_Canonico en esa Dimension.',
  alias: {}, vocabulario: {}
};
// 🔴 UN ALIAS NO ES GLOBAL: ES CONTEXTUAL. Medido en la hoja: `N/A` resuelve a `E-P4` en el
//    contexto «AON · Career Focused» y a `E-P3` en «AON · New Parents». `Único` aparece 4 veces con
//    canónicos distintos, `E-P1` dos veces. Usar el valor crudo como llave los colapsaba: de 129
//    alias solo sobrevivían 113, y los 16 perdidos eran justo los ambiguos.
//
//    La llave real es **Dimension + Valor_Crudo + Contexto**, y eso es exactamente la «escalera de
//    alias» que el proyecto ya tenía documentada: canónico → campaña·segmento → campaña → utm →
//    global. El contexto es el escalón que desambigua.
normalizacion.escalera = ['canonico', 'campana_segmento (contexto)', 'campana', 'utm', 'global', 'FRENA: no se adivina'];
normalizacion.llave_del_alias = 'Dimension + Valor_Crudo + Contexto — un alias NO es global';
alias.forEach(function (a) {
  var d = a.dimension || 'sin_dimension';
  var k = a.valor_crudo + (a.contexto ? ' @ ' + a.contexto : '');
  (normalizacion.alias[d] = normalizacion.alias[d] || {})[k] = {
    crudo: a.valor_crudo, contexto: a.contexto || null,
    canonico: a.valor_canonico, fuente: a.fuente,
    n_piezas: a.n_piezas,
    // 🔴 `Pieza_IDs` de la hoja está TRUNCADO (dice N_Piezas=77 y lista 9). Es una muestra para
    //    leer, NO una llave foránea. El puente real se reconstruye desde el catálogo.
    piezas_muestra: a.pieza_ids, piezas_truncado: a.n_piezas > a.pieza_ids.length
  };
});
vocab.forEach(function (v) {
  var d = v.dimension || 'sin_dimension';
  (normalizacion.vocabulario[d] = normalizacion.vocabulario[d] || []).push({
    valor: v.valor_canonico, fuente: v.fuente, n_piezas: v.n_piezas
  });
});

// ══ EL CONTRATO DE EXCLUSIONES (1.9) ══
var exclusiones = {
  paso: 'E1.9', fecha: '2026-08-24',
  que_es: 'Las DECISIONES de que NO cuenta. No son referencias: son decisiones, y por eso viven aparte.',
  regla: 'Toda exclusion lleva motivo escrito. Nunca se excluye trafico en silencio.',
  por_dimension: {}
};
excl.forEach(function (e) {
  var d = e.dimension || 'sin_dimension';
  (exclusiones.por_dimension[d] = exclusiones.por_dimension[d] || []).push({
    valor: e.valor_crudo || e.valor_canonico, motivo: e.notas || e.contexto || '(sin motivo escrito)',
    fuente: e.fuente, piezas: e.pieza_ids
  });
});
var sinMotivo = excl.filter(function (e) { return !t(e.notas) && !t(e.contexto); });

console.log('\n══ el JSON autoridad ══');
console.log('     alias por dimensión: ' + Object.keys(normalizacion.alias).map(function (d) { return d + ':' + Object.keys(normalizacion.alias[d]).length; }).join(' · '));
console.log('     vocabulario: ' + Object.keys(normalizacion.vocabulario).map(function (d) { return d + ':' + normalizacion.vocabulario[d].length; }).join(' · '));
console.log('\n══ el contrato de exclusiones ══');
Object.keys(exclusiones.por_dimension).forEach(function (d) {
  console.log('     ' + d.padEnd(16) + exclusiones.por_dimension[d].length + ' exclusión(es)');
});
console.log('     ' + (sinMotivo.length ? '🔴 ' + sinMotivo.length + ' SIN motivo escrito' : '✔ todas con motivo'));
if (sinMotivo.length) sinMotivo.slice(0, 6).forEach(function (e) {
  console.log('        🔴 ' + t(e.dimension).padEnd(14) + '«' + (e.valor_crudo || e.valor_canonico) + '»');
});

if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }
fs.writeFileSync(BACK + '/_contratos/normalizacion.json', JSON.stringify(normalizacion, null, 1));
fs.writeFileSync(BACK + '/_contratos/exclusiones.json', JSON.stringify(exclusiones, null, 1));
console.log('\n  → _contratos/normalizacion.json  (' + alias.length + ' alias · ' + vocab.length + ' vocabulario)');
console.log('  → _contratos/exclusiones.json    (' + excl.length + ' decisiones)');
console.log('\n  ⚠ la hoja NO se toca: es la vista. El guardián E1-8-99 la contrasta contra el JSON.');
