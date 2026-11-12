-- fact_evento_qcart_productos
-- Grain: (pieza_id, fecha, hora, shortlink_code, product, store)
-- Atribución: shortlink_code JOIN nmx_catalogo.dim_shortlink → pieza_id
-- fecha/hora/quincena/mes derivados desde fecha_hora (formato: 2026-11-10T18:00:00)
-- Fuente: nmx_insumos.land_qcart_productos (normalizado desde CSV raw por reload_catalog.py)

SELECT
    s.pieza_id,
    SUBSTR(p.fecha_hora, 1, 10)                              AS fecha,
    SUBSTR(p.fecha_hora, 12, 8)                              AS hora,
    p.shortlink_code,
    p.shortlink_name,
    p.product,
    p.brand,
    p.store,
    SUBSTR(p.fecha_hora, 1, 7) ||
        CASE WHEN CAST(SUBSTR(p.fecha_hora, 9, 2) AS INTEGER) <= 15
             THEN '-Q1' ELSE '-Q2' END                       AS quincena,
    SUBSTR(p.fecha_hora, 1, 7)                               AS mes,
    TRY_CAST(p.impressions      AS BIGINT)                   AS impressions,
    TRY_CAST(p.views            AS BIGINT)                   AS views,
    TRY_CAST(p.total_shown_price AS DOUBLE)                  AS total_shown_price,
    p.utm_campaign,
    p.utm_medium,
    p.utm_source,
    p.ads_platform,
    CAST(TO_UNIXTIME(NOW()) AS BIGINT)                       AS time
FROM nmx_insumos.land_qcart_productos p
JOIN nmx_catalogo.dim_shortlink s
    ON s.shortlink = p.shortlink_code
WHERE p.shortlink_code IS NOT NULL AND p.shortlink_code <> ''
  AND (s.fecha_activacion IS NULL OR SUBSTR(p.fecha_hora, 1, 10) >= s.fecha_activacion)
