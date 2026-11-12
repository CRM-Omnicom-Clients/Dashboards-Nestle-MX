// N9 · EL ORQUESTADOR. Corre el ciclo completo, en orden, y sabe dónde quedó.
//
// USO:   node orquestador.orquestador.js              → corre TODO en seco (nada escribe el Excel)
//        node orquestador.orquestador.js --escribir   → corre todo y escribe, pasando por la puerta
//        node orquestador.orquestador.js --desde motor-calculo   → retoma desde un script
//
// 🔴 EL ORDEN NO ES DECORATIVO. Cada paso consume el handoff del anterior:
//      insumos-validar  insumos      → dice qué hay y dónde
//      qcart-activacion activación   → la fecha de activación de cada link de Qcart
//      catalogo-leer/catalogo-aplicar catálogo → las correcciones del documento de Leslie
//      email-bloque..manual-bloque fuentes → un bloque por fuente, SIN calcular
//      PUERTA-1 puerta 1     → ¿cuadran los 4 bloques entre ellos y con el catálogo?
//      escritor-datos  escritura    → baja los bloques a las hojas de datos
//      motor-calculo  motor        → el ÚNICO que calcula
//      resumen-regenerar/insights-redactar reporte   → el Resumen y sus insights
//      PUERTA-2  puerta 2     → ¿el reporte dice lo que dice la rejilla?
//
// 🔴 UNA PUERTA QUE NO DETIENE NO ES UNA PUERTA. Si PUERTA-1 cierra, no se escribe nada — ni siquiera
//    los bloques que sí cuadran. Un corte a medias es peor que ningún corte: deja el archivo en
//    un estado que nadie sabe describir.
//
// ⚠ PUBLICAR (N8) NO ESTÁ EN ESTE BUCLE. Publicar a producción exige el OK explícito de Rick,
//   y un bucle automático no puede dárselo a sí mismo.
process.env.NODE_PATH = require(__dirname + '/lib-entorno.js').NODE_MODULES;
require('module').Module._initPaths();
var ENT = require(__dirname + '/lib-entorno.js');
var fs = require('fs'), os = require('os'), cp = require('child_process');
var D = require('path').resolve(__dirname, '..') + '/_scripts';
var BACK = require('path').resolve(__dirname, '..');
var PROY = ENT.PROYECTO;
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;
var DESDE = (function () { var i = process.argv.indexOf('--desde'); return i > 0 ? process.argv[i + 1] : null; })();
var t = function (v) { return String(v == null ? '' : v).trim(); };

// cada script: qué corre, si es una PUERTA, y si escribe el Excel
var SCRIPTS = [
  // 🔴 VA PRIMERO, ANTES DE QUE NADIE ESCRIBA. Una formula que cita una hoja borrada deja el
  //    libro en un estado que `safe-save` se NIEGA a guardar — con razon. Si esto corre tarde,
  //    el primer paso que intente escribir se estrella contra una herencia que no es suya.
  //    Vaciar `#REF!` no pierde nada: la ausencia de un dato no es un dato.
  { id: 'escritor-neutralizar', nom: 'neutralizar fórmulas muertas', script: 'escritor.neutralizar-muertas.js', escribe: true, salida: '_neutro.xlsx' },
  { id: 'insumos-validar', nom: 'insumos', script: 'fuentes-insumos.insumos.js' },
  { id: 'qcart-activacion', nom: 'activación de Qcart', script: 'fuentes-qcart.activacion-qcart.js' },
  { id: 'catalogo-leer', nom: 'leer correcciones del catálogo', script: 'catalogo.leer-correcciones.js', opcional: true },
  { id: 'catalogo-aplicar', nom: 'aplicar correcciones al catálogo', script: 'catalogo.corregir-catalogo.js', escribe: true, salida: '_cat1f.xlsx', opcional: true },
  // 🔴 EL EMAIL YA NO SALE DE DATORAMA (E4, 20-ago). Este paso seguía llamando a 'N2a-email.js'
  //    y en la corrida en seco del 21-ago PISÓ el bloque de SFMC con el viejo: 98 envíos /
  //    7,282,486 volvieron a ser 264 / 6,454,554. El 'seco' protege el Excel, NO los JSON del
  //    backend — y eso hacía que la cadena completa deshiciera el corte cada vez que se corría.
  { id: 'email-bloque', nom: 'bloque email (SFMC)', script: 'fuentes-email.email-piezas.js', flagEscribir: true },
  { id: 'qcart-bloque', nom: 'bloque qcart', script: 'fuentes-qcart.qcart.js' },
  { id: 'whatsapp-bloque', nom: 'bloque whatsapp', script: 'fuentes-whatsapp.whatsapp.js' },
  { id: 'manual-bloque', nom: 'bloque manual', script: 'fuentes-manual.manual.js' },
  { id: 'PUERTA-1', nom: 'PUERTA 1 · cuadre de los bloques', script: 'fuentes-cuadre.cuadre.js', puerta: true },
  { id: 'escritor-datos', nom: 'escritura de datos', script: 'escritor.escribir.js', escribe: true, salida: '_n4.xlsx' },
  { id: 'escritor-formato-datos', nom: 'formato de las hojas', script: 'escritor.formato.js', escribe: true, soloConEscritura: true, salida: '_fmt.xlsx', sinFlag: true },
  // 🔴 motor-clicks · los clicks POR DESTINO. Faltaba en la cadena: sin él las columnas de destino del
  //    reporte (%_Qcart, %_App, %_Web…) quedan vacías aunque todo lo demás cuadre. Se lee de
  //    `Link_URL` porque `Link_Name` viene vacío en la DE, y cruza por ContentName, no por ConfigKey.
  { id: 'motor-clicks', nom: 'clicks por destino', script: 'motor.links.js' },
  { id: 'motor-calculo', nom: 'motor de cálculo', script: 'motor.motor.js' },
  // 🔴 motor-rejilla · mete los clicks por destino en las celdas de la rejilla. Va DESPUÉS del motor y
  //    ANTES del reporte: el motor arma la rejilla, motor-rejilla la completa, el reporte la transcribe.
  { id: 'motor-rejilla', nom: 'links a la rejilla', script: 'motor.links-a-rejilla.js' },
  /* 🔴 22-sep-2026 · `clicks-hoja` y `clicks-escribir` SE RETIRAN, con sus dos hojas.
   *
   *    Rick: «yo nunca autoricé esa hoja… todo debe estar dentro de lo que el sistema ya sabe de
   *    sus hojas principales, fuentes, datos». Tenía razón y el diagnóstico es concreto:
   *    `Data_Clicks` y `Dic_Clicks` NUNCA estuvieron en `esquema.json`, que es el registro de qué
   *    hojas existen. No fue un olvido de declararlas: no debían existir.
   *
   *    El modelo ya tenía sitio para las tres cosas que esas hojas guardaban:
   *      · el detalle por URL      → `_fuentes/links.json`      (lo escribe `motor.links.js`)
   *      · los agregados por clase → `Report_Resumen`           (`*_Clicks_CTA`, `_Baja`, `_Redes…`)
   *      · el método de clasificación → `_contratos/clicks-destinos.json` + el SKILL
   *
   *    Y el camino del reporte NO pasaba por ellas: links.json → rejilla → lib-valores-resumen.
   *    `motor.hoja-clicks.js` leía los insumos POR SU CUENTA, en paralelo a `motor.links.js`:
   *    dos scripts resolviendo la misma pregunta desde la misma fuente. Sus únicos lectores eran
   *    verificadores de sí misma — la hoja existía para que unos scripts pudieran comprobar la hoja.
   *
   *    El comentario que estaba aquí contaba cómo los metí a la cadena porque la hoja se
   *    desfasaba del reporte. Sincronizar una copia huérfana era tratar el síntoma: la regla de oro
   *    del esquema dice «un dato, una autoridad», y esa copia no era autoridad ni vista de nadie.
   *
   *    Lo vigila `orquestador.guardian-hojas.js`: una hoja del libro que el esquema no declara
   *    ahora es un defecto medido en cada corte, no algo que se nota cuando Rick pregunta. */
  // 🔴 resumen-fusionar · FUSIONA Principal y FUP en una fila, por la foranea Pieza_Principal_ID. Sin este
  //    paso, 10 celdas quedan como un FUP sin su Principal -- ocupan fila propia y el reporte
  //    parece decir que el seguimiento salió solo. Va DESPUÉS de motor-rejilla (que completa la rejilla) y
  //    ANTES de N6r (que la transcribe). Vigila que email, carritos y WhatsApp no se muevan.
  { id: 'resumen-fusionar', nom: 'fusionar Principal y FUP', script: 'resumen.fusionar-fup.js', flagEscribir: true },
  // 🔴 N6r EN VEZ DE resumen-regenerar. `orquestador.resumen.js` empareja cada fila del reporte con su celda por
  //    IDENTIDAD, y eso es imposible cuando una pieza se renombra: A2/A3 movieron piezas entre
  //    campañas (Espresso Con → Hackea tu café) y touchpoints (J4-ConRegión → E-J4), y ninguna
  //    fila vieja emparejaba con su celda nueva. `N6r` REGENERA la hoja desde la rejilla: descarta
  //    las obsoletas —su dato vive en la celda nueva— e incluye todo, con los totales al final.
  { id: 'resumen-regenerar', nom: 'reporte Resumen (regenera)', script: 'resumen.regenerar.js', escribe: true, salida: '_n6r.xlsx' },
  { id: 'insights-redactar', nom: 'insights', script: 'insights.insights.js', escribe: true, salida: '_n6b.xlsx' },
  // 🔴 EL FORMATO DEL REPORTE VA AQUÍ, NO CON EL DE LAS HOJAS DE DATOS. escritor-formato-datos corre antes de que resumen-regenerar
  //    construya el Resumen, así que cualquier ancho que le pusiera se perdería en la regeneración.
  //    Sin esta segunda pasada, las 83 columnas del reporte nacían sin ancho declarado y «Recetas
  //    Nestlé» se leía «cetas Nes» — el archivo pasaba las cuatro capas y se veía mal.
  { id: 'escritor-formato-resumen', nom: 'formato del Resumen', script: 'escritor.formato.js', escribe: true, soloConEscritura: true,
    salida: '_fmt.xlsx', sinFlag: true, args: '--hoja Report_Resumen' },
  // 🔴 EL LLENADO DE VACÍAS VA DENTRO DE LA CADENA, Y AL FINAL. Lo escribí una vez POR FUERA y la
  //    corrida siguiente lo deshizo: 3,195 celdas volvieron a quedar vacías, porque los scripts que
  //    regeneran hojas —escritor-datos, resumen-regenerar, insights-redactar— las reescriben desde su fuente. Es exactamente la lección que
  //    esta misma sesión aprendió con `EmailID`: retirar (o llenar) aguas abajo del que escribe
  //    solo lo esconde hasta la corrida siguiente. Un relleno que no es un script de ejecución del corte no es un
  //    relleno: es un parche con fecha de caducidad de un ciclo.
  //    Va DESPUÉS del formato (escritor-formato-resumen) porque para entonces ninguna hoja se vuelve a regenerar, y
  //    ANTES de cuadre-coherencia/PUERTA-2 para que las puertas midan el libro tal como va a quedar.
  //    Dos scripts y no uno: medir deja la tabla en `_preescritura/` y se puede revisar; escribir la
  //    aplica sin decidir nada. Medir → decidir → escribir una vez, dentro del ciclo.
  { id: 'vacios-medir', nom: 'medir las celdas vacías (no escribe)', script: 'orquestador.medir-vacios.js', sinFlag: true },
  { id: 'vacios-llenar', nom: 'llenar vacías: N/A · cero · POR DEFINIR', script: 'escritor.aplicar-vacios.js', escribe: true, soloConEscritura: true },

  // 🔴 cuadre-coherencia · EL TERCER CRUCE, Y VA ANTES DE LA PUERTA 2. Lo pidió Rick el 20-ago y hasta hoy estaba
  //    declarado sin turno: existía, escribía su informe, y la cadena no lo llamaba nunca.
  //    Es del skill de CUADRE porque hace el cruce que ninguna de las dos puertas hace:
  //      PUERTA 1 cruza los cuatro BLOQUES del backend entre ellos.
  //      PUERTA 2 cruza el REPORTE contra la rejilla.
  //      cuadre-coherencia cruza HOJA CONTRA HOJA dentro del libro ya escrito — que la campaña de una fila de
  //      email no traiga números de WhatsApp, que un envío no viva en dos filas con dos
  //      identidades, que una oleada no se parta entre quincenas.
  //    Va ANTES de la puerta para que la incoherencia se vea en el mismo aliento que el veredicto.
  //    AVISA, no bloquea, y NO REPARA: varias filas las escribió Rick a mano y «arreglarlas»
  //    borraría su trabajo. Lo que encuentra es decisión suya.
  { id: 'cuadre-coherencia', nom: 'coherencia entre hojas (no repara, reporta)', script: 'fuentes-cuadre.normalizador.js', avisa: true },
  { id: 'PUERTA-2', nom: 'PUERTA 2 · el reporte contra la rejilla', script: 'fuentes-cuadre.puerta2.js', puerta: true }
];

// 🔴 DEUDA DECLARADA · D3 — HAY DOS ESCRITORES.
//    `escritor.escribir.js` escribe las hojas de datos por su cuenta, y `escritor.escribir-todo.js` aplica las
//    celdas que los scripts APUNTAN en el acumulador. Conviven, y eso contradice la doctrina de un
//    solo escritor: dos rutas de escritura son dos oportunidades de pisarse. Lo correcto es que escritor-datos
//    entregue su salida como «hoja regenerada» al acumulador y Z sea el único que toca el archivo.
//    No se hace aquí para no mezclar una refactorización con la corrección de la cadena.
//    → lo cierra el script 1.4/1.5 (contrato de escritura + pre-escritura).

// las validaciones que se corren después de cada script, si existen
var SUITES = {
  // 🔴 los validadores de email-bloque validaban la MIGRACIÓN desde los agentes viejos, y uno de ellos
  //    vuelve a correr 'N2a-email.js' para comparar: con la fuente ya en SFMC eso no valida,
  //    REVIERTE. Se cambian por el validador propio de NC.
  'qcart-activacion': [], 'email-bloque': ['fuentes-email.validar.js'],
  'qcart-bloque': ['fuentes-qcart.validar.js', 'fuentes-qcart.refutar.js'], 'whatsapp-bloque': ['fuentes-whatsapp.validar.js', 'fuentes-whatsapp.refutar.js'],
  'manual-bloque': ['fuentes-manual.validar.js'],
  // 🔴 EL GUARDIÁN DE LA DISTRIBUCIÓN DE QCART CORRE AQUÍ, y no es opcional (Rick, 3-sep-2026:
  //    «¿puedo confiar en que dejarás bien lo de qcart distribuido con su segmento × touchpoint ×
  //    campaña × quincena? ¿que no moverás eso?»). Va pegado a `motor-calculo` porque lee la
  //    rejilla, que es donde el Qcart ya quedó repartido — antes no hay qué mirar.
  //    Compara CELDA POR CELDA contra una línea base sellada: una que baja bloquea, una que
  //    desaparece bloquea, y un movimiento entre quincenas bloquea **aunque la suma no cambie**,
  //    que es el caso que ninguna puerta veía. Probado plantándole los tres: 3/3.
  'motor-calculo': ['motor.validar.js', 'fuentes-qcart.guardian-distribucion.js'],
  'resumen-regenerar': ['resumen.validar.js'],
  'insumos-validar': ['fuentes-insumos.validar.js', 'fuentes-insumos.cruce-sfmc.js'],
  'escritor-datos': ['escritor.validar-contrato.js', 'escritor.canonicos-coinciden.js'],
  /* 🔴 EL GUARDIÁN DE UNIDADES CORRE AQUÍ, y es la lección de septiembre de 2026 hecha paso.
   *    Los tres defectos del mes —clicks, Qcart y WhatsApp— son el MISMO: nadie declaraba qué es
   *    «uno» en cada métrica, así que dos números de distinta naturaleza acababan comparados en la
   *    misma fila. Y ninguna puerta los veía, porque las puertas comparan bloque ↔ rejilla ↔
   *    reporte y las tres descienden del mismo origen: si la unidad del origen está mal, las tres
   *    coinciden y la puerta pasa en verde.
   *    Va pegado a PUERTA-2 porque necesita el reporte ya escrito, que es donde las métricas
   *    conviven en la misma fila y el cruce de unidades se puede ver.
   *    Se prueba con `orquestador.probar-guardian-unidades.js`: 6 señuelos, 6 bloqueos. */
  /* 🔴 `guardian-hojas-vs-bloques` entra aquí porque es el hueco D1: la PUERTA 1 cruza bloques
   *    contra catálogo y la PUERTA 2 reporte contra rejilla, así que **nadie compara las hojas
   *    crudas del libro contra los bloques de los que salieron**. Una hoja puede quedarse atrás
   *    —el escritor empareja contra filas que ya existen y no crea nuevas, así que seis piezas
   *    nunca llegaron— o adelante, y las dos puertas siguen abriendo. AVISA, no bloquea: las
   *    diferencias de hoy son 53 filas de `004-P020`, una pieza retirada, y eso es decisión de
   *    Rick. Bloquear por una decisión pendiente de un humano es como se desactiva una guarda. */
  'PUERTA-2': ['fuentes-cuadre.probar-que-cierra.js', 'orquestador.guardian-unidades.js',
    'orquestador.guardian-hojas-vs-bloques.js']
};

function correr(script, args) {
  var t0 = Date.now();
  try {
    var out = cp.execSync('"' + process.execPath + '" "' + script + '"' + (args || ''), { cwd: D, encoding: 'utf8', timeout: 600000 });
    return { ok: true, ms: Date.now() - t0, out: out };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, out: (e.stdout || '') + (e.stderr || ''), codigo: e.status };
  }
}
// 🔴 CADA SCRIPT QUE ESCRIBE DEJA SU SALIDA EN UN TEMPORAL Y HAY QUE PUBLICARLA ANTES DEL
//    SIGUIENTE. Sin esto los scripts NO SE ENCADENAN: escritor-datos escribia `_n4.xlsx`, y escritor-formato-datos leia el
//    archivo vivo —sin los cambios de escritor-datos— y escribia `_fmt.xlsx` encima de nada. Al final del
//    ciclo el workbook tenia solo el ultimo paso, y los anteriores se habian perdido en silencio.
//    Publicar = copiar + la CADENA COMPLETA de validacion. Si la cadena falla, no se publica y
//    el ciclo se detiene: un archivo a medio validar es peor que uno sin tocar.
// 🔴 EL NOMBRE DEL LIBRO NO SE CLAVA. Traía la version pegada («…-v8.xlsx»): el dia que Rick
//    guarde una v9, este orquestador seguiria escribiendo sobre la v8 SIN AVISAR — el reporte
//    nuevo se construiria encima del archivo viejo y nadie lo notaria hasta mirar las cifras.
//    `archivoVivo()` elige el mas reciente y dice cual eligio.
var VIVO = (function () {
  var v = require(BACK + '/_scripts/lib-flexible.js').archivoVivo({ dir: PROY });
  console.log('  libro vivo: ' + v.archivo + (v.motivo ? '   (' + v.motivo + ')' : ''));
  return v.ruta;
})();
var TOOLS = require(__dirname + '/lib-entorno.js').TOOLS;
var PY = require(__dirname + '/lib-entorno.js').PYTHON;
// 🔴 OneDrive puede tener el archivo a medio escribir cuando la cadena lo abre, y entonces la
//    capa de Python revienta con «Bad magic number for file header» — un zip que un segundo
//    despues esta perfecto. Paso en una corrida limpia y detuvo el ciclo entero por nada.
//    Esto NO reintenta la validacion (eso taparia un fallo real): solo espera a que el archivo
//    se pueda ABRIR como zip antes de empezar a medirlo.
function esperarLegible(f) {
  for (var i = 0; i < 10; i++) {
    try {
      var z = new (require(require(__dirname + '/lib-entorno.js').TOOLS + '/node_modules/adm-zip'))(f);
      if (z.getEntries().length > 5) return true;
    } catch (e) { }
    try { cp.execSync('"' + process.execPath + '" -e "setTimeout(function(){},400)"', { timeout: 5000 }); } catch (e) { }
  }
  return false;
}

function capas(f) {
  if (!esperarLegible(f)) throw new Error('el archivo no se pudo abrir como zip tras 10 intentos: ' + f);
  // las cinco, EN EL ORIGEN. `safe-save` ademas REPARA el paquete, por eso va primera.
  cp.execSync(q(process.execPath)+" "+q(TOOLS+"/xlsx-safe-save.js")+" "+q(f), {encoding:"utf8",timeout:180000});
  cp.execSync(q(process.execPath)+" "+q(TOOLS+"/xlsx-label.js")+" "+q(f), {encoding:"utf8",timeout:120000});
  cp.execSync(q(process.execPath)+" "+q(TOOLS+"/xlsx-check.js")+" "+q(f), {encoding:"utf8",timeout:180000});
  if (fs.existsSync(PY)) cp.execSync(q(PY)+" "+q(TOOLS+"/xlsx-validar-fondo.py")+" "+q(f), {encoding:"utf8",timeout:180000});
  cp.execSync(q(process.execPath)+" "+q(TOOLS+"/xlsx-orden-celdas.js")+" "+q(f), {encoding:"utf8",timeout:180000});
}
function q(x){ return String.fromCharCode(34)+x+String.fromCharCode(34); }

// 🔴 SE VALIDA ANTES DE COPIAR. La version anterior hacia `copyFileSync` PRIMERO y validaba
//    despues: cuando la validacion fallaba, el orquestador reportaba "no se publico" — pero el
//    workbook YA estaba pisado con la salida rota, y ahi se quedaba. Asi fue como el libro
//    quedo con 48 celdas desordenadas en `Catalogo_Piezas` mientras el log decia que no habia
//    publicado nada. Un paso que falla no debe poder tocar el archivo bueno.
function publicar(salida) {
  /* 🔴 22-sep-2026 · LA SALIDA VIVE EN `_tmp/`, NO EN LA RAÍZ DEL HOME.
   *    Rick: «estás haciendo un desorden en la carpeta C». Los 128 scripts que escribían sus
   *    copias de trabajo en `homedir() + '/_algo.xlsx'` se migraron a
   *    `reportes-backend/nestle/_tmp/` — ruta igual de ASCII (que era el motivo del patrón) pero
   *    declarada en el MAPA.
   *
   * 🔴 Y ESTA LÍNEA NO SE MIGRÓ CON ELLAS, porque no contiene la ruta: la COMPONE. Un
   *    find-replace sobre `homedir() + '/_` no la toca, así que el orquestador siguió buscando
   *    en el home mientras los scripts escribían en `_tmp`. Resultado: la cadena se detuvo en su
   *    PRIMERA etapa con «el script no dejó su salida», y no era verdad — la había dejado, en
   *    otro sitio. Un reemplazo masivo hay que mirarlo también en quien CONSUME la ruta. */
  var origen = BACK + "/_tmp/" + salida;
  if (!fs.existsSync(origen)) return { ok:false, motivo:"el script no dejo su salida en _tmp/" + salida };
  try { capas(origen); }
  catch (e) {
    var d = String((e.stdout || '') + (e.message || '')).split(/[\r\n]+/)
      .filter(function (x) { return x.trim() && !/^\s*at /.test(x); });
    return { ok:false, motivo:"la salida del paso NO pasa las 5 capas (el workbook quedo INTACTO): " + d.slice(-4).join(" | ").slice(0,300) };
  }
  var antes = fs.existsSync(VIVO) ? fs.statSync(VIVO).mtimeMs : 0;
  fs.copyFileSync(origen, VIVO);
  // OneDrive revierte la escritura si el libro esta abierto en Excel, y no da ningun error.
  var st = fs.statSync(VIVO);
  if (st.size !== fs.statSync(origen).size || st.mtimeMs <= antes) {
    return { ok:false, motivo:"la copia no quedo: el destino no cambio de tamano/fecha. Cierra el libro en Excel (OneDrive revierte)." };
  }
  return { ok:true };
}

function ultimaLinea(out, patron) {
  var l = String(out).split('\n').map(function (x) { return x.replace(/\s+$/, ''); })
    .filter(function (x) { return x.trim() && (!patron || patron.test(x)); });
  return (l[l.length - 1] || '').trim();
}

console.log('════════════════════════════════════════════════════════════');
console.log('  N9 · ORQUESTADOR   ' + (ESCRIBIR ? '🔴 MODO ESCRITURA' : 'modo seco (no toca el Excel)'));
console.log('════════════════════════════════════════════════════════════');
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA CADENA ES DE SKILLS, NO DE SCRIPTS  (Rick, 25-ago-2026)
//
//    «Los scripts están contenidos en los skills. No volver a usar nunca la el sistema plano anterior.»
//
//    Hasta hoy lo que se ejecutaba era el array `SCRIPTS` de arriba: 20 scripts de ejecución planos, y los skills
//    vivían al lado sin mandar sobre nada. Ahora lo que se ejecuta es `_contratos/cadena-skills.json`
//    — 15 ETAPAS, cada una con su SKILL dueño y los scripts que ese skill corre ahí.
//
//    `SCRIPTS` NO se borra: sus comentarios son la única documentación de por qué cada script va donde
//    va, y `orquestador.cadena-skills.js` deriva la cadena de él. Pero ya no es lo que corre. El guard de
//    abajo compara los dos: si alguien edita `SCRIPTS` y no regenera la cadena, se ve — dos fuentes
//    que se desincronizan en silencio es el defecto que este proyecto ya pagó cuatro veces.
var CADENA;
try {
  CADENA = JSON.parse(fs.readFileSync(D + '/../_contratos/cadena-skills.json', 'utf8'));
} catch (e) {
  console.log('\n  🔴 no hay _contratos/cadena-skills.json — la cadena de skills no está declarada.');
  console.log('     Regenérala:  node ' + D + '/orquestador.cadena-skills.js --escribir');
  process.exit(1);
}
// ── guard: la cadena declarada tiene que cubrir exactamente los scripts que SCRIPTS documenta
(function () {
  var enCadena = {}; CADENA.etapas.forEach(function (e) { e.scripts.forEach(function (n) { enCadena[n.id] = 1; }); });
  var faltan = SCRIPTS.filter(function (p) { return !enCadena[p.id]; }).map(function (p) { return p.id; });
  var sobran = Object.keys(enCadena).filter(function (id) { return !SCRIPTS.some(function (p) { return p.id === id; }); });
  if (faltan.length || sobran.length) {
    console.log('\n  🔴 LA CADENA DE SKILLS NO COINCIDE CON LOS SCRIPTS DOCUMENTADOS');
    if (faltan.length) console.log('     scripts sin skill en la cadena: ' + faltan.join(' · '));
    if (sobran.length) console.log('     scripts en la cadena que ya no existen: ' + sobran.join(' · '));
    console.log('     Regenérala:  node ' + D + '/orquestador.cadena-skills.js --escribir');
    process.exit(1);
  }
})();

// ── PREFLIGHT DEL SKILL · las CINCO guardas estructurales, ANTES de dirigir la cadena
//
//    1 · destructivo sin skill          · nada que escriba o borre anda sin dueño        AVISA/BLOQUEA
//    2 · id duplicado                   · dos cosas no comparten id                      BLOQUEA
//    3 · lectura por literal            · deuda histórica de columnas sin catálogo        AVISA
//    4 · script suelto del catálogo raíz· todo lo del corte pasa por lib-columna          BLOQUEA
//    5 · escribir sin declarar          · todo escritor dejó su pre-escritura             BLOQUEA
//
//    Las cinco corren solas aquí. Ninguna depende de que alguien se acuerde.
//
// 🔴 ESTO ES DECISIÓN DEL SKILL, NO TRABAJO DE UN SCRIPT. El skill que dirige es el que decide bajo
//    qué condiciones vale la pena correr el corte, y la condición es: que nada destructivo ande
//    suelto y que ningún id esté duplicado. Un paso no puede tomar esa decisión — solo ve su script.
//
// 🔴 Y VA AQUÍ, NO EN UN SCRIPT QUE SE CORRE A MANO. La fase 6 encontró 64 scripts declarados que
//    la cadena nunca corre, entre ellos el normalizador que Rick pidió: declarar algo y no darle
//    turno es dejarlo escrito y sin efecto. Una guarda que hay que acordarse de correr no protege
//    de nada — la que protege es la que corre sola, delante del corte.
//
//    Solo detiene si BLOQUEA. Si avisa o no puede evaluar, se imprime y el corte sigue: un
//    guardián que atora por lo que no puede probar acaba desactivado, y entonces no guarda nada.
(function () {
  var g = require('child_process').spawnSync(process.execPath, [D + '/orquestador.guardas.js'], { encoding: 'utf8' });
  var salida = (g.stdout || '') + (g.stderr || '');
  if (g.status === 1) {
    console.log('\n  🔴 PREFLIGHT DEL ORQUESTADOR — las guardas estructurales BLOQUEAN:');
    salida.split('\n').filter(function (l) { return /🔴/.test(l); }).forEach(function (l) { console.log('  ' + l.trim()); });
    console.log('\n     El corte no arranca. Corre:  node ' + D + '/orquestador.guardas.js');
    process.exit(1);
  }
  var avisos = salida.split('\n').filter(function (l) { return /^\s*[⚠⊘]/.test(l); });
  console.log('  ✔ preflight del skill: guardas estructurales en verde' + (avisos.length ? '  ⚠ con ' + avisos.length + ' aviso(s)' : ''));
  avisos.forEach(function (l) { console.log('  ' + l.trim()); });
})();

// se recorre la cadena de SKILLS; los scripts salen de dentro de cada etapa
var PLAN = [];
CADENA.etapas.forEach(function (e) {
  e.scripts.forEach(function (n, k) {
    PLAN.push(Object.assign({}, n, { nom: n.nombre, _skill: e.skill, _etapa: e.orden, _primero: k === 0 }));
  });
});

var bitacora = [], detenido = null, arrancado = !DESDE, skillActual = null;

for (var i = 0; i < PLAN.length; i++) {
  var p = PLAN[i];
  // el encabezado de la etapa: se anuncia el SKILL, y debajo van sus scripts
  if (p._skill !== skillActual || p._primero) {
    if (arrancado || !DESDE) {
      console.log('\n  ┌─ etapa ' + String(p._etapa).padStart(2) + ' · ' + p._skill +
        '   (' + CADENA.etapas[p._etapa - 1].scripts.map(function (x) { return x.id; }).join(' · ') + ')');
    }
    skillActual = p._skill;
  }
  if (!arrancado) { if (p.id === DESDE) arrancado = true; else { console.log('  ⏭  ' + (p.etiqueta || p.id).padEnd(26) + p.nom + '  (saltado por --desde ' + DESDE + ')'); continue; } }
  if (p.soloConEscritura && !ESCRIBIR) { console.log('  ⏭  ' + (p.etiqueta || p.id).padEnd(26) + p.nom + '  (solo aplica al escribir)'); continue; }
  if (!fs.existsSync(D + '/' + p.script)) {
    if (p.opcional) { console.log('  ⏭  ' + (p.etiqueta || p.id).padEnd(26) + p.nom + '  (no existe, es opcional)'); continue; }
    console.log('  🔴 ' + p.id.padEnd(5) + p.nom + '  — falta ' + p.script);
    detenido = { script: p, motivo: 'el script no existe' }; break;
  }

  // 🔴 'escribe' = toca el EXCEL, y por eso obedece al modo seco. 'flagEscribir' = escribe su
  //    propio bloque JSON del backend, que no es el entregable: ese siempre se regenera, también
  //    en seco. Confundirlos dejaba el bloque de email a medias en cada corrida en seco.
  var args = ((p.escribe && ESCRIBIR && !p.sinFlag) || p.flagEscribir) ? ' --escribir' : '';
  if (p.args) args += ' ' + p.args;   // un script puede declarar sus propios argumentos
  process.stdout.write('  │  ▸ ' + (p.etiqueta || p.id).padEnd(26) + p.nom.slice(0, 30).padEnd(31));
  var r = correr(p.script, args);
  var seg = (r.ms / 1000).toFixed(1) + 's';
  var ver = ultimaLinea(r.out, /✅|🔴|PUERTA|VEREDICTO/) || ultimaLinea(r.out);
  console.log((r.ok ? '✔' : '🔴') + ' ' + seg.padStart(7) + '   ' + ver.slice(0, 62));
  bitacora.push({ paso: p.id, nombre: p.nom, ok: r.ok, ms: r.ms, veredicto: ver });

  // 🔴 UNA PUERTA QUE FALLA DETIENE TODO. No se sigue «a ver si el resto sí».
  if (p.puerta && !r.ok) {
    detenido = { script: p, motivo: 'la puerta CERRÓ: ' + ver };
    console.log('\n  🔴 ' + p.id + ' CERRÓ LA PUERTA. No se escribe nada más.');
    console.log('     ' + ver);
    break;
  }
  if (!r.ok && !p.puerta) {
    detenido = { script: p, motivo: 'el script falló: ' + ver };
    console.log('\n  🔴 ' + p.id + ' falló. Se detiene el ciclo — un corte a medias es peor que ninguno.');
    String(r.out).split('\n').filter(function (l) { return /🔴/.test(l); }).slice(0, 5)
      .forEach(function (l) { console.log('     ' + l.trim().slice(0, 100)); });
    break;
  }

  // publicar la salida antes de que corra el siguiente paso
  if (ESCRIBIR && p.salida) {
    var pub = publicar(p.salida);
    console.log('       ' + (pub.ok ? '📤 publicado al workbook + las 5 capas de validacion' : '🔴 NO se publico: ' + pub.motivo));
    bitacora.push({ paso: p.id + '·publicar', nombre: p.salida, ok: pub.ok, veredicto: pub.ok ? 'publicado y validado' : pub.motivo });
    if (!pub.ok) {
      detenido = { script: p, motivo: 'no se pudo publicar: ' + pub.motivo };
      console.log('\n  🔴 se detiene: el workbook quedaría a medias.');
      break;
    }
  }

  // las suites del paso
  (SUITES[p.id] || []).forEach(function (s) {
    if (!fs.existsSync(D + '/' + s)) return;
    var rs = correr(s, '');
    var v = ultimaLinea(rs.out, /✅|🔴/) || '';
    console.log('       ' + (rs.ok ? '✔' : '🔴') + ' ' + s.replace('.js', '').padEnd(32) + v.slice(0, 58));
    bitacora.push({ paso: p.id + '·suite', nombre: s, ok: rs.ok, veredicto: v });
  });
}

console.log('\n════════════════════════════════════════════════════════════');
var rojos = bitacora.filter(function (b) { return !b.ok; });
// el titular es de SKILLS y ETAPAS — que es la unidad del sistema. Los scripts van después.
var skillsCorridos = {};
PLAN.forEach(function (p) { skillsCorridos[String(p._skill || '').replace(ENT.PREFIJO_SKILL, '')] = 1; });
console.log('  skills que tomaron turno: ' + Object.keys(skillsCorridos).length +
  '   ·   etapas: ' + (PLAN.length ? PLAN[PLAN.length - 1]._etapa : 0) +
  '   ·   scripts de ejecución corridos: ' + bitacora.length + '   ·   con fallo: ' + rojos.length);
if (detenido) {
  // 🔴 SE REPORTA POR SKILL, NO POR ID DE SCRIPT. Rick, 26-ago: *«tienes que correr las decisiones
  //    de los skills; nada puede quedar anclado a los scripts, porque te pierdes.»* Y tenía razón
  //    en el diagnóstico: decir «falló resumen-regenerar» obliga a traducir mentalmente qué skill
  //    es y qué decisión suya estaba sirviendo. Decir «se detuvo el skill **resumen**, en su etapa
  //    12, al regenerar la hoja» ya lleva el razonamiento dentro. El id del script es un detalle
  //    interno; se conserva al final de la línea, para quien vaya a abrir el archivo.
  var sk = String(detenido.script._skill || '').replace(ENT.PREFIJO_SKILL, '');
  console.log('  🔴 SE DETUVO EL SKILL «' + sk + '» — en su etapa ' + detenido.script._etapa + ', al ' + detenido.script.nom);
  console.log('     ' + detenido.motivo);
  /* 🔴 EL SKILL SE SEÑALA DONDE DE VERDAD ESTÁ. Esto decía `~/.claude/skills/…` fijo, y al correr
   *    el sistema desde la carpeta de SharePoint mandó a leer el skill del HOME: otra copia, que
   *    puede decir otra cosa. Se mira primero junto al sistema (`<backend>/skills/`), que es como
   *    viaja, y si no está, el del home. */
  var skDir = (function () {
    var junto = require('path').resolve(__dirname, '..') + '/skills/crm-reporte-' + sk + '/SKILL.md';
    if (require('fs').existsSync(junto)) return junto;
    return require(__dirname + '/lib-entorno.js').SKILLS + '/crm-reporte-' + sk + '/SKILL.md';
  })();
  console.log('     el skill decide qué hacer con esto. Su contrato: ' + skDir);
  console.log('     para retomar cuando esté resuelto:  node orquestador.orquestador.js --desde ' + detenido.script.id + (ESCRIBIR ? ' --escribir' : ''));
  console.log('     (el script de ejecución era `' + detenido.script.script + '` — detalle interno)');
} else if (rojos.length) {
  console.log('  ⚠ el ciclo llegó al final, pero ' + rojos.length + ' suite(s) reportaron algo:');
  rojos.forEach(function (b) { console.log('     ' + b.nombre + ' — ' + b.veredicto.slice(0, 70)); });
} else {
  console.log('  ✅ CICLO COMPLETO' + (ESCRIBIR ? ' — el workbook quedó escrito y validado' : ' en seco — nada se escribió'));
  if (!ESCRIBIR) console.log('     para escribir de verdad:  node orquestador.orquestador.js --escribir');
}
console.log('  ⚠ PUBLICAR a producción NO está en este bucle: necesita el OK explícito de Rick.');
fs.writeFileSync(BACK + '/_orquesta-bitacora.json', JSON.stringify({
  cuando: new Date().toISOString().slice(0, 16).replace('T', ' '),
  modo: ESCRIBIR ? 'escritura' : 'seco', desde: DESDE || null,
  detenido: detenido ? { paso: detenido.script.id, motivo: detenido.motivo } : null,
  scripts: bitacora
}, null, 1));
console.log('\n  bitácora → ' + BACK + '/_orquesta-bitacora.json');
process.exit(detenido ? 1 : 0);
