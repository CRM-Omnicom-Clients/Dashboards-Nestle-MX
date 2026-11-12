# MCP SFMC — Salesforce Marketing Cloud para Claude

Servidor MCP (Model Context Protocol) que conecta Claude Code / Claude Desktop con
**Salesforce Marketing Cloud**. Permite maquetar emails, subir assets a Content Builder,
gestionar Journeys y Data Extensions, correr SQL sobre Data Views y extraer métricas — sin
entrar a la UI.

> **Autor:** Ricardo Aguilar (Omnicom) · **Versión:** 1.1 (ago-2026)
> Un mismo `index.js` sirve a varios tenants; hoy corren **GEPP** y **Nestlé NMX**.

---

## 📚 Documentación

| Documento | Cuándo leerlo |
|---|---|
| **[docs/REPORTE-NESTLE-OPERAR.md](docs/REPORTE-NESTLE-OPERAR.md)** | **Nestlé, ya operando.** Las 4 DEs y la automation que alimentan el Reporte Consolidado: qué leer, cómo agregar piezas, y qué reveló el cruce |
| **[docs/CONECTAR-Y-DESCONECTAR.md](docs/CONECTAR-Y-DESCONECTAR.md)** | **Nestlé: acceso intermitente.** El ciclo de dos comandos para encender y apagar el MCP sin dejar credenciales |
| **[docs/EMAIL-TRACKING.md](docs/EMAIL-TRACKING.md)** | **Empieza aquí para métricas.** Qué fuente usar, las recetas, y por qué `Send` sí sirve para journeys |
| [docs/DATA-EXTENSIONS.md](docs/DATA-EXTENSIONS.md) | Leer, buscar y crear DEs. Los tres árboles de carpetas. Qué DEs de reportería ya existen |
| [docs/DATA-VIEWS.md](docs/DATA-VIEWS.md) | El pipeline SQL → DE (`CRM_Email_Performance`) y cuándo NO hace falta |
| [docs/SFMC-API.md](docs/SFMC-API.md) | La API por dentro: endpoints que no existen, SOAP, errores, scopes |
| **[docs/PLAN-REPORTE-FILTRADO.md](docs/PLAN-REPORTE-FILTRADO.md)** | **Pendiente de implementar.** Diseño para que la DE traiga solo las campañas que Rick indique y se refresque sola cada semana |
| [../CONSTRUIR-MCP.md](../CONSTRUIR-MCP.md) | **Genérico.** Lecciones para construir cualquier MCP, con checklist |

**Si vas a tocar el código de este MCP, lee `CONSTRUIR-MCP.md` primero.** Los defectos que
documenta salieron de aquí.

---

## ⚠️ Antes de empezar — seguridad de credenciales

- El código es **libre de compartir**. El `.env` con las llaves **NO** — está en `.gitignore` a propósito.
- Cada persona usa **su propio `.env`** (copiado de `.env.example`).
- **Nunca** pegues el `client_secret` real en este README, en chat, ni en un MD compartido.
- Si comparten una sola llave de Installed Package, pásenla por un canal seguro (gestor de contraseñas), no por SharePoint/correo.

---

## Requisitos

- **Node.js 18+** (probado con Node 24 portable)
- Credenciales de un **Installed Package Server-to-Server** en SFMC (ver abajo)

## Instalación

```bash
# 1. Clonar / copiar la carpeta _mcp-sfmc
cd _mcp-sfmc

# 2. Instalar dependencias
npm install

# 3. Configurar credenciales
cp .env.example .env
#   → edita .env con tus valores reales
```

## Cómo obtener las credenciales (Installed Package)

En SFMC: **Setup → Apps → Installed Packages → New**
1. Nombra el package (ej. `MCP-Claude`)
2. Add Component → **API Integration** → tipo **Server-to-Server**
3. Da los scopes necesarios (Email/Content: Read+Write, Automations, Data Extensions, Tracking, Journeys según lo que uses)
4. Copia `Client Id`, `Client Secret` y el `MID` de la Business Unit
5. El subdominio del tenant sale de cualquier URL de tu instancia (`https://{TENANT}.marketingcloudapis.com`)

> **Nota de auth crítica:** el token request **requiere `account_id` (MID) en el body**; sin él devuelve `invalid_client` aunque las llaves sean correctas. El `client_secret` incluye el prefijo `SFMC_` como parte del valor real.

## Registrar el MCP en Claude

⚠️ **La config va en `~/.claude.json` → clave `mcpServers`.** El archivo `~/.claude/mcp.json`
**no lo lee nadie** — es una trampa que ya costó horas.

⚠️ **El bloque `env` es obligatorio.** Este servidor carga su `.env` con `dotenv/config`,
que resuelve contra el **CWD** — y el CWD al arrancar es la carpeta del proyecto, no la del
MCP. O sea: **el `.env` NO se carga** y las credenciales del config son load-bearing.
"Limpiarlas" rompe el servidor.

```json
{
  "mcpServers": {
    "sfmc": {
      "command": "C:\\Users\\<usuario>\\.claude\\tools\\node\\node.exe",
      "args": ["C:\\Users\\<usuario>\\.claude\\tools\\_mcp-sfmc\\index.js"],
      "env": {
        "SFMC_CLIENT_ID": "...",
        "SFMC_CLIENT_SECRET": "SFMC_...",
        "SFMC_ACCOUNT_ID": "<MID>",
        "SFMC_AUTH_URL": "https://<tenant>.auth.marketingcloudapis.com/v2/token",
        "SFMC_REST_URL": "https://<tenant>.rest.marketingcloudapis.com",
        "SFMC_SOAP_URL": "https://<tenant>.soap.marketingcloudapis.com"
      }
    }
  }
}
```

**Varios tenants:** registra el MISMO `index.js` con otro nombre de servidor y otro bloque
`env`. No se duplica código. Hoy corren dos: `sfmc` (GEPP) y `sfmc-nestle`.

Reinicia Claude Code — los MCP solo cargan al arrancar — y verifica con `/mcp`.

---

## Herramientas disponibles (27)

**Content Builder** (7)
`sfmc_list_folders` · `sfmc_create_folder` · `sfmc_list_assets` · `sfmc_get_asset` · `sfmc_create_email` · `sfmc_update_asset` · `sfmc_delete_asset`

**Journey Builder** (6)
`sfmc_list_journeys` · `sfmc_get_journey` · `sfmc_fire_entry_event` · `sfmc_pause_journey` · `sfmc_resume_journey` · `sfmc_stop_journey`

**Data Extensions** (7)
`sfmc_list_data_extensions` · `sfmc_list_de_folders` · `sfmc_get_de_fields` · `sfmc_get_de_rows` · `sfmc_create_data_extension` · `sfmc_delete_data_extension` · `sfmc_upsert_de_rows`

**Tracking** (4)
`sfmc_list_sends` · `sfmc_get_send_metrics` · `sfmc_get_bounces` · `sfmc_get_clicks`

**Automation Studio** (3)
`sfmc_list_queries` · `sfmc_run_query` · `sfmc_list_automations`

### Notas de implementación que no son obvias

- **Tracking va por SOAP, no por REST.** El endpoint `/data/v1/messageList/email/sends`
  **no existe** en la API de SFMC (404 en todos los tenants). Los datos viven en los
  objetos SOAP `Send`, `BounceEvent` y `ClickEvent`.
- **`sfmc_get_de_rows` se pide por `name`, no por `externalKey`**, y va por SOAP: el REST
  `/data/v1/customobjectdata/.../rowset` devuelve 400 para cualquier DE en estos tenants.
- **Toda tool que pagina reporta `truncated`** cuando descarta filas. Si ves `truncated:true`,
  los agregados de esa respuesta son de un subconjunto, no del total.
- **Data Views** (`_Job`, `_Sent`, `_Open`, …) no se consultan por API: ver
  [docs/DATA-VIEWS.md](docs/DATA-VIEWS.md).

---

## Estructura del proyecto

```
_mcp-sfmc/
├── index.js              # Entry point — registra las tools y arranca el server (stdio)
├── src/
│   ├── auth.js           # Token OAuth (client_credentials). Cachea en memoria.
│   ├── client.js         # HTTP (axios) + helpers SOAP y de escape/unescape XML
│   └── tools/
│       ├── content_builder.js
│       ├── journey_builder.js
│       ├── data_extensions.js
│       ├── tracking.js
│       └── automations.js      # Query Activities y Automations
├── docs/                 # Ver la tabla de arriba
├── _scripts/             # Scripts sueltos (NO son parte del MCP; gitignored)
├── .env.example          # Plantilla (SÍ se versiona)
├── .env                  # Credenciales reales (NO se versiona)
└── package.json
```

## Lo que puede y no puede el API user

Depende **enteramente de los scopes** que se le dieron al Installed Package, no del MCP.
Ver la tabla de scopes en [docs/SFMC-API.md](docs/SFMC-API.md).

> Una nota vieja de este README decía que el API user **no puede crear carpetas de Data
> Extensions**. Es falso: el 31-jul-2026 se creó la carpeta `Query / CRM Services` por SOAP
> (`Create` sobre `DataFolder`) sin problema. Lo que sí falla es **programar automations**,
> que el REST acepta y descarta en silencio.

## Notas de red

`NODE_TLS_REJECT_UNAUTHORIZED=0` **ya no hace falta.** Era necesario por el proxy de
inspección SSL de Interpublic; tras la migración a Omnicom (jul-2026) el handshake TLS pasa
limpio contra los dos tenants — verificado el 31-jul-2026 y las configs activas no lo llevan.

Si algún día vuelve a fallar por `UNABLE_TO_VERIFY_LEAF_SIGNATURE` o similar, agregarlo al
bloque `env` del servidor en `~/.claude.json`.
