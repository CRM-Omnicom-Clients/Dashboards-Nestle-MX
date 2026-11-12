# Arquitectura del pipeline de reporteo de email (SFMC)

Qué es: **6 tablas** (Data Extensions) + **5 queries** + **1 automation** que, cada noche, convierten los datos crudos de envíos de SFMC en un reporte
por pieza de email. Este documento describe **cómo está construido y por qué**. Para operarlo: `PROCESOS.md`.

> Dos tipos de afirmaciones, separadas a propósito: los **principios** (cómo funciona; no caducan) y los **estados** (lo medido en una fecha; caducan).
> Los estados llevan fecha y se pueden regenerar con `node scripts/snapshot.js`. Si algo de aquí contradice lo que ves en SFMC, **gana lo que ves**: corrige este documento.

## 1. El flujo

```text
 Vistas de datos de SFMC (_Job _Sent _Open _Click _Bounce _Unsubscribe _Journey)        CRM_Reporte_Config  ← el CATÁLOGO: qué piezas se reportan
                      │                                                                          │  (una fila por pieza; la llave real es su EmailName)
                      ▼                                                                          │
 ┌──────────────── automation CRM_Reporte_Diario · diaria 00:08 hora Central ───────────────────┴──────────┐
 │ paso 1: Vol ─► CRM_Audiencias            Links ─► CRM_Email_Links      (en paralelo)                      │
 │ paso 2: Detalle ─► CRM_Email_Detalle      una fila por ENVÍO (JobID × día)                                │
 │ paso 3: Piezas ─► CRM_Email_Piezas        una fila por PIEZA (suma todos los días de Detalle)             │
 │ paso 4: Auditoría ─► CRM_Reporte_Auditoria  una fila por pieza del catálogo + un semáforo de calidad     │
 └───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Las 6 tablas (principio) y su tamaño (estado medido el 2-oct-2026)

| Tabla | Rol en la config | Llave primaria hoy | Campos | Qué contiene | Quién la llena |
|---|---|---|---|---|---|
| `CRM_Reporte_Config` | `catalogo` | `ConfigKey` | 16 | el catálogo: marca, campaña, touchpoint, segmento, tipo, `EmailName` | `agregar-pieza.js` o a mano |
| `CRM_Audiencias` | `audiencias` | `ConfigKey` | 5 | pieza → journey → tabla de audiencia → volumen | query Vol (volumen) y `audiencias.js` (mapeo) |
| `CRM_Email_Detalle` | `detalle` | `RowKey` | 38 | una fila por **envío** (job × día): envíos, rebotes, aperturas, clicks, bajas y tasas | query Detalle |
| `CRM_Email_Piezas` | `piezas` | `ConfigKey` | 35 | una fila por **pieza**: lo de Detalle sumado + primer y último envío | query Piezas |
| `CRM_Reporte_Auditoria` | `auditoria` | `ConfigKey` | 17 | una fila por pieza del catálogo con su **Estado** (semáforo) | query Auditoría |
| `CRM_Email_Links` | `links` | `RowKey` | 14 | clicks por link/botón por pieza | query Links |

Filas el 2-oct-2026 por la tarde (tras refrescar la pieza ERIT1; por la mañana eran detalle 752 · piezas 111 · auditoría 112 · links 980): catálogo 113 · audiencias 99 · detalle 754 · piezas 112 · auditoría 113 · links 983
(la diferencia entre catálogo y piezas son piezas aún sin envíos cargados). Se miden con `node scripts/snapshot.js`.

## 3. Las 5 queries y la automation

| Query | Escribe en | Tipo | Paso |
|---|---|---|---|
| `CRM_Audiencias_Vol_Load` | `CRM_Audiencias` | Update | 1 |
| `CRM_Email_Links_Load` | `CRM_Email_Links` | Overwrite | 1 |
| `CRM_Email_Detalle_Load` | `CRM_Email_Detalle` | Update | 2 |
| `CRM_Email_Piezas_Load` | `CRM_Email_Piezas` | Overwrite | 3 |
| `CRM_Reporte_Auditoria_Load` | `CRM_Reporte_Auditoria` | Overwrite | 4 |

- **Update** = upsert por la llave primaria (no borra filas viejas). **Overwrite** = recalcula y reemplaza todo (es barato).
- La automation **`CRM_Reporte_Diario`** corre **diario a las 00:08, hora Central sin horario de verano (UTC−6)**. Su horario y sus pasos se editan en Automation Studio: este kit no los toca.
- Tiempos medidos en vivo el 2-oct-2026 con el motor sin carga: Vol 55 s · Links 59 s · **Detalle ≈ 7 min** · Piezas 35 s · Auditoría 24 s (≈ 9 min en total). Con el motor cargado y un reintento de Detalle, un refresco completo tardó 18 min.

## 4. Identidad: el `EmailName` es la llave de todo

- Una pieza **es** su `EmailName` exacto en `_Job` (el nombre del envío). Se conecta con el catálogo así: `RTRIM(j.EmailName) = c.EmailName AND c.Activo = 'Si'`.
  Solo se reportan las piezas del catálogo con `Activo = 'Si'`.
- `_Job.EmailName` lo **trunca SFMC a 100 caracteres** y lo rellena con espacios (por eso el `RTRIM`). Un email copiado o reenviado recibe un sufijo
  ` - AAAAMM` y es **otro nombre**. El nombre real se obtiene con `scripts/resolver-emailname.js`; nunca del código de asset del brief.
- `EmailID` (el asset en Content Builder) **no es la llave**: sobrevive a los renombres y se reutiliza entre campañas; sirve para detectar que dos piezas apuntan al mismo correo.
- `ConfigKey` es **heredada**: SFMC exige una llave primaria y hoy es `ConfigKey` (en las piezas nuevas, `TMP-…`, interna). Ver `MIGRACION-EMAILNAME-PK.md`.
- **`PiezaID` ya no existe** (eliminada el 22-oct-2026 a pedido de Rick, que ya lo había pedido el 21-ago): se borró el campo del catálogo, de Piezas y de Auditoría, y las queries de
  Piezas y Auditoría dejaron de llenarla. Los números de pieza viven solo en el libro raíz del equipo (`Catalogo_Piezas`), nunca en las tablas de SFMC.
- Piezas toma `Audience_DE` / `Audience_Volume` del Detalle y, **si el Detalle no los trae** (envíos que ya salieron de la retención de las vistas de datos), de `CRM_Audiencias`
  (`LEFT JOIN … ON au.ConfigKey = d.ConfigKey`; solo rellena vacíos, nunca cambia un valor que el Detalle ya trae).
- El kit **detecta** el esquema (llave `ConfigKey` o `EmailName`) leyendo la PK real de la tabla (`lib/esquema.js`): los scripts funcionan antes y después de la migración.

## 5. Cómo se calcula (lo que dice el SQL, no lo que se supone)

- **Grano de Detalle**: un renglón por `JobID × día de ENVÍO`; `RowKey = JobID_AAAAMMDD`. Ventana: eventos **desde `2026-03-01`** (la fecha está escrita en el SQL de Detalle y de Links), pero **las vistas de datos de SFMC solo retienen unos 6 meses**: lo anterior ya no existe allí y solo sobrevive en Detalle (por eso es `Update` y nunca se recrea: `MIGRACION-EMAILNAME-PK.md` §3.2).
- **Atribución al día de envío**: las aperturas, clicks, rebotes y bajas se cuentan en el día en que **salió** el correo, no en el del evento. Para eso cada evento se une a `_Sent`
  por `JobID + ListID + BatchID + SubscriberID` y hereda su fecha. Sin esto aparecerían días con aperturas y cero envíos.
- **Entregados** = envíos − rebotes (mínimo 0). **Tasas**: entrega = entregados / envíos · apertura = aperturas únicas / entregados · click = clicks únicos / entregados · CTOR = clicks únicos / aperturas únicas · rebote = rebotes / envíos.
- `Es_FUP` se deduce del **nombre** del envío (`%FUP%`, `-FP`), no del catálogo: así se puede contrastar con el touchpoint. `Journey_ID_Datorama` = el número final del `EmailName` (después del último `_`).
- **Piezas** suma todos los días de Detalle por pieza y calcula `Fecha_Primer_Envio` / `Fecha_Ultimo_Envio`, que son de la pieza y no de un envío.
- **Links**: una fila por `ConfigKey|URL`; si el botón no trae nombre (la mayoría), se deriva del destino (dominio + ruta). **No dice cuándo ocurrió cada click** (y es Overwrite: se encoge sola cuando las vistas de datos olvidan los clicks viejos); la tabla opcional de §5b sí.

### 5b. Clicks por link con fecha (opcional): `CRM_Email_Links_Dia`

Una tabla **aparte** que instala `scripts/instalar-links-dia.js` (no forma parte de las 6 tablas ni de la automation `CRM_Reporte_Diario`; `doctor.js` y `snapshot.js` no la miran todavía).

| Objeto | Qué es |
|---|---|
| `CRM_Email_Links_Dia` | 12 campos; llave `RowKey`; grano `JobID × SendDay × ClickDay × link`; **Update** (conserva los días que las vistas de datos ya olvidaron) |
| `CRM_Email_Links_Dia_Load` | su query de carga; mismo `Link_Name` / `Link_URL` que la de Links; `_Click` se une a `_Sent` con **LEFT JOIN** (un click cuyo envío ya caducó queda con `SendDay` vacío en vez de perderse) |
| `CRM_Reporte_Links_Dia` | su automation: una actividad, diaria a las 00:50 hora Central; **separada** de la del reporte para que un fallo no frene Detalle, Piezas ni Auditoría. Se crea ya con su horario y se **activa** por el endpoint legacy (por la API SFMC la crea siempre en `PausedSchedule`; `docs/PROCESOS.md` §3b) |

`ClickDay` es la fecha del click (`_Click.EventDate`); `SendDay` es el día en que **salió** ese correo, el mismo criterio del Detalle, así que `Σ Clicks_Total` por `JobID + SendDay` es el `Email_Total_Clicks` del Detalle de ese envío.
`Clicks_Unique` cuenta personas por fila: **no se suma entre días** (quien hace click en dos días cuenta en los dos). Los envíos de antes de lo que retienen las vistas de datos (≈ 6 meses) no tienen detalle por link en SFMC; esas piezas solo tienen el total de `CRM_Email_Links`.

### El semáforo de Auditoría (`Estado`)

| Estado | Significa |
|---|---|
| `OK` | la pieza tiene envíos y todo cuadra |
| `SIN MATCH` | la pieza está en el catálogo pero **no hay envíos** con ese `EmailName` (nombre mal escrito, o aún no sale) |
| `DUPLICADO` | dos piezas del catálogo con el mismo `EmailName` (hoy posible porque la llave es `ConfigKey`; tras migrar, imposible) o apuntando al mismo asset: el dato se atribuye a una sola |
| `ASSET CAMBIO` | el `EmailID` declarado en el catálogo no es el que dice `_Job`: alguien cambió el creativo o el `EmailID` del catálogo está mal. Confirma con quien armó el envío; si el cambio fue a propósito, se corrige el `EmailID` en el catálogo |
| `INACTIVO` | la pieza tiene `Activo` distinto de `Si` |

La fila de Auditoría de hoy es también el **semáforo de que la corrida terminó** (`LastRun`).

## 6. Objetos temporales y seguridad de escritura

Los scripts crean tablas y queries **temporales** con el prefijo `CRM_Tmp_` (nombre único por corrida) para consultar las vistas de datos, y las borran al terminar.
Cada consulta lleva una fila centinela `__FIN__`: así "terminó y no hay filas" se distingue de "aún no termina". Reglas completas: `SEGURIDAD.md`.

## 7. Qué es de tu BU y qué es del diseño

Son **de tu BU** (los descubre `scripts/descubrir.js` y quedan en tu config local, `pipeline.config.json`, en la carpeta de estado fuera del kit): las llaves (GUID) de las tablas, los IDs de las queries y de la automation,
las carpetas, el MID. Son **del diseño** (el kit los busca **por nombre** y por defecto son los de este documento): los nombres de las tablas, queries y automation, y la lógica de este documento.
Si tu BU usa otros nombres, se cambian en la config (`INSTALAR.md` §3). Este kit **opera un reporte que ya existe en tu BU**: no crea las tablas ni las queries del reporte (la guardia lo impide; la única excepción es la tabla opcional de §5b); si tu BU no las tiene, pídele a quien administra el reporte que las cree
(el SQL de referencia está en `tests/fixtures/arquitectura-nestle-2026-10-02.json`).
Una foto completa del estado real: `node scripts/snapshot.js`.

## 8. Glosario (para quien llega sin contexto)

| Término | Qué es |
|---|---|
| **BU / MID** | Business Unit: la "cuenta" de SFMC donde vive el reporte. El **MID** es su número; el kit lo descubre solo |
| **`_Job`, `_Sent`, `_Open`, `_Click`…** | tablas del sistema de SFMC (*data views*) con cada envío y cada evento; el reporte se calcula a partir de ellas |
| **Catálogo** | la tabla `CRM_Reporte_Config` de SFMC: qué piezas se reportan. No es el "catálogo raíz" en Excel del equipo (esa es otra herramienta) |
| **Pieza** | un email del reporte, identificado por su `EmailName` exacto |
| **`EmailID` / asset** | el número del creativo en Content Builder. Sirve para detectar que dos piezas usan el mismo correo; **no** es la llave |
| **Código NC** | el número `NC00xxxx` que viene dentro del nombre del envío (se lee de ahí) |
| **Touchpoint** | la posición de la pieza en la campaña (p. ej. `E-P1`, `E-J9`); un `*` al final marca que se infirió |
| **Normalizador** | el proceso del equipo que valida las dimensiones de las piezas nuevas (su numeración vive en el libro raíz, no en SFMC) |
| **Rick** | quien mantiene el catálogo raíz y el normalizador, y da el OK para tocar tablas o migrar la llave |
| **Datorama** | la herramienta de reportes que consume el número final del nombre (`Journey_ID_Datorama`) |
| **Lag de propagación** | tras agregar una pieza al catálogo, la primera corrida de Detalle puede no "verla"; basta una segunda corrida (el script la hace solo) |
