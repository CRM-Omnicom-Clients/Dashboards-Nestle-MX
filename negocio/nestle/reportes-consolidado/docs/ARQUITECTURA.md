# ARQUITECTURA: Reporte Consolidado Nestlé México en Treasure Data

> Cómo está construido el sistema: bases de datos, tablas, flujo de datos y decisiones de diseño.
> Para el estado actual del proyecto, ver `ESTADO.md`. Para correr el pipeline, ver `OPERACIONES.md`.

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
                  │  - Lee XLSX catálogo → 10 tablas land_*
                  │  - Lee WA XLSX multi-hoja → normaliza → land_wa_envios
                  │  - Lee Qcart CSVs raw → normaliza → land_qcart_*
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 1 — nmx_insumos (landing zone normalizada, sin pieza_id) │
│                                                                 │
│  Del catálogo:                                                  │
│    land_vocab_bu / _marcas / _campanas / _objetivos             │
│    land_vocab_touchpoints_brief / _segmentos                    │
│    land_piezas / land_pieza_segmento                            │
│    land_nombres   ← nombre_unico + canal → pieza_id            │
│    land_shortlinks ← shortlink → pieza_id + fecha_activacion   │
│                                                                 │
│  De insumos raw (normalizados por el script):                   │
│    land_wa_envios   ← nombre_wa, quincena, sends, etc.         │
│    land_qcart_carritos ← shortlink_code, fecha, store, etc.    │
│    land_qcart_productos ← shortlink_code, fecha, product, etc. │
└─────────────────┬───────────────────────────────────────────────┘
                  │  catalogo.dig  (Digdag — 24 tareas)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 2 — nmx_catalogo (dimensiones aprobadas)                 │
│                                                                 │
│    dim_bu / dim_marca / dim_campana / dim_objetivo              │
│    dim_touchpoint_brief / dim_segmento                          │
│    tabla_piezas / pieza_segmento                                │
│    tabla_nombres  ← nombre_unico (email o WA) → pieza_id       │
│    dim_shortlink  ← shortlink → pieza_id + fecha_activacion    │
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
│                                                                 │
│    fact_envio_email           ← grain: (pieza_id, email_job_id)│
│    fact_envio_whatsapp        ← grain: (pieza_id, nombre_wa,   │
│                                         quincena)              │
│    fact_evento_qcart_carritos ← grain: (pieza_id, fecha, hora, │
│                                         shortlink, store)      │
│    fact_evento_qcart_productos ← grain: + product              │
└─────────────────┬───────────────────────────────────────────────┘
                  │  reporte.dig  (Etapa 5)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 4 — nmx_reporte (tablas listas para dashboard)           │
│                                                                 │
│    rpt_email / rpt_whatsapp / rpt_qcart                         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
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
| Correr el pipeline (catalogo.dig + hechos.dig) | **AI** | `tdx wf run ...` |
| Atribuir pieza_id a los eventos (vía JOINs en SQL) | **AI** | `hechos.dig` SQLs |

**Rick nunca modifica los archivos raw antes de subirlos. La normalización y atribución es responsabilidad del pipeline.**

---

## Formato de archivos raw

### Catálogo (XLSX)
- Archivo: `catalogo/Catalogo-Nestle-MX.xlsx`
- Hojas requeridas: `Piezas`, `Pieza_Segmento`, `Nombres`, `Shortlinks`, `Vocab_*` (6 hojas)
- El script lee todas las hojas por nombre fijo.

### WA raw (XLSX multi-hoja)
- Archivo: cualquier `.xlsx` en `insumos/` con "Whatsapp" en el nombre (case-insensitive)
- Formato: varias hojas, una por campaña WA
- El script normaliza cada hoja a un esquema común y hace JOIN con `tabla_nombres` para atribuir `pieza_id`
- Columna identificadora por hoja: `Journey Name` (SFMC) o derivada (shortcode custom)
- Hojas ignoradas: datos de años anteriores (ej. 2025)

### Qcart raw (CSV)
- Carritos: archivo `.csv` en `insumos/` con `carts-raw` en el nombre
- Productos: archivo `.csv` en `insumos/` con `products-raw` en el nombre
- Formato: separador `;`, columna `shortlink code` → JOIN con `dim_shortlink` para `pieza_id`
- Columnas renombradas en normalización: `shortlink code` → `shortlink_code`, etc.

### Email (sin archivo raw — fuente directa en TD)
- Datos en `prod_sfmc_emailengagement.*` (read-only)
- El pipeline lee directo en cada ejecución. Rick no sube nada para email.

---

## nmx_catalogo — dimensiones aprobadas

Reconstruido por `catalogo.dig` (24 tareas, ~20s).

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
| `tabla_nombres` | (nombre_unico, canal) | Email + WA → pieza_id (clave de atribución) |
| `dim_shortlink` | shortlink | 82 shortlinks con pieza y fecha activación (clave de atribución Qcart) |

---

## nmx_hechos — facts por canal

### fact_envio_email ✓

**Grain:** `(pieza_id, email_job_id)`  
**Atribución:** `email_name` JOIN `tabla_nombres` WHERE `canal = 'Email'`  
**Fuente:** `prod_sfmc_emailengagement.*`  
**Resultado:** 141 rows · 135 piezas · 34.6M sends

### fact_envio_whatsapp ✓

**Grain:** `(pieza_id, nombre_wa, quincena)`  
**Atribución:** `nombre_wa` JOIN `tabla_nombres` WHERE `canal = 'WhatsApp'`  
**Fuente:** `nmx_insumos.land_wa_envios` (normalizado desde XLSX multi-hoja)  
**Resultado:** 24 rows · 19 piezas · 30,626 sends

### fact_evento_qcart_carritos ✓

**Grain:** `(pieza_id, fecha, hora, shortlink_code, store)`  
**Atribución:** `shortlink_code` JOIN `dim_shortlink`  
**Fuente:** `nmx_insumos.land_qcart_carritos`  
**Resultado:** 4,659 rows · 37 piezas

### fact_evento_qcart_productos ✓

**Grain:** `(pieza_id, fecha, hora, shortlink_code, product, store)`  
**Atribución:** `shortlink_code` JOIN `dim_shortlink`  
**Fuente:** `nmx_insumos.land_qcart_productos`

---

## nmx_reporte — salida del dashboard (Etapa 5)

| Tabla | Descripción |
|---|---|
| `rpt_email` | Métricas email por pieza, agrupando Principal + FUPs |
| `rpt_whatsapp` | Métricas WA por pieza + quincena |
| `rpt_qcart` | Carritos, views, ticket promedio, intención MXN por pieza + quincena |

---

## Workflow en Treasure Data

**Proyecto:** `nmx_crm_reporte` (ID: 2105350)

```
nmx_crm_reporte.dig
    └── +catalogo → catalogo.dig   (24 tareas)
    └── +hechos   → hechos.dig     (8 tareas: drop+rebuild × 4 facts)
```

**Para correr:** `tdx wf run nmx_crm_reporte.nmx_crm_reporte`

---

## Proceso semanal (cuando hay datos nuevos)

```
1. Rick sube archivos raw a insumos/ en GitHub (WA xlsx + Qcart CSVs)
   Rick edita Catalogo-Nestle-MX.xlsx si hay piezas/nombres nuevos
       ↓
2. AI corre reload_catalog.py
   → 10 tablas catálogo + land_wa_envios + land_qcart_* cargados en nmx_insumos
       ↓
3. AI lanza workflow nmx_crm_reporte
   → catalogo.dig + hechos.dig → ~54 segundos
       ↓
4. AI valida row counts y fechas
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
| Una pieza = un nombre_unico en tabla_nombres | Si hay una nueva pieza WA, Rick la agrega al XLSX Nombres |

---

## Archivos de referencia en este repo

| Archivo | Qué es | Ubicación |
|---|---|---|
| `Catalogo-Nestle-MX.xlsx` | Catálogo operativo — Rick lo edita | `catalogo/` |
| `(Interno-Copy))-Reporte-Consolidado-Nestle-2026-v8.xlsx` | Reporte interno v8 — referencia solo lectura | `referencia/` |
| `(Interno) Envios sin CDP _ Hive.xlsx` | Envíos email históricos ene–ago 2026 | `referencia/` |
| `Copia-111126Qcart-Links Mails-Hive- MX.xlsx` | Mapping interno Qcart shortlinks → piezas (export Hive) | `referencia/` |
