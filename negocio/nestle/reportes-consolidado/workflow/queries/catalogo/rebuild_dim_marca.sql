SELECT
  ROW_NUMBER() OVER (ORDER BY b.bu_id, m.marca_nombre) AS marca_id,
  m.marca_nombre,
  b.bu_id,
  'activo'                                AS estado,
  CAST(TO_UNIXTIME(NOW()) AS BIGINT)      AS time
FROM nmx_insumos.land_vocab_marcas m
JOIN nmx_catalogo.dim_bu b ON b.bu_nombre = m.bu_nombre
WHERE m.marca_nombre IS NOT NULL
