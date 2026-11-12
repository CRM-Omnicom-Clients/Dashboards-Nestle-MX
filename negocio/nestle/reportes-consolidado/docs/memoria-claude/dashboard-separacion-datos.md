# Dashboard: separación datos/lógica (BUG-08 — 2026-11-12)

## Regla dura

🔴 **`reporte-consolidado-crm.html` NUNCA se edita para actualizar datos.**

Solo `reporte-datos.js` cambia entre ciclos. El HTML es lógica pura y estable.

## Arquitectura desde 2026-11-12

| Archivo | Contiene | Quién lo escribe |
|---------|----------|-----------------|
| `dashboards/reporte-consolidado-crm.html` | SOLO lógica: filtros, tablas, estilos, funciones JS | Nadie (ya no cambia) |
| `dashboards/reporte-datos.js` | SOLO datos: `const AON=[...]`, `const OS=[...]`, `const WA=[...]` | `build_dashboard_data.py` |
| `workflow/scripts/build_dashboard_data.py` | Lee TD rpt_* y genera el .js | AI en cada ciclo de datos |

## Historia del BUG-08

**Causa raíz:** el HTML anterior mezclaba datos y lógica. En el commit `e787520` (fix BUG-05, 2026-11-12), al actualizar el timestamp hardcodeado en `go()`, un patch accidental fusionó `rsm(aon,os,wa)` dentro de `go()`. La función `rsm()` desapareció y su cuerpo quedó pegado como parte de la asignación `textContent`, creando un error de sintaxis JS que apagaba todo el script. El dashboard cargaba pero no mostraba datos.

**El bug pasó desapercibido** porque el patch fue pequeño y el diff parecía correcto.

**Fix:** commit `19d7524` restauró `rsm()` como función separada. Luego commit `5b0c81a` implementó la separación definitiva.

## Proceso para actualizar datos

```bash
# 1. Correr pipeline TD (si hay datos nuevos)
tdx wf run nmx_crm_reporte.nmx_crm_reporte

# 2. Generar el JS de datos
uv run workflow/scripts/build_dashboard_data.py

# 3. Push solo el .js
TOKEN=$(grep 'github_pat_' "/home/agent/work/2026-09-10_gp5b06/my/TOKEN DASHBOARDS 1.txt" | head -1 | tr -d ' \n\r')
cd /tmp/dashboards-repo
git add dashboards/reporte-datos.js
git commit -m "data: refresco [fecha]"
git push "https://x-access-token:${TOKEN}@github.com/CRM-Omnicom-Clients/Dashboards-Nestle-MX.git" main
```
