'use strict';
// MODO INSTALACION de la guardia: tres objetos PERMANENTES con nombre escrito (una DE, la query que la carga y una automation propia), y nada mas.
// Los demas permisos y prohibiciones de la guardia se prueban en guardia.test.js; aqui se prueba que abrir este modo NO abre nada extra.
const test = require('node:test');
const assert = require('node:assert/strict');
const { crearGuardia, ErrorEscritura } = require('../lib/guardia');
const { RegistroTemp } = require('../lib/temp');

const K = { cat: '03A9BE5F-0C95-4901-BEB9-3A3BEBF77C6D', aud: 'F4811FBB-1BB6-4BD0-85EF-EBE08A97CB08', det: 'E6A6AA43-BC30-443D-AA79-4ED324F45BA5', pie: '9DA78867-0F91-4CE9-97CD-B2F43BB7862E' };
const Q = { vol: 'ee50e83c-f2c1-4389-b63f-2690cfcec8f9', det: '452234b4-4939-42a7-bc34-9b628782c896' };
const INST = { de: { nombre: 'CRM_Email_Links_Dia' }, query: { nombre: 'CRM_Email_Links_Dia_Load' }, automation: { nombre: 'CRM_Reporte_Links_Dia', carpeta: 708 } };
const KEY_DE = 'AAAAAAAA-1111-2222-3333-444444444444', ID_Q = 'bbbbbbbb-1111-2222-3333-444444444444', ID_A = 'cccccccc-1111-2222-3333-444444444444', ID_DIARIA = '8a8a7b31-f99c-45fb-8482-e7b75858968b';
const cfgInst = () => ({
  prefijoTemporales: 'CRM_Tmp_', carpetas: { de: 445199, query: 460279 },
  des: { catalogo: { nombre: 'CRM_Reporte_Config', key: K.cat }, audiencias: { nombre: 'CRM_Audiencias', key: K.aud }, detalle: { key: K.det }, piezas: { key: K.pie } },
  queries: { vol: { nombre: 'CRM_Audiencias_Vol_Load', id: Q.vol }, detalle: { nombre: 'CRM_Email_Detalle_Load', id: Q.det } },
});
const rest = (metodo, ruta, cuerpo) => ({ canal: 'rest', metodo, ruta, cuerpo });
const soap = (accion, xml) => ({ canal: 'soap', accion, xml });
const fila = (key, tipo = 'DataExtensionObject') => `<Objects xsi:type="${tipo}"><CustomerKey>${key}</CustomerKey><Properties><Property><Name>X</Name><Value>1</Value></Property></Properties></Objects>`;
const instalando = ({ de = true, query = true, automation = true } = {}) => {
  const registro = new RegistroTemp();
  if (de) registro.instalarDe(KEY_DE);
  if (query) registro.instalarQuery(ID_Q);
  if (automation) registro.instalarAutomation(ID_A);
  return { g: crearGuardia({ cfg: cfgInst(), registro, instalacion: INST }), registro };
};
const cuerpoDe = (extra = {}) => ({ name: 'CRM_Email_Links_Dia', isSendable: false, categoryId: 445199, fields: [], ...extra });
const cuerpoQuery = (extra = {}) => ({ name: 'CRM_Email_Links_Dia_Load', queryText: 'SELECT 1', targetName: 'CRM_Email_Links_Dia', targetKey: KEY_DE, targetUpdateTypeId: 1, categoryId: 460279, ...extra });
const cuerpoAuto = (extra = {}) => ({ name: 'CRM_Reporte_Links_Dia', key: 'CRM_Reporte_Links_Dia', categoryId: 708, steps: [{ step: 1, name: '', activities: [{ name: 'CRM_Email_Links_Dia_Load', activityObjectId: ID_Q, objectTypeId: 300, displayOrder: 1 }] }], ...extra });

test('PERMITIDO: crear la DE, la query (Update, hacia esa DE) y la automation propia; editar, iniciar, programar y borrar SOLO esos tres', () => {
  const { g } = instalando({ de: false, query: false, automation: false });
  assert.ok(g.verificar(rest('POST', '/data/v1/customobjects', cuerpoDe())), 'la DE permanente, en la carpeta de las DEs del reporte');
  const { g: g2 } = instalando({ query: false, automation: false });
  assert.ok(g2.verificar(rest('POST', '/automation/v1/queries', cuerpoQuery())), 'la query, solo despues de registrar la DE');
  const { g: g3 } = instalando({ automation: false });
  assert.ok(g3.verificar(rest('POST', '/automation/v1/automations', cuerpoAuto())), 'la automation, solo con UNA actividad: la query registrada');
  const { g: g4 } = instalando();
  assert.ok(g4.verificar(rest('PATCH', `/automation/v1/queries/${ID_Q}`, { name: 'CRM_Email_Links_Dia_Load', queryText: 'SELECT 2', targetName: 'CRM_Email_Links_Dia', targetKey: KEY_DE.toLowerCase(), targetUpdateTypeId: 1 })));
  assert.ok(g4.verificar(rest('PUT', `/automation/v1/queries/${ID_Q}`, { name: 'CRM_Email_Links_Dia_Load', queryText: 'SELECT 2', targetName: 'CRM_Email_Links_Dia', targetKey: KEY_DE, targetUpdateTypeId: 1 })));
  assert.ok(g4.verificar(rest('POST', `/automation/v1/queries/${ID_Q}/actions/start/`, {})));
  assert.ok(g4.verificar(rest('PATCH', `/automation/v1/automations/${ID_A}`, { startSource: { typeId: 1, schedule: { typeId: 3 } } })), 'programar la automation propia');
  assert.ok(g4.verificar(rest('PATCH', `/automation/v1/automations/${ID_A}`, { schedule: { typeId: 3 }, typeId: 1, type: 'scheduled' })));
  assert.ok(g4.verificar(rest('POST', `/automation/v1/automations/${ID_A}/actions/runallonce`, {})), 'correrla una vez (run once)');
  assert.ok(g4.verificar(rest('DELETE', `/automation/v1/automations/${ID_A}`)), 'rollback');
  assert.ok(g4.verificar(rest('DELETE', `/automation/v1/queries/${ID_Q}`)));
  assert.ok(g4.verificar(soap('Delete', fila(KEY_DE.toLowerCase(), 'DataExtension'))), 'la DE permanente tambien se puede borrar (rollback), con la key sin importar mayusculas');
});

test('lo temporal y lo de siempre sigue igual con el modo abierto (consultarTemp, regenerar Vol, iniciar queries del reporte); las demas queries del reporte siguen intocables', () => {
  const { g } = instalando();
  assert.ok(g.verificar(rest('POST', '/data/v1/customobjects', { name: 'CRM_Tmp_r_ab12cd', isSendable: false })));
  assert.ok(g.verificar(rest('PATCH', `/automation/v1/queries/${Q.vol}`, { name: 'CRM_Audiencias_Vol_Load', queryText: 'SELECT 1' })));
  assert.ok(g.verificar(rest('POST', `/automation/v1/queries/${Q.det}/actions/start/`, {})));
  assert.throws(() => g.verificar(rest('PATCH', `/automation/v1/queries/${Q.det}`, { name: 'CRM_Email_Detalle_Load', queryText: 'DROP' })), ErrorEscritura);
});

test('DENEGADO: la DE por nombre, sendable o carpeta; con el modo apagado; y aunque alguien registre ids sin el modo', () => {
  const { g } = instalando({ de: false });
  for (const mal of [cuerpoDe({ isSendable: true }), cuerpoDe({ isSendable: 'true' }), cuerpoDe({ categoryId: 1 }), cuerpoDe({ categoryId: undefined }), cuerpoDe({ name: 'CRM_Email_Links_Dia2' }), cuerpoDe({ name: 'CRM_Email_Detalle' })])
    assert.throws(() => g.verificar(rest('POST', '/data/v1/customobjects', mal)), ErrorEscritura, JSON.stringify(mal).slice(0, 80));
  const sin = new RegistroTemp();
  const apagada = crearGuardia({ cfg: cfgInst(), registro: sin });                       // sin `instalacion`: ningun script puede crear objetos permanentes
  assert.throws(() => apagada.verificar(rest('POST', '/data/v1/customobjects', cuerpoDe())), ErrorEscritura, 'sin modo instalacion nada permanente se crea');
  sin.instalarDe(KEY_DE); sin.instalarQuery(ID_Q); sin.instalarAutomation(ID_A);          // registrar ids NO basta sin el modo
  for (const op of [rest('POST', '/automation/v1/queries', cuerpoQuery()), rest('POST', '/automation/v1/automations', cuerpoAuto()), rest('DELETE', `/automation/v1/automations/${ID_A}`), rest('DELETE', `/automation/v1/queries/${ID_Q}`), soap('Delete', fila(KEY_DE, 'DataExtension'))])
    assert.throws(() => apagada.verificar(op), ErrorEscritura, op.metodo || op.accion);
});

test('DENEGADO: la query solo hacia SU DE ya registrada, en Update, en su carpeta, sin targetId', () => {
  const { g } = instalando({ query: false });
  for (const mal of [cuerpoQuery({ targetUpdateTypeId: 0 }), cuerpoQuery({ targetUpdateTypeId: '0' }), cuerpoQuery({ targetUpdateTypeId: 2 }), cuerpoQuery({ targetUpdateTypeId: undefined }),
    cuerpoQuery({ targetName: 'CRM_Email_Links' }), cuerpoQuery({ targetKey: K.det, targetName: 'CRM_Email_Detalle' }), cuerpoQuery({ targetKey: '99999999-9999-9999-9999-999999999999' }),
    cuerpoQuery({ targetId: 'x' }), cuerpoQuery({ categoryId: 1 }), cuerpoQuery({ name: 'CRM_Email_Links_Dia_Load2' })])
    assert.throws(() => g.verificar(rest('POST', '/automation/v1/queries', mal)), ErrorEscritura, JSON.stringify(mal).slice(0, 90));
  const { g: sinDe } = instalando({ de: false, query: false });
  assert.throws(() => sinDe.verificar(rest('POST', '/automation/v1/queries', cuerpoQuery())), ErrorEscritura, 'la DE debe estar registrada ANTES');
});

test('DENEGADO: editar la query propia hacia otra DE/tipo/nombre, PUT incompleto, y tocar cualquier otra query', () => {
  const { g } = instalando();
  for (const mal of [rest('PATCH', `/automation/v1/queries/${ID_Q}`, { name: 'Otro' }), rest('PATCH', `/automation/v1/queries/${ID_Q}`, { targetName: 'CRM_Email_Detalle' }), rest('PATCH', `/automation/v1/queries/${ID_Q}`, { targetKey: K.det }),
    rest('PATCH', `/automation/v1/queries/${ID_Q}`, { targetId: 'x' }), rest('PATCH', `/automation/v1/queries/${ID_Q}`, { targetUpdateTypeId: 0 }), rest('PUT', `/automation/v1/queries/${ID_Q}`, { name: 'CRM_Email_Links_Dia_Load', queryText: 'SELECT 1' }),
    rest('DELETE', `/automation/v1/queries/${Q.det}`), rest('POST', '/automation/v1/queries/33333333-3333-3333-3333-333333333333/actions/start/', {})])
    assert.throws(() => g.verificar(mal), ErrorEscritura, mal.metodo + ' ' + mal.ruta);
});

test('DENEGADO: la automation propia solo con UN paso y UNA actividad que es SU query; a la propia no se le cambian los pasos; la del reporte (CRM_Reporte_Diario) intocable', () => {
  const { g } = instalando({ automation: false });
  const act = (o = {}) => ({ name: 'x', activityObjectId: ID_Q, objectTypeId: 300, displayOrder: 1, ...o });
  for (const mal of [cuerpoAuto({ steps: [] }), cuerpoAuto({ steps: undefined }), cuerpoAuto({ steps: [{ step: 1, activities: [] }] }),
    cuerpoAuto({ steps: [{ step: 1, activities: [act(), act({ activityObjectId: Q.det })] }] }),                          // dos actividades (una ajena)
    cuerpoAuto({ steps: [{ step: 1, activities: [act()] }, { step: 2, activities: [act()] }] }),                            // dos pasos
    cuerpoAuto({ steps: [{ step: 1, activities: [act({ activityObjectId: Q.det })] }] }),                                    // la query de Detalle
    cuerpoAuto({ steps: [{ step: 1, activities: [act({ activityObjectId: '99999999-9999-9999-9999-999999999999' })] }] }),  // una query no registrada
    cuerpoAuto({ steps: [{ step: 1, activities: [act({ objectTypeId: 42 })] }] }),                                            // otro tipo de actividad
    cuerpoAuto({ status: 'Running' }), cuerpoAuto({ emails: 'x' }), cuerpoAuto({ key: 'otra' }), cuerpoAuto({ categoryId: 1 }), cuerpoAuto({ name: 'CRM_Reporte_Diario', key: 'CRM_Reporte_Diario' })])
    assert.throws(() => g.verificar(rest('POST', '/automation/v1/automations', mal)), ErrorEscritura, JSON.stringify(mal).slice(0, 100));
  const { g: g2 } = instalando();
  for (const mal of [rest('PATCH', `/automation/v1/automations/${ID_A}`, { steps: [] }), rest('PUT', `/automation/v1/automations/${ID_A}`, { steps: [{}] }), rest('PATCH', `/automation/v1/automations/${ID_A}`, { name: 'Otro' }), rest('PATCH', `/automation/v1/automations/${ID_A}`, { key: 'otra' }),
    rest('PATCH', `/automation/v1/automations/${ID_A}`, { status: 'Running' }),
    rest('PATCH', `/automation/v1/automations/${ID_DIARIA}`, { schedule: { typeId: 3 } }), rest('DELETE', `/automation/v1/automations/${ID_DIARIA}`), rest('POST', `/automation/v1/automations/${ID_DIARIA}/actions/runallonce`, {}), rest('PUT', `/automation/v1/automations/${ID_DIARIA}`, { name: 'CRM_Reporte_Diario' })])
    assert.throws(() => g2.verificar(mal), ErrorEscritura, mal.metodo + ' ' + mal.ruta);
});

test('el SOAP no cambia: filas solo en catalogo/audiencias, y Delete solo de DEs temporales o de la DE de la instalacion', () => {
  const { g } = instalando();
  for (const mal of [soap('Create', fila(KEY_DE)), soap('Update', fila(KEY_DE)), soap('Delete', fila(K.cat, 'DataExtension')), soap('Delete', fila(K.det, 'DataExtension')), soap('Delete', fila('99999999-9999-9999-9999-999999999999', 'DataExtension')), soap('Delete', fila(KEY_DE, 'DataExtensionObject'))])
    assert.throws(() => g.verificar(mal), ErrorEscritura, mal.accion + ' ' + mal.xml.slice(0, 60));
  assert.ok(g.verificar(soap('Create', fila(K.cat))));
});

test('una instalacion incompleta (sin alguno de los tres nombres) equivale a NO haber pedido el modo', () => {
  const registro = new RegistroTemp(); registro.instalarDe(KEY_DE);
  const g = crearGuardia({ cfg: cfgInst(), registro, instalacion: { de: { nombre: 'CRM_Email_Links_Dia' }, query: { nombre: 'CRM_Email_Links_Dia_Load' } } });
  assert.throws(() => g.verificar(rest('POST', '/data/v1/customobjects', cuerpoDe())), ErrorEscritura);
});

test('el registro de instalados va aparte de los temporales: limpiar temporales nunca los toca, y quitarlos los vuelve a prohibir', () => {
  const { g, registro } = instalando();
  assert.equal(registro.pendientes, 0, 'los instalados no cuentan como temporales pendientes de limpiar');
  assert.deepEqual(registro.listaDes(), []); assert.deepEqual(registro.listaQueries(), []);
  registro.quitarInstaladaAutomation(ID_A);
  assert.throws(() => g.verificar(rest('DELETE', `/automation/v1/automations/${ID_A}`)), ErrorEscritura);
  registro.quitarInstaladaQuery(ID_Q); registro.quitarInstaladaDe(KEY_DE);
  assert.throws(() => g.verificar(rest('DELETE', `/automation/v1/queries/${ID_Q}`)), ErrorEscritura);
  assert.throws(() => g.verificar(soap('Delete', fila(KEY_DE, 'DataExtension'))), ErrorEscritura);
});

test('SFMC no borra automations por REST (DELETE da 404): la automation PROPIA se borra por SOAP, por su key o por su ObjectID registrado; ninguna otra', () => {
  const borrar = (tipo, campo, valor) => soap('Delete', `<Objects xsi:type="${tipo}"><${campo}>${valor}</${campo}></Objects>`);
  const { g } = instalando();
  assert.ok(g.verificar(borrar('Automation', 'CustomerKey', 'CRM_Reporte_Links_Dia')), 'por su key (= su nombre)');
  assert.ok(g.verificar(borrar('Automation', 'ObjectID', ID_A.toUpperCase())), 'por su ObjectID registrado, sin importar mayusculas');
  for (const mal of [borrar('Automation', 'CustomerKey', 'CRM_Reporte_Diario'), borrar('Automation', 'ObjectID', ID_DIARIA), borrar('Automation', 'ObjectID', '99999999-9999-9999-9999-999999999999'),
    borrar('Automation', 'Name', 'CRM_Reporte_Links_Dia'), borrar('AutomationTask', 'CustomerKey', 'CRM_Reporte_Links_Dia'), borrar('Journey', 'CustomerKey', 'CRM_Reporte_Links_Dia')])
    assert.throws(() => g.verificar(mal), ErrorEscritura, mal.xml.slice(0, 80));
  const { g: sinRegistrar } = instalando({ automation: false });
  assert.throws(() => sinRegistrar.verificar(borrar('Automation', 'CustomerKey', 'CRM_Reporte_Links_Dia')), ErrorEscritura, 'sin haberla registrado en esta corrida no se borra ni por su nombre');
  const apagada = crearGuardia({ cfg: cfgInst(), registro: new RegistroTemp() });
  assert.throws(() => apagada.verificar(borrar('Automation', 'CustomerKey', 'CRM_Reporte_Links_Dia')), ErrorEscritura, 'sin el modo instalacion tampoco');
});

// SFMC crea toda automation de la API en PausedSchedule y PATCH / status / las rutas /actions/* NO la activan (probado en vivo el 22-oct-2026); lo unico que la activa es el endpoint "legacy" de Automation Studio.
const RUTA_LEG = '/legacy/v1/beta/bulk/automations/automation/definition';
const LEGACY = 'dDZjVVh6NkRMME9aMV8tOFNMYlptdzoyNTow', LEGACY_HORARIO = 'MEJ0MGpWWkVmMENwUnp3dVl0allNQTozNjow', LEGACY_AJENO = 'bUxSUlNlLVFzMEdaLXVoNGhCak5PQToyNTow';
test('ACTIVAR EL HORARIO (endpoint legacy): solo action=schedule, solo del id legacy registrado de la automation propia y solo con el cuerpo { id, scheduleObject: { id } }', () => {
  const { g, registro } = instalando();
  const act = (extra = {}) => ({ id: LEGACY, scheduleObject: { id: LEGACY_HORARIO }, ...extra });
  const ruta = `${RUTA_LEG}/?action=schedule`;
  assert.throws(() => g.verificar(rest('POST', ruta, act())), ErrorEscritura, 'sin registrar el id legacy no pasa');
  registro.instalarAutomationLegacy(LEGACY);
  assert.ok(g.verificar(rest('POST', ruta, act())), 'registrado: pasa');
  assert.ok(g.verificar(rest('POST', `${RUTA_LEG}?action=schedule`, act())), 'tambien sin la barra final');
  for (const mal of [
    rest('POST', `${RUTA_LEG}/?action=pauseSchedule`, act()), rest('POST', `${RUTA_LEG}/?action=delete`, act()), rest('POST', `${RUTA_LEG}/`, act()), rest('POST', `${RUTA_LEG}/?action=Schedule`, act()),
    rest('POST', `${RUTA_LEG}/?action=schedule&x=1`, act()), rest('POST', `${RUTA_LEG}/?action=schedule&action=pauseSchedule`, act()), rest('POST', `${RUTA_LEG}/?x=1`, act()),
    rest('POST', ruta, act({ id: LEGACY_AJENO })),                                          // el id legacy de OTRA automation (no registrado)
    rest('POST', ruta, act({ id: LEGACY.toLowerCase() })),                                  // los ids legacy distinguen mayusculas
    rest('POST', ruta, act({ extra: 1 })), rest('POST', ruta, { id: LEGACY }), rest('POST', ruta, { scheduleObject: { id: LEGACY_HORARIO } }), rest('POST', ruta, {}),
    rest('POST', ruta, act({ scheduleObject: { id: LEGACY_HORARIO, startDate: '2026-01-01' } })), rest('POST', ruta, act({ scheduleObject: {} })), rest('POST', ruta, act({ scheduleObject: [LEGACY_HORARIO] })), rest('POST', ruta, act({ scheduleObject: 'x' })),
    rest('POST', ruta, act({ id: 'no es un id/../x' })), rest('POST', ruta, act({ scheduleObject: { id: 'a b' } })), rest('POST', ruta, act({ id: 5 })), rest('POST', ruta, act({ scheduleObject: { id: null } })),
    rest('PUT', ruta, act()), rest('PATCH', ruta, act()), rest('DELETE', `${RUTA_LEG}/${LEGACY}`), rest('POST', `${RUTA_LEG}/${LEGACY}/?action=schedule`, act()), rest('POST', '/legacy/v1/beta/bulk/automations/automation/definition/other?action=schedule', act()),
  ]) assert.throws(() => g.verificar(mal), ErrorEscritura, mal.metodo + ' ' + mal.ruta + ' ' + String(JSON.stringify(mal.cuerpo)).slice(0, 70));
  const apagada = crearGuardia({ cfg: cfgInst(), registro });                              // sin `instalacion`, aunque el id este registrado
  assert.throws(() => apagada.verificar(rest('POST', ruta, act())), ErrorEscritura, 'sin el modo instalacion no se activa nada');
  registro.quitarInstaladaAutomationLegacy(LEGACY);
  assert.throws(() => g.verificar(rest('POST', ruta, act())), ErrorEscritura, 'quitado el registro vuelve a estar prohibido');
});
test('PATCH de la automation propia: ya no admite status ni statusId (no activan nada); de las rutas /actions/* solo se permite runallonce (correrla UNA vez): start, pause, stop y las de activacion que SFMC contesta 404, no', () => {
  const { g } = instalando();
  for (const mal of [rest('PATCH', `/automation/v1/automations/${ID_A}`, { statusId: 6 }), rest('PATCH', `/automation/v1/automations/${ID_A}`, { status: 'Scheduled' }),
    ...['start', 'resume', 'resumeschedule', 'startschedule', 'activate', 'pause', 'stop', 'pauseschedule', 'runallonce/extra'].map((a) => rest('POST', `/automation/v1/automations/${ID_A}/actions/${a}`, {}))])
    assert.throws(() => g.verificar(mal), ErrorEscritura, mal.metodo + ' ' + mal.ruta);
  assert.ok(g.verificar(rest('POST', `/automation/v1/automations/${ID_A}/actions/runallonce/`, {})), 'correrla una vez sigue permitido (con o sin barra final)');
  for (const m of ['PUT', 'PATCH', 'DELETE']) assert.throws(() => g.verificar(rest(m, `/automation/v1/automations/${ID_A}/actions/runallonce`, {})), ErrorEscritura, 'solo POST: ' + m);
});
