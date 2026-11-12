# Entorno local — detalle de referencia

> Material de **consulta**, no de instrucción. CLAUDE.md guarda las rutas y las reglas que cambian
> el comportamiento; aquí vive el detalle que se busca cuando hace falta.
> Ruta de este archivo: `~/.claude/docs/entorno-local.md`

## Python 3.13

```
C:\Users\Ricardo.Aguilar\AppData\Local\Programs\Python\Python313\python.exe
```
Variable: `$PYTHON`

Instalados: `numpy`, `pandas`, `openpyxl`, `python-pptx`, `python-docx`, `pdfplumber`, `pypdf`, `Pillow`,
`matplotlib`, `plotly`, `kaleido`, `reportlab`, `lxml`, `requests`, `beautifulsoup4`, `gspread`,
`google-api-python-client`, `jinja2`, `python-dotenv`, `pywin32` (Excel COM), `markitdown[pptx]`, `simplejson`.

### ⚠️ Esta instalación se corrompe sola — y el síntoma engaña

Los paquetes se vuelven **namespace packages vacíos** cada tanto (van 7 en una semana, incluido `pandas`).
Cuando pasa, **la dependencia rota tumba a las que la usan**: `simplejson`→`requests`,
`cssselect2`→`weasyprint`, `lxml`→`python-docx`/`python-pptx`.

**🔴 Verificar mal da FALSOS POSITIVOS. Hay 3 capas y solo la última es fiable:**
```python
import pandas                     # ❌ inútil: un namespace vacío importa sin error
from pandas import DataFrame      # ⚠️ mejor, pero un SUBMÓDULO hueco también pasa
                                  #    (plotly.graph_objects importaba y NO tenía .Figure)
len(pandas.DataFrame({'a':[1]}))  # ✅ USARLO: la única prueba que no miente
```
Lo mismo aplica a Node: `require('pdf-parse')` pasaba, pero instanciarlo tronaba.
**Reparar:** `$PYTHON -m pip install <paquete> --force-reinstall` (arregla el 100% de los
"unknown location"). **No mantengas una lista de "verificados"**: caduca en días.

**Excepción que pip NO arregla — `weasyprint`:** falla con `OSError: cannot load library
'libgobject-2.0-0'`. Le faltan las librerías nativas **GTK/Pango**, que necesitan instalador de
sistema (y Rick no es admin). Reinstalarlo no sirve. **Para PDFs usar `reportlab`** (verificado).

## Node.js 24 (portable)

```
C:\Users\Ricardo.Aguilar\.claude\tools\node\node.exe
C:\Users\Ricardo.Aguilar\.claude\tools\node\npm.cmd
```
Variables: `$NODE`, `$NPM`

### Paquetes compartidos
Ruta: `C:\Users\Ricardo.Aguilar\.claude\tools\node_modules` · Variable: `$NODE_PATH`

Verificados funcionando (21-jul-2026): `xlsx` (SheetJS), `xlsx-js-style`, `exceljs`, `docx`,
`pptxgenjs`, `pdf-parse`, `adm-zip`, `sharp`, `papaparse`, `lodash`, `dayjs`, `axios`, `cheerio`,
`@napi-rs/canvas`. No instalado: `chartjs-node-canvas`.

- `xlsx` (SheetJS) — la opción por defecto para leer/escribir Excel.
- `adm-zip` — manipula el XML interno de .xlsx/.docx preservando estilos. **Dependencia CRÍTICA** de
  `rick-copies-workbook` (`xml_write_cells.js`, `xml_add_rows.js`, `xml_clone_molde.js`,
  `xml_clonar_formato.js`, `xml_dump_estructura.js`). No desinstalar.

Instalar paquetes nuevos (quedan disponibles en todas las sesiones):
```
"C:/Users/Ricardo.Aguilar/.claude/tools/node/npm.cmd" install <paquete> --prefix C:/Users/Ricardo.Aguilar/.claude/tools
```

## Otras herramientas

- **ffmpeg**: instalado por **winget** (`Gyan.FFmpeg.Essentials`) — mejor reputacion/ubicacion ante SentinelOne que el build extraido a mano. Los scripts lo resuelven solos (glob a `AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg*`). Actualizar con `winget upgrade`. Modelo whisper en `~/.claude/tools/whisper-small-model/`
- **PowerPlatform CLI**: `~/.claude/tools/pac2/cli/tools/pac.exe` (el que funciona)
- **MCP propios**: `~/.claude/tools/_mcp-sfmc` y `~/.claude/tools/_mcp-asana` — ver
  `~/.claude/docs/mcp-config.md`

## pdf-parse v2.4.5 — el export es una CLASE, el buffer va en el constructor

Verificado 21-jul-2026 contra un PDF real. El patrón anterior (`new PDFParse()` + `.parse()`) **falla**
con `Cannot read properties of undefined (reading 'verbosity')`.

```javascript
const { PDFParse } = require(require('os').homedir()+'/.claude/tools/node_modules/pdf-parse/dist/pdf-parse/cjs/index.cjs');
const p = new PDFParse({ data: fs.readFileSync(ruta) });   // el buffer va AQUÍ
const r = await p.getText();                                // getText(), NO parse()
console.log(r.text);
await p.destroy();
```
Otros métodos: `getInfo`, `getPageText`, `getHyperlinks`, `getPageLinks`, `load`.

## Notas Windows

- LibreOffice NO disponible → validar PPTX con python-pptx
- En bash usar forward slashes (`/c/Users/...`); `$NODE`/`$NPM` NO resuelven → usar ruta completa
- Para npm en bash: exportar primero el PATH de la carpeta portable de Node
