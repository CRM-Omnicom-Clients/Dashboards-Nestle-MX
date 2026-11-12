SELECT
  nombre_unico,
  pieza_id,
  canal,
  CAST(TO_UNIXTIME(NOW()) AS BIGINT)     AS time
FROM nmx_insumos.land_nombres
WHERE nombre_unico IS NOT NULL
  AND nombre_unico <> ''
