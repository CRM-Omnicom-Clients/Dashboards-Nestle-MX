# Scripts operativos — Reporte de Email CRM Nestlé (SFMC)

> 🔴 **DEPRECADO (2-oct-2026): estos scripts los reemplaza el skill `crm-reporte-mcp-nestle-sfmc`** (`~/.claude/skills/crm-reporte-mcp-nestle-sfmc/`; empieza por su `SKILL.md`). Son los mismos procesos, pero portables
> (sin rutas con usuario ni IDs fijos), con guardia de escritura, pruebas y documentación. No se borran: quedan como historia. **No los uses para operar**: dependen de `ConfigKey`, de módulos del MCP y de
> credenciales en `~/.claude.json`, y `add-pieza.js` se edita a mano. Además, la automation tiene **4 pasos** (Vol + Links van juntos), no 5 como dice más abajo.
>
> | Antes (`scripts-nestle/`) | Ahora (`crm-reporte-mcp-nestle-sfmc/scripts/`) |
> |---|---|
> | `resolver-emailname.js` | `resolver-emailname.js` |
> | `add-pieza.js` | `agregar-pieza.js` (simulacro por defecto; `--escribir` inserta y verifica) |
> | `refrescar-pieza.js`, `actualizar-todo.js` | `refrescar-pieza.js` |
> | `refrescar-audiencias.js` | `audiencias.js` |
> | `master-doc.js`, `handoff-doc.js`, `fix-*.js`, `check-4.js`, `resolver-dup.js`, `qd.js`, `leer.js` | sin reemplazo (trabajos puntuales o librerías internas) |

Scripts persistentes del pipeline de reportería de email de Nestlé. Viven aquí (en git)
porque el scratchpad de sesión se limpia solo y borra los `.js` a media tarea.

Requieren conexión al MCP `sfmc-nestle` activa (leen las credenciales del bloque `env` de
`~/.claude.json`). Correr con el node del entorno:
`~/.claude/tools/node/node.exe <script>.js`

## 🔴 REGLA DURA: la identidad es el EmailName de `_Job`, siempre

Antes de agregar/actualizar/reportar CUALQUIER pieza, resuelve su **EmailName real** con
`resolver-emailname.js`. El código del asset que llega en el brief **casi nunca** es el nombre
del envío (`069127`→no existía · `048423`→`035275` · `0242434`→`024243`), y a veces SFMC trunca
el nombre a 100 chars y le pega un sufijo ` - <fecha>` en copias/reenvíos. **Nunca** uses el
código del brief ni el asset de Content Builder (su API rebota 403) como llave.

## Los scripts

| Script | Qué hace | Cuándo correrlo |
|---|---|---|
| `resolver-emailname.js "<frag>" [--desde=<jobid>]` | resuelve el/los **EmailName EXACTOS** de `_Job` para un fragmento (código, jornada), con largo, EmailID y marca de `[Test]` | **SIEMPRE primero**, antes de agregar/actualizar/reportar una pieza |
| `actualizar-todo.js` | corre las 5 queries en orden (Vol → Detalle → Piezas → Auditoría → Links) esperando a que cada una termine de verdad | actualización manual del sistema; normalmente lo hace la automation diaria |
| `refrescar-pieza.js <ConfigKey>` | igual que actualizar-todo pero **reintenta Detalle hasta que la pieza nueva aterriza** (vence el lag de propagación que deja la pieza en 0 tras una sola corrida) | tras `add-pieza.js`, cuando quieres ver la pieza nueva el **mismo día** sin re-correr a mano |
| `add-pieza.js` | agrega **una** pieza al sistema: la sondea, la mete al catálogo anclada por ContentName, la mapea a su DE de audiencia. **Editar `NOMBRE` y `CK` adentro.** NO refresca las DEs de reporte | cuando entra un correo nuevo al reporte |
| `refrescar-audiencias.js` | re-resuelve pieza → DE de audiencia (interaction API), recarga `CRM_Audiencias` y regenera `CRM_Audiencias_Vol_Load` | solo cuando entran journeys/audiencias nuevas |
| `master-doc.js` | regenera el MD maestro `REPORTE-CRM-EMAIL-SISTEMA.md` con datos en vivo | cuando quieras el reporte actualizado en doc |
| `qd.js`, `leer.js` | librerías (REST/SOAP y lectura de DEs) | — |
| `audiencias-volumen.json`, `mapa-audiencias.json` | estado del mapa de audiencias | los mantienen los scripts |

## Objetos en SFMC (NMX 10966050, carpetas CRM Services)

DEs: `CRM_Reporte_Config` · `CRM_Audiencias` · `CRM_Email_Detalle` · `CRM_Email_Piezas`
· `CRM_Reporte_Auditoria` · `CRM_Email_Links`.
Queries: `CRM_Audiencias_Vol_Load` · `CRM_Email_Detalle_Load` · `CRM_Email_Piezas_Load`
· `CRM_Reporte_Auditoria_Load` · `CRM_Email_Links_Load`.
Automation: `CRM_Reporte_Diario` (`8a8a7b31-…`) — debe tener los 5 pasos en orden.

El contexto completo del pipeline vive en la memoria `pipeline-reporte-nestle` y en
`../docs/`.
