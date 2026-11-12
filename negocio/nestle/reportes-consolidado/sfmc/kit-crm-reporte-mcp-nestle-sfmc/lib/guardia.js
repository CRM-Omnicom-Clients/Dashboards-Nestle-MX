'use strict';
// GUARDIA DE ESCRITURA — la politica de seguridad hecha CODIGO, no prosa.
//
// Regla: este kit es de SOLO LECTURA salvo los objetos del propio reporte. Todo cliente SFMC con guardia consulta
// verificar() ANTES de enviar cualquier peticion que no sea una lectura. Lo que no este en la lista, se rechaza —
// aunque un bug o un ID mal pasado lo intentara.
//
// Permitido (y nada mas):
//   REST  POST   /data/v1/customobjects              crear DE  -> nombre con prefijo temporal, y sendable EXPLICITAMENTE falso
//   REST  POST   /automation/v1/queries              crear query -> nombre con prefijo temporal Y que cargue una DE TEMPORAL creada por esta corrida
//   REST  PATCH|PUT /automation/v1/queries/{id}      editar -> una query TEMPORAL de esta corrida (su destino solo puede ser una DE temporal de esta corrida),
//                                                    o la query Vol con su mismo nombre (regenerar su SQL; su destino, si se manda, debe ser la DE de audiencias,
//                                                    y su tipo de actualizacion sigue en Update; un PUT debe mandar destino y tipo explicitos)
//   REST  DELETE /automation/v1/queries/{id}         borrar -> solo una query TEMPORAL de esta corrida
//   REST  POST   /automation/v1/queries/{id}/actions/start   iniciar -> temporal de esta corrida o una query del reporte (por ID)
//   SOAP  Create|Update  DataExtensionObject         filas -> SOLO en la DE catalogo o la DE audiencias
//   SOAP  Delete DataExtension                       borrar DE -> solo una DE TEMPORAL de esta corrida
// NO existe ninguna escritura sobre automations, journeys, assets, Detalle/Piezas/Auditoria/Links (las llenan sus queries).
//
// MODO INSTALACION (solo si el script lo pide con `instalacion`; hoy solo scripts/instalar-links-dia.js): ademas de lo anterior permite crear/editar/borrar/iniciar EXACTAMENTE tres objetos PERMANENTES,
// con sus nombres escritos en la instalacion y registrados en esta corrida: una DE (REST POST customobjects; SOAP Delete para el rollback), una query que la carga (tipo Update, SOLO hacia esa DE)
// y una automation propia con UN paso y UNA actividad que es esa query (mas, para ella sola, activar su horario: POST /legacy/v1/beta/bulk/automations/automation/definition?action=schedule con su id legacy registrado).
// Nada que ya exista bajo otro nombre se puede tocar, y la automation del reporte (CRM_Reporte_Diario) sigue intocable.
//
// 🔴 Por que el DESTINO de una query temporal se vigila: una query Overwrite carga su resultado en la DE destino y la BORRA antes. Sin esta regla, una query
//    temporal apuntada (al crearla o con un PATCH) al catalogo, a Detalle o a cualquier otra DE la sobrescribiria al iniciarse.
const { decodificar } = require('./xml');

class ErrorEscritura extends Error {}

function crearGuardia({ cfg, registro, instalacion = null }) {
  const prefijo = (cfg && cfg.prefijoTemporales) || 'CRM_Tmp_';
  // instalacion = { de: { nombre }, query: { nombre }, automation: { nombre, carpeta } } o null (lo normal: ningun script puede crear objetos permanentes).
  const inst = instalacion && instalacion.de && instalacion.de.nombre && instalacion.query && instalacion.query.nombre && instalacion.automation && instalacion.automation.nombre ? instalacion : null;
  const carpetas = (cfg && cfg.carpetas) || {};
  const mismaCarpeta = (a, b) => a !== undefined && a !== null && b !== undefined && b !== null && String(a) === String(b);
  const TIPO_UPDATE = 1;
  const CLAVES_AUTOMATION_CREAR = ['name', 'key', 'description', 'typeId', 'type', 'categoryId', 'steps', 'startSource', 'schedule'];
  // sin `steps`: a la automation propia no se le agrega otra actividad. Ni `status` ni `statusId`: por PATCH no activan nada (probado en vivo el 22-oct-2026); el horario se activa por RUTA_LEGACY_ACTIVAR.
  const CLAVES_AUTOMATION_EDITAR = ['name', 'key', 'description', 'typeId', 'type', 'categoryId', 'startSource', 'schedule'];
  // correrla UNA vez (run once) para comprobar la instalacion de punta a punta; SFMC solo lo deja si esta en Ready o PausedSchedule. /actions/start NO: pide los pasos y sus actividades en el cuerpo y arranca desde un paso.
  const ACCIONES_AUTOMATION = /^\/automation\/v1\/automations\/([0-9a-fA-F-]{36})\/actions\/runallonce$/;
  // El UNICO camino que activa el horario de una automation creada por la API (Automation Studio y SFMC DevTools usan el mismo): un endpoint "legacy" que pide el id legacy (programId) y el id de su horario.
  const RUTA_LEGACY_ACTIVAR = '/legacy/v1/beta/bulk/automations/automation/definition';
  const ID_LEGACY = /^[A-Za-z0-9_=-]{8,200}$/;          // los ids legacy son base64url (p. ej. "dDZjVVh6NkRMME9aMV8tOFNMYlptdzoyNTow"), no GUID: sin "/", "." ni espacios
  const up = (s) => String(s || '').toUpperCase();
  const keysFilas = new Set([cfg && cfg.des && cfg.des.catalogo && cfg.des.catalogo.key, cfg && cfg.des && cfg.des.audiencias && cfg.des.audiencias.key].filter(Boolean).map(up));
  const idsReporte = new Set(Object.values((cfg && cfg.queries) || {}).map(q => q && q.id).filter(Boolean).map(s => String(s).toLowerCase()));
  const vol = (cfg && cfg.queries && cfg.queries.vol) || {};
  const aud = (cfg && cfg.des && cfg.des.audiencias) || {};
  const niega = (que) => { throw new ErrorEscritura('Escritura NO permitida por la guardia: ' + que + '. Este kit solo escribe en los objetos del reporte (ver docs/SEGURIDAD.md).'); };
  const empiezaTemp = (nombre) => String(nombre || '').startsWith(prefijo);
  const esDeTemp = (key, nombre) => !!key && registro.tieneDe(key) && empiezaTemp(nombre);

  /** El destino (targetKey/targetName/targetId) de una query temporal: si viene, SOLO puede ser una DE temporal de esta corrida. */
  function exigirDestinoTemporal(b, que) {
    if (b.targetId !== undefined) niega(que + ' con targetId (no se puede verificar a que DE apunta; usa targetKey y targetName)');
    const trae = b.targetKey !== undefined || b.targetName !== undefined;
    if (trae && !esDeTemp(b.targetKey, b.targetName)) niega(que + ' hacia la DE "' + b.targetName + '" (key ' + b.targetKey + '): una query temporal solo puede cargar una DE TEMPORAL creada por esta corrida');
  }

  /** Solo con `instalacion`. true = permitido; false = no es una operacion de la instalacion (siguen las reglas de siempre); lanza si ES de la instalacion pero se sale de lo autorizado. */
  function verificarInstalacionRest(m, p, b, consulta) {
    if (m === 'POST' && p === RUTA_LEGACY_ACTIVAR) {
      // Activar el horario: SOLO action=schedule, SOLO de la automation propia (su id legacy lo registra el instalador tras verificar su nombre) y con el cuerpo minimo { id, scheduleObject: { id } }.
      const params = new URLSearchParams(consulta || '');
      const nombres = [...params.keys()];
      if (nombres.length !== 1 || nombres[0] !== 'action' || params.get('action') !== 'schedule') niega('POST ' + p + ' con parametros distintos de action=schedule (no se pausa, ni se edita, ni se toca otra cosa por esta ruta)');
      const claves = Object.keys(b).sort().join(',');
      const so = b.scheduleObject;
      if (claves !== 'id,scheduleObject' || !so || typeof so !== 'object' || Array.isArray(so) || Object.keys(so).join(',') !== 'id') niega('activar el horario con un cuerpo distinto de { id, scheduleObject: { id } }');
      if (typeof b.id !== 'string' || !ID_LEGACY.test(b.id) || typeof so.id !== 'string' || !ID_LEGACY.test(so.id)) niega('activar el horario con ids que no tienen la forma de un id legacy (base64url)');
      if (!registro.tieneInstaladaAutomationLegacy(b.id)) niega('activar el horario de la automation legacy ' + b.id + ' (solo ' + inst.automation.nombre + ', registrada en esta corrida)');
      return true;
    }
    if (m === 'POST' && p === '/data/v1/customobjects' && b.name === inst.de.nombre) {
      if (b.isSendable !== undefined && b.isSendable !== false) niega('crear la DE ' + b.name + ' sendable');
      if (!mismaCarpeta(b.categoryId, carpetas.de)) niega('crear la DE ' + b.name + ' fuera de la carpeta de las DEs del reporte (' + carpetas.de + ')');
      return true;
    }
    if (m === 'POST' && p === '/automation/v1/queries' && b.name === inst.query.nombre) {
      if (b.targetId !== undefined || b.targetName !== inst.de.nombre || !registro.tieneInstaladaDe(b.targetKey)) niega('crear la query ' + b.name + ' hacia la DE "' + b.targetName + '" (solo hacia la DE ' + inst.de.nombre + ' de esta instalacion)');
      if (Number(b.targetUpdateTypeId) !== TIPO_UPDATE) niega('crear la query ' + b.name + ' con un tipo de actualizacion distinto de Update');
      if (!mismaCarpeta(b.categoryId, carpetas.query)) niega('crear la query ' + b.name + ' fuera de la carpeta de las queries del reporte (' + carpetas.query + ')');
      return true;
    }
    let mm = /^\/automation\/v1\/queries\/([0-9a-fA-F-]{36})$/.exec(p);
    if (mm && registro.tieneInstaladaQuery(mm[1])) {
      if (m === 'DELETE') return true;
      if (m === 'PATCH' || m === 'PUT') {
        if (b.name !== undefined && b.name !== inst.query.nombre) niega('renombrar la query ' + inst.query.nombre);
        if (b.targetId !== undefined || (b.targetName !== undefined && b.targetName !== inst.de.nombre) || (b.targetKey !== undefined && !registro.tieneInstaladaDe(b.targetKey))) niega('mover la query ' + inst.query.nombre + ' a otra DE');
        if (b.targetUpdateTypeId !== undefined && Number(b.targetUpdateTypeId) !== TIPO_UPDATE) niega('cambiar el tipo de actualizacion de ' + inst.query.nombre + ' (sigue en Update)');
        if (m === 'PUT' && (b.targetKey === undefined || b.targetName === undefined || b.targetUpdateTypeId === undefined)) niega('PUT sobre ' + inst.query.nombre + ' sin destino y tipo de actualizacion explicitos (PUT reemplaza toda la definicion)');
        return true;
      }
      return false;
    }
    mm = /^\/automation\/v1\/queries\/([0-9a-fA-F-]{36})\/actions\/start$/.exec(p);
    if (mm && m === 'POST' && registro.tieneInstaladaQuery(mm[1])) return true;
    if (m === 'POST' && p === '/automation/v1/automations' && b.name === inst.automation.nombre) {
      const extra = Object.keys(b).filter(k => !CLAVES_AUTOMATION_CREAR.includes(k));
      if (extra.length) niega('crear la automation ' + b.name + ' con campos no autorizados: ' + extra.join(', '));
      if (b.key !== undefined && b.key !== inst.automation.nombre) niega('crear la automation ' + b.name + ' con otra key');
      if (b.categoryId !== undefined && !mismaCarpeta(b.categoryId, inst.automation.carpeta)) niega('crear la automation ' + b.name + ' fuera de su carpeta (' + inst.automation.carpeta + ')');
      const pasos = b.steps;
      if (!Array.isArray(pasos) || pasos.length !== 1 || !pasos[0] || !Array.isArray(pasos[0].activities) || pasos[0].activities.length !== 1) niega('crear la automation ' + b.name + ' con algo distinto de UN paso con UNA actividad');
      const a = pasos[0].activities[0] || {};
      if (Number(a.objectTypeId) !== 300 || !registro.tieneInstaladaQuery(a.activityObjectId)) niega('la unica actividad de la automation ' + b.name + ' debe ser la query ' + inst.query.nombre + ' de esta instalacion');
      return true;
    }
    mm = /^\/automation\/v1\/automations\/([0-9a-fA-F-]{36})$/.exec(p);
    if (mm && registro.tieneInstaladaAutomation(mm[1])) {
      if (m === 'DELETE') return true;
      if (m === 'PATCH' || m === 'PUT') {
        const extra = Object.keys(b).filter(k => !CLAVES_AUTOMATION_EDITAR.includes(k));
        if (extra.length) niega('editar la automation ' + inst.automation.nombre + ' con campos no autorizados: ' + extra.join(', ') + ' (no se le cambian los pasos)');
        if (b.name !== undefined && b.name !== inst.automation.nombre) niega('renombrar la automation ' + inst.automation.nombre);
        if (b.key !== undefined && b.key !== inst.automation.nombre) niega('cambiar la key de la automation ' + inst.automation.nombre);
        return true;
      }
      return false;
    }
    mm = ACCIONES_AUTOMATION.exec(p);
    if (mm && m === 'POST' && registro.tieneInstaladaAutomation(mm[1])) return true;
    return false;
  }

  function verificarRest({ metodo, ruta, cuerpo }) {
    const m = String(metodo).toUpperCase();
    const p = String(ruta).split('?')[0].replace(/\/+$/, '');
    const b = cuerpo || {};
    if (inst && verificarInstalacionRest(m, p, b, String(ruta).split('?').slice(1).join('?'))) return true;
    if (m === 'POST' && p === '/data/v1/customobjects') {
      if (!empiezaTemp(b.name)) niega('crear la DE "' + b.name + '" (solo nombres que empiezan con ' + prefijo + ')');
      if (b.isSendable !== undefined && b.isSendable !== false) niega('crear una DE sendable');
      return true;
    }
    if (m === 'POST' && p === '/automation/v1/queries') {
      if (!empiezaTemp(b.name)) niega('crear la query "' + b.name + '" (solo nombres que empiezan con ' + prefijo + ')');
      if (b.targetId !== undefined || !esDeTemp(b.targetKey, b.targetName)) niega('crear la query "' + b.name + '" hacia la DE "' + b.targetName + '" (key ' + b.targetKey + '): una query temporal solo puede cargar una DE TEMPORAL creada por esta corrida');
      return true;
    }
    let mm = /^\/automation\/v1\/queries\/([0-9a-fA-F-]{36})$/.exec(p);
    if (mm) {
      const id = mm[1].toLowerCase();
      if (m === 'PATCH' || m === 'PUT') {
        if (registro.tieneQuery(id)) { exigirDestinoTemporal(b, 'editar la query temporal ' + id); return true; }
        if (vol.id && id === String(vol.id).toLowerCase() && b.name === vol.nombre) {
          if (b.targetId !== undefined || (b.targetKey !== undefined && up(b.targetKey) !== up(aud.key)) || (b.targetName !== undefined && b.targetName !== aud.nombre)) {
            niega('editar la query Vol hacia otra DE (' + b.targetName + '): su destino es la DE de audiencias y no cambia');
          }
          // 🔴 Su TIPO de actualizacion tampoco cambia: Vol es Update (1). Una Overwrite BORRA la DE de audiencias antes de cargarla, y ahi hay filas que ninguna query recalcula.
          if ((b.targetUpdateTypeId !== undefined && Number(b.targetUpdateTypeId) !== 1) || (b.targetUpdateTypeName !== undefined && !/^update$/i.test(String(b.targetUpdateTypeName)))) {
            niega('editar la query Vol cambiando su tipo de actualización (' + (b.targetUpdateTypeName !== undefined ? b.targetUpdateTypeName : b.targetUpdateTypeId) + '): sigue en Update, porque un Overwrite vaciaría la DE de audiencias antes de cargarla');
          }
          // PUT reemplaza TODA la definicion: lo que no se mande puede volver a su valor por defecto (Overwrite), asi que el destino y el tipo se mandan explicitos.
          if (m === 'PUT' && (b.targetKey === undefined || b.targetName === undefined || b.targetUpdateTypeId === undefined)) {
            niega('PUT sobre la query Vol sin mandar su destino y su tipo de actualización (PUT reemplaza toda la definición; usa PATCH, o manda targetKey, targetName y targetUpdateTypeId)');
          }
          return true;
        }
        niega('editar la query ' + id + ' (solo temporales de esta corrida, o la query Vol para regenerar su SQL)');
      }
      if (m === 'DELETE') { if (registro.tieneQuery(id)) return true; niega('borrar la query ' + id + ' (solo temporales creadas por esta corrida)'); }
    }
    mm = /^\/automation\/v1\/queries\/([0-9a-fA-F-]{36})\/actions\/start$/.exec(p);
    if (mm && m === 'POST') {
      const id = mm[1].toLowerCase();
      if (registro.tieneQuery(id) || idsReporte.has(id)) return true;
      niega('iniciar la query ' + id + ' (no es temporal de esta corrida ni una query del reporte)');
    }
    return niega(m + ' ' + p);
  }

  function verificarSoap({ accion, xml }) {
    const a = String(accion);
    const x = String(xml || '');
    if (a === 'Retrieve') return true;
    const objetos = x.split(/<(?:[\w.-]+:)?Objects\b/).slice(1);          // tambien con prefijo de espacio de nombres (<q:Objects …>): SFMC lo lee igual que <Objects>
    if (!objetos.length) niega('SOAP ' + a + ' sin <Objects>');
    for (const o of objetos) {
      const tipo = (/xsi:type="([^"]+)"/.exec(o.slice(0, Math.max(o.indexOf('>'), 0))) || [])[1];          // el tipo del PROPIO <Objects …>, no el de un elemento de adentro
      const key = decodificar((/<CustomerKey>([^<]+)<\/CustomerKey>/.exec(o) || [])[1] || '');
      if (a === 'Create' || a === 'Update') {
        if (tipo !== 'DataExtensionObject') niega('SOAP ' + a + ' de tipo "' + tipo + '" (solo filas de DataExtensionObject)');
        if (!keysFilas.has(up(key))) niega('SOAP ' + a + ' en la DE ' + key + ' (solo el catálogo y la DE de audiencias aceptan filas)');
      } else if (a === 'Delete') {
        if (inst && tipo === 'Automation') {
          // SFMC no deja borrar una automation por REST (DELETE da 404): la automation PROPIA de la instalacion se borra por SOAP, por su key (= su nombre) o por su ObjectID registrado, y solo si esta corrida la registro.
          const oid = decodificar((/<ObjectID>([^<]+)<\/ObjectID>/.exec(o) || [])[1] || '');
          const registrada = registro.instalados.automations.size > 0;
          if (!registrada || !((key && key === inst.automation.nombre) || (oid && registro.tieneInstaladaAutomation(oid)))) niega('SOAP Delete de la automation "' + (key || oid) + '" (solo ' + inst.automation.nombre + ', registrada en esta corrida)');
          continue;
        }
        if (tipo !== 'DataExtension') niega('SOAP Delete de tipo "' + tipo + '"');
        if (!registro.tieneDe(key) && !(inst && registro.tieneInstaladaDe(key))) niega('SOAP Delete de la DE ' + key + ' (solo temporales creadas por esta corrida' + (inst ? ' o la DE ' + inst.de.nombre + ' de esta instalacion' : '') + ')');
      } else niega('SOAP ' + a);
    }
    return true;
  }

  return {
    ErrorEscritura,
    verificar(op) {
      if (op.canal === 'rest') return verificarRest(op);
      if (op.canal === 'soap') return verificarSoap(op);
      return niega('canal desconocido ' + op.canal);
    },
  };
}

module.exports = { crearGuardia, ErrorEscritura };
