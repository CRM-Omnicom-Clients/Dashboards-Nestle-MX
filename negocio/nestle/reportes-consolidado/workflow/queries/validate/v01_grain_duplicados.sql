-- v01: Verifica que el grain de cada tabla reporte sea único
-- Si duplicados > 0, el workflow falla (BUG-10 family)
SELECT
  COALESCE(dup_qcart, 0) + COALESCE(dup_email, 0) AS duplicados,
  COALESCE(dup_qcart, 0) AS dup_rpt_qcart,
  COALESCE(dup_email, 0) AS dup_rpt_email
FROM (
  SELECT
    (SELECT COUNT(*) FROM (
      SELECT pieza_id, quincena FROM nmx_reporte.rpt_qcart
      GROUP BY pieza_id, quincena HAVING COUNT(*) > 1
    )) AS dup_qcart,
    (SELECT COUNT(*) FROM (
      SELECT pieza_id, mes FROM nmx_reporte.rpt_email
      GROUP BY pieza_id, mes HAVING COUNT(*) > 1
    )) AS dup_email
)
