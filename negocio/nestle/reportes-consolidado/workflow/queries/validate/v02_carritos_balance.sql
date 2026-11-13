-- v02: fact_evento_qcart_carritos.SUM(views) debe igualar rpt_qcart.SUM(carritos_total)
-- Si diferencia != 0, hay duplicación o pérdida en el reporte (BUG-10 family)
SELECT
  ABS(COALESCE(fact_total, 0) - COALESCE(rpt_total, 0)) AS diferencia,
  COALESCE(fact_total, 0) AS fact_carritos,
  COALESCE(rpt_total, 0)  AS rpt_carritos
FROM (
  SELECT
    (SELECT SUM(views)          FROM nmx_hechos.fact_evento_qcart_carritos) AS fact_total,
    (SELECT SUM(carritos_total) FROM nmx_reporte.rpt_qcart)                 AS rpt_total
)
