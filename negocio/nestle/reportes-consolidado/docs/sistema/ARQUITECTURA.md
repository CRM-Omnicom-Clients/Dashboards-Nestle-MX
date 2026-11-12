# ARQUITECTURA: Reporte Consolidado Nestlé México en Treasure Data

> Cómo está construido el sistema: bases de datos, tablas, flujo de datos y decisiones de diseño.
> Para el estado actual del proyecto, ver `ESTADO.md`. Para correr el pipeline, ver `OPERACIONES.md`.
> Para contexto de sesión a sesión (OIs, decisiones, próximos pasos), ver `HANDOFF.md`.

---

## El sistema en una pantalla

**Qué hace:** Convierte datos crudos de SFMC (email), WhatsApp y Qcart en un reporte estructurado y reproducible dentro de Treasure Data. El mismo input siempre produce el mismo output.

**Qué NO hace:** Reemplaza el Excel final que ve el cliente. La capa de TD produce las tablas limpias; el diseño del dashboard es en Treasure Data Studio.

---

## Capas del sistema

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 0 — ARCHIVOS RAW (Rick los sube al repo, sin procesar)    │
│                                                                 │
│  catalogo/                                                      │
│    Catalogo-Nestle-MX.xlsx      ← Rick edita semanal           │
│                                                                 │
│  insumos/                                                       │
│    [nombre]-WA-[fecha].xlsx     ← export multi-hoja de Twilio  │
│    [nombre]-carts-raw-[fecha].csv    ← export raw de Qcart     │
│    [nombre]-products-raw-[fecha].csv ← export raw de Qcart     │
└─────────────────┬───────────────────────────────────────────────┘
                  │  reload_catalog.py  (AI corre manualmente)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 1 — nmx_insumos (landing zone normalizada, sin pieza_id) │
└─────────────────┬───────────────────────────────────────────────┘
                  │  catalogo.dig  (Digdag — 24 tareas)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 2 — nmx_catalogo (dimensiones aprobadas)                 │
└─────────────────┬───────────────────────────────────────────────┘
                  │  hechos.dig  (Digdag — 8 tareas)
                  │  AQUÍ OCURRE LA ATRIBUCIÓN de pieza_id:
                  │  - Email: email_name JOIN tabla_nombres
                  │  - WA:    nombre_wa   JOIN tabla_nombres
                  │  - Qcart: shortlink   JOIN dim_shortlink
                  │  + prod_sfmc_emailengagement (read-only, para email)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 3 — nmx_hechos (facts por canal, con pieza_id)           │
└─────────────────┬───────────────────────────────────────────────┘
                  │  reporte.dig  (Digdag — 6 tareas)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 4 — nmx_reporte (tablas listas para dashboard)           │
│    rpt_email / rpt_whatsapp / rpt_qcart                         │
└─────────────────┬───────────────────────────────────────────────┘
                  ▼
             TD Studio Dashboard
```

---

## Regla de oro: quién hace qué

| Responsabilidad | Quién | Dónde |
|---|---|---|
| Descargar datos de las plataformas (SFMC, Twilio, Qcart) | **Rick** | — |
| Subir archivos raw al repo (sin procesar) | **Rick** | `insumos/` en GitHub |
| Mantener el catálogo de piezas, nombres y shortlinks | **Rick** | `catalogo/Catalogo-Nestle-MX.xlsx` en GitHub |
| Normalizar archivos raw → tablas `land_*` en nmx_insumos | **AI** | `reload_catalog.py` |
| Correr el pipeline | **AI** | `tdx wf run ...` |
| Atribuir pieza_id a los eventos (vía JOINs en SQL) | **AI** | `hechos.dig` SQLs |

**Rick nunca modifica los archivos raw antes de subirlos. La normalización y atribución es responsabilidad del pipeline.**

---

## Formato de archivos raw

### Catálogo (XLSX)
- Archivo: `catalogo/Catalogo-Nestle-MX.xlsx`
- Hojas requeridas: `Piezas`, `Pieza_Segmento`, `Nombres`, `Shortlinks`, `Vocab_*` (6 hojas)

### WA raw (XLSX multi-hoja)
- Archivo: cualquier `.xlsx` en `insumos/` con "Whatsapp" en el nombre
- Formato: varias hojas, una por campaña WA
- Columna identificadora: `Journey Name` (SFMC) o derivada (shortcode custom)

### Qcart raw (CSV)
- Carritos: archivo `.csv` en `insumos/` con `carts-raw` en el nombre
- Productos: archivo `.csv` en `insumos/` con `products-raw` en el nombre
- Formato: separador `;`, columna `shortlink code` → JOIN con `dim_shortlink`

### Email (sin archivo raw — fuente directa en TD)
- Datos en `prod_sfmc_emailengagement.*` (read-only). Rick no sube nada para email.

---

## nmx_catalogo — dimensiones aprobadas (10 tablas)

| Tabla | Grain | Descripción |
|---|---|---|
| `dim_bu` | bu_id | 5 unidades de negocio |
| `dim_marca` | marca_id | 11 marcas |
| `dim_campana` | campana_id | 13 campañas |
| `dim_objetivo` | objetivo_id | 11 objetivos |
| `dim_touchpoint_brief` | touchpoint_id | 79 touchpoints (E-P1, WA-C1, etc.) |
| `dim_segmento` | segmento_id | 52 segmentos |
| `tabla_piezas` | pieza_id | 157 piezas con todas sus dimensiones |
| `pieza_segmento` | (pieza_id, segmento_id) | bridge muchos-a-muchos |
| `tabla_nombres` | (nombre_unico, canal) | Email + WA → pieza_id (clave de atribución) |
| `dim_shortlink` | shortlink | 82 shortlinks con pieza, fecha, receta |

### Campos clave de tabla_piezas
| Campo | Descripción |
|---|---|
| `pieza_id` | Código compuesto: `{BU}-{tipo}{número}` (ej. `RN-P001`) |
| `email_type` | 'Principal' / 'Follow Up' / 'Envío Único' |
| `tipo_envio` | 'always-on' / 'one-shot' — para separar tabs del dashboard |
| `pieza_principal_id` | NULL para Principals; pieza_id del padre para FUPs |
| `touchpoint_id` | FK → dim_touchpoint_brief |

---

## nmx_hechos — facts por canal

### fact_envio_email

**Grain:** `(pieza_id, email_job_id)`  
**Atribución:** `email_name JOIN tabla_nombres WHERE canal = 'Email'`  
**Fuente:** `prod_sfmc_emailengagement.*`  
**Filtro:** `total_sends >= 10` (excluye test sends)

**Columnas (Etapa 6 — versión completa):**
```
pieza_id, email_name, email_job_id, subject,
fecha_envio, sends, delivered, bounces, hard_bounces, soft_bounces,
unique_opens, unique_clicks,
unique_clicks_cta,      -- links intencionales (receta, producto, landing)
unique_clicks_baja,     -- unsubscribe / opt-out
unique_clicks_redes,    -- redes sociales, ver en navegador, avisos legales
unique_clicks_medidos,  -- = unique_clicks_cta (clicks "medidos" = intencionales)
unique_unsubs
```

**Categorización de clicks por URL:**
- `cta`: todo lo que no sea baja ni redes_legal
- `baja`: URL contiene 'unsub', 'baja', 'optout', 'preference'
- `redes_legal`: URL contiene 'facebook', 'instagram', 'twitter', 'youtube', 'tiktok', 'view.exacttarget', 'privacidad', 'politica', 'aviso-legal', 'terminos'

### fact_envio_whatsapp

**Grain:** `(pieza_id, nombre_wa, quincena)`  
**Atribución:** `nombre_wa JOIN tabla_nombres WHERE canal = 'WhatsApp'`  
**Columnas:** pieza_id, nombre_wa, quincena, mes, sends, deliveries, no_entregados, opens_read, clicks, errores

### fact_evento_qcart_carritos

**Grain:** `(pieza_id, fecha, hora, shortlink_code, store)`  
**Atribución:** `shortlink_code JOIN dim_shortlink`  
**Columnas:** pieza_id, fecha, hora, shortlink_code, shortlink_name, store, quincena, mes, impressions, views, total_shown_price, utm_*

### fact_evento_qcart_productos

**Grain:** `(pieza_id, fecha, hora, shortlink_code, product, store)`  
**Columnas adicionales:** product, brand

---

## nmx_reporte — salida del dashboard (formato v8)

### rpt_email — FORMATO WIDE Principal + FUP

**Grain:** `(pieza_id, mes)` donde pieza = **Principal únicamente**

> Los FUPs no son filas independientes. Aparecen como columnas `fup_*` en la fila de su Principal.
> Join: `fups.pieza_principal_id = principals.pieza_id AND fups.mes = principals.mes`

**Grupos de columnas:**

| Grupo | Columnas |
|-------|----------|
| Dimensiones | campana, medio, objetivo, touchpoint_brief, tipo_email, tipo_envio, segmento_nombre, tiene_qcart, quincena_principal, mes, marca, bu |
| ID Principal | pieza_id, email_name_principal, subject_principal, fecha_envio_principal, jobs_principal |
| Métricas Principal | p_sends, p_deliveries, p_opens, p_clicks, p_clicks_cta, p_clicks_baja, p_clicks_medidos, p_unsubs, p_open_rate, p_ctor, p_click_rate, p_utor |
| ID FUP | fup_pieza_id, email_name_fup, subject_fup, quincena_fup, fecha_envio_fup |
| Métricas FUP | fup_sends, fup_deliveries, fup_opens, fup_clicks, fup_clicks_cta, fup_clicks_baja, fup_clicks_medidos, fup_unsubs, fup_open_rate, fup_ctor, fup_click_rate, fup_utor |
| Totales P+FUP | tot_sends, tot_deliveries, tot_opens, tot_clicks, tot_clicks_cta, tot_clicks_baja, tot_clicks_medidos, tot_unsubs, tot_open_rate, tot_ctor, tot_click_rate, tot_utor |

### rpt_whatsapp

**Grain:** `(pieza_id, quincena)`

| Columnas |
|----------|
| pieza_id, marca, bu, campana, objetivo, touchpoint_brief, segmento_nombre, nombre_wa, quincena, mes |
| sends, deliveries, no_entregados, opens_read, clicks, errores |
| wa_pct_entrega, wa_pct_no_entrega, wa_pct_read_vs_entrega, wa_pct_click_vs_read |

### rpt_qcart

**Grain:** `(pieza_id)` — una fila por pieza con rango temporal completo

> Se une a rpt_email por pieza_id en el dashboard (enriquecimiento lateral, no entidad separada).
> Para análisis temporal: usar directamente fact_evento_qcart_carritos.

| Columnas |
|----------|
| pieza_id, marca, bu, campana, objetivo, segmento_nombre |
| fecha_desde, fecha_hasta |
| carritos_walmart, carritos_chedraui, carritos_total |
| views_carrito, views_productos_nestle |
| intencion_total_mxn, intencion_nestle_mxn, pct_penetracion_nestle |
| ticket_carrito_mxn, ticket_producto_mxn, receta_representativa |

**Mapeo de métricas:**
- `carritos_total` = SUM(views) fact_carritos (vistas de páginas carrito)
- `views_carrito` = SUM(impressions) fact_carritos
- `intencion_total_mxn` = SUM(total_shown_price) fact_carritos
- `views_productos_nestle` = SUM(views) fact_productos WHERE brand LIKE '%Nestle%'
- `intencion_nestle_mxn` = SUM(total_shown_price) fact_productos WHERE brand LIKE '%Nestle%'
- `ticket_carrito_mxn` = intencion_total / carritos_total
- `ticket_producto_mxn` = intencion_nestle / views_productos_nestle

---

## Workflow en Treasure Data

**Proyecto:** `nmx_crm_reporte` (ID: 2105350)

```
nmx_crm_reporte.dig
├── +catalogo → catalogo.dig   (24 tareas — reconstruye nmx_catalogo)
├── +hechos   → hechos.dig     (8 tareas  — reconstruye nmx_hechos)
└── +reporte  → reporte.dig    (6 tareas  — reconstruye nmx_reporte)
```

**Para pushear cambios:** `tdx wf push my/workflow/`  
**Para correr:** `tdx wf run nmx_crm_reporte.nmx_crm_reporte`

---

## Proceso semanal (cuando hay datos nuevos)

```
1. Rick sube archivos raw a insumos/ en GitHub
   Rick edita Catalogo-Nestle-MX.xlsx si hay piezas/nombres nuevos
       ↓
2. AI corre reload_catalog.py → nmx_insumos actualizado
       ↓
3. AI lanza workflow → catalogo.dig + hechos.dig + reporte.dig (~60s)
       ↓
4. AI valida row counts, fechas y columnas clave
```

---

## Decisiones innegociables

| Regla | Detalle |
|---|---|
| Email se lee de prod_sfmc_*, nunca se copia | Resuelve desfase entre fuente y TD |
| Solo jobs automáticos escriben en TD | Sin edits manuales en las tablas de TD |
| Catálogo se edita como XLSX | Un solo archivo, Rick lo edita, el script lo carga |
| Rick sube archivos raw sin procesar | La normalización y atribución es del pipeline |
| pieza_id se atribuye en hechos.dig vía JOINs | Nunca hardcodeado en los archivos raw |
| tipo_envio (no campana) separa Always On vs One Shot | campana='AON' incluye piezas con tipo_envio='one-shot' |
| rpt_email usa formato wide | Principal + FUP en la misma fila, alineado con Excel v8 |

---

## Archivos de referencia

| Archivo | Qué es | Ubicación |
|---|---|---|
| `Catalogo-Nestle-MX.xlsx` | Catálogo operativo — Rick lo edita | `catalogo/` |
| `Copia-151026-Reporte-Consolidado-Nestle-2026-v8.xlsx` | Reporte interno v8 — referencia de columnas | `referencia/` |
| `(Interno) Envios sin CDP _ Hive.xlsx` | Envíos email históricos ene–ago 2026 | `referencia/` |
| `Copia-111126Qcart-Links Mails-Hive- MX.xlsx` | Mapping interno Qcart shortlinks → piezas | `referencia/` |
