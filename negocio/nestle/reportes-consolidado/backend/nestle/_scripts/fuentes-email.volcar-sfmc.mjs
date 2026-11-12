// fuentes-email · VOLCAR LAS DEs DE SFMC A `_insumos/`. Solo lectura (R14).
//
// 🔴 POR QUÉ UN VOLCADOR Y NO PEDÍRSELO AL MCP DESDE EL CHAT. Un fetch grande nunca entra al
//    contexto: son ~100 filas × 23 campos por DE, y meterlas en la conversación las convierte en
//    algo que hay que volver a copiar a mano para escribirlas. Aquí van del tenant al archivo sin
//    pasar por ningún lado, y lo que se imprime es el CONTEO, no el crudo.
//
// 🔴 Y REUSA EL MÓDULO DEL PROPIO MCP en vez de reimplementar el SOAP. Escribir aquí un segundo
//    cliente sería la copia que diverge: el día que el tenant cambie algo, uno de los dos se
//    entera y el otro no. Se importa el handler que ya corre en producción.
//
// 🔴 R14 · EL MCP DE SFMC ES DE SOLO LECTURA. Este script solo llama `sfmc_get_de_rows`.
//    No crea, no actualiza, no borra. Nada de lo que hace toca el tenant.
import fs from 'fs';
import os from 'os';
import path from 'path';

const MCP = path.join(os.homedir(), '.claude/tools/_mcp-sfmc');
process.chdir(MCP);        // los módulos del MCP resuelven contra SU node_modules, no el mío

// 🔴 LAS CREDENCIALES SE LEEN DE DONDE LAS LEE EL MCP QUE DE VERDAD CORRE: la entrada
//    `mcpServers['sfmc-nestle']` de `~/.claude.json`. El `.env` del MCP existe pero apunta a
//    OTRO tenant (account 534016943, el servidor `sfmc` a secas), y usarlo devolvía «no existe
//    una DE llamada CRM_Email_Piezas» sobre una BU donde efectivamente no están. Dos fuentes de
//    credenciales para el mismo cliente es la copia que diverge, aplicada a la conexión.
// 🔴 Y SE PIDE EL SERVIDOR POR NOMBRE, `sfmc-nestle`, nunca «el primero que diga sfmc»: la BU de
//    Nestlé es la única que este corte puede tocar (R13), y elegirla por prefijo sería adivinar.
const SERVIDOR = 'sfmc-nestle';
const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
const srv = (cfg.mcpServers || {})[SERVIDOR];
if (!srv || !srv.env || !srv.env.SFMC_CLIENT_ID) {
  console.log('🔴 no encontré el servidor «' + SERVIDOR + '» con credenciales en ~/.claude.json.');
  console.log('   Corre primero: node ~/.claude/tools/_mcp-sfmc/conectar.js');
  process.exit(1);
}
for (const [k, v] of Object.entries(srv.env)) process.env[k] = String(v);

const { dataExtensionTools } = await import(new URL('file:///' + path.join(MCP, 'src/tools/data_extensions.js').replace(/\\/g, '/')).href);
const getRows = dataExtensionTools.find(t => t.name === 'sfmc_get_de_rows');
if (!getRows) { console.log('🔴 no encontré `sfmc_get_de_rows` en el módulo del MCP'); process.exit(1); }

const BACK = path.join(os.homedir(), '.claude/reportes-backend/nestle');
// 🔴 LA FECHA DEL VOLCADO ES HOY, NO LA DEL `.env` (4-sep-2026). Tomarla del mtime del `.env`
//    nombró el volcado de hoy como `sfmc-piezas-2026-08-20.txt` — la fecha en que se guardaron
//    las credenciales, que no tiene nada que ver. Y como `insumoVigente` ordena por la fecha del
//    NOMBRE, el volcado más reciente habría quedado como el más antiguo: el corte seguiría
//    leyendo datos de hace dos semanas sin fallar y sin avisar.
const HOY = process.argv[2] || new Date().toISOString().slice(0, 10);

// las cuatro DEs del sistema, con el nombre de archivo que espera cada script del corte
const DES = [
  { de: 'CRM_Email_Piezas', archivo: 'sfmc-piezas-' + HOY + '.txt', quien: 'fuentes-email.email-piezas.js' },
  { de: 'CRM_Email_Links', archivo: 'sfmc-links-' + HOY + '.txt', quien: 'motor.links.js' },
  { de: 'CRM_Email_Detalle', archivo: 'sfmc-detalle-' + HOY + '.txt', quien: 'referencia' }
  // 🔴 `CRM_Email_Performance` NO se vuelca, y no es un fallo: es la tabla por SUSCRIPTOR
  //    (>5,000 filas y creciendo) y ningún script del corte la lee — el bloque de email sale de
  //    `CRM_Email_Piezas`, que ya viene agregada por pieza. Traerla entera costaría minutos y
  //    megas para un dato que nadie consume. Si algún día hace falta, va con su propio tope y su
  //    propio motivo; lo que no se puede es guardarla a medias y que parezca completa.
];

console.log('════════ fuentes-email · VOLCAR SFMC → _insumos ════════\n');
console.log('  tenant: ' + String(process.env.SFMC_AUTH_URL || '').replace(/\/\/([^.]+)\./, '//***.') + '   account: ' + process.env.SFMC_ACCOUNT_ID);
console.log('  fecha del volcado: ' + HOY + '\n');

let fallos = 0;
for (const d of DES) {
  const destino = path.join(BACK, '_insumos', d.archivo);
  let r;
  try {
    r = await getRows.handler({ name: d.de, maxRows: 5000 });
  } catch (e) {
    console.log('  🔴 ' + d.de.padEnd(24) + 'truena: ' + String(e.message).slice(0, 70));
    fallos++; continue;
  }
  if (r.error) {
    console.log('  🔴 ' + d.de.padEnd(24) + r.error + (r.detail ? ' — ' + r.detail : ''));
    fallos++; continue;
  }
  // 🔴 UN VOLCADO TRUNCADO NO SE GUARDA COMO SI FUERA COMPLETO: se declara y no se escribe.
  //    Escribirlo dejaría al corte trabajando sobre media DE creyéndola entera — el mismo
  //    defecto que el lector del maestro descartando tres meses en silencio.
  if (r.truncated) {
    console.log('  🔴 ' + d.de.padEnd(24) + 'TRUNCADO (' + r.retrieved + ' filas): ' + r.warning + ' — NO se escribe');
    fallos++; continue;
  }
  fs.writeFileSync(destino, JSON.stringify(r), 'utf8');
  console.log('  ✔ ' + d.de.padEnd(24) + String(r.count).padStart(6) + ' filas · ' + String(r.fields.length).padStart(2) +
    ' campos · ' + Math.round(fs.statSync(destino).size / 1024) + ' KB   → ' + d.archivo + '   (' + d.quien + ')');
}

// ── qué cambió respecto del volcado anterior, sin abrir el crudo en el chat
console.log('\n  ── contra el volcado anterior');
const dir = path.join(BACK, '_insumos');
for (const d of DES) {
  const base = d.archivo.replace(/-\d{4}-\d{2}-\d{2}\.txt$/, '');
  // 🔴 EL «ANTERIOR» SE ORDENA POR FECHA, NO ALFABÉTICAMENTE. Con `.sort()` a secas,
  //    `sfmc-piezas-20ago.txt` (viejo) queda DESPUÉS de `sfmc-piezas-2026-08-27.txt` (reciente),
  //    así que el diff comparaba contra el volcado más antiguo y reportaba «98 → 102 (+4)»
  //    cuando la DE no había cambiado en absoluto. Un diff que inventa movimiento es peor que
  //    no tener diff: se lee como «llegó data nueva» y no llegó nada.
  const previos = fs.readdirSync(dir).filter(f => f.startsWith(base) && f !== d.archivo)
    .map(f => {
      const m = /-(\d{4})-(\d{2})-(\d{2})\./.exec(f);
      return { f, iso: m ? m[1] + m[2] + m[3] : null, mtime: fs.statSync(path.join(dir, f)).mtimeMs };
    })
    .sort((a, b) => {
      if (a.iso && b.iso) return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0;
      if (a.iso && !b.iso) return 1;
      if (!a.iso && b.iso) return -1;
      return a.mtime - b.mtime;
    })
    .map(x => x.f);
  const ant = previos[previos.length - 1];
  if (!ant) { console.log('     ' + d.de.padEnd(24) + '(no había volcado anterior)'); continue; }
  try {
    const A = JSON.parse(fs.readFileSync(path.join(dir, ant), 'utf8'));
    const Z = JSON.parse(fs.readFileSync(path.join(dir, d.archivo), 'utf8'));
    console.log('     ' + d.de.padEnd(24) + ant.replace(base + '-', '').replace('.txt', '') + ': ' +
      String(A.count).padStart(5) + '  →  hoy: ' + String(Z.count).padStart(5) +
      '   (' + (Z.count - A.count >= 0 ? '+' : '') + (Z.count - A.count) + ')');
  } catch (e) { console.log('     ' + d.de.padEnd(24) + 'no pude comparar contra ' + ant); }
}

console.log('\n  ' + (fallos ? '🔴 ' + fallos + ' DE(s) no se volcaron' : '✅ LAS ' + DES.length + ' DEs VOLCADAS') +
  '   ·   el crudo no pasó por el contexto');
process.exit(fallos ? 1 : 0);
