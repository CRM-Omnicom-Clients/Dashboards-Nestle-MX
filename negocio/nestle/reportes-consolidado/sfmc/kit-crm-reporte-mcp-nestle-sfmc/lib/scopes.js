'use strict';
// Scopes del Installed Package que necesita el kit. Una sola lista para doctor.js y conectar.js.
const REQUERIDOS = ['data_extensions_read', 'data_extensions_write', 'automations_read', 'automations_write', 'automations_execute'];
const OPCIONALES = { journeys_read: 'mapear la audiencia de un journey (scripts/audiencias.js)' };

function clasificarScopes(scopes) {
  const s = new Set(scopes);
  return {
    faltanRequeridos: REQUERIDOS.filter(x => !s.has(x)),
    faltanOpcionales: Object.entries(OPCIONALES).filter(([k]) => !s.has(k)).map(([scope, para]) => ({ scope, para })),
  };
}

module.exports = { REQUERIDOS, OPCIONALES, clasificarScopes };
