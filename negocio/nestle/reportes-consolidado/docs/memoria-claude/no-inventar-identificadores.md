---
name: no-inventar-identificadores
description: "No proponer ConfigKey, PiezaID ni numeración: esa taxonomía es de Rick. Reportar qué cambia y dejar el identificador en blanco"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3fcc95e0-6a7f-416d-8815-86a488810f41
  modified: 2026-10-26T17:32:40.566Z
---

Al entregarle las correcciones del catálogo CRM le propuse `ConfigKey` para las filas
nuevas (`009-P006` en adelante, marcados como «propuesto»). Me corrigió:

> «Tú no propones eso, entonces no lo pongas, solo pon el detalle de lo que cambia.»

**Why:** la numeración de piezas es su convención y la asigna él. Un identificador
inventado, aunque venga marcado como propuesta, se copia y se queda — y entonces el
catálogo tiene claves que nadie decidió. El riesgo no es que la propuesta sea mala, es
que se vuelva definitiva sin que nadie la haya aprobado.

**How to apply:** en tablas de filas nuevas, la columna de identificador va como
**«fila nueva»**, no con un valor. Lo que sí va completo es todo lo que yo sí puedo
verificar contra la fuente: ContentName, EmailID, envíos, fechas, segmento. Él le pone
la clave.

Lo mismo para cualquier valor que sea suyo y no derivable del dato: nombres de campaña,
touchpoints, códigos de segmento. Si no lo puedo leer de SFMC, no lo invento —
lo dejo señalado.

**Y cuando algo sea una inferencia y no un dato, marcarlo.** Me pidió que los códigos de
persona lleven entre paréntesis lo que significan, y que lo que esté por confirmar vaya
**con asterisco**. Ejemplo: `PAE (Aspiracionales + Educated Pet Owners) *`, porque ese
código no existe en ninguna fila del catálogo y la lectura es mía, no un dato.

Ver [[catalogo-crm-defectos]].

## Ampliación 21-ago-2026 — SFMC y el normalizador de Rick

En el pipeline SFMC le puse ConfigKey/PiezaID inventados (TMP-...) a las piezas nuevas y eso
**confundió al normalizador de Rick**. Corrección que él pidió:
- El número de pieza (PiezaID) de una provisional va **"*por definir" literal**, NUNCA inventado.
- La **identidad/llave es Email_Content_Name (= EmailName)**, no el ConfigKey ni el número.
- ConfigKey queda solo como PK interna de SFMC (no puede ir en blanco); el normalizador la IGNORA.

Regla general: cualquier consumidor downstream debe casar por EmailName, no por un id de pieza
que yo no puedo asignar.

## Actualización 22-oct-2026 — PiezaID ya no existe
Rick pidió (21-ago y de nuevo el 22-oct) eliminar la columna `PiezaID`, y se eliminó de las tablas de SFMC: ver [[pieza-id-eliminada]]. La regla de fondo sigue: no inventar identificadores; ahora ni siquiera hay dónde ponerlos (la `ConfigKey` es la única llave interna que queda, y desaparece con la migración a EmailName).

## Taxonomia Nestle (26-ago-2026)
- **Nescafe ICE NO es una campana: ICE es la MARCA.** El correo Welcome (997024) es marca ICE
  pero su **campana es The Freshers** (ya existe como 006-P001/P002). No mover piezas reales de
  campana sin confirmar. Al agregar piezas ICE nuevas, Marca=Nescafe ICE, Campana=*por definir.
- Maggi Liga MX: el touchpoint que usa Rick es **E-J5** aunque el asset diga J5/J6; la DE de
  audiencia confirma "E-J5 Liga MX SIN/CON REGION".