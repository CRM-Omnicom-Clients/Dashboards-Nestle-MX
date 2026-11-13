# OPERACIONES: Reporte Consolidado Nestlé México

> Runbook del flujo de actualización de datos. Versión operativa — Etapas 0–6 implementadas.

---

## Arquitectura del pipeline (actualizada 2026-11-13)

**El pipeline corre automáticamente L–V 03:33 CDMX (schedule #640115).**

```
GitHub (insumos/_derived/)      TD Workflow: nmx_crm_reporte
──────────────────────────      ──────────────────────────────────────────
*.csv (10 archivos catálogo) ─► landing.dig  ← SOLO recarga si hay cambios
wa_envios.csv                   │  detect.py: SHA GitHub vs sync_markers
qcart_carritos_*.csv            │  load.py:   catalogo / wa / qcart (paralelo)
qcart_productos_*.csv           │
                                ├─► catalogo.dig → nmx_catalogo (dim_* + tabla_*)
                                ├─► hechos.dig   → nmx_hechos   (fact_*)
                                └─► reporte.dig  → nmx_reportes (rpt_*)
```

> Para el flujo completo con diagramas, ver `ARQUITECTURA.md`.
> Para los esquemas de cada tabla, ver `ESQUEMA-BASES-DE-DATOS.md`.

---

## Proceso de actualización

### Cuándo hace falta intervención manual

El pipeline corre automáticamente. Solo se requiere acción manual en dos casos:

1. **Rick sube archivos nuevos al repo** → el pipeline del día siguiente los detecta y carga
2. **Actualizar el dashboard** → correr `build_dashboard_data.py` y hacer push del `.js` (Paso 5 abajo)

---

### Paso 0 — Subir archivos insumos al repo

Acceder al repo `CRM-Omnicom-Clients/Dashboards-Nestle-MX`, carpeta:
```
negocio/nestle/reportes-consolidado/insumos/
```

| Canal | Archivo esperado | Notas |
|---|---|---|
| Email | `email-YYYY-MM-*.csv` | Un CSV por quincena, delimitador `;` |
| WhatsApp | `*.whatsapp*.xlsx` (ej. `NMX-WhatsApp-2026-Q3.xlsx`) | Multi-hoja |
| Qcart carritos | `*carts-raw*.csv` | Delimitador `;` |
| Qcart productos | `*products-raw*.csv` | Delimitador `;` |

> **Importante Qcart**: el CSV puede tener 70K+ filas. El loader usa BATCH_SIZE=2500
> para evitar el límite de 1M chars/query de TD Presto. Con filas de UTMs largos,
> la carga tarda ~45 minutos.

---

### Paso 1 — Actualizar el catálogo (solo si cambió)

Si se agregaron nuevas piezas, journeys de WA, o shortlinks:

1. Rick edita `catalogo/Catalogo-Nestle-MX.xlsx` y hace commit/push al repo
2. El GitHub Action convierte el XLSX a CSVs automáticamente
3. El pipeline de la próxima madrugada detecta el cambio (SHA diferente) y recarga

> **Ya no es necesario correr `reload_catalog.py` manualmente** — el landing autónomo lo hace.
> El script sigue disponible como fallback en `my/scripts/reload_catalog.py`.

---

### Paso 2 — Correr el pipeline

**Normalmente no es necesario — corre automático a las 03:33.**

Para forzar una corrida manual:
```bash
tdx wf start nmx_crm_reporte.nmx_crm_reporte
```

El pipeline corre en orden:
```
catalogo.dig → hechos.dig → reporte.dig
├── catalogo.dig     # recarga las 10 tablas de dimensiones
├── hechos.dig       # reconstruye fact_envio_email, _whatsapp, fact_evento_qcart_*
└── reporte.dig      # reconstruye rpt_email, rpt_whatsapp, rpt_qcart
```

Verificar que el intento más reciente quedó en estado `success`:
```bash
tdx wf attempts nmx_crm_reporte.nmx_crm_reporte --limit 1
```

---

### Paso 3 — Validar resultados

```sql
-- Email: grain (pieza_id, mes) — solo Principals, FUP al lado como columnas
SELECT COUNT(*) cnt, COUNT(DISTINCT pieza_id) piezas,
       MIN(mes) min_mes, MAX(mes) max_mes,
       COUNT(DISTINCT fup_pieza_id) piezas_con_fup
FROM nmx_reporte.rpt_email;

-- Verificar columnas clave de Etapa 6 (subject + clicks breakdown)
SELECT pieza_id, subject_principal, p_clicks_cta, p_clicks_baja, p_clicks_medidos,
       fup_pieza_id, fup_sends, tot_open_rate, tot_ctor
FROM nmx_reporte.rpt_email LIMIT 5;

-- WhatsApp: grain (pieza_id, quincena)
SELECT COUNT(*) cnt, COUNT(DISTINCT pieza_id) piezas,
       MIN(quincena) min_q, MAX(quincena) max_q
FROM nmx_reporte.rpt_whatsapp;

-- Qcart: grain (pieza_id) — una fila por pieza con rango completo
SELECT COUNT(*) cnt, COUNT(DISTINCT pieza_id) piezas,
       MIN(fecha_desde) min_fecha, MAX(fecha_hasta) max_fecha,
       SUM(carritos_total) total_carritos,
       ROUND(SUM(intencion_nestle_mxn) / 1000, 0) AS intencion_nestle_k
FROM nmx_reporte.rpt_qcart;
```

**Valores de referencia (corte Nov 2026):**

| Tabla | Filas | Piezas | Rango |
|---|---|---|---|
| rpt_email | ~105 | ~100 Principals (AON 19 · OS 86) | 2026-03 → 2026-11 |
| rpt_whatsapp | ~24 | ~18 | 2026-Q2-1 → 2026-Q4-2 |
| rpt_qcart | ~183 | ~37 | 2026-03 → 2026-11 |

> rpt_email contará solo Principals (no FUPs independientes). Los FUPs aparecen como columnas en su fila Principal.

---

### Paso 4 — Recarga manual de insumos pesados (si aplica)

Si el CSV de Qcart cambió y el pipeline falló por timeout, correr el loader standalone:

```bash
uv run /home/agent/work/2026-09-10_gp5b06/my/scripts/_load_qcart_only.py
```

> Este script hace DROP + CREATE + INSERT en batches de 2,500 filas.
> Lleva ~45 min para 71K filas. Monitorear con:
> ```bash
> tdx query "SELECT COUNT(*) FROM nmx_insumos.land_qcart_carritos"
> ```
> Cuando llegue a 71,117 filas, correr el pipeline (Paso 2) nuevamente.

Para recarga de WA únicamente:
```bash
uv run --with openpyxl /home/agent/work/2026-09-10_gp5b06/my/scripts/_reload_wa_only.py
```

---

## Esquema de las tablas de reporte (referencia v8)

### nmx_reporte.rpt_email (formato wide Principal + FUP)

| Grupo | Columnas |
|-------|----------|
| Dimensiones | `campana`, `medio`, `objetivo`, `touchpoint_brief`, `tipo_email`, `tipo_envio`, `segmento_nombre`, `tiene_qcart`, `quincena_principal`, `mes`, `marca`, `bu` |
| IDs Principal | `pieza_id`, `email_name_principal`, `subject_principal`, `fecha_envio_principal`, `jobs_principal` |
| Métricas Principal | `p_sends`, `p_deliveries`, `p_opens`, `p_clicks`, `p_clicks_cta`, `p_clicks_baja`, `p_clicks_medidos`, `p_unsubs`, `p_open_rate`, `p_ctor`, `p_click_rate`, `p_utor` |
| IDs FUP | `fup_pieza_id`, `email_name_fup`, `subject_fup`, `quincena_fup`, `fecha_envio_fup` |
| Métricas FUP | `fup_sends`, `fup_deliveries`, `fup_opens`, `fup_clicks`, `fup_clicks_cta`, `fup_clicks_baja`, `fup_clicks_medidos`, `fup_unsubs`, `fup_open_rate`, `fup_ctor`, `fup_click_rate`, `fup_utor` |
| Totales P+FUP | `tot_sends`, `tot_deliveries`, `tot_opens`, `tot_clicks`, `tot_clicks_cta`, `tot_clicks_baja`, `tot_clicks_medidos`, `tot_unsubs`, `tot_open_rate`, `tot_ctor`, `tot_click_rate`, `tot_utor` |

### nmx_reporte.rpt_whatsapp

| Columnas |
|----------|
| `pieza_id`, `marca`, `bu`, `campana`, `objetivo`, `touchpoint_brief`, `segmento_nombre`, `nombre_wa`, `quincena`, `mes` |
| `sends`, `deliveries`, `no_entregados`, `opens_read`, `clicks`, `errores` |
| `wa_pct_entrega`, `wa_pct_no_entrega`, `wa_pct_read_vs_entrega`, `wa_pct_click_vs_read` |

### nmx_reporte.rpt_qcart

| Columnas |
|----------|
| `pieza_id`, `marca`, `bu`, `campana`, `objetivo`, `segmento_nombre` |
| `fecha_desde`, `fecha_hasta` |
| `carritos_walmart`, `carritos_chedraui`, `carritos_total`, `views_carrito` |
| `views_productos_nestle`, `intencion_total_mxn`, `intencion_nestle_mxn` |
| `pct_penetracion_nestle`, `ticket_carrito_mxn`, `ticket_producto_mxn`, `receta_representativa` |

---

## Troubleshooting

### `QUERY_TEXT_TOO_LARGE`
- Causa: batch con filas de UTMs largos supera 1M chars
- Fix: en `_load_qcart_only.py`, reducir `BATCH_SIZE` a 2000 y relanzar desde el offset que falló

### WA journey sin pieza_id en rpt_whatsapp
- Causa: nombre del journey no está en `tabla_nombres` del catálogo
- Fix: Rick agrega el journey a `catalogo/Catalogo-Nestle-MX.xlsx` hoja `Nombres`, re-push, recorrer pipeline

### rpt_email tiene menos filas de las esperadas
- Causa: piezas FUP (con pieza_principal_id) no se muestran como filas independientes
- Esto es normal: las FUPs aparecen como columnas de su Principal correspondiente

### Pipeline falla en <5 segundos
- Causa: error de sintaxis en un .dig o SQL transient
- Fix: correr los sub-workflows individualmente para aislar:
  ```bash
  tdx wf run nmx_crm_reporte.catalogo
  tdx wf run nmx_crm_reporte.hechos
  tdx wf run nmx_crm_reporte.reporte
  ```

---

## Contactos y recursos

| Recurso | Valor |
|---|---|
| Owner | Rick Aguilar |
| Repo | CRM-Omnicom-Clients/Dashboards-Nestle-MX |
| Carpeta repo | negocio/nestle/reportes-consolidado/ |
| Workflow TD | nmx_crm_reporte (ID: 2105350) |
| DB catálogo | nmx_insumos |
| DB hechos | nmx_hechos |
| DB reporte | nmx_reporte |

---

---

## Paso 5 — Actualizar el dashboard con datos frescos

```bash
# Genera dashboards/reporte-datos.js desde los rpt_* actuales en TD
uv run workflow/scripts/build_dashboard_data.py

# Push solo el archivo de datos (el HTML nunca se toca)
cd /tmp/dashboards-repo
git add dashboards/reporte-datos.js
git commit -m "data: refresco dashboard [YYYY-MM-DD]"
git push "https://x-access-token:${TOKEN}@github.com/CRM-Omnicom-Clients/Dashboards-Nestle-MX.git" main
```

> **Regla crítica:** `reporte-consolidado-crm.html` contiene SOLO lógica JS (filtros, tablas, estilos). **Nunca** lo edites para actualizar datos — solo escribe en `reporte-datos.js`.
> Esta separación fue implementada el 2026-11-12 para evitar el BUG-08 (rsm() fusionada con go() por patch accidental del HTML).

---

## Valores de referencia (corte Nov 2026)

| Tabla | Filas | Piezas | Rango |
|---|---|---|---|
| rpt_email | 105 | 100 únicas (AON 19 · OS 86) | 2026-03 → 2026-11 |
| rpt_whatsapp | 24 | 18 | 2026-Q2-1 → 2026-Q4-2 |
| rpt_qcart | 183 | 37 piezas atribuidas | 2026-03 → 2026-11 |

**Métricas clave Qcart (referencia post-BUG-05/06/07):**
- 7,185 carritos totales · $2.69M intención total · $279.7K intención Nestlé · 10.4% pct · tkt_c $374 · tkt_p $26.94

---

*Última actualización: 2026-11-13 — Pipeline autónomo L-V 03:33 CDMX. Pasos 0-4 actualizados para reflejar landing.dig. Para esquemas completos de tablas ver ESQUEMA-BASES-DE-DATOS.md.*
