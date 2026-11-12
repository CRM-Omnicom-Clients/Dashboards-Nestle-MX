// fix-links — Link_Name ya no viene vacio: si SFMC no da LinkName, se deriva del URL
// (dominio + ruta, sin AMPscript ni querystring). Ademas Link_URL se limpia al destino real.
const Q = require('./qd.js');
const { leerDE } = require('./leer.js');
const n = v => Number(v || 0);

// expresion T-SQL que extrae la URL real de un click (dentro de AMPscript o directa).
// Toma desde 'http' hasta la primera comilla simple; si no hay 'http', deja el valor tal cual.
// La comilla literal en T-SQL se escribe con 4 comillas ('''').
const URLREAL = `
      CASE WHEN CHARINDEX('http', RTRIM(k.URL)) > 0
        THEN SUBSTRING(RTRIM(k.URL),
               CHARINDEX('http', RTRIM(k.URL)),
               CHARINDEX('''', RTRIM(k.URL) + '''', CHARINDEX('http', RTRIM(k.URL)))
                 - CHARINDEX('http', RTRIM(k.URL)))
        ELSE RTRIM(k.URL) END`.trim();

// etiqueta amigable a partir de la URL real: quita protocolo/www y el querystring
const LABEL = `
      LEFT(REPLACE(REPLACE(REPLACE(
        CASE WHEN CHARINDEX('?', MAX(${URLREAL})) > 0
             THEN LEFT(MAX(${URLREAL}), CHARINDEX('?', MAX(${URLREAL})) - 1)
             ELSE MAX(${URLREAL}) END
      , 'https://', ''), 'http://', ''), 'www.', ''), 120)`.trim();

const SQL = `
/*  CRM_Email_Links — clicks por link/boton por pieza, filtrado por catalogo.
    Link_Name: el nombre del boton en SFMC; si viene vacio (57% de los links no traen
    LinkName), se deriva del destino (dominio + ruta). Link_URL: destino limpio (sin AMPscript). */
SELECT
    LEFT(c.ConfigKey + '|' + RTRIM(k.URL), 400)  AS RowKey,
    MAX(c.ConfigKey)                             AS ConfigKey,
    MAX(c.Campana)                               AS Campana,
    MAX(c.Touchpoint)                            AS Touchpoint,
    MAX(c.Segmento)                              AS Segmento,
    MAX(RTRIM(j.EmailName))                      AS Email_Content_Name,
    MAX(RTRIM(j.EmailSubject))                   AS Email_Subject,
    MAX(j.EmailID)                               AS Email_ID,
    CASE WHEN MAX(RTRIM(k.LinkName)) <> '' THEN MAX(RTRIM(k.LinkName))
         ELSE ${LABEL} END                       AS Link_Name,
    LEFT(MAX(${URLREAL}), 500)                   AS Link_URL,
    COUNT(*)                                     AS Clicks_Total,
    COUNT(DISTINCT k.SubscriberID)               AS Clicks_Unique,
    GETDATE()                                    AS LastRefresh
FROM _Click k
INNER JOIN _Job j ON j.JobID = k.JobID
INNER JOIN CRM_Reporte_Config c
        ON RTRIM(j.EmailName) = c.ContentName AND c.Activo = 'Si'
WHERE k.EventDate >= '2026-03-01'
GROUP BY c.ConfigKey, LEFT(RTRIM(k.URL), 500), LEFT(c.ConfigKey + '|' + RTRIM(k.URL), 400)
`.trim();

(async () => {
  await Q.init();
  const abre = (SQL.match(/\(/g) || []).length, cierra = (SQL.match(/\)/g) || []).length;
  console.log('parentesis: ' + abre + '/' + cierra + (abre === cierra ? ' OK' : ' DESCUADRE'));

  const qd = await Q.buscarPorKey('CRM_Email_Links_Load');
  const u = await Q.actualizar(qd.queryDefinitionId, { name: 'CRM_Email_Links_Load', key: 'CRM_Email_Links_Load',
    description: 'Clicks por link/boton por pieza. Link_Name deriva del URL si SFMC no lo da. Mantenida por Hive.',
    queryText: SQL, targetName: 'CRM_Email_Links', targetKey: '608FD76A-3398-4AAE-9269-A3C6B0D95810',
    targetUpdateTypeId: 0, categoryId: 460279, queryDefinitionId: qd.queryDefinitionId });
  console.log('PATCH HTTP ' + u.status + (u.status >= 300 ? '  ' + String(u.raw).replace(/\s+/g, ' ').slice(0, 400) : ''));
  if (u.status >= 300) return;

  // correr Links (independiente) y validar
  const r0 = await leerDE('CRM_Email_Links', ['LastRefresh']);
  const antes = [...new Set(r0.filas.map(f => String(f.LastRefresh)))][0];
  await Q.correr(qd.queryDefinitionId);
  let f = [];
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 9000));
    const r = await leerDE('CRM_Email_Links', ['RowKey', 'Link_Name', 'Link_URL', 'Clicks_Total', 'LastRefresh']);
    if (r.error) continue; f = r.filas;
    const ts = [...new Set(f.map(x => String(x.LastRefresh)))];
    if (ts.length === 1 && ts[0] !== antes && new Set(f.map(x => x.RowKey)).size === f.length) break;
    process.stdout.write('  ' + (i * 9) + 's...\r');
  }
  const con = f.filter(x => String(x.Link_Name || '').trim()).length;
  console.log('\n\ntotal links: ' + f.length + '   con Link_Name: ' + con + '  (' + Math.round(100 * con / f.length) + '%)');
  console.log('\n=== muestra (top clicks) — ahora con etiqueta ===');
  for (const x of f.sort((a, b) => n(b.Clicks_Total) - n(a.Clicks_Total)).slice(0, 14))
    console.log('  ' + String(n(x.Clicks_Total)).padStart(6) + '  [' + String(x.Link_Name || '(vacío)').slice(0, 34).padEnd(34) + ']  ' + String(x.Link_URL).slice(0, 46));
  console.log('\nFIX: ' + (con === f.length ? 'OK — Link_Name ya nunca viene vacío' : (f.length - con) + ' aún vacíos'));
})();
