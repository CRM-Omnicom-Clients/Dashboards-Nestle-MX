---
name: crm-reporte-nestle-catalogo
description: Mantener el catálogo raíz de Nestlé — dar de alta piezas, campañas, alias y códigos de Qcart sin romper lo que ya está. Úsalo cuando lleguen envíos, links o campañas nuevas, o cuando una dimensión no resuelva.
---

# Catálogo raíz Nestlé · catalogo-leer · catalogo-aplicar — cómo se toca

<!--@DECLARACION-->
## 🔴 Lo que este skill lee, lo que lo vigila y lo que le exigen

> Este bloque **se genera** desde el estado real del sistema con
> `orquestador.declarar-en-skills.js`. No se edita a mano: un bloque escrito a mano se
> desfasa en cuanto cambia una guarda — que es justo lo que le pasó al mapa de la cadena.

**Su turno:** etapa 4   ·   **2 script(s) de ejecución**   ·   **escribe al Excel**

**Contratos que lee**

- `_contratos/_catalogo/correcciones-aplicadas.json`
- `_contratos/_catalogo/correcciones.json`
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

🔴 **Este skill escribe**, así que la Guarda 5 le aplica de lleno: sin su declaración de
pre-escritura en `_preescritura/DECL-*.json`, con los cuatro campos, **el corte no arranca**.
<!--/@DECLARACION-->

```bash
node ~/.claude/reportes-backend/nestle/_scripts/catalogo.leer-correcciones.js    # qué se declaró corregir
node ~/.claude/reportes-backend/nestle/_scripts/catalogo.corregir-catalogo.js    # aplicarlo
```

## Su etapa en la cadena: la 4, y va ANTES de los cuatro bloques

El catálogo es la **autoridad de dimensiones**: campaña, marca, BU, objetivo, segmento y touchpoint
salen de aquí, y los cuatro skills de fuente los consultan al armar sus bloques. Por eso sus
correcciones se leen y se aplican **antes** — un bloque armado contra un catálogo a medio corregir
arrastra la dimensión vieja hasta el reporte, y ahí ya no se distingue de un dato.

**Nada se infiere del naming.** Si una dimensión no resuelve, se declara un alias en
`Catalogo_Referencias`; no se deduce por parecido.

---

**Este archivo es solo el PROCEDIMIENTO.** El porqué de cada decisión, la estructura completa y las
reglas están en `~/.claude/reportes-backend/nestle/CATALOGO.md` — **léelo antes de la primera alta
de la sesión**, no lo copies aquí.

## 🔴 REGLA DURA · no escribes si no declaraste antes

Antes de aplicar correcciones al catálogo, este skill deja su declaración en
`_preescritura/DECL-catalogo.corregir-catalogo.json`. Su campo crítico es la **llave**:

> `Pieza_ID` — y para las **altas**, la IDENTIDAD DE NEGOCIO (campaña · mascota · EmailID · sends),
> **nunca el id**.

Está declarado así porque decidir un alta por `pieza_id` clonó el catálogo 17 veces: esas piezas
llegan del documento **sin** id, así que en cada corrida volvían a ser nuevas. **216 filas
sobrantes, y ninguna guarda lo vio** porque todos los `Pieza_ID` eran distintos.

La **Guarda 5** exige la declaración desde el preflight: sin ella, el corte no arranca.

## 🔴 Las tres que no se negocian

1. **No escribas tu propio lookup.** Los ids los asigna `lib-ids.js`; los alias los resuelve
   `lib-alias.js`. Si escribes otro, se equivocará distinto que el resto del sistema.
2. **Lo que no resuelve, FRENA.** Un valor desconocido no entra con un canónico inventado: sale
   como pendiente con su fuente, y Rick decide si es alias nuevo o dato nuevo.
3. **Termina siempre con la validación completa** — el refutador incluido:
   ```bash
   node ~/.claude/reportes-backend/nestle/validar-catalogo.js
   ```
   Si sale en rojo, **no digas que quedó cerrado**.

---

## El bucle

```
1. LEER      CATALOGO.md (§2 hojas · §3 ids · §4 alias · §5 fechas)
             + _catalogo/catalogo.json, que es el estado actual
2. RESOLVER  cada valor crudo con lib-alias.js  → resuelto | PENDIENTE
3. ASIGNAR   ids con lib-ids.js                 → nunca a mano, nunca por contador global
4. ESCRIBIR  el JSON primero. El Excel SIEMPRE al final (escritor.cierre.js)
5. VALIDAR   validar-catalogo.js — las 6 suites
6. RESPALDAR git commit en ~/.claude
```

## Alta de una PIEZA nueva

```js
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
var LIB = require(require('os').homedir() + '/.claude/reportes-backend/nestle/_scripts/lib-ids.js');
var REG = LIB.cargar();
var campId = LIB.idCampana(REG, { bu: 'RN', marca: 'Maggi', campana: 'Mundial' });
var id = LIB.idPieza(REG, pieza, campId);   // 004-P020 — dentro de SU campaña
LIB.guardar(REG);                            // append-only: reserva de inmediato
```

**Obligatorio en toda pieza nueva**, o el catálogo deja de ser fuente de verdad:

| Campo | Regla |
|---|---|
| `campana · nombre_pieza · segmento · email_type · canal · nombre_pieza_raw` | la **llave natural**. Sin `nombre_pieza_raw` dos envíos de WhatsApp colapsan en uno |
| `objetivo` | **se declara**, no se lee del dato ni se deduce del nombre |
| `fuente_dato` | de dónde salió. Si lo declaró Rick: `manual` |
| `Fecha_*` y periodos | ver abajo — **no son una sola columna** |
| `estado` | `Confirmado` · `Sin engagement cargado` · `Sin email cargado`. Si falta algo, se **dice** |
| `clicks_medidos` | en WhatsApp: `Sí · medido` o `No · derivado…`. Un CTOR asumido no se compara contra benchmark |

## Fechas — la parte que más se rompe

Una pieza AON manda durante semanas: **18 cruzan de quincena, 17 de mes.** Por eso hay tres niveles
(detalle en CATALOGO.md §5):

```
ANCLA      Quincena_Lanzamiento     una sola — de aquí cuelga el Qcart UNA vez
ACTIVIDAD  Quincenas_Activas        todas — donde de verdad mandó
REPARTO    Sends_Por_Quincena       "2026-04-Q2:14972 ; 2026-05-Q1:39" — debe sumar Sends
```

**Escalera de la fecha**, y `Fecha_Origen` dice cuál se usó:
```
1 Send_Date exacto  →  2 Send_Quincena declarada  →  3 fecha del journey
4 la HOJA del documento maestro ES un mes  →  5 se declara en el Estado
```
🔴 **Antes de decir que un dato no existe, agota TODAS las columnas que lo llevan.** Me pasó tres
veces: el día estaba en `Send_Quincena`, la receta 2 y 3 estaban en la misma fila, y el mes estaba
en el nombre de la hoja.

🔴 **`Granularidad_Periodo`** (`dia`·`quincena`·`mes`·`ninguna`): tener el periodo no basta, hay que
decir **con qué precisión**. Una hoja "Julio" da el mes, NO la quincena — rellenarla sería fabricar
precisión que no existe, y aguas abajo nadie la distinguiría de un dato medido.

🔴 **El catálogo NO carga métricas** (solo `Sends`, y como checksum). Opens/Clicks viven en
`Data_Email`: está probado que con la llave del catálogo el paso siguiente las reparte él mismo y
cuadran al centavo. Cargarlas duplicaría la fuente y se desincronizaría al primer refresh.

La llave fila→pieza es `campaña ¦ touchpoint ¦ segmento ¦ email_type ¦ ASSET_ID`. El asset es
imprescindible (AON tuvo dos oleadas con el mismo touchpoint y segmento), y el segmento hay que
buscarlo también en `Segmentos_Combinados`.

⚠ **Una pieza puede tener carritos SIN envíos** (Mundial WhatsApp: el Qcart midió, Twilio no está
cargado). Cualquier rejilla que armes nace del **periodo**, no del volumen — si la fila solo existe
cuando hay envíos, esa venta desaparece.

## Alta de un ALIAS

Solo cuando una grafía cruda no resuelva. **El contexto más específico gana** — si la misma grafía
da distinto touchpoint según el segmento, el contexto es `Campaña · Segmento`, nunca solo la campaña.
Un alias no puede apuntar fuera del vocabulario.

## Alta de un CÓDIGO de Qcart

La autoridad es `ReportesQcart/Qcart-Links Mails-Hive- MX.xlsx` (hojas Marzo–Agosto), **no
`Data_Qcart`** (su atribución está corrupta).

⚠ **Una fila del maestro puede traer VARIAS recetas en columnas** (Julio f8 tiene 3). Leer la fila
entera. Y un código que no entra a ninguna pieza **se declara excluido con motivo y su número** — no
se deja caer.

## Cuando algo no resuelve

Va a pendientes con: qué falta · campaña · pieza · qué intentaste · qué asumiste para seguir · qué
cambia si está mal. **Nunca se adivina en silencio.**

## 🔴 UNA VARIANTE USURPADA, Y LA DECISIÓN QUE CASI TOMÉ POR RICK (22-sep-2026)

Un `Email_Names_Variantes` sirve para que un nombre viejo siga cruzando a su pieza. El problema
aparece cuando **dos piezas se reclaman el mismo nombre**: el cruce elige una, y elige la que el
índice recorra primero. Eso no es una llave — es un sorteo.

🔴 **Y el criterio con el que iba a limpiarlas estaba mal.** Mi regla era «si dos piezas se citan
**recíprocamente**, una usurpó a la otra, así que limpio». Aplicada, habría tocado `001-P005` y
`001-P006` — que son exactamente la **decisión D1 de Rick**: piezas que SFMC publica bajo el mismo
`EmailName` y que él decidió **no retirar** (hay 4,085 referencias vivas). Un criterio técnico
correcto en abstracto borrando una decisión de negocio.

**El criterio que quedó:** si las dos piezas comparten **TouchPoint Y Segmento**, es una decisión de
negocio y **no se toca**; solo se limpia cuando difieren, que es donde el nombre de verdad está en la
pieza equivocada. Se prueba con `catalogo.refutar-variantes.js` (5 ataques, 5 atrapados), y su
ataque **B3 existe solo para eso**: comprobar que los pares de D1 conservan sus variantes.

⚠ **Un empate no se resuelve: se declara.** Cuando dos piezas de la misma audiencia reclaman un
nombre, el índice lo marca **AMBIGUO** (hoy 16 nombres) en vez de elegir. Resolver a ciegas es cómo
un alias mandó 191 carritos al segmento de al lado **con la suma cuadrando**.

## 🔴 El catálogo creció solo durante 17 corridas — 216 filas clonadas

`catalogo.corregir-catalogo.js` decidía si una pieza de Pro Plan era alta preguntando por su
`pieza_id`. Esas piezas llegan del documento **sin** `pieza_id` —por eso son «nuevas»— y el id que
se les asigna al escribirlas nunca vuelve al documento. En cada corrida volvían a ser nuevas: 12
altas más, con ids frescos. El catálogo pasó de 131 a 347 filas sin que nadie lo notara.

**Y ninguna guarda lo veía: todos los `Pieza_ID` eran DISTINTOS**, así que «id único» salía verde, y
«cero duplicadas» mira columnas, no filas. Lo que se repetía no era el id — era la **pieza**.

Tres reglas que salen de ahí:

1. **Un alta se decide por IDENTIDAD DE NEGOCIO, no por id.** `campaña · touchpoint · segmento ·
   mascota · sends · id de SFMC`. El id no entra en la llave de existencia: es su consecuencia.
2. **«Ya existe» responde si se da de alta, no si se corrige.** El primer corte devolvía temprano y
   se saltaba también las correcciones de esa fila: 12 piezas se quedaron sin su `Email_ID` y el
   retirador —con razón— se negó a retirar la columna vieja. Son dos preguntas distintas.
3. **La identidad se construye con el VALOR LÓGICO, no con una columna física.** La primera limpieza
   dejó 12 clones vivos porque la llave usaba `Email_ID (de la DE de SFMC)` y en cada par el mismo
   número estaba en columnas distintas —uno en la viva, otro en la fantasma `EmailID`—. Mientras dos
   columnas guarden el mismo valor lógico, cualquier llave sobre una de ellas parte la identidad.
   Corolario de orden: **fusionar y retirar la fantasma ANTES de deduplicar.**

Se limpia con `catalogo.retirar-clones.js`, que **no retira ni una fila sin comprobar antes que su
id no aparece en ninguna otra hoja ni en ningún bloque del backend**, y verifica que cada pieza que
se queda diga lo mismo, columna por columna.

## 🔴 El id lógico ya tiene nombre físico

catalogo-aplicar recreaba `EmailID` en cada corrida porque preguntaba por el nombre con que él la creó, y hoy esa
columna se llama `Email_ID (de la DE de SFMC)`. **Retirar aguas abajo del que crea no sirve de
nada**: hay que enseñarle al creador cómo se llama hoy. El id lógico es inmutable, el nombre físico
cambia, y quien escribe pregunta por el actual — con `lib-columna`, que resuelve o truena.

## Antes de decir que quedó

```bash
node ~/.claude/reportes-backend/nestle/validar-catalogo.js
```

**8 suites.** Las marcadas 🟢 comparan contra una FUENTE; las ⚪ comparan el catálogo consigo mismo
y **salen verdes aunque el generador esté mal**. Nunca las saltes, ni "porque no toqué mucho":

- **`Z-refutar`** ataca contra las fuentes. Con las otras 5 en verde encontró 4 defectos reales.
- **`Z-simular-n3` y `Z-simular-tasas`** construyen la salida del paso siguiente usando SOLO el
  catálogo. Encontraron 2 cosas que ninguna suite de forma veía.

🔴 Y **al cambiar el modelo, revisa los checks**: uno mío marcaba en rojo una pieza correcta porque
medía el *día* cuando el negocio solo exige el *periodo*. Un check desactualizado miente igual que
un dato desactualizado. Ver `~/.claude/rick-reportes/validar-sin-enganarse.md`.

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

---

<!-- CONTRATO-ESCRITURA:INICIO -->

## 🔴 QUÉ ESCRIBE — el contrato de escritura

> **Generado desde `_contratos/escritura.json`. No se edita a mano: se edita el contrato.**
> Antes existía solo el contrato de LECTURA. Por eso el grano acababa decidiéndose dentro
> del motor, tarde y sin que nadie lo revisara.

*El catálogo no es una fuente: es la TABLA MAESTRA. Define las dimensiones que las demás usan.*

### → `Report_Resumen`

| | |
|---|---|
| **Grano** | define la LLAVE de la fila: campaña × touchpoint × segmento × quincena del Principal |
| **Llave** | `Campaña + TouchPoint + Segmento + Quincena_Lanzamiento` |
| **Columnas suyas** | 10: `Campaña` · `Medio` · `Objetivo` · `TouchPoint` · `Segmento` · `Quincena_Lanzamiento` · `Mes` · `Mes (#)` · `Marca` · `BU` |
| **NO toca** | ninguna métrica: el catálogo describe, no mide |

**El orden es: atribuir → organizar → llenar.** No se escribe nada que no se haya atribuido
primero: llenar antes de atribuir es como un dato acaba en la fila equivocada.

Se verifica con `node ~/.claude/reportes-backend/nestle/_scripts/E1-4-contrato-escritura.js`

<!-- CONTRATO-ESCRITURA:FIN -->
