# Actualización de datos — email desde SFMC (20-ago-2026)

> Handoff de la corrida que cambió la fuente de email de Datorama a SFMC y reconstruyó
> `Report_Resumen`. Los datos NO se escribieron a hojas: viven en `_fuentes/*.json` con su
> contrato. Solo se escribió `Report_Resumen` (valores, sin insights, sin formato fino).

## Qué se hizo, en orden

1. **Fetch único** — `sfmc_get_de_rows CRM_Email_Detalle`, 17 campos, 409 filas.
   Crudo persistido en `_insumos/sfmc-email-detalle.json` (no vuelve a pedirse).
2. **`orquestador.nb-email-sfmc.js`** — agrega la DE por `ConfigKey` (= `Pieza_ID`, cruce directo) →
   `_fuentes/email.json`, mismo contrato que consumía el bloque Datorama.
3. **`orquestador.reporte.js --escribir`** — motor N5 → valida N5-99 → N6 (reporte) → publica con las
   5 capas → puerta N7. **Camino corto: NO toca N0/N1f/N2a/N4** (esos escriben datos).

## El contrato del email desde SFMC (lo que no cambia)

- **Fuente de verdad: `CRM_Email_Detalle`.** Datorama es referencia, no fuente. Donde difieran,
  SFMC manda.
- **Cruce: `ConfigKey` === `Pieza_ID`** (`001-P003`). Sin fuzzy match.
- **Grano de la DE = JobID × día.** Se agrega por `ConfigKey + Es_FUP`. Las tasas NO se cargan
  ni se promedian: el motor las recalcula desde los conteos.
- **Fecha ancla = mín(SendDay) de la pieza.** Nunca la del journey.
- **Dimensiones del catálogo** (BU/Marca/Campaña/Objetivo/Touchpoint/Segmento), vía `pieza_id`.
  La DE ya las trae iguales (verificado: campañas alineadas).
- **Columnas nuevas del reporte, al final:** `Content_ID` = `Journey_ID_Datorama` (id del
  content name) · `Email_ID` = el creativo de SFMC. A nivel celda son conjuntos coma-separados.

## Cifras de esta corrida (verificadas)

| | |
|---|---|
| Filas DE | 409 · PK sin duplicados |
| Σ Email_Sends (SFMC) | **6,220,891** — idéntico en crudo → email.json → Report_Resumen |
| Piezas | 74 (de 76 del catálogo) |
| Report_Resumen | 64 filas · **60 columnas** (Insights fuera, +Content_ID +Email_ID) |
| WhatsApp | 14,643 envíos · Qcart 1,970 carritos |
| Excel | **abre** (COM, 10 hojas) · motor 12 checks · puerta N7 abierta |

## 🔴 Dos huecos conocidos — SON DE SFMC, no de esta corrida

Se reportan tal cual; NO se inventan. Se arreglan en `CRM_Reporte_Config` (config de SFMC de
Rick), no aquí:

1. **P005 / P006 salen plegados en P025 / P027** — nombres duplicados en el config. Su volumen
   está sumado dentro de P025/P027, no perdido.
2. **Pro Plan viene a 1/3** — cada pieza salió como 3 correos (Perros/Gatos/Mixto) y el config
   registró uno. Faltan 12 altas en el config. Detalle en `CATALOGO-CORRECCIONES.md` §3.

## Para volver a correr (cuando haya datos nuevos)

```
# 1. refrescar la DE en SFMC (queries en orden, ver FUENTE-EMAIL-SFMC.md), luego:
node ~/.claude/reportes-backend/nestle/_scripts/orquestador.nb-email-sfmc.js   # tras un fetch nuevo a _insumos/
node ~/.claude/reportes-backend/nestle/_scripts/orquestador.reporte.js --escribir
```

Qcart y WhatsApp reusan sus JSON (`_fuentes/qcart.json`, `whatsapp.json`) — recargarlos solo si
cambian. Publicar a producción = decisión de Rick (gate humano), y exige copia hoja-por-hoja
porque producción tiene 18 hojas que el interno no (ver `orquestador.publicar.js`).

---

## ✅ RESUELTO POR EL HANDOFF DEL EQUIPO DE SFMC (20-ago-2026, tarde)

`CRM General/HANDOFF-CATALOGO-RAIZ.md` cierra lo que estaba pendiente abajo. **Lee ese doc antes
que este**: lo de abajo describe el estado anterior y se conserva solo para entender de dónde salió.

| Pendiente de abajo | Qué pasó |
|---|---|
| Los 6 correos de **E4** sin EmailID | están en SFMC con su `ContentName` exacto: 83930 · 84320 · 84321 · 84322 · 84323 · 84261 |
| **AON abril** (P025/P027) con el ContentName de marzo | **ya se corrigió en SFMC.** La DE ya puede entregar la oleada de abril |
| Los 6 de **E3** que la DE no traía | siguen fuera del config, pero el handoff los da de alta como piezas nuevas |
| **PAE** | sigue *por confirmar* — el handoff también lo marca así |

🔴 **Y trae mucho más que eso:** 22 piezas nuevas (3 campañas nuevas: Liga MX · Espresso Con ·
Nescafé ICE), ~30 columnas nuevas en 5 DEs, y **dos DEs nuevas** (`CRM_Email_Links` con los clicks
por botón y `CRM_Audiencias` con audiencia y volumen).

🔴 **Lo que más cambia el sistema no es una columna: `Es_FUP` viene DECLARADO por SFMC.** Hoy el
sistema deduce el Follow Up leyendo el nombre (`/follow/i`) — que es inferir del naming. **Lo
declarado le gana a lo inferido**, y si los dos se contradicen se declara la contradicción.

📄 **El plan para todo esto: `<proyecto>/_orquesta/plan-pasos-fase3.md`.** El orden no es el obvio:
el **registro de nombres va primero**, porque cargar 30 columnas nuevas sin él es repetir treinta
veces el defecto de `Content_ID` contra `Content_ID (SFMC)`.

---

## 🔴 PENDIENTE (estado anterior — ver arriba qué de esto ya se cerró)

**Objetivo: la DE de datos de email COMPLETA, con TODOS los touchpoints, y `Content_ID` = nombre
completo del correo (`Email_Content_Name` / EmailName), NO el journey.**

1. **Content_ID = `Email_Content_Name`** (nombre completo de Content Builder), en TODO el reporte.
   - Hoy la columna trae el `Journey_ID_Datorama` (número de journey) — ESO ESTÁ MAL, se reemplaza.
   - Re-jalar la DE **incluyendo el campo `Email_Content_Name`** (antes no se pidió) y mapearlo a
     `Content_ID` en `orquestador.nb-email-sfmc.js` y `orquestador.resumen.js`.
   - Email_ID sigue siendo el número del asset.

2. **Forzar el llenado completo de Purina/Pro Plan** (hoy la DE trae 1 de 3 mascotas por persona):
   - E3: faltan 6 correos → Email_ID 83762, 83763, 83766, 83767, 83769, 83770 (nombres completos en
     `PLAN-CORRECCION-AON-PROPLAN.md`).
   - E4: faltan 6 correos → 83930, 84320, 84321, 84322, 84323, 84261 (PAE = PA+PO combinado, no
     separable en persona; sí por mascota).
   - Traer sus deliveries/opens/clicks reales (el `list_sends` filtrado por «roplan» solo devolvió
     los envíos de PRUEBA `sent:1`; los blast reales salieron con otro nombre de envío → probar
     `get_send_metrics` por jobId, o list_sends por la ventana 13-17 y 23-30 jul sin filtro y casar
     por Email_Content_Name).

3. **AON Traditional Parents abril**: agregar P025/P027 reales (Email_ID 80879/81286, journey
   863587, sends 38,093/29,136) + sus métricas; la fila de marzo se queda.

4. **Qcart Traditional Parents**: partir los 365 carritos por fecha de activación de link
   (177 marzo / 188 abril) — ver `PLAN-CORRECCION-AON-PROPLAN.md` §A-bis.

La vía correcta sigue siendo cargar todo esto al `CRM_Reporte_Config` de SFMC y re-correr las
queries; si no, forzar el llenado desde el detalle de SFMC casando por EmailName/Email_ID.
