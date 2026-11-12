-- Gate 1: valida nmx_insumos antes de reconstruir nmx_catalogo
-- Devuelve una sola fila con total de errores.
-- 0 = OK. >0 = STOP.

SELECT
  SUM(errores) AS errores
FROM (

  -- Pieza_IDs duplicados en land_piezas
  SELECT COUNT(*) - COUNT(DISTINCT pieza_id) AS errores
  FROM nmx_insumos.land_piezas

  UNION ALL

  -- Piezas con campana que no existe en el vocabulario
  SELECT COUNT(*) AS errores
  FROM nmx_insumos.land_piezas p
  WHERE p.campana_nombre IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM nmx_insumos.land_vocab_campanas c
      WHERE c.campana_nombre = p.campana_nombre
    )

  UNION ALL

  -- Piezas con marca que no existe en el vocabulario
  SELECT COUNT(*) AS errores
  FROM nmx_insumos.land_piezas p
  WHERE p.marca_nombre IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM nmx_insumos.land_vocab_marcas m
      WHERE m.marca_nombre = p.marca_nombre
    )

  UNION ALL

  -- Piezas con touchpoint que no existe en el vocabulario
  SELECT COUNT(*) AS errores
  FROM nmx_insumos.land_piezas p
  WHERE p.touchpoint_brief IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM nmx_insumos.land_vocab_touchpoints_brief t
      WHERE t.touchpoint_brief = p.touchpoint_brief
    )

  UNION ALL

  -- Segmentos en pieza_segmento que no existen en el vocabulario
  SELECT COUNT(*) AS errores
  FROM nmx_insumos.land_pieza_segmento ps
  WHERE NOT EXISTS (
    SELECT 1 FROM nmx_insumos.land_vocab_segmentos s
    WHERE s.segmento_nombre = ps.segmento_nombre
      AND COALESCE(s.mascota, '') = COALESCE(ps.mascota, '')
  )

) checks
