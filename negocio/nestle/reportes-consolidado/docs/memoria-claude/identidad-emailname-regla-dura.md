---
name: identidad-emailname-regla-dura
description: "Regla DURA Nestlé: la identidad de una pieza es el EmailName EXACTO de _Job, nunca el código del asset del brief ni el asset de Content Builder. Resolver SIEMPRE con resolver-emailname.js antes de agregar/actualizar/reportar"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3fcc95e0-6a7f-416d-8815-86a488810f41
  modified: 2026-10-02T21:58:31.487Z
---

Rick me corrigió (14-sep-2026), y no es la primera vez: **«Siempre tienes que revisar por
email name porfavor, eso ya lo sabes. Si no comencemos a tener reglas más duras.»**

Yo me había ido al **asset de Content Builder** (por API) para sacar el nombre de una pieza.
Mal por dos razones: (1) el asset **NO es la identidad** del pipeline, y (2) el asset API
**rebota 403** con el scope de lectura de Nestlé.

**Why:** todo el reporte casa por `RTRIM(j.EmailName) = c.EmailName`. Esa es la ÚNICA llave.
El **código del asset que Rick pega en el brief casi nunca es el nombre real del envío** — ya
mordió varias veces: `069127`→no existía · `048423`→era `035275` · `0242434`→era `024243`.
Y a veces el email fue **copiado/reenviado**, entonces SFMC le pega un sufijo ` - <fecha>` y
además **trunca `_Job.EmailName` a 100 chars** (ej: el J8 salió con el nombre de J7 +
` - 202609`, 100 chars). Ese string truncado ES la llave.

**How to apply — SIEMPRE, antes de agregar/actualizar/reportar cualquier pieza:**
1. Resolver el EmailName real desde `_Job` (desde 2-oct-2026 con el skill; el script viejo de `scripts-nestle/` está deprecado):
   `node ~/.claude/skills/crm-reporte-mcp-nestle-sfmc/scripts/resolver-emailname.js "<fragmento>" ["<otro>"]`
   (busca por fragmentos del código/jornada; devuelve el/los EmailName EXACTOS, su largo, EmailID, cuántos jobs, primer y último envío,
   si YA ESTÁ en el catálogo, y avisa de copias con sufijo de fecha, nombres de 100 chars y pruebas). Tarda ~30–40 s (el motor domina; `--desde` no acelera de forma medible).
   Salida 2 = ningún envío contiene ese texto (negativo real: la consulta terminó).
2. Anclar/consultar por ese EmailName EXACTO. NUNCA por el código del brief, NUNCA por EmailID en
   el JOIN, NUNCA por el asset de Content Builder.
3. Si el resolver no devuelve nada, **el envío no existe con ese nombre** (no se envió, o el nombre
   real es otro) — reportarlo, no inventarlo.

Relacionado: [[pipeline-reporte-nestle]] (el JOIN y el lag), [[no-inventar-identificadores]]
(tampoco inventar ConfigKey/PiezaID).
