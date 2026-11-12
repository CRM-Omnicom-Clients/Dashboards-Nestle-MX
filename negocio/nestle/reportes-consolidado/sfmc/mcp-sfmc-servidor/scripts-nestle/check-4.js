// check-4 — ¿estan las 4 piezas de Espresso en el catalogo y con envios reales?
const Q = require('./qd.js');
const { leerDE } = require('./leer.js');
const https = require('https');
const H = u => new URL(u).host;
const n = v => Number(v || 0);

const PIEZAS = [
  'O_Nescafe-Espresso-Con-NC004682_1_IBS_CFEE_NESC_NCF_AAGW_MX_ES_Concentrate_AC_EM_A_V1_001577',
  'O_Nescafe-Espresso-Con-NC004682_2_IBS_CFEE_NESC_NCF_AAGW_MX_ES_Concentrate_AC_EM_B_V2_001576',
  'O_Nescafe-Espresso-Con-NC004682_2_IBS_CFEE_NESC_NCF_AAGW_MX_ES_NA_AC_EM_B_V2_024241',
  'O_Nescafe-Espresso-Con-NC004682_1_IBS_CFEE_NESC_NCF_AAGW_MX_ES_NA_AC_EM_C_V3_024242',
];

async function mkDE(nombre, campos) {
  const r = await Q.rest('/data/v1/customobjects', 'POST', { name: nombre, key: '', isSendable: false, categoryId: 445199, fields: campos.map((f, i) => { const o = { name: f.name, type: f.type, ordinal: i + 1, IsPrimaryKey: !!f.pk, isNullable: !f.pk, isTemplateField: false, isInheritable: true, isOverridable: true, isHidden: false, isReadOnly: false, mustOverride: false }; if (f.length) o.length = f.length; return o; }) });
  if (r.status < 300 && r.json?.key) return r.json.key;
  const tok = await Q.init(); const SOAP = H(Q.env.SFMC_SOAP_URL);
  const b = `<?xml version="1.0"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"><s:Header><a:Action s:mustUnderstand="1">Retrieve</a:Action><a:To s:mustUnderstand="1">https://${SOAP}/Service.asmx</a:To><fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header><s:Body><RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><RetrieveRequest><ObjectType>DataExtension</ObjectType><Properties>CustomerKey</Properties><Filter xsi:type="SimpleFilterPart"><Property>Name</Property><SimpleOperator>equals</SimpleOperator><Value>${nombre}</Value></Filter></RetrieveRequest></RetrieveRequestMsg></s:Body></s:Envelope>`;
  const xd = await new Promise(res => { const q = https.request({ host: SOAP, path: '/Service.asmx', method: 'POST', timeout: 60000, headers: { 'Content-Type': 'text/xml', SOAPAction: 'Retrieve', 'Content-Length': Buffer.byteLength(b) } }, rr => { let d = ''; rr.on('data', c => d += c); rr.on('end', () => res(d)); }); q.on('error', () => res('')); q.write(b); q.end(); });
  return (/<CustomerKey>([^<]+)/.exec(xd) || [])[1];
}

(async () => {
  await Q.init();
  // 1) en el catalogo?
  const cfg = await leerDE('CRM_Reporte_Config', ['ConfigKey', 'ContentName']);
  console.log('=== en CRM_Reporte_Config ===');
  const enCat = {};
  for (const p of PIEZAS) { const f = cfg.filas.find(x => String(x.ContentName).trim() === p); enCat[p] = f ? f.ConfigKey : null; console.log('  ' + (f ? 'SI (' + f.ConfigKey + ')' : 'NO') + '  ' + p.slice(-42)); }

  // 2) envios reales? (una query de sondeo)
  const key = await mkDE('CRM_Tmp_Chk', [{ name: 'Nom', type: 'Text', length: 200, pk: true }, { name: 'EmailID', type: 'Number' }, { name: 'Sends', type: 'Number' }, { name: 'MaxDay', type: 'Date' }]);
  const inList = PIEZAS.map(p => `'${p.replace(/'/g, "''")}'`).join(',');
  const SQL = `SELECT RTRIM(j.EmailName) AS Nom, MAX(j.EmailID) AS EmailID, COUNT(*) AS Sends, CONVERT(date,MAX(s.EventDate)) AS MaxDay
    FROM _Sent s INNER JOIN _Job j ON j.JobID = s.JobID
    WHERE s.EventDate >= '2026-01-01' AND RTRIM(j.EmailName) IN (${inList})
    GROUP BY RTRIM(j.EmailName)`;
  let qd = await Q.buscarPorKey('CRM_Tmp_Chk_Load');
  const cuerpo = { name: 'CRM_Tmp_Chk_Load', key: 'CRM_Tmp_Chk_Load', description: 'chk', queryText: SQL, targetName: 'CRM_Tmp_Chk', targetKey: key, targetUpdateTypeId: 0, categoryId: 460279 };
  if (qd) await Q.actualizar(qd.queryDefinitionId, { ...cuerpo, queryDefinitionId: qd.queryDefinitionId }); else qd = (await Q.crear(cuerpo)).json;
  await Q.correr(qd.queryDefinitionId);
  let env = [];
  for (let i = 0; i < 25; i++) { await new Promise(r => setTimeout(r, 8000)); const r = await leerDE('CRM_Tmp_Chk', ['Nom', 'EmailID', 'Sends', 'MaxDay']); if (!r.error && r.filas.length) { env = r.filas; break; } process.stdout.write('  ' + (i * 8) + 's...\r'); }
  console.log('\n=== envios reales en SFMC ===');
  const envDe = {};
  for (const p of PIEZAS) { const e = env.find(x => x.Nom === p); envDe[p] = e; console.log('  ' + (e ? 'asset=' + e.EmailID + '  ' + n(e.Sends) + ' env  ' + String(e.MaxDay).slice(0, 10) : 'SIN ENVIOS') + '  ' + p.slice(-42)); }

  // 3) resumen
  console.log('\n=== RESUMEN ===');
  const faltan = PIEZAS.filter(p => !enCat[p] && envDe[p] && n(envDe[p].Sends) > 0);
  const enCatCount = PIEZAS.filter(p => enCat[p]).length;
  console.log('  en el catalogo: ' + enCatCount + '/4');
  console.log('  faltan (con envios, hay que agregar): ' + faltan.length);
  for (const p of faltan) console.log('    -> ' + p.slice(-42) + '  (asset ' + envDe[p].EmailID + ', ' + n(envDe[p].Sends) + ' env)');

  require('fs').writeFileSync('faltan-4.json', JSON.stringify(faltan.map(p => ({ nom: p, id: envDe[p].EmailID, sends: n(envDe[p].Sends) })), null, 1));

  // limpiar temp
  const q2 = await Q.buscarPorKey('CRM_Tmp_Chk_Load'); if (q2) await Q.borrar(q2.queryDefinitionId);
  const SOAP = H(Q.env.SFMC_SOAP_URL); const tok = await Q.init();
  const del = `<?xml version="1.0"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"><s:Header><a:Action s:mustUnderstand="1">Delete</a:Action><a:To s:mustUnderstand="1">https://${SOAP}/Service.asmx</a:To><fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header><s:Body><DeleteRequest xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Objects xsi:type="DataExtension"><CustomerKey>${key}</CustomerKey></Objects></DeleteRequest></s:Body></s:Envelope>`;
  await new Promise(r => { const q = https.request({ host: SOAP, path: '/Service.asmx', method: 'POST', timeout: 60000, headers: { 'Content-Type': 'text/xml', SOAPAction: 'Delete', 'Content-Length': Buffer.byteLength(del) } }, rr => { let d = ''; rr.on('data', c => d += c); rr.on('end', () => r(d)); }); q.on('error', () => r('')); q.write(del); q.end(); });
})();
