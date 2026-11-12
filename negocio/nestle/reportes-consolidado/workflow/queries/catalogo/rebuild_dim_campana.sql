SELECT
  ROW_NUMBER() OVER (ORDER BY campana_nombre) AS campana_id,
  campana_nombre,
  'activo'                               AS estado,
  CAST(TO_UNIXTIME(NOW()) AS BIGINT)     AS time
FROM nmx_insumos.land_vocab_campanas
WHERE campana_nombre IS NOT NULL
