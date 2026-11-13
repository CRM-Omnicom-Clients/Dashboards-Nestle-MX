-- rpt_email
-- Grain: (pieza_id, mes) donde pieza = Principal
-- Formato wide: métricas Principal | métricas FUP | Totales P+FUP (alineado con v8)
-- El FUP se une por pieza_principal_id = principal.pieza_id AND mismo mes

WITH

-- Agrega métricas del fact por (pieza_id, mes)
pieza_mes AS (
    SELECT
        e.pieza_id,
        p.email_type,
        p.tipo_envio,
        COALESCE(p.pieza_principal_id, '')  AS pieza_principal_id,
        p.campana_id,
        p.marca_id,
        p.bu_id,
        p.objetivo_id,
        p.touchpoint_id,
        SUBSTR(e.fecha_envio, 1, 7)         AS mes,
        MIN(e.fecha_envio)                  AS primera_fecha,
        MAX(e.email_name)                   AS email_name,
        MAX(e.subject)                      AS subject,
        COUNT(DISTINCT e.email_job_id)      AS num_jobs,
        SUM(e.sends)                        AS sends,
        SUM(e.delivered)                    AS deliveries,
        SUM(e.unique_opens)                 AS unique_opens,
        SUM(e.unique_clicks)                AS unique_clicks,
        SUM(e.unique_clicks_cta)            AS unique_clicks_cta,
        SUM(e.unique_clicks_baja)           AS unique_clicks_baja,
        SUM(e.unique_clicks_medidos)        AS unique_clicks_medidos,
        SUM(e.unique_unsubs)                AS unique_unsubs
    FROM nmx_hechos.fact_envio_email e
    JOIN nmx_catalogo.tabla_piezas p
        ON p.pieza_id = e.pieza_id
    GROUP BY
        e.pieza_id,
        p.email_type, p.tipo_envio, COALESCE(p.pieza_principal_id, ''),
        p.campana_id, p.marca_id, p.bu_id, p.objetivo_id, p.touchpoint_id,
        SUBSTR(e.fecha_envio, 1, 7)
),

-- Piezas Principales (sin padre)
principals AS (
    SELECT
        *,
        CASE
            WHEN CAST(SUBSTR(primera_fecha, 9, 2) AS INT) <= 15
                THEN CONCAT(mes, '-Q1')
            ELSE CONCAT(mes, '-Q2')
        END AS quincena
    FROM pieza_mes
    WHERE pieza_principal_id = ''
),

-- FUPs (con referencia a su Principal)
fups AS (
    SELECT
        *,
        CASE
            WHEN CAST(SUBSTR(primera_fecha, 9, 2) AS INT) <= 15
                THEN CONCAT(mes, '-Q1')
            ELSE CONCAT(mes, '-Q2')
        END AS quincena
    FROM pieza_mes
    WHERE pieza_principal_id != ''
)

SELECT
    -- ── Dimensiones ────────────────────────────────────────────────────────────
    dc.campana_nombre                                           AS campana,
    'email'                                                     AS medio,
    do_.objetivo_nombre                                         AS objetivo,
    dt.touchpoint_brief,
    p_.email_type                                               AS tipo_email,
    p_.tipo_envio,
    COALESCE(seg.segmento_nombre, '—')                          AS segmento_nombre,
    CASE WHEN sl.pieza_id IS NOT NULL THEN 'Sí' ELSE 'No' END  AS tiene_qcart,
    p_.quincena                                                 AS quincena_principal,
    p_.mes,
    dm.marca_nombre                                             AS marca,
    db.bu_nombre                                                AS bu,

    -- ── Identificadores Principal ───────────────────────────────────────────────
    p_.pieza_id,
    p_.email_name                                               AS email_name_principal,
    p_.subject                                                  AS subject_principal,
    p_.primera_fecha                                            AS fecha_envio_principal,
    p_.num_jobs                                                 AS jobs_principal,

    -- ── Principal: métricas de envío ────────────────────────────────────────────
    p_.sends                                                    AS p_sends,
    p_.deliveries                                               AS p_deliveries,
    p_.unique_opens                                             AS p_opens,
    p_.unique_clicks                                            AS p_clicks,
    p_.unique_clicks_cta                                        AS p_clicks_cta,
    p_.unique_clicks_baja                                       AS p_clicks_baja,
    p_.unique_clicks_medidos                                    AS p_clicks_medidos,
    p_.unique_unsubs                                            AS p_unsubs,
    ROUND(CAST(p_.unique_opens AS DOUBLE)
          / NULLIF(p_.deliveries, 0) * 100, 2)                 AS p_open_rate,
    ROUND(CAST(p_.unique_clicks AS DOUBLE)
          / NULLIF(p_.unique_opens, 0) * 100, 2)               AS p_ctor,
    ROUND(CAST(p_.unique_clicks AS DOUBLE)
          / NULLIF(p_.deliveries, 0) * 100, 2)                 AS p_click_rate,
    ROUND(CAST(p_.unique_unsubs AS DOUBLE)
          / NULLIF(p_.unique_opens, 0) * 100, 2)               AS p_utor,

    -- ── FUP: identificadores ────────────────────────────────────────────────────
    f.pieza_id                                                  AS fup_pieza_id,
    f.email_name                                                AS email_name_fup,
    f.subject                                                   AS subject_fup,
    f.quincena                                                  AS quincena_fup,
    f.primera_fecha                                             AS fecha_envio_fup,

    -- ── FUP: métricas de envío ──────────────────────────────────────────────────
    f.sends                                                     AS fup_sends,
    f.deliveries                                                AS fup_deliveries,
    f.unique_opens                                              AS fup_opens,
    f.unique_clicks                                             AS fup_clicks,
    f.unique_clicks_cta                                         AS fup_clicks_cta,
    f.unique_clicks_baja                                        AS fup_clicks_baja,
    f.unique_clicks_medidos                                     AS fup_clicks_medidos,
    f.unique_unsubs                                             AS fup_unsubs,
    ROUND(CAST(f.unique_opens AS DOUBLE)
          / NULLIF(f.deliveries, 0) * 100, 2)                  AS fup_open_rate,
    ROUND(CAST(f.unique_clicks AS DOUBLE)
          / NULLIF(f.unique_opens, 0) * 100, 2)                AS fup_ctor,
    ROUND(CAST(f.unique_clicks AS DOUBLE)
          / NULLIF(f.deliveries, 0) * 100, 2)                  AS fup_click_rate,
    ROUND(CAST(f.unique_unsubs AS DOUBLE)
          / NULLIF(f.unique_opens, 0) * 100, 2)                AS fup_utor,

    -- ── Totales Principal + FUP ─────────────────────────────────────────────────
    COALESCE(p_.sends,         0) + COALESCE(f.sends,         0) AS tot_sends,
    COALESCE(p_.deliveries,    0) + COALESCE(f.deliveries,    0) AS tot_deliveries,
    COALESCE(p_.unique_opens,  0) + COALESCE(f.unique_opens,  0) AS tot_opens,
    COALESCE(p_.unique_clicks, 0) + COALESCE(f.unique_clicks, 0) AS tot_clicks,
    COALESCE(p_.unique_clicks_cta,     0) + COALESCE(f.unique_clicks_cta,     0) AS tot_clicks_cta,
    COALESCE(p_.unique_clicks_baja,    0) + COALESCE(f.unique_clicks_baja,    0) AS tot_clicks_baja,
    COALESCE(p_.unique_clicks_medidos, 0) + COALESCE(f.unique_clicks_medidos, 0) AS tot_clicks_medidos,
    COALESCE(p_.unique_unsubs, 0) + COALESCE(f.unique_unsubs, 0) AS tot_unsubs,
    ROUND(
        CAST(COALESCE(p_.unique_opens, 0) + COALESCE(f.unique_opens, 0) AS DOUBLE)
        / NULLIF(COALESCE(p_.deliveries, 0) + COALESCE(f.deliveries, 0), 0) * 100, 2
    )                                                           AS tot_open_rate,
    ROUND(
        CAST(COALESCE(p_.unique_clicks, 0) + COALESCE(f.unique_clicks, 0) AS DOUBLE)
        / NULLIF(COALESCE(p_.unique_opens, 0) + COALESCE(f.unique_opens, 0), 0) * 100, 2
    )                                                           AS tot_ctor,
    ROUND(
        CAST(COALESCE(p_.unique_clicks, 0) + COALESCE(f.unique_clicks, 0) AS DOUBLE)
        / NULLIF(COALESCE(p_.deliveries, 0) + COALESCE(f.deliveries, 0), 0) * 100, 2
    )                                                           AS tot_click_rate,
    ROUND(
        CAST(COALESCE(p_.unique_unsubs, 0) + COALESCE(f.unique_unsubs, 0) AS DOUBLE)
        / NULLIF(COALESCE(p_.unique_opens, 0) + COALESCE(f.unique_opens, 0), 0) * 100, 2
    )                                                           AS tot_utor,

    CAST(TO_UNIXTIME(NOW()) AS BIGINT)                        AS time

FROM principals p_

-- Dimensiones
JOIN nmx_catalogo.dim_campana          dc  ON dc.campana_id    = p_.campana_id
JOIN nmx_catalogo.dim_marca            dm  ON dm.marca_id      = p_.marca_id
JOIN nmx_catalogo.dim_bu               db  ON db.bu_id         = p_.bu_id
JOIN nmx_catalogo.dim_objetivo         do_ ON do_.objetivo_id  = p_.objetivo_id
JOIN nmx_catalogo.dim_touchpoint_brief dt  ON dt.touchpoint_id = p_.touchpoint_id

-- Segmento (bridge table — agregado para evitar multiplicación de filas)
LEFT JOIN (
    SELECT ps2.pieza_id,
           ARRAY_JOIN(ARRAY_SORT(ARRAY_AGG(DISTINCT ds2.segmento_nombre)), ' / ') AS segmento_nombre
    FROM nmx_catalogo.pieza_segmento ps2
    JOIN nmx_catalogo.dim_segmento ds2 ON ds2.segmento_id = ps2.segmento_id
    GROUP BY ps2.pieza_id
) seg ON seg.pieza_id = p_.pieza_id

-- Indicador Qcart
LEFT JOIN (
    SELECT DISTINCT pieza_id FROM nmx_catalogo.dim_shortlink
    WHERE estado_link = 'USADO'
) sl ON sl.pieza_id = p_.pieza_id

-- FUP correspondiente: mismo Principal, mismo mes
LEFT JOIN fups f
    ON  f.pieza_principal_id = p_.pieza_id
    AND f.mes                = p_.mes
