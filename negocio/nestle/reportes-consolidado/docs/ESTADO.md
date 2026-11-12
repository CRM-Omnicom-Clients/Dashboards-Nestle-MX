---
title: "ESTADO: Reporte Consolidado Nestlé México en Treasure Data"
updated: 2026-11-12
status: "Etapas 4+5 completas (parcial Qcart). rpt_email/rpt_whatsapp listos. rpt_qcart pendiente recarga Qcart. 7 nombres WA sin pieza (Rick)."
owner: Rick Aguilar
---

# ESTADO: Reporte Consolidado Nestlé México en TD

> Fuente de verdad del proyecto — actualizado 2026-11-12.
> Para la arquitectura del sistema, ver `ARQUITECTURA.md`. Para correr, ver `OPERACIONES.md`.

---

## Resumen ejecutivo (2026-11-12)

| Canal | Tabla fact | Filas | Rango fechas | Tabla rpt |
|-------|-----------|-------|-------------|-----------|
| Email | `fact_envio_email` | 141 | Mar–Oct 2026 | `rpt_email` ✓ 140 filas |
| WhatsApp | `fact_envio_whatsapp` | 18 | Jun–Oct 2026 | `rpt_whatsapp` ✓ 18 filas |
| Qcart | `fact_evento_qcart_carritos` | ⏳ cargando | Mar–Nov 2026 | `rpt_qcart` ⏳ pendiente |
| Qcart productos | `fact_evento_qcart_productos` | 400 | — | (en rpt_qcart) |

---

## Etapas del proyecto

| Etapa | Descripción | Estado |
|-------|-------------|--------|
| 1 | Setup DBs + catálogo base | ✓ COMPLETA |
| 2 | Workflow Digdag: catalogo.dig | ✓ COMPLETA |
| 3 | Workflow Digdag: hechos.dig | ✓ COMPLETA |
| 4a | fact_envio_email | ✓ COMPLETA — 141 filas, 135 piezas |
| 4b | fact_envio_whatsapp | ✓ COMPLETA — 18 filas, 18 piezas |
| 4c | fact_evento_qcart_* | ⏳ cargando insumos raw (71K filas) |
| 5a | rpt_email | ✓ COMPLETA — 140 filas, 135 piezas, Mar–Oct 2026 |
| 5b | rpt_whatsapp | ✓ COMPLETA — 18 filas, 18 piezas, Jun–Oct 2026 |
| 5c | rpt_qcart | ⏳ pendiente: re-correr pipeline cuando termine carga Qcart |
| 6 | Dashboard (TD Studio) | 🔲 PENDIENTE — requiere OI-12 (diseño) |
| 7 | OPERACIONES.md runbook | 🔲 PENDIENTE |

---

## Insumos en TD (nmx_insumos)

| Tabla | Filas | Descripción |
|-------|-------|-------------|
| `land_piezas` | 157 | Catálogo piezas |
| `land_nombres` | 158 | Nombres email+WA → pieza_id |
| `land_shortlinks` | 82 | Shortlinks Qcart → pieza_id |
| `land_wa_envios` | 30 | WA datos raw normalizados (Jun–Oct 2026) |
| `land_qcart_carritos` | ⏳ cargando | Carritos raw (Mar–Nov 2026, 71K filas totales) |
| `land_qcart_productos` | 2,654 | Productos Qcart raw |

---

## OIs (decisiones y problemas pendientes)

| ID | Descripción | Responsable | Estado |
|----|-------------|-------------|--------|
| OI-01 | Email name → pieza_id para 006 piezas | — | ✓ Resuelto (tabla_nombres) |
| OI-02 | Base email de envíos BD (sin CDP Hive) | Rick | Pendiente (histórico) |
| OI-05 | Nombre WA → pieza_id: naming standard | Rick | Pendiente (ver OI-09) |
| OI-09 | 7 nombres WA nuevos sin pieza_id en catálogo | **Rick** | 🔲 PENDIENTE |
| OI-10 | Reconciliar conteos shortlinks Qcart | Rick | Pendiente |
| OI-12 | Diseño del dashboard (spec) | Rick | Pendiente |
| OI-13 | Shortlinks no atribuidos en Qcart (71K→30 filas sin atribución) | Verificar | ⏳ Pendiente (Qcart loading) |
| OI-14 | Decimal europeo en total_shown_price: corregido en pipeline | — | ✓ Resuelto |
| OI-15 | `WA-MUNDIAL-CRM-HIVE` no está en hoja Nombres | **Rick** | 🔲 PENDIENTE |

### OI-09 / OI-15 — Nombres WA sin pieza_id (Rick debe agregar al catálogo)

Los siguientes `nombre_wa` están en el XLSX de insumos pero **NO** tienen entrada en la hoja `Nombres` de `Catalogo-Nestle-MX.xlsx`:

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

**Acción Rick:** Agrega estos nombres a la hoja `Nombres` con sus `pieza_id` y `canal = 'WhatsApp'`. Después re-correr `load_catalogo.py` + pipeline.

---

## Cambios de arquitectura (Nov 2026)

- Repo reorganizado: `insumos/` (archivos raw) + `referencia/` (documentos consulta) + `catalogo/` + `workflow/`
- `reload_catalog.py` ahora lee formatos raw directamente (WA multi-hoja XLSX, Qcart CSV con `;`)
- Atribución pieza_id: JOINs en hechos.dig (nunca en archivos raw)
- Etapa 5 (rpt_*): reporte.dig añadido al pipeline. rpt_email y rpt_whatsapp listos.
- BATCH_SIZE reducido a 2500 (evita QUERY_TEXT_TOO_LARGE con filas Qcart de UTMs largos)
