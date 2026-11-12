---
name: catalogo-crm-defectos
description: "Por qué el catálogo de piezas no cuadra contra SFMC: falta la columna de oleada en AON y falta separar por mascota en Pro Plan. Diagnóstico cerrado, corrección pendiente"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3fcc95e0-6a7f-416d-8815-86a488810f41
  modified: 2026-08-20T05:20:48.763Z
---

Reconciliación de las 76 piezas de email del Reporte Consolidado contra SFMC
(19-ago-2026). **62 cuadran.** Las 14 que no, se explican por dos defectos del catálogo
— no de SFMC, y no de los renombres.

El documento con las tablas de corrección, para la sesión que mantiene el catálogo:
`CRM General/CATALOGO-CORRECCIONES.md`.

## Los renombres NO son la causa (verificado, no supuesto)

93 de 335 creativos se enviaron bajo más de un nombre. Es real y es masivo, pero el
nombre viejo trae **entre 1 y 15 envíos**: son las pruebas antes de publicar. En cero
de 76 piezas el renombre explicaba una diferencia de volumen. **No reprocesar por
esto.** El detalle técnico vive en `~/.claude/tools/_mcp-sfmc/docs/IDENTIDAD-DE-PIEZAS.md`.

## Defecto 1 — AON: falta la columna de OLEADA

Hay **seis pares de filas con BU|Marca|Campaña|Touchpoint|Segmento|Tipo IDÉNTICOS**. No
es un error de captura: es el mismo segmento contactado en dos oleadas — journey
`803867` (marzo, segmenta por perfil) y `863587` (abril-mayo, por comportamiento de
compra). **Nada en la fila dice cuál es cuál**, así que al capturar se cruzaron.

| MARZO | ABRIL | Touchpoint · Segmento |
|---|---|---|
| P001 | P023 | E-P4 Career Focused |
| P002 | P028 | E-P4 Career Focused · FUP |
| P003 | P024 | E-P3 New Parents |
| P004 | P026 | E-P3 New Parents · FUP |
| P005 | P025 | E-P1 Traditional Parents |
| P006 | P027 | E-P1 Traditional Parents · FUP |

- Las filas de marzo traen la **suma de ambas oleadas** (cuadra a ±1 en las seis).
- Las de abril traen la cifra **de su par de marzo**.
- ✅ **RESUELTO 20-ago-2026:** P025 -> PURCHASE-EP1 (asset 80879), P027 -> FUP-PURCHASE-EP1 (asset 81286). ContentName corregido de marzo a abril: 0 duplicados, ContentName ya es llave unica. Los ~67k envios de abril ya tienen fila. Segmento heredado como P023/P024/P026/P028 (marzo label + abril name).
- 🔴 **P025 y P027 eran las filas de ABRIL** pero con el ContentName de marzo. Deben ser
  `PURCHASE-EP1` (asset 80879, 38,093) y `FUP-PURCHASE-EP1` (asset 81286, 29,136).

🔴 **Corrección a lo que dije primero:** llegué a reportar que faltaban 2 piezas de AON
en el catálogo. **No falta ninguna** — las filas existían (P025/P027), con el nombre
equivocado. Eran 2 ContentName mal y 12 números, no filas faltantes.

Y antes de eso diagnostiqué "dígitos transpuestos 863587→803867". **También era falso**:
son dos journeys distintos. Esa nota ya se borró de `CRM_Reporte_Config`.

## Defecto 2 — Pro Plan: falta separar por mascota

El sufijo del content name es la mascota (**`1` Perros · `2` Gatos · `3` Mixto**); el
prefijo (`PA`/`PP`/`PO`) es la persona, que es lo que hoy vive en `Segmento`. El catálogo
trae la suma de las tres mascotas pero registró el nombre de una sola, y no de la misma
en cada caso. Por eso 009-P003 se veía con 185 envíos cuando su grupo mandó 22,819.

| Grupo | Suma real | Catálogo | Fila |
|---|---|---|---|
| `PA_E3B` | 19,129 | 19,115 | 009-P002 (apunta a Perros) |
| `PP_E3A` | 22,819 | 22,803 | 009-P003 (apunta a Mixto) |
| `PO_E3C` | 1,463 | 1,449 | 009-P004 (apunta a Perros) |
| `PP_E4A` | 4,153 | — | **sin fila** |
| `PAE_E4B` | 18,951 | — | **sin fila** |

**Decisión de Rick (19-ago-2026): separado todo.** Sin proponerle ConfigKey — ver
[[no-inventar-identificadores]]. De 3 filas E3 se pasa a 9, más 6
nuevas de E4 = 12 filas nuevas. El código `PAE` no existe en el catálogo; la lectura probable es
*Aspiracionales + Educated Pet Owners*, pero está **por confirmar** (va con asterisco).

La desviación constante de −14/−16 (0.07%) es un corte de ventana distinto en la fuente,
no un problema de estructura. No perseguirla.

## Cómo se detecta esto de nuevo, sin volver a investigar

`CRM_Reporte_Auditoria` tiene `Asset_Declarado` (del catálogo) vs `Asset_Real` (de SFMC):
si difieren, el estado sale `ASSET CAMBIO`. Y `Piezas_Mismo_Asset > 1` marca las filas que
apuntan al mismo correo. Ver [[pipeline-reporte-nestle]].
