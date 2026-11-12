# Construir tools de MCP: lecciones que costaron caro

> Sacadas de reconstruir el MCP de SFMC (7-ago-2026), donde una revisión adversarial de
> 8 agentes encontró **67 defectos** en código que ya "funcionaba" — 9 de ellos devolviendo
> **datos incorrectos en silencio**.
>
> No es teoría: cada regla aquí corresponde a un bug real que llegó a producción.
> Aplica a cualquier MCP, no solo al de SFMC.

---

## La regla madre

> **Una tool sirve solo si DEVUELVE DATOS REALES. Que importe sin error no prueba nada.
> Que no truene, tampoco.**

Las 4 tools de tracking del MCP de SFMC pegaban a un endpoint REST **que no existe**. Estaban
documentadas, versionadas y en uso desde el día uno. Nadie las había ejercitado nunca contra
un tenant real. El README las listaba como funcionando.

**Corolario:** el criterio para decir "ya quedó" es *la corrí y me devolvió el dato que
esperaba*, no *compila* ni *importa*.

---

## 1. El truncado silencioso es el defecto #1

De los 9 defectos graves, **5 eran variantes del mismo error**: la tool descartaba filas y
respondía como si eso fuera todo.

### La trampa concreta

```js
// ❌ decide "truncated" con el estado de la PÁGINA, no con si se descartaron filas
if (rows.length >= maxRows) { truncado = status === 'MoreDataAvailable'; break; }
```
Una fuente que entrega 800 filas en un solo lote, con `maxRows=500`: devuelve 500 y
`truncated: false`. **300 filas desaparecen afirmando que no hubo corte.**

```js
// ✅ decide por si se DESCARTAN filas, y dice por qué
if (rows.length >= maxRows) { causa = rows.length > maxRows || cont ? 'maxRows' : null; break; }
if (cont && ++vueltas >= TOPE)  { causa = 'lotes'; break; }
return { count: rows.slice(0,maxRows).length, retrieved: rows.length,
         truncated: causa !== null, truncatedBy: causa,
         ...(causa ? { warning: `INCOMPLETO: se cortó por ${causa}.` } : {}) };
```

### Checklist de todo camino que pagina

- [ ] ¿Hay un tope de páginas/lotes? Si se alcanza, **¿lo reporta?**
- [ ] ¿El `maxRows` recorta después de traer? Entonces `truncated` va por el recorte.
- [ ] ¿El camino de **error** devuelve el acumulado sin recortar y con otra forma de objeto?
- [ ] Si la fuente no reporta el total, `(total || 0)` hace que `size >= 0` sea **siempre
      true** y sales en la página 1 con 50 de 1,875. Distingue "total desconocido" de 0.

---

## 2. Nunca agregues sobre un conjunto truncado y lo llames "total"

El peor bug del lote: la tool traía 459 de 2,088 envíos y publicaba un bloque `totals` de
primer nivel. Reportaba **la mitad de los clicks reales** con la etiqueta del mes completo.
Y el subconjunto era **arbitrario** (la fuente no entrega ordenado), o sea ni siquiera
reproducible.

**Regla:** si el resultado salió truncado, **el agregado cambia de nombre** —
`totals_PARCIALES`— o no se emite. Un número mal etiquetado es peor que ningún número:
nadie lo va a cuestionar.

---

## 3. Distingue TRES números, no uno

`count: Math.min(rows.length, maxRows)` colapsa tres cosas distintas y hace imposible saber
si faltó algo:

| Campo | Qué responde |
|---|---|
| `totalEnLaBU` | cuántos hay en el universo |
| `matched` | cuántos cumplen el filtro |
| `count` | cuántos van en **esta** respuesta |

Sin `matched`, un filtro que matchea 350 con `maxRows=100` devuelve `count: 100` — **idéntico
a si hubiera matcheado exactamente 100**. No hay forma de notar que se perdieron 250.

---

## 4. Un filtro en cliente después de truncar da FALSOS NEGATIVOS

Si bajas un lote, lo recortas y **luego** filtras, buscar algo que quedó fuera del corte
devuelve `0` — indistinguible de "no existe".

Pasó dos veces. La peor: `sfmc_list_data_extensions` se quedaba con el primer lote de 2,500 de
3,739 DEs y filtraba sobre él. Reportaba `count: 0` para **la DE que la propia documentación
mandaba a leer**.

**Filtra sobre el universo completo, o di clarísimo que el filtro es parcial.**

---

## 5. Normaliza en la frontera, no en el consumidor

Todo lo que entra de un sistema externo se limpia **una vez, al parsearlo**:

- **Decodifica.** En XML el `&` siempre viene como `&amp;` — es obligatorio. Sin des-escapar,
  toda URL con querystring sale rota. (Y des-escapa `&amp;` **al final**, si no re-expande
  las demás entidades.)
- **Trimea.** SFMC rellena campos de texto a longitud fija con espacios: era el **22%** del
  peso de la respuesta, y hacía fallar en silencio cualquier comparación por igualdad.
- **Escapa al salir.** Un nombre con `&` interpolado en un sobre XML lo rompe. Escapa **todo**
  lo que interpoles: valores, nombres de campo y operadores, no solo lo obvio.

---

## 6. Los caminos de error no deben parecer éxito

```js
return { error: 'no existe', rows: [] }        // ❌ rows:[] se lee como "existe y está vacía"
return { error: 'no existe', fieldCount: 0 }   // ❌ igual
return { error: 'no existe' }                  // ✅ sin payload de aspecto válido
```

Y **jamás conviertas un fallo desconocido en un diagnóstico específico**: una resolución que
no revisaba el status de la respuesta reportaba *cualquier* fallo —permisos, timeout, fault—
como *"no existe la DE"*. El mensaje real se perdía y mandaba a debuggear al lado equivocado.

**Un `catch {}` vacío es siempre un bug.** Uno de ellos hacía que un 429 transitorio se leyera
como *"no entró nadie al journey"*. Para un reporte de alcance, eso es peor que un error.

---

## 7. La descripción es el único contrato que lee el modelo

El modelo no lee tu implementación: decide **solo** con `description` e `inputSchema`.

- Si la descripción promete "estado y programación", devuelve la programación. La de
  `sfmc_list_automations` la prometía y no devolvía **nada** de schedule.
- Si un campo puede salir `undefined`, `JSON.stringify` **borra la llave** y la columna
  desaparece sin error. Mapear `a.modifiedDate` cuando la API manda `lastRunTime` no falla:
  simplemente el dato nunca llega. Verifica los nombres contra una respuesta real.
- Las descripciones de dos tools **no pueden contradecirse**. En el mismo archivo, una decía
  "usa `sfmc_list_folders` para el categoryId" y otra advertía en mayúsculas que esas carpetas
  NO sirven para eso.
- **Documenta las trampas en la descripción**, no en un README que nadie carga. Si el filtro
  es parcial cuando hay truncado, dilo ahí.

---

## 8. Toda tool que escribe: validar, resolver, y advertir

`sfmc_run_query` recibía un GUID opaco, lo interpolaba crudo en la URL y devolvía
`started: true` sin mirar la respuesta.

- [ ] **Valida la forma** del identificador. Si el schema dice `string`, el modelo va a mandar
      el *nombre* en vez del GUID tarde o temprano.
- [ ] **`encodeURIComponent`** en lo que va a la ruta. Un `../` sin escapar viaja tal cual.
- [ ] **Resuelve y reporta qué vas a tocar** *antes* de tocarlo: nombre, destino, tipo de
      operación. Un GUID mal copiado no debe ser indetectable.
- [ ] **`started: true` derivado de la respuesta**, nunca un literal.
- [ ] La descripción debe decir la consecuencia **real**: no "escribe en producción" sino
      "si es Overwrite, **BORRA** todo el contenido de la DE destino antes de repoblarla".

---

## 9. Una escritura asíncrona necesita señal de terminación, no una heurística

Van **tres** señales fallidas para lo mismo, y las tres parecían razonables:

| Señal | Por qué falla |
|---|---|
| "el timestamp es de hoy" | la corrida anterior también escribió hoy |
| "ya hay filas con datos" | ya era cierto por la corrida anterior |
| "el timestamp es estrictamente mayor" | detecta que la escritura **empezó**, no que acabó |

La tercera es la traicionera. Con semántica *Overwrite* (borra y repuebla), leer en medio
devuelve **una mezcla de las dos corridas**: salieron 5,000 filas con 2,428 duplicados de PK
y un total inflado en **1.4 millones**. Se veía perfectamente plausible.

**Señal buena — las tres a la vez:** timestamp mayor · timestamp **uniforme** en todas las
filas (`min === max`) · **PK sin duplicados**. Y si dudas, lee dos veces separadas y compara.

---

## 10. Prueba en TODOS los entornos que sirve el mismo código

Un MCP registrado dos veces con distinto `env` es **un solo código para dos producciones**.
Varios bugs solo se veían en el tenant grande: el chico tenía 20 registros y nada truncaba.

**Y el tenant chico esconde bugs por partida doble:** ahí todo pasaba porque nada llegaba al
límite. Si tus entornos son de tamaños muy distintos, **el grande es el que manda**.

---

## 11. Cómo revisarlo: pídele a alguien que lo REFUTE

Lo que encontró los 67 defectos no fue releer el código: fue lanzar agentes con el encargo
explícito de **romperlo**, con tres reglas:

1. **Solo reportar lo sustentable citando el código exacto** y el escenario de entrada que
   lo dispara. Nada de sospechas vagas.
2. **Si al leerlo bien resulta correcto, NO reportarlo.** (De 4 sospechas que yo mismo planteé,
   2 eran falsas alarmas y los agentes las descartaron con argumento.)
3. **Verificar ejecutando**, no leyendo: varios copiaron los helpers a un script con la capa
   de red mockeada y los corrieron con entradas sintéticas.

Y lo más incómodo: **uno de ellos refutó la premisa completa del proyecto.** Yo había
documentado que cierta fuente no servía para journeys; el agente lo probó job por job y era
falso. Sin ese encargo adversarial, ese error se queda escrito para siempre.

---

## Checklist de una página

**Antes de decir "quedó":**
- [ ] La corrí y **devolvió el dato esperado** — en todos los entornos que sirve
- [ ] Probé el camino de error: identificador inexistente, filtro inválido, 0 resultados
- [ ] Probé el borde: `maxRows` chiquito, y verifiqué que `truncated` salga **true**
- [ ] Ningún agregado se calcula sobre un conjunto recortado sin renombrarse
- [ ] `count` / `matched` / `total` son tres campos distintos
- [ ] Los valores salen decodificados y trimeados
- [ ] Lo que interpolo va escapado — valores, campos y operadores
- [ ] Ningún `catch {}` vacío; ningún error disfrazado de diagnóstico específico
- [ ] La `description` no promete nada que no entregue, y advierte las trampas
- [ ] Si escribe: valida, resuelve qué toca, y dice la consecuencia real
