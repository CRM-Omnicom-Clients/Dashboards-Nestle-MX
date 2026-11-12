---
name: crm-reporte-fuentes-qcart
description: Arma los dos bloques de Qcart en el backend — carritos y productos, por separado y sin calcular nada. Úsalo cuando lleguen descargas nuevas de Qcart, o para saber cuánto del tráfico es realmente nuestro.
---

# qcart-bloque · Bloque Qcart

<!--@DECLARACION-->
## 🔴 Lo que este skill lee, lo que lo vigila y lo que le exigen

> Este bloque **se genera** desde el estado real del sistema con
> `orquestador.declarar-en-skills.js`. No se edita a mano: un bloque escrito a mano se
> desfasa en cuanto cambia una guarda — que es justo lo que le pasó al mapa de la cadena.

**Su turno:** etapas 3 · 6   ·   **4 script(s) de ejecución**

**Contratos que lee**

- `_contratos/_catalogo/activacion-qcart.json`
- `_contratos/cambios-pendientes.json`
- `_contratos/entorno.json`
- `_contratos/esquema.json`
- `_contratos/exclusiones.json`
- `_contratos/registro.json`

**Hooks que lo vigilan** — viven en `~/.claude/settings.json`, los dispara Claude Code sin que nadie los invoque

| Hook | Cuándo | Qué impide |
|---|---|---|
| `hook-xlsx-protocolo` | antes de `Bash` | antes de tocar un `.xlsx` por Bash, inyecta el protocolo de escritura |
| `hook-columna-literal` | antes de `Write|Edit` | rechaza escribir un script que lea por literal una columna que ya mordió |
| `hook-xlsx-vigilar` | después de `Bash` | después de tocar un `.xlsx`, comprueba que se corrieran las 5 capas |

**Lo que le exige el preflight** — las guardas corren solas antes de la etapa 1; ninguna depende de que alguien se acuerde

- **Guarda 1 · destructivo sin skill** — 🔴 **detiene el corte** por lo grave, avisa por lo demás
- **Guarda 2 · id duplicado** — 🔴 **detiene el corte**
- **Guarda 3 · lectura por literal** — avisa y viaja al handoff
- **Guarda 4 · script suelto del catálogo raíz** — 🔴 **detiene el corte** por lo grave, avisa por lo demás
- **Guarda 5 · escribir sin haber declarado** — 🔴 **detiene el corte**
- **Guarda 6 · una pieza es su nombre** — 🔴 **detiene el corte** por lo grave, avisa por lo demás
- **Guarda 7 · una ruta se pide, no se escribe** — 🔴 **detiene el corte** por lo grave, avisa por lo demás
<!--/@DECLARACION-->

Tercer paso del ciclo. Armas **dos** bloques de eventos en el backend. La puerta 1 los escribirá
después, junto con los otros, en una sola pasada.

```bash
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-insumos.insumos.js              # primero insumos-validar
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-qcart.activacion-qcart.js    # la autoridad de links
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-qcart.qcart.js               # los dos bloques
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-qcart.validar.js          # ¿migró bien?
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-qcart.refutar.js          # ¿puedo romperlo?
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-qcart.simular-nuevo.js    # ¿y la próxima descarga?
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-qcart.simular-siguiente.js # ¿le sirve a motor-calculo?
```

## 🔴 Lo que este paso NO hace: calcular

`Data_Qcart` (la hoja vieja) hacía **dos cosas que no le tocan**, y por eso había que rehacerla:

| | Qué pasaba |
|---|---|
| **mezclaba granularidades** | `Views`/`Carts_Total` son nivel carrito; `Producto_Top`/`Num_Distintos` son nivel producto. Para caber en una fila **hay que agregar los productos**. Ahí es donde «sumaba» |
| **calculaba** | `Pct_Penetracion` (=O/N), los dos tickets promedio, `Num_Distintos`, los `Top`. Todo eso es **motor-calculo** |

| | qcart-bloque | motor-calculo |
|---|---|---|
| traer el dato como viene, decidir qué entra | ✅ | |
| **Σ para comprobar que nada se perdió** | ✅ | |
| penetración · tickets · tasas · tops | ⛔ | ✅ |

**Sumar para cuadrar no es calcular.** `Σ bloque == Σ fuente` es integridad; `Nestlé ÷ Total` es
una métrica de negocio.

**Probado** (`N2b-98`): motor-calculo deriva penetración (22 piezas), ticket (23) y producto top (22) **sin
que el bloque los traiga** — y además puede cortar por **144 días** y **4 tiendas**, cosa que la
hoja vieja no permitía (tenía `Periodo_Reporte: Agosto`).

## 🔴 LA PAUTA: EL DOC DE LINKS DEFINE LAS PIEZAS (Rick, 27-ago-2026)

> «Todas las filas del doc link Qcart marcan una pieza, **cada mes de marzo a agosto**, eso define
> todo. Si es mismo segmento en diferente mes con short link distinto, es ahí donde cuadras.
> Únicamente envío principal, **nunca FUPs**. Por eso el catálogo es primero.»
>
> «¿Quién manda? Es una **combinación**: email name, cada uno con sus links. Cada fila de qcart es
> una pieza, y esa pieza viene de la data de email. Todos los catálogos se relacionan por el
> **EMAIL NAME**.»

**Un BLOQUE del doc = MES × campaña × touchpoint × audiencia, con sus shortlinks. Eso es UNA
pieza.** El mismo segmento en otro mes, con otros códigos, es OTRA pieza y por tanto otra fila.
La validación del skill es, literalmente: **todas las filas del doc contra todas las piezas,
por `Email_Name` y sus shortlinks.**

```bash
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-qcart.auditar-pauta.js       # el doc vs el catálogo
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-qcart.alinear-doc-piezas.js  # el plan de corrección
node ~/.claude/reportes-backend/nestle/_scripts/catalogo.realinear-codigos-qcart.js --escribir
```

### 🔴 Solo cuentan las filas CON FECHA y de un mes vigente
Nada de hojas sueltas (`Reemplazos`, `Roadmap`, `Borradores`, `Cuaresma`), nada sin fecha de
envío, y **septiembre no cuenta mientras estemos en agosto** — son partidos programados, no
envíos. Leer septiembre hacía que `TYZa8g47` apareciera bajo dos touchpoints (`e-j5` y `e-p4`) y
volvía ambiguo un código que no lo es.

### 🔴 EL LECTOR DESCARTABA MEDIO SEMESTRE EN SILENCIO
`lib-maestro-links` tenía la fila del encabezado **fija en el índice 3** y la columna del código
**fija en `Códigos`**. Ninguna de las dos cosas vale para las tres primeras hojas:

| Hoja | Encabezado | Campaña | Touchpoint | Segmento | Código |
|---|---|---|---|---|---|
| **Marzo** | f8 | `Campaña` | `Nombre Mail` | `Audiencia` | `ID` |
| **Abril** | f8 | `utm_campaign` | `utm_content` | `utm_term` | `Código` *(singular)* |
| **Mayo** | f8 | `utm_campaign` | `utm_content` | `utm_term` | **ninguna** → de la URL de `QCart R1` |
| Jun · Jul · Ago | f4 | `utm_campaign` | `utm_content` | `utm_term` | `Códigos` |

Las tres se descartaban dejando un aviso **que nadie lee**. Hoy se busca el **rol**, no el nombre;
el encabezado se busca en vez de asumirse; y **una hoja de mes que entrega cero filas es un error
explícito**, no un renglón en un array. Un aviso no es una salvaguarda.

### 🔴 SI EL TOUCHPOINT Y EL SEGMENTO CHOCAN, GANA EL SEGMENTO
Es la lección de marzo, y costó **191 carritos en el segmento equivocado con la suma cuadrando**.
`Catalogo_Referencias` traía `Email 1→E-P1`, `Email 2→E-P2`, `Email 3→E-P3`: un alias que deduce
el touchpoint del **número del correo**. Pero el doc de marzo trae la audiencia en su propia
columna y dice Email 1 = Traditional Parents · Email 2 = **New Parents** · Email 3 = **Career
Focused** — que en AON son E-P1, **E-P3** y **E-P4**. Los códigos quedaron corridos una posición:

```
ETJFEOzD + 1iqH9Tx7   58 carritos   Dinkies      → New Parents
E8RDSsHg + 9Bm8slOi  133 carritos   New Parents  → Career Focused
```

**La audiencia es un hecho del envío; el «Email N» es una etiqueta de redacción.** Cuando los dos
se contradicen no se elige: gana el segmento y se **declara que el alias está mal**, porque el
choque es el síntoma, no el problema.

### 🔴 Y un alias es CONTEXTUAL
`FamilyFocused` apuntaba a `FamilyKids`, que es un segmento de **Hotcakes**; `FamilyFocused` solo
aparece en **AON abril**, donde la audiencia es `Traditional Parents`. Un alias que cruza campañas
resuelve siempre y acierta a veces.

---

## 🔴 Las dos reglas de pertenencia — la unidad es el LINK

De los 2 archivos **no todo es nuestro**:

```
1 · PERTENENCIA   el shortlink tiene que estar en NUESTRO catálogo de links
2 · VENTANA       y solo cuenta desde la FECHA DE ACTIVACIÓN de ESE link
```

⚠ **Por link, no por pieza.** `001-P001` manda en marzo y abril y su único código es el de abril:
una sola fecha para toda la pieza recortaría el tráfico del otro envío.

La autoridad es `Qcart-Links Mails-Hive- MX.xlsx`, columna **«Fecha de envío»**:

| Dice | Resultado |
|---|---|
| una fecha (serial, `dd/mm/aaaa` o **«19 de julio»**) | ✅ fecha de activación |
| `No enviado` · `No salió` · `No seleccionado` · vacío | ⛔ **el link no es válido**: su tráfico no entra |

### Lo que el filtro deja fuera hoy — y por qué importa

🔴 **Se cuenta en LAS DOS unidades, y hay que leer las dos** (29-sep-2026). Las cifras de filas
describen a dónde fue cada fila del CSV; la **métrica** que sale de aquí son **vistas**. Este cuadro
decía solo filas, y ahí es donde se esconde el defecto de septiembre.

```
                         FILAS            VISTAS      vistas/fila
CARRITOS   total        32,082           470,733
           entran           671             1,729         2.6
           sin código     1,829             3,166         1.7   ← ⚠ pesa MÁS que lo que entró
           ajenos        29,513           465,753        15.8
           antes activ.      49                73         1.5
                          ✔ cuadra        ✔ cuadra   (por separado)

PRODUCTOS  total         6,865           487,818
           entran           280             1,081         3.9
           sin código     1,177             5,964         5.1
```

⚠ **En filas, `sin código` parece un cajón de descartes; en vistas son 3,166** — más que las 1,729
que entraron en este refresh. Ahí viven los **271 carritos** con el utm correcto y sin shortlink que
Rick no se creyó («6 carritos para J7» eran ~56). Y la razón vistas/fila **cambia por cajón**, así
que ningún porcentaje calculado sobre filas se puede leer como porcentaje de carritos.

**La evidencia de que el filtro sirve:** 4 links de hotcakes tienen tráfico desde el **11-marzo**
y se activaron el **20-mayo**. Son 70 días de tráfico que **no es de nuestro envío**.

### ⚠ La protección contra el typo

Si la fecha de un link **contradice a su propia hoja** del doc (≥3 meses), **no se aplica la
ventana**: se deja pasar y se marca. `lechera-junio` con fecha 2027 borraría el 100% del tráfico
de su pieza **y el resultado se vería perfectamente normal**.

⚠ Y «está en el futuro» **no** alcanza como criterio: 7 links de `Maggi-LigaMx-agosto26` apuntan
a septiembre porque son **partidos programados**. La coherencia se mide contra la hoja, no contra
hoy ni contra el nombre de la campaña (`maggi-julio14` lleva el DÍA 14, no el año 2014).

## 🔴 Son LOGS, no un refresh

| | Email (email-bloque) | **Qcart (qcart-bloque)** |
|---|---|---|
| una fila es | un envío que **acumula** | un **bucket** día × hora × shortlink × utm × tienda, **con contador** |
| actualizar | `MAX` por métrica | **APPEND** de lo que no estaba |
| lo ya cargado | puede crecer | **no se toca nunca** |

## 🔴 UN CARRITO ES UNA **VISTA**, NO UNA FILA — el defecto de septiembre

La fila del CSV **no es un carrito**: es un bucket con la columna `views` como contador. Contarlas
daba **3,077** donde hay **7,503** carritos, y **444 filas traen `views = 0`** — filas que no son
ningún carrito. Un error del 144% con todas las sumas cuadrando.

🔴 **Y ninguna puerta podía verlo, por construcción.** Las puertas cruzan bloque ↔ rejilla ↔
reporte, y los tres descienden de este bloque: si la unidad del origen está mal, **los tres
coinciden**. Un sistema que se compara consigo mismo prueba que es CONSISTENTE, no correcto. La
primera medida externa la trajo Rick de su sesión con Qcart.

⚠ **Al corregir una unidad hay que mirar a todos sus divisores.** `Tasa_Productos_a_Carritos`
dividía filas entre filas: mal, pero consistente. Al pasar carritos a vistas se volvió filas ÷
vistas — se arregló una pata y se rompió la otra en el mismo commit.

📄 La unidad de cada métrica se declara en `_contratos/unidades.json` (`unidad` · `origen` · `se_compara_con`) y la vigila `orquestador.guardian-unidades.js` en la PUERTA 2.
El export **agregado** de Qcart (`carts-<periodo>.csv`, **sin** `-raw-`) es su propio resumen y por tanto
la **única medida externa** que este bloque tiene. Vive en `_backups/no-se-cargan/` a propósito: cargarlo
duplicaría el volumen. Se contrasta con:

```bash
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-qcart.medida-externa.js
```

Medido hoy: **19 de 29 shortlinks con vistas exactas (66%)** y 19/29 con importe exacto, sobre los que
están en los dos dentro de la ventana del agregado. 🔴 **La ventana es la del AGREGADO, no la del
bloque** —el nombre del archivo la declara— porque el bloque cubre más meses y compararlo entero
daría descuadre en todos los shortlinks con tráfico anterior.

⚠ **Los descuadres van en las DOS direcciones** (6 arriba +55 vistas, 4 abajo −23, neto +32 sobre
1,351 = 2.4%), y eso es lo que descarta un doble conteo: cargar tres CSV traslapados pondría *todos*
arriba con un neto grande. La causa es el momento de descarga, no el dedupe.

🔴 **No bloquea el corte, y es a propósito.** Es una MEDIDA, no una puerta: un descuadre contra una
fuente externa se explica (ventanas, tráfico sin shortlink), y convertirlo en bloqueo garantiza que
alguien lo desactive. Lo que hace es dejar el número escrito para ver si mejora o empeora.

⚠ Y el número anterior de este skill —«62 de 121»— era una medición suelta que **ningún script
reproducía**: comparaba el bloque completo contra un agregado de un solo mes. Un dato que el sistema
no puede recalcular no es evidencia.

⚠ **El importe usa COMA decimal** (`"1144,45"` = 1,144.45). Un parser que la borre infla **100×** —
un diagnóstico propio llegó a medir $4,522 millones donde había $50. `lib-qcart.num()` la maneja.

**La llave lleva las métricas**, no solo las dimensiones. Con un ordinal por posición, una fila
idéntica recibía `#2` y entraba como evento nuevo — la simulación de la próxima descarga la
atrapó. Las 21 filas que comparten dimensiones siguen separadas porque **difieren en `utm_content`**
(el click vino del CTA o del cuerpo) o en sus métricas.

**Probado:** de 4 filas inyectadas entra **exactamente 1**; el repetido, el ajeno y el anterior a
la activación quedan fuera.

## La carpeta manda, no el nombre

```
ReportesQcart/_vigentes/     ← solo los 2 que cuentan. Aquí van las descargas nuevas
ReportesQcart/               ← los 40 viejos (agrupados, sin fecha). NO se leen
```

Se lee **todo** lo que haya en `_vigentes/` y se clasifica **por encabezado**: el de productos
trae la columna `product`, el de carritos no. Filtrar por nombre ya falló dos veces en este
sistema.

## Cinco trampas de los archivos

| Trampa | Qué pasaba |
|---|---|
| precio europeo `"316,83"` | leído como `31683` — ×100 en un importe, invisible en un total grande |
| `store` multivalor **en dos órdenes** | `walmart, chedraui` y `chedraui, walmart` eran dos tiendas que no existen |
| separador `;` con BOM | se detecta por archivo, no se asume |
| 15 filas **sin `shortlink code`** | se descartaban en silencio, y traen views y precio reales |
| `utm_term` a veces no es segmento | `hotcakes-marzo`, `febrero_sem4` — no se infiere |

## DoD — cierras cuando

1. Lee **solo** `_vigentes/`, descubriendo los archivos por encabezado.
2. **Ninguna columna calculada** en las dos hojas.
3. Entra solo lo nuestro: link catalogado **y** fecha ≥ su activación.
4. El descarte **cuadra**: `entra + ajenos + antes + inválidos + sin código = total`.
5. **Correrlo dos veces no duplica ni una fila.**
6. Toda fila tiene `pieza_id`; lo excluido lleva su motivo.
7. Lo que el catálogo no conoce sale en `vocabulario_nuevo`.
8. **El Excel no se tocó.**

## para_el_siguiente

| Campo | Para quién |
|---|---|
| `carritos[]` y `productos[]` | **N3** escribe las dos hojas |
| `pieza_id` en cada evento | **motor-calculo** cruza las dos hojas y con email |
| `vocabulario_nuevo` | **el catálogo**, antes de escribir |
| `excluidos` + `auditoria` | el orquestador, para saber qué se dejó fuera y por qué |

## Deudas abiertas — `_catalogo/defectos-detectados.json`

| id | Qué |
|---|---|
| `DEF-QC-001` | **9 shortlinks con tráfico real** (8 de Mundial), hoy en `Data_Qcart`, ausentes del doc y del catálogo |
| `DEF-QC-002` | 4 códigos de La Lechera con fecha **2027** (typo) — mitigado, pero el dato sigue mal |
| `DEF-QC-003` | 9 piezas apuntan a links que el doc declara **no enviados** |
| `DEF-QC-004` | la hoja **Cuaresma** no tiene columna de fecha: 19 links sin fechar |

⚠ **Sustituir `Data_Qcart` por las dos hojas nuevas toca 363 fórmulas vivas.** Es cambio de
Puerta, con gate de Rick. Mientras tanto conviven.

## Lee cuando toca

| Cuándo | Qué |
|---|---|
| antes de declarar el script cerrado | `~/.claude/rick-reportes/validar-sin-enganarse.md` |
| el plan completo del paso | `<proyecto>/_orquesta/plan-n2b-qcart.md` |
| los dos catálogos que conviven | `_catalogo/puente-catalogos.json` |

---

<!-- FUNDACION:INICIO -->

## 🧱 LA FUNDACIÓN — lo que NO reimplementas

> **Se mantiene a mano.** Su generador (`E0-7-fundacion-a-skills.js`) se retiró; mientras
> no vuelva, este bloque es el único de los dos que NO se regenera solo — el de arriba sí.
> Estas cinco librerías son el suelo del sistema. Un skill que se escribe su propia llave, su
> propia quincena o su propio formato **es cómo el sistema se separa de sí mismo** — pasó, y por
> eso el reporte y el catálogo llegaron a no cruzar en ninguna de sus 86 filas.

| Librería | Qué resuelve | Cómo se usa |
|---|---|---|
| **`lib-esquema`** | El modelo de datos: entidades, llaves, relaciones, grano | `E.llaveDe(hoja)` · `E.foraneas(hoja)` · `E.prefijo()` · `E.admiteNA(col)` |
| **`lib-registro`** | El nombre físico cambia, el **id lógico no** | `R.abrir(ambito, encabezados)` → `h.col(id)` |
| **`lib-quincena`** | **Una** regla y **un** formato | `Q.deFecha(f)` · `Q.normalizar(q)` · `Q.esCanonica(q)` |
| **`lib-preescritura`** | La tabla previa, con la forma de la hoja destino | `PRE.preparar({...})` · `PRE.guardar(skill, tablas)` |
| **`lib-cambios`** | El acumulador: nadie escribe, todos **apuntan** | `CB.apuntar(paso, hoja, fila, col, valor, porque)` |

### Las reglas que salen de ahí, y no se negocian

**1 · La llave se PIDE, no se escribe.** `E.llaveDe('Report_Resumen')` devuelve
`Campaña + TouchPoint + Segmento + Quincena_del_Principal`. Escribirla a mano es cómo aparecieron
**13 colisiones** en las oleadas de AON.

**2 · La quincena tiene UNA regla y UN formato.** Día **1–15 = Q1** · **16–fin = Q2**. Formato
**`AAAA-MM-Qn`** — ordena alfabéticamente igual que cronológicamente y no depende del idioma del
mes. Toda fecha pasa por `Q.deFecha()`; toda quincena que llega de fuera, por `Q.normalizar()`.

**3 · Ninguna celda vacía, tres estados:**

| | |
|---|---|
| valor | el dato |
| **`N/A`** | **no aplica** por naturaleza (Email_Name en WhatsApp · FUP_Sends sin FUP) |
| **`PENDIENTE`** | **sí aplica y lo debemos** (un subject que la fuente aún no entrega) |

Llenar todo de `N/A` cerraría el archivo pero **borraría la señal de qué falta**. Con tres estados
un guardián puede exigir que `PENDIENTE` tienda a cero.

**4 · Nadie escribe: todos APUNTAN.** Cada skill registra sus celdas con su motivo y **un solo
escritor** (`escritor.escribir-todo.js`) las aplica de una pasada: un respaldo, una cadena de validación,
una publicación. Dos skills que piden la misma celda **chocan** y paran la escritura.

**5 · El orden es atribuir → organizar → llenar.** Nunca llenar primero: es cómo un dato acaba en
la fila equivocada. Y lo que se va a escribir se **pre-escribe** antes, para poder revisarlo.

### Antes de dar un script por cerrado

```bash
node ~/.claude/reportes-backend/nestle/_scripts/E0-99-validar.js          # el esquema sirve
node ~/.claude/reportes-backend/nestle/_scripts/E0-3-validar-quincena.js  # la quincena cruza
node ~/.claude/reportes-backend/nestle/_scripts/E0-4-validar-preescritura.js
```

📄 El modelo completo: `_contratos/esquema.json` · el estado del sistema:
`_orquesta/HANDOFF-ESTADO-SISTEMA.md` (empezar por su §2bis) y `_orquesta/estado-reportes.md`

<!-- FUNDACION:FIN -->

---

<!-- CONTRATO-ESCRITURA:INICIO -->

## 🔴 QUÉ ESCRIBE — el contrato de escritura

> **Generado desde `_contratos/escritura.json`. No se edita a mano: se edita el contrato.**
> Antes existía solo el contrato de LECTURA. Por eso el grano acababa decidiéndose dentro
> del motor, tarde y sin que nadie lo revisara.

*Los carritos y productos. Autoridad de links: Qcart-Links Mails-Hive-MX.xlsx.*

### → `Data_Qcart_Carritos`

| | |
|---|---|
| **Grano** | una fila = un **bucket** con su contador `views`. 🔴 **La fila no es el carrito: el carrito es la vista.** 3,077 filas = **7,503** carritos, y 444 filas traen `views = 0` |
| **Llave** | `fecha_hora + shortlink + tienda` |
| **NO toca** | nada calculado: penetración y tickets son del motor |

### → `Data_Qcart_Productos`

| | |
|---|---|
| **Grano** | una fila = un **bucket** con su contador `views`. La fila no es el producto visto |
| **Llave** | `fecha_hora + shortlink + tienda + producto` |
| **NO toca** | idem |

### → `Report_Resumen`

| | |
|---|---|
| **Grano** | 🔴 POR TOUCHPOINT × SEGMENTO. La quincena es solo el ANCLA temporal. |
| **Llave** | `la misma fila que define el catálogo` |
| **Ancla** | la quincena de lanzamiento del Principal, pegada a una celda QUE YA EXISTE — nunca fabrica una |
| **Columnas suyas** | 14: `QCART?` · `Receta_Representativa` · `FechaQcart_Desde` · `FechaQcart_Hasta` · `Carritos_Walmart` · `Carritos_Chedraui` · `Carritos_Total` · `Views_Carrito` · `Views_Productos_Nestle` · `Intencion_Total_MXN` · `Intencion_Nestle_MXN` · `Pct_Penetracion_Nestle` · `Ticket_Carrito_MXN` · `Ticket_Producto_MXN` |
| **NO toca** | las columnas de email · las columnas WA-* |

> 🔴 **REGLA DURA.** El ancla decide EN QUÉ FILA se pega el Qcart, NO cuántas filas hay. Agrupar a un solo segmento por campaña borra la comparación que el reporte existe para dar — y CUADRA IGUAL, así que ninguna puerta lo detecta. Cada evento trae su pieza_id por su shortlink: se agrupa por pieza y se reparte sin duplicar.

> ⚠ Los carritos que llegaron por un link del FUP suman al Principal, y queda declarado que vinieron vía FUP.

**El orden es: atribuir → organizar → llenar.** No se escribe nada que no se haya atribuido
primero: llenar antes de atribuir es como un dato acaba en la fila equivocada.

Se verifica con `node ~/.claude/reportes-backend/nestle/_scripts/E1-4-contrato-escritura.js`

<!-- CONTRATO-ESCRITURA:FIN -->
