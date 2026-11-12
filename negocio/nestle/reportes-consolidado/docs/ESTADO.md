---
title: "ESTADO: Reporte Consolidado Nestlé México en Treasure Data"
updated: 2026-11-11
status: "Etapa 6 estructuras completas. SQLs fact+rpt reescritos al formato v8. Pendiente: recarga datos + run pipeline."
owner: Rick Aguilar
---

# ESTADO: Reporte Consolidado Nestlé México en TD

> Fuente de verdad del proyecto — actualizado 2026-11-11.
> Para la arquitectura del sistema, ver `ARQUITECTURA.md`. Para correr, ver `OPERACIONES.md`.

---

## Resumen ejecutivo (2026-11-11)

| Canal | Tabla fact | Estado | Tabla rpt | Estado |
|-------|-----------|--------|-----------|--------|
| Email | `fact_envio_email` | ✓ SQL actualizado | `rpt_email` | ✓ SQL v8 completo |
| WhatsApp | `fact_envio_whatsapp` | ✓ sin cambios | `rpt_whatsapp` | ✓ SQL v8 completo |
| Qcart | `fact_evento_qcart_*` | ⏳ pendiente carga datos | `rpt_qcart` | ✓ SQL v8 completo |

> **Siguiente paso:** cargar datos Qcart (71K filas), luego correr pipeline completo.

---

## Etapas del proyecto

| Etapa | Descripción | Estado |
|-------|-------------|--------|
| 1 | Setup DBs + catálogo base | ✓ COMPLETA |
| 2 | Workflow Digdag: catalogo.dig | ✓ COMPLETA |
| 3 | Workflow Digdag: hechos.dig | ✓ COMPLETA |
| 4a | fact_envio_email | ✓ COMPLETA — 141 filas, 135 piezas |
| 4b | fact_envio_whatsapp | ✓ COMPLETA — 18 filas, 18 piezas |
| 4c | fact_evento_qcart_* | ⏳ pendiente: re-cargar 71K filas Qcart |
| 5a | rpt_email | ✓ COMPLETA (datos previos) |
| 5b | rpt_whatsapp | ✓ COMPLETA (datos previos) |
| 5c | rpt_qcart | ⏳ pendiente: correr pipeline post-carga Qcart |
| **6a** | **fact_envio_email: subject + clicks breakdown** | **✓ SQL COMPLETO** |
| **6b** | **rpt_email: formato wide v8 completo** | **✓ SQL COMPLETO** |
| **6c** | **rpt_whatsapp: touchpoint + segmento + tasas WA** | **✓ SQL COMPLETO** |
| **6d** | **rpt_qcart: formato v8 completo** | **✓ SQL COMPLETO** |
| 6e | MVP HTML dashboard (validación estructura) | ✓ v3 generado (my/mvp-dashboard.html) |
| 7 | Cargar datos + run pipeline final | 🔲 PENDIENTE — última etapa |
| 8 | Dashboard TD Studio | 🔲 PENDIENTE — después de Etapa 7 |

---

## Columnas nuevas en Etapa 6 (vs versión anterior)

### fact_envio_email — columnas agregadas
| Columna | Fuente |
|---------|--------|
| `subject` | `prod_sfmc_sends.email_subject_line` |
| `unique_clicks_cta` | `prod_sfmc_clicks.click_url` → tipo='cta' |
| `unique_clicks_baja` | `prod_sfmc_clicks.click_url` → tipo='baja' |
| `unique_clicks_redes` | `prod_sfmc_clicks.click_url` → tipo='redes_legal' |
| `unique_clicks_medidos` | = unique_clicks_cta (clicks intencionales) |

### rpt_email — formato wide v8 (Principal + FUP en la misma fila)
- Grain: `(pieza_id, mes)` donde pieza = **Principal** (sin pieza_principal_id)
- FUP unido via `pieza_principal_id = principal.pieza_id AND mes = principal.mes`
- Nuevas dimensiones: `touchpoint_brief`, `segmento_nombre`, `quincena`, `tiene_qcart`
- Nuevos identificadores: `email_name`, `subject`, `fecha_envio`, `jobs`
- Nuevas tasas: `p_ctor`, `p_utor`, `fup_ctor`, `fup_utor`, `tot_ctor`, `tot_utor`
- Nuevos clicks: `*_clicks_cta`, `*_clicks_baja`, `*_clicks_medidos` (Principal, FUP y Total)

### rpt_whatsapp — columnas agregadas
| Columna | Descripción |
|---------|-------------|
| `touchpoint_brief` | Código TP (WA-C1, WA-C2, etc.) |
| `segmento_nombre` | Segmento de audiencia |
| `wa_pct_no_entrega` | no_entregados / sends |
| `wa_pct_click_vs_read` | clicks / opens_read |

### rpt_qcart — reescrito (grain: pieza_id, rango temporal completo)
| Columna v8 | Implementación |
|------------|----------------|
| `fecha_desde` / `fecha_hasta` | MIN/MAX fecha en fact_carritos |
| `carritos_walmart` / `carritos_chedraui` | SUM(views) por store |
| `carritos_total` | SUM(views) todos los stores |
| `views_carrito` | SUM(impressions) |
| `views_productos_nestle` | SUM(views) fact_productos WHERE brand LIKE Nestlé |
| `intencion_total_mxn` | SUM(total_shown_price) fact_carritos |
| `intencion_nestle_mxn` | SUM(total_shown_price) fact_productos WHERE brand LIKE Nestlé |
| `pct_penetracion_nestle` | intencion_nestle / intencion_total |
| `ticket_carrito_mxn` | intencion_total / carritos_total |
| `ticket_producto_mxn` | intencion_nestle / views_productos_nestle |
| `receta_representativa` | MAX(receta) de dim_shortlink |

---

## Insumos en TD (nmx_insumos)

| Tabla | Filas | Descripción |
|-------|-------|-------------|
| `land_piezas` | 157 | Catálogo piezas |
| `land_nombres` | 158 | Nombres email+WA → pieza_id |
| `land_shortlinks` | 82 | Shortlinks Qcart → pieza_id |
| `land_wa_envios` | 30 | WA datos raw normalizados |
| `land_qcart_carritos` | ⏳ pendiente carga | Carritos raw (71K filas totales) |
| `land_qcart_productos` | 2,654 | Productos Qcart raw |

---

## OIs (decisiones y problemas pendientes)

| ID | Descripción | Responsable | Estado |
|----|-------------|-------------|--------|
| OI-02 | Base email de envíos BD (sin CDP Hive) | Rick | Pendiente |
| OI-09 | 7 nombres WA nuevos sin pieza_id en catálogo | **Rick** | 🔲 PENDIENTE |
| OI-13 | Shortlinks no atribuidos en Qcart | Verificar post-carga | ⏳ Pendiente |
| OI-15 | `WA-MUNDIAL-CRM-HIVE` no está en hoja Nombres | **Rick** | 🔲 PENDIENTE |

### OI-09 / OI-15 — Nombres WA sin pieza_id (Rick debe agregar al catálogo)

Los siguientes `nombre_wa` están en los insumos pero **NO** tienen entrada en la hoja `Nombres` de `Catalogo-Nestle-MX.xlsx`:

```
# Maggi Liga MX (6 nombres):
O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J10-SAB-2PM_CN_WA_A_V1_089420
O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J9-5PM_CN_WA_A_V1_074969
O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_MEXVSCL-MAR-7PM_CN_WA_A_V1_03399
O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-J10-SAB-12PM_CN_WA_A_V1_089420
O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_MEXVSPER-6PM_CN_WA_A_V1_097964
O_Maggi-Seleccion-NC006537_1_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LALIGA-JORNADA-5PM_CN_WA_A_V1_065900

# WA Mundial (1 nombre):
WA-MUNDIAL-CRM-HIVE
```

**Acción Rick:** Agrega estos nombres a la hoja `Nombres` con sus `pieza_id` y `canal = 'WhatsApp'`.

---

## Cambios de arquitectura acumulados (2026-11)

- Repo organizado: `catalogo/` + `insumos/` (raw) + `referencia/` + `workflow/queries/{catalogo,hechos,reporte}/`
- `reload_catalog.py` lee formatos raw directamente
- Etapa 6: fact_envio_email + rpt_* reescritos al formato v8 completo
- rpt_email es ahora formato wide: Principal + FUP en la misma fila, alineado con v8 Report_Resumen
- Categorización de clicks por URL (cta / baja / redes_legal) en fact_envio_email
- rpt_qcart grain cambiado a (pieza_id) con rango temporal — se une a rpt_email por pieza_id en el dashboard
