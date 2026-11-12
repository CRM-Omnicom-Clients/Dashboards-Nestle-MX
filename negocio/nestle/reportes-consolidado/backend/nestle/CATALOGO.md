# Catálogo raíz Nestlé — documentación de referencia

> **Qué es:** la capa que resuelve *qué es cada cosa* antes de que ningún reporte sume nada.
> Une SFMC (email), WhatsApp y Qcart alrededor de una sola entidad: **la pieza**.
> **Estado:** N1 cerrado · 17-ago-2026 · **8 suites en verde** — 5 de forma, el refutador, y 2 que
> prueban que el paso siguiente (N3) puede construirse encima.

**Cómo se valida — un solo comando, y el refutador corre siempre:**

```bash
node ~/.claude/reportes-backend/nestle/validar-catalogo.js
```

---

## 1 · Dónde vive cada cosa

| Qué | Dónde | Para qué |
|---|---|---|
| **El catálogo (dato)** | `_catalogo/catalogo.json` | la fuente de verdad. Lo consume el backend |
| **Registro de IDs** | `_catalogo/registro-ids.json` | `llave_natural → id`, **append-only**. Es lo que hace que un id nunca se mueva |
| **Librerías** | `_scripts/lib-ids.js` · `_scripts/lib-alias.js` | asignar ids · resolver alias. **Únicas. No escribir otro lookup** |
| **Pipeline** | `_scripts/P1…P6` | de las fuentes crudas al catálogo. Corre de cero |
| **Suites** | `_scripts/Z-*.js` | validación. Ver §6 |
| **Entrada única** | `validar-catalogo.js` | corre las 8 suites y da un veredicto |
| **Salida visible** | `(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx` → hojas `Catalogo_Piezas` y `Catalogo_Referencias` | lo que Rick abre |
| **Esta doc** | `CATALOGO.md` (aquí) | el porqué de cada decisión |
| **Memoria de sesión** | `~/.claude/projects/<proyecto>/memory/catalogo-raiz-unificado.md` | lo que se carga solo al abrir sesión |

Todo está en **git** (`~/.claude`, rama `main`). `reportes-backend/` estaba en `.gitignore` hasta
el 17-ago: perder `registro-ids.json` es perder la estabilidad de todas las referencias.

---

## 2 · Las dos hojas

### `Catalogo_Piezas` — 96 filas × 74 columnas
**Una fila = una pieza = la verdad completa.** Las recetas viven DENTRO de la fila, en 5 bloques
`Receta_N · URL_Receta_N · Cod_Walmart_N · Carritos_Walmart_N · Cod_Chedraui_N · Carritos_Chedraui_N`.

🔴 **Por eso no existe el paso "resolver link → pieza"** — que fue lo que colgó 15 links de la pieza
equivocada. El error es estructuralmente imposible, no improbable.

Bloques de columnas, por color:

| Bloque | Columnas |
|---|---|
| **identidad** | `Pieza_ID · Camp_ID · Journey_ID` |
| **dimensiones** | `BU · Marca · Campaña · Objetivo · Touchpoint · Touchpoint_Raw · Segmento · Segmentos_Combinados · Canal · Email_Type` |
| **envío** | `Tipo_Envio · Fecha_Primer_Envio · Fecha_Ultimo_Envio · Mes_Lanzamiento · Quincena_Lanzamiento · Dias_Envio · Fuente_Dato · Clicks_Medidos · Sends` |
| **periodos** | `Quincenas_Activas · N_Quincenas · Meses_Activos · N_Meses · Sends_Por_Quincena · Sends_Por_Mes · N_Envios_Fechados · **Granularidad_Periodo** · Fecha_Origen` |
| **identificadores** | `Content_Name · Content_Names_Variantes · N_Content_Names · Asset_ID · Codigo_NC · ID_SFMC` |
| **Qcart** | `Tiene_Qcart · N_Recetas · Carritos_Total · Views_Total` + los 5 bloques de receta |
| **control** | `Estado · Fuente_Qcart · Notas` |

### `Catalogo_Referencias` — 265 filas × 11 columnas, formato alto
Columna `Tipo`: `vocabulario` (listas cerradas) · `alias` (grafía cruda → canónico) · `excluido`
(lo que NO entra, **con su motivo y su número**).

🔴 **Ancla literal a la otra hoja** — `N_Piezas` y `Pieza_IDs`. El ancla existía lógicamente y las
pruebas la verificaban, pero **no había columna**: abriendo la hoja no podías saltar a las piezas
que usan ese término. Un ancla que solo un script puede recorrer no le sirve a quien abre el
archivo. Hoy: 212 referencias ancladas · 53 con `N_Piezas=0` (declaradas y sin usar — eso es
visibilidad, no error) · **0 excluidos con piezas** (si lo hubiera, ese número se estaría contando
y descontando a la vez).

⚠ Un **alias se ancla por su CANÓNICO**, no por dónde está escrito el crudo: «e-botana1» → E-P1
puede no aparecer en ninguna pieza y aun así ser útil — su trabajo es llevarte a E-P1.

---

## 3 · Los IDs — anclados a la campaña

```
CMP-004        campaña
004-J003       journey   ← 004 = el número de SU campaña
004-P007       pieza     ← igual. El id DICE de qué campaña es.
```

**Por qué:** con un contador global (`PZA-00041`) cualquier alta empujaba a todos los siguientes.
Ahora el correlativo vive **dentro** de la campaña: 30 piezas nuevas de AON no mueven ni un id de
Mundial. Cada campaña tiene 999 lugares propios.

⚠ **El touchpoint NO va dentro del id, a propósito.** Si el id fuera `004-EP3-01` y la pieza se
renombra —pasó con `WA-P1` → `WA-1`— el id cambiaría, y un id que cambia deja de ser ancla.

**Llave natural de una pieza** (lo que la hace ser la misma cosa entre cortes):
`campaña · touchpoint · segmento · email_type · canal · touchpoint_raw`
El `touchpoint_raw` entra a propósito: lleva la fecha de los envíos de WhatsApp sin `utm_content`,
que sin ella colapsaban dos envíos distintos en una sola pieza.

---

## 4 · La escalera de alias — el orden ES la regla

| # | Peldaño | Ejemplo |
|---|---|---|
| 0 | ya es canónico (comparado **normalizado**) | `BOTANA` · `Botana ` · `botana` → `Botana` |
| 1 | **campaña · segmento** | AON `N/A` → `E-P4` si Career Focused, `E-P3` si New Parents |
| 2 | campaña | `Partido 1` → `E-P1` en Mundial |
| 3 | **utm (espacio de nombres)** | `botanas` → `Botana` (su `Contexto` es `utm_term`, no una campaña) |
| 4 | global | alias sin contexto |
| 5 | **NO RESUELVE → pendiente** | `e-bebida7` **frena**, no se inventa |

🔴 Al revés, un alias genérico tapa al específico. Y sin el peldaño 3, `botanas` no encontraba
`Botana` aunque el alias sí existía.
🔴 El peldaño 5 es el que importa: **un valor desconocido no entra con un canónico inventado.**

---

## 5 · Fechas y periodos — tres niveles, a propósito

Una pieza AON **no vive en una quincena**: manda durante semanas. **18 piezas cruzan de quincena y
17 de mes.** Con una sola columna, N3 mete todos sus envíos en la de lanzamiento y el reporte
quincenal miente sin avisar.

| Nivel | Columnas | Para qué |
|---|---|---|
| **ANCLA** | `Fecha_Primer_Envio · Quincena_Lanzamiento · Mes_Lanzamiento` | **una sola.** El carrito del mes cuelga de aquí UNA vez y no se dobla |
| **ACTIVIDAD** | `Quincenas_Activas · Meses_Activos · N_*` | **todas.** Donde de verdad mandó |
| **REPARTO** | `Sends_Por_Quincena · Sends_Por_Mes` | `2026-04-Q2:14972 ; 2026-05-Q1:39` — N3 abre una fila por periodo con SU volumen, sin inventarse el reparto |

**Escalera de la fecha**, de más preciso a menos — y `Fecha_Origen` dice cuál se usó:

```
1. Send_Date exacto de Data_Email             (75 piezas)  → granularidad dia
2. Send_Quincena declarada                    ( 1 pieza)   → granularidad quincena
3. fecha del journey                          ( 6 piezas)  → dia
4. la HOJA del documento maestro es un mes    ( 7 piezas)  → granularidad mes
5. nada → se declara en el Estado             ( 7 piezas: Mundial WA-P2/P3, 0 carritos)
```

🔴 **Antes de declarar que un dato no existe, agotar TODAS las columnas que lo llevan.** Declaré
`009-P005` como "sin fecha en la fuente" mirando solo `Send_Date`: la fila traía `Send_Quincena`.

### 5b · Granularidad — cuánta precisión hay de verdad

Tener el periodo no basta: hay que decir **con qué precisión**. La hoja "Julio" del maestro da el
MES, no la quincena — abrir esa pieza por quincena sería **fabricar precisión que no existe**.

| `Granularidad_Periodo` | Piezas | Qué puede hacer N3 |
|---|---|---|
| `dia` | 81 | abrir por quincena y por mes |
| `quincena` | 1 | por quincena y por mes |
| `mes` | 7 | **solo por mes** |
| `ninguna` | 7 | no entra en ninguna rejilla; va declarada en su Estado |

Peldaño final de la escalera: **la hoja del documento maestro ES un mes**. Recuperó 7 piezas y
**44 carritos** de Mundial WhatsApp que se perdían — el mes estaba escrito en `Fuente_Qcart`
("…· Julio · f13") y no lo usé. Es la tercera vez que el dato estaba y no lo busqué.

### 5c · El catálogo NO carga métricas, y está probado que no hace falta

Solo lleva `Sends`. Opens/Clicks viven en `Data_Email`. **Probado** (`catalogo.simular-tasas.js`): con la
llave del catálogo, N3 reparte las 4 métricas él mismo y cuadran al centavo contra Data_Email —
Sends 6,454,554 · Deliveries 6,393,051 · Opens 1,939,922 · Clicks 30,720.

🔴 Por eso **`Sends_Por_Quincena` es un CHECKSUM, no el dato**: prueba que la llave parte bien.
Si el catálogo cargara métricas, duplicaría Data_Email y se desincronizaría al primer refresh.

🔴 Y **la rejilla de N3 sale del PERIODO, no de los envíos**: 3 piezas de Mundial WhatsApp tienen
carritos y NO tienen envíos (el Qcart midió, Twilio no está cargado). Si la fila solo nace cuando
hay envíos, la venta desaparece — así se perdían los 44 carritos.

### La llave fila → pieza
```
campaña ¦ touchpoint ¦ segmento ¦ email_type ¦ ASSET_ID
```
- El **`ASSET_ID` es imprescindible**: AON mandó dos oleadas (`863587` y `803867`) con el mismo
  touchpoint y segmento. Sin él, dos piezas legítimas se fusionan.
- El **segmento hay que buscarlo también en `Segmentos_Combinados`**: Antojo Infinito tiene
  `Segmento = Combinado` y los tres reales viven en la otra columna.
- Verificado: **0 filas huérfanas · 0 filas en dos piezas · Σ del reparto == `Sends` en las 82**.

---

## 6 · Cómo se valida — y la trampa de los checks circulares

```bash
node ~/.claude/reportes-backend/nestle/validar-catalogo.js
```

| Suite | Tipo | Qué prueba |
|---|---|---|
| `Z-final` | mixta | 24 validaciones de cierre |
| `Z-prueba-uso` | 🟢 | cada fila de cada fuente cae en una pieza |
| `Z-prueba-crecer2` | ⚪ | entran piezas nuevas sin mover las viejas |
| `Z-prueba-alias` | ⚪ | la escalera no se confunde |
| `Z-prueba-anclas` | ⚪ | JSON == Excel == registro |
| **`Z-refutar`** | 🟢 | **ataca contra las FUENTES** |
| **`Z-simular-n3`** | 🟢 | **construye la rejilla de N3 usando SOLO el catálogo** |
| **`Z-simular-tasas`** | 🟢 | **prueba que la llave alcanza para OR y CTOR** |

🔴 Las dos últimas existen porque "tiene las columnas que N3 necesita" era otra forma de check
circular: comparaba el catálogo contra **mi propia lectura de mi propio plan**. La única prueba
real es construir la salida del paso siguiente y ver qué se rompe. Rompió dos cosas.

🔴 **LA TRAMPA:** un check ⚪ compara el catálogo **consigo mismo** (el Excel contra el JSON, cuando
el mismo script escribió los dos). Si el generador está mal, **los dos están mal igual y sale verde**.
Eran 6 de 11. Solo prueba algo lo que se contrasta contra el documento maestro de Hive, Data_Email,
Data_Qcart o Datorama.

**`Z-refutar` no busca confirmar: busca demostrar que está mal.** Con 5 suites en verde encontró:

1. 🔴 `Fecha_Primer_Envio` era la del **journey** aplicada a todas sus piezas → 39 fechas mal,
   **17 en otra quincena**, 3 en otro mes. Rompía el `mes_atribucion` de N3 y el anclaje del Qcart.
2. 🔴 Una fila del maestro puede traer **varias recetas en columnas** (Julio f8 tiene 3) y el parser
   guardó una: se perdían 2 recetas con sus códigos.
3. 7 códigos de envíos que no salieron, sin declarar — 0 carritos, pero desaparecían en silencio.
4. `Clicks_Medidos` no existía → N4 habría comparado el CTOR *asumido* de Tercer Tiempo
   (`Read × 12%`) contra un benchmark como si fuera medición.

> **REGLA: si un defecto pasó en verde una vez, se le deja un check permanente.**
> `Z-final` pasó de 16 a 24 validaciones. Y el propio refutador tenía un check en `false`
> hardcodeado: **un check que no mide nada es peor que no tenerlo.**

---

## 7 · Reglas que costaron un error cada una

- **Nunca atribuir con UNA variable.** Usar solo `shortlink_code` fusionó campañas y movió 186 carritos.
- **Las UTMs son otro espacio de nombres.** `utm_term` NO es el segmento: trae `consider` (objetivo)
  y `final` (partido). Nada se copia sin pasar por su alias.
- **La atribución se DECLARA a nivel journey**, no se lee del dato: leerla creaba campañas fantasma.
- **Nada se infiere del naming.** Objetivos, segmentos, campañas y marcas no se deducen: engañan.
- **El encabezado de una hoja se reconoce por CONTENIDO**, no por "la fila con más celdas" — en
  Marzo el encabezado tiene 21 celdas y la primera fila de datos 22.
- **Un pendiente es algo que me falta y necesito.** "El Partido 5 no se envió" es un hecho resuelto:
  va a `Estado` o a `excluido` con motivo, no a pendientes.
- **Chile fuera:** `jumbo-cl` y `santaisabel-cl` no son nuestro mercado.

## 8 · Las fuentes y su papel

| Fuente | Papel |
|---|---|
| `ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx` | **ATRIBUYE** los links. Hojas Marzo–Agosto. FUERA: Cuaresma · Reagendar · Borradores · Resultados |
| `Data_Maggi` (respaldo v7) | **AUTORIDAD de Mundial**: partido · canal · journey · códigos |
| `Data_Qcart` | **solo NÚMEROS**, cruzados por código. Su atribución está corrupta: no usarla |
| `Data_Email` · `Data_WhatsApp` | envíos y engagement |
| **Rick** | fuente declarada (`Fuente_Dato = manual`). Cuando él da el dato, él es la autoridad |

## 9 · Lo que sigue abierto (es de N2, no del catálogo)

- **673 carritos** de `Data_Qcart` en filas sin `shortlink_code`.
- **Mundial WhatsApp**: engagement sin cargar (Twilio + Google Analytics) — 10 piezas.
- **Liga MX**: email sin descargar — 4 piezas.
- **Datorama WK33** está en disco y es más nuevo que lo cargado.
- `Catalog_Campanas` no se puede retirar todavía: **1,142 fórmulas** la referencian.
