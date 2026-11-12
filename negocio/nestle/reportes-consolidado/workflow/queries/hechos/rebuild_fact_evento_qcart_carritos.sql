-- fact_evento_qcart_carritos
-- Grain: (pieza_id, fecha, hora, shortlink_code, store)
-- Atribución: shortlink_code JOIN nmx_catalogo.dim_shortlink → pieza_id
-- fecha/hora/quincena/mes derivados desde fecha_hora (formato: 2026-11-10T18:00:00)
-- Fuente: nmx_insumos.land_qcart_carritos (normalizado desde CSV raw por reload_catalog.py)

SELECT
    s.pieza_id,
    SUBSTR(c.fecha_hora, 1, 10)                              AS fecha,
    SUBSTR(c.fecha_hora, 12, 8)                              AS hora,
    c.shortlink_code,
    c.shortlink_name,
    c.store,
    SUBSTR(c.fecha_hora, 1, 7) ||
        CASE WHEN CAST(SUBSTR(c.fecha_hora, 9, 2) AS INTEGER) <= 15
             THEN '-Q1' ELSE '-Q2' END                       AS quincena,
    SUBSTR(c.fecha_hora, 1, 7)                               AS mes,
    TRY_CAST(c.impressions      AS BIGINT)                   AS impressions,
    TRY_CAST(c.views            AS BIGINT)                   AS views,
    TRY_CAST(c.total_shown_price AS DOUBLE)                  AS total_shown_price,
    c.utm_campaign,
    c.utm_medium,
    c.utm_source,
    c.ads_platform,
    CAST(TO_UNIXTIME(NOW()) AS BIGINT)                       AS time
FROM nmx_insumos.land_qcart_carritos c
JOIN nmx_catalogo.dim_shortlink s
    ON s.shortlink = c.shortlink_code
WHERE c.shortlink_code IS NOT NULL AND c.shortlink_code <> ''
  AND (s.fecha_activacion IS NULL OR SUBSTR(c.fecha_hora, 1, 10) >= s.fecha_activacion)
