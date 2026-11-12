// resolver-dup.js — resuelve los 2 ContentName duplicados de AON.
// P025 y P027 son las filas de ABRIL pero traen el ContentName de MARZO (igual que P005/P006).
// Se corrigen a su nombre real de abril (PURCHASE-EP1 / FUP-PURCHASE-EP1), lo que:
//   (a) elimina el ContentName duplicado -> ContentName queda como llave unica
//   (b) da su fila a las piezas de abril que hoy no se reportan
// El patron es identico al que ya tienen P023/P024/P026/P028 (segmento marzo + nombre abril).
const Q = require('./qd.js');
const { leerDE } = require('./leer.js');
const https = require('https');
const H = u => new URL(u).host;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const n = v => Number(v || 0);
const CFG_KEY = '03A9BE5F-0C95-4901-BEB9-3A3BEBF77C6D';

async function mkDE(nombre, campos) {
  const r = await Q.rest('/data/v1/customobjects', 'POST', { name: nombre, key: '', isSendable: false, categoryId: 445199, fields: campos.map((f, i) => { const o = { name: f.name, type: f.type, ordinal: i + 1, IsPrimaryKey: !!f.pk, isNullable: !f.pk, isTemplateField: false, isInheritable: true, isOverridable: true, isHidden: false, isReadOnly: false, mustOverride: false }; if (f.length) o.length = f.length; return o; }) });
  if (r.status < 300 && r.json?.key) return r.json.key;
  const tok = await Q.init(); const SOAP = H(Q.env.SFMC_SOAP_URL);
  const b = `<?xml version="1.0"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"><s:Header><a:Action s:mustUnderstand="1">Retrieve</a:Action><a:To s:mustUnderstand="1">https://${SOAP}/Service.asmx</a:To><fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header><s:Body><RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><RetrieveRequest><ObjectType>DataExtension</ObjectType><Properties>CustomerKey</Properties><Filter xsi:type="SimpleFilterPart"><Property>Name</Property><SimpleOperator>equals</SimpleOperator><Value>${nombre}</Value></Filter></RetrieveRequest></RetrieveRequestMsg></s:Body></s:Envelope>`;
  const xd = await new Promise(res => { const q = https.request({ host: SOAP, path: '/Service.asmx', method: 'POST', timeout: 60000, headers: { 'Content-Type': 'text/xml', SOAPAction: 'Retrieve', 'Content-Length': Buffer.byteLength(b) } }, rr => { let d = ''; rr.on('data', c => d += c); rr.on('end', () => res(d)); }); q.on('error', () => res('')); q.write(b); q.end(); });
  return (/<CustomerKey>([^<]+)<\/CustomerKey>/.exec(xd) || [])[1];
}

(async () => {
  const tok = await Q.init();
  const SOAP = H(Q.env.SFMC_SOAP_URL);
  const soap = (accion, inner, msg) => new Promise(res => {
    const b = `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"><s:Header><a:Action s:mustUnderstand="1">${accion}</a:Action><a:To s:mustUnderstand="1">https://${SOAP}/Service.asmx</a:To><fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header><s:Body><${msg} xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${inner}</${msg}></s:Body></s:Envelope>`;
    const q = https.request({ host: SOAP, path: '/Service.asmx', method: 'POST', timeout: 120000, headers: { 'Content-Type': 'text/xml', SOAPAction: accion, 'Content-Length': Buffer.byteLength(b) } }, rr => { let d = ''; rr.on('data', c => d += c); rr.on('end', () => res(d)); });
    q.on('error', e => res('ERR ' + e.message)); q.write(b); q.end();
  });

  // --- estado actual de las 4 filas ---
  const cfg = await leerDE('CRM_Reporte_Config', ['ConfigKey', 'ContentName', 'EmailID', 'Segmento', 'Touchpoint']);
  console.log('== ANTES ==');
  for (const k of ['001-P005', '001-P025', '001-P006', '001-P027']) {
    const f = cfg.filas.find(x => x.ConfigKey === k);
    console.log('  ' + k + '  asset=' + f.EmailID + '  ' + String(f.ContentName).slice(-46));
  }

  // --- sondear los nombres de abril exactos ---
  const key = await mkDE('CRM_Tmp_Ab', [{ name: 'Nom', type: 'Text', length: 200, pk: true }, { name: 'EmailID', type: 'Number' }, { name: 'Sends', type: 'Number' }]);
  const SQL = `SELECT RTRIM(j.EmailName) AS Nom, MAX(j.EmailID) AS EmailID, COUNT(*) AS Sends
    FROM _Sent s INNER JOIN _Job j ON j.JobID = s.JobID
    WHERE s.EventDate >= '2026-01-01' AND (RTRIM(j.EmailName) LIKE '%_ES_PURCHASE-EP1_AC_EM_A_V1_863587' OR RTRIM(j.EmailName) LIKE '%_ES_FUP-PURCHASE-EP1_AC_EM_A_V1_863587')
    GROUP BY RTRIM(j.EmailName)`;
  const QK = 'CRM_Tmp_Ab_Load';
  let qd = await Q.buscarPorKey(QK);
  const cuerpo = { name: QK, key: QK, description: 'temp abril', queryText: SQL, targetName: 'CRM_Tmp_Ab', targetKey: key, targetUpdateTypeId: 0, categoryId: 460279 };
  if (qd) await Q.actualizar(qd.queryDefinitionId, { ...cuerpo, queryDefinitionId: qd.queryDefinitionId }); else qd = (await Q.crear(cuerpo)).json;
  await Q.correr(qd.queryDefinitionId);
  let abril = [];
  for (let i = 0; i < 25; i++) { await new Promise(r => setTimeout(r, 8000)); const r = await leerDE('CRM_Tmp_Ab', ['Nom', 'EmailID', 'Sends']); if (!r.error && r.filas.length) { abril = r.filas; break; } }
  console.log('\n== piezas de abril encontradas ==');
  for (const f of abril) console.log('  asset=' + f.EmailID + '  ' + fmt(f.Sends) + '  ' + f.Nom.slice(-40));

  const ep1 = abril.find(f => /_ES_PURCHASE-EP1_/.test(f.Nom));
  const fup = abril.find(f => /_ES_FUP-PURCHASE-EP1_/.test(f.Nom));
  if (!ep1 || !fup) { console.log('\nNO se encontraron ambos nombres de abril. Aborto sin cambiar nada.'); return; }

  // --- actualizar P025 y P027 ---
  const cambios = [
    { ck: '001-P025', nom: ep1.Nom, id: ep1.EmailID },
    { ck: '001-P027', nom: fup.Nom, id: fup.EmailID },
  ];
  console.log('\n== aplicando cambios ==');
  for (const c of cambios) {
    const obj = `<Objects xsi:type="DataExtensionObject"><CustomerKey>${CFG_KEY}</CustomerKey><Keys><Key><Name>ConfigKey</Name><Value>${c.ck}</Value></Key></Keys><Properties>` +
      `<Property><Name>ContentName</Name><Value>${esc(c.nom)}</Value></Property>` +
      `<Property><Name>EmailID</Name><Value>${c.id}</Value></Property>` +
      `<Property><Name>Notas</Name><Value>${esc('Oleada ABRIL (journey 863587). ContentName corregido de marzo->abril para quitar el duplicado. Segmento heredado como P023/P024/P026/P028.')}</Value></Property>` +
      `</Properties></Objects>`;
    const x = await soap('Update', '<Options/>' + obj, 'UpdateRequest');
    console.log('  ' + c.ck + ' -> ' + c.nom.slice(-34) + '  : ' + (/<OverallStatus>([^<]+)/.exec(x) || [])[1]);
  }

  // --- validar: sin duplicados ---
  const c2 = await leerDE('CRM_Reporte_Config', ['ConfigKey', 'ContentName']);
  const byCN = {}; for (const f of c2.filas) { const kk = String(f.ContentName).trim(); (byCN[kk] = byCN[kk] || []).push(f.ConfigKey); }
  const dup = Object.entries(byCN).filter(([, v]) => v.length > 1);
  console.log('\n== DESPUES ==');
  console.log('  ContentNames duplicados: ' + dup.length + (dup.length ? '  ' + JSON.stringify(dup) : '  ✓ ninguno'));
  console.log('  ContentName seria PK valida ahora: ' + (dup.length === 0 ? 'SÍ' : 'no'));

  // limpiar temp
  const q2 = await Q.buscarPorKey(QK); if (q2) await Q.borrar(q2.queryDefinitionId);
  await soap('Delete', `<Objects xsi:type="DataExtension"><CustomerKey>${key}</CustomerKey></Objects>`, 'DeleteRequest');
  console.log('\n  temp borrada. Los cambios entran al reporte en la proxima corrida de la automation.');
})();
function fmt(v) { return Number(v || 0).toLocaleString('es-MX'); }
