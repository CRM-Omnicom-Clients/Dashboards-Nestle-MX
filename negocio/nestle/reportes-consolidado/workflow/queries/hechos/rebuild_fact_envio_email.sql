-- fact_envio_email
-- Grain: (pieza_id, email_job_id) — un envío real por pieza por job
-- Filtro: solo jobs con total_sends >= 10 (excluye test sends; incluye transaccionales reales)
-- Fuentes:
--   prod_sfmc_emailengagement.prod_sfmc_sends        → volumen + bounces
--   prod_sfmc_emailengagement.prod_sfmc_opens        → unique_opens por job
--   prod_sfmc_emailengagement.prod_sfmc_clicks       → unique_clicks por job
--   prod_sfmc_emailengagement.prod_sfmc_unsubscribes → unique_unsubs por job
--   nmx_catalogo.tabla_nombres                       → email_name → pieza_id

WITH

job_sends AS (
    SELECT
        email_name,
        email_job_id,
        MAX(email_send_date)         AS fecha_envio,
        MAX(total_sends)             AS sends,
        MAX(total_delivered)         AS delivered,
        MAX(total_bounces)           AS bounces,
        MAX(total_send_hard_bounces) AS hard_bounces,
        MAX(total_send_soft_bounces) AS soft_bounces
    FROM prod_sfmc_emailengagement.prod_sfmc_sends
    GROUP BY email_name, email_job_id
    HAVING MAX(total_sends) >= 10
),

job_opens AS (
    SELECT
        email_job_id,
        COUNT(DISTINCT subscriber_key) AS unique_opens
    FROM prod_sfmc_emailengagement.prod_sfmc_opens
    GROUP BY email_job_id
),

job_clicks AS (
    SELECT
        email_job_id,
        COUNT(DISTINCT subscriber_key) AS unique_clicks
    FROM prod_sfmc_emailengagement.prod_sfmc_clicks
    GROUP BY email_job_id
),

job_unsubs AS (
    SELECT
        email_job_id,
        COUNT(DISTINCT subscriber_key) AS unique_unsubs
    FROM prod_sfmc_emailengagement.prod_sfmc_unsubscribes
    GROUP BY email_job_id
)

SELECT
    n.pieza_id,
    s.email_name,
    s.email_job_id,
    s.fecha_envio,
    s.sends,
    s.delivered,
    s.bounces,
    s.hard_bounces,
    s.soft_bounces,
    COALESCE(o.unique_opens,  0) AS unique_opens,
    COALESCE(c.unique_clicks, 0) AS unique_clicks,
    COALESCE(u.unique_unsubs, 0) AS unique_unsubs,
    CAST(TO_UNIXTIME(NOW()) AS BIGINT) AS time
FROM job_sends s
JOIN nmx_catalogo.tabla_nombres n
  ON n.nombre_unico = s.email_name
 AND n.canal = 'Email'
LEFT JOIN job_opens  o ON o.email_job_id = s.email_job_id
LEFT JOIN job_clicks c ON c.email_job_id = s.email_job_id
LEFT JOIN job_unsubs u ON u.email_job_id = s.email_job_id
