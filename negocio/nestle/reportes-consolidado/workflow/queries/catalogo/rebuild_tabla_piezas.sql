SELECT
  p.pieza_id,
  p.canal,
  p.email_type,
  p.tipo_envio,
  c.campana_id,
  m.marca_id,
  b.bu_id,
  o.objetivo_id,
  t.touchpoint_id,
  p.pieza_principal_id,
  CAST(p.fecha_primer_envio AS VARCHAR)  AS fecha_primer_envio,
  p.estado,
  p.notas,
  CAST(TO_UNIXTIME(NOW()) AS BIGINT)     AS time
FROM nmx_insumos.land_piezas p
JOIN nmx_catalogo.dim_campana           c ON c.campana_nombre     = p.campana_nombre
JOIN nmx_catalogo.dim_marca             m ON m.marca_nombre       = p.marca_nombre
JOIN nmx_catalogo.dim_bu                b ON b.bu_nombre          = p.bu_nombre
JOIN nmx_catalogo.dim_objetivo          o ON o.objetivo_nombre    = p.objetivo_nombre
JOIN nmx_catalogo.dim_touchpoint_brief  t ON t.touchpoint_brief   = p.touchpoint_brief
WHERE p.pieza_id IS NOT NULL
