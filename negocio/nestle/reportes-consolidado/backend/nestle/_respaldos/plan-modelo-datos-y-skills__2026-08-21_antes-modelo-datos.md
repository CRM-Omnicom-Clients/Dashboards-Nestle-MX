# Plan · el modelo de datos y la cadena de skills

> **Plan previo — no se ejecuta nada hasta tu visto bueno.**
> Sale de 22 decisiones que cerramos por escrito antes de planear, y de `M0-levantar-modelo.js`,
> que **midió** las relaciones reales en vez de suponerlas.
>
> **El objetivo:** que las hojas dejen de ser tablas sueltas y se comporten como una base de datos
> —entidades, llaves, relaciones declaradas— para que la atribución deje de depender de que yo
> «encuentre» el dato. Y que la cadena de skills dirija eso sola.

---

## Parte I · EL MODELO DE DATOS

### 1 · El árbol de entidades

```
CAMPAÑA  (9)                          ← raíz. Camp_ID: 001…009. Vocabulario CERRADO
   │
   └── PIEZA  (119)                    ← Pieza_ID: 004-P013. El correlativo vive DENTRO de la campaña
        │      Email_Name = llave natural ÚNICA  ✅ probado: 99 nombres, 99 distintos, 0 repetidos
        │      Email_Type: Principal · Follow Up · (N/A para WhatsApp)
        │      Pieza_Principal_ID → apunta a su Principal si es FUP; N/A si no lo es   🆕
        │
        ├── ENVÍO EMAIL      (1:1)     ← de SFMC. Sends, opens, clicks, unsubs, subject, audiencia
        ├── ENVÍO WHATSAPP   (1:1)     ← de la fuente WA. Sin Email_Name ni Subject → N/A
        │
        └── LINK QCART  (N)            ← shortlink_code. Pertenece a UNA pieza,
             │                            por tanto a UN touchpoint × UNA audiencia
             └── EVENTO QCART  (N)     ← carrito o producto. fecha ≥ activación del link
```

### 2 · Las llaves — quién identifica qué

| Nivel | Llave primaria | Llave natural | Llave foránea |
|---|---|---|---|
| Campaña | `Camp_ID` | `Campaña` (vocabulario cerrado) | — |
| **Pieza** | `Pieza_ID` | **`Email_Name`** (único 99/99) | `Camp_ID` · **`Pieza_Principal_ID`** 🆕 |
| Envío email | `Email_ID` (de la DE) | `Email_Name` | `Pieza_ID` |
| Link Qcart | `shortlink_code` | — | `Pieza_ID` |
| Evento Qcart | fecha+hora+código+tienda | — | `shortlink_code` → `Pieza_ID` |
| **Fila del reporte** | **`Campaña + TouchPoint + Segmento + Quincena_del_Principal`** | — | agrega N piezas |

🔴 **Por qué la quincena entra en la llave del reporte:** sin ella hay **13 colisiones** medidas.
`AON \| E-P4 \| Career Focused` existe en marzo **y** en abril: son oleadas distintas, con journeys
y `Email_Name` distintos. Es la misma lección que en julio nos costó destruir una fila tuya.

🔴 **Por qué `Pieza_Principal_ID` es indispensable:** el FUP sale en **otra quincena** que su
Principal (9 de 31 medidos), así que la quincena no puede estar en la llave que los empareja.
Deducirlo por dimensiones produce las 13 colisiones. **Declararlo una vez lo resuelve para siempre**,
y ningún skill vuelve a adivinar.

### 3 · El prefijo dimensional — las mismas columnas, en el mismo orden, en TODAS las hojas

```
 1 Campaña   2 Canal   3 Objetivo   4 TouchPoint   5 Segmento   6 Quincena
 7 Mes   8 Mes (#)   9 Marca   10 BU   11 Pieza_ID   12 Email_Name
```

Aplica a: `Report_Resumen` · `Catalogo_Piezas` · `Data_Email` · `Data_WhatsApp` ·
`Data_Qcart_Carritos` · `Data_Qcart_Productos` · `Catalogo_Referencias`.

Después del prefijo, cada hoja lleva **sus** columnas. Es desnormalización deliberada: se repite el
valor para que **cualquier lector reconozca la misma estructura en cualquier hoja**, sin cruzar nada.

> **Lo que hoy está roto y esto arregla:** `Campaña` y `Segmento` **no existen** en `Data_Email` ni
> en las hojas de Qcart. `Pieza_ID` vive en la columna E, AR, AF, A y A según la hoja.

### 4 · El grano de cada hoja — una fila es…

| Hoja | Una fila es | Filas hoy | Filas después |
|---|---|---|---|
| `Catalogo_Piezas` | **una pieza** (Principal y FUP van SEPARADOS) | 119 | 119 |
| `Data_Email` | una pieza con sus métricas | 98 | 98 |
| `Data_WhatsApp` | un envío de WA | 12 | 12 |
| `Data_Qcart_Carritos` | un evento carrito | 2,645 | 2,645 |
| `Data_Qcart_Productos` | un evento producto | 696 | 696 |
| `Report_Resumen` | **campaña × touchpoint × segmento × quincena**, con Principal y FUP **fusionados** | 86 | ~65 |
| `Catalogo_Referencias` | un mapeo crudo→canónico (vista del JSON) | 265 | 244 (−21 exclusiones) |

### 5 · Los tres estados de una celda — nunca vacía

| Marca | Significa | Ejemplo |
|---|---|---|
| **valor** | el dato | `Traditional Parents` |
| **`N/A`** | **no aplica** a esta fila por naturaleza | `Email_Name` en WhatsApp · `FUP_Sends` sin FUP · `Pieza_Principal_ID` en un Principal |
| **`PENDIENTE`** | **sí aplica y lo debemos** | un subject que SFMC todavía no entrega |

**Mejor práctica, y responde tu pregunta:** llenar *todo* lo vacío con `N/A` cierra el archivo pero
**borra la señal** de qué falta por conseguir. Con tres estados el archivo también queda al 100% sin
celdas vacías, y además **un guardián puede exigir que `PENDIENTE` tienda a cero** — que es la lista
de trabajo real. Meta del corte: **0 vacías, 0 PENDIENTE**.

---

## Parte II · LAS ETAPAS

> Cada sub-etapa dice **qué toca**, y cada etapa cierra con una **validación práctica y adversarial**:
> no «los checks pasan», sino «el caso de uso real atraviesa el sistema y no se rompe cuando lo ataco».

---

## ETAPA 0 · La fundación: el esquema declarado

| # | Sub-etapa | Qué hace | Qué toca |
|---|---|---|---|
| **0.1** | **`esquema.json`** | Declara el árbol: entidades, llaves primarias, naturales y foráneas, cardinalidades, y el grano de cada hoja. Es el «diccionario de datos» del sistema | `_contratos/esquema.json` (nuevo) |
| **0.2** | **El prefijo dimensional** | Declara las 12 columnas y su orden exacto, con su id lógico del registro | `esquema.json` · `lib-registro` |
| **0.3** | **Los tres estados** | Declara qué columna admite `N/A` y cuál no, y qué significa `PENDIENTE` en cada una | `esquema.json` |
| **0.4** | **`lib-esquema.js`** | La librería que lee el esquema: `prefijo()`, `llaveDe(hoja)`, `foraneas(hoja)`, `admiteNA(col)`. **Ningún skill vuelve a hardcodear una llave** | `_scripts/lib-esquema.js` (nuevo) |

**🔬 Validación adversarial de la Etapa 0:** escribir una consulta que, **usando solo el esquema**,
parta de un `shortlink_code` y llegue a la campaña cruzando evento → link → pieza → campaña; y otra
que parta de una fila del reporte y enumere las piezas que la componen. **Ataque:** meterle un
`Pieza_ID` inexistente y comprobar que **truena con mensaje claro** en vez de devolver vacío.

---

## ETAPA 1 · La cadena de skills

| # | Sub-etapa | Qué hace | Qué toca |
|---|---|---|---|
| **1.1** | 🔴 **Los 3 guardianes que truenan** | `guardian-catalogo`, `guardian-fuente-email` y `guardian-fuente-qcart` revientan en `xlsx-kit.js:50`. **Un guardián que truena no bloquea: da permiso.** Es lo más urgente del plan | `tools/reportes/*.js` |
| **1.2** | **Retirar lo muerto** | Guardianes y contratos de Campaña×Mes, Qcart Completo e Insights del sistema 2 → `_archivo-sistema2/` | `tools/reportes/` · `_orquesta/contratos-*/` |
| **1.3** | **La partitura del orquestador** | Su registro de pasos apunta a `N2a-email`, `N4-escribir`, `N6-resumen` — pasos que ya no existen. Se reescribe a los de hoy: `NC-email-piezas`, acumulador + `Z-escribir-todo`, `N5-motor` con F1, `N6r-regenerar` | `skills/rick-reportes-orquestador/SKILL.md` |
| **1.4** | 🔴 **Contrato de ESCRITURA por fuente** | Hoy cada skill sabe de dónde LEE pero no a dónde ESCRIBE. Cada uno declara, **antes de escribir**: hoja · grano · columnas (por id lógico) · llave · ancla · **qué NO toca** | `contrato-fuente-*.md` |
| **1.5** | 🔴 **La pre-escritura** | Cada skill de fuente produce **su tabla ya con la forma de la hoja destino** (mismo orden de columnas, mismos nombres) en `_preescritura/<fuente>.json` + un `.md` legible. El escritor **transcribe**, no interpreta | `_preescritura/` (nuevo) · los 4 skills de fuente |
| **1.6** | **El auditor en verde** | `auditar-agentes.js` hoy **FALLA**. Debe pasar: es el guardián del sistema mismo | `tools/reportes/auditar-agentes.js` |

**🔬 Validación adversarial de la Etapa 1:** correr el orquestador sobre el corte de agosto y que
**reproduzca los números de hoy sin que yo prenda un script**. **Ataques:** (a) romper a propósito
un guardián y comprobar que el paso **no cierra**; (b) meter una campaña inventada y ver que el
vocabulario cerrado **truena**; (c) declarar en un contrato una columna que no existe y ver que el
escritor **se niega antes de tocar el archivo**.

---

## ETAPA 2 · El catálogo — la tabla maestra

| # | Sub-etapa | Qué hace | Qué toca |
|---|---|---|---|
| **2.1** | **Referencias: JSON autoridad, hoja vista** | Los skills leen **solo** `_contratos/normalizacion.json`. La hoja se conserva como tu tablero. **Guardián que BLOQUEA si hoja y JSON difieren** — así el skill nunca elige entre dos catálogos | `normalizacion.json` (nuevo) · `Catalogo_Referencias` |
| **2.2** | **Exclusiones a su contrato** | Las 21 filas de «excluido» (16 links, 3 touchpoints, 2 tiendas) **no son referencias, son decisiones**. Salen a `exclusiones.json` con motivo y fecha. Guardián: toda exclusión con motivo escrito | `exclusiones.json` (nuevo) |
| **2.3** | **Las 34 filas 1:1 → columnas** | Las referencias que pertenecen a **una sola pieza** pasan a columnas de `Catalogo_Piezas`, junto a su pieza. Las 178 N:M **no** (repetirlas 77 veces destruiría el único lugar donde corregirlas) | `Catalogo_Piezas` |
| **2.4** | 🔴 **`Pieza_Principal_ID`** | Columna nueva: cada FUP declara su Principal. **N/A en todo lo que no sea FUP.** Se deriva del emparejamiento actual y **se verifica una por una** contra SFMC | `Catalogo_Piezas` |
| **2.5** | **Subject al catálogo** | Una columna `Subject` por pieza, desde SFMC (autoridad). Es la causa raíz de los errores que viste | `Catalogo_Piezas` |
| **2.6** | **Email_Name y Email_ID desde SFMC** | SFMC manda siempre. Se sobrescribe lo que no coincida y **cada diferencia queda declarada** en un JSON de evidencia para que la revises | `Catalogo_Piezas` |
| **2.7** | 🔴 **Qcart por audiencia × touchpoint** | Hoy los códigos viven en `Cod_Walmart_1..5` sin decir a qué audiencia pertenecen. Como **cada pieza ya es un touchpoint × audiencia** y tiene su `Email_Name` único, el código hereda esa identidad. Se declara explícitamente en el catálogo | `Catalogo_Piezas` |
| **2.8** | **Los segmentos nuevos** | `App` → «Usuarios activos sin click en App» · `Prop` → «Usuarios re-enganchables: nuevos del último año que nunca han interactuado». Nombre completo, **todo en español** | `Catalogo_Piezas` · `vocabulario.json` |
| **2.9** | **N/A y PENDIENTE** | Las 33 columnas con +60 vacíos se clasifican: no aplica → `N/A`; aplica y falta → `PENDIENTE` con su fuente. **Meta: 0 vacías** | `Catalogo_Piezas` |
| **2.10** | **Reordenar al prefijo** | Las 12 columnas del prefijo al inicio, en orden. El resto detrás | `Catalogo_Piezas` |
| **2.11** | **`Canal` en vez de `Medio`** | Un solo nombre para el mismo dato, en todas las hojas. El registro absorbe el renombre | todas |

**🔬 Validación adversarial de la Etapa 2:** tomar **3 piezas al azar** y recorrerlas de punta a
punta: catálogo → SFMC → links Qcart → eventos → fila del reporte, y comprobar que **todo coincide**.
**Ataques:** (a) renombrar una pieza y ver que el sistema **no se rompe** (el `Pieza_ID` es el ancla);
(b) borrar un `Pieza_Principal_ID` y ver que el guardián **detecta el FUP huérfano**; (c) meter un
alias contradictorio en la hoja y comprobar que el guardián **bloquea** por diferir del JSON.

---

## ETAPA 3 · Las fuentes y sus hojas de datos

| # | Sub-etapa | Qué hace | Qué toca |
|---|---|---|---|
| **3.1** | 🔴 **La quincena, una sola regla** | **Día 1–15 = Q1 · 16–fin de mes = Q2**, aplicada igual en email, WhatsApp y Qcart. Hoy hay envíos de agosto mal asignados | `lib-quincena` · las 3 fuentes |
| **3.2** | **Prefijo en `Data_Email`** | Agregar Campaña, Canal, Objetivo, TouchPoint, Segmento, Quincena, Mes, Mes(#) — hoy **no las tiene** | `Data_Email` |
| **3.3** | **Prefijo en `Data_WhatsApp`** | Completar y reordenar | `Data_WhatsApp` |
| **3.4** | **Prefijo en las 2 de Qcart** | Agregar el prefijo a 2,645 + 696 filas de eventos | `Data_Qcart_*` |
| **3.5** | **Eliminar las 2 `Soporte_IA_*`** | 0 fórmulas las citan. **Respaldo al backend antes de borrar** | el libro |
| **3.6** | **Proceso de llenado: atribuir → organizar → llenar** | Cada skill de fuente ejecuta las tres fases **en ese orden**, y la salida de cada una queda escrita. Hoy varios «llenan» antes de atribuir | los 4 skills de fuente |

**🔬 Validación adversarial de la Etapa 3:** meter un envío nuevo ficticio del **16 de agosto** y
comprobar que cae en **Ago-Q2**; y uno del 15 que caiga en **Q1**. **Ataques:** (a) un evento de
Qcart cuyo link no está en la autoridad → **excluido y declarado**; (b) un envío sin pieza →
**se detiene**, no se inventa; (c) correr la carga **dos veces** y comprobar que ninguna cifra se mueve.

---

## ETAPA 4 · El reporte resumen

| # | Sub-etapa | Qué hace | Qué toca |
|---|---|---|---|
| **4.1** | 🔴 **La llave con quincena** | `Campaña + TouchPoint + Segmento + Quincena_del_Principal`. Las oleadas de AON quedan como **filas distintas** | `N5-motor` · `N6r` |
| **4.2** | 🔴 **Principal y FUP en una fila** | Se fusionan por `Pieza_Principal_ID`. Las ~10 filas «Tipo Email = FUP» **desaparecen** y su dato pasa a las columnas FUP de su Principal. **Σ Sends no cambia** | `N5-motor` · `N6r` |
| **4.3** | **Fuera `Tipo Email`** · **`Medio`→`Canal`** | La columna deja de significar algo al fusionar | `Report_Resumen` |
| **4.4** | **`FUP_Quincena`** | Columna nueva en el bloque FUP: en qué quincena salió el seguimiento (9 de 31 difieren del Principal) | `Report_Resumen` |
| **4.5** | **Llenar Email_Name / Email_ID / Subject** | Principal **y** FUP. Hoy las columnas existen pero están **en 0** | `Report_Resumen` |
| **4.6** | **Qcart del FUP al Principal** | Los carritos que llegaron por un link del FUP suman al Principal, **y queda declarado que vinieron vía FUP** | `N5-motor` |
| **4.7** | **N/A donde no aplica** | Sin FUP → las 11 columnas FUP dicen `N/A`. WhatsApp → `N/A` en Email_Name, Subject y FUP | `N6r` |
| **4.8** | **Programadas fuera** | Las 3 piezas de Liga MX sin correo **no entran** al reporte; viven en el catálogo con su Estado | `N5-motor` |

**🔬 Validación adversarial de la Etapa 4:** **la Puerta 2 tiene que seguir abriendo**
(email 7,282,486 · WhatsApp 14,643 · Qcart 2,645) **después de fusionar** — si el total cambia, la
fusión perdió o duplicó datos. **Ataques:** (a) contar Σ Principal_Sends + Σ FUP_Sends y comprobar
que da **exactamente** el total de `Data_Email`; (b) buscar un `Email_Name` repetido en dos filas
(sería doble conteo); (c) comprobar que **ninguna campaña** tiene su Qcart colapsado en una sola
celda (el defecto F1, que cuadra igual y por eso ninguna puerta lo ve).

---

## ETAPA 5 · Cierre

| # | Sub-etapa | Qué hace |
|---|---|---|
| **5.1** | **Refutador** | Un pase que intenta **demostrar que el reporte está mal**, no confirmarlo |
| **5.2** | **Puertas 1 y 2** | Bloques vs catálogo, y reporte vs rejilla vs bloques |
| **5.3** | **Las 5 capas + MIRAR EL RENDER** | Es lo que rompe los círculos: `Data_WhatsApp` pasó 19 checks en verde con 14 de 26 envíos mal |
| **5.4** | **E2E dirigido por el skill** | El corte completo corrido por el orquestador, **sin que yo intervenga**. Ese es el 100% |
| **5.5** | **Handoff, memoria y commit** | Lo aprendido a memoria; el esquema al artifact; commit por etapa |

---

## Orden y dependencias

```
ETAPA 0  esquema declarado          ← todo lo demás lo usa
   ↓
ETAPA 1  cadena de skills           ← 1.1 (guardianes rotos) es lo más urgente
   ↓
ETAPA 2  catálogo                   ← la tabla maestra: el reporte se deriva de ella
   ↓
ETAPA 3  fuentes y datos            ← ya con el catálogo bueno
   ↓
ETAPA 4  reporte                    ← lo último que se toca
   ↓
ETAPA 5  cierre adversarial
```

**Escritura:** cada etapa acumula sus cambios y **escribe una sola vez** al final de la etapa, con
respaldo antes y las 5 capas después. Trabajamos **en el archivo vivo**.

## Lo que NO se toca

- **`Reporte_julio`** — se queda como histórico, ni una celda.
- **La fila de totales** — siempre al final, con sus rangos completos.
- **Los filtros y el formato fino** — los pones tú.
- **SFMC** — solo lectura, siempre.
- **Producción** — no se publica sin tu OK.

---

## Las 22 decisiones que cierran las ambigüedades

| # | Decisión |
|---|---|
| 1 | Prefijo dimensional idéntico en las 6 hojas + Referencias |
| 2 | Llave del reporte = Campaña + TouchPoint + Segmento + **Quincena del Principal** |
| 3 | Las oleadas son **filas distintas** |
| 4 | `Tipo Email` se elimina del reporte, **se queda en el catálogo** |
| 5 | **`Pieza_Principal_ID`** = llave foránea FUP→Principal · **N/A** si no es FUP |
| 6 | **`Canal`** gana sobre `Medio`, en todas las hojas |
| 7 | Desnormalizar: prefijo completo en todas |
| 8 | Referencias: **JSON autoridad · hoja vista · guardián que bloquea** |
| 9 | Puente Referencias↔Piezas: `Pieza_IDs` + `Dimension` + `Valor_Canonico` + prefijo |
| 10 | Exclusiones → **contrato propio** |
| 11 | **SFMC manda** en Email_Name, Email_ID y Subject |
| 12 | `Email_Name` es llave natural **única** (99/99 probado) |
| 13 | Qcart por audiencia × touchpoint **también en el catálogo** |
| 14 | Qcart del FUP **suma al Principal**, declarado |
| 15 | Quincena: **1–15 = Q1 · 16–fin = Q2**, en todas las fuentes |
| 16 | Segmentos con **nombre completo, en español** |
| 17 | Tres estados: valor · `N/A` (no aplica) · `PENDIENTE` (falta) · **0 vacías** |
| 18 | Sin FUP → las 11 columnas FUP en **`N/A`** |
| 19 | Piezas **programadas** solo en el catálogo |
| 20 | WhatsApp: mismas columnas, **N/A** donde no aplica |
| 21 | Se eliminan **solo** las 2 hojas `Soporte_IA_*`; **julio se queda** |
| 22 | `FUP_Quincena` la agrego yo · **los filtros los pones tú** |
