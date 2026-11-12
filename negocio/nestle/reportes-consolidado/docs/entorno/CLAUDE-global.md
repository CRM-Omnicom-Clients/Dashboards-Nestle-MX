# Setup Global — Ricardo Aguilar
# Leído automáticamente en TODAS las sesiones de Claude Code

> **Este archivo solo contiene lo GLOBAL.** Lo específico de un cliente, campaña o proyecto vive
> en memorias o skills — ver "Qué va dónde" abajo. Si algo aquí deja de ser cierto: **corregirlo o
> borrarlo**, no acumular correcciones.

---

## 🗓️ Estado verificado — 21-jul-2026 (post-migración Kinesso → Omnicom)

- OneDrive corporativo: `OneDrive - Interpublic` → **`OneDrive - OneWorkplace`**. Toda ruta con "Interpublic" está muerta.
- La carpeta de usuario **sigue siendo** `C:\Users\Ricardo.Aguilar` (identidad nueva `oneds+ricardo.aguilar`).
- Node, Python, ffmpeg y los 2 MCP propios **corren**. Los **paquetes** no se dan por buenos: esta
  instalación se corrompe sola → verificar **usándolos** cuando los vayas a ocupar (ver sección Python).
- Historial: `cleanupPeriodDays: 365` (antes 60, borraba transcripts en silencio).

---

## 📍 Qué va dónde — CLAUDE.md vs memorias vs skills

| Dónde | Qué va ahí | Cuándo se carga |
|---|---|---|
| **CLAUDE.md** (este archivo) | Lo que aplica a **todas** las sesiones: rutas, bugs del entorno, reglas de trabajo | **Siempre, completo** — cada línea cuesta |
| **`rules/*.md`** con `paths:` | Reglas por tipo de archivo (ej. Excel) | Al **leer** un archivo que matchea |
| **`docs/*.md`** | Material de consulta con ruta explícita | Solo si se lee — cuesta 0 hasta entonces |
| **Memoria** · `projects/<proyecto>/memory/` | Contexto de **un** proyecto: estado, acuerdos, dónde quedó algo | Al trabajar en **esa carpeta** |
| **Skill** · `~/.claude/skills/` | Un **procedimiento** repetible, con sus scripts | Cuando la tarea lo dispara |
| **Hook** · `settings.json` | Lo que **no puede fallar nunca** | Siempre — es determinista, no advisory |

**Regla de oro: si es específico de un cliente o campaña, NO va en este archivo.**
**Y si no puede fallar nunca, no va en prosa: va en un hook.**

> Cómo escribir una memoria, qué hacer al rebasar el presupuesto, y los 3 límites de `paths:`
> (no dispara al escribir · no carga fuera del cwd · no sobrevive a `/compact`):
> **`~/.claude/docs/organizacion-conocimiento.md`**

### ⚠️ Las 3 reglas que evitan que estos archivos mientan

**1. Lo que observas le gana a lo que está escrito — y se corrige en el momento.**
Si el código o un archivo contradicen lo que dice una memoria o este CLAUDE.md: **gana la realidad**.
Corregirlo en **esa misma sesión**, no "después". *(Este archivo afirmó durante meses que Python estaba
roto; ya no lo estaba, y eso hizo que se evitaran herramientas que sí servían.)*

**2. Separar principios de estados. Nunca en el mismo párrafo.**
**Principio** (no caduca): *"F-label N = SheetJS row N+1"* — va sin fecha.
**Estado** (caduca): *"Mayo entregado ✅"* — va **con fecha** y con la advertencia de verificar.

**3. Presupuesto <200 líneas.** Antes de agregar: *"¿le sirve igual a una sesión de Unilever que a una
de la agenda personal?"* Si no → memoria, regla o skill. Al mover: **no mutilar contenido bueno para
cuadrar el número** — el detalle va a `rules/` o `docs/`, nunca a la basura.

### Reglas y docs activos
| Archivo | Cuándo entra |
|---|---|
| `rules/excel-hojas-de-calculo.md` | Al tocar `.xlsx` · `.xlsm` · `.xls` · `.csv` |
| `docs/entorno-local.md` | Paquetes, instalación, pdf-parse, ffmpeg/pac |
| `docs/mcp-config.md` | Configs de MCP, servidores propios, conectores |
| `docs/organizacion-conocimiento.md` | Cómo escribir memorias y mover contenido |

---

## Herramientas locales

> Detalle completo (paquetes instalados, cómo instalar, ffmpeg/pac/whisper, patrón de pdf-parse):
> **`~/.claude/docs/entorno-local.md`** — léelo cuando lo necesites, no carga solo.

```
PYTHON  C:\Users\Ricardo.Aguilar\AppData\Local\Programs\Python\Python313\python.exe
NODE    C:\Users\Ricardo.Aguilar\.claude\tools\node\node.exe
NPM     C:\Users\Ricardo.Aguilar\.claude\tools\node\npm.cmd
MODULES C:\Users\Ricardo.Aguilar\.claude\tools\node_modules        ($NODE_PATH)
FFMPEG  C:\Users\Ricardo.Aguilar\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-essentials_build\bin\ffmpeg.exe
```
⚠️ El folder de ffmpeg queda en PATH pero el binario adentro puede desaparecer solo (pasó 13→17-sep-2026,
reinstalado). No asumir que "está en PATH" = "corre": **usar la ruta completa de arriba**, y si falla,
verificar con `-version` antes de repetir el diagnóstico viejo.

### 🔑 Claves de API — disponibles en TODA sesión
Viven en `~/CLV-RICK-TKS.txt`, **fuera de todo repo** (`~/.claude/` y `tools/` son repos y
`settings.json` **sí** se versiona → las claves nunca van ahí). Hoy: `YOUTUBE` · `ELEVENLABS` ·
`CLOUDFLARE_ACCOUNT_ID` · `CLOUDFLARE_TOKEN` · `APIFY_TOKEN`.
```
node ~/.claude/tools/clave.js --lista     qué hay (enmascarado)
node ~/.claude/tools/clave.js --probar    las prueba con llamadas REALES
node ~/.claude/tools/clave.js YOUTUBE     imprime una, para capturarla en variable
```
**Nunca pegar ni imprimir una clave completa en el chat** — el transcript se guarda en disco.

### ⚠️ Los paquetes de Python se corrompen solos — y el síntoma engaña
Se vuelven **namespace packages vacíos**: `import pandas` pasa sin error aunque esté hueco, y la
dependencia rota tumba a las que la usan. **Para declarar que algo sirve, ÚSALO — no lo cargues:**
`len(pandas.DataFrame({'a':[1]}))`, no `import pandas`. Reparar:
`$PYTHON -m pip install <paquete> --force-reinstall`. (Aplica igual a Node.)

### ⚠️ Nunca hardcodear el username en rutas
```javascript
const BASE = require('os').homedir() + '\\OneDrive - OneWorkplace\\...';   // JS
```
```python
from pathlib import Path
BASE = Path.home() / r"OneDrive - OneWorkplace\..."                          # Python
```
```powershell
$tmp = "$env:USERPROFILE\_tmp.xlsx"    # PowerShell — ⚠️ comillas DOBLES
$tmp = '$env:USERPROFILE\_tmp.xlsx'    # ✗ ROTO: las simples NO interpolan
```
Patrón portable de require en scripts de skills:
```javascript
process.env.NODE_PATH = require('os').homedir() + '/.claude/tools/node_modules';
require('module').Module._initPaths();
const XLSX = require('xlsx');
```

### 🔒 Respaldo en git
Son repos locales (rama `main`): `~/.claude/` (CLAUDE.md, rules, settings, memorias) ·
`skills/` · `tools/` · `agents/` · `rick-copies/` · `crm-reporte-doctrina/`.
Tres skills perdieron sus scripts por sesiones paralelas que los borraron con `rm` (que NO pasa por
la papelera). Fuera de git: binarios, `.env` con credenciales, transcripts.
- Tras cambiar algo: `cd <repo> && git add -A && git commit -m "..."`
- Restaurar **solo los archivos borrados** (`git checkout -- <archivo>`).
  ⚠️ `git checkout -- .` destruye el trabajo modificado sin commitear.
- **Evitar dos sesiones de Claude Code editando el mismo `.claude` a la vez.**
- Rescate sin git: los transcripts en `~/.claude/projects/**/*.jsonl` guardan cada Write.

### Notas Windows
- LibreOffice NO disponible → validar PPTX con python-pptx
- En bash usar forward slashes (`/c/Users/...`); `$NODE`/`$NPM` NO resuelven → ruta completa
- ⚠️ Git Bash **reescribe todo argumento que empiece con `/`** a ruta Windows (`/ssot/x` → `C:/Program Files/Git/ssot/x`)
  al pasarlo a `node.exe`/`python.exe`. Una ruta de API por argv da **404 falso** sin error visible.
  → `export MSYS_NO_PATHCONV=1` antes del comando (costó 5 diagnósticos falsos el 28-sep-2026).

---

## Bugs conocidos y patrones (NO repetir)

**NO escribir JSON con PowerShell** — `Set-Content -Encoding UTF8` mete **BOM** (JSON inválido) y el
round-trip `ConvertFrom-Json | ConvertTo-Json` **doble-codifica acentos** (`Librería`→`LibrerÃ­a`).
Usar **Node**; verificar después: primer byte `123` (`{`) y que no aparezcan `Ã`/`Â`.
Si toca PowerShell: `[System.IO.File]::WriteAllText($p,$json,(New-Object System.Text.UTF8Encoding($false)))`.
En `.ps1` tampoco poner acentos ni guiones largos en literales (rompen el parser); resolver rutas con
acento por comodín (`Where-Object { $_.Name -like 'Marketing Automation Kinesso*' }`).

**NUNCA backticks en un mensaje de `git commit` desde bash.** Bash los ejecuta como comandos
DENTRO del mensaje. Escribir ``el bloque publica `envios` con...`` corrió `envios` como comando y
**borró 109 archivos del working tree**. Se recuperaron enteros porque el commit ya había pasado
(`git checkout -- <archivo>` uno por uno, **nunca `git checkout -- .`**). Para citar código en un
mensaje de commit: comillas simples o nada.

**Los backslashes se pierden al pasar JS por una capa de shell.** Dos síntomas del mismo problema:
- `node -e`: `NODE_PATH` + `_initPaths()` no resuelve módulos → usar siempre archivos `.js`.
- **Heredoc del tool Bash** (`cat > x.js <<'EOF'`): colapsa `\\`→`\` **aunque el delimitador esté
  entrecomillado**. Un patrón JS `'Downloads\\Claud'` llega como `'Downloads\Claud'` = `DownloadsClaud`,
  y `\n` se vuelve salto de línea. **Falla en silencio: reemplaza 0 y no marca error.**

**Para escribir un `.js`: usar el tool Write, no heredoc.** Si un literal lleva rutas Windows,
construirlo con `String.fromCharCode(92)` y **imprimir el patrón antes de usarlo** para confirmarlo.

**pdf-parse v2.4.5** — el export es una CLASE y el buffer va en el
constructor; el método es `getText()`, no `parse()`. Patrón completo en `~/.claude/docs/entorno-local.md`.

---

## Excel / hojas de cálculo

> ⚠️ **El detalle completo vive en `~/.claude/rules/excel-hojas-de-calculo.md`** — se carga solo al
> tocar un `.xlsx`/`.xlsm`/`.csv`. **Pero NO carga si el archivo está fuera de la carpeta donde
> abriste la sesión** (el caso normal con OneDrive) → si vas a manipular Excel desde un script sin
> abrir el archivo, **lee ese archivo de reglas primero**.
> Red de seguridad: dos hooks (`hook-xlsx-protocolo.js` antes de escribir, `hook-xlsx-vigilar.js`
> después) inyectan y verifican esto solos. Son deterministas; lo de aquí es el recordatorio.

### 🔴 REGLA 0 — NO escribas un `.js` desde cero para tocar un Excel
Usa las herramientas: `xlsx-q.js` (leer/auditar) · `xlsx-apply.js` (escribir declarativo) ·
`xlsx-kit.js` (cuando hace falta lógica). Direccionan por **NOMBRE de encabezado**, no por letra.
Antes de usar una ruta, **resuélvela**: `node ~/.claude/tools/find-file.js "<patrón>" --ext xlsx`
(se renombran seguido y las rutas escritas mueren).

### 🔴 Después de CADA escritura — las CUATRO, en este orden
```
node ~/.claude/tools/xlsx-safe-save.js <archivo>          # repara el paquete OPC (valida ANTES de escribir)
node ~/.claude/tools/xlsx-label.js <archivo>              # restaura la etiqueta Purview (cumplimiento)
node ~/.claude/tools/xlsx-check.js <archivo>              # evita que Excel lo "repare"
$PYTHON ~/.claude/tools/xlsx-validar-fondo.py <archivo>   # 🔴 EL QUE NO SE SALTA
```
**Sin las 4, NO digas que quedó bien.** Son la evidencia que le reportas al usuario.

### 🔴 Las 4 reglas que NO se negocian
1. **Fórmulas sin verificar, no se entregan.** Por COM: `CalculateFullRebuild` + `SpecialCells(-4123,16)` → 0 errores.
2. **Edita el XML con `adm-zip`, no con exceljs** (su round-trip degrada el archivo). En fórmulas escribe siempre `result`.
3. **MÍRALO antes de decir "quedó bien":** `$PYTHON ~/.claude/tools/xlsx-render.py <archivo> <out.png>` da un PNG real
   (ahí se ve el texto cortado). Si no renderizaste, di **qué validaste y qué no**.
4. **"No se guardó" puede no ser tuyo:** en SharePoint alguien co-edita en paralelo y pisa sin dejar rastro.
   ⚠️ OneDrive **no** crea archivos `~$` → buscarlos da falsos negativos. Compara `mtime` antes/después
   y revisa `docProps/app.xml`: si dice *Excel Online*, escribió alguien más.

⚠️ Ante un "me sale roto", antes de teorizar: **lee `%TEMP%\error*.xml`** (filtra por el nombre del archivo).

---

## MCP y conectores

> Detalle (tabla de configs, servidores propios, logs, conectores de la cuenta):
> **`~/.claude/docs/mcp-config.md`**

- **Los MCP se cargan al INICIAR.** Editar la config con la app abierta no surte efecto → **reiniciar**.
- Config que SÍ se lee: `~/.claude.json` (Claude Code) y `%APPDATA%\Claude\claude_desktop_config.json`
  (Desktop). ⚠️ `~/.claude/mcp.json` **no lo lee nadie** — archivo trampa.
- Los servidores propios van en ruta **LOCAL** (`~/.claude/tools/_mcp-*`), nunca en OneDrive.

---

> *La lista de skills disponibles la inyecta Claude Code sola en cada sesión — no se documenta aquí
> para que no se desactualice. Los propios viven en `~/.claude/skills/` (repo git).*

---

## Reglas de trabajo

### Al abrir una sesión en una carpeta
1. Si la carpeta tiene `memory/`, ahí está el contexto del proyecto — leerlo antes de proponer.
2. Si es trabajo **recurrente** (reportes, CRM mensual), revisar **dónde quedó la última entrega**
   antes de asumir el siguiente paso. Las bitácoras caducan.
3. Si algo del contexto ya no cuadra con lo que ves en disco → aplicar la regla 1 de arriba.

### Durante el trabajo
- Para tareas con 3+ pasos: escribir plan primero, confirmar, luego ejecutar.
- Siempre rutas absolutas.
- **Verificar lo que se entrega**, no solo lo que se escribe: validar el archivo generado, releer el JSON
  después de escribirlo, correr el script antes de decir que funciona.
- Si una medición y otra se contradicen, **averiguar cuál miente** antes de concluir (pasó con
  `Get-ChildItem` vs `robocopy` en OneDrive). Y fijarse **cuándo** se midió cada una.
- **Reemplazos masivos (find-replace):** distinguir lo que **apunta** a algo (ruta viva → actualizar) de lo
  que **cuenta** algo (narración histórica → dejar). Un reemplazo ciego deja frases sin sentido.
- **Preguntar antes de:** borrar más de ~100 MB, tocar archivos de cliente, o cualquier cosa difícil de
  revertir. Verificar pieza por pieza no sustituye al permiso.
- 🔴 **Rick edita los entregables a mano. LEER EL ARCHIVO ANTES DE ESCRIBIRLO, no después.**
  Si quitó filas, movió celdas o cambió textos, **fue a propósito** — no es basura por limpiar ni una
  versión atrasada por "emparejar". Antes de regenerar o sobrescribir cualquier cosa que él haya tocado:
  **diffear contra lo que hay, y si algo suyo se va a perder, AVISAR y esperar** — no repararlo por cuenta
  propia. Un script que hace `borrar hoja → recrear` destruye sus cambios sin dejar rastro.
  Diffear *después* de escribir ya no sirve: para entonces el trabajo suyo ya se perdió.
- Si algo falla o se corrige: documentarlo **donde corresponda** (ver "Qué va dónde"), no siempre aquí.
