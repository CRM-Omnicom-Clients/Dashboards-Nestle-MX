// refrescar-audiencias.js — re-resuelve el mapa pieza -> DE de audiencia (por interaction API),
// lo recarga en CRM_Audiencias, y regenera CRM_Audiencias_Vol_Load con el conjunto de DEs actual.
// Correr SOLO cuando entren journeys/audiencias nuevas. NO refresca las DEs de reporte.
//
// Requiere qd.js y leer.js en la misma carpeta (copiados del pipeline).
const Q = require('./qd.js');
const { leerDE } = require('./leer.js');
const https = require('https');
const fs = require('fs');
const H = u => new URL(u).host;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const escSql = s => String(s).replace(/'/g, "''");
const n = v => Number(v || 0);

const CFG_AUD_KEY = 'F4811FBB-1BB6-4BD0-85EF-EBE08A97CB08';
const VOL_QID = 'ee50e83c-f2c1-4389-b63f-2690cfcec8f9';

async function mkDE(nombre, campos) {
  const r = await Q.rest('/data/v1/customobjects', 'POST', { name: nombre, key: '', isSendable: false, categoryId: 445199, fields: campos.map((f, i) => { const o = { name: f.name, type: f.type, ordinal: i + 1, IsPrimaryKey: !!f.pk, isNullable: !f.pk, isTemplateField: false, isInheritable: true, isOverridable: true, isHidden: false, isReadOnly: false, mustOverride: false }; if (f.length) o.length = f.length; return o; }) });
  if (r.status < 300 && r.json?.key) return r.json.key;
  const tok = await Q.init(); const SOAP = H(Q.env.SFMC_SOAP_URL);
  const b = `<?xml version="1.0"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"><s:Header><a:Action s:mustUnderstand="1">Retrieve</a:Action><a:To s:mustUnderstand="1">https://${SOAP}/Service.asmx</a:To><fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header><s:Body><RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><RetrieveRequest><ObjectType>DataExtension</ObjectType><Properties>CustomerKey</Properties><Filter xsi:type="SimpleFilterPart"><Property>Name</Property><SimpleOperator>equals</SimpleOperator><Value>${nombre}</Value></Filter></RetrieveRequest></RetrieveRequestMsg></s:Body></s:Envelope>`;
  const xd = await new Promise(res => { const q = https.request({ host: SOAP, path: '/Service.asmx', method: 'POST', timeout: 60000, headers: { 'Content-Type': 'text/xml', SOAPAction: 'Retrieve', 'Content-Length': Buffer.byteLength(b) } }, rr => { let d = ''; rr.on('data', c => d += c); rr.on('end', () => res(d)); }); q.on('error', () => res('')); q.write(b); q.end(); });
  return (/<CustomerKey>([^<]+)<\/CustomerKey>/.exec(xd) || [])[1];
}
function soapFactory(tok, SOAP) {
  return (accion, inner, msg) => new Promise(res => {
    const b = `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"><s:Header><a:Action s:mustUnderstand="1">${accion}</a:Action><a:To s:mustUnderstand="1">https://${SOAP}/Service.asmx</a:To><fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header><s:Body><${msg} xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${inner}</${msg}></s:Body></s:Envelope>`;
    const q = https.request({ host: SOAP, path: '/Service.asmx', method: 'POST', timeout: 120000, headers: { 'Content-Type': 'text/xml', SOAPAction: accion, 'Content-Length': Buffer.byteLength(b) } }, rr => { let d = ''; rr.on('data', c => d += c); rr.on('end', () => res(d)); });
    q.on('error', e => res('ERR ' + e.message)); q.write(b); q.end();
  });
}

(async () => {
  const tok = await Q.init();
  const SOAP = H(Q.env.SFMC_SOAP_URL);
  const soap = soapFactory(tok, SOAP);

  // 1) piezas con journey
  const p = await leerDE('CRM_Email_Piezas', ['ConfigKey', 'Journey_UUID']);
  const conJ = p.filas.filter(f => String(f.Journey_UUID || '').trim());
  console.log('piezas con journey: ' + conJ.length);

  // 2) resolver journey -> DE de audiencia (cache)
  const edCache = {}, interCache = {}, mapa = [];
  let i = 0;
  for (const f of conJ) {
    i++; process.stdout.write('  resolviendo ' + i + '/' + conJ.length + '\r');
    let edId = interCache[f.Journey_UUID];
    if (edId === undefined) { const it = await Q.rest('/interaction/v1/interactions/' + f.Journey_UUID + '?extras=all', 'GET'); edId = (it.json?.triggers || [])[0]?.metaData?.eventDefinitionId || null; interCache[f.Journey_UUID] = edId; }
    let de = edId ? edCache[edId] : null;
    if (edId && de === undefined) { const ed = await Q.rest('/interaction/v1/eventDefinitions/' + edId, 'GET'); de = ed.json?.dataExtensionName || null; edCache[edId] = de; }
    mapa.push({ ConfigKey: f.ConfigKey, Journey_UUID: f.Journey_UUID, Audience_DE: de || null });
  }
  const conDE = mapa.filter(m => m.Audience_DE);
  const distintas = [...new Set(conDE.map(m => m.Audience_DE))];
  console.log('\nresueltas: ' + conDE.length + '/' + conJ.length + '  ·  DEs distintas: ' + distintas.length);

  // 3) volumen de cada DE distinta (COUNT en chunks, con set-match exacto)
  const volKey = await mkDE('CRM_Tmp_Count', [{ name: 'DEName', type: 'Text', length: 200, pk: true }, { name: 'N', type: 'Number' }]);
  const items = distintas.map((name, idx) => ({ idx: String(idx), name }));
  const vol = {};
  const correr = async (its) => {
    const esperado = new Set(its.map(x => x.idx));
    const sql = its.map(x => `SELECT '${x.idx}' AS DEName, COUNT(*) AS N FROM [${x.name}]`).join('\nUNION ALL\n');
    let qd = await Q.buscarPorKey('CRM_Tmp_Count_Load');
    const body = { name: 'CRM_Tmp_Count_Load', key: 'CRM_Tmp_Count_Load', description: 'temp', queryText: sql, targetName: 'CRM_Tmp_Count', targetKey: volKey, targetUpdateTypeId: 0, categoryId: 460279 };
    const u = qd ? await Q.actualizar(qd.queryDefinitionId, { ...body, queryDefinitionId: qd.queryDefinitionId }) : await Q.crear(body);
    if (u.status >= 300) return { error: 1 };
    const id = qd ? qd.queryDefinitionId : u.json.queryDefinitionId;
    if ((await Q.correr(id)).status >= 300) return { error: 1 };
    for (let k = 0; k < 30; k++) { await new Promise(r => setTimeout(r, 7000)); const r = await leerDE('CRM_Tmp_Count', ['DEName', 'N']); if (r.error) continue; const got = new Set(r.filas.map(x => String(x.DEName))); if (got.size === esperado.size && [...esperado].every(x => got.has(x))) { const o = {}; for (const x of r.filas) o[String(x.DEName)] = Number(x.N); return { out: o }; } }
    return { error: 1 };
  };
  for (let c = 0; c < items.length; c += 6) {
    const chunk = items.slice(c, c + 6);
    const res = await correr(chunk);
    if (res.out) Object.assign(vol, res.out);
    else for (const it of chunk) { const r1 = await correr([it]); if (r1.out) Object.assign(vol, r1.out); }
    process.stdout.write('  volumen ' + Object.keys(vol).length + '/' + items.length + '\r');
  }
  const volDe = {}; for (const it of items) volDe[it.name] = vol[it.idx] ?? null;
  fs.writeFileSync(__dirname + '/audiencias-volumen.json', JSON.stringify(items.map(it => ({ name: it.name, volumen: vol[it.idx] ?? null })), null, 1));
  console.log('\nvolumen: ' + Object.values(vol).filter(x => x != null).length + '/' + items.length);

  // 4) recargar CRM_Audiencias (mapping + volumen) por UpdateAdd
  const filas = conDE.map(m => ({ ConfigKey: m.ConfigKey, Journey_UUID: m.Journey_UUID, Audience_DE: m.Audience_DE, Audience_Volume: volDe[m.Audience_DE] ?? '' }));
  const objetos = filas.map(f => `<Objects xsi:type="DataExtensionObject"><CustomerKey>${CFG_AUD_KEY}</CustomerKey><Properties>` + ['ConfigKey', 'Journey_UUID', 'Audience_DE', 'Audience_Volume'].map(c => `<Property><Name>${c}</Name><Value>${esc(f[c] ?? '')}</Value></Property>`).join('') + `</Properties></Objects>`).join('');
  const opts = '<Options><SaveOptions><SaveOption><PropertyName>*</PropertyName><SaveAction>UpdateAdd</SaveAction></SaveOption></SaveOptions></Options>';
  const x = await soap('Update', opts + objetos, 'UpdateRequest');
  console.log('CRM_Audiencias recargada: ' + (/<OverallStatus>([^<]+)/.exec(x) || [])[1] + ' (' + filas.length + ' filas)');

  // 5) regenerar CRM_Audiencias_Vol_Load con el conjunto actual de DEs
  const counts = distintas.map(nm => `    SELECT '${escSql(nm)}' AS DEName, COUNT(*) AS N FROM [${nm}]`).join('\n    UNION ALL\n');
  const volSql = `/* CRM_Audiencias_Vol_Load — volumen por COUNT estatico. Regenerado por refrescar-audiencias.js */\nSELECT m.ConfigKey AS ConfigKey, m.Journey_UUID AS Journey_UUID, m.Audience_DE AS Audience_DE, ISNULL(cnt.N,0) AS Audience_Volume, GETDATE() AS LastRefresh\nFROM CRM_Audiencias m\nLEFT JOIN (\n${counts}\n) cnt ON cnt.DEName = m.Audience_DE`;
  const uv = await Q.actualizar(VOL_QID, { name: 'CRM_Audiencias_Vol_Load', key: 'CRM_Audiencias_Vol_Load', description: 'volumen de audiencia por COUNT estatico', queryText: volSql, targetName: 'CRM_Audiencias', targetKey: CFG_AUD_KEY, targetUpdateTypeId: 1, categoryId: 460279, queryDefinitionId: VOL_QID });
  console.log('CRM_Audiencias_Vol_Load regenerada: HTTP ' + uv.status + '  (' + distintas.length + ' DEs)');

  // limpiar temp
  const qd = await Q.buscarPorKey('CRM_Tmp_Count_Load'); if (qd) await Q.borrar(qd.queryDefinitionId);
  await soap('Delete', `<Objects xsi:type="DataExtension"><CustomerKey>${volKey}</CustomerKey></Objects>`, 'DeleteRequest');
  console.log('\nLISTO. El volumen ya se refresca solo en la automation; el mapeo quedó al día.');
})();
