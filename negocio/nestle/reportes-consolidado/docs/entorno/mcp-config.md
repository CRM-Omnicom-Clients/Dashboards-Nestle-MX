# MCP y conectores — detalle de referencia

> Material de **consulta**. Lo que cambia el comportamiento en toda sesión vive en CLAUDE.md;
> aquí está el detalle que se busca al tocar un MCP.
> Ruta de este archivo: `~/.claude/docs/mcp-config.md`

## Dónde vive la config (esto costó horas — no repetir)

| App | Archivo que SÍ lee |
|---|---|
| **Claude Code** | `~/.claude.json` → clave `mcpServers` (raíz = todos los proyectos) |
| **Claude Desktop** | `%APPDATA%\Claude\claude_desktop_config.json` (`%APPDATA%` **ya es** `AppData\Roaming`) |
| Proyecto puntual | `.mcp.json` en la raíz del proyecto |
| ⚠️ `~/.claude/mcp.json` | **NADIE lo lee** — archivo trampa |

- **Los MCP se cargan al INICIAR.** Editar la config con la app abierta no surte efecto → **reiniciar**.
- Los servidores propios van en **ruta LOCAL** (`~/.claude/tools/_mcp-*`), nunca en OneDrive: se
  deshidratan y no arrancan.
- Diagnóstico: `%LOCALAPPDATA%\claude-cli-nodejs\Cache\<proyecto>\mcp-logs-<servidor>\*.jsonl`.
  Si **no existe** esa carpeta, la app ni intentó lanzarlo → problema de **registro**, no del servidor.
- Para distinguir "falta reiniciar" de "credenciales rotas": probar la credencial directo con un
  `fetch` a la API. Si da HTTP 200, el servidor va a funcionar en cuanto reinicies.

## Servidores propios

| Servidor | Notas |
|---|---|
| **SFMC** (`_mcp-sfmc`) | Salesforce Marketing Cloud de GEPP; sigue válido tras la migración (autentica contra Salesforce, no M365). ⚠️ A diferencia de Asana, **NO** lee su `.env` por ruta absoluta (depende del CWD): las credenciales en los dos configs son **load-bearing** — "limpiarlas" rompe el servidor. |
| **Asana** (`_mcp-asana`) | PAT propio (no OAuth, no expira). ⚠️ Autentica con la identidad **vieja** de Kinesso (`@kinesso.com`, workspace IPG Mediabrands). Su `.env` se carga por ruta absoluta → no duplicar el token en el config. |

El código de ambos está respaldado en el repo git de `~/.claude/tools/` (no así sus `.env`, ni
`_mcp-sfmc/_scripts/` — 8 de esos archivos traen el client_secret hardcodeado).

## Conectores de la cuenta claude.ai

Google Calendar · Google Drive · Canva · Notion · Chrome (automatización) · Meta Ads · Scheduled Tasks.
Viven en la **cuenta**, no en el disco → sobreviven a reinstalaciones; solo piden re-consentir.

⚠️ Los servidores `plugin:marketing:*` (gmail, google-calendar, etc.) fallan al arrancar con
*"No URL configured"*: están rotos de origen y son **`@inline`** (embebidos en la app) → **no se quitan
editando archivos**, solo desde `/plugin` interactivo o Settings → Connectors. Son ruido, no afectan nada.

## Prefijo `anthropic-skills:` en el listado de skills

Cosmético. Claude Code agrupa bajo ese namespace los skills que trae la app, igual que los plugins
usan `plugin:skill` para evitar choques de nombre. No hay ningún plugin instalado con ese nombre y los
skills propios siguen con una sola copia en `~/.claude/skills/`. Nada que arreglar.
