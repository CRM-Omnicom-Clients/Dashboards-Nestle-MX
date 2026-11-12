---
name: pipeline-reporte-nestle
description: "Pipeline de reportería de email Nestlé en SFMC (6 DEs, 5 queries, automation CRM_Reporte_Diario diaria 00:08 Central): la fuente de verdad es el skill crm-reporte-mcp-nestle-sfmc; aquí solo la historia y lo que no está en sus docs"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3fcc95e0-6a7f-416d-8815-86a488810f41
  modified: 2026-10-26T17:33:52.588Z
---

**Fuente de verdad desde el 2-oct-2026: el skill `~/.claude/skills/crm-reporte-mcp-nestle-sfmc/`** (`SKILL.md`, `docs/ARQUITECTURA.md`, `docs/PROCESOS.md`,
`docs/SEGURIDAD.md`, `docs/CONEXION.md`). Ahí están los objetos (DEs, queries, automation, grano, orden de pasos), cómo agregar una pieza, refrescar, el lag de
propagación y las reglas duras. **No dupliques aquí lo que ya vive ahí**: si esta nota contradice al skill o a lo que ves en SFMC, gana lo que ves
(`node scripts/snapshot.js --comparar …`). Los scripts viejos de `_mcp-sfmc/scripts-nestle/` están **DEPRECADOS** (README con la tabla de equivalencias).

Pipeline construido en `NMX - Nestle Mexico` (MID 10966050), carpetas `CRM Services` (DEs `445199`, queries `460279`). Filtra por catálogo: **solo reporta las piezas
que Rick indica**, no toda la BU. Reemplaza a `CRM_Email_Performance` (+ su query y su automation `_Daily`), que siguen existiendo en el tenant pero quedaron atrás
([[sfmc-nestle-mcp]] aún los describe: eso es historia).

## Estado verificado 2-oct-2026 (con fecha: puede cambiar)
- 6 DEs (Config 113 filas · Audiencias 99 · Detalle 752 · Piezas 111 · Auditoría 112 · Links 980), 5 queries, automation **Scheduled** diaria 00:08 Central (sin DST),
  **4 pasos**: Vol + Links → Detalle → Piezas → Auditoría. Corrida completa ≈ 15 min.
- Detalle es `Update` y **guarda historia que SFMC ya no puede regenerar** (retención ~6 meses de las data views): nunca borrarla ni pasarla a Overwrite.
- `CRM_Audiencias` se llena por script (`audiencias.js`), no por la automation; en Nestlé la atribución de audiencia se hace en el proceso de atribución del catálogo
  (decisión de Rick 2-oct: no aplicar `audiencias.js --escribir` en producción).

## Lo que NO está en los docs del skill (historia y por qué)
- **Mis defectos de 19-ago en la automation:** se creó sin nombre (era la única de 784 en la BU: Rick no la encontró y programó la vieja), con las queries en un solo
  step y sin schedule. La API **no** puede reestructurar steps (`PATCH {steps}` da 400, `PUT` 404), ni programar (REST y SOAP responden 200/OK y lo descartan en
  silencio), y `PATCH` solo acepta `{name}` a secas (con otro campo da 500). Rick lo arregló en la UI; hoy está bien. Por eso el kit nunca toca automations.
- **Dos señales de "terminó" distintas:** la automation → `lastRunTime` (historial, lo único que la API no falsea); una query → `LastRun`/`LastRefresh` estrictamente
  mayor y uniforme en todas las filas. **Contar filas NO sirve** (la auditoría siempre devuelve el mismo número; el contador se estabiliza al instante). Costó dos
  diagnósticos falsos.
- **Lag de propagación (mordió 3 veces, la última 9-sep con J7):** tras escribir en el catálogo por SOAP, el motor de queries tarda minutos en ver la fila; una
  query-guardia la ve ANTES que Detalle. La señal fiable es "la pieza YA tiene filas en Detalle". El kit lo resuelve en `refrescar-pieza.js`.
- **Identidad = `EmailName`** (renombrado de ContentName el 21-ago). `ConfigKey` es solo la PK interna de SFMC; el número de pieza NO se inventa
  (`PiezaID` ya no existe: se eliminó el 22-oct-2026, ver [[pieza-id-eliminada]]; ver también [[no-inventar-identificadores]] y [[identidad-emailname-regla-dura]]). Las columnas viejas
  `ContentName`/`Email_Content_Name` quedaron como legado (SFMC no deja borrar campos por API de forma confiable).
- `Journey_Name` solo se puebla en envíos de journey; los one-shot (`O_`, `RN_`, `MX.`) van vacíos y eso es correcto.
- Los defectos que este pipeline destapó en el catálogo: [[catalogo-crm-defectos]]. La migración de PK a EmailName: [[migracion-emailname-pk]].
