'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { crearCliente } = require('../lib/sfmc');
const Rf = require('../lib/refresco');
const { decodificar } = require('../lib/xml');
const { cred, fakeHttp, conToken } = require('./_utils');

const G = (n) => `${String(n).padStart(8, '0')}-aaaa-bbbb-cccc-000000000000`;
const ID = { vol: G(101), detalle: G(102), piezas: G(103), auditoria: G(104), links: G(105) };
const AUTO = G(900);
const CFG = () => ({ version: 1, prefijoTemporales: 'CRM_Tmp_', carpetas: { de: 1, query: 2 }, bu: { offsetUtcHoras: -6 }, esquema: { llavePieza: 'auto' },
  des: { catalogo: { nombre: 'CRM_Reporte_Config', key: G(1) }, audiencias: { nombre: 'CRM_Audiencias', key: G(2) }, detalle: { nombre: 'CRM_Email_Detalle', key: G(3) },
    piezas: { nombre: 'CRM_Email_Piezas', key: G(4) }, auditoria: { nombre: 'CRM_Reporte_Auditoria', key: G(5) }, links: { nombre: 'CRM_Email_Links', key: G(6) } },
  queries: { vol: { nombre: 'Vol', id: ID.vol }, detalle: { nombre: 'Det', id: ID.detalle }, piezas: { nombre: 'Pz', id: ID.piezas }, auditoria: { nombre: 'Aud', id: ID.auditoria }, links: { nombre: 'Lk', id: ID.links } },
  automation: { nombre: 'CRM_Reporte_Diario', id: AUTO, pasosEsperados: [['vol', 'links'], ['detalle'], ['piezas'], ['auditoria']] } });

// Fecha en el formato SOAP de SFMC ("M/D/YYYY h:mm:ss AM"): lo que traen los campos Date de una DE.
const fmt = (ms) => { const d = new Date(ms); let h = d.getUTCHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; const p = (n) => String(n).padStart(2, '0'); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()} ${h}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} ${ap}`; };
const T0 = Date.UTC(2026, 9, 2, 18, 0, 0);                  // "ahora" (el reloj falso); la cuenta esta en UTC-6 => 12:00 hora de la cuenta
const PIEZA = 'O_Maggi-Seleccion-NC006537_MX_ES_LIGAMX-J9-SAB_AQ_EM_A_NA_0359270';
const OTRA = 'O_Otra-Pieza_1';

const COLS = {
  CRM_Reporte_Config: ['ConfigKey', 'EmailName', 'Marca', 'Campana', 'Touchpoint', 'Activo'],
  CRM_Audiencias: ['ConfigKey', 'LastRefresh'], CRM_Email_Detalle: ['RowKey', 'EmailName', 'LastRefresh'], CRM_Email_Links: ['RowKey', 'EmailName', 'LastRefresh'],
  CRM_Email_Piezas: ['ConfigKey', 'EmailName', 'Marca', 'Campana', 'Touchpoint', 'N_Jobs', 'Email_Sends', 'Email_Unique_Opens', 'Open_Rate', 'Email_Unique_Clicks', 'Click_Rate', 'LastRefresh'],
  CRM_Reporte_Auditoria: ['ConfigKey', 'EmailName', 'Estado', 'Asset_Declarado', 'Asset_Real', 'LastRun'],
};
const PK = { CRM_Reporte_Config: 'ConfigKey', CRM_Audiencias: 'ConfigKey', CRM_Email_Piezas: 'ConfigKey', CRM_Reporte_Auditoria: 'ConfigKey', CRM_Email_Detalle: 'RowKey', CRM_Email_Links: 'RowKey' };
const xmlOk = '<r><OverallStatus>OK</OverallStatus></r>';
const celda = (k, v) => `<Property><Name>${k}</Name><Value>${v}</Value></Property>`;
const xmlFilas = (filas) => `<r><OverallStatus>OK</OverallStatus>${filas.map(o => `<Results xsi:type="DataExtensionObject"><Properties>${Object.entries(o).map(([k, v]) => celda(k, v)).join('')}</Properties></Results>`).join('')}</r>`;
const xmlInfo = (n) => `<r><OverallStatus>OK</OverallStatus><Results><Name>${n}</Name><CustomerKey>KEY-${n}</CustomerKey><CategoryID>1</CategoryID><CreatedDate>2026-08-19T10:00:00</CreatedDate></Results></r>`;
const xmlCampos = (n) => `<r><OverallStatus>OK</OverallStatus>${COLS[n].map((c, i) => `<Results><Name>${c}</Name><FieldType>Text</FieldType><MaxLength>100</MaxLength><Ordinal>${i + 1}</Ordinal><IsPrimaryKey>${c === PK[n]}</IsPrimaryKey><IsRequired>${c === PK[n]}</IsRequired></Results>`).join('')}</r>`;

/**
 * SFMC simulado con RELOJ FALSO. Las queries NO exponen estado (como en la realidad): al iniciarlas se programa su termino y,
 * cuando el reloj lo alcanza, su EFECTO aparece en la DE destino (sello nuevo en todas las filas; la pieza solo entra si la corrida la "ve").
 *   incluyeDesdeCorrida: de que corrida (1, 2, …) de detalle en adelante ve la pieza (lag de propagacion del catalogo). Infinity = nunca.
 */
function mundo(o = {}) {
  const { piezaEnCatalogo = true, activo = 'Si', piezaPreexistente = false, incluyeDesdeCorrida = 1, statusId = 6, proxima = '2026-10-03T00:08:00', automationFalla = false,
    dur = { vol: 60e3, links: 40e3, detalle: 300e3, piezas: 120e3, auditoria: 30e3 }, rechazaInicio = {}, fallaLecturas = 0, preCorriendo = null, deRota = null, automationCorreDesde = null } = o;
  const w = { t: T0, pend: preCorriendo ? [preCorriendo] : [], starts: [], calls: [], corridas: {}, falladas: 0 };
  const viejo = fmt(T0 - 20 * 3600e3);
  const pz = (sello) => ({ ConfigKey: 'TMP-X', EmailName: PIEZA, Marca: 'Maggi', Campana: 'Liga MX', Touchpoint: 'E-J9', N_Jobs: '6', Email_Sends: '1000', Email_Unique_Opens: '400', Open_Rate: '40.00', Email_Unique_Clicks: '20', Click_Rate: '2.00', Estado: 'OK', Asset_Declarado: '86001', Asset_Real: '86001', LastRefresh: sello, LastRun: sello });
  w.des = {
    CRM_Audiencias: [{ ConfigKey: 'A1', LastRefresh: viejo }, { ConfigKey: 'A2', LastRefresh: viejo }],
    CRM_Email_Detalle: [{ RowKey: 'o1', EmailName: OTRA, LastRefresh: viejo }, ...(piezaPreexistente ? [{ RowKey: 'p1', EmailName: PIEZA, LastRefresh: viejo }, { RowKey: 'p2', EmailName: PIEZA, LastRefresh: viejo }] : [])],
    CRM_Email_Piezas: [{ ConfigKey: 'O-1', EmailName: OTRA, LastRefresh: viejo }, ...(piezaPreexistente ? [{ ...pz(viejo) }] : [])],
    CRM_Reporte_Auditoria: [{ ConfigKey: 'O-1', EmailName: OTRA, LastRun: viejo }, ...(piezaPreexistente ? [{ ...pz(viejo) }] : [])],
    CRM_Email_Links: [{ RowKey: 'l1', EmailName: OTRA, LastRefresh: viejo }],
  };
  const catalogo = [{ ConfigKey: 'O-1', EmailName: OTRA, Marca: 'X', Campana: 'Y', Touchpoint: 'Z', Activo: 'Si' }, ...(piezaEnCatalogo ? [{ ConfigKey: 'TMP-X', EmailName: PIEZA, Marca: 'Maggi', Campana: 'Liga MX', Touchpoint: 'E-J9', Activo: activo }] : [])];
  const NOMBRE_DE = { vol: 'CRM_Audiencias', detalle: 'CRM_Email_Detalle', piezas: 'CRM_Email_Piezas', auditoria: 'CRM_Reporte_Auditoria', links: 'CRM_Email_Links' };
  const aplicar = () => {
    for (const p of w.pend.filter(x => !x.hecho && x.doneT <= w.t)) {
      p.hecho = true; const sello = fmt(p.doneT); const nombre = NOMBRE_DE[p.rol]; const filas = w.des[nombre]; const ts = p.rol === 'auditoria' ? 'LastRun' : 'LastRefresh';
      const ve = piezaEnCatalogo && activo === 'Si' && (p.rol === 'detalle' ? p.nCorrida >= incluyeDesdeCorrida : true);
      if (p.rol === 'vol' || p.rol === 'links') for (const f of filas) f[ts] = sello;
      else if (p.rol === 'detalle') {
        for (const f of filas) f[ts] = sello;
        if (ve && !filas.some(f => f.EmailName === PIEZA)) filas.push({ RowKey: 'p1', EmailName: PIEZA, LastRefresh: sello }, { RowKey: 'p2', EmailName: PIEZA, LastRefresh: sello });
      } else {                                                                              // Overwrite: Piezas y Auditoria dependen de lo que YA hay en Detalle
        const enDetalle = w.des.CRM_Email_Detalle.some(f => f.EmailName === PIEZA);
        w.des[nombre] = [{ ConfigKey: 'O-1', EmailName: OTRA, [ts]: sello }, ...(ve && enDetalle ? [pz(sello)] : [])];
      }
    }
  };
  const soap = (c) => {
    const b = c.body; aplicar();
    if (/<ObjectType>DataExtension<\/ObjectType>/.test(b)) { const n = /<Value>([^<]+)<\/Value>/.exec(b)[1]; return { text: COLS[n] ? xmlInfo(n) : xmlOk }; }
    if (/<ObjectType>DataExtensionField<\/ObjectType>/.test(b)) { const k = /<Value>([^<]+)<\/Value>/.exec(b)[1]; const n = Object.keys(COLS).find(x => 'KEY-' + x === k); return { text: xmlCampos(n) }; }
    const mo = /DataExtensionObject\[([^\]]+)\]/.exec(b);
    if (mo) {
      if (deRota && mo[1] === deRota) return { text: '<r><OverallStatus>Error</OverallStatus><OverallStatusMessage>La DE no responde</OverallStatusMessage></r>' };
      if (w.starts.length && w.falladas < fallaLecturas && mo[1] !== 'CRM_Reporte_Config') { w.falladas++; return { text: '<r><OverallStatus>Error</OverallStatus><OverallStatusMessage>timeout al leer</OverallStatusMessage></r>' }; }
      const pedidas = [...b.matchAll(/<Properties>([^<]+)<\/Properties>/g)].map(m => m[1]);
      const f = /<Property>([^<]+)<\/Property><SimpleOperator>equals<\/SimpleOperator><Value>([^<]*)<\/Value>/.exec(b);
      let rows = mo[1] === 'CRM_Reporte_Config' ? catalogo : (w.des[mo[1]] || []);
      if (f) rows = rows.filter(r => String(r[f[1]]) === decodificar(f[2]));
      return { text: xmlFilas(rows.map(r => Object.fromEntries(pedidas.map(p => [p, r[p] === undefined ? '' : r[p]])))) };
    }
    return { text: xmlOk };
  };
  const handler = conToken(async (c) => {
    w.calls.push(c.path === '/Service.asmx' ? `SOAP ${c.headers.SOAPAction}` : `${c.method} ${c.path}`);
    if (c.path === '/Service.asmx') return soap(c);
    if (c.method === 'GET' && c.path === `/automation/v1/automations/${AUTO}`) { w.lecturasAutomation = (w.lecturasAutomation || 0) + 1; const sid = automationCorreDesde != null && w.t >= T0 + automationCorreDesde ? 3 : statusId; return automationFalla ? { status: 500, text: 'boom' } : { json: { name: 'CRM_Reporte_Diario', statusId: sid, status: sid === 3 ? 'Running' : 'Scheduled', schedule: { scheduledTime: proxima } } }; }
    if (c.method === 'GET' && c.path === `/automation/v1/queries/${ID.detalle}`) return { json: { queryText: "SELECT 1 FROM _Sent s WHERE s.EventDate >= '2026-03-01'" } };
    const m = c.method === 'POST' && /^\/automation\/v1\/queries\/([0-9a-f-]{36})\/actions\/start\/$/.exec(c.path);
    if (m) {
      const rol = Object.keys(ID).find(r => ID[r] === m[1]); w.corridas[rol] = (w.corridas[rol] || 0) + 1; w.starts.push({ rol, t: w.t });
      const rej = rechazaInicio[rol]; if (rej) return { status: rej.status, text: rej.texto };
      w.pend.push({ rol, startT: w.t, doneT: w.t + dur[rol], nCorrida: w.corridas[rol] });
      return { json: {} };
    }
    return { json: {} };
  });
  const cli = crearCliente({ cred: cred(), cfg: CFG(), httpsRequest: fakeHttp(handler), ahora: () => w.t, dormir: async (ms) => { w.t += ms; } });
  return { w, cli };
}
const sinDiag = async () => ({ envios: 5, enVentana: 5, desde: '2026-03-01', primero: '2026-09-01', ultimo: '2026-09-02' });
const correr = (m, extra = {}, hooks = { diagnosticar: sinDiag }) => Rf.refrescarPieza(m.cli, CFG(), { emailName: PIEZA, pollMs: 10000, ...extra }, hooks);
const arranques = (w, rol) => w.starts.filter(s => s.rol === rol);

// ---------- las senales (puras) ----------
test('aterrizo: TODAS las filas con sello ESTRICTAMENTE posterior al de antes; sin filas o igual = no', () => {
  assert.equal(Rf.aterrizo({ n: 2, minMs: 5 }, { maxMs: 4 }), true);
  assert.equal(Rf.aterrizo({ n: 2, minMs: 4 }, { maxMs: 4 }), false, 'igual no es posterior');
  assert.equal(Rf.aterrizo({ n: 2, minMs: 3, maxMs: 9 }, { maxMs: 4 }), false, 'una fila vieja => aun no esta todo refrescado');
  assert.equal(Rf.aterrizo({ n: 0, minMs: null }, { maxMs: 4 }), false);
  assert.equal(Rf.aterrizo({ n: 1, minMs: 1 }, null), true, 'pieza nueva: basta con que aparezca');
  assert.equal(Rf.aterrizo({ n: 1, minMs: 1 }, { n: 0, maxMs: null }), true);
  assert.equal(Rf.aterrizo(null, null), false);
  assert.equal(Rf.avanzo({ maxMs: 5 }, { maxMs: 4 }), true); assert.equal(Rf.avanzo({ maxMs: 4 }, { maxMs: 4 }), false); assert.equal(Rf.avanzo({ maxMs: null }, { maxMs: 4 }), false);
});
test('leerSello: con EmailName solo cuenta las filas de ESA pieza; ignora sellos ilegibles', async () => {
  const { cli } = mundo({ piezaPreexistente: true });
  const de = await Rf.leerSello(cli, 'CRM_Email_Detalle', 'LastRefresh'); const pz = await Rf.leerSello(cli, 'CRM_Email_Detalle', 'LastRefresh', PIEZA);
  assert.equal(de.n, 3); assert.equal(pz.n, 2); assert.equal(pz.minMs, pz.maxMs); assert.ok(pz.maxMs > 0);
  assert.deepEqual(await Rf.leerSello(cli, 'CRM_Email_Detalle', 'LastRefresh', 'NO-EXISTE'), { n: 0, minMs: null, maxMs: null });
});

// ---------- el flujo completo ----------
test('PIEZA YA CARGADA: corre en el orden de la automation (vol+links -> detalle -> piezas -> auditoria), cada paso tras terminar el anterior', async () => {
  const m = mundo({ piezaPreexistente: true }); const logs = [];
  const r = await correr(m, { log: (s) => logs.push(s) });
  assert.equal(r.estado, 'ok'); assert.deepEqual(r.pasos.map(p => p.estado), ['ok', 'ok', 'ok', 'ok', 'ok']); assert.ok(r.pasos.every(p => p.intentos === 1));
  assert.deepEqual(m.w.starts.map(s => s.rol).slice(2), ['detalle', 'piezas', 'auditoria']); assert.deepEqual(m.w.starts.slice(0, 2).map(s => s.rol).sort(), ['links', 'vol']);
  const t = (rol) => arranques(m.w, rol)[0].t;
  assert.ok(t('detalle') >= t('vol') + 60e3, 'detalle no arranca hasta que vol termino'); assert.ok(t('piezas') >= t('detalle') + 300e3, 'piezas espera a detalle'); assert.ok(t('auditoria') >= t('piezas') + 120e3, 'auditoria espera a piezas');
  assert.equal(r.resumen.piezas.Email_Sends, '1000'); assert.equal(r.resumen.auditoria.Estado, 'OK'); assert.equal(r.resumen.auditoria.Asset_Real, '86001');
});
test('SOLO inicia las 5 queries del reporte (la guardia real esta puesta): ninguna otra escritura', async () => {
  const m = mundo({ piezaPreexistente: true }); await correr(m);
  const escrituras = m.w.calls.filter(c => /^(POST|PATCH|PUT|DELETE) /.test(c) && c !== 'POST /v2/token');
  assert.equal(escrituras.length, 5); for (const e of escrituras) assert.match(e, /^POST \/automation\/v1\/queries\/[0-9a-f-]{36}\/actions\/start\/$/);
  assert.deepEqual([...new Set(m.w.calls.filter(c => c.startsWith('SOAP ')))], ['SOAP Retrieve'], 'por SOAP solo se LEE: ni un Create/Update/Delete');
  assert.deepEqual(new Set(m.w.starts.map(s => s.rol)), new Set(['vol', 'links', 'detalle', 'piezas', 'auditoria']));
});
test('PIEZA NUEVA con LAG de propagacion: la 1a corrida de detalle termina SIN verla; se detecta y se re-corre enseguida (no tras el timeout)', async () => {
  const m = mundo({ incluyeDesdeCorrida: 2 }); const logs = [];
  const r = await correr(m, { log: (s) => logs.push(s) });
  const [d1, d2] = arranques(m.w, 'detalle'); assert.ok(d2.t - d1.t >= 300e3, `el 2o intento NO arranca antes de que termine el 1o (separacion ${(d2.t - d1.t) / 1000} s; antes del arreglo era inmediata)`);
  const det = r.pasos.find(p => p.rol === 'detalle');
  assert.equal(r.estado, 'ok', JSON.stringify({ fallo: r.fallo, logs })); assert.equal(det.estado, 'ok'); assert.equal(det.intentos, 2); assert.equal(arranques(m.w, 'detalle').length, 2);
  assert.ok(det.segundos < 700, `2 corridas de 300 s + deteccion (${det.segundos} s), NO 600 s de timeout + 300 s`);
  assert.match(logs.join('\n'), /detalle: la query TERMINO pero la pieza no aparece \(lag de propagacion del catalogo\); la vuelvo a correr/);
  assert.ok(r.resumen.piezas, 'y piezas/auditoria si la cargaron');
});
test('la pieza NUNCA aparece (p. ej. sin envios): agota los intentos => "sin-aterrizar", diagnostica, y NO sigue con piezas/auditoria', async () => {
  const m = mundo({ incluyeDesdeCorrida: Infinity }); let diag = null;
  const r = await correr(m, {}, { diagnosticar: async (cli, cfg, nombre) => { diag = nombre; return { envios: 0, enVentana: 0, desde: '2026-03-01' }; } });
  assert.equal(r.estado, 'fallo'); assert.equal(r.fallo.rol, 'detalle'); assert.equal(r.fallo.estado, 'sin-aterrizar'); assert.equal(r.fallo.intentos, 4);
  assert.equal(arranques(m.w, 'detalle').length, 4); assert.ok(!m.w.starts.some(s => s.rol === 'piezas' || s.rol === 'auditoria'), 'no se inicia lo que depende de lo que no llego');
  assert.equal(diag, PIEZA); assert.deepEqual(r.diagnostico, { envios: 0, enVentana: 0, desde: '2026-03-01' });
});
test('una query que NO termina: "timeout" tras los intentos (sin evidencia de que corriera), y se diagnostica', async () => {
  const m = mundo({ dur: { vol: 60e3, links: 40e3, detalle: Infinity, piezas: 1, auditoria: 1 } });
  const r = await correr(m, { tiempos: { detalle: { timeoutS: 60, intentos: 2 } } });
  assert.equal(r.estado, 'fallo'); assert.equal(r.fallo.estado, 'timeout'); assert.equal(r.fallo.intentos, 2); assert.equal(arranques(m.w, 'detalle').length, 2);
  assert.ok(r.diagnostico, 'tambien el timeout de detalle diagnostica los envios');
});
test('la query YA estaba corriendo (SFMC rechaza el inicio): NO es error — se espera a que la corrida en curso termine', async () => {
  const m = mundo({ piezaPreexistente: true, rechazaInicio: { detalle: { status: 400, texto: 'The query is already running' } }, preCorriendo: { rol: 'detalle', startT: T0 - 100e3, doneT: T0 + 200e3, nCorrida: 1 } });
  const logs = []; const r = await correr(m, { log: (s) => logs.push(s) });
  assert.equal(r.pasos.find(p => p.rol === 'detalle').estado, 'ok'); assert.match(logs.join('\n'), /detalle: intento 1\/4 — la query YA estaba corriendo/);
});
test('un error REAL al iniciar (403) si es error: paso "error" con el mensaje, no se sigue y NO se diagnostica', async () => {
  const m = mundo({ rechazaInicio: { detalle: { status: 403, texto: 'Forbidden: sin permiso' } } }); let diag = false;
  const r = await correr(m, {}, { diagnosticar: async () => { diag = true; return null; } });
  assert.equal(r.estado, 'fallo'); assert.equal(r.fallo.estado, 'error'); assert.match(r.fallo.error, /HTTP 403/); assert.equal(diag, false);
  assert.ok(!m.w.starts.some(s => s.rol === 'piezas'));
});
test('una lectura que falla a mitad de la espera NO aborta el paso (se reintenta en el siguiente sondeo)', async () => {
  const m = mundo({ piezaPreexistente: true, fallaLecturas: 3 });
  const r = await correr(m); assert.equal(r.estado, 'ok'); assert.equal(m.w.falladas, 3);
});
test('un paso que LANZA dentro de un grupo paralelo se vuelve "error" y su hermano TERMINA su trabajo (no queda sondeando a escondidas)', async () => {
  const m = mundo({ piezaPreexistente: true, deRota: 'CRM_Email_Links' });
  const r = await correr(m);
  assert.equal(r.estado, 'fallo'); assert.equal(r.fallo.rol, 'links'); assert.equal(r.fallo.estado, 'error'); assert.match(r.fallo.error, /La DE no responde/);
  const vol = r.pasos.find(p => p.rol === 'vol'); assert.equal(vol.estado, 'ok', 'vol (el hermano) llego hasta el final');
  assert.ok(!m.w.starts.some(s => s.rol === 'detalle'), 'y no se paso al siguiente grupo');
});
test('--sin-vol / --sin-links omiten esos pasos (y los grupos se acomodan)', async () => {
  const m = mundo({ piezaPreexistente: true }); const r = await correr(m, { sinVol: true, sinLinks: true });
  assert.equal(r.estado, 'ok'); assert.deepEqual(r.grupos, [['detalle'], ['piezas'], ['auditoria']]); assert.deepEqual(m.w.starts.map(s => s.rol), ['detalle', 'piezas', 'auditoria']);
  const m2 = mundo({ piezaPreexistente: true }); const r2 = await correr(m2, { sinVol: true }); assert.deepEqual(r2.grupos[0], ['links']);
});

// ---------- precondiciones: lo que se rechaza ANTES de iniciar nada ----------
test('la pieza NO esta en el catalogo => rechazado y no se inicia NINGUNA query (ni con --forzar: no es forzable)', async () => {
  for (const forzar of [false, true]) {
    const m = mundo({ piezaEnCatalogo: false }); const r = await correr(m, { forzar });
    assert.equal(r.estado, 'rechazado'); assert.equal(r.bloqueos[0].codigo, 'no-en-catalogo'); assert.match(r.bloqueos[0].texto, /agregar-pieza\.js/); assert.equal(m.w.starts.length, 0);
  }
});
test('pieza inactiva (Activo != Si) => rechazado: Detalle nunca la tomaria', async () => {
  const m = mundo({ activo: 'No' }); const r = await correr(m); assert.equal(r.estado, 'rechazado'); assert.equal(r.bloqueos[0].codigo, 'inactiva'); assert.equal(m.w.starts.length, 0);
});
test('la automation esta CORRIENDO => rechazado (se pisarian sus queries); --forzar lo salta y deja constancia', async () => {
  const m = mundo({ statusId: 3, piezaPreexistente: true }); const r = await correr(m);
  assert.equal(r.estado, 'rechazado'); assert.equal(r.bloqueos[0].codigo, 'automation-corriendo'); assert.equal(m.w.starts.length, 0);
  const f = mundo({ statusId: 3, piezaPreexistente: true }); const rf = await correr(f, { forzar: true });
  assert.equal(rf.estado, 'ok'); assert.match(rf.avisos.join('|'), /--forzar: se ignora el bloqueo "automation-corriendo"/);
});
test('la automation arranca en <20 min => rechazado; en 30 min => se puede', async () => {
  const cerca = mundo({ proxima: '2026-10-02T12:10:00', piezaPreexistente: true }); const r = await correr(cerca);
  assert.equal(r.estado, 'rechazado'); assert.equal(r.bloqueos[0].codigo, 'automation-inminente'); assert.match(r.bloqueos[0].texto, /arranca en 10 min/); assert.equal(cerca.w.starts.length, 0);
  const lejos = mundo({ proxima: '2026-10-02T12:30:00', piezaPreexistente: true }); assert.equal((await correr(lejos)).estado, 'ok');
  const pasada = mundo({ proxima: '2026-10-02T11:00:00', piezaPreexistente: true }); assert.equal((await correr(pasada)).estado, 'ok', 'una fecha pasada no bloquea');
});
test('una fecha de "proxima corrida" ILEGIBLE BLOQUEA (fail-closed: no se sabe si arranca ya), es forzable, y no se confunde con "arranca ya"', async () => {
  const m = mundo({ proxima: 'no-es-una-fecha', piezaPreexistente: true }); const r = await correr(m);
  assert.equal(r.estado, 'rechazado'); assert.equal(r.bloqueos[0].codigo, 'automation-fecha-ilegible'); assert.equal(r.bloqueos[0].forzable, true); assert.equal(m.w.starts.length, 0);
  assert.equal(r.precondiciones.automation.minutosHasta, null);
  const f = mundo({ proxima: 'no-es-una-fecha', piezaPreexistente: true }); const rf = await correr(f, { forzar: true }); assert.equal(rf.estado, 'ok'); assert.match(rf.avisos.join('|'), /--forzar: se ignora el bloqueo "automation-fecha-ilegible"/);
});
test('una automation SIN proxima corrida programada no bloquea por fecha (nada puede cruzarse)', async () => {
  const m = mundo({ proxima: null, piezaPreexistente: true }); const r = await correr(m); assert.equal(r.estado, 'ok', JSON.stringify(r.bloqueos));
});
test('si NO se puede leer la automation: BLOQUEA (fail-closed), es forzable y con --forzar sigue dejando constancia', async () => {
  const m = mundo({ automationFalla: true, piezaPreexistente: true }); const r = await correr(m);
  assert.equal(r.estado, 'rechazado'); assert.equal(r.bloqueos[0].codigo, 'automation-ilegible'); assert.match(r.bloqueos[0].texto, /No pude leer la automation \(HTTP 500\)/); assert.match(r.bloqueos[0].texto, /--forzar/); assert.equal(m.w.starts.length, 0);
  const f = mundo({ automationFalla: true, piezaPreexistente: true }); const rf = await correr(f, { forzar: true }); assert.equal(rf.estado, 'ok'); assert.match(rf.avisos.join('|'), /--forzar: se ignora el bloqueo "automation-ilegible"/);
});
test('estadoAutomation: devuelve el codigo de cada situacion (corriendo, inminente, fecha ilegible, ilegible, libre)', async () => {
  const cod = async (o) => (await Rf.estadoAutomation(mundo(o).cli, CFG())).bloqueos.map(b => b.codigo);
  assert.deepEqual(await cod({ statusId: 3 }), ['automation-corriendo']); assert.deepEqual(await cod({ proxima: '2026-10-02T12:10:00' }), ['automation-inminente']);
  assert.deepEqual(await cod({ proxima: 'xx' }), ['automation-fecha-ilegible']); assert.deepEqual(await cod({ automationFalla: true }), ['automation-ilegible']);
  assert.deepEqual(await cod({}), []); assert.deepEqual(await cod({ proxima: null }), []);
});
test('R6 se revisa ANTES DE CADA INICIO, no solo al principio: si la automation arranca a mitad del refresco, se DETIENE antes de la siguiente query (--forzar la salta)', async () => {
  const m = mundo({ piezaPreexistente: true, automationCorreDesde: 55e3 });                     // arranca a los 55 s: vol y links terminan a los 60 s, justo antes de iniciar detalle
  const r = await correr(m);
  assert.equal(r.estado, 'fallo'); assert.equal(r.fallo.estado, 'bloqueado'); assert.equal(r.fallo.rol, 'detalle'); assert.equal(r.fallo.bloqueos[0].codigo, 'automation-corriendo');
  assert.equal(arranques(m.w, 'detalle').length, 0, 'detalle NO se inicio'); assert.equal(arranques(m.w, 'vol').length, 1); assert.equal(arranques(m.w, 'links').length, 1);
  assert.equal(r.diagnostico, undefined, 'no se diagnostica una query que nunca corrio');
  const f = mundo({ piezaPreexistente: true, automationCorreDesde: 55e3 }); assert.equal((await correr(f, { forzar: true })).estado, 'ok');
});
test('R6 tambien frena un REINTENTO por lag: si la automation arranca despues del primer intento de Detalle, no se re-inicia', async () => {
  const m = mundo({ incluyeDesdeCorrida: 2, automationCorreDesde: 250e3 });                     // detalle tarda 300 s: termina (sin ver la pieza) con la automation ya corriendo
  const r = await correr(m);
  assert.equal(r.estado, 'fallo'); assert.equal(r.fallo.estado, 'bloqueado'); assert.equal(r.fallo.rol, 'detalle'); assert.equal(arranques(m.w, 'detalle').length, 1, 'el segundo intento NO se inicio');
  assert.ok(m.w.lecturasAutomation >= 4, 'la automation se leyo antes de cada inicio: ' + m.w.lecturasAutomation);
});
test('dryRun: muestra precondiciones y pasos y NO inicia nada', async () => {
  const m = mundo({ piezaPreexistente: true }); const r = await correr(m, { dryRun: true });
  assert.equal(r.estado, 'plan'); assert.deepEqual(r.grupos, [['vol', 'links'], ['detalle'], ['piezas'], ['auditoria']]); assert.equal(r.precondiciones.catalogo.clave, 'TMP-X'); assert.equal(m.w.starts.length, 0);
});
test('falta el EmailName => error claro, sin tocar SFMC', async () => {
  const m = mundo(); await assert.rejects(() => Rf.refrescarPieza(m.cli, CFG(), {}, {}), /Falta el EmailName EXACTO/); assert.equal(m.w.calls.length, 0);
});

// ---------- diagnostico ----------
test('diagnosticarEnvios: la ventana de Detalle se LEE de su query; la comilla del nombre se dobla; sin terminar => null', async () => {
  const m = mundo(); let sqlVisto = null;
  const consultar = async (cli, cfg, o) => { sqlVisto = o.sql; return { completo: true, segundos: 3, filas: [{ Envios: '120', EnVentana: '0', Primero: '2026-02-10', Ultimo: '2026-02-11' }] }; };
  const d = await Rf.diagnosticarEnvios(m.cli, CFG(), "O_Brien's", { consultar });
  assert.deepEqual(d, { envios: 120, enVentana: 0, desde: '2026-03-01', primero: '2026-02-10', ultimo: '2026-02-11' });
  assert.match(sqlVisto, /s\.EventDate >= '2026-03-01'/); assert.match(sqlVisto, /= 'O_Brien''s'/);
  assert.equal(await Rf.diagnosticarEnvios(m.cli, CFG(), 'x', { consultar: async () => ({ completo: false, filas: [] }) }), null);
});
