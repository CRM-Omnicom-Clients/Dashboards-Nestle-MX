'use strict';
// CAPA DE LLAVE. Hoy el catalogo tiene PK ConfigKey (+ PiezaID y ContentName legados); la migracion pendiente la pasa a
// PK = EmailName y quita esas tres columnas. Los scripts no hardcodean eso: preguntan aqui, y el modo se DETECTA del
// esquema real de la DE (no de un flag). Asi la migracion no obliga a reescribir los scripts.
//
//   modo 'configkey' : PK ConfigKey. Se escribe ConfigKey, PiezaID='*por definir' y ContentName=EmailName.
//   modo 'emailname' : PK EmailName. Solo EmailName (y las dimensiones).
//
// Identidad de una pieza en las DEs de SALIDA (Detalle/Piezas/Auditoria/Links): EmailName existe en TODAS, antes y despues
// de la migracion => para "¿ya aterrizo la pieza?" se cuenta SIEMPRE por EmailName.
const COL_IDENTIDAD = 'EmailName';
const PIEZA_ID_POR_DEFINIR = '*por definir';   // 🔴 regla dura: el numero de pieza lo pone el normalizador de Rick, nunca este codigo

class ErrorEsquema extends Error { constructor(msg, errores) { super(msg); this.name = 'ErrorEsquema'; this.errores = errores || []; } }

// entrada (camelCase) -> columna del catalogo
const MAPA = { codigoNC: 'CodigoNC', bu: 'BU', marca: 'Marca', campana: 'Campana', touchpoint: 'Touchpoint', segmento: 'Segmento',
  emailType: 'EmailType', estado: 'Estado', activo: 'Activo', notas: 'Notas', emailId: 'EmailID', journeyUUID: 'JourneyUUID' };
// Texto libre: si no cabe se recorta con "..." y se avisa. Todo lo demas (dimensiones, identidad) NUNCA se recorta en silencio.
const RECORTABLES = new Set(['Notas']);

/** 'configkey' | 'emailname' segun la PK real de la DE. override: 'auto' | 'ConfigKey' | 'EmailName'. */
function detectarModo(columnas, override = 'auto') {
  if (override === 'ConfigKey') return 'configkey';
  if (override === 'EmailName') return 'emailname';
  const pk = columnas.filter(c => c.pk).map(c => c.name);
  if (pk.includes('ConfigKey')) return 'configkey';
  if (pk.length === 1 && pk[0] === 'EmailName') return 'emailname';
  throw new ErrorEsquema(`No reconozco el esquema: la PK de la DE es [${pk.join(', ') || 'ninguna'}] (esperaba ConfigKey o EmailName).`);
}
const columnaClave = (modo) => (modo === 'configkey' ? 'ConfigKey' : 'EmailName');

function poneColumna(porNombre, props, omitidas, recortadas, errores, col, valor) {
  const c = porNombre.get(col);
  if (!c) { omitidas.push(col); return; }
  if (valor === undefined || valor === null || valor === '') return;
  if (c.type === 'Number' || c.type === 'Decimal') {
    if (!/^-?\d+(\.\d+)?$/.test(String(valor))) { errores.push(`${col} debe ser numérico (es ${JSON.stringify(valor)})`); return; }
    props[col] = String(valor); return;
  }
  let v = String(valor);
  if (c.length && v.length > c.length) {
    if (RECORTABLES.has(col)) { const nuevo = v.slice(0, c.length - 3) + '...'; recortadas.push({ campo: col, de: v.length, a: nuevo.length }); v = nuevo; }
    else { errores.push(`${col} mide ${v.length} caracteres y el campo admite ${c.length}`); return; }
  }
  props[col] = v;
}

/**
 * Arma la fila del catalogo SOLO con columnas que existen. entrada: { emailName, configKey?, bu, marca, campana, touchpoint,
 * segmento, emailType, estado, activo, notas, emailId, codigoNC, journeyUUID, extra:{col:valor} }.
 * Devuelve { props, claves, omitidas, recortadas, errores } — quien llama decide si `errores` aborta.
 */
function construirFilaCatalogo(columnas, entrada, { modo } = {}) {
  const m = modo || detectarModo(columnas);
  const porNombre = new Map(columnas.map(c => [c.name, c]));
  const props = {}, omitidas = [], recortadas = [], errores = [];
  const poner = (col, v) => poneColumna(porNombre, props, omitidas, recortadas, errores, col, v);

  if (entrada.piezaId !== undefined) errores.push('PiezaID no se asigna aquí: va "*por definir" y el número lo pone el normalizador (regla dura)');
  if (!entrada.emailName) errores.push('falta emailName (el nombre EXACTO de _Job; ver scripts/resolver-emailname.js)');
  else if (!porNombre.has(COL_IDENTIDAD)) errores.push('el catálogo no tiene la columna EmailName');
  else poner(COL_IDENTIDAD, entrada.emailName);

  if (m === 'configkey') {
    if (!entrada.configKey) errores.push('falta configKey (es la PK del catálogo en este esquema)'); else poner('ConfigKey', entrada.configKey);
  }
  // La convencion vale en AMBOS esquemas siempre que la columna exista: la migracion a EmailName como PK conserva PiezaID (lleva la numeracion
  // de Rick en 76 de 113 filas el 2-oct-2026) y puede conservar ContentName. Si la columna no existe, simplemente no se escribe.
  if (porNombre.has('PiezaID')) props.PiezaID = PIEZA_ID_POR_DEFINIR;
  if (porNombre.has('ContentName') && entrada.emailName) poner('ContentName', entrada.emailName);
  for (const [k, col] of Object.entries(MAPA)) poner(col, entrada[k]);
  for (const [col, v] of Object.entries(entrada.extra || {})) poner(col, v);

  const claves = { [columnaClave(m)]: m === 'configkey' ? entrada.configKey : entrada.emailName };
  return { props, claves, omitidas: [...new Set(omitidas)], recortadas, errores, modo: m };
}

/** Fila de CRM_Audiencias: { claves:{PK:valor}, props:{…sin la PK…}, errores }. El modo sale de SUS columnas. */
function construirFilaAudiencia(columnas, entrada, { modo } = {}) {
  const m = modo || detectarModo(columnas);
  const porNombre = new Map(columnas.map(c => [c.name, c]));
  const props = {}, omitidas = [], recortadas = [], errores = [];
  const poner = (col, v) => poneColumna(porNombre, props, omitidas, recortadas, errores, col, v);
  const valorClave = m === 'configkey' ? entrada.configKey : entrada.emailName;
  if (!valorClave) errores.push(`falta ${m === 'configkey' ? 'configKey' : 'emailName'} (PK de audiencias)`);
  poner('Journey_UUID', entrada.journeyUUID); poner('Audience_DE', entrada.audienciaDe); poner('Audience_Volume', entrada.volumen);
  return { claves: { [columnaClave(m)]: valorClave }, props, omitidas, recortadas, errores, modo: m };
}

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();
/**
 * ConfigKey INTERNA (solo existe en modo 'configkey'; el normalizador la IGNORA y desaparece con la migracion):
 * TMP-<MARCA>-<TOUCHPOINT>[-FUP], unica contra `existentes` (Set). No es un numero de pieza ni lo pretende.
 */
function proponerConfigKey(existentes, { marca, touchpoint, esFup = false }) {
  const base = ('TMP-' + (slug(marca) || 'X') + '-' + (slug(touchpoint) || 'X') + (esFup ? '-FUP' : '')).slice(0, 44);
  if (!existentes.has(base)) return base;
  for (let n = 2; n < 100; n++) { const c = `${base}-${n}`; if (!existentes.has(c)) return c; }
  throw new ErrorEsquema('No pude generar una ConfigKey única; pásala con --configkey.');
}

module.exports = { ErrorEsquema, COL_IDENTIDAD, PIEZA_ID_POR_DEFINIR, detectarModo, columnaClave, construirFilaCatalogo, construirFilaAudiencia, proponerConfigKey };
