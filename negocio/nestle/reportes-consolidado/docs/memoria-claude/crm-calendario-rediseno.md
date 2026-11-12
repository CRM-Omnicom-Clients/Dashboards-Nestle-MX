---
name: crm-calendario-rediseno
description: "Documento rector CRM Nestlé (Calendario de envíos) — modelo de 5 hojas EN PRODUCCIÓN (jul-16 2026) con Calendario Anual, Naturaleza Pieza/Estrategia y tabla tblEnvios; datos de Nestlé, decisiones de Rick y pendientes"
metadata: 
  node_type: memory
  type: project
  originSessionId: 26f4b320-3f5e-495c-ae86-09c68fcd1223
  modified: 2026-08-10T20:48:40.283Z
---

El "documento rector" CRM Nestlé (BUs: RN, Nescafé, Family Nes, Purina) pasó de **una hoja plana** (109 piezas × 83 cols, meses tecleados, fechas como texto) al **modelo datos+vistas**. **En producción desde el 16-jul-2026.** Excel/SharePoint — NO migrar a Airtable/Notion.

> ⚠️ **No dupliques metodología aquí.** El modelo y sus reglas viven en el skill **`rick-crm-master-calendar`**; las reglas de Excel (COM, openpyxl, `_xlfn.`) en el **`CLAUDE.md` global**. Aquí solo lo específico de Nestlé.

## Archivos
> ⚠️ **Los archivos se movieron de tenant (jul-2026): `OneDrive - OneWorkplace` → `OneDrive - OneWorkplace`.** Misma sub-ruta, solo cambió la raíz. Buscar con `glob('C:/Users/Ricardo.Aguilar/OneDrive*/**/...')`. (El working dir también pasó a `Marcas/CRM General`.)
- **CALENDARIO ANUAL (archivo nuevo):** `.../OneWorkplace/.../Marcas/CRM General/(Interno) Calendario CRM Anual.xlsx` — vista anual semana ISO (1-53, lunes reales, banda de mes arriba) × árbol Cliente·BU·Marca·Campaña. Clientes: Nestlé (árbol real de prod), GEPP (marcas IPW·7Up·Pepsi·Gatorade·Epura), Unilever (Hellmann's). Hoja `Listas` (Cliente/BU/Marca/Campaña). Sin fórmulas → openpyxl seguro. Script `scratchpad/build_anual.py`.
  - **REGLA DE TAXONOMÍA (de Rick):** un valor NO puede estar en 2 niveles (ni marca=campaña ni BU=marca); cada valor único a su nivel. En Nestlé se limpió: ICE/Concentrate/Clásico son MARCAS (no campañas); `Nescafé│AON`→`Masterbrand│AON`; `Nescafé│Tercer Tiempo`→`Clásico│Tercer Tiempo`; 'Nescafé' quedó solo como BU.
- **PRODUCCIÓN (envíos):** `Marcas/CRM General/Cliente-CRMNestlé-Calendario de envíos.xlsx` ⚠️ **Rick lo renombró (jul-21): antes `CRM-Nestlé-…`, ahora `Cliente-CRMNestlé-…`.**
  - ✅ **Las 5 filas huérfanas se BORRARON el 21-jul-2026** (`Nescafé│Nescafé│AON/Clásico/Concentrate/ICE/Tercer Tiempo`, 0 piezas). Con eso desaparecieron las 3 violaciones a "campaña ≠ marca" (ICE, Concentrate, Clásico eran marca **y** campaña, y el lado "campaña" solo existía en esas filas). Anotado en la hoja `Revisiones por hacer`.
  - ⚠️ **`Calendario Anual` es un ESPEJO 1:1 y frágil:** sus filas 4..N traen `=IF(Campañas!B2="","",Campañas!B2)` con la fila **fija**. Si borras filas en `Campañas`, hay que borrar **las mismas** en el espejo (desfase de 2: Campañas f9 = Anual f11), si no quedan `#REF!`.
  → visibles: `Campañas` · `Envíos` · `Calendario Anual` · `Vista Mensual` · `Listas`
  → ocultas (referencia, no tocar): `(Draft)Calendario` (la hoja plana vieja) · `Listado-Briefs` · `Detalle envíos`
- **INTERNO (pruebas):** `Marketing Automation Kinesso - Librería-Sharepoint-MAK/Nestlé/(interno) CRM-Nestlé-Calendario_v4.xlsx`
  **Regla de Rick: primero el interno, a producción solo la versión final.**
  → incluye la hoja **`Notas Asana`** (jul-21): investigación de la migración a Asana (plan Enterprise+, multi-home, mapeo calendario→Asana, límites, campos de biblioteca).
- Respaldos en `scratchpad/backup_PROD_*.xlsx` y `backup_pre_*.xlsx`.

## Estado (21-jul-2026) — *verificar antes de asumir que sigue vigente*
- **24 campañas** · **123 piezas = 123 filas** en `Envíos` · cuadratura OK · 0 errores · las 24 con color de estatus · 7 con liga a brief.
- **Interno y producción están SINCRONIZADOS** (producción mandó, se copió encima del interno). Única diferencia: el interno lleva además la hoja `Notas Asana`.
- Auditoría de coherencia limpia: ninguna marca en 2 BUs · todas las combinaciones de `Envíos` existen en el roster · las claves de la col. O cuadran al 100%.
- `Envíos` es **tabla de Excel `tblEnvios`** → las filas nuevas heredan fórmulas solas.
  ⚠️ La col. **AA `Link brief (de Campañas)` es COLUMNA CALCULADA**: escribirle al rango completo **se revierte sola**. Hay que escribir **fila por fila** (ver la regla de Excel global).
- Columna **`Naturaleza`** (F): `Pieza` / `Estrategia`. El Calendario Anual cuenta **solo Piezas**; las estrategias salen en su propia fila (automática, muestra `marca - campaña` por mes).
- `Campañas` tiene **`Inicio/Fin temporalidad medios`** (2 columnas) + **`Link briefs`** (las piezas lo heredan por fórmula con la llave `BU|Marca|Campaña`).
- ⚠️ **En producción, Rick renombró la hoja `Campañas` → `Campañas y briefs`** (ago-10) y agregó una `Hoja1`. Producción e interno divergieron y **se re-sincronizaron el ago-10 (producción mandó → se copió al interno + se reagregó `Notas Asana`)**. Ambos quedaron idénticos salvo `Notas Asana` (solo interno). 24 campañas · 126 piezas · 0 errores.
- **Estatus de campaña (col D) es por CONTEO, no por texto:** `=IF(F=0,"—",IF(G=F,"Cerrada",IF(AND(N>0,N=F-G),"On Hold","Activa")))` con F=#Piezas, G=# Cerradas, N=#OnHold. Para que "Cerrada" tome más estatus, se amplía **G**, no D.
- **Qué cuenta como "cerrado" (ago-10, decisión de Rick — `cerrada = finalizada`):** la lista vive en **`Listas!M2:M5`** (`EstatusCerrado` = `*Finalizad*` · `Analizado` · `Rechazado` · `Sacar del flujo`) y G la referencia con `SUMPRODUCT(COUNTIFS(...,Listas!$M$2:$M$5))` — SUMPRODUCT es obligatorio, sin él cuenta mal por intersección implícita (ver regla Excel global). Agregar un estatus nuevo = una fila en M, sin tocar fórmula. La col G se llama **`# Cerradas`** y `Composición` rotula "N Cerradas" (renombrado de "Finalizadas" el ago-10).
- ✅ **`Calendario Anual`: los 16 `#REF!` de la fila 38 se REPARARON (ago-10)** rellenando la fila 37 (sana) → 38. Eran pre-existentes (espejo apuntaba a `'Campañas y briefs'!#REF!`), no del cambio de estatus. El espejo son filas 4-38 (buffer), totales en fila 39 `SUM(C4:C38)`.

## Datos de Nestlé
- **BUs:** RN · Nescafé · Family Nes · Purina. **'Nescafé' es SOLO BU, ya no es marca** (desde jul-21).
- **Marcas:** Carnation · La Lechera · Maggi · Masterbrand · ICE · Concentrate · Clásico · Taster Choice · NIDO · NAN · Pro Plan · Recetas Nestlé · Recetario Gamer · `Carnation, La Lechera` y `NIN, Purina` (multi-marca).
- **Campañas:** Hotcakes · AON · Mundial · Liga MX · **The Freshers** (ICE) · **Hackea tu café** (Concentrate) · **Tercer Tiempo** (Clásico) · **You Can** (Carnation) · **Marvel** (Recetario Gamer) · **Winback / Prevensión Churn / Perfilamiento Growth Drivers** (Masterbrand) · Navidad · Antojo Infinito · AON NAN · Especializados NAN · Crossbrand NIN+Purina · Fuel for life · Por confirmar.
- **Responsables:** **Rick** (copies + finalizado) · **DBA** (diseño) · **SAM** (implementación) · **Liz** (`Estrategia por presentar`).
- **Deltas del pipeline** (hacia atrás desde el envío): IBS −1 · QA −2 · Impl −3 · Ticket −3 · AprobDiseños −7 · CorrDiseños −5 · Diseños −3 · CorrCopies −5 · Revisión −3 · Brief −3 (≈35 días).
- **Temporalidad de medios cargada** (de la tabla PAID de Rick): Maggi|Mundial 08-abr→31-jul · Pro Plan|Fuel for life 18-may→31-jul · ICE|The Freshers 27-may→31-ago · Concentrate|Hackea tu café 11-may→15-ago.

## Decisiones de Rick (respetarlas)
- **Campaña NUNCA = Marca.** Si no se sabe → `Por confirmar`.
- **Estatus manual**, no derivado de fechas. **Naturaleza tampoco se deriva del estatus** (el estatus cambia; la naturaleza no).
- **Fechas hacia atrás** desde el envío; `Mes Imp` es el rector; sin fecha confirmada → **día 15**.
- **NO proteger las hojas** ("necesitan estar libres"); el color enseña, el QA es la red.
- Encabezado **NEGRO = editable** · **AZUL = calculado**.
- **Respetar SIEMPRE lo que él editó**: leer y diagnosticar antes de tocar; rellenar solo huecos reales, nunca pisar un dato manual.

## Links de briefs (`Campañas` col. J) — cargados el 21-jul-2026
Formato acordado por Rick: **nombre del brief como texto visible + hipervínculo** (nunca la URL cruda).
⚠️ En pywin32 `Hyperlinks.Add(TextToDisplay=…)` **se ignora** → hay que setear `hl.TextToDisplay` como **propiedad** después de crear la liga.
`Envíos` **no** tiene columna de brief (se verificó) → poner objetos-hipervínculo en `Campañas` no rompe nada.
- **7 con liga:** Concentrate│Hackea tu café · ICE│The Freshers · Recetas Nestlé│AON · Maggi│Mundial · los 3 de Masterbrand (comparten `Cliente_CRM_Copies_Nescafe_AON`).
- **`No aplica`** (marca): NAN · NIDO · Pro Plan · **`Por crear`**: Carnation · Taster Choice · Recetario Gamer · **`Pendiente`**: el resto (La Lechera es el único pendiente "real" según Rick).

## Pendientes
1. 🟡 **Links de briefs — falta el de La Lechera** (Rick: "el único pendiente"). Y hay **1 URL que Rick mandó sin asignar** (`…/IQAPm0O6dkMeR4soZw-sZXjIATad3YpkEnankZjI8jiSjTo`, compartida a samantha.hernandez@mx.nestle.com) → **preguntarle de qué campaña es**.
2. **2 fechas de medios sin mapear**: `NIDO 1+ (GUMS) - 2da activación` y `NAN Optimal - Rappi` (ambas "JULIO - DICIEMBRE" en la tabla PAID) — no se supo a qué campaña van ni traen día.
3. **Campañas en `Por confirmar`**: Carnation (¿You Can?), NIDO, Taster Choice, Recetario Gamer.
4. **Probar el skill `rick-crm-master-calendar`** — el proceso de skill-creator quedó a medias (faltan test cases y eval).

Ver [[maggi-mundial-crm]].
