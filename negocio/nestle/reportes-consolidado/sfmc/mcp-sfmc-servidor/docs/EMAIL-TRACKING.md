# Métricas de email en SFMC: de dónde salen y cuál usar

> Verificado contra GEPP (MID `534016943`) y Nestlé NMX (MID `10966050`) entre el
> 31-jul y el 7-ago-2026. Nestlé: 9.19M correos en 90 días, 5,683 envíos.

---

## Cuál fuente usar — decídelo aquí

| Necesitas | Usa | Por qué |
|---|---|---|
| Métricas por envío, de un periodo | **`sfmc_list_sends`** con `dateFrom`/`dateTo` | Una llamada. Sirve para batch **y** para journey |
| Un envío concreto | `sfmc_get_send_metrics(jobId)` | |
| Quién y qué URL clickeó | `sfmc_get_clicks(jobId)` | Nivel suscriptor |
| Por qué rebotó | `sfmc_get_bounces(jobId)` | Con categoría SMTP |
| Cuántos ENTRARON a un journey | `sfmc_get_journey(id)` → `stats.cumulativePopulation` | No da opens ni clicks |
| `JourneyName` por envío · `TotalOpens`/`TotalClicks` | la DE `CRM_Email_Performance` | Ver [DATA-VIEWS.md](DATA-VIEWS.md) |
| Acumulado de por vida de un triggered send | SOAP `TriggeredSendSummary` | **Sin fecha**: no se corta por mes |

**La respuesta corta es casi siempre `sfmc_list_sends`.**

---

## La receta normal

```
sfmc_list_sends  dateFrom="2026-07-01"  dateTo="2026-07-31"  summaryOnly=true
```

Devuelve por envío: `jobId`, `emailName`, `subject`, `sentDate`, `sent`, `delivered`,
`uniqueOpens`, `uniqueClicks`, `hardBounces`, `softBounces`, `otherBounces`, `unsubscribes`,
`forwards`, y las tasas ya calculadas: `deliveryRate`, `openRate`, `clickRate`, `ctor`,
`bounceRate`, `unsubRate`.

### Las cuatro reglas que evitan números mal

1. **Siempre `dateFrom`/`dateTo`.** Sin fechas, SFMC entrega del envío **más antiguo** al más
   nuevo: los primeros lotes salen de 2019-2020. La tool avisa, pero es fácil ignorarlo.
2. **`summaryOnly=true` primero.** Un mes de una BU activa **no cabe** en la respuesta del MCP.
   Pide el detalle solo del subconjunto que te interese.
3. **Revisa `truncated`.** Si sale `true`, la llave de agregados se llama `totals_PARCIALES`
   justo para que no la confundas con el total del periodo — el subconjunto es **arbitrario**,
   no el más reciente ni el de mayor volumen.
4. **`nameFilter` se aplica en cliente** sobre lo que se alcanzó a traer. Con truncado, puede
   dar `0` para una campaña que sí existe. Si buscas algo puntual, sube `maxRows`.

### Denominadores

Todas las tasas van sobre **entregados**, que es el estándar de la industria:

```
deliveryRate = delivered / sent
openRate     = uniqueOpens  / delivered
clickRate    = uniqueClicks / delivered
ctor         = uniqueClicks / uniqueOpens      ← click-to-open
bounceRate   = (hard + soft + other) / sent    ← sobre ENVIADOS, no entregados
```

`Send` solo expone los **únicos**. Si necesitas totales (aperturas repetidas), eso está en las
Data Views — ver [DATA-VIEWS.md](DATA-VIEWS.md).

---

## Envíos de journey: sí están en `Send`

> **Esto costó una conclusión equivocada, así que va con detalle.**

Un journey genera **dos clases de registro** en el objeto `Send`:
- los del **volumen real** (cientos de miles), y
- unos con `sent=0` o `sent=1`, que son **registros por disparo** y sí existen.

Filtrar `Send` por fecha puede devolver solo los segundos y hacerte concluir que `Send` no
sirve para journeys. **Sirve.** Verificado job por job contra las Data Views:

| Job | Pieza | Data Views | `Send` |
|---|---|---|---|
| 1267354 | JUN-AON-EP4 | 334,663 | 334,962 |
| 1213309 | AON-LOYALTY-TP1 | 246,251 | 246,252 |
| 1211182 | Maggi Selección | 820,109 | 820,110 |

De 16 comparados, 10 idénticos; de los 6 que difieren, **`Send` reporta más** (la ventana móvil
recorta del lado de las Data Views).

**Lección de método:** no generalizar desde una muestra filtrada sin comprobar el caso
contrario. Bastaba pedirle a `Send` los job IDs de alto volumen para ver que ahí estaban.

---

## Triggered sends: el JobID de larga vida

Un triggered send usa **un solo JobID que acumula envíos durante meses**. Consecuencias:

- Una consulta con **ventana móvil** corta sus envíos pero atrapa todas sus aperturas
  recientes → salen con `UniqueOpens > Delivered`. Afectaba al ~0.1% de las filas.
- Ejemplo real: job `1124299` — una ventana de 90 días ve **1 envío**; `Send` reporta
  **391,274** acumulados.

**Para esos casos el número bueno es el de `Send`**, no el de una query con ventana.

---

## De dónde salen los datos, por debajo

```
_Job ─┬─ _Sent          ─┐
      ├─ _Open           │   Data Views (SQL, solo desde una Query Activity)
      ├─ _Click          │
      ├─ _Bounce         │
      └─ _Unsubscribe   ─┘
                ↕ misma capa de tracking
SOAP  Send · SentEvent · OpenEvent · ClickEvent · BounceEvent · UnsubEvent
```

Es **la misma capa**, expuesta de dos formas. Datorama toma de las Data Views.

### Qué se puede filtrar y qué no

| Objeto SOAP | Filtrable por | Sirve para |
|---|---|---|
| `Send` | **`SentDate`** (`between`, `greaterThan`, `lessThan`), `ID` | descubrir envíos **por periodo** |
| `ClickEvent` `BounceEvent` `UnsubEvent` `SentEvent` | **`SendID`** | detalle de un envío **que ya conoces** |

🔴 **Los `*Event` NO se pueden filtrar por fecha.** `Describe` de `SentEvent` no reporta ningún
campo filtrable, y un `Retrieve` con filtro por `EventDate` de **un solo día** murió en timeout
a los 120 s sin devolver nada.

**Por eso el flujo es siempre: `Send` para descubrir por periodo → `SendID` para el detalle.**
No al revés.

---

## Recetas

**Comparar un envío contra su follow-up**
```
sfmc_list_sends dateFrom="2026-07-20" dateTo="2026-07-31" nameFilter="AON" maxRows=2000
```
En Nestlé eso muestra el patrón real: el original ~40% de OR, el `FUP` a no-aperturantes ~14%.

**Ver qué links funcionaron**
```
sfmc_get_clicks  jobId=1267354  summaryOnly=true
```
`summaryOnly` da solo el conteo por URL, sin arrastrar el detalle por suscriptor.

**Diagnosticar entregabilidad**
```
sfmc_get_bounces  jobId=1246676
```
El `byCategory` separa lo transitorio de lo permanente: en un envío real, 290 *Soft bounce -
Mailbox Full* contra 10 hard bounces. Solo los hard justifican limpiar la base.

**Alcance de un journey**
```
sfmc_get_journey  id="<uuid>"     → stats.cumulativePopulation
```
⚠️ Pídelo por **`id` (UUID)**, no por `key`: los stats solo llegan por la forma de query.
Y es un contador **vivo** — el mismo journey dio 132,645 y cuatro días después 133,128.

---

## Historia: por qué esto se reescribió

Las 4 tools de tracking pegaban a `/data/v1/messageList/email/sends`, **un endpoint que no
existe en la API de SFMC**. Daba 404 en los dos tenants. Estaban documentadas en el README
como funcionando desde el día uno; nunca se habían ejercitado contra un tenant real.

Se reescribieron sobre SOAP el 31-jul-2026 (commit `6c506f0`) y se corrigieron sus truncados
silenciosos el 7-ago (commit `3cf89ae`). El detalle de la API está en
[SFMC-API.md](SFMC-API.md); las lecciones generalizables, en
[`../../CONSTRUIR-MCP.md`](../../CONSTRUIR-MCP.md).
