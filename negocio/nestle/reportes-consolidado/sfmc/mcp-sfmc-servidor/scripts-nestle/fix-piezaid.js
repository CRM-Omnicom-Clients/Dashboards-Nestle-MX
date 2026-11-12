// fix-piezaid — el numero de pieza de las provisionales NO debe ser un valor inventado.
// Se pone "*por definir" (literal) en PiezaID. La IDENTIDAD real es el ContentName (EmailName).
// ConfigKey queda como llave interna de SFMC (es la PK, no puede ir en blanco) pero el
// normalizador NO debe usarla: debe basarse en ContentName.
const Q = require('./qd.js');
const { leerDE } = require('./leer.js');
const https = require('https');
const H = u => new URL(u).host;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const CFG_KEY = '03A9BE5F-0C95-4901-BEB9-3A3BEBF77C6D';

(async () => {
  const tok = await Q.init();
  const SOAP = H(Q.env.SFMC_SOAP_URL);
  const soap = (accion, inner, msg) => new Promise(res => {
    const b = `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"><s:Header><a:Action s:mustUnderstand="1">${accion}</a:Action><a:To s:mustUnderstand="1">https://${SOAP}/Service.asmx</a:To><fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header><s:Body><${msg} xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${inner}</${msg}></s:Body></s:Envelope>`;
    const q = https.request({ host: SOAP, path: '/Service.asmx', method: 'POST', timeout: 120000, headers: { 'Content-Type': 'text/xml', SOAPAction: accion, 'Content-Length': Buffer.byteLength(b) } }, rr => { let d = ''; rr.on('data', c => d += c); rr.on('end', () => res(d)); });
    q.on('error', e => res('ERR ' + e.message)); q.write(b); q.end();
  });

  const cfg = await leerDE('CRM_Reporte_Config', ['ConfigKey', 'PiezaID', 'ContentName']);
  const prov = cfg.filas.filter(f => /^(TMP-|009-TMP)/.test(f.ConfigKey));
  console.log('provisionales: ' + prov.length + '  (PiezaID actual invento -> "*por definir")');

  const objetos = prov.map(f =>
    `<Objects xsi:type="DataExtensionObject"><CustomerKey>${CFG_KEY}</CustomerKey>` +
    `<Keys><Key><Name>ConfigKey</Name><Value>${esc(f.ConfigKey)}</Value></Key></Keys>` +
    `<Properties><Property><Name>PiezaID</Name><Value>*por definir</Value></Property></Properties></Objects>`).join('');
  const x = await soap('Update', '<Options/>' + objetos, 'UpdateRequest');
  const st = (/<OverallStatus>([^<]+)/.exec(x) || [])[1];
  const errs = [...x.matchAll(/<StatusMessage>([\s\S]*?)<\/StatusMessage>/g)].map(m => m[1]).filter(m => !/^Updated/i.test(m));
  console.log('SOAP Update: ' + st + '   con error: ' + errs.length);

  const v = await leerDE('CRM_Reporte_Config', ['ConfigKey', 'PiezaID']);
  const provV = v.filas.filter(f => /^(TMP-|009-TMP)/.test(f.ConfigKey));
  const ok = provV.filter(f => String(f.PiezaID).trim() === '*por definir').length;
  console.log('\nPiezaID = "*por definir" en: ' + ok + '/' + provV.length + ' provisionales');
  console.log('  (las piezas reales conservan su numero de Rick, no se tocan)');
  console.log('\nFIX: ' + (ok === provV.length ? 'OK' : 'REVISAR'));
})();
