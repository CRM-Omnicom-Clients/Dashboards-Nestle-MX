#!/usr/bin/env node
'use strict';
const { parseArgs, contexto, ejecutar, salidaJson } = require('../lib/cli');
const { paraMostrar: v } = require('../lib/textoseguro');           // todo lo que viene de SFMC (nombres, errores, estados) se imprime por v()
const L = require('../lib/linksdia');

const AYUDA = `instalar-links-dia.js — crea CRM_Email_Links_Dia (clicks por link con la FECHA del click) y la automation propia que la carga cada noche

Uso:  node scripts/instalar-links-dia.js [--escribir] [--hora HH:MM] [--actualizar] [--conservar] [--sin-prueba] [--json]

Por qué: CRM_Email_Links no dice cuándo ocurrió cada click, así que el desglose de clicks por destino (CTA, baja, redes+navegador+legal) no se puede repartir entre las filas-quincena de una pieza.
Esta tabla trae ClickDay (el día del click) y SendDay (el día en que salió ese correo, el mismo que usa CRM_Email_Detalle) con grano JobID × SendDay × ClickDay × link, tipo Update
(conserva las filas de envíos que las vistas de datos ya olvidaron). Crea EXACTAMENTE tres objetos: la DE CRM_Email_Links_Dia, la query CRM_Email_Links_Dia_Load y la automation
CRM_Reporte_Links_Dia (una actividad, diaria, aparte de CRM_Reporte_Diario a propósito: si falla no frena el reporte). No toca nada de lo que ya existe.

  --escribir     CREA los objetos. Sin esto es SIMULACRO: prueba el SQL en una query temporal y dice qué crearía, sin escribir nada
  --hora         hora de la corrida diaria en la zona de la cuenta (por defecto 00:50, después de CRM_Reporte_Diario). Si la automation ya existe programada a OTRA hora, solo se vuelve a crear si pides la hora aquí
  --actualizar   si la query ya existe con otro SQL, lo reemplaza (el SQL nuevo se prueba antes en una query temporal)
  --conservar    si algo falla NO borra lo que esta corrida creó (para revisarlo); por defecto lo REVIERTE
  --sin-prueba   no corre la automation una vez (por defecto sí, ANTES de activar su horario: SFMC solo deja «run once» en Ready o PausedSchedule; si no la deja, la prueba se omite y se dice)
  --json         salida legible por máquina

Qué comprueba antes de dejarlo: llave única, ningún click antes de su envío, el total contra CRM_Email_Links y cada job × día de envío contra el Detalle. Si algo no cuadra, revierte.
Seguridad: la guardia de escritura abre un MODO INSTALACION solo para este script y solo para esos tres nombres (docs/SEGURIDAD.md); necesita los permisos automations_write y data_extensions_write.
Idempotente: si ya está instalado y programado, no hace nada; adopta la DE y la query que ya existen. La automation se crea ya con su horario y se ACTIVA por el endpoint legacy (por la API SFMC la deja siempre en PausedSchedule);
una automation propia que quedó sin programar, obsoleta (apunta a una query que ya no existe) o a otra hora pedida con --hora se borra y se vuelve a crear. Si no se puede activar, NO revierte: la tabla ya quedó cargada y se activa a mano o se repite el script.
Código de salida: 0 simulacro válido / instalado y verificado / ya instalado · 1 error o instalado sin programar · 3 rechazado o revertido.`;

const num = (n) => Number(n).toLocaleString('es-MX');

function imprimir(r) {
  console.log('');
  if (r.estado === 'rechazado') { console.log('✗ ' + v(r.motivo)); return 3; }
  const p = r.plan;
  if (r.estado === 'revertido') {
    console.log('✗ NO quedó instalado: ' + v(r.motivo));
    console.log(r.creadosYBorrados.length ? `  Se borró lo que esta corrida había creado: ${r.creadosYBorrados.join(', ')}.` : '  Esta corrida no pudo borrar nada de lo que había creado (o no había creado nada todavía).');
    for (const f of r.fallosAlRevertir) console.log('  ⚠️  ' + v(f) + '  (revísalo en Automation Studio)');
    if (r.conciliacion) imprimirConciliacion(r.conciliacion);
    return 3;
  }
  if (r.estado === 'sin-programar') {
    console.log('⚠️  Casi: ' + v(r.motivo));
    console.log('\n' + r.registros.map((x) => '  ✓ ' + x).join('\n'));
    console.log(`  ✓ primera carga: ${num(r.carga.filas)} filas en ${r.carga.segundos} s`);
    imprimirConciliacion(r.conciliacion);
    imprimirPrueba(r.pruebaAutomation);
    console.log(`  Estado de la automation: ${v(r.automation.status)}`);
    return 1;
  }
  console.log(`SQL: ${num(p.sqlCaracteres)} caracteres · probado en una query temporal: ${num(p.filasDePrueba)} filas en ${p.segundosDePrueba} s`);
  console.log(`Ya existe: DE ${p.existente.de ? 'sí' : 'no'} · query ${p.existente.query ? 'sí' : 'no'} · automation ${p.existente.automation ? 'sí' : 'no'}${p.actualizarSql ? ' · el SQL de la query CAMBIA' : ''}`);
  console.log(`Horario: diaria a las ${p.hora} (${v(p.horario.timezoneName)}), primera corrida ${v(p.horario.startDate)}`);
  if (r.estado === 'simulacro') {
    console.log(`\nSe crearía: la DE ${L.NOMBRES.de} (${L.CAMPOS.length} campos, llave RowKey), la query ${L.NOMBRES.query} (Update) y la automation ${L.NOMBRES.automation} (un paso, una actividad).`);
    console.log('SIMULACRO: no se escribió nada. Para instalarlo repite el mismo comando con --escribir.');
    return 0;
  }
  if (r.estado === 'ya-instalado') { console.log('\n✓ Ya está instalado y programado: no hay nada que hacer.'); return 0; }
  console.log('\n' + r.registros.map((x) => '  ✓ ' + x).join('\n'));
  console.log(`  ✓ primera carga: ${num(r.carga.filas)} filas en ${r.carga.segundos} s`);
  imprimirConciliacion(r.conciliacion);
  imprimirPrueba(r.pruebaAutomation);
  console.log(`\n✓ Instalado. Estado de la automation: ${v(r.automation.status)} · próxima corrida ${v(r.automation.proxima)}`);
  return 0;
}
/** La corrida única de la automation va ANTES de activar su horario (SFMC solo deja «run once» en Ready o PausedSchedule). */
function imprimirPrueba(pa) {
  if (!pa) return;
  if (pa.omitida) console.log(`  ⚠️  prueba de la automation OMITIDA: ${v(pa.motivo)}. La primera corrida programada será la que compruebe que funciona de punta a punta.`);
  else console.log(`  ✓ la automation corrió una vez, sola y de punta a punta, en ${pa.segundos} s (antes de activar su horario) y volvió a "${v(pa.status)}"`);
}
function imprimirConciliacion(c) {
  console.log(`  ${c.llaveUnica ? '✓' : '✗'} llave única en ${num(c.filas)} filas · click antes del envío: ${c.clickAntesDelEnvio} · sin día de envío (envío ya fuera de las vistas): ${num(c.sinEnvio.filas)} filas, ${num(c.sinEnvio.clicks)} clicks`);
  console.log(`  ${Math.abs(c.links.diferencia) <= Math.max(10, Math.ceil(0.005 * c.links.totalViejo)) ? '✓' : '✗'} total de clicks: ${num(c.links.totalNuevo)} contra ${num(c.links.totalViejo)} de CRM_Email_Links (diferencia ${c.links.diferencia}; links distintos ${c.links.linksDistintos}, solo en el viejo ${c.links.soloEnViejo}, solo en el nuevo ${c.links.soloEnNuevo})`);
  console.log(`  ${c.detalle.distintas === 0 ? '✓' : '·'} job × día de envío contra el Detalle: ${num(c.detalle.iguales)} de ${num(c.detalle.combinaciones)} iguales${c.detalle.distintas ? ` (${c.detalle.distintas} difieren: ${c.detalle.ejemplos.map((e) => `${v(e.llave)} nuevo ${e.nuevo} detalle ${e.detalle}`).join(' | ')})` : ''}`);
  for (const pr of c.problemas) console.log('  ✗ ' + v(pr));
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanos: ['escribir', 'actualizar', 'conservar', 'sin-prueba', 'json', 'help'], ayuda: AYUDA });
  if (args.help) { console.log(AYUDA); return 0; }
  const hora = args.hora === undefined || args.hora === true ? undefined : String(args.hora);          // sin --hora: 00:50 al crear, y una automation ya programada a otra hora se respeta
  // La guardia necesita saber la carpeta de la automation ANTES de crear el cliente que escribe: se lee con un cliente de solo lectura.
  const lectura = await contexto({ soloLectura: true });
  const diaria = (await lectura.cli.restOk(`/automation/v1/automations/${lectura.cfg.automation.id}`)).json;
  const { cli, cfg } = await contexto({ soloLectura: false, instalacion: { de: { nombre: L.NOMBRES.de }, query: { nombre: L.NOMBRES.query }, automation: { nombre: L.NOMBRES.automation, carpeta: diaria.categoryId } } });
  const log = args.json ? () => {} : (s) => console.error(s);
  if (!args.json) console.error(`${args.escribir ? 'INSTALANDO' : 'SIMULACRO de la instalación de'} ${L.NOMBRES.de} …`);
  const r = await L.instalar(cli, cfg, { escribir: !!args.escribir, hora, actualizar: !!args.actualizar, conservar: !!args.conservar, probarAutomation: !args['sin-prueba'], log });
  const codigo = { simulacro: 0, instalado: 0, 'ya-instalado': 0, 'sin-programar': 1, rechazado: 3, revertido: 3 }[r.estado] ?? 1;
  if (args.json) { console.log(salidaJson(r)); return codigo; }
  return imprimir(r);
}

ejecutar(main);
