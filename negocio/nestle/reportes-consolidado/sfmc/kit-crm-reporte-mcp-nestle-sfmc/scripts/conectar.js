#!/usr/bin/env node
'use strict';
const fs = require('fs');
const { parseArgs, ejecutar, salidaJson } = require('../lib/cli');
const { crearCliente } = require('../lib/sfmc');
const { cargarConfig, cargarEjemplo } = require('../lib/config');
const { diagnosticarConexion } = require('../lib/conectar');
const { rutaConexionTxt, rutaClaudeJson, rutaConfig } = require('../lib/paths');
const { REQUERIDOS } = require('../lib/scopes');

const ayuda = () => `conectar.js — comprueba tu conexión a SFMC (credenciales → token → MID → scopes)

Uso:  node scripts/conectar.js [--json]

Busca credenciales en 3 fuentes, en este orden de prioridad:
  1) env          variables SFMC_CLIENT_ID, SFMC_CLIENT_SECRET y SFMC_AUTH_URL (o SFMC_SUBDOMAIN); SFMC_ACCOUNT_ID opcional
  2) claude.json  ${rutaClaudeJson()} → mcpServers.<nombre>.env  (lo que deja el conectar.js del MCP)
  3) conexion.txt ${rutaConexionTxt()}
                  ← LA QUE TÚ EDITAS: pega ahí el volcado del Installed Package (ver docs/CONEXION.md)

Prueba con un token real TODAS las que existan y te dice cuál usarán los demás scripts.
SOLO LEE: no escribe ningún archivo (conexion.txt es tuyo), no imprime el secret.
Para forzar una fuente en todos los scripts:  SFMC_FUENTE=conexion.txt   (o env | claude.json)

Código de salida: 0 si la fuente que usarán los scripts conecta y trae los scopes requeridos · 1 si no.`;

const NUM = { env: 1, 'claude.json': 2, 'conexion.txt': 3 };

function lineaFuente(r) {
  const cab = ` ${NUM[r.fuente]}) ${r.fuente.padEnd(13)}`;
  const sangria = ' '.repeat(cab.length + 1);
  const extra = (lineas) => lineas.map(l => `\n${sangria}${l}`).join('');
  if (r.estado === 'ausente') return `${cab}– no hay: ${r.detalle}`;
  if (r.estado === 'incompleta') return `${cab}✗ ${String(r.detalle).split('\n').map((l, i) => (i ? sangria + l.trim() : l.trim())).join('\n')}`;
  const pk = `package ${r.clientId} · tenant ${r.tenant}`;
  if (!r.token.ok) return `${cab}✗ ${pk}\n${sangria}sin token: ${String(r.token.error).split('\n').map((l, i) => (i ? sangria + l.trim() : l.trim())).join('\n')}`;
  const t = r.token;
  const lineas = [];
  if (t.faltanRequeridos.length) lineas.push(`✗ FALTAN scopes requeridos: ${t.faltanRequeridos.join(', ')}`);
  for (const o of t.faltanOpcionales) lineas.push(`⚠️  falta ${o.scope}: no podrás ${o.para}`);
  return `${cab}${t.faltanRequeridos.length ? '✗' : '✓'} ${pk} · token OK · MID ${t.mid} (${t.midDeclarado ? 'declarado' : 'descubierto'}) · scopes requeridos ${REQUERIDOS.length - t.faltanRequeridos.length}/${REQUERIDOS.length}${extra(lineas)}`;
}

function imprimir(d) {
  console.log('\nConexión a SFMC — qué credenciales hay y si funcionan\n');
  for (const r of d.resultados) console.log(lineaFuente(r));
  console.log('');
  if (d.funciona) {
    console.log(`✓ Conexión lista. Los demás scripts usarán: ${d.activa}${d.forzada ? ' (forzada con SFMC_FUENTE)' : ''}.`);
    console.log(fs.existsSync(rutaConfig()) ? '  Siguiente: node scripts/doctor.js' : `  Siguiente: node scripts/descubrir.js   (genera ${rutaConfig()})`);
  } else {
    console.log(`✗ NO está lista: ${d.problema}.`);
  }
  for (const c of d.consejos) console.log(`  → ${c}`);
  for (const a of d.avisos) console.log(`⚠️  ${a}`);
  if (!d.resultados.some(r => r.estado === 'ok') && !d.resultados.some(r => r.estado === 'incompleta')) {
    console.log(`\n  Crea tu Installed Package en SFMC, pega su volcado en:\n    ${rutaConexionTxt()}\n  y vuelve a correr este script (docs/CONEXION.md explica cada paso).`);
  }
  console.log('');
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanos: ['json', 'help'], ayuda: ayuda() });
  if (args.help) { console.log(ayuda()); return 0; }

  let mcpServerName = 'sfmc-nestle';
  try { mcpServerName = (fs.existsSync(rutaConfig()) ? cargarConfig({ exigirDescubierta: false }) : cargarEjemplo()).mcpServerName || mcpServerName; } catch { /* config rota: el doctor lo dirá */ }

  // Sin cfg => cliente de SOLO LECTURA: pedir un token es lo único que hace.
  const d = await diagnosticarConexion({ mcpServerName }, (cred) => crearCliente({ cred }));
  if (args.json) console.log(salidaJson(d));
  else imprimir(d);
  return d.funciona ? 0 : 1;
}

ejecutar(main);
