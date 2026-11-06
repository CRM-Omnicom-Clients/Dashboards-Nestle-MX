# ARQUITECTURA: Reporte Consolidado Nestlé México en Treasure Data

> Cómo está construido el sistema: bases de datos, tablas, flujo de datos y decisiones de diseño.
> Para el estado actual del proyecto, ver `ESTADO.md`. Para correr el pipeline, ver `OPERACIONES.md`.

---

## El sistema en una pantalla

**Qué hace:** Convierte datos crudos de SFMC (email), WhatsApp y Qcart en un reporte estructurado y reproducible dentro de Treasure Data. El mismo input siempre produce el mismo output.

**Qué NO hace:** Reemplaza el Excel final que ve el cliente. La capa de TD produce las tablas limpias; el diseño del dashboard es en Treasure Data Studio.

---

## Las 4 bases de datos

```
prod_sfmc_emailengagement  ← fuente de email (read-only, no tocar)
        │
        │
nmx_insumos   ← catálogo XLSX + archivos WA/Qcart cargados manualmente
        │
        │  catalogo.dig
        ▼
nmx_catalogo  ← dimensiones aprobadas: campañas, touchpoints, piezas, shortlinks
        │
        │  hechos.dig + prod_sfmc_* (joins)
        ▼
nmx_hechos    ← métricas por canal: email ✓, WA y Qcart pendientes
        │
        │  reporte.dig  (Etapa 5)
        ▼
nmx_reporte   ← tablas de salida para el dashboard (pendiente)
```

---

## nmx_insumos — landing zone

Tablas cargadas por `reload_catalog.py` desde `catalogo/Catalogo-Nestle-MX.xlsx`:

| Tabla | Contenido |
|---|---|
| `land_vocab_bu` | Unidades de negocio |
| `land_vocab_marcas` | Marcas |
| `land_vocab_campanas` | Campañas |
| `land_vocab_objetivos` | Objetivos de comunicación |
| `land_vocab_touchpoints_brief` | Touchpoints del brief |
| `land_vocab_segmentos` | Segmentos de audiencia |
| `land_piezas` | Catálogo maestro de piezas (157 piezas, 68 cols) |
| `land_pieza_segmento` | Bridge pieza↔segmento (muchos-a-muchos) |
| `land_nombres` | Nombres únicos Email + WA por pieza |
| `land_shortlinks` | Shortlinks de Qcart con pieza y fecha de activación |

Tablas pendientes (Etapas 4b/4c):
- `land_wa_envios` — datos WA por quincena (Rick sube archivo a `insumos/`)
- `land_qcart_carritos` — eventos carrito (Rick sube archivo a `insumos/`)
- `land_qcart_productos` — eventos producto (Rick sube archivo a `insumos/`)

---

## nmx_catalogo — dimensiones aprobadas

Reconstruido por `catalogo.dig` cada vez que corre el pipeline. 24 tareas, ~20s.

| Tabla | Grain | Descripción |
|---|---|---|
| `dim_bu` | bu_id | 5 unidades de negocio |
| `dim_marca` | marca_id | 11 marcas |
| `dim_campana` | campana_id | 13 campañas |
| `dim_objetivo` | objetivo_id | 11 objetivos |
| `dim_touchpoint_brief` | touchpoint_id | 79 touchpoints |
| `dim_segmento` | segmento_id | 52 segmentos |
| `tabla_piezas` | pieza_id | 157 piezas con todas sus dimensiones |
| `pieza_segmento` | (pieza_id, segmento_id) | bridge muchos-a-muchos |
| `tabla_nombres` | (nombre_unico, canal) | nombres de Email + WA → pieza_id |
| `dim_shortlink` | shortlink | 82 shortlinks con pieza y fecha activación |

---

## nmx_hechos — facts por canal

### fact_envio_email ✓ (Etapa 4a — COMPLETA)

**Grain:** (pieza_id, email_job_id) — un envío real por pieza por job.

```sql
-- Fuentes de datos:
-- prod_sfmc_emailengagement.prod_sfmc_sends        → volumen + bounces
-- prod_sfmc_emailengagement.prod_sfmc_opens        → unique_opens
-- prod_sfmc_emailengagement.prod_sfmc_clicks       → unique_clicks
-- prod_sfmc_emailengagement.prod_sfmc_unsubscribes → unique_unsubs
-- nmx_catalogo.tabla_nombres                       → email_name → pieza_id
```

| Columna | Fuente |
|---|---|
| pieza_id | JOIN tabla_nombres ON email_name = nombre_unico |
| email_name | prod_sfmc_sends |
| email_job_id | prod_sfmc_sends |
| fecha_envio | MAX(email_send_date) por job |
| sends, delivered, bounces, hard_bounces, soft_bounces | prod_sfmc_sends |
| unique_opens | COUNT(DISTINCT subscriber_key) en prod_sfmc_opens |
| unique_clicks | COUNT(DISTINCT subscriber_key) en prod_sfmc_clicks |
| unique_unsubs | COUNT(DISTINCT subscriber_key) en prod_sfmc_unsubscribes |

Resultado actual: 141 jobs · 135 piezas · 34.6M sends · 3.2M opens · 47.8K clicks.

**Decisión de filtro:** `total_sends >= 10` — excluye test sends; incluye transaccionales reales.

### fact_envio_whatsapp (Etapa 4b — pendiente datos)

Grain: (pieza_id, fecha_quincena). Espera archivo en `insumos/`.

### fact_evento_qcart_carritos / _productos (Etapa 4c — pendiente datos)

Grain: evento individual (sesión de carrito / producto agregado). Espera archivos en `insumos/`.

---

## nmx_reporte — salida del dashboard (Etapa 5, pendiente)

| Tabla | Descripción |
|---|---|
| `rpt_email` | Métricas email por pieza, agrupando Principal + FUPs. Tasas calculadas. |
| `rpt_whatsapp` | Métricas WA por pieza + touchpoint |
| `rpt_qcart` | Carritos, views, penetración, ticket promedio, intención MXN por pieza + quincena |

---

## Workflow en Treasure Data

**Proyecto:** `nmx_crm_reporte` (Project ID: 2105350)

```
nmx_crm_reporte.dig
    └── +catalogo → catalogo.dig   (24 tareas, ~20s)
    └── +hechos   → hechos.dig     (1 tarea email, ~30s)
```

**Para correr:** `tdx wf run nmx_crm_reporte.nmx_crm_reporte`

**sh> bloqueado:** Docker/ECS no configurado en esta cuenta TD. La recarga del catálogo es un script local.

---

## Modelo del catálogo (decisiones clave de Rick, nov-2026)

### Llave de una pieza

- **Email:** `email_name` (el nombre real que reporta SFMC). Único, 138 piezas.
- **WhatsApp:** `whatsapp_name`. Único, 19 piezas.
- `pieza_id` es etiqueta legible, no la llave. Formato: `001-P001` (campaña-número).
- Una celda de llave lleva UN solo nombre. Si una pieza tenía dos, el principal es el que SFMC entrega actualmente; el otro es alias.

### Shortlinks (dim_shortlink / Catalogo_Links)

- **Llave:** `(shortlink, fecha_activacion)` — un shortlink puede reusarse con distinta pieza si tiene distinta fecha de activación.
- `pieza` es llave foránea → el email_name o whatsapp_name de la pieza.
- `tienda`: `walmart` · `chedraui` · `chedraui+walmart`. Default: `walmart`.
- `estado_link`: `USADO` · `LINK NO USADO` · `NO SE ENVIO` · `PROBLEMA DE DATOS`.
- `fecha_activacion = N/A` en los 11 links que el maestro reporta como no enviados.

---

## Archivos de referencia en este repo

| Archivo | Qué es | Ubicación |
|---|---|---|
| `Catalogo-Nestle-MX.xlsx` | Catálogo operativo — Rick lo edita cada semana | `catalogo/` |
| `(Interno-Copy))-Reporte-Consolidado-Nestle-2026-v8.xlsx` | Reporte interno v8 — referencia para diseño del catálogo. Solo lectura. | `referencia/` |
| `(Interno) Envios sin CDP _ Hive.xlsx` | Envíos email históricos de SFMC (ene–ago 2026) no disponibles en CDP. Referencia histórica. | `referencia/` |

---

## Decisiones innegociables

| Regla | Detalle |
|---|---|
| Email se lee de prod_sfmc_*, nunca se copia | Resuelve desfase entre fuente y TD |
| Solo jobs automáticos escriben en TD | Sin edits manuales en las tablas de TD |
| Catálogo se edita como XLSX | Un solo archivo, Rick lo edita, el script lo carga |
| Una pieza = un nombre de llave | Nunca dos emails_name en una celda |
| El grain de fact_envio_email es (pieza_id, email_job_id) | Principal + FUP van juntos al fact, se agrupan en rpt_email |
