'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { crearGuardia, ErrorEscritura } = require('../lib/guardia');
const { RegistroTemp } = require('../lib/temp');

const K = { cat: '03A9BE5F-0C95-4901-BEB9-3A3BEBF77C6D', aud: 'F4811FBB-1BB6-4BD0-85EF-EBE08A97CB08', det: 'E6A6AA43-BC30-443D-AA79-4ED324F45BA5', pie: '9DA78867-0F91-4CE9-97CD-B2F43BB7862E' };
const Q = { vol: 'ee50e83c-f2c1-4389-b63f-2690cfcec8f9', det: '452234b4-4939-42a7-bc34-9b628782c896' };
const cfg = () => ({
  prefijoTemporales: 'CRM_Tmp_',
  des: { catalogo: { nombre: 'CRM_Reporte_Config', key: K.cat }, audiencias: { nombre: 'CRM_Audiencias', key: K.aud }, detalle: { key: K.det }, piezas: { key: K.pie } },
  queries: { vol: { nombre: 'CRM_Audiencias_Vol_Load', id: Q.vol }, detalle: { nombre: 'CRM_Email_Detalle_Load', id: Q.det } },
});
function nuevo() {
  const registro = new RegistroTemp();
  registro.addQuery('11111111-1111-1111-1111-111111111111', 'CRM_Tmp_x_aaaaaa');
  registro.addDe('22222222-2222-2222-2222-222222222222', 'CRM_Tmp_x_aaaaaa');
  return { g: crearGuardia({ cfg: cfg(), registro }), registro };
}
const rest = (metodo, ruta, cuerpo) => ({ canal: 'rest', metodo, ruta, cuerpo });
const soap = (accion, xml) => ({ canal: 'soap', accion, xml });
const fila = (key, tipo = 'DataExtensionObject') => `<Objects xsi:type="${tipo}"><CustomerKey>${key}</CustomerKey><Properties><Property><Name>X</Name><Value>1</Value></Property></Properties></Objects>`;
const T = '11111111-1111-1111-1111-111111111111';
const DT = '22222222-2222-2222-2222-222222222222';                 // la DE temporal registrada por nuevo()

test('PERMITIDO (rest): crear DE/query temporales, editar/borrar/iniciar temporales, regenerar Vol, iniciar queries del reporte', () => {
  const { g } = nuevo();
  assert.ok(g.verificar(rest('POST', '/data/v1/customobjects', { name: 'CRM_Tmp_r_ab12cd', isSendable: false })));
  assert.ok(g.verificar(rest('POST', '/automation/v1/queries', { name: 'CRM_Tmp_r_ab12cd_Load', targetKey: DT, targetName: 'CRM_Tmp_x_aaaaaa' })));
  assert.ok(g.verificar(rest('PATCH', `/automation/v1/queries/${T}`, { name: 'CRM_Tmp_x' })), 'editar el SQL sin tocar el destino');
  assert.ok(g.verificar(rest('PATCH', `/automation/v1/queries/${T}`, { name: 'CRM_Tmp_x', targetKey: DT.toLowerCase(), targetName: 'CRM_Tmp_x_aaaaaa' })), 're-apuntar a OTRA DE temporal de esta corrida');
  assert.ok(g.verificar(rest('PUT', `/automation/v1/queries/${T}`, { name: 'CRM_Tmp_x' })), 'PUT se vigila igual que PATCH');
  assert.ok(g.verificar(rest('DELETE', `/automation/v1/queries/${T}`)));
  assert.ok(g.verificar(rest('POST', `/automation/v1/queries/${T}/actions/start/`, {})));
  assert.ok(g.verificar(rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', queryText: 'SELECT 1' })));
  assert.ok(g.verificar(rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', queryText: 'SELECT 1', targetName: 'CRM_Audiencias', targetKey: K.aud.toLowerCase() })), 'Vol con su destino de siempre (la DE de audiencias)');
  assert.ok(g.verificar(rest('PUT', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', queryText: 'SELECT 1', targetKey: K.aud, targetName: 'CRM_Audiencias', targetUpdateTypeId: 1 })), 'PUT con destino y tipo explicitos');
  assert.ok(g.verificar(rest('POST', `/automation/v1/queries/${Q.det}/actions/start/?x=1`, {})));
});
test('PERMITIDO (rest): el cuerpo EXACTO que manda audiencias.js para regenerar Vol (copia el tipo de actualizacion vivo, que es Update) y su rollback', () => {
  const { g } = nuevo();
  const vivo = { queryDefinitionId: Q.vol, name: 'CRM_Audiencias_Vol_Load', key: 'CRM_Audiencias_Vol_Load', description: 'x', queryText: 'SELECT 1', targetName: 'CRM_Audiencias', targetKey: K.aud, targetUpdateTypeId: 1, targetUpdateTypeName: 'Update', categoryId: 460279 };
  assert.ok(g.verificar(rest('PATCH', `/automation/v1/queries/${Q.vol}`, vivo)));
  assert.ok(g.verificar(rest('PATCH', `/automation/v1/queries/${Q.vol}`, { ...vivo, targetUpdateTypeId: '1', targetUpdateTypeName: 'UPDATE' })), 'el tipo como texto o en mayusculas es el mismo');
});

test('PERMITIDO (soap): Retrieve libre; Create/Update solo filas de catalogo y audiencias; Delete solo DE temporal registrada', () => {
  const { g } = nuevo();
  assert.ok(g.verificar(soap('Retrieve', '<cualquiera/>')));
  assert.ok(g.verificar(soap('Create', fila(K.cat))));
  assert.ok(g.verificar(soap('Update', '<Options/>' + fila(K.aud.toLowerCase()))), 'GUID sin importar mayusculas');
  assert.ok(g.verificar(soap('Delete', fila('22222222-2222-2222-2222-222222222222', 'DataExtension'))));
});

test('DENEGADO (rest): nada fuera de la lista', () => {
  const { g } = nuevo();
  const malos = [
    rest('POST', '/data/v1/customobjects', { name: 'CRM_Reporte_Config' }),                       // sin prefijo temporal
    rest('POST', '/data/v1/customobjects', { name: 'CRM_Tmp_ok', isSendable: true }),            // sendable
    rest('POST', '/data/v1/customobjects', { name: 'CRM_Tmp_ok', isSendable: 'true' }),          // sendable como texto
    rest('POST', '/data/v1/customobjects', { name: 'CRM_Tmp_ok', isSendable: 1 }),               // sendable como numero
    rest('POST', '/automation/v1/queries', { name: 'CRM_Email_Detalle_Load' }),                   // sin prefijo
    rest('PATCH', `/automation/v1/queries/${Q.det}`, { name: 'CRM_Email_Detalle_Load', queryText: 'DROP' }), // query del reporte que NO es Vol
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'OTRO_NOMBRE' }),                    // Vol con otro nombre
    rest('DELETE', `/automation/v1/queries/${Q.det}`),                                            // borrar query del reporte
    rest('DELETE', '/automation/v1/queries/33333333-3333-3333-3333-333333333333'),                // temporal NO registrada
    rest('POST', '/automation/v1/queries/33333333-3333-3333-3333-333333333333/actions/start/', {}), // query desconocida
    rest('DELETE', '/automation/v1/automations/8a8a7b31-f99c-45fb-8482-e7b75858968b'),            // automations: ni tocar
    rest('POST', '/automation/v1/automations/8a8a7b31-f99c-45fb-8482-e7b75858968b/actions/start/', {}),
    rest('PATCH', '/interaction/v1/interactions/x', {}),                                          // journeys
    rest('PUT', '/asset/v1/content/assets/1', {}),                                                // content builder
    // el DESTINO de una query temporal: una Overwrite BORRA su DE destino antes de cargarla
    rest('POST', '/automation/v1/queries', { name: 'CRM_Tmp_q', targetKey: K.cat, targetName: 'CRM_Reporte_Config' }),                   // el catalogo
    rest('POST', '/automation/v1/queries', { name: 'CRM_Tmp_q', targetKey: K.det, targetName: 'CRM_Email_Detalle' }),                    // Detalle
    rest('POST', '/automation/v1/queries', { name: 'CRM_Tmp_q', targetKey: DT, targetName: 'CRM_Reporte_Config' }),                      // key de una temporal pero el nombre del catalogo
    rest('POST', '/automation/v1/queries', { name: 'CRM_Tmp_q', targetKey: '99999999-9999-9999-9999-999999999999', targetName: 'CRM_Tmp_otra' }), // "parece" temporal pero esta corrida no la creo
    rest('POST', '/automation/v1/queries', { name: 'CRM_Tmp_q' }),                                                                        // sin destino
    rest('POST', '/automation/v1/queries', { name: 'CRM_Tmp_q', targetKey: DT, targetName: 'CRM_Tmp_x_aaaaaa', targetId: 'x' }),         // targetId: no verificable
    rest('PATCH', `/automation/v1/queries/${T}`, { name: 'CRM_Tmp_x', targetKey: K.cat, targetName: 'CRM_Reporte_Config' }),            // re-apuntar una temporal al catalogo
    rest('PATCH', `/automation/v1/queries/${T}`, { name: 'CRM_Tmp_x', targetKey: DT }),                                               // solo la key (sin nombre temporal)
    rest('PATCH', `/automation/v1/queries/${T}`, { name: 'CRM_Tmp_x', targetName: 'CRM_Reporte_Config' }),                              // solo el nombre del catalogo
    rest('PUT', `/automation/v1/queries/${T}`, { name: 'CRM_Tmp_x', targetKey: K.det, targetName: 'CRM_Email_Detalle' }),               // PUT igual que PATCH
    rest('PATCH', `/automation/v1/queries/${T}`, { name: 'CRM_Tmp_x', targetId: '44444444-4444-4444-4444-444444444444' }),             // targetId
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetKey: K.cat, targetName: 'CRM_Reporte_Config' }), // Vol re-apuntada al catalogo
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetKey: K.det }),                           // Vol re-apuntada a Detalle (solo la key)
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetName: 'CRM_Email_Detalle' }),            // Vol re-apuntada (solo el nombre)
    rest('PUT', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetKey: K.cat }),                               // PUT igual que PATCH
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetId: '44444444-4444-4444-4444-444444444444' }),
    // el TIPO de actualizacion de Vol: una Overwrite BORRA la DE de audiencias antes de cargarla (y ahi hay filas que ninguna query recalcula)
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetUpdateTypeId: 0 }),                    // Overwrite
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetUpdateTypeId: '0' }),                  // Overwrite como texto
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetUpdateTypeId: null }),                 // null se convierte en 0
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetUpdateTypeId: false }),                // false tambien
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetUpdateTypeId: 2 }),                    // Append
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetUpdateTypeId: 'abc' }),                // basura
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetUpdateTypeName: 'Overwrite' }),
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetUpdateTypeName: 'Append' }),
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetUpdateTypeName: '' }),
    rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetUpdateTypeId: 1, targetUpdateTypeName: 'Overwrite' }),   // se contradicen: gana lo malo
    // PUT reemplaza TODA la definicion: lo que no se mande puede volver a su valor por defecto
    rest('PUT', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', queryText: 'SELECT 1' }),                       // sin destino ni tipo
    rest('PUT', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetKey: K.aud, targetName: 'CRM_Audiencias' }),   // sin tipo
    rest('PUT', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetKey: K.aud, targetUpdateTypeId: 1 }),           // sin nombre del destino
    rest('PUT', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetName: 'CRM_Audiencias', targetUpdateTypeId: 1 }), // sin la key del destino
    rest('PUT', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', targetKey: K.aud, targetName: 'CRM_Audiencias', targetUpdateTypeId: 0 }), // con tipo Overwrite
  ];
  for (const op of malos) assert.throws(() => g.verificar(op), ErrorEscritura, op.metodo + ' ' + op.ruta);
});

test('DENEGADO (soap): filas en Detalle/Piezas, otros tipos, borrar DE no temporal, acciones desconocidas', () => {
  const { g } = nuevo();
  const malos = [
    soap('Update', fila(K.det)), soap('Create', fila(K.pie)),                                    // las llenan sus queries, no scripts
    soap('Create', fila(K.cat, 'Subscriber')),                                                    // otro tipo
    soap('Delete', fila(K.cat, 'DataExtension')),                                                 // borrar el catalogo
    soap('Delete', fila('99999999-9999-9999-9999-999999999999', 'DataExtension')),                // "parece" temporal pero no la creo esta corrida
    soap('Delete', fila('22222222-2222-2222-2222-222222222222', 'DataExtensionObject')),          // tipo equivocado
    soap('Perform', '<x/>'), soap('Create', '<sin-objects/>'),
  ];
  for (const op of malos) assert.throws(() => g.verificar(op), ErrorEscritura, op.accion);
});

test('DENEGADO (soap): el mismo objeto prohibido con prefijo de espacio de nombres, con el tipo escondido en un elemento de adentro, o pegado despues de uno permitido', () => {
  const { g } = nuevo();
  const pref = (key, tipo) => `<q:Objects xmlns:q="http://exacttarget.com/wsdl/partnerAPI" xsi:type="${tipo}"><CustomerKey>${key}</CustomerKey></q:Objects>`;
  const malos = [
    soap('Create', pref(K.det, 'DataExtensionObject')),                                  // Detalle, con prefijo: SFMC lo lee igual que <Objects>
    soap('Update', pref(K.pie, 'DataExtensionObject')),
    soap('Create', fila(K.cat) + pref(K.det, 'DataExtensionObject')),                    // uno permitido y, pegado, uno prohibido con prefijo
    soap('Create', pref(K.det, 'DataExtensionObject') + fila(K.cat)),                    // al reves
    soap('Delete', pref(K.cat, 'DataExtension')),                                        // borrar el catalogo con prefijo
    soap('Create', pref(K.cat, 'Automation')),                                           // otro tipo con prefijo
    soap('Create', `<Objects><CustomerKey>${K.cat}</CustomerKey><Properties><Property xsi:type="DataExtensionObject"/></Properties></Objects>`),   // el tipo esta en un elemento de adentro, no en el <Objects>
    soap('Create', `<Objects xsi:type='DataExtensionObject'><CustomerKey>${K.cat}</CustomerKey></Objects>`),                                           // comillas simples: no verificable => cerrado
    soap('Create', `<Objects xsi:type = "DataExtensionObject"><CustomerKey>${K.cat}</CustomerKey></Objects>`),                                         // espacios alrededor del =
    soap('Create', `<Objects xsi:type="DataExtensionObject"><q:CustomerKey>${K.cat}</q:CustomerKey></Objects>`),                                       // CustomerKey con prefijo: la key no se puede leer => cerrado
    soap('Create', '<Objects xsi:type="DataExtensionObject"'),                                                                                         // etiqueta sin cerrar
  ];
  for (const op of malos) assert.throws(() => g.verificar(op), ErrorEscritura, op.accion + ' ' + op.xml.slice(0, 70));
  assert.ok(g.verificar(soap('Create', pref(K.cat, 'DataExtensionObject'))), 'lo legitimo con prefijo se juzga igual que sin prefijo');
});

test('el catalogo sin key descubierta NO acepta filas (config incompleta => cerrado)', () => {
  const c = cfg(); c.des.catalogo.key = null;
  const g = crearGuardia({ cfg: c, registro: new RegistroTemp() });
  assert.throws(() => g.verificar(soap('Create', fila(K.cat))), ErrorEscritura);
});

test('una DE/query registrada deja de ser permitida cuando se quita del registro (ya borrada)', () => {
  const { g, registro } = nuevo();
  assert.ok(g.verificar(rest('DELETE', `/automation/v1/queries/${T}`)));
  registro.quitarQuery(T);
  assert.throws(() => g.verificar(rest('DELETE', `/automation/v1/queries/${T}`)), ErrorEscritura);
});
