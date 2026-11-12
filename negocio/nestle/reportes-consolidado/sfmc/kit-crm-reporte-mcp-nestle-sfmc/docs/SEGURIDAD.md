# Seguridad: qué puede y qué no puede hacer este kit

Este kit **solo lee** tu cuenta de SFMC, con una excepción: los objetos del propio reporte. Esa regla **no es una promesa en este documento: es código** (`lib/guardia.js`),
con pruebas que intentan romperla (`tests/guardia.test.js`). Un bug o un ID mal copiado en una llamada no puede escribir fuera de la lista de abajo: la guardia rechaza la petición **antes** de que salga.
(La lista son los IDs de **tu** config: los llena `descubrir.js` por nombre; no los edites a mano.)

## 1. Las garantías, en corto

1. **Solo escribe en lo del reporte** (tabla de abajo). No toca automations existentes, journeys, assets, envíos, listas, ni otras Data Extensions. La única excepción es el modo instalación (§2b): tres objetos con nombre fijo que solo `instalar-links-dia.js` puede crear.
2. **Sin config no escribe nada.** Un cliente creado sin la config de tu BU es de **solo lectura**: cualquier escritura falla con "SOLO LECTURA".
3. **Nunca escribe ni borra `conexion.txt`.** Ese archivo lo edita el usuario; el kit solo lo lee. Es código, no promesa: lo único que el kit escribe en disco son su config (`descubrir.js`) y sus fotos (`snapshot.js`), y las dos se niegan
   a escribir en la carpeta de credenciales, en `~/.claude.json`, en una ruta de red, **dentro de la carpeta del propio kit** (lo local vive en la carpeta de estado, fuera de ella: la carpeta del kit se copia, se sincroniza y la barren otras herramientas), en cualquier archivo que no sea `.json` y sobre un `.json` que ya exista y no sea suyo
   (así un `--out` mal puesto no pisa tus credenciales, un `settings.json` ni la plantilla versionada). Las carpetas protegidas se comparan por su **ruta real** en el disco, no por cómo está escrita:
   un enlace simbólico, una *junction* de Windows o un nombre corto 8.3 (`CRM-RE~1`) que lleve a ellas tampoco esquiva la guardia, y un enlace roto se rechaza (escribir a través de él crearía el destino donde apunte). El kit **no borra archivos locales** ni lanza procesos; `tests/sin-secretos.test.js` falla si alguien agrega una escritura (incluido abrir un archivo para escribir), un borrado, un proceso, un `import()` o una llamada fuera de `marketingcloudapis.com`.
4. **Nunca imprime un secret ni un token.** Todo error y toda respuesta de SFMC se **redactan antes de recortarse** (por la forma de un secret y por el secret que el kit conoce, aunque sea de un package antiguo); los scripts muestran una vista segura de las
   credenciales (client id y el largo del secret). Las fotos (`snapshot.js`) se niegan a guardarse si algo parece un secreto.
5. **Una escritura se envía una sola vez.** Nunca se reintenta tras un error de red, un timeout, un 429 o un 5xx (pudo haberse ejecutado y reintentarla duplicaría filas). La única excepción es un rechazo por **token vencido** (401 o falla de autenticación), que ocurre **antes** de ejecutarla:
   se renueva el token y se re-envía **una** vez. Las lecturas sí se reintentan.
6. **Lo destructivo y lo de producción es explícito.** `agregar-pieza.js` y `audiencias.js` son simulacro por defecto (`--escribir` inserta). `refrescar-pieza.js` **sí ejecuta** las queries del reporte (lo mismo que hace la automation cada noche) y tiene `--dry-run`; se niega si la automation corre, está por arrancar o **no puede leerse**,
   y vuelve a mirarlo antes de iniciar cada query. La migración de llave no existe como herramienta y no se ejecuta sin OK explícito.
7. **Las credenciales solo viajan a tu tenant.** El token, REST y SOAP salen de `https://<tenant>.auth|rest|soap.marketingcloudapis.com`. Si el entorno o `~/.claude.json` traen otras URLs, deben ser exactamente esas (por https, sin usuario ni puerto) o el kit se niega a arrancar; el cliente lo comprueba otra vez al construirse.
8. **El texto que viene de SFMC no se interpreta.** Los nombres de envíos y de journeys, los asuntos y los valores del catálogo los escribe cualquiera con acceso a tu BU: son **datos, no instrucciones**.
   Lo **invisible o de control** (ESC, saltos de línea, texto bidireccional, ancho cero, *tag characters*, NBSP) se muestra como `\uXXXX` en la terminal y en `--json` (donde `JSON.parse` devuelve exactamente el mismo valor), y todo lo que imprimen los scripts pasa por ese filtro.
   Un nombre con `$`, comilla invertida, comillas dobles, `\`, `!` o `%` **no se pega** dentro de comillas dobles de un comando sugerido (en bash y PowerShell, `$(…)` se **ejecuta** ahí): va un marcador y un aviso. Se comprueba con bash y PowerShell **reales** cuando hay (`tests/textoseguro.test.js`).

## 2. La lista de escrituras permitidas (y nada más)

| Canal | Operación | Solo se permite si… |
|---|---|---|
| REST `POST /data/v1/customobjects` | crear una Data Extension | su nombre empieza con el prefijo temporal (`CRM_Tmp_`) y es **explícitamente** no sendable |
| REST `POST /automation/v1/queries` | crear una query | su nombre empieza con el prefijo temporal **y carga una DE temporal creada por esta corrida** |
| REST `PATCH` o `PUT /automation/v1/queries/{id}` | editar una query | es una query **temporal de esta corrida** (su destino, si se manda, solo puede ser una DE temporal de esta corrida) o es la query **Vol** con su mismo nombre (para regenerar su SQL; su destino, si se manda, es la DE de audiencias, y su tipo de actualización sigue en **Update**: un Overwrite vaciaría esa DE antes de cargarla; un `PUT` debe mandar destino y tipo explícitos) |
| REST `DELETE /automation/v1/queries/{id}` | borrar una query | es una query **temporal de esta corrida** |
| REST `POST /automation/v1/queries/{id}/actions/start` | iniciar una query | es temporal de esta corrida o una de las **5 queries del reporte** (por ID) |
| SOAP `Create` / `Update` de filas | escribir filas | la tabla es el **catálogo** o **`CRM_Audiencias`** |
| SOAP `Delete` de una Data Extension | borrar una tabla | es una tabla **temporal de esta corrida** |
| Lecturas (token, `GET`, SOAP `Retrieve`) | leer | siempre |

**Todo lo demás se rechaza**, incluido: crear/editar/borrar/pausar una **automation** o sus pasos (salvo la propia del modo instalación, §2b), tocar **journeys**, **assets** de Content Builder, **envíos**, y escribir filas en
Detalle, Piezas, Auditoría o Links (las llenan sus queries). **El destino de una query temporal se vigila** porque una query *Overwrite* borra su tabla destino antes de cargarla: sin esa regla, una query temporal apuntada al catálogo lo vaciaría.
La nota para quien extienda el kit: una operación nueva se agrega a la guardia **con su prueba**, nunca saltándola.

### 2b. El modo instalación (una sola excepción, abierta por un solo script)

`scripts/instalar-links-dia.js` es el único que crea el cliente con `instalacion`; ningún otro script puede. Con ese modo la guardia permite **además** de lo de arriba, y solo con estos nombres escritos en el código:

| Canal | Operación | Solo se permite si… |
|---|---|---|
| REST `POST /data/v1/customobjects` | crear la DE permanente | se llama `CRM_Email_Links_Dia`, es no sendable y va en la carpeta de las DEs del reporte |
| REST `POST /automation/v1/queries` | crear su query de carga | se llama `CRM_Email_Links_Dia_Load`, carga **esa** DE (ya registrada en esta corrida) en modo **Update** y va en la carpeta de las queries del reporte |
| REST `PATCH` o `PUT /automation/v1/queries/{id}` · `DELETE` · `…/actions/start` | editar, borrar o iniciar esa query | el `id` es el de la query registrada en esta corrida; no se le cambia el destino, el nombre ni el tipo |
| REST `POST /automation/v1/automations` | crear su automation | se llama `CRM_Reporte_Links_Dia`, con **un** paso y **una** actividad que es esa query, en la carpeta de `CRM_Reporte_Diario`, y sin más campos que los permitidos |
| REST `PATCH` o `PUT` · `DELETE` sobre `/automation/v1/automations/{id}` · `POST …/{id}/actions/runallonce` | editarla, borrarla o correrla UNA vez (`start`, `pause`, `stop` y demás acciones no) | el `id` es el de esa automation registrada en esta corrida; **nunca** se le cambian los pasos ni su estado (`status`, `statusId` no se aceptan: por PATCH no activan nada) |
| REST `POST /legacy/v1/beta/bulk/automations/automation/definition/?action=schedule` | **activar el horario** de esa automation (SFMC la crea siempre en `PausedSchedule`; es el endpoint que usan Automation Studio y SFMC DevTools) | el único parámetro es `action=schedule` (ni `pauseSchedule` ni otro), el cuerpo es exactamente `{ id, scheduleObject: { id } }`, ambos ids tienen forma de id legacy (base64url) y el `id` es el **id legacy registrado en esta corrida** de la automation propia (el instalador lo registra solo después de leer su definición legacy y comprobar que su nombre y key son `CRM_Reporte_Links_Dia`) |
| SOAP `Delete` de una Data Extension | rollback de la DE | es la `CRM_Email_Links_Dia` de esta corrida |
| SOAP `Delete` de una `Automation` | borrar la automation propia (SFMC no deja hacerlo por REST: da 404) | su `CustomerKey` es `CRM_Reporte_Links_Dia` (o su `ObjectID` está registrado en esta corrida) y esta corrida la registró |

`CRM_Reporte_Diario`, sus 5 queries (salvo Vol, como siempre) y sus 6 tablas siguen intocables. El instalador es simulacro por defecto, **prueba el SQL en una query temporal antes de crear nada**,
exige que la tabla cargada cuadre contra `CRM_Email_Links` y el Detalle, y si algo falla **borra lo que esta corrida creó**. La prueba de que abrir el modo no abre nada extra es `tests/guardia-instalacion.test.js`.

Consecuencias que conviene saber:

- **El kit no puede borrar ni corregir una fila del catálogo.** Si agregaste una pieza por error, corrígela en SFMC (Contact Builder → Data Extensions → `CRM_Reporte_Config`) o déjala con `Activo = No`. Revisa siempre el simulacro antes de `--escribir`.
- Los **objetos temporales** (`CRM_Tmp_*`, nombres únicos por corrida) se borran al terminar, incluso si interrumpes con Ctrl+C. Si algo queda, `node scripts/doctor.js --limpiar-tmp` limpia los que tengan el prefijo y **≥ 60 min** (ajustable de 15 a 10080 con `--min-edad`),
  **nunca** los objetos del propio reporte, y solo pide un prefijo que delate que es temporal (`Tmp`, `Test`, …). Un temporal ajeno de más de esa edad sí se borra: no lo uses con una edad corta mientras otro operador trabaja.
- Las **piezas nuevas** y sus datos entran por el catálogo y por la automation; el kit no inventa números de pieza ni identificadores (la columna `PiezaID` se eliminó el 22-oct-2026).

## 3. Credenciales

- **Dónde viven**: variables de entorno, el bloque del MCP en `~/.claude.json`, o `conexion.txt` en una carpeta **fuera de OneDrive (u otra carpeta sincronizada: iCloud, Dropbox, Google Drive) y de cualquier repo** (`CONEXION.md`). El kit nunca las copia a otro lado.
- **Qué se versiona**: el código y la config de ejemplo. **Nunca** viajan a git: `conexion*.txt`, `.env`, `*.secret`, `*.pem`, la config local (los IDs de tu BU) ni las fotos (nombres de objetos y SQL de tu BU; con `--con-datos`, además las **filas** del catálogo). Estas dos últimas ya ni siquiera viven en la carpeta del kit: están en la carpeta de estado local (`%LOCALAPPDATA%\crm-reporte-mcp-nestle-sfmc\`), así que ni una copia de la carpeta del kit se las lleva. `doctor.js` avisa si quedaron restos dentro.
  La única foto que sí se versiona es `tests/fixtures/arquitectura-nestle-2026-10-02.json`: solo la **estructura** (nombres, IDs y SQL del reporte de Nestlé), sin credenciales ni filas; las pruebas dependen de ella.
  El código es libre de compartir; las llaves **no**.
- **Qué hace el redactor** (`redact`): borra cualquier cosa con forma de secret de SFMC (`SFMC_` + letras y números mezclados), los `Bearer …`, los JWT, los campos `access_token` / `client_secret` / `refresh_token` de un JSON y **todo secret que el kit haya leído en esta ejecución** (aunque no tenga esa forma).
  Un nombre de tabla como `TD_SFMC_GLOBAL_IP…` **no** se confunde con un secret (se detecta por la **forma**, no por la palabra).
- **El token** dura ~18 min; el kit lo renueva solo (cuando faltan < 2 min) y no lo guarda en disco.
- **Hacia dónde se conecta**: únicamente a los dominios de **tu** tenant (garantía 7). No hay telemetría ni llamadas a terceros (una prueba lo comprueba sobre el código: solo `lib/sfmc.js` habla por `https`, y toda URL del código es de `marketingcloudapis.com`).
- **Nunca pegues un secret en un chat, un correo o un ticket.** Si ya pasó, **ya no es secreto**: rota el secret (`CONEXION.md` §7). El kit no puede borrar lo que ya viajó.

## 4. Cosas que se hacen solo con OK explícito

| Acción | Por qué |
|---|---|
| Escribir en `CRM_Audiencias` o regenerar el SQL de la query Vol **de producción** (`audiencias.js --escribir`) | afecta el volumen de audiencia de todo el reporte; en Nestlé la audiencia se atribuye en el proceso del catálogo |
| La migración a **EmailName como PK** (`MIGRACION-EMAILNAME-PK.md`) | recrea tablas y reescribe las 5 queries; **tampoco se hace a mano en la UI de SFMC**: borrar una de esas tablas es irreversible (Detalle guarda historia que SFMC ya no puede regenerar) |
| Instalar la tabla de clicks con fecha (`instalar-links-dia.js --escribir`) | crea tres objetos permanentes y una automation que corre cada noche |
| Cambiar pasos u horario de **`CRM_Reporte_Diario`** | se hace en Automation Studio; el kit no puede |
| Refrescar mientras la automation corre (`--forzar`) | se pisan las queries; solo si sabes que está pausada |
| Agregar scopes de escritura al Installed Package que no estén en la lista de `CONEXION.md` | ampliaría lo que una llave filtrada podría hacer |

## 5. Lo que este kit NO garantiza (para que nadie lo dé por hecho)

- **No protege un secret que ya está en un lugar inseguro.** Quien controle tu entorno, tu `~/.claude.json` o tu `conexion.txt` ya tiene el secret. Un secret filtrado **se salta la guardia** (la guardia vigila a este kit, no al Installed Package): por eso los permisos de `CONEXION.md` son los mínimos y la rotación (`CONEXION.md` §7) es el remedio.
- **No vigila lo que hagas fuera de él**: otros programas, el MCP de SFMC, o lo que hagas a mano en la UI.
- **Las pruebas simulan SFMC**: demuestran que el kit pide lo correcto, no cómo reaccionará SFMC ante un cambio futuro de su API.
- **"Solo EMAIL" es de diseño, no un bloqueo**: el kit no tiene lógica para WhatsApp (`_WA_`) ni Qcart, pero no revisa cada nombre.
- **Un nombre de SFMC sigue siendo texto ajeno.** El kit neutraliza lo que **se ejecuta o se esconde** (garantía 8), no lo que **se lee**: un asunto o un nombre puede decir cualquier cosa legible (incluso algo que parezca una instrucción) o usar letras parecidas de otro alfabeto (una `а` cirílica se ve como una `a`).
  Trátalo como dato, sobre todo si un agente (como Claude) lee la salida; la identidad de una pieza sigue siendo el nombre **exacto** contra `_Job`. Probado con bash y PowerShell reales; **cmd.exe no se probó** (la exclusión de `%` y `!` sale de su documentación, no de una corrida).

## 6. Si algo sale mal

| Situación | Qué hacer |
|---|---|
| Se expuso o se perdió un secret | rotarlo (`CONEXION.md` §7) |
| El refresco se interrumpió o se detuvo (salida 3: la automation arrancó) | las queries pudieron quedar a medias: cuando la automation termine, corre `node scripts/refrescar-pieza.js --email-name …` otra vez (es idempotente: recalcula desde los datos) |
| `audiencias.js` dejó el SQL de Vol distinto | no debería: lo restaura solo si SFMC lo guarda distinto; verifica con `node scripts/snapshot.js --comparar <foto anterior>` |
| Quedaron objetos `CRM_Tmp_*` | `node scripts/doctor.js --limpiar-tmp` |
| Duda sobre si algo cambió | `node scripts/snapshot.js --comparar <foto anterior>`: separa lo estructural de lo informativo |

## 7. Cómo se comprueba todo esto

`node --test` corre las pruebas del kit (sin red; simulan SFMC): la guardia permite y niega exactamente lo de la tabla, el redactor no deja pasar un secret, ningún archivo del kit contiene uno,
los scripts de escritura no escriben en simulacro y el código no escribe, borra, lanza procesos ni llama a nada fuera de lo dicho. Un nombre hostil (ESC, texto bidireccional, `$(…)`) no llega crudo a la terminal, a un `--json` ni a un comando sugerido,
y **ningún archivo del kit** (código, guías ni pruebas) lleva caracteres invisibles ni de control bidireccional (el ataque *Trojan Source*: que lo que lees no sea lo que se ejecuta). Antes de usar el kit en otra BU o máquina corre `node scripts/doctor.js`.
