---
name: sfmc-api-automations-aprendizajes
description: "Cómo se comporta DE VERDAD la API de Automation Studio de SFMC (medido en vivo el 22-oct-2026 en la BU NMX): toda automation creada por REST nace en PausedSchedule y solo la activa el endpoint legacy; run once, borrado por SOAP, start vs runallonce"
metadata:
  node_type: memory
  type: reference
  originSessionId: 3fcc95e0-6a7f-416d-8815-86a488810f41
  modified: 2026-10-23T01:09:59.236Z
---

Cosas que la documentación no dice (o dice mal) y que costaron horas al instalar `CRM_Reporte_Links_Dia`. Todas probadas en vivo; el código que las usa es `lib/linksdia.js` del skill crm-reporte-mcp-nestle-sfmc (ver [[links-por-dia-diseno]]). Antes de dudar de una, mira ese módulo y sus pruebas.

- **Crear con horario:** `POST /automation/v1/automations` con el horario dentro de `startSource: { typeId: 1, schedule: {...} }`. Con `schedule` suelto en el primer nivel SFMC lo ignora y la deja en `Ready` sin horario. `scheduleStatus: "active"` en el cuerpo se ignora.
- **Toda automation creada por la API nace en `PausedSchedule`** (`statusId` 4, `schedule.scheduleStatus: "paused"`, `scheduledTime: 0001-01-01`). `PATCH` con `status`, `statusId` o `schedule` responde 200 y NO cambia nada; `/actions/resume|resumeschedule|startschedule|activate` dan 404. En la BU hay ~198 de 803 automations en ese estado (muchas, quizá, por esto mismo).
- **Lo que SÍ la activa:** el endpoint «legacy» que usan Automation Studio y SFMC DevTools: `POST /legacy/v1/beta/bulk/automations/automation/definition/?action=schedule` con `{ id: <legacyId>, scheduleObject: { id: <id del horario> } }` → 201 `{ id }`. El `legacyId` NO es el GUID: viene en la respuesta del POST de creación (`legacyId`), y el id del horario sale de `GET /legacy/v1/beta/bulk/automations/automation/definition/{legacyId}` → `scheduleObject.id`. (El legacyId es base64 de `base64url(GUID en bytes .NET) + ":25:0"`; no se deriva en el código, se lee de la creación.) Se descubrió leyendo el código de SFMC DevTools (Accenture/sfmc-devtools, `lib/metadataTypes/Automation.js`), no la documentación: developer.salesforce.com contesta 403 a WebFetch.
- **Run once:** `POST /automation/v1/automations/{id}/actions/runallonce` con `{}`, y SOLO con la automation en `Ready` o `PausedSchedule` (en `Scheduled` da 400 «wrong status for a run once») → hay que correrla ANTES de activar el horario. `/actions/start` no es run once: exige `steps` con `activities` en el cuerpo (arranca desde un paso).
- **Borrar una automation:** `DELETE /automation/v1/automations/{id}` da 404 siempre; el SOAP `Delete` de `Automation` por `CustomerKey` sí funciona.
- **Borrar una DE que una actividad de automation referencia** la «borra suave» (la renombra `___Nombre_1`). Una DE recién creada puede tardar en verse para SOAP y para las queries: reintentar un 400/404 al crear la query que la carga.
- La **zona de la cuenta** es Central sin horario de verano (UTC−6): `startDate` del horario va sin zona, en hora de la cuenta; el GET devuelve `scheduledTime` en esa misma hora.

Cómo aplicarlo: para crear cualquier automation propia por código, sigue el orden crear con `startSource.schedule` → (correr una vez) → activar por el endpoint legacy → verificar con un GET que `status` sea `Scheduled`; y borra por SOAP, nunca por REST. En Nestlé solo se hace si Rick lo pide ([[sfmc-nestle-mcp]]).
