-- v03: Piezas con tiene_qcart='Sí' deben tener datos en rpt_qcart, y viceversa
-- Solo para piezas que aparecen en AMBAS tablas (piezas solo-Qcart son válidas)
-- violaciones > 0 indica BUG-09 family (filtro estado_link faltante o JOIN roto)
SELECT
  COALESCE(si_sin_datos, 0) + COALESCE(datos_sin_si, 0) AS violaciones,
  COALESCE(si_sin_datos, 0) AS piezas_si_sin_datos_qcart,
  COALESCE(datos_sin_si, 0) AS piezas_datos_qcart_sin_si
FROM (
  SELECT
    -- Piezas con tiene_qcart='Sí' en rpt_email pero SIN datos en rpt_qcart
    (SELECT COUNT(DISTINCT e.pieza_id)
     FROM nmx_reporte.rpt_email e
     LEFT JOIN nmx_reporte.rpt_qcart q ON q.pieza_id = e.pieza_id
     WHERE e.tiene_qcart = 'Sí' AND q.pieza_id IS NULL) AS si_sin_datos,
    -- Piezas en rpt_qcart Y en rpt_email, pero rpt_email dice tiene_qcart='No'
    (SELECT COUNT(DISTINCT q.pieza_id)
     FROM nmx_reporte.rpt_qcart q
     JOIN nmx_reporte.rpt_email e ON e.pieza_id = q.pieza_id
     WHERE e.tiene_qcart = 'No') AS datos_sin_si
)
