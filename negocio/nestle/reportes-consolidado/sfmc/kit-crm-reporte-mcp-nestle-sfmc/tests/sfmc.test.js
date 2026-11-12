'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ClienteSfmc, crearCliente, ErrorSfmc } = require('../lib/sfmc');
const { ErrorEscritura } = require('../lib/guardia');
const { SECRETO, cred, fakeHttp, sinEspera, conToken, tokens } = require('./_utils');

test('token: se cachea (dos GET => una sola peticion de token) y expone los scopes', async () => {
  const calls = []; const cli = new ClienteSfmc(cred(), { httpsRequest: fakeHttp(conToken(() => ({ json: { ok: 1 } })), calls), dormir: sinEspera });
  await cli.rest('/a'); await cli.rest('/b');
  assert.equal(tokens(calls), 1); assert.deepEqual(cli.scopes, ['data_extensions_read', 'automations_read']);
  assert.equal(calls.find(c => c.path === '/a').headers.Authorization, 'Bearer tok-1');
});

test('token: peticiones simultaneas comparten UNA sola renovacion (single-flight)', async () => {
  const calls = []; const cli = new ClienteSfmc(cred(), { httpsRequest: fakeHttp(conToken(() => ({ json: {} })), calls), dormir: sinEspera });
  await Promise.all([cli.rest('/a'), cli.rest('/b'), cli.rest('/c')]);
  assert.equal(tokens(calls), 1);
});

test('token: se RENUEVA cuando faltan <2 min (un refresco largo sobrevive a los 18 min del token)', async () => {
  let t = 1_000_000; const calls = [];
  const cli = new ClienteSfmc(cred(), { httpsRequest: fakeHttp(conToken(() => ({ json: {} })), calls), ahora: () => t, dormir: sinEspera });
  await cli.rest('/a'); assert.equal(tokens(calls), 1);
  t += 900_000; await cli.rest('/b'); assert.equal(tokens(calls), 1, 'a los 15 min aun vale (quedan 180 s)');
  t += 100_000; await cli.rest('/c'); assert.equal(tokens(calls), 2, 'a 1000 s quedan 80 s => renueva');
  assert.equal(calls.find(c => c.path === '/c').headers.Authorization, 'Bearer tok-2');
});

test('HTTP 401: renueva el token y reintenta UNA vez; si sigue 401 lo devuelve (sin bucle)', async () => {
  let vistos = 0; const calls = [];
  const cli = new ClienteSfmc(cred(), { httpsRequest: fakeHttp(conToken((c) => (c.path === '/x' ? { status: ++vistos === 1 ? 401 : 200, json: { ok: 1 } } : { json: {} })), calls), dormir: sinEspera });
  assert.equal((await cli.rest('/x')).status, 200); assert.equal(tokens(calls), 2);
  const calls2 = []; const cli2 = new ClienteSfmc(cred(), { httpsRequest: fakeHttp(conToken(() => ({ status: 401, json: {} })), calls2), dormir: sinEspera });
  assert.equal((await cli2.rest('/x')).status, 401); assert.equal(calls2.filter(c => c.path === '/x').length, 2);
});

test('MID: si falta, se descubre (token sin account_id -> tokenContext -> token con account_id)', async () => {
  const calls = []; const bodies = [];
  const h = async (c) => {
    if (c.path === '/v2/token') { bodies.push(JSON.parse(c.body)); return { json: { access_token: 'tok', expires_in: 1080, scope: '' } }; }
    if (c.path === '/platform/v1/tokenContext') return { json: { organization: { id: 999888 } } };
    return { json: {} };
  };
  const cli = new ClienteSfmc(cred({ accountId: null }), { httpsRequest: fakeHttp(h, calls), dormir: sinEspera });
  await cli.token();
  assert.equal(cli.mid, '999888'); assert.equal(bodies.length, 2);
  assert.equal(bodies[0].account_id, undefined); assert.equal(bodies[1].account_id, '999888');
});

test('invalid_client: ErrorSfmc con guia accionable y SIN el secreto', async () => {
  const h = async () => ({ status: 401, json: { error: 'invalid_client', error_description: `Invalid client ID. Use the client ID in Marketing Cloud Installed Packages. ${SECRETO}` } });
  const cli = new ClienteSfmc(cred(), { httpsRequest: fakeHttp(h), dormir: sinEspera });
  await assert.rejects(() => cli.token(), (e) => { assert.ok(e instanceof ErrorSfmc); assert.match(e.message, /CLIENT_ID no existe/); assert.ok(!e.message.includes(SECRETO.slice(5, 25))); return true; });
});

test('LECTURAS se reintentan (503, red caida) con backoff; ESCRITURAS no se reintentan jamas', async () => {
  const esperas = []; let n = 0; const calls = [];
  const h = conToken((c) => {
    if (c.path === '/lee') { n++; return n === 1 ? { status: 503, json: {} } : n === 2 ? { error: 'ECONNRESET' } : { status: 200, json: { ok: 1 } }; }
    if (c.path === '/automation/v1/queries') return { status: 503, json: {} };
    return { json: {} };
  });
  const cfg = { prefijoTemporales: 'CRM_Tmp_', des: {}, queries: {} };
  const cli = crearCliente({ cred: cred(), cfg, httpsRequest: fakeHttp(h, calls), dormir: async (ms) => { esperas.push(ms); } });
  assert.equal((await cli.rest('/lee')).status, 200); assert.equal(calls.filter(c => c.path === '/lee').length, 3); assert.deepEqual(esperas, [1000, 2000]);
  cli.registro.addDe('K-TMP-1', 'CRM_Tmp_de_aaaaaa');                                    // la query temporal debe cargar una DE temporal de esta corrida
  const w = await cli.rest('/automation/v1/queries', 'POST', { name: 'CRM_Tmp_a_bbbbbb', targetKey: 'K-TMP-1', targetName: 'CRM_Tmp_de_aaaaaa' });
  assert.equal(w.status, 503); assert.equal(calls.filter(c => c.path === '/automation/v1/queries').length, 1, 'el POST salio UNA sola vez');
});

test('GUARDIA: sin guardia => solo lectura; con guardia que niega => ErrorEscritura y NO sale ninguna peticion', async () => {
  const calls = []; const h = conToken(() => ({ json: {} }));
  const soloLectura = new ClienteSfmc(cred(), { httpsRequest: fakeHttp(h, calls), dormir: sinEspera });
  await assert.rejects(() => soloLectura.rest('/automation/v1/queries/abc', 'DELETE'), ErrorEscritura);
  await assert.rejects(() => soloLectura.soap('Create', '<Objects/>'), ErrorEscritura);
  const cli = crearCliente({ cred: cred(), cfg: { prefijoTemporales: 'CRM_Tmp_', des: {}, queries: {} }, httpsRequest: fakeHttp(h, calls), dormir: sinEspera });
  await assert.rejects(() => cli.rest('/automation/v1/automations/8a8a7b31-f99c-45fb-8482-e7b75858968b', 'DELETE'), ErrorEscritura);
  await assert.rejects(() => cli.rest('/data/v1/customobjects', 'POST', { name: 'CRM_Reporte_Config' }), ErrorEscritura);
  assert.equal(calls.length, 0, 'ni siquiera se pidio token: la guardia corta ANTES de salir');
});

test('SOAP: el token va en fueloauth, usa SOAPAction y reintenta tras un fault de token', async () => {
  const calls = []; let n = 0;
  const h = conToken((c) => {
    if (c.path !== '/Service.asmx') return { json: {} };
    return ++n === 1 ? { status: 500, text: '<s:Fault><faultstring>Token Expired</faultstring></s:Fault>' } : { text: '<r><OverallStatus>OK</OverallStatus></r>' };
  });
  const cli = new ClienteSfmc(cred(), { httpsRequest: fakeHttp(h, calls), dormir: sinEspera });
  const xml = await cli.soap('Retrieve', '<RetrieveRequest/>');
  assert.match(xml, /OverallStatus>OK/); assert.equal(tokens(calls), 2);
  const s = calls.filter(c => c.path === '/Service.asmx')[1];
  assert.equal(s.headers.SOAPAction, 'Retrieve'); assert.match(s.body, /<fueloauth xmlns="http:\/\/exacttarget.com">tok-2<\/fueloauth>/); assert.match(s.body, /<RetrieveRequestMsg /);
});

test('soapOk: lanza con el mensaje de SFMC cuando el estado no es OK', async () => {
  const h = conToken(() => ({ text: '<r><OverallStatus>Error</OverallStatus><Results><StatusMessage>Data Extension no existe</StatusMessage></Results></r>' }));
  const cli = new ClienteSfmc(cred(), { httpsRequest: fakeHttp(h), dormir: sinEspera });
  await assert.rejects(() => cli.soapOk('Retrieve', '<x/>'), /Data Extension no existe/);
});

test('paginar: junta todas las paginas ($page/$pagesize)', async () => {
  const h = conToken((c) => { const p = Number(/\$page=(\d+)/.exec(c.path)[1]); return { json: { count: 5, items: p === 1 ? [1, 2] : p === 2 ? [3, 4] : [5] } }; });
  const cli = new ClienteSfmc(cred(), { httpsRequest: fakeHttp(h), dormir: sinEspera });
  assert.deepEqual(await cli.paginar('/automation/v1/queries', { tam: 2 }), [1, 2, 3, 4, 5]);
});

test('restOk: el mensaje de error sale REDACTADO (ni secreto ni token)', async () => {
  const h = conToken(() => ({ status: 400, text: `{"message":"mal ${SECRETO}"}` }));
  const cli = new ClienteSfmc(cred(), { httpsRequest: fakeHttp(h), dormir: sinEspera });
  await assert.rejects(() => cli.restOk('/x'), (e) => { assert.match(e.message, /HTTP 400/); assert.ok(!e.message.includes(SECRETO.slice(5, 25))); return true; });
});

// ---------- hosts y redaccion ----------
test('el cliente SOLO acepta credenciales con hosts https de SFMC: otro dominio, http, con usuario o sin URL => se niega al construirse (el secret no sale)', () => {
  const noPeticiones = () => { throw new Error('no debía hacer peticiones'); };
  for (const mal of [{ authUrl: 'https://evil.example.com/v2/token' }, { restUrl: 'http://x.rest.marketingcloudapis.com' }, { soapUrl: 'https://x.soap.marketingcloudapis.com.evil.com' }, { authUrl: undefined }, { restUrl: 'https://u:p@x.rest.marketingcloudapis.com' }]) {
    assert.throws(() => new ClienteSfmc(cred(mal), { httpsRequest: noPeticiones }), /que no es un host https de SFMC/, JSON.stringify(mal));
  }
  assert.doesNotThrow(() => new ClienteSfmc(cred(), { httpsRequest: fakeHttp(conToken(() => ({ json: {} }))) }));
});
test('un error cuyo cuerpo trae el secret justo en el corte NO deja una mitad a la vista (se redacta ANTES de recortar): HTTP, token y SOAP', async () => {
  const sinTrozos = (msg) => { for (const t of [SECRETO.slice(0, 12), SECRETO.slice(20, 32), SECRETO.slice(-12)]) assert.ok(!String(msg).includes(t), `el mensaje repite «${t}»`); };
  const c1 = new ClienteSfmc(cred(), { httpsRequest: fakeHttp(conToken(() => ({ status: 500, text: 'a'.repeat(250) + SECRETO + 'b'.repeat(100) }))), dormir: sinEspera });
  let e1; try { await c1.restOk('/x'); } catch (e) { e1 = e; } assert.ok(e1); sinTrozos(e1.message);
  const c2 = new ClienteSfmc(cred(), { httpsRequest: fakeHttp(async (c) => (c.path === '/v2/token' ? { status: 400, json: { error_description: 'x'.repeat(170) + SECRETO } } : { json: {} })), dormir: sinEspera });
  let e2; try { await c2.token(true); } catch (e) { e2 = e; } assert.ok(e2); sinTrozos(e2.message);
  const c3 = new ClienteSfmc(cred(), { httpsRequest: fakeHttp(conToken(() => ({ text: '<r><OverallStatus>Error</OverallStatus><OverallStatusMessage>' + 'a'.repeat(370) + SECRETO + '</OverallStatusMessage></r>' }))), dormir: sinEspera });
  let e3; try { await c3.soapOk('Retrieve', '<RetrieveRequest/>'); } catch (e) { e3 = e; } assert.ok(e3); sinTrozos(e3.message);
});

// ---------- ESCRITURAS: solo se re-envian tras un rechazo por TOKEN (ocurre antes de ejecutarlas); nunca tras un error de red o de servidor ----------
test('una ESCRITURA REST rechazada con 401 se re-envia UNA vez con el token renovado; con 503, 429 o red caida NO se re-envia (podria haberse ejecutado)', async () => {
  const hacer = (primera) => { const calls = []; let n = 0;
    const h = conToken((c) => (c.path === '/automation/v1/queries' ? (++n === 1 ? primera : { status: 200, json: { queryDefinitionId: 'x' } }) : { json: {} }));
    const cli = crearCliente({ cred: cred(), cfg: { prefijoTemporales: 'CRM_Tmp_', des: {}, queries: {} }, httpsRequest: fakeHttp(h, calls), dormir: sinEspera }); cli.registro.addDe('K-TMP-1', 'CRM_Tmp_de_aaaaaa');
    return { cli, calls, envios: () => calls.filter(c => c.path === '/automation/v1/queries') }; };
  const escribir = (cli) => cli.rest('/automation/v1/queries', 'POST', { name: 'CRM_Tmp_a_bbbbbb', targetKey: 'K-TMP-1', targetName: 'CRM_Tmp_de_aaaaaa' });
  const a = hacer({ status: 401, json: {} }); assert.equal((await escribir(a.cli)).status, 200); assert.equal(a.envios().length, 2, '401: se envio dos veces'); assert.equal(a.envios()[1].headers.Authorization, 'Bearer tok-2', 'la segunda con el token RENOVADO');
  for (const [etq, resp, estado] of [['503', { status: 503, json: {} }, 503], ['429', { status: 429, json: {} }, 429], ['red caida', { error: 'ECONNRESET' }, 0]]) {
    const b = hacer(resp); assert.equal((await escribir(b.cli)).status, estado, etq); assert.equal(b.envios().length, 1, `${etq}: el POST salio UNA sola vez`);
  }
});
test('una ESCRITURA SOAP: tras un rechazo por token se re-envia una vez; tras un timeout o un error de servicio NO', async () => {
  const fila = '<Objects xsi:type="DataExtensionObject"><CustomerKey>KEY-CAT</CustomerKey><Properties><Property><Name>X</Name><Value>1</Value></Property></Properties></Objects>';
  const hacer = (primera) => { const calls = []; let n = 0;
    const h = conToken((c) => (c.path === '/Service.asmx' ? (++n === 1 ? primera : { text: '<r><OverallStatus>OK</OverallStatus></r>' }) : { json: {} }));
    return { cli: crearCliente({ cred: cred(), cfg: { prefijoTemporales: 'CRM_Tmp_', des: { catalogo: { nombre: 'C', key: 'KEY-CAT' } }, queries: {} }, httpsRequest: fakeHttp(h, calls), dormir: sinEspera }), envios: () => calls.filter(c => c.path === '/Service.asmx') }; };
  const a = hacer({ status: 401, text: 'unauthorized' }); await a.cli.soap('Create', fila); assert.equal(a.envios().length, 2, 'token rechazado: se re-envia una vez');
  const b = hacer({ text: '<r><faultstring>Token expired: authentication failed</faultstring></r>' }); await b.cli.soap('Create', fila); assert.equal(b.envios().length, 2, 'falla de autenticacion en el sobre: una vez');
  const c = hacer({ error: 'ETIMEDOUT' }); await assert.rejects(() => c.cli.soap('Create', fila), /sin respuesta/); assert.equal(c.envios().length, 1, 'sin respuesta (timeout): una sola vez');
  const d = hacer({ text: '<r><OverallStatus>Error</OverallStatus><OverallStatusMessage>Error interno</OverallStatusMessage></r>' }); const rd = await d.cli.soap('Create', fila); assert.match(rd, /Error interno/); assert.equal(d.envios().length, 1, 'error de servicio: una sola vez');
});
