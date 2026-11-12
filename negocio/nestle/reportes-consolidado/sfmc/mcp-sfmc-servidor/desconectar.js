#!/usr/bin/env node
/**
 * desconectar.js — apaga el MCP sfmc-nestle y saca las credenciales de ~/.claude.json.
 *
 * Quita el servidor COMPLETO, no solo el secret: dejarlo a medias produce un servidor que
 * arranca y falla, que es ruido. Volver a encenderlo es correr conectar.js.
 *
 * No toca los otros servidores (sfmc de GEPP, asana, copilotstudio).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CFG = path.join(os.homedir(), '.claude.json');
const SERVIDOR = process.argv[2] || 'sfmc-nestle';

const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
const antes = Object.keys(cfg.mcpServers || {});

if (!cfg.mcpServers?.[SERVIDOR]) {
  console.log('"' + SERVIDOR + '" no está en la config. No hay nada que quitar.');
  console.log('servidores actuales: ' + antes.join(', '));
  process.exit(0);
}

const proyectos = Object.keys(cfg.projects || {}).length;
const raizAntes = Object.keys(cfg).length;

delete cfg.mcpServers[SERVIDOR];
fs.writeFileSync(CFG, JSON.stringify(cfg, null, 2), { encoding: 'utf8' });

// verificar: que se fue el servidor y que NO se llevó nada más por delante
const raw = fs.readFileSync(CFG);
const back = JSON.parse(raw.toString('utf8'));
const quedan = Object.keys(back.mcpServers || {});

console.log('--- desconectado ---');
console.log('  quitado        : ' + SERVIDOR);
console.log('  primer byte    : ' + raw[0] + (raw[0] === 123 ? ' (ok, sin BOM)' : ' !! BOM'));
console.log('  quedan         : ' + quedan.join(', '));
console.log('  proyectos      : ' + proyectos + ' -> ' + Object.keys(back.projects || {}).length);
console.log('  claves raíz    : ' + raizAntes + ' -> ' + Object.keys(back).length);
console.log('  rastro del secret en el archivo: ' +
  (/SFMC_CLIENT_SECRET/.test(raw.toString('utf8').replace(/"sfmc"[\s\S]*?\}\s*\}/, ''))
    ? 'revisar (¿otro servidor lo usa?)' : 'ninguno de Nestlé'));

console.log('\nLa automation de SFMC sigue corriendo sola: la DE se mantiene fresca.');
console.log('Para volver a encender: node ~/.claude/tools/_mcp-sfmc/conectar.js');
