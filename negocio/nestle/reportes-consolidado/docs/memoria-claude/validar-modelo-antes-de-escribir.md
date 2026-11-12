---
name: validar-modelo-antes-de-escribir
description: Rick exige auditar la coherencia del modelo (BU|Marca|Campaña) ANTES de escribir datos encima; escribir primero y validar después no cuenta como haberlo hecho bien
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7f4f5885-aeaa-463f-8423-91bdc22cfff6
  modified: 2026-07-21T19:09:00.255Z
---

Antes de cargar datos en una tabla maestra (briefs, links, fechas, estatus), **auditar primero la
coherencia del modelo completo** y presentarle el diagnóstico. Escribir primero y validar después
no cuenta, aunque el resultado salga bien.

**Por qué:** el 21-jul-2026 cargué los links de briefs en `Campañas` mapeando por *Marca+Campaña*,
**sin haber mirado la columna BU** — que es justo el primer campo de la llave `BU|Marca|Campaña` con
la que `Envíos` hereda todo. Rick lo cachó de inmediato: *"no actualizaste la hoja de campañas, solo
los links… ¿sin eso cómo pusiste los briefs?"*. Los 7 links resultaron correctos, pero **por suerte**:
ningún par `Marca|Campaña` se repetía entre BUs. Si se hubiera repetido, habría contaminado 123 piezas
por herencia de fórmula, en el documento que ve el cliente.

**Cómo aplicarlo la próxima vez:**
1. Volcar el roster **completo con todas las columnas de la llave**, no solo las que voy a usar.
2. Correr los checks de coherencia y enseñárselos **antes** de escribir:
   marca en >1 BU · valor que es marca **y** campaña (su regla, ver [[crm-calendario-rediseno]]) ·
   filas con 0 piezas · combos que existen en las piezas pero no en el roster · claves que no cuadran.
3. Verificar que la llave usada sea **única**; si no lo es, preguntar, no adivinar.
4. Cuadratura como red final: total del roster **debe** igualar el conteo de piezas. Un `COUNTIFS`
   que devuelve 0 es válido-pero-mal.

Aplica igual a cualquier documento rector, no solo a este.
