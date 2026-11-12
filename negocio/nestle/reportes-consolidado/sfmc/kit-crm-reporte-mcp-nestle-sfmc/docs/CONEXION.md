# Cómo conectarse a SFMC (Installed Package, `conexion.txt`, MID)

Para qué: que este kit pueda leer y operar **solo el reporte de email** de tu Business Unit (BU). No necesitas saber programar.
Al terminar, `node scripts/conectar.js` debe decirte **"✓ Conexión lista"**.

> 🔴 Reglas de oro: el *secret* (la "contraseña" del package) **nunca** se pega en un chat, un correo ni un ticket, y **nunca** se guarda dentro de una carpeta
> de OneDrive o de un repositorio git. Vive en un archivo local que **solo tú editas**; el kit únicamente lo **lee** (jamás lo escribe ni lo borra).

## 1. Crear el Installed Package (una sola vez, por BU)

En Marketing Cloud, con un usuario administrador de la BU:

1. **Setup → Apps → Installed Packages → New**. Ponle un nombre claro (por ejemplo `Reporte Email - <tu nombre>`).
2. En **Components**: **Add Component → API Integration → Server-to-Server**.
3. En la lista de permisos (**Scopes**) marca exactamente los siguientes; el resto déjalos sin marcar. En pantalla aparecen por grupo
   (**Data Extensions**, **Automations**, **Journeys**); en el token de SFMC se ven con el nombre de la segunda columna:

| Scope | En la pantalla de SFMC | Para qué lo usa el kit | ¿Obligatorio? |
|---|---|---|---|
| `data_extensions_read` | Data Extensions → **Read** | leer las tablas del reporte, el catálogo y `_Job` | sí |
| `data_extensions_write` | Data Extensions → **Write** | escribir filas en el catálogo y crear/borrar tablas **temporales** `CRM_Tmp_*` | sí |
| `automations_read` | Automations → **Read** | leer la automation y sus queries | sí |
| `automations_write` | Automations → **Write** | crear queries temporales y (solo si lo pides) regenerar el SQL de la query Vol | sí |
| `automations_execute` | Automations → **Execute** | iniciar las queries del reporte al refrescar una pieza | sí |
| `journeys_read` | Journeys → **Read** | resolver journey → tabla de audiencia (`audiencias.js`) | opcional |

4. **Save**. En los detalles del componente aparecen los **tres datos** que necesitas:
   **Client Id**, **Client Secret** y **Authentication Base URI** (empieza con `https://mc…` y termina en `.auth.marketingcloudapis.com/`).
   🔴 **El Client Secret solo se puede ver al crear el componente** (después ya no): cópialo y guárdalo en `conexion.txt` **en ese momento**.
   Si lo pierdes, no se recupera: hay que generar un secret nuevo (sección 7).
5. Confirma que el package está instalado **en la BU del reporte** (NMX). El **MID** (identificador numérico de la BU) es opcional: si no lo pones, el kit lo descubre solo.

> **Si no eres administrador de la BU**: pídele a quien lo sea que cree **tu propio** package (uno por persona; así se puede revocar el de cada quien) y que te entregue el secret por el **gestor de contraseñas** de tu organización,
> nunca por chat, correo ni ticket. Si te pasan un secret por un canal inseguro, trátalo como expuesto y pide uno nuevo (sección 7).

> Fuente de estos pasos y de los nombres de los permisos: la documentación oficial de Salesforce
> ([Create and Install Packages](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/install-packages.html),
> [API Integration](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/api-integration.html),
> [API Integration Permission Scopes](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/data-access-permissions.html)),
> consultada el 2-oct-2026. SFMC cambia su pantalla de vez en cuando: si un nombre no coincide, manda el de la documentación.

## 2. Dónde va el archivo `conexion.txt`

| Sistema | Ruta |
|---|---|
| Windows | `%LOCALAPPDATA%\sfmc-mcp\conexion.txt` |
| Mac / Linux | `~/.config/sfmc-mcp/conexion.txt` (o `$XDG_CONFIG_HOME/sfmc-mcp/conexion.txt`) |
| Otra carpeta | define la variable `SFMC_CONEXION_DIR` con la carpeta que prefieras |

Crea la carpeta si no existe. **Fuera de OneDrive (y de iCloud, Dropbox, Google Drive o cualquier carpeta sincronizada) y fuera de cualquier repo.** En Mac/Linux limita el acceso: `chmod 600 conexion.txt`.

## 3. Qué lleva el archivo

**Lo más fácil:** copia los tres datos del componente (con el ícono *Copy* de cada campo, no seleccionando el texto) y pégalos tal cual. Así se ve (valores de ejemplo, no reales):

```text
Client Id
xxxxxxxxxxxxxxxxxxxxxxxx

Client Secret
SFMC_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Authentication Base URI
https://mcxxxxxxxxxxxxxxxxxxxxxxxxxxxx.auth.marketingcloudapis.com/
```

**Alternativa**, una línea por dato (el MID es opcional):

```text
CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxx
CLIENT_SECRET=SFMC_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AUTH_URI=https://mcxxxxxxxxxxxxxxxxxxxxxxxxxxxx.auth.marketingcloudapis.com/
MID=1234567
```

## 4. Probar la conexión

```bash
node scripts/conectar.js
```

Prueba con un token **real** cada fuente de credenciales que encuentre (variables de entorno → `~/.claude.json` → `conexion.txt`) y te dice cuál usarán los demás scripts.
Solo lee: no escribe ningún archivo y no imprime el secret. Una salida buena se ve así:

```text
 3) conexion.txt ✓ package … · token OK · MID 1234567 (descubierto) · scopes requeridos 5/5
✓ Conexión lista. Los demás scripts usarán: conexion.txt.
```

Después: `node scripts/descubrir.js` (genera la config con los IDs de tu BU) y `node scripts/doctor.js` (revisión completa).

## 5. Otras formas de dar las credenciales (para CI o servidores)

Variables de entorno (tienen prioridad sobre los archivos): `SFMC_CLIENT_ID`, `SFMC_CLIENT_SECRET`, `SFMC_AUTH_URL` (o `SFMC_SUBDOMAIN`) y, opcional, `SFMC_ACCOUNT_ID`.
Si defines las URLs (`SFMC_AUTH_URL`, `SFMC_REST_URL`, `SFMC_SOAP_URL`) deben ser las de **tu** tenant (`https://<tenant>.auth|rest|soap.marketingcloudapis.com`) y `SFMC_SUBDOMAIN` solo el nombre del tenant (sin puntos ni "/"): con cualquier otra el kit se niega a arrancar, para no mandar tu secret a otro dominio.
Si tienes varias fuentes con packages **distintos**, fuerza una con `SFMC_FUENTE=conexion.txt` (o `env`, o `claude.json`).
`SFMC_PIPELINE_CONFIG` apunta a otro archivo de config; `SFMC_PIPELINE_DIR` a otra carpeta de estado local (config y fotos; nunca dentro de la carpeta del kit); `SFMC_CONEXION_DIR` a otra carpeta de credenciales.

## 6. Si algo sale mal

| Lo que ves | Qué significa | Qué hacer |
|---|---|---|
| `Invalid client ID` / `HTTP 401` | el package se borró o venció, o el `AUTH_URI` es de otro tenant | crea o recupera el package vigente y pega sus datos de nuevo |
| `Hay una línea que empieza con "FMC_…": se perdió la "S" inicial` | al copiar se perdió la primera letra del secret | vuelve a copiar el secret **completo** (debe empezar con `SFMC_`) |
| `El secret aparece enmascarado (*******)` | copiaste el texto oculto de la página | usa el ícono *Copy*, no selecciones el texto |
| `Hay packages DISTINTOS en varias fuentes` | tienes un package viejo en `~/.claude.json` y uno nuevo en `conexion.txt` (o al revés) | `node scripts/conectar.js` te dice cuál funciona; fuerza el bueno con `SFMC_FUENTE=…` o borra/actualiza el viejo |
| `FALTAN scopes requeridos: …` | el package conecta pero no tiene todos los permisos | edita el Installed Package en SFMC (API Integration → Edit), marca los scopes de la tabla y guarda; el secret no cambia |
| `invalid_client` sin más detalle | no distingue entre secret, client id y MID equivocados | revisa los tres; si pusiste `MID=`, comprueba que sea el de tu BU |

## 7. Si un secret se expuso o se perdió

Si se pegó en un chat, un correo o un repo, **ya no es secreto**; y si lo perdiste, SFMC no lo vuelve a mostrar. En los dos casos el arreglo es el mismo:
genera un secret nuevo en el Installed Package (o crea un componente nuevo), pégalo en `conexion.txt` y borra el viejo.
El kit no puede "des-compartir" lo que ya viajó; la rotación es el único arreglo.
