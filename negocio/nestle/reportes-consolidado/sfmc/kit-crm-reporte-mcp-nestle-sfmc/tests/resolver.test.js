'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../lib/de');
const R = require('../lib/resolver');
const { resumen } = require('../lib/xml');

const cfg = { des: { catalogo: { nombre: 'CRM_Reporte_Config', key: 'K' } }, esquema: { llavePieza: 'auto' } };
const fila = (o) => ({ EmailName: 'X', EmailID: '1', Len: String(String(o.EmailName || 'X').length), Jobs: '1', Subject: 'asunto', Primero: '10/2/2026 11:30:00 AM', Ultimo: '10/2/2026 11:33:00 AM', ...o });

// Emulador minimo del LIKE de T-SQL (% _ [x]) para probar que el escapado deja el fragmento LITERAL.
function likeARegex(p) {
  let re = '', i = 0;
  while (i < p.length) {
    const c = p[i];
    if (c === '%') { re += '[\\s\\S]*'; i++; }
    else if (c === '_') { re += '[\\s\\S]'; i++; }
    else if (c === '[') { const j = p.indexOf(']', i + 2); re += '[' + p.slice(i + 1, j).replace(/[\\\]^-]/g, '\\$&') + ']'; i = j + 1; }
    else { re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); i++; }
  }
  return new RegExp('^' + re + '$', 'i');
}
const casa = (fragmento, texto) => likeARegex('%' + R.likeLiteral(fragmento).replace(/''/g, "'") + '%').test(texto);

// ---------- validar fragmentos ----------
test('validarFragmentos: limpia espacios, quita duplicados sin distinguir mayusculas, acepta un string suelto', () => {
  assert.deepEqual(R.validarFragmentos(['  LIGAMX-J8 ', 'ligamx-j8', '0359270']), ['LIGAMX-J8', '0359270']);
  assert.deepEqual(R.validarFragmentos('LIGAMX-J8'), ['LIGAMX-J8']);
});
test('validarFragmentos: nada, demasiado corto o demasiados => error que NOMBRA lo que esta mal', () => {
  assert.throws(() => R.validarFragmentos([]), /al menos un fragmento/);
  assert.throws(() => R.validarFragmentos(['  ', '']), /al menos un fragmento/);
  assert.throws(() => R.validarFragmentos(['J8', 'LIGAMX-J8']), /demasiado corto.*"J8"/);
  assert.throws(() => R.validarFragmentos(Array.from({ length: 21 }, (_, i) => 'frag' + i)), /Máximo 20/);
});

// ---------- SQL ----------
test('likeLiteral: el fragmento es TEXTO, nunca un patron (% _ [ y la comilla no se interpretan)', () => {
  assert.equal(R.likeLiteral("O'Brien"), "O''Brien");
  assert.equal(R.likeLiteral('J7_B'), 'J7[_]B');
  assert.equal(R.likeLiteral('100%'), '100[%]');
  assert.equal(R.likeLiteral('a[b]'), 'a[[]b]');
});
test('LIKE emulado: el fragmento casa solo con el texto LITERAL (J7_B no casa con J7XB; 100% no casa con 100abc)', () => {
  for (const [frag, si, no] of [['J7_B', 'MX_LIGAMX-J7_B_AQ', 'MX_LIGAMX-J7XB_AQ'], ['100%', 'pack 100% real', 'pack 100abc'], ['a[b]', 'xa[b]x', 'xabx'], ["O'Brien", "el O'Brien", 'el OXBrien']]) {
    assert.ok(casa(frag, si), `${frag} debe casar con "${si}"`);
    assert.ok(!casa(frag, no), `${frag} NO debe casar con "${no}"`);
  }
  assert.ok(casa('ligamx-j7', 'MX_LIGAMX-J7_B'), 'sin distinguir mayusculas (como el _Job real)');
});
test('construirSql: OR entre fragmentos, GROUP BY el nombre, piso de JobID opcional, y lo acepta el envoltorio con centinela', () => {
  const sql = R.construirSql(['LIGAMX-J8', "0359_270"], { desde: 1298000 });
  assert.match(sql, /RTRIM\(j\.EmailName\) LIKE '%LIGAMX-J8%'\s+OR RTRIM\(j\.EmailName\) LIKE '%0359\[_\]270%'/);
  assert.match(sql, /WHERE j\.JobID > 1298000 AND \(/); assert.match(sql, /GROUP BY RTRIM\(j\.EmailName\)/);
  assert.match(sql, /LEFT\(MAX\(RTRIM\(j\.EmailSubject\)\), 250\)/, 'el asunto se corta al largo del campo (si no, el INSERT revienta y parece timeout)');
  assert.ok(!/WHERE\s+j\.JobID/.test(R.construirSql(['abc-123'])), 'sin --desde no hay piso');
  assert.ok(!/ORDER BY|^\s*WITH\b/im.test(sql));
  const env = D.construirSqlCentinela(sql, R.CAMPOS.map(c => c.name));
  assert.match(env, /UNION ALL\nSELECT '__FIN__'/);
});
test('construirSql: --desde invalido => error (nada de inyectar texto en la consulta)', () => {
  for (const malo of ['abc', '-5', '12; DROP TABLE x', '1.5']) assert.throws(() => R.construirSql(['abc-123'], { desde: malo }), /--desde debe ser un JobID/);
});

// ---------- enriquecer ----------
test('enriquecer: ordena por el envio MAS RECIENTE, marca coincidencias, copia, truncado y prueba, y limpia el asunto', () => {
  const largo = 'N'.repeat(100);
  const filas = [
    fila({ EmailName: '_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270', Ultimo: '9/12/2026 10:00:00 AM', Jobs: '8' }),
    fila({ EmailName: '_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270 - 202609', Ultimo: '9/14/2026 8:15:00 AM', Primero: '9/14/2026 8:00:00 AM', Jobs: '3', Subject: '[TEST] Hola %%[ SET @x = 1 ]%% Rick' }),
    fila({ EmailName: largo, Ultimo: '', Primero: '' }),
  ];
  const c = R.enriquecer(filas, ['LIGAMX-J7', '0359270'], null);
  assert.deepEqual(c.map(x => x.emailName), ['_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270 - 202609', '_ES_LIGAMX-J7-B-C_AQ_EM_A_NA_0359270', largo], 'recientes primero; sin fecha al final');
  assert.deepEqual(c[0].coincide, ['LIGAMX-J7', '0359270']);
  assert.equal(c[0].copia, true); assert.equal(c[1].copia, false);
  assert.equal(c[0].prueba, true); assert.equal(c[0].subject, '[TEST] Hola Rick');
  assert.equal(c[0].primero, '2026-09-14 08:00'); assert.equal(c[0].ultimo, '2026-09-14 08:15');
  assert.equal(c[2].truncado, true); assert.equal(c[1].truncado, false); assert.equal(c[2].ultimo, null);
  assert.equal(c[0].enCatalogo, undefined, 'sin catalogo no se afirma nada');
  assert.ok(!('_ms' in c[0]));
});
test('enriquecer: "ya esta en el catalogo" solo con el nombre EXACTO (una variante NO cuenta)', () => {
  const cat = new Map([['_ES_A_1', { clave: 'TMP-X', marca: 'Maggi', campana: 'Liga MX', touchpoint: 'J7', activo: 'Si' }]]);
  const c = R.enriquecer([fila({ EmailName: '_ES_A_1' }), fila({ EmailName: '_ES_A_1 - 202609' }), fila({ EmailName: '_es_a_1' })], ['_ES_A_1'], cat);
  const por = Object.fromEntries(c.map(x => [x.emailName, x.enCatalogo]));
  assert.equal(por['_ES_A_1'].clave, 'TMP-X');
  assert.equal(por['_ES_A_1 - 202609'], null, 'la copia con sufijo es OTRO nombre');
  assert.equal(por['_es_a_1'], null, 'otra capitalizacion tampoco');
});

// ---------- resolverEmailNames (con consultas y catalogo simulados) ----------
const consulta = (filas, extra = {}) => { const llamadas = []; const fn = async (cli, c, o) => { llamadas.push(o); return { filas, completo: true, segundos: 7, ultimoError: null, ...extra }; }; fn.llamadas = llamadas; return fn; };

test('resolverEmailNames: manda UNA consulta temporal con los campos y el SQL, y entrega candidatos + fragmentos sin coincidencia', async () => {
  const consultar = consulta([fila({ EmailName: '_ES_LIGAMX-J8-SAB_AQ_EM_A_NA_0359270' })]);
  const r = await R.resolverEmailNames({}, cfg, { frags: ['LIGAMX-J8', 'NO-EXISTE-XYZ'], desde: 1300000 }, { consultar, leerCat: async () => new Map() });
  assert.equal(consultar.llamadas.length, 1);
  assert.equal(consultar.llamadas[0].etiqueta, 'resolver'); assert.deepEqual(consultar.llamadas[0].campos, R.CAMPOS);
  assert.match(consultar.llamadas[0].sql, /LIKE '%LIGAMX-J8%'/); assert.match(consultar.llamadas[0].sql, /JobID > 1300000/);
  assert.equal(r.completo, true); assert.equal(r.candidatos.length, 1);
  assert.deepEqual(r.sinCoincidencia, ['NO-EXISTE-XYZ']);
  assert.equal(r.candidatos[0].enCatalogo, null, 'el catalogo se leyo y no la tiene: es NUEVA');
});
test('resolverEmailNames: consulta COMPLETA sin filas = negativo REAL (todos los fragmentos sin coincidencia, sin aviso de timeout)', async () => {
  const r = await R.resolverEmailNames({}, cfg, { frags: ['ZZZ-NO-EXISTE'] }, { consultar: consulta([]), leerCat: async () => new Map() });
  assert.equal(r.completo, true); assert.deepEqual(r.candidatos, []); assert.deepEqual(r.sinCoincidencia, ['ZZZ-NO-EXISTE']); assert.deepEqual(r.avisos, []);
});
test('resolverEmailNames: la consulta NO termino => completo:false, aviso explicito de NO concluir, y no toca el catalogo', async () => {
  let leyo = false;
  const r = await R.resolverEmailNames({}, cfg, { frags: ['abc-123'], timeoutS: 90 }, { consultar: consulta([], { completo: false, ultimoError: 'La DE aun no existe', segundos: 90 }), leerCat: async () => { leyo = true; return new Map(); } });
  assert.equal(r.completo, false); assert.deepEqual(r.candidatos, []); assert.deepEqual(r.sinCoincidencia, [], 'no afirma que "no hay coincidencias"');
  assert.match(r.avisos[0], /NO terminó en 90 s.*La DE aun no existe.*NO concluyas.*--desde/s); assert.equal(leyo, false);
});
test('resolverEmailNames: si el catalogo no se puede leer, igual entrega los candidatos (enCatalogo sin afirmar) y avisa', async () => {
  const r = await R.resolverEmailNames({}, cfg, { frags: ['abc-123'] }, { consultar: consulta([fila({ EmailName: 'abc-123' })]), leerCat: async () => { throw new Error('sin permiso'); } });
  assert.equal(r.candidatos.length, 1); assert.equal(r.candidatos[0].enCatalogo, undefined);
  assert.match(r.avisos.join(' '), /No pude leer el catálogo.*sin permiso/);
});
test('resolverEmailNames: nombres de 100 caracteres avisan del truncado; y un fragmento invalido falla ANTES de consultar', async () => {
  const consultar = consulta([fila({ EmailName: 'N'.repeat(100) })]);
  const r = await R.resolverEmailNames({}, cfg, { frags: ['NNN'] }, { consultar, leerCat: async () => new Map() });
  assert.match(r.avisos.join(' '), /100 caracteres.*trunca/);
  const otra = consulta([]);
  await assert.rejects(() => R.resolverEmailNames({}, cfg, { frags: ['ab'] }, { consultar: otra }), /demasiado corto/);
  assert.equal(otra.llamadas.length, 0, 'ni una consulta con un fragmento invalido');
});

// ---------- leerCatalogo (SOAP simulado) ----------
const celda = (k, v) => `<Property><Name>${k}</Name><Value>${v}</Value></Property>`;
const xmlFilas = (filas) => `<r><OverallStatus>OK</OverallStatus>${filas.map(o => `<Results xsi:type="DataExtensionObject"><Properties>${Object.entries(o).map(([k, v]) => celda(k, v)).join('')}</Properties></Results>`).join('')}</r>`;
const xmlCampos = (cs) => `<r><OverallStatus>OK</OverallStatus>${cs.map(([n, t, l, o, pk]) => `<Results><Name>${n}</Name><FieldType>${t}</FieldType><MaxLength>${l}</MaxLength><Ordinal>${o}</Ordinal><IsPrimaryKey>${pk}</IsPrimaryKey><IsRequired>${pk}</IsRequired></Results>`).join('')}</r>`;
function cliCatalogo(columnas, filas) {
  const pedidas = [];
  return { pedidas, soapOk: async (accion, interior) => {
    let xml;
    if (/<ObjectType>DataExtension<\/ObjectType>/.test(interior)) xml = '<r><OverallStatus>OK</OverallStatus><Results><Name>CRM_Reporte_Config</Name><CustomerKey>K</CustomerKey><CategoryID>1</CategoryID><CreatedDate>2026-08-19T10:00:00</CreatedDate></Results></r>';
    else if (/<ObjectType>DataExtensionField<\/ObjectType>/.test(interior)) xml = xmlCampos(columnas);
    else { pedidas.push(interior); xml = xmlFilas(filas); }
    return { xml, res: resumen(xml) };
  } };
}
test('leerCatalogo: modo configkey pide la PK ConfigKey; modo emailname NO la pide (no existe) — y ambos indexan por EmailName', async () => {
  const cols = (...n) => n.map((x, i) => [x, 'Text', 100, i + 1, false]);
  const filaCat = { EmailName: ' _ES_A_1 ', ConfigKey: 'TMP-A', Marca: 'Maggi', Campana: 'Liga MX', Touchpoint: 'J7', Activo: 'Si' };
  const a = cliCatalogo([['ConfigKey', 'Text', 50, 1, true], ...cols('EmailName', 'Marca', 'Campana', 'Touchpoint', 'Activo')], [filaCat]);
  const m1 = await R.leerCatalogo(a, cfg);
  assert.match(a.pedidas[0], /<Properties>ConfigKey<\/Properties>/);
  assert.deepEqual(m1.get('_ES_A_1'), { clave: 'TMP-A', marca: 'Maggi', campana: 'Liga MX', touchpoint: 'J7', activo: 'Si' }, 'el nombre se indexa recortado');
  const b = cliCatalogo([['EmailName', 'Text', 100, 1, true], ...cols('Marca', 'Campana', 'Touchpoint', 'Activo').map(([n, t, l, o, pk]) => [n, t, l, o + 1, pk])], [{ EmailName: '_ES_B_2', Marca: 'Nescafé', Campana: 'ICE', Touchpoint: 'E-P1', Activo: 'Si' }]);
  const m2 = await R.leerCatalogo(b, cfg);
  assert.ok(!/<Properties>ConfigKey<\/Properties>/.test(b.pedidas[0]), 'sin ConfigKey en el esquema nuevo');
  assert.equal(m2.get('_ES_B_2').clave, '_ES_B_2', 'la clave es el propio EmailName');
});
