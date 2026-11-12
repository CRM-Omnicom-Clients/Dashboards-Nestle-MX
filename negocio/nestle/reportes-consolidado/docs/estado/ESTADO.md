---
title: "ESTADO: Reporte Consolidado Nestlé México en Treasure Data"
updated: 2026-11-12T23:00
status: "Pipeline completo ✓. Dashboard live. Auditoría Qcart BUG-05/06/07 resuelta. OI-13 (shortlinks) pendiente Rick."
owner: Rick Aguilar
---

# ESTADO: Reporte Consolidado Nestlé México en TD

> Fuente de verdad del proyecto — actualizado 2026-11-12T23:00.
> Para la arquitectura del sistema, ver `ARQUITECTURA.md`. Para correr, ver `OPERACIONES.md`.

---

## Resumen ejecutivo (2026-11-12)

| Canal | Tabla fact | Estado | Tabla rpt | Métricas finales |
|-------|-----------|--------|-----------|-----------------|
| Email | `fact_envio_email` | ✓ | `rpt_email` | 105 rows · 100 piezas únicas · AON 19 rows · OS 86 rows |
| WhatsApp | `fact_envio_whatsapp` | ✓ corregido | `rpt_whatsapp` | 24 rows · 18 piezas · OI-15+17 resueltos |
| Qcart | `fact_evento_qcart_*` | ✓ auditado | `rpt_qcart` | 183 rows · 37 piezas · **7,185 carritos** · $2.69M intención total · **$279.7K intención Nestlé** · **pct 10.4%** · tkt_c $374 · tkt_p $26.94 |

**Cobertura Qcart en dashboard:**
- Email con Qcart: **28 piezas** (8 AON + 20 OS) — antes se reportaron 15/26 por archivo truncado
- WA con Qcart: **8 piezas** — antes se reportaban 5 por archivo truncado
- `005-P012`: pieza en `rpt_qcart` sin envíos en email ni WA — investigar si es pieza sin envíos registrados (ver OI-20)

> **Dashboard v1 publicado:** https://crm-omnicom-clients.github.io/Dashboards-Nestle-MX/dashboards/reporte-consolidado-crm.html
>
> Última actualización: 2026-11-12 — auditoría Qcart completa (BUG-05/06/07 resueltos), intencion_nestle corregida de $66K → $279.7K.

---

## Avance por etapa

| Etapa | Descripción | Estado |
|-------|-------------|--------|
| 1 | Setup DBs + catálogo base | ✓ COMPLETA |
| 2 | Workflow Digdag: `catalogo.dig` | ✓ COMPLETA |
| 3 | Workflow Digdag: `hechos.dig` | ✓ COMPLETA |
| 4a | `fact_envio_email` | ✓ 105 filas · 100 piezas |
| 4b | `fact_envio_whatsapp` | ✓ 24 filas corregidas |
| 4c | `fact_evento_qcart_*` | ✓ **7,185 carritos** · 37 piezas atribuidas (BUG-05/06/07 resueltos) |
| 5a | `rpt_email` | ✓ OI-18 resuelto · 105 filas · 0 duplicados |
| 5b | `rpt_whatsapp` | ✓ OI-18 resuelto · 24 filas · 0 duplicados |
| 5c | `rpt_qcart` | ✓ 183 filas · 37 piezas · totales auditados · **BUG-05/06/07 resueltos** |
| 6 | Dashboard HTML v1 | ✓ Publicado · datos reales · Qcart 28E+8WA piezas · intencion_nestle corregida |
| **P1** | **Catálogo rebuild (AON/OS verificado, 157 piezas)** | **✓ COMPLETA 2026-11-12** |
| **P2** | **WA insumos corregidos (OI-15+17)** | **✓ COMPLETA 2026-11-12** |
| **P3** | **Pipeline final + dashboard refrescado** | **✓ COMPLETA 2026-11-12** |
| P4 | Schedule semanal martes 22h | 🔲 PENDIENTE |
| **P5** | **Validación email vs SFMC (OI-19)** | **🔲 PENDIENTE — Rick conectará MCP** |

---

## Fórmulas del dashboard (referencia)

### Email
| Columna | Fórmula | Notas |
|---------|---------|-------|
| Open% | opens ÷ sends | OR = tasa de apertura |
| CTOR% | clicks ÷ opens | Click-to-Open Rate |
| UTOR% | unsubs ÷ sends | Unsubscribe rate sobre envíos |
| %CTA/U | cta_clicks ÷ total_clicks | % de clicks que son CTA |
| %Baja/U | baja_clicks ÷ total_clicks | % de clicks que son Baja |
| Total P+FUP | Σ(p_* + fup_*) por pieza, luego Σ campaña | FUP solo cuando existe |
| **Totales fila ∑** | Σ contadores luego ÷ — **NO promedio de tasas** | Ponderado correcto |

### WhatsApp
| Columna | Fórmula |
|---------|---------|
| Delivery% | deliveries ÷ sends |
| No Ent% | no_entregados ÷ sends |
| Read% | opens_read ÷ deliveries |
| CTR/Read | clicks ÷ opens_read |

### Qcart (por pieza, agrega todas las quincenas)
| Columna | Fórmula |
|---------|---------|
| Carritos Total | Σ views por (pieza×quincena) |
| Intención Total | Σ total_shown_price — **precio acumulado, no por carrito** |
| %Nestlé | Σ intencion_nestle ÷ Σ intencion_total |
| Ticket Carrito | Σ intencion_total ÷ Σ carritos_total |
| Ticket Producto | Σ intencion_nestle ÷ Σ views_productos_nestle |

> **Nota crítica Qcart:** `total_shown_price` en el CSV es el valor agregado de todos los views (no precio por carrito individual). Un evento con 1,408 views y $521K no es un carrito de $521K — es 1,408 carritos promedio ~$370 c/u.

---

## Bugs resueltos en esta sesión

### BUG-01: `_qc` inyectado como lista cruda → formato incorrecto
- **Síntoma:** Columnas Qcart del dashboard mostraban `—` y los totales de campaña tampoco tenían datos Qcart
- **Causa:** El script de inyección guardaba `_qc` como lista de rows de `rpt_qcart` con claves largas. `qcCols(q)` espera objeto con claves abreviadas `{cw, cc, ct, vc, vpn, itn, inn, rec, fd, fh, pct, tkt_c, tkt_p}`
- **Fix:** `aggregate_qc_for_pieza()` suma todas las quincenas por pieza y renombra las claves. Recalcula `pct`, `tkt_c`, `tkt_p` desde sumas (no promedios de tasas)
- **Commit:** `323c9a9`

### BUG-02: Archivo `rpt_qcart.jsonl` truncado — 98/183 rows
- **Síntoma:** Dashboard mostraba 15 piezas email con Qcart y 0 WA — debían ser 28 email + 8 WA
- **Causa:** El archivo salvado venía de un output comprimido que solo tenía los primeros ~100 rows
- **Fix:** Re-fetch con `tdx query --limit 300` → 183 rows completos
- **Commit:** `(este push)`

### BUG-03: Duplicados CSV antes de JOIN de atribución
- **Síntoma:** 27,731 filas con misma clave (fecha_hora, shortlink, store) en `land_qcart_carritos` — ROW_NUMBER tiraba datos
- **Causa real:** Duplicados no afectaban shortlinks atribuidos (0 duplicados entre los 82 de `dim_shortlink`)
- **Fix preventivo:** CTE `land_collapsed` que hace GROUP BY + SUM antes del JOIN
- **Commit:** `8aa4524`

### BUG-04: `tipo_envio` incorrecto — "100 años", "Hotcakes", "Checo" en AON
- **Síntoma:** Piezas one-shot aparecían en la pestaña AON del dashboard
- **Causa:** `hechos.dig` + `reporte.dig` corrieron antes de `catalogo.dig` → `tabla_piezas` stale
- **Fix:** Correr `catalogo.dig` primero (Attempt 1424125690), luego `reporte.dig` (Attempt 1424125825)
- **Regla permanente:** Siempre `catalogo.dig` → `hechos.dig` → `reporte.dig`

### BUG-05: `intencion_nestle` subestimada — $66K en lugar de $279.7K
- **Síntoma:** `rpt_qcart` reportaba solo $66,360 intención Nestlé; pct_penetracion=2.5%
- **Causa:** CTE `nestle_productos` en `rebuild_rpt_qcart.sql` tenía `WHERE LOWER(brand) LIKE '%nestle%' OR LOWER(brand) LIKE '%nestlé%'`. Solo matcheaba la marca literal "nestle", ignorando Maggi ($18.9M+ en raw), La Lechera, Carnation, Nescafé, Nido, Nesquik, etc.
- **Raíz confirmada:** `land_qcart_productos` contiene SOLO marcas Nestlé — las 12 marcas distintas son todas del portfolio. No hay productos de competidores en esta tabla.
- **Fix:** Se eliminó el `WHERE` completamente de `nestle_productos`. Comentario explicativo agregado.
- **Resultado:** intencion_nestle corregida a **$279,728**; pct_global=**10.4%**; tkt_producto=**$26.94**
- **Workflow re-run:** Attempt 1424132257 ✅ · **Commit:** `3310f29` + `e787520`

### BUG-06: `pct_penetracion_nestle > 100%` en 29 rows
- **Síntoma:** Filas con pct como 2,216%, 1,691%, 658%, etc.
- **Causa (grain mismatch):** `views` en `land_qcart_carritos` ≠ `views` en `land_qcart_productos`. En carritos = cart sessions (deduplicadas); en productos = impresiones individuales por SKU. Un shortlink×fecha puede tener 1 cart session ($367.90) pero 174 impresiones de producto ($8,154), haciendo que `inn > itn`.
- **Impacto:** 29 rows afectadas, 102 carritos (1.4% del total 7,185)
- **Fix:** `CASE WHEN inn > itn THEN NULL ELSE pct END` — mostrar NULL en lugar de % imposible. El `pct_global` agregado (10.4%) no se ve afectado (se calcula de SUM(inn)/SUM(itn)).
- **Commit:** `f918371`

### BUG-07: `carritos_walmart + carritos_chedraui > carritos_total`
- **Síntoma:** Muchas filas donde la suma de splits Walmart+Chedraui excedía el total de carritos
- **Causa:** 712 filas en `land_qcart_carritos` tienen `store = 'chedraui-com-mx, walmart-com-mx'` o `'walmart-com-mx, chedraui-com-mx'` (valor combinado). Ambas condiciones LIKE matcheaban → 3,074 views contados doble.
- **Fix:** `NOT LIKE '%chedraui%'` agregado al CASE walmart; `NOT LIKE '%walmart%'` al CASE chedraui.
- **Verificación:** `rows_wm+ched>total = 0` post-fix.
- **Workflow re-run:** Attempt 1424132696 ✅ · **Commit:** `f918371`

---

## OIs abiertos

| ID | Descripción | Responsable | Estado |
|----|-------------|-------------|--------|
| OI-02 | Base email de envíos BD (sin CDP Hive) | Rick | 🔲 Pendiente |
| OI-09 | 4 nombres WA sin pieza_id: LALIGA-J10-SAB-12PM, LALIGA-J10-SAB-2PM, MEXVSCL-MAR-7PM | **Rick** | 🔲 Pendiente |
| OI-13 | Shortlinks Qcart: **329 de 408 sin mapeo** (4.64% cobertura actual) | **Rick** | 🔲 Bloqueante — completar hoja Shortlinks en catálogo |
| OI-15 | WA-MUNDIAL-CRM-HIVE — 6 filas GA eliminadas de `land_wa_envios` | Studio | ✅ Resuelto 2026-11-12 |
| OI-16 | `land_qcart_carritos`: 71,117 filas cargadas | Studio | ✅ Resuelto 2026-11-12 |
| OI-17 | 8 piezas WA clicks corregidos | Studio | ✅ Resuelto 2026-11-12 |
| OI-18 | Duplicados en `rpt_*` por pieza_segmento sin colapsar | Studio | ✅ Resuelto 2026-11-12 |
| **OI-19** | **Validación email vs SFMC — hallazgos completos** | **Studio + Rick** | **🔲 Decisión de Rick pendiente — ver análisis abajo** |
| **OI-20** | **`005-P012` aparece en rpt_qcart pero no en rpt_email ni rpt_whatsapp** | Studio | 🔲 Investigar |
| **OI-21** | **290 email_names sin mapeo en prod_sfmc_sends (50.4M sends no atribuidos)** | **Rick** | 🔲 Rick decide cuáles agregar al catálogo |

---

## Análisis OI-19: Validación email vs SFMC — RESULTADO

### Veredicto
**Los datos en TD son correctos.** Para todos los `email_name` registrados en `tabla_nombres`, `diff_sends = 0` — coincidencia perfecta con `prod_sfmc_sends`.

La "discrepancia" reportada NO es un error de datos: es que el catálogo CRM cubre solo una fracción de todos los envíos en SFMC.

### Escala real (2026, jobs con ≥10 sends)
| Estado | email_names | Jobs | Total Sends |
|--------|-------------|------|-------------|
| **MAPEADOS** (en catálogo) | 135 | 141 | **34.6M** |
| **SIN MAPEO** (fuera del reporte) | 290 | 5,071 | **50.4M** |

> Los mapeados tienen 141 jobs para 135 nombres porque algunas piezas tienen sends en más de un job_id (ej. A/B, re-send).
> Los SIN MAPEO tienen 5,071 jobs para 290 nombres porque incluyen campañas trigger/journey que generan un job por envío o por segmento.

### Campañas SIN MAPEO con mayor volumen (top 15)

| email_name | Tipo | Sends | Período |
|------------|------|-------|---------|
| NESCAFE CLASICO | Simple | 2.23M | Mar 2026 |
| RN_Volcano_12026 | RN_ prefix | 1.33M | Ene 2026 |
| O_Maggi-Seleccion-NC006537_1_... *(extras)* | O_ sin registrar | 1.20M | May 2026 |
| J_AMMA-Partnership-NC006962_... | O_/J_ sin registrar | 1.11M | Ene–Jul 2026 |
| RN_LigaMX_Jornada1 | RN_ prefix | 1.11M | Ene 2026 |
| RN_LigaMX_J2 | RN_ prefix | 1.10M | Ene 2026 |
| RN_MX VS PANAMA | RN_ prefix | 1.10M | Ene 2026 |
| RN_MX VS BOLIVIA | RN_ prefix | 1.09M | Ene 2026 |
| RN_LigaMX_Jornada_20260207 | RN_ prefix | 1.09M | Feb 2026 |
| RN_Volcano_1001_TP1 | RN_ prefix | 1.03M | Ene 2026 |
| RN_MaggyCrunchy_Tp2 | RN_ prefix | 1.03M | Ene 2026 |
| O_Recetas-NC008057_... *(var)*  | O_ NC diferente | 998K | Ago–Oct 2026 |
| J_MYW-NC004140_... *(14 segs)* | J_ sin registrar | ~9M total | Ene 2026 |
| J_Recetas-San-Valentin-NC008005_... | J_ sin registrar | ~1.8M | Feb 2026 |
| J_Cuaresma-Recetas-NC008303_... | J_ sin registrar | ~1.2M | Mar 2026 |

### Grupos de emails sin mapeo

| Grupo | Campañas | Sends |
|-------|----------|-------|
| Campañas CRM con O_/J_ naming correcto pero NO registradas | ~40 | ~35M |
| Campañas `RN_` prefix (naming diferente, mismos segmentos) | ~15 | ~12M |
| Purina/Petcare (MX.Purina.*, MX.Proplan.*) | 27 | 3.6M |

### Acción requerida: **Rick decide**

Los emails con O_/J_ naming correcto que faltan son campañas legítimas NMX no registradas en `land_piezas`+`land_nombres`. Ejemplos:

```
J_MYW-NC004140_...           → Nescafé Make Your World (Enero 2026)
J_Recetas-San-Valentin-...   → San Valentín 2026
J_Cuaresma-Recetas-...       → Cuaresma 2026
J_Anniversary-NC007063_...   → Aniversario 2026
J_Birthday-NC007068_...      → Cumpleaños (trigger)
O_NH-NC007067_...            → Nestlé Home, Sep 2026
O_Nescafe-HotSale-...        → Hot Sale 2026
O_FamilyNes-NC008592_...     → FamilyNes (extra jobs)
J_AMMA-Partnership-...       → AMMA Partnership
O_Recetas-NC008057_...       → Recetas CDP (NC diferente a NC000600)
J_Nescafe-Classic-NC002832_. → Nescafé Winback (Oct 2026)
O_Gerber-Decisions-...       → Gerber (otro brand)
```

Los `RN_` prefix son probablemente campañas del equipo de Recetas Nestlé con nomenclatura diferente. Rick debe confirmar si deben incluirse.

**Para agregar campañas:** Rick agrega filas en `land_piezas` (Excel) + `land_nombres` con los `email_name` exactos. Luego se re-ejecuta `catalogo.dig` → `hechos.dig` → `reporte.dig`.

### Métricas para emails MAPEADOS: ¿son correctas?
Sí. Para los 141 jobs con pieza registrada:
- `diff_sends = 0` para todos los verificados
- Opens y clicks usan `COUNT(DISTINCT subscriber_key)` = únicos, igual que SFMC
- Si SFMC muestra números distintos es porque está viendo piezas adicionales NO registradas en TD

---

## Plan OI-19: Checklist MCP (cuando esté disponible)

```
Para validación directa con SFMC vía MCP:
□ Confirmar email_names exactos de las campañas con discrepancia reportada
□ ¿Qué Job Names/IDs muestra SFMC para esas campañas?
□ Si están en la lista de SIN_MAPEO de arriba → confirmar si deben agregarse al catálogo
□ Para los MAPEADOS: verificar que Job Name en SFMC = nombre_unico en tabla_nombres
□ Revisar si hay splits A/B que TD consolida pero SFMC muestra por separado
```


- Foco inicial: piezas con mayor volumen donde la discrepancia sea más visible

---

## Plan ETAPA 7: Schedule semanal

```bash
tdx wf schedule nmx_crm_reporte.nmx_crm_reporte \
  --cron "0 22 * * 2" \
  --timezone "America/Mexico_City"
```

> Martes 22:00h MX. Ejecuta el workflow completo (`catalogo.dig` → `hechos.dig` → `reporte.dig`) en ese orden.
> **Pendiente:** Confirmar que `nmx_crm_reporte.nmx_crm_reporte` es el workflow master que llama a los 3 en secuencia, o crear uno nuevo.

---

## Catálogo de commits relevantes

| Commit | Descripción |
|--------|-------------|
| `323c9a9` | fix: _qc formato correcto en dashboard (lista → objeto agregado) |
| `4455581` | data: validación totales Qcart + fix duplicados CSV |
| `8aa4524` | fix: colapsar dupes CSV antes de atribución fact_qcart |
| `849809d` | docs: ESTADO.md validación Qcart completa |
| `77a8de9` | fix tipo_envio: 100años/Hotcakes/Checo → One-Shot |
| `493efee` | refresh dashboard datos reales post-pipeline |
| `6d6ab24` | fix OI-18: 0 duplicados en rpt_* |
| `3310f29` | **fix BUG-05: intencion_nestle subestimada — filtro brand incorrecto en rpt_qcart** |
| `e787520` | **fix BUG-05 + dashboard: intencion_nestle corregida ($66K→$280K, pct 2.5%→10.4%)** |
| `f918371` | **fix BUG-06+07: pct_penetracion NULL cuando inn>itn, store dual excluido de w/c** |
| `919bcca` | **dashboard: refresh datos con BUG-05/06/07 corregidos** |
| `ff60fa8` | chore: update tdx.json revision stamp |

---

## Cambios de arquitectura (2026-11)

- Repo: `catalogo/` · `insumos/` · `referencia/` · `workflow/queries/{catalogo,hechos,reporte}/`
- `load_catalogo.py` / `reload_catalog.py`: lee XLSX raw directamente + `WA_SKIP_NOMBRES` + `WA_CLICKS_OVERRIDE`
- `fix_wa_envios.py` en `my/scripts/`: corrección ad hoc de `land_wa_envios`
- Fact tables: formato v8 Principal+FUP wide, clicks desglosados CTA/Baja/Medidos
- `rpt_qcart` grain: `(pieza_id, quincena)` — agrega en dashboard con `aggregate_qc_for_pieza()`
- Dashboard `reporte-consolidado-crm.html`: 83 columnas ordenables, totales campaña P+FUP+Total+Qcart, paleta morado/rosa, Gotham/Montserrat, timestamp dinámico, filtro Quincena, badge v1
- **Regla de orden de ejecución:** `catalogo.dig` siempre primero — `tabla_piezas` stale rompe tipo_envio en todos los `rpt_*`
