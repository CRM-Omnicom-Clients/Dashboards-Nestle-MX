'use strict';
// lib/catalogo.js: lee el catalogo pidiendo SOLO las columnas que EXISTEN en su esquema real (pedir una que no existe hace fallar el Retrieve ENTERO),
// siempre con EmailName y la PK del modo, sin duplicados, y respetando el override esquema.llavePieza. La prueba mira lo que el kit PIDE a SFMC, no solo lo que devuelve.
const test = require('node:test');
const assert = require('node:assert/strict');
const { leerCatalogoFilas } = require('../lib/catalogo');
const { crearCliente } = require('../lib/sfmc');
const { cred, fakeHttp, conToken, sinEspera } = require('./_utils');

const CAT = 'CRM_Reporte_Config';
const col = (name, ordinal, { pk = false, type = 'Text', length = 100 } = {}) => ({ name, ordinal, pk, type, length });
const SCHEMA_CONFIGKEY = [col('ConfigKey', 1, { pk: true }), col('EmailName', 2), col('Marca', 3), col('Campana', 4), col('Activo', 5), col('PiezaID', 6)];
const SCHEMA_EMAILNAME = [col('EmailName', 1, { pk: true }), col('Marca', 2), col('Campana', 3), col('Activo', 4)];

/** Un SFMC de mentira que contesta los tres Retrieve del lector y GUARDA que propiedades se pidieron de la DE. */
function sfmcFalso(columnas) {
  const pedidos = [];
  const manejador = conToken((c) => {
    if (c.path !== '/Service.asmx') return { json: {} };
    const ok = (interior) => ({ text: `<r><OverallStatus>OK</OverallStatus>${interior}</r>` });
    if (/<ObjectType>DataExtension<\/ObjectType>/.test(c.body)) return ok('<Results><CustomerKey>KEY-CAT</CustomerKey><CategoryID>7</CategoryID></Results>');
    if (/<ObjectType>DataExtensionField<\/ObjectType>/.test(c.body)) {
      return ok(columnas.map(x => `<Results><Name>${x.name}</Name><FieldType>${x.type}</FieldType><MaxLength>${x.length}</MaxLength><Ordinal>${x.ordinal}</Ordinal><IsPrimaryKey>${x.pk}</IsPrimaryKey><IsRequired>${x.pk}</IsRequired></Results>`).join(''));
    }
    const m = /<ObjectType>DataExtensionObject\[([^\]]*)\]<\/ObjectType>/.exec(c.body);
    if (m) {
      const props = [...c.body.matchAll(/<Properties>([^<]*)<\/Properties>/g)].map(x => x[1]); pedidos.push({ de: m[1], props });
      return ok(`<Results><Properties>${props.map(p => `<Property><Name>${p}</Name><Value>v-${p}</Value></Property>`).join('')}</Properties></Results>`);
    }
    return ok('');
  });
  return { manejador, pedidos };
}
const cliente = (columnas) => { const f = sfmcFalso(columnas); const cli = crearCliente({ cred: cred(), cfg: null, httpsRequest: fakeHttp(f.manejador), dormir: sinEspera }); return { cli, pedidos: f.pedidos }; };
const CFG = (esquema) => ({ des: { catalogo: { nombre: CAT, key: 'KEY-CAT' } }, ...(esquema === undefined ? {} : { esquema }) });

test('catalogo: pide EmailName + la PK + lo deseado que EXISTE, sin duplicados y sin las columnas que no existen (esas harian fallar el Retrieve entero)', async () => {
  const { cli, pedidos } = cliente(SCHEMA_CONFIGKEY);
  const r = await leerCatalogoFilas(cli, CFG({ llavePieza: 'auto' }), ['Marca', 'NoExiste', 'Activo', 'Marca', 'EmailName', 'Touchpoint', 'ConfigKey']);
  assert.equal(r.modo, 'configkey'); assert.equal(r.pk, 'ConfigKey');
  assert.deepEqual(r.pedidas, ['EmailName', 'ConfigKey', 'Marca', 'Activo'], 'primero la identidad y la PK; luego lo deseado que existe, en su orden, sin repetir');
  assert.equal(pedidos.length, 1); assert.equal(pedidos[0].de, CAT); assert.deepEqual(pedidos[0].props, r.pedidas, 'lo que se PIDIO a SFMC es exactamente lo filtrado');
  assert.equal(r.columnas.length, SCHEMA_CONFIGKEY.length);
  assert.equal(r.filas.length, 1); assert.deepEqual(Object.keys(r.filas[0]), r.pedidas); assert.equal(r.filas[0].Marca, 'v-Marca');
});

test('catalogo: sin lo deseado pide solo la identidad y la PK; en el esquema de PK=EmailName la identidad y la PK son la misma columna y no se repite', async () => {
  const a = cliente(SCHEMA_CONFIGKEY); const ra = await leerCatalogoFilas(a.cli, CFG({ llavePieza: 'auto' }));
  assert.deepEqual(ra.pedidas, ['EmailName', 'ConfigKey']); assert.deepEqual(a.pedidos[0].props, ['EmailName', 'ConfigKey']);
  const b = cliente(SCHEMA_EMAILNAME); const rb = await leerCatalogoFilas(b.cli, CFG({ llavePieza: 'auto' }), ['Marca', 'Campana']);
  assert.equal(rb.modo, 'emailname'); assert.equal(rb.pk, 'EmailName'); assert.deepEqual(rb.pedidas, ['EmailName', 'Marca', 'Campana']); assert.deepEqual(b.pedidos[0].props, ['EmailName', 'Marca', 'Campana']);
});

test('catalogo: lo deseado que NO existe se omite en silencio (una columna que la migracion quita no rompe la lectura); si ninguna existe queda solo identidad + PK', async () => {
  const { cli, pedidos } = cliente(SCHEMA_EMAILNAME);
  const r = await leerCatalogoFilas(cli, CFG({ llavePieza: 'auto' }), ['PiezaID', 'ContentName', 'ConfigKey']);
  assert.deepEqual(r.pedidas, ['EmailName']); assert.deepEqual(pedidos[0].props, ['EmailName']);
});

test('catalogo: el override esquema.llavePieza manda sobre la deteccion (EmailName / ConfigKey), y sin esquema o con "auto" se detecta de la PK real', async () => {
  const forzado = cliente(SCHEMA_CONFIGKEY); const r1 = await leerCatalogoFilas(forzado.cli, CFG({ llavePieza: 'EmailName' }), ['Marca']);
  assert.equal(r1.modo, 'emailname', 'forzado a EmailName aunque la PK real sea ConfigKey'); assert.equal(r1.pk, 'EmailName'); assert.deepEqual(r1.pedidas, ['EmailName', 'Marca']);
  const otro = cliente(SCHEMA_EMAILNAME); const r2 = await leerCatalogoFilas(otro.cli, CFG({ llavePieza: 'ConfigKey' }), ['Marca']);
  assert.equal(r2.modo, 'configkey', 'forzado a ConfigKey'); assert.equal(r2.pk, 'ConfigKey'); assert.deepEqual(r2.pedidas, ['EmailName', 'Marca'], 'ConfigKey no existe en ese esquema: no se pide');
  const sin = cliente(SCHEMA_EMAILNAME); assert.equal((await leerCatalogoFilas(sin.cli, CFG(undefined))).modo, 'emailname', 'sin cfg.esquema: se detecta (y no lanza TypeError)');
  const nulo = cliente(SCHEMA_CONFIGKEY); assert.equal((await leerCatalogoFilas(nulo.cli, CFG(null))).modo, 'configkey', 'cfg.esquema = null: se detecta');
  const vacio = cliente(SCHEMA_CONFIGKEY); assert.equal((await leerCatalogoFilas(vacio.cli, CFG({}))).modo, 'configkey', 'esquema sin llavePieza: se detecta');
});

test('catalogo: un esquema que no reconoce (ni PK ConfigKey ni EmailName) es un error CLARO, no una lectura a ciegas', async () => {
  const { cli, pedidos } = cliente([col('Otra', 1, { pk: true }), col('EmailName', 2)]);
  await assert.rejects(() => leerCatalogoFilas(cli, CFG({ llavePieza: 'auto' })), /No reconozco el esquema/);
  assert.equal(pedidos.length, 0, 'ni siquiera pidio filas');
});
