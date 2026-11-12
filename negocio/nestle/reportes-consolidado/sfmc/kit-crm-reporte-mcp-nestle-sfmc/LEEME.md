# crm-reporte-mcp-nestle-sfmc — el reporte de email de Nestlé en SFMC (kit portable)

Los scripts, las pruebas y las guías con las que cualquier persona del equipo opera el reporte de **email** de Nestlé en Salesforce Marketing Cloud (BU `NMX - Nestle Mexico`) bajo los mismos procesos.
Es el *lado SFMC* del sistema `crm-reporte-*`: mantiene las tablas `CRM_Email_Detalle`, `CRM_Email_Piezas`, `CRM_Reporte_Auditoria` y `CRM_Email_Links`, de las que lee `crm-reporte-fuentes-email`.
Está escrito para alguien del equipo Martech: no hace falta saber programar, solo copiar una carpeta, pegar las credenciales propias y correr cuatro comandos.

---

## 1 · Dónde vive cada cosa

| Qué | Dónde | Notas |
|---|---|---|
| **El kit** (código, guías y pruebas) | esta carpeta, `crm-reporte-mcp-nestle-sfmc\` | **Solo código y guías: nada local se guarda aquí.** Se puede copiar, comprimir o sincronizar sin llevarse datos de nadie |
| **Copia de trabajo** (con git y respaldo) | `~/.claude/skills/crm-reporte-mcp-nestle-sfmc/` | La usa Claude Code como skill. Aquí se cambia el kit |
| **Copia ordenada para leer y compartir** | `CRM General\crm-reporte-mcp-nestle-sfmc\` (SharePoint) | La regenera quien mantiene el kit, desde un commit. Si cambias algo ahí, no se propaga |
| 🔑 **Archivo de claves** | `%LOCALAPPDATA%\sfmc-mcp\conexion.txt` | **Fuera de OneDrive, de SharePoint y de esta carpeta, a propósito.** Lo edita cada persona; el kit solo lo lee (sección 4) |
| **Estado local** (config con los IDs de tu BU y fotos de la arquitectura) | `%LOCALAPPDATA%\crm-reporte-mcp-nestle-sfmc\` | Lo crea el kit al usarlo. No lleva claves; las fotos con `--con-datos` traen filas del cliente: no se comparten. `SFMC_PIPELINE_DIR` lo mueve |

En Mac y Linux: las claves en `~/.config/sfmc-mcp/` y el estado local en `~/.local/share/crm-reporte-mcp-nestle-sfmc/`.
Dentro del kit: `SKILL.md` (reglas duras y qué comando usar) · `docs\` (guías) · `scripts\` (los comandos) · `lib\` (el núcleo) · `tests\` (las pruebas) · `config\` (solo la plantilla de ejemplo).

---

## 2 · Cómo quedó portable

- **Sin rutas con usuario ni IDs "pegados"**: el kit encuentra las tablas, las queries y la automation **por nombre** y guarda los IDs de cada BU en su propio estado local (`descubrir.js`).
- **Credenciales por tres fuentes** (variables de entorno → `~/.claude.json` → `conexion.txt`): el kit las prueba con un token real y dice cuál va a usar.
- **Sin dependencias**: solo Node.js 18 o más nuevo. Se instala copiando la carpeta.
- **Ni la config ni las fotos viven en la carpeta del kit**: así otras herramientas pueden copiarla entera (por ejemplo, la que lleva el sistema de reportes a SharePoint) sin llevarse nada local. `doctor.js` avisa si encuentra restos ahí.
- **Las reglas de seguridad son código, no promesas**: solo escribe en los objetos del reporte, nunca escribe ni borra `conexion.txt`, nunca imprime un secret y no reintenta una escritura a ciegas (la envía una sola vez; solo la repite si el token venció). Detalle en `docs\SEGURIDAD.md`.
- **Pruebas que no usan red** (unas 360; de 10 a 30 s) y un chequeo de salud (`doctor.js`).
- Probado desde una **instalación limpia** (carpeta recién copiada, usuario sin nada configurado), contra SFMC real, con credenciales por variables de entorno y con solo `conexion.txt`.

---

## 3 · Instalar en otra máquina (≈ 10 minutos)

1. Instala **Node.js 18 o más nuevo** (`node --version`).
2. **Copia** la carpeta `crm-reporte-mcp-nestle-sfmc` a tu equipo. Para usarla con Claude Code, a `%USERPROFILE%\.claude\skills\`.
   Si la copiaste de SharePoint, pásala a tu máquina antes de usarla: córrela desde tu disco, no desde la carpeta compartida.
3. Crea **tu propio Installed Package** en SFMC y guarda sus tres datos en tu `conexion.txt` (`docs\CONEXION.md`).
4. Desde la carpeta del kit:

```bash
node --test                      # el kit llegó completo (todas las pruebas pasan, fail 0)
node scripts/conectar.js         # prueba tus credenciales: debe decir "Conexión lista"
node scripts/descubrir.js        # genera tu config con los IDs de TU BU (solo lee de SFMC)
node scripts/doctor.js           # chequeo de salud: debe decir "sin fallas"
```

La guía completa, con lo que hacer si algo no avanza: `docs\INSTALAR.md`.

---

## 4 · 🔑 El archivo de claves

- **El archivo es `conexion.txt`**, en `%LOCALAPPDATA%\sfmc-mcp\`. Lleva tres datos del Installed Package: **Client Id**, **Client Secret** y **Authentication Base URI** (el MID es opcional). Cada persona tiene el suyo.
- **Cómo se actualiza** (al rotar un secret o al cambiar de package): copia los datos del Installed Package con el ícono *Copy* (el secret solo se ve al crearlo), pégalos en `conexion.txt` y corre `node scripts/conectar.js`: debe decir "Conexión lista".
  Según la experiencia del equipo, un secret nuevo queda en *Staged* y **no autentica hasta que se promueve a *Active***.
- **Si además usas el servidor MCP de SFMC en Claude Code**, ese servidor guarda sus propias claves en `~/.claude.json` (otra copia de lo mismo): al rotar, actualiza **los dos** y reinicia Claude Code. `node scripts/conectar.js` te avisa si los dos tienen packages distintos.
- 🔴 **Las claves nunca van en esta carpeta, ni en SharePoint, ni en un chat, ni en git.** Si una clave se pegó en un lugar así, ya no es secreta: se rota (`docs\CONEXION.md` §7). El kit **no puede** escribir ni borrar `conexion.txt`.
- No confundir: `~/.claves-api.txt` (y `clave.js`) es **otro** archivo, el de YouTube, ElevenLabs, Cloudflare y Apify. SFMC no usa ese.

---

## 5 · El día a día

```bash
node scripts/resolver-emailname.js "<fragmento del nombre>"        # el EmailName REAL de un envío (nunca el código del asset del brief)
node scripts/agregar-pieza.js --email-name "<EXACTO>" --marca "…" --campana "…" --touchpoint "…"      # simulacro; con --escribir inserta
node scripts/refrescar-pieza.js --email-name "<EXACTO>"            # corre las queries del reporte y confirma que la pieza aterrizó (≈ 9–18 min)
node scripts/doctor.js                                             # chequeo de salud
```

Tres reglas que no se negocian (todas en `SKILL.md`):

1. **La identidad de una pieza es el `EmailName` exacto de `_Job`.** Un nombre con sufijo ` - AAAAMM` es otro envío.
2. **No refrescar a mano de 23:48 a 00:40** (la automation corre a las 00:08, hora Central): el script se niega solo.
3. **No hay `PiezaID`**: la columna se eliminó el 22-oct-2026 (pedido de Rick); el kit nunca inventa números de pieza.

Todo lo demás: `docs\PROCESOS.md` (los procesos paso a paso) y `docs\ARQUITECTURA.md` (cómo está construido el reporte y por qué).

---

## 6 · Qué está verificado y qué no

- **Verificado en vivo** (2-oct-2026; BU NMX; Windows; Node 24): instalación limpia; conectar, descubrir, doctor, resolver y foto de la arquitectura; alta de una pieza (simulacro y rechazo de duplicado); y el refresco **real** de una pieza nueva, que aterrizó en las cuatro tablas del reporte.
- **No verificado**: los pasos de la pantalla de SFMC para crear el Installed Package (vienen de la documentación oficial de Salesforce); Mac y Linux; Node 18; otra BU u otro tenant; `cmd.exe`; el bloqueo cuando la automation está corriendo (solo simulado).
- **Lo que el kit NO hace**: crear las tablas o las queries del reporte (opera un reporte que ya existe; la única excepción es la tabla opcional de clicks con fecha, `scripts/instalar-links-dia.js`), cambiar pasos u horario de la automation del reporte, ni corregir o borrar filas del catálogo.

---

## 7 · Migración a `EmailName` como llave (pendiente)

Está **planeada y documentada, pero no ejecutada**: `docs\MIGRACION-EMAILNAME-PK.md`. Necesita antes: la decisión sobre los lectores de `ConfigKey`, una fecha fuera de 23:48–00:40
y las herramientas de migración, que todavía no existen. Mientras tanto el kit funciona igual: detecta solo con qué llave está la tabla (`ConfigKey` hoy, `EmailName` después).

---

## ⚠️ Si esta carpeta está en un SharePoint compartido con el cliente

El código y las guías se pueden compartir; **las llaves no**. Aquí no hay `conexion.txt`, ni config local, ni fotos: todo eso vive fuera de la carpeta del kit, en la máquina de cada persona.
