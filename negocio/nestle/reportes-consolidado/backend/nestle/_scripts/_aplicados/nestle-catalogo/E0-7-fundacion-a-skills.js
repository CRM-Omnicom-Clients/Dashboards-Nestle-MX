// E0.7 · LA FUNDACIÓN, DENTRO DE CADA SKILL.
//
// 🔴 EL HUECO MEDIDO: 9 de los 10 skills **no conocen el esquema**, ninguno sabe de la quincena
//    canónica, ninguno sabe de la pre-escritura. Una fundación que los skills no citan no es una
//    fundación: es una carpeta de scripts que nadie usa. Y entonces cada skill se escribe su
//    propia llave, su propia quincena, su propio formato — que es exactamente cómo el sistema se
//    separó de sí mismo.
//
// 🔴 GENERADO, NO ESCRITO A MANO. La sección sale de este paso, así que los 10 skills dicen lo
//    mismo y actualizar la fundación es actualizar un solo lugar. Es la misma regla que aplicamos
//    a `Catalogo_Referencias`: una autoridad, y las vistas se verifican.
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var fs = require('fs'), os = require('os');
var BACK = os.homedir() + '/.claude/reportes-backend/nestle';
var SK = os.homedir() + '/.claude/skills';
var ESCRIBIR = process.argv.indexOf('--escribir') >= 0;

// 🔴 LA LISTA DE SKILLS SE LEE DE LA CADENA, NO SE CLAVA AQUÍ. Estaba escrita a mano con los 9
//    skills que existían, y al nacer `escritor`, `motor` y `resumen` este generador los ignoró en
//    silencio: los tres skills nuevos quedaban sin fundación —sin saber que no deben reimplementar
//    la quincena ni la llave— que es justo el defecto que la fundación existe para prevenir.
//    `cadena-skills.json` es hoy la única declaración de qué skills componen el sistema.
var SKILLS = (function () {
  try {
    var c = JSON.parse(fs.readFileSync(
      os.homedir() + '/.claude/reportes-backend/nestle/_contratos/cadena-skills.json', 'utf8'));
    return (c.skills || []).map(function (s) { return s.id; });
  } catch (e) {
    console.log('  🔴 no hay _contratos/cadena-skills.json — córrelo con orquestador.cadena-skills.js --escribir');
    process.exit(1);
  }
})();

var INI = '<!-- FUNDACION:INICIO -->', FIN = '<!-- FUNDACION:FIN -->';

var SECCION = [
INI,
'',
'## 🧱 LA FUNDACIÓN — lo que NO reimplementas',
'',
'> **Generado desde `E0-7-fundacion-a-skills.js`. No se edita a mano.**',
'> Estas cinco librerías son el suelo del sistema. Un skill que se escribe su propia llave, su',
'> propia quincena o su propio formato **es cómo el sistema se separa de sí mismo** — pasó, y por',
'> eso el reporte y el catálogo llegaron a no cruzar en ninguna de sus 86 filas.',
'',
'| Librería | Qué resuelve | Cómo se usa |',
'|---|---|---|',
'| **`lib-esquema`** | El modelo de datos: entidades, llaves, relaciones, grano | `E.llaveDe(hoja)` · `E.foraneas(hoja)` · `E.prefijo()` · `E.admiteNA(col)` |',
'| **`lib-registro`** | El nombre físico cambia, el **id lógico no** | `R.abrir(ambito, encabezados)` → `h.col(id)` |',
'| **`lib-quincena`** | **Una** regla y **un** formato | `Q.deFecha(f)` · `Q.normalizar(q)` · `Q.esCanonica(q)` |',
'| **`lib-preescritura`** | La tabla previa, con la forma de la hoja destino | `PRE.preparar({...})` · `PRE.guardar(skill, tablas)` |',
'| **`lib-cambios`** | El acumulador: nadie escribe, todos **apuntan** | `CB.apuntar(paso, hoja, fila, col, valor, porque)` |',
'',
'### Las reglas que salen de ahí, y no se negocian',
'',
'**1 · La llave se PIDE, no se escribe.** `E.llaveDe(\'Report_Resumen\')` devuelve',
'`Campaña + TouchPoint + Segmento + Quincena_del_Principal`. Escribirla a mano es cómo aparecieron',
'**13 colisiones** en las oleadas de AON.',
'',
'**2 · La quincena tiene UNA regla y UN formato.** Día **1–15 = Q1** · **16–fin = Q2**. Formato',
'**`AAAA-MM-Qn`** — ordena alfabéticamente igual que cronológicamente y no depende del idioma del',
'mes. Toda fecha pasa por `Q.deFecha()`; toda quincena que llega de fuera, por `Q.normalizar()`.',
'',
'**3 · Ninguna celda vacía, tres estados:**',
'',
'| | |',
'|---|---|',
'| valor | el dato |',
'| **`N/A`** | **no aplica** por naturaleza (Email_Name en WhatsApp · FUP_Sends sin FUP) |',
'| **`PENDIENTE`** | **sí aplica y lo debemos** (un subject que la fuente aún no entrega) |',
'',
'Llenar todo de `N/A` cerraría el archivo pero **borraría la señal de qué falta**. Con tres estados',
'un guardián puede exigir que `PENDIENTE` tienda a cero.',
'',
'**4 · Nadie escribe: todos APUNTAN.** Cada skill registra sus celdas con su motivo y **un solo',
'escritor** (`escritor.escribir-todo.js`) las aplica de una pasada: un respaldo, una cadena de validación,',
'una publicación. Dos skills que piden la misma celda **chocan** y paran la escritura.',
'',
'**5 · El orden es atribuir → organizar → llenar.** Nunca llenar primero: es cómo un dato acaba en',
'la fila equivocada. Y lo que se va a escribir se **pre-escribe** antes, para poder revisarlo.',
'',
'### Antes de dar un paso por cerrado',
'',
'```bash',
'node ~/.claude/reportes-backend/nestle/_scripts/E0-99-validar.js          # el esquema sirve',
'node ~/.claude/reportes-backend/nestle/_scripts/E0-3-validar-quincena.js  # la quincena cruza',
'node ~/.claude/reportes-backend/nestle/_scripts/E0-4-validar-preescritura.js',
'```',
'',
'📄 El modelo completo: `_contratos/esquema.json` · el plan: `_orquesta/plan-skills-v2.md`',
'',
FIN].join('\n');

console.log('════════ E0.7 · LA FUNDACIÓN A LOS SKILLS ' + (ESCRIBIR ? '🔴 ESCRIBE' : '(seco)') + ' ════════\n');
var hechos = 0, faltan = [];
SKILLS.forEach(function (s) {
  var ruta = SK + '/' + s + '/SKILL.md';
  if (!fs.existsSync(ruta)) { console.log('   🔴 ' + s.padEnd(34) + 'NO EXISTE'); faltan.push(s); return; }
  var md = fs.readFileSync(ruta, 'utf8');
  var ya = md.indexOf(INI) >= 0;
  var nuevo = ya
    ? md.slice(0, md.indexOf(INI)) + SECCION + md.slice(md.indexOf(FIN) + FIN.length)
    : md.replace(/\s*$/, '') + '\n\n---\n\n' + SECCION + '\n';
  console.log('   ' + (ya ? '↻' : '+') + ' ' + s.padEnd(34) + (ya ? 'actualizada' : 'agregada'));
  if (ESCRIBIR && nuevo !== md) { fs.writeFileSync(ruta, nuevo); hechos++; }
});
if (faltan.length) { console.log('\n  🔴 faltan: ' + faltan.join(', ')); process.exit(1); }
if (!ESCRIBIR) { console.log('\n  (seco. Para escribir: --escribir)'); process.exit(0); }
console.log('\n  ✔ ' + hechos + ' de ' + SKILLS.length + ' skills conocen la fundación');
console.log('  ⚠ rick-reportes-nestle-fuentes NO se toca: está muerto y lo retira la etapa 5.4');
