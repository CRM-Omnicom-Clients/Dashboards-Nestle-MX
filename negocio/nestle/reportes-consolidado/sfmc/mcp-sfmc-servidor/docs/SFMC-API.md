# La API de SFMC: lo que la documentación no dice

> Todo verificado contra dos tenants productivos entre el 31-jul y el 7-ago-2026:
> **GEPP** (MID `534016943`) y **Nestlé NMX** (MID `10966050`, 3,739 DEs · 1,892 queries ·
> 778 automations · 17,723 assets · 9.2M correos en 90 días).
>
> Está escrito para que la próxima persona —o la próxima sesión— no repita las mismas
> semanas. Si algo aquí contradice lo que ves en el tenant, **gana el tenant**: corrígelo aquí.

---

## 1. Autenticación

```
POST https://{tenant}.auth.marketingcloudapis.com/v2/token
{ grant_type, client_id, client_secret, account_id }
```

**`account_id` (el MID) es obligatorio en el body.** Sin él, `invalid_client` aunque las
llaves estén perfectas.

### 🔴 `invalid_client` es ambiguo: no distingue cuál de los tres valores está mal

Client id, client secret y MID producen **el mismo error, con el mismo texto**. Eso costó
una sesión entera persiguiendo un secret que estaba bien mientras el MID era de otra BU.

**Cómo aislarlo en una llamada:** pide el token **sin** `account_id`. SFMC lo emite contra
la BU dueña del package. Si eso funciona y con `account_id` no, **el MID es el problema**.
Luego el MID real sale de:

```
GET /platform/v1/tokenContext
→ { "enterprise": {"id": …}, "organization": {"id": ← este es el MID}, "user": {…} }
```

### El secret de la UI viene enmascarado

En *Installed Packages* el Client Secret se muestra como `*******` y **debajo** hay un campo
`Description` que SFMC autogenera como `<clientId> - 1` / `- 2`. Seleccionar y copiar la
página se lleva el Description, no el secret. **Hay que darle clic al ícono de copiar.**
Esto pasó tres veces seguidas antes de detectarse.

### Los secrets nuevos caducan

Los packages creados recientemente traen `Secret Expiration`. El día que vence, el MCP muere
con `invalid_client` y parece un bug de código. Se rota desde *Staged Secret Information* en
la misma página. ⚠️ **Un secret en Staged todavía no autentica**: hay que promoverlo a Active.

### Alcance del package

`Account` (SOAP) devuelve **una sola fila** si el package se instaló en una BU hija: no ve al
enterprise padre ni a las hermanas. Cambiar el MID en la config **no** da acceso a otra BU —
eso se otorga en el paso *Access* de la instalación, o creando el package a nivel enterprise.

---

## 2. Códigos de error: qué significa cada uno

| Código | Qué es realmente |
|---|---|
| **596 Service Not Found** | El gateway dice que ese servicio **no existe en esta ruta**. NO es permisos — con permisos sería 403. Agregar scopes no cambia nada. |
| **404** | La ruta está mal dentro de un servicio que sí existe |
| **400 `Parameter {id} is invalid`** | Típico de `/data/v1/customobjectdata`; en estos tenants sale para **cualquier** DE, por key y por nombre |
| **HTTP 200 + `<OverallStatus>Error</OverallStatus>`** | SOAP falla con 200. **Siempre revisar `OverallStatus`**, si no un fallo de permisos se lee como "no hay datos" |

---

## 3. Endpoints REST que NO funcionan (y qué usar en su lugar)

| Endpoint | Qué pasa | Alternativa |
|---|---|---|
| `/data/v1/messageList/email/sends` | **404 en todos los tenants — no existe** | SOAP `Send` |
| `/data/v1/customobjectdata/key:{k}/rowset` | 400 para cualquier DE | SOAP `DataExtensionObject[nombre]` |
| `/interaction/v1/interactions/{id}?extras=stats` | 200 **sin** el objeto stats | forma de query: `/interactions?id={uuid}&extras=stats` |
| `/interaction/v1/interactions/{id}/stats` | 404 | no existe |
| `/insights/v1/reports` · `/intelligence/v1/reports` · `/reports/v1/reports` · `/analytics/v1/reports` | 596 | **Marketing Cloud Intelligence (Datorama) es otro producto**, con su plataforma y credenciales |
| `/audience/v1/audiences` · `/einstein/v1/scores` | 596 | Audience Studio y Einstein son productos aparte |

**Regla general que salió de esto: no confíes en que un endpoint existe porque está en un
README o porque el nombre suena razonable. Pruébalo contra el tenant.** Las 4 tools de
tracking de este MCP estuvieron rotas desde el día uno porque nadie las ejercitó nunca.

---

## 4. SOAP: la vía confiable

`POST https://{tenant}.soap.marketingcloudapis.com/Service.asmx`
con header `SOAPAction: Retrieve` y `<fueloauth>{token}</fueloauth>` en el Header del sobre.

### Objetos verificados

| Objeto | Para qué | Nota |
|---|---|---|
| `DataExtension` | listar DEs | `Name` **no es único**; el único es `CustomerKey` |
| `DataExtensionField` | esquema de una DE | solo filtrable por `DataExtension.CustomerKey` |
| `DataExtensionObject[NOMBRE]` | **filas** de una DE | requiere `<Properties>`; sin ellas falla |
| `DataFolder` | carpetas | filtrar por `ContentType`: `dataextension` / `queryactivity` |
| `Send` | métricas por job | `NumberSent`, `NumberDelivered`, `UniqueOpens`, `UniqueClicks`, `HardBounces`, `SoftBounces`, `Unsubscribes`, `SentDate`, `EmailName` |
| `SentEvent` `OpenEvent` `ClickEvent` `BounceEvent` `UnsubEvent` | eventos a nivel suscriptor | **ver la trampa de abajo** |
| `TriggeredSendDefinition` | definiciones de triggered send | |
| `TriggeredSendSummary` | métricas acumuladas de triggered | **sin campo de fecha**: no se puede cortar por mes |
| `Account` / `BusinessUnit` | qué BUs ve el package | |
| `QueryDefinition` | Query Activities | también por REST, que es más cómodo |

### 🔴 Los objetos `*Event` no se pueden filtrar por fecha

`Describe` de `SentEvent` **no reporta ningún campo filtrable**. Un `Retrieve` con filtro por
`EventDate` de **un solo día** se murió en timeout a los 120 s sin devolver nada.

Sí funcionan filtrados por **`SendID`** — así están hechas `sfmc_get_clicks` y
`sfmc_get_bounces`. O sea: sirven cuando ya sabes el job, no para descubrir por periodo.

### `Describe` para no adivinar campos

```xml
<DefinitionRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><DescribeRequests>
<ObjectDefinitionRequest><ObjectType>TriggeredSendSummary</ObjectType></ObjectDefinitionRequest>
</DescribeRequests></DefinitionRequestMsg>
```
con `SOAPAction: Describe`. Devuelve cada campo con `IsRetrievable`. **Un solo campo inválido
tumba el Retrieve completo**, así que vale la pena consultarlo antes.

### Paginación

Lotes de **2,500**. Si `OverallStatus` es `MoreDataAvailable`, saca el `<RequestID>` y repite
mandando `<ContinueRequest>{id}</ContinueRequest>`. **En el ContinueRequest NO va el filtro**,
solo `ObjectType` + `Properties`.

### 🔴 Tres trampas de parseo que cuestan datos

1. **`<Results xsi:type="Send">`** — un regex `/<Results>/` sin tolerancia a atributos
   cuenta **0 filas** y parece que no hay datos. Usar `/<Results[^>]*>/`.
2. **Las entidades XML nunca vienen decodificadas.** El `&` siempre llega como `&amp;`
   (obligatorio en XML). Toda URL con UTMs sale rota si no se des-escapa.
3. **SFMC rellena con espacios.** `EmailName` a 100 chars, `Subject` a 200. Era el **22%**
   del peso de una respuesta, y hace que comparar por igualdad falle en silencio.

---

## 5. La Simple Query API (REST de Content Builder)

**El operador es `eq`, NO `=`.** Con `=` cualquier `$filter` revienta con error 10003.

```
$filter=assetType.name eq 'htmlemail' and category.id eq 648      ✅
$filter=assetType.name='htmlemail'                                ❌ error 10003
$filter=name like '%maggi%'                                       ✅ (like sí es válido)
```

Y `parentId` como **parámetro suelto no lo reconoce**: SFMC lo ignora y devuelve la lista
**sin filtrar**, con pinta de correcta. Va como `$filter=parentId eq N`.

---

## 6. Data Views: solo por SQL, y el SQL solo corre en una Query Activity

`_Job` · `_Sent` · `_Open` · `_Click` · `_Bounce` · `_Unsubscribe` · `_Journey` ·
`_JourneyActivity` · `_Subscribers` · `_ListSubscribers` · `_Complaint`

**No hay endpoint de "correr SQL".** Una Query Activity lee Data Views y **escribe a una
Data Extension**; nunca devuelve filas al que llama. El ciclo completo está en
[DATA-VIEWS.md](DATA-VIEWS.md).

> 💡 **El truco que más tiempo ahorró en todo el proyecto:** en vez de adivinar los nombres
> de columna de las Data Views, bajé las **1,892 queries del tenant** por
> `/automation/v1/queries` (que trae el `queryText`) y minée el esquema de **451 queries que
> ya corren en producción**. Eso da los nombres reales, los joins que la gente usa de verdad,
> y de paso revela qué DEs alimenta cada quien. Aplicable a cualquier tenant.

### Crear y correr una query por REST

```
POST   /automation/v1/queries                     { name, key, queryText, targetName,
                                                    targetKey, targetUpdateTypeId: 0, categoryId }
POST   /automation/v1/queries/{id}/actions/start/  {}
```
`targetUpdateTypeId`: **0 = Overwrite** · 1 = Update · 2 = Append.
El `categoryId` es del árbol **`Query`** (raíz 637), no del de Data Extensions.

**El parser SQL de SFMC no acepta comentarios `/* */` dentro de una subconsulta** — da
`Incorrect syntax near the keyword 'SELECT'`. En el encabezado sí los acepta.

### ⚠️ Programar automations por REST NO funciona

`PATCH /automation/v1/automations/{id}` con un objeto `schedule` responde **200 y lo
descarta**; `/actions/schedule/` da 404 y `/actions/start/` pide `Steps` aunque ya los tenga.
La recurrencia hay que ponerla **a mano en Automation Studio**. La query en cambio sí se
dispara por API sin problema.

---

## 7. Journeys

- Los stats **solo llegan por la forma de query**: `/interactions?id={uuid}&extras=stats`.
  Con la forma de ruta responde 200 y omite el objeto.
- `stats.cumulativePopulation` = cuántos **entraron** al journey. **No hay opens ni clicks**
  en Journey Builder; para eso, `Send` o las Data Views.
- Es un contador vivo: el mismo journey dio 132,645 un día y 133,128 cuatro días después.

### Envíos de journey: sí están en `Send`

Un journey genera **dos clases de registro** en `Send`: los de volumen real y unos con
`sent=0/1` que son registros por disparo. **Filtrar por fecha puede devolver solo los
segundos y hacerte creer que `Send` no sirve para journeys.** Sí sirve — verificado job por
job: AON EP4 dio 334,663 en las Data Views contra 334,962 en `Send`.

**Los triggered sends usan un JobID de larga vida** que acumula envíos durante meses. Una
ventana móvil corta sus envíos pero atrapa sus aperturas recientes, y salen con
`UniqueOpens > Delivered`. Ahí el número bueno es el de `Send`, no el de una query con ventana.

---

## 8. Scopes

Los que otorgó el package de Nestlé (35, todos de lectura salvo `automations_*`) y qué
habilitan:

| Necesitas | Scope |
|---|---|
| leer/crear/editar assets y emails | `saved_content_read/write`, `documents_and_images_*`, `email_read/write` |
| journeys | `journeys_read` · `journeys_write` · `journeys_execute` (pausar/reanudar/disparar) |
| Data Extensions | `data_extensions_read/write` |
| métricas de envío | `tracking_events_read` |
| **Query Activities y Automations** | `automations_read/write/execute` ← **incluye crear y correr QueryDefinition** |
| ver las BUs | `accounts_read` |

⚠️ **`data_extensions_write` no es quirúrgico**: abre escritura y borrado sobre **todas** las
DEs de la BU, no sobre una. Si solo hace falta crear una DE, conviene otorgarlo temporal,
crearla y revocarlo.

---

## 9. Registro del MCP

Ver [../README.md](../README.md). Los dos puntos que más cuestan:

1. **La config va en `~/.claude.json` → `mcpServers`.** `~/.claude/mcp.json` **no lo lee nadie**.
2. **El bloque `env` es load-bearing.** Este servidor carga su `.env` con `dotenv/config`, que
   resuelve contra el **CWD** — y el CWD al arrancar es la carpeta del proyecto, no la del MCP.
   O sea el `.env` **no se carga**: las credenciales del config son las que funcionan.

**Varios tenants = el mismo `index.js` registrado con otro nombre y otro `env`.** Cero código
duplicado. Corolario: **cualquier cambio al MCP afecta a todos los tenants a la vez** — hay que
probar en todos antes de dar algo por bueno.
