# Migración: `EmailName` como llave primaria — plan (NO ejecutada)

> **Estado al 2-oct-2026: plan verificado hasta donde se puede sin tocar producción; NO ejecutado.** Rick lo dejó para después ("lo vemos luego").
> Para ejecutarlo hacen falta tres cosas: **(1)** su OK explícito y una fecha, **(2)** las decisiones de la §9, **(3)** las herramientas de la §8. El kit **no trae** un script de
> migración y su guardia de escritura (`lib/guardia.js`) **prohíbe a propósito** crear o borrar las DEs del reporte y editar sus queries (salvo Vol). Nadie debe saltarse eso "para ir más rápido", **ni hacerlo a mano en la UI de SFMC**: borrar una de estas tablas es irreversible, y Detalle guarda historia que SFMC ya no puede regenerar (§3.2).
> Lo que sí se midió está marcado ✅ con su evidencia; lo que no, ⚠️. Las cifras llevan fecha: **si algo no coincide con lo que ves, gana lo que ves** (`snapshot.js --comparar`).
>
> **Actualización del 22-oct-2026 — léela antes de usar §3.1, §5, §6 y §9.** (1) **`PiezaID` ya no existe**: Rick pidió eliminarla (21-ago y otra vez el 22-oct) y se borró el campo del catálogo, de Piezas y de Auditoría.
> Donde este plan dice «`PiezaID` se conserva» (§3.1, §5, §9.3) quedó **superado**: no hay nada que conservar ni recargar. (2) Las queries **Piezas** y **Auditoría** cambiaron (Piezas: sin `PiezaID` y con la audiencia de `CRM_Audiencias` cuando el Detalle no la trae;
> Auditoría: sin `PiezaID`; hashes SHA-256 de su SQL `c7bafdf2fd…`→`16a03a72e7…` y `13e8f1f155…`→`4c96d9bc59…`), así que **los bloques `diff-sql` de la §6 para esas dos ya no encajan con el SQL vivo** (las líneas se movieron): regenéralos contra el SQL vivo
> antes de ejecutar nada (siguen encajando con la foto del 2-oct que usan las pruebas). (3) El borrado de un campo se hizo por SOAP (`Delete` de `DataExtension` con `<Fields><Field><ObjectID>…`, ObjectID del campo verificado) con un respaldo `snapshot.js --con-datos` previo y una prueba previa de los SQL nuevos en queries temporales; borrar un campo **no toca los datos de las demás columnas** (probado en una DE temporal). Detalle en `docs/PROCESOS.md` §9.

## 1. Qué es y por qué

Hoy el catálogo (`CRM_Reporte_Config`) y tres tablas de salida tienen como llave primaria `ConfigKey`: una clave **interna** (`TMP-…` o una numeración vieja) que ya no identifica nada.
La identidad real de una pieza es su **`EmailName`** (el nombre exacto de `_Job`; regla 1 de `SKILL.md`). Meta: **una sola identidad, `EmailName`, en todas las tablas**.

SFMC no permite cambiar la llave primaria de una DE ya creada (lo documenta Salesforce; ⚠️ no se probó aquí porque la guardia no deja editar DEs). Por eso las DEs con PK `ConfigKey` hay que **recrearlas**.

El kit ya está preparado de su lado: detecta el modo (`configkey` | `emailname`) mirando la PK real de la DE (`lib/esquema.js`, con pruebas), así que `agregar-pieza.js`, `audiencias.js` y `refrescar-pieza.js`
siguen funcionando antes **y** después. Lo que falta es lo de abajo.

## 2. Qué se hace con cada tabla

> Las filas de esta guía se midieron la **mañana** del 2-oct-2026. Esa tarde se refrescó la pieza ERIT1 y quedaron en Detalle 754 · Piezas 112 · Auditoría 113 · Links 983. **Vuelve a medir antes de migrar** (`node scripts/snapshot.js --con-datos`): las comprobaciones de abajo dicen "o más", no un número fijo.

| Tabla | Filas (2-oct mañana) | PK hoy → nueva | Acción | Por qué |
|---|---:|---|---|---|
| `CRM_Reporte_Config` (catálogo) | 113 | `ConfigKey` → `EmailName` | **Recrear** (mismo nombre, misma CustomerKey) y **recargar** del respaldo | 🔴 Es la única tabla cuyos datos no se recalculan en ninguna parte |
| `CRM_Audiencias` | 99 | `ConfigKey` → `EmailName` | **Recrear** y recargar (`ConfigKey`→`EmailName` vía el catálogo del respaldo) | Mapa Journey/Audiencia hecho a mano; el volumen lo recalcula Vol |
| `CRM_Email_Piezas` | 111 | `ConfigKey` → `EmailName` | **Recrear vacía**; la llena su query | Se recalcula entera (Overwrite) desde Detalle + catálogo |
| `CRM_Reporte_Auditoria` | 112 | `ConfigKey` → `EmailName` | **Recrear vacía**; la llena su query | Se recalcula entera (Overwrite) desde catálogo + Piezas |
| `CRM_Email_Detalle` | 752 | `RowKey` (igual) | 🔴 **NO tocar la tabla**; solo cambia su query | Guarda historia que SFMC **ya no puede regenerar** (§3.2) |
| `CRM_Email_Links` | 980 | `RowKey` (igual) | No se recrea; cambia su query (la RowKey pasa a `EmailName\|URL`) | Overwrite: la primera corrida la reescribe entera |

## 3. Hechos medidos (2-oct-2026)

**3.1 Los datos caben en la llave nueva ✅** (respaldo `snapshot.js --con-datos` de las 14:46, lectura en vivo).
Catálogo: 113 filas, todas `Activo=Si` y `Estado=Confirmado`. `EmailName`: 113 únicos (también sin distinguir mayúsculas, que es como compara la PK), ninguno vacío, ninguno con espacios en los bordes,
máximo 100 caracteres (el tope de `_Job`; la columna admite 200). `ContentName == EmailName` en 113 de 113: se puede quitar sin perder nada. `ConfigKey`: 113 únicas, máximo 23 caracteres, 25 empiezan con `TMP-`.
`PiezaID` (2-oct): 76 filas llevaban la numeración de Rick (`NNN-Pn`, sin duplicados) y 37 decían `*por definir`; ~~«PiezaID NO se quita»~~ → **superado: Rick pidió eliminarla y se eliminó el 22-oct-2026**. Audiencias: 99 filas, todas con pieza en el catálogo (0 huérfanas),
14 piezas del catálogo sin fila de audiencias, y ningún `EmailName` quedaría con dos filas.

**3.2 Detalle guarda historia irrecuperable ✅.** Detalle tiene 752 filas (por mes de envío: mar 6 · abr 70 · may 66 · jun 62 · jul 147 · ago 255 · sep 145 · oct 1). De sus **8 JobID más viejos, 6 ya no tienen
ningún evento en `_Sent`** (envíos del 14 al 20 de marzo, de 5,397 a 37,374 envíos cada uno); los 2 del 13 de abril sí. Es lo esperable con la retención de unos 6 meses de las data views de SFMC, así que Detalle **no se puede reconstruir**:
si se borrara, o se pasara a Overwrite, esas filas (y las de las próximas semanas, conforme venzan) se perderían para siempre. Por eso su query es `Update` (upsert por `RowKey`). Medido con una consulta temporal por `JobID`.

**3.3 Las DEs son simples de recrear ✅.** Las 6: sin descripción, no sendables, no testables, **sin política de retención**, carpeta 445199. Recrear una solo necesita nombre, CustomerKey, carpeta y esquema
(el respaldo trae los esquemas completos: tipos, largos, PK, orden).

**3.4 Ensayo con objetos temporales ✅** (`CRM_Tmp_*`, bajo la guardia, se borraron solos; 0 quedaron). Las dudas que decidían el procedimiento:

| Prueba | Resultado medido |
|---|---|
| Recrear una DE **con el mismo nombre y la misma CustomerKey** (otra PK) tras borrarla | **Inmediato** (1 intento, 1 s). SFMC conservó la CustomerKey pedida |
| Una query que apuntaba a la DE borrada, **sin tocarla**, tras recrearla | **Funciona**: SFMC liga la query por CustomerKey (el `targetId` que reporta cambió solo al ID nuevo) y cargó las 3 filas |
| **Re-apuntar** una query a otra DE por `PATCH` (`targetName` + `targetKey`) | **Funciona** (HTTP 200); cargó en la DE nueva y dejó la vieja intacta |
| `HASHBYTES` en el SQL de SFMC | Existe (devuelve 40 hex). Ojo: hashea el texto como Unicode, no da el SHA1 "de libro" |

Consecuencia: **recrear cada DE con su misma CustomerKey deja intactas las queries, la automation y tu config local `pipeline.config.json`** (que guarda esas CustomerKey). No hace falta re-apuntar nada.

**3.5 La RowKey de Links crece ✅ (simulado con los datos reales).** Hoy es `ConfigKey|URL` (tope 400). Con `EmailName` (hasta 100) en vez de `ConfigKey` (hasta 23): la RowKey más larga hoy mide 382;
con la nueva medirían más de 400 **20 de 980 filas** (máximo 429: `EmailName` de 62 + URL de 366). `LEFT(…, 400)` les corta solo la cola `…JobSubscriberBatchID%%` (idéntica en todas) y **no provoca ninguna colisión**
(0 colisiones con tope 400; con tope 300 habría 2, con 250 habría 6). Es aceptable hoy, pero es frágil: tras migrar se verifica `COUNT(*)` de Links y se decide la variante con hash (§9.2).

**3.6 Columnas vestigiales ✅.** `Email_Content_Name` está vacía en las 112 filas de Auditoría y en las 980 de Links (ninguna query la escribe ya); en Detalle tiene valor en 528 de 752 (historia: el último `SendDay` con valor es el 20-ago).
`ConfigKey` hoy está llena en las 752 de Detalle y en las 980 de Links; tras migrar **dejará de escribirse** (las filas viejas la conservan, las nuevas la traen vacía).

## 4. ⚠️ Quién más lee estas tablas (lo que más se puede romper)

Cambiar las DEs no es solo un cambio de SFMC: **todo lo que lea la columna `ConfigKey` de Piezas, Detalle o Links se queda sin ella — y la mayoría de esos lectores no fallan: agrupan todo en una sola fila vacía.**
Medido en la instalación de Rick (2-oct-2026, líneas de **código** que mencionan `ConfigKey`, sin comentarios ni volcados): **38 archivos** —

| Dónde | Archivos | Qué son |
|---|---:|---|
| `~/.claude/reportes-backend/nestle/_scripts/` | 22 vivos (+ 6 en `_aplicados/`) | El motor de reportes de Rick. Lee los volcados `sfmc-piezas/detalle/links-<fecha>.txt`; ejemplos verificados: `lib-fechas-envio.js` traduce `ConfigKey`→`EmailName` leyendo Detalle y Piezas, `fuentes-email.refrescar-volcado.js` indexa las filas por `r.ConfigKey`, `fuentes-insumos.refrescar-metricas.js` usa `ConfigKey` como llave de `sfmc-piezas`, `resumen.piezas-por-quincena.js` filtra Detalle por `ConfigKey` |
| `~/.claude/tools/_mcp-sfmc/scripts-nestle/` | 10 | Los scripts viejos que **este kit reemplaza** (`add-pieza.js`, `refrescar-pieza.js`, `fix-piezaid.js`…): no deben seguir usándose |

El volcador (`fuentes-email.volcar-sfmc.mjs`) trae las columnas que existan, así que **no avisará** de que `ConfigKey` ya no está. Cualquier otro consumidor que no se vea desde aquí (Excel, Power BI, Datorama, conectores) también hay que inventariarlo:
`grep -rln "ConfigKey" <tus carpetas de scripts>` y preguntar quién lee esas tablas. **Este plan no modifica nada de lo anterior.**

## 5. Esquemas finales

Regla: se quita `ConfigKey` (y `ContentName` del catálogo, `Email_Content_Name` de Auditoría) y la PK pasa a `EmailName` (Text 200, obligatoria, primera columna). Todo lo demás queda **igual** (tipo, largo, nombre).

| Tabla | Columnas hoy → después | Se quitan |
|---|---|---|
| Catálogo | 16 → 14 | `ConfigKey`, `ContentName` |
| Audiencias | 5 → 5 (`ConfigKey` se cambia por `EmailName`) | `ConfigKey` |
| Piezas | 35 → 34 | `ConfigKey` |
| Auditoría | 17 → 15 | `ConfigKey`, `Email_Content_Name` |
| Detalle · Links | sin cambio (PK `RowKey`) | — (`ConfigKey` y `Email_Content_Name` quedan vestigiales; se pueden borrar luego, ⚠️ no se probó borrar un campo de una DE con filas) |

## 6. Cambios de SQL — el mapa exacto (Opción A: solo `EmailName`)

Cada bloque es la lista **completa** de cambios de una query: `@@ L<n>` es la línea donde empieza el cambio **en el SQL del 2-oct-2026**, `-` lo que hay y `+` lo que pasa a haber (sin `+` = se borra).
Se compara ignorando los espacios sobrantes. `tests/docs.test.js` verifica que cada línea `-` exista tal cual, en esa línea, en la foto E0 (`tests/fixtures/arquitectura-nestle-2026-10-02.json`): **si alguien edita una query, la prueba lo avisa antes de que este mapa mienta.**
Tras aplicarlos, ninguna de las 5 queries menciona `ConfigKey` ni `ContentName`.

```diff-sql CRM_Audiencias_Vol_Load
@@ L2
- SELECT m.ConfigKey AS ConfigKey, m.Journey_UUID AS Journey_UUID, m.Audience_DE AS Audience_DE, ISNULL(cnt.N,0) AS Audience_Volume, GETDATE() AS LastRefresh
+ SELECT m.EmailName AS EmailName, m.Journey_UUID AS Journey_UUID, m.Audience_DE AS Audience_DE, ISNULL(cnt.N,0) AS Audience_Volume, GETDATE() AS LastRefresh
```

```diff-sql CRM_Email_Detalle_Load
@@ L17
-     MAX(c.ConfigKey)                            AS ConfigKey,
@@ L34
-         delata cuando dos ConfigKey distintos apuntan al mismo correo. NO es llave: el
+         delata cuando dos EmailName distintos apuntan al mismo correo. NO es llave: el
@@ L143
-        LEFT  JOIN CRM_Audiencias au ON au.ConfigKey = c.ConfigKey
+ LEFT  JOIN CRM_Audiencias au ON au.EmailName = c.EmailName
```

```diff-sql CRM_Email_Piezas_Load
@@ L7
-     d.ConfigKey                         AS ConfigKey,
+     c.EmailName                         AS EmailName,
@@ L9
-     MAX(d.EmailName)           AS EmailName,
@@ L48
- JOIN CRM_Reporte_Config c ON c.ConfigKey = d.ConfigKey
+ JOIN CRM_Reporte_Config c ON c.EmailName = d.EmailName
@@ L50
-     SELECT j.EmailID AS Asset, COUNT(DISTINCT c.ConfigKey) AS NPiezas
+     SELECT j.EmailID AS Asset, COUNT(DISTINCT c.EmailName) AS NPiezas
@@ L56
- GROUP BY d.ConfigKey
+ GROUP BY c.EmailName
```

```diff-sql CRM_Reporte_Auditoria_Load
@@ L5
-     DUPLICADO: dos piezas del catalogo con el MISMO ContentName. El dato se atribuye
-     a una sola por la PK; la otra no es una falla, es un duplicado que hay que resolver
-     en el catalogo. Sin este estado se veria igual que una pieza que de verdad falta.
+     DUPLICADO: dos piezas del catalogo que apuntan al MISMO asset (EmailID). Es un duplicado
+     que hay que resolver en el catalogo; sin este estado se veria igual que una pieza que falta.
@@ L11
-     c.ConfigKey                                  AS ConfigKey,
@@ L26
-          WHEN ISNULL(p.N_Jobs, 0) = 0
-               AND EXISTS (SELECT 1 FROM CRM_Email_Piezas p2
-                           JOIN CRM_Reporte_Config c2 ON c2.ConfigKey = p2.ConfigKey
-                           WHERE c2.EmailName = c.EmailName)
-                                        THEN 'DUPLICADO'
@@ L41
-        ON p.ConfigKey = c.ConfigKey
+        ON p.EmailName = c.EmailName
```

```diff-sql CRM_Email_Links_Load
@@ L5
-     LEFT(c.ConfigKey + '|' + RTRIM(k.URL), 400)  AS RowKey,
+     LEFT(c.EmailName + '|' + RTRIM(k.URL), 400)  AS RowKey,
@@ L6
-     MAX(c.ConfigKey)                             AS ConfigKey,
@@ L53
- GROUP BY c.ConfigKey, LEFT(RTRIM(k.URL), 500), LEFT(c.ConfigKey + '|' + RTRIM(k.URL), 400)
+ GROUP BY c.EmailName, LEFT(RTRIM(k.URL), 500), LEFT(c.EmailName + '|' + RTRIM(k.URL), 400)
```

Notas del mapa:
- **Piezas L7/L56 usan `c.EmailName` (el del catálogo), no `d.EmailName`**: así la PK de Piezas es idéntica, carácter por carácter, a la del catálogo (en los datos de hoy coinciden en las 752 filas de Detalle).
- **Auditoría L26–L30 se borra entera**: era el estado `DUPLICADO` de "dos filas del catálogo con el mismo nombre". Con `EmailName` como PK eso **no puede ocurrir**, así que la rama es código muerto. El otro `DUPLICADO` (dos piezas distintas en el mismo asset, `Piezas_Mismo_Asset > 1`) se queda.
- **El mapa no cambia `RowKey` de Detalle** (`JobID_AAAAMMDD`): por eso Detalle conserva sus 752 filas y su historia.
- Vol cambia solo en L2, pero **`audiencias.js` ya lo regenera con la PK que tenga la tabla** (`lib/audiencias.js` usa la PK real de `CRM_Audiencias`): tras migrar, el siguiente alta de audiencia produce la versión `EmailName` sola.

### 6.1 Ensayo de los SQL nuevos ✅ (2-oct-2026)

Cada query se corrió **dos veces, a la vez y sobre las mismas entradas**, en tablas temporales (`CRM_Tmp_*`; no se tocó ninguna tabla ni query de producción): la **vieja** (el SQL de producción tal cual, con el esquema de producción) y la **nueva**
(el SQL tras aplicar el mapa de arriba, con el esquema final de la §5: PK `EmailName`, sin `ConfigKey`). SFMC aceptó los 10 SQL al crearlos (la creación ya valida la sintaxis). Luego se compararon fila por fila y columna por columna:

| Query | Filas (nueva = vieja) | Columnas comparadas | Resultado |
|---|---:|---:|---|
| Vol | 99 | 4 | idénticas |
| Detalle | 748 | 35 | idénticas |
| Piezas | 111 | 33 | idénticas |
| Auditoría | 113 | 14 | idénticas, con el mismo `Estado` (109 OK · 2 ASSET CAMBIO · 2 SIN MATCH) |
| Links | 983 | 11 | idénticas; la RowKey nueva es exactamente `EmailName\|URL` cortada a 400, **983 únicas (0 colisiones)** y `Clicks_Total` 117,058 = 117,058 |

Se validó también el **método**: la query vieja recién corrida reproduce la tabla de producción (Piezas: 111 filas idénticas en 34 columnas; Auditoría: idénticas salvo la fila de la pieza ERIT1, dada de alta hoy después de la corrida de las 00:08).
Las tablas que dependen de eventos en vivo (Links, Detalle) difieren de producción solo en lo esperable —clicks y aperturas posteriores a las 00:08, y las 6 filas de marzo de Detalle que ya no se pueden regenerar (§3.2)—:
por eso la comparación que cuenta es **nueva contra vieja, a la vez**. Duró ≈8 min (Detalle tarda 7).

Lo que este ensayo **no** prueba (§11): la carga de filas por SOAP a las DEs recreadas, el borrado y la creación de las DEs de producción, el `PATCH` de las queries de producción y que la automation corra con ellas.

## 7. Procedimiento del día (≈45 min; **NO es un runbook que puedas ejecutar hoy**: describe lo que hará la herramienta de la §8, que aún no existe)

**Antes** (cualquier día anterior):
1. Decisiones de la §9 tomadas y lectores de la §4 revisados.
2. `node scripts/doctor.js` en verde y `node scripts/snapshot.js --con-datos` → el respaldo (esquemas, SQL **completo**, automation y las filas del catálogo y de audiencias).
   Comprueba que dice 113 y 99 filas (o las de ese día), **guárdalo fuera del repo** (trae datos del cliente) y corre `node scripts/snapshot.js --comparar <ese archivo> --con-datos`: debe salir idéntica.
3. Que los hashes de las 5 queries en vivo coincidan con los de este mapa (`snapshot.js --comparar` contra la foto E0 del fixture). Si no coinciden, **el mapa de la §6 hay que revalidarlo antes** (las pruebas `docs.test.js` lo detectan).
4. Elegir la ventana: **fuera de 23:48–00:40 hora de la cuenta** (la automation arranca a las 00:08 y dura ≈15 min; es la misma ventana de `PROCESOS.md` §0) y sin que nadie ejecute `refrescar-pieza.js` ni `audiencias.js`. El kit no pausa automations; si la ventana se acerca a las 00:08, la pausa Rick en la UI.

**El día** (en este orden; el punto de no retorno es el paso 6):
5. `node scripts/doctor.js` otra vez: automation no corriendo, 0 temporales.
6. Catálogo y audiencias: **borrar** la DE y **crearla** con el mismo nombre, la misma CustomerKey, la carpeta 445199, no sendable y el esquema nuevo (§5); **cargar** las filas del respaldo (catálogo: sin `ConfigKey` ni `ContentName`; audiencias: `EmailName` sale del catálogo del respaldo). Lo mismo con Piezas y Auditoría, pero **vacías**.
7. **Parchear las 5 queries** con los SQL nuevos (§6) y **verificar** que SFMC guardó el texto enviado (el kit ya hace esa verificación con Vol).
8. Iniciar las queries en el orden de la automation —Vol + Links → Detalle → Piezas → Auditoría— y esperar cada paso (Detalle tarda ≈7 min).
9. **Verificar** (§7.1) y, solo entonces, avisar a quien consuma las tablas.

### 7.1 Cómo se verifica que quedó bien
- `node scripts/snapshot.js --con-datos --comparar <respaldo>`: las únicas diferencias **estructurales** esperadas son las 4 PK, los campos quitados de la §5 y los 5 SQL; en datos: `113 -> 113 filas · 0 desaparecidas · 0 cambiadas · 0 nuevas` (catálogo, sobre 14 columnas comunes) y `99 -> 99` (audiencias).
- Piezas: mismo número de filas que antes (+ las piezas con envíos nuevos) y las métricas por `EmailName` iguales a las previas (el ensayo de §6.1 ya demostró que los SQL nuevos dan lo mismo).
- Auditoría: la misma distribución de `Estado` (hoy: 109 OK · 2 ASSET CAMBIO · 1 SIN MATCH, sobre 112 filas) más el catálogo nuevo.
- Links: `COUNT(*)` ≈ 980 y **ninguna** RowKey duplicada; sumas de `Clicks_Total` y `Clicks_Unique` iguales a las de antes.
- Detalle: **752 filas o más** (nunca menos: perder una es perder historia).
- `node scripts/doctor.js` dice que el esquema es `emailname`; `node scripts/agregar-pieza.js --email-name "<un EmailName ya existente>" --marca … --campana … --touchpoint …` rechaza el duplicado (salida 3), y con un EmailName nuevo el simulacro muestra la fila sin `ConfigKey`.

## 8. Lo que falta construir antes de ejecutar (hoy NO existe)

| Qué | Estado | Nota |
|---|---|---|
| `scripts/migracion-ensayo.js` | El ensayo de §6.1 se hizo con un script suelto; falta dejarlo en el kit | Solo usa objetos temporales: **no necesita** tocar la guardia |
| `scripts/migrar-llave.js` (+ `--revertir <respaldo>`) | No existe | Simulacro por defecto; `--ejecutar` pide la fecha; se niega si la automation corre, si estamos a menos de 30 min de su hora, o si el SQL en vivo ya no es el del respaldo. Es el único código con permiso de borrar/crear las 4 DEs y editar las 5 queries, y solo mientras migra |
| Excepción **acotada y temporal** en la guardia | No existe | Una guardia aparte (modo migración) que solo nombra **esas** 4 DEs y **esas** 5 queries; la normal sigue prohibiéndolo. Cada operación nueva va con su prueba |
| Lectores de la §4 | No son del kit | Hay que migrarlos a `EmailName` (o elegir la Opción B de la §9.1) **antes** |

## 9. Decisiones que necesita Rick

1. **Qué pasa con los lectores de `ConfigKey` (§4).**
   - **A — `EmailName` solo** (lo que pediste: "todo conectado con EmailName, ConfigKey no lo usamos"). Es lo que describe esta guía. Exige migrar antes los ~22 scripts vivos del motor de reportes, porque si no leerán `ConfigKey` vacío **sin fallar**.
   - **B — puente**: el catálogo conserva `ConfigKey` como columna **normal** (ya no PK), las queries siguen escribiéndola y solo cambian las líneas que la usan para unir/agrupar (todas las de la §6 salvo los borrados de `ConfigKey`: Detalle L17, Auditoría L11, Links L6, y Piezas L7 que además la devolvería). Los lectores viejos siguen andando mientras se migran; después se hace la Opción A. Cuesta una migración más y que `agregar-pieza.js` siga escribiendo la `ConfigKey` mientras exista la columna (cambio de 3 líneas en `esquema.js` + su prueba).
   - Recomendación: **B si no vas a migrar el motor de reportes antes; A si ya lo migraste.**
2. **RowKey de Links** (§3.5): `EmailName|URL` tal cual (simple; 20 filas largas cortadas, 0 colisiones hoy) **o** `EmailName` + hash de la URL (`LEFT(c.EmailName,100) + '|' + CONVERT(varchar(40), HASHBYTES('SHA1', RTRIM(k.URL)), 2)`: nunca se corta ni colisiona, pero la RowKey deja de ser legible). Recomendación: la simple, con la verificación de §7.1.
3. **`PiezaID`**: ~~conservarla~~ → **ELIMINADA el 22-oct-2026** (Rick lo había pedido el 21-ago y se le recomendó conservarla: fue un error ir contra su instrucción). `ContentName`: quitarla (idéntica a `EmailName` en 113/113).
4. **Columnas vestigiales** de Detalle y Links (`ConfigKey`, `Email_Content_Name`): dejarlas (recomendado; son inocuas) o borrarlas después.
5. **La fecha y la hora**, fuera de 23:48–00:40.

## 10. Reversa

Antes del paso 6 **no se ha cambiado nada**: basta con no seguir. Después, el respaldo trae todo lo necesario: los **esquemas viejos** (`des.<tabla>.campos`: tipo, largo, PK, orden), los **SQL viejos completos** (`queries.<query>.queryText`) y las **filas** del catálogo y de audiencias.
Revertir es el mismo procedimiento al revés: recrear las 4 DEs con su esquema viejo (misma CustomerKey), recargar catálogo y audiencias, volver a poner los SQL viejos y correr la cadena (Piezas y Auditoría se regeneran solas; Detalle y Links no se tocaron).
Lo único que **no** vuelve es lo que se escribió en Detalle entre la migración y la reversa (sin `ConfigKey`): es inocuo para el reporte, pero los lectores de la Opción A no lo habrían tenido.

## 11. Lo que NO se verificó

- La migración **en producción**: nunca se ejecutó (por decisión de Rick).
- Que SFMC no permita cambiar la PK de una DE existente (documentado por Salesforce, no probado: la guardia no deja editar DEs).
- Borrar un campo de una DE con filas (no hace falta en este plan: las DEs con PK nueva se recrean y las otras dejan sus columnas vestigiales).
- Recrear con una CustomerKey en forma de GUID y con el volumen de producción (el ensayo usó claves de texto y 3 filas; el comportamiento medido —misma clave conservada, queries que la siguen— no depende de eso, pero no se midió).
- Consumidores fuera de lo que se ve desde este equipo (Excel, Power BI, Datorama, conectores).
- Que ninguna relación de Contact Builder / Data Designer use estas DEs (no son sendables; no se revisó la UI).
