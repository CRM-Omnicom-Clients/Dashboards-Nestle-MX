-- fact_envio_whatsapp
-- Grain: (pieza_id, nombre_wa, quincena)
-- Atribución: nombre_wa JOIN nmx_catalogo.tabla_nombres → pieza_id
-- Fuente: nmx_insumos.land_wa_envios (normalizado desde XLSX raw por reload_catalog.py)

SELECT
    n.pieza_id,
    w.nombre_wa,
    w.quincena,
    MAX(w.send_date)                              AS fecha_envio,
    MAX(w.mes)                                    AS mes,
    SUM(CAST(w.sends AS BIGINT))                  AS sends,
    SUM(TRY_CAST(w.deliveries AS BIGINT))         AS deliveries,
    SUM(TRY_CAST(w.opens_read AS BIGINT))         AS opens_read,
    SUM(TRY_CAST(w.clicks AS BIGINT))             AS clicks,
    SUM(TRY_CAST(w.errores AS BIGINT))            AS errores,
    SUM(TRY_CAST(w.no_entregados AS BIGINT))      AS no_entregados,
    CAST(TO_UNIXTIME(NOW()) AS BIGINT)            AS time
FROM nmx_insumos.land_wa_envios w
JOIN nmx_catalogo.tabla_nombres n
    ON n.nombre_unico = w.nombre_wa
    AND n.canal = 'WhatsApp'
WHERE w.nombre_wa IS NOT NULL AND w.nombre_wa <> ''
  AND w.sends IS NOT NULL
GROUP BY n.pieza_id, w.nombre_wa, w.quincena
