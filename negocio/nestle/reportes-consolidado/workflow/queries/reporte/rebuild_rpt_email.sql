-- rpt_email
-- Grain: (pieza_id, mes)
-- Une email_job_ids de una misma pieza por mes (Principal + FUPs por separado)
-- Métricas: envío, entrega, apertura, clic, bajas

SELECT
    e.pieza_id,
    p.canal,
    p.email_type,
    p.tipo_envio,
    p.pieza_principal_id,
    dm.marca_nombre                                             AS marca,
    db.bu_nombre                                               AS bu,
    dc.campana_nombre                                          AS campana,
    do_.objetivo_nombre                                        AS objetivo,
    SUBSTR(e.fecha_envio, 1, 7)                                AS mes,
    COUNT(DISTINCT e.email_job_id)                             AS num_jobs,
    SUM(e.sends)                                               AS sends,
    SUM(e.delivered)                                           AS delivered,
    SUM(e.bounces)                                             AS bounces,
    SUM(e.hard_bounces)                                        AS hard_bounces,
    SUM(e.soft_bounces)                                        AS soft_bounces,
    SUM(e.unique_opens)                                        AS unique_opens,
    SUM(e.unique_clicks)                                       AS unique_clicks,
    SUM(e.unique_unsubs)                                       AS unique_unsubs,
    ROUND(CAST(SUM(e.unique_opens) AS DOUBLE)
          / NULLIF(SUM(e.delivered), 0) * 100, 2)             AS open_rate_pct,
    ROUND(CAST(SUM(e.unique_clicks) AS DOUBLE)
          / NULLIF(SUM(e.delivered), 0) * 100, 2)             AS click_rate_pct,
    ROUND(CAST(SUM(e.delivered) AS DOUBLE)
          / NULLIF(SUM(e.sends), 0) * 100, 2)                 AS delivery_rate_pct,
    CAST(TO_UNIXTIME(NOW()) AS BIGINT)                        AS time
FROM nmx_hechos.fact_envio_email e
JOIN nmx_catalogo.tabla_piezas p
    ON p.pieza_id = e.pieza_id
JOIN nmx_catalogo.dim_marca dm
    ON dm.marca_id = p.marca_id
JOIN nmx_catalogo.dim_bu db
    ON db.bu_id = p.bu_id
JOIN nmx_catalogo.dim_campana dc
    ON dc.campana_id = p.campana_id
JOIN nmx_catalogo.dim_objetivo do_
    ON do_.objetivo_id = p.objetivo_id
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
