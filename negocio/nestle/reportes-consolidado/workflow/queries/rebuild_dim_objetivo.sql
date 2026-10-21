SELECT
  ROW_NUMBER() OVER (ORDER BY objetivo_nombre) AS objetivo_id,
  objetivo_nombre,
  'activo'                               AS estado,
  CAST(TO_UNIXTIME(NOW()) AS BIGINT)     AS time
FROM nmx_insumos.land_vocab_objetivos
WHERE objetivo_nombre IS NOT NULL
