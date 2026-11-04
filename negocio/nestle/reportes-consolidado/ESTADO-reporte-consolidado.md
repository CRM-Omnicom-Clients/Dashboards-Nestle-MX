---
title: "ESTADO: Reporte Consolidado Nestlé México en Treasure Data"
updated: 2026-11-04
status: "reload_catalog.py FUNCIONAL (10/10 tablas) + nmx_crm_reporte SUCCESS. Siguiente: Etapa 4 Hechos workflow (email attribution + WA + Qcart)"
owner: Rick Aguilar
---

# ESTADO: Reporte Consolidado Nestlé México en Treasure Data

> Documento de trabajo. Se actualiza en cada sesión. Fuente de verdad para decisiones, esquemas y avance.

---

## Plan de etapas

| # | Etapa | Estado | Qué produce |
|---|---|---|---|
| **1** | **Arquitectura** | **✓ COMPLETA** | Esquemas, vocabularios confirmados, plan de repo y workflow |
| **0** | **Bootstrap** | **✓ COMPLETA** | 4 DBs + 10 seeds en nmx_insumos + workflow permissions + GitHub repo |
| **2** | **Repositorio** | **✓ COMPLETA** | `negocio/nestle/reportes-consolidado/` en GitHub con CSVs v8, workflow y queries |
| **catalogo.dig** | **Catálogo (subtarea)** | **✓ COMPLETA** | nmx_insumos → nmx_catalogo: 10 tablas, idempotente, 24/24 tareas exitosas |
| **3** | **Landing / Recarga catálogo** | **✓ COMPLETA** | `reload_catalog.py` carga 10/10 tablas en nmx_insumos; `nmx_crm_reporte` SUCCESS |
| 4 | Hechos workflow | Pendiente | `04_hechos.dig` + Gate 2: email + WA + Qcart → nmx_hechos |
| 5 | Reporte workflow | Pendiente | `06_reporte.dig`: nmx_hechos → nmx_reporte (3 secciones, validado vs Excel) |
| 6 | Dashboard | Pendiente | Studio dashboard con diseño fijo; schedule semanal activado |
| 7 | Operabilidad | Pendiente | Cold run por teammate; OPERACIONES.md; traspaso |

---

## Flujo de datos

```
Repo GitHub privado (CSV editados por el equipo)
    │
    │  job pull (Etapa 3)
    ▼
nmx_insumos     ← archivos exactamente como llegan, append-only
    │
    │  Gate 1: checks sobre los inputs
    │
    │  jobs de conformación (Etapa 4)
    ▼
nmx_catalogo    ← catálogo aprobado, vocabularios, reglas, shortlinks
    │
    │  jobs de hechos (Etapa 5)
    ▼
nmx_hechos      ← facts normalizadas, sin texto de dimensión, con claves
    │
    │  Gate 2: checks sobre el modelo
    │
    │  jobs de reporte (Etapa 6)
    ▼
nmx_reporte     ← 3 secciones del reporte a grain de reporte
    │
    ▼
Studio dashboard (Etapa 7)
```

El repo es la **puerta de entrada** para datos editados a mano.
Las bases de datos de TD son donde **viven los datos con la estructura correcta**.

---

## Las 4 bases de datos

| DB | Nombre | Qué contiene |
|---|---|---|
| 0 | `prod_sfmc_emailengagement` *(y prod_sfmc_sends)* | Email data ya en TD. Solo lectura, nunca se copia. |
| 1 | `nmx_insumos` | Los archivos tal como llegan del repo. Sin procesar. Append-only. |
| 2 | `nmx_catalogo` | Catálogo aprobado: piezas, vocabularios cerrados, shortlinks, nombres, bridge. |
| 3 | `nmx_hechos` | Facts normalizadas: email (attribution), WA, Qcart. Con claves, sin texto de dimensión. |
| 4 | `nmx_reporte` | Las 3 secciones del reporte + resultados de checks. Lo que lee el dashboard. |

---

## Esquemas de tablas con PKs y FKs

### `nmx_insumos` (DB-1)

Archivos crudos. Sin validación. Cada carga genera un `load_id` nuevo.

| Tabla | PK | Columnas clave |
|---|---|---|
| `land_catalogo` | (load_id, fila_fuente) | todas las columnas del CSV + load_id |
| `land_referencias` | (load_id, fila_fuente) | todas las columnas del CSV + load_id |
| `land_shortlinks` | (load_id, fila_fuente) | todas las columnas del CSV + load_id |
| `land_whatsapp` | (load_id, fila_fuente) | todas las columnas del CSV + load_id |
| `land_qcart_carritos` | (load_id, fila_fuente) | todas las columnas del CSV + load_id |
| `land_qcart_productos` | (load_id, fila_fuente) | todas las columnas del CSV + load_id |
| `land_load_log` | load_id | archivo, repo_commit, n_filas_fuente, n_filas_cargadas, run_id, as_of_date, fecha_hora |

---

### `nmx_catalogo` (DB-2)

```
dim_bu
  PK: bu_id (int)
  Columnas: bu_nombre, estado (activo/retirado)

dim_marca
  PK: marca_id (int)
  FK: bu_id → dim_bu
  Columnas: marca_nombre, estado

dim_campana
  PK: campana_id (int)
  FK: bu_id → dim_bu  [NOTA: campana puede cruzar BUs; bu_id es BU primaria]
  Columnas: campana_nombre, estado

dim_objetivo
  PK: objetivo_id (int)
  Columnas: objetivo_nombre, estado

dim_touchpoint_brief            ← nombre definitivo (los códigos son del brief)
  PK: touchpoint_id (int)
  Columnas: touchpoint_brief (el código: E-A1, WA-C2, etc.), canal (Email/WhatsApp), estado
  FUTURO: tabla dim_touchpoint con nombres legibles y reglas de naming

dim_segmento
  PK: segmento_id (int)
  Columnas: segmento_nombre, mascota (Gatos/Perros/Mixto/NULL), estado
  NOTA: Pro Plan es marca, no segmento → los segmentos son Aspiracionales, Educated Pet Owners, Pet Parents

tabla_piezas                    ← la tabla central del catálogo
  PK: pieza_id (varchar, ej. "001-P001")
  FK: campana_id    → dim_campana
  FK: marca_id      → dim_marca
  FK: bu_id         → dim_bu
  FK: objetivo_id   → dim_objetivo
  FK: touchpoint_id → dim_touchpoint_brief
  FK: pieza_principal_id → tabla_piezas  (nullable; FUPs apuntan a su Principal)
  Columnas: canal (Email/WhatsApp), email_type (Principal/FUP/NULL),
            tipo_envio, fecha_primer_envio, estado, notas
  NOTA: sin segmento_id — los segmentos van en pieza_segmento (M:M)

pieza_segmento                  ← bridge M:M (nueva — una pieza puede tener N segmentos)
  PK: (pieza_id, segmento_id)
  FK: pieza_id    → tabla_piezas
  FK: segmento_id → dim_segmento

tabla_nombres                   ← mapeo nombre_unico → pieza_id
  PK: nombre_unico              (el Email_Name o WA_Name exacto tal como viene de SFMC)
  FK: pieza_id → tabla_piezas
  Columnas: canal (Email/WhatsApp), fecha_aprobacion, aprobado_por, motivo

dim_shortlink
  PK: shortlink_code            (ej. "Mb4KvUvP")
  FK: pieza_id → tabla_piezas
  Columnas: nombre_receta, tienda, fecha_activacion,
            excluido (bool), motivo_exclusion

map_alias
  PK: (dimension, valor_crudo, contexto)
  Columnas: valor_canonico, fuente, notas
  Nota: valor_canonico debe existir en la dim_* correspondiente (CHK-03)

map_exclusion
  PK: (tipo, valor)             (tipo: link / event / pieza)
  Columnas: motivo, excluido_por, fecha
  Regla: motivo nunca vacío (CHK-13)

dim_clase_click
  PK: clase_id
  Columnas: clase_nombre, familia (intent/engagement/mechanics/unresolved)

map_patron_click
  PK: orden                     (primera coincidencia gana)
  FK: clase_id → dim_clase_click
  Columnas: patron_url (regex), notas

decision_log
  PK: decision_id
  Columnas: tipo, descripcion, aprobado_por, fecha, commit_git
```

---

### `nmx_hechos` (DB-3)

```
dim_fecha
  PK: fecha (YYYY-MM-DD)
  Columnas: quincena (YYYY-MM-Qn), mes_nombre, mes_numero, semana_iso

fact_envio_email                ← attribution layer (no copia datos — lee prod_sfmc_*)
  PK: (pieza_id, job_id, fecha_envio)
  FK: pieza_id    → nmx_catalogo.tabla_piezas
  FK: fecha_envio → dim_fecha
  Columnas: sends, deliveries, opens, clicks, unsubs, bounces,
            delivery_rate, open_rate, click_rate, ctor
  GRAIN: pendiente confirmación final (OI-02)

fact_click_link
  PK: (pieza_id, url)
  FK: pieza_id  → nmx_catalogo.tabla_piezas
  FK: clase_id  → nmx_catalogo.dim_clase_click
  Columnas: n_clicks (unique por link)

fact_envio_whatsapp
  PK: (pieza_id, fecha_envio, touchpoint_id)
  FK: pieza_id      → nmx_catalogo.tabla_piezas
  FK: fecha_envio   → dim_fecha
  FK: touchpoint_id → nmx_catalogo.dim_touchpoint_brief
  Columnas: sends, deliveries, no_entregados, reads, clicks,
            clicks_medidos (bool), notas
  Regla: clicks_medidos = false → clicks es NULL, no 0 (CHK-08)

fact_evento_qcart_carritos
  PK: (fecha, hora, shortlink_code, store)
  FK: shortlink_code → nmx_catalogo.dim_shortlink
  FK: fecha          → dim_fecha
  Columnas: views, total_shown_price, impressions

fact_evento_qcart_productos
  PK: (fecha, hora, shortlink_code, store, producto)
  FK: shortlink_code → nmx_catalogo.dim_shortlink
  FK: fecha          → dim_fecha
  Columnas: views, total_shown_price, impressions

map_ancla_qcart
  PK: (mes, pieza_id)
  FK: pieza_id → nmx_catalogo.tabla_piezas
  Columnas: quincena_ancla, motivo, run_id
  Regla: solo ancla a rows que existen en rpt_email (CHK-07)

test_result
  PK: (run_id, check_id)
  Columnas: estado (passed/failed/no_evaluado), n_filas_problema, detalle, fecha_hora
```

---

### `nmx_reporte` (DB-4)

```
rpt_email
  PK: pieza_id
  FK: pieza_id → nmx_catalogo.tabla_piezas
  Columnas: métricas de email (Principal + FUP + Totales) — lista a definir Etapa 6

rpt_whatsapp
  PK: (pieza_id, touchpoint_id)
  FK: pieza_id      → nmx_catalogo.tabla_piezas
  FK: touchpoint_id → nmx_catalogo.dim_touchpoint_brief
  Columnas: métricas WA — lista a definir Etapa 6

rpt_qcart
  PK: (pieza_id, quincena)
  FK: pieza_id → nmx_catalogo.tabla_piezas
  Columnas: carritos por tienda, views, penetración, ticket, intención MXN — Etapa 6

override_reporte
  PK: override_id
  FK: pieza_id → nmx_catalogo.tabla_piezas
  Columnas: seccion, columna, valor_correcto, valor_anterior, motivo, quien, fecha
```

---

## Vocabularios confirmados (nmx_catalogo)

### dim_bu
```
Culinarios (RN)
Nescafé
Purina
Chocolates
Family Nes
```

### dim_marca (11, v8 confirmado)
```
Recetas Nestlé       → Culinarios (RN)
Carnation / La Lechera → Family Nes
La Lechera           → Family Nes
Maggi (Culinarios)   → Culinarios (RN)
Maggi (Selección)    → Culinarios (RN)
Clásico              → Nescafé
ICE                  → Nescafé
Concentrate          → Nescafé
Pro Plan             → Purina
Dog Chow             → Purina
KitKat               → Chocolates
NAN                  → Family Nes
```

### dim_campana (13, v8)
```
AON
Antojo Infinito
Centenario Nestlé (100 años)
Checo
F1
Fuel for life
Hackea tu café
Hotcakes
Liga MX
Mundial
Tercer Tiempo
Territorios
The Freshers
```

### dim_objetivo (11, v8)
```
Awareness
Consider
Descarga App
Enrichment
Inspiration
Loyalty
NO SE ENVIO
Prevención de Churn
Promoción
Purchase
WinBack
```

### dim_touchpoint_brief (79, v8)
*(E-* = Email, WA-* = WhatsApp — +18 respecto a v7)*
```
E-A1        E-A2        E-APP       E-C1        E-D1
E-D2        E-E3        E-E4        E-ENRICH1   E-Hack1
E-Hack2     E-Hack2-AON E-Hack3     E-Hack3-AON E-Hack4
E-Hack4-AON E-I1        E-I2        E-J10       E-J4
E-J5        E-J6        E-J7        E-J8        E-J9
E-L1        E-L2        E-L3        E-L4        E-P1
E-P2        E-P3        E-P4        E-PROP1     E-PROP2
E-Rit1      E-Rit1-AON  E-Rit2      E-Rit2-AON  E-Rit3
E-SNM-3     E-T1        E-T2        E-T3        Final
Partido 2   Partido 3   Semifinal A Semifinal B
WA-1        WA-2        WA-A1       WA-C1       WA-C2
WA-C3       WA-C4       WA-J10      WA-J8       WA-J9
WA-SNM-2    WA-SNM-3
```
*FUTURO: tabla dim_touchpoint con nombres legibles y reglas de naming.*

### dim_segmento (52, v8 — +5 respecto a v7)

Nuevos en v8: `Femenil Futbol`, `Aspiracionales/Perros`, `Educated Pet Owners/Perros`, `WA-opt-in segments` (→ Cooking/Botanas/Bebidas WA-opt-in), `Gen Z Cafés WA-opt-in`

| segmento_nombre | mascota |
|---|---|
| Activos | NULL |
| Amazon | NULL |
| Aspiracionales | NULL |
| Aspiracionales | Gatos |
| Aspiracionales | Mixto |
| Bebidas | NULL |
| Botana | NULL |
| Botanas WA-opt-in | NULL |
| Career Focused | NULL |
| Combinado | NULL |
| Cooking WA-opt-in | NULL |
| Bebidas WA-opt-in | NULL |
| Dinkies y Empty Nesters | NULL |
| Educated Pet Owners | NULL |
| Educated Pet Owners | Gatos |
| Educated Pet Owners | Mixto |
| FamilyKids | NULL |
| Futboleros | NULL |
| Futboleros Cafés WA-opt-in | NULL |
| Futboleros Recetas WA-opt-in | NULL |
| Gen Z Cafés | NULL |
| Indulgentes | NULL |
| Interés Salado | NULL |
| Mamás c/hijos 1 a 3 años | NULL |
| Modern Cooking | NULL |
| New Parents | NULL |
| Pet Parents | NULL |
| Pet Parents | Gatos |
| Pet Parents | Mixto |
| Pet Parents | Perros |
| Potencial Chocolates | NULL |
| Premium Cafés | NULL |
| Premium Cafés Usuarios nuevos | NULL |
| Productive Adults | NULL |
| Prácticos | NULL |
| Re-enganchables | NULL |
| Región unificada | NULL |
| Saludables | NULL |
| Sin Cluster | NULL |
| Tibios | NULL |
| Traditional Parents | NULL |
| Usuarios CON región | NULL |
| Usuarios activos sin click en App | NULL |
| Usuarios con Engagement | NULL |
| Usuarios sin región | NULL |
| Walmart | NULL |
| Wellness Navigators | NULL |
| Young Creatives | NULL |

*NOTA: "Aspiracionales + Educated Pet Owners" (las 3 piezas con Gatos/Mixto/Perros) se modelan como 2 filas en pieza_segmento: Aspiracionales + Educated Pet Owners.*
*NOTA: "All Segments WA-opt-in" (Cooking+Botanas+Bebidas) = 3 filas en pieza_segmento, no una entrada separada.*

---

## Estructura del repositorio GitHub (`nmx-crm-reporte`)

```
nmx-crm-reporte/
│
├── README.md
├── .gitignore
│
│  ── DATOS ── (editados por el equipo, fuente de verdad)
│
├── catalogo/
│   ├── piezas.csv
│   ├── pieza_segmento.csv        bridge M:M pieza ↔ segmento
│   ├── nombres.csv               nombre_unico → pieza_id (Email + WA)
│   ├── shortlinks.csv
│   └── vocabularios/
│       ├── bu.csv
│       ├── marcas.csv
│       ├── campanas.csv
│       ├── objetivos.csv
│       ├── touchpoints_brief.csv
│       └── segmentos.csv
│
├── whatsapp/
│   └── envios.csv                actualizar en cada corte
│
├── qcart/
│   ├── carritos.csv
│   └── productos.csv
│
│  ── WORKFLOW ── (código TD — pushed con `tdx wf push workflow/`)
│
├── workflow/
│   ├── manifest.yml
│   ├── nmx_crm_reporte.dig       orquestador principal
│   ├── tasks/
│   │   ├── 01_landing.dig        GitHub pull → nmx_insumos
│   │   ├── 02_gate1.dig          checks pre-catálogo
│   │   ├── 03_catalogo.dig       nmx_insumos → nmx_catalogo
│   │   ├── 04_hechos.dig         catálogo + SFMC + insumos → nmx_hechos
│   │   ├── 05_gate2.dig          checks post-hechos
│   │   └── 06_reporte.dig        nmx_hechos → nmx_reporte
│   └── queries/
│       ├── landing/              land_*.sql (append-only a insumos)
│       ├── catalogo/             rebuild_*.sql (idempotente, 10 tablas)
│       ├── hechos/               rebuild_fact_*.sql
│       ├── reporte/              rebuild_rpt_*.sql
│       └── checks/               gate1_*.sql y gate2_*.sql
│
└── docs/
    ├── ARQUITECTURA.md
    ├── OPERACIONES.md            runbook operativo
    └── VOCABULARIOS.md           valores canónicos de cada dimensión
```

### Convenciones de nomenclatura

| Qué | Convención | Ejemplo |
|---|---|---|
| SQL queries | `verbo_objeto.sql` | `rebuild_dim_bu.sql`, `land_whatsapp.sql` |
| Prefijo `rebuild_` | drop + recreate idempotente | cada corrida produce el mismo resultado |
| Prefijo `land_` | append-only a insumos | no modifica ni deduplica |
| Prefijo `gate1_` / `gate2_` | checks: 0 filas = OK, >0 = falla | patrón uniforme |
| Tasks `.dig` | `NN_nombre.dig` numeradas | orden de ejecución visible en nombre |
| Tablas TD | `snake_case` sin prefijo BU | namespaced por DB |
| DBs TD | prefijo `nmx_` | namespaced por proyecto |
| CSVs de datos | sustantivo simple | `piezas.csv` no `catalogo_piezas_v2.csv` |

---

## Formatos de archivos CSV (repo GitHub — Etapa 2+)

### `/catalogo/piezas.csv`
```
pieza_id, canal, email_type, tipo_envio, campana_id, marca_id, bu_id,
objetivo_id, touchpoint_id, pieza_principal_id, fecha_primer_envio, estado, notas
```
*(sin segmento — los segmentos van en pieza_segmento.csv)*

### `/catalogo/pieza_segmento.csv`
```
pieza_id, segmento_id
```

### `/catalogo/referencias.csv`
```
tipo, dimension, valor_crudo, valor_canonico, contexto, fuente, notas
```
`tipo` = vocabulario | alias | excluido

### `/catalogo/shortlinks.csv`
```
shortlink_code, pieza_id, nombre_receta, tienda, fecha_activacion, excluido, motivo_exclusion
```

### `/whatsapp/wa.csv`
```
pieza_id, whatsapp_name, fecha_envio, touchpoint, sends, deliveries,
no_entregados, reads, clicks, clicks_medidos, notas
```
- `pieza_id` obligatorio — único puente al catálogo
- `clicks_medidos` = "Sí" / "No"
- Sin columnas de dimensión (BU, Marca, etc.)

### `/qcart/carritos.csv` y `/qcart/productos.csv`
```
fecha, hora, shortlink_code, store, views, total_shown_price
(+ producto para productos.csv)
```

---

## Decisions status

### DECIDED (firmes)

Q0 Todo en TD · Q1 Rick puede crear DBs y jobs · Q2 Studio = dashboard · Q3 GitHub repo · Q4 Email se lee en lugar, nunca se copia · Q5 Solo jobs automáticos escriben · Q6 Check fallido para la corrida · Q7 Nombre nuevo espera aprobación · Q11 Dos acciones para operar · Q13 Teammates con acceso · Q14 Repo privado · Q15 Pull desde GitHub · Q16 Solo Rick aprueba catálogo · Q17 Email al fallar · Q19 Post-build: IA solo corre y lee · Q20 Repo de datos ≠ NUBE-CLAUD

### Confirmado en sesiones Oct 2026

| Punto | Decisión |
|---|---|
| Output al cliente | Dashboard. Excel sigue como legacy. |
| Estructura del reporte | 3 secciones: rpt_email, rpt_whatsapp, rpt_qcart |
| Repo conectado | GitHub ya conectado a TD |
| Email DB | prod_sfmc_emailengagement + prod_sfmc_sends (read-only) |
| Email key | Email_Name (nombre_unico) → pieza_id |
| Shortlink | Único key de atribución email/WA → Qcart |
| Tres relojes | event_time, report_time (quincena), cut_time (as-of) |
| pieza_id | Entero simple: 1, 2, 3... (o formato "001-P001") |
| Pieza = un canal | Una pieza es Email OR WhatsApp, nunca los dos |
| Cross-channel join | A nivel campaña/segmento/quincena, no pieza_id |
| Segmentos M:M | Bridge table pieza_segmento |
| Pro Plan = marca | "Pro Plan" no va en dim_segmento; sus segmentos son Aspiracionales/Educated Pet Owners/Pet Parents |
| Mascota = columna | dim_segmento tiene columna mascota (Gatos/Perros/Mixto/NULL) |
| Canal | Solo Email y WhatsApp |
| tabla_nombres | nombre_unico (no nombre_fisico) → pieza_id |
| WA naming | SFMC-style como email. Cortos (Hotcakes/Mundial) válidos tal como están. N/A = pendiente |
| dim_touchpoint_brief | Renombrado (códigos son del brief; naming legible = trabajo futuro) |

---

## Preguntas pendientes

| ID | Pregunta | Etapa | Dueño |
|---|---|---|---|
| OI-R1 | ¿Nombre del repo GitHub ya conectado a TD? | 0 | Rick |
| OI-R2 | ¿Workflow push lo hace Rick o el asistente con token? | 0 | Rick |
| OI-02 | Grain final del fact de email (pendiente confirmar con email DB) | 5 | Rick |
| OI-09 | Naming standard para WA_Name en piezas sin nombre SFMC | 2 | Rick |
| OI-10 | Reconciliar conteos de shortlinks | 4 | Rick |
| OI-12 | Spec diseño visual del dashboard | 7 | Rick |
| OI-15 | Mecanismo de swap atómico de tablas en TD | 5 | Dev |
| OI-16 | Qué reloj va en la columna `time` de TD | 5 | Dev |
| dim_marca | Completar y confirmar lista canónica de marcas | 1 | Rick |

---

## Fuera de scope

- Excel formateado → legacy
- Hoja `Reporte_julio` → congelada
- Cambios dentro de SFMC
- Análisis a nivel persona (por ahora)
- Reporte Maggi → pendiente OI-11

---

## Archivos de referencia

| Archivo | Ubicación | Uso |
|---|---|---|
| HANDOFF-reporte-nestle-treasure-data.md | `my/uploads/` | Fuente de verdad para decisiones detalladas |
| Copia-151026-Reporte-Consolidado-Nestle-2026-v8.xlsx | `Dashboard CRM/Reporte Consolidado/` | Referencia de estructura actual |
| ddl.sql | `my/nmx_catalogo/` | CREATE TABLE statements (por generar) |
| seeds/*.csv | `my/nmx_catalogo/seeds/` | Seed data (por generar) |
