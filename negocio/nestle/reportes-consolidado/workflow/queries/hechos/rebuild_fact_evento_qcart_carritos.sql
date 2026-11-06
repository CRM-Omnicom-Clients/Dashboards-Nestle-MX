-- fact_evento_qcart_carritos
-- Grain: evento de sesión de carrito — (pieza_id, fecha, hora, shortlink_code, store)
-- Fuente: nmx_insumos.land_qcart_carritos
-- Nota: pieza_id viene declarado en el Excel (Rick lo llena manualmente).
--       views = número de veces que se vio la página de carrito en esa sesión/hora.

SELECT
    pieza_id,
    fecha,
    hora,
    shortlink_code,
    shortlink_name,
    store,
    quincena,
    mes,
    TRY_CAST(impressions        AS BIGINT)  AS impressions,
    TRY_CAST(views              AS BIGINT)  AS views,
    TRY_CAST(total_shown_price  AS DOUBLE)  AS total_shown_price,
    activacion_link,
    fuente,
    aviso,
    email_name,
    CAST(TO_UNIXTIME(NOW()) AS BIGINT)       AS time
FROM nmx_insumos.land_qcart_carritos
WHERE pieza_id IS NOT NULL
  AND pieza_id <> ''
