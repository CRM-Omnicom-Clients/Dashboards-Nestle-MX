---
name: sincronia-catalogo-libro
description: "Regla de Rick (22-oct-2026) - el Catalogo_Piezas del libro vivo es la AUTORIDAD de las definiciones (Segmento, Touchpoint, Marca; PiezaID ya no existe en SFMC); cómo se sincronizó el catálogo de SFMC con él, qué quedó fuera y cómo repetirlo"
metadata:
  node_type: memory
  type: project
  originSessionId: 3fcc95e0-6a7f-416d-8815-86a488810f41
  modified: 2026-10-26T17:32:38.359Z
---

**Regla (Rick, 22-oct-2026):** «para las piezas por definir y otros elementos revisa el libro `(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx`, en la hoja del catálogo están todas las definiciones». Para PiezaID, Segmento, Touchpoint y Marca manda `Catalogo_Piezas`; el catálogo de SFMC (`CRM_Reporte_Config`) se alinea a él, no al revés.
**Why:** el libro lleva la numeración (PiezaID es de Rick) y los nombres canónicos; las filas TMP-* de SFMC nacieron con valores provisionales o con asterisco. Ver [[no-inventar-identificadores]] y [[crm-calendario-rediseno]].
**How to apply:** repetirlo cada vez que la sesión del reporte agregue piezas al libro.

**Hechos de ubicación:** el libro vivo está en `CRM General/Sistema-Reportes-CRM/(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx` (Rick lo renombró de «- Copy» a ese nombre el 22-oct 16:39; contenido idéntico a `Copia-151026-…`, sha1 91d4cbfa…). Se lee SIEMPRE una copia temporal; `Catalogo_Piezas` tiene 139 filas × 85 columnas (`Pieza_ID`, `Segmento`, `TouchPoint`, `Marca`, `Campaña`, `Email_Name` + `Email_Names_Variantes` separados por « · », `Email_ID (de la DE de SFMC)`…). El catálogo de SFMC tiene 16 columnas: ConfigKey (PK), PiezaID, ContentName, CodigoNC, JourneyUUID, BU, Marca, Campana, Touchpoint, Segmento, EmailType, Estado, Activo, Notas, EmailID, EmailName. `_catalogo/catalogo.json` del backend está desfasado (22-sep): no sirve para esto.

**Cómo se hizo (scripts de scratchpad, ya no existen):**
1. Cruce por EmailName REAL (minúsculas, sin acentos; nombres del libro = `Email_Name` + variantes partidos por « · »); EmailID de cada par comprobado (0 diferencias); 121 de 142 filas SFMC con pieza en el libro, 0 ambiguas.
2. Plan por celda: placeholder SFMC (`*por definir`, vacío, o con asterisco) + valor definido en el libro → LLENAR; ambos con valor y distinto → CONFLICTO (se alineó al libro; CodigoNC con guion `NC-000600` NO se toca: el formato SFMC es el del propio EmailName).
3. Comprobar largo contra la columna de la DE (Segmento admite 60, Touchpoint 40, PiezaID 30): 2 celdas no caben.
4. Aplicar con `D.upsertarFila(cli, cfg, 'catalogo', {ConfigKey}, {solo columnas del plan})`, exigiendo antes que cada celda tenga hoy el valor «antes» del plan, con respaldo (`catalogo-antes-definir.json`) y relectura completa (142 × 16): cambiaron exactamente 56 filas / 108 celdas y nada más. Después refresh completo (9 min): las 4 tablas de salida traen los valores nuevos (0 con el viejo).

**Resultado del 22-oct:** PiezaID 45 filas · Segmento 38 celdas · Touchpoint 17 (sin asteriscos: E-J4, E-APP, E-PROP2, E-Rit1/2, E-Hack*-AON, E-A1/E-A2 → E-Hack1/E-Hack2 de Concentrate) · Marca 8 (**ICE es Marca**: «Nescafé ICE» → «ICE», también en las 5 filas de lote 2 que no están en el libro). Conflictos alineados: Gen Z Indulgentes→Gen Z Cafés, Premium→Premium Cafés, PAE por confirmar→Aspiracionales + Educated Pet Owners (Gatos/Mixto/Perros, el propio libro lo marca «POR CONFIRMAR»), Region Sur→Usuarios CON región.

**⚠️ Actualización del 22-oct (noche) y 26-oct:** Rick pidió ELIMINAR la columna `PiezaID` (ya lo había pedido el 21-ago) y se eliminó del catálogo, de Piezas y de Auditoría: ver [[pieza-id-eliminada]]. Todo lo de arriba sobre «llenar PiezaID» quedó sin objeto; el catálogo de SFMC tiene ahora 15 columnas. Lo que sigue vigente es lo demás (Segmento, Touchpoint, Marca).
**Pendiente (antes «21 PiezaID por definir»; ahora solo Segmento):** piezas que NO están en el libro: Checo ×5, Dog Chow ×9, ICE E-L1 ×4 + ICE E-P1 FUP, Concentrate E-Rit3 (`TMP-CONCENTRATE-E-RIT3`, touchpoint `E-Rit3*`), Maggi E-SNM-Femenil; su Segmento (18 pendientes). Cuando la sesión del reporte las agregue al libro, repetir la sincronía. `TMP-AON-EPROP2` y `-FUP`: el libro dice «Usuarios re-enganchables: nuevos del último año que nunca han interactuado» (74 caracteres; la columna de SFMC admite 60) → Rick eligió el 22-oct la etiqueta corta **«Reenganchables»**, ya aplicada en el catálogo y propagada a Detalle y Piezas (verificado el 26-oct). CodigoNC vacío en 16 filas de los dos lados (no derivable).
**Decisión de Rick (22-oct):** los journeys de WhatsApp NO se agregan al `Catalogo_Piezas` del libro (el libro lo edita solo él).
**Lección del mismo día:** el nombre de DE `TD-SFMC_IPG_MEX_RN_SNM_Femenil_Octubre_101026_FILTRADO` (con guion) disparaba la detección de «secret» y `snapshot.js` se negaba a guardar; arreglado en el kit (commit 288e851) tratando el guion como parte del identificador.
