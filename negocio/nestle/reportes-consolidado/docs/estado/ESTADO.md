---
title: "ESTADO: Reporte Consolidado Nestlé México en Treasure Data"
updated: 2026-11-12T21:00
status: "Etapas 1-6 completas + validación Qcart. Bloqueante: OI-13 (329 shortlinks sin mapeo). Pendiente: Etapa 7 (schedule)."
owner: Rick Aguilar
---

# ESTADO: Reporte Consolidado Nestlé México en TD

> Fuente de verdad del proyecto — actualizado 2026-11-12T20:30.
> Para la arquitectura del sistema, ver `ARQUITECTURA.md`. Para correr, ver `OPERACIONES.md`.

---

## Resumen ejecutivo (2026-11-12)

| Canal | Tabla fact | Estado | Tabla rpt | Notas |
|-------|-----------|--------|-----------|-------|
| Email | `fact_envio_email` | ✓ | `rpt_email` | AON 19 rows · OS 86 rows (105 total) |
| WhatsApp | `fact_envio_whatsapp` | ✓ datos corregidos | `rpt_whatsapp` | 24 rows · 0 duplicados |
| Qcart | `fact_evento_qcart_*` | ✓ validado | `rpt_qcart` | 2,991 eventos · 15 piezas email con Qcart · ticket avg \$281-\$461 MXN |

> **Dashboard v1 publicado:** https://crm-omnicom-clients.github.io/Dashboards-Nestle-MX/dashboards/reporte-consolidado-crm.html
>
> **Dashboard actualizado 2026-11-12** — mejoras UI: 83 columnas ordenables, totales por campaña (P+FUP+Total+Qcart), paleta morado/rosa, fuente Gotham/Montserrat, timestamp dinámico, filtro Quincena, badge v1.

---

## Avance por etapa

| Etapa | Descripción | Estado |
|-------|-------------|--------|
| 1 | Setup DBs + catálogo base | ✓ COMPLETA |
| 2 | Workflow Digdag: `catalogo.dig` | ✓ COMPLETA |
| 3 | Workflow Digdag: `hechos.dig` | ✓ COMPLETA |
| 4a | `fact_envio_email` | ✓ 141 filas · 135 piezas |
| 4b | `fact_envio_whatsapp` | ✓ datos corregidos · OI-15+17 resueltos |
| 4c | `fact_evento_qcart_*` | ✓ | land: 71,117 · fact: 2,991 (4.64% cobertura shortlinks — OI-13) |
| 5a | `rpt_email` | ✓ OI-18 resuelto | 105 filas, 0 duplicados |
| 5b | `rpt_whatsapp` | ✓ OI-18 resuelto | 18 filas, 0 duplicados |
| 5c | `rpt_qcart` | ✓ SQL corregido | datos parciales por OI-13 |
| 6 | Dashboard HTML v1 | ✓ Publicado · **refrescado 2026-11-12** · datos reales pipeline completo |
| **P1** | **Catálogo rebuild (AON/OS verificado, 157 piezas)** | **✓ COMPLETA 2026-11-12** |
| **P2** | **WA insumos corregidos (OI-15+17)** | **✓ COMPLETA 2026-11-12** |
| **P3** | **Pipeline final con datos reales** | **✓ COMPLETA 2026-11-12** |
| P4 | Schedule semanal martes 22h | 🔲 PENDIENTE — después de P3 |

---

## Plan completo para pipeline final

### ETAPA 1 — Catálogo ✓ COMPLETA (2026-11-12)
- [x] Gate 1 = 0 errores — vocabularios y llaves sin inconsistencias
- [x] Verificar tipo_envio AON/OS en `land_piezas`: correcto, sin piezas inesperadas
- [x] Rebuild catalog chain ejecutado (`nmx_crm_reporte.catalogo` workflow):
  - `tabla_piezas`: 157 piezas (Email AON 39 · Email OS 99 · WA 19)
  - `dim_campana`: 13 · `dim_marca`: 11 · `dim_bu`: 5 · `dim_objetivo`: 11
  - `dim_segmento`: 52 · `dim_touchpoint_brief`: 79
  - `pieza_segmento`: 169 (12 piezas con 2–3 segmentos — ver OI-18)
  - `tabla_nombres`: 158 · `dim_shortlink`: 82
- [ ] Alta piezas nuevas CRM HIVE (si las hay — Rick confirma)

### ETAPA 2 — Insumos WA ✓ COMPLETA (2026-11-12)
- [x] **2A** DELETE 6 filas `WA-MUNDIAL-CRM-HIVE` de `land_wa_envios` (sesiones GA, no envíos reales)
- [x] **2B** UPDATE clicks 8 piezas — valores del v8, verificados en `fact_envio_whatsapp`:

  | Pieza | Nombre WA | Clicks |
  |---|---|---|
  | 004-P017 | WA-MUNDIAL-SEMIFINAL-A | 289 ✓ |
  | 004-P018 | WA-MUNDIAL-SEMIFINAL-B | 369 ✓ |
  | 004-P019 | WA-MUNDIAL-FINALES | 616 ✓ |
  | 005-P011 | O_Maggi LALIGA-JORNADA-4PM | 53 ✓ |
  | 005-P013 | O_Maggi LALIGA-J9-4PM | 53 ✓ |
  | 005-P016 | O_Maggi LALIGA-J10-JUE | 42 ✓ |
  | 005-P018 | O_Maggi MEXVSPER-2PM | 59 ✓ |
  | 005-P021 | O_Maggi CDP-RN-LMXF | 109 ✓ |

- [x] **2C** Welcome 008-P007 (134) y 008-P008 (288): clicks derivados, se mantienen como reales (decisión Rick 2026-11-12)
- [x] `fact_envio_whatsapp` reconstruida con datos corregidos — 8 piezas verificadas ✓
- [x] `load_catalogo.py` actualizado con `WA_SKIP_NOMBRES` y `WA_CLICKS_OVERRIDE` — reloads futuros no pierden correcciones

### ETAPA 3 — Insumos Qcart ✓ COMPLETA (2026-11-12)
- [x] Cargar CSV 71K filas: `land_qcart_carritos` = **71,117 filas** (carga paralela 8 workers × 1K/batch)
- [x] Cargar productos: `land_qcart_productos` = **2,654 filas**
- [x] Verificar cobertura OI-13: **4.64%** de eventos atribuibles (3,308/71,220)
  - 408 shortlinks únicos en CSV; 82 mapeados en `dim_shortlink`; **329 sin mapeo → bloqueante para Rick**
  - Rick debe completar hoja `Shortlinks` del catálogo con todos los shortlink_code → pieza_id

### ETAPA 4 — Fix SQL: duplicados por pieza_segmento (OI-18) ✓ COMPLETA (2026-11-12)
- [x] `rebuild_rpt_whatsapp.sql` — subconsulta `MIN(segmento_nombre)` antes del JOIN (elimina 3× para 004-P\*)
- [x] `rebuild_rpt_email.sql` — subconsulta `ARRAY_JOIN(ARRAY_AGG(DISTINCT ...))` para concatenar segmentos (elimina 2× para 009-P\*)
- [x] `rebuild_rpt_qcart.sql` — subconsulta `MIN(segmento_nombre)` antes del JOIN
- [x] Push commit `6d6ab24` a GitHub · workflow project re-pushed (rev 2026-11-12T20-18-24-732Z)

### ETAPA 5 — Run pipeline completo ✓ COMPLETA (2026-11-12)
- [x] hechos.dig (Attempt 1424123750): `fact_envio_email` ✓ · `fact_envio_whatsapp` ✓ · `fact_evento_qcart_carritos` ✓ (2,991 filas) · `fact_evento_qcart_productos` ✓
  - Fix: `QUALIFY` → subquery ROW_NUMBER en `rebuild_fact_evento_qcart_carritos.sql`
- [x] reporte.dig (Attempt 1424123947): `rpt_email` ✓ 105 filas · `rpt_whatsapp` ✓ 18 filas · `rpt_qcart` ✓
  - OI-18 validado: **0 duplicados** en rpt_whatsapp y rpt_email

### ETAPA 6 — Dashboard ✓ COMPLETA (2026-11-12)
- [x] Dashboard refrescado con datos frescos post-pipeline: 34 AON + 71 OS + 18 WA
- [x] 26 piezas email con Qcart · 5 piezas WA con Qcart (limitado por OI-13)
- [x] Push commit `493efee` → GitHub Pages live

### ETAPA 7 — Schedule 🔲
- [ ] `tdx wf schedule` — martes 22:00h MX (`nmx_crm_reporte.nmx_crm_reporte`)

---

## OIs abiertos

| ID | Descripción | Responsable | Estado |
|----|-------------|-------------|--------|
| OI-02 | Base email de envíos BD (sin CDP Hive) | Rick | 🔲 Pendiente |
| OI-09 | 4 nombres WA sin pieza_id: LALIGA-J10-SAB-12PM, LALIGA-J10-SAB-2PM, MEXVSCL-MAR-7PM | **Rick** | 🔲 Pendiente |
| OI-13 | Shortlinks Qcart: **329 de 408 sin mapeo** (4.64% cobertura actual) | **Rick** | 🔲 Bloqueante — completar hoja Shortlinks en catálogo |
| OI-15 | WA-MUNDIAL-CRM-HIVE — 6 filas GA eliminadas de `land_wa_envios` | Studio | ✅ Resuelto 2026-11-12 |
| OI-16 | `land_qcart_carritos`: 71,117 filas cargadas | Studio | ✅ Resuelto 2026-11-12 |
| OI-17 | 8 piezas WA clicks corregidos en `land_wa_envios` y `fact_envio_whatsapp` | Studio | ✅ Resuelto 2026-11-12 |
| OI-18 | Duplicados en `rpt_*` por LEFT JOIN pieza_segmento sin colapsar | Studio | ✅ Resuelto 2026-11-12 |

### Detalle OI-18: Duplicados por pieza_segmento

Los tres `rpt_*` hacen `LEFT JOIN pieza_segmento → dim_segmento` sin agrupar antes. Con >1 segmento por pieza se multiplican filas:
- `rpt_whatsapp`: 004-P010/013/017/018/019 aparecen **3×** (3 segmentos cada una)
- `rpt_email`: 009-P015/016/017 aparecen **2×** (2 segmentos cada una)
- `rpt_qcart`: misma vulnerabilidad

Fix (Etapa 4): subconsulta que colapsa a 1 fila por pieza antes del JOIN.

---

## Cambios de arquitectura (2026-11)

- Repo: `catalogo/` · `insumos/` · `referencia/` · `workflow/queries/{catalogo,hechos,reporte}/`
- `load_catalogo.py` / `reload_catalog.py`: lee XLSX raw directamente + `WA_SKIP_NOMBRES` + `WA_CLICKS_OVERRIDE`
- `fix_wa_envios.py` en `my/scripts/`: corrección ad hoc de `land_wa_envios` sin re-fetch del XLSX
- Fact tables: formato v8 con Principal+FUP wide, clicks desglosados CTA/Baja/Medidos
- `rpt_qcart` grain: `(pieza_id, quincena)` — agrega a nivel pieza en el dashboard
- Dashboard `reporte-consolidado-crm.html`: 83 columnas ordenables, totales campaña P+FUP+Total+Qcart, paleta morado/rosa, Gotham/Montserrat, timestamp dinámico, filtro Quincena, badge v1
