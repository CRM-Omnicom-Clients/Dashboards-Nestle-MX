---
name: sfmc-nestle-mcp
description: "MCP sfmc-nestle (SFMC de Nestlé, package CRM Hive Intelligence) — MID correcto, vencimiento del secret y scopes de solo lectura"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3fcc95e0-6a7f-416d-8815-86a488810f41
  modified: 2026-10-21T10:55:13.665Z
---

El MCP de SFMC de Nestlé corre con el **mismo `index.js`** que el de GEPP
(`~/.claude/tools/_mcp-sfmc`), registrado como un segundo servidor `sfmc-nestle` en
`~/.claude.json`. No hay copia del código: solo cambia el bloque `env`.

**Datos del package** (verificados 31-jul-2026 contra el API, no copiados de la UI):

| Dato | Valor |
|---|---|
| Package | `CRM Hive Intelligence` (Custom, In Development) |
| Business Unit | `NMX - Nestle Mexico` (tipo `BUSINESS_UNIT`, hija) |
| **MID** | **`10966050`** |
| Enterprise padre | `10958513` — **el package NO lo alcanza, ni a las BU hermanas** |
| Client Id | `xqwn1y2wyivqwnyxo5ngbc5t` |
| Tenant | `mcflspkw06d92jc90b28j3zlr95y` |
| Grant type | Server-to-Server (client_credentials) |

## 🔴 Tres cosas que costaron una sesión entera

**1. El MID de la UI no era el bueno.** Se intentó con `100019226` y daba `invalid_client` —
idéntico a un secret equivocado. La forma de aislarlo: pedir el token **sin** `account_id`
(SFMC lo emite contra la BU dueña del package) y luego pegarle a
`/platform/v1/tokenContext`, que devuelve el MID real. Si algún día vuelve a dar
`invalid_client`, **descartar el MID antes que el secret**: el mensaje de error de SFMC es
el mismo boilerplate para los tres valores y no distingue cuál falla.

**2. En la UI el Client Secret sale como `*******`.** Debajo trae un `Description:` que SFMC
autogenera como `<clientId> - 1` / `- 2`. Seleccionar y copiar la página se lleva el
Description, no el secret — hay que darle clic al ícono de copiar. Pasó tres veces seguidas.

**3. El secret vence.** `2027-01-28` — los packages nuevos de SFMC caducan el secret, el de
GEPP es anterior y no tiene vencimiento. Ese día el MCP va a morir con `invalid_client` y va
a parecer un bug de código. Se rota desde *Staged Secret Information* en la misma página.
⚠️ Un secret en Staged **todavía no autentica**; hay que promoverlo a Active.

**Auditoría de secretos (2-oct-2026, cierre del skill crm-reporte-mcp-nestle-sfmc):** el secret ACTUAL del bloque `sfmc-nestle` (pegado por Rick en el chat el 29-sep; yo lo repetí una vez en un
script de prueba el 2-oct y lo borré a los pocos minutos) y el ANTERIOR (agosto) quedaron en la transcripción **local** de la sesión 3fcc95e0, y el anterior también en `~/.claude.json.backup`.
En ningún repo, memoria, kit ni carpeta de OneDrive. Recomendado a Rick: rotar el actual (`docs/CONEXION.md` §7 del skill) y borrar el package viejo si aún existe. Estado: pendiente de su decisión.

**✅ RESUELTO el 20-oct-2026:** Rick marcó `automations_execute` (efecto inmediato en el siguiente token) y `journeys_read`; el package tiene 10 scopes y `doctor.js` sale sin fallas. Lo de abajo queda como historia.
**Cambio detectado el 8-oct-2026 (no lo hizo Claude; probablemente la rotación):** el bloque `sfmc-nestle` de `~/.claude.json` ya apunta a OTRO package (client `8cv7m1m1…`, ayer era `2cimnuty…`) con **8 scopes en vez de 11**. Le faltan
`automations_execute` (REQUERIDO por el kit: crear DEs/queries temporales y disparar queries) y `journeys_read` (audiencias). Mientras no los marque Rick en el Installed Package (Setup → Apps → Installed Packages → API Integration → Edit; el secret no
cambia), el kit solo puede LEER tablas: no puede agregar-pieza, refrescar-pieza, resolver-emailname ni audiencias (todos usan consulta temporal) — `doctor.js` marca ✗ en «Scopes del package». No es un bug del kit ni hay que «arreglarlo» por cuenta propia
(política de arriba: no agregar scopes). La automation de las 00:08 NO depende de este package (corrió bien el 8-oct). El vencimiento `2027-01-28` de arriba era del package anterior; el del nuevo no se ha verificado.

## Alcance real: una BU, y es producción (verificado 31-jul-2026)

El objeto SOAP `Account` devuelve **una sola fila** — el package no ve al enterprise padre ni a
BU hermanas. Cambiar el MID en la config **no** da acceso a otra BU: eso se otorga en el paso
*Access* de la instalación, o creando el package a nivel enterprise.

**No es cuenta de prueba.** 752 journeys · 776 automations · 1,874 queries SQL · 2,628 carpetas
de Content Builder · **17,723 assets** · 6.6M correos enviados en 2026, con historial desde 2019.

Nestlé **no separó las marcas en BUs distintas**: adentro de NMX conviven Purina, NIN, Gerber,
Fancy Feast y Nescafé (se ve en los nombres de las queries y DEs). Para el Reporte Consolidado
eso significa que todo lo necesario está en esta BU, sin pedir accesos extra.

## 🔴 Política de Rick: en Nestlé se LEE, no se escribe

Decisión suya, 31-jul-2026: **contra el tenant de Nestlé solo consultar datos. No crear, no
editar, no borrar, no prender ni parar journeys.** La única excepción son las **automations**,
y aun así **solo cuando él lo pida explícitamente** — no por iniciativa propia aunque parezca
la solución obvia.

**Por qué:** es el tenant productivo del cliente. Un asset creado de más o un journey pausado
por error se ve del lado de Nestlé, no del nuestro.

**Cómo aplicarlo:** los 35 scopes concedidos son de lectura salvo `automations_*`, así que
casi toda la política la impone Salesforce sola — `create_email`, `update_asset`,
`upsert_de_rows`, `pause_journey` y compañía rebotan con error de scope. Eso es una red de
seguridad, no la regla: la regla es no intentarlo.

⚠️ **NO agregar los scopes de escritura.** Que falten es intencional. En la sesión donde se
configuró esto llegué a recomendar agregarlos antes de que él fijara la política — si una
sesión futura ve las tools de escritura fallando, **no es un bug que haya que arreglar.**

Consecuencia asumida: `rick-html-email-builder` **no puede subir emails a Nestlé**. Ahí la
maquetación se entrega por fuera. En GEPP (`sfmc`) sí hay escritura y eso no cambia.

## Métricas de email: el REST no existe, va por SOAP

**Principio (no caduca):** `/data/v1/messageList/email/sends` **no existe en la API de SFMC** —
da 404 en cualquier tenant. Las métricas de envío viven en los objetos SOAP `Send`,
`BounceEvent`, `ClickEvent`, `SentEvent`, `UnsubEvent`. Si alguna doc o README dice lo
contrario, la doc está mal.

**Estado (31-jul-2026):** las 4 tools ya se reescribieron sobre `sfmcSoap()` — commit `6c506f0`
en `~/.claude/tools`. Probadas ejercitando las handlers contra los dos tenants: GEPP 20 envíos
en 2026, Nestlé 157 envíos / 6.6M enviados / OR 20.92%.

- `sfmc_list_sends` — **pásale siempre `dateFrom`/`dateTo`**. Sin filtro, SOAP entrega del
  envío más VIEJO al más nuevo y los primeros lotes salen de 2020. Devuelve tasas ya
  calculadas y totales del periodo.
- `sfmc_get_send_metrics` — un job por ID. `sfmc_get_bounces` / `sfmc_get_clicks` — por
  `SendID`, con desglose por categoría SMTP y top de URLs. `summaryOnly:true` en clicks evita
  arrastrar el detalle por suscriptor.
- En `list_sends`, `count` excluye los `Send` con 0 enviados y `retrieved` es el crudo: por eso
  puede salir `truncated:true` con `count` menor a `maxRows`. No es bug.

⚠️ **Trampa de parseo:** los resultados vienen como `<Results xsi:type="Send">`. Un regex
`/<Results>/` sin tolerancia a atributos cuenta 0 filas y parece que no hay datos.

**Performance de email dentro de journeys:** no hay endpoint nativo, `/interactions/{id}/stats`
da 404. Hay que leer las actividades `EMAILV2` del journey y cruzarlas contra `Send` por nombre.

**Intelligent Reports: no se alcanza desde aquí.** Es Datorama, producto y API aparte — los
tres endpoints candidatos devuelven 596. Editarlos sigue siendo manual.

## Métricas de email: primero `sfmc_list_sends`

**Principio (no caduca):** para métricas de envío —incluidos los de journey— **`sfmc_list_sends`
alcanza**. Una llamada, sin infraestructura. Pásale siempre `dateFrom`/`dateTo`, y
`summaryOnly:true` si el periodo es largo.

🔴 **Corregido el 3-ago-2026:** llegué a escribir aquí y en DATA-VIEWS.md que `Send` devuelve
`sent=0/1` para journeys con triggered send y que por eso hacía falta un pipeline de Data
Views. **Era falso.** El error: filtré `Send` por fecha, cayeron unos job IDs de AON que sí
traen `sent=0/1` (registros por disparo, existen), y generalicé sin comprobar los de alto
volumen. Comparando job por job, `Send` sí los tiene (AON EP4: 334,663 en la DE vs 334,962 en
`Send`). **Lección: no generalizar de una muestra filtrada sin verificar el caso contrario.**

**La DE `CRM_Email_Performance` sigue siendo útil, pero solo para 3 cosas** que `Send` no da:
`JourneyName`/`JourneyID` por envío · `TotalOpens`/`TotalClicks` (no solo los únicos) · un
dataset ya agregado que se lee de un jalón. Si no necesitas ninguna, usa `sfmc_list_sends`.

Para leerla: `sfmc_get_de_rows name="CRM_Email_Performance"`. Si `LastRefresh` está viejo:
`sfmc_run_query queryDefinitionId="0f9ffc39-c3a5-4928-85e6-b2ee43ac2d85"`.
**El detalle vive en `~/.claude/tools/_mcp-sfmc/DATA-VIEWS.md`** — leerlo antes de tocar la query.

**Lo que sí es cierto de las Data Views:** no se consultan por API. El REST da 400 y el SOAP
`SentEvent` filtrado por fecha da **timeout** (su Describe no reporta campos filtrables).
La única vía es una Query Activity que escribe a una DE.

**Piezas creadas** (con permiso temporal de escritura que Rick ya revocó):
DE `CRM_Email_Performance` en `Data Extensions / CRM Services` · query
`CRM_Email_Performance_Load` en `Query / CRM Services` · automation
`CRM_Email_Performance_Daily`.

⚠️ **La automation NO quedó programada.** El REST del tenant acepta el PATCH con schedule
y **lo descarta en silencio**. Hay que ponerle la recurrencia a mano en Automation Studio.
Mientras tanto, refrescar con `sfmc_run_query`.

⚠️ **Para saber si una corrida terminó, comparar `MAX(LastRefresh)` contra el valor de ANTES
de disparar.** Contar filas o mirar si la fecha es de hoy **NO sirve** — la corrida previa
las deja idénticas. Esa trampa costó dos diagnósticos falsos seguidos.

## Dónde quedó documentado todo (7-ago-2026)

Esto sobrevive aunque el MCP se desconecte — son archivos versionados en git:

Todo cuelga de `~/.claude/tools/`. El `README.md` del MCP es el índice.

| Documento | Qué contiene |
|---|---|
| `_mcp-sfmc/docs/EMAIL-TRACKING.md` | **Empieza aquí para métricas.** Tabla de qué fuente usar para cada pregunta, las 4 reglas que evitan números mal, denominadores de cada tasa, y la evidencia de que `Send` SÍ trae los envíos de journey |
| `_mcp-sfmc/docs/DATA-EXTENSIONS.md` | Leer/buscar/crear DEs · los **3 árboles de carpetas** sin relación entre sí · el paisaje real de Nestlé (3,739 DEs, sin convención) · catálogo de las DEs de reportería que ya existen |
| `_mcp-sfmc/docs/DATA-VIEWS.md` | El pipeline SQL → `CRM_Email_Performance`, y cuándo NO hace falta |
| `_mcp-sfmc/docs/SFMC-API.md` | La API por dentro: endpoints que no existen, `596` ≠ permisos, cómo aislar un `invalid_client`, objetos SOAP, trampas de parseo, scopes |
| **`CONSTRUIR-MCP.md`** | **Genérico, para cualquier MCP futuro.** Las 11 lecciones de los 67 defectos de la revisión adversarial, con checklist de una página |

**Si vuelves a conectar este MCP o construyes otro, empieza por `CONSTRUIR-MCP.md`.**

## Notas

- El `.env` de `_mcp-sfmc` **no se carga** (dotenv resuelve contra el CWD, que es la carpeta
  del proyecto). Las credenciales del bloque `env` en `~/.claude.json` son load-bearing.
- No renombrar el servidor `sfmc` (GEPP): `rick-html-email-builder/references/sfmc.md`
  apunta a los nombres `mcp__sfmc__*`.
- El tenant no necesita `NODE_TLS_REJECT_UNAUTHORIZED=0` — el handshake TLS pasa limpio
  después de la migración a Omnicom.
