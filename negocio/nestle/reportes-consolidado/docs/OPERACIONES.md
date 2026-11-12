# OPERACIONES: Reporte Consolidado Nestlé México

> Runbook del flujo de actualización de datos. Versión operativa — Etapas 0–6 implementadas.

---

## Arquitectura del pipeline

```
GitHub (insumos/)              TD Workflow: nmx_crm_reporte
─────────────────              ──────────────────────────────
Catalogo-Nestle-MX.xlsx  ──→  catalogo.dig   → nmx_insumos (10 tablas dim/cat)
Email CSVs (por quincena)──→  hechos.dig     → nmx_hechos.fact_envio_email
WhatsApp XLSX            ──→                  nmx_hechos.fact_envio_whatsapp
Qcart CSVs (carritos/    ──→                  nmx_insumos.land_qcart_carritos
            productos)                         nmx_insumos.land_qcart_productos
                                               nmx_hechos.fact_evento_qcart_carritos
                                               nmx_hechos.fact_evento_qcart_productos
                         ──→  reporte.dig    → nmx_reporte.rpt_email
                                               nmx_reporte.rpt_whatsapp
                                               nmx_reporte.rpt_qcart
```

Dimensiones compartidas: `dim_marca`, `dim_bu`, `dim_campana`, `dim_objetivo`, `dim_shortlink`, `dim_touchpoint_brief`, `dim_segmento`, `pieza_segmento`.

---

## Proceso de actualización

### Cuándo correr el pipeline

Correr después de cualquiera de estos eventos:

- Nuevo corte de email: se suben nuevos CSVs a `insumos/` con prefijo `email-`
- Nuevo corte de WA: se reemplaza el XLSX `insumos/*.whatsapp*.xlsx`
- Nuevo corte de Qcart: se reemplazan los CSVs `insumos/*carts-raw*.csv` y `*products-raw*.csv`
- Cambios en el catálogo: se edita `catalogo/Catalogo-Nestle-MX.xlsx`

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
2. En TD AI Studio, correr en terminal:
   ```bash
   uv run --with openpyxl /home/agent/work/2026-09-10_gp5b06/my/scripts/reload_catalog.py
   ```
3. Verificar que las 10 tablas se recargaron correctamente

**Hojas que se cargan del catálogo:**

| Hoja Excel | Tabla TD |
|---|---|
| Piezas | nmx_insumos.tabla_piezas |
| Nombres | nmx_insumos.tabla_nombres |
| Shortlinks | nmx_insumos.dim_shortlink |
| Marcas | nmx_insumos.dim_marca |
| BU | nmx_insumos.dim_bu |

---

### Paso 2 — Correr el pipeline

```bash
tdx wf run nmx_crm_reporte.nmx_crm_reporte
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
| rpt_email | ~115 | ~115 Principals | 2026-03 → 2026-10 |
| rpt_whatsapp | ~18 | ~18 | 2026-Q2-1 → 2026-Q4-2 |
| rpt_qcart | ~42 | ~42 | 2026-03 → 2026-11 |

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

*Última actualización: 2026-11-11 — Etapas 0–6 SQLs completos. Pendiente: cargar Qcart + run pipeline final + dashboard TD Studio.*
