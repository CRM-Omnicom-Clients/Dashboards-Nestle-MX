# ARQUITECTURA: Reporte Consolidado Nestlé México en Treasure Data

> Cómo está construido el sistema: bases de datos, tablas, flujo de datos y decisiones de diseño.
> Para el estado actual del proyecto, ver `ESTADO.md`. Para correr el pipeline, ver `OPERACIONES.md`.
> Para el landing autónomo, ver `HANDOFF-landing-autonomo.md`.

**Actualizado:** 2026-11-13 — landing autónomo en producción (schedule L-V 03:33 CDMX).

---

## 1. El disparador — ¿qué arranca el pipeline?

```
LUNES–VIERNES 03:33 CDMX
         │
         ▼
   TD Digdag Schedule
   #640115 nmx_crm_reporte
         │
         ▼
   nmx_crm_reporte.dig   ← master workflow
```

El pipeline corre automáticamente cada día hábil. También puede correrse a mano:
```bash
tdx wf start nmx_crm_reporte.nmx_crm_reporte
```

---

## 2. El flujo completo del pipeline

```
nmx_crm_reporte.dig
│
├─ 1. landing.dig      ← autónomo: detecta cambios y recarga insumos si hay
│
├─ 2. catalogo.dig     ← reconstruye dim_* en TD (nmx_catalogo)
│
├─ 3. hechos.dig       ← reconstruye fact_* en TD (nmx_hechos)
│
└─ 4. reporte.dig      ← reconstruye rpt_* en TD (nmx_reportes)
```

Los pasos 2–4 siempre corren. El paso 1 decide si hay insumos nuevos que cargar antes.

---

## 3. landing.dig — la lógica autónoma

```
                    GitHub Repo
              RickAguilarOmnicom/NUBE-CLAUD
              ┌────────────────────────────┐
              │  catalogo/_derived/        │
              │    *.csv (10 archivos)     │
              │  insumos/_derived/         │
              │    wa_envios.csv           │
              │    qcart_carritos_*.csv    │
              │    qcart_productos_*.csv   │
              └────────────┬───────────────┘
                           │  GitHub API (SHA por archivo)
                           ▼
┌─────────────────────────────────────────────────┐
│                  landing.dig                    │
│                                                 │
│  ┌─────────────┐                               │
│  │read_markers │  lee nmx_insumos.sync_markers  │
│  │  (td>)      │  "¿qué SHA tengo guardado?"   │
│  └──────┬──────┘                               │
│         │ markers_json                          │
│         ▼                                       │
│  ┌─────────────┐                               │
│  │   detect    │  compara SHA GitHub vs markers │
│  │   (py>)     │  emite flags booleanos:        │
│  └──────┬──────┘    catalogo_changed: true/false│
│         │            wa_changed:      true/false│
│         │            qcart_changed:   true/false│
│         │            any_change:      true/false│
│         ▼                                       │
│  ┌─────────────────────────────────────┐       │
│  │          loads  (_parallel)         │       │
│  │                                     │       │
│  │  if catalogo_changed:               │       │
│  │    load.catalogo_prod (py>)         │       │
│  │    → land_dim_marca, land_nombres,  │       │
│  │      land_piezas, land_shortlinks…  │       │
│  │                                     │       │
│  │  if wa_changed:                     │       │
│  │    load.wa_prod (py>)               │       │
│  │    → land_wa_envios                 │       │
│  │                                     │       │
│  │  if qcart_changed:                  │       │
│  │    load.qcart_prod (py>)            │       │
│  │    → land_qcart_carritos            │       │
│  │    → land_qcart_productos           │       │
│  └──────────────┬──────────────────────┘       │
│                 │                               │
│                 ▼                               │
│  ┌──────────────────────┐                      │
│  │  persist_markers     │  si any_change:       │
│  │  (py> markers.upsert)│  actualiza SHA en TD  │
│  └──────────────────────┘  para próxima vez     │
└─────────────────────────────────────────────────┘
```

---

## 4. La tabla sync_markers — la "memoria" del sistema

```
nmx_insumos.sync_markers
┌─────────────────────────────┬──────────────┬──────────┬───────────────────┐
│ path                        │ blob_sha     │ loader   │ loaded_at         │
├─────────────────────────────┼──────────────┼──────────┼───────────────────┤
│ catalogo/_derived/piezas.csv│ abc123...    │ catalogo │ 2026-11-13T03:33  │
│ insumos/_derived/wa_envios  │ def456...    │ wa       │ 2026-11-13T03:33  │
│ ...                         │ ...          │ ...      │ ...               │
└─────────────────────────────┴──────────────┴──────────┴───────────────────┘
         ▲                              │
         │ detect.py lee esto           │ markers.upsert escribe aquí
         │ y compara contra             │ cuando hay cambio real
         │ GitHub API tree              │
```

Si SHA en tabla == SHA en GitHub → **no recarga**. Solo recarga cuando hay un archivo nuevo en el repo.

---

## 5. ¿Qué pasa si no hay cambios?

```
03:33 CDMX
    │
    ▼
landing.dig corre
    │
    ├─ detect.py: SHA GitHub == SHA en markers
    │             → catalogo_changed = false
    │             → wa_changed       = false
    │             → qcart_changed    = false
    │             → any_change       = false
    │
    ├─ loads: todos los if> se saltan  (< 5 segundos)
    │
    └─ persist_markers: se salta (any_change = false)
    │
    ▼  (sin cargar nada)
catalogo.dig → hechos.dig → reporte.dig   ← corren siempre
    │
    ▼
rpt_* = mismos datos de ayer (idempotente, sin daño)
```

El pipeline es **seguro de correr en vacío** — sin duplicados, sin corrupción.

---

## 6. Flujo de datos completo — de Excel a dashboard

```
Rick edita Excel en su PC
        │
        │  sube manualmente al repo
        ▼
GitHub: CRM-Omnicom-Clients/Dashboards-Nestle-MX
  negocio/nestle/reportes-consolidado/
    catalogo/_derived/*.csv   (10 archivos, catálogo de piezas)
    insumos/_derived/wa_envios.csv
    insumos/_derived/qcart_*.csv
        │
        │  03:33 CDMX L-V  (o si Rick corre manual)
        ▼
landing.dig detecta cambio → carga a TD
        │
        ▼
TD: nmx_insumos (tablas land_*)
  land_dim_marca, land_nombres, land_piezas, land_shortlinks...
  land_wa_envios
  land_qcart_carritos, land_qcart_productos
        │
        ▼
catalogo.dig → TD: nmx_catalogo
  tabla_piezas, dim_shortlink, dim_marca...
        │
        ▼
hechos.dig → TD: nmx_hechos
  fact_envio_email
  fact_envio_whatsapp
  fact_evento_qcart_carritos
  fact_evento_qcart_productos
        │
        ▼
reporte.dig → TD: nmx_reportes
  rpt_email
  rpt_whatsapp
  rpt_qcart
        │
        │  (paso manual — pendiente automatizar)
        ▼
build_dashboard_data.py → reporte-datos.js → git push
        │
        ▼
GitHub Pages → Dashboard público
https://crm-omnicom-clients.github.io/Dashboards-Nestle-MX/
  dashboards/reporte-consolidado-crm.html
```

---

## 7. Secretos — dónde vive cada credencial

```
TD Workflow Secrets (nunca en código ni en commits)
┌──────────────────────┬────────────────────────────────────────────┐
│ Nombre del secret    │ Para qué                                   │
├──────────────────────┼────────────────────────────────────────────┤
│ github_pat_dashboards│ detect.py y load.py leen archivos GitHub   │
│ td.apikey            │ load.py y markers.upsert escriben a TD     │
└──────────────────────┴────────────────────────────────────────────┘
```

Los loaders los reciben vía `_env` en el `.dig`:
```yaml
_env:
  GITHUB_PAT: ${secret:github_pat_dashboards}
  TD_APIKEY:  ${secret:td.apikey}
```

---

## 8. Capas del sistema

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 0 — ARCHIVOS RAW (Rick los sube al repo, sin procesar)    │
│                                                                 │
│  catalogo/_derived/                                             │
│    *.csv (10 archivos generados por GitHub Action)              │
│                                                                 │
│  insumos/_derived/                                              │
│    wa_envios.csv                                                │
│    qcart_carritos_*.csv                                         │
│    qcart_productos_*.csv                                        │
└─────────────────┬───────────────────────────────────────────────┘
                  │  landing.dig + detect.py + load.py
                  │  (automático L-V 03:33, solo si hay cambios)
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
                  │  ATRIBUCIÓN de pieza_id:
                  │  - Email: email_name  JOIN tabla_nombres
                  │  - WA:    nombre_wa   JOIN tabla_nombres
                  │  - Qcart: shortlink   JOIN dim_shortlink
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 3 — nmx_hechos (facts por canal, con pieza_id)           │
└─────────────────┬───────────────────────────────────────────────┘
                  │  reporte.dig  (Digdag — 6 tareas)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 4 — nmx_reportes (tablas listas para dashboard)           │
│    rpt_email / rpt_whatsapp / rpt_qcart                         │
└─────────────────┬───────────────────────────────────────────────┘
                  │  build_dashboard_data.py  (paso manual)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 5 — DASHBOARD (GitHub Pages)                              │
│    dashboards/reporte-datos.js        ← SOLO datos: AON/OS/WA  │
│    dashboards/reporte-consolidado-crm.html  ← SOLO lógica JS   │
│                                                                 │
│    URL: crm-omnicom-clients.github.io/Dashboards-Nestle-MX/    │
│         dashboards/reporte-consolidado-crm.html                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Regla de oro: quién hace qué

| Responsabilidad | Quién | Dónde |
|---|---|---|
| Descargar datos de las plataformas (SFMC, Twilio, Qcart) | **Rick** | — |
| Subir archivos al repo (insumos y catálogo) | **Rick** | GitHub |
| Detectar cambios y recargar insumos a TD | **Automático** | `landing.dig` L-V 03:33 |
| Reconstruir catálogo, hechos y reportes | **Automático** | `catalogo→hechos→reporte.dig` |
| Generar el JS de datos del dashboard | **AI** | `build_dashboard_data.py` (manual) |
| Atribuir pieza_id a los eventos (JOINs SQL) | **Pipeline** | `hechos.dig` |

**Rick ya no necesita correr el pipeline manualmente.** Solo sube los archivos; al día siguiente a las 3:33 ya están en las tablas de TD.

---

## 10. Workflow en Treasure Data

**Proyecto activo:** `nmx_crm_reporte` (project_id 2105350)
**Schedule activo:** `#640115` — cron `33 3 * * 1-5` America/Mexico_City
**Schedule desactivado:** `#640484 [.]` — duplicado inactivo (creado por segundo upload)

```
nmx_crm_reporte.dig
├── +landing  → landing.dig   (detect → loads condicionales → persist_markers)
├── +catalogo → catalogo.dig  (24 tareas — reconstruye nmx_catalogo)
├── +hechos   → hechos.dig    (8 tareas  — reconstruye nmx_hechos)
└── +reporte  → reporte.dig   (6 tareas  — reconstruye nmx_reportes)
```

**Para pushear cambios al workflow:**
```bash
tdx wf upload my/workflow/ --project nmx_crm_reporte
```

**Para correr manualmente:**
```bash
tdx wf start nmx_crm_reporte.nmx_crm_reporte
```

---

## 11. nmx_catalogo — dimensiones aprobadas (10 tablas)

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

---

## 12. nmx_hechos — facts por canal

### fact_envio_email
**Grain:** `(pieza_id, email_job_id)` · **Atribución:** `email_name JOIN tabla_nombres`
**Fuente:** `prod_sfmc_emailengagement.*` (read-only) · **Filtro:** `total_sends >= 10`

### fact_envio_whatsapp
**Grain:** `(pieza_id, nombre_wa, quincena)` · **Atribución:** `nombre_wa JOIN tabla_nombres`

### fact_evento_qcart_carritos + fact_evento_qcart_productos
**Grain:** `(pieza_id, fecha, hora, shortlink_code, store)` · **Atribución:** `shortlink_code JOIN dim_shortlink`

---

## 13. nmx_reportes — salida del dashboard (formato v8)

### rpt_email
**Grain:** `(pieza_id, mes)` — Principal únicamente; FUP como columnas `fup_*` en la misma fila.

### rpt_whatsapp
**Grain:** `(pieza_id, quincena)`

### rpt_qcart
**Grain:** `(pieza_id)` — agrega todas las quincenas en una fila.

| Métrica Qcart | Fórmula |
|---|---|
| `carritos_total` | SUM(views) fact_carritos |
| `intencion_total_mxn` | SUM(total_shown_price) fact_carritos |
| `intencion_nestle_mxn` | SUM(total_shown_price) fact_productos (sin filtro brand — todo en Qcart es Nestlé) |
| `pct_penetracion_nestle` | intencion_nestle / intencion_total × 100 |
| `ticket_carrito_mxn` | intencion_total / carritos_total |

---

## 14. Decisiones innegociables

| Regla | Detalle |
|---|---|
| Email se lee de prod_sfmc_*, nunca se copia | Resuelve desfase entre fuente y TD |
| Solo el pipeline escribe en TD | Sin edits manuales en tablas TD |
| Catálogo se edita como XLSX → GitHub Action lo convierte a CSV | Un solo archivo, Rick lo edita, el Action lo convierte, landing.dig lo detecta |
| Rick sube archivos raw sin procesar | La normalización y atribución es del pipeline |
| pieza_id se atribuye en hechos.dig vía JOINs | Nunca hardcodeado en archivos raw |
| tipo_envio separa Always On vs One Shot | campana='AON' puede tener piezas one-shot; tipo_envio es la fuente de verdad |
| rpt_email usa formato wide | Principal + FUP en la misma fila (formato v8) |
| Dashboard: datos separados de lógica (desde 2026-11-12) | `reporte-datos.js` = datos; HTML = lógica pura; **nunca editar HTML para datos** (causa BUG-08) |
| landing.dig verifica SHA antes de cargar | Idempotente — corre a diario sin duplicar datos |

---

## 15. Archivos de referencia

| Archivo | Qué es | Ubicación |
|---|---|---|
| `Catalogo-Nestle-MX.xlsx` | Catálogo operativo — Rick lo edita | `catalogo/` en GitHub |
| `Copia-151026-Reporte-Consolidado-Nestle-2026-v8.xlsx` | Reporte interno v8 — referencia de columnas | `referencia/` |
| `(Interno) Envios sin CDP _ Hive.xlsx` | Envíos email históricos ene–ago 2026 | `referencia/` |
| `Copia-111126Qcart-Links Mails-Hive- MX.xlsx` | Mapping interno Qcart shortlinks → piezas | `referencia/` |
| `HANDOFF-landing-autonomo.md` | Reglas de atribución Alianzas/Abuelita, métricas Qcart consolidadas | `docs/estado/` |
