# Ciclo de conexión intermitente — Nestlé

> 🔴 **SUPERADO (2-oct-2026): no sigas este documento.** Ya no refleja cómo se conecta hoy: el `conectar.js` actual **nunca escribe ni borra `conexion.txt`** (lo dice su propia cabecera; este texto aún dice que lo borra),
> y la ruta de abajo lleva el usuario de una máquina. Cómo conectarse hoy —Installed Package, `conexion.txt`, MID, permisos, y cómo probarlo con `node scripts/conectar.js`— está en el skill
> **`crm-reporte-mcp-nestle-sfmc`** (`~/.claude/skills/crm-reporte-mcp-nestle-sfmc/docs/CONEXION.md`). Este archivo se conserva solo como historia.

> En Nestlé el acceso es intermitente **a propósito**: las credenciales no viven en
> `~/.claude.json` entre sesiones. Se ponen para trabajar y se quitan al terminar.
>
> Nestlé **no tiene FTP permitido**, así que el dato no puede salir solo de SFMC. La
> automation mantiene la DE fresca del lado de SFMC, y Rick conecta cuando quiere jalarla.

---

## Cómo queda repartido el trabajo

| Corre | Dónde | Cuándo | Necesita a Claude |
|---|---|---|---|
| La automation refresca la DE | **dentro de SFMC** | diario, 05:00 | ❌ no |
| Leer la DE y escribir el reporte | aquí | cuando Rick conecte | ✅ sí |

Eso es lo importante del diseño: **la parte que tiene que pasar todos los días no depende de
que nadie conecte nada.** Cuando Rick conecte, el dato ya está listo — solo se lee.

---

## Preparación — una sola vez

Ya hecho. Vive en `%LOCALAPPDATA%\sfmc-mcp\` — fuera de OneDrive y fuera de todo repo de git,
para que no se sincronice ni se versione por accidente.

| Archivo | Qué trae |
|---|---|
| `perfil.json` | client id, MID, tenant. **No secreto**, no cambia, se queda |
| `conexion.txt` | solo el secret. Se llena y **el script lo borra** al terminar |

---

## Conectar

**1.** Saca el Client Secret de tu gestor de contraseñas.

**2.** Ábrelo y pégalo en la línea `SECRET=`:

```
C:\Users\Ricardo.Aguilar\AppData\Local\sfmc-mcp\conexion.txt
```

**3.** Corre:

```
node ~/.claude/tools/_mcp-sfmc/conectar.js
```

El script, en este orden:
- valida la forma del secret (espacios, asteriscos, largo)
- **prueba el token contra SFMC** — si falla, no escribe nada
- escribe en `~/.claude.json` y verifica lo que quedó en disco
- **borra el secret del txt**

**4.** Reinicia Claude Code. Los MCP solo cargan al arrancar.

**5.** Verifica con una llamada real, no con `/mcp`:
```
sfmc_get_de_rows  name="CRM_Email_Performance"  maxRows=3
```

### Las guardas que trae

Cortan antes de gastar una llamada, y cada mensaje dice qué hacer:

| Si pegas… | Dice |
|---|---|
| `xqwn…nyxo5ngbc5t - 2` | *trae espacios — copiaste una etiqueta, no el valor* |
| `*******` | *copiaste el valor enmascarado* |
| algo corto | *mide N caracteres, se ve corto* |
| el secret equivocado | *no escribí nada* + el recordatorio de que `invalid_client` no distingue entre secret, client id y MID |

La primera guarda existe porque ese error se cometió **tres veces seguidas**: en la UI de SFMC
el secret sale como `*******` y debajo hay un campo `Description` que SFMC autogenera como
`<clientId> - 1`. Seleccionar la página se lleva el Description. **Hay que darle clic al ícono
de copiar.**

---

## Desconectar

```
node ~/.claude/tools/_mcp-sfmc/desconectar.js
```

Quita el servidor **completo** de `~/.claude.json` — no solo el secret, porque dejarlo a medias
produce un servidor que arranca y falla, que es ruido. Reporta qué servidores quedan y verifica
que no se llevó nada más por delante.

No toca `sfmc` (GEPP), `asana` ni `copilotstudio`.

---

## Sacar el dato sin FTP

Con FTP descartado, quedan dos vías:

**A. Export manual desde la UI.** En Email Studio → Data Extensions, seleccionar la DE y usar
*Export*. ⚠️ **Sin verificar si descarga al navegador o exige FTP** — depende del tamaño y de
la versión de la UI. `CRM_Email_Piezas` es chica (~150 filas) y tiene buena probabilidad de
bajar directo. Vale la pena probarlo una vez: si funciona, Rick no depende de nadie.

**B. Que Claude la lea y escriba el reporte.** Es la vía por defecto mientras A no se confirme.
Conectar → leer la DE → escribir a `Data_Email` → desconectar.

---

## El ciclo semanal, resumido

```
1. pegar el secret en conexion.txt
2. node conectar.js          → valida, prueba, instala, limpia el txt
3. reiniciar Claude Code
4. trabajar                  → leer la DE, escribir el reporte
5. node desconectar.js       → saca las credenciales
```

Pasos 2 y 5 son un comando cada uno. Lo demás es trabajo real.

---

## Si algo falla

| Síntoma | Casi siempre es |
|---|---|
| `invalid_client` | El MID antes que el secret. Ver `docs/SFMC-API.md` §1 |
| Las tools no aparecen | Falta reiniciar |
| Una tool responde raro | Ver si trae `truncated: true` — los agregados de una respuesta truncada son de un subconjunto |
| La DE se ve vieja | La automation no corrió. Refrescar a mano con `sfmc_run_query` |
| `SIN MATCH` en la auditoría | Una pieza del catálogo no existe en SFMC. **Es lo que hay que revisar**, no un error del sistema |

**El 2027-01-28 el secret vence** y el síntoma será `invalid_client`, que parece un bug de
código. Se rota desde *Staged Secret Information* en la página del package; un secret en Staged
**todavía no autentica** — hay que promoverlo a Active.
