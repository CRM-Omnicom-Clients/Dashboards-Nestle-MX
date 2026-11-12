'use strict';
// Diagnostico de la CONEXION: que fuentes de credenciales hay, cuales FUNCIONAN (token real) y cual usaran los demas scripts.
// SIN efectos: no escribe ningun archivo (ni conexion.txt ni ~/.claude.json); solo pide tokens. Nunca imprime el secret.
const { inspeccionarFuentes, analizarFuentes, resolverCredenciales, redact } = require('./credenciales');
const { clasificarScopes } = require('./scopes');

/** Pide un token con cada fuente utilizable y junta lo que se aprende (MID, scopes) o el motivo del fallo. */
async function probarFuentes(fuentes, opts, crear) {
  const out = [];
  for (const f of fuentes) {
    if (f.estado !== 'ok') { out.push({ ...f, token: null }); continue; }
    let cred;
    try { cred = resolverCredenciales({ ...opts, fuente: f.fuente }); }
    catch (e) { out.push({ ...f, estado: 'incompleta', detalle: e.message, token: null }); continue; }
    const cli = crear(cred);
    try {
      await cli.token();
      out.push({ ...f, token: { ok: true, mid: String(cli.mid), midDeclarado: !!cred.accountId, scopes: cli.scopes, ...clasificarScopes(cli.scopes) } });
    } catch (e) {
      out.push({ ...f, token: { ok: false, error: redact(e.message, [cred.clientSecret]) } });
    } finally { try { cli.cerrar(); } catch { /* ya cerrado */ } }
  }
  return out;
}

/** Con los resultados ya probados: funciona o no, por que, y que hacer. Pura. */
function veredicto(resultados, { forzada = null } = {}) {
  // Aqui SI se sabe que token funciona, asi que la ambiguedad se redacta con eso; las incompletas ya salen en la linea de su fuente.
  const { activa } = analizarFuentes(resultados, { forzada });
  const consejos = [], avisos = [];
  let funciona = false, problema = null;
  const alternativa = (excepto) => resultados.find(r => r !== excepto && r.token && r.token.ok);
  if (!activa || activa.estado !== 'ok') {
    problema = forzada ? `SFMC_FUENTE=${forzada}, pero esa fuente no tiene credenciales utilizables` : 'ninguna fuente tiene credenciales utilizables';
    const alt = alternativa(activa);
    if (alt) consejos.push(`${alt.fuente} sí funciona: quita SFMC_FUENTE para que los scripts la usen.`);
  } else if (!activa.token.ok) {
    problema = `los scripts usarán "${activa.fuente}" y esa fuente NO obtiene token`;
    const alt = alternativa(activa);
    if (alt) consejos.push(`"${alt.fuente}" (client ${alt.clientId}) SÍ obtiene token. Para que los scripts la usen: SFMC_FUENTE=${alt.fuente} (PowerShell: $env:SFMC_FUENTE = "${alt.fuente}"), o corrige/borra las credenciales de "${activa.fuente}".`);
  } else if (activa.token.faltanRequeridos.length) {
    problema = `el package de "${activa.fuente}" conecta, pero le FALTAN scopes requeridos: ${activa.token.faltanRequeridos.join(', ')}`;
    consejos.push('Edita el Installed Package en SFMC (Setup → Apps → Installed Packages → tu package → API Integration → Edit) y marca esos scopes; el secret no cambia.');
  } else funciona = true;

  if (!forzada) {
    const conectan = resultados.filter(r => r.token && r.token.ok);
    if (new Set(conectan.map(r => r.clientId)).size > 1) {
      avisos.push(`Los packages de ${conectan.map(r => `${r.fuente} (client ${r.clientId})`).join(' y ')} conectan, pero son DISTINTOS. ` +
        `Los scripts usan "${activa.fuente}". Si querías usar otro, fuérzalo con SFMC_FUENTE=<fuente>.`);
    }
    if (activa && activa.token && activa.token.ok) {
      for (const r of resultados.filter(x => x !== activa && x.token && !x.token.ok)) {
        avisos.push(`"${r.fuente}" tiene un package (client ${r.clientId}) que ya NO conecta. Hoy no estorba porque los scripts usan "${activa.fuente}", ` +
          'pero está desactualizado: pega ahí el package vigente o bórralo, para que nadie se confunda.');
      }
    }
  }
  return { activa: activa ? activa.fuente : null, funciona, problema, avisos, consejos };
}

/**
 * Entrada unica. opts se reenvia a credenciales (env, home, plataforma, mcpServerName, leerArchivo, existe).
 * crear(cred) => cliente (inyectable en pruebas; en los scripts es crearCliente sin guardia = solo lectura).
 */
async function diagnosticarConexion(opts, crear) {
  const env = (opts && opts.env) || process.env;
  const forzada = (opts && opts.fuente) || env.SFMC_FUENTE || null;
  const resultados = await probarFuentes(inspeccionarFuentes(opts), opts, crear);
  return { forzada, resultados, ...veredicto(resultados, { forzada }) };
}

module.exports = { probarFuentes, veredicto, diagnosticarConexion };
