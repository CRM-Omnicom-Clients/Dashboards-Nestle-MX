# insumos/

Archivos crudos que Rick sube directamente desde las plataformas.
**No se procesan antes de subir.** La normalización y atribución de pieza_id ocurre en el pipeline.

## Tipos de archivo esperados

### WhatsApp (XLSX)
- Patrón: `*whatsapp*.xlsx`
- Archivo actual: `(Interno-Copia 111126 - Resultados Whatsapp CRM 2026.xlsx`
- Multi-hoja; cada hoja = una campaña / journney
- Hojas procesadas: Hotcakes, Maggi Mundial, Tercer Tiempo, Maggi Liga MX, ICE
- Hojas omitidas: BAU 2025 Nescafé, Abuelita (no tiene pieza en catálogo)

### Qcart — Carritos (CSV)
- Patrón: `*carts-raw*.csv`
- Archivo actual: `recetas-nestle-mx-carts-raw-2026-03-01-2026-11-11.csv`
- Delimitador: punto y coma (`;`)
- Decimal europeo en `total_shown_price` (coma → punto en pipeline)
- El campo `shortlink code` vincula con `dim_shortlink` para obtener `pieza_id`

### Qcart — Productos (CSV)
- Patrón: `*products-raw*.csv`
- Archivo actual: `recetas-nestle-mx-products-raw-2026-03-01-2026-11-11.csv`
- Mismo formato que carritos, agrega columnas `product` y `brand`

## Regla de oro

> Rick sube archivos raw sin procesar.
> `reload_catalog.py` normaliza columnas, fechas y decimales.
> Los SQL de `hechos/` atribuyen `pieza_id` vía JOINs.

## Archivo de referencia

El mapping interno Qcart → pieza (Excel de Hive) está en `referencia/`.
