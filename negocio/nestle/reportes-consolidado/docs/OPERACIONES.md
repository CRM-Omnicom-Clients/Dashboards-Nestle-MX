# OPERACIONES: Reporte Consolidado Nestlé México

> Runbook del flujo semanal. Se completa en Etapa 7 cuando el pipeline esté al 100%.

---

## Estado actual

**Etapas completas:** 0 (bootstrap), 1 (arquitectura), 2 (repo), 3 (catálogo), 4a (hechos email).

**Pendiente para completar este runbook:** 4b (WA), 4c (Qcart), 5 (rpt_*), 6 (dashboard), 7 (operabilidad).

---

## Proceso semanal actual (parcial — solo email)

### Pre-requisitos
- Acceso a TD AI Studio (carpeta CRM)
- Token GitHub en `my/TOKEN DASHBOARDS 1.txt`

### Pasos

**1. Actualizar catálogo** (si hubo cambios en piezas o vocabularios)
   - Rick edita `catalogo/Catalogo-Nestle-MX.xlsx` y hace commit/push al repo
   - En TD AI Studio: correr `uv run --with openpyxl [path]/scripts/reload_catalog.py`
   - Verificar: 10/10 tablas recargadas en nmx_insumos

**2. Correr el pipeline**
   ```
   tdx wf run nmx_crm_reporte.nmx_crm_reporte
   ```
   - Duración esperada: ~54 segundos
   - Verifica: catalogo.dig (24 OK) + hechos.dig (1 OK)

**3. Verificar resultados**
   ```sql
   SELECT COUNT(*) FROM nmx_hechos.fact_envio_email;
   -- Esperado: ~141 filas
   ```

---

## Qué agregar cuando estén 4b/4c/5/6

- Pasos para subir archivos WA + Qcart a `insumos/`
- Paso de verificación de rpt_email/wa/qcart
- Instrucciones de publicación del dashboard en Studio
- Schedule automático en TD
- Checklist de validación del corte completo

---

## Contactos

| Rol | Persona |
|---|---|
| Owner del proyecto | Rick Aguilar |
| Repo | CRM-Omnicom-Clients/Dashboards-Nestle-MX |
| Workflow TD | nmx_crm_reporte (ID: 2105350) |
