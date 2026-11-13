-- v04: pct_penetracion_nestle nunca puede ser > 100 ni negativo
-- Captura BUG-06 family (grain mismatch entre carritos y productos)
SELECT
  COUNT(*) AS violaciones,
  SUM(CASE WHEN pct_penetracion_nestle > 100 THEN 1 ELSE 0 END) AS pct_mayor_100,
  SUM(CASE WHEN pct_penetracion_nestle < 0   THEN 1 ELSE 0 END) AS pct_negativo
FROM nmx_reporte.rpt_qcart
WHERE pct_penetracion_nestle IS NOT NULL
  AND (pct_penetracion_nestle > 100 OR pct_penetracion_nestle < 0)
