# HANDOFF — Landing autónomo nmx_crm_reporte

**Inicio:** 2026-11-12 · **Estado:** ✅ PRODUCCIÓN · **Primer run:** 2026-11-13 03:33 CDMX

---

## Estado al 2026-11-13

Pipeline completo en producción. Schedule activo L–V 03:33 CDMX. Primer run automatizado completado.

| Componente | Estado | Detalles |
|---|---|---|
| `nmx_crm_reporte.dig` | ✅ | Master con schedule `33 3 * * 1-5` America/Mexico_City |
| `landing.dig` | ✅ | detect → loads paralelos → persist_markers |
| `catalogo.dig` | ✅ | Sin cambios funcionales; email corregido |
| `hechos.dig` | ✅ | Sin cambios funcionales |
| `reporte.dig` | ✅ | Sin cambios funcionales |
| Schedule `#640115` | ✅ | nmx_crm_reporte — L-V 03:33, próximo 2026-11-16 |
| Schedule `#640484` | 🚫 DESACTIVADO | Duplicado con `[.]` generado por segundo upload |
| Secrets TD | ✅ | `github_pat_dashboards` + `td.apikey` configurados |

---

## Arquitectura del landing autónomo

```
nmx_crm_reporte.dig
├── landing.dig          ← autónomo: solo recarga si hay cambios en GitHub
│   ├── read_markers     td> nmx_insumos.sync_markers → ${td.last_results.markers_json}
│   ├── detect           py> detect.main (compara SHA GitHub vs markers)
│   ├── loads (_parallel)
│   │   ├── if_catalogo  py> load.catalogo_prod  (si catalogo_changed)
│   │   ├── if_wa        py> load.wa_prod         (si wa_changed)
│   │   └── if_qcart     py> load.qcart_prod      (si qcart_changed)
│   └── persist_markers  py> markers.upsert (si any_change)
├── catalogo.dig
├── hechos.dig
└── reporte.dig
```

**Repo fuente:** `RickAguilarOmnicom/NUBE-CLAUD`
**Secret auth:** `${secret:github_pat_dashboards}` para GitHub API, `${secret:td.apikey}` para escritura a TD
**Tabla markers:** `nmx_insumos.sync_markers (path, blob_sha, loader, loaded_at)`

---

## Reglas de atribución Qcart (metodología confirmada 2026-11-13)

### Shortlinks oficiales (vía `dim_shortlink`)
- Filtro: `brand LIKE '%nestle%'` sobre `fact_evento_qcart_productos`
- Activación: `fecha >= fecha_activacion` del catálogo
- Excluye automáticamente shortlinks no registrados en `dim_shortlink`

### Alianzas (medición ad hoc — fuera del catálogo oficial)
- Shortlinks: `nMo8xFmB` (Carnation), `PfmeoFGv` (Maggi) — NO están en `dim_shortlink`
- Medición: `land_qcart_carritos` filtrado por `utm_campaign LIKE '%lianza%'`
- **Fecha activación confirmada: 2026-10-30** (Rick Aguilar, 2026-11-13)
- Shortlink `PfmeoFGv` (Ponche Navideño vía Recetas): **excluido** — no activado aún

### Chocolate Abuelita WA (medición ad hoc)
- Shortlink: `gFS7vAke` — NO en `dim_shortlink`
- **Fecha activación confirmada: 2026-10-30** (Rick Aguilar, 2026-11-13)
- Brand en Qcart = "abuelita" (no "nestle") → bajo regla estándar = $0 Nestlé
- **Decisión vigente:** contabilizado en `intencion_total_mxn` pero NO en `intencion_nestle_mxn`

---

## Métricas Qcart consolidadas (snapshot 2026-11-13)

> Incluye RN oficial + Alianzas + Abuelita WA. Período desde activación de cada canal.

| Canal | Intención Total | Intención Nestlé | Penetración | Carritos | Ticket |
|-------|----------------|-----------------|-------------|---------|--------|
| **Total** | $3,979,765 | $344,204 | **8.6%** | 10,323 | $386 |
| Email (RN + Alianzas) | $3,625,014 | $305,518 | 8.4% | 9,183 | $395 |
| WhatsApp (RN + Abuelita) | $354,751 | $38,686 | 10.9% | 1,140 | $311 |

> Si Abuelita se contara como 100% Nestlé: intencion_nestle = $368,724 / penetración = 9.3%

---

## Archivos locales clave

| Artefacto | Ruta |
|---|---|
| Master workflow | `my/workflow/nmx_crm_reporte.dig` |
| Landing dig | `my/workflow/landing.dig` |
| Detector | `my/workflow/detect.py` |
| Loader | `my/workflow/load.py` |
| Markers upsert | `my/workflow/markers.py` |
| SQL read markers | `my/workflow/queries/read_markers.sql` |
| PAT GitHub | `my/GITHU-NUBECLAUD-TOKEN-TDSTUDIO=gith.txt` |

---

## Decisiones fijas (no re-litigar)

1. **Schedule L–V 03:33 CDMX** (cron `33 3 * * 1-5`) — sin shadow previo, cutover directo
2. **catalogo.dig → hechos.dig → reporte.dig** — orden siempre; catalogo primero
3. **Scripts legacy quedan como fallback** — `reload_catalog.py` y `_load_qcart_only.py` no se borran
4. **Alianzas/Abuelita NO están en `dim_shortlink`** — medición ad hoc documentada arriba; pendiente de formalizar en catálogo si Rick lo decide
5. **Secret names definitivos:** `github_pat_dashboards` (GitHub) · `td.apikey` (Treasure Data)

---

## Bugs resueltos

| Bug | Descripción | Resuelto |
|-----|-------------|---------|
| BUG-09 | `tiene_qcart = 'Sí'` incorrecto para shortlinks con `estado_link != 'USADO'` | ✅ 2026-11-13 · fix en `rebuild_rpt_email.sql` línea 178 · commit `e6ff64c` |

**Validación BUG-09:** 004-P006/P007/P008 → `tiene_qcart='No'` (sin datos en rpt_qcart). 005-P008 → `'Sí'` (con datos). Global: 28 piezas con `Sí` = exactamente 28 con datos en rpt_qcart.

---

## Pendientes

| Item | Responsable |
|---|---|
| Verificar primer run automático 2026-11-16 03:33 (siguiente L-V) en TD console | Rick |
| Decidir si Alianzas/Abuelita se agregan a `dim_shortlink` (formalización) | Rick |
| OI-13: 329 shortlinks Qcart sin mapeo en catálogo | Rick |
| OI-19: Validación email vs SFMC (Rick conectará MCP) | Rick |
