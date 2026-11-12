'use strict';
// Registro de objetos TEMPORALES creados por esta corrida (DEs y queries). Lo usan:
//  - la guardia: solo se puede borrar/disparar/editar lo que ESTA corrida creo (o las queries del reporte por ID);
//  - la limpieza: lo registrado se borra en `finally` y al recibir SIGINT/SIGTERM.
// Nombres UNICOS por corrida (sufijo aleatorio): dos operadores a la vez no se pisan la DE ni la query.
const crypto = require('crypto');

class RegistroTemp {
  constructor() {
    this.des = new Map(); this.queries = new Map();       // clave normalizada -> { nombre, id|key } (el ORIGINAL, para borrar)
    // Objetos PERMANENTES que un INSTALADOR (scripts/instalar-*.js) crea o adopta en esta corrida. Van APARTE de los temporales: la limpieza de temporales NUNCA los borra,
    // y la guardia solo los toca si el instalador los registro aqui (y solo con los nombres que esa instalacion autoriza).
    // `automationsLegacy`: el id "legacy" (programId) de la automation propia — es el que pide el endpoint que activa su horario; NO es el id de la API REST normal.
    this.instalados = { des: new Set(), queries: new Set(), automations: new Set(), automationsLegacy: new Set() };
  }
  instalarDe(key) { this.instalados.des.add(String(key).toUpperCase()); }
  instalarQuery(id) { this.instalados.queries.add(String(id).toLowerCase()); }
  instalarAutomation(id) { this.instalados.automations.add(String(id).toLowerCase()); }
  instalarAutomationLegacy(id) { this.instalados.automationsLegacy.add(String(id)); }                 // base64url (distingue mayusculas): NO se pasa a minusculas
  tieneInstaladaDe(key) { return this.instalados.des.has(String(key).toUpperCase()); }
  tieneInstaladaQuery(id) { return this.instalados.queries.has(String(id).toLowerCase()); }
  tieneInstaladaAutomation(id) { return this.instalados.automations.has(String(id).toLowerCase()); }
  tieneInstaladaAutomationLegacy(id) { return this.instalados.automationsLegacy.has(String(id)); }
  quitarInstaladaDe(key) { this.instalados.des.delete(String(key).toUpperCase()); }
  quitarInstaladaQuery(id) { this.instalados.queries.delete(String(id).toLowerCase()); }
  quitarInstaladaAutomation(id) { this.instalados.automations.delete(String(id).toLowerCase()); }
  quitarInstaladaAutomationLegacy(id) { this.instalados.automationsLegacy.delete(String(id)); }
  addDe(key, nombre) { this.des.set(String(key).toUpperCase(), { nombre, key: String(key) }); }
  addQuery(id, nombre) { this.queries.set(String(id).toLowerCase(), { nombre, id: String(id) }); }
  tieneDe(key) { return this.des.has(String(key).toUpperCase()); }
  tieneQuery(id) { return this.queries.has(String(id).toLowerCase()); }
  quitarDe(key) { this.des.delete(String(key).toUpperCase()); }
  quitarQuery(id) { this.queries.delete(String(id).toLowerCase()); }
  listaDes() { return [...this.des.values()]; }
  listaQueries() { return [...this.queries.values()]; }
  get pendientes() { return this.des.size + this.queries.size; }
}

/** CRM_Tmp_<etiqueta>_<6 hex> — etiqueta saneada, nombre <= 60 chars. */
function nombreTemp(prefijo, etiqueta) {
  const e = String(etiqueta || 'x').replace(/[^A-Za-z0-9]+/g, '').slice(0, 20) || 'x';
  return `${prefijo}${e}_${crypto.randomBytes(3).toString('hex')}`;
}

module.exports = { RegistroTemp, nombreTemp };
