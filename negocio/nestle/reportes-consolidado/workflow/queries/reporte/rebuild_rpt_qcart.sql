-- rpt_qcart
-- Grain: (pieza_id, quincena)
-- Agrega eventos de carrito y productos por pieza y periodo quincenal
-- Métricas: impresiones, views, eventos carrito, ticket promedio, intención de compra total

WITH carritos AS (
    SELECT
        c.pieza_id,
        c.quincena,
        c.mes,
        COUNT(DISTINCT c.shortlink_code)                       AS shortlinks_activos,
        COUNT(DISTINCT c.store)                                AS tiendas,
        SUM(c.impressions)                                     AS impressions,
        SUM(c.views)                                           AS views,
        COUNT(*)                                               AS eventos_carrito,
        ROUND(SUM(COALESCE(c.total_shown_price, 0)), 2)       AS valor_carrito_total,
        ROUND(AVG(
            CASE WHEN c.total_shown_price > 0
                 THEN c.total_shown_price END), 2)             AS ticket_promedio
    FROM nmx_hechos.fact_evento_qcart_carritos c
    GROUP BY 1, 2, 3
),
productos AS (
    SELECT
        pr.pieza_id,
        pr.quincena,
        COUNT(DISTINCT pr.product)                             AS productos_distintos,
        COUNT(DISTINCT pr.brand)                               AS marcas_productos,
        COUNT(*)                                               AS eventos_producto
    FROM nmx_hechos.fact_evento_qcart_productos pr
    GROUP BY 1, 2
)
SELECT
    ca.pieza_id,
    dm.marca_nombre                                             AS marca,
    db.bu_nombre                                               AS bu,
    dc.campana_nombre                                          AS campana,
    do_.objetivo_nombre                                        AS objetivo,
    ca.quincena,
    ca.mes,
    ca.shortlinks_activos,
    ca.tiendas,
    ca.impressions,
    ca.views,
    ca.eventos_carrito,
    ca.valor_carrito_total,
    ca.ticket_promedio,
    COALESCE(pr.productos_distintos, 0)                        AS productos_distintos,
    COALESCE(pr.marcas_productos, 0)                           AS marcas_productos,
    COALESCE(pr.eventos_producto, 0)                           AS eventos_producto,
    ROUND(CAST(ca.views AS DOUBLE)
          / NULLIF(ca.impressions, 0) * 100, 2)               AS view_rate_pct,
    CAST(TO_UNIXTIME(NOW()) AS BIGINT)                        AS time
FROM carritos ca
LEFT JOIN productos pr
    ON pr.pieza_id = ca.pieza_id AND pr.quincena = ca.quincena
JOIN nmx_catalogo.tabla_piezas p
    ON p.pieza_id = ca.pieza_id
JOIN nmx_catalogo.dim_marca dm
    ON dm.marca_id = p.marca_id
JOIN nmx_catalogo.dim_bu db
    ON db.bu_id = p.bu_id
JOIN nmx_catalogo.dim_campana dc
    ON dc.campana_id = p.campana_id
JOIN nmx_catalogo.dim_objetivo do_
    ON do_.objetivo_id = p.objetivo_id
