'use strict';
// FOTO de la arquitectura del reporte (SOLO LECTURA): las DEs (campos, PK, filas), las queries (con su SQL COMPLETO) y la automation
// (pasos y programacion). Sirve para tres cosas:
//   1. RESPALDO antes de tocar algo (la migracion a EmailName como PK necesita el SQL y los esquemas originales para poder volver atras).
//   2. DETECTAR CAMBIOS: alguien edito una query, agrego un campo o pauso la automation.
//   3. DOCUMENTAR el estado real (los docs del kit citan esta foto, no la memoria de nadie).
// El formato es un superconjunto del de la foto E0 del 2-oct-2026 (hecha por un script aparte): asi se pueden comparar.
// 🔴 Sin secretos: solo nombres, IDs, esquemas y SQL. Nunca credenciales ni tokens.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const D = require('./de');
const { redact, errorDeArchivoSeguro } = require('./credenciales');
const { exigirEscrituraSegura } = require('./paths');
const { ROLES_DE, ROLES_QUERY } = require('./config');

const FORMATO = 1;
const norm = (s) => String(s == null ? '' : s).replace(/\r\n/g, '\n').trim();
const sha = (s) => crypto.createHash('sha256').update(norm(s)).digest('hex');
const nulo = (v) => (v === undefined || v === '' || v === 0 ? null : v);

// Los DATOS que NO se recalculan solos: el catalogo y el mapa de audiencias. Detalle, Piezas, Auditoria y Links las reconstruyen sus queries.
// Con `conDatos` la foto los incluye: es el respaldo que necesita una migracion (recrear tablas) para poder volver atras o cargar las nuevas.
const TABLAS_DE_DATOS = ['catalogo', 'audiencias'];

/** Foto en vivo. opts: { conFilas = true, conDatos = false }. Solo hace GET y Retrieve. */
async function capturar(cli, cfg, { conFilas = true, conDatos = false } = {}) {
  await cli.token();
  const snap = { formato: FORMATO, capturado: new Date(cli.ahora()).toISOString(), mid: String(cli.mid), roles: { des: {}, queries: {} }, des: {}, queries: {}, automation: null };

  for (const rol of ROLES_DE) {
    const nombre = cfg.des[rol].nombre; const info = await D.infoDe(cli, nombre); const cols = await D.columnas(cli, nombre);
    const pk = cols.filter(c => c.pk).map(c => c.name);
    snap.roles.des[rol] = nombre;
    snap.des[nombre] = { rol, key: info.key, categoryId: String(info.categoryId), creada: info.creada,
      campos: cols.map(c => ({ name: c.name, type: c.type, length: c.length, ordinal: c.ordinal, pk: c.pk, required: c.required })), pk,
      filas: conFilas && pk.length ? (await D.leerFilas(cli, nombre, [pk[0]])).length : null };
  }

  const a = await cli.restOk(`/automation/v1/automations/${cfg.automation.id}`);
  const enAutomation = new Set((a.json.steps || []).flatMap(s => (s.activities || []).map(x => String(x.activityObjectId).toLowerCase())));
  for (const rol of ROLES_QUERY) {
    const q = cfg.queries[rol]; const r = await cli.restOk(`/automation/v1/queries/${q.id}`); const j = r.json;
    snap.roles.queries[rol] = j.name;
    snap.queries[j.name] = { rol, id: j.queryDefinitionId, key: j.key, name: j.name, categoryId: j.categoryId, targetName: j.targetName, targetKey: j.targetKey,
      targetUpdateTypeId: j.targetUpdateTypeId, targetUpdateTypeName: j.targetUpdateTypeName || null, modificada: j.modifiedDate || null,
      sqlLen: String(j.queryText || '').length, sha256: sha(j.queryText), queryText: String(j.queryText || ''), enRutinaDeAutomation: enAutomation.has(String(j.queryDefinitionId).toLowerCase()) };
  }
  const j = a.json;
  snap.automation = { id: j.id, name: j.name, status: j.status, statusId: j.statusId, typeId: j.typeId, lastRunTime: j.lastRunTime || null, schedule: j.schedule || null, steps: j.steps || [] };
  if (conDatos) {
    snap.datos = {};
    for (const rol of TABLAS_DE_DATOS) {
      const nombre = cfg.des[rol].nombre; const columnas = snap.des[nombre].campos.map(c => c.name);
      const filas = await D.leerFilas(cli, nombre, columnas);
      if (filas.truncado) throw new Error(`No pude leer completa la tabla ${nombre} (demasiadas filas): el respaldo quedaría incompleto.`);
      snap.datos[rol] = { nombre, columnas, pk: snap.des[nombre].pk, filas: [...filas] };
    }
  }
  return snap;
}

// ---------- comparar ----------
// Estructural = cambia como funciona el pipeline. Informativo = cambia con el uso diario (filas, fechas) y NO es una alerta.
const CAMPOS_SCHEDULE = ['typeId', 'startDate', 'endDate', 'rangeTypeId', 'pattern', 'icalRecur', 'timezoneName', 'scheduleStatus'];
const campoTxt = (c) => `${c.name} (${c.type}${nulo(c.length) ? ' ' + c.length : ''}${c.pk ? ', PK' : ''})`;
const pasosDe = (snap) => ((snap.automation && snap.automation.steps) || []).map(s => (s.activities || []).map(x => x.name).sort());

function compararSnapshots(a, b) {
  const est = [], inf = [];
  const E = (objeto, cambio, antes, despues) => est.push({ nivel: 'estructural', objeto, cambio, ...(antes !== undefined ? { antes } : {}), ...(despues !== undefined ? { despues } : {}) });
  const I = (objeto, cambio, antes, despues) => inf.push({ nivel: 'informativo', objeto, cambio, ...(antes !== undefined ? { antes } : {}), ...(despues !== undefined ? { despues } : {}) });
  if (String(a.mid) !== String(b.mid)) E('BU', `MID distinto: ${a.mid} -> ${b.mid} (¿son de BUs diferentes?)`);

  // --- DEs ---
  for (const n of Object.keys(a.des)) if (!b.des[n]) E(`DE ${n}`, 'DESAPARECIO (estaba en la foto A)');
  for (const n of Object.keys(b.des)) if (!a.des[n]) E(`DE ${n}`, 'NUEVA (no estaba en la foto A)');
  for (const n of Object.keys(a.des)) {
    const x = a.des[n], y = b.des[n]; if (!y) continue; const o = `DE ${n}`;
    if (String(x.key).toUpperCase() !== String(y.key).toUpperCase()) E(o, 'cambio su CustomerKey: la DE fue RECREADA', x.key, y.key);
    if (String(x.categoryId) !== String(y.categoryId)) E(o, 'cambio de carpeta', x.categoryId, y.categoryId);
    if (JSON.stringify(x.pk) !== JSON.stringify(y.pk)) E(o, `cambio la llave primaria: [${x.pk}] -> [${y.pk}]`);
    const fa = new Map(x.campos.map(c => [c.name, c])), fb = new Map(y.campos.map(c => [c.name, c]));
    for (const [nm, c] of fa) if (!fb.has(nm)) E(o, `campo QUITADO: ${campoTxt(c)}`);
    for (const [nm, c] of fb) if (!fa.has(nm)) E(o, `campo AGREGADO: ${campoTxt(c)}`);
    for (const [nm, c] of fa) {
      const d = fb.get(nm); if (!d) continue;
      if (c.type !== d.type) E(o, `campo ${nm}: cambio de tipo ${c.type} -> ${d.type}`);
      if (nulo(c.length) !== nulo(d.length)) E(o, `campo ${nm}: cambio de largo ${nulo(c.length)} -> ${nulo(d.length)}`);
      if (!!c.pk !== !!d.pk) E(o, `campo ${nm}: ${d.pk ? 'ahora ES' : 'dejo de ser'} llave primaria`);
      if (Number(c.ordinal) !== Number(d.ordinal)) I(o, `campo ${nm}: cambio de posicion ${c.ordinal} -> ${d.ordinal}`);
    }
    if (x.filas != null && y.filas != null && x.filas !== y.filas) I(o, `filas ${x.filas} -> ${y.filas}`, x.filas, y.filas);
  }

  // --- queries ---
  for (const n of Object.keys(a.queries)) if (!b.queries[n]) E(`query ${n}`, 'DESAPARECIO (¿se borro o se renombro?)');
  for (const n of Object.keys(b.queries)) if (!a.queries[n]) E(`query ${n}`, 'NUEVA (no estaba en la foto A)');
  for (const n of Object.keys(a.queries)) {
    const x = a.queries[n], y = b.queries[n]; if (!y) continue; const o = `query ${n}`;
    if (String(x.id).toLowerCase() !== String(y.id).toLowerCase()) E(o, 'cambio su ID: la query fue RECREADA', x.id, y.id);
    if (x.targetName !== y.targetName) E(o, `cambio su DE destino: ${x.targetName} -> ${y.targetName}`);
    if (Number(x.targetUpdateTypeId) !== Number(y.targetUpdateTypeId)) E(o, `cambio su tipo de actualizacion: ${x.targetUpdateTypeId} -> ${y.targetUpdateTypeId} (0 Overwrite, 1 Update)`);
    const hx = x.sha256 || sha(x.queryText), hy = y.sha256 || sha(y.queryText);
    if (hx !== hy) {
      const la = norm(x.queryText).split('\n'), lb = norm(y.queryText).split('\n'); let i = 0; while (i < la.length && i < lb.length && la[i] === lb[i]) i++;
      E(o, `el SQL CAMBIO (${x.sqlLen} -> ${y.sqlLen} caracteres; primera diferencia en la linea ${i + 1})`, (la[i] || '').trim().slice(0, 120), (lb[i] || '').trim().slice(0, 120));
    }
    if (!!x.enRutinaDeAutomation !== !!y.enRutinaDeAutomation) E(o, y.enRutinaDeAutomation ? 'ahora ESTA en la automation' : 'YA NO esta en la automation');
  }

  // --- automation ---
  const A = a.automation, B = b.automation;
  if (A && B) {
    if (A.name !== B.name) E('automation', `cambio su nombre: ${A.name} -> ${B.name}`);
    if (String(A.id).toLowerCase() !== String(B.id).toLowerCase()) E('automation', 'cambio su ID: fue RECREADA', A.id, B.id);
    if (JSON.stringify(pasosDe(a)) !== JSON.stringify(pasosDe(b))) E('automation', 'cambiaron sus PASOS', JSON.stringify(pasosDe(a)), JSON.stringify(pasosDe(b)));
    for (const c of CAMPOS_SCHEDULE) if (JSON.stringify((A.schedule || {})[c]) !== JSON.stringify((B.schedule || {})[c])) E('automation', `programacion: cambio ${c}`, (A.schedule || {})[c], (B.schedule || {})[c]);
    if (A.statusId !== B.statusId) I('automation', `estado ${A.status} (${A.statusId}) -> ${B.status} (${B.statusId})`, A.statusId, B.statusId);
    if (A.lastRunTime !== B.lastRunTime) I('automation', `ultima corrida ${A.lastRunTime} -> ${B.lastRunTime}`);
  } else if (A || B) E('automation', A ? 'DESAPARECIO' : 'NUEVA');
  compararDatos(a, b, E, I);
  return { identica: !est.length, estructurales: est, informativas: inf };
}

// Columnas que cambian solas con el uso (no cuentan como "fila cambiada").
const VOLATILES = new Set(['Audience_Volume', 'LastRefresh', 'LastRun']);
/**
 * Compara las filas respaldadas (solo si AMBAS fotos traen `datos`), por EmailName cuando existe en las dos (asi se puede cruzar una foto
 * de ANTES y otra de DESPUES de migrar la llave) y solo sobre las columnas comunes. Una fila que desaparecio es estructural: perder datos nunca es "uso normal".
 */
function compararDatos(a, b, E, I) {
  if (!a.datos || !b.datos) return;
  for (const rol of Object.keys(a.datos)) {
    const x = a.datos[rol], y = b.datos[rol]; if (!y) continue; const o = `datos ${x.nombre}`;
    const clave = x.columnas.includes('EmailName') && y.columnas.includes('EmailName') ? 'EmailName' : (JSON.stringify(x.pk) === JSON.stringify(y.pk) ? x.pk[0] : null);
    if (!clave) { I(o, 'la llave cambio y la tabla no trae EmailName: no se compara fila a fila'); continue; }
    const comunes = x.columnas.filter(c => y.columnas.includes(c) && !VOLATILES.has(c));
    const por = (t) => new Map(t.filas.map(f => [String(f[clave]).trim(), f]));
    const ma = por(x), mb = por(y);
    const desaparecidas = [...ma.keys()].filter(k => !mb.has(k)), nuevas = [...mb.keys()].filter(k => !ma.has(k)), cambiadas = [];
    for (const [k, fa] of ma) { const fb = mb.get(k); if (!fb) continue; const dif = comunes.filter(c => String(fa[c] == null ? '' : fa[c]).trim() !== String(fb[c] == null ? '' : fb[c]).trim()); if (dif.length) cambiadas.push({ k, dif }); }
    I(o, `${x.filas.length} -> ${y.filas.length} filas · ${desaparecidas.length} desaparecidas · ${cambiadas.length} cambiadas · ${nuevas.length} nuevas (sobre ${comunes.length} columnas comunes)`);
    if (desaparecidas.length) E(o, `${desaparecidas.length} fila(s) DESAPARECIERON (${desaparecidas.slice(0, 3).map(k => '…' + k.slice(-40)).join(' | ')}${desaparecidas.length > 3 ? ' …' : ''})`);
    for (const c of cambiadas.slice(0, 5)) I(o, `fila cambiada …${c.k.slice(-35)}: ${c.dif.join(', ')}`);
  }
}

function formatearDiferencias(d) {
  const L = [];
  L.push(d.identica ? '✓ La ESTRUCTURA es idéntica (DEs, queries y automation).' : `✗ ${d.estructurales.length} diferencia(s) ESTRUCTURAL(ES):`);
  for (const x of d.estructurales) { L.push(`  ✗ ${x.objeto}: ${x.cambio}`); if (x.antes !== undefined || x.despues !== undefined) L.push(`      antes:   ${x.antes}\n      después: ${x.despues}`); }
  if (d.informativas.length) { L.push(`\n${d.informativas.length} cambio(s) informativo(s) (uso normal, no son alerta):`); for (const x of d.informativas) L.push(`  · ${x.objeto}: ${x.cambio}`); }
  return L.join('\n');
}

/** ¿Algo de la foto tiene forma de secreto o de token? (nunca deberia: solo lleva nombres, IDs, esquemas y SQL). */
function contieneSecreto(snap) { const t = JSON.stringify(snap); return redact(t) !== t; }

/**
 * Guarda la foto en disco (UNICO sitio donde el kit escribe fotos). Se niega si algo parece un secreto y si la ruta es una de
 * credenciales o un archivo ajeno (paths.exigirEscrituraSegura). Devuelve { ruta, bytes }.
 */
function guardarFoto(snap, ruta) {
  if (contieneSecreto(snap)) throw new Error('La foto contiene algo con forma de secreto: no se escribió (revisa qué objeto lo trae).');
  const destino = exigirEscrituraSegura(ruta, 'foto');
  const texto = JSON.stringify(snap, null, 2);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, texto, 'utf8');
  return { ruta: destino, bytes: Buffer.byteLength(texto) };
}

/** Lee una foto del disco y la normaliza. Si el archivo no es JSON, lo dice SIN repetir su contenido (podria ser un archivo de credenciales). */
function leerFotoArchivo(ruta, { existe = fs.existsSync, leer = (p) => fs.readFileSync(p, 'utf8') } = {}) {
  if (!existe(ruta)) throw new Error(`No existe la foto: ${ruta}`);
  try { return normalizar(JSON.parse(String(leer(ruta)).replace(new RegExp('^' + String.fromCharCode(0xFEFF)), ''))); }
  catch (e) { throw new Error(`No pude leer ${ruta} como foto: ${errorDeArchivoSeguro(e)}`); }
}

/** Adapta la foto E0 (formato sin "roles" ni "sha256") para compararla: calcula lo que le falta. */
function normalizar(snap) {
  const s = JSON.parse(JSON.stringify(snap));
  for (const q of Object.values(s.queries || {})) { if (!q.sha256) q.sha256 = sha(q.queryText); if (q.sqlLen == null) q.sqlLen = String(q.queryText || '').length; }
  return s;
}

module.exports = { FORMATO, TABLAS_DE_DATOS, sha, capturar, compararSnapshots, formatearDiferencias, contieneSecreto, guardarFoto, leerFotoArchivo, normalizar, pasosDe };
