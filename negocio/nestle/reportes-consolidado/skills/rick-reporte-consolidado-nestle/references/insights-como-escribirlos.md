# Cómo escribir los insights de un reporte de campaña

> Destilado de la iteración completa del reporte Maggi Mundial 2026 (30-31 jul-2026), donde el formato
> pasó de 9 columnas con viñetas a **una sola columna con un párrafo por touchpoint**. Cada regla de aquí
> costó una vuelta de corrección con Rick — no reinventarlas.

---

## 1. Las reglas de VALIDEZ (antes de escribir nada)

### 🔴 R1. Un benchmark solo vale si viene de un negocio comparable
El reporte arrastraba una "meta de CTOR de 15%". Todos los envíos quedaban 13-15 puntos abajo y el
reporte se leía como un fracaso. **Ese 15% era de la federación de fútbol**, que tiene una comunidad
mucho más definida que una marca de alimentos. No era una meta baja: era una meta ajena.
**Antes de comparar contra cualquier benchmark, preguntar de qué negocio y de qué audiencia salió.**
Si no es comparable, no se publica la brecha — ni siquiera "para contexto".
*(La meta de OR de 26% sí resultó válida y se conservó.)*

### 🔴 R2. Cada canal se mide contra SÍ MISMO, nunca contra otro canal
Email y WhatsApp no comparten métricas ni audiencias. "WhatsApp convierte mejor que email" no significa
nada. Lo que sí se puede decir: cómo le fue a WhatsApp contra el promedio de WhatsApp.
- Canal **sin histórico** (primera corrida): su propio promedio es la única referencia y es
  **obligatorio escribir "sin benchmark"**.
- Nombrar la métrica **con el canal**: `Read Rate de WA`, `click de WA sobre leídos`. Nunca "OR" a secas
  en una fila de WhatsApp — se confunde con el del correo.

### 🔴 R3. Verificar la FUENTE de medición antes de comparar dos números de la "misma" métrica
Los clics de WhatsApp venían de **GA-4 en junio y de Q-cart en julio**. En julio el conteo de clics es
*idéntico* al de carritos (164/164, 258/258, 346/346): es el mismo dato con dos nombres. Comparar el
"62.8% de clic" de julio contra el "18.1%" de junio es comparar cosas distintas.
**Si el reporte tiene una columna de fuente (`Fuente de Clicks`), leerla antes de rankear.**

### 🔴 R4. Un cero absoluto en atribución es una falla de medición, no un resultado
Qcart reportó $0 de producto Maggi en una receta de Maggi que sí lo lleva. **Si es pieza propia, siempre
lleva producto propio**; un cero significa que el match de producto falló.
Se reporta como pendiente de la fuente y **se bloquea cualquier conclusión de negocio** sobre esa cifra
hasta que el proveedor la revise. Lo mismo con ratios >100% (carritos > clics): dato inflado en origen.

### 🔴 R5. Agregar antes de concluir — un patrón de 2 de 4 touchpoints no es un hallazgo de campaña
Por partido, "Bebidas es la que mejor convierte" era cierto en 2 de 4. **Acumulado de campaña la mejor
era Modern Cooking** (CTOR 1.46% vs 1.12%). Se había recomendado subirle volumen a la audiencia
equivocada. **Calcular el acumulado por dimensión ANTES de escribir la recomendación**, no después.

---

## 2. Qué buscar (los análisis que dieron los mejores hallazgos)

- **Dispersión: qué métrica separa y cuál no.** El OR se movió 1.31× entre audiencias y el CTOR 2.22×.
  Eso es lo que permite decir *"clusterizar sirvió poco para abrir y explicó mucho del clic"* → la palanca
  está en el creativo, no en la segmentación. **La métrica que NO se mueve es tan informativa como la que sí.**
- **Correlación de rangos entre métricas.** El orden de CTOR por audiencia resultó idéntico al de
  penetración de producto. Quien más clic hace también llena el carrito con más producto propio. Un
  hallazgo que ninguna métrica sola mostraba.
- **Reparto de volumen vs rendimiento.** La audiencia con 41% de los envíos era la última en CTOR y en
  penetración. Cruzar `%volumen` contra la métrica de calidad casi siempre da una recomendación.
- **Comparación blindada = mismo día, mismo creativo, distinta audiencia.** Es la más fuerte que existe
  en un reporte de email porque no hay variable de confusión. Buscarla siempre primero.
- **Efecto del tamaño de lista.** El Read Rate de WA cayó ~21 puntos al pasar de 162 a ~2,000
  destinatarios. Un resultado de lista chica y muy activa **no se proyecta** a una lista grande.
- **Ticket por carrito** distingue canales/piezas mejor que el conteo de carritos.

---

## 3. Formato: UNA columna, un párrafo por touchpoint

Se probaron 9 columnas (Titular / Qué pasó / Contra qué / Qué lo explica / Qué aprendimos / Qué hacer /
Qué tan seguro / Hallazgo / Pendiente) y **se descartaron**: el cliente pidió 1, máximo 2.

**Formato final:** una columna, **texto corrido (NO viñetas)**, ~5 líneas, y el `⚠ Pendiente` como
segundo párrafo dentro de la misma celda. Fusionar verticalmente las filas del mismo touchpoint.
⚠️ Si las filas del touchpoint **no son contiguas** (p.ej. el email en las filas 5-6 y su WhatsApp en la 11),
no se pueden fusionar en un bloque: se fusiona lo contiguo y se repite el texto en la fila suelta.

**El insight de cierre de campaña lleva tres bloques explícitos**, en este orden:
1. **Hallazgos entre audiencias** · 2. **Hallazgos de cada canal contra su propia referencia** ·
3. **Recomendaciones** derivadas de los dos anteriores.

---

## 4. Lenguaje

**Los números van DENTRO del texto.** (Se probó sacarlos —"4 de cada 10" en vez de "37.9%"— y se revirtió:
el cliente los quiere en la frase.) Los porcentajes conviven con las cifras absolutas: `1,268 clics (1.54%)`.

### ⛔ Nunca "conversión"
Es la palabra más peligrosa del reporte: significa cosas distintas en cada renglón. **Siempre la métrica
con su denominador:**

| En vez de | Escribir |
|---|---|
| "convirtió 2.04%" | "CTOR de 2.04% (clics sobre aperturas)" |
| "duplicó la conversión" | "pasó de 18.8% a 37.7% de carritos sobre leídos" |
| "la que mejor convierte" | "la de CTOR más alto" |
| "tasa de conversión de Qcart" | "carritos por clic" — y como multiplicador `0.00x`, no como % |

### Otras reglas
- **El texto abre nombrando el touchpoint** ("El Partido 1…", "La Semifinal B…") para que se entienda
  fuera de su fila.
- **Conectar con "pero" y "por lo tanto", no con "y".** La causalidad es lo que lo vuelve un hallazgo.
- **Nombres concretos**: "Botana", no "el segmento"; "Deditos de Pescado", no "la receta".
- **La recomendación empieza con verbo** y dice dónde se ejecuta.
- **Palabras prohibidas:** performance · engagement · optimizar · accionable · aprovechar · capitalizar ·
  leverage · maximizar · impactar · palanca.
- **Vocabulario del cliente**: usa "clusterizar" para segmentar y "Read Rate" para la apertura de WhatsApp.

---

## 5. Autovalidación del texto (correr sobre el resultado, no sobre la intención)

Chequeos que **sí** cazaron errores reales en esta iteración:
1. **Cero jerga**: regex con `\b` sobre la lista prohibida. *(Sin `\b`, "MAYOR" da falso positivo por "OR".)*
2. **Cada texto trae al menos una cifra.**
3. **Ningún texto usa un benchmark invalidado** (buscar "15%", "meta de 15").
4. **El texto se entiende solo**: nombra su touchpoint o su canal.
5. **Las cifras citadas se recomputan desde las columnas de métricas** y deben coincidir.
6. **Coherencia entre niveles**: la recomendación por touchpoint no puede contradecir la de campaña
   (fue justo lo que pasó con Bebidas vs Modern Cooking).
