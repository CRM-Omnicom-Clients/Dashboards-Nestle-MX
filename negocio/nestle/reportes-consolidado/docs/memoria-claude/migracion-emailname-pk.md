---
name: migracion-emailname-pk
description: "Migración de la PK a EmailName (quitar ConfigKey): plan verificado y escrito en el kit (docs/MIGRACION-EMAILNAME-PK.md), NO ejecutado. Falta el OK y la fecha de Rick, decidir qué hacer con los lectores de ConfigKey y construir las herramientas"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3fcc95e0-6a7f-416d-8815-86a488810f41
  modified: 2026-10-02T21:58:23.934Z
---

**Pedido de Rick (21-ago-2026):** «ConfigKey debe ser el EmailName, actualiza bien la arquitectura»: la PK de las DEs = `EmailName` y `ConfigKey` desaparece. El 2-oct-2026 confirmó el
objetivo («todo conectado con EmailName, ConfigKey no lo usamos») pero **lo dejó para después** («lo revisamos luego»): **no hay orden de ejecutarla**.

**Estado (2-oct-2026): plan listo y verificado, NO ejecutado.** La fuente de verdad es `~/.claude/skills/crm-reporte-mcp-nestle-sfmc/docs/MIGRACION-EMAILNAME-PK.md` (no esta nota). Lo que decide el plan,
medido en vivo:
- **Recrear** catálogo, audiencias, piezas y auditoría (SFMC no cambia la PK de una DE existente) con el **mismo nombre y CustomerKey**: es inmediato y las queries las siguen por key. Piezas y
  Auditoría son regenerables. **NO tocar `CRM_Email_Detalle`**: guarda historia irrecuperable (6 de sus 8 JobID más viejos ya no tienen eventos en `_Sent`). Links no se recrea.
- Los 5 SQL nuevos (mapa línea por línea que el código aplica y las pruebas verifican) se ensayaron en tablas temporales y dan **resultados idénticos** a los viejos.
- Respaldo previo: `node scripts/snapshot.js --con-datos` (esquemas, SQL completo y las filas del catálogo y de audiencias; local, trae datos del cliente).

**🔴 Lo que Rick no esperaba:** 38 archivos de código leen `ConfigKey` (22 vivos en `~/.claude/reportes-backend/nestle/_scripts/`: lib-fechas-envio, motor.links, fuentes-email.refrescar-volcado,
resumen.piezas-por-quincena…) y **no fallan si falta: agrupan todo en una fila vacía**. Hay que migrarlos antes (Opción A de la guía) o dejar `ConfigKey` como columna normal un tiempo (Opción B).

**Para ejecutarla falta:** su OK + fecha (fuera de 00:08–00:30 Central), la decisión A/B, y construir `migrar-llave.js` (+ `--revertir`) y `migracion-ensayo.js` con una guardia acotada y temporal (hoy
la guardia del kit prohíbe a propósito crear/borrar esas DEs y editar esas queries).

**How to apply:** si Rick pide "migra la llave", leer el doc del kit y presentar su §9 (decisiones) antes de tocar nada; no seguir pasos de memorias viejas. Es destructiva (borra DEs de producción): confirmar cada vez.
Relacionado: [[pipeline-reporte-nestle]], [[plan-portabilidad-sfmc]], [[no-inventar-identificadores]].
