// FJ · deja el handoff MD+JSON de los pasos que se cerraron en la Fase 2 (G1 · G2 · G3 · I1 · I2).
//
// 🔴 POR QUÉ EN EL PROYECTO Y NO EN EL BACKEND. Lo pidió Rick: «no sé dónde guardas todo y creo
//    que lo puedes perder u olvidar». El backend vive en `~/.claude` —que hoy mismo perdió 113
//    scripts porque una sesión paralela los borró con `rm`— y el proyecto vive en OneDrive, que
//    él ve. Cada paso deja ahí su MD (para el humano) y su JSON (para el paso siguiente).
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var H = require(BACK + '/_scripts/lib-handoff.js');
var CORTE = process.argv[2] || 'WK34-2026';
var CUANDO = process.argv[3] || '20-ago-2026';
function J(p) { try { return JSON.parse(fs.readFileSync(BACK + '/_fuentes/' + p, 'utf8')); } catch (e) { return null; } }
function Jr(p) { try { return JSON.parse(fs.readFileSync(BACK + '/_rejilla/' + p, 'utf8')); } catch (e) { return null; } }

var ver = Jr('veredicto-puerta2.json') || {};
var dif = J('diff-explicado.json') || {};
var nor = J('normalizador.json') || {};
var ins = J('insights-candidatos.json') || {};

H.emitir('reporte', {
  paso: 'G1 · corrida e2e y Puerta 2', cuando: CUANDO,
  cargo: 'La cadena corta completa: motor (N5) → validación del motor (N5-99) → escritura del ' +
    '`Report_Resumen` (N6) → las 5 capas de validación del paquete → Puerta 2 (N7).',
  encontro: [
    'La Puerta 2 estaba cerrada por **17,116 envíos perdidos**, y el hueco no era del escritor sino del MOTOR: el ancla del Qcart fabricaba una celda que no existía.',
    'K1 se estaba aplicando **dos veces**. La activación del link ya filtra qué eventos de Qcart cuentan (H2); usarla además para elegir la quincena en la que el bloque se MUESTRA creó una celda «May-Q2» de Hotcakes E-P1 Saludables sin un solo envío — y los 17,116 envíos reales de May-Q1 se quedaron sin fila.',
    'La llave de emparejamiento no llevaba la quincena: AON Traditional Parents E-P1 existe dos veces con la misma identidad (marzo y abril) y la de marzo se escribía en las dos.',
    'Ese bug ya había **destruido** la fila de abril que Rick construyó a mano (journey 863587, Email ID 80879/81286, 67,229 envíos y su Qcart de abril). Se restauró desde su copia de las 11:57.'
  ],
  falta: [
    'La oleada de abril de AON Traditional Parents **no la puede producir el sistema**: `CRM_Reporte_Config` sigue con el `Content_Name` de marzo en `001-P025`/`001-P027`, así que la DE no la entrega. Vive como fila de Rick hasta que el config se corrija.',
    'Sus deliveries/opens/clicks de abril siguen en 0 porque no están en la DE. El número de envíos sí es real.'
  ],
  validado: [
    'Puerta 2: **6 de 6 métricas exactas** — Tot_Sends 6,246,993 · Deliveries 6,186,886 · Opens 2,092,614 · Clicks 33,171 · WA 14,643 · Carritos 1,970.',
    'Las 5 capas del paquete: safe-save · etiqueta Purview · xlsx-check · validar-fondo (4 capas) · orden de celdas.',
    'Prueba del caso nuevo: se corrió el ciclo completo OTRA VEZ y la fila de abril **sobrevivió** — que es lo que prueba que la llave quedó bien, no que el escritor no truene.',
    'La guarda anti-clon de N7 se probó **cerrando**: con el archivo dañado bloquea citando los 66,204 contados dos veces, y con el reparado abre.'
  ],
  datos: { veredicto: ver.veredicto || ver, bloqueos: ver.bloqueos || [], avisos: ver.avisos || [] }
}, CORTE);

H.emitir('diff', {
  paso: 'G2 · el diff explicado', cuando: CUANDO,
  cargo: 'Compara el `Report_Resumen` de hoy contra la copia previa a la sustitución y **clasifica cada diferencia por causa**.',
  encontro: [
    'Se empareja por **identidad + quincena, nunca por número de fila**: un diff por índice marca todas las filas como cambiadas en cuanto alguien inserta una. Costó 60 diferencias falsas antes de notarlo.',
    (dif.celdas || 0) + ' celdas cambiadas en ' + ((dif.filas || {}).tocadas || 0) + ' filas · ' + (dif.limpiadas || 0) + ' se limpiaron.',
    '226 de esas celdas son **Qcart que estaba repetido** en varias filas del mismo mes: el total de carritos bajó de 4,667 a 2,158 porque antes se contaba más de una vez.',
    '7 filas cambiaron de quincena y 2 son nuevas (la oleada de abril de AON y la pieza de WhatsApp de ICE).'
  ],
  falta: [],
  validado: [
    'Cada delta reconcilia con su causa: Tot_Sends +18,141 = −66,204 (abril viejo) +67,229 (abril real) +17,116 (Hotcakes May-Q1 recuperado).',
    'Ninguna diferencia cayó en «causa desconocida».'
  ],
  datos: dif
}, CORTE);

H.emitir('normalizador', {
  paso: 'I1 · normalizador transversal (+ I2 · marcado)', cuando: CUANDO,
  cargo: 'Mide la coherencia **cruzando hojas**, que es lo que ningún otro guardián mira: llaves entre catálogos y fuentes, sentido de negocio por fila, el mismo envío en dos filas, la misma oleada en dos quincenas, filas fuera del rango de totales, y si lo no validado está marcado.',
  encontro: [
    'Pro Plan E3 estaba **partido en dos quincenas** según por qué vía llegó cada pieza: 3 desde la DE (13-jul, Jul-Q1) y 6 desde `get_send_metrics` por jobId (17-jul, Jul-Q2) — y contradecía las 9 filas que Rick tenía en Jul-Q1. **Resuelto**: la fecha ancla sale de las hermanas de la DE y se declara de dónde salió.',
    'Un falso positivo **mío**, corregido: marcaba Partido 2 y Partido 3 como duplicados por tener 162 envíos cada uno. Son envíos distintos que coinciden en cifra. Ahora solo acusa cuando una de las dos filas no tiene respaldo en el bloque.',
    'I2: los 6 EmailID que faltan están marcados `**Por llenar`; el CTOR de WhatsApp no medido va en blanco en los 6 casos; 21 piezas mudas y todas dicen por qué.'
  ],
  falta: [
    '🔴 **The Freshers vs ICE — decisión de Rick.** `The Freshers` es una campaña de EMAIL (006-P001/P002) y su fila carga 2,000 envíos de WhatsApp; el catálogo atribuye ese mismo envío a `ICE 010-P001`. Son el mismo envío mostrado dos veces.',
    '🔴 La fila de ICE quedó **por debajo de la fila de totales** (f75, y el SUM llega a f73): queda fuera del total. Hoy el total sale bien **por coincidencia**, porque la fila de Rick (que sí está dentro) trae la misma cifra.',
    'La ambigüedad de fondo: `ICE` está usada como MARCA en The Freshers y como CAMPAÑA en 010-P001. Las dos lecturas son defendibles y no se infiere del naming — es pregunta para Rick.'
  ],
  validado: [
    '11 checks en verde, todos con su evidencia citada (no «pasó»: «264/264», «2538/2538», «42 touchpoints evaluados»).',
    'Ningún check pinta verde sin haber evaluado casos: los que no tienen qué medir dicen «N/A» y por qué.'
  ],
  datos: nor
}, CORTE);

H.emitir('insights', {
  paso: 'G3 · skill de insights', cuando: CUANDO,
  cargo: 'El skill `rick-reportes-nestle-insights` con su parte determinista en código: `scripts/iqs.js` produce los candidatos y su puntaje desde la rejilla; la prosa la escribe el skill.',
  encontro: [
    (ins.candidatos || 0) + ' candidatos · ' + (ins.pasan || 0) + ' pasan el umbral 60 · ' + Object.keys(ins.por_celda || {}).length + ' celdas con acción.',
    'Reprodujo el mejor hallazgo conocido de Tercer Tiempo sin que nadie se lo dijera: el CTOR abre **22×** entre Futboleros (9.3%) y Walmart (0.4%).',
    'Un candidato degenerado, corregido: decía «Activos lidera apertura y Activos convierte mejor» — cuando un corte trae dos celdas del mismo segmento, los dos líderes pueden ser el mismo. Ahora exige que sean segmentos distintos.',
    (ins.sin_accion || []).length + ' cortes quedan **sin acción prioritaria**, y eso se escribe tal cual en vez de rellenarse con una recomendación inventada.'
  ],
  falta: [
    '`Report_Resumen` **no lleva columna de insights** hoy: Rick la retiró el 20-ago y el escritor la respeta. El skill produce el texto; dónde se pega es decisión suya.'
  ],
  validado: [
    'El IQS solo busca baseline dentro de campaña **+ objetivo** — la regla que evita el bug de comparar un Purchase contra un Inspiration.',
    'Corrido contra la rejilla real de 71 celdas.'
  ],
  datos: ins
}, CORTE);

console.log('handoffs emitidos en el corte ' + CORTE);
console.log(H.indice ? H.indice(CORTE) : '');
