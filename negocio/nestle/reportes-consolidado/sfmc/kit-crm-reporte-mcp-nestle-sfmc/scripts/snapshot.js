#!/usr/bin/env node
'use strict';
const path = require('path');
const { parseArgs, contexto, ejecutar, salidaJson } = require('../lib/cli');
const { jsonSeguro } = require('../lib/textoseguro');
const { dirFotos, resolverFoto, exigirEscrituraSegura } = require('../lib/paths');
const { fechaCuenta } = require('../lib/fechas');
const S = require('../lib/snapshot');

const AYUDA = `snapshot.js — foto de la arquitectura del reporte (SOLO LECTURA) y comparación entre fotos

Uso:  node scripts/snapshot.js [--out <archivo.json>] [--sin-filas] [--con-datos] [--json]   captura una foto en vivo
      node scripts/snapshot.js --comparar <a.json> [<b.json>] [--con-datos] [--json]       compara dos fotos (o <a> contra el estado en vivo)

La foto trae las 6 DEs (campos, llave primaria, nº de filas), las 5 queries (con su SQL COMPLETO) y la automation (pasos y programación).
Sin secretos: solo nombres, IDs, esquemas y SQL. Por defecto se guarda en la carpeta de estado local, FUERA de la carpeta del kit (la ruta exacta se imprime al guardar).

  --out          dónde guardarla (por defecto <carpeta de estado>/snapshot/snapshot-<fecha>-<mid>.json). Nunca dentro de la carpeta del kit
  --sin-filas    no cuenta las filas de cada DE (más rápido)
  --con-datos    incluye las FILAS del catálogo y de audiencias: es lo único que no se recalcula solo (Detalle, Piezas, Auditoría y
                 Links las reconstruyen sus queries). Es el respaldo que exige una migración. La foto trae datos del cliente: no se sube a git.
  --json         imprime el JSON en vez de guardarlo (con --comparar: el resultado de la comparación)
  --comparar     distingue cambios ESTRUCTURALES (un campo nuevo, un SQL distinto, una automation con otros pasos) de los
                 INFORMATIVOS (filas, fechas de corrida: uso diario normal). Acepta una ruta o solo el NOMBRE de una foto (la busca en la carpeta de fotos)

Para qué: respaldo ANTES de tocar algo (la migración a EmailName como PK necesita el SQL y los esquemas originales para poder volver atrás),
detectar que alguien editó una query o pausó la automation, y documentar el estado real.
Código de salida: 0 captura hecha / estructura idéntica · 1 error · 2 hay diferencias estructurales.`;

const leerFoto = (ruta) => S.leerFotoArchivo(ruta);

function resumen(snap, ruta, bytes) {
  const L = [`\nFoto de la arquitectura — MID ${snap.mid} · ${snap.capturado}\n`, '  DEs:'];
  for (const [n, d] of Object.entries(snap.des)) L.push(`    ${n.padEnd(24)} ${String(d.campos.length).padStart(2)} campos · PK ${d.pk.join(',') || '—'}${d.filas != null ? ' · ' + d.filas.toLocaleString('es-MX') + ' filas' : ''}`);
  L.push('  Queries:');
  for (const [n, q] of Object.entries(snap.queries)) L.push(`    ${n.padEnd(28)} → ${q.targetName} · ${q.targetUpdateTypeId === 1 ? 'Update' : q.targetUpdateTypeId === 0 ? 'Overwrite' : 'tipo ' + q.targetUpdateTypeId} · SQL ${q.sqlLen.toLocaleString('es-MX')} car. · ${q.sha256.slice(0, 10)}`);
  const a = snap.automation;
  L.push(`  Automation: ${a.name} · ${a.status} · ${a.schedule ? a.schedule.icalRecur + ' ' + (a.schedule.timezoneName || '') : 'sin programación'} · pasos: ${S.pasosDe(snap).map(p => '[' + p.join(' + ') + ']').join(' → ')}`);
  if (snap.datos) L.push(`  Datos respaldados: ${Object.values(snap.datos).map(d => `${d.nombre} ${d.filas.length} filas`).join(' · ')}`);
  if (ruta) L.push(`\nGuardada en: ${ruta} (${(bytes / 1024).toFixed(0)} KB)`);
  return L.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanos: ['sin-filas', 'con-datos', 'json', 'help'], ayuda: AYUDA });
  if (args.help) { console.log(AYUDA); return 0; }
  // Si el destino es una ruta prohibida (credenciales, ~/.claude.json, un archivo ajeno), se dice YA, no despues de 10 s de captura.
  if (args.comparar === undefined && typeof args.out === 'string') exigirEscrituraSegura(path.resolve(args.out), 'foto');
  const { cli, cfg } = await contexto({ soloLectura: true });          // cliente SIN guardia de escritura: no puede escribir nada
  if (!cfg) throw new Error('Falta la config de esta instalación: corre  node scripts/descubrir.js');
  const conFilas = !args['sin-filas']; const conDatos = !!args['con-datos'];

  if (args.comparar !== undefined) {
    const rutas = [].concat(args.comparar === true ? [] : args.comparar).concat(args._).map(String);
    if (!rutas.length || rutas.length > 2) { console.log(AYUDA); return 1; }
    const pa = resolverFoto(rutas[0]), pb = rutas[1] ? resolverFoto(rutas[1]) : null;
    const a = leerFoto(pa);
    const b = pb ? leerFoto(pb) : S.normalizar(await S.capturar(cli, cfg, { conFilas, conDatos }));
    const d = S.compararSnapshots(a, b);
    if (args.json) console.log(salidaJson(d));
    else { console.log(`\nComparando  A: ${pa} (${a.capturado})\n        con  B: ${pb || 'estado EN VIVO'} (${b.capturado})\n`); console.log(S.formatearDiferencias(d) + '\n'); }
    return d.identica ? 0 : 2;
  }

  const snap = await S.capturar(cli, cfg, { conFilas, conDatos });
  if (S.contieneSecreto(snap)) throw new Error('La foto contiene algo con forma de secreto: no se escribió (revisa qué objeto lo trae).');
  if (args.json) { console.log(jsonSeguro(snap)); return 0; }                // ya se comprobo arriba que no trae secretos
  const cuando = (fechaCuenta(new Date(Date.parse(snap.capturado) + (cfg.bu && cfg.bu.offsetUtcHoras != null ? Number(cfg.bu.offsetUtcHoras) : -6) * 3600e3).toISOString().replace('Z', '')) || '').replace(' ', '_').replace(':', '');
  const destino = typeof args.out === 'string' ? path.resolve(args.out) : path.join(dirFotos(), `snapshot-${cuando || 'ahora'}-${snap.mid}.json`);
  const { ruta, bytes } = S.guardarFoto(snap, destino);                      // se niega con credenciales, ~/.claude.json o un archivo ajeno
  console.log(resumen(snap, ruta, bytes) + '\n');
  return 0;
}

ejecutar(main);
