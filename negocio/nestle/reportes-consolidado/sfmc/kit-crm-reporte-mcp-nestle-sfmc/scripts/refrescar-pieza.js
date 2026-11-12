#!/usr/bin/env node
'use strict';
const { parseArgs, contexto, ejecutar, salidaJson } = require('../lib/cli');
const { paraMostrar: v } = require('../lib/textoseguro');           // todo lo que viene de SFMC (catalogo, automation, errores) se imprime por v()
const { refrescarPieza } = require('../lib/refresco');
const { formatoEdad, fechaCuenta } = require('../lib/fechas');

const AYUDA = `refrescar-pieza.js — refresca las DEs del reporte y CONFIRMA que una pieza aterrizó

Uso:  node scripts/refrescar-pieza.js --email-name "<EmailName EXACTO de _Job>" [--sin-vol] [--sin-links] [--forzar] [--dry-run] [--json]

Corre las queries del reporte en el MISMO orden que la automation (vol + links -> detalle -> piezas -> auditoría), cada paso
solo después de que el anterior terminó, y confirma por EmailName que la pieza llegó a cada DE.

  --email-name   🔴 el EmailName EXACTO de _Job (el que devuelve resolver-emailname.js)
  --sin-vol      omite la query de audiencias (Vol)
  --sin-links    omite la query de links
  --forzar       corre aunque la automation esté corriendo o por arrancar (se pueden pisar sus queries: bajo tu riesgo)
  --dry-run      solo muestra las precondiciones y los pasos; no inicia nada
  --json         salida legible por máquina

Cómo sabe que una query terminó: las queries de SFMC no exponen su estado, así que se mide lo que escriben en su DE:
cada fila lleva un sello (LastRefresh/LastRun) y TODAS las filas de la pieza deben traer uno POSTERIOR al de antes de iniciar.
Si la corrida terminó y la pieza no aparece (lag de propagación del catálogo), la re-corre.

Se niega a correr si: la pieza no está en el catálogo o está inactiva · la automation está corriendo · arranca en menos de 20 min.
Tiempo: ~9 min con el motor sin carga (medido el 2-oct-2026: vol 55 s, links 59 s, detalle 7 min, piezas 35 s, auditoría 24 s); más si el motor está cargado.
Código de salida: 0 la pieza aterrizó en todo · 1 un paso falló o no terminó · 3 rechazado por una precondición (también si la automation arrancó a mitad del refresco).`;

const num = (v) => Number(v || 0).toLocaleString('es-MX');
const dur = (s) => (s >= 90 ? formatoEdad(s / 60) : `${s} s`);

function imprimirPrecondiciones(r) {
  const c = r.precondiciones.catalogo, a = r.precondiciones.automation;
  console.log('Precondiciones');
  console.log(c ? `  ✓ catálogo: ${[c.clave, c.marca, c.campana, c.touchpoint].filter(Boolean).map(v).join(' · ')} · Activo=${v(c.activo)}` : '  ✗ catálogo: la pieza NO está');
  if (a) console.log(`  ✓ automation ${v(a.nombre)}: ${v(a.status)}${a.proxima ? ` · próxima ${v(a.proxima)}${a.minutosHasta != null && a.minutosHasta >= 0 ? ` (en ${formatoEdad(a.minutosHasta)})` : ''}` : ''}`);
  for (const b of r.precondiciones.bloqueos) console.log(`  ✗ ${v(b.texto)}`);
  for (const x of r.avisos) console.log(`  ⚠️  ${v(x)}`);
}

function imprimirResultado(r) {
  console.log('\nPasos');
  for (const p of r.pasos) {
    const base = `  ${p.rol.padEnd(10)}`;
    if (p.estado === 'ok') console.log(`${base}✓ ${p.intentos} intento${p.intentos === 1 ? '' : 's'} · ${dur(p.segundos)}${p.despuesPz ? ` · filas de la pieza: ${p.despuesPz.n}` : ''}`);
    else if (p.estado === 'sin-aterrizar') console.log(`${base}✗ la query TERMINÓ ${p.intentos} veces y la pieza no aparece`);
    else if (p.estado === 'timeout') console.log(`${base}✗ no vi evidencia de que terminara (${p.intentos} intento${p.intentos === 1 ? '' : 's'}, ${dur(p.segundos)})`);
    else if (p.estado === 'bloqueado') console.log(`${base}✗ detenido ANTES de iniciar la query: ${p.bloqueos.map(b => v(b.texto)).join(' ')}`);
    else console.log(`${base}✗ error: ${v(p.error)}`);
  }
  if (r.estado === 'ok') {
    const pz = r.resumen && r.resumen.piezas, au = r.resumen && r.resumen.auditoria;
    console.log(`\n✓ La pieza aterrizó en todo el reporte (${dur(r.segundos)} en total).`);
    if (pz) console.log(`  ${[pz.Marca, pz.Campana, pz.Touchpoint].filter(Boolean).map(v).join(' · ')}  —  envíos ${num(pz.Email_Sends)} · aperturas ${num(pz.Email_Unique_Opens)} (${pz.Open_Rate}%) · clicks ${num(pz.Email_Unique_Clicks)} (${pz.Click_Rate}%)${pz.N_Jobs ? ` · ${pz.N_Jobs} jobs` : ''}${pz.Fecha_Primer_Envio ? ` · ${fechaCuenta(pz.Fecha_Primer_Envio)?.slice(0, 10)} → ${fechaCuenta(pz.Fecha_Ultimo_Envio)?.slice(0, 10)}` : ''}`);
    if (au) console.log(`  Auditoría: ${v(au.Estado)}${au.Asset_Declarado ? ` · asset declarado ${v(au.Asset_Declarado)} ${au.Asset_Declarado === au.Asset_Real ? '=' : '≠'} real ${v(au.Asset_Real)}` : ''}`);
    return;
  }
  const f = r.fallo; console.log(`\n✗ El refresco NO terminó bien en el paso "${f.rol}".`);
  if (f.estado === 'sin-aterrizar') {
    console.log(`  La query corrió y terminó ${f.intentos} veces, pero la pieza no llegó a ${f.rol}.`);
    const d = r.diagnostico;
    if (d) {
      if (d.envios === 0) console.log('  Causa probable: ese EmailName NO tiene envíos en _Sent (¿es el nombre EXACTO? verifícalo con scripts/resolver-emailname.js, o el envío aún no sale).');
      else if (d.enVentana === 0) console.log(`  Causa probable: tiene ${num(d.envios)} envíos en _Sent (${d.primero} → ${d.ultimo}) pero NINGUNO dentro de la ventana de Detalle (desde ${d.desde}).`);
      else console.log(`  Tiene ${num(d.enVentana)} envíos dentro de la ventana de Detalle${d.desde ? ' (desde ' + d.desde + ')' : ''}, así que no es falta de datos. Si agregaste la pieza al catálogo hace pocos minutos, espera y repite (lag de propagación); si no, revisa el EmailName en el catálogo contra _Job.`);
    } else console.log('  No pude comprobar si tiene envíos en _Sent (la consulta de diagnóstico no terminó).');
  } else if (f.estado === 'bloqueado') {
    console.log('  El refresco se DETUVO antes de iniciar otra query porque ya no era seguro seguir (ver arriba). Lo ya corrido no se deshace. Cuando la automation termine, vuelve a correr este mismo comando.');
  } else if (f.estado === 'timeout') {
    console.log('  La query no mostró señales de terminar. El motor puede estar lento (node scripts/doctor.js --latencia) o la query falló: revísala en Automation Studio → Activities → Query.');
  } else console.log(`  ${v(f.error)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanos: ['sin-vol', 'sin-links', 'forzar', 'dry-run', 'json', 'help'], ayuda: AYUDA });
  if (args.help) { console.log(AYUDA); return 0; }
  const emailName = args['email-name'] === true || args['email-name'] == null ? '' : String(args['email-name']);
  if (!emailName) { console.log(AYUDA); return 1; }

  const { cli, cfg } = await contexto({ soloLectura: false });
  const log = args.json ? () => {} : (s) => console.error(s);
  if (!args.json) console.error(`Refrescando ${JSON.stringify(emailName)} …`);
  const r = await refrescarPieza(cli, cfg, { emailName, sinVol: !!args['sin-vol'], sinLinks: !!args['sin-links'], forzar: !!args.forzar, dryRun: !!args['dry-run'], log });
  const codigo = { ok: 0, plan: 0, rechazado: 3 }[r.estado] ?? (r.fallo && r.fallo.estado === 'bloqueado' ? 3 : 1);
  if (args.json) { console.log(salidaJson(r)); return codigo; }

  console.log('');
  imprimirPrecondiciones(r);
  if (r.estado === 'rechazado') { console.log('\nNo se inició ninguna query.'); return 3; }
  if (r.estado === 'plan') { console.log(`\nSIMULACRO: no se inició nada. Pasos que se correrían, en orden:\n${r.grupos.map((g, i) => `  ${i + 1}) ${g.join(' + ')}`).join('\n')}`); return 0; }
  imprimirResultado(r);
  return codigo;
}

ejecutar(main);
