#!/usr/bin/env node
'use strict';
const { parseArgs, contexto, ejecutar, salidaJson } = require('../lib/cli');
const { paraMostrar: v } = require('../lib/textoseguro');           // todo lo que viene de SFMC (nombres, DEs, motivos) se imprime por v()
const { mapearAudiencias } = require('../lib/audiencias');

const AYUDA = `audiencias.js — mapea la AUDIENCIA de las piezas con journey (journey → DE de entrada → volumen) y deja lista la query Vol

Uso:  node scripts/audiencias.js --pendientes                          [--escribir] [--json]
      node scripts/audiencias.js --email-name "<EXACTO>" [--email-name "<otra>"] [--journey-uuid <uuid>] [--escribir] [--json]

Por qué: la query Vol (CRM_Audiencias_Vol_Load) trae escrita a mano la lista de DEs de audiencia que cuenta. Una pieza cuyo journey
no está mapeado sale con Audience_Volume = 0 en el reporte. Esto resuelve cada journey con la API de Journey Builder, cuenta su DE,
registra la fila en CRM_Audiencias y agrega la DE nueva al SQL de Vol.

  --pendientes       todas las piezas ACTIVAS del catálogo con journey y sin fila (o sin DE) en CRM_Audiencias
  --email-name       una pieza concreta (el EmailName EXACTO de _Job); se puede repetir
  --journey-uuid     fuerza el journey de UNA pieza (por defecto sale de la DE Piezas: refresca la pieza antes si es nueva)
  --escribir         APLICA los cambios. Sin esto es SIMULACRO: lee, cuenta y valida, pero no escribe nada
  --sin-validar      no ejecuta el SQL nuevo de Vol en una query temporal antes de proponerlo (no recomendado)
  --json             salida legible por máquina

Seguridad: con --escribir solo toca filas de CRM_Audiencias y el SQL de la query Vol — y ese SQL SOLO después de ejecutarlo con éxito
en una query temporal; si SFMC lo guarda distinto, restaura el anterior. Necesita el scope journeys_read.
Código de salida: 0 simulacro válido / aplicado y verificado / nada pendiente · 1 error o aplicado a medias · 3 rechazado (pieza fuera del catálogo o SQL que no valida).`;

const num = (v) => (v == null ? '—' : Number(v).toLocaleString('es-MX'));

function imprimir(r) {
  console.log('');
  if (r.estado === 'rechazado') { console.log('✗ ' + v(r.motivo)); return 3; }
  if (r.sinJourney.length) { console.log('Sin journey en la DE Piezas (¿aún no se refresca? corre scripts/refrescar-pieza.js, o usa --journey-uuid):'); for (const n of r.sinJourney) console.log('  · ' + v(n)); console.log(''); }
  if (r.estado === 'nada') {
    console.log(`✓ Nada pendiente: ${r.yaMapeadas.length} pieza(s) activa(s) con journey ya tienen su audiencia${r.unicoEnvio ? ` · ${r.unicoEnvio} envío(s) sin journey (no aplica)` : ''}.`);
    return 0;
  }
  console.log(`Audiencias: ${r.filasAudiencias} filas · piezas a mapear: ${r.objetivos.length}${r.yaMapeadas.length ? ` · ya mapeadas: ${r.yaMapeadas.length}` : ''}${r.unicoEnvio ? ` · envíos sin journey: ${r.unicoEnvio}` : ''}\n`);
  const ETQ = { nueva: '✚ NUEVA', actualiza: '✎ ACTUALIZA', igual: '= igual' };
  for (const f of r.filas) {
    console.log(`${ETQ[f.accion].padEnd(12)} ${v(f.emailName.slice(-62))}`);
    console.log(`             journey ${v(f.journeyUUID)}`);
    console.log(`             DE: ${v(f.deNombre)} · volumen ${num(f.volumen)}${f.antes ? ` (antes: ${v(f.antes.Audience_DE || '(sin DE)')} · ${num(f.antes.Audience_Volume)})` : ''}`);
  }
  if (r.problemas.length) { console.log('\nNo se pudieron mapear:'); for (const p of r.problemas) console.log(`  ✗ ${v(p.emailName.slice(-62))} — ${v(p.motivo)}${p.deNombre ? ` ("${v(p.deNombre)}")` : ''}`); }
  for (const a of r.avisos) console.log('⚠️  ' + v(a));
  console.log(`\nQuery Vol: hoy cuenta ${r.enSqlAntes} DEs · ${r.desNuevas.length ? `se AGREGAN ${r.desNuevas.length}: ${r.desNuevas.map(v).join(' | ')}` : 'no hace falta cambiarla (todas las DEs ya están en su lista)'}`);
  if (r.validacion) console.log(r.validacion.ok ? `  ✓ el SQL nuevo se ejecutó bien en una query temporal (${r.validacion.filas} filas, ${r.validacion.segundos} s)` : `  ✗ el SQL nuevo NO validó: ${v(r.validacion.motivo)}`);
  if (r.estado === 'simulacro') { console.log('\nSIMULACRO: no se escribió nada. Para aplicarlo repite el mismo comando con --escribir.'); return 0; }
  console.log('');
  for (const e of r.escritas) console.log(`  ${e.verificada ? '✓' : '✗'} ${e.accion === 'nueva' ? 'fila nueva' : 'fila actualizada'}: ${v(e.emailName.slice(-58))}${e.verificada ? '' : ' — NO coincide al releerla'}`);
  if (r.vol) console.log(`  ${r.vol.ok ? '✓' : '✗'} query Vol ${r.vol.ok ? 'actualizada y verificada' : 'NO se pudo actualizar: ' + v(r.vol.motivo)}`);
  console.log(r.estado === 'aplicado' ? '\n✓ Aplicado. La query Vol ya cuenta las DEs nuevas en la próxima corrida de la automation.' : '\n✗ Aplicado A MEDIAS: revisa lo marcado con ✗.');
  return r.estado === 'aplicado' ? 0 : 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanos: ['pendientes', 'escribir', 'sin-validar', 'json', 'help'], ayuda: AYUDA });
  if (args.help) { console.log(AYUDA); return 0; }
  const emailNames = [].concat(args['email-name'] === undefined || args['email-name'] === true ? [] : args['email-name']).map(String);
  if (!args.pendientes && !emailNames.length) { console.log(AYUDA); return 1; }

  const { cli, cfg } = await contexto({ soloLectura: false });
  const log = args.json ? () => {} : (s) => console.error(s);
  if (!args.json) console.error(`${args.escribir ? 'MAPEANDO' : 'SIMULACRO de mapeo'} de audiencias …`);
  const r = await mapearAudiencias(cli, cfg, { emailNames, pendientes: !!args.pendientes, journeyUUID: args['journey-uuid'] === true ? null : args['journey-uuid'] || null, escribir: !!args.escribir, validarVol: !args['sin-validar'], log });
  const codigo = { nada: 0, simulacro: 0, aplicado: 0, rechazado: 3 }[r.estado] ?? 1;
  if (args.json) { console.log(salidaJson(r)); return codigo; }
  return imprimir(r);
}

ejecutar(main);
