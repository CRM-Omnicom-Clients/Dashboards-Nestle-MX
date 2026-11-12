// handoff-doc.js — genera el handoff para la sesion del CATALOGO RAIZ: todo lo que debe
// actualizar en su catalogo y en sus skills (columnas nuevas, IDs, piezas nuevas, links).
const Q = require('./qd.js');
const { leerDE } = require('./leer.js');
const https = require('https');
const fs = require('fs');
const H = u => new URL(u).host;
const corto = s => String(s).replace(/^.*_ES_/, '').replace(/^MX\.Proplan\.ATM_JB\./, '');

const DES = [
  ['CRM_Reporte_Config', '03A9BE5F-0C95-4901-BEB9-3A3BEBF77C6D', 'catálogo (qué se reporta)'],
  ['CRM_Email_Detalle', 'E6A6AA43-BC30-443D-AA79-4ED324F45BA5', 'hechos: pieza × día'],
  ['CRM_Email_Piezas', '9DA78867-0F91-4CE9-97CD-B2F43BB7862E', 'totales por pieza'],
  ['CRM_Email_Links', '608FD76A-3398-4AAE-9269-A3C6B0D95810', 'clicks por link/botón'],
  ['CRM_Audiencias', 'F4811FBB-1BB6-4BD0-85EF-EBE08A97CB08', 'DE de audiencia + volumen'],
  ['CRM_Reporte_Auditoria', '3CC31E3D-0384-47E8-B851-575B6C5D08D0', 'semáforo'],
];
// columnas NUEVAS (agregadas en ago-2026) para marcarlas
const NUEVAS = new Set(['EmailName', 'EmailID', 'Email_Subject', 'Email_ID', 'Es_FUP', 'Journey_ID_Datorama', 'Journey_Name', 'Journey_UUID', 'Piezas_Mismo_Asset', 'Email_Total_Unsubs', 'Email_Unique_Unsubs', 'Audience_DE', 'Audience_Volume', 'Asset_Declarado', 'Asset_Real', 'Link_Name', 'Link_URL', 'Clicks_Total', 'Clicks_Unique']);
const LEGACY = new Set(['ContentName', 'Email_Content_Name']);   // duplicados de EmailName; borrar en la UI
const INUTIL = new Set(['ConfigKey', 'PiezaID']);   // no sirven de identidad; ConfigKey es PK interna, PiezaID borrar en UI

(async () => {
  const tok = await Q.init();
  const SOAP = H(Q.env.SFMC_SOAP_URL);
  const campos = async (ck) => {
    const b = `<?xml version="1.0"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"><s:Header><a:Action s:mustUnderstand="1">Retrieve</a:Action><a:To s:mustUnderstand="1">https://${SOAP}/Service.asmx</a:To><fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header><s:Body><RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><RetrieveRequest><ObjectType>DataExtensionField</ObjectType><Properties>Name</Properties><Properties>FieldType</Properties><Properties>MaxLength</Properties><Properties>IsPrimaryKey</Properties><Properties>Ordinal</Properties><Filter xsi:type="SimpleFilterPart"><Property>DataExtension.CustomerKey</Property><SimpleOperator>equals</SimpleOperator><Value>${ck}</Value></Filter></RetrieveRequest></RetrieveRequestMsg></s:Body></s:Envelope>`;
    const x = await new Promise(res => { const q = https.request({ host: SOAP, path: '/Service.asmx', method: 'POST', timeout: 60000, headers: { 'Content-Type': 'text/xml', SOAPAction: 'Retrieve', 'Content-Length': Buffer.byteLength(b) } }, rr => { let d = ''; rr.on('data', c => d += c); rr.on('end', () => res(d)); }); q.on('error', () => res('')); q.write(b); q.end(); });
    return x.split(/<Results[^>]*>/).slice(1).map(bl => ({
      name: (/<Name>([\s\S]*?)<\/Name>/.exec(bl) || [])[1],
      type: (/<FieldType>([\s\S]*?)<\/FieldType>/.exec(bl) || [])[1],
      len: (/<MaxLength>([\s\S]*?)<\/MaxLength>/.exec(bl) || [])[1],
      pk: (/<IsPrimaryKey>([\s\S]*?)<\/IsPrimaryKey>/.exec(bl) || [])[1] === 'true',
      ord: Number((/<Ordinal>([\s\S]*?)<\/Ordinal>/.exec(bl) || [])[1] || 0),
    })).filter(f => f.name).sort((a, b) => a.ord - b.ord);
  };

  // catalogo: provisionales + correcciones
  const cfg = await leerDE('CRM_Reporte_Config', ['ConfigKey', 'EmailName', 'EmailID', 'Campana', 'Touchpoint', 'Segmento', 'EmailType', 'CodigoNC', 'BU', 'Marca']);
  const prov = cfg.filas.filter(f => /^(TMP-|009-TMP)/.test(f.ConfigKey)).sort((a, b) => a.ConfigKey.localeCompare(b.ConfigKey));

  const L = []; const W = (s = '') => L.push(s);
  W('# Handoff a la sesión del catálogo raíz — actualizaciones del sistema de email CRM Nestlé');
  W();
  W('> 20-ago-2026. El pipeline de email en SFMC creció mucho: columnas nuevas, DEs nuevas, piezas');
  W('> nuevas y correcciones. **Este doc es para que actualices el catálogo raíz y tus skills** para');
  W('> que consuman todo lo nuevo. Fuente: SFMC NMX 10966050. SFMC manda; Datorama es referencia.');
  W('> Doc del sistema completo: `CRM General/REPORTE-CRM-EMAIL-SISTEMA.md`.');
  W();
  W('## TL;DR — qué tienes que hacer');
  W();
  W('1. **Dar de alta ' + prov.length + ' piezas nuevas** en el catálogo raíz (§2), con TU numeración, ancladas por su EmailName.');
  W('2. **Corregir** 2 piezas de AON (P025/P027) y separar Pro Plan por mascota (§3).');
  W('3. **Agregar la columna `EmailID`** al catálogo raíz (§4) y entender que la llave es el EmailName, no el número de pieza.');
  W('4. **Mapear en tus skills las columnas nuevas** de las DEs de reporte (§5) — subject, IDs, FUP, unsubs únicos/totales, audiencia y volumen.');
  W('5. **Consumir 2 DEs nuevas**: `CRM_Email_Links` (clicks por botón, §6) y `CRM_Audiencias` (audiencia+volumen, §7).');
  W();
  W('---');
  W('## 1. La llave/identidad es EmailName — NO el ConfigKey');
  W();
  W('🔴 **Para tu normalizador:** identifica cada pieza por su **`EmailName`** (= EmailName');
  W('exacto de SFMC). **NO uses `ConfigKey` ni el número de pieza como identidad** — te confunden.');
  W();
  W('- **`EmailName`** = la IDENTIDAD real. Único (0 duplicados). Es lo que debe casar tu normalizador.');
  W('- **El número de pieza lo asignas tú/el normalizador — aquí no hay ninguno** (ni ConfigKey ni PiezaID');
  W('  sirven de identidad; el EmailName es la llave).');
  W('- (Si ves un `ConfigKey` en la DE, es solo la PK técnica interna de SFMC — no la uses ni la importes.)');
  W();
  W('---');
  W('## 2. Piezas nuevas a dar de alta (' + prov.length + ')');
  W();
  W('**No llevan número de pieza** (ni ConfigKey ni PiezaID — no sirven). Dales tu número `0XX-P0XX` y');
  W('mételas al catálogo raíz **identificándolas por su EmailName** (la llave real). Las dimensiones');
  W('con `*` son inferidas por mí — confírmalas.');
  W();
  W('| Campaña | Touchpoint | Segmento | Tipo | EmailID | EmailName = IDENTIDAD (exacto) |');
  W('|---|---|---|---|---|---|');
  for (const f of prov)
    W(`| ${f.Campana} | ${f.Touchpoint} | ${f.Segmento} | ${f.EmailType} | \`${f.EmailID}\` | \`${f.EmailName}\` |`);
  W();
  W('> El EmailName va **EXACTO** (es la llave del match), incluido el final `.NA`/`_NA` y mayúsculas.');
  W('> Detalle por campaña: Pro Plan en `PURINA-RESULTADOS.md`; AON/Nescafé/Maggi en `REPORTE-EMAIL-NUEVOS-Y-LINKS.md`.');
  W();
  W('---');
  W('## 3. Correcciones a piezas existentes');
  W();
  W('**AON — 2 EmailName corregidos (ya aplicado en SFMC, replícalo en la raíz):**');
  W('- `001-P025`: su EmailName pasó de TRADITIONAL-PARENTS (marzo) a **`…PURCHASE-EP1_AC_EM_A_V1_863587`** (abril, asset 80879, 38,093 envíos).');
  W('- `001-P027`: pasó a **`…FUP-PURCHASE-EP1_AC_EM_A_V1_863587`** (abril, asset 81286, 29,136 envíos).');
  W('- Eran las filas de abril con el nombre de marzo (duplicaban a P005/P006). Ya no hay duplicados.');
  W();
  W('**AON — journey IDs:** `803867` (marzo, por perfil) y `863587` (abril-mayo, por compra) son **dos');
  W('journeys distintos**, no un typo. Ver `CATALOGO-CORRECCIONES.md`.');
  W();
  W('**Pro Plan — separar por mascota:** cada correo salió 3 veces (Perros/Gatos/Mixto). El catálogo');
  W('debe tener una fila por mascota. Ver `CATALOGO-CORRECCIONES.md` §3 y `PURINA-RESULTADOS.md`.');
  W();
  W('---');
  const cfgF = await campos('03A9BE5F-0C95-4901-BEB9-3A3BEBF77C6D');
  W('## 4. Columna nueva en el catálogo: `EmailID`');
  W();
  W('`CRM_Reporte_Config` ahora tiene **`EmailID`** (Number). Es el identificador del **creativo** en');
  W('SFMC: sobrevive a los renombres y sirve para detectar cuándo dos filas apuntan al mismo correo.');
  W('**No es la llave** (un mismo creativo se reusa entre campañas/meses). La llave es el EmailName.');
  W('Agrega esta columna a tu catálogo raíz. Esquema actual del catálogo:');
  W();
  W('| # | Columna | Tipo | Nueva |');
  W('|---|---|---|---|');
  cfgF.forEach((f, i) => W(`| ${i + 1} | \`${f.name}\`${f.pk ? ' 🔑' : ''} | ${f.type}${f.len && f.type === 'Text' ? '(' + f.len + ')' : ''} | ${NUEVAS.has(f.name) ? '🆕' : LEGACY.has(f.name) ? 'legacy → usar EmailName' : INUTIL.has(f.name) ? 'no usar (interno)' : ''} |`));
  W();
  W('---');
  W('## 5. Columnas nuevas en las DEs de reporte (para tus skills)');
  W();
  W('Tus skills que leen los datos de email deben **mapear estas columnas nuevas**. Esquemas en vivo:');
  W();
  for (const [nombre, ck, rol] of DES) {
    if (nombre === 'CRM_Reporte_Config') continue;
    const fs2 = await campos(ck);
    const nuevas = fs2.filter(f => NUEVAS.has(f.name)).map(f => f.name);
    W(`### \`${nombre}\` — ${rol}`);
    W();
    W('| # | Columna | Tipo | Nueva |');
    W('|---|---|---|---|');
    fs2.forEach((f, i) => W(`| ${i + 1} | \`${f.name}\`${f.pk ? ' 🔑' : ''} | ${f.type}${f.len && f.type === 'Text' ? '(' + f.len + ')' : ''} | ${NUEVAS.has(f.name) ? '🆕' : LEGACY.has(f.name) ? 'legacy → usar EmailName' : INUTIL.has(f.name) ? 'no usar (interno)' : ''} |`));
    if (nuevas.length) W('\n**Nuevas aquí:** ' + nuevas.map(x => '`' + x + '`').join(', '));
    W();
  }
  W('**Qué significan las nuevas (las que más te sirven en el reporte):**');
  W();
  W('| Columna | Qué es |');
  W('|---|---|');
  W('| `Email_Subject` | el asunto real que salió |');
  W('| `Email_ID` | identidad del creativo (no es llave) |');
  W('| `Es_FUP` | Si/No leído del nombre en SFMC (separa Follow Up del principal) |');
  W('| `Journey_Name` / `Journey_UUID` | journey del envío (vacío en one-shots, y está bien) |');
  W('| `Journey_ID_Datorama` | el número final del EmailName (cruza con Datorama) |');
  W('| `Email_Total_Unsubs` / `Email_Unique_Unsubs` | bajas totales vs suscriptores distintos |');
  W('| `Audience_DE` | nombre de la DE que activó el journey (la audiencia) |');
  W('| `Audience_Volume` | tamaño de esa audiencia (COUNT actual de la DE) |');
  W('| `Piezas_Mismo_Asset` | (en Piezas) >1 = dos piezas apuntan al mismo correo |');
  W();
  W('---');
  W('## 6. DE nueva: `CRM_Email_Links` — clicks por link/botón');
  W();
  W('Una fila por **link de cada pieza**. Sirve para reportar cuántos clicks lleva cada botón de un');
  W('correo. `Link_Name` es el nombre del botón (ej. `[Facebook]`, `[ver-producto]`), `Link_URL` el');
  W('destino, y `Clicks_Total` / `Clicks_Unique` los clicks. Se une a las demás por `ConfigKey`.');
  W('Si algún skill reporta clicks, aquí está el desglose por botón (validado: suma por link == total de la pieza).');
  W();
  W('---');
  W('## 7. DE nueva: `CRM_Audiencias` — audiencia + volumen por pieza');
  W();
  W('Mapea cada pieza (`ConfigKey`) a la **DE que la activa** (`Audience_DE`) y su **volumen**');
  W('(`Audience_Volume`). Se une por `ConfigKey`. Detalle y Piezas ya la traen incorporada como');
  W('`Audience_DE` / `Audience_Volume`, así que tus skills la leen de ahí directamente.');
  W();
  W('---');
  W('## 8. Los IDs — para no confundirlos');
  W();
  W('| ID | Qué identifica | ¿Es llave? |');
  W('|---|---|---|');
  W('| **EmailName** | la pieza/correo | ✅ **sí, la llave del catálogo** |');
  W('| `Email_ID` / `EmailID` | el creativo en SFMC | ❌ no (se reusa) |');
  W('| `Journey_UUID` | el journey (GUID de SFMC) | — |');
  W('| `Journey_ID_Datorama` | número final del EmailName (cruza con Datorama) | — |');
  W('| `ConfigKey` / número de pieza | alias interno | interno, tuyo |');
  W();
  W('Detalle: `~/.claude/tools/_mcp-sfmc/docs/IDENTIDAD-DE-PIEZAS.md`.');
  W();
  W('---');
  W('## 9. Qué actualizar en tus skills (resumen accionable)');
  W();
  W('1. **Catálogo raíz:** agrega columna `EmailID`; da de alta las ' + prov.length + ' piezas nuevas; aplica las');
  W('   correcciones de AON (P025/P027) y la separación de Pro Plan por mascota.');
  W('2. **Skills que leen email:** mapea las columnas nuevas de `CRM_Email_Detalle`/`CRM_Email_Piezas`');
  W('   (subject, Email_ID, Es_FUP, Journey_*, unsubs únicos+totales, Audience_DE, Audience_Volume).');
  W('3. **Si reportas clicks:** lee `CRM_Email_Links` para el desglose por botón.');
  W('4. **Identifica y une SIEMPRE por `EmailName`**, nunca por ConfigKey ni');
  W('   número de pieza. Las provisionales llevan `PiezaID = *por definir` — no inventes ni asumas número.');
  W('5. **Unsubs:** ahora hay dos (único y total) — usa el que corresponda a tu métrica.');
  W();
  W('---');
  W('_Docs de apoyo: `REPORTE-CRM-EMAIL-SISTEMA.md` (sistema completo) · `CATALOGO-CORRECCIONES.md`');
  W('(AON + Pro Plan) · `REPORTE-EMAIL-NUEVOS-Y-LINKS.md` · `PURINA-RESULTADOS.md` · `AUDIENCIA-POR-PIEZA.md`._');

  fs.writeFileSync('HANDOFF-CATALOGO-RAIZ.md', L.join('\n'), 'utf8');
  console.log('escrito: HANDOFF-CATALOGO-RAIZ.md (' + L.length + ' lineas) · provisionales: ' + prov.length);
})();
