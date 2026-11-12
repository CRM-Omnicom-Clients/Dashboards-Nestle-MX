---
name: invisibles-en-codigo
description: "Al escribir archivos con Write/Edit, un escape \"backslash-u\" de un caracter invisible o de formato (BOM, bidi, ancho cero) puede terminar como el caracter REAL dentro del archivo; construirlos con String.fromCodePoint y verificar con un escaneo"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3fcc95e0-6a7f-416d-8815-86a488810f41
  modified: 2026-10-02T23:53:00.666Z
---

Cuando un archivo de codigo necesita caracteres invisibles (BOM, RLO, ancho cero, separadores de linea y de parrafo), NO escribirlos como texto "backslash-u + 4 digitos" con Write/Edit:
terminaron como el caracter real incrustado en el archivo. Pasó dos veces en el kit crm-reporte-mcp-nestle-sfmc: 5 BOM reales (en lib/config.js, lib/credenciales.js y 2 pruebas) y un regex de
una prueba de humo que se rompio ("Invalid regular expression: missing /") porque uno de los caracteres era un separador de linea real.

**Why:** un invisible real en el fuente es justo lo que la prueba "Trojan Source" del kit prohibe, y no se ve al revisar el archivo ni en un diff. Los escapes con llaves (de un codigo largo) y
las propiedades Unicode (la clase de formato) sobrevivieron; los de 4 digitos de ciertos caracteres no.
**How to apply:** construirlos en codigo con `String.fromCodePoint(0x202e)` / `String.fromCharCode(0xfeff)`; en un regex, usar propiedades Unicode (formato, control, separadores). Tras escribir el
archivo, escanearlo en busca de formato/control/separadores (menos salto de linea, retorno y tabulador): `tests/sin-secretos.test.js` del skill crm-reporte-mcp-nestle-sfmc ya lo hace sobre todo el kit.
Parentesco con la regla global de CLAUDE.md sobre backslashes en heredocs. Ver [[plan-portabilidad-sfmc]].
