# Métricas de email por Data Views — Nestlé (`sfmc-nestle`)

> Cómo sacar métricas de email de SFMC cuando el objeto `Send` no alcanza.
> Construido y verificado el **31-jul-2026** contra `NMX - Nestle Mexico` (MID `10966050`).

---

## TL;DR para otra sesión

Los datos ya están en una DE. Para leerlos:

```
sfmc_get_de_rows  name="CRM_Email_Performance"  maxRows=500
```

Devuelve **un renglón por JobID** con `EmailName`, `SendDate`, `JourneyName`,
`Sent`, `Delivered`, `Bounces`, `UniqueOpens`, `TotalOpens`, `UniqueClicks`,
`TotalClicks`, `Unsubscribes`, `LastRefresh`.

Para filtrar: `filterField="Sent"`, `filterOperator="greaterThan"`, `filterValue="10000"`.
Operadores: `equals` · `notEquals` · `greaterThan` · `lessThan` · `like`.

**Si `LastRefresh` está viejo**, refresca antes de leer:

```
sfmc_run_query  queryDefinitionId="0f9ffc39-c3a5-4928-85e6-b2ee43ac2d85"
```

Es asíncrona: tarda ~30 s con ventana de 7 días, ~8 min con 90.

---

## 🔴 Empieza por aquí: probablemente NO necesitas esto

**Para métricas de envío, `sfmc_list_sends` alcanza — también para journeys.** Es una
llamada, sin infraestructura, y los datos están al momento.

> **Corrección del 3-ago-2026.** La primera versión de este documento decía que el objeto
> `Send` devuelve `sent=0/1` para journeys con triggered send y que por eso hacía falta este
> pipeline. **Es falso.** El error vino de filtrar `Send` por fecha, toparse con unos job IDs
> de AON que sí traen `sent=0/1` (son registros por disparo, existen) y generalizar sin
> comprobar los jobs de alto volumen. Al compararlos uno por uno contra la DE, `Send` sí
> los tiene:
>
> | JobID | Data Views | `Send` |
> |---|---|---|
> | 1267354 (AON EP4) | 334,663 | 334,962 |
> | 1213309 (AON LOYALTY) | 246,251 | 246,252 |
> | 1211182 (Maggi Selección) | 820,109 | 820,110 |
>
> 10 de 16 coinciden; de los 6 que difieren, `Send` reporta **más** (la ventana móvil de
> 90 días recorta del lado de las Data Views, no de `Send`).

### Entonces, ¿para qué sirve este pipeline?

Para tres cosas que `Send` **no** da, y solo si las necesitas:

1. **`JourneyName` / `JourneyID` por envío.** `Send` no liga el envío a su journey; aquí
   viene resuelto por la cadena `_Journey → _JourneyActivity → _Job`.
2. **`TotalOpens` / `TotalClicks`** (no solo los únicos, que es lo único que expone `Send`).
3. **Un dataset ya agregado y estable** que se puede leer entero de un jalón sin paginar
   miles de registros SOAP ni reventar el límite de la respuesta del MCP.

Si no necesitas ninguna de las tres, usa `sfmc_list_sends` y ahórrate esto.

---

## Por qué las Data Views no se consultan directo

Son la fuente real, la misma de la que toma Datorama, pero **no hay forma de leerlas por API**:

| Vía | Resultado |
|---|---|
| `/data/v1/customobjectdata/key:_Sent/rowset` | 400 |
| SOAP `Retrieve` de `SentEvent` filtrado por `EventDate` | **timeout a 120 s** — el Describe no reporta ningún campo filtrable |
| `/insights/v1/reports`, `/intelligence/v1/reports` | 596 Service Not Found |

**No hay endpoint de "correr SQL" en SFMC.** El SQL solo corre como *Query Activity*,
que lee Data Views y **escribe a una Data Extension** — nunca devuelve filas al que llama.
De ahí este diseño.

---

## Las piezas

| Pieza | Identificador |
|---|---|
| DE destino | `CRM_Email_Performance` · key `E35FA166-C0DC-425A-B3C0-7EBC0CF0A419` · carpeta `Data Extensions / CRM Services` (445199) |
| Query | `CRM_Email_Performance_Load` · GUID `0f9ffc39-c3a5-4928-85e6-b2ee43ac2d85` · carpeta `Query / CRM Services` (460279) |
| Automation | `CRM_Email_Performance_Daily` · id `5a4054ab-c003-4254-b56d-4dce8a34b855` |

⚠️ **La automation NO tiene schedule.** El REST de este tenant acepta el PATCH con
`schedule` (HTTP 200) y **lo descarta en silencio**; `/actions/schedule/` da 404 y
`/actions/start/` pide `Steps` aunque ya los tenga. Hay que ponerle la recurrencia
**a mano en la UI** (Automation Studio → la automation → Schedule → Daily). Mientras
no se haga, refrescar con `sfmc_run_query`.

---

## Esquema de las Data Views

Derivado de **451 queries de producción** del propio tenant, no de la documentación.
Estas columnas ya corren ahí:

| Vista | Columnas útiles |
|---|---|
| `_Job` | `JobID` · `EmailName` · `EmailID` · `EmailSubject` · `FromName` · `FromEmail` · `DeliveredTime` · `PickupTime` · `SchedTime` · **`TriggererSendDefinitionObjectID`** |
| `_Sent` | `JobID` · `SubscriberKey` · `EventDate` · `ListID` · `BatchID` · `SubscriberID` · `TriggererSendDefinitionObjectID` · `Domain` |
| `_Open` | `JobID` · `SubscriberKey` · `EventDate` · **`IsUnique`** · `TriggererSendDefinitionObjectID` · `TriggeredSendCustomerKey` |
| `_Click` | `JobID` · `SubscriberKey` · `EventDate` · `IsUnique` · **`URL`** · `LinkName` · `LinkContent` |
| `_Bounce` | `JobID` · `SubscriberKey` · `EventDate` · **`BounceCategory`** · `BounceSubcategory` · `BounceType` · `SMTPCode` · `SMTPBounceReason` |
| `_Unsubscribe` | `JobID` · `SubscriberKey` · `EventDate` · `IsUnique` |
| `_Journey` | `JourneyID` · `JourneyName` · **`VersionID`** · `VersionNumber` |
| `_JourneyActivity` | **`JourneyActivityObjectID`** · `VersionID` |

**La cadena que liga un envío a su journey** (esto es lo que hace el modelo escalable):

```
_Journey.VersionID  ←  _JourneyActivity.VersionID
_JourneyActivity.JourneyActivityObjectID  ←  _Job.TriggererSendDefinitionObjectID
_Job.JobID  ←  _Sent / _Open / _Click / _Bounce / _Unsubscribe .JobID
```

---

## Decisiones de diseño, y por qué

**Grano = 1 renglón por `JobID`.** Es el mismo grano que `Data_Email` del Reporte
Consolidado, así se pega directo.

**La query trae TODOS los envíos de la ventana, no una lista de journeys.**
Filtrar por journey es un `WHERE` de quien consume. Así, **agregar journeys nuevos no
requiere tocar nada** — entran solos. Si algún día el volumen molesta, se le agrega un
filtro; hoy 90 días son ~5,400 filas.

**Las métricas se pre-agregan ANTES de unir con journey.** `_JourneyActivity` puede
traer más de un renglón por actividad; si se uniera primero, cada `SUM` se duplicaría.
La subconsulta `a` ya entrega 1 renglón por JobID y afuera se usa `MAX()`, así un
fan-out no altera números.

**El `INNER JOIN` contra `sd` (envíos dentro de la ventana) es el ancla.** Sin él, un job
enviado *antes* de la ventana pero con aperturas *dentro* entraba con `Sent=0` y
`Delivered = 0 - Bounces` salía **negativo**. Pasaba en 6 de 1,213 filas.

**`SendDate` cae a `MIN(_Sent.EventDate)`.** `_Job.DeliveredTime` viene NULL en muchos
jobs, sobre todo triggered.

---

## Validación

Cruce contra el objeto SOAP `Send`, que es fuente independiente:

```
ventana 90 días → 5,403 filas
5,241 jobs comparables → 5,239 idénticos + 1 dentro de 2% = 100%
```

### ⚠️ Limitación conocida: triggered sends con JobID de larga vida

Un triggered send usa **un solo JobID que acumula envíos durante meses**. Una ventana
móvil corta sus envíos pero atrapa todas sus aperturas recientes, así que esos renglones
salen con `UniqueOpens > Delivered`.

Afecta **~0.1% de las filas** (6 de 5,403). Ejemplo real: job `1124299` — la query ve
1 envío en la ventana, `Send` reporta 391,274 acumulados.

**No es un bug que arreglar: es el precio de la ventana móvil.** Y es exactamente el caso
donde **`sfmc_list_sends` da el número correcto y esta DE no** — otra razón para preferir
`Send` salvo que necesites el join de journey.

El acumulado de por vida también está en SOAP `TriggeredSendSummary` (que a cambio **no
tiene fecha**, así que no se puede cortar por mes).

---

## Cómo cambiar la ventana

Está escrita como literal en el SQL (`DATEADD(day, -90, GETDATE())`, 6 apariciones).
Se edita la query en Automation Studio, o por API con
`PATCH /automation/v1/queries/{id}` mandando el `queryText` completo.

Se prefirió un literal sobre una DE de configuración: un número en un lugar visible se
entiende y se cambia; una tabla de config es otra pieza que mantener y que se
desincroniza.

---

## Trampas que ya costaron tiempo

**1. Saber si una corrida terminó es más difícil de lo que parece — van TRES señales fallidas.**

| Señal | Por qué falla |
|---|---|
| *"`LastRefresh` es de hoy"* | La corrida anterior también escribió `GETDATE()` hoy |
| *"hay filas con `Sent > 0`"* | Ya era cierto por la corrida anterior |
| *"`MAX(LastRefresh)` es estrictamente mayor"* | Detecta que la escritura **empezó**, no que acabó |

La tercera es la traicionera: la query es `Overwrite`, así que borra y repuebla. Leer en
medio devuelve una mezcla — pasó el 7-ago-2026 y salieron **5,000 filas con 2,428 JobIDs
duplicados** y un total de envíos inflado en 1.4 millones. Se veía plausible.

✅ **Criterio bueno — las tres cosas a la vez:**
1. `MAX(LastRefresh)` **estrictamente mayor** al de antes de disparar, **y**
2. `LastRefresh` **uniforme**: `min === max` (si hay dos valores, la DE tiene filas de dos
   corridas = escritura a medias), **y**
3. `JobID` **sin duplicados** — es la PK, un duplicado solo puede venir de una lectura
   inconsistente.

Y si aún así dudas: lee dos veces con 25 s de diferencia y compara. Estable = terminó.

**2. El parser SQL de SFMC no acepta comentarios `/* */` dentro de una subconsulta.**
Da `Incorrect syntax near the keyword 'SELECT'`. En el encabezado sí los acepta.

**3. `sfmc_get_de_rows` pide `name`, no `externalKey`.** Cambió de firma al migrarlo a SOAP.

**4. Un `Retrieve` de `DataExtensionObject[...]` sin `<Properties>` falla.** Por eso la
tool resuelve los campos sola cuando no se los dan.

**5. Los resultados SOAP vienen como `<Results xsi:type="...">`.** Un regex `/<Results>/`
sin tolerancia a atributos cuenta 0 filas y parece que no hay datos.
