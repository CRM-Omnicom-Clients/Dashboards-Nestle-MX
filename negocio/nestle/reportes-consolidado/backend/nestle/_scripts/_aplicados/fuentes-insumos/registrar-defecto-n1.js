// Registra en `_catalogo/defectos-detectados.json` el defecto que N2a encontró en N1.
// Append-only, igual que conflictos.json: un defecto que no se escribe se re-investiga cada
// sesión, y este en particular es invisible desde N1 —sus suites validan totales, y los
// totales cuadran—. Solo aparece al cruzar envío contra pieza, o sea desde el paso siguiente.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var P = os.homedir() + '/.claude/reportes-backend/nestle/_catalogo/defectos-detectados.json';
var D = [];
try { D = JSON.parse(fs.readFileSync(P, 'utf8')); } catch (e) { }

var nuevo = {
  id: 'DEF-N1-001',
  detectado_por: 'N2a · N2a-97-refutar.js (check C4)',
  detectado_el: '2026-08-19',
  nodo_afectado: 'N1 · catálogo raíz',
  hoja: 'Catalogo_Piezas',
  que: 'seis piezas listan en Content_Names_Variantes content_names que no les pertenecen',
  piezas: ['001-P023', '001-P024', '001-P025', '001-P026', '001-P027', '001-P028'],
  patron: 'cada una es el duplicado de una-quincena de una pieza multi-quincena: 001-P005 cubre 2026-03-Q2 ; 2026-04-Q2 y 001-P025 solo 2026-03-Q2, con el MISMO Content_Name canónico',
  lo_que_esta_bien: {
    total_catalogo: 6454554,
    total_data_email: 6454554,
    envios_huerfanos: 0,
    nota: 'la columna Sends de cada pieza es correcta. El defecto NO mueve ninguna cifra agregada.'
  },
  lo_que_esta_mal: {
    envios_reclamados_por_dos_piezas: 8,
    sends_que_se_inflarian: 223790,
    porcentaje: '3.5% del total',
    cuando_haria_daño: 'cuando un paso atribuya envío→pieza recorriendo Content_Names_Variantes y sume por esa vía'
  },
  por_que_las_suites_de_N1_no_lo_vieron:
    'validan totales y cuadres agregados, y los agregados están correctos. El defecto solo aparece al cruzar cada envío contra su pieza — es decir, desde el paso siguiente. Es la lección de siempre: la prueba que no es circular es simular el consumidor.',
  mitigacion_ya_aplicada: {
    donde: 'N2a-97-refutar.js · function atribuir()',
    cascada: ['1 · content_name canónico', '2 · canónico + sends', '3 · variante única', '4 · variante + sends', 'AMBIGUA → se declara con candidatas, no se fuerza'],
    resultado: 'de 8 ambiguos con cruce ingenuo a 2 con la cascada (0.76% de 264)',
    residuo: ['001-P005/001-P025', '001-P006/001-P027']
  },
  arreglo_de_raiz: 'quitar de Content_Names_Variantes de las 6 piezas los content_names que ya tienen dueño canónico en otra pieza, o eliminar las piezas duplicadas de una-quincena si el diseño acordado es UNA pieza multi-quincena con columnas de reparto.',
  estado: 'ABIERTO · requiere escribir en Catalogo_Piezas → decisión de Rick, no se toca sin su OK'
};

if (!D.some(function (x) { return x.id === nuevo.id; })) D.push(nuevo);
fs.writeFileSync(P, JSON.stringify(D, null, 1));
console.log('registrado: ' + nuevo.id + '  ·  defectos en el archivo: ' + D.length);
console.log('  → ' + P);
