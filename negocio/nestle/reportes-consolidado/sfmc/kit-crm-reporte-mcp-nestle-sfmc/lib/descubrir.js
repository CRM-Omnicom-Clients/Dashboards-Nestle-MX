'use strict';
// Descubre los IDs de los objetos del reporte POR NOMBRE en la BU conectada. SOLO LECTURA (usa un cliente sin guardia de
// escritura). Devuelve una config nueva (clon de `base` con key/id/carpetas/mid llenos) + el reporte de lo hallado.
const { infoDe } = require('./de');
const { ROLES_DE, ROLES_QUERY, completarConEjemplo } = require('./config');

const unico = (xs) => [...new Set(xs)];
// Texto fijo (sin fecha: asi correr descubrir dos veces da EXACTAMENTE el mismo archivo).
const NOTA_GENERADA = 'Generada por scripts/descubrir.js; no lleva credenciales. Los key/id los escribe ese script: no los edites a mano — si algo cambia en SFMC, vuelve a correrlo.';

async function descubrir({ cli, base, log = () => {} }) {
  // Una config de una version anterior del kit recibe los campos nuevos de la plantilla (nunca pisa los suyos): asi "volver a correr descubrir" es el camino de actualizacion.
  const { cfg, agregados } = completarConEjemplo(base);
  const faltan = [], avisos = [], cambios = [];
  const poner = (obj, campo, valor, etiqueta) => {
    const antes = obj[campo];
    if (String(antes) !== String(valor)) { cambios.push(`${etiqueta}: ${antes == null ? '(vacío)' : antes} → ${valor}`); obj[campo] = valor; }
  };

  // --- BU ---
  await cli.token();
  cfg.bu = cfg.bu || {};
  if (cfg.bu.mid && String(cfg.bu.mid) !== String(cli.mid)) avisos.push(`El MID de la config (${cfg.bu.mid}) NO coincide con el del token (${cli.mid}): ¿te conectaste a otra BU? Se actualiza al del token.`);
  poner(cfg.bu, 'mid', String(cli.mid), 'bu.mid');

  // --- DEs (SOAP por nombre) ---
  log('  DEs…');
  const carpetasDe = [];
  for (const rol of ROLES_DE) {
    const d = cfg.des[rol];
    try { const info = await infoDe(cli, d.nombre); poner(d, 'key', info.key, `des.${rol}.key`); carpetasDe.push({ rol, id: Number(info.categoryId) }); }
    catch (e) { faltan.push(`DE ${rol}: "${d.nombre}" no existe en esta BU`); }
  }

  // --- queries (REST, lista paginada) ---
  log('  queries (lista completa de la BU)…');
  const todas = await cli.paginar('/automation/v1/queries');
  const idPorRol = {};
  const carpetasQ = [];
  for (const rol of ROLES_QUERY) {
    const q = cfg.queries[rol];
    const hits = todas.filter(x => x.name === q.nombre);
    if (!hits.length) { faltan.push(`query ${rol}: "${q.nombre}" no existe en esta BU`); continue; }
    if (hits.length > 1) { faltan.push(`query ${rol}: "${q.nombre}" está DUPLICADA (${hits.map(h => h.queryDefinitionId).join(', ')}); renombra o borra la sobrante`); continue; }
    poner(q, 'id', hits[0].queryDefinitionId, `queries.${rol}.id`);
    idPorRol[hits[0].queryDefinitionId.toLowerCase()] = rol;
    if (hits[0].categoryId != null) carpetasQ.push({ rol, id: Number(hits[0].categoryId) });
  }

  // --- automation (REST, lista paginada) ---
  log('  automation (lista completa de la BU)…');
  const a = cfg.automation;
  const autos = (await cli.paginar('/automation/v1/automations')).filter(x => x.name === a.nombre);
  if (!autos.length) faltan.push(`automation: "${a.nombre}" no existe en esta BU`);
  else if (autos.length > 1) faltan.push(`automation: "${a.nombre}" está DUPLICADA (${autos.map(x => x.id).join(', ')})`);
  else {
    poner(a, 'id', autos[0].id, 'automation.id');
    const det = await cli.restOk(`/automation/v1/automations/${autos[0].id}`);
    const reales = (det.json.steps || []).map(s => (s.activities || []).map(x => idPorRol[String(x.activityObjectId).toLowerCase()] || `?${x.name}`).sort());
    const esperados = a.pasosEsperados.map(p => [...p].sort());
    if (JSON.stringify(reales) !== JSON.stringify(esperados)) avisos.push(`Los pasos de la automation no son los esperados.\n    esperados: ${JSON.stringify(a.pasosEsperados)}\n    reales   : ${JSON.stringify(reales)}`);
  }

  // --- carpetas (categoryId) ---
  const carpeta = (lista, preferido, etiqueta) => {
    if (!lista.length) return null;
    const ids = unico(lista.map(x => x.id));
    if (ids.length > 1) avisos.push(`${etiqueta}: los objetos están en carpetas distintas (${lista.map(x => x.rol + '=' + x.id).join(', ')}); se usa la de "${preferido}" para crear temporales`);
    return (lista.find(x => x.rol === preferido) || lista[0]).id;
  };
  const cDe = carpeta(carpetasDe, 'catalogo', 'DEs'), cQ = carpeta(carpetasQ, 'vol', 'queries');
  cfg.carpetas = cfg.carpetas || {};
  if (cDe != null) poner(cfg.carpetas, 'de', cDe, 'carpetas.de');
  if (cQ != null) poner(cfg.carpetas, 'query', cQ, 'carpetas.query');

  cfg._comentario = NOTA_GENERADA;
  return { cfg, faltan, avisos, cambios, agregados, completo: faltan.length === 0 };
}

module.exports = { descubrir };
