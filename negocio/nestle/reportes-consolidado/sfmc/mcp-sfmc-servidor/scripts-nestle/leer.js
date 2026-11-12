// Lector de filas de DE por SOAP (el REST /customobjectdata da 400 en este tenant).
const Q = require('./qd.js');
const https = require('https');
const H = (u) => new URL(u).host;

async function leerDE(nombreDE, campos, filtroXml) {
  const tok = await Q.init();
  const SOAP = H(Q.env.SFMC_SOAP_URL);
  const filas = [];
  let cont = null, v = 0;

  do {
    const req = cont
      ? `<RetrieveRequest><ContinueRequest>${cont}</ContinueRequest><ObjectType>DataExtensionObject[${nombreDE}]</ObjectType>${campos.map(c => `<Properties>${c}</Properties>`).join('')}</RetrieveRequest>`
      : `<RetrieveRequest><ObjectType>DataExtensionObject[${nombreDE}]</ObjectType>${campos.map(c => `<Properties>${c}</Properties>`).join('')}${filtroXml || ''}</RetrieveRequest>`;

    const b = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing">
<s:Header><a:Action s:mustUnderstand="1">Retrieve</a:Action>
<a:To s:mustUnderstand="1">https://${SOAP}/Service.asmx</a:To>
<fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header>
<s:Body><RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${req}</RetrieveRequestMsg></s:Body></s:Envelope>`;

    const xml = await new Promise((res) => {
      const r = https.request({ host: SOAP, path: '/Service.asmx', method: 'POST', timeout: 120000,
        headers: { 'Content-Type': 'text/xml', SOAPAction: 'Retrieve', 'Content-Length': Buffer.byteLength(b) } },
        (rr) => { let d = ''; rr.on('data', c => d += c); rr.on('end', () => res(d)); });
      r.on('error', (e) => res('ERR ' + e.code)); r.write(b); r.end();
    });

    const st = /<OverallStatus>([^<]+)<\/OverallStatus>/.exec(xml)?.[1];
    if (!/^(OK|MoreDataAvailable)$/.test(st || '')) {
      return { error: st, detalle: /<StatusMessage>([^<]+)<\/StatusMessage>/.exec(xml)?.[1], filas };
    }
    for (const bl of xml.split(/<Results[^>]*>/).slice(1)) {
      const o = {};
      for (const m of bl.matchAll(/<Name>([^<]*)<\/Name>\s*<Value>([^<]*)<\/Value>/g)) o[m[1]] = m[2];
      if (Object.keys(o).length) filas.push(o);
    }
    cont = st === 'MoreDataAvailable' ? /<RequestID>([^<]+)<\/RequestID>/.exec(xml)?.[1] : null;
  } while (cont && ++v < 40);

  return { filas };
}

module.exports = { leerDE };
