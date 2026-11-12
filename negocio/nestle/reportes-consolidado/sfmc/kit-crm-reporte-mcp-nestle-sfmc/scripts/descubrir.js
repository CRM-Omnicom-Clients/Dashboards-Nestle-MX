#!/usr/bin/env node
'use strict';
const { parseArgs, contexto, ejecutar } = require('../lib/cli');
const { jsonSeguro } = require('../lib/textoseguro');
const { descubrir } = require('../lib/descubrir');
const { guardarConfig } = require('../lib/config');
const { exigirEscrituraSegura } = require('../lib/paths');

const AYUDA = `descubrir.js — encuentra los IDs de los objetos del reporte en TU BU y genera la config local (pipeline.config.json)

Uso:  node scripts/descubrir.js [--dry-run] [--parcial] [--json] [--out <ruta>]

  --dry-run   muestra lo que haría; no escribe nada
  --parcial   guarda la config aunque falten objetos (por defecto solo se guarda si está completa)
  --json      salida legible por máquina
  --out       config a leer/escribir (por defecto <carpeta de estado local>/pipeline.config.json, o $SFMC_PIPELINE_CONFIG; nunca dentro de la carpeta del kit)

Solo LEE de SFMC (usa un cliente sin permiso de escritura). Lo único que escribe es el archivo de config local, FUERA de la carpeta del kit,
que no lleva secretos (al terminar imprime su ruta). Es idempotente: correrlo de nuevo solo actualiza lo que cambió.`;

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanos: ['dry-run', 'parcial', 'json', 'help'], ayuda: AYUDA });
  if (args.help) { console.log(AYUDA); return 0; }
  const ctx = await contexto({ soloLectura: true, exigirDescubierta: false, rutaConfigArg: args.out });
  if (!args['dry-run']) exigirEscrituraSegura(ctx.ruta, 'config');         // un destino prohibido se dice YA, antes de listar la BU entera
  const log = args.json ? () => {} : (m) => console.log(m);

  log('Conectando…');
  log('  credenciales: ' + ctx.vista.detalleFuente + ' · client ' + ctx.vista.clientId + ' · secret ' + ctx.vista.secret);
  const r = await descubrir({ cli: ctx.cli, base: ctx.base, log });

  let escrita = null;
  const guardar = !args['dry-run'] && (r.completo || args.parcial);
  if (guardar) escrita = guardarConfig(r.cfg, ctx.ruta);

  if (args.json) {
    console.log(jsonSeguro({ credenciales: ctx.vista, completo: r.completo, faltan: r.faltan, avisos: r.avisos, cambios: r.cambios, agregadosDePlantilla: r.agregados, escrita, config: r.cfg }));
    return r.completo ? 0 : 1;
  }
  console.log(`\nBU: MID ${r.cfg.bu.mid}   carpetas: DEs ${r.cfg.carpetas.de} · queries ${r.cfg.carpetas.query}`);
  console.log('\nDEs');
  for (const [rol, d] of Object.entries(r.cfg.des)) console.log(`  ${d.key ? '✓' : '✗'} ${rol.padEnd(11)} ${d.nombre.padEnd(24)} ${d.key || '— no encontrada'}`);
  console.log('\nQueries');
  for (const [rol, q] of Object.entries(r.cfg.queries)) console.log(`  ${q.id ? '✓' : '✗'} ${rol.padEnd(11)} ${q.nombre.padEnd(28)} ${q.id || '— no encontrada'}`);
  console.log(`\nAutomation\n  ${r.cfg.automation.id ? '✓' : '✗'} ${r.cfg.automation.nombre}  ${r.cfg.automation.id || '— no encontrada'}`);
  if (r.avisos.length) console.log('\nAvisos\n  ⚠️ ' + r.avisos.join('\n  ⚠️ '));
  if (r.faltan.length) console.log('\nFALTAN\n  ✗ ' + r.faltan.join('\n  ✗ '));
  console.log('\nCambios respecto a la config anterior: ' + (r.cambios.length ? '\n  ' + r.cambios.join('\n  ') : 'ninguno'));
  if (r.agregados.length) console.log('Campos nuevos de la plantilla agregados a tu config (con su valor por defecto): ' + r.agregados.join(', '));
  console.log('\n' + (escrita ? 'Config escrita: ' + escrita
    : args['dry-run'] ? '(dry-run: no se escribió nada)'
      : r.completo ? '' : 'NO se escribió la config porque faltan objetos (usa --parcial para guardarla igual).'));
  return r.completo ? 0 : 1;
}

ejecutar(main);
