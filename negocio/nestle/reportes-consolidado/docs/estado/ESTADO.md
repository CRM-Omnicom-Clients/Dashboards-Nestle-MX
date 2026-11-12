---
title: "ESTADO: Reporte Consolidado Nestlé México en Treasure Data"
updated: 2026-11-12T19:35
status: "Catálogo reconstruido ✓ (AON/OS correcto, 157 piezas). Etapa 2 pendiente: fix WA insumos. Qcart sin carga completa."
owner: Rick Aguilar
---

# ESTADO: Reporte Consolidado Nestlé México en TD

> Fuente de verdad del proyecto — actualizado 2026-11-12.
> Para la arquitectura del sistema, ver `ARQUITECTURA.md`. Para correr, ver `OPERACIONES.md`.

---

## Resumen ejecutivo (2026-11-12)

| Canal | Tabla fact | Estado | Tabla rpt | Filas | Notas |
|-------|-----------|--------|-----------|-------|-------|
| Email | `fact_envio_email` | ✓ | `rpt_email` | 108 | AON 34 · OS 74 · Fix pendiente: 2x rows 009-P015/016/017 |
| WhatsApp | `fact_envio_whatsapp` | ⚠️ clicks incompletos | `rpt_whatsapp` | 28 | 8 piezas con clicks NULL · Fix pendiente: 3x rows 004-P* |
| Qcart | `fact_evento_qcart_*` | ⚠️ datos parciales | `rpt_qcart` | 4 | Solo 25 filas raw cargadas; 71K pendientes |

> **Dashboard v1 publicado:** https://crm-omnicom-clients.github.io/Dashboards-Nestle-MX/dashboards/reporte-consolidado-crm.html
>
> **Dashboard actualizado 2026-11-12** con mejoras de UI: columnas ordenables (83 headers), totales por campaña en todas las secciones, paleta morado/rosa, fuente Gotham/Montserrat, timestamp dinámico, filtro Quincena.

---

## Avance por etapa

| Etapa | Descripción | Estado |
|-------|-------------|--------|
| 1 | Setup DBs + catálogo base | ✓ COMPLETA |
| 2 | Workflow Digdag: catalogo.dig | ✓ COMPLETA |
| 3 | Workflow Digdag: hechos.dig | ✓ COMPLETA |
| 4a | fact_envio_email | ✓ 141 filas, 135 piezas |
| 4b | fact_envio_whatsapp | ✓ 18 piezas · ⚠️ 8 sin clicks (ver OI-17) |
| 4c | fact_evento_qcart_* | ⚠️ DATOS PARCIALES — 25/71K filas |
| 5a | rpt_email | ⚠️ SQL OK · fix pieza_segmento pendiente (ver OI-18) |
| 5b | rpt_whatsapp | ⚠️ SQL OK · fix pieza_segmento pendiente (ver OI-18) |
| 5c | rpt_qcart | ⚠️ SQL OK · fix pieza_segmento pendiente (ver OI-18) |
| 6a–d | Formato v8 completo (fact + rpt) | ✓ COMPLETO |
| **6e** | **Dashboard HTML v1** | **✓ Publicado — mejoras UI 2026-11-12** |
| **1-extra** | **Catálogo rebuild (AON/OS verificado)** | **✓ COMPLETA 2026-11-12** |
| **7** | **Pipeline final con datos reales** | **🔲 EN CURSO — Etapa 2 siguiente** |
| 8 | Schedule semanal martes 22h | 🔲 PENDIENTE — después de Etapa 7 |

---

## Plan completo para pipeline final

### ETAPA 1 — Catálogo (✓ COMPLETA 2026-11-12)
- [x] Gate 1 = 0 errores — vocabularios y llaves sin inconsistencias
- [x] Verificar tipo_envio AON/OS en `land_piezas`: correcto, sin piezas inesperadas
- [x] Rebuild catalog chain ejecutado y verificado (nmx_crm_reporte.catalogo):
  - `tabla_piezas`: 157 piezas (Email AON 39 · Email OS 99 · WA 19)
  - `dim_campana`: 13 · `dim_marca`: 11 · `dim_bu`: 5 · `dim_objetivo`: 11
  - `dim_segmento`: 52 · `dim_touchpoint_brief`: 79
  - `pieza_segmento`: 169 (12 piezas con múltiples segmentos — ver OI-18)
  - `tabla_nombres`: 158 · `dim_shortlink`: 82
- [ ] Alta piezas nuevas CRM HIVE (si las hay — Rick confirma)

### ETAPA 2 — Insumos WA
- [ ] **2A** DELETE 6 filas `WA-MUNDIAL-CRM-HIVE` de `land_wa_envios` (sesiones GA, no envíos reales — ver OI-15)
- [ ] **2B** UPDATE clicks 8 piezas con NULL: 004-P017 (289), 004-P018 (369), 004-P019 (616), 005-P011 (53), 005-P013 (53), 005-P016 (42), 005-P018 (59), 005-P021 (109)
- [ ] **2C** Decisión Rick: Welcome 008-P007 (134) y 008-P008 (288) son clicks derivados (Read × CTOR ×0.12) — ¿mostrar como reales o marcar?

### ETAPA 3 — Insumos Qcart
- [ ] Cargar CSV 71K filas `recetas-nestle-mx-carts-raw-2026-03-01-2026-11-11.csv` → `fact_evento_qcart_*`

### ETAPA 4 — Fix SQL pipeline
- [ ] `rebuild_rpt_whatsapp.sql` — fix pieza_segmento LEFT JOIN → subconsulta MIN(segmento) (OI-18a)
- [ ] `rebuild_rpt_email.sql` — fix pieza_segmento LEFT JOIN → STRING_AGG (OI-18b)
- [ ] `rebuild_rpt_qcart.sql` — fix pieza_segmento LEFT JOIN → subconsulta MIN(segmento) (OI-18c)

### ETAPA 5 — Run pipeline completo
- [ ] Rebuild catálogo → hechos → reporte en orden

### ETAPA 6 — Dashboard
- [ ] Regenerar y publicar con datos frescos

### ETAPA 7 — Schedule
- [ ] `tdx wf schedule` para martes 22h MX

---

## OIs abiertos

| ID | Descripción | Responsable | Estado |
|----|-------------|-------------|--------|
| OI-02 | Base email de envíos BD (sin CDP Hive) | Rick | Pendiente |
| OI-09 | 4 nombres WA nuevos sin pieza_id en catálogo (LALIGA-J10-SAB-12PM/2PM, MEXVSCL-MAR-7PM) | **Rick** | 🔲 PENDIENTE |
| OI-13 | Shortlinks Qcart: verificar cobertura completa vs dim_shortlink | **Rick+Studio** | 🔲 BLOQUEANTE |
| OI-15 | `WA-MUNDIAL-CRM-HIVE` — 6 filas falsas en `land_wa_envios` (sesiones GA, no envíos). Acción: DELETE | **Studio** | 🔲 PENDIENTE ETAPA 2A |
| OI-16 | land_qcart_carritos: 25/71K filas cargadas | **Rick+Studio** | 🔲 BLOQUEANTE |
| OI-17 | 8 piezas WA con clicks NULL en TD (valores en v8): 004-P017/018/019, 005-P011/013/016/018/021 | **Studio** | 🔲 PENDIENTE ETAPA 2B |
| OI-18 | Duplicados en rpt_* por LEFT JOIN pieza_segmento sin colapsar: 004-P010/013/017/018/019 (3x) y 009-P015/016/017 (2x) | **Studio** | 🔲 PENDIENTE ETAPA 4 |

### Detalle OI-17: Clicks WA faltantes

| Pieza | Nombre WA | Clicks v8 | TD actual |
|---|---|---|---|
| 004-P017 | WA-MUNDIAL-SEMIFINAL-A | 289 | NULL ❌ |
| 004-P018 | WA-MUNDIAL-SEMIFINAL-B | 369 | NULL ❌ |
| 004-P019 | WA-MUNDIAL-FINALES | 616 | NULL ❌ |
| 005-P011 | O_Maggi LALIGA-JORNADA-5PM | 53 | NULL ❌ |
| 005-P013 | O_Maggi LALIGA-J9-5PM | 53 | NULL ❌ |
| 005-P016 | O_Maggi LALIGA-J10 | 42 | NULL ❌ |
| 005-P018 | O_Maggi MEXVSPER-6PM | 59 | NULL ❌ |
| 005-P021 | O_Maggi CDP-RN-LMXF | 109 | NULL ❌ |

Causa: XLSX raw de Liga MX y Mundiales grandes no tenía columna clicks. Se ingresaron manualmente en v8 pero nunca se actualizó el insumo raw.

### Detalle OI-15: WA-MUNDIAL-CRM-HIVE

El cargador leyó la tabla de sesiones de Google Analytics (filas 47–53, hoja Maggi Mundial) como si fueran envíos WA. Las 6 "filas" tienen:
- `nombre_wa = WA-MUNDIAL-CRM-HIVE`
- `sends` = 15, 6, 5, 9, 5, 3 (total 43 — idéntico a las sesiones GA)
- `clicks` = NULL
- Sin pieza_id asignable

No es una pieza real. Las 43 "sesiones" son el desglose por UTM de los clicks de Segundo y Tercer Partido (17 + 26 = 43). Acción: DELETE de `land_wa_envios`.

### Detalle OI-18: Duplicados por pieza_segmento

Los tres `rpt_*` SQLs hacen `LEFT JOIN nmx_catalogo.pieza_segmento ... LEFT JOIN nmx_catalogo.dim_segmento` sin agrupar antes. Para piezas con más de un segmento, esto multiplica las filas:
- `rpt_whatsapp`: 004-P010/013/017/018/019 aparecen 3× (3 segmentos cada una)
- `rpt_email`: 009-P015/016/017 aparecen 2× (2 segmentos cada una)
- `rpt_qcart`: misma vulnerabilidad

Fix: subconsulta que colapsa `pieza_segmento` a 1 fila por pieza antes del JOIN.

---

## Cambios de arquitectura acumulados (2026-11)

- Repo: `catalogo/` + `insumos/` + `referencia/` + `workflow/queries/{catalogo,hechos,reporte}/`
- `reload_catalog.py` lee formatos raw del xlsx directamente
- Etapa 6: fact_envio_email + rpt_* reescritos a formato v8 (Principal + FUP wide, clicks desglosados)
- rpt_qcart grain: `(pieza_id, quincena)` — se agrega a nivel pieza en el dashboard (SUM carritos, MIN/MAX fechas)
- Dashboard HTML v1 `reporte-consolidado-crm.html`:
  - 83 headers con ordenamiento click-to-sort
  - Totales campaña en todas las secciones (P + FUP + Total + Qcart)
  - Paleta morado/rosa/blanco/negro (sin azul ni dorado)
  - Fuente Gotham/Montserrat stack
  - Timestamp dinámico "Actualizado: [fecha/hora MX]"
  - Filtro Quincena (aplica email + WA)
  - Badge "v1"
- Fix: `touchpoint_nombre` → `touchpoint_brief` en rebuild_rpt_qcart.sql (commit ce48b1d)
