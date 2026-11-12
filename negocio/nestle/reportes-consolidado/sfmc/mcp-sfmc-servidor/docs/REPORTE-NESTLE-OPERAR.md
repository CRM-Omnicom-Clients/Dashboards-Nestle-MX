# Reporte de email Nestlé — construido y operando

> 🔴 **SUPERADO (2-oct-2026): no operes con este documento.** Describe el reporte tal como quedó el 19-ago-2026 y hoy es **incorrecto en lo operativo**: hay **5 queries** (no 3: se sumaron
> `CRM_Audiencias_Vol_Load` y `CRM_Email_Links_Load`), la automation **sí está programada** (diaria, 00:08 hora Central) y las piezas se agregan con `resolver-emailname.js` + `agregar-pieza.js`
> sobre el **EmailName real de `_Job`**, no recargando el Excel. Lo vigente está en el skill **`crm-reporte-mcp-nestle-sfmc`** (`~/.claude/skills/crm-reporte-mcp-nestle-sfmc/`: `SKILL.md`,
> `docs/ARQUITECTURA.md`, `docs/PROCESOS.md`). Este archivo se conserva solo como historia del diseño.

> Implementado el 19-ago-2026 en `NMX - Nestle Mexico` (MID `10966050`).
> Diseño en [PLAN-REPORTE-FILTRADO.md](PLAN-REPORTE-FILTRADO.md).

---

## Qué se lee, en una línea

```
sfmc_get_de_rows  name="CRM_Email_Piezas"      → una fila por pieza, con primer y último envío
sfmc_get_de_rows  name="CRM_Email_Detalle"     → una fila por pieza × día
sfmc_get_de_rows  name="CRM_Reporte_Auditoria" → ¿está el 100%? y el semáforo de la corrida
```

**Antes de usar los números, revisa la auditoría.** Un `Estado` distinto de `OK` significa que
esa pieza no aportó datos, y hay que saber por qué antes de reportar.

---

## Lo que quedó en SFMC

Todo en `CRM Services` — DEs en la carpeta `445199`, queries en `460279`.

| Objeto | Nombre | Key / GUID |
|---|---|---|
| DE config | `CRM_Reporte_Config` | `03A9BE5F-0C95-4901-BEB9-3A3BEBF77C6D` |
| DE detalle | `CRM_Email_Detalle` | `E6A6AA43-BC30-443D-AA79-4ED324F45BA5` |
| DE piezas | `CRM_Email_Piezas` | `9DA78867-0F91-4CE9-97CD-B2F43BB7862E` |
| DE auditoría | `CRM_Reporte_Auditoria` | `3CC31E3D-0384-47E8-B851-575B6C5D08D0` |
| Query detalle | `CRM_Email_Detalle_Load` | `452234b4-4939-42a7-bc34-9b628782c896` |
| Query piezas | `CRM_Email_Piezas_Load` | `27da9759-b444-4657-ade5-abcaeb940435` |
| Query auditoría | `CRM_Reporte_Auditoria_Load` | `bfea3a5b-8324-409c-b6ec-28e520bcd0cf` |
| Automation | `CRM_Reporte_Diario` | `8a8a7b31-f99c-45fb-8482-e7b75858968b` |

El orden de los 3 pasos **importa**: Piezas lee de Detalle, y Auditoría lee de Piezas.

---

## 🔴 Lo único que falta: el schedule

**La automation existe y funciona, pero no está programada.** No es un descuido: **no se puede
programar por API en este tenant**, y se probaron las dos vías:

| Vía | Resultado |
|---|---|
| `PATCH /automation/v1/automations/{id}` con `schedule` | **200 OK y lo descarta** |
| `/actions/schedule/` | 404 |
| SOAP `Update` sobre `Automation` con `ScheduleDefinition` | **`OK "Program updated"` y lo descarta** |

El objeto SOAP `Automation` sí declara `Schedule` como actualizable, y aun así no persiste.

**Se pone a mano, una vez:** Automation Studio → `CRM_Reporte_Diario` → Schedule → Daily →
05:00 → Save. Mientras tanto, se dispara con `sfmc_run_query` en el orden de arriba.

---

## Estado de los datos al cerrar

```
catálogo        96 piezas  =  16 WhatsApp (otro canal) + 80 Email
                              de las 80: 76 con llave, 4 Liga MX sin lanzar
auditoría       74 OK  ·  2 DUPLICADO  ·  0 SIN MATCH
detalle        407 filas, del 2026-03-14 al 2026-08-19
envíos       6,220,613
```

Por campaña: AON 2.67M · Tercer Tiempo 2.08M · Mundial 550K · Hotcakes 352K ·
The Freshers 204K · Antojo Infinito 154K · Hackea tu café 152K · Fuel for life 53K.

---

## 🔴 Lo que el cruce reveló, y es del catálogo

Contra los `Sends` que el catálogo declara: **85% cuadra** (28 idénticas + 35 dentro de 1%,
de 74). Las 11 que difieren **no son error de la query** — se agrega por el Content Name que
SFMC registró, y ese número es el de las Data Views.

**4 pares están cruzados entre sí:**

| El valor que la DE da a… | …tu catálogo se lo asigna a |
|---|---|
| `001-P001` (34,450) | `001-P023` |
| `001-P002` (26,508) | `001-P028` |
| `001-P003` (5,969) | `001-P024` |
| `001-P004` (5,397) | `001-P026` |

Son justo las piezas que necesitaron alias por los dígitos transpuestos (`863587` vs
`803867`). O el `Pieza_ID → Content_Name` de esos 8 renglones está cruzado, o son la misma
pieza duplicada. **Es una decisión del catálogo, no del pipeline.** Los 2 `DUPLICADO` de la
auditoría salen de ahí.

**Y 3 de "Fuel for life" difieren sin ese patrón** — pendientes de revisar aparte:

| Pieza | DE | catálogo |
|---|---:|---:|
| `009-P002` | 15,988 | 19,115 |
| `009-P003` | **185** | **22,803** |
| `009-P004` | 1,105 | 1,449 |

`009-P003` es la más grave: 185 contra 22,803.

---

## Agregar piezas nuevas

1. Rick agrega la fila a `Catalogo_Piezas` en el Excel
2. Se recarga `CRM_Reporte_Config` (script `n3-config.js` del scratchpad, o a mano en la UI)
3. La corrida siguiente la incluye sola — **la query no se toca**

El `ContentName` de la config tiene que ser **exactamente** el `EmailName` de SFMC. Si no
matchea, la auditoría lo marca `SIN MATCH`: por eso existe.

---

## Cómo saber si una corrida terminó

**No basta con contar filas ni con mirar si la fecha es de hoy.** Un `Overwrite` borra y
repuebla, y leer en medio devuelve una mezcla que se ve plausible.

✅ La fila de `CRM_Reporte_Auditoria` con `LastRun` **estrictamente mayor** al de antes de
disparar, **y uniforme** en las 76 filas. Si hay dos valores de `LastRun`, la escritura va a
medias.

---

## Decisiones de diseño que no son obvias

- **Los eventos se cuentan en el día del ENVÍO, no del evento.** Cada apertura se une de vuelta
  a `_Sent` por `JobID+ListID+BatchID+SubscriberID` y hereda su fecha. Sin eso salen días con
  aperturas y cero envíos, y `Delivered` negativo.
- **`RTRIM` en el join contra el catálogo.** SFMC rellena `_Job.EmailName` a 100 caracteres con
  espacios. Sin `RTRIM` no matchea **nada**.
- **Detalle es `Update`, Piezas y Auditoría son `Overwrite`.** El detalle acumula historia; los
  otros dos se recalculan enteros y son baratos.
- **La PK del detalle es texto** (`JobID_YYYYMMDD`), no una PK compuesta con `Date`.
- **La auditoría usa `LEFT JOIN` a propósito.** Con `INNER JOIN`, una pieza sin datos
  desaparecería — que es exactamente el falso negativo que la tabla existe para evitar.
- **`Send` NO sirve para las piezas de journey.** `001-P007` da 1 por `Send` y 556,865 por las
  Data Views; el catálogo dice 556,865. Por eso el pipeline va sobre Data Views.

---

## Columnas de identidad añadidas (19-ago-2026)

`CRM_Email_Detalle` y `CRM_Email_Piezas` llevan, además de las métricas:

| Columna | Para qué |
|---|---|
| `Email_Subject` | el asunto real que salió — permite cruzar sin depender del nombre |
| `Email_Content_Name` | el nombre en SFMC al momento del envío |
| `Email_ID` | identidad del creativo; sobrevive a los renombres. **No es llave** |
| `Es_FUP` | `Si`/`No` derivado del nombre en SFMC, no del catálogo |
| `Journey_ID_Datorama` | el número final del Content Name, el que cruza con Datorama |
| `Journey_Name` / `Journey_UUID` | solo se pueblan en envíos de journey; los one-shot van vacíos |
| `Piezas_Mismo_Asset` | (solo en Piezas) `> 1` = dos filas del catálogo apuntan al mismo correo |

El porqué de cada una y las trampas de cada identificador: **`IDENTIDAD-DE-PIEZAS.md`**.
