'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { crearCliente } = require('../lib/sfmc');
const D = require('../lib/de');
const { cred, fakeHttp, conToken } = require('./_utils');

const K = { cat: '03A9BE5F-0C95-4901-BEB9-3A3BEBF77C6D', aud: 'F4811FBB-1BB6-4BD0-85EF-EBE08A97CB08' };
const cfg = () => ({ prefijoTemporales: 'CRM_Tmp_', carpetas: { de: 445199, query: 460279 },
  des: { catalogo: { nombre: 'CRM_Reporte_Config', key: K.cat }, audiencias: { nombre: 'CRM_Audiencias', key: K.aud } }, queries: {} });

// ---- XML de SFMC sintetico ----
const celda = (k, v) => `<Property><Name>${k}</Name><Value>${v}</Value></Property>`;
const filaXml = (o) => `<Results xsi:type="DataExtensionObject"><Properties>${Object.entries(o).map(([k, v]) => celda(k, v)).join('')}</Properties></Results>`;
const xmlFilas = (filas, { estado = 'OK', reqId } = {}) => `<r><OverallStatus>${estado}</OverallStatus>${reqId ? `<RequestID>${reqId}</RequestID>` : ''}${filas.map(filaXml).join('')}</r>`;
const xmlOk = '<r><OverallStatus>OK</OverallStatus></r>';
const xmlInfo = (nombre, key, creada = '2026-08-19T10:00:00') => `<r><OverallStatus>OK</OverallStatus><Results><Name>${nombre}</Name><CustomerKey>${key}</CustomerKey><CategoryID>445199</CategoryID><CreatedDate>${creada}</CreatedDate></Results></r>`;
const xmlCampos = (cs) => `<r><OverallStatus>OK</OverallStatus>${cs.map(([n, t, l, o, pk]) => `<Results><Name>${n}</Name><FieldType>${t}</FieldType><MaxLength>${l}</MaxLength><Ordinal>${o}</Ordinal><IsPrimaryKey>${pk}</IsPrimaryKey><IsRequired>${pk}</IsRequired></Results>`).join('')}</r>`;

/** SFMC simulado. polls: respuestas sucesivas a la LECTURA de filas ({error:true} | {filas:[…]}); la ultima se repite. */
function simulador({ polls = [], esquemas = {}, paginas = null, fallaQuery = false, fallaBorradoQuery = false, listaDes = [], listaQueries = [], reloj = () => 0, offsetCuenta = -6 } = {}) {
  const st = { deCreadas: [], queriesCreadas: [], iniciadas: [], borradasQ: [], borradasDe: [], soap: [], lecturasFilas: 0 };
  let nQ = 0, nDe = 0;
  const handler = conToken(async (c) => {
    if (c.method === 'POST' && c.path === '/data/v1/customobjects') {
      const b = JSON.parse(c.body);
      // Regla REAL de SFMC (la destapo una corrida en vivo): un campo no puede empezar con "_". La simulacion la aplica igual.
      const mal = (b.fields || []).find(f => String(f.name).startsWith('_'));
      if (mal) return { status: 400, json: { message: 'Field name cannot begin with an underscore.', errorcode: 10000 } };
      const key = 'DE-KEY-' + (++nDe); st.deCreadas.push({ ...b, key }); return { json: { key } };
    }
    if (c.method === 'POST' && c.path === '/automation/v1/queries') {
      if (fallaQuery) return { status: 400, text: 'SQL invalido' };
      const b = JSON.parse(c.body); const id = `aaaaaaaa-bbbb-cccc-dddd-${String(++nQ).padStart(12, '0')}`; st.queriesCreadas.push({ ...b, id }); return { json: { queryDefinitionId: id } };
    }
    if (c.method === 'POST' && /\/actions\/start\/$/.test(c.path)) { st.iniciadas.push(c.path); return { json: {} }; }
    if (c.method === 'DELETE' && c.path.startsWith('/automation/v1/queries/')) { if (fallaBorradoQuery) return { status: 500, text: 'boom' }; st.borradasQ.push(c.path.split('/').pop()); return { json: {} }; }
    if (c.method === 'GET' && c.path.startsWith('/automation/v1/queries?')) return { json: { count: listaQueries.length, items: listaQueries } };
    if (c.path === '/Service.asmx') {
      st.soap.push(c.body);
      if (/<DeleteRequest /.test(c.body)) { st.borradasDe.push(/<CustomerKey>([^<]+)</.exec(c.body)[1]); return { text: xmlOk }; }
      if (/<ObjectType>DataExtensionObject\[/.test(c.body)) {
        if (paginas) return { text: /<ContinueRequest>/.test(c.body) ? paginas[1] : paginas[0] };
        const nombreDe = /DataExtensionObject\[([^\]]+)\]/.exec(c.body)[1];
        st.lecturasPorDe = st.lecturasPorDe || {};
        const intento = st.lecturasPorDe[nombreDe] = (st.lecturasPorDe[nombreDe] || 0) + 1;
        const p = typeof polls === 'function' ? polls(nombreDe, intento) : (polls[Math.min(st.lecturasFilas++, polls.length - 1)] || { filas: [] });
        return { text: p.error ? '<r><OverallStatus>Error</OverallStatus><OverallStatusMessage>La DE aun no existe</OverallStatusMessage></r>' : xmlFilas(p.filas) };
      }
      if (/<ObjectType>DataExtensionField<\/ObjectType>/.test(c.body)) { const k = /<Value>([^<]+)<\/Value>/.exec(c.body)[1]; const n = Object.keys(esquemas).find(x => 'KEY-' + x === k); return { text: n ? xmlCampos(esquemas[n]) : xmlOk }; }
      if (/<SimpleOperator>like<\/SimpleOperator>/.test(c.body)) return { text: `<r><OverallStatus>OK</OverallStatus>${listaDes.map(d => `<Results><Name>${d.nombre}</Name><CustomerKey>${d.key}</CustomerKey><CreatedDate>${d.creada}</CreatedDate></Results>`).join('')}</r>` };
      if (/<ObjectType>DataExtension<\/ObjectType>/.test(c.body)) {
        const nombre = /<Value>([^<]+)<\/Value>/.exec(c.body)[1];
        const sonda = st.deCreadas.find(d => d.name === nombre);                      // una DE recien creada: CreatedDate = reloj + zona de la cuenta
        if (sonda) return { text: xmlInfo(nombre, sonda.key, new Date(reloj() + offsetCuenta * 3600e3).toISOString().slice(0, 23)) };
        return { text: esquemas[nombre] ? xmlInfo(nombre, 'KEY-' + nombre) : xmlOk };
      }
      return { text: xmlOk };
    }
    return { json: {} };
  });
  return { handler, st };
}
function nuevoCli(handler, { conCfg = true, t0 = 0 } = {}) {
  let t = t0;
  return crearCliente({ cred: cred(), cfg: conCfg ? cfg() : null, httpsRequest: fakeHttp(handler), ahora: () => t, dormir: async (ms) => { t += ms; } });
}

test('construirSqlCentinela: PK unica + fila __FIN__; quita ; final; rechaza CTE/vacio/sin campos; escapa ]', () => {
  const s = D.construirSqlCentinela('SELECT a AS a, b AS b FROM t;', ['a', 'b']);
  assert.equal(s, "SELECT CONVERT(varchar(36), NEWID()) AS ClaveTmp, q.[a] AS [a], q.[b] AS [b]\nFROM (\nSELECT a AS a, b AS b FROM t\n) q\nUNION ALL\nSELECT '__FIN__', NULL, NULL");
  assert.throws(() => D.construirSqlCentinela('WITH x AS (SELECT 1 AS a) SELECT a FROM x', ['a']), D.ErrorSql);
  assert.throws(() => D.construirSqlCentinela('  ', ['a']), D.ErrorSql);
  assert.throws(() => D.construirSqlCentinela('SELECT 1', []), D.ErrorSql);
  assert.match(D.construirSqlCentinela('SELECT 1', ['x]y']), /q\.\[x\]\]y\] AS \[x\]\]y\]/);
});

test('REGRESION (SFMC rechaza un comentario dentro de una subconsulta): construirSqlCentinela QUITA los comentarios, sin tocar cadenas ni identificadores', () => {
  const sql = "/* Vol — volumen. Regenerado */\nSELECT 'a /* no */ b' AS x, [col--raro] AS y, 'it''s -- vivo' AS z -- fin de linea\nFROM t /* otro */";
  const q = D.quitarComentariosSql(sql);
  assert.ok(!/Regenerado|fin de linea|otro/.test(q), 'los comentarios se van'); assert.ok(q.includes("'a /* no */ b'") && q.includes('[col--raro]') && q.includes("'it''s -- vivo'"), 'lo que esta entre comillas o corchetes se queda');
  const env = D.construirSqlCentinela(sql, ['x', 'y', 'z']);
  assert.ok(!/\/\*|Regenerado|fin de linea/.test(env.replace(/'a \/\* no \*\/ b'/, '')), 'el SQL envuelto no lleva ningun comentario');
  assert.match(env, /FROM \(\n\s*SELECT 'a \/\* no \*\/ b' AS x/);
});
test('quitarComentariosSql: cadena o comentario sin cerrar no se cuelgan; un comentario antes de WITH ya no esconde el CTE', () => {
  assert.equal(D.quitarComentariosSql("SELECT 'abierta /* x").trim(), "SELECT 'abierta /* x"); assert.equal(D.quitarComentariosSql('SELECT 1 /* sin cerrar').trim(), 'SELECT 1');
  assert.throws(() => D.construirSqlCentinela('/* x */ WITH c AS (SELECT 1 AS a) SELECT a FROM c', ['a']), /no admite CTE/);
});
test('construirSqlCentinela: rechaza columnas "_x" (SFMC no las admite) y la reservada ClaveTmp', () => {
  assert.throws(() => D.construirSqlCentinela('SELECT 1 AS _x', ['_x']), /no admite columnas que empiecen con "_"/);
  assert.throws(() => D.construirSqlCentinela('SELECT 1 AS ClaveTmp', ['ClaveTmp']), /reservado/);
});

test('REGRESION: el SFMC simulado rechaza campos con "_" como el real, y consultarTemp ya no manda ninguno', async () => {
  const { handler, st } = simulador({ polls: [{ filas: [{ ClaveTmp: '__FIN__' }] }] });
  const cli = nuevoCli(handler);
  await assert.rejects(() => D.crearDeTemp(cli, cfg(), 'CRM_Tmp_a_111111', [{ name: '_k', type: 'Text', length: 40, pk: true }]), /HTTP 400.*underscore/);
  await D.consultarTemp(cli, cfg(), { etiqueta: 'reg', sql: 'SELECT 1 AS N', campos: [{ name: 'N', type: 'Number' }], timeoutS: 30 });
  assert.ok(st.deCreadas[0].fields.every(f => !f.name.startsWith('_')));
});

test('infoDe/columnas: cachean (una sola ida) y una DE inexistente da error claro', async () => {
  const { handler, st } = simulador({ esquemas: { MiDE: [['K', 'Text', 50, 1, true], ['V', 'Number', 0, 2, false]] } });
  const cli = nuevoCli(handler);
  const cols = await D.columnas(cli, 'MiDE'); await D.columnas(cli, 'MiDE');
  assert.deepEqual(cols.map(c => c.name), ['K', 'V']); assert.equal(cols[0].pk, true); assert.equal(cols[0].length, 50);
  assert.equal(st.soap.length, 2, 'info + campos, UNA sola vez');
  await assert.rejects(() => D.infoDe(cli, 'NoExiste'), /no existe en esta BU/);
});

test('leerFilas: pagina con ContinueRequest y DECODIFICA entidades', async () => {
  const p1 = xmlFilas([{ N: 'marzo-&gt;abril' }, { N: 'A &amp; B' }], { estado: 'MoreDataAvailable', reqId: 'req-1' });
  const p2 = xmlFilas([{ N: 'tres' }]);
  const { handler, st } = simulador({ esquemas: { MiDE: [['N', 'Text', 50, 1, true]] }, paginas: [p1, p2] });
  const cli = nuevoCli(handler);
  const filas = await D.leerFilas(cli, 'MiDE', ['N']);
  assert.deepEqual(filas, [{ N: 'marzo->abril' }, { N: 'A & B' }, { N: 'tres' }]);
  const lect = st.soap.filter(b => /DataExtensionObject\[MiDE\]/.test(b));
  assert.equal(lect.length, 2); assert.match(lect[1], /<ContinueRequest>req-1<\/ContinueRequest>/);
});

test('leerFilas: pedir una columna inexistente => ErrorColumna con las disponibles y NO sale el Retrieve de filas', async () => {
  const { handler, st } = simulador({ esquemas: { MiDE: [['K', 'Text', 50, 1, true], ['Email_Unique_Opens', 'Number', 0, 2, false]] } });
  const cli = nuevoCli(handler);
  await assert.rejects(() => D.leerFilas(cli, 'MiDE', ['K', 'Email_Opens', 'EmailType']), (e) => {
    assert.ok(e instanceof D.ErrorColumna); assert.match(e.message, /Email_Opens, EmailType/); assert.deepEqual(e.disponibles, ['K', 'Email_Unique_Opens']); return true;
  });
  assert.equal(st.soap.filter(b => /DataExtensionObject\[/.test(b)).length, 0);
});

test('insertarFila/upsertarFila: XML correcto, valores escapados; otros roles se rechazan ANTES de enviar', async () => {
  const { handler, st } = simulador();
  const cli = nuevoCli(handler);
  await D.insertarFila(cli, cfg(), 'catalogo', { ConfigKey: 'TMP-X', Notas: 'a & b <c>', Vacio: undefined });
  let b = st.soap.at(-1);
  assert.match(b, /<CreateRequest /); assert.ok(b.includes(`<CustomerKey>${K.cat}</CustomerKey>`)); assert.match(b, /a &amp; b &lt;c&gt;/); assert.ok(!b.includes('Vacio'));
  await D.upsertarFila(cli, cfg(), 'audiencias', { ConfigKey: 'TMP-X' }, { Audience_DE: 'X', Audience_Volume: 5 });
  b = st.soap.at(-1);
  assert.match(b, /<UpdateRequest /); assert.match(b, /<SaveAction>UpdateAdd<\/SaveAction>/); assert.match(b, /<Keys><Key><Name>ConfigKey<\/Name><Value>TMP-X<\/Value><\/Key><\/Keys>/);
  const antes = st.soap.length;
  await assert.rejects(() => D.insertarFila(cli, cfg(), 'detalle', {}), /Solo se escriben filas/);
  assert.equal(st.soap.length, antes);
});

test('consultarTemp: espera el centinela, devuelve SOLO filas utiles y LIMPIA (query y DE)', async () => {
  const { handler, st } = simulador({ polls: [{ error: true }, { filas: [] }, { filas: [{ ClaveTmp: 'a1', N: '7' }, { ClaveTmp: 'a2', N: '9' }, { ClaveTmp: '__FIN__' }] }] });
  const cli = nuevoCli(handler); const logs = [];
  const r = await D.consultarTemp(cli, cfg(), { etiqueta: 'prueba', sql: 'SELECT N AS N FROM t', campos: [{ name: 'N', type: 'Number' }], timeoutS: 120, pollMs: 6000, log: (m) => logs.push(m) });
  assert.equal(r.completo, true); assert.deepEqual(r.filas, [{ N: '7' }, { N: '9' }]);
  const de = st.deCreadas[0];
  assert.ok(/^CRM_Tmp_prueba_[0-9a-f]{6}$/.test(de.name)); assert.equal(de.categoryId, 445199); assert.equal(de.isSendable, false);
  assert.deepEqual(de.fields.map(f => [f.name, f.IsPrimaryKey, f.isNullable]), [['ClaveTmp', true, false], ['N', false, true]]);
  const q = st.queriesCreadas[0];
  assert.equal(q.targetName, de.name); assert.equal(q.targetUpdateTypeId, 0); assert.equal(q.categoryId, 460279); assert.match(q.queryText, /UNION ALL\nSELECT '__FIN__', NULL$/);
  assert.equal(st.iniciadas.length, 1);
  assert.deepEqual(st.borradasQ, [q.id]); assert.deepEqual(st.borradasDe, ['DE-KEY-1']); assert.equal(cli.registro.pendientes, 0);
});

test('consultarTemp: solo el centinela => completo:true con CERO filas (un negativo REAL, distinto de un timeout)', async () => {
  const { handler } = simulador({ polls: [{ filas: [{ ClaveTmp: '__FIN__' }] }] });
  const r = await D.consultarTemp(nuevoCli(handler), cfg(), { etiqueta: 'vacia', sql: 'SELECT N AS N FROM t WHERE 1=0', campos: [{ name: 'N', type: 'Number' }], timeoutS: 60 });
  assert.equal(r.completo, true); assert.deepEqual(r.filas, []);
});

test('consultarTemp: sin centinela => completo:false (NO concluir nada) y aun asi limpia', async () => {
  const { handler, st } = simulador({ polls: [{ filas: [] }] });
  const cli = nuevoCli(handler);
  const r = await D.consultarTemp(cli, cfg(), { etiqueta: 'lenta', sql: 'SELECT N AS N FROM t', campos: [{ name: 'N', type: 'Number' }], timeoutS: 30, pollMs: 6000 });
  assert.equal(r.completo, false); assert.deepEqual(r.filas, []); assert.ok(r.segundos >= 30);
  assert.equal(st.borradasQ.length, 1); assert.equal(st.borradasDe.length, 1); assert.equal(cli.registro.pendientes, 0);
});

test('consultarTemp: si falla a mitad de camino (query rechazada) lanza Y borra la DE ya creada', async () => {
  const { handler, st } = simulador({ fallaQuery: true });
  const cli = nuevoCli(handler);
  await assert.rejects(() => D.consultarTemp(cli, cfg(), { etiqueta: 'mala', sql: 'SELECT N AS N FROM t', campos: [{ name: 'N', type: 'Number' }] }), /No pude crear la query temporal/);
  assert.deepEqual(st.borradasDe, ['DE-KEY-1']); assert.equal(cli.registro.pendientes, 0);
});

test('consultarTemp: dos corridas a la vez usan nombres DISTINTOS (varios operadores no se pisan)', async () => {
  const { handler, st } = simulador({ polls: [{ filas: [{ ClaveTmp: '__FIN__' }] }] });
  const cli = nuevoCli(handler); const una = { etiqueta: 'misma', sql: 'SELECT 1 AS N', campos: [{ name: 'N', type: 'Number' }], timeoutS: 60 };
  await Promise.all([D.consultarTemp(cli, cfg(), una), D.consultarTemp(cli, cfg(), una)]);
  const nombres = st.deCreadas.map(d => d.name);
  assert.equal(nombres.length, 2); assert.equal(new Set(nombres).size, 2);
});

test('REGRESION concurrencia: la consulta que termina primero NO borra la DE/query de la que sigue en curso', async () => {
  const fin = { ClaveTmp: '__FIN__' };
  const { handler, st } = simulador({ polls: (nombre, intento) => (nombre.includes('_rapida_') ? { filas: [fin] } : (intento < 8 ? { filas: [] } : { filas: [{ ClaveTmp: 'x1', N: '5' }, fin] })) });
  const cli = nuevoCli(handler);
  const base = { sql: 'SELECT 1 AS N', campos: [{ name: 'N', type: 'Number' }], timeoutS: 600, pollMs: 6000 };
  const pLenta = D.consultarTemp(cli, cfg(), { ...base, etiqueta: 'lenta' });
  const pRapida = D.consultarTemp(cli, cfg(), { ...base, etiqueta: 'rapida' });
  const rr = await pRapida;
  assert.equal(rr.completo, true);
  assert.equal(st.borradasDe.length, 1, 'solo se borro la DE de la rapida');
  assert.equal(cli.registro.pendientes, 2, 'la lenta conserva su DE y su query mientras sigue en curso');
  const rl = await pLenta;
  assert.equal(rl.completo, true); assert.deepEqual(rl.filas, [{ N: '5' }]);
  assert.equal(st.borradasDe.length, 2); assert.equal(cli.registro.pendientes, 0);
});

test('limpiarTemporales: nunca lanza; reporta lo que no pudo borrar y deja registrado solo eso', async () => {
  const { handler, st } = simulador({ fallaBorradoQuery: true });
  const cli = nuevoCli(handler);
  cli.registro.addQuery('aaaaaaaa-bbbb-cccc-dddd-000000000099', 'CRM_Tmp_x_111111_Load'); cli.registro.addDe('DE-KEY-9', 'CRM_Tmp_x_111111');
  const { fallos } = await D.limpiarTemporales(cli);
  assert.equal(fallos.length, 1); assert.match(fallos[0], /query CRM_Tmp_x_111111_Load/);
  assert.deepEqual(st.borradasDe, ['DE-KEY-9']); assert.equal(cli.registro.pendientes, 1);
});

test('medirOffsetCuenta: mide la zona de la cuenta con una DE sonda y la BORRA', async () => {
  for (const off of [-6, -5, 0, 5.5]) {
    const ctx = {}; const { handler, st } = simulador({ reloj: () => ctx.cli.ahora(), offsetCuenta: off });
    ctx.cli = nuevoCli(handler, { t0: Date.UTC(2026, 9, 2, 18, 0, 0) });
    assert.equal(await D.medirOffsetCuenta(ctx.cli, cfg()), off, 'zona UTC' + off);
    assert.equal(st.deCreadas.length, 1); assert.equal(st.borradasDe.length, 1); assert.equal(ctx.cli.registro.pendientes, 0);
  }
});

test('limpiarHuerfanos: borra SOLO prefijo + edad >= minEdad (zona medida); omite lo reciente y lo sin fecha', async () => {
  const t0 = Date.UTC(2026, 9, 2, 18, 0, 0);                                   // "ahora" = 12:00 hora de la cuenta (UTC-6)
  const ctx = {};
  const { handler, st } = simulador({
    reloj: () => ctx.cli.ahora(), offsetCuenta: -6,
    listaDes: [{ nombre: 'CRM_Tmp_vieja_aaaaaa', key: 'K-VIEJA', creada: '2026-09-30T09:00:00' }, { nombre: 'CRM_Tmp_reciente_bbbbbb', key: 'K-REC', creada: '2026-10-02T11:50:00' }, { nombre: 'CRM_Tmp_sinfecha_cccccc', key: 'K-SF', creada: '' }],
    listaQueries: [{ name: 'CRM_Tmp_vieja_aaaaaa_Load', queryDefinitionId: 'aaaaaaaa-bbbb-cccc-dddd-000000000001', createdDate: '2026-09-30T09:00:00' }, { name: 'CRM_Tmp_reciente_bbbbbb_Load', queryDefinitionId: 'aaaaaaaa-bbbb-cccc-dddd-000000000002', createdDate: '2026-10-02T11:50:00' }, { name: 'CRM_Email_Detalle_Load', queryDefinitionId: 'aaaaaaaa-bbbb-cccc-dddd-000000000003', createdDate: '2025-08-01T00:00:00' }],
  });
  ctx.cli = nuevoCli(handler, { t0 });
  const r = await D.limpiarHuerfanos(ctx.cli, cfg(), { minEdadMin: 60 });
  assert.equal(r.offsetHoras, -6);
  assert.deepEqual(r.borrados.des, ['CRM_Tmp_vieja_aaaaaa']); assert.deepEqual(r.borrados.queries, ['CRM_Tmp_vieja_aaaaaa_Load']);
  assert.deepEqual(r.omitidos.map(o => o.nombre).sort(), ['CRM_Tmp_reciente_bbbbbb', 'CRM_Tmp_reciente_bbbbbb_Load', 'CRM_Tmp_sinfecha_cccccc']);
  assert.ok(st.borradasDe.includes('K-VIEJA') && !st.borradasDe.includes('K-REC') && !st.borradasDe.includes('K-SF'));
  assert.ok(!st.borradasQ.includes('aaaaaaaa-bbbb-cccc-dddd-000000000003'), 'la query del reporte jamas se toca (no lleva el prefijo)');
  assert.deepEqual(r.fallos, []);
});

test('limpiarHuerfanos: con la zona MAL supuesta una DE de hace 5 min parecería vieja; midiendo, no (el porqué de medir)', async () => {
  const t0 = Date.UTC(2026, 9, 2, 18, 0, 0); const ctx = {};
  const { handler, st } = simulador({ reloj: () => ctx.cli.ahora(), offsetCuenta: -6, listaDes: [{ nombre: 'CRM_Tmp_x_dddddd', key: 'K-X', creada: '2026-10-02T11:55:00' }] });
  ctx.cli = nuevoCli(handler, { t0 });
  const mal = await D.limpiarHuerfanos(nuevoCli(simulador({ reloj: () => 0, listaDes: [{ nombre: 'CRM_Tmp_x_dddddd', key: 'K-X', creada: '2026-10-02T11:55:00' }] }).handler, { t0 }), cfg(), { minEdadMin: 60, offsetHoras: 6 });
  assert.equal(mal.borrados.des.length, 1, 'suponiendo UTC+6 (mal) una DE de 5 min parece de 11 h y se borraria');
  const bien = await D.limpiarHuerfanos(ctx.cli, cfg(), { minEdadMin: 60 });
  assert.equal(bien.borrados.des.length, 0); assert.deepEqual(st.borradasDe.filter(k => k === 'K-X'), []);
});

test('listarTemporales: solo lo que empieza con el prefijo (aunque el filtro "like" devuelva de mas)', async () => {
  const { handler } = simulador({
    listaDes: [{ nombre: 'CRM_Tmp_a_111111', key: 'K1', creada: '2026-10-02T10:00:00' }, { nombre: 'OtraDE_CRM_Tmp_', key: 'K2', creada: '2026-10-02T10:00:00' }],
    listaQueries: [{ name: 'CRM_Tmp_a_111111_Load', queryDefinitionId: 'q1' }, { name: 'CRM_Email_Detalle_Load', queryDefinitionId: 'q2' }],
  });
  const r = await D.listarTemporales(nuevoCli(handler), cfg());
  assert.deepEqual(r.des.map(d => d.nombre), ['CRM_Tmp_a_111111']); assert.deepEqual(r.queries.map(q => q.nombre), ['CRM_Tmp_a_111111_Load']);
});

// ---------- consultarTemp: "completo" solo si la carga se CONFIRMO estable ----------
test('consultarTemp: si la relectura de estabilidad FALLA no se da por completa; si se recupera, si; si nunca se confirma => completo:false', async () => {
  const FIN = { ClaveTmp: '__FIN__' }; const A1 = { ClaveTmp: 'a1', N: '7' };
  const sim = (polls) => { const { handler } = simulador({ polls }); return D.consultarTemp(nuevoCli(handler), cfg(), { etiqueta: 'est', sql: 'SELECT N AS N FROM t', campos: [{ name: 'N', type: 'Number' }], timeoutS: 60, pollMs: 6000 }); };
  const recupera = await sim([{ filas: [A1, FIN] }, { error: true }, { filas: [A1, FIN] }]);
  assert.equal(recupera.completo, true); assert.deepEqual(recupera.filas, [{ N: '7' }]);
  const siempreFalla = await sim([{ filas: [A1, FIN] }, { error: true }]);
  assert.equal(siempreFalla.completo, false, 'no pudo confirmar que la carga termino'); assert.deepEqual(siempreFalla.filas, []); assert.match(siempreFalla.ultimoError, /no pude confirmar|FALLA|error/i);
});
test('consultarTemp: una carga que sigue CRECIENDO no se da por completa antes del tiempo limite; una estable si', async () => {
  const FIN = { ClaveTmp: '__FIN__' };
  const crece = (_n, i) => ({ filas: [...Array(i + 1)].map((_, k) => ({ ClaveTmp: 'k' + k, N: String(k) })).concat(FIN) });
  const { handler } = simulador({ polls: crece });
  const r = await D.consultarTemp(nuevoCli(handler), cfg(), { etiqueta: 'crece', sql: 'SELECT N AS N FROM t', campos: [{ name: 'N', type: 'Number' }], timeoutS: 60, pollMs: 6000 });
  assert.equal(r.completo, false, 'nunca se estabilizo');
});

// ---------- limpieza de huerfanos: --min-edad valida y NUNCA adopta lo del reporte ----------
test('validarMinEdad: solo numeros entre 15 y 10080 (o su texto numerico); una bandera sola, texto, NaN, 0 o negativos se rechazan', () => {
  assert.equal(D.validarMinEdad(60), 60); assert.equal(D.validarMinEdad('90'), 90); assert.equal(D.validarMinEdad(15), 15); assert.equal(D.validarMinEdad(10080), 10080); assert.equal(D.validarMinEdad(' 30 '), 30);
  for (const malo of [true, false, 'abc', '', NaN, Infinity, -5, 0, 1, 14.9, '14', 10081, null, undefined, {}, [], '60 min', '1e2']) assert.throws(() => D.validarMinEdad(malo), D.ErrorLimpieza, JSON.stringify(malo));
});
test('limpiarHuerfanos: una min-edad invalida se rechaza ANTES de tocar SFMC (antes: "abc" -> NaN, o una bandera sola -> 1 min = borrar TODO lo temporal, tambien lo de otro operador)', async () => {
  const t0 = Date.UTC(2026, 9, 2, 18, 0, 0);
  const { handler, st } = simulador({ reloj: () => t0, offsetCuenta: -6, listaDes: [{ nombre: 'CRM_Tmp_x_aaaaaa', key: 'K-X', creada: '2026-10-02T11:59:00' }] });
  for (const malo of ['abc', true, 1, NaN]) await assert.rejects(() => D.limpiarHuerfanos(nuevoCli(handler, { t0 }), cfg(), { minEdadMin: malo }), D.ErrorLimpieza);
  assert.deepEqual(st.borradasDe, []); assert.equal(st.soap.length, 0, 'ni siquiera consulto SFMC');
});
test('limpiarHuerfanos: NUNCA adopta un objeto del propio reporte aunque su nombre empiece con el prefijo (por nombre, por key o por id, sin distinguir mayusculas)', async () => {
  const t0 = Date.UTC(2026, 9, 2, 18, 0, 0); const ctx = {};
  const c = cfg(); c.des.catalogo = { nombre: 'CRM_Tmp_Catalogo', key: K.cat }; c.queries = { vol: { nombre: 'CRM_Tmp_Vol', id: 'aaaaaaaa-bbbb-cccc-dddd-0000000000aa' } };
  const vieja = '2026-09-01T09:00:00';
  const { handler, st } = simulador({ reloj: () => ctx.cli.ahora(), offsetCuenta: -6,
    listaDes: [{ nombre: 'CRM_Tmp_Catalogo', key: K.cat, creada: vieja }, { nombre: 'CRM_Tmp_otra_renombrada', key: K.aud.toLowerCase(), creada: vieja }, { nombre: 'CRM_Tmp_huerfana_aaaaaa', key: 'K-H', creada: vieja }],
    listaQueries: [{ name: 'CRM_Tmp_Vol', queryDefinitionId: 'aaaaaaaa-bbbb-cccc-dddd-0000000000bb', createdDate: vieja }, { name: 'CRM_Tmp_renombrada', queryDefinitionId: 'AAAAAAAA-BBBB-CCCC-DDDD-0000000000AA', createdDate: vieja }, { name: 'CRM_Tmp_huerfana_aaaaaa_Load', queryDefinitionId: 'aaaaaaaa-bbbb-cccc-dddd-000000000009', createdDate: vieja }] });
  ctx.cli = nuevoCli(handler, { t0 });
  const r = await D.limpiarHuerfanos(ctx.cli, c, { minEdadMin: 60 });
  assert.deepEqual(r.borrados.des, ['CRM_Tmp_huerfana_aaaaaa']); assert.deepEqual(r.borrados.queries, ['CRM_Tmp_huerfana_aaaaaa_Load']);
  assert.deepEqual(r.omitidos.filter(o => o.motivo === 'es del reporte').map(o => o.nombre).sort(), ['CRM_Tmp_Catalogo', 'CRM_Tmp_Vol', 'CRM_Tmp_otra_renombrada', 'CRM_Tmp_renombrada']);
  assert.ok(!st.borradasDe.includes(K.cat) && !st.borradasDe.includes(K.aud) && !st.borradasDe.includes(K.aud.toLowerCase()));
});
