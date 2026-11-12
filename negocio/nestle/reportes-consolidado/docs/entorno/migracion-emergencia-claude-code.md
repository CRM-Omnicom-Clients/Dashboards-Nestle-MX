# Plan de emergencia — migrar Claude Code a otra computadora

> **Cuándo se usa:** si tienes que pasar Claude Code a una máquina personal (laptop corporativa
> muere, te la piden de vuelta, cambias de rol). Ruta de este archivo:
> `~/.claude/docs/migracion-emergencia-claude-code.md`
> **Paradoja a resolver primero:** este plan vive dentro de `~/.claude`. Si la laptop muere sin
> respaldo *fuera* de ella, el plan muere con ella. Por eso el paso 1 de "Preparación HOY" es
> sacar una copia **off-machine** — y esa copia incluye este archivo.

---

## 0. El principio rector: separar lo TUYO de lo CORPORATIVO

No todo se migra. A una computadora **personal** NO deben pasar datos ni credenciales de cliente
(gobernanza de datos Omnicom; probablemente contra política). La migración carga tu **entorno de
trabajo reutilizable**, no la información de las cuentas.

| Se MIGRA (tuyo, reutilizable) | NO se migra a personal (corporativo) |
|---|---|
| `CLAUDE.md`, `rules/`, `docs/`, `settings.json` | Credenciales SFMC/GEPP, Asana PAT corporativo |
| Memorias (`projects/*/memory/*.md`) | Datos de cliente en OneDrive (Nestlé, Unilever, GEPP…) |
| `skills/`, `agents/` (código) | MCPs que autentican con identidad Omnicom |
| `tools/` **scripts** (los `.js`/`.py`, no los binarios) | Cualquier `.env` con secreto de cuenta |
| Proyectos personales (Agenda, entrenamiento, dashboards propios) | Los `.jsonl` de sesiones (traen credenciales en claro) |

En la máquina personal **re-autenticas solo lo tuyo** (Google Calendar, tu Asana personal si aplica).
Lo corporativo se re-emite por IT en el equipo que corresponda.

---

## 1. Los 2 huecos que hoy convierten una emergencia en una pérdida

**Hueco #1 — Los 6 repos son local-only (sin `remote`).**
`.claude`, `skills`, `tools`, `agents`, `rick-copies`, `crm-reporte-doctrina` no tienen a dónde hacer push.
Si el disco muere, **no hay de dónde clonar**. El git local solo protege contra borrados accidentales
en la misma máquina, no contra perder la máquina.

**Hueco #2 — Las credenciales están fuera de git.**
`.env` (MCPs), `.credentials.json` (OAuth de Claude Code) están git-ignorados a propósito. Bien para
no filtrarlas — pero significa que **no están respaldadas en ningún lado**. Si mueres la máquina, se
pierden y se re-emiten desde cero.

---

## 2. Preparación HOY (para que "emergencia" no sea "pánico")

1. **Copia off-machine del conocimiento (sin secretos, sin binarios).** tar nativo de Windows:
   ```powershell
   tar -a -c -f "$env:USERPROFILE\claude-portable.zip" -C "$env:USERPROFILE\.claude" `
     --exclude=".git" --exclude=".env" --exclude=".credentials.json" `
     --exclude=".msal-cache.json" --exclude="*.jsonl" --exclude="tool-results" `
     --exclude="node_modules" --exclude="node" --exclude="pac2" `
     --exclude="whisper-small-model" --exclude="ffmpeg" `
     CLAUDE.md RESTAURAR.md rules docs commands settings.json projects skills agents tools
   ```
   (O simplemente: `powershell -ExecutionPolicy Bypass -File ~/.claude/tools/backup-claude.ps1`, que
   corre este mismo comando y verifica que no haya secretos.)
   (Se excluyen a propósito: `.git` — su historia carga IDs viejos y pesa; `.msal-cache.json` — token
   de copilotstudio; `.env`/`.credentials.json`/`*.jsonl`/`tool-results` — secretos; y los binarios
   pesados que se reinstalan por winget.)
   Verifica que NO trae secretos antes de sacarlo del equipo:
   ```powershell
   tar -tf "$env:USERPROFILE\claude-portable.zip" | Select-String "\.env$|credentials"   # debe salir vacío
   ```
   Guárdalo donde TÚ controles (USB / almacenamiento personal). Repite cada tanto — es tu única red
   real contra el Hueco #1.

2. **Commit al día antes de respaldar.** Hoy hay cambios sin commit en todos los repos. Un respaldo
   de un working tree a medias restaura un estado a medias. Por repo:
   ```
   cd <repo> && git add -A && git commit -m "checkpoint pre-migracion"
   ```
   ⚠️ Con sesiones paralelas de Claude Code abiertas, comitea con cuidado (puede haber trabajo de
   otra sesión sin terminar). Cierra las demás sesiones antes del checkpoint.

3. **Inventario de MCP: qué re-autenticar y qué NO** (el código de los MCP propios viaja en el zip;
   los `.env` con secretos NO — se regeneran desde la cuenta que corresponda). Esta lista no lleva
   secretos, solo *qué* re-conectar y *desde qué cuenta*:

   | MCP / conector | Identidad | En máquina personal |
   |---|---|---|
   | Google Calendar | tu Gmail personal (rick.movement) | ✅ **Re-auth OAuth** — es tuyo |
   | Asana | PAT identidad Kinesso/Omnicom | ❌ corporativo — no migrar |
   | SFMC (Nestlé, GEPP) | credenciales de cuenta de cliente | ❌ corporativo — no migrar |
   | Data Cloud (Salesforce GEPP) | Connected App de la org GEPP | ❌ corporativo — no migrar |
   | Copilot Studio / Power Platform | AAD Omnicom (device-code) | ❌ corporativo — no migrar |
   | Conectores de trabajo (Slack, HubSpot, Notion corp…) | cuentas Omnicom | ❌ corporativo — no migrar |

   **Regla:** en personal solo re-autenticas lo que es legítimamente tuyo. Los `.env` corporativos
   NUNCA se copian; si un MCP propio (p. ej. datacloud) se quiere usar con una cuenta personal, se
   crea un `.env` nuevo con credenciales personales, no las de cliente.

---

## 3. En la máquina nueva — qué se copia vs qué se re-instala

Los **binarios NO se copian**: se re-instalan por winget (firmados por Microsoft → cero pelea con
cualquier EDR, y auto-actualizables). Copiar los viejos arrastra los problemas de firma/reputación.

| Componente | Acción |
|---|---|
| Node.js | `winget install OpenJS.NodeJS` |
| Python 3.13 | python.org, luego `pip install` de la lista en `docs/entorno-local.md` |
| ffmpeg | `winget install Gyan.FFmpeg` |
| pac (Power Platform CLI) | `winget install Microsoft.PowerPlatformCLI` (**la versión firmada** — sin extraer nupkg a mano) |
| `node_modules` compartido | `npm install --prefix ~/.claude/tools` (se reconstruye del package.json) |
| Modelo whisper | re-descargar a `~/.claude/tools/whisper-small-model/` |
| Conocimiento y scripts | restaurar del `claude-portable.zip` |

---

## 4. Procedimiento de arranque (orden)

1. Instalar **Claude Code** (`npm i -g @anthropic-ai/claude-code` o el instalador oficial).
2. Instalar Node, Python, ffmpeg, pac por **winget** (paso 3).
3. Descomprimir `claude-portable.zip` en `%USERPROFILE%\.claude`.
4. `npm install --prefix ~/.claude/tools` → reconstruye `node_modules`.
5. `pip install` de la lista de paquetes (ver `docs/entorno-local.md`).
6. Re-descargar el modelo whisper.
7. **Re-autenticar SOLO los MCP personales.** No traer credenciales corporativas.
8. **Reescribir rutas:** en personal NO existe `OneDrive - OneWorkplace`. Los scripts de `tools/`
   ya resuelven por `homedir()` (portables), pero cualquier ruta a datos de cliente hay que
   repuntarla a donde vivan los datos personales — o dejarla muerta si esos datos no se migran.
9. **Verificar antes de confiar:** correr un `.xlsx` de prueba con las 4 validaciones, un
   `transcribe`, y `git status` en cada repo.

---

## 5. Ventaja colateral: en personal desaparece el problema del EDR

Una máquina personal **no tiene SentinelOne ni proxy corporativo**. Eso significa:
- Los binarios sin firma (ffmpeg, DLLs de pac) **no se ponen en cuarentena** — el motivo #1 de fallos
  de herramienta se evapora.
- El bypass TLS ya no tiene ni pretexto (ya lo quitamos de sfmc/asana/transcribe; en personal
  tampoco haría falta para copilotstudio/datacloud).
- Ya no hay que pedirle a IT que meta nada en allowlist.

El precio es el del punto 0: pierdes acceso legítimo a las cuentas corporativas. La máquina personal
es para **tu tooling y tus proyectos**, no para operar las cuentas de cliente.
