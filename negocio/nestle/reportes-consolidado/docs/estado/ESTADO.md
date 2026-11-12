---
title: "ESTADO: Reporte Consolidado Nestlé México en Treasure Data"
updated: 2026-11-12T21:30
status: "Pipeline completo ✓. Dashboard live. OI-13 (shortlinks) pendiente Rick. OI-19 (validación email vs SFMC) abierto."
owner: Rick Aguilar
---

# ESTADO: Reporte Consolidado Nestlé México en TD

> Fuente de verdad del proyecto — actualizado 2026-11-12T21:30.
> Para la arquitectura del sistema, ver `ARQUITECTURA.md`. Para correr, ver `OPERACIONES.md`.

---

## Resumen ejecutivo (2026-11-12)

| Canal | Tabla fact | Estado | Tabla rpt | Métricas finales |
|-------|-----------|--------|-----------|-----------------|
| Email | `fact_envio_email` | ✓ | `rpt_email` | 105 rows · 100 piezas únicas · AON 19 rows · OS 86 rows |
| WhatsApp | `fact_envio_whatsapp` | ✓ corregido | `rpt_whatsapp` | 24 rows · 18 piezas · OI-15+17 resueltos |
| Qcart | `fact_evento_qcart_*` | ✓ validado | `rpt_qcart` | 183 rows · 37 piezas · 7,185 carritos · $2.69M intención |

**Cobertura Qcart en dashboard:**
- Email con Qcart: **28 piezas** (8 AON + 20 OS) — antes se reportaron 15/26 por archivo truncado
- WA con Qcart: **8 piezas** — antes se reportaban 5 por archivo truncado
- `005-P012`: pieza en `rpt_qcart` sin envíos en email ni WA — investigar si es pieza sin envíos registrados (ver OI-20)

> **Dashboard v1 publicado:** https://crm-omnicom-clients.github.io/Dashboards-Nestle-MX/dashboards/reporte-consolidado-crm.html
>
> Última actualización: 2026-11-12 — datos pipeline completo, Qcart 183 rows, fórmulas validadas.

---

## Avance por etapa

| Etapa | Descripción | Estado |
|-------|-------------|--------|
| 1 | Setup DBs + catálogo base | ✓ COMPLETA |
| 2 | Workflow Digdag: `catalogo.dig` | ✓ COMPLETA |
| 3 | Workflow Digdag: `hechos.dig` | ✓ COMPLETA |
| 4a | `fact_envio_email` | ✓ 105 filas · 100 piezas |
| 4b | `fact_envio_whatsapp` | ✓ 24 filas corregidas |
| 4c | `fact_evento_qcart_*` | ✓ 2,991 carritos · 37 piezas atribuidas |
| 5a | `rpt_email` | ✓ OI-18 resuelto · 105 filas · 0 duplicados |
| 5b | `rpt_whatsapp` | ✓ OI-18 resuelto · 24 filas · 0 duplicados |
| 5c | `rpt_qcart` | ✓ 183 filas · 37 piezas · totales validados |
| 6 | Dashboard HTML v1 | ✓ Publicado · datos reales · Qcart 28E+8WA piezas |
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
| **OI-19** | **Validación email vs SFMC: posibles discrepancias en métricas** | **Studio + Rick** | **🔲 Abierto — ver plan abajo** |
| **OI-20** | **`005-P012` aparece en rpt_qcart pero no en rpt_email ni rpt_whatsapp** | Studio | 🔲 Investigar |

---

## Plan OI-19: Validación email vs SFMC

### Contexto
Rick indica que hay datos en `fact_envio_email` / `rpt_email` que no coinciden con lo que muestra SFMC. Se conectará un MCP para doble validación directa contra SFMC.

### Hipótesis a revisar

1. **Desfase temporal / sync:** Los envíos de SFMC se sincronizan a TD con algún delay. Si el CSV de insumos se generó antes de que terminaran de procesarse todos los opens/clicks en SFMC, los números serán menores en TD.

2. **Deduplicación de opens/clicks:** SFMC reporta únicos (Unique Opens, Unique Clicks). TD puede estar contando todos los eventos incluyendo re-opens/re-clicks. Verificar si `fact_envio_email` usa conteos únicos o totales.

3. **Filtro de piezas:** El catálogo de TD incluye solo las piezas CRM registradas. Si SFMC tiene envíos adicionales (transaccionales, batch no-CRM) que no están en `land_piezas`, TD no los va a mostrar.

4. **Job IDs / Email Names:** La unión entre SFMC y TD se hace por `job_id` o `email_name`. Si hay discrepancia en los identificadores (typos, versiones, A/B sends), algunas piezas no van a matchear.

5. **Supresiones y bounces:** SFMC reporta Sends después de supresiones. TD puede tener Sends brutas del CSV. Verificar qué definición usa cada tabla.

6. **Métricas FUP:** Verificar que los `fup_*` de TD coincidan con los datos del FUP en SFMC (pueden estar en jobs separados).

### Checklist de validación (cuando esté el MCP)

```
Para cada pieza con discrepancia:
□ Comparar p_sends (TD) vs Sends (SFMC) → ¿mismo Job ID?
□ Comparar p_opens (TD) vs Unique Opens (SFMC) → ¿son únicos en ambos?
□ Comparar p_clicks (TD) vs Unique Clicks (SFMC)
□ Revisar fecha de extracción del CSV vs fecha de corte SFMC
□ Verificar que email_name en TD matchea exactamente con Job Name en SFMC
□ Revisar si hay splits A/B no consolidados
□ Confirmar que los FUPs están correctamente vinculados (mismo job o jobs separados)
```

### Tablas a comparar
- `nmx_insumos.land_email_envios` (raw del CSV de SFMC) vs SFMC directo
- `nmx_hechos.fact_envio_email` (procesado) vs SFMC
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

---

## Cambios de arquitectura (2026-11)

- Repo: `catalogo/` · `insumos/` · `referencia/` · `workflow/queries/{catalogo,hechos,reporte}/`
- `load_catalogo.py` / `reload_catalog.py`: lee XLSX raw directamente + `WA_SKIP_NOMBRES` + `WA_CLICKS_OVERRIDE`
- `fix_wa_envios.py` en `my/scripts/`: corrección ad hoc de `land_wa_envios`
- Fact tables: formato v8 Principal+FUP wide, clicks desglosados CTA/Baja/Medidos
- `rpt_qcart` grain: `(pieza_id, quincena)` — agrega en dashboard con `aggregate_qc_for_pieza()`
- Dashboard `reporte-consolidado-crm.html`: 83 columnas ordenables, totales campaña P+FUP+Total+Qcart, paleta morado/rosa, Gotham/Montserrat, timestamp dinámico, filtro Quincena, badge v1
- **Regla de orden de ejecución:** `catalogo.dig` siempre primero — `tabla_piezas` stale rompe tipo_envio en todos los `rpt_*`
