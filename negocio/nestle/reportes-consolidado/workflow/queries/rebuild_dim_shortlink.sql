SELECT
  sl.shortlink_code,
  sl.pieza_id,
  sl.nombre_receta,
  sl.tienda,
  CAST(sl.excluido AS BOOLEAN)           AS excluido,
  sl.motivo_exclusion,
  CAST(TO_UNIXTIME(NOW()) AS BIGINT)     AS time
FROM nmx_insumos.land_shortlinks sl
WHERE sl.shortlink_code IS NOT NULL
  AND sl.shortlink_code <> ''
