'use strict';
// Alta de UNA pieza en el catalogo (CRM_Reporte_Config). SOLO el catalogo: el mapeo de audiencia va en audiencias.js.
//
// 🔴 Reglas duras que este modulo hace cumplir (no son consejos):
//   - Identidad = el EmailName EXACTO de _Job. Se comprueba que exista y se usa el texto que devuelve _Job.
//   - PiezaID siempre '*por definir': el numero de pieza lo asigna el normalizador de Rick, nunca este codigo.
//   - Marca, Campana y BU NUNCA se cruzan, y se escriben EXACTAS como ya estan en el catalogo (no partir el reporte en dos).
//   - Un EmailName que ya esta en el catalogo se rechaza: no se duplica ni se pisa.
const D = require('./de');
const E = require('./esquema');
const { filtroSimple } = require('./xml');
const { leerCatalogoFilas } = require('./catalogo');
const { RE_SUFIJO_FECHA } = require('./resolver');
const { fechaCuenta } = require('./fechas');
const { paraMostrar, argumentoPegable, avisoDeNombre } = require('./textoseguro');

class ErrorAlta extends Error { constructor(msg) { super(msg); this.name = 'ErrorAlta'; } }

const POR_DEFINIR = E.PIEZA_ID_POR_DEFINIR;                 // '*por definir': el marcador sancionado de "aun no se sabe"
const TIPOS = { principal: 'Principal', fup: 'Follow Up' };  // los dos valores reales de EmailType
const DIMENSIONES_MARCABLES = ['bu', 'marca', 'campana', 'touchpoint', 'segmento'];
const COLUMNAS_LECTURA = ['BU', 'Marca', 'Campana', 'Touchpoint', 'Segmento', 'EmailType', 'EmailID', 'Activo'];
const CAMPOS_SONDEO = [
  { name: 'EmailName', type: 'Text', length: 250 }, { name: 'EmailID', type: 'Number' }, { name: 'Jobs', type: 'Number' },
  { name: 'Primero', type: 'Date' }, { name: 'Ultimo', type: 'Date' }, { name: 'Subject', type: 'Text', length: 250 },
  { name: 'JourneyUUID', type: 'Text', length: 60 }, { name: 'JourneyName', type: 'Text', length: 250 },
];

// ---------- comparar valores contra lo que YA existe ----------
/** Sin el asterisco final: "Liga MX*" y "Liga MX" son el mismo valor, uno marcado como inferido. */
const sinAst = (s) => String(s == null ? '' : s).trim().replace(/\*+$/, '').trim();
/** Para comparar: sin acentos, sin mayusculas, sin signos, espacios colapsados. "(por definir)*" y "*por definir" igualan. */
const normalizar = (s) => sinAst(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const esPorDefinir = (s) => normalizar(s) === 'por definir';

/** Map(normalizado -> Map(base sin asterisco -> Set(grafias completas))) de una columna del catalogo. */
function indiceDe(filas, col) {
  const idx = new Map();
  for (const f of filas) {
    const v = String(f[col] == null ? '' : f[col]).trim();
    if (!v || esPorDefinir(v)) continue;
    const n = normalizar(v), base = sinAst(v);
    if (!idx.has(n)) idx.set(n, new Map());
    const m = idx.get(n); if (!m.has(base)) m.set(base, new Set()); m.get(base).add(v);
  }
  return idx;
}
const grafias = (mapa) => [...mapa.values()].flatMap(s => [...s]).sort();

/** 'existente' (mismo texto, con o sin asterisco) · 'variante' (mismo texto normalizado, otra grafia) · 'nuevo' · 'por-definir'. */
function clasificarValor(valor, idx) {
  const v = String(valor).trim();
  if (esPorDefinir(v)) return { tipo: 'por-definir' };
  const mapa = idx.get(normalizar(v));
  if (!mapa) return { tipo: 'nuevo' };
  if (mapa.has(sinAst(v))) return { tipo: 'existente' };
  return { tipo: 'variante', existentes: grafias(mapa) };
}

function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** Los valores existentes mas parecidos a `valor` (para "¿quisiste decir…?"). */
function cercanos(valor, idx, k = 4) {
  const n = normalizar(valor), tope = Math.max(3, Math.ceil(n.length * 0.4));
  return [...idx.entries()].map(([nn, mapa]) => ({ d: distancia(n, nn), v: grafias(mapa)[0] })).filter(x => x.d <= tope).sort((a, b) => a.d - b.d).slice(0, k).map(x => x.v);
}
const todos = (idx) => [...idx.values()].map(m => grafias(m)[0]).sort();
/** Lista entre comillas: un valor puede llevar coma ("Carnation, La Lechera") y sin comillas parecerian dos. */
const lista = (arr) => arr.map(x => JSON.stringify(x)).join(', ');

/** La BU que el catalogo usa mas para una marca (por texto normalizado). null si la marca no tiene filas. */
function buDominante(filas, marca) {
  const n = normalizar(marca), cuenta = new Map(); let total = 0;
  for (const f of filas) if (normalizar(f.Marca) === n && String(f.BU || '').trim()) { cuenta.set(f.BU, (cuenta.get(f.BU) || 0) + 1); total++; }
  const orden = [...cuenta.entries()].sort((a, b) => b[1] - a[1] || (a[0].endsWith('*') - b[0].endsWith('*')) || a[0].localeCompare(b[0]));
  return orden.length ? { bu: orden[0][0], n: orden[0][1], total } : null;
}

// ---------- dimensiones ----------
/**
 * Valida y completa las dimensiones contra el catalogo VIVO. Devuelve { valores, errores, avisos, derivados }.
 * entrada: { bu?, marca, campana, touchpoint, segmento?, inferido? ("marca,campana,…") }
 */
function validarDimensiones(entrada, filas, { permitirNuevos = false } = {}) {
  const errores = [], avisos = [], derivados = {};
  const idx = { bu: indiceDe(filas, 'BU'), marca: indiceDe(filas, 'Marca'), campana: indiceDe(filas, 'Campana') };
  const etq = { bu: 'BU', marca: 'Marca', campana: 'Campaña' };
  const marca = String(entrada.marca || '').trim(), campana = String(entrada.campana || '').trim();
  const touchpoint = String(entrada.touchpoint || '').trim();
  const segmento = String(entrada.segmento || '').trim() || POR_DEFINIR;
  let bu = String(entrada.bu || '').trim();
  if (!marca) errores.push('falta --marca');
  if (!campana) errores.push(`falta --campana (si aún no se sabe: "${POR_DEFINIR}")`);
  if (!touchpoint) errores.push(`falta --touchpoint (si aún no se sabe: "${POR_DEFINIR}")`);

  // 1) Marca ≠ Campaña ≠ BU: nunca cruzadas (regla dura de Rick). Una dimension cruzada ya queda explicada con UN error:
  //    no se le suman los de "valor nuevo" / "falta la BU", que serian consecuencias y taparian la causa.
  const en = (col, v) => idx[col].has(normalizar(v));
  const cruzada = { bu: false, marca: false, campana: false };
  if (marca && !esPorDefinir(marca) && !en('marca', marca)) {
    if (en('campana', marca)) { cruzada.marca = true; errores.push(`"${marca}" es una CAMPAÑA que ya existe en el catálogo, no una marca. Marca ≠ Campaña: no se cruzan.`); }
    else if (en('bu', marca)) { cruzada.marca = true; errores.push(`"${marca}" es una BU del catálogo, no una marca.`); }
  }
  if (campana && !esPorDefinir(campana) && !en('campana', campana) && en('marca', campana)) { cruzada.campana = true; errores.push(`"${campana}" es una MARCA que ya existe en el catálogo, no una campaña. Marca ≠ Campaña: no se cruzan.`); }
  if (bu && !esPorDefinir(bu) && !en('bu', bu) && (en('marca', bu) || en('campana', bu))) { cruzada.bu = true; errores.push(`"${bu}" es una marca o campaña del catálogo, no una BU (BU existentes: ${lista(todos(idx.bu))}).`); }

  // 2) BU: si falta, la del catalogo para esa marca; si se da y difiere de la usual, aviso.
  const dom = marca && !esPorDefinir(marca) && !cruzada.marca ? buDominante(filas, marca) : null;
  if (!bu) {
    if (dom) { bu = dom.bu; derivados.bu = `derivada del catálogo: la BU más usada para la marca "${marca}" (${dom.n} de ${dom.total} filas)`; }
    else if (marca && !cruzada.marca) errores.push(`falta --bu y no puedo derivarla (la marca "${marca}" no tiene filas en el catálogo). BU existentes: ${lista(todos(idx.bu))}`);
  } else if (dom && sinAst(dom.bu) !== sinAst(bu)) avisos.push(`para la marca "${marca}" el catálogo usa la BU "${dom.bu}" (${dom.n} de ${dom.total} filas); indicaste "${bu}"`);

  // 3) Cada valor contra lo que ya existe: la misma grafia, o error (una variante parte el reporte en dos).
  const clasifica = (clave, valor) => {
    if (!valor) return;
    const c = clasificarValor(valor, idx[clave]);
    if (c.tipo === 'variante') errores.push(`${etq[clave]} "${valor}" no coincide con el catálogo; existe como ${c.existentes.map(x => JSON.stringify(x)).join(' / ')}. Escríbelo EXACTO para no partir el reporte en dos.`);
    else if (c.tipo === 'nuevo') {
      const cerca = cercanos(valor, idx[clave]);
      const base = `${etq[clave]} "${valor}" no existe en el catálogo${cerca.length ? ` (¿quisiste decir ${cerca.map(x => JSON.stringify(x)).join(', ')}?)` : ''}`;
      if (permitirNuevos) avisos.push(base + ' — se da de alta como valor NUEVO (--permitir-valores-nuevos)');
      else errores.push(base + `. Existentes: ${lista(todos(idx[clave]))}. Si es un valor nuevo a propósito, repite con --permitir-valores-nuevos.`);
    }
  };
  if (!cruzada.marca) clasifica('marca', marca);
  if (!cruzada.campana) clasifica('campana', campana);
  if (!cruzada.bu) clasifica('bu', bu);

  // 4) Touchpoint y segmento son texto libre por campana: una variante solo avisa.
  for (const [col, valor] of [['Touchpoint', touchpoint], ['Segmento', segmento]]) {
    if (!valor) continue;
    const c = clasificarValor(valor, indiceDe(filas, col));
    if (c.tipo === 'variante') avisos.push(`${col} "${valor}" existe en el catálogo como ${c.existentes.map(x => JSON.stringify(x)).join(' / ')}: ¿es el mismo?`);
  }
  if (marca && campana && !esPorDefinir(marca) && !esPorDefinir(campana) && en('marca', marca) && en('campana', campana)) {
    const par = (f) => `${normalizar(f.Marca)}|${normalizar(f.Campana)}`;
    if (!filas.some(f => par(f) === `${normalizar(marca)}|${normalizar(campana)}`)) {
      const suyas = [...new Set(filas.filter(f => normalizar(f.Marca) === normalizar(marca)).map(f => f.Campana))];
      avisos.push(`combinación NUEVA Marca × Campaña: "${marca}" × "${campana}" (la marca hoy tiene: ${suyas.join(', ')}). Confirma que no estén cruzadas.`);
    }
  }

  // 5) Asterisco = "esto lo infiero yo" (convencion del catalogo). Solo en lo que se marque.
  const marcadas = new Set(String(entrada.inferido || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  const malas = [...marcadas].filter(k => !DIMENSIONES_MARCABLES.includes(k));
  if (malas.length) errores.push(`--inferido: dimensión desconocida ${malas.map(m => JSON.stringify(m)).join(', ')} (usa: ${DIMENSIONES_MARCABLES.join(', ')})`);
  const ast = (clave, v) => (marcadas.has(clave) && v && !esPorDefinir(v) && !/\*$/.test(v) ? v + '*' : v);
  const valores = { bu: ast('bu', bu), marca: ast('marca', marca), campana: ast('campana', campana), touchpoint: ast('touchpoint', touchpoint), segmento: ast('segmento', segmento) };
  return { valores, errores, avisos, derivados, inferidas: [...marcadas].filter(k => DIMENSIONES_MARCABLES.includes(k)) };
}

/** NC006537, NC004682… se lee del PROPIO nombre (dato verificable, no inventado). */
const derivarCodigoNC = (emailName) => { const m = /NC\d{5,7}/i.exec(String(emailName || '')); return m ? m[0].toUpperCase() : null; };

// ---------- duplicados ----------
const buscarDuplicado = (filas, emailName) => filas.find(f => String(f.EmailName).trim() === emailName) || null;

/** Lo que NO bloquea pero conviene mirar: la misma pieza con/sin sufijo de fecha, el mismo EmailID, el mismo touchpoint. */
function parecidos({ emailName, emailId, valores, emailType, filas, pk }) {
  const avisos = [];
  const base = (s) => String(s).replace(RE_SUFIJO_FECHA, '').trim();
  const nombre = (f) => `${f[pk]} (…${String(f.EmailName).trim().slice(-48)})`;
  for (const f of filas) {
    const n = String(f.EmailName).trim();
    if (n === emailName) continue;
    if (base(n) === base(emailName)) {
      // Mismo nombre salvo el sufijo " - AAAAMM": quien NO lo trae es el original.
      const rol = !RE_SUFIJO_FECHA.test(n) ? 'el ORIGINAL' : !RE_SUFIJO_FECHA.test(emailName) ? 'una versión con sufijo de fecha (copia/reenvío)' : 'otra copia con un sufijo de fecha distinto';
      avisos.push(`${nombre(f)} es ${rol} de este mismo nombre: son piezas DISTINTAS, confirma que quieres ambas.`);
    } else if (emailId != null && String(f.EmailID) === String(emailId)) avisos.push(`el EmailID ${emailId} ya está en el catálogo bajo OTRO nombre: ${nombre(f)} (¿un email renombrado?).`);
  }
  const k = (v) => [v.marca, v.campana, v.touchpoint, v.segmento].map(normalizar).join('|');
  for (const f of filas) {
    if (String(f.EmailName).trim() !== emailName && [f.Marca, f.Campana, f.Touchpoint, f.Segmento].map(normalizar).join('|') === k(valores) && normalizar(f.EmailType) === normalizar(emailType)) {
      avisos.push(`ya hay una pieza con la misma Marca · Campaña · Touchpoint · Segmento · Tipo: ${nombre(f)}. ¿Es un touchpoint repetido?`);
    }
  }
  return avisos;
}

// ---------- sondeo en _Job ----------
const lit = (s) => String(s).replace(/'/g, "''");
function construirSondeoSql(emailName) {
  return `SELECT MAX(RTRIM(j.EmailName)) AS EmailName, MAX(j.EmailID) AS EmailID, COUNT(*) AS Jobs,
       MIN(j.SchedTime) AS Primero, MAX(j.SchedTime) AS Ultimo, LEFT(MAX(RTRIM(j.EmailSubject)), 250) AS Subject,
       MAX(jr.JourneyID) AS JourneyUUID, LEFT(MAX(RTRIM(jr.JourneyName)), 250) AS JourneyName
FROM _Job j
LEFT JOIN _JourneyActivity ja ON ja.JourneyActivityObjectID = j.TriggererSendDefinitionObjectID
LEFT JOIN _Journey jr ON jr.VersionID = ja.VersionID
WHERE RTRIM(j.EmailName) = '${lit(emailName)}'`;
}
/** Un agregado sin GROUP BY devuelve UNA fila aunque no haya coincidencias: Jobs = 0 es el negativo. */
async function sondear(cli, cfg, emailName, { consultar = D.consultarTemp, timeoutS = 600, pollMs = 6000, log = () => {} } = {}) {
  const r = await consultar(cli, cfg, { etiqueta: 'alta', sql: construirSondeoSql(emailName), campos: CAMPOS_SONDEO, timeoutS, pollMs, log });
  if (!r.completo) return { completo: false, segundos: r.segundos, ultimoError: r.ultimoError || null, encontrado: false };
  const f = (r.filas || [])[0] || {};
  const jobs = Number(f.Jobs) || 0;
  const num = (v) => (v == null || v === '' ? null : Number(v));
  return { completo: true, segundos: r.segundos, encontrado: jobs > 0, emailName: String(f.EmailName || '').trim() || null, emailId: num(f.EmailID), jobs,
    primero: fechaCuenta(f.Primero), ultimo: fechaCuenta(f.Ultimo), subject: String(f.Subject || '').replace(/%%\[[\s\S]*?\]%%/g, '').replace(/\s+/g, ' ').trim() || null,
    journeyId: String(f.JourneyUUID || '').trim() || null, journeyName: String(f.JourneyName || '').trim() || null };
}

// ---------- el plan (puro) ----------
/**
 * entrada: { emailName, bu?, marca, campana, touchpoint, segmento?, fup?, emailType?, estado?, activo?, notas?, codigoNC?, configKey?, inferido?, permitirNuevos? }
 * cat: { modo, pk, columnas, filas } · sondeo: de sondear() · hoy: 'AAAA-MM-DD'
 * Devuelve { errores, avisos, derivados, fila, claves, modo, valores, configKey, emailType, omitidas, recortadas }.
 */
function planificarAlta({ entrada, cat, sondeo, hoy }) {
  const errores = [], avisos = [], derivados = {};
  const emailName = String(entrada.emailName || '').trim();
  if (!emailName) errores.push('falta --email-name (el nombre EXACTO de _Job; encuéntralo con scripts/resolver-emailname.js)');
  if (sondeo && sondeo.emailName && sondeo.emailName !== emailName) errores.push(`El nombre real en _Job es "${sondeo.emailName}" (otra capitalización o espacios): usa ese EXACTO.`);

  const dim = validarDimensiones(entrada, cat.filas, { permitirNuevos: !!entrada.permitirNuevos });
  errores.push(...dim.errores); avisos.push(...dim.avisos); Object.assign(derivados, dim.derivados);

  const emailType = entrada.fup ? TIPOS.fup : String(entrada.emailType || TIPOS.principal).trim();
  if (entrada.fup && entrada.emailType && normalizar(entrada.emailType) !== normalizar(TIPOS.fup)) errores.push(`--fup y --email-type "${entrada.emailType}" se contradicen`);
  if (![TIPOS.principal, TIPOS.fup].some(t => normalizar(t) === normalizar(emailType))) avisos.push(`EmailType "${emailType}" no es ninguno de los habituales (${TIPOS.principal}, ${TIPOS.fup})`);
  const tipoFinal = [TIPOS.principal, TIPOS.fup].find(t => normalizar(t) === normalizar(emailType)) || emailType;

  let codigoNC = String(entrada.codigoNC || '').trim() || null;
  if (!codigoNC) { codigoNC = derivarCodigoNC(emailName); if (codigoNC) derivados.codigoNC = 'leído del propio EmailName'; }

  let configKey = String(entrada.configKey || '').trim() || null;
  if (cat.modo === 'configkey') {
    const existentes = new Set(cat.filas.map(f => f.ConfigKey).filter(Boolean));
    if (configKey && existentes.has(configKey)) errores.push(`la ConfigKey ${configKey} ya existe en el catálogo`);
    if (!configKey) {
      try { configKey = E.proponerConfigKey(existentes, { marca: dim.valores.marca, touchpoint: dim.valores.touchpoint, esFup: tipoFinal === TIPOS.fup }); derivados.configKey = 'interna (el normalizador la ignora); desaparece con la migración a EmailName como PK'; }
      catch (e) { errores.push(e.message); }
    }
  } else if (configKey) avisos.push('--configkey se ignora: este catálogo ya no usa ConfigKey (su PK es EmailName)');

  avisos.push(...parecidos({ emailName, emailId: sondeo && sondeo.emailId, valores: dim.valores, emailType: tipoFinal, filas: cat.filas, pk: cat.pk }));

  const notas = String(entrada.notas || '').trim() || `PROVISIONAL - alta ${hoy} con agregar-pieza.js.${dim.inferidas.length ? ' Dimensiones con * son inferidas.' : ''}`;
  const fila = E.construirFilaCatalogo(cat.columnas, {
    emailName, configKey, bu: dim.valores.bu, marca: dim.valores.marca, campana: dim.valores.campana, touchpoint: dim.valores.touchpoint, segmento: dim.valores.segmento,
    emailType: tipoFinal, estado: String(entrada.estado || 'Confirmado').trim(), activo: String(entrada.activo || 'Si').trim(), notas,
    emailId: sondeo && sondeo.emailId != null ? sondeo.emailId : undefined, codigoNC,
  }, { modo: cat.modo });
  errores.push(...fila.errores);
  if (fila.omitidas.length) avisos.push(`columnas que este catálogo no tiene y se omiten: ${fila.omitidas.join(', ')}`);
  for (const r of fila.recortadas) avisos.push(`${r.campo} se recortó de ${r.de} a ${r.a} caracteres (límite de la columna)`);
  return { errores, avisos, derivados, fila: fila.props, claves: fila.claves, modo: cat.modo, valores: dim.valores, configKey, emailType: tipoFinal, omitidas: fila.omitidas, recortadas: fila.recortadas };
}

// ---------- escribir y verificar ----------
const ES_PK_DUPLICADA = /primary key|duplicate|unique|already exists|violation/i;
async function escribirFila(cli, cfg, cat, plan) {
  try { await D.insertarFila(cli, cfg, 'catalogo', plan.fila); }
  catch (e) { if (ES_PK_DUPLICADA.test(e.message)) return { estado: 'duplicado', carrera: true, mensaje: e.message }; throw e; }
  // No basta con que SFMC diga OK: se lee la fila de vuelta y se compara campo por campo.
  const valorPk = plan.claves[cat.pk];
  const leidas = await D.leerFilas(cli, cfg.des.catalogo.nombre, Object.keys(plan.fila), { filtro: filtroSimple(cat.pk, 'equals', valorPk), validar: false });
  const real = leidas[0];
  if (!real) return { estado: 'no-verificada', diferencias: null };
  const diferencias = Object.entries(plan.fila).filter(([k, v]) => String(real[k] == null ? '' : real[k]).trim() !== String(v).trim()).map(([campo, esperado]) => ({ campo, esperado, real: real[campo] }));
  return { estado: diferencias.length ? 'escrita-con-diferencias' : 'escrita', diferencias };
}

const resumenFila = (f, pk) => ({ clave: f[pk], emailName: String(f.EmailName).trim(), marca: f.Marca, campana: f.Campana, touchpoint: f.Touchpoint, segmento: f.Segmento, emailType: f.EmailType, activo: f.Activo, emailId: f.EmailID });

/**
 * Entrada principal. Estados: 'duplicado' | 'no-existe-en-job' | 'sin-terminar' | 'rechazada' | 'simulacro' |
 *   'escrita' | 'escrita-con-diferencias' | 'no-verificada'.   Por defecto es SIMULACRO: no escribe nada.
 */
async function agregarPieza(cli, cfg, entrada, { escribir = false, consultar = D.consultarTemp, timeoutS = 600, pollMs = 6000, log = () => {} } = {}) {
  const emailName = String(entrada.emailName || '').trim();
  const cat = await leerCatalogoFilas(cli, cfg, COLUMNAS_LECTURA);
  if (cat.filas.truncado) throw new ErrorAlta('No pude leer el catálogo completo (demasiadas filas): sin eso no se puede comprobar duplicados con seguridad.');
  const base = { modo: cat.modo, filasCatalogo: cat.filas.length, errores: [], avisos: [] };
  if (!emailName) return { ...base, estado: 'rechazada', errores: ['falta --email-name (el nombre EXACTO de _Job; encuéntralo con scripts/resolver-emailname.js)'] };

  const dup = buscarDuplicado(cat.filas, emailName);                       // antes de la consulta lenta
  if (dup) return { ...base, estado: 'duplicado', existente: resumenFila(dup, cat.pk) };
  // Lo que no necesita _Job (un typo, una marca cruzada) se rechaza al instante, sin gastar los ~40 s de la consulta.
  const previa = validarDimensiones(entrada, cat.filas, { permitirNuevos: !!entrada.permitirNuevos });
  if (previa.errores.length) return { ...base, estado: 'rechazada', errores: previa.errores, avisos: previa.avisos, derivados: previa.derivados };

  const sondeo = await sondear(cli, cfg, emailName, { consultar, timeoutS, pollMs, log });
  if (!sondeo.completo) return { ...base, estado: 'sin-terminar', sondeo, avisos: [`La consulta a _Job NO terminó en ${timeoutS} s${sondeo.ultimoError ? ' (' + sondeo.ultimoError + ')' : ''}: no se sabe si el envío existe. Reintenta (doctor.js --latencia mide el motor).`] };
  if (!sondeo.encontrado) return { ...base, estado: 'no-existe-en-job', sondeo };

  const offset = cfg.bu && cfg.bu.offsetUtcHoras != null ? Number(cfg.bu.offsetUtcHoras) : -6;
  const hoy = new Date(cli.ahora() + offset * 3600e3).toISOString().slice(0, 10);
  const plan = planificarAlta({ entrada, cat, sondeo, hoy });
  const comun = { ...base, sondeo, ...plan };
  if (plan.errores.length) return { ...comun, estado: 'rechazada' };
  if (!escribir) return { ...comun, estado: 'simulacro' };
  const r = await escribirFila(cli, cfg, cat, plan);
  if (r.estado === 'duplicado') return { ...comun, ...r, errores: [], avisos: [...plan.avisos, 'Otro operador acaba de agregar esta misma pieza (la PK ya existía al escribir).'] };
  return { ...comun, ...r };
}

/**
 * Las lineas de "Siguiente" tras un alta. El EmailName es texto ajeno (viene de _Job): solo se pega entre comillas dobles si el shell no interpretaria nada
 * (un nombre con "$(…)" EJECUTARIA ese codigo al pegar el comando, en bash y en PowerShell). Si no es seguro, va un marcador y se explica por que.
 */
function pasosSiguientes(emailName, { journey = false } = {}) {
  const arg = argumentoPegable(emailName);
  const a = arg || '"<EmailName de arriba>"';
  const lineas = [`  1) node scripts/refrescar-pieza.js --email-name ${a}     (si no, aparece en el reporte hasta la próxima corrida de las 00:08)`];
  if (journey) lineas.push(`  2) node scripts/audiencias.js --email-name ${a}       (es de journey: mapea su audiencia y volumen)`);
  if (!arg) lineas.push(`  ⚠️  El EmailName ${avisoDeNombre(emailName)}. Por eso NO se copió en los comandos de arriba: sustituye el marcador por el nombre, entre comillas simples.`);
  return lineas;
}

const ORDEN_FILA = ['ConfigKey', 'PiezaID', 'EmailName', 'ContentName', 'BU', 'Marca', 'Campana', 'Touchpoint', 'Segmento', 'EmailType', 'Estado', 'Activo', 'CodigoNC', 'EmailID', 'Notas'];

/** Las lineas de la fila que se inserto (o se insertaria), con la nota de donde sale cada dato. */
function lineasDeFila(r) {
  const v = paraMostrar; const fila = r.fila || {}; const L = [];
  for (const k of ORDEN_FILA.filter(c => c in fila)) {
    const nota = k === 'PiezaID' ? `   ← lo asigna el normalizador de Rick, nunca este script`
      : k === 'ConfigKey' ? `   ← ${v(r.derivados.configKey || 'dada por ti')}`
        : k === 'BU' && r.derivados.bu ? `   ← ${v(r.derivados.bu)}`
          : k === 'CodigoNC' && r.derivados.codigoNC ? `   ← ${v(r.derivados.codigoNC)}`
            : k === 'EmailID' ? '   ← de _Job' : k === 'ContentName' ? '   ← = EmailName' : '';
    L.push(`   ${k.padEnd(12)} ${v(fila[k])}${nota}`);
  }
  if (r.modo === 'emailname') L.push('   (esquema nuevo: la PK es EmailName; ya no hay ConfigKey. PiezaID y ContentName salen solo si la tabla conserva esas columnas)');
  return L;
}

/**
 * Lo que imprime un alta, como { lineas, codigo } (puro: se prueba sin consola). Todo lo que viene de SFMC (nombres, asuntos, journeys, valores del catalogo) pasa por
 * paraMostrar: ninguna linea de _Job ni del catalogo puede falsificar otras (por ejemplo, un "✓ Insertada y VERIFICADA" falso) ni mover la terminal.
 * codigo: 0 simulacro valido / alta verificada · 1 error o rechazo · 2 el EmailName no existe en _Job · 3 ya esta en el catalogo.
 */
function formatearResultado(r) {
  const v = paraMostrar; const L = [''];
  const fin = (codigo) => ({ lineas: L, codigo });
  if (r.estado === 'duplicado') {
    const e = r.existente;
    if (r.carrera) { L.push('✗ Otro operador acaba de agregar esta misma pieza: la PK ya existía al escribir. No se duplicó nada.'); return fin(3); }
    L.push('✗ YA ESTÁ en el catálogo: no se agrega (no se duplica ni se pisa).');
    L.push(`   ${v(e.clave)} · ${[e.marca, e.campana, e.touchpoint, e.emailType].filter(Boolean).map(v).join(' · ')} · Activo=${v(e.activo)} · EmailID ${v(e.emailId)}`);
    L.push(`   ${v(e.emailName)}`);
    L.push('   Cambiarle una dimensión (p. ej. la campaña) es una CORRECCIÓN del catálogo, no un alta: pídela a propósito, no por aquí.');
    return fin(3);
  }
  if (r.estado === 'no-existe-en-job') {
    L.push(`✗ Ese EmailName NO existe en _Job (la consulta terminó en ${r.sondeo.segundos} s: es un negativo REAL).`);
    L.push('   Usa el nombre EXACTO que devuelve:  node scripts/resolver-emailname.js "<un fragmento>"   (nunca el código del asset del brief)');
    return fin(2);
  }
  if (r.estado === 'sin-terminar') { for (const a of r.avisos) L.push('✗ ' + v(a)); return fin(1); }

  const s = r.sondeo;                       // no existe si se rechazó antes de consultar _Job (typo de dimensiones)
  if (s) {
    L.push(`EmailName   ✓ existe en _Job · ${s.jobs} job${s.jobs === 1 ? '' : 's'} · EmailID ${s.emailId ?? '?'}${s.primero ? ' · ' + s.primero + (s.ultimo && s.ultimo !== s.primero ? ' → ' + s.ultimo : '') : ''}`);
    if (s.subject) L.push(`Asunto      "${v(String(s.subject).slice(0, 70))}"`);
    L.push(`Journey     ${s.journeyId ? `${v(s.journeyName || '(sin nombre)')} · ${v(s.journeyId)}` : '(envío sin journey)'}`);
  }
  L.push(`Catálogo    ${r.filasCatalogo} filas · modo ${r.modo === 'configkey' ? 'ConfigKey (esquema actual)' : 'EmailName como PK (esquema nuevo)'} · no hay duplicado`);

  if (r.estado === 'rechazada') {
    L.push('');
    for (const e of r.errores) L.push('✗ ' + v(e));
    for (const a of r.avisos) L.push('⚠️  ' + v(a));
    L.push(`\nNo se escribió nada${s ? '' : ' (y ni se consultó _Job: el rechazo no lo necesitaba)'}.`);
    return fin(1);
  }
  L.push(`\n${r.estado === 'simulacro' ? 'Fila que SE INSERTARÍA' : 'Fila insertada'}:`);
  L.push(...lineasDeFila(r));
  L.push('');
  for (const a of r.avisos) L.push('⚠️  ' + v(a));

  if (r.estado === 'simulacro') { L.push('\nSIMULACRO: no se escribió nada. Si todo está bien, repite el MISMO comando agregando --escribir.'); return fin(0); }
  if (r.estado === 'escrita') L.push('\n✓ Insertada y VERIFICADA: se releyó la fila y todos los campos coinciden.');
  else if (r.estado === 'escrita-con-diferencias') { L.push('\n✗ Se insertó, pero al releerla hay diferencias:'); for (const d of r.diferencias) L.push(`   ${v(d.campo)}: esperado ${v(JSON.stringify(d.esperado))} · leído ${v(JSON.stringify(d.real))}`); }
  else L.push('\n✗ SFMC dijo OK pero no pude releer la fila para verificarla: revísala a mano en el catálogo.');
  if (r.estado === 'escrita') { L.push('\nSiguiente:'); L.push(...pasosSiguientes(r.fila.EmailName, { journey: !!r.sondeo.journeyId })); }
  return fin(r.estado === 'escrita' ? 0 : 1);
}

module.exports = { ErrorAlta, POR_DEFINIR, TIPOS, CAMPOS_SONDEO, sinAst, normalizar, esPorDefinir, indiceDe, clasificarValor, cercanos, buDominante, validarDimensiones,
  derivarCodigoNC, buscarDuplicado, parecidos, construirSondeoSql, sondear, planificarAlta, escribirFila, pasosSiguientes, formatearResultado, agregarPieza };
