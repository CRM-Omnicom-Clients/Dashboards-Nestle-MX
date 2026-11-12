---
name: crm-reporte-fuentes-manual
description: Carga al backend lo que el equipo declara a mano porque ninguna descarga lo entrega. Úsalo cuando haya que meter un dato que no llega por SFMC, Qcart ni WhatsApp — por ejemplo Liga MX antes de que la fuente la traiga.
---

# manual-bloque · Bloque Manual

<!--@DECLARACION-->
## 🔴 Lo que este skill lee, lo que lo vigila y lo que le exigen

> Este bloque **se genera** desde el estado real del sistema con
> `orquestador.declarar-en-skills.js`. No se edita a mano: un bloque escrito a mano se
> desfasa en cuanto cambia una guarda — que es justo lo que le pasó al mapa de la cadena.

**Su turno:** etapa 8   ·   **2 script(s) de ejecución**

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

```bash
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-manual.manual.js                    # el bloque
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-manual.validar.js                # ¿está bien?
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-manual.refutar.js                # ¿puedo romperlo?
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-manual.simular-primer-dato.js    # las 4 reglas, con datos
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-manual.simular-siguiente.js      # ¿le sirve a PUERTA-1/N3/motor-calculo?
```

## 🔴 Que esté vacío es el estado NORMAL

Hoy tiene **cero datos**, y así debe estar la mayor parte del tiempo. Existe para que el día que
haga falta el dato entre **por un camino con reglas**, y no pegado a mano en la hoja.

El caso a la vista es **Liga MX**: sus 4 piezas (`005-P001`…`005-P004`) están en el catálogo con
`sends = 0` porque los partidos son el **22-ago, 6-sep y 19-sep** — aún no ocurren.

## Cómo se usa

Un `.csv` en `<proyecto>/_manual/`. Una fila = un dato:

```
pieza_id,fecha,metrica,valor,quien,por_que
005-P001,2026-08-22,sends,12500,Rick,Liga MX P1 — Datorama aún no lo trae
```

Las **dimensiones no se escriben**: el dato hereda campaña, canal, marca y touchpoint **de su
pieza**. Por eso `pieza_id` es lo único obligatorio del lado del catálogo.

## Las 4 reglas

| Regla | Por qué |
|---|---|
| 🔴 `quien` y `por_que` **obligatorios** | es **el único dato del sistema sin fuente verificable**. Los demás se vuelven a bajar y se comparan; éste no. Sin autor ni motivo, en tres meses es indistinguible de un error de dedo |
| la pieza **debe existir** en el catálogo | si no, es un dato flotante: sin campaña, sin canal, sin periodo |
| 🔴 **no puede pisar** lo que una fuente automática ya trae | si SFMC (o Qcart/WhatsApp) ya lo da, el manual sobra — y si difiere, hay dos verdades y ninguna forma de elegir. Se declara **redundante** y no se carga |
| **nada calculado** | `ctor`, `rate`, `%` se rechazan. Las tasas son de motor-calculo |

Métricas válidas: `sends` · `deliveries` · `opens` · `clicks` · `errores` · `carritos` · `views` · `importe`.

## Se puede CORREGIR (y aquí sí, a diferencia de Qcart)

Un evento de Qcart pasado no cambia. Un dato manual **sí**: la persona puede haberse equivocado.
Si se vuelve a declarar con otro valor, **gana el nuevo y se conserva el anterior** (`valor_anterior`).

⚠ Y borrar una fila del CSV **no borra el dato cargado** — el bloque es acumulativo. Para quitar
algo hay que hacerlo en el backend a propósito.

## Cuando un dato manual deja de hacer falta

Si la fuente automática empieza a traerlo, el script lo marca **redundante** y te dice qué filas
borrar. *Un dato manual que sobrevive a su motivo es el que después nadie sabe explicar.*

## Río abajo sigue siendo distinguible

`fuente = 'manual'` viaja con el dato hasta la hoja (`Fuente_Dato`). **Probado**: motor-calculo puede separar
lo declarado de lo medido, y PUERTA-1 suma los 4 bloques **sin que ninguna pieza reciba el mismo dato
dos veces** — porque la regla de «no pisar» lo impide en origen.

## Límite conocido

`quien` acepta cualquier texto: se pide que **exista**, no que sea cierto. Validarlo requeriría
una lista de personas, y no la hay.

## DoD

1. Corre con cero datos sin fallar.
2. Rechaza sin `quien` / sin `por_que` / pieza inexistente / métrica calculada / valor no numérico.
3. Lo que la fuente automática ya trae **no se carga**.
4. Una corrección gana y conserva el valor anterior.
5. Correrlo dos veces no cambia nada.
6. El dato llega a la puerta marcado como manual.
7. El Excel no se tocó.

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

*Lo que Rick declara a mano porque ninguna descarga lo entrega.*

### → `Report_Resumen`

| | |
|---|---|
| **Grano** | la fila que Rick declare |
| **Llave** | `la misma` |
| **Columnas suyas** | 1: `las que declare` |
| **NO toca** | lo que una fuente automática ya escribe |

**El orden es: atribuir → organizar → llenar.** No se escribe nada que no se haya atribuido
primero: llenar antes de atribuir es como un dato acaba en la fila equivocada.

Se verifica con `node ~/.claude/reportes-backend/nestle/_scripts/E1-4-contrato-escritura.js`

<!-- CONTRATO-ESCRITURA:FIN -->
