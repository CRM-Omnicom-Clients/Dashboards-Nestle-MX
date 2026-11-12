---
name: rick-reporte-consolidado-nestle
description: >-
  Produce y actualiza el Reporte Consolidado de email marketing + Qcart de Nestlé (intención de compra):
  carga Data_Email (SFMC/Salesforce), Data_Qcart (descargas CSV de carritos y productos de Qcart), catálogos,
  calcula los reportes Mensual/Quincenal/Campaña+Qcart con atribución de productos Nestlé, y aplica el formato
  completo (apartados por color + formatos numéricos + pestañas) SIN romper fórmulas ni estilos. Úsalo SIEMPRE que
  se trabaje el "Reporte-Consolidado-Nestle" / "reporte de campañas Nestlé" / intención de compra Qcart /
  penetración Nestlé / actualizar Data_Email o Data_Qcart / formatear ese Excel / auditar sus métricas / conciliar
  panel vs descargas Qcart — aunque no digan la palabra "skill". Incluye reglas críticas para editar el .xlsx con
  Node/SheetJS + XML porque SheetJS borra estilos y renumera numFmt, XLOOKUP se corrompe, y las rutas de OneDrive
  llevan acentos.
---

# Reporte Consolidado Nestlé (email + Qcart)

> ## ⚠️ Existe un sistema nuevo que hace este mismo trabajo
>
> **`crm-reporte-orquestador`** lo reemplaza: mismo alcance, pero con agentes separados por paso,
> guardianes deterministas que miden en vez de recordar, y estado en disco que sobrevive a una
> compactación. Los dos se disparan con las mismas palabras — **si vas a correr un corte completo,
> usa el orquestador.**
>
> Este skill **se conserva a propósito** y no se retira hasta que el sistema nuevo haya corrido de
> punta a punta. Sigue siendo útil para **una tarea suelta y acotada** (un formateo, una consulta
> puntual sobre este workbook).
>
> ⚠️ Y para lo que sí uses de aquí: **verifica antes de creerle.** Es un documento largo que se
> escribió por acumulación; partes de su estado —rutas, qué hoja existe, hasta dónde está cargado
> cada reporte— pueden haber caducado. La verdad medida está en
> `node ~/.claude/tools/reportes/correr-guardianes.js <workbook> --texto`.

## Qué es y cuándo usarlo
Este skill mantiene el workbook consolidado de email (SFMC) + Qcart de Nestlé. Se usa para: **actualizar datos**
(nuevo periodo de envíos o de Qcart), **recalcular la atribución Nestlé**, **formatear** el archivo, y **auditar** que
todo cuadre. La filosofía innegociable: **nunca inventar datos** ("sin datos irreales") y **no romper lo que
funciona** — ante incertidumbre que no se pueda verificar, conservar el estado bueno y reportarlo con honestidad.

**Archivos (nomenclatura vigente jul-2026):**
- **OFICIAL** (el que se comparte con el equipo): `Reporte-CRM-Consolidado-Nestle-2026.xlsx` en
  `…\Archivos de Leslie Monserrat Monterrosas (Omnicom) - Nestlé 2026\Marcas\CRM General\` **(MOVIDA 16-jul-2026** — antes
  estaba en `Reportes\Total Proyecto\`; el equipo la reagrupó con el Calendario de envíos, briefs y Estatus Campañas.
  Verificar la ruta antes de publicar: la mueven sin avisar).
- **SANDBOX/pruebas:** `Claud-Reporte-Consolidado.xlsx` (en `…\Nestlé\Reportes-Nestlé\`).
- **Fuente de email:** `Reportes-Datorama\Datorama-Nestle-WK##.xlsx` — usar SIEMPRE el WK de número más alto.
- **Campañas email-only (sin Qcart):** algunas campañas no tienen data de Qcart (p.ej. **Nescafé Tercer Tiempo** y
  **Purina** —marca nueva—). Entran en Data_Email + Report_Mensual/Quincenal, pero NO en Report_Campana+Qcart (que
  solo incluye journeys con venta/Qcart). Marcarlas NUEVA_CAMPAÑA y agregar su fila a Catalog_Campanas.

## Archivos (registro oficial — usar SIEMPRE estos alias)
**Se EDITAN (3):**

| Alias | Archivo | Dónde |
|---|---|---|
| **Claud** | `Claud-Reporte-Consolidado.xlsx` | `…/Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/Reportes-Nestlé/` — **sandbox, se trabaja aquí** |
| **Producción** | `Reporte-CRM-Consolidado-Nestle-2026.xlsx` | `…/Archivos de Leslie Monserrat Monterrosas (Omnicom) - Nestlé 2026/**Marcas/CRM General**/` — **compartido, gate obligatorio**. ⚠️ Movida 16-jul-2026 (antes `Reportes/Total Proyecto/`) — **confirmar ruta con `find` antes de publicar**. Node NO lee esta ruta (acentos, regla #1) → verificar disponibilidad con bash, no con `fs.openSync` (da ENOENT falso). |
| **Interno** | `(interno) Seguimiento&Monitoreo Nestlé 2026 - Martech.xlsx` | `…/Nestlé/Reportes-Nestlé/` — seguimiento interno (PAID + CRM) |

**Solo LECTURA (fuentes — NUNCA escribirles):**

| Alias | Archivo | Para qué |
|---|---|---|
| **Integrado** | `Reporte integrado 2026.xlsx` (de Leslie) | BAU/benchmarks. Es un reporte de **PAID** con algunas filas email (`Plataforma=SFMC`) de pasada — **NO es fuente CRM completa** (88 filas en 3 años). |
| **WhatsApp** | `Resultados Whatsapp CRM 2026.xlsx` | canal WA (3 hojas con esquemas distintos entre sí; Maggi en cero) |

## Regla de oro operativa
Trabaja **1 paso a la vez**, con **backup antes de tocar**, **autovalidación después de cada escritura**, y valida
con el humano entre fases. Guarda scripts en `_scripts/`. Reporta al final qué **inferencias** hiciste.
> **Y la más importante (jul-2026): NO inferir reglas de negocio.** Objetivos, segmentos, campañas y marcas **no se
> deducen** de los naming — engañan. Preguntar SIEMPRE; lo no confirmado se marca `⚠ Por confirmar` en
> `Catalog_Campanas.Estado_Dato` con su nota. Nunca adivinar en silencio.

---

## Modelo de datos (capas del workbook)
- **Capa cruda — canal WhatsApp:** **`Data_WhatsApp`** (A–AE, 31 cols) — **hoja PROPIA, WhatsApp NO va en Data_Email.**
  Mismas dimensiones canónicas + métricas core + nativas WA (embudo opt-in Aud_Original→Filtros→Final, Logins/Recetas,
  códigos de error Meta). **Por qué separada:** 836 fórmulas tocan Data_Email y ninguna filtra canal → meter filas WA
  obligaba a parchar ~700 SUMIFS + 54 XLOOKUP y **convertir 4 `SUM(Data_Email!T:T)` y 4 SUMIF del auditor** (que si no
  sumarían WhatsApp y pondrían 🔴 en todo el control); además ~18 de 36 columnas quedarían vacías por fila WA. Todo eso
  por el **0.15%** del volumen (7,374 envíos WA vs 5,030,349 email). En los reportes entra como **filas separadas por
  Canal** (decisión de Rick).
  > 🚨 **El CTOR de WhatsApp NO siempre es un dato.** En **Tercer Tiempo** los clicks NO están medidos: la fuente los
  > deriva de `Read × un CTOR asumido fijo` (pesimista 10% / **realista 12%** / optimista 14.62%). Verificable:
  > 1124×0.12=134.88 y 2405×0.12=288.6 → por eso ambos envíos dan exactamente 12.0%. **Es un supuesto, no una medición**
  > — nunca reportarlo como resultado ni compararlo contra benchmark. Los de **Hotcakes sí son reales** (CTOR varía:
  > 11.2/16.4/12.0/18.1%). Distinguir SIEMPRE con la col `Clicks_Medidos`. Detalle: `Protocol_IA_Email` R16–R18.
- **Capa cruda:** `Data_Email` (SFMC: sends/deliveries/opens/clicks/rates por envío) — **A–AJ = crudo intacto** +
  **AK–AO = columnas CANÓNICAS** (AK Canal · AL BU_Canonico · AM Marca · AN Campana_Canonica · AO Segmento_Canonico),
  llenadas por lookup vivo al catálogo con `IFERROR(INDEX(Catalog_Campanas!$X:$X,MATCH($B{r},Catalog_Campanas!$D:$D,0)),"")`
  — **INDEX/MATCH, nunca XLOOKUP** (se corrompe). El crudo NUNCA se sobrescribe (R15): si SFMC inventa otra variante, se
  agrega al catálogo y listo. Los reportes nuevos consumen las canónicas; los viejos siguen con el crudo hasta migrarse.
  Y `Data_Qcart` (descargas CSV de
  Qcart: **carritos** = Doc 2 y **productos** = Doc 3). Data_Email trae `Send_Week` (col M) = **serial del LUNES** de la
  semana (0 sin dato) + `Send_Week_Label` (col AJ, agregada jul-2026) = `"WK##-2026"` derivado del serial (semana ISO) —
  la llave legible para los reportes semanales. Regenerar el label en cada update de Data_Email.
- **Catálogos:** `Catalog_Campanas` (**reconstruido jul-2026: 12 cols, es la FUENTE DE VERDAD de las dimensiones** —
  BU · Marca · Campaña · Objetivo · Segmento_Canonico · Segmento_SFMC_Raw · Canal · Touchpoint · Journey_ID ·
  Fecha_Lanzamiento · Estado_Dato · Notas), `Catalog_Recetas_Qcart`, `Catalog_Productos_Nestle` (patrones de match
  Nestlé), **`Catalog_Benchmarks_BAU`** (benchmarks BAU por BU; fuente = Integrado de Leslie — ⚠️ EN REVISIÓN, ver abajo).
  > **Modelo dimensional (jul-2026): BU ≠ MARCA ≠ CAMPAÑA.** BU = RN/Nescafé/Purina (alineado al master calendar y al
  > BM del Integrado). Marca admite **multi-valor coma-separado** (Hotcakes → `"Carnation, La Lechera"`). Campaña
  > NUNCA es la marca (La Lechera → campaña **"Antojo Infinito"**; Pro Plan → **"Fuel for life"**; Maggi → **"Mundial"**).
  > El **segmento NUNCA es el nombre del objetivo** (`Inspiration` → segmento real **"Interés Salado"**; `AON-APP` →
  > **"Activos"**; `AON-LOYALTY` → **"Usuarios con Engagement"**). El dato crudo se conserva; el canónico se AGREGA.
  > **Los nombres de journey NO son inferibles** (el WA "O_Welcome-NC007067" es Purchase, no Welcome) → preguntar,
  > nunca deducir; lo no confirmado se marca en `Estado_Dato`. Reglas completas: `Protocol_IA_Email` **R11–R16**.
- **Capa reporte:** `Report_Mensual`, `Report_Quincenal`, **`Report_Semanal`** (espejo del quincenal pero por semana:
  cruza email por `Send_Week_Label`; dims A-W con **E Semana ISO · F Fechas · G Touchpoint**), **`Report_Campana+Qcart`**
  (la principal: cruza email + Qcart por **Mes + Marca + Segmento**; Maggi desglosado por **partido** vía Touchpoint
  e-*1/e-*2, con columna D "Touchpoint") y **`Report_Insights_Operativo`** (matriz de insights consultivos por quincena — ver abajo).
  > ⚠️ **`Report_Insights` (fichas por quincena) se ELIMINÓ 23-jul-2026** por redundante con `Report_Insights_Operativo`; nada la referenciaba (0 fórmulas). `Report_Insights_Semanal`/`Report_Semanal` tampoco están en el workbook (solo sobrevive `Send_Week_Label` en Data_Email). El **único insights vivo es el Operativo**.
- **Capa reporte — hojas nuevas (jul-2026):**
  - **`Report_Resumen_Campana`** — rollup EJECUTIVO. 1 fila = **Campaña × Quincena**; bandas Identidad · Email Principal ·
    Email FUP · Email Total · Qcart. **Anclaje Qcart (crítico):** el Qcart es MENSUAL y el email QUINCENAL → el Qcart del
    mes se ancla a la **quincena de lanzamiento** (la del 1er envío Principal del mes) y aparece **una sola vez**; las
    otras quincenas muestran `— ver Qx`. Así sumar la columna da el total mensual **sin doble conteo**. Sin carrito →
    `Sin Qcart`. SUMIFS vivos + valores cacheados.
  - **`Report_Insights_Operativo`** — matriz operativa quincenal: filas = quincena (más reciente arriba), columnas = las
    campañas **canónicas**, `N/A` si no hubo envíos. Cada celda = 4 líneas (Desempeño con touchpoints · Intención Qcart o
    "Sin Qcart" · Objetivos + panorama de clusters · Acción). Nunca mezclar journeys distintos en una línea de objetivos.
    > 🚨 **Reglas de insight (jul-2026, Rick) — detalle completo en `Protocol_IA_Reportes` Bloque H:**
    > - **Intención: número Y %**, nunca solo el % (`$214,026 total · $16,687 Nestlé (7.8%) · 744 carritos`).
    > - **Siempre OR y CTOR** en cada objetivo y cluster; y **panorama de TODOS los clusters**, no solo mejor/peor.
    > - ⛔ **No forzar "mejor/peor"**: cuando OR y CTOR se contradicen es FALSO rankear por OR. Caso real: Botana
    >   OR 37%/CTOR 0.6% vs Bebidas OR 31%/CTOR 1.1% — Botana "ganaba" convirtiendo la mitad. Si discrepan, **decirlo**
    >   ("X lidera apertura, Y convierte mejor") — esa discrepancia **es** el insight.
    > - ⛔ **Benchmark por Campaña × OBJETIVO**, jamás cruzando journeys. Bug real: Hotcakes May-Q2 (Purchase+Loyalty,
    >   OR 39.7%) se comparaba contra su Abr-Q2 (**Inspiration**, OR 84.6%) → "44.9pp bajo tu mejor" y una acción sin
    >   sentido. Inspiration abre naturalmente más que Purchase.
    > - **IQS operativo** (determinista, umbral 60, máx 2 acciones/celda): Cuantificado 25 · Comparado 20 · Accionable 25 ·
    >   Material 20 (≥100k envíos o brecha ≥10pp) · No repetido 10. Si nada pasa → "sin acción prioritaria", **nunca**
    >   inventar recomendación para llenar.
    > - ⛔ **La acción abre con VERBO**, no con etiqueta. Estructura: `[verbo + qué hacer] — [evidencia con cifras]:
    >   [diagnóstico]`. MAL: `CLIC (Purchase): CTOR 0.7% está 0.8pp bajo su mejor → un solo CTA`. BIEN: `Dejar un solo
    >   CTA arriba del fold en Purchase — su CTOR (0.7%) está 0.8pp abajo de su propio mejor (1.5%): abren pero no
    >   hacen clic`. Las claves `asunto/clic/mix/dispersion/techo/qcart/fup/baseline` son **internas del IQS** (dedup,
    >   diversidad, anti-repetición) — **nunca** se imprimen. Acciones **numeradas** `1) 2)`, jamás separadas por `|`.
    > - **"Primera corrida" NO es una acción** → decirlo honesto: no hay histórico contra qué medir; los números quedan
    >   de referencia. Y el **baseline es FALLBACK**: si hay ≥1 acción real, se descarta (si no, salían juntas
    >   "Concentrar en Futboleros" + "todavía no hay acción" = contradicción).
    > - **Dedup por palanca+destino** y **diversidad**: la 2ª acción usa otra palanca (si no, salía "subirle volumen a
    >   FamilyKids" dos veces, una por journey).
    > - **Candidato DISPERSIÓN**: si el CTOR entre clusters abre ≥3×, entra aunque el líder gane en ambas. Sin esto se
    >   perdía el mejor hallazgo de Tercer Tiempo (Futboleros CTOR 9.3% vs Amazon 0.3% = **35×**).
    > - **`Audiencias:`**, nunca "audiencia única". Si el `Segmento_Canonico` es multivalor (Antojo Infinito =
    >   `"Career Focused, New Parents, Traditional Parents"`) → `A + B + C (envío combinado, no separables)`.
  > ⚠️ **`Report_Semanal` y `Report_Insights_Semanal` viven SOLO en el SANDBOX Claud** como registro histórico; **NO se
  > publican al OFICIAL** (decisión jul-2026: el cliente se queda solo con el quincenal). El build queda documentado
  > (sección "Reportes derivados") por si se retoman. `Send_Week_Label` sí queda en Data_Email de ambos (dato inocuo).
- **Protocolos (para Copilot/IA):** `Protocol_IA_*`. **Control:** `Control_IA_Auditoria`, `Control_IA_Bitacora`.
- **Soporte (ocultas):** `Soporte_IA_Qcart_Productos` (Producto Estrella), `Soporte_IA_Stage_*`, `..._Benchmarks`,
  `..._Contexto`, y `Data_Qcart_Legacy` (versión vieja; aún alimenta Producto Estrella — no borrar sin migrar).

Estructura de columnas detallada por hoja: ver `references/estructura-hojas.md`.

🔴 **Antes de redactar CUALQUIER insight, leer `references/insights-como-escribirlos.md`.** Destila la
iteración completa del reporte Maggi Mundial (31-jul-2026): las 5 reglas de validez que evitan publicar una
conclusión falsa —benchmark de otro negocio · comparar canales entre sí · comparar métricas con distinta
fuente de medición · leer un cero de atribución como resultado · concluir sin agregar—, qué análisis dieron
los mejores hallazgos (dispersión, correlación de rangos, volumen vs rendimiento), el formato final
(**una columna, párrafo corrido, fusionada por touchpoint**) y las reglas de lenguaje, empezando por
**nunca escribir "conversión"** sin su denominador.

---

## Reglas de atribución (los modelos matemáticos)
- **Llave de cruce:** la receta corresponde a un `segmento + journey + mes`. El match Nestlé se hace contra
  `Catalog_Productos_Nestle` (columna `Patrones_Match`, `Activo='Sí'`), normalizando acentos **y guiones** (el producto
  del CSV `"sazonador liquido mi-che"` NO matchea el patrón `"mi che"` si no colapsas `-`→espacio; mi-che es Nestlé/Maggi
  y pesa fuerte en la penetración). Qcart se consolida **por receta × tienda × medio** (email/whatsapp separados); si un
  Journey tiene varios envíos (p.ej. Maggi por partido), el Touchpoint del naming (`e-bebida1`/`e-bebida2`) desglosa el
  partido en Data_Qcart y en Report_Campana+Qcart.
- **Intención Total** (`Data_Qcart!N`) viene de Doc 2 (carritos). **Intención Nestlé** (`Data_Qcart!O`) viene de
  Doc 3 (productos matcheados). **Penetración Nestlé = O / N** (`Report AR`).
- **Doc 3 solo itemiza ~8% de los productos del carrito** → la penetración es un **piso honesto, no inflado**. No
  "maquillar" hacia arriba. Si un match sube la atribución, verifícalo (idealmente adversarialmente) antes de sumarlo.
- **Cap anti-sobreatribución:** `O` nunca puede superar `N` en una fila (si pasa, capear `O=N`).
- **Multiplicadores vs tasas:** el shortlink de Qcart es **único por canal** (no hay tráfico externo). Por eso
  cualquier ratio >100% (Views/Clicks, Carritos/Clicks, Productos/Carritos) = **dato inflado en la fuente**, NO
  amplificación → es un **flag de calidad para revisar con Qcart**. Estos van como decimal `0.00` (multiplicador),
  no como `%`.
- **Discrepancia panel vs descargas ~10%** en intención: conocida; reportarla, no ocultarla.

---

## Pipeline mensual (fases con gate humano entre cada una)
1. **Entendimiento** — leer documentos fuente y mapear estructura (usa `read_all_sheets` sobre el Excel de
   implementación y las descargas CSV de Qcart).
2. **Data_Email** — refrescar con MAX por llave `Journey_ID` (col H **de Data_Email**, NO Content_Name que viene
   sucio **y cambia de formato entre semanas** → filas *refresh* parecen nuevas si cruzas por él). Monótono
   (MAX), llave anti-duplicado, naming de 3 niveles. Ver protocolo `protocol-actualizacion-datos`.
   > 🔁 **"No hay envíos nuevos" ≠ "no hay datos nuevos" (confusión recurrente — leer siempre).** Las métricas de
   > email ACUMULAN: opens/clicks siguen sumando días después del envío. Un pull de Datorama más reciente PUEDE traer
   > números más altos para los MISMOS envíos, sin envíos nuevos → por eso el refresh es **MAX por Journey_ID** (monótono).
   > **PERO** el engagement madura RÁPIDO (~3-7 días): si el load previo ya era ≥1 semana después de los envíos, los
   > números suelen estar FINALES y un pull nuevo no agrega nada. **No asumir ninguna de las dos** — hacer el diff
   > envío-por-envío. **Cómo verificar bien (mi error típico):** (1) el WK de Datorama trae hojas por MES
   > (`AON-RN-<mes>`); un envío vive en la hoja de SU mes — otras hojas traen filas FRAGMENTO (sends=0, opens parciales)
   > → NO comparar contra la hoja equivocada (busqué La Lechera en `AON-RN-Julio`, sends=0/opens=1995, cuando vive
   > completa en `AON-RN-Junio` con 91,379 sends/29,398 opens). (2) Match por `content_name + send_date + sends`
   > (llave robusta); columnas del export: **I=Email Sends · L=Email Unique Opens · N=Email Unique Clicks**.
   > (3) Tomar MAX por envío. Caso real (23-jul-2026): WK29 vs Data_Email cargado de WK27 → 44 idénticos, **0 crecieron**
   > (junio ya maduro), 0 envíos de julio (lag de Datorama). Resultado correcto: NO cargar nada.
   Ojo con los **3 identificadores**: Journey NAME (prefijo `O_Welcome-NC007067`, en Catalog_Campanas) ≠ Journey_ID
   (JID numérico, la llave) ≠ content_name (la pieza, sucio). El "Campaign ID" col H del **reporte fuente** es el
   Datorama_Campaign_ID, NO el Journey_ID.
3. **Data_Qcart** — cargar carritos (Doc 2 → col N) y productos (Doc 3 → col O matcheado). Recalcular columnas Nestlé
   (`O,T,U,V,W,X,J`) con el catálogo actual. Capear sobreatribución.
4. **Reportes** — los `Report_*` se recalculan solos por fórmula (SUMIFS/XLOOKUP). Verificar que subtotales
   (SUMIF por `utm` col E) y TOTAL cuadren con la suma del detalle.
5. **Formato** — aplicar el sistema de formato completo (ver abajo).
6. **QA / Auditoría** — correr `scripts/_audit_formats.js` + verificar 4 dimensiones (marca, framework de métricas,
   segmentación, fechas/nomenclatura) + que la fila de validación del reporte marque ✅.

Entre fases: **validación humana**. Dentro de una fase con muchos bloques: auto-validar y notificar solo al terminar.

### Reportes derivados (semanal, u otra granularidad) e insights a escala
- **Reporte derivado = clona las fórmulas del reporte análogo** (el Semanal clona el Quincenal) y **cambia solo la
  llave de pivote**: el Quincenal cruza por `Data_Email!$AH` (Send_Quincena); el Semanal por `Data_Email!$AJ`
  (Send_Week_Label). El resto (dims, XLOOKUP de subjects, split Principal/FUP) es idéntico. El **FUP se cruza por
  Touchpoint SIN filtro de periodo** (igual que el quincenal: el FUP se envía en semana/quincena posterior al Principal).
- **Verificar cuadre por LLAVE** (`join('|')`) contra `Data_Email` (Σ Principal del periodo = Σ por combo). No con `===`.
- **Insights narrativos por periodo, a escala:** una ficha por periodo con **cifras ancla vivas** (fórmula SUMIFS por
  llave de periodo, no texto). Para muchos periodos, redactar la narrativa con un **workflow en paralelo** (1 agente por
  periodo, con su data real; el agente escribe SOLO texto, las fórmulas ancla las pone el ensamblador). Formato streamlined
  de 5 bloques para cadencia corta (semanal); 7 para quincenal/mensual.

---

## ★ Aprendizajes de la carga masiva 24-jul-2026 (WK30 + Qcart + reportes) — leer antes de una carga grande

- **Datorama cambió de layout en WK30+:** agregó columnas nativas **`Journey ID` + `Journey Name`** (corrió todo +2 cols vs WK29). ⇒ **detectar columnas por NOMBRE de header, NUNCA por índice fijo** (un parseo con índices de WK29 lee "sends" = el GUID del Journey ID). El `Journey Name` nativo (ej. `MX_Automa_User_Mixto_AutomatedJourney_CDP_ProPlan_E3A_NA`) por fin da el nombre de journey que antes no estaba en la data.
- **Content name ≠ Journey name.** El content (`O_Maggi-Seleccion...`, en Data_Email col Q + Datorama) NO es el journey. El journey (Journey Builder, estilo `MX_Automa...`) solo viene del `Journey Name` de WK30+ o del calendario; **el MCP de SFMC es de GEPP, NUNCA Nestlé.** Data_Email lleva col **`Nombre_Journey`** (col AP, poblada desde WK30). Ver memoria `journey-vs-content-naming`.
- **Reconciliación de carga = por 5-LLAVE (Journey_ID+Segment+Touchpoint+Email_Type+Version), NUNCA por content_name** (cambia de formato entre WK → filas *refresh* parecen nuevas). Caso real WK30: de 16 "nuevas por content", 7 eran duplicados (misma 5-llave); solo 9 (Pro Plan Comunidad) eran genuinamente nuevas.
- **Nombres de hoja vigentes (los renombraron):** `Report_Mensual` · `Report_Campana+Qcart` · **`Report_CompletoQcart`** (era "Report_Resumen_Campana") · `Report_Insights_Operativo`. `Report_Insights` (fichas) se eliminó (jul-2026).
- **Data_Qcart — 5 columnas nuevas (AE-AI):** `Fecha_Envio` · `Fecha_Descarga` · `Shortlink_Code` · `utm_term` · `utm_source`. Los CSV vienen en 2 formatos: viejo "Camps" (6/7 cols, sin utm_content/term) y **nuevo rico** (10/11 cols con `utm_content`=touchpoint, `utm_term`=segmento). **Tienda** = el sufijo del NOMBRE del shortlink (`_W`/`_C`) MANDA sobre el `store` del producto (ruidoso). **WhatsApp** va en el mismo Data_Qcart con `Medio=WhatsApp`; en los reportes = **columna Medio + filas separadas por medio** (decisión de Rick).
- **EDITAR reportes: quirúrgico por XML con adm-zip, NO SheetJS+pipeline** cuando el cambio es acotado — preserva estilos, no corrompe XLOOKUP/theme, y evita el pipeline pesado. Recetas:
  - **Append** (hojas sin subtotales, ej. Report_Mensual/CompletoQcart): filas antes de `</sheetData>` + bumpear `<dimension>`. Bajo riesgo.
  - **Insertar filas** con subtotales/validación (ej. Report_Campana+Qcart): renumerar filas ≥punto `+N`, **extender rangos de datos** (`$2:$16`→`$2:$20`) y **shiftear refs ≥punto** en fórmulas de subtotal/TOTAL/validación. **Verificar SIEMPRE replicando la validación viva en Node** (report total = fuente Data_Qcart) ANTES de publicar.
  - ⚠️ **JS `String.replace(re, str)`: el `$` de un monto (`$182,401`) se interpreta como backreference** y corrompe el texto → usar **forma de función** `replace(re, m=>nuevo+m)`. (Mismo bug que el `-replace` de PowerShell, regla #4.)
  - Las canónicas (AL-AO / AA-AD) de filas nuevas son fórmulas SIN valor cacheado → Node no las ve (recalculan en Excel); verificar derivando del crudo (Brand→canónica).
- **Pro Plan Comunidad (Purina):** journeys `E3A/E3B/E3C` = personas **Pet Parents / Pet Aspiracionales / Pet Owners** (códigos PP/PA/PO), NO el pet type (Perros/Gatos/Mixto → va en Touchpoint). Campaña=Fuel for life, Objetivo=Enriquecimiento.
- **OneDrive de Rick revierte escrituras al Claud si Excel lo tiene abierto** (perdió cambios y hasta backups en `_backups/`): confirmar Excel cerrado + guardar copia segura en el HOME (`_claud_SAFE_*.xlsx`, fuera de OneDrive) + re-leer live tras escribir. Ver memoria `onedrive-clobber-claud`.
- **MOVER / INSERTAR columnas sin romper fórmulas → `scripts/column_ops.js`** (creado 24-jul-2026). El "reporte roto" al mover una columna a mano es porque, fuera de Excel (COM caído), NADIE reescribe las referencias. El módulo replica ese ajuste: `moveColumn(xml,from,to)` (rotación) e `insertColumns(xml,at,count)` (shift). **Regla:** sólo recorre refs *within-sheet*; PROTEGE cross-sheet (`Data_Email!$T:$T`) y strings (`"Walmart"`). Recuerda el `<dimension>` (`bumpDimension`) y **reordenar celdas por columna dentro de cada fila** (OOXML lo exige — el módulo ya lo hace). **VERIFICAR sin Excel:** (1) estructural 0 shared/0 #REF/orden/`_xlfn` intacto; (2) semántico = **recomputar SUMIFS/MINIFS en JS vs el `<v>` cacheado** (no cambia al mover) — si empatan, las refs quedaron bien. Plantillas: `_verify_move.js`, `_verify_dates.js`.
- **Columna `Medio` (jul-2026, Rick): va en D, justo tras Campaña**, en los 2 reportes con Qcart (`Report_Campana+Qcart`, `Report_CompletoQcart`). Report_Mensual es solo-email (sin Medio). Ojo: **CompletoQcart YA filtra por Medio** (`Data_Qcart!$Y:$Y=$D{fila}`); **Campana+Qcart NO** (comingla email+WA en la fila de segmento — es un rollup; sus filas WA son etiquetas). Al mover Medio, el ref `$Y=$AA{r}` de CompletoQcart siguió a la columna correctamente (→`$D{r}`).
- **Columnas de rango de datos `Fecha_Desde` / `Fecha_Hasta` (Rick, "de qué fecha a qué fecha se toman los datos"):** una por reporte, **antes de las métricas** (Mensual F/G, Campana+Qcart K/L, CompletoQcart J/K). `Send_Date` = Data_Email col **L** (serial); MIN/MAX por las **mismas llaves que Sends** (Mensual AI/B/C/D/AG · Campana+Qcart AN/AO/AG · CompletoQcart AN/C/AO/F/AH). Formato `dd/mm/yyyy` vía numFmt propio + `applyNumberFormat`. Filas Qcart-only (Maggi WA) → sin email → **en blanco**. ⚠️ **Se shippearon como VALORES ESTÁTICOS** (no `MINIFS`): ver siguiente punto.
- **⚠️ "Roto" que NO se puede diagnosticar (24-jul, 2ª vez):** tras Medio+fechas, Rick vio "roto" pero el archivo **pasa TODO** (partes zip idénticas al v2 aprobado, sharedStrings/styles counts OK, 0 shared/#REF, celdas en orden, sin conflict-copies). **Falsos positivos a descartar:** el chequeo "celda A7 en fila 6" es artefacto de regex por `<row .../>` **self-closing** (existen en el v2 bueno también) — no es corrupción. **Conclusión probable = OneDrive stale-cache de Rick** ([[onedrive-clobber-claud]]): la cura ambas veces fue **copia con NOMBRE NUEVO** (fuerza sync limpio). **De-riesgo extra:** si un cambio nuevo mete funciones novedosas (`_xlfn.MINIFS/MAXIFS`), convertirlas a **valores estáticos** elimina el único sospechoso de contenido (yo ya tenía los valores por recompute). Regla: ante "roto" irreproducible → (1) copia con nombre nuevo, (2) quitar lo más nuevo/novedoso, (3) NO publicar a prod hasta que Rick confirme abrir-limpio (gate).

## 🛠️ Pipeline de edición (usar SIEMPRE — reemplaza escribir un script por cambio)

**No escribir un script nuevo por edición.** Declarar el cambio en JSON y correr el runner: ya trae
escape de `&`, creación de celdas que no existen, conservación de estilos, orden OOXML del `mergeCells`,
`safe-save` y validación — y **aborta sin escribir si el resultado no pasa el diagnóstico**.

```bash
node ~/.claude/tools/xlsx-apply.js edicion.json --dry-run   # qué haría, sin tocar el archivo
node ~/.claude/tools/xlsx-apply.js edicion.json             # aplicar
```
```json
{ "archivo": "C:/.../(Interno)-Reporte-Consolidado-Nestle-2026-v7.xlsx",
  "respaldo": "C:/.../_backups/consolidado_2026-07-31.xlsx",
  "hojas": { "Report_Resumen": {
      "set":     { "AU1": "Insights", "B5": 1234 },
      "formula": { "R2:R44": { "f": "IFERROR($P{r}/$O{r},0)" } },
      "limpiar": ["AV1:BD17"], "merge": ["AU2:AU4"],
      "cols": { "AU": {"ancho": 105} }, "filas": { "2": {"alto": 52} },
      "estilo": { "AU2:AU17": {"wrap": true, "vertical": "top"} } } } }
```
`{r}` se sustituye por el número de fila. `formula` acepta `{"f":"...","v":0.5}` para dejar el valor
cacheado — **sin `v` la celda se ve vacía hasta que Excel recalcule** (y SheetJS no expone `.f`, así que
para verificarla hay que leer el XML, no el objeto de SheetJS).

**Diagnóstico independiente** (no modifica; sale con código 1 si algo está mal):
```bash
node ~/.claude/tools/xlsx-diagnose.js <archivo.xlsx>
```
Cubre **15 defectos** que hacen que Excel repare, y los 10 críticos están probados con inyección
deliberada: orden del zip · partes `[trash]` · partes sin content-type · `calcChain` desfasado ·
`sharedStrings` fuera de rango · estilo `s=` inexistente · `definedNames` huérfanos · relaciones colgadas ·
**orden OOXML dentro de `<worksheet>`** · **`count` de `mergeCells`/`dataValidations`** · **merges
solapados** · **filas/celdas desordenadas o duplicadas** · **`#REF!`** · **fórmulas compartidas sin
maestro** · **`externalReferences` inconsistente**.

> ⚠️ **Dos falsos positivos que costaron depurar** al escribir estos chequeos, y que aplican a CUALQUIER
> regex sobre XML de Excel: **(1)** las filas y las `<f>` pueden ser **autocerradas** (`<row r="6"/>`,
> `<f t="shared" si="0"/>`); si el regex de "bloque con cuerpo" no las excluye, el `[\s\S]*?` se come el
> XML hasta el cierre siguiente y reporta basura. **(2)** el **orden de atributos no es fijo**: anclar a
> `<f t="shared"` falla cuando viene `<f ref="..." si="2" t="shared">`. Filtrar por contenido del atributo,
> no por posición.

## ⚠️ Reglas críticas al editar el .xlsx (NO improvisar — esto ya costó horas)
1. **Rutas OneDrive con acentos** ("Librería/Nestlé"): Node/xlsx **falla al leer** rutas absolutas con acentos.
   Patrón seguro: `cp` el archivo a una **ruta ASCII en el home** (`require('os').homedir()+'/_v.xlsx'` en Node,
   `"$env:USERPROFILE\_v.xlsx"` en PowerShell — comillas **dobles**), leer/escribir ahí, y `cp` de regreso.
   PowerShell 5.1 igual: operar sobre copias ASCII `_*_tmp.xlsx`. **Nunca hardcodear el username.**
2. **SheetJS (`xlsx`) BORRA todos los estilos de celda + tab colors en cada `writeFile`.** Por eso: haz **todos los
   writes de datos/fórmulas primero**, y aplica el **formato por XML AL FINAL**.
3. **SheetJS RENUMERA los `numFmtId` custom al escribir** (166="$" puede volverse 166="0.0%"). Un script de formato
   que hardcodee IDs existentes asigna formatos equivocados. **Solución:** `format_all.ps1` crea sus **propios**
   numFmts deterministas: 180=`"$"#,##0`, 181=`0.0%`, 182=`#,##0`, 183=`0.00`, 184=`dd/mm/yyyy`.
4. **`$` en PowerShell `-replace`:** el replacement interpreta `$&`,`$1` como backreferences → un formato de moneda
   `"$"#,##0` se corrompe. **Usar `.Replace()` literal**, nunca `-replace`, al insertar texto con `$`.
5. **XLOOKUP se corrompe** (`_xludf.XLOOKUP` → Excel marca "dañado"). Correr `scripts/repair_xlookup.ps1` tras
   cualquier write de SheetJS **o de `xlsx-js-style`** (probado: `xlsx-js-style` también corrompe XLOOKUP, no escribe
   tab colors, e infla el archivo ~6× — NO reemplaza el pipeline; el XML es más controlado). La corrupción es
   **NO-determinística**: el mismo pipeline dio `_xludf`=277 en un write y 0 en otro (WK27). NO confíes en un
   `_xludf`=0 de un QA previo para saltarte el repair — córrelo SIEMPRE tras cada write que toque fórmulas, aunque
   el check anterior saliera limpio. Es idempotente (si ya está sano, no hace daño).
6. **NUNCA notas/comentarios de SheetJS** (`ws[addr].c`): inflan un `vmlDrawing` a ~8 MB y **Excel se traba** al
   abrir. Un diccionario visible va como **fila de texto**, no como comentario.
7. 🔴 **`adm-zip` ROMPE EL PAQUETE OPC — correr SIEMPRE `~/.claude/tools/xlsx-safe-save.js` como último paso.**
   Diagnosticado 30-jul-2026: **era la causa real de meses de "me sale roto"**, no el caché de OneDrive.
   Dos defectos, ninguno visible en un diff de celdas ni en `xlsx-check.js`:
   **(a) `deleteFile()` no borra, RENOMBRA a `[trash]/0000.dat`** → parte sin content-type; Excel repara.
   Los respaldos del consolidado acumulaban de 1 a 7 de estas desde el 6-jul.
   **(b) `writeZip()/toBuffer()` reordena alfabéticamente** y `[Content_Types].xml` deja de ser la primera
   entrada del zip, que es lo que exige ECMA-376 Parte 2 §10.1.1 (verificado en adm-zip 0.5.18; no hay opción
   para apagarlo → la herramienta escribe el ZIP a mano con orden determinista).
   También elimina `xl/calcChain.xml` + su Override + su Relationship (Excel lo reconstruye): un calcChain
   desfasado tras reescribir fórmulas es la otra causa clásica de reparación. Aborta sin escribir si algo no cuadra.
   ⚠️ **Corolario: NO versionar (`-v2`, `-v3`…) para "esquivar" el roto** — era un parche sobre un diagnóstico
   equivocado. Se edita el MISMO archivo. Y **jamás renombrar ni mover un archivo compartido con el equipo**:
   les rompe los links (pasó con `Interno-Maggi-Mundial-Resumen-2026.xlsx`, hubo que revertirlo).
7b. **El zip del INTERNO usa BACKSLASH** (`xl\worksheets\sheet10.xml`, no `xl/...`) → `$zip.GetEntry('xl/...')`
    devuelve **null** y el inyector falla en silencio ("no se encontró la hoja"). Usar un helper que pruebe `/`, `\` y
    como fallback recorra `$zip.Entries` comparando `FullName.Replace('','/')`. Script listo:
    `scripts/inject_sheet_interno.ps1`. Al inyectar una hoja en el interno: sus xf de banda YA existen —
    **352-356 = headers** (5 bandas), **357** texto · **358** `#,##0` · **359** `0.0%` · **360** `$#,##0`; si no pones
    `s=` la hoja sale SIN formato. Y leer el origen con `{cellStyles:true}` o `!cols` viene vacío (se pierden anchos).
7. **Excel/OneDrive bloquean el archivo** (EBUSY). Si el usuario no puede abrir: casi siempre `EXCEL.EXE` sigue vivo
   o OneDrive sincroniza. Cerrar Excel del todo. Si un guardado deja el path atascado en OneDrive: **copia con
   nombre nuevo** (OneDrive lo trata como archivo nuevo).
8. **`fullCalcOnLoad`**: tras editar fórmulas con SheetJS, setear `w.Workbook.CalcPr.fullCalcOnLoad=true` para que
   Excel recalcule al abrir. Node **no** recalcula fórmulas → para validar valores computados, **replica la lógica en
   Node** o pide al usuario abrir en Excel.
9. **numFmt DUPLICADO tras `format_all` → deduplicar SIEMPRE.** Cuando el write de SheetJS NO renumera los numFmt
   custom (es impredecible), `format_all` agrega 180-184 ENCIMA → `numFmtId` duplicado en `styles.xml` = OOXML inválido
   (riesgo de diálogo "recuperar contenido" en Excel). Correr `_dedup_numfmt.ps1` como **último paso** del pipeline y
   verificar `grep '<numFmt numFmtId=' styles.xml | sort | uniq -c` = 1 por id. (Los dos sets son idénticos → dedup sin
   pérdida.)
10. **Insertar/mover COLUMNAS o FILAS: SheetJS NO auto-ajusta refs** (Excel-UI sí lo hace solo; los scripts no). Al
    desplazar hay que **bumpear a mano** las refs: (a) internas same-sheet (col o fila ≥ punto de inserción, +delta);
    (b) cross-sheet en OTRAS hojas que apunten a este reporte (Insights/Auditoría → `'Report_Campana+Qcart'!$X$N`).
    **Antes de bumpear PROTEGER** con placeholders: (1) literales de texto `"..."` (si no, un `"Jun-Q1-2026"` se
    corrompe a `"Jun-R1-2026"` porque "Q1" parece ref de columna); (2) refs cross-sheet `Sheet!...` (incl. rangos).
    **Verificar SIEMPRE replicando por LLAVE** (`[camp,jour,seg,brand,wk,tp].join('|')`), NUNCA con `===` celda-a-celda:
    el Touchpoint puede ser `1` (número) vs `"1"` (texto) y `===` da falsos negativos — SUMIFS de Excel sí iguala num/txt.

---

11. **🔥 `theme1.xml` SE DUPLICA en cada round-trip de SheetJS → resetearlo SIEMPRE.** *(Descubierto jul-2026; era la
    causa REAL del "bloat" que se persiguió durante sesiones y se atribuyó mal a las hojas.)* El `xl/theme/theme1.xml`
    del workbook se corrompió en algún round-trip viejo (quedó en **13 MB** con basura inyectada entre un `<a:theme>`
    válido de apertura y su cierre) y **SheetJS lo DUPLICA cada vez que reescribe** (13 MB → 26 MB → …). Comprimido eso
    son ~250 KB de un archivo de 478 KB. **Síntoma:** el .xlsx crece ~2× por build y "no se sabe por qué"; reconstruir
    desde un backup limpio **NO lo arregla** (el backup ya traía el theme podrido). **Diagnóstico:**
    `unzip -l x.xlsx | grep theme1` → si pesa > ~50 KB (uno normal ronda **7.6 KB**), está podrido.
    **Fix:** `scripts/reset_theme.ps1 -file X.xlsx -theme scripts/clean_theme.xml` como **paso FINAL** del pipeline
    (tras `_dedup_numfmt`). El theme solo define colores/fuentes default y nuestras hojas usan estilos explícitos →
    reemplazarlo es **inocuo**. Verificado: con el reset el Claud se queda en **~230 KB** en vez de dispararse a 478 KB.
    ⚠️ **Producción y el Interno todavía arrastran themes inflados** (3.3 MB) → aplicarles el reset al publicar.

---

## Sistema de formato (correr con `scripts/`, en orden, sobre copias ASCII)
Aplicar **después** del último write de datos:
```
1. cp archivo → _repair_tmp.xlsx  → repair_xlookup.ps1  → cp de regreso   (normaliza XLOOKUP; da _repair_out.xlsx)
2. cp archivo → _tabcolor_tmp.xlsx → set_tab_colors.ps1 → cp de regreso    (colores de PESTAÑA por categoría)
3. cp archivo → _fmtall_tmp.xlsx  → format_all.ps1     → cp de regreso    (apartados + numFmt + fechas, 1 paso dinámico)
4. cp archivo → _overlay_tmp.xlsx → _overlay.ps1       → cp de regreso    (títulos manuales + headers 📅 de Insights/Insights_Semanal; requiere markers _ins_markers.json + _ins_sem_markers.json)
5. cp archivo → _dnf_tmp.xlsx     → _dedup_numfmt.ps1  → cp de regreso    (dedup numFmt — OBLIGATORIO, ver regla #9; da _dnf_out.xlsx)
6. reset_theme.ps1 -file archivo -theme scripts/clean_theme.xml           (OBLIGATORIO, ver regla #11 — si no, el archivo se duplica de tamaño en cada build)
```
> Para hojas `banner` nuevas (p.ej. `Report_Insights_Semanal`): agregarlas al `$cfg` de `format_all.ps1` **y** a la
> lista de pre-cache de band-xfs; hacer grid-fill + generar su markers; y extender `_overlay.ps1` para colorear sus
> headers 📅/📐/BLOQUE. Las hojas `tab` nuevas: solo una entrada en `$cfg` con sus `secs`/`cur`/`pct`/`int` por columna.
- **Pestañas** = tipo de hoja (Report=amarillo FFC000, Data=azul 0070C0, Catalog=verde 00B050, Protocol=gris 808080,
  Control=morado 7030A0, Soporte=gris claro, Legacy=rojo).
- **Apartados** = grupos de columnas por tema, cada uno con su color de header + zebra del mismo tono (8 hues:
  slate/blue/teal/indigo/amber/green/olive/rose). 3 modos: `tab` (tabla), `doc` (Protocol_IA_*: header + col A
  etiqueta + col B zebra), `banner` (Insights/Auditoría: título + zebra que **preserva** el numFmt existente).
- **Grid-fill obligatorio para bandas full-width en hojas dispersas** (`banner`): el colorizador XML solo pinta
  celdas `<c>` que YA existen. En hojas dispersas (fichas de Insights con contenido solo en col A o A-C) la banda
  sale **parchada** (solo col A). ANTES de `format_all`, rellenar las celdas vacías A..lastCol de cada fila de banda
  (crear los `<c>` vacíos) para que el fill cubra el ancho completo. Regla: banda full-width ⇒ primero materializar
  la cuadrícula A..lastCol, luego colorear.
- **Formato manual de celdas-título sobrevive con overlay post-format.** `format_all.ps1` repinta headers/zebra según
  `$cfg` y **sobreescribe** cualquier formato manual de una celda-título (p.ej. A19 "SUBTOTALES" azul `17375E` bold
  en Report_Campana+Qcart). Si una celda lleva formato manual que debe conservarse: aplicar un **overlay XML AL FINAL**
  (`_overlay.ps1`, después de format_all) que reponga font color + bold de esas celdas puntuales. Documentar qué
  celdas llevan overlay para no perderlas en la próxima corrida.
- `format_all.ps1` es **dinámico** (lee counts de fonts/fills/cellXfs y calcula índices) → funciona sin importar el
  estado que dejó SheetJS. Config de columnas por hoja está dentro del script (`$cfg`).
- Formatos por tipo de columna: moneda→`$`, tasas→`0.0%` (valor fracción, no ×100), conteos→`#,##0`, ratios→`0.00`,
  fechas→`dd/mm/yyyy`, IDs→General (sin separador). Verificar con `scripts/_audit_formats.js`.

---

## Checklist de QA final
- `unzip -t` OK · `tabColor` = # de hojas · `_xludf` = 0 · comentarios/vmlDrawing = 0 · `metadata.xml` presente si hay
  array formulas · #REF! reales = 0 (ojo: texto de doc que dice "#REF!" es falso positivo).
- `_audit_formats.js`: cada columna con su formato correcto; los flags de columnas de **texto** (Retailer, Notas,
  Flags) son falsos positivos.
- Fila de validación del reporte (Σ Nestlé, Σ Total, Σ Views) marca ✅ (que la referencia sea **viva**,
  `=SUM(Data_Qcart!...)`, no un número hardcodeado que queda stale).
- Tamaño ~200–400 KB (NUNCA 8 MB → sería bloat de comentarios).

## Publicación Sandbox → Producción (verify-libre → backup → copy → verify idéntico)
Se **trabaja sobre el SANDBOX** `Claud-Reporte-Consolidado.xlsx` y solo al final se **publica al OFICIAL** compartido
`Reporte-CRM-Consolidado-Nestle-2026.xlsx`. Nunca editar el oficial en caliente. Procedimiento determinístico:

> ### 🚦 PASO 0 — GATE HUMANO (innegociable)
> **NUNCA publicar sin el OK explícito de Ricardo tras validar él mismo en Claud.** Producción es un archivo
> **compartido con el equipo/cliente**. El QA técnico (fórmulas, `_xludf`, formato) **NO sustituye** su revisión: Node
> no recalcula fórmulas, así que solo él puede confirmar en Excel que los números y la estética se ven bien tras el
> recálculo. Flujo: terminar en Claud + QA → **presentarle qué cambió (con preview si es texto/estructura) y pedirle
> que valide** → esperar su "OK/publica" → recién entonces los pasos 1-5. Única excepción: si en el mismo mensaje él
> dice explícitamente "copia a producción". *(Regla añadida 8-jul-2026 tras publicar sin gate.)*

1. **Verificar que producción esté libre** — abrir el oficial en modo `r+` (`fs.open(path,'r+')`); si falla con EBUSY,
   alguien lo tiene abierto (Excel vivo / OneDrive sincronizando) → NO publicar, avisar y esperar (ver regla #7).
2. **Backup de producción** — copiar el oficial actual a `_backups/…_Pre<cambio>_<fecha>.xlsx` ANTES de sobrescribir.
3. **Copiar sandbox → producción** — `cp` Claud sobre el oficial (vía copia ASCII si la ruta lleva acentos, regla #1).
4. **Verificar bytes idénticos** — comparar tamaño (y opcional hash) del oficial recién escrito contra el sandbox;
   deben coincidir. Si difieren, la copia se truncó/bloqueó → reintentar tras cerrar Excel.
5. **Batch de fixes en UNA sola re-publicación** — acumular todos los arreglos de una corrida y publicar una vez (no
   republicar por cada fix); solo publicar con la auto-auditoría en 🟢.

## Deuda técnica conocida (documentar, no fingir)
- **Producto Estrella** de subtotales y de **Maggi** sale "(sin desglose)": `Soporte_IA_Qcart_Productos` toma sus
  dimensiones de `Data_Qcart_Legacy` (stale) y las llaves receta|tienda de Maggi no enlazan. El **detalle**
  Recetas/Hotcakes sí funciona. Arreglo real = reconstruir llaves Stage→Data_Qcart (tarea de datos, verificar en Excel).
- **Cadena legacy** (`Data_Qcart_Legacy` + `Soporte_IA_Stage_*`) alimenta Producto Estrella → no borrar sin migrar.
- **Narrativa en prosa de Insights** puede quedar stale; los anclajes cuantitativos (fórmula) sí son correctos.

## Scripts incluidos
- `scripts/repair_xlookup.ps1` — normaliza `_xludf.XLOOKUP` → XLOOKUP vía recreación de zip (.NET).
- `scripts/set_tab_colors.ps1` — colores de pestaña por categoría.
- `scripts/format_all.ps1` — formato completo (apartados/doc/banner + numFmt + fechas) en un paso dinámico. `$cfg` con
  entradas para todas las hojas incl. `Report_Semanal` (tab) y `Report_Insights_Semanal` (banner).
- `scripts/_overlay.ps1` — post-format: A22 azul oscuro de `Report_Campana+Qcart`. El bloque de headers 📅/📐/BLOQUE de
  `Report_Insights` quedó **INERTE** (esa hoja se eliminó 23-jul-2026 → los insights viven en `Report_Insights_Operativo`,
  que formatea `format_all`/`format_operativo`). El script hace **no-op** si no encuentra la hoja/markers (`_regen_markers.js`
  escribe markers vacíos).
- `scripts/_dedup_numfmt.ps1` — dedup de `<numFmt>` por id en styles.xml (OBLIGATORIO tras format_all, regla #9).
- `scripts/reset_theme.ps1` + `scripts/clean_theme.xml` — **reemplaza el `theme1.xml` podrido por uno limpio de 7.6 KB**
  (OBLIGATORIO como último paso, regla #11). Params: `-file <xlsx> -theme <clean_theme.xml>`. El theme limpio se extrajo
  de un workbook fresco de SheetJS, así que no se vuelve a inflar.
- `scripts/_audit_formats.js` — auditoría columna-por-columna de formatos (Node + xlsx).
- `scripts/column_ops.js` — **mover/insertar columnas sin romper fórmulas** (Node + adm-zip). `moveColumn`, `insertColumns`, `bumpDimension`; protege refs cross-sheet y strings, reordena celdas por fila. Verificar SIEMPRE recomputando en JS vs `<v>` cacheado (ver aprendizaje "MOVER/INSERTAR columnas").

> Nota de portabilidad (corregido 21-jul-2026): los scripts usan `"$env:USERPROFILE\_*_tmp.xlsx"` (PowerShell)
> y `require('os').homedir()` (Node) como buffer ASCII en el home del usuario. **Son portables — no hay que
> ajustar nada al cambiar de máquina o de usuario.** ⚠️ En PowerShell la interpolación **exige comillas dobles**:
> `"$env:USERPROFILE\..."` funciona, `'$env:USERPROFILE\...'` NO (se queda literal y truena). Ese fue el motivo
> por el que alguna vez se hardcodeó la ruta; la salida correcta es cambiar la comilla, no el path.
