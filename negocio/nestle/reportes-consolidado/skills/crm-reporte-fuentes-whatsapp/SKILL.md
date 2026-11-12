---
name: crm-reporte-fuentes-whatsapp
description: Arma el bloque de WhatsApp en el backend leyendo las 5 hojas de la fuente, cada una con su esquema. Úsalo cuando el equipo agregue una campaña nueva de WA, o para saber qué del reporte de WhatsApp es medición y qué es supuesto.
---

# whatsapp-bloque · Bloque WhatsApp

<!--@DECLARACION-->
## 🔴 Lo que este skill lee, lo que lo vigila y lo que le exigen

> Este bloque **se genera** desde el estado real del sistema con
> `orquestador.declarar-en-skills.js`. No se edita a mano: un bloque escrito a mano se
> desfasa en cuanto cambia una guarda — que es justo lo que le pasó al mapa de la cadena.

**Su turno:** etapa 7   ·   **3 script(s) de ejecución**

**Contratos que lee**

- `_contratos/_catalogo/activacion-qcart.json`
- `_contratos/entorno.json`
- `_contratos/esquema.json`
- `_contratos/normalizacion.json`
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
- **Guarda 8 · el archivo vivo se llama como dice el contrato** — 🔴 **detiene el corte** por lo grave, avisa por lo demás
- **Guarda 9 · LAS DECISIONES YA TOMADAS** — avisa y viaja al handoff
<!--/@DECLARACION-->

```bash
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-insumos.insumos.js               # primero insumos-validar
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-whatsapp.whatsapp.js             # el bloque
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-whatsapp.validar.js           # ¿migró bien?
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-whatsapp.refutar.js           # ¿puedo romperlo?
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-whatsapp.simular-nuevo.js     # ¿y la próxima campaña?
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-whatsapp.simular-siguiente.js # ¿le sirve a motor-calculo?
```

## 🔴 0 · UNA HOJA NO ES UNA TABLA (la trampa que costó más caro)

Las hojas traen **tablas apiladas con encabezados distintos**. El lector v1 buscaba un encabezado
por hoja y leía todo lo de abajo con él:

```
encabezado f1 : SEGMENTO | Journey | utm_content | url | Fecha | #AUD... | ENVÍOS | ENTREGAS
fila       f9 : Envíos Tercer partido | 46199 | | 162 | 162 | 1 | 125 | 0.77 | 94 | 30
                ↑ su encabezado real es el f8. Con el de arriba, ENVÍOS cae sobre Read:
                  un envío de 162 se cargaba como 94.
```

Además entraron como envíos una tabla de **links** (sin una sola métrica) y seis filas de
**sesiones de Google Analytics** (`Session source … Sessions`), porque la columna 9 del encabezado
equivocado decía «Envíos». **14 de 26 envíos estaban mal y las 19 validaciones daban verde**
— la auditoría comparaba el bloque contra sí mismo. Lo destapó **renderizar la hoja y mirarla**.

El lector v2 hace tres cosas, en orden, y ninguna adivina:

1. parte cada hoja en **bloques** separados por filas vacías;
2. a cada bloque le busca **su** encabezado, y solo carga el que tenga columna de envíos — una
   tabla sin esa métrica se **declara** y se descarta, nunca se lee con el encabezado de otra;
3. una fila necesita **al menos una métrica** para ser un envío: fecha y segmento solos son un
   plan, no un resultado.

⚠ **`LECTOR = 2` en `lib-whatsapp.js`.** Al cambiar la forma de leer, lo cargado antes deja de ser
historia y pasa a ser salida mala: el script **RECONSTRUYE** en vez de hacer append. Si tocas el
lector de manera que cambie qué filas entran o qué columna es cuál, **sube esa versión** — si no,
lo corregido se suma a lo corrupto y el bloque crece con el error dentro.

## 🔴 0b · El mismo envío en DOS tablas

`Maggi` y `Maggi Mundial` describen la misma campaña: una por journey, la otra resumida. Ninguna
llave lo detecta — son campañas distintas para cualquier normalización. Lo detecta la **aritmética
sobre métricas independientes a la vez**:

```
Maggi Mundial f6 «Finales» = 1965 envíos · 1520 entregas · 917 leídos
Maggi f15 + f16            =  982+983  ·  749+771  ·  440+477   → idéntico
```

**Gana el DESAGREGADO**: un detalle se puede volver a sumar, un resumen no se puede partir. Si
empatan, gana el que trae fecha. Lo excluido queda listado con la prueba, nunca se borra.

## 🔴 0c · El append no vuelve a mirar lo que ya está — y manda la FUENTE

Da una fila por presente con su llave y pasa de largo. Si la hoja y la fuente se separan en un
campo que **no** es la llave, no se entera nadie. Pasó: la hoja fechaba 3 envíos de Hotcakes en
3 días distintos y la fuente decía que los 4 salieron el mismo.

**Decisión de Rick (19-ago-2026): manda la FUENTE.** El paso declara la corrección exacta
(columna, valor de la hoja, valor de la fuente) y la escritura la aplica, dejando en `Notas` lo
que decía antes — el valor viejo no se borra, cambia de sitio.

⚠ **El límite es lo que hace segura la regla:** manda la fuente **solo en los campos que la
fuente MIDE**. Las columnas canónicas —`BU_Canonico`, `Campana_Canonica`, `Segmento_Canonico`—
no están en la fuente y son de Rick: ahí no hay nada que comparar ni que corregir. Una regla de
precedencia sin ese límite se come el trabajo a mano.

⚠ Y el check tiene que cubrir el caso «la hoja **vacía** y la fuente con dato». La primera
versión pedía que la hoja tuviera un valor para comparar, y así se saltaba justo el envío que
más falta hacía corregir.

## 🔴 0d · La fecha que la fuente no trae, del doc de links de Qcart

Un envío sin fecha no cae en ningún periodo, y **todo** reporte pivota por periodo: se caería en
silencio. La tabla `Maggi Mundial` no tiene columna de fecha — no está vacía, no existe.

**Decisión de Rick (19-ago-2026): la fecha sale de la ACTIVACIÓN del link** en
`Qcart-Links Mails-Hive- MX.xlsx`, que es la autoridad que qcart-activacion ya resuelve. Se buscan los
códigos del `utm_content` y se toma la **primera** activación.

Tres cosas la hacen defendible, y ninguna es opcional:

1. **Se declara.** El envío lleva `fecha_via` y `fecha_nota`, y la celda `Notas` de la hoja dice
   que la fecha es derivada. Río abajo se distingue de una medida.
2. **Se cruza contra una segunda fuente.** La tabla-calendario de la propia hoja dice
   «Semifinal A · 14/07/26 · sbH9gVge…» por su lado. **3/3 coinciden.** Para que ese cruce sea
   posible, el lector guarda las FILAS de las tablas que descarta: *se descartan para cargar, no
   para saber*.
3. **Si no hay con qué, la fecha se queda en `null`** y se dice por qué. Nunca se inventa.

⚠ **El orden importa: enriquecer ANTES de resolver solapes.** El desempate de un solape usa la
fecha; resolverlos primero desempata con menos información. Al reordenar, los envíos con fecha
derivada pasaron de 1 a 3 y las comprobaciones cruzadas de 0 a 3 — el resultado final es el
mismo, pero antes estaba sin probar.

🔴 **`ENRIQUECIMIENTO` es la otra mitad de la versión.** `LECTOR` cubre cómo se lee la fuente;
el enriquecimiento cubre lo que se le agrega después. La fecha va DENTRO de la llave del envío,
así que derivarla convirtió una fila en «nueva» y el append la duplicó (Σ 16,624 en vez de
14,643). La versión guardada es `LECTOR.ENRIQUECIMIENTO` y cualquiera de las dos mitades fuerza
la reconstrucción. **Si tocas algo que cambia cómo se ve un envío, sube la mitad que le toca.**


## Es el 0.15% del volumen y el que más fácil miente

14,643 envíos WA contra 5 millones de email (eran 7,374 antes de arreglar el lector). Pero tiene **tres trampas que no se ven en un total**:
filas de subtotal que duplican, cinco esquemas que no coinciden, y una hoja que **inventa los
clicks**.

## 🔴 1 · Las filas de SUBTOTAL — el defecto que más inflaba

Tres hojas traen una fila «Totales» al final:

| Hoja | Dice | La suma de sus filas |
|---|---|---|
| Hotcakes | 1,561 | **1,561** |
| Tercer Tiempo | 5,813 | **5,813** |
| Maggi | 0 | 0 |

Cargarlas **duplica la hoja entera**: 7,374 sends de más.

⚠ **No basta buscar la palabra**: la etiqueta vive en distinta columna en cada hoja. Se busca en
**cualquier celda** y se **CONFIRMA CON LA ARITMÉTICA**. Si una fila etiquetada «Totales» no
cuadra con la suma de arriba, **no se descarta**: se declara, porque entonces es otra cosa.

## 🔴 2 · Los clicks de Tercer Tiempo NO están medidos

La fuente los **deriva**: `Clicks realistas = Read × 0.12` (probado: 1124×0.12=134.88).
Hay tres columnas —pesimista ×0.10, realista ×0.12, optimista ×0.1462— y ninguna es una medición.

```
clicks = null          ← NO se rellena con el derivado
clicks_medidos = 'No'  ← y se dice por qué, con su factor
```

**La firma del número inventado:** si se cargara, el CTOR saldría **exactamente 12% siempre**. El
refutador busca justo eso — un CTOR idéntico en 3+ envíos.

⚠ **`clicks = null` aquí no significa «faltó el dato»: significa que la pregunta no se puede
responder con esta fuente.** motor-calculo lo sabe y no lo confunde con un cero.

## 🔴 3 · Cinco hojas, cinco esquemas

| Hoja | Idioma | Particularidad |
|---|---|---|
| Hotcakes | español, MAYÚSCULAS | `SEGMENTO · ENVÍOS · ENTREGAS · OPENS · CLICKS` |
| Maggi | español | + `Journey`, y las métricas vienen **vacías** |
| Maggi Mundial | español, otro orden | `BU · Marca · Campaña · Leídos · Entregados` |
| Tercer Tiempo | **inglés** | `Total Sent · Read · Clicks pes/rea/opt` |
| Maggi Liga MX | **inglés**, otro | `Undelivered` a secas · sin clicks · `Delivered / Not Read` |
| ICE | **inglés**, otro | `Undelivered ERROR` · sin columna de clicks |

Se leen por **sinónimo de encabezado**, nunca por posición. **Añadir una hoja nueva es añadir
sinónimos, no escribir un parser** — probado: una hoja inventada se cargó sola, con su subtotal
detectado.

## 🔴 3b · LA TABLA CANÓNICA — una regla por métrica, y la misma siempre

> Rick, 14-sep-2026: *«revisa y homologa esos datos… todo lo que requieras para que siempre se mida
> igual»*. Esto es esa homologación. **Cada hoja de la fuente la arma un equipo distinto y nombra
> las columnas a su manera**, así que el nombre físico NO puede ser la regla: la regla es el campo
> canónico, y el nombre físico es un sinónimo más.

| Campo canónico | Qué es | Nombres físicos que ya se han visto |
|---|---|---|
| `sends` | mensajes que **salieron** | `ENVÍOS` · `Envios` · `Total Sent` |
| `deliveries` | **llegaron** al teléfono | `ENTREGAS` · `Entregados` · `Total Received` |
| `opens_read` | el usuario lo **abrió** | `OPENS` · `Leídos` · `Read` |
| `no_entregados` | salieron y **no llegaron** | `No entregados` · `ERROR Undelivered` · `Undelivered` · `Undelivered ERROR` |
| `errores` | **no salieron** (fallo al enviar) | `ERRORES` · `Failed` |
| `clicks` | clicks **medidos** | `CLICKS` · `Clicks` |
| `aud_original` | la audiencia de origen | `#AUDIENCIA ORIGINAL` · `Total MGSC / Data Extension` |

🔴 **`errores` y `no_entregados` NO son lo mismo, y confundirlos ya costó.** Twilio separa *failed*
(no salió) de *undelivered* (salió y no llegó). En Tercer Tiempo `Failed` vale **0** y
`ERROR Undelivered` vale **1,242**: la hoja de datos decía «0 errores» sobre un envío con 1,242 no
entregados porque solo existía la columna `Errores`. Las dos columnas existen, y las dos se llenan.

🔴 **El emparejamiento es EXACTO, no por substring.** Por eso `Undelivered` (Liga MX) no casaba con
`error undelivered` (Tercer Tiempo) y sus **346** no entregados se perdían en silencio: el campo
salía `null` y `null` se lee como «no hubo». Añadir un sinónimo es seguro justamente porque la
coincidencia es exacta — no puede robarle la columna a otra hoja.

### Qué puede contestar cada hoja, hoy

| | sends | deliv | read | no_entreg | errores | clicks | audiencia | fecha |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Hotcakes | ✔ | ✔ | ✔ | — | ✔ | ✔ | ✔ | ✔ |
| Maggi Mundial | ✔ | ✔ | ✔ | ✔ | — | ✔ | — | del doc de links |
| Tercer Tiempo | ✔ | ✔ | ✔ | ✔ | ✔ | derivados | ✔ | ✔ |
| Maggi Liga MX | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ |
| ICE | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

Un hueco aquí **no es un defecto**: es que esa hoja no trae esa columna. Se declara y la celda queda
`PENDIENTE`, nunca 0 — un cero afirmaría que la métrica vale cero.

## 🔴 3c · DÓNDE ACABA CADA MÉTRICA — la pregunta de Rick, contestada

> *«Todas las demás métricas de WA que están, ¿cómo las usas, dónde se suman?»* (14-sep-2026)

**Solo CINCO de las 20 columnas de `Data_WhatsApp` llegan al reporte.** Las demás viven en la hoja
de datos y ahí se quedan — no es un defecto, es que el reporte no tiene columna para ellas:

| Columna de `Data_WhatsApp` | A dónde va |
|---|---|
| `Sends` | → `WA-Envíos` · **se suma** por celda campaña × touchpoint × segmento |
| `Deliveries` | → `WA-Entregados` · se suma |
| `Opens_Read` | → `WA-Leídos` · se suma |
| `No_Entregados` | → `WA-No entregados` · se suma |
| `Clicks` | → `WA-Clicks` · se suma, **solo si `Clicks_Medidos = Sí`** |
| `Errores` · `Aud_Original` · `Aud_Filtros` · `Aud_Final` · `Logins` · `Recetas_Capturadas` · `Errores_Meta_Detalle` | **no llegan al reporte** — se consultan en la hoja de datos |
| `Delivery_Rate` · `Read_Rate` · `CTOR` · `Pct_Error` | **no se copian**: el motor las recalcula |

**Las cuatro tasas del reporte, y su denominador — que es donde se discute:**

| Columna | Fórmula | Ojo |
|---|---|---|
| `WA-%Entrega` | `Entregados ÷ Envíos` | |
| `WA-%No entrega` | `No entregados ÷ Envíos` | |
| `WA-%Read vs entrega` | `Leídos ÷ **Entregados**` | ⚠ **no** sobre envíos. Una lámina de Twilio dio «63%» y el reporte 61.9% por esto: 1,124÷1,817 envíos vs 1,124÷1,781 entregados |
| `WA-%Click vs Read` | `Clicks ÷ Leídos` | vacía si los clicks no están medidos |

🔴 **Ninguna tasa se copia de la fuente.** La fuente trae `%Delivery Rate`, `%Read Rate`, `%CTR`…
y **se ignoran todas**: el motor las recalcula desde los conteos. Copiarlas heredaría el denominador
que haya usado quien armó esa hoja, y son cinco hojas con cinco criterios.

### 🔴 3d · EL DENOMINADOR ES EL CONCILIADO, NUNCA EL CRUDO (22-sep-2026)

`%Read vs entrega` divide entre los entregados **que salieron de `conciliarEntregas()`**, no entre
los que publica la hoja. No es un matiz: son las tres piezas donde la fuente se contradice.

| pieza | la hoja guardó | con el entregado conciliado | diferencia |
|---|---|---|---|
| `008-P008` | 60.90% (2,405÷3,949) | **83.22%** (2,405÷2,890) | **22.3 pp** |
| `008-P007` | 61.86% (1,124÷1,817) | **68.91%** (1,124÷1,631) | 7.1 pp |
| `002-P022` | 71.66% (177÷247) | **74.06%** (177÷239) | 2.4 pp |

Usar el crudo divide entre una cifra que **el propio sistema ya rechazó** por contradecir los fallos
que esa misma fila declara. Auditoría: `fuentes-whatsapp.auditar-metricas.js`.

⚠ **Y esas columnas no deberían estar llenas en `Data_WhatsApp`.** La tabla de arriba dice que
`Delivery_Rate`·`Read_Rate`·`CTOR`·`Pct_Error` **no se copian porque el motor las recalcula** — pero
hoy `Read_Rate` viene escrita (con el denominador crudo) y `Pct_Error` viene vacía. La declaración
es correcta; la implementación no la obedece.

### 🔴 3e · EL CLICK DE WHATSAPP TIENE **TRES ORÍGENES**, Y SE PREGUNTAN EN ORDEN (Rick, 28-oct-2026)

> *«Las métricas de click de WhatsApp no deben de quedar por definir, si ya tienes los datos,
> sabes.»* — y tenía razón: **17 de 18 filas** decían `POR DEFINIR` teniendo el dato a la vista.
> Antes de esto, Mundial publicaba `POR DEFINIR` en sus tres piezas **con 289 / 369 / 616 carritos
> medidos en la columna de al lado**.

**El resolutor vive en UN solo sitio** — `WA_BLOQUE()` en `lib-valores-resumen.js` — y devuelve las
cuatro columnas de una vez (`qcart`, `recetas`, `clicks`, `tasa`). Si se resolvieran por separado,
la tasa podría publicarse sobre un numerador que la columna de clicks no publica.

```
1 · ¿LA FUENTE LO MIDE?        → ese número GANA. No se le suma nada.
2 · ¿SE PUEDE INFERIR?         → WA-Clicks Qcart + WA-Clicks-Recetas
3 · ni medido ni inferible     → N/A
```

🔴 **`WA-Clicks = Qcart + Recetas` NO es una ley, es la fórmula de la rama 2.** La versión anterior
de esta sección la enunciaba como identidad universal, y eso es falso: en las 7 filas medidas el
total **no** es la suma de las dos columnas —Hotcakes `WA-C1` publica **19** clicks con **0**
carritos— porque ahí hubo medición y la medición no se infiere. Quien lea la identidad como ley va
a «corregir» esas 7 filas.

| rama | columna | de dónde sale | unidad |
|---|---|---|---|
| **1** | `WA-Clicks` | **la fuente los mide** → se transcriben tal cual | `click_whatsapp` |
| **2** | `WA-Clicks Qcart` | **se infiere de los carritos**: en WhatsApp no hay tracking y el carrito es el único rastro de que el link se tocó. **Es la misma cifra que `Carritos_Total`** | `click_qcart` |
| **2** | `WA-Clicks-Recetas` | **Google Analytics — NO conectado.** Solo lo que Rick capturó a mano en `_contratos/clicks-recetas-de-rick.json` | `click_receta` |
| **2** | `WA-Clicks` | la **suma** de las dos anteriores | `click_whatsapp` |

#### 🔴 Un número derivado de un SUPUESTO no es una medición
`Tercer Tiempo WA-1` y `WA-2` traen clicks en la fuente, y el resolutor los **rechaza**: no están
medidos, salen de `Read × un CTOR asumido fijo` (12%). Por eso llevan `clicks_medidos = false` y
caen a la rama 3 → `N/A`. Publicarlos como medición pondría un supuesto a competir contra
benchmarks. **La bandera manda sobre la presencia del número.**

#### 🔴 Las RECETAS no aplican a todas las campañas — y el ámbito se declara, no se adivina
> *«Mundial no lo toques, si dice N/A es porque no llevaba Qcart. Entonces solo aplica de Liga MX
> en adelante.»*

Vive en `_contratos/unidades.json` → `metricas['WA-Clicks-Recetas'].aplica_a_campanas`. Hoy:
`["Liga MX"]`. **Fuera de ese ámbito, `WA-Clicks-Recetas` es `N/A` y el total es solo la parte de
Qcart** — no `POR DEFINIR`, porque no falta nada: esa campaña nunca tuvo recetas que medir.

🔴 Eso es lo que separa **`N/A` de `POR DEFINIR`**: `N/A` dice *«no aplica»* y `POR DEFINIR` dice
*«aplica y falta»*. La distinción sigue viva **en la columna de recetas**, que es donde se declara
lo que falta — pero ya **no arrastra al total**: desde el 28-oct el total suma lo que hay (ver
abajo). Antes sí lo arrastraba, y por eso Mundial publicaba `POR DEFINIR` teniendo 289/369/616.

#### Las 18 filas con envíos de WhatsApp — medido el 28-oct-2026

| rama | campaña · touchpoint | `WA-Clicks` | Qcart | Recetas |
|---|---|:--:|:--:|:--:|
| 1 · medido | Hotcakes `WA-C1` · `WA-C2` · `WA-C3` · `WA-C4` | 19 · 29 · 33 · 52 | 0 | `N/A` |
| 1 · medido | Mundial `Partido 2` · `Partido 3` | 17 · 26 | 0 | `N/A` |
| 1 · medido | The Freshers `WA-A1` | 171 | 0 | `N/A` |
| 2 · inferido | Mundial `Semifinal A` · `Semifinal B` · `Final` | 289 · 369 · 616 | = | `N/A` |
| 2 · inferido | Liga MX `WA-J8` · `WA-J9` | 60 · 67 | 53 · 53 | **7 · 14** |
| 3 · `N/A` | Tercer Tiempo `WA-1` · `WA-2` | `N/A` | 0 | `N/A` |
| 3 · `N/A` | Liga MX `WA-SNM-3` | `N/A` | 0 | `N/A` |
| 2b · piso | Liga MX `WA-J10` · `WA-SNM-2` · `WA-SNF-1` | **42 · 59 · 109** | 42 · 59 · 109 | `POR DEFINIR` |

### 🔴 UNA SUMA INCOMPLETA SUMA LO QUE TIENE — y va DESPUÉS del desglose (Rick, 28-oct, 2ª vez)

> *«Los clicks totales van después del desglose»* · *«¿si ya tienes clicks de recetas pero no de
> Qcart, por qué está POR DEFINIR? Si es una fórmula… no puede haber por definir si tienes los
> datos, si es una fórmula incompleta sumas lo que tienes.»*

**Las tres cosas que estaban mal, y las tres eran mías:**

1. **El orden.** El total iba ANTES de sus dos mitades, como si lo explicaran a posteriori. Va
   después: `WA-Leídos · WA-Clicks Qcart · WA-Clicks-Recetas · WA-Clicks · WA-%Entrega · …`
2. **El `POR DEFINIR` del total.** Con 42 carritos medidos y las recetas sin medir, el total decía
   `POR DEFINIR` y **escondía un 42 que sí se conocía**. 🔴 **La regla anterior —«una suma con un
   sumando desconocido es desconocida»— queda RETIRADA para esta columna.** El total es el **piso**
   de lo que se conoce, y la parte que falta se sigue viendo en `WA-Clicks-Recetas`: el lector sabe
   que es un piso porque la mitad que falta está declarada a su izquierda.
3. **No era una fórmula.** Se escribía como número suelto, así que corregir una mitad a mano dejaba
   el total mintiendo y nadie veía de dónde salía.

```
WA-Clicks  =  SUM(WA-Clicks Qcart : WA-Clicks-Recetas)
```

🔴 **`SUM()` ignora el texto, y eso es justo lo que se quiere**: con las recetas en `POR DEFINIR`,
`SUM(BQ24:BR24)` da **42**. La fórmula incompleta suma lo que tiene, sin que nadie programe el caso.

🔴 **La fórmula se escribe SOLO si reproduce el valor que ya se iba a escribir.** Por eso una fila
**medida** por la fuente (Hotcakes publica 19 clicks con 0 carritos) nunca se convierte en un `SUM`
que daría 0: la comprobación la protege sin que el escritor tenga que saber de ramas.

⚠ **Y las fórmulas se escriben ANTES de mover las columnas** (`regenerar` es la etapa 12,
`mover-columnas` la 14), y mover **no reescribe las referencias**. Falla en silencio: la celda
conserva su `<v>` cacheado, así que el número que se LEE sigue bien y solo al recalcular aparece
otra cifra o un `#¡VALOR!`. Lo comprueba `resumen.verificar-formulas.js`, que no mira el número
sino **a qué columnas apunta cada fórmula** según el contrato.

🔴 **Lo que Rick capturó a mano MANDA y no se pisa al recalcular.** *«yo ya había puesto unos clics
en recetas de WhatsApp que no elimines, o sea, no porque lo recalcules los elimines… los que no
están vacíos, déjalos.»* Viven en `_contratos/clicks-recetas-de-rick.json`, **con llave de
IDENTIDAD (campaña ¦ touchpoint ¦ segmento), nunca por número de fila**: al crecer Liga MX de 12 a
17 filas, las suyas se movieron de la 22/25 a la 24/27.

⚠ **En una fila sin envíos de WhatsApp las cuatro columnas dicen `N/A`**, no vacío y no `0`. Con `0`
se rompería la identidad `WA-Clicks Qcart ≡ Carritos_Total` en cuanto esa fila de email tenga
carritos — que los tiene. Un `0` en `WA-Clicks Qcart` **con** envíos de WA sí es un dato: significa
que esa pieza no declara ningún `Cod_*`.

#### ⚠ Y SUS TRES HERMANAS SÍ VAN EN BLANCO — no lo «arregles» (medido 28-oct-2026)
`WA-%Entrega`, `WA-%No entrega` y `WA-%Read vs entrega` dejan **138 celdas vacías cada una** en las
filas sin WhatsApp, mientras `WA-%Click vs Read` dice `N/A`. Parece una incoherencia y **no se
toca**: `orquestador.medir-vacios.js` ya las mide y las declara, con la decisión de Rick encima —
`Report_Resumen` → `se_llena: false`, *«Rick, 26-ago: se permiten celdas vacías fuera del catálogo
— POR DEFINIR solo donde el catálogo deba una dimensión»*.

🔴 **La regla «cero celdas vacías» es del CATÁLOGO, no de este reporte.** Medí 2,710 vacías en
`Report_Resumen` y estuve a punto de llamarlas defecto y llenarlas: son 2,710 celdas de un
entregable del cliente que alguien ya decidió dejar así. Antes de llamar defecto a un hueco, se
mira si el sistema ya lo midió y qué decidió su dueño — **`_preescritura/decisiones.json` lo dice
hoja por hoja**.

⚠ Lo que sí queda **abierto para Rick**: él dijo *«si no tiene clicks lo dejas en blanco pero no
por definir»* y las 3 piezas sin clicks (Tercer Tiempo `WA-1`/`WA-2`, Liga MX `WA-SNM-3`) hoy dicen
`N/A`, no blanco. Se eligió `N/A` por coherencia con las otras columnas de clicks; **está sin
confirmar con él.**

🔴 **La regla VIEJA está RETIRADA.** Decía `WA-Clicks ≡ Carritos_Total` y después que esa
equivalencia estaba *refutada* citando «Qcart mide 949 clicks → 18 carritos». Esa cita no se
sostenía: **949 es exactamente `WA-Leídos` de WA-J8**, o sea comparaba LECTURAS con carritos
llamándolas clicks. Qcart no publica clicks en ningún sitio de este sistema.

#### Cómo se comprueba — no leyendo la hoja
```bash
node _scripts/fuentes-whatsapp.auditar-clicks.js         # ¿cada fila publicó la rama que le toca?
node _scripts/fuentes-whatsapp.probar-auditor-clicks.js  # ¿y el auditor mira, o solo sale verde?
node _scripts/resumen.auditar-tasas.js                   # ¿cada tasa es el cociente de SUS patas?
```
🔴 **No basta con que las 4 columnas cuadren entre sí**: salen del mismo resolutor, así que cuadran
aunque la rama elegida sea la equivocada. La rama esperada se decide **fuera del resolutor**, con
las dos autoridades —¿la fuente mide esta pieza (`clicks_medidos` en la rejilla)? ¿la campaña está
en `aplica_a_campanas` (el contrato)?— y después se compara contra lo que la hoja publicó.

🔴 **Y el auditor se prueba plantándole el defecto**, porque verde no prueba que mire. Los 5
señuelos van sobre copias y el original se restaura comprobando **sha1**; el auditor tiene que
ponerse rojo **y nombrar el motivo** — ponerse rojo por cualquier razón no cuenta. Hoy 5/5. Así
se vieron los DOS defectos que el auditor ya llevaba: leía las capturas de Rick con la forma
equivocada (**0 capturas, sin tronar** → WA-J8 y WA-J9 habrían salido como «falta la mitad»
teniendo su dato), y leía la quincena por literal cuando se llama `Quincena_Lanzamiento Principal`
(**`undefined` en las 18 filas**, que emparejó consigo mismo y dio un rojo redondo y falso).

⚠ **Y ojo con el señuelo mismo:** el primer S1 aterrizó en `100 años · E1-F1`, una celda **sin
envíos de WhatsApp** que el auditor no examina, salió verde, y lo apunté como ceguera del auditor.
**Un ataque mal armado se cuenta como derrota del sistema y manda a arreglar lo que no está roto**
— por eso el prover declara `NO PUDE PLANTARLO` en vez de contarlo como pasar.

## 🔴 Y ESOS NÚMEROS ERAN FILAS, NO CARRITOS (corregido 29-sep-2026)

Las cifras de esa tabla **eran 36 / 42 / 70 / 21** y estaban mal: el bloque contaba los carritos de
la pieza con `+ 1` por fila del CSV de Qcart, y **una fila es un bucket** día × hora × shortlink ×
utm × tienda **con su contador `views`**. Σ clicks de WhatsApp pasó de **529 a 1,229 (+700)**, y el
salto mayor es `004-P019`: de 70 a **383**.

🔴 **No es un cambio a la decisión de Rick: es cumplirla.** Él la declaró como «los clicks deben
**coincidir** con los carritos totales de Qcart». Contando filas **no coincidían** — coincidía el
click con el bucket. Contar vistas es lo que hace verdadera la regla que él escribió.

🔴 **Y el auditor de esta misma regla contaba también por fila.** El bloque ponía filas, el auditor
comparaba contra filas: **los dos mal, los dos de acuerdo**, y la auditoría salía en ✔ diciendo que
la regla se cumplía. Es la patología que ya había morado en `Data_WhatsApp` —la comprobación y el
dato salidos del **mismo lector equivocado**— y por eso ninguna suite lo vio en una semana.
**Un auditor que hereda la unidad de lo que audita no audita: confirma.**

⚠ Lo destapó U4 del guardián de unidades, y solo después de **generalizarla**: buscaba cinco
patrones literales en tres archivos fijos y este era un cuarto archivo con el mismo defecto escrito
de otra manera. Hoy barre los 86 scripts que nombran carritos y las excepciones se declaran en
`_contratos/unidades.json`.

Las otras 9 **no tienen Qcart**: sus clicks salen de la columna propia de su hoja (Hotcakes,
Mundial e ICE traen `Clicks`) o no están medidos (Tercer Tiempo). Aplicar la regla fuera de su
ámbito producía **7 falsos positivos** — una regla buena medida donde no toca.

⚠ Si los carritos se recargan, estos clicks **quedan atrás**: el reporte tenía 35/62/5 cuando el
bloque ya decía 36/70/21. La regla también sirve como guardián de que la hoja está al día.

## 🔴 ESTA FUENTE NO TIENE MEDIDA EXTERNA — y es un hueco DECLARADO, no oculto

Email se contrasta contra el detalle de SFMC. Qcart, contra su export agregado
(`fuentes-qcart.medida-externa.js`). **WhatsApp, contra nada**: la única fuente es el archivo de
Leslie, y no hay un segundo lugar donde el mismo hecho esté medido.

Eso importa porque las puertas del sistema cruzan bloque ↔ rejilla ↔ reporte, y los tres descienden
de este bloque: si la unidad o el lector están mal, **los tres coinciden**. Aquí ya pasó dos veces —
la auditoría de `Data_WhatsApp` en verde con 14 de 26 envíos mal, y la regla clicks≡carritos en ✔
con las dos patas contando filas. **Un sistema que se compara consigo mismo prueba que es
consistente, no correcto.**

El hueco está declarado en `_contratos/unidades.json` → `medida_externa`, y **U5 del guardián de
unidades lo AVISA en cada corte** (⚠, no 🔴: avisar un hueco conocido es honesto; bloquear por él
pararía todos los cortes y acabaría desactivado). Cerrarlo pide una segunda medición del canal —
de Meta o de quien opera los envíos— y esa decisión es de Rick.

## No calcula

`Delivery_Rate` · `Read_Rate` · `CTOR` · `Pct_Error` **son de motor-calculo**. El bloque trae conteos crudos.

**Probado** (`N2c-98`): motor-calculo deriva las cuatro, y **sabe dónde el CTOR no existe**.

## El ancla — cascada, nunca una variable

```
1  campaña + segmento + fecha      → 4 (Hotcakes, cuadra exacto)
2  campaña + segmento + sends
2b campaña + SENDS exactos         → 2 (Tercer Tiempo, que no trae segmento)
3  campaña + touchpoint (+fecha)
4  campaña + segmento
   AMBIGUA / SIN PIEZA → con sus candidatas. **No se fuerza.**
```

Hoy atribuye **6 de 26**, y no es fallo del ancla: las **10 piezas WA de Mundial están vacías**
(`sends=0`, sin fecha) y **no hay piezas de ICE**. El hueco está en el catálogo.

## Sin cadencia: es APPEND

El equipo consolida a mano y agrega campañas **cuando ocurren**. Lo ya cargado no se toca.
La llave lleva `fecha ¦ campaña ¦ segmento ¦ journey ¦ utm_content ¦ sends ¦ read`.

⚠ Con `journey || utm_content` se perdían 2 envíos: dos filas de Maggi Mundial comparten todo
menos el `utm_content` (`wa-botanas3` vs `wa-botana1`). **Los dos campos entran.**

## DoD

1. Las 5 hojas leídas, ninguna saltada.
2. **Ningún subtotal dentro del bloque**, y cada exclusión confirmada por aritmética.
3. **Ningún click derivado cargado como medición.**
4. Ninguna columna calculada.
5. Correrlo dos veces no duplica.
6. Todo envío sin pieza trae su motivo y sus candidatas.
7. El Excel no se tocó. **La fuente es de solo lectura y nunca se escribe.**

## Hallazgos abiertos (de datos, no del sistema)

- `Data_WhatsApp` tiene **6 de 26** envíos → faltan **8,835 sends** (Maggi Mundial, Maggi, ICE).
- El catálogo tiene **10 piezas WA de Mundial vacías** y **ninguna de ICE**.

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

*Los envíos de WhatsApp. No tiene Email_Name ni Subject: ahí va N/A.*

### → `Data_WhatsApp`

| | |
|---|---|
| **Grano** | una fila = un envío de WA |
| **Llave** | `Pieza_ID + TouchPoint` |
| **NO toca** | nada de email |

### → `Report_Resumen`

| | |
|---|---|
| **Grano** | su propia fila — una pieza de WhatsApp NO se fusiona con una de email |
| **Llave** | `la misma fila que define el catálogo` |
| **Columnas suyas** | 5: `WA-Envíos` · `WA-Entregados` · `WA-No entregados` · `WA-Leídos` · `WA-Clicks` |
| **NO toca** | Email Name · Subject · las columnas Principal_* y FUP_*: van en N/A |

**El orden es: atribuir → organizar → llenar.** No se escribe nada que no se haya atribuido
primero: llenar antes de atribuir es como un dato acaba en la fila equivocada.

Se verifica con `node ~/.claude/reportes-backend/nestle/_scripts/E1-4-contrato-escritura.js`

<!-- CONTRATO-ESCRITURA:FIN -->
