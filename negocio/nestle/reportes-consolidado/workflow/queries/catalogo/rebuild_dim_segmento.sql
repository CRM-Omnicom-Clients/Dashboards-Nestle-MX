SELECT
  ROW_NUMBER() OVER (ORDER BY segmento_nombre, COALESCE(mascota,'')) AS segmento_id,
  segmento_nombre,
  NULLIF(mascota, '')                    AS mascota,
  'activo'                               AS estado,
  CAST(TO_UNIXTIME(NOW()) AS BIGINT)     AS time
FROM nmx_insumos.land_vocab_segmentos
WHERE segmento_nombre IS NOT NULL
