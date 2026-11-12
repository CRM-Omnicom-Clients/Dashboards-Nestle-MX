'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const C = require('../lib/config');

const ejemplo = () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'pipeline.config.example.json'), 'utf8'));
const GUID = (n) => `${String(n).padStart(8, '0')}-0000-0000-0000-000000000000`;
function completa() {
  const c = ejemplo(); let n = 1;
  for (const d of Object.values(c.des)) d.key = GUID(n++);
  for (const q of Object.values(c.queries)) q.id = GUID(n++);
  c.automation.id = GUID(n++); c.carpetas = { de: 445199, query: 460279 }; c.bu.mid = '10966050';
  return c;
}

test('la PLANTILLA es valida sin descubrir, y exigiendo descubrimiento lista TODO lo que falta', () => {
  assert.deepEqual(C.validar(ejemplo()).errores, []);
  const e = C.validar(ejemplo(), { exigirDescubierta: true }).errores;
  assert.ok(e.some(x => /des\.catalogo sin key/.test(x))); assert.ok(e.some(x => /queries\.vol sin id/.test(x)));
  assert.ok(e.some(x => /automation sin id/.test(x))); assert.ok(e.some(x => /carpetas\.de/.test(x)));
});

test('una config completa es valida', () => { assert.deepEqual(C.validar(completa(), { exigirDescubierta: true }).errores, []); });

test('rechaza: version, rol faltante, GUID mal formado, paso con rol desconocido, llavePieza invalida', () => {
  const m = (f) => { const c = completa(); f(c); return C.validar(c, { exigirDescubierta: true }).errores.join(' | '); };
  assert.match(m(c => { c.version = 2; }), /version debe ser 1/);
  assert.match(m(c => { delete c.des.links; }), /des\.links\.nombre falta/);
  assert.match(m(c => { c.queries.vol.id = 'no-es-guid'; }), /queries\.vol\.id no es un GUID/);
  assert.match(m(c => { c.automation.pasosEsperados = [['vol', 'inventado']]; }), /pasosEsperados/);
  assert.match(m(c => { c.esquema.llavePieza = 'PiezaID'; }), /llavePieza/);
  assert.match(m(c => { c.carpetas.de = -5; }), /carpetas\.de debe ser un entero positivo/);
});

test('SEGURIDAD: un prefijo temporal que choque con objetos del reporte se rechaza (la guardia permitiria BORRARLOS)', () => {
  const c = completa(); c.prefijoTemporales = 'CRM_Email_';
  const e = C.validar(c, { exigirDescubierta: true }).errores.join(' | ');
  assert.match(e, /empieza con el prefijo temporal "CRM_Email_"/);
  const c2 = completa(); c2.prefijoTemporales = 'CRM_';
  assert.match(C.validar(c2).errores.join(' | '), /prefijoTemporales debe ser/);
});

test('cargarConfig: archivo ausente => error que dice como generarlo; JSON roto => error claro; ida y vuelta guardar/cargar', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfmc-cfg-'));
  try {
    const ruta = path.join(dir, 'sub', 'pipeline.config.json');
    assert.throws(() => C.cargarConfig({ ruta }), (e) => e instanceof C.ErrorConfig && /descubrir\.js/.test(e.message));
    C.guardarConfig(completa(), ruta);
    assert.deepEqual(C.cargarConfig({ ruta }), completa());
    fs.writeFileSync(ruta, '{ roto', 'utf8');
    assert.throws(() => C.cargarConfig({ ruta }), /No pude leer/);
    assert.throws(() => C.guardarConfig({ version: 9 }, ruta), C.ErrorConfig);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('cargarConfig: una config guardada por Notepad o por PowerShell (UTF-8 con BOM) se lee igual que la limpia', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfmc-cfg-'));
  try {
    const ruta = path.join(dir, 'pipeline.config.json');
    fs.writeFileSync(ruta, String.fromCharCode(0xfeff) + JSON.stringify(completa(), null, 2), 'utf8');
    assert.deepEqual(C.cargarConfig({ ruta }), completa());
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('accesores por rol', () => {
  const c = completa();
  assert.equal(C.deDe(c, 'catalogo').nombre, 'CRM_Reporte_Config'); assert.equal(C.queryDe(c, 'vol').nombre, 'CRM_Audiencias_Vol_Load');
  assert.throws(() => C.deDe(c, 'nada'), C.ErrorConfig);
});

// ---------- completarConEjemplo: una config de una version anterior del kit recibe lo nuevo de la plantilla ----------
const sinCampo = (f) => { const c = completa(); f(c); return c; };

test('completarConEjemplo: agrega lo que falta (con su valor por defecto), lo lista y deja intacto todo lo demas', () => {
  const vieja = sinCampo(c => { delete c.bu.offsetUtcHoras; });
  const r = C.completarConEjemplo(vieja, ejemplo());
  assert.deepEqual(r.agregados, ['bu.offsetUtcHoras']); assert.equal(r.cfg.bu.offsetUtcHoras, -6);
  assert.deepEqual({ ...r.cfg, bu: { ...r.cfg.bu, offsetUtcHoras: undefined } }, { ...vieja, bu: { ...vieja.bu, offsetUtcHoras: undefined } }, 'lo demás queda igual');
  assert.deepEqual(C.validar(r.cfg, { exigirDescubierta: true }).errores, [], 'y la config completada sigue siendo valida');
});
test('completarConEjemplo: NUNCA pisa un valor que la config ya tiene (ni un null, ni una lista personalizada, ni el offset de otra BU)', () => {
  const mia = completa(); mia.bu.offsetUtcHoras = -5; mia.bu.mid = null; mia.automation.pasosEsperados = [['vol'], ['detalle', 'links'], ['piezas'], ['auditoria']]; mia.prefijoTemporales = 'Mi_Tmp_';
  const r = C.completarConEjemplo(mia, ejemplo());
  assert.deepEqual(r.cfg, mia); assert.deepEqual(r.agregados, []);
});
test('completarConEjemplo: conserva los campos propios que la plantilla no conoce, y una seccion entera que falta se agrega y se reporta UNA vez', () => {
  const c = sinCampo(x => { x.miCampoPropio = { a: 1 }; delete x.esquema; });
  const r = C.completarConEjemplo(c, ejemplo());
  assert.deepEqual(r.cfg.miCampoPropio, { a: 1 }); assert.deepEqual(r.cfg.esquema, ejemplo().esquema); assert.deepEqual(r.agregados, ['esquema']);
});
test('completarConEjemplo: es idempotente, no modifica lo que recibe, y sin segundo argumento usa la plantilla del kit', () => {
  const vieja = sinCampo(c => { delete c.bu.offsetUtcHoras; delete c.mcpServerName; });
  const ej = ejemplo(); const copiaVieja = JSON.stringify(vieja), copiaEj = JSON.stringify(ej);
  const r1 = C.completarConEjemplo(vieja, ej); assert.equal(JSON.stringify(vieja), copiaVieja); assert.equal(JSON.stringify(ej), copiaEj);
  assert.deepEqual(r1.agregados.sort(), ['bu.offsetUtcHoras', 'mcpServerName']);
  const r2 = C.completarConEjemplo(r1.cfg, ej); assert.deepEqual(r2.agregados, []); assert.deepEqual(r2.cfg, r1.cfg);
  r1.cfg.bu.offsetUtcHoras = 99; assert.equal(ej.bu.offsetUtcHoras, -6, 'lo agregado es una COPIA: tocarlo no altera la plantilla');
  r1.cfg.automation.pasosEsperados.push(['x']); assert.equal(JSON.stringify(vieja), copiaVieja, 'ni siquiera las listas se comparten con la config recibida');
  assert.deepEqual(C.completarConEjemplo(vieja).agregados.sort(), ['bu.offsetUtcHoras', 'mcpServerName'], 'con la plantilla real del kit');
});

test('prefijoTemporales debe DELATAR que es temporal (Tmp, Temp, Scratch, Sbx, Sandbox, Test, Prueba): la limpieza de huerfanos borra TODO lo que empiece con el', () => {
  const m = (pre) => { const c = completa(); c.prefijoTemporales = pre; return C.validar(c, { exigirDescubierta: true }).errores.join(' | '); };
  for (const bueno of ['CRM_Tmp_', 'ZZSbx_', 'Mi_Tmp_', 'Nestle_Test_', 'OTRO_TEMP_x', 'a_Scratch_', 'Pruebas_X_', 'X_sandbox_1']) assert.equal(m(bueno), '', bueno);
  for (const malo of ['Nestle_', 'CRM_Reporte_', 'Datos_Clientes_', 'Producto_']) assert.match(m(malo), /no delata que es TEMPORAL/, malo);
});
