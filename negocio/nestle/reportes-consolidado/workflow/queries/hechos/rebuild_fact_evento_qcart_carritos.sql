-- fact_evento_qcart_carritos
-- Grain: (pieza_id, fecha, hora, shortlink_code, store)
-- Atribución: shortlink_code JOIN nmx_catalogo.dim_shortlink → pieza_id
-- fecha/hora/quincena/mes derivados desde fecha_hora (formato: 2026-11-10T18:00:00)
-- Fuente: nmx_insumos.land_qcart_carritos (normalizado desde CSV raw por reload_catalog.py)
--
-- Reglas de atribución:
-- 1. Solo shortlinks con estado_link = 'USADO' (excluye NO SE ENVIO, LINK NO USADO)
-- 2. Si un shortlink aparece en dos piezas con distintas fechas de activación (ej. hTHNLqzL),
--    se asigna a la pieza con la fecha de activación más reciente que sea <= fecha del evento.
-- 3. El CSV puede tener filas duplicadas para (fecha_hora, shortlink_code, store) —
--    se colapsan sumando views y total_shown_price antes de la atribución.
-- Note: QUALIFY not supported in Presto — uso subquery con rn.

WITH land_collapsed AS (
    -- Paso 1: colapsar duplicados del CSV antes del JOIN
    SELECT
        fecha_hora,
        shortlink_code,
        MAX(shortlink_name)                                              AS shortlink_name,
        store,
        SUM(TRY_CAST(impressions      AS BIGINT))                       AS impressions,
        SUM(TRY_CAST(views            AS BIGINT))                       AS views,
        SUM(TRY_CAST(total_shown_price AS DOUBLE))                      AS total_shown_price,
        MAX(utm_campaign)                                                AS utm_campaign,
        MAX(utm_medium)                                                  AS utm_medium,
        MAX(utm_source)                                                  AS utm_source,
        MAX(ads_platform)                                                AS ads_platform
    FROM nmx_insumos.land_qcart_carritos
    WHERE shortlink_code IS NOT NULL AND shortlink_code <> ''
    GROUP BY fecha_hora, shortlink_code, store
)

SELECT
    pieza_id,
    fecha,
    hora,
    shortlink_code,
    shortlink_name,
    store,
    quincena,
    mes,
    impressions,
    views,
    total_shown_price,
    utm_campaign,
    utm_medium,
    utm_source,
    ads_platform,
    time
FROM (
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
        c.impressions,
        c.views,
        c.total_shown_price,
        c.utm_campaign,
        c.utm_medium,
        c.utm_source,
        c.ads_platform,
        CAST(TO_UNIXTIME(NOW()) AS BIGINT)                       AS time,
        ROW_NUMBER() OVER (
            PARTITION BY c.fecha_hora, c.shortlink_code, c.store
            ORDER BY COALESCE(s.fecha_activacion, '1900-01-01') DESC
        )                                                         AS rn
    FROM land_collapsed c
    JOIN nmx_catalogo.dim_shortlink s
        ON s.shortlink = c.shortlink_code
       AND s.estado_link = 'USADO'
       AND (s.fecha_activacion IS NULL OR SUBSTR(c.fecha_hora, 1, 10) >= s.fecha_activacion)
) t
WHERE rn = 1
