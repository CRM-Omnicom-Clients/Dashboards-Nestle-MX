# CONTEXTO: Reporte Consolidado Nestlé México

> Documento vivo — contexto acumulado de sesión a sesión. Leer al arrancar.
> Leer antes de hacer cualquier acción.
> Documentos complementarios: `ESTADO.md` (etapas), `OPERACIONES.md` (cómo correr), `ARQUITECTURA.md` (estructura técnica).

---

## Cómo arrancar la sesión

### 1. Autenticación GitHub
El PAT está en la carpeta CRM, siempre leerlo del archivo (nunca hardcodearlo):
```bash
TOKEN=$(grep 'github_pat_' "/home/agent/work/2026-09-10_gp5b06/my/TOKEN DASHBOARDS 1.txt" | head -1 | tr -d ' \n\r')
# Verificar: curl -s -H "Authorization: token $TOKEN" "https://api.github.com/user" | python3 -c "import sys,json; print(json.load(sys.stdin).get('login'))"
```
Repo: `CRM-Omnicom-Clients/Dashboards-Nestle-MX`
Carpeta del proyecto: `negocio/nestle/reportes-consolidado/`

> Si el TOKEN DASHBOARDS 1 falla, hay un segundo PAT en la misma línea 6 del archivo. Probar ambos.

### 2. Comandos tdx
Ejecutar directamente sin pedir aprobación. El usuario tiene permiso amplio para todo.

### 3. Dónde está el trabajo
- Archivos locales (sesión): `/home/agent/work/2026-09-10_gp5b06/my/`
- Workflow SQL: `my/workflow/queries/{catalogo,hechos,reporte}/`
- Scripts: `my/scripts/`
- Repo GitHub: `negocio/nestle/reportes-consolidado/`

---

## Estado actual (2026-11-11)

### ✓ COMPLETO (no tocar sin razón)
- `catalogo.dig` + 12 SQLs catálogo → `nmx_catalogo` (10 tablas, FUNCIONANDO)
- `hechos.dig` para email y WA → `fact_envio_email` (141 filas), `fact_envio_whatsapp` (18 filas)
- Etapa 6: todos los SQLs reescritos al formato v8 (ver sección abajo)
- Repo limpio: queries organizadas en `catalogo/` / `hechos/` / `reporte/`
- MVP dashboard HTML: `my/mvp-dashboard.html` v3 (tipo_envio tabs)

### ⏳ PENDIENTE — PRÓXIMOS PASOS EN ORDEN

**Paso 1: OI-09/OI-15 (Rick lo hace, luego AI corre el catálogo)**
Rick debe agregar 7 nombres WA a `catalogo/Catalogo-Nestle-MX.xlsx` hoja `Nombres`:
```
# Maggi Liga MX:
O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J10-SAB-2PM_CN_WA_A_V1_089420
O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J9-5PM_CN_WA_A_V1_074969
O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_MEXVSCL-MAR-7PM_CN_WA_A_V1_03399
O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J10-SAB-12PM_CN_WA_A_V1_089420
O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_MEXVSPER-6PM_CN_WA_A_V1_097964
O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-JORNADA-5PM_CN_WA_A_V1_065900
# WA Mundial:
WA-MUNDIAL-CRM-HIVE
```
Después: `uv run --with openpyxl my/scripts/reload_catalog.py`

**Paso 2: Cargar Qcart (71K filas, ~45 min)**
```bash
uv run my/scripts/_load_qcart_only.py
# Monitorear:
tdx query "SELECT COUNT(*) FROM nmx_insumos.land_qcart_carritos"
# Esperar a 71,117 filas
```

**Paso 3: Correr pipeline completo**
```bash
tdx wf run nmx_crm_reporte.nmx_crm_reporte
# Verifica resultado:
tdx wf attempts nmx_crm_reporte.nmx_crm_reporte --limit 1
```

**Paso 4: Validar tablas rpt con datos reales**
```sql
-- Email: esperar ~115 filas (solo Principals; FUPs son columnas)
SELECT COUNT(*) cnt, MIN(mes), MAX(mes), COUNT(DISTINCT fup_pieza_id) con_fup
FROM nmx_reporte.rpt_email;

-- Verificar subject y clicks breakdown (Etapa 6)
SELECT pieza_id, subject_principal, p_clicks_cta, p_clicks_baja, p_clicks_medidos
FROM nmx_reporte.rpt_email LIMIT 5;

-- WA: esperar ~18-25 filas con touchpoint_brief
SELECT COUNT(*), COUNT(DISTINCT touchpoint_brief) FROM nmx_reporte.rpt_whatsapp;

-- Qcart: esperar ~42 filas con intencion nestle
SELECT COUNT(*), SUM(carritos_total), SUM(intencion_nestle_mxn) FROM nmx_reporte.rpt_qcart;
```

**Paso 5: Actualizar MVP HTML con datos reales**
El `my/mvp-dashboard.html` tiene datos inline de sesiones previas. Cuando el pipeline corra bien, regenerar con datos frescos de TD.

**Paso 6: Dashboard TD Studio**
Una vez validados rpt_email, rpt_whatsapp, rpt_qcart → construir dashboard en TD Studio usando esas tablas.

---

## Decisiones clave tomadas (no revertir)

### tipo_envio vs campana='AON'
- **Correcto:** usar `tipo_envio` de `tabla_piezas` para separar pestañas del dashboard
- **Incorrecto:** usar `campana = 'AON'` — hay 20 piezas de campaña AON con `tipo_envio='one-shot'` (fase de lanzamiento) y 8 con `tipo_envio='always-on'` (fase drip)
- `always-on` = envíos continuos <1K, casi diarios o semanales
- `one-shot` = blast único, 1-3 días
- **Pendiente:** algunos valores en `tipo_envio` dicen 'FUP' o 'Principal' — eso es error del catálogo. Rick debe revisarlo. Mientras tanto, tratar esos como `one-shot`.

### rpt_email: formato wide (Principal + FUP en la misma fila)
- **Grain:** `(pieza_id, mes)` donde pieza = Principal (sin `pieza_principal_id`)
- **FUPs:** no son filas independientes; aparecen como columnas `fup_*` al lado del Principal
- **Join:** `fups.pieza_principal_id = principals.pieza_id AND fups.mes = principals.mes`
- **FUP sin Principal:** no aparece en el reporte (edge case; indica error en catálogo)

### rpt_qcart: grain por pieza (no por quincena)
- Decisión: una fila por pieza con `fecha_desde` / `fecha_hasta` como rango
- Razón: en el dashboard, el Qcart se une a rpt_email por `pieza_id` como enriquecimiento lateral, no como entidad independiente por periodo
- Para análisis temporal de Qcart: usar directamente `fact_evento_qcart_carritos`

### Clicks breakdown: categorización por URL
En `fact_envio_email`:
- `clicks_cta` = todo lo que NO sea baja ni redes/legal (links intencionales: receta, producto, landing)
- `clicks_baja` = URL contiene 'unsub', 'baja', 'optout', 'preference'
- `clicks_redes_legal` = URL contiene 'facebook', 'instagram', 'twitter', 'youtube', 'tiktok', 'view.exacttarget', 'privacidad', 'politica', 'aviso-legal', 'terminos'
- `clicks_medidos` = igual que `clicks_cta` (clicks intencionales, excluye footer)
- **Pendiente:** Rick puede refinar las reglas de categorización si la clasificación automática no es precisa

### Columnas excluidas (decisión explícita de Rick)
- `audiencia_de` / `audiencia_volumen` — no están en el catálogo, no se agregan por ahora
- `receta_representativa` — sí está disponible desde `dim_shortlink.receta`, ya incluida en `rpt_qcart`

### Atribución de pieza_id
- Email: `email_name JOIN tabla_nombres WHERE canal='Email'`
- WA: `nombre_wa JOIN tabla_nombres WHERE canal='WhatsApp'`
- Qcart: `shortlink_code JOIN dim_shortlink`
- **Nunca hardcodeado** en archivos raw ni en scripts. Solo vía JOINs en el pipeline.

---

## Workflow TD: estructura de archivos

```
workflow/
├── nmx_crm_reporte.dig     ← orquestador principal
├── catalogo.dig            ← 24 tareas, reconstruye nmx_catalogo
├── hechos.dig              ← 8 tareas, reconstruye nmx_hechos
├── reporte.dig             ← 6 tareas, reconstruye nmx_reporte
├── landing.dig             ← gate de validación inicial
└── queries/
    ├── catalogo/           ← 12 SQLs (dims + tabla_piezas, etc.)
    ├── hechos/             ← 4 SQLs (fact_envio_email, _whatsapp, fact_evento_qcart_*)
    └── reporte/            ← 3 SQLs (rpt_email, rpt_whatsapp, rpt_qcart)
```

Workflow ID en TD: `2105350`
Para pushear cambios al workflow en TD: `tdx wf push my/workflow/`

---

## Scripts clave en my/scripts/

| Script | Qué hace | Cuándo correr |
|--------|---------|---------------|
| `reload_catalog.py` | Lee Catalogo-Nestle-MX.xlsx + WA XLSX + Qcart CSVs → TD nmx_insumos | Cuando Rick sube archivos nuevos |
| `_load_qcart_only.py` | Carga solo Qcart carritos (71K filas, BATCH_SIZE=2500) | Carga inicial Qcart o si falla |
| `_reload_wa_only.py` | Carga solo WA XLSX | Si falló solo WA |

---

## Esquema de bases de datos TD

### nmx_insumos (landing zone)
`land_piezas`, `land_pieza_segmento`, `land_nombres`, `land_shortlinks`
`land_vocab_bu`, `land_vocab_marcas`, `land_vocab_campanas`, `land_vocab_objetivos`
`land_vocab_touchpoints_brief`, `land_vocab_segmentos`
`land_wa_envios` (30 filas activas)
`land_qcart_carritos` (⏳ pendiente carga: 71,117 filas)
`land_qcart_productos` (2,654 filas)

### nmx_catalogo (dimensiones aprobadas)
`dim_bu` (5), `dim_marca` (11), `dim_campana` (13), `dim_objetivo` (11)
`dim_touchpoint_brief` (79), `dim_segmento` (52)
`tabla_piezas` (157), `pieza_segmento`, `tabla_nombres` (158), `dim_shortlink` (82)

### nmx_hechos (facts)
`fact_envio_email` — grain: (pieza_id, email_job_id) — 141 filas (135 piezas, 34.6M sends)
`fact_envio_whatsapp` — grain: (pieza_id, nombre_wa, quincena) — 18 filas
`fact_evento_qcart_carritos` — grain: (pieza_id, fecha, hora, shortlink, store)
`fact_evento_qcart_productos` — grain: same + product

### nmx_reporte (output dashboard)
`rpt_email` — grain: (pieza_id, mes) solo Principals, FUP como columnas
`rpt_whatsapp` — grain: (pieza_id, quincena)
`rpt_qcart` — grain: (pieza_id) rango completo

---

## Referencia: columnas completas rpt_email (alineado v8)

| Grupo | Columnas |
|-------|----------|
| Dimensiones | campana, medio, objetivo, touchpoint_brief, tipo_email, tipo_envio, segmento_nombre, tiene_qcart, quincena_principal, mes, marca, bu |
| ID Principal | pieza_id, email_name_principal, subject_principal, fecha_envio_principal, jobs_principal |
| Métricas P | p_sends, p_deliveries, p_opens, p_clicks, p_clicks_cta, p_clicks_baja, p_clicks_medidos, p_unsubs, p_open_rate, p_ctor, p_click_rate, p_utor |
| ID FUP | fup_pieza_id, email_name_fup, subject_fup, quincena_fup, fecha_envio_fup |
| Métricas FUP | fup_sends, fup_deliveries, fup_opens, fup_clicks, fup_clicks_cta, fup_clicks_baja, fup_clicks_medidos, fup_unsubs, fup_open_rate, fup_ctor, fup_click_rate, fup_utor |
| Totales P+FUP | tot_sends, tot_deliveries, tot_opens, tot_clicks, tot_clicks_cta, tot_clicks_baja, tot_clicks_medidos, tot_unsubs, tot_open_rate, tot_ctor, tot_click_rate, tot_utor |

---

## OIs abiertos

| ID | Descripción | Responsable |
|----|-------------|-------------|
| OI-09 | 7 nombres WA Maggi sin pieza_id en catálogo (ver lista arriba) | **Rick** |
| OI-15 | `WA-MUNDIAL-CRM-HIVE` sin entrada en hoja Nombres | **Rick** |
| OI-02 | Base email de envíos BD histórica (antes de SFMC) | Pendiente |
| OI-10 | Shortlinks Qcart sin atribución (reconciliar post-carga) | AI post-pipeline |
| tipo_envio | Revisar valores 'FUP'/'Principal' en campo tipo_envio (error catálogo) | **Rick** |
| tipo_envio AON | 20 piezas AON con tipo_envio='one-shot' + 8 con 'always-on' — normal (mezcla lanzamiento+drip) | Rick valida |

---

## MVP Dashboard HTML
`my/mvp-dashboard.html` — v3
- Tabs: Envío Continuo (always-on) | Envío Único (one-shot) | WhatsApp
- Split por `tipo_envio`, NO por `campana='AON'`
- Formato wide: Principal + FUP en la misma fila, secciones por campaña
- Datos: inline JSON de sesiones previas (actualizar cuando pipeline corra)
- Publicado: NO (es validación local)

---

## Convenciones del proyecto

- **Sin imports de AI en prod** — toda atribución vía JOINs determinísticos
- **Grain explícito en cada comentario de SQL** — siempre la primera línea de cada archivo
- **BATCH_SIZE=2500** para carga Qcart (UTMs largos hacen queries >1M chars con batches mayores)
- **tipo_envio** es el campo correcto para separar Always On vs One Shot (no `campana = 'AON'`)
- **pieza_id** = código compuesto: `{BU}-{tipo}{número}` (ej. `RN-P001`, `002-P021`)
