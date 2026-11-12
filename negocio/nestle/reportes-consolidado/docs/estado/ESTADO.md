---
title: "ESTADO: Reporte Consolidado Nestlé México en Treasure Data"
updated: 2026-11-12T20:30
status: "Catálogo ✓ · WA insumos ✓ · Dashboard v1 ✓. Próximo: Etapa 4 (fix SQL pieza_segmento) + Etapa 3 (Qcart 71K)."
owner: Rick Aguilar
---

# ESTADO: Reporte Consolidado Nestlé México en TD

> Fuente de verdad del proyecto — actualizado 2026-11-12T20:30.
> Para la arquitectura del sistema, ver `ARQUITECTURA.md`. Para correr, ver `OPERACIONES.md`.

---

## Resumen ejecutivo (2026-11-12)

| Canal | Tabla fact | Estado | Tabla rpt | Notas |
|-------|-----------|--------|-----------|-------|
| Email | `fact_envio_email` | ✓ | `rpt_email` | AON 39 piezas · OS 99 piezas · ⚠️ 2× rows para 009-P015/016/017 (OI-18) |
| WhatsApp | `fact_envio_whatsapp` | ✓ datos corregidos | `rpt_whatsapp` | ⚠️ 3× rows para 004-P010/013/017/018/019 (OI-18) |
| Qcart | `fact_evento_qcart_*` | ⚠️ datos parciales | `rpt_qcart` | 25 filas raw; 71K pendientes (OI-16) |

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
| 4c | `fact_evento_qcart_*` | ⚠️ PARCIAL — 25/71K filas (OI-16) |
| 5a | `rpt_email` | ⚠️ SQL OK · fix pieza_segmento pendiente (OI-18) |
| 5b | `rpt_whatsapp` | ⚠️ SQL OK · fix pieza_segmento pendiente (OI-18) |
| 5c | `rpt_qcart` | ⚠️ SQL OK · fix pieza_segmento pendiente (OI-18) |
| 6 | Dashboard HTML v1 | ✓ Publicado · mejoras UI 2026-11-12 |
| **P1** | **Catálogo rebuild (AON/OS verificado, 157 piezas)** | **✓ COMPLETA 2026-11-12** |
| **P2** | **WA insumos corregidos (OI-15+17)** | **✓ COMPLETA 2026-11-12** |
| **P3** | **Pipeline final con datos reales** | **🔲 EN CURSO — Etapa 4 siguiente** |
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

### ETAPA 3 — Insumos Qcart 🔲 BLOQUEANTE
- [ ] Cargar CSV 71K filas: `recetas-nestle-mx-carts-raw-2026-03-01-2026-11-11.csv`
  - Archivo en repo: `insumos/recetas-nestle-mx-carts-raw-2026-03-01-2026-11-11.csv`
  - Acción: correr `reload_catalog.py` o carga directa → `fact_evento_qcart_carritos` + `_productos`
- [ ] Verificar que shortlinks en `dim_shortlink` (82 entries) cubren eventos del CSV

### ETAPA 4 — Fix SQL: duplicados por pieza_segmento (OI-18) 🔲 PENDIENTE
- [ ] `rebuild_rpt_whatsapp.sql` — subconsulta `MIN(segmento_nombre)` antes del JOIN (elimina 3× para 004-P\*)
- [ ] `rebuild_rpt_email.sql` — subconsulta `STRING_AGG` para concatenar segmentos (elimina 2× para 009-P\*)
- [ ] `rebuild_rpt_qcart.sql` — subconsulta `MIN(segmento_nombre)` antes del JOIN

### ETAPA 5 — Run pipeline completo 🔲 (después de 3+4)
- [ ] Rebuild en orden: `nmx_crm_reporte.catalogo` → `nmx_crm_reporte.hechos` → `nmx_crm_reporte.reporte`
- [ ] Validar conteos post-run: 0 piezas con count > 1 en rpt_*, clicks WA correctos

### ETAPA 6 — Dashboard 🔲
- [ ] Regenerar `my/dashboard-v1.html` con datos frescos de TD
- [ ] Push a GitHub Pages → `dashboards/reporte-consolidado-crm.html`

### ETAPA 7 — Schedule 🔲
- [ ] `tdx wf schedule` — martes 22:00h MX (`nmx_crm_reporte.nmx_crm_reporte`)

---

## OIs abiertos

| ID | Descripción | Responsable | Estado |
|----|-------------|-------------|--------|
| OI-02 | Base email de envíos BD (sin CDP Hive) | Rick | 🔲 Pendiente |
| OI-09 | 4 nombres WA sin pieza_id: LALIGA-J10-SAB-12PM, LALIGA-J10-SAB-2PM, MEXVSCL-MAR-7PM | **Rick** | 🔲 Pendiente |
| OI-13 | Shortlinks Qcart: verificar cobertura vs dim_shortlink (82 entries) | **Rick+Studio** | 🔲 Bloqueante |
| OI-15 | WA-MUNDIAL-CRM-HIVE — 6 filas GA eliminadas de `land_wa_envios` | Studio | ✅ Resuelto 2026-11-12 |
| OI-16 | `land_qcart_carritos`: 25/71K filas — cargar CSV completo | **Rick+Studio** | 🔲 Bloqueante |
| OI-17 | 8 piezas WA clicks corregidos en `land_wa_envios` y `fact_envio_whatsapp` | Studio | ✅ Resuelto 2026-11-12 |
| OI-18 | Duplicados en `rpt_*` por LEFT JOIN pieza_segmento sin colapsar | Studio | 🔲 Pendiente Etapa 4 |

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
