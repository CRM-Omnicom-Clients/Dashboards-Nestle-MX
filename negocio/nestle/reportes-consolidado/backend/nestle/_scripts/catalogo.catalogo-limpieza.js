// N1g · LA LIMPIEZA DEL CATÁLOGO — etapa 4, dentro del skill `crm-reporte-nestle-catalogo`.
//
// Hace SU parte de la etapa 3, y solo la suya:
//   3.1 · fusionar `EmailID` en `Email_ID (de la DE de SFMC)` SIN perder datos
//   3.2 · los códigos de Qcart que viven en `Email_Name_Legacy` van a su columna
//   3.5 · revisar SUS celdas vacías y decidir `N/A` o `POR DEFINIR`, con su razón
//
// 🔴 LA REGLA DE RICK PARA FUSIONAR (25-ago): «cuando es la vieja y la nueva **siempre se quedan
//    ambos**. O varios.» Fusionar NO es elegir un valor: la columna única se queda con TODOS los
//    valores distintos que existían, separados por ` · `. Elegir uno sería decidir por él en un
//    dato que discrepa — y la discrepancia es información, no ruido.
//
// 🔴 Y `Email_Name_Legacy` NO ES UNA VIEJA/NUEVA. Se midió: de sus 35 diferencias, **4** son el
//    mismo email name con otro ID final —esas sí se fusionan— y **31 son de WhatsApp y traen
//    CÓDIGOS DE QCART** (`wa-cooking1`, `sbH9gVge`). Meter eso en `Email_Name` pondría un dato de
//    otra naturaleza en la columna de nombres. Rick lo resolvió: van a su columna de códigos.
//
// 🔴 NO ESCRIBE EL EXCEL. Deja todo pre-escrito para que se pueda revisar antes. El escritor aplica.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var L = require(__dirname + '/lib-flexible.js');
var V = require(__dirname + '/lib-vacios.js');
var CB = require(__dirname + '/lib-cambios.js');
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };

var VIVA_ID = 'Email_ID (de la DE de SFMC)', FANT_ID = 'EmailID';
var VIVA_NM = 'Email_Name', FANT_NM = 'Email_Name_Legacy (duplicada, no usar)';
var COL_CODIGOS = 'Codigos_Qcart';   // 🔴 la columna a la que van los códigos de WhatsApp

console.log('════════ N1g · LIMPIEZA DEL CATÁLOGO ' + (ESCRIBIR ? '(apunta)' : '(seco)') + ' ════════\n');
CB.descartarNodo('N1g');
var wb = XLSX.readFile(L.archivoVivo({ dir: PROY }).ruta);
var enc = (XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { header: 1 })[0] || []).map(t);
var F = XLSX.utils.sheet_to_json(wb.Sheets['Catalogo_Piezas'], { defval: '', blankrows: false });
console.log('  Catalogo_Piezas: ' + F.length + ' filas · ' + enc.filter(Boolean).length + ' columnas\n');

// ── 3.1 · fusionar los IDs ────────────────────────────────────────────────────────────
console.log('  ══ 3.1 · «' + FANT_ID + '» → «' + VISTA(VIVA_ID) + '» ══');
function VISTA(s) { return s; }
var fus1 = [], amb1 = 0;
F.forEach(function (f, i) {
  var viva = t(f[VIVA_ID]), fant = t(f[FANT_ID]);
  if (!fant) return;                                  // la fantasma no aporta
  if (viva === fant) return;                          // idénticos: nada que hacer
  if (!viva) { fus1.push({ fila: i + 2, de: '(vacío)', a: fant, tipo: 'la viva estaba vacía' }); return; }
  // 🔴 discrepan → SE QUEDAN LOS DOS
  amb1++;
  fus1.push({ fila: i + 2, de: viva, a: viva + ' · ' + fant, tipo: 'discrepan: se quedan ambos', pieza: t(f['Pieza_ID']) });
});
console.log('     celdas que se llenan con el valor de la vieja: ' + fus1.filter(function (x) { return x.tipo.indexOf('vacía') >= 0; }).length);
console.log('     🔴 celdas donde discrepan → se quedan AMBOS:    ' + amb1);
fus1.filter(function (x) { return x.tipo.indexOf('ambos') >= 0; }).forEach(function (x) {
  console.log('        fila ' + x.fila + '  ' + (x.pieza || '') + '  «' + x.de + '»  →  «' + x.a + '»');
});
console.log('     tras fusionar, «' + FANT_ID + '» no aporta nada: se retira.\n');

// ── 3.2 · los códigos de Qcart de WhatsApp ────────────────────────────────────────────
console.log('  ══ 3.2 · «' + FANT_NM + '» ══');
function esEmailName(s) { return /^[JO]_/.test(s) || /_EM_/.test(s); }
var aCodigos = [], aNombre = [], iguales = 0;
F.forEach(function (f, i) {
  var viva = t(f[VIVA_NM]), fant = t(f[FANT_NM]);
  if (!fant) return;
  if (viva === fant) { iguales++; return; }
  if (!esEmailName(fant)) {
    // no es un email name: es un código de Qcart (o varios)
    aCodigos.push({ fila: i + 2, pieza: t(f['Pieza_ID']), canal: t(f['Canal']), valor: fant });
  } else {
    // sí es un email name y discrepa → se quedan ambos
    aNombre.push({ fila: i + 2, pieza: t(f['Pieza_ID']), de: viva, a: viva + ' · ' + fant });
  }
});
console.log('     idénticas (la fantasma no aporta):            ' + iguales);
console.log('     🔴 códigos de Qcart → «' + COL_CODIGOS + '»:  ' + aCodigos.length);
aCodigos.slice(0, 4).forEach(function (x) { console.log('        ' + x.pieza.padEnd(10) + x.canal.padEnd(10) + '«' + x.valor.slice(0, 44) + '»'); });
console.log('     email names que discrepan → se quedan ambos:  ' + aNombre.length);
aNombre.forEach(function (x) { console.log('        ' + x.pieza.padEnd(10) + '…' + x.de.slice(-28) + '  +  …' + x.a.slice(-14)); });
console.log('     tras esto, «' + FANT_NM + '» no aporta nada: se retira.\n');

// ── 3.5 · SUS celdas vacías ───────────────────────────────────────────────────────────
// 🔴 LAS REGLAS LAS PONE ESTE SKILL, porque es el que sabe de estas columnas. Cada una devuelve
//    la RAZÓN por la que no aplica —que es lo que la convierte en `N/A`— o `null` si sí aplica.
var REGLAS = {
  'Email_Name': function (f) { return /whats/i.test(t(f['Canal'])) ? 'las piezas de WhatsApp no tienen email name' : null; },
  'Email_ID (de la DE de SFMC)': function (f) { return /whats/i.test(t(f['Canal'])) ? 'el Email_ID lo emite SFMC: WhatsApp no pasa por ahí' : null; },
  'Content_ID (final del Email_Name)': function (f) { return /whats/i.test(t(f['Canal'])) ? 'se deriva del email name, que WhatsApp no tiene' : null; },
  'Pieza_Principal_ID': function (f) { return !/fup/i.test(t(f['Email_Type'])) ? 'solo un FUP declara a su Principal' : null; },
  'Subsegmento': function (f) { return 'el subsegmento solo existe donde el segmento se desambigua (Pro Plan · especie)'; },
  'Fecha_Ultimo_Envio': function (f) { return t(f['Sends']) === '0' ? 'la pieza no llegó a enviarse' : null; }
};
var rev = V.revisar('Catalogo_Piezas', F, enc.filter(Boolean), REGLAS, {
  saltarColumnas: [FANT_ID, FANT_NM]     // se van a retirar: no se rellenan
});
console.log('  ══ 3.5 · celdas vacías de Catalogo_Piezas ══');
console.log('     total: ' + rev.celdas.length + '   →   N/A ' + rev.na + '   ·   POR DEFINIR ' + rev.porDefinir);
console.log('     de esas, sin que nadie declarara nada: ' + rev.sinDeclarar);
var top = V.listaParaRick([rev]).slice(0, 10);
if (top.length) {
  console.log('\n     las columnas que quedan en POR DEFINIR:');
  top.forEach(function (x) { console.log('        ' + String(x.filas).padStart(4) + '  ' + x.columna.padEnd(34) + (x.declarada ? '' : '⚠ sin declarar')); });
}

fs.writeFileSync(BACK + '/_contratos/limpieza-catalogo.json', JSON.stringify({
  paso: 'N1g', regla_fusion: 'vieja y nueva: SE QUEDAN AMBOS (Rick, 25-ago)',
  fusion_ids: fus1, a_codigos: aCodigos, a_nombre: aNombre, vacios: rev
}, null, 1));
console.log('\n  → _contratos/limpieza-catalogo.json');
if (!ESCRIBIR) { console.log('\n  (seco. Para apuntar: --escribir)'); process.exit(0); }

// ── apuntar (no escribe: el escritor aplica) ──────────────────────────────────────────
// el lote anterior se aplicó y se cerró; este corte abre el suyo
try { CB.abrir('WK35-limpieza'); } catch (e) { }

// 🔴 PRIMERO SE CREA LA COLUMNA, LUEGO SE LLENA. Apuntar valores para una columna que no existe
//    deja al escritor con celdas sin destino — y con razón se niega. Crear va antes que llenar.
if (aCodigos.length && enc.indexOf(COL_CODIGOS) < 0) {
  CB.apuntarColumna('N1g', 'Catalogo_Piezas', COL_CODIGOS,
    'los codigos de Qcart que vivian en Email_Name_Legacy: son codigos, no nombres de email. Rick, 25-ago.');
}

fus1.forEach(function (x) { CB.apuntar('N1g', 'Catalogo_Piezas', x.fila, VIVA_ID, x.a, 'fusión de la fantasma EmailID · ' + x.tipo); });
aNombre.forEach(function (x) { CB.apuntar('N1g', 'Catalogo_Piezas', x.fila, VIVA_NM, x.a, 'fusión de Email_Name_Legacy · discrepan, se quedan ambos'); });
aCodigos.forEach(function (x) { CB.apuntar('N1g', 'Catalogo_Piezas', x.fila, COL_CODIGOS, x.valor, 'código(s) de Qcart que estaban en Email_Name_Legacy · pieza de ' + x.canal); });
// 🔴 LOS VACÍOS VAN APARTE. Con `--vacios` se apuntan; sin él, solo la fusión. Son dos decisiones
//    distintas y mezclarlas haría imposible revisar una sin la otra.
if (process.argv.indexOf('--vacios') >= 0) {
  rev.celdas.forEach(function (x) { CB.apuntar('N1g', 'Catalogo_Piezas', x.fila, x.columna, x.valor, x.razon); });
}
var res = CB.resumen();
console.log('\n  ── apuntado. Acumulado: ' + res.total + ' celdas · choques: ' + res.choques);
console.log('     fusión de IDs: ' + fus1.length + ' · nombres: ' + aNombre.length + ' · códigos a «' + COL_CODIGOS + '»: ' + aCodigos.length);
console.log('     vacíos: ' + (process.argv.indexOf('--vacios') >= 0 ? rev.celdas.length + ' apuntados' : 'NO (usa --vacios)'));
console.log('  ⚠ tras aplicar, «' + FANT_ID + '» y «' + FANT_NM + '» ya no aportan: se retiran en un script aparte.');
