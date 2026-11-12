'use strict';
// Lectura del catalogo (CRM_Reporte_Config) segun su esquema REAL: modo de llave y columnas que existen.
// Compartido por el resolver (¿ya esta registrada?) y por agregar-pieza (validar y evitar duplicados).
const D = require('./de');
const E = require('./esquema');

/**
 * Lee TODAS las filas del catalogo con las columnas `deseadas` que EXISTAN (mas EmailName y la PK del modo, siempre).
 * Pedir una columna que no existe haria fallar el Retrieve entero; por eso se filtra contra el esquema real.
 * Devuelve { modo, pk, columnas, pedidas, filas }. filas.truncado === true si la DE no se pudo paginar completa.
 */
async function leerCatalogoFilas(cli, cfg, deseadas = []) {
  const columnas = await D.columnas(cli, cfg.des.catalogo.nombre);
  const modo = E.detectarModo(columnas, cfg.esquema && cfg.esquema.llavePieza);
  const pk = E.columnaClave(modo);
  const pedidas = [...new Set([E.COL_IDENTIDAD, pk, ...deseadas])].filter(c => columnas.some(x => x.name === c));
  const filas = await D.leerFilas(cli, cfg.des.catalogo.nombre, pedidas);
  return { modo, pk, columnas, pedidas, filas };
}

module.exports = { leerCatalogoFilas };
