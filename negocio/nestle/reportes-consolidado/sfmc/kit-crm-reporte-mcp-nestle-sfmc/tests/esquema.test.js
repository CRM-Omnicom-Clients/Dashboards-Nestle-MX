'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../lib/esquema');

// Esquemas REALES (foto de SFMC del 2-oct-2026), no inventados.
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'arquitectura-nestle-2026-10-02.json'), 'utf8'));
const catalogoLegado = fx.des.CRM_Reporte_Config.campos;
const audienciasLegado = fx.des.CRM_Audiencias.campos;
// Esquema POST-migracion (sintetico): PK EmailName, sin ConfigKey/PiezaID/ContentName.
const quitar = (cols, ...nombres) => cols.filter(c => !nombres.includes(c.name)).map(c => (c.name === 'EmailName' ? { ...c, pk: true, required: true } : c));
const catalogoNuevo = quitar(catalogoLegado, 'ConfigKey', 'PiezaID', 'ContentName');
const audienciasNuevo = [{ name: 'EmailName', type: 'Text', length: 200, pk: true }, ...audienciasLegado.filter(c => c.name !== 'ConfigKey')];

const J10 = 'O_Maggi-Seleccion-NC006537_NA_IBS_FOOD_MAGG_MGG_AMPZ_MX_ES_LIGAMX-J10_AQ_EM_A_NA_30794109';
const entradaJ10 = () => ({ emailName: J10, configKey: 'TMP-MAGGI-J10', codigoNC: 'NC006537', bu: 'RN', marca: 'Maggi', campana: 'Liga MX', touchpoint: 'E-J10', segmento: '*por definir',
  emailType: 'Principal', estado: 'Confirmado', activo: 'Si', notas: 'PROVISIONAL', emailId: 86203 });

test('detectarModo: del esquema REAL (PK ConfigKey) => configkey; del esquema nuevo (PK EmailName) => emailname', () => {
  assert.equal(E.detectarModo(catalogoLegado), 'configkey');
  assert.equal(E.detectarModo(catalogoNuevo), 'emailname');
  assert.equal(E.detectarModo(audienciasLegado), 'configkey');
  assert.equal(E.detectarModo(audienciasNuevo), 'emailname');
  assert.equal(E.detectarModo(catalogoNuevo, 'ConfigKey'), 'configkey', 'override manual');
  assert.throws(() => E.detectarModo([{ name: 'X', pk: true }]), E.ErrorEsquema);
});

test('modo configkey: la fila de J10 es EXACTAMENTE la que se escribio a mano en el catalogo (regresion del comportamiento vivo)', () => {
  const r = E.construirFilaCatalogo(catalogoLegado, entradaJ10());
  assert.deepEqual(r.errores, []); assert.equal(r.modo, 'configkey');
  assert.deepEqual(r.props, { EmailName: J10, ConfigKey: 'TMP-MAGGI-J10', PiezaID: '*por definir', ContentName: J10, CodigoNC: 'NC006537', BU: 'RN', Marca: 'Maggi',
    Campana: 'Liga MX', Touchpoint: 'E-J10', Segmento: '*por definir', EmailType: 'Principal', Estado: 'Confirmado', Activo: 'Si', Notas: 'PROVISIONAL', EmailID: '86203' });
  assert.deepEqual(r.claves, { ConfigKey: 'TMP-MAGGI-J10' });
  assert.deepEqual(r.omitidas, []);
});

test('modo emailname: SIN ConfigKey/PiezaID/ContentName; la clave es EmailName', () => {
  const r = E.construirFilaCatalogo(catalogoNuevo, entradaJ10());
  assert.deepEqual(r.errores, []); assert.equal(r.modo, 'emailname');
  assert.ok(!('ConfigKey' in r.props) && !('PiezaID' in r.props) && !('ContentName' in r.props));
  assert.equal(r.props.EmailName, J10); assert.equal(r.props.Marca, 'Maggi');
  assert.deepEqual(r.claves, { EmailName: J10 });
});

test('esquema migrado que CONSERVA PiezaID (lleva la numeracion de Rick) y ContentName: se escriben igual — PiezaID "*por definir", ContentName = EmailName', () => {
  const conservaPiezaID = quitar(catalogoLegado, 'ConfigKey');                              // lo que RECOMIENDA docs/MIGRACION-EMAILNAME-PK.md: solo se va ConfigKey (y ContentName)
  const r = E.construirFilaCatalogo(conservaPiezaID, entradaJ10());
  assert.deepEqual(r.errores, []); assert.equal(r.modo, 'emailname'); assert.ok(!('ConfigKey' in r.props));
  assert.equal(r.props.PiezaID, '*por definir', 'la regla dura (el numero lo pone el normalizador) vale en los dos esquemas'); assert.equal(r.props.ContentName, J10);
  assert.deepEqual(r.claves, { EmailName: J10 });
  const soloPiezaID = E.construirFilaCatalogo(quitar(catalogoLegado, 'ConfigKey', 'ContentName'), entradaJ10());
  assert.equal(soloPiezaID.props.PiezaID, '*por definir'); assert.ok(!('ContentName' in soloPiezaID.props), 'sin la columna no se escribe');
  assert.ok(E.construirFilaCatalogo(conservaPiezaID, { ...entradaJ10(), piezaId: '001-P999' }).errores.some(e => /PiezaID no se asigna/.test(e)), 'y nadie puede ponerle un numero a mano');
});

test('Notas (texto libre) se recorta a 200 con "..." y se avisa; una DIMENSION que no cabe es error, nunca se recorta en silencio', () => {
  const r = E.construirFilaCatalogo(catalogoLegado, { ...entradaJ10(), notas: 'x'.repeat(330) });
  assert.equal(r.props.Notas.length, 200); assert.ok(r.props.Notas.endsWith('...')); assert.deepEqual(r.recortadas, [{ campo: 'Notas', de: 330, a: 200 }]); assert.deepEqual(r.errores, []);
  const r2 = E.construirFilaCatalogo(catalogoLegado, { ...entradaJ10(), marca: 'M'.repeat(80), activo: 'Siii' });
  assert.ok(r2.errores.some(e => /Marca mide 80.*admite 60/.test(e))); assert.ok(r2.errores.some(e => /Activo mide 4.*admite 3/.test(e)));
});

test('reglas duras: PiezaID nunca se asigna; faltan EmailName / ConfigKey; EmailID debe ser numerico; EmailName largo es error', () => {
  const e = (cambio) => E.construirFilaCatalogo(catalogoLegado, { ...entradaJ10(), ...cambio }).errores.join(' | ');
  assert.match(e({ piezaId: '009-P006' }), /PiezaID no se asigna aquí/);
  assert.match(e({ emailName: '' }), /falta emailName/);
  assert.match(e({ configKey: '' }), /falta configKey/);
  assert.match(e({ emailId: '85.4x' }), /EmailID debe ser numérico/);
  assert.match(e({ emailName: 'N'.repeat(201) }), /EmailName mide 201.*admite 200/);
});

test('columnas inexistentes se OMITEN (se reportan), no rompen: asi un esquema distinto no obliga a tocar el codigo', () => {
  const sinJourney = catalogoLegado.filter(c => c.name !== 'JourneyUUID');
  const r = E.construirFilaCatalogo(sinJourney, { ...entradaJ10(), journeyUUID: 'abc', extra: { ColumnaNueva: 'x' } });
  assert.deepEqual(r.errores, []); assert.deepEqual(r.omitidas.sort(), ['ColumnaNueva', 'JourneyUUID']);
});

test('audiencias: fila en ambos modos (la PK sale de las columnas de ESA DE)', () => {
  const ent = { configKey: 'TMP-X', emailName: J10, journeyUUID: 'uuid-1', audienciaDe: 'DE_Audiencia_X', volumen: 107112 };
  const a = E.construirFilaAudiencia(audienciasLegado, ent);
  assert.deepEqual(a.claves, { ConfigKey: 'TMP-X' }); assert.deepEqual(a.props, { Journey_UUID: 'uuid-1', Audience_DE: 'DE_Audiencia_X', Audience_Volume: '107112' });
  const b = E.construirFilaAudiencia(audienciasNuevo, ent);
  assert.deepEqual(b.claves, { EmailName: J10 }); assert.deepEqual(b.props, a.props);
  assert.match(E.construirFilaAudiencia(audienciasLegado, { ...ent, configKey: '' }).errores.join(), /falta configKey/);
});

test('proponerConfigKey: TMP-<MARCA>-<TOUCHPOINT>[-FUP], sin acentos, unica, y NO parece un numero de pieza', () => {
  const ya = new Set();
  const k1 = E.proponerConfigKey(ya, { marca: 'Nescafé ICE', touchpoint: 'E-P1' }); assert.equal(k1, 'TMP-NESCAFE-ICE-E-P1');
  ya.add(k1);
  assert.equal(E.proponerConfigKey(ya, { marca: 'Nescafé ICE', touchpoint: 'E-P1', esFup: true }), 'TMP-NESCAFE-ICE-E-P1-FUP');
  assert.equal(E.proponerConfigKey(ya, { marca: 'Nescafé ICE', touchpoint: 'E-P1' }), 'TMP-NESCAFE-ICE-E-P1-2');
  assert.ok(!/^\d{3}-P\d+/.test(k1), 'jamas "009-P006"');
  assert.ok(E.proponerConfigKey(new Set(), { marca: 'M'.repeat(80), touchpoint: 'T' }).length <= 50);
});
