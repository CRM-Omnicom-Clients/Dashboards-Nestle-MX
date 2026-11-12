-- rpt_whatsapp
-- Grain: (pieza_id, quincena)
-- Métricas de envío WA por pieza y periodo quincenal

SELECT
    w.pieza_id,
    dm.marca_nombre                                             AS marca,
    db.bu_nombre                                               AS bu,
    dc.campana_nombre                                          AS campana,
    do_.objetivo_nombre                                        AS objetivo,
    w.nombre_wa,
    w.quincena,
    w.mes,
    SUM(w.sends)                                               AS sends,
    SUM(w.deliveries)                                          AS deliveries,
    SUM(w.opens_read)                                          AS opens_read,
    SUM(w.clicks)                                              AS clicks,
    SUM(w.errores)                                             AS errores,
    SUM(w.no_entregados)                                       AS no_entregados,
    ROUND(CAST(SUM(w.deliveries) AS DOUBLE)
          / NULLIF(SUM(w.sends), 0) * 100, 2)                 AS delivery_rate_pct,
    ROUND(CAST(SUM(w.opens_read) AS DOUBLE)
          / NULLIF(SUM(w.deliveries), 0) * 100, 2)            AS open_rate_pct,
    ROUND(CAST(SUM(w.clicks) AS DOUBLE)
          / NULLIF(SUM(w.deliveries), 0) * 100, 2)            AS click_rate_pct,
    CAST(TO_UNIXTIME(NOW()) AS BIGINT)                        AS time
FROM nmx_hechos.fact_envio_whatsapp w
JOIN nmx_catalogo.tabla_piezas p
    ON p.pieza_id = w.pieza_id
JOIN nmx_catalogo.dim_marca dm
    ON dm.marca_id = p.marca_id
JOIN nmx_catalogo.dim_bu db
    ON db.bu_id = p.bu_id
JOIN nmx_catalogo.dim_campana dc
    ON dc.campana_id = p.campana_id
JOIN nmx_catalogo.dim_objetivo do_
    ON do_.objetivo_id = p.objetivo_id
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
