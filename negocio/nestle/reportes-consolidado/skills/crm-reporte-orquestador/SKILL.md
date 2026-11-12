---
name: crm-reporte-orquestador
description: Dirige de punta a punta la producción de un reporte consolidado de datos de marketing — desde que llegan los insumos hasta que se publica — planeando y ejecutando solo, encadenando un backend de scripts deterministas y verificando cada script con su guardián. Úsalo SIEMPRE que se pida correr un corte de datos, actualizar los reportes de un cliente, integrar una fuente nueva, o cuando se pregunte "¿qué falta de este reporte?". Es el punto de entrada del sistema crm-reporte.
---

# Orquestador de reportes consolidados

<!--@DECLARACION-->
## 🔴 Lo que este skill lee, lo que lo vigila y lo que le exigen

> Este bloque **se genera** desde el estado real del sistema con
> `orquestador.declarar-en-skills.js`. No se edita a mano: un bloque escrito a mano se
> desfasa en cuanto cambia una guarda — que es justo lo que le pasó al mapa de la cadena.

**Su turno:** etapa 15   ·   **1 script(s) de ejecución**

**Contratos que lee**

- `_contratos/entorno.json`
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

**Este archivo es SOLO el bucle.** Las reglas de Excel, las de redacción y los contratos de cada
artefacto viven en archivos que se leen **cuando toca**. No los copies aquí: el cuerpo de un skill
está en contexto todos los turnos.

> **Planeas y ejecutas.** No enseñas el plan para que lo aprueben: lo escribes y lo corres.
> Al terminar reportas qué hiciste. Solo te detienes por lo que dice *Criterio de parada*.

## Antes que nada
1. Localiza `<proyecto>/_orquesta/`. Si no existe, el proyecto no está montado: dilo y para.
2. Lee `estado-reportes.md` y el `plan-reportes-<corte>.md` más reciente.
3. Índice del sistema: `~/.claude/crm-reporte-doctrina/README.md`.

---

## Qué es un "corte"

Hay **dos niveles** y no son lo mismo:

| | Quién lo define | Dónde vive |
|---|---|---|
| **Corte de datos** | **El usuario lo declara.** "Corre WK32", "actualiza julio", "carga estas campañas" | es el nombre del `plan-reportes-<corte>.md` |
| **Actualización de cada artefacto** | **Lo determinan los guardianes**, midiendo hasta dónde está cada hoja y cada reporte | una línea por artefacto en `estado-reportes.md` |

El usuario dice *qué corte* correr; **los guardianes dicen qué le falta a cada artefacto para ese corte**.
Nunca al revés: no asumas el alcance de un corte por el calendario ni por la fecha.

Si el usuario no declara corte, **pregúntalo** — es la única pregunta obligatoria de arranque.

---

## El bucle

```
┌─ 1. ¿Hay plan abierto para este corte?
│      SÍ → ir a 4 (continuar donde quedó, sin re-hacer nada)
│      NO → seguir
├─ 0. ¿EL SISTEMA ESTÁ SANO? (solo si tocaste agentes, contratos o guardianes)
│      node ~/.claude/tools/reportes/auditar-agentes.js --texto
│      Mide que agentes, contratos y guardianes sigan coherentes entre sí: DoD que citan
│      checks que su guardián NO emite, tareas que contradicen un contrato, referencias
│      rotas, bloques compartidos que divergieron. Si falla, arréglalo antes de correr un
│      corte: un guardián equivocado no bloquea, DA PERMISO.
├─ 2. DIAGNÓSTICO: correr todos los guardianes
│      node ~/.claude/tools/reportes/correr-guardianes.js <workbook> --texto
│      → _orquesta/_diagnostico/<corte>.json
│      No saltes este paso: sin él el plan hereda las mentiras de estado-reportes.md.
│      ⚠️ El guardián de llegada NO entra en el lote: necesita origen y destino, y en el
│         diagnóstico todavía no hay destino. Se corre en el script 11.
├─ 3. PLANEAR: plan-reportes-<corte>.md = corte que pidió el usuario
│                                       + hallazgos del diagnóstico
│                                       + pendientes abiertos de estado-reportes.md
│      Lo escribes y arrancas. No lo sometes a aprobación.
├─ 4. EJECUTAR: tomar el PRIMER paso que no esté DONE
│      → delegar al agente de la tabla
│      → correr SU guardián
│      → escribir estado + evidencia en el plan
│      → si el script cambió un hecho durable, actualizar estado-reportes.md AHORA
│      → repetir 4 hasta que no quede ninguno
└─ 5. CERRAR: plegar a estado-reportes.md · archivar el plan
              · lo que quedó sin resolver pasa a estado-reportes.md
```

**El paso 2 va antes del 3 a propósito.** Si el plan sale de lo que `estado-reportes.md` *dice*,
hereda sus mentiras. Sale de lo que los guardianes *miden*. Así los huecos se vuelven tareas solos —
fue como se descubrió que 6 envíos de WhatsApp llevaban semanas sin llegar a ningún reporte.

### 🔴 `estado-reportes.md` se actualiza SOBRE LA MARCHA
No al final. **Cada paso que cambia un hecho durable lo escribe en el momento**: qué fuente quedó
cargada hasta cuándo, qué reporte quedó actualizado hasta qué corte, qué se publicó dónde.
Si la sesión muere a medio camino, el estado ya es verdad hasta el último paso terminado.
Un `estado-reportes.md` desactualizado envenena el diagnóstico del corte siguiente.

---

## LA CADENA DE SKILLS

> 🔴 **REESCRITO 25-ago-2026 — la cadena es de SKILLS.** Lo pidió Rick:
> *«los pasos están contenidos en los skills; el sistema plano anterior no se vuelve a usar».*
> Antes lo que se ejecutaba era un array de 20 scripts de ejecución planos y los skills vivían al lado sin mandar
> sobre nada — por eso el corte se corría invocando pasos. **Ya no.**

**El modelo, y no es «un skill = un tramo»:**

```
SKILL  · la unidad de propiedad — su SKILL.md, su contrato, su DoD
ETAPA  · una aparición del skill en la cadena, con los pasos que corre ahí
SCRIPT   · un script, SIEMPRE dentro de una etapa de un skill
```

Un skill aparece **varias veces**: `qcart` corre en la activación y otra vez al armar sus bloques;
el `escritor` corre tres veces; el `cuadre` abre la PUERTA 1 y después la PUERTA 2. Forzar que cada
skill fuera contiguo cambiaría el **orden real de ejecución**, que es justo lo que hay que respetar.

**La cadena vive declarada en `_contratos/cadena-skills.json`** — 17 etapas, 12 skills, 23 pasos —
y el orquestador la recorre de ahí. Se regenera con:

```bash
node ~/.claude/reportes-backend/nestle/_scripts/orquestador.cadena-skills.js --escribir
```

🔴 **Ese paso BLOQUEA si un script del backend no tiene skill dueño.** Un script huérfano significaría
que «correr la cadena de skills» deja fuera parte del corte, en silencio.

### La cadena, etapa por etapa

| # | Skill | Pasos | Qué pasa ahí |
|---|---|---|---|
| 1 | **escritor** | `escritor-neutralizar` | vacía las fórmulas muertas antes de que nadie escriba |
| 2 | **fuentes-insumos** | `insumos-validar` | qué llegó, qué falta, qué está viejo |
| 3 | **fuentes-qcart** | `qcart-activacion` | la fecha de activación de cada link |
| 4 | **nestle-catalogo** | `catalogo-leer` `catalogo-aplicar` | lee y aplica las correcciones — **la autoridad de dimensiones va antes que las fuentes** |
| 5 | **fuentes-email** | `email-bloque` | el bloque de email, desde SFMC |
| 6 | **fuentes-qcart** | `qcart-bloque` | carritos y productos |
| 7 | **fuentes-whatsapp** | `whatsapp-bloque` | el bloque de WhatsApp, anclado al catálogo |
| 8 | **fuentes-manual** | `manual-bloque` | lo que ninguna fuente entrega |
| 9 | **fuentes-cuadre** | `PUERTA-1` 🚪 | **PUERTA 1** · ¿se puede escribir? |
| 10 | **escritor** | `escritor-datos` `escritor-formato-datos` | baja los bloques a las hojas y les da anchos |
| 11 | **motor** | `motor-clicks` `motor-calculo` `motor-rejilla` | el **único** que divide |
| 12 | **resumen** | `resumen-fusionar` `resumen-regenerar` | fusiona Principal+FUP y regenera el Resumen |
| 13 | **nestle-insights** | `insights-redactar` | la columna de insights |
| 14 | **escritor** | `escritor-formato-resumen` | formatea el Resumen **ya construido** |
| 15 | **fuentes-cuadre** | `PUERTA-2` 🚪 | **PUERTA 2** · ¿lo escrito dice la verdad? |

**Por qué el orden es así, en tres frases:** el catálogo va antes que las fuentes porque es su
autoridad de dimensiones · el motor va después de escribir porque calcula sobre lo escrito · el
formato del Resumen va al final porque la etapa 12 **regenera** la hoja y se llevaría por delante
cualquier ancho puesto antes.

### El camino normal: un comando

```bash
# el corte completo — las 17 etapas
node ~/.claude/reportes-backend/nestle/_scripts/orquestador.orquestador.js --escribir

# el camino corto: retomar desde una etapa (p.ej. solo rehacer el reporte)
node ~/.claude/reportes-backend/nestle/_scripts/orquestador.orquestador.js --desde motor-calculo --escribir
```

Recorre las **17 etapas** con sus validaciones y **se detiene en la primera que falla**: un corte a
medias es peor que ninguno.

> 🔴 **`orquestador.reporte.js` está RETIRADO (25-ago-2026)** y este skill lo anunciaba como *el DEFAULT*.
> Lo destapó la validación adversarial de la cadena. Era un **segundo runner** —o sea, una cadena de
> pasos con otro nombre— y encima **producía un reporte distinto**: encadenaba `orquestador.resumen.js`
> (empareja por identidad) mientras la cadena usa `resumen.regenerar.js` (regenera desde la rejilla,
> justamente porque emparejar falla cuando una pieza se renombra). Dos verdades del mismo dato, y
> ganaba la que corriera antes.
> **El camino corto es hoy `--desde motor-calculo`**: mismo ahorro, un solo runner.

### Qué hace cada script

> 🔴 **REESCRITO 24-ago-2026** contra los scripts que existen de verdad. La versión anterior
> citaba `N2a-email`, `N4-formato` y `N6-resumen` como si fueran la cadena viva, y **no lo eran**:
> el email dejó de salir de Datorama y el reporte se regenera en vez de emparejarse. Una partitura
> que nombra instrumentos que ya no existen no dirige nada.

| # | Paso | Script | Su validación |
|---|---|---|---|
| escritor-neutralizar | Neutralizar fórmulas muertas | `escritor.neutralizar-muertas.js` | — |
| insumos-validar | Insumos | `fuentes-insumos.insumos.js` | `N1-99-validar` · `N1s-99-cruce-sfmc` |
| qcart-activacion | Activación de Qcart | `fuentes-qcart.activacion-qcart.js` | incluida |
| catalogo-leer/catalogo-aplicar | Correcciones al catálogo | `catalogo.leer-correcciones.js` · `catalogo.corregir-catalogo.js` | incluida |
| email-bloque | Bloque **email** | **`fuentes-email.email-piezas.js`** (SFMC · `CRM_Email_Piezas`) | `NC-99-validar` (12 checks) |
| qcart-bloque | Bloque **Qcart** | `fuentes-qcart.qcart.js` · **`--rebuild`** si cambió el padrón | `N2b-99` · `N2b-97-refutar` · `B0-99` |
| whatsapp-bloque | Bloque **WhatsApp** | `fuentes-whatsapp.whatsapp.js` | `N2c-99` (14 checks) · `N2c-97-refutar` |
| manual-bloque | Bloque **manual** | `fuentes-manual.manual.js` | `N2d-99-validar` |
| PUERTA-1 | **PUERTA 1** · cuadre de bloques | `fuentes-cuadre.cuadre.js` | es la puerta |
| escritor-datos | Escritura de datos | `escritor.escribir.js` · `escritor.formato.js` | `N1d-99-contrato` · `N6-99-canonicos` |
| **motor-clicks** | 🆕 **Clicks por destino** | `motor.links.js` | balance por pieza |
| motor-calculo | **Motor de cálculo** (lo único que calcula) | `motor.motor.js` | `N5-99-validar` |
| **motor-rejilla** | 🆕 **Links a la rejilla** | `motor.links-a-rejilla.js` | volumen contado una vez por DE |
| **resumen-fusionar** | 🆕 **Fusionar Principal y FUP** | `resumen.fusionar-fup.js` | vigila que email, carritos **y** WhatsApp no se muevan |
| resumen-regenerar | Reporte **Resumen** | 🔄 **`resumen.regenerar.js`** (regenera, no empareja) | `N6-99-validar` (cifra por cifra) |
| insights-redactar | Insights | `insights.insights.js` | IQS determinista |
| PUERTA-2 | **PUERTA 2** · reporte vs rejilla | `fuentes-cuadre.puerta2.js` | `N7-96-probar-que-cierra` |
| N8 | Publicar a producción | `orquestador.publicar.js` | `guardian-llegada.js` · **gate humano** |
| N10 | Retiro de lo viejo | `orquestador.retiro.js` | mide quién cita a quién |
| N11 | Prueba de punta a punta | `orquestador.e2e.js` | reproduce · abre en Excel · trazabilidad |

#### 🔴 Los tres cambios de fondo, y por qué

**1 · El email sale del MCP de SFMC, no de Datorama.** `N2a-email.js` sigue en disco pero **no se
llama**: en una corrida en seco llegó a PISAR el bloque de SFMC y devolvió 98 envíos / 7,282,486 a
264 / 6,454,554. El «seco» protege el Excel, **no los JSON del backend**.

**2 · El reporte se REGENERA (`N6r`), no se empareja (`resumen-regenerar`).** Emparejar cada fila con su celda por
identidad es imposible cuando una pieza se renombra — y se renombran: Espresso Con → Hackea tu café,
J4-ConRegión → E-J4. `N6r` descarta las obsoletas (su dato vive en la celda nueva) e incluye todo.

**3 · Nadie escribe: todos APUNTAN.** Los pasos de catálogo registran sus celdas en
`_contratos/cambios-pendientes.json` con su motivo, y **`escritor.escribir-todo.js`** las aplica de una
pasada: un respaldo, una cadena de validación, una publicación. Dos pasos que piden la misma celda
con valores distintos **chocan** y paran la escritura.

```bash
node ~/.claude/reportes-backend/nestle/_scripts/escritor.escribir-todo.js            # seco: qué aplicaría
node ~/.claude/reportes-backend/nestle/_scripts/escritor.escribir-todo.js --escribir # aplica y publica
```

> ⚠ **DEUDA D3 · hay DOS escritores.** `N4-escribir` escribe las hojas de datos por su cuenta y `Z`
> aplica lo apuntado. Conviven, y eso contradice la doctrina de un solo escritor. Lo cierra el script
> 1.4/1.5 del plan del modelo de datos.

#### El modelo de datos — leerlo antes de cruzar nada

`_contratos/esquema.json` declara entidades, llaves y relaciones; `lib-esquema.js` las sirve.
**Ningún paso debe hardcodear una llave: la pide.**

| | |
|---|---|
| Llave natural de una pieza | **`Email_Name`** — único, probado 99/99 |
| Llave de una fila del reporte | `Campaña + TouchPoint + Segmento + Quincena del Principal` |
| FUP → Principal | **`Pieza_Principal_ID`**, declarado — nunca deducido |
| Los tres estados de celda | valor · `N/A` (no aplica) · `PENDIENTE` (aplica y falta) |

### 🔴 LAS REGLAS QUE EVITAN DAR VUELTAS (25-ago-2026)

Rick lo dijo así: *«no puedes estar dando vueltas escribiendo, viendo qué salió mal, corrigiendo,
luego otra vez»*. Tenía razón, y el diagnóstico es concreto — **se estaba escribiendo al archivo
para averiguar qué estaba mal**. Cada descubrimiento costaba una corrida de 43 scripts de ejecución.

**Leer**

| | Regla | Mecanismo que la hace cumplir |
|---|---|---|
| **L1** | Una columna se **pide**, no se escribe | `lib-columna.de()` resuelve o **truena** · el hook `hook-columna-literal.js` rechaza escribir un script que lea por corchete una columna de la lista negra · la **guarda 3** nombra la deuda histórica |
| **L2** | Un cero no es un vacío | la librería nunca devuelve `''`: si no resuelve, se detiene. Así un `0` solo puede venir de un dato |
| **L3** | Un campo de contrato se pide igual | `COL.campo()` — `e.n` no existía y **no tronó**: devolvió `undefined` y agrupó las 15 etapas en una sola llave |

🔴 **La lista negra la escribe el defecto real, no la teoría.** Solo entran nombres que ya costaron
un error, con su fecha y su caso. Una lista preventiva de 90 columnas bloquearía trabajo legítimo y
acabaría desactivada — y un guardián desactivado no guarda nada.

**Escribir**

- **E1 · Medir todo → decidir todo → escribir una vez.** Ningún paso escribe para averiguar. La
  medición deja su tabla en `_preescritura/` y se puede revisar **antes** de tocar el Excel.
- **E2 · Se arregla al creador, nunca al heredero.** Lo mide `orquestador.probar-idempotencia.js`:
  corre la cadena dos veces y exige que ninguna hoja cambie de tamaño. Nace de retirar `EmailID` y
  que catalogo-aplicar la recreara, y de 216 filas clonadas que ninguna guarda veía.
- **E3 · Fusionar antes de retirar**, siempre. El retirador se niega solo si quedan valores sin
  fusionar — déjalo negarse.
- **E4 · Tras escribir, releer del disco y comparar por NOMBRE**, nunca por letra ni por índice.
- **E5 · El formato lo edita Rick.** No se deciden anchos ni colores; lo que sí es obligatorio es
  **no destruirlos** al tocar la estructura.

**Para no dar vueltas**

- **vacios-medir · Para probar un script se corre el script**, no la cadena entera (hoy 46 scripts).
- **vacios-llenar · Un script exploratorio escribe un JSON**; del chat sale un resumen, no 40 líneas.
- **V3 · No correr dos cadenas a la vez.** Comparten los temporales (`~/_fmt.xlsx`) y una pisa a la
  otra: así falló un script que en aislado corre en verde.

### 🔴 El preflight de este skill — corre SOLO, antes de dirigir la cadena

Antes de recorrer las 17 etapas, este skill decide si vale la pena correr el corte. La condición son
las **dos guardas estructurales** (`orquestador.guardas.js`), que ya van cableadas dentro de
`orquestador.orquestador.js` — no hay que acordarse de correrlas:

| Guarda | Qué prueba | Por qué existe |
|---|---|---|
| **destructivo sin skill** | nada que escriba el Excel o borre archivos anda sin dueño ni papel; y nadie invoca a un script **congelado** | `escritor.retirar.js` desplazó celdas y perdió 5 columnas del catálogo: escribía el archivo del cliente sin rendirle cuentas a nadie |
| **id duplicado** | dos scripts no comparten id de paso · dos contratos no comparten forma · dos etapas no comparten paso | la fase 5 renombró el **producto** al renombrar al **productor**, y dos censos convivieron con el mismo contenido, uno muerto |

Se corren solas, pero se pueden pedir a mano:

```bash
node ~/.claude/reportes-backend/nestle/_scripts/orquestador.guardas.js --antes escritor.retirar.js
```

**Los tres veredictos, y solo uno detiene:** `BLOQUEA` (probado, con el caso en la mano) para el
corte · `AVISA` viaja al handoff · `NO PUDE EVALUAR` se declara ruidosamente y **no cuenta como
pasar**. Nunca bloquean por escribir — escribir es el trabajo del sistema; bloquean por escribir
**sin dueño declarado**. Y no traen su propia lista de nada: todo se lo preguntan a
`orquestador.censo-scripts.json` y `cadena-skills.json`, así que una decisión nueva no las desfasa.

⚠️ **Que salgan verdes no prueba que miren.** `orquestador.probar-guardas.js` les planta cada
defecto sobre una copia y exige que bloqueen — así se descubrió que la guarda del congelado no
reconocía `execFileSync(` y salía verde con el señuelo delante.

### Los guardianes transversales

| Cuándo | Qué corre |
|---|---|
| Antes de dar por bueno cualquier anclaje | `FB-anclaje.js` — Pieza_ID entre TODAS las hojas |
| Antes de dar por bueno un layout | `FA-contrato-layout.js --verificar` |
| Para comprobar la doctrina de escritura | `FF-doctrina.js` |
| Tras CADA escritura a un .xlsx | las **5 capas**: `xlsx-safe-save` → `label` → `check` → `validar-fondo` → **`xlsx-orden-celdas`** |

🔴 **La quinta capa no es opcional.** Las otras cuatro pasaron sobre un libro que Excel se negaba a
abrir: lo único malo era el ORDEN de las celdas dentro de cada fila.

### La doctrina de escritura (leerla antes de tocar un escritor)
`~/.claude/crm-reporte-doctrina/doctrina-de-escritura.md` — cinco reglas: el backend calcula y el escritor
transcribe · la hoja manda la forma · no se borran filas · el formato lo hace el humano · un fetch
grande nunca entra al contexto.


**Un reporte por invocación**: cargarle a un agente los cuatro contratos es como se confunden.

### Estados de un script

### 🔴 Un guardián dice DOS cosas, y no pesan igual

```
✗ BLOQUEA · el dato está PROBADAMENTE mal y se reproduce con una cifra
            (una suma que no cuadra, filas duplicadas, una fórmula que no puede matchear)
            → el script NO cierra

⚠ AVISA   · hay algo que mirar, pero no prueba que el entregable esté mal
            (falta una columna que el contrato pide, un valor sospechoso, una hoja sin anclar)
            → el script SÍ cierra, y el aviso viaja al handoff y a estado-reportes.md
```

**Esto es lo que evita que un guardián equivocado atore el corte para siempre.** Antes, cualquier
check en rojo dejaba el script en `PARCIAL`: si el guardián estaba mal, el agente "arreglaba" algo que
no estaba roto, o el bucle no convergía nunca. Ahora un guardián equivocado degrada a **ruido**, y lo
que de verdad importa —los totales— sigue deteniendo la publicación.

⚠️ **Un aviso no es un permiso para ignorarlo.** Se arrastra corte a corte y se reporta. Si un aviso
lleva varios cortes abierto, es una tarea que nadie está tomando: súbela al plan.

### Estados de un script

| Estado | Qué significa |
|---|---|
| `DONE` | terminado y su guardián no dejó nada **bloqueante** (los avisos van al handoff) |
| `PENDIENTE` | falta hacerlo |
| `PARCIAL` | se hizo a medias; se re-delega solo lo que falló |
| `PENDIENTE-DESCARGA` | **no hay insumo para este corte.** No bloquea: se anota con su razón y el bucle sigue |
| `N/A` | no aplica a este corte, con razón escrita |

Un paso en `PENDIENTE-DESCARGA` **no impide cerrar el corte**, pero sí se reporta al final y se
arrastra a `estado-reportes.md` para que el corte siguiente lo vea.

### Si llegan insumos nuevos a medio corte
El corte que declara el usuario es donde actúas. Si él pide re-correr un corte ya cerrado porque
llegaron datos, **se re-abren solo los pasos de carga afectados** y sus reportes aguas abajo — no
se re-hace todo.

## Qué NO se delega
El hilo principal conserva: **escribir a los archivos críticos** (un solo punto con permiso de
escritura), la conversación con el usuario, los gates de publicación, y el mantenimiento de
`estado-reportes.md`.

> Regla de reparto: si la salida de la herramienta pesa más que la decisión → subagente.
> Si la decisión pesa más que la salida → hilo principal.

---

## Criterio de parada

**Resuelve, no preguntes.** Ante una duda, en este orden:

```
1. ¿Lo puede medir un guardián?     → córrelo y usa el resultado
2. ¿Está en una autoridad?          → léela (autoridades-reportes.md)
3. ¿Se puede derivar de la data?    → derívalo y anota de dónde salió
4. ¿Se puede asumir sin riesgo?     → asúmelo, déjalo escrito, y SIGUE
5. Solo si nada de lo anterior      → PENDIENTES
```

**Detente SOLO si un dato no tiene NINGÚN ancla para asociarse** — un registro que no se puede amarrar
a ninguna campaña por ninguna llave, y que ningún guardián ni autoridad resuelve. Nada más.

`pendientes-reportes-<corte>.md` es para **eso y nada más**. No es un buzón de dudas: si una duda
podía resolverse con un guardián y terminó ahí, el sistema falló. Lo que no se resuelva en el corte
**pasa a `estado-reportes.md`** al cerrar, para que el corte siguiente lo vea.

Formato de un pendiente — sin este detalle el usuario no puede responder:

```yaml
- id: PEN-<corte>-NN
  paso: <número y nombre>
  falta: <qué dimensión o dato>
  campaña: <nombre · código>
  pieza: <content name · tipo>
  ids: <jobs · journey_id>
  intenté: <qué guardián corrí, qué autoridad leí, y por qué ninguno lo resolvió>
  qué asumí para seguir: <valor> · escrito en <dónde>
  impacto si está mal: <qué filas y qué reportes cambian>
  qué necesito de ti: <una frase concreta>
```

**Publicar siempre requiere OK explícito del usuario.** Esa es la otra parada, y es innegociable.

---

## Handoff

Cada agente cierra con su bloque `HANDOFF`. **Lee eso, no su trabajo completo.**

| Estado | Qué haces |
|---|---|
| `COMPLETO` | corres su guardián; si pasa, avanzas |
| `PARCIAL` | re-delegas **solo lo que falló**, con el error como contexto |
| `BLOQUEADO` | intentas resolverlo con guardián/autoridad; si de verdad no hay ancla, va a pendientes y sigues |

Un `COMPLETO` cuyo guardián falla es un **handoff falso**: se trata como `PARCIAL` y se registra en la
bitácora del plan. Si nunca detectas ninguno, probablemente no estás verificando.

### 🔴 Cuando un agente trae `guardian_sospechoso`

Un agente puede **impugnar a su guardián**; no puede reescribirlo. **Tú decides.** Es de lo más
valioso que te van a reportar: un guardián equivocado no bloquea, **da permiso**.

```
1. ¿Trae las tres cosas? check + el punto del contrato que dice probar + el caso concreto.
   Si falta una, es una opinión: se devuelve, no se actúa.
2. Compruébalo TÚ. Abre el dato y el check. No le creas al agente ni al guardián por su cargo.
3. Si el guardián está mal  → corrígelo, vuelve a correr el script, y anótalo en la bitácora.
   Si el agente está mal    → el script sigue en PARCIAL, y se lo dices con la evidencia.
   Si el CONTRATO está mal  → corrígelo tú; el agente nunca corrige su contrato.
```

⚠️ Un agente que impugna para no quedarse en `PARCIAL` está haciendo el peor uso del canal. La señal:
impugna sin abrir el dato, o su "evidencia" repite lo que ya decía su handoff.

### Cuando el refutador encuentra algo
No se anota y se sigue: **se re-abre el script que produjo el defecto**, se re-hace, y se vuelve a
correr su guardián. **No se publica nada hasta que el refutador quede sin nada que probar.**

---

## Publicación

**El interno es la fuente de verdad.** Publicar es copiar de él a los destinos, no fusionar.

1. Leer `<proyecto>/_orquesta/publicacion-reportes.md`: qué hoja va a qué archivo.
2. **Resolver la ruta del destino por búsqueda, en esta corrida.** Las mueven sin avisar; una ruta
   escrita en un documento puede estar muerta.
3. **Diffear destino contra origen antes de escribir.** Si el destino tiene hojas o filas que el
   interno no tiene, se **conservan** — nunca se borran por omisión: pueden ser trabajo del equipo
   del cliente. Ya pasó con una hoja que producción tenía y el interno ya no.
4. Verificar que el destino esté libre; si está abierto en Excel, **no publicar** — OneDrive revierte
   la escritura. ⚠️ Que no dé `EBUSY` no prueba que nadie lo tenga abierto: en SharePoint se coedita
   sin rastro local.
5. Backup del destino antes de sobrescribir.
6. Copiar y correr el guardián de llegada. Mide **siete cosas**, no tres: que los dos archivos se
   pudieron abrir de verdad, toda hoja, filas por hoja, totales columna por columna, paquete sano,
   **etiqueta de clasificación** completa, y que el destino quedó **más nuevo** que el origen — si no,
   la copia no ocurrió aunque nada haya fallado.

⚠️ Copiar una hoja **entre libros distintos** no es copiar su XML: hay que traducir estilos y textos.
Ver `tools/reportes/PENDIENTE.md` → `copiarHoja()`.

---

## Conocimiento (leer cuando toca, no antes)

| Cuándo | Qué |
|---|---|
| **Antes de declarar un script cerrado** | **`~/.claude/crm-reporte-doctrina/validar-sin-enganarse.md`** |
| Antes de escribir a cualquier .xlsx | `~/.claude/crm-reporte-doctrina/editar-xlsx-sin-romper.md` |
| Antes de redactar un insight | `~/.claude/crm-reporte-doctrina/insights-como-escribirlos.md` |
| **Al crear o corregir un guardián** | `~/.claude/crm-reporte-doctrina/como-se-escribe-un-guardian.md` |
| Al resolver una dimensión nueva | `<proyecto>/_orquesta/autoridades-reportes.md` |
| Al publicar | `<proyecto>/_orquesta/publicacion-reportes.md` |
| Al tocar un artefacto | su contrato en `<proyecto>/_orquesta/contratos-cliente-<cliente>/` |
| Índice del sistema | `~/.claude/crm-reporte-doctrina/README.md` |

## 🔴 QUÉ ES «UNO» — la regla que salió de septiembre de 2026

Tres defectos costaron un reporte equivocado en el mismo mes, y **los tres son el mismo**:

| | Se comparaba | Contra | Y son |
|---|---|---|---|
| **Clicks** | `Clicks` (único por **correo**) | el desglose (único por **link**) | quien toca 2 links cuenta 1 arriba y 2 abajo → el desglose excedía en **98 de 101 piezas** |
| **Qcart** | un carrito | una **fila** del CSV | una fila es un bucket con contador `views`: 3,077 filas son **7,503 vistas**, con 444 de `views = 0` |
| **WhatsApp** | `WA-Clicks` | `Carritos_Total` | eran **un total** y **una de sus partes**: ver abajo |

**Nadie declaraba la unidad**, así que dos números de distinta naturaleza acababan en la misma fila.

🔴 **El tercer caso estaba mal CONTADO, y se corrigió el 27-oct-2026.** Decía: «Qcart mide 949
clicks → 18 carritos: el click es el paso ANTES del carrito». **949 es exactamente `WA-Leídos` de
WA-J8** — o sea, comparaba LECTURAS contra carritos llamándolas clicks. Qcart no publica clicks en
ningún sitio de este sistema: mide carritos, y el click de Qcart **se infiere** de ellos.
Lo que de verdad pasaba es que `WA-Clicks` es un **TOTAL de dos mitades** —
`WA-Clicks Qcart` (inferido de los carritos) **+** `WA-Clicks-Recetas` (de Google Analytics, no
conectado) — y se estaba comparando el total contra una de sus partes. El modelo completo vive en
`crm-reporte-fuentes-whatsapp/SKILL.md` §3e y en `_contratos/unidades.json`.
**La lección no cambia, se refuerza:** una evidencia que nadie vuelve a medir envejece igual que
una cifra, y esta sobrevivió un mes dentro de la tabla que explica por qué hay que medir.

🔴 **Y ninguna puerta los vio, por una razón estructural:** las puertas comparan bloque ↔ rejilla ↔
reporte, y las tres descienden del mismo origen. Si la unidad del origen está mal, **las tres
coinciden** y la puerta pasa en verde. Un sistema que se compara consigo mismo prueba que es
CONSISTENTE, no que es correcto.

**Lo que ahora es obligatorio** — `_contratos/unidades.json` + `orquestador.guardian-unidades.js`,
que corre pegado a PUERTA-2:

1. **Toda métrica de conteo declara tres cosas**: su **unidad** (qué es «uno»), su **origen** (el
   campo del que sale) y **contra qué se compara**. Sin las tres no se publica: es un número que
   nadie puede contrastar.
2. **Dos unidades distintas no se comparan** — salvo que el cruce se declare `embudo: true` con su
   razón (hay que leer antes de hacer clic). La diferencia entre un cruce legítimo y el defecto es
   que el legítimo está **escrito**.
3. **Una fuente con contador no se cuenta por filas.** El guardián escanea el CÓDIGO, no el dato:
   cuando el dato lo delata ya está publicado.
4. **Cada fuente declara su MEDIDA EXTERNA** — con qué se contrasta desde fuera del sistema. Hoy:
   email ✔ · Qcart ✔ (su export agregado) · **WhatsApp 🔴 ninguna, y va declarado como hueco**.

⚠️ Y el guardián **se prueba**: `orquestador.probar-guardian-unidades.js` le planta los seis
señuelos sobre copias y exige que bloquee (6/6). Que salga verde no prueba que mire.

## 🔴 LAS DOS COPIAS DE SKILLS: EL MTIME NO ES AUTORIDAD (28-oct-2026)

Hay **dos** copias de los 13 skills y **dos lectores distintos**:

| copia | ruta | quién la lee |
|---|---|---|
| **portable** | `ENT.SKILLS` = `<backend>/skills` | **los SCRIPTS**, y los generadores la escriben |
| **home** | `~/.claude/skills` | **el AGENTE** — es la que Claude Code carga |

🔴 **La portable es el ORIGEN DE REGISTRO.** La dirección es siempre portable → home.

### El caso que lo enseñó, y costó cinco secciones

Escribí cinco secciones nuevas en los `SKILL.md` del **home**. Después corrí
`orquestador.declarar-en-skills.js --escribir`, que regenera el bloque `@DECLARACION` **en la
portable**. Eso dejó la portable **4 minutos más nueva** — con el bloque fresco y **sin mis
secciones**. El sincronizador, que elegía «el más nuevo», copió portable → home y **se llevó las
cinco**. No falló: hizo exactamente lo que decía hacer.

🔴 **El mtime mide CUÁNDO se escribió un archivo, no QUIÉN tiene el contenido bueno.** Y en
OneDrive encima lo reescribe la sincronización de la nube, así que ni eso mide bien. Es la misma
razón por la que `deriva-copia` compara **por sha1, nunca por fecha**.

### La regla hoy

```bash
node _scripts/orquestador.sincronizar-skills.js                      # seco: qué haría
node _scripts/orquestador.sincronizar-skills.js --escribir            # portable → home
node _scripts/orquestador.sincronizar-skills.js --desde-home <skill> --escribir
```

🔴 **No se pisa en silencio.** Si el home trae líneas que la portable no tiene, eso es trabajo sin
sincronizar: el paso **se niega y las nombra**. Editar el home es legítimo; perderlo sin enterarse,
no. Y funcionó en su primera corrida: señaló 31 líneas solo en el home — resultaron ser la sección
**retirada**, así que ahí ganaba la portable, pero lo dijo en vez de decidirlo solo.

### El orden que evita todo esto

```
1 · editar la PORTABLE  (<backend>/skills)
2 · regenerar:  censo-scripts → cadena-skills → declarar-en-skills
3 · sincronizar: portable → home
4 · comprobar que las dos dicen lo mismo
```

⚠ Y si se añade un script nuevo, **va al censo ANTES de correr la cadena**: `maggi.tipo-email-
filas-nuevas.js` escribía el Excel sin dueño declarado y la **GUARDA 1 detuvo el corte entero** —
que es justo para lo que existe.

## Reglas del sistema
- 🔴 **Un guardián que compara algo consigo mismo no prueba nada.** Al cerrar, cuenta cuántos
  checks se contrastan contra una FUENTE que el script no escribió. Si son minoría, no sabes que
  está bien: sabes que es consistente. Detalle en `validar-sin-enganarse.md`.
- 🔴 **La prueba que no es circular: simular al consumidor.** Construye la salida del paso
  SIGUIENTE con lo que produjiste. "Tiene los campos que necesita" es circular si la lista la
  escribiste tú leyendo tu propio plan.
- 🔴 **"No hay dato" es una conclusión, no una observación.** Antes de escribirla, agota TODAS
  las columnas del origen que podrían llevarlo — y la hoja, que también es un dato.
- **Si un defecto pasó en verde una vez, se le deja un check permanente.** Si no, vuelve.
- **Nada se infiere del naming.** Las dimensiones salen de las autoridades.
- **Relee antes de escribir.** El usuario edita los entregables a mano: sus cambios se respetan.
- **Si el DoD no pasa, no se publica.** El script aborta; no existe "casi bien".
- **Di qué validaste y qué no.** No puedes ver el render: dilo en vez de afirmar que quedó bien.
- **Backup antes de cada escritura**, y verificar releyendo el archivo escrito, no el objeto en memoria.

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
