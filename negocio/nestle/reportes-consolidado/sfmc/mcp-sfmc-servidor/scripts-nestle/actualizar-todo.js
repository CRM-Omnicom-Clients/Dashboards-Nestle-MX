// actualizar-todo.js — CORRE TODO EL SISTEMA EN ORDEN, de una vez.
// Uso:  node actualizar-todo.js
// Refresca las 5 queries en el orden correcto, cada una esperando a que la anterior TERMINE
// de verdad (LastRefresh estrictamente mayor + uniforme + PK sin duplicados). Es lo que hay
// que correr tras cada nuevo envío, y es exactamente lo que debe hacer la automation diaria.
//
// El mapeo ConfigKey->DE de audiencia (CRM_Audiencias) NO se toca aqui: solo cambia cuando
// entran journeys nuevos -> para eso corre  refrescar-audiencias.js  (por API).
const Q = require('./qd.js');
const { leerDE } = require('./leer.js');
const n = v => Number(v || 0);

const PASOS = [
  { de: 'CRM_Audiencias',        id: 'ee50e83c-f2c1-4389-b63f-2690cfcec8f9', ts: 'LastRefresh', pk: 'ConfigKey', nota: 'volumen de audiencia (COUNT estatico)' },
  { de: 'CRM_Email_Detalle',     id: '452234b4-4939-42a7-bc34-9b628782c896', ts: 'LastRefresh', pk: 'RowKey',    nota: 'hechos: pieza x dia (incluye audiencia + volumen)' },
  { de: 'CRM_Email_Piezas',      id: '27da9759-b444-4657-ade5-abcaeb940435', ts: 'LastRefresh', pk: 'ConfigKey', nota: 'totales por pieza' },
  { de: 'CRM_Reporte_Auditoria', id: 'bfea3a5b-8324-409c-b6ec-28e520bcd0cf', ts: 'LastRun',     pk: 'ConfigKey', nota: 'semaforo / duplicados / asset cambio' },
  { de: 'CRM_Email_Links',       id: '9f4c9f45-d08a-43df-afc7-6d511157c7cd', ts: 'LastRefresh', pk: 'RowKey',    nota: 'clicks por link/boton' },
];

async function esperar(de, ts, pk, antes) {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 10000));
    const r = await leerDE(de, [pk, ts]);
    if (r.error) continue;
    const T = [...new Set(r.filas.map(f => String(f[ts])))];
    const cambio = T.length === 1 && T[0] !== antes;
    const pkOk = new Set(r.filas.map(f => f[pk])).size === r.filas.length;
    process.stdout.write('    ' + (i * 10) + 's  filas=' + r.filas.length + '  cambio=' + cambio + '  \r');
    if (cambio && pkOk) return { ok: true, ts: T[0], filas: r.filas.length };
  }
  return { ok: false };
}

(async () => {
  await Q.init();
  console.log('==== ACTUALIZAR TODO EL SISTEMA ====\n');
  const t0 = Date.now();
  for (const p of PASOS) {
    const r0 = await leerDE(p.de, [p.ts]);
    const antes = r0.error ? null : [...new Set(r0.filas.map(f => String(f[p.ts])))][0];
    process.stdout.write('▶ ' + p.de.padEnd(22) + p.nota + '\n');
    const s = await Q.correr(p.id);
    if (s.status >= 300) { console.log('  START FALLO HTTP ' + s.status + ' — ' + String(s.raw).slice(0, 150)); return; }
    const w = await esperar(p.de, p.ts, p.pk, antes);
    console.log('  ' + (w.ok ? '✓ ' + w.filas + ' filas · ' + w.ts : '✗ NO TERMINO a tiempo'));
    if (!w.ok) { console.log('\nABORTA: ' + p.de + ' no terminó. Revisar en Automation Studio.'); return; }
  }
  const seg = ((Date.now() - t0) / 1000).toFixed(0);

  // --- resumen ---
  const p = await leerDE('CRM_Email_Piezas', ['ConfigKey', 'Email_Sends', 'Audience_Volume']);
  const d = await leerDE('CRM_Email_Detalle', ['RowKey', 'Email_Sends']);
  const lk = await leerDE('CRM_Email_Links', ['RowKey']);
  console.log('\n==== LISTO en ' + seg + 's ====');
  console.log('  piezas: ' + p.filas.length + ' · filas detalle: ' + d.filas.length + ' · links: ' + lk.filas.length);
  console.log('  envios totales: ' + d.filas.reduce((a, f) => a + n(f.Email_Sends), 0).toLocaleString('es-MX'));
  console.log('  piezas con volumen de audiencia: ' + p.filas.filter(f => n(f.Audience_Volume) > 0).length + '/' + p.filas.length);
})();
