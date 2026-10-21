SELECT
  ROW_NUMBER() OVER (ORDER BY bu_nombre) AS bu_id,
  bu_nombre,
  'activo'                                AS estado,
  CAST(TO_UNIXTIME(NOW()) AS BIGINT)      AS time
FROM nmx_insumos.land_vocab_bu
WHERE bu_nombre IS NOT NULL
