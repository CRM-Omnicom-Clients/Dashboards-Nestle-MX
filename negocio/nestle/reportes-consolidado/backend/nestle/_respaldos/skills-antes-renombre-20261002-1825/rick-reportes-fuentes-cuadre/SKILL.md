---
name: crm-reporte-fuentes-cuadre
description: Las DOS puertas del sistema — cruza los cuatro bloques y dictamina si se puede escribir (Puerta 1), y al final cruza el reporte contra la rejilla (Puerta 2). Úsalo antes de escribir un corte y al cerrarlo; si una puerta sale CERRADA, no se escribe ni se publica nada.
---

# Las dos puertas · PUERTA-1 · PUERTA-2

<!--@DECLARACION-->
## 🔴 Lo que este skill lee, lo que lo vigila y lo que le exigen

> Este bloque **se genera** desde el estado real del sistema con
> `orquestador.declarar-en-skills.js`. No se edita a mano: un bloque escrito a mano se
> desfasa en cuanto cambia una guarda — que es justo lo que le pasó al mapa de la cadena.

**Su turno:** etapas 9 · 17   ·   **5 script(s) de ejecución**

**Contratos que lee**

- `_contratos/entorno.json`
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
<!--/@DECLARACION-->

```bash
# ── PUERTA 1 · etapa 9 · ¿se puede escribir?
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-cuadre.cuadre.js                 # el veredicto
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-cuadre.refuta-probar-que-cierra.js   # ¿de verdad cierra?
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-cuadre.refutar.js             # ¿se le puede engañar?
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-cuadre.simular-siguiente.js   # ¿la puerta obedece?

# ── PUERTA 2 · etapa 15 · ¿lo escrito dice la verdad?
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-cuadre.puerta2.js                 # el veredicto
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-cuadre.probar-que-cierra.js    # ¿de verdad cierra?
```

## 🔴 Son TRES cruces, no dos — cuadre-coherencia es el tercero

| | Qué cruza |
|---|---|
| **Puerta 1** · PUERTA-1 | los cuatro **bloques** del backend, entre ellos |
| **cuadre-coherencia** · normalizador | **hoja contra hoja** dentro del libro ya escrito |
| **Puerta 2** · PUERTA-2 | el **reporte** contra la rejilla |

cuadre-coherencia mira lo que ninguna puerta mira: que una fila de email no traiga números de WhatsApp, que un
envío no viva en dos filas con dos identidades, que una oleada no se parta entre quincenas. Va
**antes** de la Puerta 2 para que la incoherencia se vea en el mismo aliento que el veredicto.
**Avisa, no bloquea, y NO repara** — varias filas del reporte las escribió Rick a mano.

Lo pidió el 20-ago y estuvo **declarado sin turno hasta el 25**: existía, escribía su informe, y la
cadena no lo llamaba nunca. Al darle turno salió que **6 de sus 7 hallazgos eran falsos**, los seis
por escribir el nombre de la llave en vez de pedirlo (`pieza_id`, `Touchpoint`,
`Quincena_Lanzamiento`). Un guardián que grita seis falsos por corrida enseña a ignorarlo entero —
por eso ahora todo lo lee con `lib-columna`, que resuelve o truena.

## 🔴 En seco la Puerta 2 compara un reporte viejo contra una rejilla nueva

La puerta cerró acusando al reporte de inventar 366 carritos. No los inventaba: en seco resumen-regenerar **no
reescribe la hoja**, así que se comparaba un `Report_Resumen` de la era Datorama (2,741) contra una
rejilla recién calculada (2,375). Al escribir de verdad, cuadra. **Un veredicto en seco sobre una
hoja que el ciclo iba a regenerar no es un veredicto.**

Los 366 sí tienen nombre y son decisión de Rick: la pieza `001-P005` es Principal de Datorama y ya
no llega por SFMC; sus carritos, repartidos en seis meses, buscan un envío que la fuente nueva no
trae, y **el ancla no fabrica celdas**.

## 🔴 Un solo dueño para las dos puertas, y es a propósito

Quien decide **si se puede escribir** decide también **si lo escrito dice la verdad**. Separarlas en
dos dueños deja que cada uno confíe en que el otro miraba: la Puerta 1 cruza los bloques *antes*, la
Puerta 2 cruza el reporte contra la rejilla *después*, y las dos aplican la misma doctrina —
**BLOQUEA vs AVISA**, y un gate que no cierra es un adorno.

| | Puerta 1 · `PUERTA-1` | Puerta 2 · `PUERTA-2` |
|---|---|---|
| **Cuándo** | etapa 9, antes de escribir nada | etapa 15, con la hoja terminada |
| **Qué cruza** | los 4 bloques entre ellos y contra el catálogo | el reporte contra la rejilla, y la rejilla contra los bloques |
| **Si cierra** | no se escribe **nada** | no se publica **nada** |

Y hay una pregunta que **solo la Puerta 2 puede hacer**: *¿quedó alguna columna sin llenar?* Antes
de ella la respuesta sería «todavía no» — los insights y el formato aún no corrieron.

Sale **exit 0** si la puerta abre, **exit 1** si cierra. El veredicto queda en
`_fuentes/veredicto.json`.

## Por qué existe

Cada bloque se validó **contra sí mismo**. Hay cosas que **solo se ven al juntarlos**: un dato
contado por dos bloques, un bloque que quedó de otro corte, una suma que ya no cuadra con el
catálogo. Ninguno de los cuatro puede detectar eso solo.

## 🔴 La regla dura

**Si el veredicto es CERRADA, la Puerta 1 no escribe NADA** — ni siquiera los bloques que sí
cuadran. Un corte a medias deja el archivo en un estado que nadie sabe describir después.

**Probado** (`N2v-98`): con la puerta cerrada la Puerta 1 escribe **0 filas**, aunque email y
qcart cuadraran.

## BLOQUEA vs AVISA — y por qué la distinción importa

Sin esta separación el gate sería un rojo permanente, y un rojo permanente se ignora.

| | Qué |
|---|---|
| **BLOQUEA** | el mismo dato en dos bloques · un bloque con **MENOS** que el catálogo · bloques de cortes distintos · cuadre interno roto · **la auditoría no coincide con el contenido** · falta un bloque |
| **AVISA** | un bloque con **MÁS** que el catálogo → *es justo lo que la puerta va a corregir* · piezas sin datos aún · huérfanos ya declarados por su bloque |

**La dirección de la diferencia es lo que decide.** Traer de más antes de escribir es normal;
traer de menos significa que algo se perdió por el camino.

## Lo que mide

1. **Frescura** — los 4 del mismo corte (tolerancia 3 h)
2. **Doble conteo** — pares `pieza¦métrica` con más de un bloque. Probado en las 3 combinaciones
3. **Σ vs catálogo** — por canal, con su dirección
4. **Cuadre interno** — el de cada bloque, releído del JSON… **y contando los registros de verdad**
5. **Cobertura** — piezas sin tocar y datos sin pieza

## 🔴 Un gate que no cierra es un adorno

Con datos sanos **siempre da verde**, así que la única forma de saber si sirve es romper los
bloques a propósito. `N2v-96` lo hace, uno por motivo, y comprueba también que **vuelve a abrir**
al arreglarlo — un gate trabado en cerrado es igual de inútil.

⚠ **El agujero que encontró el refutador:** un bloque con `envios: []` y la auditoría intacta
**pasaba**. El gate creía el número declarado en vez de contar. Ahora compara la auditoría contra
el contenido real: *una auditoría es una afirmación sobre el contenido; si no coincide con él,
la afirmación miente.*

## El orden de escritura lo dicta el veredicto

```
catalogo → email → qcart → whatsapp → manual
```

El catálogo va **primero**: las columnas canónicas de las hojas de datos lo consultan por fórmula.

## No escribe el Excel

Solo lee y dictamina. Verificado por `mtime` en su propia simulación.

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
