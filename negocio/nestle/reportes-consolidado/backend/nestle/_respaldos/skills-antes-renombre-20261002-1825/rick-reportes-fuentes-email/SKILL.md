---
name: crm-reporte-fuentes-email
description: Arma el bloque de envíos de email en el backend — lo que ya está se actualiza, lo nuevo se agrega, nada se borra. La fuente de verdad es el MCP de SFMC (DE `CRM_Email_Detalle`); Datorama quedó como referencia. Úsalo cuando haya datos de email que cargar.
---

# email-bloque · Bloque Email

<!--@DECLARACION-->
## 🔴 Lo que este skill lee, lo que lo vigila y lo que le exigen

> Este bloque **se genera** desde el estado real del sistema con
> `orquestador.declarar-en-skills.js`. No se edita a mano: un bloque escrito a mano se
> desfasa en cuanto cambia una guarda — que es justo lo que le pasó al mapa de la cadena.

**Su turno:** etapa 5   ·   **2 script(s) de ejecución**

**Contratos que lee**

- `_contratos/cadena-skills.json`
- `_contratos/entorno.json`
- `_contratos/esquema.json`
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

## 🔴 LA FUENTE ES SFMC (desde 20-ago-2026)

**Datorama ya no es la fuente: es referencia.** Donde difieran, **manda SFMC**.

| Qué | Dónde |
|---|---|
| Tabla de hechos | DE **`CRM_Email_Detalle`** (BU `NMX - Nestle Mexico`) |
| Spec completo | `…/Marcas/CRM General/FUENTE-EMAIL-SFMC.md` |
| El puente al catálogo | **`ConfigKey` === `Pieza_ID`** (`001-P003`). Cruce directo, sin fuzzy |
| Constructor del bloque | `orquestador.nb-email-sfmc.js` → `_fuentes/email.json` (mismo contrato de siempre) |

### Las reglas que no cambian
- **El grano de la DE es JobID × DÍA.** Una pieza que salió 5 días son 5 filas. Se agrega por
  `ConfigKey + Es_FUP`, porque el reporte separa Principal de FUP.
- **Las tasas NUNCA se promedian ni se cargan.** El motor las recalcula desde los conteos.
  Promediar el `Open_Rate` de 5 filas da un número que no existe.
- **Fecha ancla = mín(SendDay) de la pieza.** Nunca la del journey. Si la fuente no trae día pero
  el catálogo declara la quincena, se usa **la quincena declarada** — eso no es inventar, es leer
  lo que ya estaba escrito. Lo que sí sería inventar es ponerle un día.
- **Los dos identificadores son DOS cosas:** `EmailName` = la cadena completa que viene de la DE ·
  `Content_ID` = **el segmento final** de esa cadena. **Ninguno viene del journey.**

### 🔴 Un fetch grande NUNCA entra al contexto
`sfmc_get_de_rows` sobre `CRM_Email_Detalle` devuelve ~240 KB: **rebasa el límite y se persiste
solo a disco**. Se procesa con script desde `_insumos/sfmc-email-detalle.json`. Leer el crudo cuesta
más que toda la corrida. Ver `~/.claude/rick-reportes/doctrina-de-escritura.md`, regla 5.

### Lo que SFMC no da, y hay que saberlo
Los **blast de journey** no salen por `sfmc_list_sends` (el objeto Send no los expone; ahí solo se
ven los envíos de prueba con `sent:1`). Se leen por **`sfmc_get_send_metrics` con el jobId**, que se
obtiene del `RowKey` de la DE (`JobID_YYYYMMDD`). Así se recuperaron los 9 correos de Pro Plan E3.


Segundo paso del ciclo. Armas el bloque de envíos **en el backend**. La puerta 1 lo escribirá
después, junto con los otros bloques, en una sola pasada.

```bash
node ~/.claude/reportes-backend/nestle/_scripts/fuentes-insumos.insumos.js --corte WK33   # primero insumos-validar
node ~/.claude/reportes-backend/nestle/_scripts/email-bloque-email.js                 # el bloque
node ~/.claude/reportes-backend/nestle/_scripts/email-bloque-99-validar.js            # ¿migró bien?
node ~/.claude/reportes-backend/nestle/_scripts/email-bloque-98-simular-siguiente.js  # ¿le sirve al siguiente?
node ~/.claude/reportes-backend/nestle/_scripts/email-bloque-97-refutar.js            # ¿puedo romperlo?
node ~/.claude/reportes-backend/nestle/_scripts/email-bloque-96-simular-nuevo.js      # los caminos que el corte NO ejercita
```

## 🔴 Corre el 96 aunque todo esté verde

`nuevos = 0` en un corte significa que **el camino de incorporación no se ejecutó ni una vez**.
Ahí vivía el defecto de fondo: los nuevos se contaban y el bloque era `E.map(...)` —solo lo ya
cargado—, o sea que el script cuyo trabajo es *«lo nuevo se agrega»* **no agregaba lo nuevo**, y
las 11 validaciones daban verde. El 96 altera el export y corre **el email-bloque de verdad** contra él.

⚠ Un check que no se ejecuta no prueba nada, y **no se distingue de uno que pasa**. La primera
versión del 96 eligió una víctima que no estaba en la hoja: no imprimió nada y el veredicto
salió verde igual. Si una prueba no se puede montar, **aborta**; no la dejes pasar en silencio.

## No haces

- **No tocas Qcart ni WhatsApp.** Cada fuente tiene su bloque.
- **No tocas el catálogo ni los reportes.**
- 🔴 **No escribes en el Excel.** Ni una celda. Eso es la puerta 1 — y es un **cambio de diseño**:
  el agente viejo sí escribía `Data_Email` directo.
- **No corriges el contrato.** Si discrepa de la realidad, **gana la realidad** y lo reportas.

## ⚡ Consumes el handoff de insumos-validar — no re-derivas

insumos-validar ya midió qué archivo usar, su sello, cuántas hojas trae y si el esquema es uniforme.
**No vuelvas a inventariar la carpeta ni a buscar el encabezado.**

**Verificas UNA cifra** (el sello del archivo contra el que dice el handoff). Si cuadra, arrancas.
Si **no** cuadra, **paras todo**: una medición mala envenena el script entero.

## 🔴 Las tres clases de columna — y una no se toca

Del `contrato-fuente-email`. Se detectan **escaneando la columna completa**, nunca con una lista
fija de letras (el esquema crece y las letras se corren) **ni mirando solo la fila 2**.

| Clase | Qué es | Regla |
|---|---|---|
| **crudo** | lo que entrega la fuente | se escribe tal cual, **nunca se corrige** |
| 🔒 **fórmula** | `BU_Canonico` · `Marca` · `Campana_Canonica` · `Segmento_Canonico` | ⛔ **NO se sobrescriben.** Hacen lookup vivo al catálogo: escribir texto encima **mata el vínculo** |
| **derivada** | mes · quincena · semana · `Email_Type` | las calcula este paso desde la fecha |

⚠ Las de fórmula están **intercaladas** entre las crudas, no al final.

### 🔴 Y ninguna de las cuatro es una columna de fórmula: son MIXTAS

| Columna | fórmula | **a mano** |
|---|---|---|
| BU_Canonico | 263 | 1 |
| Marca | 263 | 1 |
| Campana_Canonica | 182 | **82** |
| Segmento_Canonico | 71 | **193** |

**277 celdas están escritas a mano.** Mirar la fila 2 decía «columna de fórmula» de una columna
que es 73% texto manual. Una puerta que se lo creyera y *restaurara la fórmula en la columna*
borraría las 277 — y como sus valores crudos (`Interés Salado`, `Premium`,
`Gen Z Indulgentes`) **no están en `Catalog_Campanas`**, la fórmula devolvería `""` y quedarían
vacías para siempre.

⛔ **Se escribe celda por celda, nunca por columna.** El bloque publica `clases_de_columna` y
`celdas_escritas_a_mano` para que la puerta lo sepa sin volver a medirlo.

## 🔴 La llave: el contrato dice una cosa y la realidad otra

El contrato pide `Journey_ID + Segment + Touchpoint + Email_Type + Version`.
**Gana la realidad**, y se reporta sin corregir el contrato:

```
Journey_ID está contaminado: 58 de 264 filas traen el asset_id, no el journey
  → con esa llave: 29 colisiones
✔ cola(55) del content_name + fecha
  → 264 llaves para 264 filas, 0 colisiones
```

⛔ **Nunca cruzar por el content_name entero**: cambia de prefijo entre cortes y las filas de
refresh parecen nuevas. Ya pasó: de 16 "nuevas por content", 7 eran duplicados.

## 🔴 El diff tiene que SUMAR — y los nuevos van en la suma

```
idénticos + crecieron + sin pareja + nuevos = total
    244    +     3    +     17     +   0    = 264 ✔
```

Sin la categoría **sin pareja**, 17 envíos quedaban invisibles — no mal, sino *sin contar*. Un
envío que el export vigente ya no trae **se conserva y se declara**; nunca se borra ni se omite.

⚠ Y sin **nuevos** en la suma, el cuadre daba verde dejando envíos fuera del bloque. Con
`nuevos = 0` las dos fórmulas dan lo mismo: por eso el fallo era invisible.

## 🔴 Qué hace falta para incorporar un envío nuevo — y por qué nunca alcanza

Las 4 fórmulas vivas cruzan por **dos columnas crudas**, no por el content_name:

```
BU / Marca / Campana_Canonica  →  MATCH($B, Catalog_Campanas!$D)   $B = Campaign
Segmento_Canonico              →  MATCH($D, Catalog_Campanas!$G)   $D = Segment
```

Y el export **no entrega ninguna de las dos en forma usable**:

| | la hoja tiene | el export trae |
|---|---|---|
| `Campaign` | 20 valores catalogados | `CRM-AON-Recestas Nestlé-2026` · `N/A` · `Maggi SNM LMX` — **ninguno matchea** |
| `Segment` | Career Focused, … | **no existe**; solo `Audience Name` = `All Subscribers` en **955 de 955** |

Por eso un envío nuevo **nunca se escribe solo**, y el bloque lo gradúa en vez de tratar los dos
casos igual:

| Gravedad | Qué falta | Cómo se resuelve |
|---|---|---|
| **MUERTA** | `Campaign` sin catalogar | se da de alta en `Catalog_Campanas` — es catalogar |
| **PARCIAL** | `Segment` | **lo decide un humano**: el dato no existe en ninguna fuente |

Se propone `candidato_campaign` (el propio content_name — así se incorporaron 5 campañas antes)
pero **no se asigna**. Forzar la ambigua es el error que ya movió 186 carritos.

🔴 **Esto confirma que el catálogo va ANTES del primer ciclo de escritura**, no después.

## Email_Type: se deriva, y por eso hay que tener cuidado

La fuente no lo entrega. El marcador tiene **dos formas**: 112 envíos dicen `FUP` y **uno dice
`FP`** (`…TRADITIONAL-PARENTS-FP_AC_EM_A_V1_803867`). Con solo `FUP`, ese envío se clasificaba
Principal y entraba a la banda equivocada. `D.tipoEmail()` cubre las dos — probado 264/264.

⚠ Deriva un **marcador técnico**, no una regla de negocio. Campaña, objetivo y segmento **no se
derivan del nombre jamás**.

## Refresh monótono

Las métricas **acumulan**: opens y clicks siguen subiendo días después. El refresh es **MAX por
llave**, nunca sobrescritura. Pero el engagement madura en pocos días — **diffea envío por envío**,
no asumas ni que creció ni que no.

## 🔴 Atribuir envío → pieza: cascada, nunca una sola variable

El catálogo tiene **6 piezas que reclaman content_names ajenos** (`DEF-N1-001`): 8 envíos caen
en 2 piezas. Un cruce ingenuo `mapa[cn] = pieza_id` **machaca en silencio** — la última gana — y
el check daba un tranquilizador 264/264.

```
1 · content_name canónico          248
2 · canónico + sends                 2
3 · variante única                  12
4 · variante + sends                 0
    AMBIGUA → se declara con candidatas   2   ⛔ no se fuerza
```

⚠ **Las cifras del catálogo están bien** (Σ catálogo == Σ Data_Email, 0 huérfanos). Lo inflado
son las **listas**. Por eso las 8 suites de insumos-validar no lo vieron: validan agregados, y los agregados
cuadran. Solo aparece cruzando envío contra pieza — o sea, **desde el paso siguiente**.

## Los dos catálogos que hoy conviven

| | Alimenta | Ojo |
|---|---|---|
| `Catalog_Campanas` | las **fórmulas vivas** de Data_Email | es la que decide si una fila nace muerta |
| `Catalogo_Referencias` | la escalera de alias de insumos-validar | **no resuelve 18 de las 20** campañas de la otra |

Este paso mide contra la **primera** —la que de verdad decide— y **reporta la divergencia**. Si
midiera contra la de insumos-validar avisaría de un problema inexistente y callaría el real.

## DoD — cierras cuando

1. La cifra de control del handoff **cuadra** contra el archivo.
2. **El diff suma**: idénticos + crecieron + sin pareja + nuevos == total del bloque.
3. Cada envío tiene su `Email_Type` (`Principal` / `Follow Up`) — **la fuente no la entrega, la
   derivas tú**. Sin ella el envío se suma dos veces o desaparece de los reportes.
4. Toda fila tiene campaña. Sin ella **la fila queda muerta**: no entra a ningún reporte.
5. Las columnas con **fórmula viva quedan identificadas** y marcadas como intocables.
6. Ningún `journey_id` en conflicto queda sin resolver por regla o sin declarar.
7. **El Excel no se tocó.** Compruébalo por `mtime`.

## para_el_siguiente

| Campo | Para quién |
|---|---|
| `envios[]` con sus métricas | **PUERTA-1** cruza contra el catálogo |
| `columnas_con_formula` | **N3** sabe qué NO sobrescribir |
| `auditoria.cuadre_del_diff` | **PUERTA-1** comprueba que nada se perdió |
| `discrepancia_con_el_contrato` | el orquestador decide si el contrato se actualiza |

| `clases_de_columna` + `celdas_escritas_a_mano` | **N3** escribe celda por celda, no por columna |
| `vocabulario_nuevo` | **el catálogo**, ANTES de la primera escritura |
| `divergencia_entre_catalogos` | el orquestador, para saber si los dos catálogos se separaron |

**Probado** (`N2a-98-simular-siguiente.js`): 262 envíos atribuidos por cascada + 2 ambiguos
declarados, la Σ cuadra con el catálogo, las 4 columnas siguen vivas y la puerta sabe que 277
celdas son manuales.

## Rúbrica — umbral ≥4

| Dimensión | 1 | 3 | 5 |
|---|---|---|---|
| **Cuadre** | diste el total | diste el total y el delta | el diff suma y cada categoría tiene su cifra |
| **Trazabilidad** | cargaste | dijiste de qué archivo | cada envío cita su fuente, su llave y por qué ganó el valor que ganó |
| **Respeto a lo que había** | sobrescribiste | conservaste | detectaste las fórmulas vivas, conservaste lo sin pareja, y declaraste cada conflicto |

## Lee cuando toca

| Cuándo | Qué |
|---|---|
| antes de la primera escritura | `~/.claude/rick-reportes/editar-xlsx-sin-romper.md` |
| antes de escribir una fecha | `~/.claude/rick-reportes/fechas.md` |
| antes de declarar el script cerrado | `~/.claude/rick-reportes/validar-sin-enganarse.md` |
| decisiones abiertas | `_catalogo/decisiones-pendientes.json` |

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

*Los envíos de email. Autoridad: la DE de SFMC (CRM_Email_Piezas), cruce por ContentName.*

### → `Data_Email`

| | |
|---|---|
| **Grano** | una fila = UNA PIEZA (98). No día de envío: la fuente entrega por pieza. |
| **Llave** | `Pieza_ID` |
| **NO toca** | las 4 columnas canónicas escritas a mano por Rick — 277 celdas |

### → `Report_Resumen`

| | |
|---|---|
| **Grano** | campaña × touchpoint × segmento × quincena — Principal y FUP FUSIONADOS en la misma fila |
| **Llave** | `la misma fila que define el catálogo` |
| **Ancla** | el FUP se pega a la fila de su Principal por Pieza_Principal_ID, aunque haya salido en otra quincena |
| **Columnas suyas** | 26: `Email Name SFMC_Principal` · `Principal_Subject` · `Principal_Sends` · `Principal_Deliveries` · `Principal_Opens` · `Principal_Clicks` · `Email Name SFMC_FUP` · `FUP_Subject` · `FUP_Sends` · `FUP_Deliveries` · `FUP_Opens` · `FUP_Clicks` · `Tot_Sends` · `Tot_Deliveries` · `Tot_Opens` · `Tot_Clicks` · `Unsubs_Unicos` · `Audiencia_DE SFMC` · `Audiencia_Volumen SFMC` · `Clicks_Unicos_Total` · `Clicks_Qcart` · `Clicks_App` · `Clicks_Social` · `Clicks_Web` · `Clicks_Ver_Navegador` · `Clicks_Unsub` |
| **NO toca** | las columnas WA-* · las columnas de Qcart |

**El orden es: atribuir → organizar → llenar.** No se escribe nada que no se haya atribuido
primero: llenar antes de atribuir es como un dato acaba en la fila equivocada.

Se verifica con `node ~/.claude/reportes-backend/nestle/_scripts/E1-4-contrato-escritura.js`

<!-- CONTRATO-ESCRITURA:FIN -->
