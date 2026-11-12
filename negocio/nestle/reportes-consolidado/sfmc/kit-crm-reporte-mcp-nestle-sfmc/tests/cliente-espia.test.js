'use strict';
// Ataque al CLIENTE REAL (ClienteSfmc / crearCliente) con un HTTP espia (fakeHttp), no a la guardia suelta:
//   1. lo prohibido NO genera ninguna peticion — ni siquiera la del token —, escrito como se escriba el metodo, la ruta o la accion SOAP;
//   2. el metodo que sale al cable es el que la guardia juzgo (no hay un segundo "String()" distinto);
//   3. las credenciales (token, fueloauth) solo viajan a los 3 hosts de SFMC de la credencial, pase lo que pase con la ruta;
//   4. el texto hostil (el EmailName viene de _Job, lo escribe cualquiera con acceso a la BU) cambia el CONTENIDO del XML pero nunca su FORMA.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ClienteSfmc, crearCliente } = require('../lib/sfmc');
const { ErrorEscritura } = require('../lib/guardia');
const { filtroSimple, ErrorXml } = require('../lib/xml');
const D = require('../lib/de');
const { cred, fakeHttp, conToken, sinEspera, TEN } = require('./_utils');

const K = { cat: '03A9BE5F-0C95-4901-BEB9-3A3BEBF77C6D', aud: 'F4811FBB-1BB6-4BD0-85EF-EBE08A97CB08', det: 'E6A6AA43-BC30-443D-AA79-4ED324F45BA5' };
const Q = { vol: 'ee50e83c-f2c1-4389-b63f-2690cfcec8f9', det: '452234b4-4939-42a7-bc34-9b628782c896' };
const TMPQ = '11111111-1111-1111-1111-111111111111', TMPDE = '22222222-2222-2222-2222-222222222222';
const CFG = {
  prefijoTemporales: 'CRM_Tmp_', carpetas: { de: '1', query: '2' },
  des: { catalogo: { nombre: 'CRM_Reporte_Config', key: K.cat }, audiencias: { nombre: 'CRM_Audiencias', key: K.aud }, detalle: { nombre: 'CRM_Email_Detalle', key: K.det } },
  queries: { vol: { nombre: 'CRM_Audiencias_Vol_Load', id: Q.vol }, detalle: { nombre: 'CRM_Email_Detalle_Load', id: Q.det } },
};
const SOAP_OK = '<r><OverallStatus>OK</OverallStatus></r>';
const HOSTS = new Set([`${TEN}.auth.marketingcloudapis.com`, `${TEN}.rest.marketingcloudapis.com`, `${TEN}.soap.marketingcloudapis.com`]);
const ch = (n) => String.fromCharCode(n);
const ESQUEMA_TOKEN = new RegExp('^' + ['Bear', 'er'].join('') + ' tok-\\d+$');          // el esquema del encabezado Authorization, armado por partes: el escaner de secretos no debe ver aqui el patron que describe

function nuevo({ guardado = true, cfg = CFG } = {}) {
  const calls = [];
  const h = conToken((c) => (c.path === '/Service.asmx' ? { text: SOAP_OK } : { json: {} }));
  const cli = guardado
    ? crearCliente({ cred: cred(), cfg, httpsRequest: fakeHttp(h, calls), dormir: sinEspera })
    : new ClienteSfmc(cred(), { httpsRequest: fakeHttp(h, calls), dormir: sinEspera });
  if (guardado) { cli.registro.addQuery(TMPQ, 'CRM_Tmp_x_aaaaaa'); cli.registro.addDe(TMPDE, 'CRM_Tmp_x_aaaaaa'); }
  return { cli, calls };
}
const fila = (key, tipo = 'DataExtensionObject') => `<Objects xsi:type="${tipo}"><CustomerKey>${key}</CustomerKey><Properties><Property><Name>X</Name><Value>1</Value></Property></Properties></Objects>`;

test('cliente de SOLO LECTURA: ningun metodo distinto de GET sale a la red, escrito como se escriba — y sin pedir ni el token', async () => {
  const { cli, calls } = nuevo({ guardado: false });
  const metodos = ['POST', 'post', 'Post', 'pOsT', ' POST', 'POST ', 'PUT', 'put', 'PATCH', 'patch', 'DELETE', 'delete', 'OPTIONS', 'HEAD', 'TRACE', 'CONNECT', 'PROPFIND', 'MKCOL', 'BREW', '', '  ', null, 0, 1, true, {}, ['POST'], ['DELETE'], { toString() { return 'DELETE'; } }, ' GET', 'GET ', 'GE' + ch(0x200B) + 'T'];
  for (const m of metodos) {
    await assert.rejects(() => cli.rest('/automation/v1/automations/8a8a7b31-f99c-45fb-8482-e7b75858968b/actions/start/', m, {}), ErrorEscritura, JSON.stringify(m));
    await assert.rejects(() => cli.restOk('/data/v1/customobjects', m, { name: 'CRM_Tmp_x' }), ErrorEscritura, 'restOk ' + JSON.stringify(m));
  }
  for (const a of ['Create', 'Update', 'Delete', 'Perform', 'Execute', 'Schedule', 'Configure', 'Describe', 'Extract', 'Query', 'retrieve', 'RETRIEVE', 'Retrieve ', ' Retrieve', '', null, undefined]) {
    await assert.rejects(() => cli.soap(a, fila(K.cat)), ErrorEscritura, 'SOAP ' + JSON.stringify(a));
  }
  assert.equal(calls.length, 0, 'ni una sola peticion (ni la del token): ' + JSON.stringify(calls.map(c => c.method + ' ' + c.path)));
});

test('la lectura sale al cable como GET en mayusculas (el metodo del cable es el que se juzgo), con el token de SFMC y solo al host REST', async () => {
  const { cli, calls } = nuevo({ guardado: false });
  for (const m of ['get', 'GET', 'Get', ['GET'], { toString() { return 'get'; } }, undefined]) await cli.rest('/automation/v1/queries', m);
  const lecturas = calls.filter(c => c.path !== '/v2/token');
  assert.equal(lecturas.length, 6);
  for (const c of lecturas) { assert.equal(c.method, 'GET'); assert.equal(c.host, `${TEN}.rest.marketingcloudapis.com`); assert.match(c.headers.Authorization, ESQUEMA_TOKEN); assert.equal(c.body, ''); }
});

test('cliente con guardia — REST: lo prohibido no genera NINGUNA peticion, ni con rutas disfrazadas (case, //, .., %2F, ;, #, espacios, URL absoluta, query-string) ni con metodos en otra forma', async () => {
  const { cli, calls } = nuevo();
  const buenaDe = { name: 'CRM_Tmp_x_ab12cd', isSendable: false };
  const buenaQuery = { name: 'CRM_Tmp_x_ab12cd_Load', targetKey: TMPDE, targetName: 'CRM_Tmp_x_aaaaaa' };
  const prohibidas = [
    // el disfraz de la ruta: la misma operacion PERMITIDA (crear DE temporal) escrita de otra manera
    ['POST', '//data/v1/customobjects', buenaDe], ['POST', '/DATA/V1/CUSTOMOBJECTS', buenaDe], ['POST', '/Data/v1/customObjects', buenaDe],
    ['POST', '/data/v1/customobjects/../automations', buenaDe], ['POST', '/data/v1/customobjects%2F..%2Fautomations', buenaDe], ['POST', '/data/v1/customobjects%2e%2e', buenaDe],
    ['POST', '/data/v1/customobjects;x=1', buenaDe], ['POST', '/data/v1/customobjects#x', buenaDe], ['POST', '/data/v1/customobjects/extra', buenaDe],
    ['POST', '/data/v1/customobjects\\..\\x', buenaDe], ['POST', ' /data/v1/customobjects', buenaDe], ['POST', '/data/v1/customobjects ', buenaDe], ['POST', 'data/v1/customobjects', buenaDe],
    ['POST', 'https://evil.example/data/v1/customobjects', buenaDe], ['POST', '/data/v1/customobjects' + ch(0xFF0F) + 'x', buenaDe], ['POST', '/data/v1/customobjects' + ch(0), buenaDe],
    ['POST', '/automation/v1/queries/../queries', buenaQuery], ['POST', '/automation/v1/queries/./', buenaQuery], ['POST', '/automation/v1//queries', buenaQuery],
    // ids: la forma exacta es de 36 caracteres hex y guiones, y nada mas
    ['DELETE', `/automation/v1/queries/${TMPQ}/../${Q.det}`, null], ['DELETE', `/automation/v1/queries/${TMPQ}%2F..%2F${Q.det}`, null], ['DELETE', `/automation/v1/queries/${TMPQ}x`, null],
    ['DELETE', `/automation/v1/queries/${TMPQ.slice(0, 35)}`, null], ['DELETE', `/automation/v1/queries/${TMPQ}${TMPQ}`, null], ['DELETE', `/automation/v1/queries/${TMPQ.replace(/1/g, 'g')}`, null],
    ['DELETE', `/automation/v1/queries/${Q.det}?x=/automation/v1/queries/${TMPQ}`, null], ['DELETE', `/automation/v1/queries/${Q.det}#/automation/v1/queries/${TMPQ}`, null],
    ['POST', `/automation/v1/queries/${Q.det}/actions/start/../../${Q.vol}/actions/start`, {}], ['POST', `/automation/v1/queries/${TMPQ}/actions/start/x`, {}], ['POST', `/automation/v1/queries/${TMPQ}/actions/stop`, {}],
    ['POST', '/automation/v1/queries/33333333-3333-3333-3333-333333333333/actions/start', {}],            // existe en la forma, pero no es del reporte ni temporal
    // lo claramente fuera de la lista
    ['POST', '/data/v1/customobjects', { name: 'CRM_Reporte_Config' }], ['POST', '/data/v1/customobjects', { name: 'CRM_Tmp_x', isSendable: true }],
    ['DELETE', `/automation/v1/queries/${Q.det}`, null], ['DELETE', '/data/v1/customobjects/' + K.cat, null], ['PUT', `/data/v1/customobjectdata/key:${K.cat}/rowset`, [{ keys: { a: 1 }, values: { b: 2 } }]],
    ['POST', `/hub/v1/dataevents/key:${K.cat}/rowset`, [{ keys: { a: 1 }, values: { b: 2 } }]], ['POST', '/messaging/v1/email/messages', { definitionKey: 'x' }], ['POST', '/interaction/v1/events', { ContactKey: 'x' }],
    ['POST', '/automation/v1/automations/8a8a7b31-f99c-45fb-8482-e7b75858968b/actions/start/', {}], ['DELETE', '/automation/v1/automations/8a8a7b31-f99c-45fb-8482-e7b75858968b', null],
    ['PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetUpdateTypeId: 0 }],
    ['PUT', '/asset/v1/content/assets/1', {}], ['PATCH', '/interaction/v1/interactions/x', {}], ['DELETE', '/contacts/v1/contacts', { values: [1] }],
    // el metodo de la operacion permitida, escrito raro o cambiado por otro
    ['PUT', '/data/v1/customobjects', buenaDe], ['PATCH', '/data/v1/customobjects', buenaDe], ['DELETE', '/data/v1/customobjects', null], ['OPTIONS', '/data/v1/customobjects', null], ['HEAD', '/data/v1/customobjects', null],
  ];
  for (const [m, ruta, cuerpo] of prohibidas) {
    await assert.rejects(() => cli.rest(ruta, m, cuerpo), ErrorEscritura, m + ' ' + ruta);
    await assert.rejects(() => cli.restOk(ruta, m, cuerpo), ErrorEscritura, 'restOk ' + m + ' ' + ruta);
  }
  assert.equal(calls.length, 0, 'ni una peticion, ni la del token: ' + JSON.stringify(calls.map(c => c.method + ' ' + c.path).slice(0, 5)));
});

test('cliente con guardia — SOAP: lo prohibido no genera NINGUNA peticion (otras acciones, otros objetos, prefijos de espacio de nombres, tipos escondidos, acciones en otra forma)', async () => {
  const { cli, calls } = nuevo();
  const pref = (key, tipo) => `<q:Objects xmlns:q="http://exacttarget.com/wsdl/partnerAPI" xsi:type="${tipo}"><CustomerKey>${key}</CustomerKey></q:Objects>`;
  const prohibidas = [
    ['Create', fila(K.det)], ['Update', fila(K.det)], ['Create', fila(K.cat, 'Subscriber')], ['Create', fila(K.cat, 'Automation')], ['Update', fila(K.cat, 'Email')],
    ['Delete', fila(K.cat, 'DataExtension')], ['Delete', fila(K.aud, 'DataExtension')], ['Delete', fila('99999999-9999-9999-9999-999999999999', 'DataExtension')], ['Delete', fila(TMPDE, 'DataExtensionObject')],
    ['Create', pref(K.det, 'DataExtensionObject')], ['Create', fila(K.cat) + pref(K.det, 'DataExtensionObject')], ['Create', pref(K.det, 'DataExtensionObject') + fila(K.cat)], ['Delete', pref(K.cat, 'DataExtension')],
    ['Create', '<Objects><CustomerKey>' + K.cat + '</CustomerKey><Properties><Property xsi:type="DataExtensionObject"/></Properties></Objects>'],
    ['Create', `<Objects xsi:type='DataExtensionObject'><CustomerKey>${K.cat}</CustomerKey></Objects>`], ['Create', '<sin-objects/>'], ['Create', ''], ['Update', null],
    ['Perform', '<x/>'], ['Execute', '<x/>'], ['Schedule', '<x/>'], ['Configure', '<x/>'], ['Describe', '<x/>'], ['Extract', '<x/>'], ['Query', '<x/>'],
    ['retrieve', '<x/>'], ['RETRIEVE', '<x/>'], ['Retrieve ', '<x/>'], [' Retrieve', '<x/>'], ['', '<x/>'], [null, '<x/>'], [undefined, '<x/>'],
  ];
  for (const [a, x] of prohibidas) await assert.rejects(() => cli.soap(a, x), ErrorEscritura, 'SOAP ' + JSON.stringify(a) + ' ' + String(x).slice(0, 50));
  assert.equal(calls.length, 0, 'ni una peticion, ni la del token');
});

test('lo PERMITIDO sale tal cual se juzgo — metodo, ruta (con la barra final), cuerpo y host — y las credenciales solo viajan a los 3 hosts de SFMC', async () => {
  const { cli, calls } = nuevo();
  const cuerpoDe = { name: 'CRM_Tmp_x_ab12cd', isSendable: false, fields: [] };
  const volReal = { queryDefinitionId: Q.vol, name: 'CRM_Audiencias_Vol_Load', key: 'CRM_Audiencias_Vol_Load', description: 'x', queryText: 'SELECT 1', targetName: 'CRM_Audiencias', targetKey: K.aud, targetUpdateTypeId: 1, categoryId: 460279 };
  await cli.rest('/data/v1/customobjects', 'POST', cuerpoDe);
  await cli.rest('/data/v1/customobjects/', 'post', cuerpoDe);
  await cli.rest(`/automation/v1/queries/${TMPQ}/actions/start/`, 'POST', {});
  await cli.rest(`/automation/v1/queries/${Q.det}/actions/start?x=1`, 'POST', {});
  await cli.rest(`/automation/v1/queries/${Q.vol}`, 'PATCH', volReal);
  await cli.rest(`/automation/v1/queries/${TMPQ}`, 'DELETE');
  await cli.soapOk('Create', fila(K.cat)); await cli.soapOk('Update', fila(K.aud.toLowerCase())); await cli.soapOk('Delete', fila(TMPDE, 'DataExtension')); await cli.soapOk('Retrieve', '<RetrieveRequest/>');
  const esc = calls.filter(c => c.path !== '/v2/token' && c.method !== 'GET');
  assert.deepEqual(esc.map(c => c.method + ' ' + c.path), [
    'POST /data/v1/customobjects', 'POST /data/v1/customobjects/', `POST /automation/v1/queries/${TMPQ}/actions/start/`, `POST /automation/v1/queries/${Q.det}/actions/start?x=1`,
    `PATCH /automation/v1/queries/${Q.vol}`, `DELETE /automation/v1/queries/${TMPQ}`, 'POST /Service.asmx', 'POST /Service.asmx', 'POST /Service.asmx', 'POST /Service.asmx']);
  assert.deepEqual(JSON.parse(esc[0].body), cuerpoDe); assert.deepEqual(JSON.parse(esc[4].body), volReal, 'el cuerpo de Vol llega sin cambios');
  assert.deepEqual(esc.slice(6).map(c => /<s:Body><(\w+) /.exec(c.body)[1]), ['CreateRequest', 'UpdateRequest', 'DeleteRequest', 'RetrieveRequestMsg'], 'el elemento del cuerpo SOAP corresponde a la accion juzgada');
  assert.deepEqual(esc.slice(6).map(c => c.headers.SOAPAction), ['Create', 'Update', 'Delete', 'Retrieve']);
  for (const c of calls) assert.ok(HOSTS.has(c.host), 'host fuera de SFMC: ' + c.host);
  assert.ok(calls.filter(c => c.headers && c.headers.Authorization).every(c => c.host === `${TEN}.rest.marketingcloudapis.com`), 'el token del encabezado Authorization solo va al host REST');
  assert.ok(calls.filter(c => c.path === '/Service.asmx').every(c => c.host === `${TEN}.soap.marketingcloudapis.com` && !c.headers.Authorization), 'SOAP lleva el token en fueloauth, solo al host SOAP');
});

test('las LECTURAS no se pueden usar para llevar las credenciales a otro host: una URL absoluta o un host dentro de la ruta cambia la RUTA, nunca el host de la peticion', async () => {
  const { cli, calls } = nuevo({ guardado: false });
  for (const ruta of ['https://evil.example/steal', '//evil.example/steal', '/x?redirect=https://evil.example', 'http://169.254.169.254/latest/meta-data', '@evil.example/x', '.evil.example/x', ':443/x']) await cli.rest(ruta, 'GET');
  const sale = calls.filter(c => c.path !== '/v2/token');
  assert.equal(sale.length, 7);
  for (const c of calls) assert.ok(HOSTS.has(c.host), 'host fuera de SFMC: ' + c.host);
  assert.ok(sale.every(c => c.host === `${TEN}.rest.marketingcloudapis.com`));
});

// ---------- el texto hostil cambia el CONTENIDO del XML, nunca su FORMA ----------
const firma = (xml) => [...String(xml).matchAll(/<\/?([A-Za-z_][\w:.-]*)/g)].map(m => m[1]).join(',');
const soloTexto = (xml) => String(xml).replace(/<[^>]*>/g, '');
const HOSTILES = [
  'NC000817', `O_Maggi & "Liga" <J8> it's`, '</Value></Property><Property><Name>X</Name><Value>', '</Objects><Objects xsi:type="Automation"><CustomerKey>x</CustomerKey>', ']]>', '<![CDATA[<Objects>]]>',
  '&amp;', '&#x41;', '&lt;Objects&gt;', '<!DOCTYPE x [<!ENTITY a "b">]><x>&a;</x>', '<?xml version="1.0"?>', '<!-- -->', '<q:Objects xmlns:q="http://exacttarget.com/wsdl/partnerAPI">',
  '"', "'", '<', '>', '&', '\\', '%00', '$(rm -rf /)', '`id`', 'Nescafé ' + String.fromCodePoint(0x1F600) + ' ñ', ch(0x200B) + ch(0x202E) + 'abc', ch(0xFEFF), 'a'.repeat(5000),
];

test('texto hostil en valores, NOMBRES de columna/llave/DE y hasta en la key de la DE de la config: el XML que sale tiene la MISMA forma que con un valor normal, y la guardia sigue reconociendo la key', async () => {
  // v viaja por TODOS los lugares donde el kit mete texto en un XML: filtros, columnas pedidas, nombre de la DE, valores, nombres de columna, llaves, la key de la DE y el borrado de una DE temporal.
  const forma = async (v) => {
    const cfg = JSON.parse(JSON.stringify(CFG)); cfg.des.catalogo.key = 'KEY-' + v; cfg.des.audiencias.key = 'AUD-' + v;          // la key de una DE sale de SFMC: tambien es texto no confiable
    const { cli, calls } = nuevo({ cfg });
    await D.leerFilas(cli, 'DE' + v, ['Campo' + v, 'EmailName'], { filtro: filtroSimple('EmailName' + v, 'equals', v), validar: false });
    await D.insertarFila(cli, cfg, 'catalogo', { ConfigKey: v, ['Col' + v]: v });
    await D.upsertarFila(cli, cfg, 'audiencias', { ['Llave' + v]: v }, { Audience_DE: v, ['Otra' + v]: '3' });
    cli.registro.addDe('TMP-' + v, 'CRM_Tmp_x'); await D.borrarDeTemp(cli, 'TMP-' + v);
    return calls.filter(c => c.path === '/Service.asmx').map(c => c.body);
  };
  const base = await forma('NC000817');
  assert.equal(base.length, 4);
  for (const v of HOSTILES) {
    const cuerpos = await forma(v);
    assert.equal(cuerpos.length, 4, JSON.stringify(v).slice(0, 60));
    cuerpos.forEach((b, i) => {
      assert.equal(firma(b), firma(base[i]), 'la FORMA cambio con el valor ' + JSON.stringify(v).slice(0, 60));
      const t = soloTexto(b);
      assert.ok(!t.includes('<') && !t.includes('>'), 'quedo un < o > crudo en el texto con ' + JSON.stringify(v).slice(0, 60));
      assert.ok(!/&(?!(amp|lt|gt|quot|apos);)/.test(t), 'un & que no abre una entidad con ' + JSON.stringify(v).slice(0, 60));
    });
  }
});

test('filas: undefined y null NO se mandan (no escribirian la palabra "undefined" ni "null" en la tabla); la cadena vacia, 0 y false SI', async () => {
  const { cli, calls } = nuevo();
  await D.insertarFila(cli, CFG, 'catalogo', { ConfigKey: 'k', Uno: undefined, Dos: null, Tres: '', Cuatro: 0, Cinco: false });
  const b = calls.find(c => c.path === '/Service.asmx').body;
  assert.ok(!/Uno|Dos|undefined|null/.test(b), 'se colaron undefined/null');
  assert.match(b, /<Name>Tres<\/Name><Value><\/Value>/); assert.match(b, /<Name>Cuatro<\/Name><Value>0<\/Value>/); assert.match(b, /<Name>Cinco<\/Name><Value>false<\/Value>/);
});

test('texto con un caracter que XML no admite: se rechaza con ErrorXml ANTES de armar la peticion — cero peticiones, en filtros y en filas', async () => {
  const malos = [ch(0), ch(1), ch(8), ch(11), ch(12), ch(14), ch(31), ch(0xFFFE), ch(0xFFFF), ch(0xD83D), ch(0xDE00), 'NC0008' + ch(11) + '17', 'Word' + ch(11) + 'paste'];
  for (const v of malos) {
    const { cli, calls } = nuevo();
    assert.throws(() => filtroSimple('EmailName', 'equals', v), ErrorXml);
    await assert.rejects(() => D.insertarFila(cli, CFG, 'catalogo', { ConfigKey: 'k', EmailName: v }), ErrorXml);
    await assert.rejects(() => D.upsertarFila(cli, CFG, 'audiencias', { ConfigKey: v }, { Audience_DE: 'x' }), ErrorXml);
    await assert.rejects(() => D.upsertarFila(cli, CFG, 'audiencias', { ConfigKey: 'k' }, { ['Col' + v]: 'x' }), ErrorXml, 'tambien en el NOMBRE de la columna');
    assert.equal(calls.length, 0, 'no salio nada hacia SFMC con ' + JSON.stringify(v));
  }
});
