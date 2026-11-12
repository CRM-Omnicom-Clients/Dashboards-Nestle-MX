-- Cuenta filas en nmx_insumos para confirmar que hay datos cargados
SELECT
  'land_vocab_bu'              AS tabla, COUNT(*) AS filas FROM nmx_insumos.land_vocab_bu
UNION ALL SELECT 'land_vocab_marcas',              COUNT(*) FROM nmx_insumos.land_vocab_marcas
UNION ALL SELECT 'land_vocab_campanas',            COUNT(*) FROM nmx_insumos.land_vocab_campanas
UNION ALL SELECT 'land_vocab_objetivos',           COUNT(*) FROM nmx_insumos.land_vocab_objetivos
UNION ALL SELECT 'land_vocab_touchpoints_brief',   COUNT(*) FROM nmx_insumos.land_vocab_touchpoints_brief
UNION ALL SELECT 'land_vocab_segmentos',           COUNT(*) FROM nmx_insumos.land_vocab_segmentos
UNION ALL SELECT 'land_piezas',                    COUNT(*) FROM nmx_insumos.land_piezas
UNION ALL SELECT 'land_pieza_segmento',            COUNT(*) FROM nmx_insumos.land_pieza_segmento
UNION ALL SELECT 'land_nombres',                   COUNT(*) FROM nmx_insumos.land_nombres
UNION ALL SELECT 'land_shortlinks',                COUNT(*) FROM nmx_insumos.land_shortlinks
