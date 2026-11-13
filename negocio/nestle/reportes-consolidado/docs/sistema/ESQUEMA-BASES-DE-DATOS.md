# ESQUEMA DE BASES DE DATOS: Reporte Consolidado NMX

> Esquemas extraídos directamente de TD. Última verificación: 2026-11-13.
> Para el flujo del pipeline, ver `ARQUITECTURA.md`. Para correr, ver `OPERACIONES.md`.

---

## Mapa de bases de datos

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     4 bases de datos en Treasure Data                      │
│                                                                            │
│  nmx_insumos          nmx_catalogo          nmx_hechos       nmx_reportes  │
│  ─────────────        ────────────          ──────────       ────────────  │
│  (landing zone)   →   (dimensiones)    →    (facts)      →   (reportes)   │
│  tablas land_*        tablas dim_*          tablas fact_*     tablas rpt_* │
│  + sync_markers       + tabla_piezas                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. nmx_insumos — Landing zone

Recibe archivos crudos. No tiene pieza_id resuelto (solo nombres, shortlinks, vocabularios).

### 1.1 Diagrama de tablas

```
nmx_insumos
│
├── land_piezas            ← catálogo de piezas (nombres, BU, tipo, etc.)
├── land_nombres           ← mapping nombre_unico → pieza_id (Email + WA)
├── land_shortlinks        ← mapping shortlink → pieza_id (Qcart)
├── land_pieza_segmento    ← bridge pieza ↔ segmento
│
├── land_vocab_bu          ← vocabulario controlado: BUs
├── land_vocab_marcas      ← vocabulario controlado: Marcas
├── land_vocab_campanas    ← vocabulario controlado: Campañas
├── land_vocab_objetivos   ← vocabulario controlado: Objetivos
├── land_vocab_segmentos   ← vocabulario controlado: Segmentos
├── land_vocab_touchpoints_brief  ← vocabulario controlado: Touchpoints
│
├── land_wa_envios         ← métricas de envíos WA (por quincena)
├── land_qcart_carritos    ← eventos de carrito Qcart (raw, ~71K filas)
├── land_qcart_productos   ← eventos de producto Qcart (raw)
│
└── sync_markers           ← tabla de control: SHA GitHub por archivo
```

### 1.2 Esquemas por tabla

**land_piezas** — catálogo operativo de piezas
```
pieza_id            VARCHAR   PK lógico  ej. "RN-P001", "005-P012"
canal               VARCHAR              "Email" | "WhatsApp" | "Qcart"
email_type          VARCHAR              "Principal" | "Follow Up" | "Envío Único"
tipo_envio          VARCHAR              "always-on" | "one-shot"
campana_nombre      VARCHAR              nombre textual (denormalizado)
marca_nombre        VARCHAR              nombre textual (denormalizado)
bu_nombre           VARCHAR              nombre textual (denormalizado)
objetivo_nombre     VARCHAR              nombre textual (denormalizado)
touchpoint_brief    VARCHAR              ej. "E-P1", "WA-C1"
pieza_principal_id  VARCHAR   FK→self    NULL para Principals; pieza padre para FUPs
fecha_primer_envio  VARCHAR
estado              VARCHAR              "activa" | "inactiva"
notas               VARCHAR
time                BIGINT               timestamp de carga (UNIX)
```

**land_nombres** — clave de atribución Email + WA
```
nombre_unico  VARCHAR   PK lógico  nombre exacto en SFMC/Twilio
pieza_id      VARCHAR   FK→pieza   pieza asignada a este nombre
canal         VARCHAR              "Email" | "WhatsApp"
time          BIGINT
```

**land_shortlinks** — clave de atribución Qcart
```
shortlink         VARCHAR   PK lógico  ej. "nMo8xFmB"
fecha_activacion  VARCHAR              fecha desde la que cuenta (YYYY-MM-DD)
pieza_nombre      VARCHAR              nombre descriptivo
pieza_id          VARCHAR   FK→pieza
tienda            VARCHAR              "walmart" | "chedraui" | null
receta            VARCHAR              nombre de receta ligada
url_receta        VARCHAR
estado_link       VARCHAR              "activo" | "inactivo"
nota              VARCHAR
time              BIGINT
```

**land_wa_envios** — métricas de WhatsApp
```
nombre_wa      VARCHAR   PK lógico  nombre del journey WA
send_date      VARCHAR              fecha del envío
quincena       VARCHAR              ej. "2026-10-Q2"
mes            VARCHAR              ej. "2026-10"
sends          BIGINT
deliveries     BIGINT
opens_read     BIGINT
clicks         BIGINT
errores        BIGINT
no_entregados  BIGINT
time           BIGINT
```

**land_qcart_carritos** — eventos de carrito (raw ~71K filas)
```
fecha_hora         VARCHAR   "YYYY-MM-DDTHH:MM:SS"
shortlink_code     VARCHAR   FK→shortlink (clave de atribución)
shortlink_name     VARCHAR
utm_campaign       VARCHAR
utm_medium         VARCHAR
utm_source         VARCHAR
utm_content        VARCHAR
utm_term           VARCHAR
ads_platform       VARCHAR
store              VARCHAR   "walmart-com-mx" | "chedraui-com-mx" | combinado
impressions        BIGINT    vistas del carrito
views              BIGINT    sesiones de carrito (la métrica principal)
total_shown_price  DOUBLE    precio acumulado de productos mostrados ($MXN)
time               BIGINT
```

**land_qcart_productos** — eventos de producto (raw)
```
fecha_hora         VARCHAR
shortlink_code     VARCHAR   FK→shortlink
shortlink_name     VARCHAR
utm_*              VARCHAR   (5 campos UTM)
ads_platform       VARCHAR
product            VARCHAR   nombre del producto (SKU textual)
brand              VARCHAR   "maggi" | "nescafe" | "abuelita" | etc.
store              VARCHAR
impressions        BIGINT
views              BIGINT    impresiones del producto
total_shown_price  DOUBLE
time               BIGINT
```

**sync_markers** — tabla de control del landing autónomo
```
path       VARCHAR   PK lógico  ruta del archivo en GitHub
blob_sha   VARCHAR              SHA-1 del contenido actual
loader     VARCHAR              "catalogo" | "wa" | "qcart"
loaded_at  VARCHAR              timestamp ISO de la última carga
time       BIGINT
```

---

## 2. nmx_catalogo — Dimensiones aprobadas

Resuelve nombres a IDs. `catalogo.dig` reconstruye esta DB desde `nmx_insumos`.

### 2.1 Diagrama de relaciones

```
nmx_catalogo
│
│  ┌─────────┐    ┌──────────┐    ┌─────────────┐    ┌───────────┐
│  │ dim_bu  │◄───│ dim_marca│    │ dim_campana │    │dim_objetivo│
│  │  bu_id  │    │ marca_id │    │ campana_id  │    │objetivo_id│
│  │bu_nombre│    │marca_nomb│    │campana_nomb │    │objetivo_nb│
│  │ estado  │    │  bu_id ──┘    │  estado     │    │  estado   │
│  └─────────┘    │  estado  │    └─────────────┘    └───────────┘
│                 └──────────┘
│
│  ┌────────────────────────────────────────────────────────────┐
│  │                      tabla_piezas                          │
│  │                                                            │
│  │  pieza_id           VARCHAR  PK  "RN-P001", "005-P012"    │
│  │  canal              VARCHAR      "Email"|"WhatsApp"|"Qcart"│
│  │  email_type         VARCHAR      "Principal"|"Follow Up"  │
│  │  tipo_envio         VARCHAR      "always-on"|"one-shot"   │
│  │  campana_id    ─────────────────────────► dim_campana     │
│  │  marca_id      ─────────────────────────► dim_marca       │
│  │  bu_id         ─────────────────────────► dim_bu          │
│  │  objetivo_id   ─────────────────────────► dim_objetivo    │
│  │  touchpoint_id ─────────────────────────► dim_touchpoint  │
│  │  pieza_principal_id ────────────────────► tabla_piezas    │
│  │  fecha_primer_envio VARCHAR                                │
│  │  estado             VARCHAR                                │
│  └────────────────────────────────────────────────────────────┘
│         │                              │
│         │ 1:N                          │ 1:N
│         ▼                              ▼
│  ┌──────────────┐             ┌─────────────────┐
│  │pieza_segmento│             │  tabla_nombres  │
│  │  pieza_id    │             │  nombre_unico   │
│  │  segmento_id─┼────────────►│  pieza_id       │
│  └──────────────┘  dim_segmento  canal          │
│                                └─────────────────┘
│
│  ┌────────────────────────────────────────────────┐
│  │               dim_shortlink                    │
│  │  shortlink        VARCHAR  PK                  │
│  │  fecha_activacion VARCHAR                      │
│  │  pieza_nombre     VARCHAR                      │
│  │  pieza_id    ───────────────────► tabla_piezas │
│  │  tienda           VARCHAR                      │
│  │  receta           VARCHAR                      │
│  │  url_receta       VARCHAR                      │
│  │  estado_link      VARCHAR                      │
│  └────────────────────────────────────────────────┘
│
│  ┌──────────────────────┐  ┌────────────────────────────────┐
│  │      dim_segmento    │  │      dim_touchpoint_brief      │
│  │  segmento_id BIGINT  │  │  touchpoint_id  BIGINT         │
│  │  segmento_nombre     │  │  touchpoint_brief VARCHAR      │
│  │  mascota             │  │  canal          VARCHAR        │
│  │  estado              │  │  estado         VARCHAR        │
│  └──────────────────────┘  └────────────────────────────────┘
```

### 2.2 Esquemas por tabla

**tabla_piezas** — entidad central del sistema
```
pieza_id            VARCHAR   PK
canal               VARCHAR              "Email" | "WhatsApp"
email_type          VARCHAR              "Principal" | "Follow Up" | "Envío Único"
tipo_envio          VARCHAR              "always-on" | "one-shot"
campana_id          BIGINT    FK→dim_campana
marca_id            BIGINT    FK→dim_marca
bu_id               BIGINT    FK→dim_bu
objetivo_id         BIGINT    FK→dim_objetivo
touchpoint_id       BIGINT    FK→dim_touchpoint_brief
pieza_principal_id  VARCHAR   FK→tabla_piezas  NULL si es Principal
fecha_primer_envio  VARCHAR
estado              VARCHAR
notas               VARCHAR
time                BIGINT
```

**tabla_nombres** — clave de atribución Email + WA
```
nombre_unico  VARCHAR   nombre exacto en plataforma (SFMC JobName / Twilio Journey)
pieza_id      VARCHAR   FK→tabla_piezas
canal         VARCHAR   "Email" | "WhatsApp"
time          BIGINT
```

**dim_shortlink** — clave de atribución Qcart
```
shortlink         VARCHAR   PK  código del shortlink (ej. "nMo8xFmB")
fecha_activacion  VARCHAR       YYYY-MM-DD; solo cuenta desde esta fecha
pieza_nombre      VARCHAR
pieza_id          VARCHAR   FK→tabla_piezas
tienda            VARCHAR
receta            VARCHAR
url_receta        VARCHAR
estado_link       VARCHAR
time              BIGINT
```

**dim_bu / dim_marca / dim_campana / dim_objetivo / dim_objetivo / dim_segmento / dim_touchpoint_brief**
```
{entidad}_id      BIGINT    PK surrogate (auto-generado por catalogo.dig)
{entidad}_nombre  VARCHAR
bu_id             BIGINT    solo en dim_marca (FK→dim_bu)
canal             VARCHAR   solo en dim_touchpoint_brief
mascota           VARCHAR   solo en dim_segmento
estado            VARCHAR   "activo" | "inactivo"
time              BIGINT
```

**pieza_segmento** — bridge N:M
```
pieza_id      VARCHAR   FK→tabla_piezas
segmento_id   BIGINT    FK→dim_segmento
time          BIGINT
```

---

## 3. nmx_hechos — Tablas de hechos

Atribuye `pieza_id` a cada evento. `hechos.dig` reconstruye esta DB.

### 3.1 Diagrama de atribución

```
                    FUENTES EXTERNAS
                    ─────────────────
prod_sfmc_emailengagement.*   land_wa_envios   land_qcart_carritos
(read-only en TD)                              land_qcart_productos
         │                         │                   │
         │ JOIN                    │ JOIN               │ JOIN
         │ email_name              │ nombre_wa          │ shortlink_code
         │   = tabla_nombres       │   = tabla_nombres  │   = dim_shortlink
         │   .nombre_unico         │   .nombre_unico    │   .shortlink
         │                         │                   │
         ▼                         ▼                   ▼
fact_envio_email           fact_envio_whatsapp   fact_evento_qcart_carritos
                                                 fact_evento_qcart_productos
         └─────────────────────────┴───────────────────┘
                              │
                     pieza_id resuelto
                     para todos los canales
```

### 3.2 Esquemas por tabla

**fact_envio_email** — grain: `(pieza_id, email_job_id)`
```
pieza_id               VARCHAR   FK→tabla_piezas  (atribuido vía tabla_nombres)
email_name             VARCHAR                    nombre de la pieza en SFMC
email_job_id           BIGINT                     ID del job en SFMC
subject                VARCHAR
fecha_envio            VARCHAR
sends                  BIGINT
delivered              BIGINT
bounces                BIGINT
hard_bounces           BIGINT
soft_bounces           BIGINT
unique_opens           BIGINT
unique_clicks          BIGINT
unique_clicks_cta      BIGINT   clicks intencionales (receta, producto, landing)
unique_clicks_baja     BIGINT   clicks de unsub/opt-out
unique_clicks_redes    BIGINT   clicks a RRSS, avisos legales, ver en navegador
unique_clicks_medidos  BIGINT   = unique_clicks_cta  (alias)
unique_unsubs          BIGINT
time                   BIGINT
```

**fact_envio_whatsapp** — grain: `(pieza_id, nombre_wa, quincena)`
```
pieza_id       VARCHAR   FK→tabla_piezas  (atribuido vía tabla_nombres)
nombre_wa      VARCHAR
quincena       VARCHAR   ej. "2026-10-Q2"
fecha_envio    VARCHAR
mes            VARCHAR   ej. "2026-10"
sends          BIGINT
deliveries     BIGINT
opens_read     BIGINT
clicks         BIGINT
errores        BIGINT
no_entregados  BIGINT
time           BIGINT
```

**fact_evento_qcart_carritos** — grain: `(pieza_id, fecha, hora, shortlink_code, store)`
```
pieza_id           VARCHAR   FK→tabla_piezas  (atribuido vía dim_shortlink)
fecha              VARCHAR   YYYY-MM-DD
hora               VARCHAR   HH:MM:SS
shortlink_code     VARCHAR   FK→dim_shortlink
shortlink_name     VARCHAR
store              VARCHAR   "walmart-com-mx" | "chedraui-com-mx"
quincena           VARCHAR
mes                VARCHAR
impressions        BIGINT
views              BIGINT   sesiones de carrito (métrica principal)
total_shown_price  DOUBLE   precio acumulado de productos en carrito ($MXN)
utm_campaign       VARCHAR
utm_medium         VARCHAR
utm_source         VARCHAR
ads_platform       VARCHAR
time               BIGINT
```

**fact_evento_qcart_productos** — grain: `(pieza_id, fecha, hora, shortlink_code, product, store)`
```
pieza_id           VARCHAR   FK→tabla_piezas
fecha              VARCHAR
hora               VARCHAR
shortlink_code     VARCHAR   FK→dim_shortlink
shortlink_name     VARCHAR
product            VARCHAR   nombre del SKU (ej. "Nescafé Clásico 100g")
brand              VARCHAR   "maggi" | "nescafe" | "abuelita" | ...
store              VARCHAR
quincena           VARCHAR
mes                VARCHAR
impressions        BIGINT
views              BIGINT   impresiones individuales por SKU
total_shown_price  DOUBLE   precio acumulado por SKU
utm_campaign       VARCHAR
utm_medium         VARCHAR
utm_source         VARCHAR
ads_platform       VARCHAR
time               BIGINT
```

> **Nota grain Qcart:** `views` en carritos ≠ `views` en productos.
> Carritos = sesiones deduplicadas. Productos = impresiones por SKU (puede ser 100× mayor).
> No comparar directamente. BUG-06 (pct > 100%) ocurre cuando inn > itn por este motivo.

---

## 4. nmx_reportes — Tablas de reporte

Listas para dashboard. `reporte.dig` reconstruye esta DB.

### 4.1 Diagrama de construcción

```
fact_envio_email ─────────────┐
  JOIN tabla_piezas            │
  JOIN dim_* (vía tabla_piezas)│
  FUP JOIN self                ├──► rpt_email
  grain: (pieza_id, mes)       │    (formato wide Principal + FUP)
─────────────────────────────-─┘

fact_envio_whatsapp ──────────┐
  JOIN tabla_piezas            │
  JOIN dim_* (vía tabla_piezas)├──► rpt_whatsapp
  grain: (pieza_id, quincena)  │
─────────────────────────────-─┘

fact_evento_qcart_carritos ───┐
  JOIN fact_evento_qcart_prods│
  JOIN tabla_piezas            │
  JOIN dim_* (vía tabla_piezas)├──► rpt_qcart
  grain: (pieza_id, quincena)  │
─────────────────────────────-─┘
```

### 4.2 Esquemas por tabla

**rpt_email** — 63 columnas, grain: `(pieza_id, mes)`
```
── DIMENSIONES (12) ──────────────────────────────────────────────────────
campana           VARCHAR   nombre de campaña
medio             VARCHAR
objetivo          VARCHAR
touchpoint_brief  VARCHAR   ej. "E-P1"
tipo_email        VARCHAR   "Principal" | "Follow Up"
tipo_envio        VARCHAR   "always-on" | "one-shot"  ← tab del dashboard
segmento_nombre   VARCHAR
tiene_qcart       VARCHAR   "Sí" | "No"
quincena_principal VARCHAR
mes               VARCHAR   ej. "2026-10"
marca             VARCHAR
bu                VARCHAR

── IDENTIDAD PRINCIPAL (5) ───────────────────────────────────────────────
pieza_id                VARCHAR   PK lógico
email_name_principal    VARCHAR
subject_principal       VARCHAR
fecha_envio_principal   VARCHAR
jobs_principal          BIGINT    nº de email jobs que suman a esta pieza

── MÉTRICAS PRINCIPAL (12) ───────────────────────────────────────────────
p_sends, p_deliveries, p_opens, p_clicks,
p_clicks_cta, p_clicks_baja, p_clicks_medidos, p_unsubs,
p_open_rate [double], p_ctor [double], p_click_rate [double], p_utor [double]

── IDENTIDAD FUP (5) ─────────────────────────────────────────────────────
fup_pieza_id, email_name_fup, subject_fup, quincena_fup, fecha_envio_fup

── MÉTRICAS FUP (12) ─────────────────────────────────────────────────────
fup_sends, fup_deliveries, fup_opens, fup_clicks,
fup_clicks_cta, fup_clicks_baja, fup_clicks_medidos, fup_unsubs,
fup_open_rate [double], fup_ctor [double], fup_click_rate [double], fup_utor [double]

── TOTALES P+FUP (12) ────────────────────────────────────────────────────
tot_sends, tot_deliveries, tot_opens, tot_clicks,
tot_clicks_cta, tot_clicks_baja, tot_clicks_medidos, tot_unsubs,
tot_open_rate [double], tot_ctor [double], tot_click_rate [double], tot_utor [double]

── SISTEMA ───────────────────────────────────────────────────────────────
time              BIGINT
```

**rpt_whatsapp** — 20 columnas, grain: `(pieza_id, quincena)`
```
── DIMENSIONES (7) ──────────────────────────────────────────────────────
pieza_id, marca, bu, campana, objetivo, touchpoint_brief, segmento_nombre

── IDENTIFICACIÓN (3) ───────────────────────────────────────────────────
nombre_wa, quincena, mes

── MÉTRICAS (6) ─────────────────────────────────────────────────────────
sends, deliveries, no_entregados, opens_read, clicks, errores

── TASAS (4) ────────────────────────────────────────────────────────────
wa_pct_entrega            = deliveries / sends
wa_pct_no_entrega         = no_entregados / sends
wa_pct_read_vs_entrega    = opens_read / deliveries
wa_pct_click_vs_read      = clicks / opens_read

── SISTEMA ──────────────────────────────────────────────────────────────
time  BIGINT
```

**rpt_qcart** — 23 columnas, grain: `(pieza_id, quincena)`
```
── DIMENSIONES (9) ──────────────────────────────────────────────────────
pieza_id, quincena, tipo_envio, marca, bu, campana, objetivo,
touchpoint_brief, segmento_nombre

── RANGO TEMPORAL (2) ───────────────────────────────────────────────────
fecha_desde, fecha_hasta   primer y último evento de la quincena

── VOLUMEN DE CARRITO (4) ───────────────────────────────────────────────
carritos_walmart   BIGINT   sesiones en Walmart (store LIKE '%walmart%')
carritos_chedraui  BIGINT   sesiones en Chedraui (store LIKE '%chedraui%')
carritos_total     BIGINT   todas las sesiones de carrito
views_carrito      BIGINT   impresiones de página carrito

── INTENCIÓN DE COMPRA (5) ──────────────────────────────────────────────
views_productos_nestle  BIGINT   impresiones de SKUs del portfolio Nestlé
intencion_total_mxn     DOUBLE   SUM(total_shown_price) fact_carritos ($MXN)
intencion_nestle_mxn    DOUBLE   SUM(total_shown_price) fact_productos (todo el portfolio)
pct_penetracion_nestle  DOUBLE   inn/itn×100 (NULL si inn>itn — BUG-06 workaround)
receta_representativa   VARCHAR  receta ligada al shortlink (de dim_shortlink)

── TICKETS (2) ──────────────────────────────────────────────────────────
ticket_carrito_mxn   DOUBLE   intencion_total / carritos_total
ticket_producto_mxn  DOUBLE   intencion_nestle / views_productos_nestle

── SISTEMA ──────────────────────────────────────────────────────────────
time  BIGINT
```

---

## 5. Relaciones entre bases de datos

```
nmx_insumos                nmx_catalogo              nmx_hechos         nmx_reportes
───────────                ────────────              ──────────         ────────────

land_piezas ────────────► tabla_piezas
land_nombres ───────────► tabla_nombres ──────────── email_name ──────► fact_envio_email ──► rpt_email
                                         JOIN         nombre_wa  ──────► fact_envio_whatsapp ► rpt_whatsapp
land_shortlinks ────────► dim_shortlink ──────────── shortlink  ──────► fact_qcart_* ───────► rpt_qcart
land_pieza_segmento ────► pieza_segmento
land_vocab_* ───────────► dim_bu / dim_marca / dim_campana / dim_objetivo / dim_segmento / dim_touchpoint
land_wa_envios ─────────────────────────────────────────────────────────► (vía hechos.dig)
land_qcart_* ───────────────────────────────────────────────────────────► (vía hechos.dig)
sync_markers ────────────── (tabla de control, no participa en SQL de negocio)
```

### Joins críticos del pipeline

```sql
-- Atribución Email (en hechos.dig)
fact_envio_email.pieza_id resuelto por:
  JOIN nmx_catalogo.tabla_nombres n
    ON n.nombre_unico = sfmc.email_name AND n.canal = 'Email'

-- Atribución WA (en hechos.dig)
fact_envio_whatsapp.pieza_id resuelto por:
  JOIN nmx_catalogo.tabla_nombres n
    ON n.nombre_unico = land_wa_envios.nombre_wa AND n.canal = 'WhatsApp'

-- Atribución Qcart (en hechos.dig)
fact_evento_qcart_*.pieza_id resuelto por:
  JOIN nmx_catalogo.dim_shortlink s
    ON s.shortlink = land_qcart.shortlink_code
  WHERE (s.fecha_activacion IS NULL
      OR SUBSTR(land_qcart.fecha_hora, 1, 10) >= s.fecha_activacion)

-- Enriquecimiento en reporte (en reporte.dig)
rpt_* todas las dimensiones vienen de:
  JOIN nmx_catalogo.tabla_piezas p ON p.pieza_id = fact.pieza_id
  JOIN nmx_catalogo.dim_marca m    ON m.marca_id = p.marca_id
  JOIN nmx_catalogo.dim_bu b       ON b.bu_id    = p.bu_id
  JOIN nmx_catalogo.dim_campana c  ON c.campana_id = p.campana_id
  ... etc.
```

---

## 6. Conteos actuales (corte 2026-11-13)

| Base de datos | Tabla | Filas |
|---|---|---|
| nmx_insumos | land_piezas | ~157 |
| nmx_insumos | land_nombres | ~169 |
| nmx_insumos | land_shortlinks | ~82 |
| nmx_insumos | land_wa_envios | ~24 |
| nmx_insumos | land_qcart_carritos | ~71,117 |
| nmx_insumos | land_qcart_productos | ~71,117 |
| nmx_catalogo | tabla_piezas | 157 |
| nmx_catalogo | tabla_nombres | 169 |
| nmx_catalogo | dim_shortlink | 82 |
| nmx_hechos | fact_envio_email | ~105 |
| nmx_hechos | fact_envio_whatsapp | ~24 |
| nmx_hechos | fact_evento_qcart_carritos | ~7,185 (carritos únicos) |
| nmx_hechos | fact_evento_qcart_productos | — |
| nmx_reportes | rpt_email | 105 |
| nmx_reportes | rpt_whatsapp | 24 |
| nmx_reportes | rpt_qcart | 183 |

---

## 7. Alertas y trampas conocidas

| Trampa | Dónde | Detalle |
|---|---|---|
| `views` Qcart no es comparable entre tablas | fact_carritos vs fact_productos | Carritos = sesiones; productos = impresiones por SKU. Nunca dividir una entre otra. |
| `pct_penetracion_nestle > 100%` | rpt_qcart | BUG-06: grain mismatch inn>itn. Se muestra NULL en lugar de % imposible. |
| `carritos_walmart + carritos_chedraui > carritos_total` | rpt_qcart | BUG-07: store con valor combinado "walmart-com-mx, chedraui-com-mx" se excluye de ambos splits. |
| `intencion_total_mxn` no es precio por carrito individual | land_qcart_carritos | Es el acumulado de todos los views. 1 evento con 1,408 views ≠ 1 carrito de $521K. |
| Shortlinks Alianzas y Abuelita NO están en dim_shortlink | — | Atribución ad hoc documentada en `HANDOFF-landing-autonomo.md`. |
| FUPs no aparecen como filas en rpt_email | — | Aparecen como columnas `fup_*` de su Principal. Normal y correcto. |
| Email no tiene archivos raw | — | Fuente directa en `prod_sfmc_emailengagement.*` (read-only). Rick no sube nada. |
