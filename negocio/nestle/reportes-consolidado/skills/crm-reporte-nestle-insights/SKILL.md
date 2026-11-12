---
name: crm-reporte-nestle-insights
description: Escribir los insights operativos del reporte de Nestlé — qué pasó, contra qué se compara y qué hacer. Úsalo cuando haya que redactar la columna o la matriz de insights de un corte ya cerrado; nunca antes de que la Puerta 2 esté abierta.
---

# Insights de Nestlé — cómo se escriben

<!--@DECLARACION-->
## 🔴 Lo que este skill lee, lo que lo vigila y lo que le exigen

> Este bloque **se genera** desde el estado real del sistema con
> `orquestador.declarar-en-skills.js`. No se edita a mano: un bloque escrito a mano se
> desfasa en cuanto cambia una guarda — que es justo lo que le pasó al mapa de la cadena.

**Su turno:** etapa 13   ·   **1 script(s) de ejecución**   ·   **escribe al Excel**

**Contratos que lee**

- `_contratos/clicks-destinos.json`
- `_contratos/clicks-recetas-de-rick.json`
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
- **Guarda 8 · el archivo vivo se llama como dice el contrato** — 🔴 **detiene el corte** por lo grave, avisa por lo demás
- **Guarda 9 · LAS DECISIONES YA TOMADAS** — avisa y viaja al handoff

🔴 **Este skill escribe**, así que la Guarda 5 le aplica de lleno: sin su declaración de
pre-escritura en `_preescritura/DECL-*.json`, con los cuatro campos, **el corte no arranca**.
<!--/@DECLARACION-->

**Este archivo es solo el PROCEDIMIENTO.** Las reglas de redacción completas están en
`~/.claude/crm-reporte-doctrina/insights-como-escribirlos.md` — **léelo antes del primer insight de la
sesión.** Aquí está lo que hay que hacer y en qué orden.

## 🔴 Antes de escribir una sola palabra

```bash
node ~/.claude/skills/crm-reporte-nestle-insights/scripts/iqs.js
```

Eso produce los **candidatos con su puntaje**, leyendo la rejilla del motor
(`_rejilla/rejilla.json`) y dejando el resultado en `_fuentes/insights-candidatos.json`.

**No se redacta un insight que el IQS no haya puesto sobre la mesa.** Si una celda no tiene
candidatos, la celda va con *«sin acción prioritaria»* — y eso se escribe tal cual. Inventar una
recomendación para no dejar el hueco vacío es el modo más rápido de perder la confianza del
lector, porque la primera que se note falsa contamina todas las demás.

## 🔴 REGLA DURA · no escribes si no declaraste antes

Antes de escribir la columna de insights, este skill deja su declaración en
`_preescritura/DECL-insights.insights.json`. Lo que declara, y por qué importa aquí:

> **una celda por FILA del reporte — solo la columna `Insights`.**

Ese grano es la frontera del skill: no toca ninguna otra columna, ni recalcula lo que el motor ya
calculó. Declararlo hace explícito que este skill **escribe una sola columna**, y que cualquier
otra celda tocada sería un defecto.

La **Guarda 5** lo exige desde el preflight: sin declaración, el corte no arranca.

## Las tres condiciones para redactar

1. **La Puerta 2 tiene que estar abierta.** Un insight sobre un número que no cuadra es peor que
   ningún insight. `node ~/.claude/reportes-backend/nestle/_scripts/fuentes-cuadre.puerta2.js`
2. **El corte tiene que estar cerrado.** Los opens y clicks maduran ~3-7 días: redactar sobre un
   envío de anteayer produce un «bajó el engagement» que se desmiente solo la semana siguiente.
3. **Hay que saber qué NO está medido.** El CTOR de WhatsApp de Tercer Tiempo **no es un dato**:
   la fuente lo deriva de `Read × un CTOR asumido`. Se reconoce por `Clicks_Medidos = No`.
   Nunca se compara contra benchmark ni se reporta como resultado.

## Lo que el IQS calcula y tú no debes recalcular

| Palanca | Qué detecta |
|---|---|
| `asunto` | el OR está por debajo de **su propio mejor**, dentro de la misma campaña **y objetivo** |
| `clic` | el CTOR está por debajo del suyo: abren y no hacen clic |
| `fup` | el Follow Up abre mucho menos que su Principal |
| `qcart` | intención con **número Y porcentaje**, marcada como piso |
| `dispersion` | el CTOR abre ≥3× entre segmentos del mismo corte |
| `contradiccion` | uno lidera apertura y **otro** convierte: no se rankean |

Umbral **60**. Criterios: Cuantificado 25 · Comparado 20 · Accionable 25 · Material 20
(≥100k envíos o brecha ≥10pp) · No repetido 10. **Máximo 2 acciones por celda, y la segunda con
otra palanca** — si no, salían dos veces «subirle volumen a FamilyKids», una por journey.

Las claves (`asunto`, `clic`, `fup`, `dispersion`…) son **internas**: sirven para deduplicar y
diversificar. **Nunca se imprimen.**

## Cómo se redacta cada celda

Cuatro líneas, en este orden:

1. **Desempeño** — con sus touchpoints, y **siempre OR y CTOR**, nunca uno solo.
2. **Intención Qcart** — número **y** porcentaje (`$214,026 total · $16,687 Nestlé (7.8%) ·
   744 carritos`), o `Sin Qcart`. Nunca solo el %.
3. **Objetivos y panorama de clusters** — **todos** los clusters, no solo el mejor y el peor.
4. **Acción** — o `sin acción prioritaria`.

### La acción abre con un VERBO, no con una etiqueta

```
✗ CLIC (Purchase): CTOR 0.7% está 0.8pp bajo su mejor → un solo CTA
✓ Dejar un solo CTA arriba del fold en Purchase — su CTOR (0.7%) está 0.8pp abajo de su propio
  mejor (1.5%): abren pero no hacen clic
```

Estructura: `[verbo + qué hacer] — [evidencia con cifras]: [diagnóstico]`.
Acciones **numeradas** `1) 2)`, jamás separadas por `|`.

### Las cuatro que se rompen solas si no se vigilan

- ⛔ **Nunca comparar cruzando objetivos.** Inspiration abre naturalmente más que Purchase; medir
  un Purchase contra un Inspiration produce una brecha falsa y una acción sin sentido. El IQS ya
  solo busca baseline dentro de campaña **+** objetivo — no lo deshagas al redactar.
- ⛔ **Cuando OR y CTOR se contradicen, decirlo.** «X lidera apertura, Y convierte mejor.» Esa
  discrepancia **es** el insight; forzar un ranking la esconde.
- ⛔ **«Primera corrida» no es una acción.** Se dice honesto: no hay histórico contra qué medir,
  los números quedan de referencia. Y el baseline es **fallback**: si hay ≥1 acción real, se
  descarta — si no, salen juntas «Concentrar en Futboleros» y «todavía no hay acción».
- ⛔ **`Audiencias:`, nunca «audiencia única».** Si el segmento es multivalor (Antojo Infinito =
  `Career Focused, New Parents, Traditional Parents`) → `A + B + C (envío combinado, no
  separables)`.

## Dónde van

Hoy el `Report_Resumen` **no lleva columna de insights**: Rick la retiró el 20-ago-2026 y el
escritor la respeta. Este skill produce el texto; **dónde se pega es decisión suya**. No la
recrees en la hoja: la doctrina de escritura dice que la HOJA manda la forma.

## Al terminar

Deja el handoff del paso:
```bash
node ~/.claude/reportes-backend/nestle/_scripts/lib-handoff.js --paso G3
```

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
