# HANDOFF · Reporte Consolidado de Nestlé (CRM)

> **Para quien lo tome sin haber estado en las sesiones.**
>
> 🆕 **Actualizado el 4-nov-2026 — en lo que toca al CATÁLOGO.** La **Parte A** (abajo) cuenta qué se
> hizo y se decidió en el catálogo entre el 29-oct y el 4-nov: la llave de las piezas, la hoja nueva
> `Catalogo_Links`, los estados de celda y la limpieza. **Es lo más nuevo y manda sobre lo demás.**
>
> **Todo lo que viene después de la Parte A (§1 en adelante) se midió el 8-sep-2026** y NO se volvió a
> medir el 4-nov, salvo donde dice lo contrario. Donde una sección vieja contradice a la Parte A, **gana
> la Parte A**, y la sección lo dice con un aviso 🆕.
>
> **Autor de las decisiones: Ricardo Aguilar (Rick).** Nada de lo que dice «decisión» aquí se
> dedujo — se lo dijo él a un agente, y por eso se puede citar.

### Dónde se trabaja (esto antes vivía en `PROCEDENCIA.md`, que se eliminó el 4-nov-2026)

| | |
|---|---|
| **Se trabaja en** | 💻 **LA COMPUTADORA de Rick** — la cadena no corre en la nube (necesita el MCP de SFMC y el disco) |
| **El libro vivo** | 🆕 **la copia que Rick dejó en esta misma carpeta**: `(Interno-Copy))-Reporte-Consolidado-Nestle-2026-v8.xlsx`. Es **idéntica** (sha1 `14fc925667ef…`) a la de SharePoint al 4-nov-2026 11:48, que es con la que se verificó todo. Rick, 4-nov: *«el libro vivo es el que copié ahora al repositorio, misma carpeta; ese vamos a trabajar»* |
| **Regla** | **Una sola copia del libro se edita a la vez.** Un `.xlsx` que dos sesiones editan no se puede fusionar. Aquí, en la nube, **solo se LEE y se planea**: no correr cortes, no cargar insumos, no publicar, no tocar el libro |

⚠️ **Dos cosas que hay que saber antes de correr nada** *(no se resolvieron el 4-nov porque Rick pidió «nada de scripts del sistema»)*:
1. **Los scripts siguen resolviendo el libro en la carpeta de SharePoint**, no en esta
   (`…\Archivos de Leslie Monserrat Monterrosas (Omnicom) - Nestlé 2026\Marcas\CRM General\Sistema-Reportes-CRM\`).
   Mientras `lib-entorno.js` / `entorno.json` no apunten a la copia de este repo, **hay DOS copias** del libro y
   una corrida escribiría en la de SharePoint, no en esta.
2. **El nombre de esta copia es `(Interno-Copy))-…` — con dos paréntesis de cierre.** No es el nombre que fija el contrato del
   sistema (`(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx`); la guarda 8 («el archivo vivo se llama como dice el contrato») lo marcaría.

---

## 0 · Cómo usar este archivo

| Si vas a… | Lee |
|---|---|
| correr un corte | §7 · el comando y qué esperar |
| entender por qué algo está así | §5 · las decisiones de negocio |
| no romper nada | §6 · las reglas innegociables |
| saber qué falta | §8 · pendientes |
| saber **qué se hizo y se decidió en el catálogo** (lo más nuevo) | 🆕 **Parte A** |
| saber si algo que dice aquí sigue siendo cierto | §9 · cómo re-medir (y A.12 para el catálogo) |

🔴 **Regla que gobierna a este archivo: lo que observes le gana a lo que aquí esté escrito.**
Si el disco contradice una cifra de aquí, gana el disco y **se corrige este archivo en esa misma
sesión**. Un estado que miente envenena el diagnóstico del corte siguiente, que es de donde sale el
plan. Este archivo ya nació de arreglar exactamente eso: `estado-reportes.md` *(solo en local)* seguía diciendo «v7 ·
WK31 · julio» dos semanas después.

⚠️ **Nota para un agente en la nube:** casi todo esto vive en el disco de Rick (`C:\Users\Ricardo.Aguilar`).
Un agente remoto **puede leer y planear con este archivo, pero no puede correr la cadena** sin ese
disco, sin el MCP de SFMC y sin OneDrive montado. Lo que sí puede: dirigir, revisar, redactar,
priorizar pendientes y preparar el trabajo para una sesión local.

---

## A · EL CATÁLOGO — qué hicimos y qué decidimos (29-oct → 4-nov-2026)

> Esta parte **es** el handoff de lo que pasó en el catálogo, y sirve para pasar el trabajo a TD AI Studio.
> Todo está **escrito en el libro** y se verificó **releyéndolo del disco**, no leyendo el script.
> Las decisiones son de Rick; cada una vive, con quién la dijo y su evidencia, en
> `Sistema/_contratos/catalogo-decisiones-2026-10-29.json` (36) y `catalogo-decisiones-2026-11-04.json` (n37–n49 + las etapas).
> El plan completo, con sus 6 etapas y 31 sub-etapas, está en `Sistema/_orquesta/plan-modelo-catalogo-2026-10-30.md`.

### A.1 En una pantalla

| | |
|---|---|
| **El catálogo hoy** | **157 piezas** (138 de email · 19 de WhatsApp) · **68 columnas** · 13 campañas |
| **Campañas** | AON 33 · Hotcakes 24 · Liga MX 18 · Fuel for life 17 · Mundial 15 · Hackea tu café 15 · The Freshers 10 · Tercer Tiempo 8 · 100 años 8 · Territorios 3 · Checo 3 · Antojo Infinito 2 · F1 1 |
| **Sus celdas** | 10,676 · **0 `POR DEFINIR`** · 0 `POR ACTUALIZAR` · 22 `PENDIENTE` (todas en las 26 columnas de Qcart, que salen en la etapa 5) · 56 **en blanco a propósito** (son datos por *medir*) |
| **Hoja nueva** | **`Catalogo_Links`** · 82 filas × 9 columnas · 81 shortlinks (uno va en dos filas) |
| **Estado de las piezas** | `ENVIADA` 151 · `LINK NO USADO` 4 · `NO SE ENVIO` 2 |
| **Cómo se sabe que quedó bien** | validador del catálogo **5/5** · las restricciones del modelo (R1–R15) **todas pasan sobre el libro vivo** · **15 de 15 señuelos** muerden · la auditoría de shortlinks dice «todo cuadra» |
| **Publicado a producción** | 🔴 **NO.** El productivo no se tocó |
| **Para deshacer todo** | `_backups/(Interno)-Reporte-Consolidado-Nestle-2026-v8.ANTES-ETAPA0-20261104.xlsx` (sha1 `025ecd91c445…`). El libro publicado es sha1 `14fc925667ef…` |

### A.2 Línea de tiempo

| Fecha | Qué pasó |
|---|---|
| **29-oct** | **36 decisiones de Rick**, aplicadas: `POR DEFINIR` 149 → **0** · alta de `WA-SNM-1` como `005-P022` (`NO SE ENVIO`) · fila `013-P004` borrada · **18 columnas retiradas** · 10 alias de Mundial corregidos y 4 de Liga MX borrados (93 → 89) · nacen los estados `NO SE ENVIO`, `LINK NO USADO`, `POR ACTUALIZAR` y la columna `Estado_Pieza` |
| **30-oct** | Auditoría del **maestro de Qcart contra el catálogo**. Salieron hallazgos reales (links en la tienda o la pieza equivocada, un código de WhatsApp colgado de un email, fechas de activación malas). Rick pidió **pensar el catálogo como una base de datos bien planteada**: llaves primarias y foráneas. Se escribió el plan |
| **4-nov** | **Etapas 0 a 4 y lo de la 5 que es del catálogo**: respaldo · contrato · `Catalogo_Links` en seco · diff · **escritura al libro** · limpieza · señuelos · auditoría migrada |

### A.3 El modelo de llaves — la decisión central

**Catalogo_Piezas — una fila por pieza**

- 🔴 **La llave es el nombre con que su fuente la publica, según su canal:** `Email_Name` si `Canal = Email`, `Whatsapp_Name` si `Canal = WhatsApp`. La otra columna lleva `N/A`.
  *Rick: «para email la llave única debe ser Email_Name, para WhatsApp debe ser Whatsapp_Name… son realmente las únicas que no se te duplican; en lo demás has cometido errores».*
- **`Pieza_ID` queda como etiqueta legible**, la columna no se quita. Se duplicó antes; los nombres no (139 de 139 y 18 de 18 únicos el 30-oct).
- 🔴 **Una celda de llave lleva UN solo nombre.** Había 7 piezas con dos (`001-P005`, `001-P006`, `001-P032`, `005-P009`, `005-P010`, `005-P012`, `008-P008`). El **principal es el que SFMC realmente entrega para esa pieza**; el otro es un **alias** y pasa a la columna de variantes (separador ` ; `). Rick dijo «el que está como principal, el otro es un alias»; medido, en **4 de las 7 el principal era el segundo** (`001-P032`, `005-P009`, `005-P010`, `005-P012`): el primero era un nombre viejo que SFMC ya no trae, y tomar «el primero» habría dejado una llave que no une con SFMC.
- **Dos piezas nunca enviadas no tenían llave** (una llave no puede ir vacía). Se nombraron: `004-P020` → `EM-MUNDIAL-E-P2-MODERN-COOKING` y `005-P022` → `WA-LIGAMX-SNM-1`. Son **nombres propios sin el número que asigna SFMC** (que no existe porque nunca salieron), como ya se hace con `WA-HOTCAKES-C1-…` y `WA-MUNDIAL-FINALES`.
- `006-P003` (The Freshers · WA-A1) tenía **el mismo texto** en `Email_Name` y `Whatsapp_Name`: era una copia, no un email. Su `Email_Name` pasó a `N/A`.

**Catalogo_Links — una fila por shortlink × fecha de activación** *(hoja nueva, es el catálogo de Qcart)*

```
Catalogo_Piezas                            Catalogo_Links
  llave: Email_Name | Whatsapp_Name  ◄────── Pieza  (llave foránea)
                                              PK = (Shortlink, Fecha_Activacion)
                                              Pieza_ID · Tienda · Receta · URL_Receta · Estado_Link · Nota
```

- 🔴 **Llave primaria: `(Shortlink, Fecha_Activacion)`.** Rick: *«la llave principal es el short link, lo demás es complementario, serían foreign keys… es una llave distinta con fechas distintas… es una activation date».*
  El shortlink solo **no** es único cuando el equipo lo reusa: `hTHNLqzL` se activó el **15-ago en E-J4** y el **4-sep en E-J7**. La fecha lo versiona. En modelado se llama **fecha de vigencia (*effective date* / *valid-from*)**; la tabla es de tipo temporal. Un carrito se atribuye a la fila del link con la fecha de activación más reciente que no pase la fecha del carrito.
- **Regla que lo vigila:** un link, en una fecha dada, pertenece a **una sola pieza**.
- **`Pieza`** es la llave foránea: lleva el `Email_Name` o el `Whatsapp_Name` de la pieza. `Pieza_ID` va al lado solo para poder leerla.
- **`Tienda`**: `walmart` · `chedraui` · `chedraui+walmart` (tal cual lo escribe Qcart). Si no hay dos links, **es `walmart`** (Rick).
- **`Estado_Link`**: `USADO` · `LINK NO USADO` (la pieza sí salió y ese link no) · `NO SE ENVIO` (el envío de ese link no ocurrió) · `PROBLEMA DE DATOS` (sin carritos y sin explicación). Se **deriva**: explícito del contrato → `Estado_Pieza` de su pieza → el maestro no trae fecha válida → `USADO`.
- **`Fecha_Activacion` = `N/A`** en los **11 links que el maestro dice «No enviado» / «No salió» / «Envío Federación»**: no hay fecha porque no se activaron, y la llave `(Shortlink, N/A)` sigue siendo única porque cada uno tiene una sola fila.
- **`Receta` y `URL_Receta` son columnas de esta hoja**, no una tabla aparte (Rick: *«NO, no es otra tabla, es columna en el catálogo de Qcart y listo»*).
- **No lleva medición** (carritos, views): *«Carritos total es medición, enfócate en catálogo»*. Tampoco el prefijo dimensional (campaña, touchpoint, segmento): eso se lee de su pieza por la llave foránea, y repetirlo sería guardar el mismo dato en dos lugares.
- **El maestro de Qcart manda** en qué link es de qué pieza y desde cuándo. Fuente de las fechas: `_catalogo/activacion-qcart.json`, que el sistema deriva del maestro.

### A.4 Los estados de una celda *(reemplaza §5.9, que decía «tres estados»)*

| Estado | Significa | Dónde |
|---|---|---|
| un **valor** | el dato | cualquier celda |
| **`N/A`** | no aplica | cualquiera |
| **`NO SE ENVIO`** | se planeó y nunca salió. Es un **resultado**, no un hueco | celdas de una pieza no enviada; `Estado_Pieza`; `Estado_Link` |
| **`LINK NO USADO`** | la pieza salió y el link no iba dentro | `Estado_Pieza`; `Estado_Link` |
| **`ENVIADA`** 🆕 | una pieza normal que salió. Antes iba **en blanco** en 152 piezas | `Estado_Pieza` |
| **`PROBLEMA DE DATOS`** 🆕 | el link existe y no hay carritos ni explicación | `Estado_Link` |
| **en blanco** 🆕 | **solo** en las columnas de **medición** (fechas, envíos…): es un dato por medir. En cualquier otra columna un blanco es un defecto | 15 columnas + `Content_ID` |
| **`Declarado por Rick · <fecha>`** 🆕 | el formato de la columna `Estado` cuando Rick confirmó la pieza | `Estado` |
| ~~`POR DEFINIR` / `PENDIENTE` / `POR ACTUALIZAR` / «⚠ Por confirmar»~~ | **ya no puede quedar ninguno** (Rick: *«no podemos dejar nada por definir, o por confirmar o pendiente»*). Los 22 `PENDIENTE` que quedan están en las 26 columnas de Qcart y salen con ellas | — |

`Estado_Pieza` vale: `ENVIADA` · `NO SE ENVIO` · `LINK NO USADO` · `FUERA DEL REPORTE` · `NO MODIFICAR` (🔴 *«nunca es nunca»*: ningún script toca esa pieza).
**Las 15 columnas de medición:** `Fecha_Primer_Envio`, `Fecha_Ultimo_Envio`, `Mes_Lanzamiento`, `Quincena`, `Quincenas_Activas`, `N_Quincenas`, `Meses_Activos`, `N_Meses`, `Sends_Por_Quincena`, `Sends_Por_Mes`, `Granularidad_Periodo`, `Fecha_Origen`, `Dias_Envio`, `Sends`, `Clicks_Medidos`.

### A.5 Lo que cambió en `Catalogo_Piezas` el 4-nov — 383 celdas

| Qué | Celdas |
|---|---:|
| `Segmento` (15 piezas, ver abajo) | 15 |
| `Objetivo` (3 de Rick + `005-P017` por la regla de Qcart) | 4 |
| nombre-llave de `004-P020` | 2 |
| `005-P022` llenada (la otra pieza no enviada se tomó de modelo) | 58 |
| `006-P003`: `Email_Name` → `N/A` y `Tipo_Envio` → `one-shot` | 2 |
| una sola llave por celda (7 piezas) y sus alias a variantes | 12 |
| shortlinks en su tienda y su pieza (ver A.6) | 16 |
| `URL_Receta` que no era una URL → `N/A` | 11 |
| URL de **otra receta** corregida (`001-P003`) | 2 |
| «\| Recetas Nestlé» quitado de 3 nombres de receta | 3 |
| `Estado` → «Declarado por Rick · 4-nov-2026» (las 50 «por confirmar») | 50 |
| `Estado_Pieza`: `ENVIADA` ×151 y `004-P010` → `LINK NO USADO` | 152 |
| datos por **medir** → en blanco (54) y `Content_ID` por obtener de SFMC (2) | 56 |
| **Total** | **383** |

**Lo que Rick dijo de segmentos y objetivos (4-nov):**
- **AON, E-APP** (`001-P029`): segmento **«Usuarios activos»**, objetivo Descarga App.
- **AON, E-PROP2** (`001-P030`, `P031`): segmento **«Reenganchables»**. **E-PROP1** (`001-P032`, `P033`): segmento **«Tibios»**. 🔴 **Un PROP siempre lleva objetivo «Prevención de Churn»** (E-PROP1 decía «Usuarios Tibios»).
- **Hackea tu café**: *«todos el mismo segmento»* → **«Premium Cafés»**. Las versiones AON (`007-P011`…`P015`) son **mismas dimensiones; lo que cambia es el tipo** (`always-on`, que ya tenían).
- **The Freshers**: *«todo la misma audiencia»* → **«Gen Z Cafés»** (`006-P007`…`P010` decían «GEN Z»). El objetivo de E-P1 es **Purchase**.
- **Territorios** (`010-P001`…`P003`): segmento **«Sin Territorio»**.
- **Checo**: objetivo **«Promoción»** (`012-P003` decía «Promociones»).
- **Regla Awareness / Purchase:** *Awareness por defecto; Purchase solo si lleva Qcart.* Se aplicó **solo a Liga MX**, donde Rick la dijo (`005-P017`, sin Qcart, pasó a Awareness).
- Las demás piezas «por confirmar» (altas de octubre: 100 años, F1, Checo, Territorios, E-L1, Liga MX SNM/femenil, Hackea Hack3/4/Rit3…) *«son altas, hay que darlas de alta»* → quedaron **«Declarado por Rick · 4-nov-2026»**.

🟡 **3 propuestas mías que quedaron escritas con el «Dale» de Rick** (se revierten si no las quiere): `006-P003` = `one-shot` (las otras 17 piezas de WhatsApp lo son) · las URLs de Molletes y Espagueti en `001-P003` (eran las de Wraps y Salmón; las correctas estaban mal puestas en `001-P011`) · quitar «| Recetas Nestlé» de 3 nombres.

### A.6 Qcart: los shortlinks y `Catalogo_Links`

🔴 **Por qué importa:** ningún total del reporte cambia con estos arreglos —la tienda de cada carrito sale del CSV de Qcart—, así que **ninguna puerta los veía**. Lo que estaba mal era el *padrón*.

| Pieza | Antes | Después |
|---|---|---|
| `004-P001` | Walmart «tJEICO87 ; Z8W0ZouI» · Chedraui «Y8umAAnA» | Walmart `tJEICO87` · Chedraui `Z8W0ZouI` |
| `004-P002` | Walmart `cCFb2xEx` · Chedraui `hWaJfDxS` | Walmart `hWaJfDxS` · Chedraui `N/A` (*«solo Walmart»*) |
| `004-P003` | Walmart «rr0VvKTb ; dHfqmS7n» · Chedraui `w5r9LWOP` | Walmart `rr0VvKTb` · Chedraui `dHfqmS7n` |
| `004-P005` | Walmart «HcDJTsRH ; rueO2xbY» · Chedraui `N/A` | Walmart `HcDJTsRH` · Chedraui `rueO2xbY` |
| `003-P001` (La Lechera) | 4 códigos de 2 recetas **metidos y cruzados** en el slot 1 | Carlota: `o41ObWyu` / `PJrhl5GT` · **Flan Napolitano (receta nueva en el maestro)**: `r0J2KBES` / `PDy0MeF9` · `N_Recetas` 1 → 2 |
| `004-P020` | `wdvsBDby` solo estaba en `Codigos_Qcart` | `Cod_Chedraui_3` |

- 🔴 **Los 6 links de WhatsApp de `004-P010`** (Mundial · Partido 2): 3 recetas × 2 tiendas (`wa-botana1`, `wa-bebida1`, `wa-cooking1`). Tres estaban **colgados de piezas de email**, ocupando justo la celda del link real de Chedraui; los otros tres el catálogo no los declaraba en ninguna parte. El maestro dice «No enviado / No se envió a Qcart»; **el mensaje sí salió** → `LINK NO USADO`, y `004-P010` quedó `LINK NO USADO`.
- **`uDEM0jlX` (Tinga de Pollo, 254 carritos) es de `001-P005`**, activado el **13-mar-2026**. Cuatro señales lo dicen (el maestro, `N_Recetas = 4` con 3 llenas, la fecha de activación y que `001-P025` no tiene Qcart). Un contrato viejo lo mandaba a `001-P025` y nunca se aplicó. No cabía en la forma de 3 ranuras: **por eso nació `Catalogo_Links`**.
- **`hTHNLqzL`** en dos filas (E-J4 y E-J7), cada una con su fecha.
- **Hotcakes** (`002-P001`…`P004`): un solo link sirve a las dos tiendas → `Tienda = chedraui+walmart`, una fila por link.
- **`UhCnTNuz`** (Liga MX E-J5, sin carritos y sin explicación) → `PROBLEMA DE DATOS`. **`uv5JZ8U7`** y **`6SiccJiG`** → sin salida.
- **Lechera, fecha:** el maestro dice **2027-07-26** para sus 4 links (13 meses después de su hoja: un error de año y mes). Rick: *«ya la tienes, es la que dijiste de los envíos»* → **2026-06-26**. ⚠ **La corrección vive solo en el contrato; el maestro sigue diciendo 2027.**
- **URLs de receta de Mundial = `N/A`**: el maestro trae los ingredientes donde iría la URL (11 celdas).
- **48 links del maestro quedan FUERA del catálogo** (decisión n48; no tienen pieza ni fecha): Cuaresma 19, Borradores 6, «Por reagendar» 20 y Maggi julio «No salió» 3. *Cuaresma no se envió*; Rick cambia el maestro. La auditoría ya no los vuelve a reportar como faltantes.
- **Las 26 columnas de Qcart de `Catalogo_Piezas` se quedan** (`Cod_*`, `Carritos_*`, `Receta_*`, `URL_Receta_*`, `Tiene_Qcart`, `N_Recetas`, `Fuente_Qcart`, `Codigos_Qcart`…) **hasta que cambien los scripts del sistema**. Retirarlas es la etapa 5 y pide el OK de Rick. Mientras tanto se corrigieron con los mismos arreglos, para que no contradigan a `Catalogo_Links`.

### A.7 Cómo se escribió y se verificó *(el camino a repetir)*

1. **Respaldo** con sha1 del libro y del esquema, antes de tocar nada.
2. **Diff «hoy → quedaría»** de las 383 celdas, con el valor de hoy junto al nuevo. **Rick lo revisó** («Dale») antes de escribir. *El diff protege, no el cuidado*: así se cazó que se iba a escribir `cartanywhere` en la pieza equivocada.
3. **Escritura por XML, celda por celda** (`lib-celda-xml`), sobre una **copia**; la hoja nueva con `lib-hoja-xml`. Nada de SheetJS para escribir (ya se llevó el formato de 56 columnas una vez).
4. **Cinco guardas antes de publicar:** G1 el libro no cambió desde el respaldo · G2 cada celda valía hoy lo que el diff dijo · G3 las 5 capas · G4 releída, la copia es **igual en las 10,676 celdas** a lo prometido y `Catalogo_Links` igual a su propuesta · G5 **solo** cambiaron la hoja del catálogo, el registro del libro y la hoja nueva (las demás partes, byte a byte).
5. **Publicar y esperar 12 s** para ver que OneDrive no lo revierta (el sha1 se mantuvo).
6. **Mirar el render** (`xlsx-render.py`). Hecho para `Catalogo_Links` y para una ventana de `Catalogo_Piezas`.

### A.8 Las restricciones del modelo y los señuelos

`catalogo.validar-modelo.js` (`--libro` valida **lo escrito en el libro vivo**):

| | Restricción |
|---|---|
| R1 | cada pieza: **un** nombre, el de su canal, sin repetidos |
| R2 | `(Shortlink, Fecha_Activacion)` única; un link en dos piezas solo con fechas distintas |
| R3 | toda `Pieza` de un link existe en `Catalogo_Piezas` |
| R4 · R5 | `Tienda` y `Estado_Link` en su dominio, y sin columnas de medición |
| R6 · R7 | nada en blanco fuera de las columnas de medición · nada `PENDIENTE` / «por confirmar» |
| R8 | el canal del link coincide con el de su pieza (se lee el **campo de canal del maestro**, no el nombre) |
| R9 | fecha ISO o `N/A`, y **no futura** |
| R10 | todo código que el catálogo declaraba sigue declarado |
| R11 | un link «no usado / no enviado» **no tiene carritos** |
| R12 | la tienda no contradice a Qcart cuando Qcart observa **una sola** |
| R13 | un código por celda |
| R14 | la URL es de **su** receta y es una URL |
| R15 | **la llave misma** existe en su fuente (SFMC / WhatsApp) |

🔴 **`catalogo.probar-validador-modelo.js` planta 15 defectos, uno por uno, y exige que cada uno sea atrapado. Hoy: 15 de 15 y el control pasa.** Sirvió: el señuelo de R15 destapó un **punto ciego del propio validador** (aceptaba «algún alias existe», y una llave inventada pasaba). Se hizo estricto. Y `catalogo.auditar-shortlinks.js` ahora **lee `Catalogo_Links` como declaración**: antes acusaba de «no declarado» a `uDEM0jlX` (254 carritos).

### A.9 Lo que aprendimos *(no repetir)*

1. 🔴 **La fila del maestro no es el registro; el bloque sí.** Una fila trae una receta por bloque, cada una con su tienda, su shortlink y su estado. Leer solo el primero hizo invisibles 12 códigos (entre ellos 2 de La Lechera con 68 carritos).
2. 🔴 **El maestro escribe «No se envío» con acento.** Un patrón `no se envi` no lo casa, y 3 códigos que la fuente ya explicaba salían como pregunta abierta.
3. **Consultar los alias antes de acusar.** Dos veces un «defecto» era un alias ya resuelto. Pero también al revés: R8 pasó en verde con 3 códigos de WhatsApp colgados de piezas de email porque el alias `wa-cooking1 → E-P1` lo disimulaba; la evidencia directa es el **campo de canal** del maestro.
4. 🔴 **El render encontró lo que ningún check veía:** «Misma receta» como nombre de receta, URLs de otra receta y ingredientes pegados en `URL_Receta`.
5. **Un estado no es basura.** Se acusaron 18 `URL_Receta` que no eran URL; 7 eran estados (`PENDIENTE`, `NO SE ENVIO`). Eran 11.
6. **Una celda puede traer dos nombres.** «139 de 139 únicos» comparaba la celda entera y no podía verlo. Hasta la **fuente** de WhatsApp lo hace: Tercer Tiempo, fila 3, trae `…948959` y `…972359` en **una** celda de 144 caracteres.
7. **El principal es el que SFMC entrega**, no el primero de la celda.
8. **Verde no prueba que mire** → señuelos (A.8).
9. **En Windows `copyFileSync` conserva la fecha del archivo original**, así que la fecha de un temporal no dice cuándo se creó. Para borrar copias propias se deriva la lista **del código que las crea**.
10. Un `heredoc` con texto largo y comillas falló en el shell; **usar el tool Write**.

### A.10 Lo que NO se hizo

- **No se publicó a producción.**
- **No se corrió la cadena.** `Report_Resumen` y `Data_Email` siguen con los segmentos viejos de **15 piezas** (`001-P029`…`P031`, `006-P007`…`P010`, `007-P011`…`P015`, `010-P001`…`P003`) hasta el próximo corte.
- **No se tocó ningún script del sistema** (motor, resumen, fuentes, orquestador): Rick dijo *«nada de scripts, solo catálogo»* porque van a cambiar. Tampoco `pieza.llave_primaria` de `esquema.json`: sigue `Pieza_ID` porque los scripts lo leen; la llave por nombre vive en el contrato y en `Catalogo_Links`.
- **No se retiraron las 26 columnas de Qcart.** **No se documentó en el skill del catálogo** (el sync entre sus dos copias ya borró secciones una vez). **No hay commit:** `Sistema/` no es repo git.
- Los `Carritos_*` de las columnas viejas quedaron **desfasados** en `004-P001`, `P002`, `P003`, `P005` y `003-P001` (se movieron sus códigos de slot): es medición y la regenera la cadena.

### A.11 Pendientes y decisiones abiertas

**Dudas para Rick**
1. `001-P006`: su alias `…863587` también lo trae `001-P027`; quedó como alias de `001-P027` **por parecido de nombre** → revisar.
2. Regla Awareness/Purchase: **7 piezas fuera de Liga MX** son Purchase sin Qcart (6 de Hackea —`007-P005`, `P006`, `P007`, `P010`, `P014`, `P015`— y `011-P001`) y **no se tocaron**.
3. Las 3 propuestas de A.5, ya escritas: ¿alguna se revierte?
4. `Fecha_Activacion = N/A` en los 11 links no enviados: decisión de Claude, ¿se confirma?
5. Los 3 links de `004-P020` (pieza nunca enviada) conservan la fecha que trae el maestro (10 y 17-jun) aunque su estado es `NO SE ENVIO`: ¿se quedan con fecha o `N/A`?
6. 15 de los 82 links tienen **una** tienda en el maestro pero Qcart observa carritos de **las dos**; quedaron con la del maestro. ¿Así, o `chedraui+walmart`?
7. `Sheet2` está sin declarar en el esquema (es de Rick). `Copia-151026-Reporte-Consolidado-Nestle-2026-v8.xlsx` (copia que compite, en la carpeta de SharePoint). 195 archivos ajenos en `Sistema/_tmp/` (161 MB; **pasa de 100 MB, pide OK**).

**De Rick, fuera del catálogo**
8. **Corregir en el maestro** la fecha de los 4 links de Lechera (dice 2027-07-26; debe ser 2026-06-26) y **marcar Cuaresma como no enviada**.
9. **Equipo de WhatsApp:** un solo nombre por celda en el Excel de resultados (Tercer Tiempo, fila 3).
10. Dar las **URLs de receta de Mundial** si quieren dejar de ser `N/A`.

**Esperan a que cambien los scripts del sistema**
11. Que el lector de WhatsApp **separe** las celdas con dos nombres.
12. **Correr la cadena** para regenerar `Report_Resumen` y `Data_Email` con los segmentos nuevos.
13. **Retirar las 26 columnas** de Qcart (etapa 5, con respaldo y OK de Rick) y meter las restricciones del modelo al **preflight del orquestador**.
14. Que los scripts del sistema **resuelvan el libro de esta carpeta** (ver el aviso de arriba) y que su nombre sea el del contrato.
15. 🟡 Pendiente mío: `catalogo.construir-links.js` lee columnas por nombre literal (la guarda 3 lo avisa) → migrarlo al lector por nombre. Y documentar el modelo en el skill `crm-reporte-nestle-catalogo`.

### A.12 Dónde está cada cosa *(en `…\Sistema-Reportes-CRM\Sistema\`)*

| Qué | Dónde |
|---|---|
| Las decisiones (con quién y evidencia) | `_contratos/catalogo-decisiones-2026-10-29.json` · `_contratos/catalogo-decisiones-2026-11-04.json` |
| El plan, etapa por etapa | `_orquesta/plan-modelo-catalogo-2026-10-30.md` |
| Scripts nuevos | `lib-maestro-links.js` (el lector único del maestro) · `catalogo.construir-links.js` · `catalogo.diff-piezas.js` · `catalogo.escribir-etapa3.js` · `catalogo.validar-modelo.js` · `catalogo.probar-validador-modelo.js` |
| Scripts cambiados | `catalogo.auditar-shortlinks.js` (lector único + `Catalogo_Links`) · `catalogo.validar-limpio.js` (acepta `ENVIADA`) |
| El esquema | `_contratos/esquema.json` → `hojas.Catalogo_Links` · `estado_de_pieza.valores += ENVIADA` · `estados_de_celda.estado_de_link` (solo adiciones) |
| Lo que se iba a escribir | `_preescritura/DIFF-catalogo-piezas.xlsx` · `diff-catalogo-piezas.json` · `catalogo-links-VISTA-PREVIA-DESPUES.xlsx` |
| Respaldos | `…\Sistema-Reportes-CRM\_backups\` (`ANTES-ETAPA0-20261104`) |

**Cómo comprobar que sigue siendo cierto:**
```bash
node Sistema/_scripts/catalogo.validar-limpio.js             # el catálogo limpio: 5 comprobaciones
node Sistema/_scripts/catalogo.validar-modelo.js --libro     # las restricciones, sobre el libro VIVO
node Sistema/_scripts/catalogo.probar-validador-modelo.js    # ¿el validador MIRA? 15 señuelos + 1 control
node Sistema/_scripts/catalogo.auditar-shortlinks.js         # maestro de Qcart ↔ catálogo
node Sistema/_scripts/orquestador.guardian-hojas.js          # el libro contra el esquema
```

**Para deshacer:** copiar el respaldo `ANTES-ETAPA0-20261104.xlsx` sobre el libro, con Excel cerrado, y volver a validar. El esquema anterior está en `_backups/esquema.ANTES-ETAPA0-20261104.json`.

---

## 1 · Qué es este sistema

No es un reporte: es una **capa de atribución** sobre cuatro fuentes que no se conocen entre ellas.
Salesforce (SFMC) mide **envíos**; el negocio pregunta por **campañas**. Entre una cosa y la otra
hay ocho dimensiones que ninguna fuente entrega, y esa distancia es el producto.

**Entregable final:** una hoja `Report_Resumen` dentro de un `.xlsx` que **Rick sigue editando a
mano**. No es un dashboard: la salida tiene que seguir siendo un Excel editable.

### Las cuatro fuentes y su llave

| Fuente | Qué entrega | Llave de cruce |
|---|---|---|
| **SFMC** | dos Data Extensions: `CRM_Email_Piezas` (agregada, 1 fila/pieza) y `CRM_Email_Detalle` (1 fila por job×día) | `Email_Name` → `Pieza_ID` |
| **Qcart** | maestro de links + eventos de carritos y productos | 🔴 el **shortlink**, nunca el utm |
| **WhatsApp** | 5 hojas con esquemas distintos entre sí | `Pieza_ID` **declarado a mano** |
| **Manual** | lo que ninguna fuente entrega | declarado, con quién y cuándo |

**El catálogo no es una fuente.** Es la autoridad de dimensiones (campaña · marca · BU · segmento ·
touchpoint · objetivo) y por eso se consulta **antes** que las fuentes, no después.

---

## 2 · Dónde vive cada cosa

```
🆕 4-nov-2026 · ARCHIVO VIVO (el que se trabaja) = la copia EN ESTA CARPETA DEL REPO:
  negocio/nestle/reportes-consolidado/(Interno-Copy))-Reporte-Consolidado-Nestle-2026-v8.xlsx   (sha1 14fc925667ef…)
  La de SharePoint —\Archivos de Leslie…\Marcas\CRM General\Sistema-Reportes-CRM\(Interno)-Reporte-…v8.xlsx— es IDÉNTICA
  al 4-nov y es la que los scripts siguen resolviendo (ver «Dónde se trabaja», arriba).
  🆕 El BACKEND vivo está en  …\Sistema-Reportes-CRM\Sistema\  (no en ~\.claude\reportes-backend, que no recibe nada desde el
  6-oct) y los skills se llaman  crm-reporte-*  (antes  rick-reportes-*).

LO DE ABAJO ES DEL 8-sep, ANTES de que el sistema se migrara a Sistema-Reportes-CRM:

ARCHIVO VIVO (el que se trabaja)
  C:\Users\Ricardo.Aguilar\OneDrive - OneWorkplace\Marketing Automation Kinesso - Librería-Sharepoint-MAK\
    Nestlé\Reportes-Nestlé\(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx

BACKEND (los scripts, los contratos, los bloques)   ← está en git
  C:\Users\Ricardo.Aguilar\.claude\reportes-backend\nestle\
    _scripts\        173 .js
    _contratos\      cadena-skills.json · esquema.json · reglas-irrenunciables.json …
    _fuentes\        los 4 bloques + los veredictos de las puertas
    _rejilla\        rejilla.json + veredicto-puerta2.json
    _preescritura\   lo que cada paso VA a escribir, declarado antes de tocar el Excel
    _catalogo\       catalogo.json + registro-ids.json (append-only)
    _orquesta-bitacora.json   ← la última corrida

SKILLS                 C:\Users\Ricardo.Aguilar\.claude\skills\rick-reportes-*   ← git
PROYECTO / ORQUESTA    …\Reportes-Nestlé\_orquesta\
INSUMOS DESCARGADOS    …\reportes-backend\nestle\_insumos\
FUENTE QCART           …\Reportes-Nestlé\ReportesQcart\Qcart-Links Mails-Hive- MX.xlsx

PRODUCCIÓN (del cliente — NO se toca sin OK de Rick)
  …\OneDrive - OneWorkplace\Archivos de Leslie Monserrat Monterrosas (Omnicom) - Nestlé 2026\
    Marcas\CRM General\Reporte-CRM-Consolidado-Nestle-2026.xlsx
  ⚠ La ruta la mueven sin avisar → resolverla por búsqueda antes de cada publicación.
```

🔴 **Nunca renombrar ni mover el archivo vivo ni el productivo**: están compartidos con el equipo y
les rompe los links.

---

## 3 · El último corte — 8-sep-2026

> 🆕 **Histórico.** Después hubo más cortes (el sistema siguió cargando fuentes hasta finales de octubre) y **no se re-midieron
> aquí**. El 4-nov **no se corrió ninguna cadena**: solo se tocó el catálogo (Parte A).

| | |
|---|---|
| **Corrida** | `2026-09-08 19:35Z` (13:35 hora local) · modo **escritura** · sin `--desde` |
| **Pasos** | **44 · 0 fallos · no se detuvo** |
| **PUERTA 1** | 🟢 **ABIERTA** (19:33Z) · 0 bloqueos · 1 aviso |
| **PUERTA 2** | 🟢 **ABIERTA** (19:35Z) · 0 bloqueos · 0 avisos |
| **Idempotencia** | la cadena se corrió **dos veces seguidas**: ninguna hoja cambió de tamaño, ninguna gemela reapareció |
| **Publicación a producción** | 🔴 **NO** — el productivo sigue en **17-ago-2026** |

**Lo que midió la PUERTA 2 al cerrar:**

```
filas_reporte   82   ==   celdas_rejilla   82
email_bloque    8,937,524   ==   email_rejilla   8,937,524
```

**Lo que midió la PUERTA 1 al abrir:**

| Cruce | Bloque | Catálogo | Δ |
|---|---:|---:|---:|
| email | 8,937,524 | 8,937,524 | **0** |
| whatsapp | 14,643 | 14,643 | **0** |

- doble conteo: 69 pares revisados, **0 choques**
- huérfanos: **0** · huérfanos sin declarar: **0**
- frescura de los 4 bloques: 0 minutos entre el más viejo y el más nuevo
- ⚠ **aviso: 13 «piezas» sin datos de ningún bloque** — 5 de Mundial WhatsApp, 4 de Liga MX Email,
  y **al menos 3 que no son piezas** sino las notas a mano de Rick (ver §8, defecto D2)

### Hasta cuándo están cargados los insumos

| Fuente | Último insumo en disco |
|---|---|
| SFMC (detalle, piezas, links) | **4-sep-2026** (`sfmc-detalle-2026-09-04.txt`) |
| Qcart · maestro de links | **3-sep-2026** (`Qcart-Links Mails-Hive- MX.xlsx`) |
| Qcart · CSV de carritos/productos | junio-2026 (los históricos) |
| WhatsApp | Hotcakes + Tercer Tiempo, sin cambio desde agosto |

---

## 4 · Estado medido de cada artefacto

### 4.1 El workbook — `(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx`

> 🆕 **Forma del libro el 4-nov-2026** (sha1 `14fc925667ef…` · 875,113 bytes · **13 hojas**; filas = rango usado, **incluye el encabezado**):
>
> | Hoja | Filas | Cols | | Hoja | Filas | Cols |
> |---|---:|---:|---|---|---:|---:|
> | `Report_Resumen` | 158 | 89 | | `Catalogo_Referencias` | 269 | 11 |
> | `Catalogo_Piezas` | 158 | **68** | | `Data_Email` | 139 | 47 |
> | **`Catalogo_Links`** 🆕 | **83** | **9** | | `Data_WhatsApp` | 25 | 33 |
> | `Maggi Reporte` | 34 | 53 | | `Data_Qcart_Carritos` | 4,660 | 31 |
> | `Reporte_julio` | 45 | 58 | | `Data_Qcart_Productos` | 1,684 | 32 |
> | `Exclusiones` | 15 | 8 | | `Sheet1` · `Sheet2` | 23 · 13 | 8 · 20 |
>
> El 4-nov solo cambiaron **`Catalogo_Piezas`** (383 celdas) y se creó **`Catalogo_Links`**. El resto de las hojas quedó **byte a byte** como estaba.
> La tabla de abajo es del 8-sep.
`674,543 bytes · 10 hojas · modificado 8-sep-2026 17:05`

| Hoja | Cols | Filas con dato | Fórmulas |
|---|---:|---:|---:|
| `Report_Resumen` | **78** | **83** (82 de dato + encabezado) | 44 |
| `Catalogo_Piezas` | **82** | **130** | 0 |
| `Catalogo_Referencias` | 11 | 272 | 0 |
| `Data_Email` | 47 | **98** | 0 |
| `Data_WhatsApp` | 35 | 12 | 0 |
| `Data_Qcart_Carritos` | 31 | **2,645** | 0 |
| `Data_Qcart_Productos` | 32 | **696** | 0 |
| `Reporte_julio` | 58 | 44 | 47 |
| `Exclusiones` | 1 | 14 | 0 |
| `Sheet1` | 5 | 7 | 0 |

### 4.2 El catálogo

> 🆕 **Reemplazado por la Parte A (A.1).** Hoy: **157 piezas · 68 columnas · 0 `POR DEFINIR`**; ya no hay filas de notas a mano
> (157 filas = 157 `Pieza_ID`) y existe la hoja `Catalogo_Links`. Lo de abajo es del 8-sep.

- **126 `Pieza_ID` distintos**, cero identidades duplicadas
- 130 filas con dato = 126 piezas + **4 filas que son notas a mano de Rick** (sin llave, una sola
  celda cada una, en `TouchPoint`): *NOTAS CATALOGO VARIOS DATOS YA ESTABAN* · *REVISAR A DETALLE
  QCART* · *ATRIBUCIÓN DE CLICKS Y AGRUPACIÓN* · *CADA COSA POR SEPARADO*
- 82 columnas (se retiraron 4: `ID_SFMC`, `Asset_ID`, `Camp_ID`, `Journey_ID`)

| Campaña | Piezas |
|---|---:|
| AON | 33 |
| Hotcakes | 24 |
| Mundial | 20 |
| Fuel for life | 17 |
| Liga MX | 9 |
| Tercer Tiempo | 8 |
| Hackea tu café | 7 |
| The Freshers | 6 |
| Antojo Infinito | 2 |
| **Total** | **126** |

### 4.3 Los bloques del backend (la verdad de las cifras)

| Bloque | Contenido |
|---|---|
| `email.json` | **104 envíos** · Σ **8,937,524** sends |
| `qcart.json` | **2,769 carritos** · **786 productos** |
| `whatsapp.json` | **12 envíos** · Σ **14,643** |
| `manual.json` | 0 registros |

🔴 **Los bloques y las hojas de datos NO coinciden.** Ver §8 · defecto **D1**.

### 4.4 El reporte
`Report_Resumen` · 78 columnas · 82 filas de dato (81 de campaña + 1 de totales al final).

Bloques de columnas: identidad (A–N) → **Principal** (O–AC) → **FUP** (AD–AS) → **Total** (AT–BC)
→ **WhatsApp** (BD–BL) → **Qcart** (BM–BY) → **Insights** (BZ).

Cada bloque de email lleva sus 5 métricas + 5 tasas, incluyendo las **9 columnas de unsubscribe**
(`Principal_`/`FUP_`/`Tot_` × conteo + `Unsub_Rate (vs sends)` + `UTOR (vs opens)`) y las
**2 de fecha de envío** (`Principal_Fecha_Envio`, `FUP_Fecha_Envio`), a la izquierda de cada Subject.

Verificado contra SFMC, no contra la rejilla: Principal **32,960** · FUP **16,224** · Total **49,184**.

### 4.5 El código

| | |
|---|---:|
| archivos `.js` en `_scripts/` | **173** |
| librerías compartidas (`lib-*.js`) | **31** |
| scripts (no librería) | **142** |
| … con nombre `<skill>.<verbo>.js` | 137 |
| … heredados de la era Datorama (`N2a-*`, retirados) | 5 |
| **scripts con turno en la cadena** | **23** |
| etapas | **17** |
| skills | **12** |
| scripts huérfanos (sin skill dueño) | **0** ← si aparece uno, la cadena se detiene |

Por prefijo: `catalogo` 37 · `orquestador` 36 · `fuentes-qcart` 14 · `escritor` 11 · `resumen` 9 ·
`fuentes-cuadre` 7 · `fuentes-whatsapp` 5 · `fuentes-manual` 5 · `motor` 4 · `fuentes-insumos` 4 ·
`fuentes-email` 4 · `insights` 1.

### 4.6 La cadena, etapa por etapa
Declarada en `_contratos/cadena-skills.json` (versión 3). **No es «un skill = un tramo»**: manda el
orden real de ejecución.

| # | Skill | Scripts |
|---|---|---|
| 1 | escritor | `escritor-neutralizar` → `escritor.neutralizar-muertas.js` |
| 2 | fuentes-insumos | `insumos-validar` → `fuentes-insumos.insumos.js` |
| 3 | fuentes-qcart | `qcart-activacion` → `fuentes-qcart.activacion-qcart.js` |
| 4 | **nestle-catalogo** | `catalogo-leer` → `catalogo.leer-correcciones.js` · `catalogo-aplicar` → `catalogo.corregir-catalogo.js` |
| 5 | fuentes-email | `email-bloque` → `fuentes-email.email-piezas.js` |
| 6 | fuentes-qcart | `qcart-bloque` → `fuentes-qcart.qcart.js` |
| 7 | fuentes-whatsapp | `whatsapp-bloque` → `fuentes-whatsapp.whatsapp.js` |
| 8 | fuentes-manual | `manual-bloque` → `fuentes-manual.manual.js` |
| **9** | **fuentes-cuadre** | 🚪 **PUERTA 1** → `fuentes-cuadre.cuadre.js` |
| 10 | escritor | `escritor-datos` → `escritor.escribir.js` · `escritor-formato-datos` → `escritor.formato.js` |
| 11 | motor | `motor-clicks` → `motor.links.js` · `motor-calculo` → `motor.motor.js` · `motor-rejilla` → `motor.links-a-rejilla.js` |
| 12 | resumen | `resumen-fusionar` → `resumen.fusionar-fup.js` · `resumen-regenerar` → `resumen.regenerar.js` |
| 13 | nestle-insights | `insights-redactar` → `insights.insights.js` |
| 14 | escritor | `escritor-formato-resumen` → `escritor.formato.js` |
| 15 | orquestador | `vacios-medir` → `orquestador.medir-vacios.js` |
| 16 | escritor | `vacios-llenar` → `escritor.aplicar-vacios.js` |
| **17** | **fuentes-cuadre** | `cuadre-coherencia` → `fuentes-cuadre.normalizador.js` · 🚪 **PUERTA 2** → `fuentes-cuadre.puerta2.js` |

**Por qué ese orden, en tres frases:** el catálogo va antes que las fuentes porque es su autoridad de
dimensiones · el motor va después de escribir porque calcula sobre lo escrito · el formato del
Resumen va al final porque la etapa 12 **regenera** la hoja y se llevaría cualquier ancho puesto antes.

---

## 5 · Las decisiones de negocio — cerradas

> Estas son las que **no se deducen**. Si una fuente contradice a una de estas, gana la decisión y
> se declara que la fuente está mal.

### 5.1 Modelo dimensional
- **BU ≠ MARCA ≠ CAMPAÑA.** BU = RN / Nescafé / Purina. La marca admite multi-valor
  (Hotcakes → «Carnation, La Lechera»). La campaña **nunca** es la marca: La Lechera → *Antojo
  Infinito* · Pro Plan → *Fuel for life* · Maggi → *Mundial*.
- **El segmento nunca es el nombre del objetivo.** `Inspiration` → segmento real **Interés Salado**;
  `AON-APP` → **Activos**; `AON-LOYALTY` → **Usuarios con Engagement**.
- **20-ago:** *The Freshers* es la **CAMPAÑA**; **ICE** es la marca (Nescafé ICE). *PAE* se descarta.
  La pieza de WhatsApp `010-P001` se movió a esa campaña como `006-P003`; la campaña 010 desapareció.
- **8-sep:** el **Objetivo de The Freshers es `Purchase`**. `Objetivo` quedó 138/138.
- 🔴 **Los nombres de journey no son inferibles.** El WA `O_Welcome-NC007067` es *Purchase*, no
  *Welcome*. Se pregunta; lo no confirmado se marca, nunca se adivina en silencio.
- 🔴 **Si el touchpoint y el segmento chocan, gana el SEGMENTO** — y se declara que el alias está mal.

### 5.2 Identidad y llaves
- **IDs anclados a la campaña**: `CMP-004` · `004-J003` · `004-P007`. El correlativo vive **dentro**
  de la campaña, así una campaña nueva no mueve los ids de otra. El touchpoint **no** va en el id
  (si se renombra la pieza, el id dejaría de ser ancla). `registro-ids.json` es **append-only**.
- 🆕 **4-nov · la llave de una pieza es su NOMBRE según el canal** (`Email_Name` si es email, `Whatsapp_Name` si es WhatsApp); `Pieza_ID` es
  solo una etiqueta; **una celda de llave lleva UN nombre** y los demás son alias en la columna de variantes. Y los links de Qcart tienen
  su propia llave: `(Shortlink, Fecha_Activacion)`. **Detalle y razones en A.3.**
- ~~**`Email_Name` es la llave natural** de una pieza — única, probada.~~ *(8-sep; la regla vale, pero ya no solo para email.)*
- **`Pieza_Principal_ID`** declara FUP → Principal. Deducirlo falla: el FUP sale en otra quincena.
- **La llave de una fila del reporte** es `Campaña + TouchPoint + Segmento + Objetivo + Quincena del
  Principal`, y **agrega piezas**: no es única, y eso está bien. El defecto sería una llave
  *incompleta*, no la agregación.
- 🔴 **8-sep · UNA LLAVE DE IDENTIDAD NO PUEDE LLEVAR UNA MÉTRICA.** La llave de existencia de Pro
  Plan era `campaña·mascota·emailId·**sends**`; al limpiar los correos de prueba (19,213 → 19,206)
  dejó de casar, el paso las leyó como nuevas y **recreó 11 de las 12 gemelas recién borradas**.
  La llave correcta: **campaña · mascota · id del creativo**, con los envíos solo de respaldo y
  exigiendo que una candidata gane CLARO (diferencia ≥ 2).
- **La escalera de alias** (`lib-alias.js`): canónico → campaña·segmento → campaña → utm → global →
  **frena**. Un alias es **contextual**, nunca global.

### 5.3 Tiempo
- **Quincena canónica `AAAA-MM-Qn`**: día 1–15 = Q1, 16–fin = Q2. Antes convivían dos formatos y
  **0 de 86 filas cruzaban**.
- 🔴 **La fecha es de la PIEZA** (mín. `Send_Date`), **nunca la del journey** — con la del journey,
  17 piezas caían en otra quincena.
- 🔴 **7-sep · la fecha de envío sale del DETALLE, no de la DE agregada.** `Fecha_Primer_Envio` de
  `CRM_Email_Piezas` incluye los jobs de prueba: para `E-PROP1` decía 3-ago por cuatro jobs de UN
  envío, cuando el envío real arrancó el **24-ago** (21 días de diferencia). Medido sobre las 104:
  64 coincidían, **40 adelantadas por una prueba, 0 al revés** — esa dirección uniforme es lo que
  prueba que era contaminación.
  Tres reglas: vacía se llena · anterior al real se corrige · **posterior al real NO se toca**
  (6 celdas de AON con `2026-04-30` idéntico en las 12 piezas = un cierre de periodo, no una fecha).
- 🔴 **La quincena no se movió sola.** Corregir las fechas cambiaba de periodo a 19 piezas, y eso
  mueve filas del reporte → se declaró y se aplicó a propósito, no se arrastró.
- 🔴 **El periodo es de la PIEZA, no de la hermana.** Heredar `Quincenas_Activas` / `N_Quincenas` /
  `Dias_Envio` de una hermana «porque coinciden» es derivar por parecido. Se calculan de **sus
  propios días** del detalle: 454 celdas.
- **Una pieza AON manda en VARIAS quincenas** (18 cruzan): 3 niveles de columnas — ANCLA / ACTIVIDAD
  / REPARTO.

### 5.4 Los jobs de prueba
- Un **job** es un disparo de envío en SFMC. En esta BU conviven jobs reales con jobs de **1 correo**
  (alguien se lo manda a sí mismo para revisarlo): **202 jobs = 203 envíos**.
- Contaminaban la **fecha** y las **métricas**: 200 opens, **93 clicks de 38,914 = 0.24%**; en una
  pieza chica movían la apertura **7.65 pp**.
- 🔴 **El criterio de «prueba» vive en UN solo lugar** — `lib-fechas-envio.js`, umbral **< 10
  envíos** — y lo usan la fecha *y* la resta. Dos criterios habrían hecho que la fecha dijera 24-ago
  mientras las métricas contaban el 3-ago.
- Antes de restar se comprueba que el detalle **cuadre exacto** con la agregada en las 7 métricas, y
  la resta se verifica contra una medición independiente **o el paso falla**.
- Σ sends **8,937,727 → 8,937,524** (−203). Opens −200 · clicks −93 · unsubs −1.

### 5.5 Qcart

> 🆕 **4-nov · Qcart se separó del catálogo de piezas: tiene su propia hoja, `Catalogo_Links`** (A.3 y A.6). El shortlink sigue siendo la llave
> —ahora con la **fecha de activación**—, la tienda sale del propio Qcart (`chedraui+walmart` cuando un link sirve a las dos) y un link
> que no se envió lleva `N/A` en la fecha y su estado dice por qué. Lo que sigue es del 8-sep y **sigue valiendo**.
- 🔴 **La llave es el SHORTLINK, nunca el utm.** `utm_content`/`utm_term` vienen **invertidos** en
  parte de las filas; usarlos mandó **171 carritos de Cooking a Botana** con la suma cuadrando.
- **Cada bloque del doc de links (MES × campaña × touchpoint × audiencia) ES una pieza.**
- **El grano en el reporte es TOUCHPOINT × SEGMENTO**; la quincena es solo el ancla temporal.
  Agrupar a un solo segmento borra la comparación que el reporte existe para dar — **y cuadra igual**,
  así que ninguna puerta lo ve.
- 🔴 **El ancla se pega a una celda que YA EXISTE, nunca fabrica una.**
- **Penetración Nestlé = productos matcheados / carritos**, y es un **piso honesto**: el doc de
  productos solo itemiza ~8% del carrito. No se maquilla hacia arriba.
- **Cap anti-sobreatribución:** la intención Nestlé nunca puede superar la total en una fila.
- Cualquier ratio > 100 % = **dato inflado en la fuente**, no amplificación → es un flag de calidad
  para revisar con Qcart, no un multiplicador que reportar.

### 5.6 WhatsApp
- **Hoja propia** (`Data_WhatsApp`), nunca dentro de `Data_Email`: 836 fórmulas tocan `Data_Email` y
  ninguna filtra canal. En los reportes entra como **filas separadas por canal**.
- 🔴 **El CTOR de WhatsApp no siempre es un dato.** En *Tercer Tiempo* los clicks **no están
  medidos**: la fuente los deriva de `Read × un CTOR asumido` (12 %). Los de *Hotcakes* sí son
  reales. Se distingue siempre con la columna **`Clicks_Medidos`**, y un derivado **nunca** se
  reporta como resultado ni se compara contra benchmark.

### 5.7 Unsubscribe
- **9 columnas**: `Principal_` / `FUP_` / `Tot_` × conteo + `Unsub_Rate (vs sends)` +
  `UTOR (vs opens)`.
- El hallazgo que las justifica: el FUP se ve **igual** sobre envíos y **3× peor** sobre aperturas
  (**4.60 % vs 1.47 %**). Esa diferencia solo aparece con el segundo denominador.

### 5.8 Insights
- **IQS determinista**, umbral 60, máximo 2 acciones por celda. Si nada pasa el umbral escribe
  **«sin acción prioritaria»** — nunca inventa una para llenar.
- ⛔ **No forzar mejor/peor.** Si OR y CTOR se contradicen, **esa discrepancia es el insight**.
- ⛔ **Benchmark por Campaña × OBJETIVO**, jamás cruzando journeys (*Inspiration* abre naturalmente
  más que *Purchase*).
- **La acción abre con un VERBO**, no con una etiqueta, y va numerada.
- Intención: **número Y porcentaje**, nunca solo el porcentaje.

### 5.9 Los tres estados de una celda

> 🆕 **Reemplazado por A.4.** Hoy no son tres: están `NO SE ENVIO`, `LINK NO USADO`, `ENVIADA`, `PROBLEMA DE DATOS`, el blanco **solo** en datos
> por medir y «Declarado por Rick · fecha»; y **ya no puede quedar** `POR DEFINIR`, `PENDIENTE`, `POR ACTUALIZAR` ni «por confirmar».
> Lo de abajo es del 8-sep.

`valor` · **`N/A`** (no aplica — solo si se puede *escribir* la razón) · **`POR DEFINIR`/`PENDIENTE`**
(aplica y falta). 🔴 Mezclarlos reportaba **5,923 «huecos»** que no significaban nada.

---

## 6 · Reglas de operación innegociables

### 6.1 Del cliente y del archivo
1. 🔴 **NO PIERDAS LO QUE YA ESTÁ ATRIBUIDO** — ni por peso del archivo, sino por validación real.
2. 🔴 **No rompas lo que está; esto es ir agregando datos.** (Rick, textual.)
3. 🔴 **Rick edita los entregables a mano. LEER EL ARCHIVO ANTES DE ESCRIBIRLO, no después.**
   Si quitó filas, movió celdas o cambió textos, **fue a propósito**. Diffear *después* ya no sirve:
   para entonces su trabajo ya se perdió. Herramienta: `orquestador.que-cambio-rick.js` (diffea por
   **nombre de encabezado** y lee aunque Excel lo tenga abierto).
4. 🔴 **El ORDEN de las filas del reporte es de Rick.** `resumen.regenerar.js` lee la posición de
   cada fila **en su hoja** y solo lo nuevo va al final.
5. 🔴 **El formato lo edita Rick.** No se deciden anchos ni colores; lo obligatorio es **no
   destruirlos**. (Excepción autorizada: los formatos numéricos de las 9 columnas de unsub.)
6. 🔴 **Publicar a producción SIEMPRE necesita el OK explícito de Rick**, después de que él valide.
   El QA técnico no lo sustituye: Node no recalcula fórmulas ni ve el render.
7. **Preguntar antes de**: borrar más de ~100 MB, tocar archivos de cliente, o cualquier cosa
   difícil de revertir.
8. 🔴 **R14 · El MCP de SFMC es de SOLO LECTURA.**

### 6.2 De escritura
- **E1 · Medir todo → decidir todo → escribir una vez.** Ningún paso escribe para averiguar. La
  medición deja su tabla en `_preescritura/` y se revisa **antes** de tocar el Excel.
- 🔴 **E2 · Se arregla al CREADOR, nunca al heredero.** Borrar 12 filas sin tocar al que las crea es
  cómo este catálogo creció de 131 a 347 en 17 corridas.
- **E3 · Fusionar antes de retirar**, siempre.
- **E4 · Tras escribir, releer del disco y comparar por NOMBRE** — nunca por letra ni por índice.
- **L1 · Una columna se PIDE, no se escribe** (`lib-columna.de()` resuelve o truena). Hay un hook
  que rechaza un script que lea por literal una columna que ya mordió.
- **L2 · Un cero no es un vacío.** La librería nunca devuelve `''`: si no resuelve, se detiene.

### 6.3 Después de CADA escritura a un `.xlsx` — **las 5 capas, en orden**
```
xlsx-safe-save.js  →  xlsx-label.js  →  xlsx-check.js  →  xlsx-validar-fondo.py  →  xlsx-orden-celdas
```
🔴 **La quinta no es opcional**: las otras cuatro pasaron sobre un libro que Excel se negaba a abrir;
lo único malo era el **orden de las celdas dentro de cada fila**.
**Sin las 5, no se dice que quedó bien.**

### 6.4 Cómo NO engañarse validando
- 🔴 **El render rompe los círculos.** `Data_WhatsApp` pasó **19 checks en verde** con 14 de 26
  envíos mal, porque la auditoría comparaba el bloque contra sí mismo y ambos salían del mismo lector
  equivocado. **Mirar el PNG** (`xlsx-render.py`).
- 🔴 **Que un guardián salga verde no prueba que mire.** A cada guarda se le **planta su defecto**
  sobre una copia y se le exige que bloquee. Así se vio que una no reconocía `execFileSync(` y salía
  verde con el señuelo delante.
- 🔴 **Un mapeo se PRUEBA donde los dos lados ya tienen valor.** Cero solapamiento ≠ aprobado.
  Rechazó `Content_ID ← ConfigKey` (es el Pieza_ID), `Journey_ID ← Journey_ID_Datorama` (otro espacio
  de ids) y `Asset_ID ← Email_ID` (863587 idéntico en las 12 de AON = es del journey).
- 🔴 **La prueba que no es circular: SIMULAR el nodo siguiente.**
- **«0 celdas que cambiarían» NO se lee como «ya está bien».**
- **El seco miente**: 31 pasos en verde en seco; al escribir de verdad y mirar salieron **11 defectos**,
  ninguno lo encontró un check.

### 6.5 Trampas de la máquina (ya costaron daño real)
| Trampa | Qué pasó |
|---|---|
| 🔴 **Backticks en un mensaje de `git commit` desde bash** | bash los ejecutó **dentro** del mensaje y **borró 109 archivos** del working tree. Para citar código en un commit: comillas simples o nada. |
| 🔴 **Heredoc del tool Bash para escribir un `.js`** | colapsa `\\` → `\` **en silencio**, aunque el delimitador esté entrecomillado. Usar el tool **Write**. |
| 🔴 **JSON escrito con PowerShell** | mete **BOM** y **doble-codifica acentos** (`Librería` → `LibrerÃ­a`). Usar Node. |
| 🔴 **`git checkout -- .`** | destruye el trabajo modificado sin commitear. Restaurar **archivo por archivo**. |
| 🔴 **Dos sesiones corriendo la cadena a la vez** | comparten los temporales (`~/_fmt.xlsx`) y una pisa a la otra. |
| ⚠ **OneDrive con el Excel abierto** | revierte las escrituras, y hasta los respaldos. Guardar copia **fuera** de OneDrive y **releer** tras escribir. OneDrive **no** crea archivos `~$` → buscarlos da falsos negativos. |
| ⚠ **Rutas OneDrive con acentos** | Node/`xlsx` falla al leerlas. Copiar a una ruta ASCII del home, trabajar ahí, y copiar de regreso. Nunca hardcodear el username. |

---

## 7 · Cómo correr un corte

```bash
# el corte completo — las 17 etapas
node ~/.claude/reportes-backend/nestle/_scripts/orquestador.orquestador.js --escribir

# camino corto: rehacer solo el reporte
node ~/.claude/reportes-backend/nestle/_scripts/orquestador.orquestador.js --desde motor-calculo --escribir
```

Recorre las 17 etapas con sus validaciones y **se detiene en la primera que falla**: un corte a
medias es peor que ninguno.

> 🆕 **4-nov.** Hoy son **8 guardas** (la corrida del 4-nov: 14 verificaciones pasan · 3 avisan · **0 bloquean**; los avisos son deuda vieja:
> 57 scripts que leen columnas por literal y 86 herramientas fuera del corte). Y las **rutas de estos comandos son las del 8-sep**: hoy el backend
> está en `Sistema-Reportes-CRM/Sistema/` y se corre desde ahí (`lib-entorno.js` resuelve las rutas). **No se corrió la cadena el 4-nov.**

**Antes de la etapa 1 corren solas las 5 guardas del preflight** (`orquestador.guardas.js`), cableadas
dentro del orquestador — no hay que acordarse:

| Guarda | Veredicto |
|---|---|
| 1 · destructivo sin skill | avisa |
| 2 · **id duplicado** | 🔴 **detiene el corte** |
| 3 · lectura por literal | avisa |
| 4 · **script suelto del catálogo raíz** | 🔴 **detiene el corte** |
| 5 · **escribir sin haber declarado** | 🔴 **detiene el corte** |

**Los tres veredictos, y solo uno detiene:** `BLOQUEA` (probado, con el caso en la mano) ·
`AVISA` (viaja al handoff) · `NO PUDE EVALUAR` (se declara ruidosamente y **no cuenta como pasar**).

**Publicar es un paso aparte, fuera de la cadena a propósito:**
```bash
node ~/.claude/reportes-backend/nestle/_scripts/orquestador.publicar.js   # exige el OK de Rick
```

---

## 8 · Pendientes

### 8.1 🔴 Defectos abiertos — verificados el 8-sep, ninguno lo ve una puerta

**D1 · Las hojas de datos van un corte atrás de los bloques.** *(nuevo, encontrado al escribir este
handoff)*

| Hoja | Tiene | El bloque tiene | Falta |
|---|---:|---:|---:|
| `Data_Email` | 98 | **104** | **6 piezas** |
| `Data_Qcart_Carritos` | 2,645 | **2,769** | **124 eventos** |
| `Data_Qcart_Productos` | 696 | **786** | **90 productos** |

Las 6 piezas que existen en el bloque y en el catálogo pero **nunca llegaron a `Data_Email`**:
`005-P007` · `005-P008` · `005-P009` (Liga MX) · `006-P006` (The Freshers) · **`001-P032`** ·
**`001-P033`** (AON).

**Causa:** `escritor.escribir.js` **empareja registros del bloque contra filas que ya existen** y
cuenta las demás como `sin pareja` — **no crea filas nuevas**. Su declaración
(`DECL-escritor.escribir.json`, del 26-ago) todavía dice *«98 filas · ~2,645 · ~696»*, exactamente lo
que hay en las hojas hoy.

**Por qué ninguna puerta lo ve:** la PUERTA 1 cruza *bloques contra catálogo* (los dos al día); la
PUERTA 2 cruza *reporte contra rejilla* (los dos construidos desde los bloques). **Nadie compara las
hojas de datos contra los bloques.** Es la misma familia que «un skill de fuente entiende de dónde
lee, pero no a dónde escribe».

**El reporte NO está mal**: la PUERTA 2 midió `8,937,524 == 8,937,524` y `82 filas == 82 celdas`, y
esas cifras vienen del bloque. Lo que está atrasado es la **hoja cruda que el equipo consulta**.

**Qué hacer:** que el escritor **cree la fila** cuando el registro no tiene pareja, o declare
explícitamente que no lo hace y quién sí. Arreglar **al creador**, no a la hoja (regla E2).

---

> 🆕 *4-nov: `Catalogo_Piezas` ya no tiene filas de notas (157 filas = 157 `Pieza_ID`). No se re-midió si `fuentes-cuadre.cuadre.js` cuenta bien.*

**D2 · El cuadre cuenta filas, no piezas.** `cobertura.piezas` de la PUERTA 1 dice **130** — que es
el número de **filas** de `Catalogo_Piezas`, no de piezas (**126**). Por eso 3 de las «13 piezas sin
tocar» son en realidad las **notas a mano de Rick**, que no son registros.

Es exactamente el defecto que ya se corrigió en `orquestador.medir-vacios.js` (guarda «una fila sin
llave no es un registro») y en `orquestador.guardian-no-perdida.js` (`ES_PIEZA`). **`fuentes-cuadre.cuadre.js`
todavía no lo tiene.** No cambia ninguna cifra del reporte; ensucia el aviso.

---

**D3 · `estado-reportes.md` estaba desfasado.** Decía «v7 · WK31 · julio» el 8-sep. Es el archivo del
que el orquestador saca su diagnóstico. Corregido para apuntar aquí; **mantenerlo al día sobre la
marcha, no al cerrar**.

---

**D4 · Dos escritores conviven** (deuda declarada, no nueva): `escritor.escribir.js` escribe las
hojas de datos por su cuenta y `escritor.escribir-todo.js` aplica lo que todos apuntan. Contradice la
doctrina de un solo escritor.

### 8.2 Decisiones que solo puede tomar Rick

| # | Decisión | Contexto medido |
|---|---|---|
| **R1** | **Publicar a producción** | El productivo está en **17-ago**. 🔴 **NO es una copia**: el destino tiene **18 hojas que el interno no tiene** (`Report_Mensual`, `Report_Campana+Qcart`, `Report_CompletoQcart`, `Report_Insights_Operativo`, `Data_Qcart`, `Catalog_Campanas`, los `Protocol_IA_*`, `Control_IA_*`…) y el interno tiene **5 que el destino no** (`Catalogo_Piezas`, `Catalogo_Referencias`, `Data_Qcart_Carritos`, `Data_Qcart_Productos`, `Reporte_julio`). Copiar encima **perdería 18 hojas del cliente**. El paso ya lo bloquea con ese motivo: *«hace falta copia hoja por hoja»*. **Decisión: ¿migramos el productivo a la arquitectura nueva, o se publica hoja por hoja?** |
| **R2** | **Las 175 celdas de QCART** | 27 piezas reales cuyo bloque el maestro no tiene (mes no vigente o sin fecha). Las cierra `Qcart-Links Mails-Hive- MX.xlsx`, no el sistema. |
| **R3** | **El blast de `E-PROP1` del 2-sep** | Pregunta para **operación**, no defecto: el total **no está duplicado** (1,495,829 idéntico en las 4 capas). Es **un solo job** (1292673) y **2-sep = 1,172,646 envíos en un día** = 88 % del volumen, contra 951/día el resto. Audiencia 1,876,482 → se mandó al **71.3 % de la base**. OR **1.48 %** contra **37.0 %** de las otras 16 piezas de AON. **¿Estaba planeado?** |
| **R4** | Semántica de `Fecha_Ultimo_Envio` | ¿último envío real, o cierre de periodo? Hoy 98/104. |
| **R5** | `006-P001` / `006-P002` | SFMC reporta **menos** que el catálogo. ¿Se rebasa o se investiga? |
| **R6** | `009-P001` · `Email_ID` **83347 vs 83356** | dos ids para la misma pieza. |
| **R7** | Ruta del **Reporte de Seguimiento** | sin ella, ese destino no se publica. Nunca se ha dado. |
| **R8** | Borrar las 2 hojas `Soporte_IA_*` | pendiente desde el 24-ago. |
| **R9** | `Sheet1` y `Exclusiones` | 7 y 14 filas. ¿Se quedan? |

### 8.3 `POR DEFINIR` — 357 celdas, agrupadas por **quién las puede cerrar**

> 🆕 **4-nov: en `Catalogo_Piezas` hay 0 `POR DEFINIR`** (se cerraron las 149 de la limpieza del 29-oct y los pendientes restantes se
> resolvieron o se dejaron **en blanco por ser datos por medir**; ver A.4). Los 22 `PENDIENTE` que quedan están en las 26 columnas de Qcart.
> Este conteo de 357 es del 8-sep y se refería a **todas** las hojas; no se re-midió fuera del catálogo.

| Grupo | Celdas | Quién lo cierra |
|---|---:|---|
| **QCART** | **175** | el maestro `Qcart-Links Mails-Hive- MX.xlsx` |
| **SFMC** | **88** | SFMC — pero **solo si la pieza tiene envíos ahí** |
| **PERIODO** | **68** | el detalle día por día de SFMC |
| **PROCEDENCIA** | **24** | el propio sistema, al cargar la pieza |
| **DIMENSIÓN** | **2** | 🔴 **RICK** — se declara, no se deduce (`Oleada`) |

Recorrido: **971 → 357**. Columnas más pendientes: `N_Envios_Fechados` 30 ·
`Fecha_Activacion_Qcart` 23 · `Activaciones_Qcart` 23 · `Codigo_NC` 20 · `Clicks_Medidos` 18 ·
`Carritos_Total` 18 · `Views_Total` 18 · `Tipo_Envio` 17.

🔴 **De los que quedan, ninguno tiene fuente real** — solo hermanas que coinciden. **No se llenan.**

### 8.4 Piezas sin datos de ningún bloque (13, del aviso de la PUERTA 1)
`004-P011` · `004-P012` · `004-P014` · `004-P015` · `004-P016` (Mundial WhatsApp) ·
`005-P001` · `005-P002` · `005-P003` · `005-P004` (Liga MX Email) · + 3–4 que son las notas a mano
(ver D2). **Puede que aún no tengan envíos** — no impide escribir las demás.

---

## 9 · Cómo re-medir todo esto

```bash
# el estado real del workbook — hojas, filas, columnas, fórmulas
node ~/.claude/tools/xlsx-q.js "<archivo vivo>"

# los guardianes: de aquí salen las CIFRAS, no de este documento
node ~/.claude/tools/reportes/correr-guardianes.js "<archivo vivo>" --texto

# coherencia entre agentes, contratos y guardianes
node ~/.claude/tools/reportes/auditar-agentes.js --texto

# el catálogo, con su refutador
node ~/.claude/reportes-backend/nestle/validar-catalogo.js

# qué cambió Rick a mano (lee aunque Excel lo tenga abierto)
node ~/.claude/reportes-backend/nestle/_scripts/orquestador.que-cambio-rick.js

# rastrear una pieza por las 4 capas: SFMC → bloque → rejilla → reporte
node ~/.claude/reportes-backend/nestle/_scripts/resumen.rastrear-pieza.js <Pieza_ID>

# mirarlo de verdad
python ~/.claude/tools/xlsx-render.py "<archivo vivo>" salida.png
```

> 🆕 **Para el catálogo, los comandos de re-medición están en A.12** (validador, restricciones sobre el libro vivo, señuelos, auditoría de shortlinks).

**Los veredictos vivos, en disco:**
- PUERTA 1 → `~/.claude/reportes-backend/nestle/_fuentes/veredicto.json`
- PUERTA 2 → `~/.claude/reportes-backend/nestle/_rejilla/veredicto-puerta2.json`
- última corrida → `~/.claude/reportes-backend/nestle/_orquesta-bitacora.json`
- `POR DEFINIR` → `~/.claude/reportes-backend/nestle/_preescritura/informe-por-definir.json`

---

## 10 · Documentos hermanos

| Documento | Para qué |
|---|---|
| `_orquesta/estado-reportes.md *(solo en local, la usan los skills rick-reportes-* que no migraron)*` | el estado que lee el orquestador para su diagnóstico |
| `_orquesta/publicacion-reportes.md *(solo en local, la usan los skills rick-reportes-* que no migraron)*` | destinos, gates y guardián de llegada |
| `_orquesta/autoridades-reportes.md *(solo en local, la usan los skills rick-reportes-* que no migraron)*` | quién manda sobre cada dimensión |
| `_orquesta/mapa-cadena-skills.html` | el mapa visual de la cadena |
| `_orquesta/que-vale-este-sistema.html` | qué vale el sistema, con los diagramas de fuentes y skills |
| 🆕 `Sistema/_contratos/catalogo-decisiones-2026-10-29.json` · `…-2026-11-04.json` | las decisiones del catálogo, cada una con quién la dijo y su evidencia (Parte A) |
| 🆕 `Sistema/_orquesta/plan-modelo-catalogo-2026-10-30.md` | el plan de 6 etapas del modelo de llaves y `Catalogo_Links`, con su estado al 4-nov |
| `que-vale-este-sistema.html` *(en esta misma carpeta, **sin actualizar**: es del 8-sep)* | qué vale el sistema, con diagramas |
| `~/.claude/reportes-backend/nestle/CATALOGO.md` | el catálogo raíz, completo *(del 8-sep)* |
| `~/.claude/rick-reportes/validar-sin-enganarse.md` | los aprendizajes de validación |
| `~/.claude/rick-reportes/doctrina-de-escritura.md` | las 5 reglas de escritura |

---

*Generado el 8-sep-2026 midiendo contra disco; **Parte A y avisos 🆕 añadidos el 4-nov-2026** con lo que se hizo y verificó en el
catálogo (no se re-midió el resto). Si una cifra de aquí no cuadra con lo que ves,
**gana lo que ves** — y corrige este archivo en esa misma sesión.*
