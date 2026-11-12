#!/usr/bin/env node
'use strict';
const { parseArgs, contexto, ejecutar, salidaJson } = require('../lib/cli');
const { paraMostrar } = require('../lib/textoseguro');
const { resolverEmailNames, formatearCandidato, ErrorResolver, MIN_FRAGMENTO } = require('../lib/resolver');

const AYUDA = `resolver-emailname.js — encuentra el EmailName REAL (el de _Job) a partir de un fragmento

Uso:  node scripts/resolver-emailname.js "<fragmento>" ["<fragmento2>" ...] [--desde <JobID>] [--max <N>] [--json]

  <fragmento>   texto que aparece en el nombre real del envío (mín. ${MIN_FRAGMENTO} caracteres). Es texto LITERAL, no un patrón.
                Varios fragmentos = se busca cualquiera de ellos. No distingue mayúsculas.
  --desde       solo JobID mayores a este valor (opcional: un escaneo completo de _Job tardó de 30 a 90 s el 2-oct-2026 según la carga del motor; casi nunca hace falta)
  --max         cuántos candidatos mostrar (30 por defecto; --json los trae todos)
  --json        salida legible por máquina

🔴 REGLA DURA: la identidad de una pieza es el EmailName EXACTO de _Job. NUNCA el código del asset del brief ni el de
Content Builder (casi nunca coinciden). Corre esto ANTES de agregar, actualizar o reportar una pieza.

Es de solo lectura sobre tus datos: crea y borra una DE + query temporales (CRM_Tmp_*) para consultar _Job.
Código de salida: 0 hay candidatos · 2 la consulta terminó y NO hay ninguno (negativo real) · 1 error o la consulta no terminó.`;

const comillas = (lista) => lista.map(f => '"' + paraMostrar(f) + '"').join(', ');

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanos: ['json', 'help'], ayuda: AYUDA });
  if (args.help) { console.log(AYUDA); return 0; }
  const frags = args._;
  if (!frags.length) { console.log(AYUDA); return 1; }
  const max = args.max != null ? Number(args.max) : 30;
  if (!Number.isInteger(max) || max < 1) throw new ErrorResolver('--max debe ser un entero >= 1');

  const { cli, cfg } = await contexto({ soloLectura: false });
  const log = args.json ? () => {} : (s) => console.error(s);
  if (!args.json) console.error(`Resolviendo ${JSON.stringify(frags)}${args.desde ? ` (JobID > ${args.desde})` : ' — escaneo completo de _Job (30-90 s según la carga del motor)'} …`);
  const r = await resolverEmailNames(cli, cfg, { frags, desde: args.desde != null && args.desde !== true ? args.desde : null, log });

  if (args.json) { console.log(salidaJson(r)); return r.completo ? (r.candidatos.length ? 0 : 2) : 1; }

  console.log('');
  if (!r.completo) { for (const a of r.avisos) console.log('✗ ' + paraMostrar(a)); return 1; }
  if (!r.candidatos.length) {
    console.log(`SIN coincidencias (la consulta terminó en ${r.segundos} s: es un negativo REAL). Ningún _Job.EmailName contiene: ${comillas(r.frags)}.`);
    console.log('Si esperabas un envío, no existe con ese texto en el nombre: pide el nombre real a quien lo armó (NO uses el código del asset del brief).');
    return 2;
  }
  r.candidatos.slice(0, max).forEach((c, i) => console.log(formatearCandidato(c, i) + '\n'));
  if (r.candidatos.length > max) console.log(`… y ${r.candidatos.length - max} más (afina el fragmento, usa --desde, o --max ${r.candidatos.length}).\n`);
  if (r.sinCoincidencia.length) console.log(`Sin coincidencias para: ${comillas(r.sinCoincidencia)}\n`);
  for (const a of r.avisos) console.log('⚠️  ' + paraMostrar(a));
  console.log(`➜ Usa el EmailName EXACTO de arriba como llave (es el que casa el JOIN del reporte). ${r.candidatos.length} candidato(s) · consulta de ${r.segundos} s.`);
  return 0;
}

ejecutar(main);
