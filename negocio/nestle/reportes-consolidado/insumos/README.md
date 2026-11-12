# insumos/ — Archivos raw que sube Rick

Rick descarga estos archivos directamente de las plataformas y los sube aquí sin modificarlos.
El script `reload_catalog.py` los detecta automáticamente y los carga a TD.

## Archivos esperados

### WhatsApp — resultados de envíos WA
- **Formato**:  con la palabra  en el nombre (cualquier nombre)
- **Origen**: Descarga manual desde Twilio / SFMC
- **Estructura**: varias hojas, una por campaña
- **Hojas procesadas**: Hotcakes, Maggi Mundial, Tercer Tiempo, Maggi Liga MX, ICE
- **Hojas ignoradas**: BAU 2025 Nescafé (año anterior), Abuelita (pendiente de agregar al catálogo)
- **Carga a**: 

### Qcart — eventos de carrito (sesiones)
- **Formato**:  con  en el nombre, separador 
- **Origen**: Export raw del dashboard Qcart
- **Carga a**: 

### Qcart — eventos de producto
- **Formato**:  con  en el nombre, separador 
- **Origen**: Export raw del dashboard Qcart
- **Carga a**: 

## Notas

- Los nombres de archivo pueden cambiar entre cortes (fechas, versiones). El script los detecta por patrón.
- El catálogo () **no va aquí** — tiene su propia carpeta.
- La atribución  no se hace aquí — ocurre en  via JOINs con el catálogo.
- Archivos  de referencia (como reportes internos de Qcart) deben ir en , no aquí.
