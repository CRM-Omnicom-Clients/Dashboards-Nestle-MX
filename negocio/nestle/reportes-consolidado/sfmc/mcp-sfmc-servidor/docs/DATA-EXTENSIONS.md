# Data Extensions en SFMC: leerlas, crearlas y no perderse

> Verificado contra Nestlé NMX (MID `10966050`) el 7-ago-2026:
> **3,739 DEs** en **545 carpetas** · 2,680 sendable / 1,059 no.
> GEPP tiene 66 DEs — sirve para probar, no para descubrir problemas de escala.

---

## Leer filas

```
sfmc_get_de_rows  name="CRM_Email_Performance"
```

**Se pide por `name`, NO por external key.** Si omites `fields`, la tool resuelve el esquema
sola (dos llamadas SOAP extra).

Con filtro:
```
sfmc_get_de_rows  name="CRM_Email_Performance"
                  filterField="Sent"  filterOperator="greaterThan"  filterValue="10000"
```
Operadores válidos: `equals` · `notEquals` · `greaterThan` · `lessThan` · `like` ·
`isNull` · `isNotNull` · `between` · `IN`.

**Revisa siempre `truncated`.** El default es `maxRows=500`; si sale `true`, faltan filas y
la respuesta lo dice con un `warning`.

### 🔴 El REST de DE rows no funciona en estos tenants

`/data/v1/customobjectdata/key:{k}/rowset` devuelve **400 `Parameter {id} is invalid`** para
cualquier DE, por key **y** por nombre, con y sin parámetros de página. Por eso la tool va por
SOAP `DataExtensionObject[nombre]`.

Detalle que cuesta descubrir: **un `Retrieve` de `DataExtensionObject` sin `<Properties>`
falla**. Hay que saber los campos antes de pedir las filas — de ahí la resolución automática.

---

## Encontrar una DE

```
sfmc_list_data_extensions  nameFilter="Performance"
sfmc_get_de_fields         name="CRM_Email_Performance"
```

⚠️ **`sfmc_list_data_extensions` bajaba solo el primer lote de 2,500** y filtraba en cliente
sobre él. En Nestlé (3,739 DEs) eso reportaba `count: 0` para DEs que sí existen — incluida
`CRM_Email_Performance`, la que la propia documentación mandaba a leer. **Corregido el
7-ago-2026** (commit `3cf89ae`): ahora pagina y reporta `totalEnLaBU`.

### Name vs CustomerKey

SFMC impone unicidad sobre el **`CustomerKey`**, no sobre el `Name`: en teoría dos DEs en
carpetas distintas pueden llamarse igual.

**En la práctica, en Nestlé hay 0 nombres duplicados de 3,739** — así que direccionar por
nombre es seguro hoy. `sfmc_get_de_rows` detecta el caso y devuelve un error explicativo si
algún día aparece un duplicado, en vez de tomar el primero en silencio.

---

## 🔴 Dos árboles de carpetas distintos, y confundirlos no da error

| Árbol | Tool | Endpoint | Para qué |
|---|---|---|---|
| **Data Extensions** | `sfmc_list_de_folders` | SOAP `DataFolder` + `ContentType='dataextension'` | el `categoryId` que exige crear una DE |
| **Content Builder** | `sfmc_list_folders` | REST `/asset/v1/content/categories` | carpetas de assets y emails |
| **Query** (raíz `637`) | — | SOAP `DataFolder` + `ContentType='queryactivity'` | el `categoryId` de una Query Activity |

Son **tres espacios de IDs sin relación**. Un `categoryId` de Content Builder pasado a
`sfmc_create_data_extension` no falla de forma obvia: crea la DE en un lugar equivocado o
rebota con un mensaje que no menciona el árbol.

### El paisaje de carpetas en Nestlé

545 carpetas de DEs. Las más pobladas:

| DEs | Carpeta |
|---:|---|
| 423 | `Data Extensions` (la raíz, sin organizar) |
| 350 | `Audiences` |
| 116 | `2021` |
| 101 | `Purina` |
| 93 | `NBS Latam` |
| 75 | `Recetas Nestlé` |
| 56 + 33 | `Test` (dos carpetas distintas con el mismo nombre) |
| 45 | `IP Warmup MX` |
| 43 | `Nescafé Audiences` |
| 39 | `Batches` |

**No hay convención.** Hay carpetas por marca, por año, por propósito y por equipo, más una
raíz con 423 DEs sueltas. Buscar por `nameFilter` es más confiable que navegar el árbol.

Lo nuestro vive en **`Data Extensions / CRM Services`** (`categoryId` **445199**).

---

## Crear una DE

```
sfmc_create_data_extension
  name="..."  categoryId=445199  isSendable=false
  fields=[{name:"JobID", type:"Number", isPrimaryKey:true, isNullable:false}, ...]
```

- **`categoryId` sale de `sfmc_list_de_folders`**, nunca de `sfmc_list_folders`.
- Al menos **un primary key no nulo**.
- Tipos: `Text` (con `length`) · `Number` · `Date` · `Boolean` · `Decimal` · `EmailAddress` ·
  `Phone` · `Locale`.
- Si `isSendable=true`, hacen falta `sendableCustomObjectField` y `sendableSubscriberField`
  (normalmente `_SubscriberKey`).

⚠️ **`data_extensions_write` no es quirúrgico.** Abre escritura **y borrado** sobre las 3,739
DEs de la BU, no sobre una. Para crear una sola conviene otorgarlo temporal, crearla y
revocarlo — que es como se hizo `CRM_Email_Performance`.

---

## DEs de reportería que ya existen en Nestlé

**424 DEs se alimentan de queries sobre Data Views.** Pero el patrón es casi **1 query : 1 DE**:
es trabajo ad-hoc por campaña (suprimir bouncers, segmentar no-aperturantes), **no un pipeline
de reportería**. Los nombres lo delatan: `AON Young Creatives filtrado final`,
`3001576_bounces_E-Hack2`.

Las pocas que sí parecen reportería:

| DE | Lee | Qué es |
|---|---|---|
| `JPR_NMX_PerfStage` | `_Sent` `_Open` `_Click` `_Bounce` `_Unsubscribe` | Performance por día y por *triggered send*. Lo más parecido a lo nuestro que ya existía |
| `Qry_Rslt_Journey_Campaings` | `_Job` `_Journey` `_JourneyActivity` | resultados por journey |
| `Qry_Rslt_Campaing_Opens` | `_Open` `_Job` | aperturistas por lista de JobIDs (hardcodeados en el SQL) |
| `DE_MX_Purina_Ecosystem_Engage_1` | `_Sent` `_Open` | 12 queries alimentándola |
| `ConsumerJOBDataView1` | `_Open` `_Job` | aperturistas de 24 meses |
| `CRM_Email_Performance` | las 6 vistas de email | **la nuestra** — ver [DATA-VIEWS.md](DATA-VIEWS.md) |

> 💡 **Antes de construir algo, busca si ya existe.** Bajar las queries del tenant con
> `sfmc_list_queries includeSql=true` y ver qué DEs alimentan revela el trabajo previo del
> equipo del cliente. Ahí salió que `JPR_NMX_PerfStage` ya hacía casi lo mismo.

---

## Escribir filas

```
sfmc_upsert_de_rows  externalKey="..."  keyFields=["JobID"]  rows=[{...}]
```

Upsert por primary key vía `/hub/v1/dataevents`. Necesita `data_extensions_write`.

🔴 **En Nestlé esto está bloqueado a propósito** — la política es solo lectura. Ver la memoria
del proyecto `sfmc-nestle-mcp.md`.

---

## Data Views: no son DEs

`_Job` · `_Sent` · `_Open` · `_Click` · `_Bounce` · `_Unsubscribe` · `_Journey` ·
`_JourneyActivity` · `_Subscribers` · `_ListSubscribers` · `_Complaint`

**No se leen con `sfmc_get_de_rows`** ni con ningún endpoint: solo con SQL desde una Query
Activity, que escribe a una DE. Todo el mecanismo está en [DATA-VIEWS.md](DATA-VIEWS.md).
