// add-pieza.js — agrega UNA pieza a todo el sistema SIN refrescar las DEs de reporte.
// 1) sondea (DE temporal) EmailID + Sends + Journey_UUID + Subject
// 2) la agrega a CRM_Reporte_Config (anclada por ContentName, key provisional)
// 3) si es journey: resuelve su DE de audiencia + volumen y la agrega a CRM_Audiencias
//    (si la DE de audiencia es nueva, regenera CRM_Audiencias_Vol_Load)
// NO corre Detalle/Piezas/Auditoria/Links: eso lo hara la automation.
const Q = require('./qd.js');
const { leerDE } = require('./leer.js');
const https = require('https');
const fs = require('fs');
const H = u => new URL(u).host;

// crearDE inline (el scratchpad se limpia y crear-de.js desaparece): crea la DE y
// devuelve su CustomerKey, leyendolo del POST (201) o por SOAP si ya existia (409).
async function crearDE(nombre, campos) {
  await Q.init();
  const r = await Q.rest('/data/v1/customobjects', 'POST', {
    name: nombre, key: '', isSendable: false, categoryId: 445199,
    fields: campos.map((f, i) => { const o = { name: f.name, type: f.type, ordinal: i + 1, IsPrimaryKey: !!f.pk, isNullable: !f.pk, isTemplateField: false, isInheritable: true, isOverridable: true, isHidden: false, isReadOnly: false, mustOverride: false }; if (f.length) o.length = f.length; if (f.scale !== undefined) o.scale = f.scale; return o; }),
  });
  if (r.status < 300 && r.json?.key) return { nombre, key: r.json.key };
  // ya existia -> buscar CustomerKey por SOAP
  const tok = await Q.init(); const SOAP = H(Q.env.SFMC_SOAP_URL);
  const b = `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"><s:Header><a:Action s:mustUnderstand="1">Retrieve</a:Action><a:To s:mustUnderstand="1">https://${SOAP}/Service.asmx</a:To><fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header><s:Body><RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><RetrieveRequest><ObjectType>DataExtension</ObjectType><Properties>CustomerKey</Properties><Filter xsi:type="SimpleFilterPart"><Property>Name</Property><SimpleOperator>equals</SimpleOperator><Value>${nombre}</Value></Filter></RetrieveRequest></RetrieveRequestMsg></s:Body></s:Envelope>`;
  const xd = await new Promise(res => { const q = https.request({ host: SOAP, path: '/Service.asmx', method: 'POST', timeout: 60000, headers: { 'Content-Type': 'text/xml', SOAPAction: 'Retrieve', 'Content-Length': Buffer.byteLength(b) } }, rr => { let d = ''; rr.on('data', c => d += c); rr.on('end', () => res(d)); }); q.on('error', () => res('')); q.write(b); q.end(); });
  const ck = (/<CustomerKey>([^<]+)<\/CustomerKey>/.exec(xd) || [])[1];
  return ck ? { nombre, key: ck } : null;
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const n = v => Number(v || 0);

const NOMBRE = 'O_Nescafe-Espresso-Con-NC004682_1_IBS_CFEE_NESC_NCF_AAGW_MX_ES_NA_AC_EM_C_V3_024242';
const CK = 'TMP-NESC-ESPRESSO-V3';
const DIM = { BU: 'Nescafé*', Marca: 'Nescafé*', Campana: 'Espresso Con*', Touchpoint: 'E-A*', Segmento: '(por definir)*', EmailType: 'Principal', CodigoNC: 'NC004682' };
const CFG_KEY = '03A9BE5F-0C95-4901-BEB9-3A3BEBF77C6D';
const AUD_KEY = 'F4811FBB-1BB6-4BD0-85EF-EBE08A97CB08';

(async () => {
  const tok = await Q.init();
  const SOAP = H(Q.env.SFMC_SOAP_URL);
  const soap = (accion, inner, msg) => new Promise(res => {
    const b = `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"><s:Header><a:Action s:mustUnderstand="1">${accion}</a:Action><a:To s:mustUnderstand="1">https://${SOAP}/Service.asmx</a:To><fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header><s:Body><${msg} xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${inner}</${msg}></s:Body></s:Envelope>`;
    const q = https.request({ host: SOAP, path: '/Service.asmx', method: 'POST', timeout: 120000, headers: { 'Content-Type': 'text/xml', SOAPAction: accion, 'Content-Length': Buffer.byteLength(b) } }, rr => { let d = ''; rr.on('data', c => d += c); rr.on('end', () => res(d)); });
    q.on('error', e => res('ERR ' + e.message)); q.write(b); q.end();
  });

  // ---- 1. sondeo ----
  console.log('== 1. sondeo de la pieza ==');
  const DE = 'CRM_Tmp_Pieza', QK = 'CRM_Tmp_Pieza_Load';
  const de = await crearDE(DE, [{ name: 'K', type: 'Text', length: 5, pk: true }, { name: 'EmailID', type: 'Number' }, { name: 'Sends', type: 'Number' }, { name: 'MinDay', type: 'Date' }, { name: 'MaxDay', type: 'Date' }, { name: 'Subject', type: 'Text', length: 200 }, { name: 'JourneyUUID', type: 'Text', length: 60 }]);
  const dekey = de ? de.key : null;
  const SQL = `SELECT 'x' AS K, MAX(j.EmailID) AS EmailID, COUNT(*) AS Sends,
    CONVERT(date,MIN(s.EventDate)) AS MinDay, CONVERT(date,MAX(s.EventDate)) AS MaxDay,
    MAX(RTRIM(j.EmailSubject)) AS Subject, MAX(jr.JourneyID) AS JourneyUUID
    FROM _Sent s INNER JOIN _Job j ON j.JobID = s.JobID
    LEFT JOIN _JourneyActivity ja ON ja.JourneyActivityObjectID = j.TriggererSendDefinitionObjectID
    LEFT JOIN _Journey jr ON jr.VersionID = ja.VersionID
    WHERE s.EventDate >= '2026-01-01' AND RTRIM(j.EmailName) = '${esc(NOMBRE).replace(/&apos;/g, "''")}'`;
  let qd = await Q.buscarPorKey(QK);
  const cuerpo = { name: QK, key: QK, description: 'temp sondeo pieza', queryText: SQL, targetName: DE, targetKey: dekey, targetUpdateTypeId: 0, categoryId: 460279 };
  if (qd) await Q.actualizar(qd.queryDefinitionId, { ...cuerpo, queryDefinitionId: qd.queryDefinitionId });
  else qd = (await Q.crear(cuerpo)).json;
  await Q.correr(qd.queryDefinitionId);
  let row = null;
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 8000)); const r = await leerDE(DE, ['K', 'EmailID', 'Sends', 'MinDay', 'MaxDay', 'Subject', 'JourneyUUID']); if (!r.error && r.filas.length) { row = r.filas[0]; break; } process.stdout.write('  ' + (i * 8) + 's...\r'); }
  if (!row || n(row.Sends) === 0) { console.log('\n  NO se encontraron envios con ese nombre. Aborto.'); return; }
  console.log('\n  EmailID=' + row.EmailID + '  Sends=' + fmt(row.Sends) + '  fechas ' + String(row.MinDay).slice(0, 10) + '→' + String(row.MaxDay).slice(0, 10));
  console.log('  Journey_UUID=' + (row.JourneyUUID || '(one-shot, sin journey)'));
  console.log('  Subject: ' + String(row.Subject || '').replace(/%%\[[\s\S]*?\]%%/g, '').trim().slice(0, 60));

  // ---- 2. agregar a CRM_Reporte_Config ----
  console.log('\n== 2. agregar a CRM_Reporte_Config ==');
  const existe = (await leerDE('CRM_Reporte_Config', ['ConfigKey'])).filas.some(f => f.ConfigKey === CK);
  if (existe) console.log('  ya existía ' + CK + ' — se omite el insert');
  else {
    const props = { ConfigKey: CK, PiezaID: '*por definir', EmailName: NOMBRE, ContentName: NOMBRE, CodigoNC: DIM.CodigoNC, BU: DIM.BU, Marca: DIM.Marca, Campana: DIM.Campana, Touchpoint: DIM.Touchpoint, Segmento: DIM.Segmento, EmailType: DIM.EmailType, Estado: 'Confirmado', Activo: 'Si', Notas: 'PROVISIONAL - variante C/V3 de Espresso Con. Dimensiones * inferidas.', EmailID: row.EmailID };
    const obj = `<Objects xsi:type="DataExtensionObject"><CustomerKey>${CFG_KEY}</CustomerKey><Properties>` + Object.entries(props).map(([k, v]) => `<Property><Name>${k}</Name><Value>${esc(v)}</Value></Property>`).join('') + `</Properties></Objects>`;
    const x = await soap('Create', obj, 'CreateRequest');
    console.log('  ' + (/<OverallStatus>([^<]+)/.exec(x) || [])[1] + ' · ' + (/<StatusMessage>([^<]+)/.exec(x) || [])[1]);
  }

  // ---- 3. audiencia (si journey) ----
  console.log('\n== 3. DE de audiencia ==');
  if (!String(row.JourneyUUID || '').trim()) {
    console.log('  one-shot sin journey: no tiene entry DE. (queda sin audiencia, como 009-P005)');
  } else {
    const inter = await Q.rest('/interaction/v1/interactions/' + row.JourneyUUID + '?extras=all', 'GET');
    const edId = (inter.json?.triggers || [])[0]?.metaData?.eventDefinitionId;
    let deName = null, vol = null;
    if (edId) { const ed = await Q.rest('/interaction/v1/eventDefinitions/' + edId, 'GET'); deName = ed.json?.dataExtensionName || null; }
    console.log('  DE de audiencia: ' + (deName || '(no resuelta)'));
    if (deName) {
      // volumen por COUNT
      const CDE = 'CRM_Tmp_Pieza', CQK = 'CRM_Tmp_Pieza_Load';   // reuso la temp (otra columna)
      const cq = `SELECT 'x' AS K, 0 AS EmailID, COUNT(*) AS Sends, CONVERT(date,GETDATE()) AS MinDay, CONVERT(date,GETDATE()) AS MaxDay, '' AS Subject, '' AS JourneyUUID FROM [${deName}]`;
      await Q.actualizar(qd.queryDefinitionId, { name: CQK, key: CQK, description: 'temp count', queryText: cq, targetName: CDE, targetKey: dekey, targetUpdateTypeId: 0, categoryId: 460279, queryDefinitionId: qd.queryDefinitionId });
      await Q.correr(qd.queryDefinitionId);
      for (let i = 0; i < 25; i++) { await new Promise(r => setTimeout(r, 8000)); const r = await leerDE(CDE, ['Sends']); if (!r.error && r.filas.length) { vol = n(r.filas[0].Sends); break; } }
      console.log('  volumen: ' + (vol !== null ? fmt(vol) : '(no obtenido)'));
      // agregar/actualizar en CRM_Audiencias
      const props = { ConfigKey: CK, Journey_UUID: row.JourneyUUID, Audience_DE: deName, Audience_Volume: vol ?? '' };
      const obj = `<Objects xsi:type="DataExtensionObject"><CustomerKey>${AUD_KEY}</CustomerKey><Keys><Key><Name>ConfigKey</Name><Value>${esc(CK)}</Value></Key></Keys><Properties>` + Object.entries(props).filter(([k]) => k !== 'ConfigKey').map(([k, v]) => `<Property><Name>${k}</Name><Value>${esc(v)}</Value></Property>`).join('') + `</Properties></Objects>`;
      const opts = '<Options><SaveOptions><SaveOption><PropertyName>*</PropertyName><SaveAction>UpdateAdd</SaveAction></SaveOption></SaveOptions></Options>';
      const x = await soap('Update', opts + obj, 'UpdateRequest');
      console.log('  CRM_Audiencias: ' + (/<OverallStatus>([^<]+)/.exec(x) || [])[1] + ' · ' + (/<StatusMessage>([^<]+)/.exec(x) || [])[1]);
      // ¿DE nueva? -> regenerar la vol query
      const volSet = require('./audiencias-volumen.json');
      if (!volSet.some(v => v.name === deName)) {
        volSet.push({ name: deName, volumen: vol });
        fs.writeFileSync('audiencias-volumen.json', JSON.stringify(volSet, null, 1));
        console.log('  ⚠️ DE de audiencia NUEVA -> hay que regenerar CRM_Audiencias_Vol_Load (correr aa1-vol-query.js)');
        fs.writeFileSync('REGENERAR-VOL-QUERY.flag', deName);
      } else console.log('  DE ya estaba en el conjunto -> la vol query ya la cuenta');
    }
  }

  // ---- limpiar temp ----
  const del = `<Objects xsi:type="DataExtension"><CustomerKey>${dekey}</CustomerKey></Objects>`;
  await soap('Delete', del, 'DeleteRequest');
  const q2 = await Q.buscarPorKey(QK); if (q2) await Q.borrar(q2.queryDefinitionId);
  console.log('\n  temp borrada.');

  console.log('\n== RESUMEN ==');
  console.log('  ' + CK + ' agregada al catalogo (anclada por ContentName). EmailID ' + row.EmailID + ', ' + fmt(row.Sends) + ' envios.');
  console.log('  Aparecera en el reporte en la proxima corrida de la automation.');
})();
function fmt(v) { return Number(v || 0).toLocaleString('es-MX'); }
