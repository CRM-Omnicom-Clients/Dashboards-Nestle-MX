---
title: "ESTADO: Reporte Consolidado Nestlé México en Treasure Data"
updated: 2026-11-12
status: "Dashboard v1 publicado. Pipeline con datos parciales — pendiente recarga completa de Qcart y fix de shortlinks."
owner: Rick Aguilar
---

# ESTADO: Reporte Consolidado Nestlé México en TD

> Fuente de verdad del proyecto — actualizado 2026-11-12.
> Para la arquitectura del sistema, ver `ARQUITECTURA.md`. Para correr, ver `OPERACIONES.md`.

---

## Resumen ejecutivo (2026-11-12)

| Canal | Tabla fact | Estado | Tabla rpt | Filas | Notas |
|-------|-----------|--------|-----------|-------|-------|
| Email | `fact_envio_email` | ✓ | `rpt_email` | 108 | AON 34 · OS 74 |
| WhatsApp | `fact_envio_whatsapp` | ✓ | `rpt_whatsapp` | 28 | 7 nombres sin pieza_id (OI-09) |
| Qcart | `fact_evento_qcart_*` | ⚠️ datos parciales | `rpt_qcart` | 4 | Solo 5K/71K filas raw cargadas |

> **Dashboard v1 publicado:** https://crm-omnicom-clients.github.io/Dashboards-Nestle-MX/dashboards/nestle-reporte-v1.html
>
> **⚠️ Qcart incompleto:** `land_qcart_carritos` tiene solo 5,000 de 71,000 filas raw. Además, solo 27 de esas 5K filas tienen shortlink en catálogo (0.54% match). Ver OI-13 y OI-16.

---

## Problemas pendientes antes del pipeline final

### OI-13 / OI-16 — Qcart: datos incompletos y shortlinks faltantes

Diagnóstico ejecutado 2026-11-12:

| Métrica | Valor | Esperado |
|---------|-------|----------|
| Filas en `land_qcart_carritos` | 5,000 | ~71,000 |
| Filas con match en `dim_shortlink` | 27 | ~71,000 |
| Match rate actual | 0.54% | >95% |
| Piezas con datos en `rpt_qcart` | 4 | ~30+ |

**Acciones Rick (bloquean el pipeline final):**

1. **Recargar `land_qcart_carritos` completo** — las 71K filas del Excel de Qcart. Las filas actuales son solo Recetas Nestlé; faltan Maggi, Hotcakes, Dog Chow y todos los demás.

2. **Completar hoja `Shortlinks`** en `Catalogo-Nestle-MX.xlsx` con TODOS los shortlinks usados en campañas Qcart 2026. El catálogo actual tiene 82 shortlinks; los datos raw usan ~1,000+. Se necesita el mapeo completo `shortlink_code → pieza_id` para cada marca y campaña. Criterio: **toda pieza con `tiene_qcart = Sí` en la hoja Piezas debe tener al menos un shortlink en esta hoja.**

3. **Actualizar `tipo_envio`** — Checo/Dog Chow (012-P*, 013-P*) ya están como `one-shot` en el xlsx. El pipeline los recogerá.

---

## Etapas del proyecto

| Etapa | Descripción | Estado |
|-------|-------------|--------|
| 1 | Setup DBs + catálogo base | ✓ COMPLETA |
| 2 | Workflow Digdag: catalogo.dig | ✓ COMPLETA |
| 3 | Workflow Digdag: hechos.dig | ✓ COMPLETA |
| 4a | fact_envio_email | ✓ 141 filas, 135 piezas |
| 4b | fact_envio_whatsapp | ✓ 18 filas, 18 piezas |
| 4c | fact_evento_qcart_* | ⚠️ DATOS PARCIALES — 5K/71K filas |
| 5a–c | rpt_email / rpt_whatsapp / rpt_qcart | ✓ SQL completos, datos parciales |
| 6a–d | Formato v8 completo (fact + rpt) | ✓ COMPLETO |
| **6e** | **Dashboard HTML v1** | **✓ Publicado en GitHub Pages** |
| **7** | **Pipeline final con datos reales** | **🔲 BLOQUEADO — ver OI-13/16** |
| 8 | Schedule semanal martes 22h | 🔲 PENDIENTE — después de Etapa 7 |

---

## OIs abiertos

| ID | Descripción | Responsable | Estado |
|----|-------------|-------------|--------|
| OI-02 | Base email de envíos BD (sin CDP Hive) | Rick | Pendiente |
| OI-09 | 7 nombres WA nuevos sin pieza_id en catálogo | **Rick** | 🔲 PENDIENTE |
| OI-13 | Shortlinks Qcart incompletos (82 de ~1,000+) | **Rick** | 🔲 BLOQUEANTE |
| OI-15 | `WA-MUNDIAL-CRM-HIVE` no está en hoja Nombres | **Rick** | 🔲 PENDIENTE |
| OI-16 | land_qcart_carritos: 5K/71K filas cargadas | **Rick** | 🔲 BLOQUEANTE |

### Nombres WA sin pieza_id (OI-09 / OI-15)
Agregar a hoja `Nombres` en `Catalogo-Nestle-MX.xlsx`:
```
O_Maggi-Seleccion-NC006537_1_..._LALIGA-J10-SAB-2PM_...    canal=WhatsApp
O_Maggi-Seleccion-NC006537_1_..._LALIGA-J9-5PM_...         canal=WhatsApp
O_Maggi-Seleccion-NC006537_1_..._MEXVSCL-MAR-7PM_...       canal=WhatsApp
O_Maggi-Seleccion-NC006537_1_..._LALIGA-J10-SAB-12PM_...   canal=WhatsApp
O_Maggi-Seleccion-NC006537_1_..._MEXVSPER-6PM_...          canal=WhatsApp
O_Maggi-Seleccion-NC006537_1_..._LALIGA-JORNADA-5PM_...    canal=WhatsApp
WA-MUNDIAL-CRM-HIVE                                         canal=WhatsApp
```

---

## Cambios de arquitectura acumulados (2026-11)

- Repo: `catalogo/` + `insumos/` + `referencia/` + `workflow/queries/{catalogo,hechos,reporte}/`
- `reload_catalog.py` lee formatos raw del xlsx directamente
- Etapa 6: fact_envio_email + rpt_* reescritos a formato v8 (Principal + FUP wide, clicks desglosados)
- rpt_qcart grain: `(pieza_id, quincena)` — se agrega a nivel pieza en el dashboard (SUM carritos, MIN/MAX fechas)
- Dashboard HTML v1: 4 tabs (AON / OS / WA / Resumen), sticky dims hasta QC?, Qcart siempre visible en email
- Fix: `touchpoint_nombre` → `touchpoint_brief` en rebuild_rpt_qcart.sql (commit ce48b1d)
