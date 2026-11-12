SELECT
  sl.shortlink                                       AS shortlink,
  sl.fecha_activacion,
  sl.pieza_nombre,
  sl.pieza_id,
  sl.tienda,
  sl.receta,
  sl.url_receta,
  sl.estado_link,
  CAST(TO_UNIXTIME(NOW()) AS BIGINT)                 AS time
FROM nmx_insumos.land_shortlinks sl
WHERE sl.shortlink IS NOT NULL
  AND sl.shortlink <> ''
