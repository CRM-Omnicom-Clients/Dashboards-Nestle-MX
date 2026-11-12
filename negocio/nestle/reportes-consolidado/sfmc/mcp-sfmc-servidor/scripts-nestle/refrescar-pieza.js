// refrescar-pieza.js — refresca las DEs del reporte y CONFIRMA que una pieza nueva aterrice,
// usando senales ROBUSTAS: "la pieza aparece en Detalle" y luego "aparece en Piezas".
//
// 🔴 Por que NO usar LastRefresh uniforme como senal de "termino": Detalle es Update (upsert),
//    y cuando el motor de SFMC esta lento/cargado el LastRefresh NO queda uniforme aunque la
//    pieza YA este cargada (mordio 14-sep con J8: Detalle crecio 678->682 = la pieza aterrizo,
//    pero el LastRefresh nunca se uniformo y la version vieja abortaba). La senal fiable es
//    contar las filas de la ConfigKey en la DE destino.
//
// Tambien resuelve el lag de propagacion: si la 1a corrida de Detalle no ve la fila nueva del
// catalogo (0 filas de la pieza), reintenta Detalle hasta que aparece.
//
// Uso:  node refrescar-pieza.js <ConfigKey>     (sin arg => refresco a ciegas, tiempos fijos)
const Q = require('./qd.js');
const { leerDE } = require('./leer.js');
const n = v => Number(v || 0);
const CK = process.argv[2] || null;

const VOL = 'ee50e83c-f2c1-4389-b63f-2690cfcec8f9';
const DET = '452234b4-4939-42a7-bc34-9b628782c896';
const PIEZAS = '27da9759-b444-4657-ade5-abcaeb940435';
const AUDIT = 'bfea3a5b-8324-409c-b6ec-28e520bcd0cf';
const LINKS = '9f4c9f45-d08a-43df-afc7-6d511157c7cd';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const filasDe = async (de, ck) => { const r = await leerDE(de, ['ConfigKey']); return r.error ? -1 : r.filas.filter(f => f.ConfigKey === ck).length; };

// corre una query y espera a que la ConfigKey aparezca en `de`. Reintenta la query si no aparece.
async function correrHasta(id, de, ck, label, intentos, polls) {
  for (let intento = 1; intento <= intentos; intento++) {
    await Q.correr(id);
    for (let i = 0; i < polls; i++) {
      await sleep(10000);
      const c = await filasDe(de, ck);
      process.stdout.write('  ' + label + ' intento ' + intento + '  ' + (i * 10) + 's  (' + ck + ' en ' + de + '=' + c + ')   \r');
      if (c > 0) { console.log('\n  ✓ ' + ck + ' en ' + de + ' (' + c + ' filas)'); return true; }
    }
    console.log('\n  ' + label + ': no aparecio en intento ' + intento + (intento < intentos ? ', re-corro...' : ''));
  }
  return false;
}
async function correrYEsperar(id, seg) { await Q.correr(id); await sleep(seg * 1000); }

(async () => {
  await Q.init();
  console.log('==== REFRESCO' + (CK ? ' (confirmando ' + CK + ')' : '') + ' ====\n');
  const t0 = Date.now();

  console.log('> Vol (audiencias)'); await correrYEsperar(VOL, 60);

  if (CK) {
    console.log('> Detalle (hasta que aterrice ' + CK + ')');
    const okD = await correrHasta(DET, 'CRM_Email_Detalle', CK, 'Detalle', 6, 40);
    if (!okD) { console.log('⚠ ' + CK + ' NO aterrizo en Detalle tras varios intentos. Revisar: EmailName EXACTO (usar resolver-emailname.js) y que tenga envios reales en _Sent (>= 2026-03-01).'); return; }
    console.log('> Piezas (hasta que aparezca ' + CK + ')');
    await correrHasta(PIEZAS, 'CRM_Email_Piezas', CK, 'Piezas', 4, 30);
  } else {
    console.log('> Detalle'); await correrYEsperar(DET, 420);
    console.log('> Piezas'); await correrYEsperar(PIEZAS, 150);
  }

  console.log('> Auditoria'); await correrYEsperar(AUDIT, 40);
  console.log('> Links'); await correrYEsperar(LINKS, 40);

  console.log('\n==== LISTO en ' + ((Date.now() - t0) / 1000).toFixed(0) + 's ====');
  if (CK) {
    const r = await leerDE('CRM_Email_Piezas', ['ConfigKey', 'Marca', 'Campana', 'Touchpoint', 'Email_Sends', 'Email_Unique_Opens', 'Email_Unique_Clicks', 'Open_Rate', 'Click_Rate']);
    const f = r.filas.find(x => x.ConfigKey === CK);
    console.log('  ' + CK + ': ' + (f ? (f.Marca + ' · ' + f.Campana + ' · ' + f.Touchpoint + ' · Sends=' + n(f.Email_Sends).toLocaleString('es-MX') + ' Opens=' + n(f.Email_Unique_Opens).toLocaleString('es-MX') + ' (' + f.Open_Rate + '%) Clicks=' + n(f.Email_Unique_Clicks) + ' (' + f.Click_Rate + '%)') : '✗ NO aparece'));
  }
})();
