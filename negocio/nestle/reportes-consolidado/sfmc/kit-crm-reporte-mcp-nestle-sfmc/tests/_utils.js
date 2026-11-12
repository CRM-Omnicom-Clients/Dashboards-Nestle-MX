'use strict';
// Utilidades compartidas por las pruebas (NO es un *.test.js: el runner no lo ejecuta). HTTP falso + credencial sintetica.
const EventEmitter = require('events');

const PRE = 'SFMC' + '_';
// Secreto SINTETICO armado en runtime: el codigo fuente nunca contiene un "SFMC_…" contiguo.
const SECRETO = PRE + 'Zq3Lm9Tr8Xv2Ab7Cd4Ef1Gh6Jk5Np0Qw2Rs9Tu3Vw8Xy1Za4Bc7De0Fg5Hi';
const TEN = 'mcfakeaaaaaaaaaaaaaaaaaaaaaa';
const cred = (extra) => ({ clientId: 'abcd1234efgh5678ijkl9012', clientSecret: SECRETO, accountId: '1234567', tenant: TEN,
  authUrl: `https://${TEN}.auth.marketingcloudapis.com/v2/token`, restUrl: `https://${TEN}.rest.marketingcloudapis.com`, soapUrl: `https://${TEN}.soap.marketingcloudapis.com`, ...extra });

/** https.request falso: handler({host,path,method,headers,body}) -> {status,json|text} | {error:'ECONNRESET'} */
function fakeHttp(handler, calls = []) {
  return (opts, cb) => {
    const req = new EventEmitter(); let body = '';
    req.write = (d) => { body += d; }; req.destroy = () => {};
    req.end = () => setImmediate(async () => {
      const llamada = { host: opts.host, path: opts.path, method: opts.method, headers: opts.headers, body }; calls.push(llamada);
      try {
        const r = await handler(llamada);
        if (r.error) return req.emit('error', Object.assign(new Error(r.error), { code: r.error }));
        const res = new EventEmitter(); res.statusCode = r.status || 200; res.setEncoding = () => {};
        cb(res); res.emit('data', r.text != null ? r.text : JSON.stringify(r.json == null ? {} : r.json)); res.emit('end');
      } catch (e) { req.emit('error', e); }
    });
    return req;
  };
}
const sinEspera = async () => {};
/** handler base: /v2/token entrega tok-N; todo lo demas lo decide `resto(llamada, nTokens)` */
function conToken(resto, extraTok = {}) {
  let n = 0;
  return async (c) => (c.path === '/v2/token' ? { json: { access_token: 'tok-' + (++n), expires_in: 1080, scope: 'data_extensions_read automations_read', ...extraTok } } : resto(c, n));
}
const tokens = (calls) => calls.filter(c => c.path === '/v2/token').length;

module.exports = { PRE, SECRETO, TEN, cred, fakeHttp, sinEspera, conToken, tokens };
