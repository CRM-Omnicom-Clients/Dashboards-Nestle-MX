# Sistema de reportes CRM — Nestlé

Esto produce el **Reporte Consolidado de CRM de Nestlé**: lee las fuentes (SFMC, Qcart, WhatsApp),
calcula, escribe el libro de Excel y comprueba que lo escrito diga la verdad. Son **17 etapas**
dirigidas por **12 skills**, y se corre con **un comando**.

Está escrito para alguien del equipo Martech: se asume que ya tienes Claude Code, Node y acceso a
las carpetas de SharePoint del equipo.

---

## 1 · Qué hay aquí

| Carpeta | Qué es |
|---|---|
| `_scripts/` | los 255 scripts. Los que corren en el corte son 64; el resto son herramientas de diagnóstico que se invocan a mano cuando algo falla |
| `_contratos/` | **las decisiones del sistema, en JSON.** Aquí vive lo que no se escribe en el código: las rutas, la cadena de etapas, el esquema de datos, qué es «uno» en cada métrica |
| `_catalogo/` | el catálogo de piezas y las correcciones **que se mantienen a mano** |
| `skills/` | los 12 `SKILL.md`: el **qué hacer**. Los scripts son el cómo |
| `tools/` | las 5 capas de validación del Excel y los 3 hooks |
| `_preescritura/lineas-base/` | las fotos del estado anterior, para poder demostrar que un corte no perdió nada |

Lo demás (`_fuentes`, `_insumos`, `_rejilla`, `_tmp`) son **salidas**: la cadena las reescribe en
cada corte. Si están vacías, es porque todavía no has corrido nada.

---

## 2 · Ponerlo a andar — tres pasos

```bash
npm install xlsx adm-zip
```

Son los **dos únicos paquetes** que usa el sistema (`xlsx` en 169 sitios, `adm-zip` en 48).

```bash
node _scripts/orquestador.instalar.js
```

Revisa tu máquina y **no escribe nada**: los intérpretes, los paquetes (los prueba **usándolos**,
no cargándolos — en esta instalación se corrompen y un `require` pasa aunque el paquete esté
hueco), las carpetas que el sistema necesita encontrar, y los 3 hooks.
Cuando esté claro lo que falta, instala los hooks con:

```bash
node _scripts/orquestador.instalar.js --escribir
```

⚠️ **Los hooks se cargan al INICIAR Claude Code.** Reinícialo después de instalarlos.

```bash
node _scripts/orquestador.probar-entorno.js
```

Comprueba que el contrato de rutas resuelva a carpetas que existen de verdad. **Si esto no está en
verde, no corras un corte**: el sistema no fallaría — concluiría «no hay datos», que es otra cosa.

---

## 3 · Correr un corte

### 🔴 La primera vez: traer las ENTRADAS

Las carpetas `_fuentes`, `_insumos` y `_rejilla` llegan **vacías** a propósito: son salidas, y la
cadena las reescribe. Pero hay una entrada que **no produce la cadena** y sin ella el corte se
detiene en la etapa 5:

```bash
node _scripts/fuentes-email.refrescar-volcado.js --escribir
```

Es la foto de las DE de SFMC, y necesita **el MCP de SFMC conectado**. Si no lo tienes, pídelo
antes: el corte no puede empezar sin esto, y es el único paso que depende de un permiso externo.

🔴 **Y el refresco importa más de lo que parece.** Las dos PUERTAS salieron abiertas una vez sobre
un volcado de hace tres días, con dos envíos ya hechos que no estaban: **todos los pasos salen del
mismo volcado, así que un dato atrasado cuadra consigo mismo** y ninguna puerta lo ve. Durante meses
nadie era dueño del refresco — por eso existe ese script.

### El corte

```bash
node _scripts/orquestador.orquestador.js --escribir
```

Recorre las 17 etapas y **se detiene en la primera que falla**: un corte a medias es peor que
ninguno. Si ya corriste y solo quieres rehacer el reporte:

```bash
node _scripts/orquestador.orquestador.js --desde motor-calculo --escribir
```

**Sin `--escribir` va en seco** y no toca el libro. 🔴 Pero ojo: *seco* protege el Excel, **no los
JSON del backend**. Y un paso en verde en seco no significa que escriba bien — ya pasó: 31 pasos en
verde en seco, y al escribir de verdad y **mirar el resultado** salieron 11 defectos que ningún
check había visto.

### Las dos PUERTAS

| | Qué pregunta | Si cierra |
|---|---|---|
| **PUERTA 1** (etapa 9) | ¿cuadran los cuatro bloques con el catálogo? | no se escribe nada |
| **PUERTA 2** (etapa 17) | ¿lo escrito dice lo mismo que la rejilla? | no se publica nada |

Antes de la etapa 1 corren solas **7 guardas estructurales**. Cinco pueden **detener el corte**.
No hay que acordarse de correrlas.

---

## 4 · Cuando algo falla

**Lee el mensaje completo.** Este sistema está escrito para que cada fallo diga qué pasó y qué
hacer. Si un paso dice «no pude evaluar», **eso no cuenta como pasar**: es el tercer veredicto y
existe a propósito.

| Síntoma | Qué mirar |
|---|---|
| «no hay datos» de una fuente | `orquestador.probar-entorno.js`. Casi siempre es una carpeta de SharePoint que no está **sincronizada** (verla en el navegador no basta) |
| «Cannot find module 'xlsx'» | `npm install xlsx adm-zip`, y comprueba con `orquestador.instalar.js` |
| el libro «se abre roto» en Excel | lee `%TEMP%\error*.xml` **antes de teorizar** — filtra por el nombre del archivo |
| una escritura no aparece | ¿está el libro abierto en Excel? OneDrive revierte la escritura, y a veces también los respaldos. Y en SharePoint alguien puede estar co-editando: revisa `docProps/app.xml`, si dice *Excel Online* escribió alguien más |
| una guarda bloquea | **déjala bloquear.** Las 7 se prueban plantándoles el defecto (`orquestador.probar-guardas.js`, 19 pruebas): si bloquea, es porque lo puede demostrar |
| no sabes en qué estado quedó | `_orquesta-bitacora.json` tiene la última corrida paso a paso |

### Las 5 capas, después de CADA escritura al Excel

No son opcionales, y van en este orden:

```
xlsx-safe-save  →  xlsx-label  →  xlsx-check  →  xlsx-validar-fondo  →  xlsx-orden-celdas
```

La cadena las corre sola. 🔴 **La quinta no se salta**: las otras cuatro pasaron sobre un libro que
Excel se negaba a abrir, y lo único malo era el **orden de las celdas** dentro de cada fila.

---

## 5 · Lo que NO se negocia

1. 🔴 **Publicar a producción necesita el OK explícito de Rick.** No está en el bucle del corte, y
   el paso se detiene solo. Publicar **no es copiar el archivo encima**: el libro productivo tiene
   18 hojas que el interno no tiene, y una copia encima se las lleva.
2. 🔴 **Rick edita los entregables a mano.** Si quitó filas, movió celdas o cambió textos, **fue a
   propósito**. Antes de regenerar algo que él tocó: diffear contra lo que hay, y si algo suyo se va
   a perder, **avisar y esperar**. Diffear *después* de escribir ya no sirve.
3. **El orden de las filas de `Report_Resumen` es suyo.** Lo nuevo va al final.
4. **Una columna se pide, no se escribe.** `lib-columna.de()` resuelve o truena. Un literal
   devuelve `undefined` en silencio, y `undefined` se lee como «vacío»: así un script acusó de
   vacías a 98 de 98 filas sobre una columna llena al 100%.
5. **Una ruta se pide, no se escribe.** Igual: están en `_contratos/entorno.json` y la **guarda 7**
   impide que vuelvan al código.
6. **No inferir reglas de negocio.** Campañas, segmentos y objetivos **no se deducen del naming** —
   engañan. Se pregunta. Lo no confirmado se marca, no se adivina.
7. **No correr dos cadenas a la vez**: comparten los temporales y una pisa a la otra.

---

## 6 · Antes de decir que quedó bien

```bash
node _scripts/orquestador.probar-guardas.js       # que las 7 guardas ATRAPEN, no solo que pasen
node _scripts/orquestador.verificar-estado-docs.js # que los documentos no mientan sobre el disco
node _scripts/orquestador.linea-base.js --guardar antes-de-mi-corte
#   ... corres el corte ...
node _scripts/orquestador.linea-base.js --comparar antes-de-mi-corte
```

Esa última es **la red de seguridad**: compara celda por celda **por llave** y dice si algo que ya
estaba se perdió o volvió a `POR DEFINIR`. Las dos puertas no pueden probar eso — las dos miran el
estado nuevo contra sí mismo.

🔴 **Y mira el resultado.** `xlsx-render.py` saca un PNG del libro:

```bash
<tu python> tools/xlsx-render.py "<el libro>" salida.png
```

Hay defectos que no cambian ninguna suma, así que **pasan todas las puertas**: un formato perdido,
un texto cortado, una columna desplazada. El render es lo que rompe esos círculos.

---

## 7 · Quién manda sobre qué

Cada `skills/crm-reporte-*/SKILL.md` empieza con un bloque `@DECLARACION` **generado desde el
estado real del sistema**: qué contratos lee, qué hooks lo vigilan y qué le exige el preflight. No
se edita a mano — se regenera:

```bash
node _scripts/orquestador.declarar-en-skills.js --escribir
```

| Si vas a tocar… | El dueño es |
|---|---|
| campañas, piezas, alias, códigos de Qcart | `nestle-catalogo` |
| una fuente (email · Qcart · WhatsApp · manual) | `fuentes-*` |
| tasas, agregados, clicks por destino | `motor` — **el único que divide** |
| `Report_Resumen` | `resumen` |
| escribir cualquier hoja | `escritor` |
| las puertas | `fuentes-cuadre` |
| dirigir el corte | `orquestador` |

---

## ⚠️ Esta carpeta está en un SharePoint compartido con el equipo de cliente

No es una carpeta privada del equipo Martech. `_MANIFIESTO.json` dice qué se copió, desde dónde y
cuándo. Si cambias algo aquí, **no se propaga** al backend de Rick: son dos copias independientes
(y eso se comprobó a propósito, porque una copia que en realidad ejecuta la otra es peor que no
tener copia).
