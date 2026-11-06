---
title: "ESTADO: Reporte Consolidado Nestlé México en Treasure Data"
updated: 2026-11-05
status: "Etapas 4a+4b+4c completas. Pipeline email+WA+Qcart corriendo. Faltan: 5 rpt_*, 6 dashboard."
owner: Rick Aguilar
---

# ESTADO: Reporte Consolidado Nestlé México en TD

> Fuente de verdad del proyecto. Se actualiza al cierre de cada sesión.

---

## Resumen ejecutivo al 2026-11-05

| Capa | Tabla(s) | Estado |
|---|---|---|
| Catálogo (insumos) | 10 tablas `land_*` en nmx_insumos | ✓ Funcionando — recarga manual semanal vía script |
| Catálogo (procesado) | 10 tablas `dim_*` + `tabla_piezas` etc. en nmx_catalogo | ✓ Funcionando — `catalogo.dig` idempotente |
| Hechos email | `fact_envio_email` en nmx_hechos | ✓ 141 rows — 135 piezas — 34.6M sends |
| Hechos WA | `fact_envio_whatsapp` en nmx_hechos | ✓ 24 rows — 19 piezas — 30,626 sends |
| Hechos Qcart | `fact_evento_qcart_carritos` / `_productos` en nmx_hechos | ✓ 4,659 / 1,683 rows — 37 piezas |
| Reporte | `rpt_email`, `rpt_whatsapp`, `rpt_qcart` | Pendiente (Etapa 5) |
| Dashboard | Studio dashboard | Pendiente (Etapa 6) |

**Workflow en TD:** `nmx_crm_reporte` (ID: 2105350) — corre en ~54s. Llama catalogo.dig → hechos.dig (8 tareas: email + WA + qcart_carritos + qcart_productos).

---

## Plan general de etapas

| # | Etapa | Estado | Qué produce |
|---|---|---|---|
| **0** | **Bootstrap** | **✓ COMPLETA** | 4 DBs creadas + permisos workflow + repo GitHub inicializado |
| **1** | **Arquitectura** | **✓ COMPLETA** | Esquemas, vocabularios v8, decisiones firmadas |
| **2** | **Repositorio** | **✓ COMPLETA** | Repo GitHub con XLSX catálogo, workflow, queries |
| **3** | **Recarga catálogo** | **✓ COMPLETA** | `reload_catalog.py`: XLSX → 10 tablas nmx_insumos; `catalogo.dig`: 24/24 OK |
| **4a** | **Hechos email** | **✓ COMPLETA** | `fact_envio_email`: 141 rows, 135 piezas, 34.6M sends |
| **4b** | **Hechos WA** | **✓ COMPLETA** | `fact_envio_whatsapp`: 24 rows, 19 piezas, 30,626 sends |
| **4c** | **Hechos Qcart** | **✓ COMPLETA** | `fact_evento_qcart_carritos`: 4,659 rows; `_productos`: 1,683 rows |
| **5** | **Reporte** | **Sin bloqueo** | `rpt_email`, `rpt_whatsapp`, `rpt_qcart` en nmx_reporte |
| **6** | **Dashboard** | Pendiente OI-12 | Studio dashboard; schedule semanal activado |
| **7** | **Operabilidad** | Pendiente | OPERACIONES.md; cold run; traspaso |

---

## Sub-plan: lo que sigue

### Etapa 5 — Tablas de reporte
Sin bloqueo. Las 3 tablas de hechos existen con datos reales.

| Tabla | Qué hace | Estado |
|---|---|---|
| `rpt_email` | Agrupa Principal + FUPs por pieza; sums + tasas (open_rate, click_rate, CTOR, delivery_rate) | Listo para hacer |
| `rpt_whatsapp` | Métricas WA por pieza + touchpoint | Listo para hacer |
| `rpt_qcart` | Carritos, views, penetración, ticket promedio, intención MXN por pieza + quincena | Listo para hacer — ver OI-13 |

### Etapa 6 — Dashboard
Requiere que las 3 tablas de reporte existan con datos reales para validar el diseño visual.
Pendiente de Rick: spec de diseño (OI-12) — qué columnas, en qué orden, qué filtros quiere el cliente.

### Etapa 7 — Operabilidad
- OPERACIONES.md: runbook del flujo semanal (quién hace qué, en qué orden)
- Cold run: que un teammate pueda correr el pipeline de cero
- Schedule semanal en TD: configurar trigger automático

---

## Proceso semanal actual (Etapas 0–4c operativas)

```
1. Rick actualiza Catalogo-Nestle-MX.xlsx en GitHub (y sube wa_envios.csv + qcart_*.csv si hay nuevos datos)
       ↓
2. AI corre: uv run --with openpyxl .../my/scripts/reload_catalog.py
   → 10 hojas XLSX + 3 CSVs (WA + qcart_carritos + qcart_productos) cargados en nmx_insumos
       ↓
3. AI lanza workflow nmx_crm_reporte en TD  (tdx wf run nmx_crm_reporte.nmx_crm_reporte)
   → catalogo.dig reconstruye nmx_catalogo (24 tareas)
   → hechos.dig reconstruye 4 fact tables: email + WA + qcart_carritos + qcart_productos
   → Total: ~54s
```

---

## Flujo de datos

```
Repo GitHub (Catalogo-Nestle-MX.xlsx + wa_envios.csv + qcart_carritos.csv + qcart_productos.csv)
    │
    │  reload_catalog.py (manual semanal)
    ▼
nmx_insumos          ← archivos crudos, sin procesar
    │
    │  catalogo.dig
    ▼
nmx_catalogo         ← catálogo aprobado: 10 tablas (dims + hechos bridge)   ✓ VIVO
    │
    │  hechos.dig
    ├──────────────────────────────────────┐
    │  prod_sfmc_emailengagement (read-only)│
    └──────────────────────────────────────┘
    ▼
nmx_hechos           ← facts por canal: email ✓, WA ✓, Qcart ✓
    │
    │  reporte.dig (Etapa 5)
    ▼
nmx_reporte          ← 3 tablas rpt_* listas para dashboard   (pendiente)
    │
    ▼
Studio dashboard     (pendiente — Etapa 6)
```

---

## Bases de datos y estado actual

| DB | Nombre | Estado | Tablas |
|---|---|---|---|
| Fuente | `prod_sfmc_emailengagement` | Read-only. No tocar. | prod_sfmc_sends, prod_sfmc_opens, prod_sfmc_clicks, prod_sfmc_unsubscribes (+21 más) |
| 1 | `nmx_insumos` | Activa | 10 tablas catálogo (`land_vocab_*`, `land_piezas`, etc.) + land_wa_envios + land_qcart_carritos + land_qcart_productos |
| 2 | `nmx_catalogo` | Activa | 10 tablas: dim_bu, dim_marca, dim_campana, dim_objetivo, dim_touchpoint_brief, dim_segmento, tabla_piezas, pieza_segmento, tabla_nombres, dim_shortlink |
| 3 | `nmx_hechos` | Activa | fact_envio_email ✓ · fact_envio_whatsapp ✓ · fact_evento_qcart_carritos ✓ · fact_evento_qcart_productos ✓ |
| 4 | `nmx_reporte` | Vacía | rpt_email, rpt_whatsapp, rpt_qcart — pendiente Etapa 5 |

---

## Tablas de hechos — diseño

### fact_envio_email
| Decisión | Valor |
|---|---|
| Grain | (pieza_id, email_job_id) — un job real por fila |
| Filtro | total_sends >= 10 |
| Métricas | sends, delivered, bounces (hard+soft), unique_opens, unique_clicks, unique_unsubs |
| Resultados | 141 rows — 135 piezas — 34.6M sends — 3.2M opens — 47.8K clicks |

### fact_envio_whatsapp
| Decisión | Valor |
|---|---|
| Grain | (pieza_id, whatsapp_name, quincena) |
| Fuente | nmx_insumos.land_wa_envios (Rick declara pieza_id en el Excel) |
| Métricas | sends, deliveries, opens_read, clicks (TRY_CAST — algunos N/A), errores, no_entregados |
| Resultados | 24 rows — 19 piezas — 30,626 sends (Maggi: múltiples segments por quincena = múltiples whatsapp_name) |

### fact_evento_qcart_carritos
| Decisión | Valor |
|---|---|
| Grain | (pieza_id, fecha, hora, shortlink_code, store) |
| Fuente | nmx_insumos.land_qcart_carritos |
| Métricas | impressions, views, total_shown_price (TRY_CAST a BIGINT/DOUBLE) |
| Resultados | 4,659 rows — 37 piezas — fechas 2026-03-14 a 2026-10-21 |
| ⚠️ Caveats | Ver OI-13 (duplicados grain) + OI-14 (quincena vacío) |

### fact_evento_qcart_productos
| Decisión | Valor |
|---|---|
| Grain | (pieza_id, fecha, hora, shortlink_code, product, store) |
| Fuente | nmx_insumos.land_qcart_productos |
| Métricas | impressions, views, total_shown_price (TRY_CAST) |
| Resultados | 1,683 rows — 37 piezas |

---

## Repo GitHub — estructura

```
CRM-Omnicom-Clients/Dashboards-Nestle-MX
└── negocio/nestle/reportes-consolidado/
    ├── docs/
    │   ├── ESTADO.md              ← este archivo
    │   ├── ARQUITECTURA.md        ← 4 DBs, tablas, flujo, decisiones
    │   └── OPERACIONES.md         ← runbook semanal (pendiente Etapa 7)
    ├── referencia/
    │   ├── (Interno-Copy))-Reporte-Consolidado-Nestle-2026-v8.xlsx   ← read-only
    │   └── (Interno) Envios sin CDP _ Hive.xlsx                      ← read-only
    ├── catalogo/
    │   └── Catalogo-Nestle-MX.xlsx    ← Rick edita aquí cada semana
    ├── insumos/
    │   ├── wa_envios.csv              ← Rick sube archivo WA por corte
    │   ├── qcart_carritos.csv         ← Rick sube datos Qcart carritos
    │   └── qcart_productos.csv        ← Rick sube datos Qcart productos
    ├── workflow/                       ← proyecto TD nmx_crm_reporte (ID: 2105350)
    │   ├── nmx_crm_reporte.dig
    │   ├── catalogo.dig
    │   ├── hechos.dig                 ← 8 tareas: drop+rebuild × 4 canales
    │   ├── manifest.yml
    │   ├── tdx.json
    │   └── queries/
    │       ├── catalogo/              ← 10 rebuild_dim_*.sql
    │       └── hechos/
    │           ├── rebuild_fact_envio_email.sql
    │           ├── rebuild_fact_envio_whatsapp.sql
    │           ├── rebuild_fact_evento_qcart_carritos.sql
    │           └── rebuild_fact_evento_qcart_productos.sql
    └── _historico/                    ← archivado (no se usa)
```

---

## Decisiones firmes

| ID | Decisión |
|---|---|
| Q0 | Todo en TD |
| Q4 | Email se lee en prod_sfmc_*, nunca se copia |
| Q5 | Solo jobs automáticos escriben en TD |
| OI-02 | Grain fact_envio_email = (pieza_id, email_job_id), sends >= 10 |
| OI-R1 | Repo GitHub = CRM-Omnicom-Clients/Dashboards-Nestle-MX |
| OI-R2 | Workflow push + merge lo hace el asistente con token |
| — | Catálogo se edita como XLSX (no CSVs) |
| — | sh> bloqueado → recarga catálogo = script local (Option B) |
| — | Principal + FUP se agrupan en rpt_email, no en el fact |
| — | WA + Qcart = archivos en repo `insumos/`; Rick los sube cada corte |
| — | Grain WA = (pieza_id, whatsapp_name, quincena) — pieza_id declarado por Rick en Excel |
| — | Qcart: columnas con ñ/acentos sanitizadas a ASCII en reload_catalog.py |

---

## Preguntas pendientes

| ID | Pregunta | Etapa | Dueño |
|---|---|---|---|
| OI-09 | Naming standard para WA_Name en piezas sin nombre SFMC | 4b | Rick |
| OI-10 | Reconciliar conteos de shortlinks (82 en catálogo vs datos reales) | 4c | Rick |
| OI-12 | Spec diseño visual del dashboard (columnas, filtros, orden) | 6 | Rick |
| OI-13 | Duplicados en grain de fact_evento_qcart_carritos: 4,659 rows vs 4,090 grains únicos. Causa: fuente CSV combina 2 exportaciones con rangos de fecha solapados (fuente `...2026-08-01-2026-09-09...` y `...2026-08-01-2026-10-06...`). Para rpt_qcart: ¿deduplicar por MAX(views) o re-exportar CSV sin solapamiento? | 5 | Rick |
| OI-14 | quincena vacío en 44% de fact_evento_qcart_carritos (2,063/4,659 rows) a lo largo de todo el rango de fechas — ¿es intencional o falta llenar en la fuente? | 5 | Rick |

---

## Fuera de scope

- Excel formateado (legacy — sigue existiendo, no se toca)
- Análisis a nivel persona
- Reporte Maggi (proyecto separado)
- Cambios dentro de SFMC
