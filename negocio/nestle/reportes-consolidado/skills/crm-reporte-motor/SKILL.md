---
name: crm-reporte-motor
description: Calcula la rejilla — tasas, agregados y el desglose de clicks por destino — a partir de los bloques ya escritos. Úsalo entre la escritura de datos y la construcción del Resumen; es el único que tiene permiso de dividir.
---

# El motor · motor-clicks · motor-calculo · motor-rejilla

<!--@DECLARACION-->
## 🔴 Lo que este skill lee, lo que lo vigila y lo que le exigen

> Este bloque **se genera** desde el estado real del sistema con
> `orquestador.declarar-en-skills.js`. No se edita a mano: un bloque escrito a mano se
> desfasa en cuanto cambia una guarda — que es justo lo que le pasó al mapa de la cadena.

**Su turno:** etapa 11   ·   **5 script(s) de ejecución**

**Contratos que lee**

- `_contratos/clicks-destinos.json`
- `_contratos/entorno.json`
- `_contratos/esquema.json`
- `_contratos/qcart-distribucion-base.json`
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
node ~/.claude/reportes-backend/nestle/_scripts/motor.links.js             # clicks por destino
node ~/.claude/reportes-backend/nestle/_scripts/motor.motor.js             # la rejilla
node ~/.claude/reportes-backend/nestle/_scripts/motor.links-a-rejilla.js  # los links a la rejilla
node ~/.claude/reportes-backend/nestle/_scripts/motor.validar.js        # su suite
```

Sale a **`_rejilla/rejilla.json`**. **No toca el Excel.**

## 🔴 Es el ÚNICO que divide

Los cuatro skills de fuente tienen prohibido calcular: arman bloques con lo que la fuente dice, sin
tasas ni porcentajes. Todo cociente del sistema nace aquí. Por eso una tasa mal solo puede haberse
roto en un sitio.

Y el reporte tampoco calcula: **copia** de la rejilla. Si un número del reporte no está en la
rejilla, el reporte se lo inventó.

### 🔴 La cadena de autoridad, de punta a punta (22-sep-2026)

> Rick: *«no sabemos cuál es la fuente de la verdad, de cálculo y de anotación»*. Es ésta, y cada
> escalón tiene **un solo** dueño:

| capa | autoridad de | quién la escribe |
|---|---|---|
| la fuente del cliente | **nada** — es el ORIGEN, pero se contradice (4 envíos de WA lo hacen) | el equipo, fuera del sistema |
| `_fuentes/*.json` | 🟢 **los CONTEOS** — fuente + conciliación, con su porqué escrito | los skills de fuente |
| `_rejilla/rejilla.json` | 🟢 **las TASAS** — todo cociente nace aquí | **este skill** |
| el workbook | **nada** — es una **vista** | el escritor y el resumen, copiando |

🔴 **Un hecho guardado dos veces crea la pregunta «¿cuál es la buena?».** No se contesta con un
documento que arbitre: se contesta **no guardándolo dos veces**. Tres casos reales, el mismo error:

- **`Data_Clicks` y `Dic_Clicks` (retiradas 22-sep).** Materializaban en el libro lo que ya estaba
  en `_fuentes/links.json` (detalle) y en `Report_Resumen` (agregados). `motor.hoja-clicks.js`
  leía los insumos **en paralelo** a `motor.links.js` — dos scripts resolviendo la misma pregunta.
  Sus únicos lectores eran verificadores de sí misma: la hoja existía para poder comprobar la hoja.
- **Las 4 tasas de `Data_WhatsApp`** (`Delivery_Rate`·`Read_Rate`·`CTOR`·`Pct_Error`). Nadie las
  lee, y quedaron con el denominador **crudo** cuando la conciliación cambió los entregados:
  `008-P008` guarda 60.90% teniendo 2,405 y 2,890 en su propia fila — que dan 83.22%.
  **Una derivación guardada es un caché, y este caché no tenía invalidación.**
- La regla que lo cierra: **toda celda derivada debe poder reproducirse desde los hechos de su
  propia fila.** Eso es un guardián, no un texto: un documento no impide que la celda mienta.

⚠ **Y el libro no puede tener una hoja que `esquema.json` no declare.** Lo mide
`orquestador.guardian-hojas.js` en cada corte. `Data_Clicks` estuvo semanas ahí sin que nada lo
notara: se descubrió porque Rick preguntó.

## Los tres pasos, y por qué son tres

| Paso | Grano | Qué resuelve |
|---|---|---|
| **`motor-clicks`** | pieza | clasifica cada click por **el destino de su URL** |
| **`motor-calculo`** | celda | agrupa a `campaña × objetivo × touchpoint × segmento × quincena` y calcula |
| **`motor-rejilla`** | celda | mezcla el desglose de `motor-clicks` en la rejilla, y consolida audiencia |

**`motor-rejilla` no está dentro de `motor-calculo` a propósito.** `links.json` está a grano de **pieza** y la rejilla a
grano de **celda**: una celda agrupa varias piezas. Repartir eso dentro del bucle de email mezclaría
dos granos en el mismo sitio — que es como nacen los errores que nadie encuentra. Aquí el reparto es
explícito: cada celda suma los links de **las piezas que contiene**, ni una más.

## 🔴 El destino sale de la URL, no del nombre

`Link_Name` viene **vacío** en casi todas las filas de la DE. Pero `Link_URL` no, y el destino **es
un hecho de la URL**: `qcart.app` es el carrito, `apps.apple.com` es la app, `unsub` es la baja.
Eso no es inferir del naming — es leer a dónde apunta el enlace.

⚠ Lo que no cae en ninguna clase entra como **`otro`** y se cuenta. No se reparte a ojo.

Y el desglose **tiene que cuadrar**: Σ de las clases == Σ de los links de la pieza.

## 🔴 QUÉ ES **UNO** EN UN CLICK — la pregunta que costó el reporte de septiembre

Rick lo vio así: filas donde el desglose sumaba **más** que la columna de clicks. Parecía un error de
suma. No lo era: eran **dos unidades distintas con el mismo nombre**.

| Columna | Qué es **uno** | De dónde sale |
|---|---|---|
| **`Clicks`** | una **persona** que hizo click en ese correo | `Clicks` de SFMC — único por **correo** |
| el **desglose** por destino | un **enlace** tocado | `Clicks_Unique` de la DE de links — único por **link** |
| **`Clicks_Medidos`** 🆕 | lo mismo que el desglose: Σ de sus clases | `lib-clicks-destino.totalMedido()` |

Quien toca dos enlaces del mismo correo cuenta **1 arriba y 2 abajo**. El desglose puede exceder a
`Clicks` y **eso no es un defecto** — es que no son la misma pregunta. Medido hoy: únicos
**41,744** vs medidos **49,198**, con **31 piezas** en exceso y la peor a **4.0×**.

🔴 **Por eso existe `Clicks_Medidos`, y por eso el desglose se compara contra ELLA y nunca contra
`Clicks`.** Con la columna a su lado, la fila deja de parecer incoherente: dice cuántas personas y
cuántos toques, que son dos hechos.

⚠ **Y me equivoqué de vara antes de acertar.** El primer arreglo armó el desglose con
`Clicks_Total` (todos los toques, repeticiones incluidas): el síntoma visible **empeoró** —87 piezas
en exceso, la peor a **90.6×**— porque la queja de Rick era contra `Clicks`, no contra la columna
nueva. La vara correcta es `Clicks_Unique`. *Elegir la unidad más grande no es ser conservador: es
cambiar de pregunta.*

🔴 **El check viejo no podía verlo, por construcción**: validaba el desglose contra `clicks_unicos`,
**los dos sacados del mismo campo**. Un guardián que compara algo consigo mismo prueba que es
consistente, no que es correcto. Hoy el contraste es **externo**: contra el detalle de SFMC.

📄 **Toda métrica que salga de aquí se declara en `_contratos/unidades.json`** con sus tres campos
—`unidad` · `origen` · `se_compara_con`— y un cruce de unidades legítimo se marca `embudo: true` con
su razón. Lo vigila `orquestador.guardian-unidades.js` en la PUERTA 2 — hoy **10 checks**: U1 · U2 · U2b · U3 · U3b · U3c · U3d · U4 · U5 · U6, con 3,207 comparaciones. Los tres nuevos son del 27-oct-2026: **U2b** (toda referencia del contrato resuelve a una columna: un nombre mal escrito dejaba el cruce sin evaluar, en silencio), **U3c** (lo declarado idéntico lo es EN EL DATO) y **U3d** (el total de una suma derivada no publica un parcial). Se prueban con `orquestador.probar-guardian-unidades.js`: **9 señuelos, 9 bloqueos**.
Si no se puede decir contra qué se compara una métrica, es un número que nadie puede contrastar.

## 🔴 El volumen de audiencia NO se suma dos veces

Dos piezas de la misma celda pueden salir de la **misma** Data Extension. Sumar sus volúmenes daría
una audiencia mayor que la que existe. Se consolida por DE distinta, no por pieza.

## 🔴 Y ninguna tasa se compara fuera de su objetivo

`Inspiration` abre naturalmente más que `Purchase`. Comparar el OR de una campaña contra el suyo de
otra quincena **con otro objetivo** produjo una vez «44.9pp bajo tu mejor» y una acción sin sentido.
El motor entrega las tasas; quien las compara es `crm-reporte-nestle-insights`, y solo dentro del
mismo objetivo.

## Lo que este skill NO hace

- **No escribe el Excel.** Verificado por `mtime` en su propia validación.
- **No decide dimensiones**: las toma del catálogo, ya resueltas por el bloque.
- **No inventa la quincena**: se la pide a `lib-quincena`. Tuvo su propia copia y se corrigió.
- **No concatena el subsegmento por su cuenta** — esa regla vive en el skill de email. Tenerla dos
  veces hizo que el bloque saliera limpio y la rejilla volviera a doblarlo:
  `Pro Plan Aspiracionales · Gatos — Gatos` en 15 filas, durante corridas enteras.

## DoD — cierras cuando

1. `motor.validar.js` da **EL MOTOR CALCULA BIEN** (hoy 10 checks).
2. El desglose de clicks cuadra con **`Clicks_Medidos`** —su propia unidad— y se contrasta contra el
   **detalle de SFMC**, que es una fuente externa. 🔴 **No contra `Clicks`**: son unidades distintas
   y exigirles que coincidan es cómo se eligió la vara equivocada. Lo prueban
   `motor.probar-vara-clicks.js` y `motor.refutar-clicks.js` (8 ataques, 8 atrapados).
3. Σ de la rejilla == Σ de los bloques, por canal.
4. El Excel **no se movió**: `mtime` igual antes y después.

## para_el_siguiente

`_rejilla/rejilla.json` — una entrada por celda, con sus piezas, sus métricas ya calculadas, su
qcart anclado y su desglose de clicks. Es lo único que `crm-reporte-resumen` tiene permitido leer.

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
