# Instalar el kit (≈ 10 minutos)

Para quien recibe el kit y va a operar el reporte de email de su BU. No necesitas saber programar: copias una carpeta, pegas tus credenciales y corres cuatro comandos.
Los comandos van **desde la carpeta del kit** (la que contiene `scripts/` y `lib/`).

## 0. Lo que necesitas

- **Node.js 18 o más nuevo** (`node --version`). El kit **no tiene dependencias**: no hay `npm install`.
  Si en Windows `node` no se reconoce, instálalo desde nodejs.org o usa la ruta completa del ejecutable (por ejemplo `"C:\ruta\a\node.exe" scripts\doctor.js`).
- Un **Installed Package** de SFMC con los permisos del kit: `CONEXION.md` §1 te dice cómo crearlo (lo hace un administrador de la BU).
- Salida a Internet hacia `*.marketingcloudapis.com`. Windows, Mac o Linux.
- En **Windows**, la ruta completa de un archivo no puede pasar de 260 caracteres (límite del sistema): el archivo más profundo del kit mide 50 por dentro, así que **la carpeta donde lo pongas debe medir menos de ~200 caracteres**.
  Una carpeta de OneDrive o SharePoint sincronizada, con nombres largos, lo rebasa fácil: si los comandos fallan sin decir nada, ponlo en una ruta corta (`C:\Herramientas\` o `%USERPROFILE%\.claude\skills\`). Con acentos, espacios y paréntesis en la ruta funciona (se probó).

## 1. Poner el kit en tu máquina

Copia la carpeta `crm-reporte-mcp-nestle-sfmc/` a donde quieras (cumpliendo lo anterior). Para que **Claude Code** la use como skill, ponla en `~/.claude/skills/` (en Windows, `%USERPROFILE%\.claude\skills\`). El kit **no necesita escribir en su propia carpeta**: puede estar en solo lectura.
No hace falta git. Comprueba que llegó completa (no usa red; tarda unos 30 s, hasta 1 min en una máquina lenta u ocupada; deben pasar **todas** las pruebas y `fail 0`). Dos pruebas usan **bash** y **PowerShell** de verdad si los tienes; si no, las omiten y lo dicen (no son fallas):

```bash
node --test
```

## 2. Conectar

Sigue `CONEXION.md` (crear el package, guardar sus tres datos en `conexion.txt` **fuera de OneDrive y de cualquier repo**) y comprueba:

```bash
node scripts/conectar.js
```

Debe terminar con **"✓ Conexión lista"** y decirte qué credencial usarán los demás scripts. Si no, la tabla de `CONEXION.md` §6 traduce cada mensaje.

## 3. Descubrir tu BU

```bash
node scripts/descubrir.js --dry-run     # muestra lo que encontraría; no escribe nada
node scripts/descubrir.js               # genera tu config local (imprime su ruta)
```

Busca **por nombre** las 6 tablas, las 5 queries y la automation del reporte, y apunta sus IDs en tu **config local** (`pipeline.config.json`, en la carpeta de estado `%LOCALAPPDATA%\crm-reporte-mcp-nestle-sfmc\`, **fuera** de la carpeta del kit; `conectar.js` y `doctor.js` imprimen la ruta exacta).
Solo lee de SFMC y el archivo no lleva secretos. Es idempotente: correrlo de nuevo solo actualiza lo que cambió.
El kit **opera un reporte que ya existe** en tu BU: no crea las tablas ni las queries. Si tu BU no las tiene, pídele a quien administra el reporte que las cree (`ARQUITECTURA.md` §7).
Cada línea debe salir con ✓.

- **"no existe en esta BU"**: tu BU nombra distinto o aún no tiene el reporte. Copia `config/pipeline.config.example.json` a la ruta de tu config local (la que imprime `conectar.js`), cambia los `nombre` por los de tu BU (los nombres son el contrato; los IDs los llena el script) y vuelve a correrlo.
- **"está DUPLICADA"**: hay dos objetos con el mismo nombre; renombra o borra el que sobre.
- **Zona horaria**: la config asume la de la cuenta de Nestlé (`bu.offsetUtcHoras: -6`, sin horario de verano). Si tu BU es otra, ajústala: de ella depende cuándo se considera "reciente" una corrida.
- Otra ubicación: `SFMC_PIPELINE_CONFIG` (solo la config) o `SFMC_PIPELINE_DIR` (toda la carpeta de estado). Nunca dentro de la carpeta del kit: el kit se niega a escribir ahí.

## 4. Revisión de salud

```bash
node scripts/doctor.js
```

Debe terminar con **"✓ sin fallas"**. Un ⚠️ no bloquea pero léelo (lo típico: dos packages distintos en dos fuentes de credenciales, o una automation que hace más de 36 h que no corre). Qué mira cada línea: `PROCESOS.md` §5.

## 5. Primera lectura (no cambia nada del reporte)

```bash
node scripts/resolver-emailname.js "<un fragmento del nombre de un email>"
node scripts/snapshot.js
```

La primera te enseña el flujo central (el **EmailName real** de un envío, `PROCESOS.md` §1; usa una tabla y una consulta temporales `CRM_Tmp_*` que se borran solas y tarda de 30 a 90 s); la segunda guarda una foto de la arquitectura en la carpeta de fotos de tu estado local (imprime la ruta). Desde aquí, el día a día está en `SKILL.md` y `PROCESOS.md`.

## 6. Qué se guarda en tu máquina

| Dónde | Qué es | ¿Se comparte? |
|---|---|---|
| `conexion.txt` (`%LOCALAPPDATA%\sfmc-mcp\`) | tu secret | 🔴 **Nunca** |
| `pipeline.config.json` (carpeta de estado local) | los IDs de tu BU (sin secretos) | No: es de tu BU |
| `snapshot\*.json` (carpeta de estado local) | fotos de la arquitectura; con `--con-datos` traen **filas del cliente** | 🔴 **Nunca** |
| la carpeta del kit | código, docs y pruebas: **nada local** | Sí |

La carpeta de estado es `%LOCALAPPDATA%\crm-reporte-mcp-nestle-sfmc\` (Mac y Linux: `~/.local/share/crm-reporte-mcp-nestle-sfmc/`): fuera del kit, de OneDrive y de la carpeta de credenciales. Que el kit no guarde nada local en su carpeta es a propósito: esa carpeta se copia, se comprime y la barren otras herramientas.
Si venías de una versión anterior que guardaba `config/pipeline.config.json` y `snapshot/` dentro del kit, `doctor.js` te avisa y te dice a dónde moverlos.

## 7. Compartir el kit con otra persona (sin secretos ni datos)

La carpeta del kit **no guarda nada local** (ni claves, ni config, ni fotos: viven fuera, §6), así que se puede copiar, comprimir o sincronizar tal cual. Aun así el paquete se arma desde git, para que sea exactamente un commit: git no incluye `conexion*.txt`, `.env`, `*.secret` ni `*.pem` (el `.gitignore` del kit los excluye).
Para armarlo desde el repositorio donde vive el kit (por ejemplo `~/.claude/skills`; en PowerShell `cd $HOME\.claude\skills`), sin copiar carpetas a mano:

```bash
cd ~/.claude/skills
git archive --format=zip --prefix=crm-reporte-mcp-nestle-sfmc/ -o crm-reporte-mcp-nestle-sfmc.zip HEAD:crm-reporte-mcp-nestle-sfmc
```

El zip trae el código, los docs, las pruebas y una **foto de referencia de la estructura** (`tests/fixtures/`: nombres, IDs y SQL de la BU de Nestlé; **sin credenciales ni filas de datos**).
Quien lo reciba repite esta guía desde el paso 1 con **su propio** package: nunca se comparte el secret.
**Sin git** (si instalaste copiando la carpeta): comprime la carpeta del kit tal cual; `doctor.js` te avisa si quedaron restos locales dentro (de una versión anterior o de un archivo de claves pegado por error), y esos restos no deben viajar.

## 8. Actualizar y desinstalar

- **Actualizar**: reemplaza la carpeta del kit **completa** por la nueva: tu config, tus fotos y tus claves viven fuera de ella y no se tocan. Luego `node --test` y `node scripts/doctor.js`.
  Si la versión nueva agrega algo a la config, `node scripts/descubrir.js` lo completa.
- **Desinstalar**: borra la carpeta del kit, tu `conexion.txt` y la carpeta de estado local. Si ya no usarás ese Installed Package, bórralo también en SFMC (Setup → Installed Packages).

## 9. Si la instalación no avanza

| Lo que ves | Qué hacer |
|---|---|
| `node` no se reconoce | instala Node.js 18+ o usa la ruta completa del ejecutable |
| `node --test` dice `bad option: --test` o las pruebas ni arrancan | tu Node es anterior a 18: actualízalo |
| `No existe la config de esta instalación` | corre `node scripts/descubrir.js` (necesita credenciales: paso 2) |
| `Config inválida …` | el JSON de la config está mal formado o un objeto se llama `CRM_Tmp_…`; vuelve a generarla con `descubrir.js` |
| `descubrir.js` o `doctor.js` dicen que no conectan | `node scripts/conectar.js` y `CONEXION.md` §6 |
| Todo conecta pero `doctor.js` marca `Esquema de las DEs` | a esas tablas les falta una columna que el kit necesita: el mensaje dice cuál |
