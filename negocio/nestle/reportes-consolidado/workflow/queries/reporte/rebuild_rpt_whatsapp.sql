-- rpt_whatsapp
-- Grain: (pieza_id, quincena)
-- Métricas de envío WhatsApp con todas las tasas y dimensiones v8

SELECT
    w.pieza_id,
    dm.marca_nombre                                             AS marca,
    db.bu_nombre                                               AS bu,
    dc.campana_nombre                                          AS campana,
    do_.objetivo_nombre                                        AS objetivo,
    dt.touchpoint_brief,
    COALESCE(seg.segmento_nombre, '—')                         AS segmento_nombre,
    w.nombre_wa,
    w.quincena,
    w.mes,
    SUM(w.sends)                                               AS sends,
    SUM(w.deliveries)                                          AS deliveries,
    SUM(w.no_entregados)                                       AS no_entregados,
    SUM(w.opens_read)                                          AS opens_read,
    SUM(w.clicks)                                              AS clicks,
    SUM(w.errores)                                             AS errores,
    ROUND(CAST(SUM(w.deliveries) AS DOUBLE)
          / NULLIF(SUM(w.sends), 0) * 100, 2)                 AS wa_pct_entrega,
    ROUND(CAST(SUM(w.no_entregados) AS DOUBLE)
          / NULLIF(SUM(w.sends), 0) * 100, 2)                 AS wa_pct_no_entrega,
    ROUND(CAST(SUM(w.opens_read) AS DOUBLE)
          / NULLIF(SUM(w.deliveries), 0) * 100, 2)            AS wa_pct_read_vs_entrega,
    ROUND(CAST(SUM(w.clicks) AS DOUBLE)
          / NULLIF(SUM(w.opens_read), 0) * 100, 2)            AS wa_pct_click_vs_read,
    CAST(TO_UNIXTIME(NOW()) AS BIGINT)                        AS time

FROM nmx_hechos.fact_envio_whatsapp w
JOIN nmx_catalogo.tabla_piezas p
    ON p.pieza_id = w.pieza_id
JOIN nmx_catalogo.dim_marca            dm  ON dm.marca_id     = p.marca_id
JOIN nmx_catalogo.dim_bu               db  ON db.bu_id        = p.bu_id
JOIN nmx_catalogo.dim_campana          dc  ON dc.campana_id   = p.campana_id
JOIN nmx_catalogo.dim_objetivo         do_ ON do_.objetivo_id = p.objetivo_id
JOIN nmx_catalogo.dim_touchpoint_brief dt  ON dt.touchpoint_id = p.touchpoint_id
LEFT JOIN (
    SELECT ps.pieza_id, MIN(ds2.segmento_nombre) AS segmento_nombre
    FROM nmx_catalogo.pieza_segmento ps
    JOIN nmx_catalogo.dim_segmento ds2 ON ds2.segmento_id = ps.segmento_id
    GROUP BY ps.pieza_id
) seg ON seg.pieza_id = w.pieza_id

GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
