# Mapa del backend de Nestlé

> Generado por `orquestador.mapa-carpeta.js` el 2026-09-22. **No se edita a mano** — se regenera.

| Carpeta | Archivos | Para qué | Regla |
|---|---|---|---|
| `_archivo` | 22 | Lo RETIRADO: scripts que ya no corren, huérfanos y salidas accidentales. | Se mueve aquí, NUNCA se borra con rm. Tres skills perdieron sus scripts así. |
| `_catalogo` | 19 | Estado y mediciones del catálogo de piezas. | — |
| `_contratos` | 38 | Lo que el sistema DECLARA: la cadena, el esquema, el registro de nombres, las reglas irrenunciables y los contratos de consumo. | Se generan desde el estado real. Un contrato a mano se desfasa. |
| `_fuentes` | 31 | Los bloques de datos por fuente (email, qcart, whatsapp, manual). Es el LOG acumulado. | Modo append: lo ya escrito no se va solo. Purgar exige un script con motivo. |
| `_insumos` | 28 | Lo que llega de fuera antes de procesarse. | — |
| `_preescritura` | 96 | Las MEDICIONES antes de tocar el Excel: qué se escribiría y por qué. | E1 · medir todo → decidir todo → escribir una vez. Se revisa ANTES de escribir. |
| `_rejilla` | 3 | La rejilla de cálculo intermedia. | — |
| `_respaldos` | 28 | Copias del workbook antes de escrituras grandes. | Fuera de OneDrive cuando importa: OneDrive revierte si Excel está abierto. |
| `_scripts` | 352 | Todo lo ejecutable. Nombres `<skill>.<verbo>.js`; las librerías, `lib-*.js`. | Un script sin skill dueño BLOQUEA el corte (guarda 1). |
| `_tmp` | 2 | Las copias ASCII de trabajo de los scripts. Descartable entero. | Ningún script escribe temporales fuera de aquí. Nada de esto es fuente de verdad. |

## Archivos en la raíz

- `CATALOGO.md` — La documentación del catálogo raíz.
- `MAPA.md` — Este mapa (generado).
- `_orquesta-bitacora.json` — La bitácora que escribe `orquestador.orquestador.js` en esta ruta exacta.

## Sueltos

✅ ninguno.