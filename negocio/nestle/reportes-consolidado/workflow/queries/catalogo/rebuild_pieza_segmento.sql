SELECT
  ps.pieza_id,
  s.segmento_id,
  CAST(TO_UNIXTIME(NOW()) AS BIGINT)     AS time
FROM nmx_insumos.land_pieza_segmento ps
JOIN nmx_catalogo.dim_segmento s
  ON  s.segmento_nombre = ps.segmento_nombre
  AND COALESCE(s.mascota, '') = COALESCE(NULLIF(ps.mascota,''), '')
WHERE ps.pieza_id IS NOT NULL
