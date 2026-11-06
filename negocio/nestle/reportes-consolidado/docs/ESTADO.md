---
title: "ESTADO: Reporte Consolidado Nestlé México en Treasure Data"
updated: 2026-11-05
status: "Etapa 4a completa. Pipeline email corriendo en TD. Faltan: 4b WA + 4c Qcart (datos), 5 rpt_*, 6 dashboard."
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
| Hechos email | `fact_envio_email` en nmx_hechos | ✓ Funcionando — 135 piezas, 34.6M sends |
| Hechos WA | `fact_envio_whatsapp` | Pendiente archivo de datos |
| Hechos Qcart | `fact_evento_qcart_*` | Pendiente archivos de datos |
| Reporte | `rpt_email`, `rpt_whatsapp`, `rpt_qcart` | Pendiente (Etapa 5) |
| Dashboard | Studio dashboard | Pendiente (Etapa 6) |

**Workflow en TD:** `nmx_crm_reporte` (ID: 2105350) — corre en ~54s. Llama catalogo.dig → hechos.dig.

---

## Plan general de etapas

| # | Etapa | Estado | Qué produce |
|---|---|---|---|
| **0** | **Bootstrap** | **✓ COMPLETA** | 4 DBs creadas + permisos workflow + repo GitHub inicializado |
| **1** | **Arquitectura** | **✓ COMPLETA** | Esquemas, vocabularios v8, decisiones firmadas |
| **2** | **Repositorio** | **✓ COMPLETA** | Repo GitHub con XLSX catálogo, workflow, queries |
| **3** | **Recarga catálogo** | **✓ COMPLETA** | `reload_catalog.py`: XLSX → 10 tablas nmx_insumos; `catalogo.dig`: 24/24 OK |
| **4a** | **Hechos email** | **✓ COMPLETA** | `fact_envio_email`: 141 jobs, 135 piezas, 34.6M sends |
| **4b** | **Hechos WA** | Pendiente datos | Necesita archivo WA en nmx_insumos |
| **4c** | **Hechos Qcart** | Pendiente datos | Necesita archivos Qcart (carritos + productos) |
| **5** | **Reporte** | Pendiente | `rpt_email`, `rpt_whatsapp`, `rpt_qcart` en nmx_reporte |
| **6** | **Dashboard** | Pendiente | Studio dashboard; schedule semanal activado |
| **7** | **Operabilidad** | Pendiente | OPERACIONES.md; cold run; traspaso |

---

## Sub-plan: lo que falta en detalle

### Etapas 4b + 4c — Hechos WA y Qcart
**Bloqueo: datos.** Rick sube los archivos al repo; el asistente los carga a nmx_insumos y escribe los SQLs.

| Paso | Acción | Quién |
|---|---|---|
| 4b-1 | Subir archivo WA (formato: pieza_id, whatsapp_name, fecha_envio, touchpoint, sends, deliveries, reads, clicks, clicks_medidos) al repo en `insumos/` | Rick |
| 4b-2 | Cargar WA a nmx_insumos + escribir `rebuild_fact_envio_whatsapp.sql` | AI |
| 4c-1 | Subir archivos Qcart (carritos + productos) al repo en `insumos/` | Rick |
| 4c-2 | Cargar Qcart a nmx_insumos + escribir `rebuild_fact_evento_qcart_*.sql` | AI |

### Etapa 5 — Tablas de reporte
**Sin bloqueo para email.** WA y Qcart esperan sus datos.

| Tabla | Qué hace | Bloqueo |
|---|---|---|
| `rpt_email` | Agrupa Principal + FUPs por pieza; sums + tasas (open_rate, click_rate, CTOR, delivery_rate) | Ninguno — puede hacerse ahora |
| `rpt_whatsapp` | Métricas WA por pieza + touchpoint | Espera 4b |
| `rpt_qcart` | Carritos, views, penetración, ticket promedio, intención MXN por pieza + quincena | Espera 4c |

### Etapa 6 — Dashboard
Requiere que las 3 tablas de reporte existan con datos reales para validar el diseño visual.
Pendiente de Rick: spec de diseño (OI-12) — qué columnas, en qué orden, qué filtros quiere el cliente.

### Etapa 7 — Operabilidad
- OPERACIONES.md: runbook del flujo semanal (quién hace qué, en qué orden)
- Cold run: que un teammate pueda correr el pipeline de cero
- Schedule semanal en TD: configurar trigger automático

---

## Proceso semanal actual (Etapas 0–4a operativas)

```
1. Rick actualiza Catalogo-Nestle-MX.xlsx en GitHub
       ↓
2. AI corre: uv run --with openpyxl .../my/scripts/reload_catalog.py
   → 10 tablas recargadas en nmx_insumos
       ↓
3. AI lanza workflow nmx_crm_reporte en TD  (tdx wf run nmx_crm_reporte.nmx_crm_reporte)
   → catalogo.dig reconstruye nmx_catalogo (24 tareas, ~20s)
   → hechos.dig reconstruye fact_envio_email (~30s)
   → Total: ~54s
```

Cuando tengamos 4b + 4c, el paso 1 también incluirá subir WA + Qcart.

---

## Flujo de datos

```
Repo GitHub (Catalogo-Nestle-MX.xlsx + insumos WA + Qcart)
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
nmx_hechos           ← facts por canal: email ✓, WA pendiente, Qcart pendiente
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
| 1 | `nmx_insumos` | Activa | 10 tablas catálogo (`land_vocab_*`, `land_piezas`, etc.). WA + Qcart pendientes. |
| 2 | `nmx_catalogo` | Activa | 10 tablas: dim_bu, dim_marca, dim_campana, dim_objetivo, dim_touchpoint_brief, dim_segmento, tabla_piezas, pieza_segmento, tabla_nombres, dim_shortlink |
| 3 | `nmx_hechos` | Parcial | fact_envio_email ✓. fact_envio_whatsapp y fact_evento_qcart_* pendientes. |
| 4 | `nmx_reporte` | Vacía | rpt_email, rpt_whatsapp, rpt_qcart — pendiente Etapa 5 |

---

## fact_envio_email — decisiones de diseño

| Decisión | Valor |
|---|---|
| Grain | (pieza_id, email_job_id) — un job real por fila |
| Filtro | total_sends >= 10 (excluye test sends; incluye transaccionales reales pequeños) |
| Principal vs FUP | Ambos en el fact. Se agrupan en `rpt_email` (Etapa 5). |
| Métricas | sends, delivered, bounces (hard+soft), unique_opens, unique_clicks, unique_unsubs |
| Resultados | 141 registros — 135 piezas — 34.6M sends — 3.2M opens — 47.8K clicks |

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
    │   └── README.md                  ← WA + Qcart irán aquí
    ├── workflow/                       ← proyecto TD nmx_crm_reporte (ID: 2105350)
    │   ├── nmx_crm_reporte.dig
    │   ├── catalogo.dig
    │   ├── hechos.dig
    │   ├── manifest.yml
    │   ├── tdx.json
    │   └── queries/
    │       ├── catalogo/              ← 10 rebuild_dim_*.sql
    │       └── hechos/
    │           └── rebuild_fact_envio_email.sql
    └── _historico/                    ← archivado (no se usa)
        ├── dashboard-crm-nestle-v3.html
        ├── que-vale-este-sistema.html
        └── backup-drafts/
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

---

## Preguntas pendientes

| ID | Pregunta | Etapa | Dueño |
|---|---|---|---|
| OI-09 | Naming standard para WA_Name en piezas sin nombre SFMC | 4b | Rick |
| OI-10 | Reconciliar conteos de shortlinks (82 en catálogo vs datos reales) | 4c | Rick |
| OI-12 | Spec diseño visual del dashboard (columnas, filtros, orden) | 6 | Rick |

---

## Fuera de scope

- Excel formateado (legacy — sigue existiendo, no se toca)
- Análisis a nivel persona
- Reporte Maggi (proyecto separado)
- Cambios dentro de SFMC
