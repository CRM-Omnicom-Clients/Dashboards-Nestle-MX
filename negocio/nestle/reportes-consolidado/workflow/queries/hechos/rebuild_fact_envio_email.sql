-- fact_envio_email
-- Grain: (pieza_id, email_job_id) — un envío real por pieza por job
-- Filtro: total_sends >= 10 (excluye test sends)
-- Fuentes:
--   prod_sfmc_emailengagement.prod_sfmc_sends        → volumen + bounces + subject
--   prod_sfmc_emailengagement.prod_sfmc_clicks       → clicks categorizados (cta/baja/redes/medidos)
--   prod_sfmc_emailengagement.prod_sfmc_opens        → unique_opens
--   prod_sfmc_emailengagement.prod_sfmc_unsubscribes → unique_unsubs
--   nmx_catalogo.tabla_nombres                       → email_name → pieza_id

WITH

job_sends AS (
    SELECT
        email_name,
        email_job_id,
        MAX(email_subject_line)      AS subject,
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

-- Categorización de clicks por tipo de URL
-- cta       = links intencionales (receta, producto, landing page)
-- baja       = unsubscribe / opt-out / preferencias
-- redes_legal = redes sociales, ver en navegador, avisos legales
click_typed AS (
    SELECT
        email_job_id,
        subscriber_key,
        CASE
            WHEN LOWER(click_url) LIKE '%unsub%'
              OR LOWER(click_url) LIKE '%baja%'
              OR LOWER(click_url) LIKE '%optout%'
              OR LOWER(click_url) LIKE '%preference%'       THEN 'baja'
            WHEN LOWER(click_url) LIKE '%facebook.com%'
              OR LOWER(click_url) LIKE '%twitter.com%'
              OR LOWER(click_url) LIKE '%instagram.com%'
              OR LOWER(click_url) LIKE '%youtube.com%'
              OR LOWER(click_url) LIKE '%tiktok.com%'
              OR LOWER(click_url) LIKE '%view.exacttarget%'
              OR LOWER(click_url) LIKE '%privacidad%'
              OR LOWER(click_url) LIKE '%politica%'
              OR LOWER(click_url) LIKE '%aviso-legal%'
              OR LOWER(click_url) LIKE '%terminos%'         THEN 'redes_legal'
            ELSE 'cta'
        END AS click_type
    FROM prod_sfmc_emailengagement.prod_sfmc_clicks
),

job_clicks AS (
    SELECT
        email_job_id,
        COUNT(DISTINCT subscriber_key)                                           AS unique_clicks,
        COUNT(DISTINCT CASE WHEN click_type = 'cta'         THEN subscriber_key END) AS unique_clicks_cta,
        COUNT(DISTINCT CASE WHEN click_type = 'baja'        THEN subscriber_key END) AS unique_clicks_baja,
        COUNT(DISTINCT CASE WHEN click_type = 'redes_legal' THEN subscriber_key END) AS unique_clicks_redes,
        -- clicks_medidos = clicks intencionales (CTA), excluye footer links
        COUNT(DISTINCT CASE WHEN click_type = 'cta'         THEN subscriber_key END) AS unique_clicks_medidos
    FROM click_typed
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
    s.subject,
    s.fecha_envio,
    s.sends,
    s.delivered,
    s.bounces,
    s.hard_bounces,
    s.soft_bounces,
    COALESCE(o.unique_opens,          0) AS unique_opens,
    COALESCE(c.unique_clicks,         0) AS unique_clicks,
    COALESCE(c.unique_clicks_cta,     0) AS unique_clicks_cta,
    COALESCE(c.unique_clicks_baja,    0) AS unique_clicks_baja,
    COALESCE(c.unique_clicks_redes,   0) AS unique_clicks_redes,
    COALESCE(c.unique_clicks_medidos, 0) AS unique_clicks_medidos,
    COALESCE(u.unique_unsubs,         0) AS unique_unsubs,
    CAST(TO_UNIXTIME(NOW()) AS BIGINT)   AS time
FROM job_sends s
JOIN nmx_catalogo.tabla_nombres n
  ON n.nombre_unico = s.email_name
 AND n.canal = 'Email'
LEFT JOIN job_opens  o ON o.email_job_id = s.email_job_id
LEFT JOIN job_clicks c ON c.email_job_id = s.email_job_id
LEFT JOIN job_unsubs u ON u.email_job_id = s.email_job_id
