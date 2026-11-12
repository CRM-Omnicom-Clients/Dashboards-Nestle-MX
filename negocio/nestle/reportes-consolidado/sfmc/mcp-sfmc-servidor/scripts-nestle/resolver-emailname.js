// resolver-emailname.js — resuelve el/los EmailName REALES de _Job para uno o varios fragmentos.
//
// 🔴 REGLA DURA DEL PIPELINE: la identidad de una pieza es el **EmailName EXACTO de _Job**,
//    NUNCA el codigo del asset que llega en el brief (casi nunca coincide: 069127 no existia,
//    048423 era 035275, 0242434 era 024243...) ni el asset de Content Builder (no es la
//    identidad, y ademas el asset API rebota 403 con el scope de lectura de Nestle).
//    ➜ SIEMPRE correr esto ANTES de agregar / actualizar / reportar una pieza.
//
// Ojo: _Job.EmailName esta **truncado a ~100 chars** y SFMC le puede pegar un sufijo " - <fecha>"
//    cuando el email fue copiado/reenviado. El nombre que devuelve aqui ES el que hay que usar
//    como llave (es contra el que casa el JOIN de Detalle: RTRIM(j.EmailName)=c.EmailName).
//
// Uso:  node resolver-emailname.js "<frag1>" ["<frag2>" ...] [--desde=<jobid>]
//   ej: node resolver-emailname.js "0359270" "069127" "LALIGA-J8" --desde=1298000
//   (--desde acota por JobID reciente => mucho mas rapido; sin el, escanea todo _Job y tarda)
const Q = require('./qd.js');
const { leerDE } = require('./leer.js');
const https = require('https');
const H = u => new URL(u).host;
const DE = 'CRM_Tmp_Resolver', QK = 'CRM_Tmp_Resolver_Load';

const args = process.argv.slice(2);
const desde = (args.find(a => a.startsWith('--desde=')) || '').split('=')[1];
const frags = args.filter(a => !a.startsWith('--'));
if (!frags.length) { console.log('Uso: node resolver-emailname.js "<frag>" ["<frag2>"...] [--desde=<jobid>]'); process.exit(1); }
const esc = s => String(s).replace(/'/g, "''");

async function crearDE(nombre, campos) {
  await Q.init();
  const r = await Q.rest('/data/v1/customobjects', 'POST', { name: nombre, key: '', isSendable: false, categoryId: 445199, fields: campos.map((f, i) => { const o = { name: f.name, type: f.type, ordinal: i + 1, IsPrimaryKey: !!f.pk, isNullable: !f.pk, isTemplateField: false, isInheritable: true, isOverridable: true, isHidden: false, isReadOnly: false, mustOverride: false }; if (f.length) o.length = f.length; return o; }) });
  if (r.status < 300 && r.json?.key) return r.json.key;
  const tok = await Q.init(); const SOAP = H(Q.env.SFMC_SOAP_URL);
  const b = `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"><s:Header><a:Action s:mustUnderstand="1">Retrieve</a:Action><a:To s:mustUnderstand="1">https://${SOAP}/Service.asmx</a:To><fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header><s:Body><RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><RetrieveRequest><ObjectType>DataExtension</ObjectType><Properties>CustomerKey</Properties><Filter xsi:type="SimpleFilterPart"><Property>Name</Property><SimpleOperator>equals</SimpleOperator><Value>${nombre}</Value></Filter></RetrieveRequest></RetrieveRequestMsg></s:Body></s:Envelope>`;
  const xd = await new Promise(res => { const q = https.request({ host: SOAP, path: '/Service.asmx', method: 'POST', timeout: 60000, headers: { 'Content-Type': 'text/xml', SOAPAction: 'Retrieve', 'Content-Length': Buffer.byteLength(b) } }, rr => { let d = ''; rr.on('data', c => d += c); rr.on('end', () => res(d)); }); q.on('error', () => res('')); q.write(b); q.end(); });
  return (/<CustomerKey>([^<]+)<\/CustomerKey>/.exec(xd) || [])[1];
}
async function borrar(dekey) {
  const tok = await Q.init(); const SOAP = H(Q.env.SFMC_SOAP_URL);
  const del = `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"><s:Header><a:Action s:mustUnderstand="1">Delete</a:Action><a:To s:mustUnderstand="1">https://${SOAP}/Service.asmx</a:To><fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header><s:Body><DeleteRequest xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Objects xsi:type="DataExtension"><CustomerKey>${dekey}</CustomerKey></Objects></DeleteRequest></s:Body></s:Envelope>`;
  await new Promise(res => { const q = https.request({ host: SOAP, path: '/Service.asmx', method: 'POST', timeout: 60000, headers: { 'Content-Type': 'text/xml', SOAPAction: 'Delete', 'Content-Length': Buffer.byteLength(del) } }, rr => { let d = ''; rr.on('data', c => d += c); rr.on('end', () => res(d)); }); q.on('error', () => res('')); q.write(del); q.end(); });
  const q2 = await Q.buscarPorKey(QK); if (q2) await Q.borrar(q2.queryDefinitionId);
}
(async () => {
  await Q.init();
  const dekey = await crearDE(DE, [{ name: 'EmailName', type: 'Text', length: 250, pk: true }, { name: 'EmailID', type: 'Number' }, { name: 'Len', type: 'Number' }, { name: 'Jobs', type: 'Number' }, { name: 'Subject', type: 'Text', length: 200 }]);
  const cond = frags.map(f => `RTRIM(j.EmailName) LIKE '%${esc(f)}%'`).join(' OR ');
  const floor = desde ? `j.JobID > ${Number(desde)} AND ` : '';
  const SQL = `SELECT RTRIM(j.EmailName) AS EmailName, MAX(j.EmailID) AS EmailID, MAX(LEN(RTRIM(j.EmailName))) AS Len, COUNT(*) AS Jobs, MAX(RTRIM(j.EmailSubject)) AS Subject
    FROM _Job j WHERE ${floor}(${cond}) GROUP BY RTRIM(j.EmailName)`;
  let qd = await Q.buscarPorKey(QK);
  const cuerpo = { name: QK, key: QK, description: 'resolver emailname', queryText: SQL, targetName: DE, targetKey: dekey, targetUpdateTypeId: 0, categoryId: 460279 };
  if (qd) await Q.actualizar(qd.queryDefinitionId, { ...cuerpo, queryDefinitionId: qd.queryDefinitionId });
  else qd = (await Q.crear(cuerpo)).json;
  await Q.correr(qd.queryDefinitionId);
  console.log('resolviendo ' + JSON.stringify(frags) + (desde ? ' (JobID>' + desde + ')' : ' (scan completo, puede tardar)') + ' ...');
  let filas = null;
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 7000)); const r = await leerDE(DE, ['EmailName', 'EmailID', 'Len', 'Jobs', 'Subject']); if (!r.error && r.filas.length) { filas = r.filas; break; } process.stdout.write('  ' + (i * 7) + 's...\r'); }
  console.log('\n');
  if (!filas) console.log('SIN resultados: ningun _Job.EmailName contiene esos fragmentos (o timeout). Si esperabas match, el envio no existe con ese texto en el nombre.');
  else {
    filas.sort((a, b) => Number(b.Jobs) - Number(a.Jobs));
    for (const f of filas) {
      const test = /\[test/i.test(f.Subject || '') ? '  ⚠️TEST' : '';
      console.log('EmailName (len ' + f.Len + '): ' + f.EmailName);
      console.log('  EmailID=' + f.EmailID + '  jobs=' + f.Jobs + '  subj="' + String(f.Subject || '').replace(/%%\[[\s\S]*?\]%%/g, '').trim().slice(0, 45) + '"' + test + '\n');
    }
    console.log('➜ Usa el EmailName EXACTO de arriba como llave. Ese es el que casa el reporte.');
  }
  await borrar(dekey);
})();
