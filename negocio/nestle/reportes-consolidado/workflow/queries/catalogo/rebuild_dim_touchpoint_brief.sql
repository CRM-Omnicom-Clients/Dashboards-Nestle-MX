SELECT
  ROW_NUMBER() OVER (ORDER BY canal, touchpoint_brief) AS touchpoint_id,
  touchpoint_brief,
  canal,
  'activo'                               AS estado,
  CAST(TO_UNIXTIME(NOW()) AS BIGINT)     AS time
FROM nmx_insumos.land_vocab_touchpoints_brief
WHERE touchpoint_brief IS NOT NULL
