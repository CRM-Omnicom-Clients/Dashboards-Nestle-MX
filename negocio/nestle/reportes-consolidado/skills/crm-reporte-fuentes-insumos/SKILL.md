---
name: crm-reporte-fuentes-insumos
description: Revisa las descargas antes de que nada las consuma — qué llegó, qué falta, qué está viejo y qué forma trae cada fuente. Úsalo al inicio de cada corte, antes de cargar nada.
---

# insumos-validar · Insumos

<!--@DECLARACION-->
## 🔴 Lo que este skill lee, lo que lo vigila y lo que le exigen

> Este bloque **se genera** desde el estado real del sistema con
> `orquestador.declarar-en-skills.js`. No se edita a mano: un bloque escrito a mano se
> desfasa en cuanto cambia una guarda — que es justo lo que le pasó al mapa de la cadena.

**Su turno:** etapa 2   ·   **3 script(s) de ejecución**

**Contratos que lee**

- `_contratos/entorno.json`

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

Primer paso del ciclo. Miras lo que llegó al inbox y decides si sirve. **Nadie carga nada hasta
que tú entregues tu veredicto.**

```bash
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-insumos.insumos.js --corte WK33   # el veredicto
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-insumos.validar.js             # ¿migró bien?
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-insumos.simular-siguiente.js   # ¿le sirve a email-bloque?
```

## No haces

- **No cargas datos.** Ni al backend ni al workbook.
- **No escribes en el Excel.** Ni siquiera un temporal "para probar".
- **No renombras, mueves ni borras** nada del inbox. Si un archivo debería renombrarse, lo
  **reportas**; lo ejecuta el script de carga.
- **No corriges el contrato.** Si el contrato y la realidad discrepan, **gana la realidad**: lo
  escribes en `para_el_siguiente` con la diferencia concreta.

## ⚡ Si el encargo ya trae mediciones, NO las vuelvas a derivar

Cuando el orquestador te entrega la forma de una fuente, el mapeo de columnas o los totales de
partida, **eso ya se midió**. Re-descubrirlo es el gasto más grande de una corrida.

Lo que sí haces: **verifica UNA sola de esas cifras** contra el archivo. Si cuadra, das el resto
por bueno. Si NO cuadra, **paras todo y lo reportas** — una medición mala envenena el script entero,
y esa discrepancia vale más que cualquier cosa que ibas a producir.

## 🔴 Las tres que no se negocian

**1 · El nombre es una pista, el contenido es el dato.** Los dos defectos del guardián viejo
salieron de creerle al nombre:

| Defecto medido 18-ago | Consecuencia |
|---|---|
| filtraba la carpeta con `/^Datorama-Nestle-WK(\d+)\.xlsx$/` | **no veía 4 de 18 archivos** y firmaba en verde con media carpeta |
| elegía el WK más alto del **nombre** | cargaba `WK33` (12-ago 20:11) teniendo `WK32.1` (13-ago 16:42) — **21 horas más viejo** |

Se lista **todo**, se clasifica por lo que trae adentro, y se ordena por su **sello interno**.

**2 · El periodo se lee por las fechas de las filas, nunca por el nombre.** Y cuando no se puede
—**40 de 42 CSV de Qcart no traen columna de fecha**— se declara así, no se deduce del nombre.

**3 · Ningún esquema es estable, ni siquiera dentro de un archivo.** Hoy conviven **6 esquemas de
CSV** en Qcart, y el export de email trae **20 columnas en 4 hojas y 31 en otras 2**. No es un
error: es la fuente evolucionando. **Leer por nombre de columna, nunca por posición.**

## DoD — cierras cuando

1. **[1] Email** — hay descarga, trae datos, y el elegido es el más fresco **por su sello**. Si el
   corte pedido no coincide con el elegido, reportas los dos.
2. **[2] Qcart** — todo CSV clasificado por su encabezado, cada pieza con sus dos mitades, ninguna
   vacía. Cada huérfano queda en uno de tres casos: *falta el archivo* · *nombre desajustado* ·
   *sin token de tipo*.
3. **[3] WhatsApp** — se resuelve el archivo y **no es un respaldo ni un borrador**.
4. **[4] El archivo de trabajo está libre.** Si está bloqueado, ningún paso de carga puede correr.
5. **[5] El mapa de shortlinks** está presente. Si hay más de uno, confirmas cuál es el vigente.
6. **Periodo y estructura** — de cada fuente reportas qué periodo cubre, **leído adentro**, y qué
   esquemas trae hoy. Todo elemento no reconocido queda nombrado.
7. **Volumen** — cada fuente contra el corte anterior, **en cifras**. Siempre los dos números y el
   delta, nunca un adjetivo. Una fuente que **pierde** volumen es sospechosa aunque todo esté verde.

## para_el_siguiente

Tu producto no es el veredicto: es **la forma de cada fuente**, para que los bloques email-bloque/b/c no la
vuelvan a derivar. En `_insumos/inventario.json`:

| Campo | Qué le ahorra al siguiente |
|---|---|
| `forma.email.ruta` + `sello` | no listar 18 archivos ni compararlos |
| `forma.email.hojas` | cuántas filas y columnas trae cada hoja |
| `forma.email.esquema_uniforme` | si puede fijar columnas o no |
| `forma.qcart.esquemas` | los 6 esquemas con sus columnas |
| `forma.qcart.sin_periodo_legible` | cuántos CSV no permiten leer su periodo |
| `tareas` | lo que el handoff **no** resuelve y él debe tener en cuenta |

**Probado** (`fuentes-insumos.simular-siguiente.js`): email-bloque arranca con esto, lee 955 filas y la cifra de
control cuadra contra el archivo real.

## Rúbrica — umbral ≥4 en todas

| Dimensión | 1 | 3 | 5 |
|---|---|---|---|
| **Cobertura** | revisaste lo que el validador señaló | revisaste que los archivos existan | contaste tú cada archivo, lo abriste, y cuadraste tu conteo |
| **Precisión del faltante** | "falta Qcart" | nombras el archivo | nombras archivo, periodo, caso al que pertenece y qué pasos quedan sin poder correr |
| **Detección de lo nuevo** | ignoraste lo que no reconociste | lo mencionaste de pasada | nombraste cada hoja, columna o esquema desconocido con una muestra |

## Si crees que el validador mide mal

**No lo reescribes.** Lo reportas con el check, lo que dice probar y el caso concreto. Un validador
equivocado no bloquea: **da permiso**, y por eso reportarlo vale tanto.

## Lee cuando toca

| Cuándo | Qué |
|---|---|
| antes de abrir cualquier fuente | `~/.claude/crm-reporte-doctrina/leer-fuentes-que-cambian.md` |
| antes de declarar algo cerrado | `~/.claude/crm-reporte-doctrina/validar-sin-enganarse.md` |
| antes de escribir una fecha | `~/.claude/crm-reporte-doctrina/fechas.md` |

## 🔴 Flexible en lo que entra, estricto en el objetivo

Los datos de hoy se van a reemplazar enteros. **Lo que se entrega no es el dato: es el sistema
capaz de digerirlo.** Un paso que hay que *editar* para cargar datos nuevos no está terminado.

Este paso ya nace bien —lista todo, clasifica por contenido, ordena por sello interno— y desde
el 19-ago **resuelve el archivo vivo en vez de declararlo**:

```js
var _vivo = L.archivoVivo({ dir: PROY });     // lib-flexible
```

Estaba escrito con su versión (`-v8`) en **31 sitios del sistema**. El día que exista una v9,
los 31 siguen leyendo la v8 **sin avisar**. Ahora se resuelve aquí una vez y viaja en el handoff
como `forma.archivo_vivo` — ningún paso de aguas abajo vuelve a escribir ese nombre.

### Lo que NO se hace, nunca

| ⛔ | ✔ |
|---|---|
| filtrar la carpeta por patrón de nombre | listar todo y clasificar por contenido |
| elegir por el WK del nombre | ordenar por el sello interno del archivo |
| `MESN = {marzo…agosto}` | `L.mesDe()` — los 12, y `null` si no es un mes |
| lista fija de métricas | `L.metricasDe()` — descubre, y **declara lo que no reconoce** |
| `chk('96 piezas', n === 96)` | `chk('toda pieza tiene id único', …)` |

**Un check contra una constante obliga a editar código para cargar datos.** Ése era el
determinismo que rompía a los agentes viejos. `L.invariante()` / `L.constante()` marcan la
diferencia en el código para que no se vuelva a colar.

⚠ Flexible **no** es permisivo: lo que no se reconoce **se acepta, se declara y se le nombra
dueño** (`vocabulario_nuevo`, `metricasDe().nuevas`, `AMBIGUA` con candidatas). Descartar lo raro
en silencio es lo que hizo que 6 envíos de WhatsApp pasaran semanas sin llegar a ningún reporte.

Auditar antes de cerrar: `node ~/.claude/reportes-backend/nestle/_scripts/AUDIT-fragilidad.js`

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
