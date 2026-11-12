-- rpt_qcart
-- Grain: (pieza_id, quincena) — una fila por pieza por quincena con actividad
-- Atribución temporal: fecha del evento (no fecha_activacion del shortlink)
-- Filtro anti-test: fact_evento_qcart_* ya excluye eventos < fecha_activacion
-- tipo_envio incluido para split AON / one-shot en dashboard

WITH

carritos AS (
    SELECT
        pieza_id,
        quincena,
        MIN(fecha)                                                        AS fecha_desde,
        MAX(fecha)                                                        AS fecha_hasta,
        SUM(CASE WHEN LOWER(store) LIKE '%walmart%'  THEN views ELSE 0 END) AS carritos_walmart,
        SUM(CASE WHEN LOWER(store) LIKE '%chedraui%' THEN views ELSE 0 END) AS carritos_chedraui,
        SUM(views)                                                        AS carritos_total,
        SUM(impressions)                                                  AS views_carrito,
        SUM(total_shown_price)                                            AS intencion_total_mxn
    FROM nmx_hechos.fact_evento_qcart_carritos
    GROUP BY pieza_id, quincena
),

nestle_productos AS (
    SELECT
        pieza_id,
        quincena,
        SUM(views)                                                        AS views_productos_nestle,
        SUM(total_shown_price)                                            AS intencion_nestle_mxn
    FROM nmx_hechos.fact_evento_qcart_productos
    WHERE LOWER(brand) LIKE '%nestle%'
       OR LOWER(brand) LIKE '%nestlé%'
    GROUP BY pieza_id, quincena
),

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
    c.quincena,

    -- Dimensiones
    p.tipo_envio,
    dm.marca_nombre                                                       AS marca,
    db.bu_nombre                                                          AS bu,
    dc.campana_nombre                                                     AS campana,
    do_.objetivo_nombre                                                   AS objetivo,
    dtp.touchpoint_brief                                                  AS touchpoint_brief,
    COALESCE(ds.segmento_nombre, '—')                                    AS segmento_nombre,

    -- Rango temporal de la quincena
    c.fecha_desde,
    c.fecha_hasta,

    -- Carritos por tienda y total
    c.carritos_walmart,
    c.carritos_chedraui,
    c.carritos_total,
    c.views_carrito,

    -- Productos Nestlé
    COALESCE(np.views_productos_nestle, 0)                               AS views_productos_nestle,

    -- Intención de compra
    ROUND(c.intencion_total_mxn, 2)                                      AS intencion_total_mxn,
    ROUND(COALESCE(np.intencion_nestle_mxn, 0.0), 2)                     AS intencion_nestle_mxn,
    ROUND(
        CAST(COALESCE(np.intencion_nestle_mxn, 0) AS DOUBLE)
        / NULLIF(c.intencion_total_mxn, 0) * 100, 2
    )                                                                     AS pct_penetracion_nestle,

    -- Tickets promedio
    ROUND(c.intencion_total_mxn / NULLIF(c.carritos_total, 0), 2)        AS ticket_carrito_mxn,
    ROUND(
        COALESCE(np.intencion_nestle_mxn, 0.0)
        / NULLIF(COALESCE(np.views_productos_nestle, 0), 0), 2
    )                                                                     AS ticket_producto_mxn,

    -- Receta ligada al link Qcart
    r.receta_representativa,

    CAST(TO_UNIXTIME(NOW()) AS BIGINT)                                   AS time

FROM carritos c
JOIN nmx_catalogo.tabla_piezas          p    ON p.pieza_id      = c.pieza_id
JOIN nmx_catalogo.dim_marca            dm    ON dm.marca_id     = p.marca_id
JOIN nmx_catalogo.dim_bu               db    ON db.bu_id        = p.bu_id
JOIN nmx_catalogo.dim_campana          dc    ON dc.campana_id   = p.campana_id
JOIN nmx_catalogo.dim_objetivo         do_   ON do_.objetivo_id = p.objetivo_id
LEFT JOIN nmx_catalogo.dim_touchpoint_brief dtp ON dtp.touchpoint_id = p.touchpoint_id
LEFT JOIN nmx_catalogo.pieza_segmento  ps    ON ps.pieza_id     = c.pieza_id
LEFT JOIN nmx_catalogo.dim_segmento    ds    ON ds.segmento_id  = ps.segmento_id
LEFT JOIN nestle_productos             np    ON np.pieza_id     = c.pieza_id
                                            AND np.quincena     = c.quincena
LEFT JOIN receta                        r    ON r.pieza_id      = c.pieza_id
