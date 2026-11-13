-- v05: carritos_walmart + carritos_chedraui no debe superar carritos_total
-- Captura BUG-07 family (double-count de tienda con string dual)
SELECT
  COUNT(*) AS violaciones,
  MAX(carritos_walmart + carritos_chedraui - carritos_total) AS exceso_maximo
FROM nmx_reporte.rpt_qcart
WHERE (carritos_walmart + carritos_chedraui) > carritos_total
