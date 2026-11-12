-- rpt_qcart
-- Grain: (pieza_id) — una fila por pieza con rango de fechas completo
-- Columnas alineadas con v8: store splits, intencion nestle, tickets, penetración
-- Mapeo v8:
--   Carritos_Walmart/Chedraui/Total = SUM(views) por store desde fact_carritos
--   Views_Carrito                  = SUM(impressions) desde fact_carritos
--   Views_Productos_Nestle         = SUM(views) desde fact_productos WHERE brand LIKE Nestlé
--   Intencion_Total_MXN            = SUM(total_shown_price) desde fact_carritos
--   Intencion_Nestle_MXN           = SUM(total_shown_price) desde fact_productos WHERE brand LIKE Nestlé
--   Ticket_Carrito_MXN             = Intencion_Total / Carritos_Total
--   Ticket_Producto_MXN            = Intencion_Nestle / Views_Productos_Nestle
--   Pct_Penetracion_Nestle         = Intencion_Nestle / Intencion_Total

WITH

-- Resumen de carritos por pieza (todos los stores, todos los periodos)
carritos AS (
    SELECT
        pieza_id,
        MIN(fecha)                                              AS fecha_desde,
        MAX(fecha)                                             AS fecha_hasta,
        -- Carrito views por store (Walmart, Chedraui, resto)
        SUM(CASE WHEN LOWER(store) LIKE '%walmart%'   THEN views ELSE 0 END) AS carritos_walmart,
        SUM(CASE WHEN LOWER(store) LIKE '%chedraui%'  THEN views ELSE 0 END) AS carritos_chedraui,
        SUM(views)                                             AS carritos_total,
        SUM(impressions)                                       AS views_carrito,
        SUM(total_shown_price)                                 AS intencion_total_mxn
    FROM nmx_hechos.fact_evento_qcart_carritos
    GROUP BY pieza_id
),

-- Productos Nestlé únicamente
nestle_productos AS (
    SELECT
        pieza_id,
        SUM(views)                                             AS views_productos_nestle,
        SUM(total_shown_price)                                 AS intencion_nestle_mxn
    FROM nmx_hechos.fact_evento_qcart_productos
    WHERE LOWER(brand) LIKE '%nestle%'
       OR LOWER(brand) LIKE '%nestlé%'
       OR LOWER(brand) LIKE '%nestle%'
    GROUP BY pieza_id
),

-- Receta representativa del shortlink (toma la primera asociada)
receta AS (
    SELECT
        pieza_id,
        MAX(receta) AS receta_representativa
    FROM nmx_catalogo.dim_shortlink
    WHERE receta IS NOT NULL AND receta != ''
    GROUP BY pieza_id
)

SELECT
    c.pieza_id,
    dm.marca_nombre                                            AS marca,
    db.bu_nombre                                               AS bu,
    dc.campana_nombre                                          AS campana,
    do_.objetivo_nombre                                        AS objetivo,
    COALESCE(ds.segmento_nombre, '—')                         AS segmento_nombre,

    -- Rango temporal
    c.fecha_desde,
    c.fecha_hasta,

    -- Carritos por tienda y total
    c.carritos_walmart,
    c.carritos_chedraui,
    c.carritos_total,
    c.views_carrito,

    -- Productos Nestlé
    COALESCE(np.views_productos_nestle, 0)                    AS views_productos_nestle,

    -- Intención de compra
    ROUND(c.intencion_total_mxn, 2)                           AS intencion_total_mxn,
    ROUND(COALESCE(np.intencion_nestle_mxn, 0.0), 2)          AS intencion_nestle_mxn,
    ROUND(
        CAST(COALESCE(np.intencion_nestle_mxn, 0) AS DOUBLE)
        / NULLIF(c.intencion_total_mxn, 0) * 100, 2
    )                                                          AS pct_penetracion_nestle,

    -- Tickets promedio
    ROUND(c.intencion_total_mxn
          / NULLIF(c.carritos_total, 0), 2)                   AS ticket_carrito_mxn,
    ROUND(COALESCE(np.intencion_nestle_mxn, 0.0)
          / NULLIF(COALESCE(np.views_productos_nestle, 0), 0), 2) AS ticket_producto_mxn,

    -- Receta ligada al link Qcart
    r.receta_representativa,

    CAST(TO_UNIXTIME(NOW()) AS BIGINT)                        AS time

FROM carritos c
JOIN nmx_catalogo.tabla_piezas p       ON p.pieza_id      = c.pieza_id
JOIN nmx_catalogo.dim_marca     dm     ON dm.marca_id     = p.marca_id
JOIN nmx_catalogo.dim_bu        db     ON db.bu_id        = p.bu_id
JOIN nmx_catalogo.dim_campana   dc     ON dc.campana_id   = p.campana_id
JOIN nmx_catalogo.dim_objetivo  do_    ON do_.objetivo_id = p.objetivo_id
LEFT JOIN nmx_catalogo.pieza_segmento  ps ON ps.pieza_id  = c.pieza_id
LEFT JOIN nmx_catalogo.dim_segmento    ds ON ds.segmento_id = ps.segmento_id
LEFT JOIN nestle_productos np ON np.pieza_id = c.pieza_id
LEFT JOIN receta r            ON r.pieza_id  = c.pieza_id
