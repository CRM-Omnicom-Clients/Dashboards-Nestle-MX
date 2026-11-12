# Estructura de columnas por hoja

## Report_Campana+Qcart (A–AZ) — la principal
Cruza email + Qcart por Mes+Marca+Segmento. Apartados (para formato):
- **A–F Identificación** (Campaign, Journey, Segmento, Mes, utm_campaign, Receta_Representativa)
- **G–M Email Envío Principal** (P_Sends…P_Click_Rate) · **N–T Email FUP** · **U–AA Email Totales**
- **AB–AE Qcart Carritos** (Walmart/Chedraui/Sin_Tienda/%Sin tienda)
- **AF–AS Qcart Intención/Valor/Tasas**: AF Views_Carrito, AG Views_Nestle, **AH Intencion_Total ($)**,
  **AI Intencion_Nestle ($)**, AJ Ventas_Reales, AK/AL Valor_Click, AM %Discrepancia, AN/AO Tickets,
  AP Tasa_Clicks_a_Views (OCULTA, duplicado), **AQ Carritos_por_Click (0.00)**, **AR Pct_Penetracion (=AI/AH)**,
  AS Tasa_Productos_a_Carritos (0.00)
- **AT–AZ Producto/Retailer/QA**: AT Producto_Estrella, AU %Producto_Estrella (=MAX(views)/SUM(views)), AV/AW Retailer, AZ Notas
- Detalle filas 3–17 · Subtotales 20–25 (SUMIF por utm col E) · TOTAL 26 · Validación 28–31 (E30 = `=SUM(Data_Qcart!O2:O49)` vivo)
- Formatos: cur=AH,AI,AJ,AK,AL,AN,AO · pct=K,L,M,R,S,T,Y,Z,AA,AE,AM,AR,AU,AW · int=conteos · ratio(0.00)=AQ,AS

## Report_Mensual (A–M): A–E ID, F–I conteos(int), J–L tasas(%)
## Report_Quincenal (A–V): A–F ID, G–M Principal, N–T FUP; pct=L,M,S,T; int=H,I,J,K,O,P,Q,R

## Report_Resumen_Campana (A–U) — rollup ejecutivo (jul-2026)
1 fila = **Campaña × Quincena** (13 filas). Header congelado + 4 cols de identidad congeladas; autofiltro A1:U{n}.
- **A–D Identidad** (Campaña, Mes, Quincena `Mmm-Qn-2026`, Objetivo(s)) — banda slate
- **E–G Email Principal** (Sends, OR, CTOR) — blue · `—` si esa quincena fue solo FUP
- **H–J Email FUP** (Sends, OR, CTOR) — teal · `—` si no hubo follow-up
- **K–N Email Total** (Sends, OR, CTOR, CTR) — indigo
- **O–U Qcart del MES, anclado** (Carritos_Walmart, Carritos_Chedraui, Carritos_Total, Intencion_Total$,
  Intencion_Nestle$, Penetracion%, Ticket$) — amber
- **Anclaje (crítico):** el Qcart es MENSUAL → se pone SOLO en la **quincena de lanzamiento** (1er envío Principal del
  mes); las otras quincenas llevan `— ver Qx` en la col O y O–U vacías. Sumar la columna = total mensual correcto, sin
  doble conteo. Sin carrito → `Sin Qcart`. Todo SUMIFS vivo + valor cacheado.
- Formatos: cur=R,S,U · pct=F,G,I,J,L,M,N,T · int=E,H,K,O,P,Q

## Report_Insights_Operativo (A–G) — matriz operativa quincenal (jul-2026)
Filas = quincena (más reciente arriba, `Q12 · Jun-Q2`), columnas = las 6 campañas, `N/A` si no hubo envíos.
Cada celda = 4 líneas: **Desempeño** (OR/CTOR + touchpoints Principal/FUP) · **Intención** (Qcart del mes, o
`Sin Qcart`) · **Objetivos+Clusters** (agrupado POR JOURNEY — nunca mezclar journeys en la misma línea — con mejor y
peor segmento) · **Acción** (diagnóstico + siguiente paso). Alturas de fila variables según contenido; formato propio
en `_format_operativo.ps1` (no en format_all).

## Data_Email (A–AO)
**A–AJ = CRUDO (nunca se sobrescribe):** A BU, B Campaign, C Journey, D Segment, E Email_Type, F Touchpoint, G Version,
**H Journey_ID (llave oficial)**, I Subject_Clean, J Report_Period, K Source, **L Send_Date (fecha)**,
**M Send_Week (fecha)**, N Sender, O/P Datorama, Q Content_Name, R Subject_Raw, S Audience,
**T–X conteos(int)** (Sends/Deliv/Opens/Clicks/Bounces), **Y–AC tasas(%)** (Delivery/Open/Click/CTOR/Bounce),
AD–AF Flags(texto), AG Send_Month, AH Send_Quincena, AI Brand *(LEGACY: traía el BU, no la marca — no usar)*,
AJ Send_Week_Label.
**AK–AO = CANÓNICAS (jul-2026, se AGREGAN):** **AK Canal** · **AL BU_Canonico** · **AM Marca** ·
**AN Campana_Canonica** · **AO Segmento_Canonico**. Fórmula (INDEX/MATCH, **nunca XLOOKUP**):
`=IFERROR(INDEX(Catalog_Campanas!$A:$A,MATCH($B2,Catalog_Campanas!$D:$D,0)),"")` (BU; cambiar $A por $B/$C para
Marca/Campaña) y `=IFERROR(INDEX(Catalog_Campanas!$F:$F,MATCH($D2,Catalog_Campanas!$G:$G,0)),"")` (segmento).
Bandas de formato: 0-10 slate · 11-18 indigo · 19-23 blue · 24-28 green · 29-31 rose · 32-35 slate · **36-40 teal**.
Refrescar con MAX por **H (Journey_ID)**, no por Content_Name (sucio).

## Data_WhatsApp (A–AE, 31 cols) — canal WhatsApp, hoja PROPIA (jul-2026)
WhatsApp **no** va en Data_Email (ver SKILL.md y `Protocol_IA_Email` R17). Fuente: doc **WhatsApp** (3 hojas con
esquemas distintos entre sí). Hoy 6 filas: Hotcakes 4 segmentos (Jun-Q1) + Tercer Tiempo 2 envíos (Jun-Q2).
- **A–I dimensiones:** BU · Marca · Campaña · Campana_Raw · Objetivo · Segmento_Canonico · Segmento_WA_Raw · Canal · Touchpoint — slate
- **J–L tiempo:** Send_Date(fecha) · Send_Month · Send_Quincena — indigo
- **M–R métricas:** Sends · Deliveries · **Opens_Read** (lectura WA = "apertura") · **Clicks**(ratio 0.00, puede ser
  fraccional por venir estimado) · **Q Clicks_Medidos** (`Sí` / `NO — estimado`) · Errores — blue
- **S–U tasas:** Delivery_Rate · Read_Rate · CTOR — green
- **V–X embudo opt-in** (solo WA, el email no lo tiene): Aud_Original · Aud_Filtros · Aud_Final — amber
- **Y–Z conversión:** Logins · Recetas_Capturadas — teal · ⚠️ solo existen a nivel TOTAL de campaña (la fuente dice
  que no se pueden identificar por segmento) → no atribuir por cluster
- **AA–AB error:** Pct_Error · Errores_Meta_Detalle (63024 destinatario inválido · 63032 limitación WhatsApp ·
  63049 Meta no entregó · 63019 media falló) — rose
- **AC–AE meta:** utm_content · URL · Notas — slate

**Anomalías de la fuente (documentadas):** (1) los clicks de Tercer Tiempo son `Read × CTOR asumido` (10/12/14.62%),
NO medición → `Clicks_Medidos="NO — estimado"`; (2) la fila "Totales" de Tercer Tiempo suma PORCENTAJES
(%Delivery 198%, %Read 122%) = basura, recalcular desde las filas; (3) fechas inconsistentes (una texto "19/6/2026",
otra serial 46203) → normalizar al cargar; (4) Maggi WA se planeó pero **no se envió** (0 registros) → vive en
`Catalog_Campanas` como "No ejecutada", no en Data_WhatsApp.

## Data_Qcart (A–Y)
A Brand, B Journey, C Campaign(utm), D Segment, E Touchpoint, F Periodo_Reporte(Mes), G Receta, H URL_Receta,
I URL_Qcart_Shortlink, J Productos_Nestle_Receta, K Tienda, **L Views(int)**, **M Carts_Total(int)**,
**N Intencion_Total ($, Doc2)**, **O Intencion_Nestle ($, Doc3 matcheado)**, P/Q Tickets($), R _KeyReceta,
S Views_Carrito(int), T Views_Nestle(int), **U Pct_Penetracion(%)=O/N**, V Num_Productos(int), W/X Top, Y Medio.

## Catálogos
- **Catalog_Productos_Nestle (A–G):** A Producto_Canonico, B Marca, **C Patrones_Match** (alias `|`-separados),
  D Categoria, E Confirmado_Legacy, **F Activo (Sí/No)**, G Notas. El match usa C con Activo='Sí', normalizando acentos.
- **Catalog_Recetas_Qcart (A–W):** dimensiones + N Views_Carrito(int), O Monto_Total($), P N_Prod(int),
  Q N_Prod_Nestle(int), R N_Prod_Revisar(int), **S Monto_Nestle($)**, **T Pct_Penetracion(%)**, K Fecha(fecha).
- **Catalog_Campanas (A–L) — RECONSTRUIDA jul-2026, FUENTE DE VERDAD de las dimensiones** (39 filas, autofiltro):
  **A BU** (RN/Nescafé/Purina) · **B Marca** (multi-valor coma-separado: `"Carnation, La Lechera"`) · **C Campaña**
  (≠ marca: Hotcakes · Mundial · Antojo Infinito · Fuel for life · Tercer Tiempo · AON) · **D Objetivo** (antes
  "Journey") · **E Segmento_Canonico** · **F Segmento_SFMC_Raw** (el crudo, se conserva) · **G Canal** (Email/WhatsApp) ·
  **H Touchpoint** (incl. `Partido 1/2/3` de Maggi) · I Journey_ID · **J Fecha_Lanzamiento(fecha)** ·
  **K Estado_Dato** (`Confirmado` / `⚠ Por confirmar` / `No ejecutada`) · L Notas.
  Bandas: A–C slate · D–F indigo · G–I blue · J–L green. Reglas completas en `Protocol_IA_Email` R11–R16.
- **Catalog_Benchmarks_BAU (A–G):** A BU · B BU_BAU (nombre en el Integrado) · **C Open_Rate_BAU(%)** ·
  **D CTOR_BAU(%)** · **E Vol_Entregados(int)** · **F Costo_Entregados($)** · G Fuente. Bandas: A–B slate · C–D blue ·
  E–G teal. ⚠️ **EN REVISIÓN** (el BM 2024 tiene CTOR anómalos; el 2026 es auto-referencial — ver Protocol_IA_Reportes
  bloque F).

## Nomenclatura de colores (para format_all $cfg y set_tab_colors)
8 hues (header/tinteA/tinteB): slate 595F6E/F1F2F4/E2E4E8 · blue 2E6DB4/EAF1FB/D6E4F5 · teal 2A9187/E8F4F2/CFE8E4 ·
indigo 6A4C93/EFEAF6/DFD5EC · amber C77F0A/FBF1E1/F6E4C6 · green 4C9A2A/EDF6E6/D8EDCB · olive 7A8B1E/F2F4E2/E6EAC4 ·
rose B0436A/F9EAEF/F2D5DF. Pestañas: Report FFC000, Data 0070C0, Catalog 00B050, Protocol 808080, Control 7030A0,
Soporte BFBFBF, Legacy FF0000.
