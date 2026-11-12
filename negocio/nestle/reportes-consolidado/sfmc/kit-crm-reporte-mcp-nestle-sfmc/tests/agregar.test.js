'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { crearCliente } = require('../lib/sfmc');
const D = require('../lib/de');
const A = require('../lib/agregar');
const { decodificar } = require('../lib/xml');
const { cred, fakeHttp, conToken } = require('./_utils');

// ---------- un catalogo de juguete con la forma y los valores REALES (leidos el 2-oct-2026) ----------
const COLS_CK = [['ConfigKey', 'Text', 50, true], ['PiezaID', 'Text', 30], ['ContentName', 'Text', 200], ['CodigoNC', 'Text', 20], ['JourneyUUID', 'Text', 60], ['BU', 'Text', 30], ['Marca', 'Text', 60],
  ['Campana', 'Text', 60], ['Touchpoint', 'Text', 40], ['Segmento', 'Text', 60], ['EmailType', 'Text', 30], ['Estado', 'Text', 40], ['Activo', 'Text', 3], ['Notas', 'Text', 200], ['EmailID', 'Number', 0], ['EmailName', 'Text', 200]];
const COLS_EN = [['EmailName', 'Text', 200, true], ['CodigoNC', 'Text', 20], ['JourneyUUID', 'Text', 60], ['BU', 'Text', 30], ['Marca', 'Text', 60], ['Campana', 'Text', 60], ['Touchpoint', 'Text', 40],
  ['Segmento', 'Text', 60], ['EmailType', 'Text', 30], ['Estado', 'Text', 40], ['Activo', 'Text', 3], ['Notas', 'Text', 200], ['EmailID', 'Number', 0]];
const mk = (ck, bu, marca, campana, touchpoint, segmento, tipo, id, nombre) => ({ ConfigKey: ck, PiezaID: '*por definir', ContentName: nombre, CodigoNC: '', JourneyUUID: '', BU: bu, Marca: marca, Campana: campana, Touchpoint: touchpoint, Segmento: segmento, EmailType: tipo, Estado: 'Confirmado', Activo: 'Si', Notas: '', EmailID: String(id), EmailName: nombre });
const FILAS = () => [
  mk('001-P019', 'RN', 'Recetas Nestlé', 'AON', 'E-P3', 'Activos', 'Principal', 84000, 'O_AO-RECETAS-NESTLE-NC000600_MLTS_MX_ES_JUN-AON-EP3_CN_EM_A_V1_982527'),
  mk('TMP-MAGGI-J7-B-C', 'RN', 'Maggi', 'Liga MX', 'E-J7', 'Futboleros', 'Principal', 85487, 'O_Maggi-Seleccion-NC006537_MX_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270'),
  mk('TMP-MAGGI-J8', 'RN', 'Maggi', 'Liga MX', 'E-J8', 'Futboleros', 'Principal', 85752, 'O_Maggi-Seleccion-NC006537_MX_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270 - 202609'),
  mk('M-MUN-1', 'RN', 'Maggi', 'Mundial', 'E-M1', 'Futboleros', 'Principal', 85001, 'O_Maggi-Mundial_1'),
  mk('M-MUN-2', 'RN', 'Maggi', 'Mundial', 'E-M2', 'Futboleros', 'Follow Up', 85002, 'O_Maggi-Mundial_2'),
  mk('TMP-MAGGI-J4-SR', 'Maggi*', 'Maggi*', 'Liga MX*', 'J4-SinRegión*', '*por definir', 'Principal', 84970, 'O_Maggi-J4-SR'),
  mk('TMP-NESC-ESPRESSO', 'Nescafé', 'Concentrate', 'Hackea tu café', 'E-A*', '(por definir)*', 'Principal', 84742, 'O_Nescafe-Espresso-Con-NC004682_V2'),
  mk('TMP-NESC-ICE-ENRICH1', 'Nescafé', 'Nescafé ICE', 'The Freshers', 'E-P1', 'GEN Z', 'Principal', 84936, 'O_Nescafe-ICE_V3'),
  mk('PP-1', 'Purina', 'Pro Plan', 'Fuel for life', 'E-P1', 'Perros', 'Principal', 80001, 'O_ProPlan_1'),
  mk('CL-1', 'Nescafé', 'Clásico', 'Tercer Tiempo', 'E-T1', 'Cerveceros', 'Principal', 80002, 'O_Clasico_1'),
  mk('LL-1', 'RN', 'Carnation, La Lechera', 'Hotcakes', 'E-H1', 'Familias', 'Principal', 80003, 'O_Hotcakes_1'),
  mk('LL-2', 'RN', 'La Lechera', 'Antojo Infinito', 'E-A1', 'Postres', 'Principal', 80004, 'O_Antojo_1'),
];
const NUEVO = 'O_Maggi-Seleccion-NC006537_MX_ES_LIGAMX-J9-SAB_AQ_EM_A_NA_0359270';
const ENT = (extra = {}) => ({ emailName: NUEVO, marca: 'Maggi', campana: 'Liga MX', touchpoint: 'E-J9', ...extra });
const SONDEO = (extra = {}) => ({ completo: true, segundos: 9, encontrado: true, emailName: NUEVO, emailId: 86001, jobs: 6, primero: '9/12/2026 10:00:00 AM', ultimo: '9/12/2026 1:00:00 PM', subject: 'Un clásico', journeyId: null, journeyName: null, ...extra });
const catDe = (modo = 'configkey', filas = FILAS()) => ({ modo, pk: modo === 'configkey' ? 'ConfigKey' : 'EmailName', filas,
  columnas: (modo === 'configkey' ? COLS_CK : COLS_EN).map(([name, type, length, pk], i) => ({ name, type, length: length || null, ordinal: i + 1, pk: !!pk, required: !!pk })) });

// ---------- normalizacion y clasificacion ----------
test('normalizar: sin acentos, mayusculas ni asterisco; "*por definir" y "(por definir)*" son lo mismo', () => {
  assert.equal(A.normalizar('Liga MX*'), A.normalizar('  liga   mx ')); assert.equal(A.normalizar('Hackea tu café'), A.normalizar('HACKEA TU CAFE'));
  assert.ok(A.esPorDefinir('*por definir') && A.esPorDefinir('(por definir)*') && !A.esPorDefinir('Maggi'));
  assert.equal(A.sinAst('Maggi**'), 'Maggi');
});
test('clasificarValor: existente (con o sin asterisco) · variante (otra grafia) · nuevo · por-definir', () => {
  const idx = A.indiceDe(FILAS(), 'Campana');
  assert.equal(A.clasificarValor('Liga MX', idx).tipo, 'existente'); assert.equal(A.clasificarValor('Liga MX*', idx).tipo, 'existente');
  const v = A.clasificarValor('liga mx', idx); assert.equal(v.tipo, 'variante'); assert.deepEqual(v.existentes, ['Liga MX', 'Liga MX*']);
  assert.equal(A.clasificarValor('Hackea tu cafe', idx).tipo, 'variante');
  assert.equal(A.clasificarValor('Copa Foo', idx).tipo, 'nuevo'); assert.equal(A.clasificarValor('*por definir', idx).tipo, 'por-definir');
});

// ---------- dimensiones ----------
const V = (extra, opts) => A.validarDimensiones({ marca: 'Maggi', campana: 'Liga MX', touchpoint: 'E-J9', ...extra }, FILAS(), opts);
test('dimensiones: caso feliz — la BU se DERIVA de la marca (Maggi -> RN, no la inferida "Maggi*") y no hay errores', () => {
  const r = V({});
  assert.deepEqual(r.errores, []); assert.equal(r.valores.bu, 'RN'); assert.match(r.derivados.bu, /la BU más usada para la marca "Maggi" \(4 de 5 filas\)/);
  assert.equal(r.valores.segmento, '*por definir');
});
test('dimensiones: Marca ≠ Campaña ≠ BU — nunca cruzadas (la regla dura de Rick)', () => {
  assert.match(V({ marca: 'Liga MX' }).errores.join('|'), /"Liga MX" es una CAMPAÑA.*no una marca/);
  assert.match(V({ campana: 'Maggi' }).errores.join('|'), /"Maggi" es una MARCA.*no una campaña/);
  assert.match(V({ campana: 'Nescafé ICE' }).errores.join('|'), /"Nescafé ICE" es una MARCA/, 'ICE es MARCA, no campaña (taxonomia del 26-ago)');
  assert.match(V({ marca: 'Purina' }).errores.join('|'), /"Purina" es una BU/);
  assert.match(V({ bu: 'Hotcakes' }).errores.join('|'), /"Hotcakes" es una marca o campaña del catálogo, no una BU/);
});
test('dimensiones: una dimension CRUZADA da UN solo error (la causa), sin los de "valor nuevo" ni "falta la BU" que serian consecuencias', () => {
  assert.equal(V({ marca: 'Liga MX' }).errores.length, 1, JSON.stringify(V({ marca: 'Liga MX' }).errores));
  assert.equal(V({ campana: 'Maggi' }).errores.length, 1);
  assert.equal(V({ bu: 'Hotcakes' }).errores.length, 1);
  assert.equal(V({ marca: 'Liga MX', campana: 'Maggi' }).errores.length, 2, 'el cruce de las dos: exactamente los dos errores de cruce');
  assert.equal(A.validarDimensiones({}, FILAS()).errores.length, 3, 'sin marca ni campana ni touchpoint: solo las 3 faltas, sin "no puedo derivar la BU"');
});
test('dimensiones: las listas de valores existentes van ENTRE COMILLAS (un valor puede llevar coma: "Carnation, La Lechera")', () => {
  const e = V({ campana: 'Copa Foo' }).errores.join('|');
  assert.match(e, /Existentes: "AON", "Antojo Infinito", "Fuel for life", "Hackea tu café", "Hotcakes", "Liga MX", "Mundial", "Tercer Tiempo", "The Freshers"\./, 'una entrada por valor (Liga MX y Liga MX* son uno)');
  assert.match(A.validarDimensiones({ marca: 'Foo', campana: 'Liga MX', touchpoint: 'E-1' }, FILAS(), { permitirNuevos: true }).errores.join('|'), /BU existentes: "Maggi\*", "Nescafé", "Purina", "RN"/);
  const filas = FILAS().concat([mk('LL-3', 'RN', 'Carnation, La Lechera', 'Hotcakes', 'E-H2', 'Familias', 'Principal', 80005, 'O_Hotcakes_2')]);
  assert.match(A.validarDimensiones({ marca: 'Zzz', campana: 'Foo', touchpoint: 'E-1' }, filas).errores.join('|'), /"Carnation, La Lechera"/);
});
test('dimensiones: una VARIANTE de ortografia es error con la grafia exacta (si no, el reporte se parte en dos)', () => {
  assert.match(V({ campana: 'liga mx' }).errores.join('|'), /Campaña "liga mx" no coincide.*"Liga MX" \/ "Liga MX\*".*EXACTO/);
  assert.match(V({ marca: 'Concentrate', campana: 'Hackea tu cafe' }).errores.join('|'), /"Hackea tu café"/);
  assert.match(V({ marca: 'nescafe ice', campana: 'The Freshers' }).errores.join('|'), /Marca "nescafe ice".*"Nescafé ICE"/);
});
test('dimensiones: valor NUEVO = error con sugerencias; con --permitir-valores-nuevos pasa como aviso', () => {
  const e = V({ campana: 'Liga Mexicana' }).errores.join('|');
  assert.match(e, /Campaña "Liga Mexicana" no existe en el catálogo.*¿quisiste decir "Liga MX"/s); assert.match(e, /--permitir-valores-nuevos/);
  const ok = V({ campana: 'Copa Foo' }, { permitirNuevos: true }); assert.deepEqual(ok.errores, []); assert.match(ok.avisos.join('|'), /valor NUEVO/);
});
test('dimensiones: "*por definir" es el marcador sancionado: no cuenta como valor nuevo ni como cruce', () => {
  const r = V({ campana: '*por definir', touchpoint: '*por definir' }); assert.deepEqual(r.errores, []); assert.equal(r.valores.campana, '*por definir');
});
test('dimensiones: faltan obligatorias => errores que las nombran; marca sin filas y sin --bu => no se puede derivar', () => {
  const r = A.validarDimensiones({}, FILAS()); assert.match(r.errores.join('|'), /falta --marca/); assert.match(r.errores.join('|'), /falta --campana/); assert.match(r.errores.join('|'), /falta --touchpoint/);
  const n = A.validarDimensiones({ marca: 'Foo', campana: 'Liga MX', touchpoint: 'E-1' }, FILAS(), { permitirNuevos: true });
  assert.match(n.errores.join('|'), /falta --bu y no puedo derivarla.*BU existentes: "Maggi\*", "Nescafé", "Purina", "RN"/);
});
test('dimensiones: BU dada que difiere de la usual => aviso; par Marca×Campana nuevo => aviso', () => {
  assert.match(V({ bu: 'Purina' }).avisos.join('|'), /para la marca "Maggi" el catálogo usa la BU "RN"/);
  assert.match(V({ campana: 'Tercer Tiempo' }).avisos.join('|'), /combinación NUEVA Marca × Campaña: "Maggi" × "Tercer Tiempo"/);
  assert.ok(!V({}).avisos.some(a => /combinación NUEVA/.test(a)), 'un par que ya existe no avisa');
});
test('--inferido pone el asterisco SOLO donde se pide, no duplica, y rechaza dimensiones desconocidas', () => {
  const r = V({ inferido: 'campana,touchpoint' }); assert.equal(r.valores.campana, 'Liga MX*'); assert.equal(r.valores.touchpoint, 'E-J9*'); assert.equal(r.valores.marca, 'Maggi');
  assert.equal(V({ campana: 'Liga MX*', inferido: 'campana' }).valores.campana, 'Liga MX*');
  assert.equal(V({ campana: '*por definir', inferido: 'campana' }).valores.campana, '*por definir');
  assert.match(V({ inferido: 'color' }).errores.join('|'), /--inferido: dimensión desconocida "color"/);
});
test('derivarCodigoNC: se LEE del nombre (NC + 5-7 digitos); sin codigo => null', () => {
  assert.equal(A.derivarCodigoNC('O_Maggi-Seleccion-NC006537_NA_IBS'), 'NC006537'); assert.equal(A.derivarCodigoNC('x_nc004682_y'), 'NC004682'); assert.equal(A.derivarCodigoNC('sin codigo'), null);
});

// ---------- duplicados y parecidos ----------
test('buscarDuplicado: solo el nombre EXACTO; la copia con sufijo de fecha NO es el mismo nombre', () => {
  const f = FILAS(); const base = 'O_Maggi-Seleccion-NC006537_MX_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270';
  assert.equal(A.buscarDuplicado(f, base).ConfigKey, 'TMP-MAGGI-J7-B-C'); assert.equal(A.buscarDuplicado(f, base + ' - 202609').ConfigKey, 'TMP-MAGGI-J8');
  assert.equal(A.buscarDuplicado(f, base.toLowerCase()), null); assert.equal(A.buscarDuplicado(f, NUEVO), null);
});
test('parecidos: original/copia con sufijo, mismo EmailID bajo otro nombre, mismo touchpoint ya registrado', () => {
  const base = 'O_Maggi-Seleccion-NC006537_MX_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270';
  const p = (extra) => A.parecidos({ emailName: NUEVO, emailId: 86001, valores: { marca: 'Maggi', campana: 'Liga MX', touchpoint: 'E-J9', segmento: 'Futboleros' }, emailType: 'Principal', filas: FILAS(), pk: 'ConfigKey', ...extra });
  assert.deepEqual(p({}), []);
  // El nuevo es el ORIGINAL (sin sufijo) y en el catalogo ya esta su copia (J8, con " - 202609"):
  const sinJ7 = FILAS().filter(f => f.ConfigKey !== 'TMP-MAGGI-J7-B-C');
  assert.match(p({ emailName: base, filas: sinJ7 }).join('|'), /TMP-MAGGI-J8 .* es una versión con sufijo de fecha \(copia\/reenvío\) de este mismo nombre/);
  // El nuevo es una COPIA (sufijo 202610): el J7 sin sufijo es el ORIGINAL y el J8 es OTRA copia con sufijo distinto:
  const c = p({ emailName: base + ' - 202610' }).join('|');
  assert.match(c, /TMP-MAGGI-J7-B-C .* es el ORIGINAL de este mismo nombre/); assert.match(c, /TMP-MAGGI-J8 .* es otra copia con un sufijo de fecha distinto/);
  assert.ok(!/TMP-MAGGI-J8 .* es el ORIGINAL/.test(c), 'una copia nunca se llama original');
  assert.match(p({ emailId: 85002 }).join('|'), /el EmailID 85002 ya está en el catálogo bajo OTRO nombre/);
  assert.match(p({ valores: { marca: 'Maggi', campana: 'Mundial', touchpoint: 'E-M1', segmento: 'Futboleros' } }).join('|'), /misma Marca · Campaña · Touchpoint · Segmento · Tipo/);
});

// ---------- sondeo ----------
test('construirSondeoSql: igualdad EXACTA, comilla doblada, y lo acepta el envoltorio con centinela', () => {
  const sql = A.construirSondeoSql("O_Brien's_test");
  assert.match(sql, /WHERE RTRIM\(j\.EmailName\) = 'O_Brien''s_test'/); assert.ok(!/LIKE/.test(sql));
  assert.match(sql, /LEFT JOIN _JourneyActivity ja ON ja\.JourneyActivityObjectID = j\.TriggererSendDefinitionObjectID/);
  D.construirSqlCentinela(sql, A.CAMPOS_SONDEO.map(c => c.name));
});
test('sondear: Jobs=0 es el negativo (una agregacion sin GROUP BY devuelve UNA fila vacia); timeout => completo:false', async () => {
  const consulta = (r) => async () => r;
  const vacio = await A.sondear({}, {}, 'x', { consultar: consulta({ completo: true, segundos: 5, filas: [{ EmailName: '', EmailID: '', Jobs: '0', Primero: '', Ultimo: '', Subject: '', JourneyUUID: '', JourneyName: '' }] }) });
  assert.equal(vacio.completo, true); assert.equal(vacio.encontrado, false);
  const hay = await A.sondear({}, {}, 'x', { consultar: consulta({ completo: true, segundos: 5, filas: [{ EmailName: 'x', EmailID: '86001', Jobs: '6', Primero: '9/24/2026 8:33:00 AM', Ultimo: '10/2/2026 7:00:00 PM', Subject: 'Hola %%[ SET @a = 1 ]%% Rick', JourneyUUID: ' abc ', JourneyName: 'J' }] }) });
  assert.deepEqual([hay.encontrado, hay.emailId, hay.jobs, hay.subject, hay.journeyId], [true, 86001, 6, 'Hola Rick', 'abc']);
  assert.deepEqual([hay.primero, hay.ultimo], ['2026-09-24 08:33', '2026-10-02 19:00'], 'las fechas salen normalizadas, igual que en el resolver');
  const colgado = await A.sondear({}, {}, 'x', { consultar: consulta({ completo: false, segundos: 600, filas: [], ultimoError: 'boom' }) });
  assert.deepEqual([colgado.completo, colgado.encontrado], [false, false]);
});

// ---------- el plan (puro) ----------
test('planificarAlta (esquema ACTUAL): ConfigKey TMP interna, PiezaID literal, ContentName=EmailName, NC y EmailID derivados, Notas por defecto', () => {
  const p = A.planificarAlta({ entrada: ENT(), cat: catDe(), sondeo: SONDEO(), hoy: '2026-10-02' });
  assert.deepEqual(p.errores, []);
  assert.equal(p.fila.ConfigKey, 'TMP-MAGGI-E-J9'); assert.equal(p.fila.PiezaID, '*por definir', 'regla dura: el numero de pieza no se inventa');
  assert.equal(p.fila.ContentName, NUEVO); assert.equal(p.fila.EmailName, NUEVO); assert.equal(p.fila.CodigoNC, 'NC006537'); assert.equal(p.fila.EmailID, '86001');
  assert.deepEqual([p.fila.BU, p.fila.Marca, p.fila.Campana, p.fila.Touchpoint, p.fila.Segmento, p.fila.EmailType, p.fila.Estado, p.fila.Activo], ['RN', 'Maggi', 'Liga MX', 'E-J9', '*por definir', 'Principal', 'Confirmado', 'Si']);
  assert.equal(p.fila.Notas, 'PROVISIONAL - alta 2026-10-02 con agregar-pieza.js.'); assert.deepEqual(p.claves, { ConfigKey: 'TMP-MAGGI-E-J9' });
  assert.ok(!('JourneyUUID' in p.fila), 'la audiencia/journey se mapea en audiencias.js, no aqui');
});
test('planificarAlta (esquema NUEVO, PK=EmailName): sin ConfigKey/PiezaID/ContentName, y --configkey se ignora con aviso', () => {
  const p = A.planificarAlta({ entrada: ENT({ configKey: 'X-1' }), cat: catDe('emailname', FILAS().map(({ ConfigKey, PiezaID, ContentName, ...r }) => r)), sondeo: SONDEO(), hoy: '2026-10-02' });
  assert.deepEqual(p.errores, []); for (const k of ['ConfigKey', 'PiezaID', 'ContentName']) assert.ok(!(k in p.fila), k + ' no existe en el esquema nuevo');
  assert.deepEqual(p.claves, { EmailName: NUEVO }); assert.match(p.avisos.join('|'), /--configkey se ignora/);
});
test('planificarAlta: FUP, inferidos y notas propias; --fup contradiciendo --email-type es error', () => {
  const p = A.planificarAlta({ entrada: ENT({ fup: true, inferido: 'campana', notas: 'Confirmado por Rick' }), cat: catDe(), sondeo: SONDEO(), hoy: 'h' });
  assert.equal(p.fila.EmailType, 'Follow Up'); assert.equal(p.fila.Campana, 'Liga MX*'); assert.equal(p.fila.Notas, 'Confirmado por Rick'); assert.equal(p.fila.ConfigKey, 'TMP-MAGGI-E-J9-FUP');
  assert.match(A.planificarAlta({ entrada: ENT({ fup: true, emailType: 'Principal' }), cat: catDe(), sondeo: SONDEO(), hoy: 'h' }).errores.join('|'), /se contradicen/);
  assert.match(A.planificarAlta({ entrada: ENT({ emailType: 'Raro' }), cat: catDe(), sondeo: SONDEO(), hoy: 'h' }).avisos.join('|'), /no es ninguno de los habituales/);
});
test('planificarAlta: nombre con otra capitalizacion que el de _Job => error con el nombre real; ConfigKey repetida => error; Notas largas se recortan con aviso', () => {
  assert.match(A.planificarAlta({ entrada: ENT({ emailName: NUEVO.toLowerCase() }), cat: catDe(), sondeo: SONDEO(), hoy: 'h' }).errores.join('|'), /El nombre real en _Job es "O_Maggi/);
  assert.match(A.planificarAlta({ entrada: ENT({ configKey: 'PP-1' }), cat: catDe(), sondeo: SONDEO(), hoy: 'h' }).errores.join('|'), /la ConfigKey PP-1 ya existe/);
  const largo = A.planificarAlta({ entrada: ENT({ notas: 'n'.repeat(260) }), cat: catDe(), sondeo: SONDEO(), hoy: 'h' });
  assert.equal(largo.fila.Notas.length, 200); assert.ok(largo.fila.Notas.endsWith('...')); assert.match(largo.avisos.join('|'), /Notas se recortó de 260 a 200/);
});
test('planificarAlta: una dimension demasiado larga NUNCA se recorta en silencio (es error)', () => {
  const p = A.planificarAlta({ entrada: ENT({ touchpoint: 'T'.repeat(50), inferido: '' }), cat: catDe(), sondeo: SONDEO(), hoy: 'h' });
  assert.match(p.errores.join('|'), /Touchpoint mide 50 caracteres y el campo admite 40/);
});

// ---------- agregarPieza de punta a punta: cliente real + guardia real + SFMC simulado ----------
const CFG = () => ({ prefijoTemporales: 'CRM_Tmp_', carpetas: { de: 445199, query: 460279 }, bu: { offsetUtcHoras: -6 }, esquema: { llavePieza: 'auto' },
  des: { catalogo: { nombre: 'CRM_Reporte_Config', key: 'KEY-CAT' }, audiencias: { nombre: 'CRM_Audiencias', key: 'KEY-AUD' } }, queries: {} });
const xmlOk = '<r><OverallStatus>OK</OverallStatus></r>';
const celda = (k, v) => `<Property><Name>${k}</Name><Value>${v}</Value></Property>`;
const xmlFilas = (filas) => `<r><OverallStatus>OK</OverallStatus>${filas.map(o => `<Results xsi:type="DataExtensionObject"><Properties>${Object.entries(o).map(([k, v]) => celda(k, v)).join('')}</Properties></Results>`).join('')}</r>`;
const xmlCampos = (cs) => `<r><OverallStatus>OK</OverallStatus>${cs.map(([n, t, l, pk], i) => `<Results><Name>${n}</Name><FieldType>${t}</FieldType><MaxLength>${l || 0}</MaxLength><Ordinal>${i + 1}</Ordinal><IsPrimaryKey>${!!pk}</IsPrimaryKey><IsRequired>${!!pk}</IsRequired></Results>`).join('')}</r>`;

function mundo({ modo = 'configkey', filas = null, errorAlCrear = null, alterar = null } = {}) {
  const base = FILAS().map(f => (modo === 'configkey' ? f : (({ ConfigKey, PiezaID, ContentName, ...r }) => r)(f)));
  const store = (filas || base).map(f => ({ ...f })); const columnas = modo === 'configkey' ? COLS_CK : COLS_EN; const pk = modo === 'configkey' ? 'ConfigKey' : 'EmailName';
  const soap = []; const creates = [];
  const handler = conToken(async (c) => {
    if (c.path !== '/Service.asmx') return { json: {} };
    soap.push(c.body); const b = c.body;
    if (/<CreateRequest/.test(b)) {
      const props = Object.fromEntries([...b.matchAll(/<Property><Name>([^<]+)<\/Name><Value>([^<]*)<\/Value><\/Property>/g)].map(m => [m[1], decodificar(m[2])]));
      creates.push({ customerKey: /<CustomerKey>([^<]+)</.exec(b)[1], props });
      if (errorAlCrear) return { text: `<r><OverallStatus>Error</OverallStatus><Results><StatusCode>Error</StatusCode><StatusMessage>${errorAlCrear}</StatusMessage></Results></r>` };
      store.push(alterar ? alterar({ ...props }) : props); return { text: xmlOk };
    }
    if (/<ObjectType>DataExtension<\/ObjectType>/.test(b)) return { text: '<r><OverallStatus>OK</OverallStatus><Results><Name>CRM_Reporte_Config</Name><CustomerKey>KEY-CAT</CustomerKey><CategoryID>1</CategoryID><CreatedDate>2026-08-19T10:00:00</CreatedDate></Results></r>' };
    if (/<ObjectType>DataExtensionField<\/ObjectType>/.test(b)) return { text: xmlCampos(columnas) };
    if (/DataExtensionObject\[CRM_Reporte_Config\]/.test(b)) {
      const f = /<Property>([^<]+)<\/Property><SimpleOperator>equals<\/SimpleOperator><Value>([^<]*)<\/Value>/.exec(b);
      const pedidas = [...b.matchAll(/<Properties>([^<]+)<\/Properties>/g)].map(m => m[1]);
      const rows = f ? store.filter(r => String(r[f[1]]) === decodificar(f[2])) : store;
      return { text: xmlFilas(rows.map(r => Object.fromEntries(pedidas.map(p => [p, r[p] === undefined ? '' : r[p]])))) };
    }
    return { text: xmlOk };
  });
  const mkCli = (conCfg) => crearCliente({ cred: cred(), cfg: conCfg ? CFG() : null, httpsRequest: fakeHttp(handler), ahora: () => Date.UTC(2026, 9, 2, 18, 0, 0), dormir: async () => {} });
  return { cli: mkCli(true), cliSoloLectura: mkCli(false), store, creates, soap, pk, mkCli };
}
const consulta = (sondeo) => { const llamadas = []; const fn = async (cli, c, o) => { llamadas.push(o); return sondeo.completo === false ? { filas: [], completo: false, segundos: 600, ultimoError: 'x' } : { completo: true, segundos: 9, filas: [sondeo.fila] }; }; fn.llamadas = llamadas; return fn; };
const FILA_JOB = { EmailName: NUEVO, EmailID: '86001', Jobs: '6', Primero: '9/12/2026 10:00:00 AM', Ultimo: '9/12/2026 1:00:00 PM', Subject: 'Un clásico', JourneyUUID: '', JourneyName: '' };

test('agregarPieza: SIMULACRO por defecto — arma la fila y NO manda ningun Create', async () => {
  const w = mundo(); const c = consulta({ fila: FILA_JOB });
  const r = await A.agregarPieza(w.cli, CFG(), ENT(), { consultar: c });
  assert.equal(r.estado, 'simulacro'); assert.equal(r.fila.ConfigKey, 'TMP-MAGGI-E-J9'); assert.equal(c.llamadas.length, 1);
  assert.equal(w.creates.length, 0); assert.ok(!w.soap.some(x => /<CreateRequest/.test(x)), 'ni un Create en el simulacro');
});
test('agregarPieza --escribir: UN Create en el catalogo, relee la fila y la verifica campo por campo; la 2a vez es DUPLICADO', async () => {
  const w = mundo(); const c = consulta({ fila: FILA_JOB });
  const r = await A.agregarPieza(w.cli, CFG(), ENT({ inferido: 'campana' }), { escribir: true, consultar: c });
  assert.equal(r.estado, 'escrita'); assert.deepEqual(r.diferencias, []);
  assert.equal(w.creates.length, 1); assert.equal(w.creates[0].customerKey, 'KEY-CAT');
  assert.equal(w.creates[0].props.PiezaID, '*por definir'); assert.equal(w.creates[0].props.EmailName, NUEVO); assert.equal(w.creates[0].props.Campana, 'Liga MX*');
  assert.equal(w.store.length, 13);
  const otra = await A.agregarPieza(w.cli, CFG(), ENT(), { escribir: true, consultar: consulta({ fila: FILA_JOB }) });
  assert.equal(otra.estado, 'duplicado'); assert.equal(otra.existente.clave, 'TMP-MAGGI-E-J9'); assert.equal(w.creates.length, 1, 'no se escribio una segunda vez'); assert.equal(w.store.length, 13);
});
test('agregarPieza: un duplicado se rechaza ANTES de la consulta lenta a _Job y sin escribir', async () => {
  const w = mundo(); const c = consulta({ fila: FILA_JOB });
  const r = await A.agregarPieza(w.cli, CFG(), ENT({ emailName: 'O_Maggi-Mundial_1' }), { escribir: true, consultar: c });
  assert.equal(r.estado, 'duplicado'); assert.equal(r.existente.clave, 'M-MUN-1'); assert.equal(c.llamadas.length, 0, 'ni se consulto _Job'); assert.equal(w.creates.length, 0);
});
test('agregarPieza: el EmailName no existe en _Job => negativo REAL, sin escribir; consulta sin terminar => "sin-terminar", sin escribir', async () => {
  const w = mundo();
  const no = await A.agregarPieza(w.cli, CFG(), ENT(), { escribir: true, consultar: consulta({ fila: { ...FILA_JOB, EmailName: '', EmailID: '', Jobs: '0' } }) });
  assert.equal(no.estado, 'no-existe-en-job'); assert.equal(no.sondeo.encontrado, false);
  const lento = await A.agregarPieza(w.cli, CFG(), ENT(), { escribir: true, consultar: consulta({ completo: false }), timeoutS: 600 });
  assert.equal(lento.estado, 'sin-terminar'); assert.match(lento.avisos[0], /NO terminó en 600 s.*no se sabe si el envío existe/);
  assert.equal(w.creates.length, 0);
});
test('agregarPieza: un rechazo de validacion (marca cruzada) es INSTANTANEO: no gasta la consulta a _Job y no escribe', async () => {
  const w = mundo(); const c = consulta({ fila: FILA_JOB });
  const r = await A.agregarPieza(w.cli, CFG(), ENT({ marca: 'Liga MX', campana: 'Maggi' }), { escribir: true, consultar: c });
  assert.equal(r.estado, 'rechazada'); assert.match(r.errores.join('|'), /CAMPAÑA que ya existe/); assert.match(r.errores.join('|'), /MARCA que ya existe/);
  assert.equal(c.llamadas.length, 0, 'ni se consulto _Job'); assert.equal(w.creates.length, 0);
});
test('agregarPieza: un rechazo que SOLO se sabe con _Job (nombre con otra capitalizacion) sí pasa por la consulta y devuelve el sondeo', async () => {
  const w = mundo(); const c = consulta({ fila: FILA_JOB });
  const r = await A.agregarPieza(w.cli, CFG(), ENT({ emailName: NUEVO.toLowerCase() }), { escribir: true, consultar: c });
  assert.equal(r.estado, 'rechazada'); assert.match(r.errores.join('|'), /El nombre real en _Job es/); assert.equal(c.llamadas.length, 1); assert.equal(r.sondeo.emailId, 86001); assert.equal(w.creates.length, 0);
});
test('agregarPieza: si SFMC guarda algo DISTINTO a lo enviado, se reporta con el campo (no se declara exito)', async () => {
  const w = mundo({ alterar: (p) => ({ ...p, Campana: 'Liga Mx' }) });
  const r = await A.agregarPieza(w.cli, CFG(), ENT(), { escribir: true, consultar: consulta({ fila: FILA_JOB }) });
  assert.equal(r.estado, 'escrita-con-diferencias'); assert.deepEqual(r.diferencias, [{ campo: 'Campana', esperado: 'Liga MX', real: 'Liga Mx' }]);
});
test('agregarPieza: carrera (otro operador la agrego justo antes) => la PK duplicada se reporta como duplicado, sin explotar', async () => {
  const w = mundo({ errorAlCrear: 'Violation of PRIMARY KEY constraint' });
  const r = await A.agregarPieza(w.cli, CFG(), ENT(), { escribir: true, consultar: consulta({ fila: FILA_JOB }) });
  assert.equal(r.estado, 'duplicado'); assert.equal(r.carrera, true); assert.match(r.avisos.join('|'), /Otro operador/);
});
test('agregarPieza: otros errores de SFMC al escribir SI se propagan (no se confunden con duplicado)', async () => {
  const w = mundo({ errorAlCrear: 'Invalid field Foo' });
  await assert.rejects(() => A.agregarPieza(w.cli, CFG(), ENT(), { escribir: true, consultar: consulta({ fila: FILA_JOB }) }), /Invalid field Foo/);
});
test('GUARDIA: con un cliente de SOLO LECTURA (sin config) --escribir NO puede escribir: lo frena el cliente, no la buena voluntad', async () => {
  const w = mundo();
  await assert.rejects(() => A.agregarPieza(w.cliSoloLectura, CFG(), ENT(), { escribir: true, consultar: consulta({ fila: FILA_JOB }) }), /SOLO LECTURA/);
  assert.equal(w.creates.length, 0);
});
test('agregarPieza (esquema NUEVO, PK=EmailName): escribe sin ConfigKey y relee por EmailName', async () => {
  const w = mundo({ modo: 'emailname' });
  const r = await A.agregarPieza(w.cli, CFG(), ENT(), { escribir: true, consultar: consulta({ fila: FILA_JOB }) });
  assert.equal(r.estado, 'escrita'); assert.equal(r.modo, 'emailname'); assert.ok(!('ConfigKey' in w.creates[0].props) && !('PiezaID' in w.creates[0].props));
  assert.equal(w.store.at(-1).EmailName, NUEVO);
  const otra = await A.agregarPieza(w.cli, CFG(), ENT(), { escribir: true, consultar: consulta({ fila: FILA_JOB }) });
  assert.equal(otra.estado, 'duplicado'); assert.equal(w.creates.length, 1);
});
test('agregarPieza: falta --email-name => rechazada sin tocar _Job ni escribir', async () => {
  const w = mundo(); const c = consulta({ fila: FILA_JOB });
  const r = await A.agregarPieza(w.cli, CFG(), { marca: 'Maggi' }, { escribir: true, consultar: c });
  assert.equal(r.estado, 'rechazada'); assert.match(r.errores[0], /falta --email-name/); assert.equal(c.llamadas.length, 0); assert.equal(w.creates.length, 0);
});
