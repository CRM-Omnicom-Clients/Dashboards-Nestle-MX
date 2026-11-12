# Validación CDP (TD) vs SFMC directo — Nov 2026

Validación realizada 2026-11-12 con el kit SFMC en `sfmc/kit-crm-reporte-mcp-nestle-sfmc/`.

## Resultado principal

**100/100 piezas de TD tienen match en SFMC.** No hay pieza huérfana.

| Categoría | N |
|-----------|---|
| Exactos (diff sends = 0) | 10 |
| Diff < 1% | 10 |
| Diff 1–5% | 5 |
| Diff ≥ 5% | 48 |
| SFMC sin mapeo TD | 9 |

## Las divergencias grandes son arquitecturales, no errores

- **TD** agrega por `pieza_id`: suma TODOS los `nombre_unico` → pieza (todos los EmailNames del catálogo que apunten a esa pieza, todas las quincenas, P+FUP)
- **SFMC** reporta por `EmailName`: 1 fila por email job
- Para piezas AON con muchos jobs (ej. LigaMX), TD acumula millones; SFMC muestra solo el EmailName registrado

**Para comparación exacta 1:1:** filtrar TD al EmailName específico que SFMC tiene registrado.

## Semáforo SFMC (CRM_Reporte_Auditoria — 148 rows)

| Estado | N | Detalle |
|--------|---|---------|
| OK | 139 | ✅ |
| SIN MATCH | 2 | Nescafé ICE y Nescafé Espresso — sin envíos recientes |
| DUPLICADO | 5 | Maggi Selección, Nescafé Winback CH2 B1+B2, Test_1 — 2 config keys apuntan al mismo EmailName |
| ASSET CAMBIO | 2 | `009-P012` y `009-P017` (Proplan) — creativo reemplazado en Content Builder |

## 9 SFMC sin mapeo TD (OI-21)

| Sends | EmailName | Acción |
|-------|-----------|--------|
| 854K | Nescafé Winback SA | Mapear → pieza existente |
| 414K | Nescafé Winback SB | Ídem |
| 200K | Nescafé Winback A | Ídem |
| 168K | Nescafé Winback B | Ídem |
| 107K | Purina Brand AON | ¿Incluir en reporte NMX? |
| ~17 total | CH2 B1+B2 / SC / otros | Tests/duplicados — ignorar |

## Kit SFMC — patrón de uso

```javascript
const { resolverCredenciales } = require('./lib/credenciales.js');
const { crearCliente } = require('./lib/sfmc.js');
const { cargarConfig } = require('./lib/config.js');
const { columnas, leerFilas } = require('./lib/de.js');

const cfg  = cargarConfig();
const cred = await resolverCredenciales(cfg);
const cli  = await crearCliente({ cred, cfg });  // objeto, no cred directo

const cols = await columnas(cli, 'CRM_Email_Piezas');
const rows = await leerFilas(cli, 'CRM_Email_Piezas', cols.map(c=>c.name), { validar: false });
```

**Errores comunes a recordar:**
- `crearCliente(cred)` → error: necesita `crearCliente({ cred, cfg })`
- `leerFilas(cli, de, número)` → error: el 3er parámetro deben ser nombres de columnas como array de strings
- TD `tabla_nombres` tiene `canal: 'Email'` (capitalizado, no `'email'`)
- TD `rpt_email` tiene `tot_sends` (no `total_sends`), `p_sends`, `fup_sends`
