/*
 * catalogo.contrato-consumo.js — EL CONTRATO PARA QUIEN LEE EL CATÁLOGO DESDE FUERA.
 *
 * Rick, 21-sep: «¿cómo hacemos para que lo que se deba aclarar en catálogo se aclare, y luego
 * crear las reglas para que la otra sesión sepa qué tomar?»
 *
 * 🔴 SON DOS COSAS DISTINTAS Y VAN EN DOS ARCHIVOS DISTINTOS:
 *      · `consumo-catalogo.json`    — lo que YA está decidido: qué se puede tomar y cómo cruzarlo.
 *      · `decisiones-abiertas.json` — lo que FALTA decidir, con `decision: null` hasta que Rick
 *                                     la llene. Nadie más la llena, y nadie adivina mientras.
 *    Mezclarlas haría que una duda abierta se leyera como una regla, que es justo como se cuelan
 *    las atribuciones inventadas.
 *
 * 🔴 EL CONTRATO SE GENERA, NO SE ESCRIBE. Un contrato a mano se desfasa en cuanto cambia el
 *    catálogo y entonces miente con autoridad — ya pasó con el mapa de la cadena y con
 *    `estado-reportes.md`, que dijo «v7 · WK31» durante dos meses. Aquí cada cifra se MIDE del
 *    archivo vivo en el momento de generar, y va con su huella.
 *
 * 🔴 LA HUELLA ES LO QUE HACE QUE EL CONTRATO NO SE PUEDA USAR VIEJO. Lleva el número de filas,
 *    de piezas y la suma de Sends. El consumidor compara: si no cuadra, está leyendo otro
 *    catálogo y debe REGENERAR en vez de confiar. Sin esto, el reconciliador de Treasure Data
 *    del 14-sep siguió citando 4 piezas que ya se habían retirado.
 *
 * 🔴 Y UNA DECISIÓN ABIERTA SE MIDE, NO SE RECUERDA. Cada una trae un check contra el catálogo
 *    vivo; si el check dice que ya no aplica, se marca `resuelta_en_el_archivo` sola. Las que no
 *    se pueden medir desde el catálogo (viven en el CDP) se declaran `NO_MEDIBLE_AQUI` — que no
 *    es lo mismo que «pasa».
 *
 *   node catalogo.contrato-consumo.js              (genera y muestra)
 *   node catalogo.contrato-consumo.js --verificar  (¿el contrato en disco sigue vigente?)
 */
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');

var XLSX = require('xlsx'), fs = require('fs'), os = require('os');
var BACK = require('path').resolve(__dirname, '..');
var COL = require(BACK + '/_scripts/lib-columna.js');
var PZ = require(BACK + '/_scripts/lib-es-pieza.js');
var AMBITO = 'catalogo';
var PROY = ENT.PROYECTO;
var VIVO = ENT.LIBRO;
var VERIFICAR = process.argv.indexOf('--verificar') >= 0;
var t = function (v) { return String(v == null ? '' : v).trim(); };
var num = function (v) { var n = Number(t(v).replace(/[,$\s]/g, '')); return isFinite(n) ? n : 0; };

var tmp = require('path').resolve(__dirname, '..') + '/_tmp/_contrato.xlsx';
fs.copyFileSync(VIVO, tmp);
var C = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets['Catalogo_Piezas'], { defval: '' });
function N(id) { return COL.de(C, id, AMBITO); }
var cols = { id: N('Pieza_ID'), canal: N('Canal'), touchpoint: N('TouchPoint') };
/* 🔴 EL NOMBRE DEL EMAIL SE PIDE POR SU ID LÓGICO, NO POR SU NOMBRE FÍSICO.
   Pedir «Email_Name» resuelve a la entrada RETIRADA `catalogo.emailname`
   («Email_Name_Legacy (duplicada, no usar)»), porque `plano()` colapsa `Email_Name` y
   `emailname` al mismo texto. El id inmutable es `catalogo.content_name`; su nombre físico
   cambió de `Content_Name` a `Email_Name`, y ese cambio vive en el registro — que es
   exactamente para lo que existe el registro. */
var cNOM = COL.de(C, 'catalogo.content_name');
var cSENDS = N('Sends'), cCAMP = N('Campa' + 'ña'), cSEG = N('Segmento'), cTIPO = N('Email_Type');

var U = PZ.universo(C, cols);
var sends = C.reduce(function (a, p) { return a + num(p[cSENDS]); }, 0);
var huella = { filas: C.length, piezas: U.piezas.length, email: U.email.length, whatsapp: U.whatsapp.length, no_piezas: U.no_piezas.length, suma_sends: sends };

console.log('════════ CONTRATO DE CONSUMO DEL CATÁLOGO ════════\n');
console.log('  filas en la hoja      ' + huella.filas);
console.log('  piezas de verdad      ' + huella.piezas + '   (Email ' + huella.email + ' · WhatsApp ' + huella.whatsapp + (U.sin_canal.length ? ' · SIN CANAL ' + U.sin_canal.length : '') + ')');
console.log('  NO son piezas         ' + huella.no_piezas);
U.no_piezas.forEach(function (x) { console.log('       f' + String(x.i).padEnd(4) + '«' + x.texto + '»   → ' + x.veredicto.motivo); });
console.log('  Σ Sends               ' + sends.toLocaleString('es-MX'));

// ══ LAS DECISIONES ABIERTAS, CADA UNA CON SU CHECK CONTRA EL CATÁLOGO VIVO ═══════════
function pieza(id) { return C.filter(function (p) { return t(p[cols.id]) === id; })[0] || null; }
function nombresDePieza(id) { var p = pieza(id); return p ? PZ.nombresDe(p[cNOM]) : []; }

var DECISIONES = [
  {
    id: 'D1', titulo: 'Las gemelas de Traditional Parents: el mismo envío bajo dos nombres',
    que_hay_que_aclarar: '¿001-P005/P006 y 001-P025/P027 son la misma pieza? SFMC publica el envío bajo el nombre con journey 863587 (el de P025/P027); el catálogo guarda además el de 803867 (P005/P006), que NO existe en el CDP.',
    impacto_si_no_se_decide: 'Sumar las cuatro cuenta el mismo envío dos veces: 37,374 + 38,093 para un solo envío de Principal. El dashboard lo va a reportar inflado.',
    opciones: ['retirar P005/P006 y dejar P025/P027', 'retirar P025/P027 y corregir el Email_Name de P005/P006', 'declararlas variantes de una misma pieza y sumar UNA sola vez'],
    ojo: 'hay 4,085 referencias vivas a esos ids — no se retira nada sin las 5 pruebas de `catalogo.probar-gemelas.js`',
    quien_la_toma: 'Rick', bloquea_a: ['dashboard Treasure Data', 'sesión SFMC'],
    check: function () {
      var a = nombresDePieza('001-P005'), b = nombresDePieza('001-P025');
      if (!a.length || !b.length) return { abierta: false, porque: 'alguna de las dos ya no está en el catálogo' };
      var chocan = a.some(function (x) { return b.some(function (y) { return PZ.mismoNombre(x, y); }); });
      return { abierta: !chocan, porque: chocan ? 'ya comparten nombre normalizado: la duplicidad está declarada' : 'siguen con nombres distintos y ambas con Sends' };
    }
  },
  {
    id: 'D2', titulo: 'E-J8 lleva el Email_Name de J7',
    que_hay_que_aclarar: '005-P012 (E-J8) tiene como Email_Name «…LIGAMX-J7-B-C…_0359270 - 202609», que es el nombre de 005-P010 (E-J7). ¿Cuál es el nombre real del J8 en SFMC?',
    impacto_si_no_se_decide: 'Cualquier cruce por Email_Name pisa J7 con J8. El dashboard va a atribuir los envíos de una jornada a la otra y la suma va a cuadrar igual.',
    opciones: ['corregir el Email_Name de 005-P012 con el que SFMC publica para J8', 'declarar que J8 se envió bajo el nombre de J7 (reuso) y marcarlo'],
    quien_la_toma: 'Rick + quien creó el envío en SFMC', bloquea_a: ['dashboard Treasure Data'],
    check: function () {
      var j7 = nombresDePieza('005-P010'), j8 = nombresDePieza('005-P012');
      if (!j7.length || !j8.length) return { abierta: false, porque: 'alguna de las dos ya no está' };
      var choca = j8.some(function (x) { return j7.some(function (y) { return PZ.mismoNombre(x, y); }); });
      return { abierta: choca, porque: choca ? 'J8 sigue apuntando al nombre de J7' : 'ya tienen nombres distintos' };
    }
  },
  {
    id: 'D3', titulo: 'El FUP de E-PROP1: 158,056 en el catálogo vs 1,286,701 en el CDP',
    que_hay_que_aclarar: '¿El nombre del FUP (001-P033) está capturando el blast del 2-sep (1,172,646 envíos en un día)? El Principal 001-P032 tiene 1,337,766.',
    impacto_si_no_se_decide: 'Son ~1.13M envíos cuya atribución entre Principal y FUP no está resuelta. Es la discrepancia más grande del reconciliador (+714%).',
    opciones: ['partir por JobID y día en el CDP y repartir', 'declarar que el nombre del FUP se reusó y no sirve como llave'],
    ojo: 'NO se resuelve por Email_Name: se resuelve por JobID/día. El blast fue el job 1292673.',
    quien_la_toma: 'Rick', bloquea_a: ['dashboard Treasure Data'],
    check: function () { return { abierta: null, porque: 'NO_MEDIBLE_AQUI — la evidencia vive en el CDP, no en el catálogo' }; }
  },
  {
    id: 'D4', titulo: 'Mundial E-P2 × Modern Cooking sigue POR DEFINIR',
    que_hay_que_aclarar: '004-P020 no tiene Email_Name ni Sends. Es la pieza que faltaba y cuyos ~49 carritos estaban cayendo dentro de Bebidas.',
    impacto_si_no_se_decide: 'Sus carritos se atribuyen al segmento de al lado y la suma cuadra igual — ninguna puerta lo ve.',
    opciones: ['darle de alta su Email_Name real', 'declarar que esa pieza nunca se envió y marcarla N/A'],
    quien_la_toma: 'Rick', bloquea_a: ['reporte Qcart', 'dashboard Treasure Data'],
    check: function () {
      var p = pieza('004-P020');
      if (!p) return { abierta: false, porque: 'ya no está en el catálogo' };
      var n = PZ.nombresDe(p[cNOM]);
      return { abierta: !n.length, porque: n.length ? 'ya tiene Email_Name' : 'sigue sin Email_Name' };
    }
  },
  {
    id: 'D5', titulo: 'w5r9LWOP: un shortlink de WhatsApp dentro de una pieza de email',
    que_hay_que_aclarar: 'El código está declarado en el maestro (Junio f23) con utm «wa-bebida1» (WhatsApp) pero vive en el catálogo de 004-P003, que es Email. Además el maestro lo marca «No se envío a Qcart» y tiene 0 carritos.',
    impacto_si_no_se_decide: 'Hoy no mueve ninguna cifra (0 carritos), pero si algún día genera tráfico se atribuiría a email lo que es de WhatsApp.',
    opciones: ['quitarlo de la pieza de email', 'dejarlo y declarar que fue un reuso deliberado'],
    quien_la_toma: 'Rick', bloquea_a: [],
    check: function () {
      var hit = C.filter(function (p) {
        if (t(p[cols.canal]) !== 'Email') return false;
        return Object.keys(p).some(function (k) { return /^Cod_/.test(k) && t(p[k]) === 'w5r9LWOP'; });
      });
      return { abierta: hit.length > 0, porque: hit.length ? 'sigue en la pieza de email ' + t(hit[0][cols.id]) : 'ya no está en ninguna pieza de email' };
    }
  },
  {
    id: 'D6', titulo: '009-P003: una variante del CDP con 22,819 envíos contra 180 del catálogo',
    que_hay_que_aclarar: 'El reconciliador reporta «Sends CDP (var.) 22,819» para una pieza de Pro Plan cuyo catálogo dice 180. Es 126× más grande.',
    impacto_si_no_se_decide: 'O la variante está mal emparejada, o hay un envío grande sin registrar en el catálogo.',
    opciones: ['revisar qué Email_Name está casando como variante', 'dar de alta la pieza que falte'],
    quien_la_toma: 'Rick', bloquea_a: ['dashboard Treasure Data'],
    check: function () { return { abierta: null, porque: 'NO_MEDIBLE_AQUI — la evidencia vive en el CDP' }; }
  }
];

console.log('\n── DECISIONES ABIERTAS (medidas contra el catálogo de hoy) ──');
var salida = DECISIONES.map(function (d) {
  var r = d.check();
  var estado = r.abierta === null ? 'NO_MEDIBLE_AQUI' : (r.abierta ? 'ABIERTA' : 'resuelta_en_el_archivo');
  console.log('  ' + d.id + '  ' + (r.abierta === null ? '·' : (r.abierta ? '🔴' : '✔')) + ' ' + estado.padEnd(22) + d.titulo);
  console.log('        ' + r.porque);
  return {
    id: d.id, titulo: d.titulo, estado: estado, medicion: r.porque,
    que_hay_que_aclarar: d.que_hay_que_aclarar, impacto_si_no_se_decide: d.impacto_si_no_se_decide,
    opciones: d.opciones, ojo: d.ojo || null, quien_la_toma: d.quien_la_toma, bloquea_a: d.bloquea_a,
    decision: null, decidido_por: null, fecha_decision: null
  };
});

// ══ LOS ARCHIVOS ═════════════════════════════════════════════════════════════════════
var CONTRATO = {
  que_es: 'Lo que un consumidor externo (dashboard de Treasure Data, sesión de SFMC) puede tomar del catálogo y cómo cruzarlo. Generado del archivo vivo — no se edita a mano.',
  generado: new Date().toISOString().slice(0, 16).replace('T', ' '),
  // el nombre se PIDE aunque solo se imprima: una narracion que describe el estado vivo miente
  // igual que una ruta en cuanto el archivo se renombra, y este ya cambio una vez (v7 -> v8).
  fuente: require('path').basename(ENT.LIBRO) + ' · hoja Catalogo_Piezas',
  huella: huella,
  como_usar_la_huella: 'Antes de confiar en este contrato, cuenta las filas y sus piezas. Si no coinciden con `huella`, estás leyendo otro catálogo: REGENERA. El reconciliador del 14-sep citaba 4 piezas ya retiradas por no hacer esto.',

  universo: {
    regla: 'Una fila es pieza si su Pieza_ID tiene la forma NNN-PNNN. Lo resuelve `lib-es-pieza.js` — no se reimplementa.',
    no_son_piezas: U.no_piezas.map(function (x) { return { fila: x.i, texto: x.texto, motivo: x.veredicto.motivo }; }),
    por_canal: { Email: { n: U.email.length, fuente: 'SFMC · prod_sfmc_emailengagement.prod_sfmc_sends' },
      WhatsApp: { n: U.whatsapp.length, fuente: 'whatsapp_leads.* — NO vive en SFMC' } },
    sin_canal: U.sin_canal.map(function (x) { return x.id; })
  },

  reglas_de_match: [
    { id: 'M1', regla: 'Cruzar SOLO las piezas de canal Email contra SFMC.', por_que: 'WhatsApp no vive ahí por diseño. Contarlas como «no encontradas» produjo 17 falsas discrepancias de 38.' },
    { id: 'M2', regla: 'Normalizar el Email_Name antes de comparar: quitar el sufijo « - AAAAMM» y el «-B-C».', por_que: 'SFMC publica «…LIGAMX-J9-B-C_AQ…» donde el catálogo guarda el nombre planeado. Es la misma pieza.', mecanismo: 'lib-es-pieza.normalizar()' },
    { id: 'M3', regla: 'Un Email_Name puede traer VARIOS nombres separados por « · ». Se prueban todos.', por_que: 'el catálogo guarda las variantes conocidas de un mismo envío', mecanismo: 'lib-es-pieza.nombresDe()' },
    { id: 'M4', regla: 'Comparar envíos ÚNICOS contra únicos y totales contra totales, nunca cruzado.', por_que: '001-P030 aparece con +89.1% y sus únicos (42,667) coinciden con el catálogo (42,629): es un re-envío a la misma audiencia, no un descuadre.' }
  ],

  lo_que_el_catalogo_garantiza: [
    'Pieza_ID único y estable — es la llave.',
    'Email_Name es la llave natural del envío (probada única).',
    'Las dimensiones (campaña, marca, segmento, objetivo) son la AUTORIDAD: no se deducen del naming.'
  ],
  lo_que_el_catalogo_NO_garantiza: [
    { cosa: 'Sends al día', detalle: 'El catálogo es una FOTO. Las piezas always-on siguen acumulando en el CDP. Una diferencia de 1-3% en always-on es esperada, no un error: compara contra la fecha de corte del catálogo, no contra hoy.' },
    { cosa: 'Los mismos Sends que el CDP', detalle: 'El catálogo RESTA los jobs de prueba (<10 envíos por job, criterio único en lib-fechas-envio.js). El CDP no. Por eso Pro Plan sale +1.6% a +13.2%: son 1 a 5 correos de prueba.' },
    { cosa: 'Que toda pieza tenga Email_Name', detalle: 'Las piezas en POR DEFINIR / PENDIENTE existen porque el doc de Qcart las declara, pero no se han lanzado. No son un error de datos.' },
    { cosa: 'Métricas de WhatsApp', detalle: 'No están en SFMC. Nunca.' }
  ],

  decisiones_abiertas: salida.filter(function (d) { return d.estado !== 'resuelta_en_el_archivo'; }).map(function (d) { return d.id; }),
  regla_de_las_decisiones: 'Mientras una decisión esté ABIERTA, su pieza se consume MARCADA como provisional. No se elige una opción por cuenta propia: elegir sin decidir es inventar una atribución, y la suma cuadra igual.'
};

var REG = {
  que_es: 'Las dudas del catálogo que solo Rick puede cerrar. `decision` se queda en null hasta que él la llene — ningún script la rellena.',
  regla: 'Una decisión abierta se MIDE contra el archivo vivo, no se recuerda. Las que no se pueden medir desde el catálogo se declaran NO_MEDIBLE_AQUI, que no es lo mismo que «pasa».',
  generado: CONTRATO.generado, huella: huella, decisiones: salida
};

if (VERIFICAR) {
  var prev = null;
  try { prev = JSON.parse(fs.readFileSync(BACK + '/_contratos/consumo-catalogo.json', 'utf8')); } catch (e) { }
  if (!prev) { console.log('\n🔴 no hay contrato en disco. Genera uno.'); process.exit(1); }
  var igual = JSON.stringify(prev.huella) === JSON.stringify(huella);
  console.log('\n── verificación de vigencia');
  console.log('   contrato en disco: ' + JSON.stringify(prev.huella));
  console.log('   catálogo de hoy  : ' + JSON.stringify(huella));
  console.log(igual ? '   ✅ VIGENTE' : '   🔴 DESFASADO — el catálogo cambió. Regenera antes de que nadie lo consuma.');
  process.exit(igual ? 0 : 1);
}

fs.writeFileSync(BACK + '/_contratos/consumo-catalogo.json', JSON.stringify(CONTRATO, null, 1));
fs.writeFileSync(BACK + '/_contratos/decisiones-abiertas.json', JSON.stringify(REG, null, 1));
console.log('\n  → _contratos/consumo-catalogo.json');
console.log('  → _contratos/decisiones-abiertas.json');
console.log('\n  ' + CONTRATO.decisiones_abiertas.length + ' decisión(es) sin cerrar: ' + CONTRATO.decisiones_abiertas.join(' · '));
