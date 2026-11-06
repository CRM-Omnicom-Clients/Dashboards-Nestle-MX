-- fact_envio_whatsapp
-- Grain: (pieza_id, quincena) — un envío de WA por pieza por quincena
-- Fuente: nmx_insumos.land_wa_envios
-- Nota: pieza_id viene declarado en el Excel (Rick lo llena manualmente).
--       No requiere JOIN a tabla_nombres porque la fuente WA no viene de un sistema
--       con nombres únicos como SFMC. El GROUP BY deduplicaría filas duplicadas del Excel.
-- Nota: clicks puede ser N/A en algunas filas (piezas sin medición de clicks).

SELECT
    w.pieza_id,
    w.whatsapp_name,
    w.quincena,
    MAX(w.send_date)                                       AS fecha_envio,
    MAX(w.mes)                                             AS mes,
    SUM(CAST(w.sends         AS BIGINT))                   AS sends,
    SUM(CAST(w.deliveries    AS BIGINT))                   AS deliveries,
    SUM(CAST(w.opens_read    AS BIGINT))                   AS opens_read,
    SUM(TRY_CAST(w.clicks    AS BIGINT))                   AS clicks,
    MAX(w.clicks_medidos)                                  AS clicks_medidos,
    SUM(CAST(w.errores       AS BIGINT))                   AS errores,
    SUM(CAST(w.no_entregados AS BIGINT))                   AS no_entregados,
    CAST(TO_UNIXTIME(NOW()) AS BIGINT)                     AS time
FROM nmx_insumos.land_wa_envios w
WHERE w.pieza_id IS NOT NULL
  AND w.pieza_id <> ''
GROUP BY w.pieza_id, w.whatsapp_name, w.quincena
