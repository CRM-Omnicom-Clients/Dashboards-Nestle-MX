# Procesos operativos y qué hacer cuando algo falla

Todo se hace con los scripts de `scripts/` (Node ≥ 18). **Casi todos empiezan en modo simulacro**: te muestran qué harían y no escriben nada hasta que agregas `--escribir`.
Si es tu primera vez: `CONEXION.md` y luego `node scripts/conectar.js` y `node scripts/doctor.js`.

## 0. Antes de empezar

- `node scripts/doctor.js` sin ✗. Un ⚠️ no bloquea, pero léelo.
- **No refresques entre las 23:48 y las 00:40 hora Central**: la automation `CRM_Reporte_Diario` corre a las 00:08 y dura ~15 min. `refrescar-pieza.js` se niega solo si la ve corriendo o a menos de 20 min de arrancar.
- Trabaja con el **EmailName exacto** (sección 1). Es la regla que más errores evita.

## 1. Agregar un email nuevo al reporte

**Paso 1 — encontrar el EmailName real.** Con un fragmento del nombre (un código, una campaña, un touchpoint; mínimo 3 caracteres):

```bash
node scripts/resolver-emailname.js "LIGAMX-J9" "0359270"
```

Lista cada nombre real de `_Job` con su `EmailID`, cuántos jobs tiene, su primer y último envío, el asunto, y si **YA ESTÁ en el catálogo** (con su clave) o es **NUEVA**.
Avisa de: copia con sufijo de fecha (es **otro** nombre que el original), nombre de 100 caracteres (SFMC lo truncó: úsalo tal cual) y envíos de prueba.
Un código de asset del brief casi nunca coincide con el nombre real: **búscalo así, no lo supongas**. Tarda de 30 a 90 s (lo domina la carga del motor, no el escaneo). Salida `2` = ningún envío contiene ese texto (negativo real: la consulta terminó y no hay nada).
**Si no aparece**: prueba otro fragmento (una palabra de la campaña, el touchpoint, parte del asunto) o pide al equipo que armó el envío el nombre exacto en SFMC; **no inventes ni adivines** el nombre.
Si ves **dos nombres casi iguales** (uno con el sufijo ` - AAAAMM`), son dos envíos distintos: el sufijo lo pone SFMC a una copia o reenvío. Registra el que quieres reportar, y consulta antes de registrar los dos.
El nombre se imprime tal cual lo guarda SFMC, con una excepción de seguridad: lo **invisible o de control** (ESC, saltos de línea, texto bidireccional, ancho cero, NBSP…) se ve como `\uXXXX`, y un nombre con caracteres que la terminal interpreta (`$`, comillas, `` ` ``, `\`, `!`, `%`, `;`, `|`…) sale con un **⚠️**: pégalo entre comillas **simples**, nunca suelto ni entre dobles.
`agregar-pieza.js` aplica lo mismo y, si el nombre no es seguro entre comillas dobles, no lo copia en los comandos de "Siguiente": pone un marcador y te dice por qué (`SEGURIDAD.md` garantía 8).

**Paso 2 — simulacro del alta.**

```bash
node scripts/agregar-pieza.js --email-name "<EmailName EXACTO>" --marca "Concentrate" --campana "Hackea tu café" --touchpoint "E-Rit1" --inferido touchpoint
```

Valida contra el catálogo vivo y te muestra la fila que insertaría. Lo que revisa y lo que debes saber:

- **Marca, Campaña y BU deben ser EXACTAS** a las que ya existen (sin acento o con otra mayúscula = error con la grafía correcta). **Marca ≠ Campaña**: una campaña puesta como marca se rechaza.
- Si no das `--bu`, se toma la que el catálogo usa para esa marca. El código NC se lee del propio nombre. No hay `PiezaID` (la columna se eliminó el 22-oct-2026).
- `--inferido touchpoint,campana` agrega `*` a lo que **tú infieres** y no sabes seguro. Si aún no se sabe: `"*por definir"`. `--fup` marca un Follow Up.
- Un valor que no existe aún (marca nueva) se rechaza: si es a propósito, `--permitir-valores-nuevos`.
- Un EmailName que **ya está** en el catálogo se rechaza (nunca se duplica ni se pisa). Cambiarle una dimensión a una pieza existente es una corrección, no un alta: **el kit no corrige ni borra filas** (no existe el comando), se hace en la tabla del catálogo en SFMC o por el proceso del normalizador.
- Revisa el simulacro con calma: una fila equivocada **no se puede deshacer desde el kit**. Los valores nuevos (`--permitir-valores-nuevos`) y los `*` de lo inferido son decisiones tuyas; si dudas, pregunta antes de `--escribir`.

**Paso 3 — escribir.** Mismo comando con `--escribir`. Inserta la fila y la **vuelve a leer** para comprobar que quedó idéntica ("Insertada y VERIFICADA").

**Paso 4 — refrescar** (sección 2) o esperar a la corrida de las 00:08.

## 2. Refrescar una pieza y confirmar que aterrizó

```bash
node scripts/refrescar-pieza.js --email-name "<EmailName EXACTO>"
```

Corre las queries del reporte **en el orden de la automation** (vol + links → detalle → piezas → auditoría), cada paso solo cuando el anterior terminó, y confirma **por EmailName**
que la pieza llegó a Detalle, Piezas y Auditoría. ≈ 9 min con el motor sin carga (el paso lento es Detalle: ~7 min); 18 min medidos el 2-oct-2026 con un reintento de Detalle y el motor más lento (Piezas y Auditoría tardaron ~2 min cada una). `--dry-run` muestra el plan sin iniciar nada.

- **Cómo sabe que terminó**: las queries de SFMC no avisan; se mide lo que escriben (cada fila lleva un sello `LastRefresh`/`LastRun`) y *todas* las filas de la pieza deben traer uno posterior al de antes.
- **Lag de propagación**: si acabas de agregarla al catálogo, la primera corrida de Detalle puede no "verla": el 2-oct-2026, con una pieza registrada unas 2 h antes, hizo falta **una segunda corrida** (no es cuestión de minutos de espera). Si la corrida termina y la pieza no aparece, el script la **re-corre solo** (hasta 4 veces en Detalle).
- **Se niega a correr** (salida 3) si la pieza no está en el catálogo o está inactiva, o si la automation está corriendo, arranca en < 20 min o **no se puede leer** (ni su próxima corrida se entiende): sin poder verla no se sabe si hay peligro. `--forzar` salta lo de la automation: **úsalo solo si sabes que está pausada**.
- **Vuelve a mirar la automation antes de iniciar cada query** (un refresco con reintentos puede durar más de una hora): si arrancó a mitad de camino, **se detiene** antes de la siguiente query (salida 3), no deshace lo ya corrido, y basta repetir el comando cuando la automation termine.
- Si falla en Detalle te dice la causa probable con un conteo en `_Sent`: **sin envíos** (¿el nombre es el exacto? ¿aún no sale?), **envíos fuera de la ventana** (el reporte cuenta desde 2026-03-01) o **sí hay envíos** (entonces espera y repite, o revisa el EmailName).

Cuando termina bien muestra la pieza (envíos, aperturas, clicks) y el `Estado` de Auditoría. Debe decir **OK**.

## 3. Audiencias (opcional)

```bash
node scripts/audiencias.js --pendientes            # simulacro: qué piezas con journey no tienen audiencia mapeada
node scripts/audiencias.js --email-name "<EXACTO>" --escribir
```

Resuelve el journey de la pieza con la API de Journey Builder (necesita el scope `journeys_read`), cuenta su tabla de audiencia, registra la fila en `CRM_Audiencias` y agrega esa tabla a la lista de la query Vol.
El SQL nuevo de Vol **se ejecuta primero en una query temporal**; si no corre, no se toca la de producción, y si SFMC lo guarda distinto se restaura el anterior.
**En Nestlé no se usa**: la atribución de audiencia se hace en el proceso de atribución del catálogo; no escribas en `CRM_Audiencias` ni en la query Vol de producción sin pedirlo.
🔴 **Si el email también salió en pruebas, pasa el journey a mano** (`--email-name "<EXACTO>" --journey-uuid <UUID del journey de producción>`, de una pieza a la vez): por defecto el journey sale de `CRM_Email_Piezas.Journey_UUID`, que es un `MAX()` entre todos los journeys que mandaron ese email y se queda con el de PRUEBA si su UUID ordena más alto
(Winback de Nescafé, 27-oct-2026: `E-Zombies-A` mostraba el UUID de `zombies_winback_MX`, el de prueba). `Audience_Volume` es el tamaño ACTUAL de la DE de entrada y cambia cada noche; para los pasos 2 y 3 de una secuencia (solo no-aperturas) sobreestima el alcance.

## 3b. Clicks por link CON FECHA DEL CLICK (`CRM_Email_Links_Dia`, opcional; se instala una vez)

```bash
node scripts/instalar-links-dia.js                  # simulacro: prueba el SQL en una query temporal y dice qué crearía (no escribe nada)
node scripts/instalar-links-dia.js --escribir       # crea la tabla, su query y su automation; la llena; concilia; corre la automation una vez; activa su horario
```

Por qué existe: `CRM_Email_Links` no dice **cuándo** ocurrió cada click, así que el desglose por destino (CTA, baja, redes+navegador+legal) no se puede repartir entre las filas-quincena de una pieza que manda en varias
(el reporte repetía el total de la pieza en todas: +71 % de clicks «medidos», 22-oct-2026). Esta tabla trae `ClickDay` y `SendDay` y quien la consume elige a qué fila lo asigna.

| Qué es | Detalle |
|---|---|
| Grano | `JobID` × `SendDay` × `ClickDay` × link (≈ 11 000 filas el 22-oct-2026); llave `RowKey` = JobID + días + ConfigKey + **hash** de la URL |
| `ClickDay` / `SendDay` | el día del click (`_Click`) y el día en que salió ese correo (`_Sent`, el mismo que usa `CRM_Email_Detalle`). `SendDay` queda **vacío** si el envío ya salió de las vistas de datos (≈ 6 meses) pero el click sigue: el click no se pierde |
| Qué cuadra | sumando `Clicks_Total` por `JobID` + `SendDay` sale `Email_Total_Clicks` del Detalle; sumando todo, el total de `CRM_Email_Links`. `Link_Name` y `Link_URL` salen de la MISMA expresión que la query de Links, así que se clasifican igual |
| Tipo | **Update**: las filas de días que las vistas de datos ya olvidaron se conservan (con un Overwrite se perderían). Por eso conviene instalarla cuanto antes: cada noche sin ella se pierde un día de detalle por link de los envíos más viejos |
| Los tres objetos | la DE `CRM_Email_Links_Dia`, la query `CRM_Email_Links_Dia_Load` y la automation `CRM_Reporte_Links_Dia` (una actividad, diaria a las 00:50 hora Central, **aparte** de `CRM_Reporte_Diario`: si falla no frena el reporte) |

Con `--escribir`, en este orden: prueba el SQL → crea la DE y comprueba su estructura → crea la query y comprueba que SFMC la guardó igual → la corre y espera a que la carga se estabilice → **concilia** (llave única, ningún click antes de su envío,
total contra `CRM_Email_Links`, cada job × día contra el Detalle) → crea la automation **ya con su horario** (nace en `PausedSchedule`) → la corre **una vez** de punta a punta → **activa** su horario. **Si algo falla, borra lo que esa corrida creó** (`--conservar` lo deja para revisarlo). Es idempotente:
si ya está instalado y programado, no hace nada; si la query existe con otro SQL, pide `--actualizar`. La automation propia que ya existe se **borra por SOAP y se vuelve a crear** si apunta a una query que ya no existe, si quedó sin programar (`PausedSchedule`) o si `--hora HH:MM` pide otra hora que la suya;
una que ya está `Scheduled` se respeta tal cual (aunque alguien la haya movido a otra hora) y una que está corriendo no se toca. `--sin-prueba` omite la corrida final.

**Cómo se activa el horario (probado en vivo el 22-oct-2026).** Por la API, SFMC crea **toda** automation en `PausedSchedule`, con o sin `scheduleStatus: "active"` en el cuerpo; `PATCH` (`status`, `statusId`, `schedule`) responde 200 y no cambia nada, y las rutas `/actions/resume|resumeschedule|startschedule|activate` dan 404.
Lo que sí funciona es el endpoint «legacy» que usan Automation Studio y SFMC DevTools: `POST /legacy/v1/beta/bulk/automations/automation/definition/?action=schedule` con `{ id: <id legacy>, scheduleObject: { id: <id del horario> } }` (responde 201 `{ id }`).
El **id legacy** (base64, no el GUID) viene en la respuesta de la CREACIÓN (`legacyId`) —por eso, si una automation propia quedó sin activar, se borra y se vuelve a crear—; el id del horario sale de `GET …/definition/{id legacy}` → `scheduleObject.id`.
Antes de activar nada se comprueba que esa definición legacy es la nuestra (nombre y key) y la guardia exige que ese id esté registrado en la corrida (`docs/SEGURIDAD.md`).
**La corrida única va ANTES de activar el horario**: `POST /automation/v1/automations/{id}/actions/runallonce` solo funciona con la automation en `Ready` o `PausedSchedule` (en `Scheduled` da 400 «wrong status for a run once»), y `…/actions/start` no sirve (pide los pasos y sus actividades en el cuerpo).
Si SFMC no deja correrla, la prueba se **omite y se dice** (la instalación sigue); si corre y termina en `Error`, revierte. Una automation que ya estaba `Scheduled` y se adopta no se puede correr: también se omite.
Si no se puede activar, **no revierte** (la tabla ya está cargada y conciliada): termina con salida 1 y dice cómo activarla a mano (Automation Studio → `CRM_Reporte_Links_Dia` → pestaña Schedule → Active) o que repitas el script, que la borra y la vuelve a crear.

## 4. Foto y respaldo de la arquitectura

```bash
node scripts/snapshot.js                                   # guarda snapshot-<fecha>-<mid>.json en tu carpeta de fotos (imprime la ruta; solo lectura)
node scripts/snapshot.js --con-datos                       # además respalda las FILAS del catálogo y de audiencias
node scripts/snapshot.js --comparar <foto>.json            # ¿cambió algo respecto a esa foto? (basta el nombre: la busca en tu carpeta de fotos)
```

Haz una foto **antes de tocar cualquier cosa** (es el respaldo del SQL y de los esquemas). Con `--con-datos` trae también las filas del catálogo y de audiencias —lo único que **no** se recalcula solo: Detalle, Piezas, Auditoría y Links las reconstruyen sus queries—,
que es el respaldo que exige una migración; **trae datos del cliente: no se sube a git ni se comparte**. `--comparar` separa lo **estructural** (un campo nuevo, un SQL distinto, otros pasos, otra llave primaria; con datos, una fila que **desapareció**)
de lo **informativo** (nº de filas, última corrida, una fila nueva o cambiada).

## 5. Revisión de salud (`doctor.js`)

| Línea | Qué mira |
|---|---|
| Credenciales / Fuentes / Token / Scopes | que te conectes, con qué package, y que no falte ningún permiso |
| Objetos del reporte / Esquema | que las 6 tablas, 5 queries y la automation existan y tengan las columnas que el kit necesita |
| Automation | estado, pasos esperados, última corrida (⚠️ si hace > 36 h que no corre) |
| Frescura de los datos | cuándo se refrescó `CRM_Email_Piezas` |
| Temporales huérfanos | tablas/queries `CRM_Tmp_*` de una corrida interrumpida → `--limpiar-tmp` (solo borra las de ≥ 60 min por defecto) |

`--latencia` mide cuánto tarda el motor con una consulta trivial (normal: 20–60 s). Solo crea y borra objetos temporales si se lo pides.

## 6. Códigos de salida

| Script | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| `conectar.js` | la fuente que usarán los scripts conecta y trae los scopes | no conecta / faltan scopes | — | — |
| `doctor.js` | sin ✗ | hay algún ✗ | — | — |
| `resolver-emailname.js` | hay candidatos | error o la consulta no terminó | ningún envío contiene el texto (negativo real) | — |
| `agregar-pieza.js` | simulacro válido / alta verificada | error o rechazo de validación | el EmailName no existe en `_Job` | ya está en el catálogo |
| `refrescar-pieza.js` | la pieza aterrizó en todo | un paso falló o no terminó | — | rechazado por una precondición (también si la automation arrancó a mitad del refresco) |
| `audiencias.js` | simulacro válido / aplicado / nada pendiente | error o aplicado a medias | — | pieza fuera del catálogo o SQL que no valida |
| `snapshot.js` | foto hecha / estructura idéntica | error | hay diferencias estructurales | — |
| `instalar-links-dia.js` | simulacro válido / instalado y verificado / ya instalado | error | — | rechazado por una precondición, o revertido porque algo no cuadró |

## 7. Cuando algo falla

| Lo que ves | Causa probable | Qué hacer |
|---|---|---|
| `Invalid client ID` / HTTP 401 al conectar | package vencido, borrado o de otro tenant | `CONEXION.md` §6 |
| Una pieza sale `SIN MATCH` en Auditoría | el `EmailName` del catálogo no es el de `_Job`, o aún no tiene envíos | `resolver-emailname.js` con un fragmento; compara con el catálogo |
| Una pieza sale `DUPLICADO` | dos filas del catálogo con el mismo EmailName o el mismo asset | deja una y desactiva (`Activo`) o corrige la otra |
| Una pieza sale `ASSET CAMBIO` | el `EmailID` declarado en el catálogo no es el del envío real: se cambió el creativo o el `EmailID` está mal | confirma con quien armó el envío; si el cambio fue a propósito, corrige el `EmailID` del catálogo (no hay comando: se corrige en la tabla) |
| "No pude leer la automation … Por seguridad no refresco" | falta el permiso `automations_read` del package o SFMC no respondió | `node scripts/conectar.js` y `CONEXION.md` §6; solo si sabes que la automation no corre, repite con `node scripts/refrescar-pieza.js --email-name … --forzar` |
| `Audience_Volume` en 0 | la audiencia de ese journey no está mapeada | `audiencias.js --pendientes` (si tu proceso lo requiere) |
| Piezas/Detalle muestran un `Journey_Name` de PRUEBA (`TEST_…`, `zombies_winback_MX`) o un `Journey_UUID` que no es el real | el email salió también en journeys de prueba (o el journey cambió de nombre) y las queries toman el `MAX()` del nombre y del UUID | no hay comando: el dato viene así de SFMC. Para mapear audiencia usa `audiencias.js --journey-uuid` con el journey real. Arreglarlo de raíz exige cambiar la query de Detalle/Piezas (elegir el journey con más envíos) y necesita OK del dueño del reporte |
| "la query TERMINO pero la pieza no aparece" | lag de propagación del catálogo, o la pieza no tiene envíos en la ventana | el script re-corre solo; si agota intentos, lee el diagnóstico que imprime |
| "no vi evidencia de que terminara" | motor lento o la query falló | `doctor.js --latencia`; revisa la query en Automation Studio |
| "La automation … está CORRIENDO" | refrescar ahora pisaría sus queries | espera a que termine (≈ 15 min) |
| "El nombre real en _Job es …" | escribiste el nombre con otra capitalización | usa el nombre exacto que te muestra |
| "… es una CAMPAÑA que ya existe en el catálogo, no una marca" | marca y campaña cruzadas | corrige `--marca` / `--campana` |
| `Marca "…" no coincide con el catálogo; existe como …` (lo mismo para Campaña y BU) | otra ortografía o sin acento | escríbelo EXACTO como lo muestra |
| `Temporales huérfanos` en el doctor | una corrida se interrumpió | `node scripts/doctor.js --limpiar-tmp` |
| `Config inválida … empieza con el prefijo temporal` | un objeto del reporte se llama `CRM_Tmp_…` | renombra el objeto o cambia `prefijoTemporales` en la config |
| `Hay packages DISTINTOS en varias fuentes` | dos credenciales distintas configuradas | `CONEXION.md` §6 (`SFMC_FUENTE`) |
| `instalar-links-dia.js`: «NO quedó instalado … NO cuadra» | la tabla cargada no concilia (llave repetida, click antes del envío, total o job × día distintos) | el mensaje dice cuál; ya revirtió. Revisa si hubo una carga grande en curso y repite |
| `instalar-links-dia.js`: «Casi: … NO pude activar su horario» (salida 1) | la automation existe pero quedó en `PausedSchedule`: el endpoint legacy no la activó (o no devolvió su id legacy); la tabla y la query ya están cargadas | actívala a mano (Automation Studio → `CRM_Reporte_Links_Dia` → Schedule → Active) o repite el script: la borra y la vuelve a crear |
| `instalar-links-dia.js`: «Se DEJARON la query y la DE» | al revertir no se pudo borrar la automation (SFMC no deja por REST; el SOAP también falló) | bórrala a mano en Automation Studio y repite el script |
| `instalar-links-dia.js`: «No reconozco la query de Links vigente» | alguien reescribió `CRM_Email_Links_Load` | actualiza `extraerExpresiones` en `lib/linksdia.js`; no se instala nada mientras tanto |

**Mensajes de SFMC que conviene reconocer** (aparecen al extender el kit, no en el uso normal):

- `Incorrect syntax near the keyword 'SELECT'` al crear una query → SFMC **no acepta un comentario (`/* */` o `--`) dentro de una subconsulta**. El envoltorio de `lib/de.js` ya los quita; si escribes una query a mano, no los pongas dentro de subconsultas.
- `Update Type must be 'Update' or the target data extension … cannot appear in the query` → una query **Overwrite** no puede leer su propia tabla destino.
- `Field name cannot begin with an underscore` → SFMC rechaza nombres de campo que empiezan con `_` (el valor sí puede).
- Crear una query **valida su sintaxis al instante**: sirve para probar un SQL sin ejecutarlo.

## 8. Lo que NO se hace sin permiso explícito

Escribir en `CRM_Audiencias` o en el SQL de la query Vol de producción · instalar la tabla de clicks con fecha (`instalar-links-dia.js --escribir`) · cambiar pasos u horario de `CRM_Reporte_Diario` (se hace en Automation Studio) ·
recrear tablas (la migración a EmailName como PK) · borrar columnas de las tablas del reporte · editar el SQL de las queries de Piezas, Auditoría, Detalle o Links · tocar `conexion.txt`. Reglas completas y por qué: `SEGURIDAD.md`.

## 9. Bitácora: cambios de esquema hechos fuera del kit (con permiso expreso de Rick)

**22-oct-2026 — se eliminó la columna `PiezaID`** del catálogo (`CRM_Reporte_Config`), de `CRM_Email_Piezas` y de `CRM_Reporte_Auditoria` (Rick lo pidió el 21-ago y otra vez el 22-oct), y en el mismo paso la query de Piezas pasó a **rellenar** `Audience_DE` / `Audience_Volume`
desde `CRM_Audiencias` cuando el Detalle no los trae (arregló `001-P005` y `001-P006`: 56,902). No es una capacidad del kit —su guardia sigue sin permitir editar esas queries ni borrar columnas—: fue una operación de una vez, con un script de una sola
corrida cuya guardia se acotó a exactamente eso. Orden y por qué (el reporte nunca queda roto entre pasos):
1. **Respaldo**: `node scripts/snapshot.js --con-datos` (esquemas, SQL de las 5 queries y las filas del catálogo y de audiencias). El del 22-oct es `snapshot-2026-10-22_1950-10966050.json`; trae el `PiezaID` de cada fila del catálogo.
2. **No hacerlo cerca de la automation**: se negó a escribir si faltaban menos de 90 min para las 00:08.
3. **Probar los SQL nuevos en queries temporales** y compararlos columna por columna con lo vivo: Piezas dio las mismas 140 filas (solo las 4 audiencias rellenadas) y Auditoría las mismas 142. Si algo difería, no se tocaba nada.
4. **PATCH de las dos queries** (Piezas, Auditoría) y relectura: SFMC tenía que guardar el SQL idéntico al probado (si no, se restauraba el original). Con las queries ya sin `PiezaID`, la tabla destino puede conservar la columna sin romperse.
5. **Borrar el campo** en Piezas, Auditoría y catálogo: SOAP `Delete` de `DataExtension` con `<Fields><Field><ObjectID>…</ObjectID></Field></Fields>` (el ObjectID del campo, leído justo antes; **no** el CustomerKey: eso no borra nada). SFMC contesta «Data Extension Fields deleted.» y **no toca los datos de las demás columnas** (probado antes en una DE temporal con filas).
   `DELETE …/customobjects/{id}/fields/{fieldId}` por REST da 404.
6. **Refrescar** Detalle → Piezas → Auditoría con `refrescar-pieza.js` (o la lib) y confirmar que aterrizó. Para volver atrás: agregar el campo `PiezaID` (Text 30) a las tres DEs, restaurar el SQL de las dos queries desde el respaldo y recargar el catálogo desde el respaldo.
