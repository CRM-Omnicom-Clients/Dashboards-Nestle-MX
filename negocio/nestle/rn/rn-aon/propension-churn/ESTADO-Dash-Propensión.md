# ESTADO · Propensión (Prevención de Churn) · AON Recetas Nestlé

> **Punto de retome.** Última revisión: 14-oct-2026 (iteración 5).
> Este documento tiene dos partes.
> **Parte A: para continuar en TD AI Studio.** Está escrita para poder pegarse sola, sin el resto del repo.
> **Parte B: para continuar desde una sesión de Claude** (regenerar y validar el HTML de referencia).

**Dónde está el entregable.** En el repositorio `CRM-Omnicom-Clients/Dashboards-Nestle-MX`, en `negocio/nestle/rn/rn-aon/propension-churn/`:
- `(Interno) Dashboard-Propension-AON-RN.html`: la estructura y los números, para abrir en cualquier navegador.
- GitHub: `https://github.com/CRM-Omnicom-Clients/Dashboards-Nestle-MX/tree/main/negocio/nestle/rn/rn-aon/propension-churn`

---

## Cambios de esta iteración (14-oct-2026 · iter 5) — Rediseño estructural completo

Basado en propuesta de manager. Nueva estructura de 5 secciones (vs las 4 previas):

| Sección | Qué contiene |
|---|---|
| **§0 Contexto** | Estrategia (3.6M inactivos, 1M Propensión, objetivo 30%), segmentos + objetivos (OR/CTOR) |
| **§1 Resultados** | 3 bloques separados por segmento: tabla Ago/Sep/Total con columnas comparativa vs objetivo (color+flecha inline) |
| **§2 Aportación** | Hero: 12,842 rescatados. KPIs: 1.28% vs universo Propensión (1M), 0.86% vs usuarios con envío (1.49M), 0.36% vs inactivos totales (3.6M). Snapshot modelo churn |
| **§3 Anomalía** | Contexto + ¿Qué pasó? (2 causas) + Impacto Tibios únicamente (no mezcla performance general) |
| **§4 Plan** | 3 acciones con responsable IBS, imagen de reglas |

**Dato nuevo confirmado:** usuarios únicos E-PROP1 (Tibios) con envío = **1,340,573** (verificado con n_rows en `raw_sfmc_global.raw_sfmc_global_emailevents_sends`; coincide exactamente con la suma de Principal Ago + Sep del dashboard). Re-eng = 153,243. **Total único = 1,493,816**.

**Dato nuevo:** contexto corregido = 3.6M usuarios inactivos totales · 1M con Propensión de Churn medidos en mayo 2026.

## Cambios de iteración 4 (13-oct-2026)

- **§1 Perfiles de audiencia (nuevo bloque antes de Hipótesis):** tres tarjetas (Re-enganchables, Tibios, Fríos) con icono, nombre, touchpoint y descripción de la regla ("Adquiridos en el último año sin interacción en los últimos 6 meses", etc.), más el tamaño de audiencia abajo (Re 79.5K · Ti 2.54M Mid Probability · Fr 12.1K High Probability). Responde a la pregunta "¿quiénes eran estos usuarios?" antes de pedir las metas.
- **§2 ¿Qué pasó? audiencia Tibios corregida:** la cifra de 1,955,293 que venía de la hoja no reflejaba el tamaño real del segmento en agosto. Se reemplazó por la reconstrucción desde CDP (Mid Probability actual proyectada hacia atrás usando los flags de etiqueta): Ago 3,024,049 · Sep 3,060,455 · Variación +1.20%. Principal / Audiencia recalculada: 5.39% (Ago) · 38.47% (Sep) · +33.08 pts. Debajo de la tabla, aviso aclarando que la etiqueta se sobre-escribe y que la cifra exacta queda pendiente del snapshot pre-campaña.
- **Iconografía:** iconos SVG (stroke) en los 4 encabezados H2 (Resultados · Anomalía · Plan · Resumen) y en los H3 de §1 (Hipótesis · Resultados · Realidad · ¿Quiénes eran estos usuarios?). Tono tostado único (`#C87A2A`), tamaño 22 px en H2 y 18 px en H3. Las ilustraciones del Plan de acción ya existentes se mantuvieron.

## Cambios de iteración 3 (13-oct-2026)

- **§1 Resultados, orden definitivo:** tabla detalle completa (visible, no colapsada) → scorecards por segmento → barras divergentes mes a mes. Primero el detalle que el usuario quiere ver, después las comparativas que resaltan lo importante.
- **§1 Resultados rediseñado en tres capas (método del skill de dashboards):**
  - **Scorecards por segmento** (Re-enganchables, Tibios, Fríos). Dos hero figures: Open Rate y CTOR de septiembre, con flecha + "pp por debajo/por encima de Agosto" en texto (nunca solo color). Mini-tira al pie con Sends, Deliveries, Clicks, Unsubs y su variación %. Fríos declara "Sin activar en Agosto – Septiembre".
  - **Barras divergentes mes a mes.** Open Rate y CTOR, Septiembre contra Agosto. Cero dibujado y rotulado "0 = Agosto". Verde a la derecha, rojo a la izquierda, con la etiqueta en puntos porcentuales fuera de la barra.
- **§4 Resumen rediseñado:** se quitaron los dos cuadros "Sin datos cargados" (CLTV, Churn Model). En su lugar, tres bloques nuevos construidos con los datos reales de la CDP:
  - **Foto actual del modelo de Churn (1-oct-2026):** scorecards con la distribución (Mid 2.54M · High 12.1K · Low 1.66M · null 6.72M) y, para Mid y High, cuántos usuarios abrieron durante Ago-Sep y cuántos abrieron por primera vez (rescate). Total rescatados: 12,842.
  - **Dónde vive el modelo:** rejilla con las 4 tablas que lo sostienen (`prod_churn_ml.prod_unification_customers_churn_prediction_recetas`, `..._table_recetas`, `model_log_table_recetas`, `cdp_audience_686576.customers.churn_probability_label_recetas`), el algoritmo (regresión logística, sklearn, accuracy 0.78 el 1-oct) y la cadencia (quincenal · días 1 y 16 ~18:25 UTC).
  - **Accionables:** (1) snapshot pre/post campaña, (2) métrica de rescate operativa, (3) tamaño de segmentos en el tiempo, (4) documentar la receta del modelo.
- **Rediseño visual:** fondo blanco (antes oscuro `#1C0A07`). Paleta de entidades reequilibrada para AA sobre blanco: Re `#D99100`, Tibios `#C76A00`, Fríos `#2A7FB8`. Estado por encima `#4F8F00` / por debajo `#C8355A`. Degradado de marca conservado solo en filetes y barra de progreso.
- **Tipografía:** H1 bajó de `max 136px` a `max 88px`. H2 de `68px` a `54px`. Piso de encabezados de tabla subió de 13 px a 14 px.
- **Interactividad agregada:**
  - Filtro por segmento (sticky bajo la nav): "Todos / Re-enganchables / Tibios / Fríos" oculta filas que no corresponden.
  - Tooltips sobre cada valor crudo: hover muestra la llave `data-k` y el valor crudo `data-raw`.
  - Barra de progreso de scroll en el borde superior con el degradado de marca.
  - Focus visible en teclado (accesibilidad).

## Decisiones confirmadas por Rick

| Pendiente | Decisión (13-oct) |
|---|---|
| Comparación de modelos ML en §4 | Antes vs después de la campaña |
| Granularidad de modelos | Solo el promedio por segmento |
| Modelos a mostrar | **CLTV** (en CDP) y **Churn Propensity** (en CDP) |
| Churn: foto actual + accionable para snapshot | Mostrar la foto 1-oct-2026 y declarar accionable: "necesitamos snapshot para ver el cambio" |
| Métrica alternativa mientras no hay snapshot | "Rescate": usuarios Mid/High que abrieron por primera vez en Ago-Sep |

## Dónde vive el modelo de Churn Recetas (hallazgo 13-oct · tdx)

| Qué | Dónde |
|---|---|
| Predicciones por usuario (se **sobre-escriben** cada corrida) | `prod_churn_ml.prod_unification_customers_churn_prediction_recetas` (10.94M filas, 1 timestamp) |
| Dataset de entrenamiento | `prod_churn_ml.prod_unification_customers_churn_table_recetas` |
| Log del modelo (features, coeficientes, accuracy) | `prod_churn_ml.model_log_table_recetas` (51 corridas desde 2024-11-06) |
| Etiqueta publicada al perfil | `cdp_audience_686576.customers.churn_probability_label_recetas` ∈ {Low, Mid, High, null} |
| Algoritmo | Regresión logística (sklearn) · features arrancan con `opted_out, sfmc_unsubscribed, total_pageviews, …` |
| Cadencia | **Quincenal — días 1 y 16 de cada mes (~18:25 UTC).** Última corrida: 1-oct-2026, accuracy 0.78 |
| Distribución actual (10.94M total) | Mid 2.54M · Low 1.66M · High 12.1K · null 6.72M |
| Segmentos que usan la etiqueta | Tibios = Mid Probability · Fríos = High Probability (ambos filtran además por comportamiento y suscripción) |
| Métrica de rescate Ago-Sep (universo = etiqueta actual) | Mid: 2.54M → 31,399 abrieron → **11,571 primera vez** · High: 12.1K → 6,669 abrieron → **1,271 primera vez** |
| Nota | No hay histórico guardado. Para comparar antes/después hay que programar snapshot antes del siguiente retrain (16-oct-2026, ~18:25 UTC) |

## Pendientes abiertos con Rick (siguen pendientes)

| Pendiente | Lo desbloquea |
|---|---|
| Base de la meta de CTOR: `Clicks / Opens` (literal) vs `Clicks / Deliveries` | Rick |
| Rótulo final: "Churn Model" o "Churn Rate" | Rick |
| Umbral de "más de lo habitual" para notificaciones | Rick + TD |
| Hipótesis para Fríos (hoy no activos) | Rick |
| Datos CDP para §2 "¿Quiénes eran esos usuarios?" (envío masivo Tibios 2-sep): cortes sugeridos — enviados vs no enviados, recencia 7-12m, comportamiento post-envío | Rick / consulta en CDP |
| **Snapshot pre-Ago del modelo de Churn:** no hay histórico guardado; el próximo retrain es el 16-oct-2026 ~18:25 UTC. Para comparar antes/después hay que programar un job diario que copie `prod_churn_ml.prod_unification_customers_churn_prediction_recetas` a una tabla particionada por fecha | TD · programar antes del próximo retrain |
| **CLTV**: existe `cltv_tier`, `pcltv_3month`, `ltv_pred` en `cdp_audience_686576.customers`. Mismo problema de histórico — toca verificar si CLTV sí guarda snapshot | Consulta en CDP |

---

# Parte A · Para continuar en TD AI Studio

## A1. Qué se necesita

Construir en TD AI Studio, conectado a los datos de la CDP, el dashboard de la campaña **Propensión (Prevención de Churn) de AON Recetas Nestlé**, con la estructura de este documento.

Ya existe una versión de referencia en HTML con las cifras reales de un Excel (la hoja `PROPENSIÓN` del Reporte Consolidado Nestlé 2026 v8). Es una **maqueta con números reales**: sirve de modelo de estructura, textos y valores esperados. En TD, los números fijos se reemplazan por los que salgan de la CDP. Cada cifra del HTML trae su valor esperado en el atributo `data-raw` y su llave en `data-k`.

## A2. La pantalla

Cuatro secciones, en este orden. **Solo el nombre de la sección y sus preguntas.** Nada de titulares explicativos, conclusiones ni notas.

| # | Sección | Preguntas en pantalla | Contenido |
|---|---|---|---|
| 1 | Resultados | ¿Cómo van? | Tres tablas con los rótulos Hipótesis, Resultados y Realidad |
| 2 | Anomalía | ¿Qué pasó? · ¿Qué impacto tuvo? · ¿Qué aportó? · ¿Quiénes eran esos usuarios? | Tres tablas (Tibios, septiembre contra agosto) y un cuadro por llenar |
| 3 | Plan de acción | (ninguna) | Dos grupos: Reglas y Acciones |
| 4 | Resumen de la campaña | (ninguna) | Una tabla por segmento y dos cuadros por llenar: CLTV y Churn Model |

**Formato fijo en todas las tablas: segmentos en filas, métricas en columnas**, con los nombres del reporte: Sends, Deliveries, Opens, Clicks, Unsubs, Open Rate, CTOR, Click Rate (más UTOR y Delivery Rate donde se indica).

- **1.1 Hipótesis:** por segmento, la meta de Open Rate y de CTOR.
- **1.2 Resultados:** por segmento y mes (Agosto, Septiembre, Total): Sends, Deliveries, Opens, Clicks, Unsubs, Open Rate, CTOR, Click Rate.
- **1.3 Realidad:** por segmento y mes, hipótesis, real y diferencia en puntos porcentuales. La diferencia se dibuja como barra divergente con el cero rotulado «0 = hipótesis», con flecha y la palabra «por encima» o «por debajo».
- **2.1 ¿Qué pasó?** Tibios, agosto y septiembre, más una fila de variación: Audiencia, Sends Principal, Sends FUP, Sends Total, Principal / Audiencia.
- **2.2 ¿Qué impacto tuvo?** Mismas filas: Delivery Rate, Open Rate, CTOR, Click Rate, Unsubs, UTOR. Variación en puntos.
- **2.3 ¿Qué aportó?** Mismas filas: Deliveries, Opens, Clicks. Diferencia absoluta.
- **4 Resumen:** por segmento y para la campaña: la regla del segmento, Sends, Open Rate, CTOR, Unsubs.

## A3. Segmentos

| Segmento | Touchpoint | Regla (Rick, 12-oct) |
|---|---|---|
| Re-enganchables | E-PROP2 | Adquiridos en el último año sin ninguna interacción en los últimos 6 meses |
| Tibios | E-PROP1 | Interacción hace más de 7 meses y menos de 12 |
| Fríos | sin touchpoint en la hoja | Interacción entre 13 y 24 meses atrás. **No se ha activado** |

Cada touchpoint tiene dos envíos: **Principal** y **FUP** (follow up). La hoja etiqueta los segmentos con otras palabras («nuevos del último año que nunca han interactuado», «entre 6 y 12 meses»); **mandan las reglas de la tabla**.

## A4. Métricas, con su fórmula exacta

| Métrica | Fórmula |
|---|---|
| Sends | Envíos del Principal más los del FUP |
| Deliveries | Entregados, Principal más FUP |
| Opens | Aperturas únicas por envío, Principal más FUP |
| Clicks | Clics únicos por envío, Principal más FUP |
| Unsubs | Bajas, Principal más FUP |
| Open Rate | Opens / Deliveries |
| CTOR | Clicks / Opens |
| Click Rate | Clicks / Deliveries |
| UTOR | Unsubs / Opens |
| Delivery Rate | Deliveries / Sends |
| Principal / Audiencia | Sends del Principal / tamaño de la audiencia del segmento |

**Reglas que no se negocian:**
1. Se reporta el **Total = Principal + FUP**. El FUP no tuvo objetivo propio; la meta es general para todo.
2. Las tasas **siempre se recalculan desde los conteos**. Nunca se promedian tasas.
3. Opens y Clicks son únicos **por envío**, no personas. Agosto más septiembre suma eventos, no gente.
4. No se usan cifras de otras hojas ni de reportes anteriores.

## A5. Hipótesis (Rick, 12-oct)

| Segmento | Open Rate | CTOR |
|---|---|---|
| Re-enganchables | 15% mínimo | 0.6% |
| Tibios | 10% aproximado | 0.5% |
| Fríos | sin hipótesis | sin hipótesis |

**Decisión abierta de Rick, que cambia el sentido de la tabla 1.3:** hoy el CTOR meta se compara con el CTOR del reporte (Clicks / Opens), y sale muy por encima. Si Rick quiso decir Clicks / Deliveries (el Click Rate), sale por debajo. Hasta que lo confirme, el dashboard usa la lectura literal.

## A6. Cifras de referencia: conciliar antes de construir

**Primer paso en TD: verificar que la CDP reproduce las cifras de `Referencia-Conciliacion.md`.** Trae los conteos por envío (4 envíos), las tasas y los totales por segmento y de la campaña. Si TD obtiene otra cifra, se explica la diferencia antes de seguir.

Dos cosas de la hoja que hay que **contrastar con la CDP**, porque la hoja no las resuelve:

1. **Fechas.** Las filas de septiembre conservan las fechas de envío de agosto; solo la quincena es confiable. Rick indica que el envío masivo de Tibios fue el **2 de septiembre** (más de un millón de envíos). La hoja muestra 1,177,481 de Principal en la quincena 2026-09-Q1, pero no el día.
2. **Dos envíos grandes.** En Tibios de septiembre el FUP también es de 1,130,693. No se sabe si salió en un día aparte. Hace falta el **volumen por día de E-PROP1** (Principal y FUP) para confirmarlo.

Y una fila a revisar: el **FUP de Re-enganchables de septiembre** mide 72,617, que es 1.91 veces su Principal (37,997), y la hoja declara un Open Rate de 4.39% cuando sus conteos dan 3.94%. Puede estar sumando más de un envío. Conviene verlo en la CDP.

## A7. Lo que TD debe construir, porque la hoja no lo tiene

1. **¿Quiénes eran esos usuarios?** (sección 2). Análisis sobre los usuarios del envío masivo de Tibios. Cortes sugeridos, a ajustar a lo que exista en la CDP: enviados contra no enviados dentro de la audiencia; recencia de la última interacción (el segmento exige entre 7 y 12 meses); quiénes abrieron, hicieron clic o se dieron de baja.
2. **CLTV** y **Churn Model** (sección 4). Cuadros del impacto en el modelo de machine learning. Falta definir qué valor del modelo se muestra y contra qué se compara; una propuesta es el valor por segmento antes y después de la campaña. **Rick decide el rótulo:** su servilleta decía «Churn Model» y su mensaje «Churn Rate».
3. **Volumen por día.** La hoja no trae día por día. Hace falta para ver la anomalía y para el dashboard operativo.

## A8. Plan de acción (palabras de Rick, 13-oct)

**Reglas**
- **Volumen de envío:** máximo **10,000 envíos por día, después de una activación programada**. Los envíos programados, como el de 163,085 de agosto, no entran en esta regla.
- **Horario de envío:** envíos en el horario adecuado para cada usuario (STO), para CDMX.

**Acciones**
- **Dashboard de seguimiento operativo en TD Studio:** ver posibles anomalías más rápido; se actualiza diario con los datos de la CDP; envía notificaciones si el volumen empieza a subir más de lo habitual.
- **Falta definir qué es «más de lo habitual».** Hace falta un umbral. Una propuesta: alerta dura al pasar de 10,000 por día y una alerta relativa contra el volumen típico de los días anteriores. La decisión es de Rick y de TD.

## A9. Reglas de pantalla, para reproducirla en TD

- Orden y nombres de la sección A2. **Sin títulos explicativos, sin conclusiones, sin notas internas.**
- Una cifra en pantalla solo si viene de la CDP (o de la hoja, mientras no esté conectada).
- Fondo oscuro cálido con degradados suaves que se mueven; aparición animada al desplazarse. Estilo tomado de bnn.mx. Paleta de recetasnestle.com.mx.

| Elemento | Valor |
|---|---|
| Fondo de página · de tarjeta | `#1C0A07` · `#270F0A` |
| Texto · secundario · apagado | `#FFFAF5` · `#F5D5DA` · `#D8BDB6` |
| Re-enganchables · Tibios · Fríos (solo relleno de punto o chip) | `#FFCD00` · `#F09100` · `#50AFE1` |
| Por encima · por debajo de la hipótesis | `#97D815` · `#FF5C7A` |
| Degradado (solo fondo y filetes, 135 grados) | `#B9193C` → `#D7235F` → `#F09100` → `#FFCD00` |
| Tipografía | Outfit. Mínimo 13 px |

Los degradados **nunca** van en barras, cifras ni texto. En celular las tablas pasan a tarjetas, sin scroll horizontal. Las tres ilustraciones del plan de acción están en `herramientas/assets/`.

## A10. Lo que se desconoce de TD AI Studio

Esto no se sabe y no se supuso. Se completa al llegar:
- En qué formato recibe una estructura: ¿acepta el HTML, una especificación, un prompt?
- Qué tablas y campos de la CDP traen envíos, entregas, aperturas, clics y bajas por touchpoint y por envío.
- Cómo se identifica en la CDP a un usuario como Re-enganchable, Tibio o Frío (las reglas están en A3).
- Cómo se programan la actualización diaria y las notificaciones.

## A11. Orden sugerido de trabajo en TD

1. Conectar los datos y reproducir `Referencia-Conciliacion.md`. Resolver las diferencias.
2. Construir las secciones 1 y 4 (tablas) con los datos de la CDP.
3. Construir la sección 2 con el volumen por día, y llenar «¿Quiénes eran esos usuarios?».
4. Construir los cuadros CLTV y Churn Model.
5. Montar el dashboard operativo con actualización diaria y notificaciones (A8).
6. Decidir con Rick: base del CTOR, rótulo Churn Model o Churn Rate, umbral de «más de lo habitual».

---

# Parte B · Para continuar desde una sesión de Claude

**Construido, validado y publicado en `main`** (13-oct-2026).

| Prueba | Resultado |
|---|---|
| `valida-cuadre.py`: cada cifra del HTML y de la referencia recalculada desde el Excel | 803 comprobaciones, 0 fallos. Con errores sembrados falla siempre |
| `contraste-pixeles.py`: texto sobre los píxeles renderizados | 327 textos, ninguno bajo 4.5 a 1, a 1440 y a 390 px |
| `revisa-render.py` del skill | Sin desbordamiento horizontal, ningún texto bajo 13 px |
| `lint-texto.py` | Solo texto aprobado; rechaza insights, notas y cifras que no vengan de la hoja |
| Regenerar desde cero | El HTML queda idéntico byte a byte |
| Paleta | `valida-paleta.py`: entidades ΔE 19.3 (piso 15), entidad contra estado ΔE 24.4 (piso 14) |

## Cómo se regenera

La fuente única es la hoja `PROPENSIÓN` de `negocio/nestle/(InternoCOPIA)-Reporte-Consolidado-Nestle-2026-v8.xlsx` (sha256 `f60bbac8…`). **Si la hoja cambia, se corre todo en orden; si un validador falla, no se entrega.**

```bash
pip install openpyxl playwright Pillow          # no persiste entre sesiones
cd negocio/nestle/rn/rn-aon/propension-churn/herramientas
/usr/bin/python3 -I extrae-hoja.py              # hoja -> crudo-propension.json
python3 construye.py                            # -> datos.json, el HTML y Referencia-Conciliacion.md
/usr/bin/python3 -I valida-cuadre.py --html "../(Interno) Dashboard-Propension-AON-RN.html"
python3 lint-texto.py "../(Interno) Dashboard-Propension-AON-RN.html"
/usr/bin/python3 contraste-pixeles.py "../(Interno) Dashboard-Propension-AON-RN.html"
/usr/bin/python3 ../../../../../../.claude/skills/rick-dashboard-metodo/scripts/revisa-render.py \
  "../(Interno) Dashboard-Propension-AON-RN.html" --piso-fuente 13 --ancho-movil 390 \
  --chromium /opt/pw-browsers/chromium-1194/chrome-linux/chrome --salida /tmp/render
```

En este entorno `python3` y `pip` apuntan a intérpretes distintos: openpyxl, Playwright y PIL viven en `/usr/bin/python3`. `construye.py` y `lint-texto.py` solo usan la librería estándar.

## Qué hay en la carpeta

| Archivo | Qué es |
|---|---|
| `(Interno) Dashboard-Propension-AON-RN.html` | El dashboard de referencia |
| `Referencia-Conciliacion.md` | Cifras para conciliar la CDP. Generado, no se edita |
| `CANON.md` | Qué cifra manda, definiciones, banco de preguntas, sistema visual |
| `herramientas/construye.py` | Resuelve todas las vistas. La pantalla no calcula |
| `herramientas/pagina.py`, `estilo.css`, `animacion.js` | Arman el HTML |
| `herramientas/valida-cuadre.py`, `contraste-pixeles.py`, `lint-texto.py` | Los tres vigilantes |
| `herramientas/assets/` | Fuente Outfit y las tres ilustraciones. Los `.jpg` sin `-opt` son los originales de la API (Cloudflare Workers AI): **la generación no se repite idéntica, no se borran** |

## Pendientes con Rick

| Pendiente | Lo desbloquea |
|---|---|
| Base de la meta de CTOR. Si es Clicks / Deliveries, el cambio es una línea: en `construye.py` (bloque `realidad`) usar `cr` en vez de `ctor`, y lo mismo en `esperado()` de `valida-cuadre.py` | Rick |
| Rótulo «Churn Model» o «Churn Rate» | Rick |
| El Plan de acción y el Resumen no llevan pregunta, por instrucción de Rick. Si quiere una, va en `pagina.py` y en `lint-texto.py` | Rick |
| Umbral de «más de lo habitual» para las notificaciones | Rick y TD |
| Fríos sin activar y sin hipótesis | Rick |
| `Report_Resumen` y `Data_Email` siguen con cifras anteriores. No se usan | Quien mantiene el consolidado |
