---
title: "ESTADO: Reporte Consolidado Nestlé México en Treasure Data"
updated: 2026-11-13T19:00
status: "Pipeline completo ✓. Schedule L-V 03:33 CDMX activo. Filtro quincena/mes en dashboard. 0 duplicados. 5 piezas WA-MUNDIAL corregidas."
owner: Rick Aguilar
---

# ESTADO: Reporte Consolidado Nestlé México en TD

> Fuente de verdad del proyecto — actualizado 2026-11-13T19:00 CDMX.
> Arquitectura detallada con diagramas: `my/ARQUITECTURA.md`.
> Historial de decisiones landing autónomo: `my/HANDOFF-landing-autonomo.md`.

---

## Resumen ejecutivo (2026-11-13)

| Canal | Tabla fact | Estado | Tabla rpt | Métricas vigentes |
|-------|-----------|--------|-----------|------------------|
| Email | `fact_envio_email` | ✅ | `rpt_email` | **105 rows** · 100 piezas únicas · AON 18 rows · OS 87 rows |
| WhatsApp | `fact_envio_whatsapp` | ✅ BUG-12 resuelto | `rpt_whatsapp` | **18 rows** · 18 piezas · 0 duplicados · 5 Mundial con quincena correcta |
| Qcart | `fact_evento_qcart_*` | ✅ BUG-13 resuelto | `rpt_qcart` | **183 rows** · 37 piezas · filtro período activo en dashboard |

**Dashboard publicado:**
> https://crm-omnicom-clients.github.io/Dashboards-Nestle-MX/dashboards/reporte-consolidado-crm.html
> Último commit: `2052a54` — 2026-11-13

**Métricas Qcart consolidadas (RN + Alianzas + Abuelita WA):**

| Canal | Intención Total | Intención Nestlé | Penetración | Carritos | Ticket |
|-------|----------------|-----------------|-------------|---------|--------|
| **Total** | **$3,979,765** | **$344,204** | **8.6%** | **10,323** | **$386** |
| Email (RN + Alianzas) | $3,625,014 | $305,518 | 8.4% | 9,183 | $395 |
| WhatsApp (RN + Abuelita) | $354,751 | $38,686 | 10.9% | 1,140 | $311 |

---

## Avance por etapa — 2026-11-13

| Etapa | Descripción | Estado |
|-------|-------------|--------|
| 1 | Setup DBs + catálogo base | ✅ COMPLETA |
| 2 | Workflow Digdag: `catalogo.dig` | ✅ COMPLETA |
| 3 | Workflow Digdag: `hechos.dig` | ✅ COMPLETA |
| 4a | `fact_envio_email` | ✅ 105 filas · 100 piezas |
| 4b | `fact_envio_whatsapp` | ✅ 18 filas · BUG-11-WA+BUG-12 resueltos |
| 4c | `fact_evento_qcart_*` | ✅ BUG-13 (QUALIFY→ROW_NUMBER) resuelto |
| 5a | `rpt_email` | ✅ 105 filas · 0 duplicados |
| 5b | `rpt_whatsapp` | ✅ 18 filas · 0 duplicados |
| 5c | `rpt_qcart` | ✅ 183 filas · 37 piezas · totales auditados |
| 6 | Dashboard HTML v1 | ✅ Publicado · filtro período activo · commit `2052a54` |
| P1 | Catálogo rebuild (AON/OS verificado, 157 piezas) | ✅ COMPLETA 2026-11-12 |
| P2 | WA insumos corregidos (OI-15+17) | ✅ COMPLETA 2026-11-12 |
| P3 | Pipeline final + dashboard refrescado | ✅ COMPLETA 2026-11-12 |
| P4 | Schedule L-V 03:33 CDMX + landing autónomo | ✅ COMPLETA 2026-11-13 · Schedule #640115 activo |
| P5 | Filtro período Qcart (quincena/mes en dashboard) | ✅ COMPLETA 2026-11-13 · commit `3618d4e` |
| P6 | 0 duplicados WA + auditoría completa email/WA/Qcart | ✅ COMPLETA 2026-11-13 · commits `ffbfbc4` + `2052a54` |

---

## Bugs resueltos — histórico completo

| Bug | Descripción | Fix | Commit |
|-----|-------------|-----|--------|
| BUG-01 | `_qc` inyectado como lista cruda → formato incorrecto en dashboard | `aggregate_qc_for_pieza()` suma y renombra claves | `323c9a9` |
| BUG-02 | Archivo `rpt_qcart.jsonl` truncado — 98/183 rows | Re-fetch con `--limit 300` | — |
| BUG-03 | 27,731 filas duplicadas en `land_qcart_carritos` antes del JOIN | CTE `land_collapsed` GROUP BY + SUM previo | `8aa4524` |
| BUG-04 | `tipo_envio` incorrecto (100 años, Hotcakes, Checo en AON) | Correr `catalogo.dig` antes de `reporte.dig` | — |
| BUG-05 | `intencion_nestle` subestimada ($66K → $280K) por filtro `brand='nestle'` | Eliminar filtro brand en `nestle_productos` CTE | `3310f29` |
| BUG-06 | `pct_penetracion > 100%` en 29 rows por grain mismatch carritos/productos | `CASE WHEN inn > itn THEN NULL` | `f918371` |
| BUG-07 | `carritos_walmart + chedraui > total` por store combinado matcheando ambas condiciones | `NOT LIKE '%chedraui%'` en CASE walmart | `f918371` |
| BUG-08 | (reservado) | — | — |
| BUG-09 | `tiene_qcart = 'Sí'` incorrecto para shortlinks con `estado_link != 'USADO'` | Fix WHERE en `rebuild_rpt_email.sql` | `e6ff64c` |
| BUG-10 | Filas duplicadas en `rpt_qcart` y `rpt_email` por JOIN directo con `pieza_segmento` | Subquery ARRAY_AGG antes del JOIN | `6dca60c` |
| BUG-11 | `intencion_nestle_mxn` filtrada solo a `brand='nestle'` (versión rpt_qcart) | Sin filtro brand — todo portafolio Nestlé | repo directo |
| BUG-11-WA | 34 filas en `rpt_whatsapp` (debían ser 18) por JOIN `pieza_segmento` + GROUP BY `nombre_wa` | CTE pre-agrega antes del JOIN catálogo; remueve `nombre_wa` | `ffbfbc4` |
| BUG-12 | 5 piezas WA-MUNDIAL con `quincena/mes/send_date` vacíos en `land_wa_envios` | Fallback `COALESCE(quincena, derivada tabla_piezas.fecha_primer_envio)` en `rebuild_fact_envio_whatsapp.sql` | `2052a54` |
| BUG-13 | `QUALIFY ROW_NUMBER()` no soportado en Presto 423 en `rebuild_fact_qcart_carritos.sql` | Reescrito como subquery `WHERE rn = 1` | `2052a54` |

---

## OIs — abiertos y cerrados

| ID | Descripción | Estado |
|----|-------------|--------|
| OI-02 | Base email de envíos BD (sin CDP Hive) — scope fuera del reporte actual | 🔲 Pendiente de Rick |
| OI-09 | 4 nombres WA Liga MX sin pieza_id (LALIGA-J10-SAB-12PM, J9-5PM, etc.) | 🔲 Pendiente — Rick agrega a catálogo si aplica |
| OI-13 | Shortlinks Qcart: 343/408 sin mapeo | ✅ **CERRADO** — cobertura parcial intencional (solo email+master CRM), Rick confirmó 2026-11-13 |
| OI-15 | WA-MUNDIAL-CRM-HIVE — 6 filas GA eliminadas de `land_wa_envios` | ✅ Resuelto 2026-11-12 |
| OI-16 | `land_qcart_carritos`: 71,117 filas cargadas | ✅ Resuelto 2026-11-12 |
| OI-17 | 8 piezas WA clicks corregidos | ✅ Resuelto 2026-11-12 |
| OI-18 | Duplicados en `rpt_*` por pieza_segmento sin colapsar | ✅ Resuelto 2026-11-12 (BUG-10) |
| OI-19 | Validación email vs SFMC — datos coinciden 100% para los 141 jobs mapeados | ✅ **CERRADO** — `diff_sends = 0` para todos los mapeados; los 290 sin mapeo son campañas fuera de scope del reporte |
| OI-20 | `005-P012` en `rpt_qcart` sin envíos en email ni WA | 🔲 Investigar si es pieza sin envíos registrados |
| OI-21 | 290 email_names sin mapeo en prod_sfmc_sends (50.4M sends no atribuidos) | 🔲 Rick decide cuáles agregar al catálogo |

---

## Fórmulas del dashboard (referencia)

### Email
| Columna | Fórmula | Notas |
|---------|---------|-------|
| Open% | opens ÷ deliveries | Tasa de apertura sobre entregados |
| CTOR% | clicks ÷ opens | Click-to-Open Rate |
| Click% | clicks ÷ deliveries | CTR sobre entregados |
| UTOR% | unsubs ÷ opens | Unsubscribe rate sobre aperturas |
| %CTA/U | cta_clicks ÷ total_clicks | % clicks intencionales |
| Total P+FUP | Σ(p_* + fup_*) | FUP solo cuando existe |
| **∑ campaña** | Σ contadores luego ÷ | **NO promedio de tasas** |

### WhatsApp
| Columna | Fórmula |
|---------|---------|
| Delivery% | deliveries ÷ sends |
| No Ent% | no_entregados ÷ sends |
| Read% | opens_read ÷ deliveries |
| CTR/Read | clicks ÷ opens_read |

### Qcart (filtro período activo)
| Columna | Fórmula |
|---------|---------|
| Carritos Total | Σ views para el período seleccionado |
| Intención Total | Σ total_shown_price para el período |
| %Nestlé | Σ intencion_nestle ÷ Σ intencion_total |
| Ticket Carrito | Σ intencion_total ÷ Σ carritos_total |
| Ticket Producto | Σ intencion_nestle ÷ Σ views_productos_nestle |

> Nota crítica: `total_shown_price` en CSV es el valor agregado de todos los views, no precio por carrito individual.

---

## Pipeline autónomo — estado (2026-11-13)

| Dato | Valor |
|---|---|
| Schedule activo | `#640115 nmx_crm_reporte` |
| Cron | `33 3 * * 1-5` America/Mexico_City (L–V 03:33) |
| Siguiente run automático | 2026-11-16 03:33 CDMX |
| Schedule desactivado | `#640484 [.]` — duplicado por segundo upload |
| Primer run automático | 2026-11-13 03:33 ✅ éxito |
| Project ID | 2105350 |
| Revisión actual | `2026-11-13T18-44-47-408Z` |

---

## Commits — catálogo cronológico

| Commit | Descripción | Fecha |
|--------|-------------|-------|
| `323c9a9` | fix: _qc formato correcto (lista → objeto agregado) | 2026-11-12 |
| `6d6ab24` | fix OI-18: 0 duplicados en rpt_* (BUG-10) | 2026-11-12 |
| `3310f29` | fix BUG-05: intencion_nestle filtro brand incorrecto | 2026-11-12 |
| `e787520` | fix BUG-05 + dashboard: intencion_nestle $66K→$280K | 2026-11-12 |
| `f918371` | fix BUG-06+07: pct NULL cuando inn>itn, store dual excluido | 2026-11-12 |
| `87ad014` | docs: OI-13 cerrado — cobertura shortlinks intencional | 2026-11-13 |
| `2afbbba` | docs: ESTADO completo ambos dashboards | 2026-11-13 |
| `3618d4e` | feat: filtro período Qcart (_qc por quincena, resolveQc/aggQc) | 2026-11-13 |
| `ffbfbc4` | fix: 34→18 filas rpt_whatsapp (BUG-11-WA) | 2026-11-13 |
| `2052a54` | fix: WA Mundial fechas desde catálogo + QUALIFY→ROW_NUMBER (BUG-12/13) | 2026-11-13 |
