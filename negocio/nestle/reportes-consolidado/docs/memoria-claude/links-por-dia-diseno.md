---
name: links-por-dia-diseno
description: "CRM_Email_Links_Dia INSTALADA y activa desde el 22-oct-2026 (clicks por link con ClickDay y SendDay; automation propia CRM_Reporte_Links_Dia diaria 00:50 Central, corridas nocturnas verificadas hasta el 26-oct): grano, números de conciliación, caso E-Hack1 de Rick y contrato para la sesión del Excel"
metadata:
  node_type: memory
  type: project
  originSessionId: 3fcc95e0-6a7f-416d-8815-86a488810f41
  modified: 2026-10-26T17:33:46.445Z
---

**Qué pidió Rick (22-oct-2026, pegó una nota de la sesión del Excel):** el desglose de clicks del reporte (CTA · baja · redes+navegador+legal · medidos) sale de `CRM_Email_Links`, que NO trae fecha. Una pieza con varias quincenas repite el total de la pieza en cada fila (su ejemplo: `E-Hack1 2026-08-Q1 · 116 envíos · 0 clicks · Medidos 778`; yo medí +71 % de clicks «medidos» en todo el reporte: 90,615 repetidos contra 52,930 reales). Elegió la opción A (instalar con una guardia ensanchada) y luego pidió «la fecha del click, no la quincena».

**Estado: INSTALADA y activa (22-oct-2026, ~19:15 Central).** Tres objetos en la BU NMX, creados por `scripts/instalar-links-dia.js --escribir` del kit crm-reporte-mcp-nestle-sfmc (commit e76b333):
- DE `CRM_Email_Links_Dia` (Update, 12 campos, llave `RowKey`)
- query `CRM_Email_Links_Dia_Load` (Update, id ebac2d29-5254-4f14-8a73-736b25e8ee17) — mismas expresiones `Link_Name` / `Link_URL` que la query vigente de Links
- automation `CRM_Reporte_Links_Dia` (id 2a451e8f-dc7a-4b35-8136-e8d41e4da5f3, carpeta 708): 1 paso, 1 actividad, **diaria 00:50 Central** (UTC−6), `Scheduled`, primera corrida programada 23-oct 00:50; corrió una vez a mano antes de activarla (107 s) y quedó bien. **Separada a propósito** de `CRM_Reporte_Diario` (00:08, intacta: 4 pasos, `Scheduled`): si falla no frena Detalle/Piezas/Auditoría.

**Grano y columnas:** `JobID × SendDay × ClickDay × link`. RowKey = `JobID_AAAAMMDD(envío)_AAAAMMDD(click)|ConfigKey|SHA1(URL)`; JobID, **SendDay** (día en que SALIÓ el correo, el mismo que usa el Detalle: el click se une a `_Sent` con LEFT JOIN), **ClickDay** (día del click, nunca vacío), ConfigKey, EmailName, Email_ID, Link_Name, Link_URL (500), Clicks_Total, Clicks_Unique, LastRefresh. Tipo **Update**: conserva filas de envíos que las vistas de datos (~182 días) ya olvidaron; un Overwrite las perdería. No lleva columna de quincena: la fecha es real y quien consume agrupa como quiera (v1 del diseño tenía `Quincena` y grano JobID×SendDay; la v3 instalada lo cambió por pedido de Rick).

**Números de la instalación:** 11,072 filas · 214,425 clicks · llave única · 0 clicks antes de su envío · 103 filas / 135 clicks con SendDay vacío (el envío ya salió de las vistas; el click no se pierde) · total contra `CRM_Email_Links` 214,398 (+27: clicks que llegaron entre lecturas) · job×día de envío contra el Detalle: 450 de 458 iguales, los 8 restantes difieren 1–6 clicks (tardíos; el Detalle se refresca a las 00:08).

**El caso de Rick (E-Hack1 = 007-P001 + 007-P002):** por quincena de ENVÍO la tabla coincide EXACTO con el Detalle (892 / 0 / 608 / 4 / 1 clicks en 2026-07-Q2 / 08-Q1 / 09-Q2 / 10-Q1 / 10-Q2 = 1,505); por quincena del CLICK se reparten donde ocurrieron (811 / 50 / 28 / 1 / 590 / 22 / 3). Esa fila «2026-08-Q1, 116 envíos, 0 clicks» tiene 50 clicks en esa quincena, pero de correos enviados en julio. **Decisión de significado que le toca a la sesión del Excel:** filas por envíos → `SendDay` (cuadra con opens/sends del Detalle); actividad por calendario → `ClickDay`.

**Contrato para la sesión del Excel:**
- Sumar `Clicks_Total`. `Clicks_Unique` NO es aditivo entre días ni entre links (quien cliquea dos días cuenta dos).
- Clasificar por `Link_URL` con `_contratos/clicks-destinos.json` (la misma lógica que `CRM_Email_Links`).
- Cruzar con el Detalle por `JobID + SendDay` (= `RowKey` del Detalle `JobID_AAAAMMDD`) para descartar los jobs de prueba con el mismo umbral (<10 envíos) que ya usa con el Detalle.
- `SendDay` vacío = envío ya fuera de las vistas: esos clicks suman al total pero no tienen quincena de envío.
- `CRM_Email_Links` (viejo, Overwrite, sin fecha) sigue existiendo y se encoge solo; esta tabla acumula hacia adelante. Cada noche sin ella se perdía un día de detalle por link de los envíos más viejos.

**Límites:** no hay detalle por link para envíos ≤ 22-abr-2026 (21 filas del Detalle, 5,863 clicks = 2.7 %): esas piezas conservan el total de pieza del Links viejo ([[pipeline-reporte-nestle]], [[plan-portabilidad-sfmc]]: historia irrecuperable). Sigue ciega al link de baja tokenizado por suscriptor (lo cubre `motor.clicks-desde-plataforma.js` del reporte con ClickEvent).

**Corridas nocturnas VERIFICADAS (26-oct-2026):** `CRM_Reporte_Links_Dia` corre sola: `Scheduled`, última corrida 26-oct 00:50, próxima 27-oct 00:50, y `CRM_Email_Links_Dia` pasó de 11,072 a 11,440 filas (ClickDay 22-abr → 26-oct, 217,006 clicks, último LastRefresh 26-oct 00:50); `CRM_Reporte_Diario` sigue sana (última 26-oct 00:08, 4 pasos). Cómo se activó el horario (la API crea toda automation en PausedSchedule; solo la activa el endpoint legacy) está en [[sfmc-api-automations-aprendizajes]]. Para volver a instalar o rehacer la automation: el script es idempotente (simulacro por defecto) y borra por SOAP + recrea la que quede sin programar.
