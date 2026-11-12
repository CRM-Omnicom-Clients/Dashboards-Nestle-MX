---
name: crm-reporte-resumen
description: Construye Report_Resumen desde la rejilla — fusiona Principal y FUP en una fila y regenera la hoja con su fila de totales al final. Úsalo después del motor y antes de los insights; no calcula nada, copia.
---

# El Resumen · resumen-fusionar · resumen-regenerar

<!--@DECLARACION-->
## 🔴 Lo que este skill lee, lo que lo vigila y lo que le exigen

> Este bloque **se genera** desde el estado real del sistema con
> `orquestador.declarar-en-skills.js`. No se edita a mano: un bloque escrito a mano se
> desfasa en cuanto cambia una guarda — que es justo lo que le pasó al mapa de la cadena.

**Su turno:** etapa 12   ·   **3 script(s) de ejecución**   ·   **escribe al Excel**

**Contratos que lee**

- `_contratos/clicks-destinos.json`
- `_contratos/clicks-recetas-de-rick.json`
- `_contratos/entorno.json`
- `_contratos/esquema.json`
- `_contratos/registro.json`
- `_contratos/unidades.json`

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

🔴 **Este skill escribe**, así que la Guarda 5 le aplica de lleno: sin su declaración de
pre-escritura en `_preescritura/DECL-*.json`, con los cuatro campos, **el corte no arranca**.
<!--/@DECLARACION-->

```bash
node ~/.claude/reportes-backend/nestle/_scripts/resumen.fusionar-fup.js       # fusiona en la rejilla
node ~/.claude/reportes-backend/nestle/_scripts/resumen.regenerar.js          # seco
node ~/.claude/reportes-backend/nestle/_scripts/resumen.regenerar.js --escribir
node ~/.claude/reportes-backend/nestle/_scripts/resumen.validar.js          # su suite
```

## 🔴 No calcula. COPIA.

Cada cifra de la hoja tiene que estar en `rejilla.json`. Su validador comprueba **912 cifras una
por una**; si el reporte trae un número que la rejilla no tiene, se lo inventó.

## Etapa 1 · `resumen-fusionar` — Principal y FUP en la MISMA fila

**Lo pidió Rick:** «FUP y Principal deberían existir en la misma línea, no separada; por eso tiene
sus columnas de resultados FUP».

De las 86 celdas de la rejilla, **10 eran un FUP sin su Principal**. No duplicaban nada —Principal +
FUP suma exacto los 7,282,486 de `Data_Email`— pero ocupaban fila propia porque **el FUP salió en
otra quincena** (`001-P004` en Mar-Q2 y su Principal `001-P003` en Mar-Q1), y la quincena está en la
llave.

**No se deduce quién es el Principal de quién: se declara.** `Pieza_Principal_ID` es la foránea del
catálogo. Deducirlo por parecido de nombre falla justo en el caso que importa.

🔴 **Tres cosas que la fusión rompió y ahora vigila:**
1. **Recalcular el total.** No hacerlo perdió **350,328 envíos** del reporte.
2. **El Qcart de la celda que desaparece se lleva a la del Principal.** Borrarla con su qcart hizo
   desaparecer **164 carritos** mientras el motor seguía declarando «2,645 ✔». *(Un FUP nunca tiene
   Qcart propio — regla de Rick.)*
3. **WhatsApp no se toca.** Σ antes == Σ después, y se imprime.

## Etapa 2 · `N6r` — regenerar, no emparejar

La hoja se **reconstruye entera** desde la rejilla. Se intentó emparejar por llave y no funciona:
renombrar una pieza —*Espresso Con* → *Hackea tu café*— deja la llave vieja sin pareja y la fila
huérfana.

⚠ **Regenerar es destructivo por naturaleza.** Antes de correr: leer lo que hay y diffear. Rick edita
el reporte a mano y sus cambios **no son basura por limpiar**.

## 🔴 La fila de totales — lo que Rick pidió, medido

Va **al final**, siempre, y su validador exige **exactamente una**.

Y la fórmula va **con su `result`**. Escribía `<f>SUM()</f>` **sin `<v>`**: Excel lo calcula al
abrir, pero **ningún otro lector** — ni los guardianes, ni el guardián de llegada, ni Excel Online.
Medida desde fuera, la fila «Total» tenía **una celda con dato** —la etiqueta— y 82 vacías, mientras
las 76 filas de arriba sumaban 4,992,922.

El total se **acumula al escribir**, no releyendo la hoja: releer para sumar sería medir el
resultado con el mismo lector que lo produjo.

🔴 **Y la fila de totales NO es una fila de datos.** Sumarla junto con ellas cuenta todo dos veces —
pasó en cuanto dejó de estar vacía: `Σ Carritos_Total` saltó a 5,290 con la rejilla diciendo 2,645.
Se **excluye de las sumas, pero se cuenta aparte**: excluir una fila de la comparación no es dejar
de mirarla.

## Ninguna columna sale muda

Una columna que este skill debe llenar y sale **100% vacía** no es un detalle estético: significa que
el valor cayó en una columna que no existe, y **ninguna suma cambia por eso**. Pasó con
`Audiencia_DE SFMC` y `Audiencia_Volumen SFMC` — 0 de 77 filas mientras la rejilla traía el dato en
62, porque la librería escribía con el nombre corto. Lo enseñó el render.

**El nombre físico se le pide al registro**, no se escribe a mano.

## 🔴 REGLA DURA · no escribes si no declaraste antes

Antes de regenerar `Report_Resumen`, este skill deja su declaración en
`_preescritura/DECL-resumen.regenerar.json` con los cuatro campos obligatorios. El que más importa
aquí es el **grano**, y está declarado así:

> una fila por **campaña × touchpoint × segmento × quincena** — el Qcart va por touchpoint ×
> segmento, y la quincena es solo el ancla temporal.

Está escrito porque agrupar el Qcart a un solo segmento **borra la comparación que el reporte
existe para dar, y cuadra igual**: ninguna puerta lo vería. La declaración es el único sitio donde
ese hecho queda dicho antes de escribir.

La **Guarda 5** lo exige desde el preflight: sin declaración, el corte no arranca.

## DoD — cierras cuando

0. **Dejaste tu declaración de pre-escritura** y la Guarda 5 pasa.
1. `resumen.validar.js` da **EL REPORTE DICE LO QUE DICE LA REJILLA** (hoy 9 checks).
2. Una fila por celda de la rejilla, ni una más — **descontando** la de totales.
3. La fila de totales es **una**, va **al final**, y sus SUM traen su valor cacheado.
4. Ninguna columna vigilada sale 100% vacía.
5. **Miraste el render.**

## No haces

- No calculas: eso es de `crm-reporte-motor`.
- No escribes los insights: eso es de `crm-reporte-nestle-insights`, que corre **después**.
- No decides si el reporte es publicable: eso es la **PUERTA 2**, de `crm-reporte-fuentes-cuadre`.
- No pones anchos: eso es `crm-reporte-escritor` en su etapa `escritor-formato-resumen`, que corre después de ti
  justamente porque tú regeneras la hoja.

## 🔴 Una tasa no se suma — la fila de totales se recalcula

La fila de totales dejaba vacías sus 22 columnas de tasa, y con razón: **sumar porcentajes es
falso**. Pero «vacío» tampoco es la respuesta —Rick pidió cero celdas vacías— y un total sí tiene
tasa: la de los totales. Se declara la pareja numerador/denominador de cada una y se emite
**Σnum / Σden** con su fórmula y su `result` cacheado. Lo que no es dato ni tasa (campaña, segmento,
asunto, insight) va `N/A`, porque la razón se puede escribir: *un agregado no tiene esa dimensión*.
Resultado: de 52 celdas vacías a 0 — 24 tasas recalculadas + 27 `N/A`.

Y `WA-Clicks` salía vacía en totales porque el regex de sumables decía `^WA-(Env|Entreg|No entreg|Le)`
y se la saltaba: **una columna que no entra en la lista no truena, simplemente no suma**.

### ⚠️ RETIRADA el 28-oct · «Una suma DERIVADA no publica un total parcial» (era del 27-oct)

> 🔴 **Rick la retiró al día siguiente, y se deja escrita porque el mecanismo que la implementa
> sigue en pie y alguien podría reactivarlo sin querer.** Su veredicto: *«no puede haber por
> definir si tienes los datos, si es una fórmula incompleta sumas lo que tienes»*. Con 42
> carritos medidos y las recetas sin medir, esta regla escondía un 42 que sí se conocía detrás de
> un `POR DEFINIR`. **Hoy el total es el PISO de lo que se conoce**, y lo que falta se declara en
> su propia columna, que es donde el lector lo ve.
> El contrato manda: `unidades.json` → `WA-Clicks.si_falta_una_parte` = *SUMA LO QUE HAY*. El
> código de abajo solo actúa si una columna derivada **emite** `POR DEFINIR`, y ninguna lo hace ya.
> Lo que sigue es el relato del defecto del 27-oct, que explica por qué existe el mecanismo:

Entrar en la lista de sumables tampoco bastaba. `WA-Clicks` está declarada en
`_contratos/unidades.json` como `es_suma_de: [WA-Clicks Qcart, WA-Clicks-Recetas]`, y su contrato
dice: *«si falta una parte: POR DEFINIR — una suma con un sumando desconocido es desconocida»*.
Esa regla se cumplía **fila por fila** —17 de 19 filas de WhatsApp dicen `POR DEFINIR`— y se
rompía **justo en la fila de totales, que es la que se lee**: `SUM()` ignora el texto, así que
sumó las 2 filas completas y publicó **127 clicks totales de WhatsApp** al lado de un total de
**1,590** en la columna de Qcart. Un número chico y confiado.

Ahora, antes de emitir el `SUM`, se pregunta al contrato si esa columna es una suma derivada y se
cuentan sus `POR DEFINIR`; si hay alguno, el total **es `POR DEFINIR`**. Cada parte conserva su
propio total, así que no se esconde nada. **Qué columnas llevan la regla no se decide aquí: se le
pregunta a `unidades.json`**, así que una columna derivada nueva queda protegida sin tocar este
código. Lo vigila **U3d** del guardián de unidades, con su señuelo (el 127 real, plantado).

#### 🔴 …Y SU TASA TAMPOCO (28-oct-2026) — la mitad que faltaba

La regla se puso en el `SUM` y **no en la razón**. Así que `WA-Clicks` total decía `POR DEFINIR`
y, en la celda de al lado, `WA-%Click vs Read` publicaba **12.1%**: es `1,748 / 14,415`, la tasa
de los clicks que **sí** se conocen, presentada como la tasa de WhatsApp. **Un piso disfrazado de
resultado**, pegado a la celda que declara que el numerador es desconocido.

🔴 **Y su fórmula era `BQ158/BP158` con `BQ158` = el TEXTO «POR DEFINIR»**: el 12.1% solo existía
en el caché, y en cuanto Excel recalculara daba `#¡VALOR!`. Dos defectos en una celda — uno que
miente y otro que revienta — y el que se veía era el que mentía.

Hoy, antes de emitir la razón del total se pregunta si **el numerador o el denominador** son una
suma derivada sin total; si lo son, la tasa es `POR DEFINIR`.

⚠ **No lo vio ninguna puerta, ni `resumen.auditar-tasas.js`** —compara cada tasa contra sus patas
y salta las no numéricas, y todas miran **filas de datos**, no la de totales. **Lo vio el render.**
El check existe ahora (`fuentes-whatsapp.auditar-clicks.js`, con su señuelo S6) para que la próxima
vez no haga falta mirar — pero la lección es la de siempre: **una regla puesta en el conteo no se
aplica sola a la razón**, y la fila de totales necesita sus propias comprobaciones.

## 🔴 QUIEN REESCRIBE UNA PATA, RECALCULA LA TASA — en el mismo paso (28-oct-2026)

`resumen.fusionar-fup.js` junta las celdas del FUP en la fila del Principal: suma `deliveries`,
`opens`, `clicks`, `unsubs`. **Sumaba las patas y dejaba las tasas de la primera celda.** La fila
142 (`AON · E-PROP2`) publicaba un `FUP_Open_Rate` de **4.47%** teniendo **3,773 / 102,980 = 3.66%**
en su propia fila.

```js
var _r = function (a, b) { return (Number(b) || 0) ? (Number(a) || 0) / (Number(b) || 0) : null; };
dst.fup.open_rate  = _r(dst.fup.opens,  dst.fup.deliveries);
dst.fup.click_rate = _r(dst.fup.clicks, dst.fup.deliveries);
dst.fup.ctor       = _r(dst.fup.clicks, dst.fup.opens);
if (dst.fup.unsubs !== undefined) dst.fup.utor = _r(dst.fup.unsubs, dst.fup.opens);
```

🔴 **Es el mismo defecto que `Read_Rate`, y la misma lección: una derivación guardada es un caché.**
La tasa se calculó una vez, los conteos cambiaron después, y nadie volvió. No se arregla
documentando cuál es la fuente de la verdad — **la pregunta «¿cuál manda?» solo existe porque el
hecho está dos veces**.

🔴 **Dónde se arregla: en quien TOCA la pata, no en quien la lee.** Recalcular al final, en el
regenerador, habría tapado el síntoma dejando la rejilla mintiendo para todo lo demás que la
consume — insights incluidos. **E2 · se arregla al creador, nunca al heredero.**

🔴 **Y la regla general, porque esto va a volver:** cualquier paso que **sume, fusione, reparta o
reste** un numerador o un denominador queda obligado a recalcular, en la misma pasada, todas las
tasas que dependen de él. Si no sabe cuáles son, no debería estar tocando la pata.

⚠ **Ninguna puerta lo vio.** La PUERTA 2 cruza el reporte contra la rejilla, y la tasa mala estaba
**en las dos** — salía de la rejilla y se copió fiel. Cuadraba consigo misma. Lo que lo destapa es
comparar la tasa contra **sus propias patas en su propia fila**:

```bash
node _scripts/resumen.auditar-tasas.js    # 1,388 comparaciones, cada tasa contra su pareja
```

## 🔴 Dos veces la misma llave en el mapa de columnas

Escribí `'Unsubs_Total': c.unsubs_unicos` veinte líneas debajo de `'Unsubs_Total': null`. JS se queda
con la última **sin avisar**, así que mi línea pisó en silencio una decisión de Rick («unsuscribe
total se quita»). Lo que se pierde así no es un valor: es una decisión, y no queda rastro.

`resumen.validar.js` lo vigila **leyendo el archivo, no el módulo** — al importar, JS ya se quedó con
una y la repetición desaparece: desde el módulo el defecto es invisible.

## Las bajas · las dos columnas que pidió Rick

Mismo numerador, distinto denominador, y son dos lecturas del mismo hecho:
`% Unsuscribe` = bajas / **envíos** (salud de la lista) · `% Unsub vs Clicks` = bajas / **clicks**
(de los que interactuaron, cuántos lo hicieron para irse). La segunda va **al final**, para análisis.

🔴 **El numerador NO es `Clicks_Unsub`** —ése cuenta clicks en el link de baja, que no es una baja—.
SFMC entrega la baja real en `email_unique_unsubs`, que el motor agrega como `unsubs_unicos`.
El click habría dado un número parecido y equivocado: de los peores, porque nadie lo nota.

## para_el_siguiente

`Report_Resumen` escrito y validado contra la rejilla, con su columna `Insights` **creada y vacía** —
la llena el skill de insights. Y el aviso de qué celdas quedaron en `PENDIENTE`.

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
