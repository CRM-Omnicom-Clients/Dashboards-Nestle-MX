#!/usr/bin/env node
'use strict';
const { parseArgs, ejecutar, registrarCliente, salidaJson } = require('../lib/cli');
const { resolverCredenciales, inspeccionarFuentes, vistaSegura, ErrorCredenciales } = require('../lib/credenciales');
const { crearCliente } = require('../lib/sfmc');
const { cargarConfig, cargarEjemplo } = require('../lib/config');
const { instalarLimpiezaAlSalir } = require('../lib/de');
const { rutaConfig, dirEstado, restosLocalesEnElKit } = require('../lib/paths');
const { ejecutarChequeos, chequeoEstadoLocal } = require('../lib/doctor');

const AYUDA = `doctor.js — diagnóstico de tu instalación del pipeline de email (SFMC)

Uso:  node scripts/doctor.js [--limpiar-tmp [--min-edad <min>]] [--latencia] [--json]

Revisa: Node · credenciales · token y MID · scopes · config · objetos del reporte · esquema de las DEs ·
automation (estado, pasos, última corrida) · frescura de los datos · temporales huérfanos.
Por defecto es de SOLO LECTURA.

  --limpiar-tmp   borra los temporales huérfanos (CRM_Tmp_*) de corridas interrumpidas. Solo los que tengan
                  >= --min-edad minutos (entre 15 y 10080; 60 por defecto): uno más reciente puede ser de otro operador en curso.
                  Nunca toca los objetos del propio reporte, aunque su nombre empiece con el prefijo.
                  La edad usa la zona horaria de la cuenta, que se MIDE (no se supone).
  --latencia      mide cuánto tarda el motor de queries con una consulta trivial (crea y borra una DE+query temporales)
  --json          salida legible por máquina

Código de salida: 0 si no hay ✗ (los ⚠️ no lo cambian) · 1 si algo falla.`;

const ICONO = { ok: '✓', aviso: '⚠️ ', falla: '✗', omitido: '–' };

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanos: ['limpiar-tmp', 'latencia', 'json', 'help'], ayuda: AYUDA });
  if (args.help) { console.log(AYUDA); return 0; }

  const estadoLocal = { dir: dirEstado(), restos: restosLocalesEnElKit() };       // ¿hay config, fotos o credenciales DENTRO de la carpeta del kit?
  let cfg = null, errorCfg = null;
  try { cfg = cargarConfig(); } catch (e) { errorCfg = e.message; }
  const base = cfg || cargarEjemplo();

  const mcpServerName = base.mcpServerName || 'sfmc-nestle';
  let cred;
  try { cred = resolverCredenciales({ mcpServerName }); }
  catch (e) {
    if (!(e instanceof ErrorCredenciales)) throw e;
    const res = [{ id: 'credenciales', estado: 'falla', titulo: 'Credenciales', detalle: e.message }, chequeoEstadoLocal(estadoLocal)];
    imprimir(res, args.json); return 1;
  }

  const cli = registrarCliente(crearCliente({ cred }));                         // lectura: sin guardia de escritura
  const cliW = cfg ? registrarCliente(crearCliente({ cred, cfg })) : null;       // escribe SOLO temporales (limpiar/latencia)
  if (cliW) instalarLimpiezaAlSalir(cliW);

  const res = await ejecutarChequeos({ cred, cli, cliW, cfg, errorCfg, vista: vistaSegura(cred), estadoLocal,
    fuentes: inspeccionarFuentes({ mcpServerName }), forzada: process.env.SFMC_FUENTE || null,
    opciones: { limpiarTmp: !!args['limpiar-tmp'], minEdad: args['min-edad'], latencia: !!args.latencia } });
  imprimir(res, args.json);
  return res.some(x => x.estado === 'falla') ? 1 : 0;
}

function imprimir(res, json) {
  if (json) { console.log(salidaJson({ resultados: res, fallas: res.filter(x => x.estado === 'falla').length, avisos: res.filter(x => x.estado === 'aviso').length })); return; }
  console.log(`\nDiagnóstico del pipeline — config: ${rutaConfig()}\n`);
  for (const x of res) {
    const [primera, ...resto] = String(x.detalle).split('\n');
    console.log(` ${ICONO[x.estado]} ${x.titulo.padEnd(34)} ${primera}`);
    for (const l of resto) console.log(`   ${' '.repeat(34)} ${l.trim()}`);
  }
  const f = res.filter(x => x.estado === 'falla').length, a = res.filter(x => x.estado === 'aviso').length;
  console.log(`\n${f ? '✗ ' + f + ' falla(s)' : '✓ sin fallas'}${a ? ' · ⚠️  ' + a + ' aviso(s)' : ''}\n`);
}

ejecutar(main);
