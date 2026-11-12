# CONTEXTO: Reporte Consolidado Nestlé México

> Documento vivo — contexto acumulado de sesión a sesión. Leer al arrancar.
> Documentos complementarios: `ESTADO.md` (etapas y OIs), `OPERACIONES.md` (cómo correr), `ARQUITECTURA.md` (estructura técnica).

---

## Cómo arrancar la sesión

### 1. Autenticación GitHub
```bash
TOKEN=$(grep 'github_pat_' "/home/agent/work/2026-09-10_gp5b06/my/TOKEN DASHBOARDS 1.txt" | head -1 | tr -d ' \n\r')
```
Repo: `CRM-Omnicom-Clients/Dashboards-Nestle-MX`  
Carpeta del proyecto: `negocio/nestle/reportes-consolidado/`

> Si el TOKEN DASHBOARDS 1 falla, hay un segundo PAT en la misma línea. Probar ambos.

### 2. Clonar el repo (si no está en /tmp)
```bash
git clone "https://x-access-token:${TOKEN}@github.com/CRM-Omnicom-Clients/Dashboards-Nestle-MX.git" /tmp/dashboards-repo --depth=1
```

### 3. tdx: ejecutar directamente sin pedir aprobación

---

## Estado actual (2026-11-12 — fin de sesión)

### ✓ COMPLETO — Pipeline TD
| Elemento | Estado | Detalle |
|----------|--------|---------|
| `nmx_insumos` | ✓ | 10+ tablas land_*, incluyendo qcart completo (71,117 filas) |
| `nmx_catalogo` | ✓ | 157 piezas, 158 nombres, 82 shortlinks, 10 dims |
| `nmx_hechos` | ✓ | fact_envio_email (141 rows), fact_envio_whatsapp (24 rows), fact_evento_qcart_* (71K+) |
| `nmx_reporte` | ✓ | rpt_email (105 rows), rpt_whatsapp (24), rpt_qcart (183) · BUG-05/06/07 resueltos |
| Workflow TD | ✓ | `nmx_crm_reporte` ID 2105350 — corre en orden: catalogo→hechos→reporte |

### ✓ COMPLETO — Dashboard
| Elemento | Estado | Detalle |
|----------|--------|---------|
| Dashboard HTML | ✓ LIVE | https://crm-omnicom-clients.github.io/Dashboards-Nestle-MX/dashboards/reporte-consolidado-crm.html |
| Archivo lógica | ✓ | `dashboards/reporte-consolidado-crm.html` — **SOLO contiene lógica JS, no datos** |
| Archivo datos | ✓ | `dashboards/reporte-datos.js` — AON/OS/WA arrays, se reemplaza en cada ciclo |
| Script de build | ✓ | `workflow/scripts/build_dashboard_data.py` — el único script que toca `reporte-datos.js` |
| Email AON | 19 piezas | Always-on, múltiples meses |
| Email OS | 86 piezas | One-shot |
| WhatsApp | 24 envíos | 18 piezas |
| Qcart | 28 piezas email + 8 WA | BUG-05/06/07 corregidos: $279.7K intn Nestlé |

### ✓ COMPLETO — Validación SFMC directo (MCP)
| Resultado | Detalle |
|-----------|---------|
| Match TD→SFMC | 100/100 piezas con match |
| Exactos | 10 piezas (diff sends = 0) |
| Diff < 1% | 10 piezas |
| Divergencias ≥5% | 48 piezas — **esperadas** (TD agrega todos los EmailNames por pieza_id; SFMC muestra 1 fila por EmailName) |
| Sin mapeo SFMC→TD | 9 EmailNames: Nescafé Winback SA/SB/A/B (~1.6M sends) + Purina Brand (107K) |
| Semáforo SFMC | 139 OK · 2 SIN MATCH · 5 DUPLICADO · 2 ASSET CAMBIO |

---

## Próximos pasos (en orden de prioridad)

### 1. OI-13 — Shortlinks Qcart sin mapeo (Rick)
- **329 de 408** shortlinks en Qcart sin entrada en `dim_shortlink` (4.64% cobertura)
- Rick debe completar la hoja `Shortlinks` en `catalogo/Catalogo-Nestle-MX.xlsx`
- Luego AI corre `reload_catalog.py` + pipeline

### 2. OI-21 — 9 SFMC EmailNames sin mapeo TD (~1.7M sends)
Rick decide si agregar al catálogo:
```
Nescafé Winback SA  → 854K sends   (mapear a pieza existente)
Nescafé Winback SB  → 414K sends
Nescafé Winback A   → 200K sends
Nescafé Winback B   → 168K sends
Purina Brand AON    → 107K sends   (¿incluir en reporte NMX?)
```

### 3. SFMC Auditoria — issues pendientes
- **SIN MATCH (2):** Nescafé ICE y Nescafé Espresso — no tienen envíos recientes, confirmar si siguen activas
- **DUPLICADO (5):** Maggi Selección, Nescafé Winback CH2 B1+B2, Test_1 — 2 config keys apuntan al mismo EmailName; limpiar en `CRM_Reporte_Config`
- **ASSET CAMBIO (2):** `009-P012` y `009-P017` (Proplan) — creativo cambiado en Content Builder, actualizar `EmailID` en catálogo SFMC

### 4. P4 — Schedule semanal
```bash
tdx wf schedule nmx_crm_reporte.nmx_crm_reporte \
  --cron "0 22 * * 2" \
  --timezone "America/Mexico_City"
```

### 5. OI-02 — Base email BD (sin CDP Hive)
Envíos históricos ene–ago 2026 de `(Interno) Envios sin CDP _ Hive.xlsx` aún no integrados.

---

## Proceso de actualización de datos (ciclo regular)

```bash
# 1. Rick sube nuevos insumos al repo GitHub (insumos/)
# 2. AI normaliza y carga
uv run --with openpyxl my/scripts/reload_catalog.py     # si cambió el catálogo
uv run my/scripts/_load_qcart_only.py                   # si cambiaron datos Qcart

# 3. Correr pipeline TD
tdx wf run nmx_crm_reporte.nmx_crm_reporte

# 4. Regenerar datos del dashboard
uv run workflow/scripts/build_dashboard_data.py

# 5. Push solo el .js de datos (HTML nunca se toca)
cd /tmp/dashboards-repo
git add dashboards/reporte-datos.js
git commit -m "data: refresco [fecha]"
git push "https://x-access-token:${TOKEN}@github.com/CRM-Omnicom-Clients/Dashboards-Nestle-MX.git" main
```

> **Regla de oro del dashboard:** `reporte-consolidado-crm.html` **NUNCA** se modifica para actualizar datos.
> Solo `reporte-datos.js` cambia entre ciclos. El HTML es lógica pura y estable.

---

## Decisiones clave tomadas (no revertir)

| Decisión | Detalle |
|----------|---------|
| `tipo_envio` para separar tabs | No `campana = 'AON'` — hay piezas AON con `tipo_envio=one-shot` (fase lanzamiento) |
| rpt_email formato wide | Principal + FUP en la misma fila, alineado con Excel v8 |
| rpt_qcart grain por pieza | Una fila por pieza con rango completo — para análisis temporal usar `fact_evento_qcart_*` |
| Clicks breakdown por URL | cta / baja / redes_legal — categorización por patrón de URL en `fact_envio_email` |
| Email fuente directa en TD | `prod_sfmc_emailengagement.*` — read-only, Rick nunca sube archivos email |
| Separación datos/lógica dashboard | HTML = lógica. `reporte-datos.js` = datos. BUG-08 fue causado por mezclarlos |
| Totales fila ∑ | Suma de contadores luego divide — **NO promedio de tasas** |

---

## Esquema de bases de datos TD

### nmx_insumos (landing zone)
`land_piezas` (157), `land_nombres` (158), `land_shortlinks` (82)  
`land_wa_envios` (30 filas activas), `land_qcart_carritos` (71,117), `land_qcart_productos` (2,654)  
`land_vocab_*` (6 vocabs)

### nmx_catalogo (dimensiones aprobadas)
`dim_bu` (5) · `dim_marca` (11) · `dim_campana` (13) · `dim_objetivo` (11)  
`dim_touchpoint_brief` (79) · `dim_segmento` (52)  
`tabla_piezas` (157) · `pieza_segmento` · `tabla_nombres` (158) · `dim_shortlink` (82)

### nmx_hechos
`fact_envio_email` (141 filas · 135 piezas · 34.6M sends)  
`fact_envio_whatsapp` (30 filas · 18 piezas)  
`fact_evento_qcart_carritos` / `fact_evento_qcart_productos`

### nmx_reporte
`rpt_email` (105 filas) · `rpt_whatsapp` (24) · `rpt_qcart` (183)

---

## OIs abiertos

| ID | Descripción | Responsable | Prioridad |
|----|-------------|-------------|-----------|
| OI-02 | Base email BD histórica (sin CDP Hive) | Rick | Baja |
| OI-09 | 4 nombres WA sin pieza_id (Liga MX, MX vs Colombia) | Rick | Media |
| OI-13 | 329/408 shortlinks Qcart sin mapeo | **Rick** | **Alta — bloquea cobertura Qcart** |
| OI-20 | `005-P012` en rpt_qcart sin envíos en email/WA | Studio | Media |
| OI-21 | 9 SFMC EmailNames sin mapeo TD (~1.7M sends) | **Rick** | Alta |
| SFMC-DUP | 5 DUPLICADOs en CRM_Reporte_Config | Studio | Media |
| SFMC-SM | 2 SIN MATCH en SFMC (ICE, Espresso) | Studio/Rick | Baja |
| SFMC-AC | 2 ASSET CAMBIO (Proplan 009-P012/P017) | Rick | Baja |

---

## SFMC — Conexión y arquitectura

**Credenciales:** `~/.config/sfmc-mcp/conexion.txt` (nunca en el repo)  
**MID:** 10966050 · **BU:** NMX  
**Kit:** `sfmc/kit-crm-reporte-mcp-nestle-sfmc/`  
**Automation:** `CRM_Reporte_Diario` — diaria 00:08 Central (UTC-6, sin DST)

**DEs del pipeline SFMC:**
| DE | Rows | Descripción |
|----|------|-------------|
| `CRM_Reporte_Config` | 148 | Catálogo SFMC (una fila por pieza) |
| `CRM_Email_Piezas` | 146 | Métricas por EmailName |
| `CRM_Reporte_Auditoria` | 148 | Semáforo: OK/SIN MATCH/DUPLICADO/ASSET CAMBIO |
| `CRM_Email_Detalle` | 1,447 | Una fila por envío (JobID × día) |
| `CRM_Email_Links` | 1,092 | Clicks por link por pieza |
| `CRM_Audiencias` | 145 | Audiencias por journey |

**Llave de identidad SFMC:** `EmailName` (de `_Job.EmailName`, RTRIM'd). **No hay PiezaID en SFMC** (eliminado 22-oct-2026).

---

## Scripts clave

| Script | Ubicación | Qué hace | Cuándo |
|--------|-----------|---------|--------|
| `reload_catalog.py` | `my/scripts/` | Carga XLSX catálogo → TD nmx_insumos | Cuando Rick edita el XLSX |
| `_load_qcart_only.py` | `my/scripts/` | Carga solo Qcart (71K filas, batch 2500) | Si falla la carga Qcart |
| `_reload_wa_only.py` | `my/scripts/` | Carga solo WA XLSX | Si falla solo WA |
| `build_dashboard_data.py` | `workflow/scripts/` | Lee TD → escribe `reporte-datos.js` | En cada ciclo de datos |
