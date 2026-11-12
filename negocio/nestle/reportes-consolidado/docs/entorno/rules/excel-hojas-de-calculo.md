---
paths:
  - "**/*.xlsx"
  - "**/*.xlsm"
  - "**/*.xls"
  - "**/*.csv"
---

# Excel y hojas de cálculo — reglas de Rick

> Se carga sola al tocar un `.xlsx`/`.xlsm`/`.csv`. Si estás escribiendo un script que manipula Excel
> **sin** abrir el archivo primero, lee este archivo a mano: `~/.claude/rules/excel-hojas-de-calculo.md`.
> El hook `PreToolUse` (`hook-xlsx-protocolo.js`) inyecta el protocolo corto al detectar una escritura;
> este archivo es el detalle completo.

## 🔴 REGLA 0 — NO escribas un `.js` desde cero para tocar un Excel

Van 3 herramientas que cubren lo que antes eran 40-80 líneas repetidas por tarea (y cada copia traía
sus propios bugs de regex/escape). **Úsalas antes de escribir código:**

```
node ~/.claude/tools/xlsx-q.js <archivo> [hoja] [--cols|--distintos|--agrupar|--donde|--formulas|--diff|--salud]
node ~/.claude/tools/xlsx-apply.js <edicion.json> [--dry-run]     # escribir, declarativo
```
```javascript
var K=require(require('os').homedir()+'/.claude/tools/xlsx-kit.js');   // cuando SÍ hace falta lógica
var h=K.abrir(ruta).hoja('Data_Email');
h.n('Email_Sends',42) · h.buscar({Campana_Canonica:'Mundial'}) · h.agrupar('Touchpoint',{sumar:[...]})
h.f('Email_Open_Rate',2) · h.donde('Piñarindo') · K.diff(a,b) · wb.guardar()
```
**Todo direcciona por NOMBRE de encabezado, no por letra** → el mismo código sirve aunque muevan las
columnas, y sirve para cualquier archivo. `xlsx-q.js` sin argumentos imprime su propia ayuda.
⚠️ `h.f()` lee la fórmula del **XML**: SheetJS no expone `.f` si la celda no trae `<v>` cacheado.

### Antes de usar una ruta, RESOLVERLA — se renombran seguido
Las rutas absolutas escritas en scripts y memorias mueren cuando Rick renombra o mueve
(`Interno-Maggi-…`→`ReporteCliente-…`, `Interno-Reporte-…`→`(Interno)-Reporte-…`). Buscar por patrón,
ignorando acentos, guiones y paréntesis:
```
node ~/.claude/tools/find-file.js "consolidado nestle" --ext xlsx     # ranked; ▶ = mejor
node ~/.claude/tools/find-file.js "consolidado" --uno                 # solo la ruta, para scripts
node ~/.claude/tools/find-file.js --recientes --en <carpeta> --dias 7 # qué tocó desde la última sesión
```
`require('.../find-file.js').uno('patrón',{ext:'xlsx'})` desde código. Ordena por coincidencia +
recencia y **manda los `_backups/` al final**.

## 🔴 La cadena de validación — las CUATRO, en este orden

Después de CADA escritura con adm-zip / exceljs / openpyxl / SheetJS:
```
node ~/.claude/tools/xlsx-safe-save.js <archivo>          # 1º repara el PAQUETE OPC
node ~/.claude/tools/xlsx-label.js <archivo>              # 2º restaura la etiqueta Purview
node ~/.claude/tools/xlsx-check.js <archivo>              # 3º valida que Excel no lo repare
$PYTHON ~/.claude/tools/xlsx-validar-fondo.py <archivo>   # 4º 🔴 EL QUE NO SE SALTA
```
✅ Los pasos 1 y 4 ya son automáticos: **`xlsx-safe-save.js` VALIDA ANTES DE ESCRIBIR** y si no pasa
**aborta sin tocar el archivo del usuario** (probado: un archivo roto es rechazado y el original queda
intacto). Escape sólo si algo se atora: `XLSX_SIN_VALIDAR=1`.

🔴 **`xlsx-validar-fondo.py` es obligatorio: sin él no digas que quedó bien.** Valida en 4 capas y
la 2ª es la que faltaba — **`openpyxl`, un lector OOXML estricto e INDEPENDIENTE del código propio**,
que sí ve los errores **semánticos** de hoja (los otros checks son de sintaxis y los dejan pasar).
Verificado: sobre un archivo roto reporta **la misma columna que Excel**. Si un checker propio y un
lector real discrepan, **el equivocado es el propio** — contrastarlo siempre antes de creerle.

🔴 **Ante un "me sale roto", ANTES de teorizar: leer `%TEMP%\error*.xml`** — es el log que escribe
Excel al reparar y dice la parte y la posición exactas. Adivinar en vez de leerlo costó una sesión.
⚠️ Ese log trae **la URL del archivo**, no solo el nombre: filtra por él (`grep -l "<archivo>" error*.xml`)
porque en la carpeta se mezclan los de todos los clientes y el más reciente casi nunca es el tuyo.

🔴 **Corolarios:** (1) NO versionar `-v2/-v3` para esquivar un "roto" — diagnosticar y editar el MISMO
archivo. (2) NUNCA renombrar ni mover un archivo compartido con el equipo: les rompe los links.

### Red de seguridad automática (hooks)
- **`PreToolUse` → `hook-xlsx-protocolo.js`**: al detectar un comando que escribe un `.xlsx` sin la
  cadena segura, inyecta el protocolo. No bloquea. Corre aunque la sesión no haya leído nada de esto.
- **`PostToolUse` → `hook-xlsx-vigilar.js`**: tras cada Bash revisa los `.xlsx` que cambiaron —incluso
  los escritos sin safe-save— y avisa si quedaron rotos. Carpetas en `~/.claude/tools/xlsx-vigilar.json`
  (+ siempre el cwd de la sesión).
- Los hooks son la garantía **determinista**; este archivo y CLAUDE.md son advisory. Aun así corre las
  4 al publicar: son la evidencia que le reportas al usuario.

## 🔴 SÍ puedes ver el render — MÍRALO antes de decir "quedó bien" *(14-ago-2026)*
```
$PYTHON ~/.claude/tools/xlsx-render.py <archivo> <salida.png> [hoja] [rango] [--dpi=300] [--alturas]
```
Devuelve un PNG real (Excel COM → PDF → PyMuPDF) y con él **sí** ves colores, contraste, anchos y
**texto cortado** — el error que más se escapaba. Ciclo: escribir → renderizar → **mirar** → corregir.
Lo que sigue sin verse ahí es si Excel abrirá el diálogo de reparación: para eso `xlsx-check` +
`xlsx-validar-fondo`. Si por lo que sea no renderizaste, di **qué validaste y qué no** — afirmar que
"quedó bien" a ciegas es lo que genera los ciclos de "me sale mal".

## REGLA GLOBAL: verificar con Excel real, no adivinar

⚠️ **MANDATORIO en cualquier sesión que genere o edite un .xlsx con fórmulas.**
Hay **Excel instalado (Microsoft 365)** y se maneja por COM con `pywin32`.
Entregar fórmulas sin verificar convierte al usuario en tu compilador.

1. **NUNCA entregues un .xlsx con fórmulas sin verificarlo.** Abrir por COM → `CalculateFullRebuild()` →
   `SpecialCells(-4123, 16)` → debe dar **0 celdas con error**.
2. **Parchar > reconstruir.** Para cambios puntuales, patchar por COM (`.Formula = "..."`) + `wb.Save()`.
   Excel guarda nativo → no se pierde nada (dropdowns, formato condicional, x14).
3. **openpyxl sirve para crear en bulk**, pero no calcula ni preserva todo.

## Snippet COM (diagnóstico + parche)
```python
import win32com.client as w, os
XL_FORMULAS, XL_ERRORS = -4123, 16
xl = w.DispatchEx("Excel.Application"); xl.Visible=False; xl.DisplayAlerts=False
try:
    wb = xl.Workbooks.Open(os.path.abspath(ruta))     # ruta ABSOLUTA
    wb.Sheets("Hoja").Range("E2").Formula = '=TEXTJOIN(" · ",TRUE,A2,B2)'
    xl.CalculateFullRebuild()
    for sh in wb.Worksheets:                          # escanear errores
        try:
            for c in sh.Cells.SpecialCells(XL_FORMULAS, XL_ERRORS):
                print(sh.Name, c.Address, c.Text, c.Formula)
        except Exception: pass                        # lanza excepción si NO hay errores
    wb.Save(); wb.Close(False)
finally:
    xl.Quit()                                         # SIEMPRE, si no queda instancia huérfana
```

## Gotchas COM
- ⚠️ **SIEMPRE `try/finally` con `xl.Quit()`.** Si truena sin cerrar, queda instancia huérfana que **toma
  el archivo** → el siguiente intento falla con *"being used by another program"*. Es el error que más cuesta.
- **Usar `DispatchEx`, no `Dispatch`** (`Dispatch` se engancha al Excel del usuario).
- ⚠️ **Excel rechaza llamadas COM mientras RECALCULA al abrir.** Síntoma engañoso: el `Open` funciona y
  truena la llamada *siguiente*. Solución: cálculo en manual antes de abrir, recalcular al final:
  ```python
  dummy = xl.Workbooks.Add()   # Excel no deja tocar Calculation sin un libro abierto
  xl.Calculation = -4135       # manual
  wb = xl.Workbooks.Open(ruta)
  dummy.Close(False)
  # ...trabajo...
  xl.Calculation = -4105       # automático
  xl.CalculateFullRebuild()
  ```
- **Diagnosticar un Excel colgado antes de matarlo** (puede ser el del usuario con trabajo sin guardar):
  ```python
  xl = win32com.client.GetActiveObject("Excel.Application")
  xl.Visible   # False = instancia huérfana mía | True = la del usuario, NO TOCAR
  ```
  `taskkill //F //IM EXCEL.EXE` mata TODOS los Excel → verificar antes y avisar.
- **Insertar filas/columnas por COM re-cablea las fórmulas solo** (incluidas otras hojas y referencias
  absolutas). Gran razón para usar COM en vez de openpyxl cuando cambia la estructura.
- El archivo debe estar **CERRADO** por el usuario → revisar lock `~$archivo.xlsx` antes de tocar.
- `Range.Address` es **propiedad**, no método (`c.Address` ✔).
- Usar `PYTHONIOENCODING=utf-8`: un print con acentos truena y **parece** fallo de Excel.
- `.Formula` = inglés · `.FormulaLocal` = localizado.
- 🔴 **pywin32 IGNORA argumentos con nombre en varios métodos de Excel — sin avisar.** No lanza error:
  llama al método **sin** ese argumento. Consecuencias reales vistas:
  | Escrito | Lo que de verdad pasó |
  |---|---|
  | `Hyperlinks.Add(..., TextToDisplay=n)` | la celda mostró la URL cruda |
  | `Worksheets.Add(After=última)` | la hoja se creó en otra posición |
  | `hoja.Move(After=otra)` | **`Move()` sin argumentos → la hoja se fue a un LIBRO NUEVO y desapareció del original** |
  **Regla: pasar por POSICIÓN, o setear la propiedad después.** `Move(Before, After)` → el primer
  posicional es *Before*: `hoja.Move(wb.Sheets("LaDeAdelante"))`. Para el texto de una liga:
  `hl = celda.Hyperlinks(1); hl.TextToDisplay = "nombre"`.
  **Y siempre verificar el efecto** (releer nombre/posición/valor), no asumir que la llamada funcionó.
- 🔴 **`COUNTIFS(...,rango_criterios)` escrito por COM `.Formula` cuenta MAL — usa SUMPRODUCT.** Al pasar
  un rango como criterio (para contar contra una LISTA de valores, p.ej. varios estatus que cuentan como
  "cerrado"), `.Formula` lo entra con **intersección implícita**: cada fila agarra UN solo valor del rango
  según su posición, no la lista completa → conteos silenciosamente equivocados (una campaña "cerrada"
  cae a 0). Se ve bien, no truena. **Envuelve en `SUMPRODUCT`** para forzar evaluación de arreglo, que es
  independiente de versión y de cómo COM entró la fórmula:
  `=SUMPRODUCT(COUNTIFS(datos!$H$3:$H$999, Listas!$M$2:$M$5))` en vez de `=SUM(COUNTIFS(...,Listas!$M$2:$M$5))`.
  ⚠️ El rango de criterios debe cubrir **exactamente** la lista, **sin celdas vacías de sobra**: un criterio
  vacío cuenta las celdas de datos vacías (aquí, piezas sin estatus) como si cumplieran. Y para variantes de
  escritura usa comodín dentro de una celda del rango (`*Finalizad*`) — COUNTIFS respeta el `*` venga de
  literal o de celda.
- 🔴 **Columna calculada de una tabla (ListObject): escribir al RANGO COMPLETO se revierte solo.** Excel
  restaura la fórmula guardada de la columna. `AutoCorrect.AutoFillFormulasInLists=False` **no basta**
  si la columna tiene fórmulas inconsistentes (unas filas con una versión, otras con otra: ahí solo
  se actualizan las "consistentes"). **Lo determinista es escribir fila por fila** construyendo las
  referencias relativas de cada una, y contar cuántas quedaron.
- ⚠️ **Borrar filas encoge los rangos de las fórmulas que las contienen**: un `INDEX($J$2:$J$28)` pasa
  a `$J$2:$J$23` al borrar 5 filas de en medio → las campañas nuevas dejan de resolver **en silencio**.
  Al borrar filas de una tabla maestra, **releer y reamplíar** los rangos de los lookups que la citan.
- ⚠️ Un texto que empieza con `=` `+` `-` `@` se interpreta como **fórmula** al asignar `.Value`
  (`com_error` genérico). Prefijar con `'` para forzar texto.

## 🔴🔴 adm-zip ROMPE EL PAQUETE OPC — la causa nº1 de "me sale roto"

**Diagnosticado 30-jul-2026.** Durante meses el usuario reportó que los Excel "salían rotos" tras cada
edición. El diagnóstico que se dio por bueno —*caché de OneDrive*— **era falso**, y el "workaround" que
se adoptó (guardar con nombre nuevo `-v2`, `-v3`…) era un parche sobre un diagnóstico equivocado: generó
versiones inútiles y **llegó a romperle los links a un archivo compartido con el equipo**.

La causa real son **dos comportamientos de `adm-zip`**. Ninguno se ve en un diff de celdas, ninguno lo
detecta `xlsx-check.js`, y el archivo pasa todas las validaciones de contenido. Por eso costó tanto:

| # | Qué hace adm-zip | Por qué Excel repara |
|---|---|---|
| **a** | **`deleteFile()` no borra: RENOMBRA la entrada a `[trash]/0000.dat`** | queda una parte dentro del `.xlsx` **sin content-type**; Excel recorre el paquete, encuentra algo que no sabe interpretar → *"contenido ilegible"* |
| **b** | **`writeZip()`/`toBuffer()` REORDENA las entradas alfabéticamente** | `[Content_Types].xml` deja de ser la **primera** entrada del zip, que es lo que exige **ECMA-376 Parte 2 §10.1.1** |

Evidencia: los respaldos del reporte de Nestlé acumulaban **de 1 a 7 partes `[trash]`** desde el 6-jul-2026
— justo cuando empezaron las quejas. Y verificado en adm-zip **0.5.18**: metes `[Content_Types].xml`
primera y sale **segunda**, tras `_rels/.rels`. **No hay opción para desactivarlo.**

⚠️ **`getEntries()` MIENTE sobre el orden** (también reordena al listar). El orden real se lee del primer
local header del zip:
```javascript
var buf=fs.readFileSync(f), nl=buf.readUInt16LE(26);
var primera=buf.slice(30,30+nl).toString('utf8');   // debe ser "[Content_Types].xml"
```

### Las dos herramientas
```
node ~/.claude/tools/xlsx-diagnose.js  <archivo.xlsx>   # ¿por qué repara? (no modifica)
node ~/.claude/tools/xlsx-safe-save.js <archivo.xlsx>   # lo arregla (in-place o [salida])
```
- **`xlsx-safe-save.js`** reescribe el zip **a mano** (writer propio con `zlib`, orden determinista) con
  `[Content_Types].xml` primero; tira las partes `[trash]/` y cualquier parte sin content-type; y elimina
  `xl/calcChain.xml` + su `Override` + su `Relationship` (Excel lo reconstruye solo; un calcChain desfasado
  tras reescribir fórmulas es la otra causa clásica). **Aborta sin escribir** si el paquete quedaría mal.
  Verificado no-destructivo: 14,532 celdas idénticas antes/después, imágenes y estilos byte a byte.
- **`xlsx-diagnose.js`** revisa además: sharedStrings con índice fuera de rango, `s="N"` fuera del rango de
  `cellXfs`, `definedNames` huérfanos y relaciones colgadas. Sale con código 1 si algo está mal.

### Reglas
1. **`xlsx-safe-save.js` es el ÚLTIMO paso de cualquier escritura** (adm-zip, exceljs, SheetJS, openpyxl),
   antes de `xlsx-label.js` y `xlsx-check.js`. Es idempotente.
2. **NO versionar (`-v2`, `-v3`…) para "esquivar" un archivo roto.** Si sale roto, **diagnosticar**.
   Se edita el MISMO archivo.
3. 🔴 **NUNCA renombrar ni mover un archivo compartido con el equipo.** Los links que ya repartieron
   quedan colgando. Si de verdad hace falta una copia, va en **otra** carpeta (la propia), nunca
   renombrando la que ellos abren.
4. Preferir **`updateFile()`** sobre `deleteFile()`+`addFile()`: `updateFile` no genera `[trash]`.

## 🔴 exceljs (Node) — el round-trip DEGRADA el archivo y Excel lo REPARA

**Diagnosticado con evidencia el 29-jul-2026, tras >10 ediciones del mismo libro.**
El patrón `readFile(ruta) → modificar → writeFile(MISMA ruta)` **no es lossless** sobre un `.xlsx`
que creó Excel. Comparando el original (19 partes) contra la versión editada, exceljs **borró**:

| Parte perdida | Consecuencia |
|---|---|
| `xl/externalLinks/externalLink1.xml` + su `.rels` | enlaces a otros libros, eliminados |
| `docProps/custom.xml` | propiedades personalizadas |
| `xl/calcChain.xml` | (inofensivo: Excel lo reconstruye) |

**La causa del "Read-Only — Repaired" fue un `definedName` HUÉRFANO:**
```
_xlnm._FilterDatabase = '[1](Draft) Reporte'!$A$1:$P$1
```
Al borrar una hoja con `wb.removeWorksheet()`, exceljs quita la hoja **pero deja el nombre definido
que Excel había creado para su autoFilter**, y encima ya había borrado el `externalLink` al que el
`[1]` apuntaba. Excel abre, no resuelve la referencia y repara el archivo.
🔴 **`removeWorksheet()` NO limpia los `definedNames` de esa hoja. Hay que limpiarlos a mano.**

### Reglas al usar exceljs

> 🔴 **REGLA 0 — DIFFEAR ANTES DE ESCRIBIR, no después.**
> `removeWorksheet()` + `addWorksheet()` **destruye** lo que el usuario haya editado a mano en esa
> hoja, sin dejar rastro y sin que ninguna validación posterior lo detecte: para cuando corres el
> check, el trabajo suyo ya no existe. Un check post-escritura levanta el acta del daño, no lo evita.
> Antes de regenerar una hoja de un documento vivo:
> 1. Abrir el archivo y volcar la hoja que se va a tocar (valores + fórmulas).
> 2. Compararla contra lo que el script va a producir.
> 3. Si hay algo que el script NO reproduce → **es del usuario. Avisar y esperar**, no "emparejarlo"
>    con otra versión ni asumir que la más completa es la buena. Que dos archivos hermanos difieran
>    suele ser una decisión, no un descuido.
>
> Un respaldo previo NO sustituye esto: sirve para reparar, y para entonces el usuario ya perdió tiempo.

1. **Después de CADA escritura, correr el check de integridad de abajo.** No es opcional.
2. **Escribir siempre `result` en las fórmulas**: `{ formula:"A1+B1", result: 42 }`. Con `result:null`
   Excel muestra la celda **vacía** hasta que recalcule, y el usuario lo lee como "no se guardó".
   ⚠️ exceljs **no persiste `result: 0`** — un cero se relee como `undefined`; es inofensivo pero
   no confundirlo con un fallo.
3. **`wb.calcProperties.fullCalcOnLoad = true` NO se persiste.** Inyectar a mano en el zip:
   `<calcPr calcId="..." fullCalcOnLoad="1"/>` en `xl/workbook.xml`.
4. **Para cambios quirúrgicos, NO usar exceljs: editar el XML dentro del zip** con `adm-zip`,
   tocando solo la parte necesaria. Eso preserva todo lo demás intacto y es idempotente.
5. **Los scripts que insertan columnas deben ser IDEMPOTENTES.** Si el script lee sus propios valores
   de la hoja para "rescatarlos", la segunda corrida los lee **desplazados** y corrompe los datos
   en silencio. Fijar los valores en el script o detectar si la columna ya existe. Añadir una
   autovalidación que aborte si un total no cuadra.
6. 🔴 **`writeFile()` BORRA `docProps/custom.xml`** → se pierde la etiqueta de sensibilidad de
   **Microsoft Purview** (Confidential, Internal…). El libro abre bien y se ve idéntico; el hallazgo
   es de cumplimiento y solo aparece en una auditoría. Restaurar siempre después de escribir:
   `node ~/.claude/tools/xlsx-label.js <archivo>` (la saca del respaldo; `--check` solo reporta).
7. ⚠️ **exceljs trunca los tamaños de fuente fraccionarios**: `7.5` se relee y se escribe como `7`.
   En una hoja con tipografía chica eso **corta texto** que antes cabía. Si el formato original usa
   medios puntos, no pasarlo por un round-trip de exceljs — editar el XML con `adm-zip`.
   También **descarta `_xlnm.Print_Area`**, así que se pierde el área de impresión definida.
8. 🔴 **Fechas: exceljs convierte `Date` ↔ serial en UTC; un lector JS con `getDate()` corre por la zona
   horaria (aquí GMT-6) y muestra el día ANTERIOR.** Para que Excel muestre el 26-oct se escribe
   `new Date('2026-10-26T00:00:00Z')` — **sin** «+1 día». Verificar siempre con Excel real
   (`ws.Range("K9").Text` por COM o `xlsx-render.py`), **nunca con un script JS que relea lo escrito**:
   es circular y da por buena una fecha corrida. *(oct-2026: un «+1 día» mío dejó el corte de
   vigencia del SPECS de KitKat en 1-dic en vez de 30-nov, y se había reportado como verificado.)*

### Check de integridad OBLIGATORIO (detecta lo que hace que Excel repare)
Sobre el zip, con `adm-zip`:
1. **`definedNames` huérfanos** → cada uno debe apuntar a una hoja que EXISTE, sin `[n]` de libro
   externo ni `#REF!`. **Es la causa nº 1 de reparación.**
2. **Relaciones huérfanas** → todo `Target=` de `xl/_rels/workbook.xml.rels` debe existir en el zip.
3. **`externalReferences` consistente** → declarado en `workbook.xml` ⟺ archivo presente en el zip.
4. **Orden OOXML dentro de `<worksheet>`**: `dimension > sheetViews > sheetFormatPr > cols >
   sheetData > autoFilter > mergeCells > dataValidations > pageMargins > pageSetup`. Fuera de orden → repara.
5. **`count` declarado = elementos reales** en `mergeCells` y `dataValidations`.
6. **Merges sin solapamientos.**
7. **Fórmulas sin `#REF!`** y sin valor cacheado faltante (salvo los ceros).
Scripts de referencia en el scratchpad de esta sesión: `diag_definednames.js`, `diag_orden.js`,
`diag_degradacion.js`, `fix_definednames.js`, `fix_calcpr.js`.

## Gotchas openpyxl
- 🔴 **Un texto que empieza con `=` se escribe como FÓRMULA y Excel se NIEGA A ABRIR el archivo.**
  No es que salga mal el valor: `Workbooks.Open` truena con *"Open method of Workbooks class failed"*
  y openpyxl relee el archivo sin quejarse, así que el zip parece sano. Pasó con etiquetas de fila tipo
  `"=  SALDO MÍNIMO (día 4)"` → quedaron como `<f>  SALDO MÍNIMO (día 4)</f>`.
  **Usar otro glifo para subtotales (`►`) y el menos Unicode `−` (U+2212) para las restas.**
  Diagnóstico rápido: abrir con `Workbooks.Open(ruta, *[None]*13, 1)` (CorruptLoad **posicional**);
  si con eso abre, es contenido inválido → bisecar quitando `<f>...</f>` del sheet XML.
- **Prefijo `_xlfn.`**: openpyxl NO lo agrega → funciones modernas salen `#¿NOMBRE?`. Escribir
  `_xlfn.LET`, `_xlfn.TEXTJOIN`, `_xlfn.XLOOKUP`, `_xlfn._xlws.FILTER`… Las del spec original
  (IF, SUMIFS, INDEX, MATCH, VLOOKUP, IFERROR, SUM…) no lo necesitan.
- **Pierde sus validaciones dinámicas** (dropdowns con OFFSET/x14) al re-leer su archivo → no hacer
  load+save; recrear las DV o parchar por COM.
- **No calcula**: `data_only=True` solo da valores si **Excel** guardó antes.
  `wb.calculation.fullCalcOnLoad = True` fuerza recálculo al abrir.
- ⚠️ **Imágenes/media: SheetJS y openpyxl los DESTRUYEN** al reescribir; **COM los preserva.** Revisar
  antes: `[n for n in zipfile.ZipFile(f).namelist() if 'media' in n]` → si trae media, ir por COM o XML.

## 🔴 NO leer un CSV con SheetJS si trae FECHAS o TELÉFONOS

`XLSX.readFile()` sobre un `.csv` **interpreta y convierte**, y las dos conversiones destruyen datos:

**1. Fechas: asume formato AMERICANO (mm/dd).** Un CSV latino con `01/08/2026` (1 de agosto) se
lee como **8 de enero** y se guarda como serial. El síntoma engaña: los días **13-31 se salvan**
(no son meses válidos y quedan como texto), así que **solo se corrompen los días 1-12** — el error
parece aleatorio y la mitad de los datos se ve bien. *(Costó 14,037 mensajes descartados en
silencio: el 1-6 de agosto se volvieron enero-junio y ninguna fecha coincidía con su envío.)*

**2. Teléfonos y folios largos → notación científica** (`5.24425E+11`), irrecuperables: quedan
6 dígitos significativos y ~159 candidatos por número.

**Solución: leer el CSV como TEXTO y parsear a mano.** Nunca dejar que una librería adivine el tipo.
```javascript
const txt = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '');   // quitar BOM
// parser propio respetando comillas; toda celda queda como string
const fecha = s => { const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : ''; };   // dd/mm/yyyy
```
**Cómo detectarlo:** censar las fechas resultantes. Si aparecen meses donde no hubo actividad
(enero-junio en una campaña de agosto) **con volumen alto**, están invertidas. Y **abortar** cuando
una fecha del origen no corresponde a nada declarado, en vez de descartar la fila calladamente.

## ⚠️ Un .xlsx grande (>20 MB) NO se abre con SheetJS — usar streaming

`XLSX.readFile` sobre 40 MB / 136k filas × 167 columnas **no termina** (ni en 10 min). Y `at(r,c)`
con `encode_cell` son millones de strings. Con el lector en streaming de exceljs: **11 segundos**.
```javascript
const rd = new E.stream.xlsx.WorkbookReader(ruta, { entries:'emit', sharedStrings:'cache', worksheets:'emit' });
for await (const ws of rd) for await (const row of ws) { const v = row.values; /* v[1] = col A */ }
```
⚠️ En streaming las **fechas llegan como SERIAL** (`46198.75`), no como `Date`:
`new Date(Math.round(v*86400000) + Date.UTC(1899,11,30))`. Sin convertir, toda comparación de
fechas falla aunque el archivo esté perfecto.

## xlsx (SheetJS) — leer y clonar preservando estilos
```javascript
const wb = XLSX.readFile(FILE, { cellStyles: true });          // cellStyles al leer Y al escribir
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
// clonar hoja: copiar cada key; las que empiezan con '!' con JSON.parse(JSON.stringify()), el resto Object.assign
// escribir celda conservando estilo: setear .v y .t, y BORRAR .w (caché de texto) y .r (rich text)
XLSX.writeFile(wb, OUTPUT, { cellStyles: true });
```

**⚠️ Row offset en templates con `!ref` desde row 2** — si el template arranca en row 2,
`data.indexOf(row)+1` da índice del array, no el row de Excel. Regla: **F-label N = Excel row N+1**.
Siempre diagnosticar con un script debug (`encode_cell({r,c})`) antes de asumir direcciones.

**Fechas Excel (serial) → fecha legible**
```javascript
const excelDateToJS = s => new Date(Math.round((s - 25569) * 864e5)).toISOString().slice(0, 10);
```

## 🔴🔴 FÓRMULAS COMPARTIDAS — insertar filas por XML las rompe *en silencio* (17-ago-2026)

Una fórmula compartida son **dos celdas que se necesitan**:

```xml
maestro    <c r="L4"><f t="shared" ref="L4:L47" si="2">IF(G4=0,0,K4/G4)</f><v>…</v></c>
seguidor   <c r="L52"><f t="shared" si="2"/><v>…</v></c>
```

El seguidor **no guarda su fórmula**: Excel la deduce trasladando la del maestro, y para eso
exige que el seguidor caiga **dentro del `ref`** que el maestro declara.

**Al insertar filas con adm-zip las celdas se renumeran, pero el `ref` del maestro NO.**
La fila de totales pasa de la 47 a la 52, el maestro sigue diciendo `ref="L4:L47"`, y el
seguidor de `L52` queda fuera de su propio rango. Excel contesta al abrir:

```
Removed Records: Shared formula from /xl/worksheets/sheetN.xml part
Removed Records: Formula from /xl/calcChain.xml part
```

**Por qué se escapó tantas veces:** el XML es **válido**. No hay atributo mal cerrado ni índice
fuera de rango. El error es **semántico y entre dos celdas**, así que ni un parser estricto, ni
`openpyxl`, ni `xlsx-check` (antes de esta fecha) lo veían: los tres decían "íntegro" sobre un
archivo al que Excel le iba a borrar 9 fórmulas. Los logs `%TEMP%\error*.xml` del reporte de
7UP DOT lo dijeron literalmente el 10 y el 13 de agosto y no se leyeron a tiempo.

### Cómo se maneja
```
node ~/.claude/tools/xlsx-compartidas.js <archivo>            revisa y repara
node ~/.claude/tools/xlsx-compartidas.js <archivo> --revisar  solo reporta
```
- **Ya es automático**: `xlsx-safe-save.js` recalcula esos `ref` antes de escribir, y **se niega
  a escribir** si el buffer final todavía trae alguno roto.
- `xlsx-check.js` lo reporta como FALLA, y el hook `hook-xlsx-vigilar.js` lo revisa aparte
  (el validador de openpyxl no puede verlo).
- **Irreparable**: un seguidor **sin maestro** — la fórmula solo vivía en el maestro y ya no
  está. No se puede deducir; hay que reescribirla a mano. safe-save aborta en ese caso.

⚠️ **Un maestro puede declarar UNA SOLA CELDA** (`ref="W34"`, sin dos puntos). Es legal y Excel
lo escribe así cuando el grupo tiene un solo miembro. Asumir que siempre hay `:` da un falso
positivo de "seguidor sin maestro" — y con safe-save abortando, eso **impide guardar un archivo
sano**. Verificado contra `Roadmap_Auronix_WA_7UP_CRM.xlsx`.

## Fórmulas: gotchas de Excel mismo
- 🔴 **`IFERROR(rango,0)` dentro de SUMPRODUCT colapsa a ESCALAR** — no se evalúa fila por fila:
  toma la primera celda del rango y la aplica a todas. Una ventana de meses tipo
  `(IFERROR(H,0)<=M)*(M<=IFERROR(H,0)+E-1)` proyecta ingresos en los meses equivocados **sin dar error**.
  Solución: quitar el IFERROR — una celda vacía ya vale 0 en una comparación numérica:
  `(H<=M)*(M<=H+E-1)`.
- **`(H=M)+(I=M)` cuenta DOBLE** si ambas columnas traen el mismo mes. Envolver: `((H=M)+(I=M)>0)`.

## OneDrive / SharePoint
- Archivos online-only son **placeholders**: hidratar (copiar a ruta local ASCII) antes de leer,
  si no → `Bad compressed size: 0`.
- ⚠️ **`Get-ChildItem` y `find` MIENTEN en carpetas de OneDrive** (no ven los placeholders
  deshidratados). Para medir o comparar contenido ahí: **`robocopy <src> <dst> /L`** (solo lista).
- Para tocar un documento compartido sin dañarlo: **cirugía del XML** (unzip → editar solo la parte
  necesaria → rezip). Verificar antes que no haya charts/media/pivot/vba.
- Las rutas de OneDrive llevan acentos (`Librería`) → rompen scripts de Python; copiar a ruta ASCII
  temporal si algo falla, o resolver la carpeta por comodín.

### 🔴 Co-autoría: "no se guardó" que NO es tuyo
En un libro de SharePoint puede haber alguien editándolo **al mismo tiempo desde Excel Online**.
Guarda sin dejar rastro local y **pisa** lo que tu script escribió, sin ningún defecto en el XML.
- ⚠️ **OneDrive/SharePoint NO crean archivos `~$`** → buscarlos **no** detecta si el libro está
  abierto. Ese chequeo da falsos negativos y es la razón por la que "verifiqué que estaba cerrado"
  no significa nada aquí.
- Lo que **sí** funciona: guardar el `mtime` antes de escribir y releerlo después; si cambió sin que
  tú escribieras, hubo otra mano. Y revisar `docProps/app.xml` → `<Application>`: si dice
  *Microsoft Excel Online*, el último guardado fue de otra persona, no del escritorio.
- Antes de dar por hecho que tu escritura falló, **preguntar al usuario si alguien de su equipo tiene
  el archivo abierto**. Concluir "lo rompí yo" sin descartar esto lleva a reescribir de más.
