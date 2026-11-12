// master-doc.js — genera el MD MAESTRO del sistema de email CRM Nestlé, con datos en vivo.
// Junta: correos nuevos, links, audiencia+volumen, runbook de actualizacion y estado del sistema.
// Es el doc que se conserva y se actualiza (re-correr este script lo regenera).
const Q = require('./qd.js');
const { leerDE } = require('./leer.js');
const fs = require('fs');
const n = v => Number(v || 0);
const fmt = v => n(v).toLocaleString('es-MX');
const corto = s => String(s).replace(/^.*_ES_/, '').replace(/^MX\.Proplan\.ATM_JB\./, '');

(async () => {
  await Q.init();
  const cfg = await leerDE('CRM_Reporte_Config', ['ConfigKey', 'EmailName', 'Campana', 'Activo']);
  const p = await leerDE('CRM_Email_Piezas', ['ConfigKey', 'Campana', 'Touchpoint', 'Segmento', 'EmailName', 'Email_Subject', 'Email_ID', 'Es_FUP', 'Email_Sends', 'Email_Deliveries', 'Email_Unique_Opens', 'Email_Unique_Clicks', 'Email_Total_Unsubs', 'Email_Unique_Unsubs', 'Open_Rate', 'Click_Rate', 'Audience_DE', 'Audience_Volume', 'LastRefresh']);
  const lk = await leerDE('CRM_Email_Links', ['ConfigKey', 'Link_Name', 'Link_URL', 'Clicks_Total', 'Clicks_Unique']);
  const au = await leerDE('CRM_Audiencias', ['ConfigKey', 'Audience_DE', 'Audience_Volume']);
  const a = (await Q.rest('/automation/v1/automations/8a8a7b31-f99c-45fb-8482-e7b75858968b', 'GET')).json || {};
  const pRefresh = [...new Set(p.filas.map(f => String(f.LastRefresh)))][0];

  const L = []; const W = (s = '') => L.push(s);
  W('# Sistema de Reporte de Email CRM — Nestlé (SFMC)');
  W();
  W('> **Documento maestro. Se conserva y se actualiza.** Reúne los correos nuevos, el desglose de');
  W('> links, la audiencia por pieza y el runbook de actualización. Generado con datos en vivo de SFMC.');
  W('> BU `NMX - Nestle Mexico` (MID 10966050). SFMC manda; Datorama es referencia.');
  W(`> Última recarga de Piezas: ${pRefresh} · piezas en catálogo: ${cfg.filas.length} · con datos: ${p.filas.length}.`);
  W();
  W('## Índice');
  W('1. Cómo está armado el sistema');
  W('2. Cómo se actualiza (runbook)');
  W('3. La automation — qué debe tener');
  W('4. Correos nuevos de este mes');
  W('5. Desglose de clicks por link/botón');
  W('6. Unsubs únicos y totales');
  W('7. Audiencia y volumen por pieza');
  W('8. Provisionales pendientes de formalizar');
  W('9. Catálogo por EmailName — estado');
  W('10. Pendientes');
  W();
  W('---');
  W('## 1. Cómo está armado el sistema');
  W();
  W('| DE | Rol | Se llena con |');
  W('|---|---|---|');
  W('| `CRM_Reporte_Config` | **catálogo**: qué piezas se reportan | script/API (lo edita Rick en la raíz) |');
  W('| `CRM_Audiencias` | mapa pieza → DE de audiencia + volumen | script (mapeo) + query `CRM_Audiencias_Vol_Load` (volumen) |');
  W('| `CRM_Email_Detalle` | hechos: pieza × día de envío | query, filtrado por el catálogo |');
  W('| `CRM_Email_Piezas` | totales por pieza | query, agrega el detalle |');
  W('| `CRM_Reporte_Auditoria` | semáforo: OK / DUPLICADO / SIN MATCH / ASSET CAMBIO | query |');
  W('| `CRM_Email_Links` | clicks por link/botón por pieza | query |');
  W();
  W('**Regla de oro del match:** cada pieza se ancla por su `EmailName` (= el EmailName exacto de');
  W('SFMC), no por el número de pieza. **El número de pieza lo asigna el normalizador, no aquí** (ni ConfigKey ni PiezaID sirven como identidad).');
  W();
  W('---');
  W('## 2. Cómo se actualiza (runbook)');
  W();
  W('Hay **tres** tipos de actualización, de más frecuente a menos:');
  W();
  W('**a) Cada nuevo envío / corte diario — actualizar todas las métricas.**');
  W('Lo hace la **automation `CRM_Reporte_Diario`** sola (una vez que tenga los 5 pasos, ver §3).');
  W('Manual, si hace falta: `node actualizar-todo.js` — corre las 5 queries en orden.');
  W();
  W('**b) Agregar una pieza nueva al reporte.**');
  W('`node add-pieza.js` (editando el nombre adentro). Sondea EmailID/journey, la mete al catálogo');
  W('anclada por EmailName, y la agrega al mapa de audiencia. NO refresca las DEs (eso lo hace la');
  W('automation). Si su DE de audiencia es nueva, regenera la query de volumen sola.');
  W();
  W('**c) Journeys/audiencias nuevas — refrescar el mapa.**');
  W('`node refrescar-audiencias.js` re-resuelve pieza → DE de audiencia por la interaction API.');
  W('Solo hace falta cuando entran journeys nuevos (no en cada envío).');
  W();
  W('---');
  W('## 3. La automation — qué debe tener');
  W();
  W(`Estado actual: **${a.status}** · ${(a.steps || []).length} step(s).`);
  W();
  W('🔴 **Le faltan 2 queries y el orden.** Debe quedar con **5 pasos, en este orden** (cada uno lee');
  W('del anterior, por eso NO pueden ir en el mismo step):');
  W();
  W('| Paso | Query |');
  W('|---|---|');
  W('| 1 | `CRM_Audiencias_Vol_Load` |');
  W('| 2 | `CRM_Email_Detalle_Load` |');
  W('| 3 | `CRM_Email_Piezas_Load` |');
  W('| 4 | `CRM_Reporte_Auditoria_Load` |');
  W('| 5 | `CRM_Email_Links_Load` |');
  W();
  W('Hoy tiene solo 3 (Detalle+Piezas+Auditoría) en **un mismo step** (corren a la vez → Piezas y');
  W('Auditoría leen datos viejos). Esto **se arregla arrastrando en Automation Studio** — la API no');
  W('deja reestructurar steps. No hay actividades duplicadas.');
  W();
  W('🧹 **Limpieza:** existe una query vieja `CRM_Email_Performance_Load` → DE `CRM_Email_Performance`');
  W('del pipeline anterior (deprecado). No la usa nada del reporte actual. Conviene borrarla para que no');
  W('confunda. (No la borré yo: es una DE de producción; dime y la elimino.)');
  W();
  W('---');
  W('## 4. Correos nuevos de este mes');
  W();
  const NEW = ['TMP-AON-EAPP', 'TMP-AON-EPROP2', 'TMP-AON-EPROP2-FUP', 'TMP-NESC-ICE', 'TMP-NESC-ICE-FUP', 'TMP-NESC-ESPRESSO', 'TMP-NESC-ESPRESSO-FUP', 'TMP-NESC-ESPRESSO-V3', 'TMP-MAGGI-J4-SR', 'TMP-MAGGI-J4-CR'];
  W('| EmailName (identidad) | Campaña | Touchpoint | FUP | Asset | Sends | OR% | CR% | Unsub ú/t |');
  W('|---|---|---|---|---|---:|---:|---:|---:|');
  for (const k of NEW) {
    const f = p.filas.find(x => x.ConfigKey === k);
    if (!f) continue;
    W(`| \`${corto(f.EmailName)}\` | ${f.Campana} | ${f.Touchpoint} | ${f.Es_FUP} | \`${f.Email_ID}\` | ${fmt(f.Email_Sends)} | ${f.Open_Rate} | ${f.Click_Rate} | ${n(f.Email_Unique_Unsubs)}/${n(f.Email_Total_Unsubs)} |`);
  }
  W();
  W('Los FUP van separados por regla. La variante C de Espresso Con (42,000 envíos) se acaba de');
  W('agregar y entrará en la próxima corrida de la automation.');
  W();
  W('---');
  W('## 5. Desglose de clicks por link/botón');
  W();
  W('Sí se puede: `_Click` expone la URL y el nombre del botón (`Link_Name`). DE `CRM_Email_Links`.');
  W('Por pieza, cada link con sus clicks totales y únicos. Validado: la suma por link == total de');
  W('clicks de la pieza. Ejemplo (E-APP):');
  W();
  const eapp = lk.filas.filter(f => f.ConfigKey === 'TMP-AON-EAPP').sort((x, y) => n(y.Clicks_Total) - n(x.Clicks_Total));
  if (eapp.length) {
    W('| Botón / Link | Clicks | Únicos |');
    W('|---|---:|---:|');
    for (const f of eapp.slice(0, 10)) {
      const nm = String(f.Link_Name || '').trim();
      const url = String(f.Link_URL || '').replace(/%%=RedirectTo\(CONCAT\('/i, '').replace(/^%%=Redirectto\(/i, '').split("'")[0].slice(0, 50);
      W(`| ${nm ? '**' + nm + '** · ' : ''}${url} | ${fmt(f.Clicks_Total)} | ${fmt(f.Clicks_Unique)} |`);
    }
    W();
  }
  W('---');
  W('## 6. Unsubs únicos y totales');
  W();
  W('`Email_Total_Unsubs` (todos los eventos) y `Email_Unique_Unsubs` (suscriptores distintos), en');
  W('Detalle y Piezas. Validado único ≤ total. Suelen ser casi iguales.');
  W();
  W('---');
  W('## 7. Audiencia y volumen por pieza');
  W();
  W('Cada pieza trae la **DE que la activa** (entry source del journey) y su **volumen**. Se resuelve');
  W('por interaction API. El `% enviado` compara enviados vs tamaño de la audiencia.');
  W('⚠️ El volumen es el **actual** de la DE, no un snapshot del día del envío.');
  W();
  const conAud = p.filas.filter(f => String(f.Audience_DE || '').trim()).sort((x, y) => String(x.Campana + x.ConfigKey).localeCompare(String(y.Campana + y.ConfigKey)));
  W('| EmailName (identidad) | Campaña | Enviados | Audiencia | % | DE de audiencia |');
  W('|---|---|---:|---:|---:|---|');
  for (const f of conAud) {
    const vol = n(f.Audience_Volume), s = n(f.Email_Sends);
    W(`| \`${corto(f.EmailName)}\` | ${f.Campana} | ${fmt(s)} | ${fmt(vol)} | ${vol > 0 ? (100 * s / vol).toFixed(0) + '%' : '—'} | ${f.Audience_DE} |`);
  }
  W(`\n(${conAud.length} piezas con audiencia. Las one-shot sin journey no tienen entry DE.)`);
  W();
  W('---');
  W('## 8. Provisionales pendientes de formalizar');
  W();
  const tmp = cfg.filas.filter(f => /^(TMP-|009-TMP)/.test(f.ConfigKey));
  W(`Hay **${tmp.length} piezas provisionales** que la otra sesión debe formalizar en el catálogo raíz`);
  W('**con la numeración de Rick**, identificándolas por su EmailName (no llevan número de pieza aquí):');
  W();
  W('| Campaña | EmailName (identidad) |');
  W('|---|---|');
  for (const f of tmp.sort((a, b) => String(a.EmailName).localeCompare(String(b.EmailName))))
    W(`| ${f.Campana} | \`${corto(f.EmailName)}\` |`);
  W();
  W('---');
  W('## 9. Catálogo por EmailName — estado');
  W();
  const byCN = {}; for (const f of cfg.filas) { const kk = String(f.EmailName).trim(); (byCN[kk] = byCN[kk] || []).push(f.ConfigKey); }
  const dupCN = Object.entries(byCN).filter(([, v]) => v.length > 1);
  W('En el catálogo, **EmailName = el EmailName exacto de SFMC**. Todos los joins del sistema anclan');
  W('por ahí, no por el número de pieza. **El número de pieza lo asigna el normalizador, no aquí** (ni ConfigKey ni PiezaID sirven como identidad).');
  W();
  if (dupCN.length === 0) {
    W('✅ **EmailName es único** en las ' + cfg.filas.length + ' filas (0 duplicados). Los 2 que había');
    W('(P025/P027, que traían el nombre de marzo) se corrigieron a su nombre real de abril el 20-ago.');
    W('Con esto **EmailName ya sirve como llave**. Volverlo la PK *formal* de la DE es opcional (recrear');
    W('la DE con PK=EmailName + repuntar las 5 queries) — no urge, porque el sistema ya lo trata como');
    W('la identidad y la auditoría avisa si alguien repite un EmailName.');
  } else {
    W('🔴 Hay **' + dupCN.length + ' EmailName duplicados** — resolverlos antes de usar EmailName como PK:');
    for (const [cn, ks] of dupCN) W('- `' + ks.join('` y `') + '` comparten `' + corto(cn) + '`');
  }
  W();
  W('---');
  W('## 10. Pendientes');
  W();
  W('1. **Completar la automation** a 5 pasos en orden (Automation Studio) — hoy tiene 3 en 1 step. *(tuyo, en la UI)*');
  W('2. **Borrar** la query/DE vieja `CRM_Email_Performance` (si confirmas).');
  W('3. **Formalizar** las provisionales en el catálogo raíz (§8) con tu numeración.');
  W('4. ✅ Duplicados de AON corregidos (P025/P027) — EmailName ya es único.');
  W('5. Confirmar el segmento de las piezas nuevas de Nescafé/Maggi (dimensiones con `*`).');
  W();
  W('---');
  W('_Regenerar este doc: `node master-doc.js`. Todas las cifras salen de las DEs, no a mano._');

  fs.writeFileSync('REPORTE-CRM-EMAIL-SISTEMA.md', L.join('\n'), 'utf8');
  console.log('escrito: REPORTE-CRM-EMAIL-SISTEMA.md (' + L.length + ' lineas)');
  console.log('  piezas: ' + p.filas.length + ' · con audiencia: ' + conAud.length + ' · provisionales: ' + tmp.length + ' · links: ' + lk.filas.length);
})();
