---
name: crm-reporte-escritor
description: La doctrina de escritura del sistema de reportes — prepara el libro, escribe las hojas de datos obedeciendo los contratos, y les da forma. Úsalo cuando haya que llevar los bloques del backend al Excel; nunca escribas una hoja de datos por fuera de este skill.
---

# El escritor · escritor-neutralizar · escritor-datos · escritor-formato-datos · escritor-formato-resumen

<!--@DECLARACION-->
## 🔴 Lo que este skill lee, lo que lo vigila y lo que le exigen

> Este bloque **se genera** desde el estado real del sistema con
> `orquestador.declarar-en-skills.js`. No se edita a mano: un bloque escrito a mano se
> desfasa en cuanto cambia una guarda — que es justo lo que le pasó al mapa de la cadena.

**Su turno:** etapas 1 · 10 · 14 · 16   ·   **7 script(s) de ejecución**   ·   **escribe al Excel**

**Contratos que lee**

- `_contratos/entorno.json`
- `_contratos/registro.json`

**Hooks que lo vigilan** — viven en `~/.claude/settings.json`, los dispara Claude Code sin que nadie los invoque

| Hook | Cuándo | Qué impide |
|---|---|---|
| `hook-xlsx-protocolo` | antes de `Bash` | antes de tocar un `.xlsx` por Bash, inyecta el protocolo de escritura |
| `hook-columna-literal` | antes de `Write|Edit` | rechaza escribir un script que lea por literal una columna que ya mordió |
| `hook-xlsx-vigilar` | después de `Bash` | después de tocar un `.xlsx`, comprueba que se corrieran las 5 capas |

**Lo que le exige el preflight** — las guardas corren solas antes de la etapa 1; ninguna depende de que alguien se acuerde

- **Guarda 1 · destructivo sin skill** — 🔴 **detiene el corte** por lo grave, avisa por lo demás
- **Guarda 2 · id duplicado** — 🔴 **detiene el corte**
- **Guarda 3 · lectura por literal** — avisa y viaja al handoff
- **Guarda 4 · script suelto del catálogo raíz** — 🔴 **detiene el corte** por lo grave, avisa por lo demás
- **Guarda 5 · escribir sin haber declarado** — 🔴 **detiene el corte**
- **Guarda 6 · una pieza es su nombre** — 🔴 **detiene el corte** por lo grave, avisa por lo demás
- **Guarda 7 · una ruta se pide, no se escribe** — 🔴 **detiene el corte** por lo grave, avisa por lo demás
- **Guarda 8 · el archivo vivo se llama como dice el contrato** — 🔴 **detiene el corte** por lo grave, avisa por lo demás
- **Guarda 9 · LAS DECISIONES YA TOMADAS** — avisa y viaja al handoff

🔴 **Este skill escribe**, así que la Guarda 5 le aplica de lleno: sin su declaración de
pre-escritura en `_preescritura/DECL-*.json`, con los cuatro campos, **el corte no arranca**.
<!--/@DECLARACION-->

```bash
node ~/.claude/reportes-backend/nestle/_scripts/escritor.neutralizar-muertas.js               # cuenta
node ~/.claude/reportes-backend/nestle/_scripts/escritor.escribir.js                          # solo DIFF
node ~/.claude/reportes-backend/nestle/_scripts/escritor.escribir.js --escribir               # escribe
node ~/.claude/reportes-backend/nestle/_scripts/escritor.formato.js --escribir                # hojas de datos
node ~/.claude/reportes-backend/nestle/_scripts/escritor.formato.js --hoja Report_Resumen --escribir
node ~/.claude/reportes-backend/nestle/_scripts/escritor.validar-contrato.js              # su suite
```

## Es UN skill con TRES etapas, y el orden no es negociable

| Etapa | Paso | Cuándo corre | Qué hace |
|---|---|---|---|
| **1** | `escritor-neutralizar` | al abrir el corte, **antes de nada** | vacía las fórmulas muertas |
| **10** | `escritor-datos` · `escritor-formato-datos` | después de la **PUERTA 1** | escribe las 4 hojas de datos y les da anchos |
| **14** | `escritor-formato-resumen` | después de que el **Resumen ya existe** | el mismo formateador, sobre el reporte |

**Por qué `escritor-formato-resumen` va al final y no con `escritor-formato-datos`:** el Resumen lo **regenera** `crm-reporte-resumen` en
la etapa 12. Cualquier ancho que se le ponga antes se pierde en esa regeneración. Estuvo así y el
resultado fue que sus 83 columnas nunca recibían ancho: **«Recetas Nestlé» se leía «cetas Nes»**.

## 🔴 No sabe de negocio. Obedece.

La traducción bloque→hoja vive en **`_contratos/hojas.js`**, no aquí. Este skill lee el contrato y
copia. Antes esa traducción era un `switch` de 20 casos **con dos copias**, y decidir en dos sitios
es cómo se separan.

Cada columna del contrato declara de dónde sale, y son cinco orígenes:

| | |
|---|---|
| `bloque` | lo trae el bloque de la fuente → **se escribe** |
| `catalogo` | sale de `Catalogo_Piezas` por `pieza_id` → **se escribe** (manda el catálogo) |
| `derivado` | se calcula de otra columna del propio bloque → **se escribe** |
| `n5` | es una tasa o un flag: los calcula el motor → **NO se toca** |
| `conservar` | la hoja lo tiene y ninguna fuente lo reproduce → **NO se toca, y se declara** |

## 🔴 Las cinco reglas que este skill existe para no romper

**1 · La llave se ancla a una celda que YA EXISTE.** Nunca a una que el propio escritor va a
fabricar. `Data_Email` se anclaba a `Email_Name` —una columna vacía que este skill llena— y
emparejaba **0 de 98 filas**. El paso salía en verde porque «0 celdas que cambiarían» se lee como
«ya está bien».

**2 · Llenar un hueco y PISAR un dato no son la misma operación.** El diff las cuenta por separado
y lista qué se perdería. Rick edita las hojas a mano: diffear **antes**, no después — después ya se
perdió.

**3 · Un dato que no se puede calcular NO autoriza a borrar el que está.** Una derivación sin fecha
devuelve `undefined` (no tocar), **nunca** `''`. Devolviendo cadena vacía, este skill iba a dejar
en blanco `Mes (#)` en 110 filas que lo tenían bien.

**4 · Nada se reimplementa.** La quincena se le pide a `lib-quincena`. Hubo aquí una segunda
versión que devolvía `Ago-Q1-2026` mientras el resto del sistema usa `2026-08-Q1`: iba a pisar
**2,645 celdas buenas** de Qcart con el formato viejo.

**5 · No crea filas.** `escritor-datos` empareja y escribe; si un registro del bloque no tiene fila, lo dice.
Para crear filas o columnas está el acumulador (`CB.regenerarHoja` / `CB.apuntarColumna`).

## Después de cada escritura, las CINCO capas

```
xlsx-safe-save → xlsx-label (Purview) → xlsx-check → xlsx-validar-fondo → xlsx-orden-celdas
```

**Sin las cinco no se dice que quedó bien.** Son la evidencia que se le reporta a Rick.

🔴 **La quinta no es opcional, y este skill lo aprendió por las malas:** las otras cuatro pasaron
sobre un libro que **Excel se negaba a abrir**, y lo único malo era el **orden de las celdas dentro
de cada fila**. Un paquete OPC válido puede seguir siendo ilegible.

⚠ Y este documento decía «las cuatro» hasta el 25-ago, copiando un mensaje del orquestador que
también undercontaba. Las cinco corren de verdad — dentro de `publicar()`.

## El formato solo se ve MIRANDO

El ancho sale del **contenido real** de cada columna, no de una tabla clavada — así una columna
nueva queda bien sin que nadie la agregue a una lista. Tope 46: sin él, una URL de 300 caracteres
haría una columna inusable.

Ninguna suma detecta esto. Se comprueba con un render:

```bash
$PYTHON ~/.claude/tools/xlsx-render.py <archivo> <out.png> Report_Resumen A1:N24 --dpi 150
```

## 🔴 REGLA DURA · no escribes si no declaraste antes

Rick, 26-ago: *«Solo el skill puede proceder y terminar cuando completa el loop de pre-escritura.
Si eso no pasa, el proceso genera muchos loops en la escritura siguiente. Tiene que ser una regla
muy estricta.»*

Antes de tocar el Excel, este skill deja su declaración en `_preescritura/DECL-<script>.json` con
**los cuatro campos**, y ninguno es opcional porque cada uno tapa un defecto que ya ocurrió:

| Campo | El defecto que tapa |
|---|---|
| `hoja` | escribir a la hoja equivocada |
| `grano` | el Qcart agrupado a un solo segmento: borró la comparación y **cuadró igual** |
| `llave` | `Data_Email` anclada a una columna que el propio escritor llena — 0 de 98 cruzaron |
| `celdas_esperadas` | «0 celdas que cambiarían» se leyó como «ya está bien» |

Se deja con `lib-declaracion-escritura.declarar()`, que **se niega** si falta cualquiera de los
cuatro. Y lo vigila la **Guarda 5** desde el preflight: un escritor sin declaración —o con una
declaración a medias, que es peor porque parece cumplida— **detiene el corte antes de arrancar**.

## DoD — cierras cuando

0. **Dejaste tu declaración de pre-escritura** y la Guarda 5 pasa. Sin esto no cierras, aunque todo
   lo demás esté en verde.
1. `escritor.validar-contrato.js` da **CONTRATO VÁLIDO** (hoy 6 checks).
2. El diff declara cuántas celdas **llenan hueco** y cuántas **pisan**, con la lista de lo que se
   perdería — y ninguna pérdida quedó sin explicar.
3. Las cuatro capas pasaron en cada publicación.
4. **Miraste el render** de al menos una hoja escrita.

## No haces

- No decides qué significa una columna: eso es del contrato.
- No calculas tasas ni agregados: eso es de `crm-reporte-motor`.
- No construyes el Resumen: eso es de `crm-reporte-resumen`.
- No publicas a producción. **Nunca**, sin OK explícito de Rick.
- 🔴 **No decides formato.** Anchos, colores, altos y estilos los edita Rick (25-ago-2026). Lo que
  sí es obligatorio es **no destruirlos**: ver «retirar una columna» abajo.

## 🔴 Retirar una columna — las cuatro cosas que ya salieron mal

Se hace con `escritor.retirar.js`, y **nunca antes de fusionar**: 24 piezas tenían su número solo
en la columna fantasma y retirar primero las habría perdido. El paso se niega solo si detecta
valores sin fusionar — déjalo negarse.

| Lo que salió mal | Por qué | Qué lo cierra |
|---|---|---|
| Se desplazaron 5 columnas del catálogo | el regex ponía la alternativa `<c …>…</c>` primero y se tragaba las **celdas auto-cerradas** (13,564 en esa hoja), devorando hasta el siguiente `</c>` | la auto-cerrada va primero y exige terminar en `/>` |
| Nadie lo detectó | se comparó por letra y por conteo | **comparar celda por celda contra el NOMBRE de su columna** — por letra no sirve: las letras se corren a propósito |
| Se perdieron los 65 anchos de `Catalogo_Piezas` | borraba el bloque `<cols>` entero | se **reconstruye**: se descarta el tramo retirado y los de la derecha se corren |
| Excel reparaba el archivo | sin `<cols>`, el formateador insertaba `sheetFormatPr` **antes** de `sheetViews` | la limpieza del formateador ya no depende de que exista `<cols>` |

🔴 **Y probado, no supuesto:** `escritor.probar-retiro.js` lo corre sobre una copia y exige que
ninguna celda cambie de columna. Se verificó además que con el regex viejo esa prueba **falla** y
reproduce el daño exacto — un test que solo pasa no demuestra nada.

## 🔴 Llenar celdas vacías — vacios-llenar, y va DENTRO del ciclo

`escritor.aplicar-vacios.js` **transcribe**, no decide: la tabla la produjo `vacios-medir` con las reglas de
cada skill dueño. Tres cosas que no se negocian:

1. **Va dentro de la cadena, después del formato.** Se escribió una vez por fuera y la corrida
   siguiente lo deshizo — 3,195 celdas volvieron a quedar vacías, porque escritor-datos/resumen-regenerar/insights-redactar regeneran sus
   hojas. Un relleno fuera del ciclo dura exactamente un ciclo.
2. **Si la celda ya tiene dato, se salta y se reporta.** La hoja pudo cambiar entre medir y escribir
   —Rick edita a mano—; escribir encima es cómo se pierde su trabajo.
3. **Un cero es un dato.** «Sin clicks a la app» se escribe `0`, no `N/A`. Confundirlos convierte un
   cero en un hueco y el hueco en un `N/A` falso.

## 🔴 EL FORMATO NO LO VE NINGUNA PUERTA — las tres reglas que salieron de ahí (28-oct-2026)

> Rick: *«los porcentajes están mal en algunos casos, mal calculados, o con mal formato»* ·
> *«estas dos columnas no deben de estar al final, sino donde corresponde»* ·
> *«checa bien que el formato de colores por sección sea el adecuado, o sea que todo lo de
> principal esté en un color»*.

**Ninguna de las tres cambia un valor**, así que las dos PUERTAS pasaron en verde con las tres
rotas. Un `numFmt` perdido, una columna al final y un encabezado de otro color **cuadran igual**.
E5 sigue en pie — *el formato lo decide Rick* — y por eso estas reglas no eligen formato: **lo
conservan, lo heredan de quien ya lo tiene, y lo auditan**.

### 1 · Mover una columna es DECLARATIVO, y se lleva su formato de una hermana

El orden se declara en `resumen.mover-columnas.js`, nunca con índices sueltos:

```js
{ columna: 'WA-Clicks Qcart', despues_de: 'WA-Clicks', formato_de: 'WA-Clicks' },
{ columna: 'WA-%Click vs Read', despues_de: 'WA-%Read vs entrega', formato_de: 'Principal_CTOR' },
```

🔴 **`formato_de` no es un adorno: sin él una columna movida llega con formato General** y una tasa
se ve como `0`. Se nombra **una columna hermana que ya tiene el formato correcto** —nunca un
`numFmt` escrito a mano— porque el formato bueno es el que Rick ya aprobó en la columna de al lado.

🔴 **`despues_de` se resuelve por NOMBRE en cada corrida** (E4). Con letras o índices, el segundo
movimiento del lote apunta a la posición que el primero ya movió: las 6 columnas quedaron en un
orden que nadie declaró y que cuadraba.

### 2 · Un color por sección — y la sección se asigna GLOBALMENTE, no una por una

Las secciones se agrupan por el prefijo del nombre (`Principal_` · `FUP_` · `Tot_` · `WA-` …).
🔴 **Eso no viola R1**: R1 prohíbe deducir **campaña, segmento u objetivo** del naming; agrupar
columnas hermanas por su prefijo es otra cosa, y se declara en el auditor para que se vea.

🔴 **La asignación es global y de un tirón, no sección por sección.** Mi primera versión recorría
las secciones en orden y cada una cedía su color si otra ya lo usaba — así **Qcart renunció a su
propio morado** porque WhatsApp también lo tenía, y acabó con el color de nadie. Lo correcto: cada
color lo reclama **la sección que más lo usa** (es la que ya lo tenía puesto por Rick), y la que
pierde su favorito toma el siguiente libre. Hoy:

| sección | color | columnas |
|---|---|:--:|
| Identidad | `595F6E` | 19 |
| Principal | `2E6DB4` | 15 |
| FUP | `31859C` | 16 |
| Total email | `4C7A34` | 13 |
| WhatsApp | `2A9187` | 11 |
| Qcart | `6A4C93` | 13 |

🔴 **Nunca se fabrica un relleno: se COPIA el índice de estilo de una celda que ya lo tiene.**
Escribir un `fill` nuevo en el XML mete un estilo que no está en la paleta del libro y Excel lo
«repara». 18 encabezados reestilados así, 0 estilos nuevos.

### 3 · La fila de totales hereda el formato de SU PROPIA columna

No de la fila de arriba, no de un mapa escrito a mano: **de las filas de dato de su columna**.
Medido antes de tocar nada: en **89 de 89** columnas la fila de totales ya tenía idéntica fuente,
relleno y borde que sus datos — **lo único que difería era el `numFmt`, y esa diferencia ERA el
defecto**. Heredar el estilo completo por columna arregló 26 desajustes y no cambió nada más.

⚠ **Y antes de heredar, hay que saber que se puede**: la medición es la que autoriza la regla. Si
las 89 columnas hubieran tenido estilos distintos entre totales y datos, copiar el de los datos
habría borrado un diseño deliberado de Rick.

### Cómo se comprueba — mirando, no leyendo

```bash
node _scripts/resumen.auditar-tasas.js                    # valor ≠ formato: dos defectos, dos listas
node _scripts/resumen.auditar-colores-encabezado.js       # ¿una sección, un color?
node _scripts/orquestador.huella-formato.js --verificar   # numFmt + ancho + estilo, por NOMBRE
```

🔴 **`auditar-tasas` separa «mal calculado» de «mal formato» a propósito.** Mezclarlos haría que
arreglar el formato pareciera arreglar el cálculo. Mal calculado = el valor no es el cociente de
sus patas **en su propia fila** → es un caché (el caso del `Read_Rate` que decía 60.90% teniendo
2,405 y 2,890 en su fila). Mal formato = el valor está bien y se lee mal.

⚠ **Un ticket es dinero, no una tasa.** Entraba a la auditoría por tener pareja numerador/
denominador —la tiene: importe/carritos— pero su resultado son pesos. Exigirle formato de `%`
convertía 4 celdas correctas en 4 hallazgos falsos, y **un hallazgo falso en una lista corta le
quita autoridad a los verdaderos**.

🔴 **El render es el único que ve esto.** `xlsx-render.py` saca un PNG real; sin mirarlo, se dice
**qué se validó y qué no**.

## Deuda declarada · D3 — hay DOS escritores

`N4-escribir` escribe las hojas de datos por su cuenta y `Z-escribir-todo` aplica lo apuntado por
el acumulador. Conviven a propósito mientras se migra; está declarado en el orquestador para que no
parezca un descuido.

---

<!-- FUNDACION:INICIO -->

## 🧱 LA FUNDACIÓN — lo que NO reimplementas

> **Se mantiene a mano.** Su generador (`E0-7-fundacion-a-skills.js`) se retiró; mientras
> no vuelva, este bloque es el único de los dos que NO se regenera solo — el de arriba sí.
> Estas cinco librerías son el suelo del sistema. Un skill que se escribe su propia llave, su
> propia quincena o su propio formato **es cómo el sistema se separa de sí mismo** — pasó, y por
> eso el reporte y el catálogo llegaron a no cruzar en ninguna de sus 86 filas.

| Librería | Qué resuelve | Cómo se usa |
|---|---|---|
| **`lib-esquema`** | El modelo de datos: entidades, llaves, relaciones, grano | `E.llaveDe(hoja)` · `E.foraneas(hoja)` · `E.prefijo()` · `E.admiteNA(col)` |
| **`lib-registro`** | El nombre físico cambia, el **id lógico no** | `R.abrir(ambito, encabezados)` → `h.col(id)` |
| **`lib-quincena`** | **Una** regla y **un** formato | `Q.deFecha(f)` · `Q.normalizar(q)` · `Q.esCanonica(q)` |
| **`lib-preescritura`** | La tabla previa, con la forma de la hoja destino | `PRE.preparar({...})` · `PRE.guardar(skill, tablas)` |
| **`lib-cambios`** | El acumulador: nadie escribe, todos **apuntan** | `CB.apuntar(paso, hoja, fila, col, valor, porque)` |

### Las reglas que salen de ahí, y no se negocian

**1 · La llave se PIDE, no se escribe.** `E.llaveDe('Report_Resumen')` devuelve
`Campaña + TouchPoint + Segmento + Quincena_del_Principal`. Escribirla a mano es cómo aparecieron
**13 colisiones** en las oleadas de AON.

**2 · La quincena tiene UNA regla y UN formato.** Día **1–15 = Q1** · **16–fin = Q2**. Formato
**`AAAA-MM-Qn`** — ordena alfabéticamente igual que cronológicamente y no depende del idioma del
mes. Toda fecha pasa por `Q.deFecha()`; toda quincena que llega de fuera, por `Q.normalizar()`.

**3 · Ninguna celda vacía, tres estados:**

| | |
|---|---|
| valor | el dato |
| **`N/A`** | **no aplica** por naturaleza (Email_Name en WhatsApp · FUP_Sends sin FUP) |
| **`PENDIENTE`** | **sí aplica y lo debemos** (un subject que la fuente aún no entrega) |

Llenar todo de `N/A` cerraría el archivo pero **borraría la señal de qué falta**. Con tres estados
un guardián puede exigir que `PENDIENTE` tienda a cero.

**4 · Nadie escribe: todos APUNTAN.** Cada skill registra sus celdas con su motivo y **un solo
escritor** (`escritor.escribir-todo.js`) las aplica de una pasada: un respaldo, una cadena de validación,
una publicación. Dos skills que piden la misma celda **chocan** y paran la escritura.

**5 · El orden es atribuir → organizar → llenar.** Nunca llenar primero: es cómo un dato acaba en
la fila equivocada. Y lo que se va a escribir se **pre-escribe** antes, para poder revisarlo.

### Antes de dar un script por cerrado

```bash
node ~/.claude/reportes-backend/nestle/_scripts/E0-99-validar.js          # el esquema sirve
node ~/.claude/reportes-backend/nestle/_scripts/E0-3-validar-quincena.js  # la quincena cruza
node ~/.claude/reportes-backend/nestle/_scripts/E0-4-validar-preescritura.js
```

📄 El modelo completo: `_contratos/esquema.json` · el estado del sistema:
`_orquesta/HANDOFF-ESTADO-SISTEMA.md` (empezar por su §2bis) y `_orquesta/estado-reportes.md`

<!-- FUNDACION:FIN -->
