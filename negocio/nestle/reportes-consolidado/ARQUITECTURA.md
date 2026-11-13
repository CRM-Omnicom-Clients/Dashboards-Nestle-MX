---
title: "ARQUITECTURA: CRM Reporte Consolidado Nestlé México"
updated: 2026-11-13
owner: Rick Aguilar
---

# ARQUITECTURA: CRM Reporte Consolidado Nestlé México

> Documento de referencia permanente. Actualizado 2026-11-13 tras sesión de auditoría completa.

---

## 1. Visión general del sistema

```mermaid
flowchart TD
    subgraph SRC ["Fuentes de datos"]
        SFMC["SFMC (Salesforce MC)\nprod_sfmc_*"]
        GH["GitHub NUBE-CLAUD\nCatálogo XLSX / WA XLSX / Qcart CSV"]
    end

    subgraph TD ["Treasure Data"]
        subgraph INS ["nmx_insumos (landing raw)"]
            LI["land_piezas\nland_nombres\nland_shortlinks\nland_segmentos"]
            LW["land_wa_envios"]
            LQ["land_qcart_carritos\nland_qcart_productos"]
        end

        subgraph CAT ["nmx_catalogo (dimensiones)"]
            TP["tabla_piezas"]
            TN["tabla_nombres"]
            DS["dim_shortlink\ndim_marca / dim_bu\ndim_campana / dim_objetivo\ndim_touchpoint_brief\npieza_segmento"]
        end

        subgraph HEC ["nmx_hechos (hechos atómicos)"]
            FE["fact_envio_email\ngrain: pieza_id × email_job_id"]
            FW["fact_envio_whatsapp\ngrain: pieza_id × nombre_wa × quincena"]
            FC["fact_evento_qcart_carritos\ngrain: pieza_id × fecha_hora × shortlink × store"]
            FP["fact_evento_qcart_productos\ngrain: pieza_id × fecha_hora × shortlink × product × store"]
        end

        subgraph RPT ["nmx_reporte (agregados)"]
            RE["rpt_email\ngrain: pieza_id × mes"]
            RW["rpt_whatsapp\ngrain: pieza_id × quincena"]
            RQ["rpt_qcart\ngrain: pieza_id × quincena"]
        end

        subgraph VAL ["QC guards (reporte.dig)"]
            QC1["QC-01: 0 duplicados en rpt_*"]
            QC2["QC-02: balance rpt_qcart = fact"]
            QC3["QC-03: tiene_qcart consistente"]
            QC4["QC-04: pct_penetracion ∈ [0,100]"]
            QC5["QC-05: walmart+chedraui ≤ total"]
        end
    end

    subgraph DASH ["Dashboard (GitHub Pages)"]
        JS["reporte-datos.js\n(build_dashboard_data.py)"]
        HTML["reporte-consolidado-crm.html"]
    end

    GH -->|"landing.dig (autónomo)"| LI
    GH -->|"landing.dig (autónomo)"| LW
    GH -->|"landing.dig (autónomo)"| LQ
    SFMC --> FE
    LI -->|"catalogo.dig"| TP & TN & DS
    LW -->|"hechos.dig"| FW
    LQ -->|"hechos.dig"| FC & FP
    TP & TN & SFMC -->|"hechos.dig"| FE
    FE & TP & DS --> RE
    FW & TP --> RW
    FC & FP & DS & TP --> RQ
    RE & RW & RQ -->|"build_dashboard_data.py"| JS
    JS --> HTML

    RE --> QC1
    RW --> QC1
    RQ --> QC1
    RQ --> QC2 & QC3 & QC4 & QC5
```

---

## 2. Pipeline de ejecución — Digdag

```mermaid
flowchart LR
    SCH["Schedule\n33 3 * * 1-5\nCDMX"] --> MASTER

    subgraph MASTER ["nmx_crm_reporte.dig"]
        L["landing.dig\n(autónomo por SHA)"]
        C["catalogo.dig"]
        H["hechos.dig"]
        R["reporte.dig"]
        L --> C --> H --> R
    end

    subgraph LANDING_DETAIL ["landing.dig (detalle)"]
        RM["read_markers\nnmx_insumos.sync_markers"]
        DET["detect.py\ncompara SHA GitHub vs markers"]
        PAR["_parallel\nif_catalogo · if_wa · if_qcart"]
        PM["persist_markers\nupsert SHA nuevo"]
        RM --> DET --> PAR --> PM
    end

    subgraph REPORTE_DETAIL ["reporte.dig (detalle)"]
        RE2["rebuild_rpt_email"]
        RW2["rebuild_rpt_whatsapp"]
        RQ2["rebuild_rpt_qcart"]
        QC["QC-01..05\nfail> si viola integridad"]
        RE2 & RW2 & RQ2 --> QC
    end
```

**Regla de orden:** `catalogo.dig` siempre primero — `tabla_piezas` stale rompe `tipo_envio` en todos los `rpt_*`.

**Secret names definitivos:**
- `${secret:github_pat_dashboards}` — lectura de GitHub
- `${secret:td.apikey}` — escritura a TD

---

## 3. Modelo de datos — grains y relaciones

```mermaid
erDiagram
    tabla_piezas {
        string pieza_id PK
        string canal
        string tipo_envio
        string email_type
        string pieza_principal_id
        string fecha_primer_envio
    }
    tabla_nombres {
        string nombre_unico PK
        string canal
        string pieza_id FK
    }
    dim_shortlink {
        string shortlink PK
        string pieza_id FK
        string estado_link
        string fecha_activacion
    }

    fact_envio_email {
        string pieza_id FK
        string email_job_id PK
        string fecha_envio
        int sends
        int unique_opens
        int unique_clicks
    }
    fact_envio_whatsapp {
        string pieza_id FK
        string nombre_wa FK
        string quincena PK
        string fecha_envio
        int sends
        int opens_read
    }
    fact_evento_qcart_carritos {
        string pieza_id FK
        string fecha_hora PK
        string shortlink_code FK
        string store PK
        int views
        double total_shown_price
    }

    rpt_email {
        string pieza_id PK
        string mes PK
        string quincena_principal
        int p_sends
        int fup_sends
    }
    rpt_whatsapp {
        string pieza_id PK
        string quincena PK
        int sends
        int opens_read
    }
    rpt_qcart {
        string pieza_id PK
        string quincena PK
        int carritos_total
        double intencion_total_mxn
        double intencion_nestle_mxn
    }

    tabla_piezas ||--o{ fact_envio_email : "pieza_id"
    tabla_piezas ||--o{ fact_envio_whatsapp : "pieza_id"
    tabla_piezas ||--o{ rpt_email : "pieza_id"
    tabla_piezas ||--o{ rpt_whatsapp : "pieza_id"
    tabla_piezas ||--o{ rpt_qcart : "pieza_id"
    dim_shortlink ||--o{ fact_evento_qcart_carritos : "pieza_id"
    rpt_email ||--o{ rpt_qcart : "_qc por quincena"
    rpt_whatsapp ||--o{ rpt_qcart : "_qc por quincena"
```

---

## 4. Modelo de atribución por canal

### Email

```mermaid
flowchart LR
    JOB["email_job_id\n(un envío real)"] --> FE2["fact_envio_email\n(grain: pieza × job)"]
    FE2 -->|"GROUP BY pieza_id, SUBSTR(fecha_envio,1,7)"| PM2["pieza_mes\n(grain: pieza × mes)"]
    PM2 -->|"dia_envio ≤ 15 → Q1\ndia_envio > 15 → Q2"| RP["rpt_email\nquincena_principal = Q de primer envío del mes"]
    PM2 -->|"JOIN pieza_principal_id = p.pieza_id AND mes = p.mes"| FUP["FUP unido\nen la misma fila"]
```

**Regla:** opens y clicks se atribuyen al `email_job_id` → quincena del envío, **no** de la apertura/clic.
Para AON con sends en Q1 y Q2 del mismo mes: ambos jobs agregan al mismo `mes`, y `quincena_principal` = Q del **primer** envío.

### WhatsApp

```mermaid
flowchart LR
    RAW["land_wa_envios\n(XLSX raw)"] -->|"COALESCE(quincena_xlsx, derivada catálogo)"| FW2["fact_envio_whatsapp\n(grain: pieza × nombre_wa × quincena)"]
    TP2["tabla_piezas\nfecha_primer_envio"] -.->|"fallback si quincena vacía"| FW2
    FW2 -->|"CTE pieza_quincena\nGROUP BY pieza_id, quincena\n(sin nombre_wa, sin pieza_segmento)"| RW2["rpt_whatsapp\n(grain: pieza × quincena)"]
```

**Fallback fechas (BUG-12):** cuando `send_date`/`quincena`/`mes` vienen en blanco del XLSX, se deriva desde `tabla_piezas.fecha_primer_envio`. Aplica a las 5 piezas WA-MUNDIAL-*.

### Qcart

```mermaid
flowchart LR
    CSV["land_qcart_carritos\n(CSV raw eventos)"] -->|"JOIN dim_shortlink (estado_link=USADO)\nROW_NUMBER para shortlink activo"| FC2["fact_evento_qcart_carritos\n(grain: pieza × evento × store)"]
    FC2 -->|"GROUP BY pieza_id, quincena\nSUM(views, total_shown_price)"| RQ2["rpt_qcart\n(grain: pieza × quincena)"]
    DS2["dim_shortlink\nfecha_activacion"] -.->|"dedup por shortlink activo"| FC2
```

**Dedup de shortlinks:** cuando un shortlink aparece en 2 piezas distintas (distinta `fecha_activacion`), el evento se atribuye a la pieza con `fecha_activacion` más reciente que sea ≤ fecha del evento.

---

## 5. Filtro de período en el dashboard (JavaScript)

```mermaid
flowchart TD
    FLT["Usuario selecciona filtro\n#fq = quincena exacta\n#fx = mes\n(ninguno) = total campaña"] --> CF["CUR_F = getF()\n{q: '2026-10-Q1'} o\n{x: '2026-10'} o {}"]

    CF --> RQC

    subgraph RQC ["resolveQc(row)"]
        RN{"row._qc\nexiste?"}
        RN -->|"No"| NULL["return null\n→ columnas en —"]
        RN -->|"Sí"| FQ{"CUR_F.q?"}
        FQ -->|"Sí"| EXACT["row._qc[CUR_F.q]\n→ quincena exacta"]
        FQ -->|"No"| FM{"CUR_F.x?"}
        FM -->|"Sí"| MONTH["aggQc(keys.filter(k.startsWith(CUR_F.x)))\n→ suma Q1+Q2 del mes"]
        FM -->|"No"| ALL["aggQc(all keys)\n→ total campaña"]
    end

    subgraph AGG ["aggQc(entries)"]
        SUM["SUM: cw, cc, ct, vc, vpn, itn, inn\nMIN(fd) / MAX(fh)\nRecalcula: pct, tkt_c, tkt_p"]
    end

    EXACT & MONTH & ALL --> SUM
    SUM --> FLAT["Columnas Qcart en tabla\ncw, cc, ct, vc, vpn, itn, inn, pct, tkt_c, tkt_p"]
```

**Estructura `_qc` en reporte-datos.js:**
```json
{
  "pieza_id": "001-P001",
  "_qc": {
    "2026-10-Q1": {"cw":120,"cc":34,"ct":154,"vc":890,"vpn":1200,"itn":59000,"inn":5100,"pct":8.6,"tkt_c":383,"tkt_p":4.25,"rec":"Receta X","fd":"2026-10-01","fh":"2026-10-15"},
    "2026-10-Q2": {"cw":80,"cc":20,"ct":100,"vc":600,"vpn":800,"itn":38000,"inn":3200,"pct":8.4,...}
  }
}
```

---

## 6. QC Guards — `reporte.dig`

| Check | Qué valida | Falla si |
|---|---|---|
| QC-01 | 0 duplicados en `rpt_qcart`, `rpt_email`, `rpt_whatsapp` | COUNT(*) > 1 para (pieza_id, quincena/mes) |
| QC-02 | Balance `rpt_qcart` ≈ `fact_qcart_carritos` | `rpt_carritos ≠ fact_carritos` |
| QC-03 | `tiene_qcart = 'Sí'` ↔ existe dato en `rpt_qcart` | Inconsistencia en cualquier pieza |
| QC-04 | `pct_penetracion ∈ [0, 100]` | Alguna fila > 100% o negativa |
| QC-05 | `carritos_walmart + carritos_chedraui ≤ carritos_total` | Alguna fila viola la restricción |

Si cualquier QC falla: `fail>` aborts el intento — `reporte.dig` **no entrega datos corruptos**.

---

## 7. Nomenclatura de piezas

```
{marca_id}-P{nnn}
Ejemplo: 001-P001 (Nescafé Clásico, pieza 1), 004-P010 (Maggi, pieza 10)
```

| Prefijo | Marca |
|---|---|
| `001` | Nescafé Clásico |
| `002` | Nescafé Decaf |
| `003` | Coffee Mate |
| `004` | Maggi |
| `005` | La Lechera / Carnation |
| `006+` | Otras marcas Nestlé MX |

---

## 8. Canales y tipos de envío

| Canal | `tipo_envio` | Grain rpt | Quincena base |
|---|---|---|---|
| Email | `always-on` (AON) | `(pieza_id, mes)` | Primer envío del mes |
| Email | `one-shot` (OS) | `(pieza_id, mes)` | Primer (y único) envío del mes |
| WhatsApp | `one-shot` | `(pieza_id, quincena)` | `send_date` del XLSX (o `fecha_primer_envio` del catálogo) |
| Qcart | — | `(pieza_id, quincena)` | `fecha_hora` del evento |

---

## 9. Repositorios y archivos clave

| Componente | Repositorio | Ruta |
|---|---|---|
| Dashboard HTML | `CRM-Omnicom-Clients/Dashboards-Nestle-MX` | `dashboards/reporte-consolidado-crm.html` |
| Datos dashboard | `CRM-Omnicom-Clients/Dashboards-Nestle-MX` | `dashboards/reporte-datos.js` |
| Build script | `CRM-Omnicom-Clients/Dashboards-Nestle-MX` | `negocio/nestle/reportes-consolidado/workflow/scripts/build_dashboard_data.py` |
| Workflow SQL | TD Digdag project `nmx_crm_reporte` (ID 2105350) | `queries/hechos/`, `queries/reporte/`, `queries/validate/` |
| Workflow SQL local | CRM (carpeta compartida) | `my/workflow/queries/` |
| Catálogo insumos | `RickAguilarOmnicom/NUBE-CLAUD` | `negocio/nestle/reportes-consolidado/insumos/` |

---

## 10. Commits relevantes (cronológico)

| Commit | Descripción | Fecha |
|---|---|---|
| `323c9a9` | fix: _qc formato correcto (lista → objeto agregado) | 2026-11-12 |
| `6d6ab24` | fix OI-18: 0 duplicados en rpt_* (BUG-10) | 2026-11-12 |
| `3310f29` | fix BUG-05: intencion_nestle filtro brand incorrecto | 2026-11-12 |
| `f918371` | fix BUG-06+07: pct NULL cuando inn>itn, store dual | 2026-11-12 |
| `87ad014` | docs: OI-13 cerrado (cobertura shortlinks intencional) | 2026-11-13 |
| `3618d4e` | feat: filtro período Qcart (_qc por quincena, resolveQc) | 2026-11-13 |
| `ffbfbc4` | fix: 34→18 filas rpt_whatsapp (BUG-11-WA) | 2026-11-13 |
| `2052a54` | fix: WA Mundial fechas desde catálogo + QUALIFY→ROW_NUMBER (BUG-12/13) | 2026-11-13 |
