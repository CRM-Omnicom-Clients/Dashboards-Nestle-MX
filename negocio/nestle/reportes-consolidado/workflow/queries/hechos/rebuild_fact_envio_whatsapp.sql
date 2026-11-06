-- fact_envio_whatsapp
-- Grain: (pieza_id, quincena) — un envío de WA por pieza por quincena
-- Fuentes:
--   nmx_insumos.land_wa_envios   → métricas WA por envío
--   nmx_catalogo.tabla_nombres   → whatsapp_name → pieza_id (verificación)

SELECT
    n.pieza_id,
    w.whatsapp_name,
    w.quincena,
    w.send_date                                        AS fecha_envio,
    w.mes,
    CAST(w.sends          AS BIGINT)                   AS sends,
    CAST(w.deliveries     AS BIGINT)                   AS deliveries,
    CAST(w.opens_read     AS BIGINT)                   AS opens_read,
    CAST(w.clicks         AS BIGINT)                   AS clicks,
    w.clicks_medidos,
    CAST(w.errores        AS BIGINT)                   AS errores,
    CAST(w.no_entregados  AS BIGINT)                   AS no_entregados,
    CAST(TO_UNIXTIME(NOW()) AS BIGINT)                 AS time
FROM nmx_insumos.land_wa_envios w
JOIN nmx_catalogo.tabla_nombres n
  ON n.nombre_unico = w.whatsapp_name
 AND n.canal        = 'WhatsApp'
