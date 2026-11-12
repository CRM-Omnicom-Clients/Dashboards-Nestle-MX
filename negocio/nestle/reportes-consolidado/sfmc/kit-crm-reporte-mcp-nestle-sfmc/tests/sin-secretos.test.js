'use strict';
// SEGURIDAD ESTATICA: lo que SEGURIDAD.md promete sobre secretos, escrituras en disco y red, comprobado sobre el codigo mismo.
// Si alguien agrega una escritura, un borrado, un proceso o una llamada a otro dominio, esta prueba falla y obliga a decidirlo a conciencia
// (actualizar la lista de abajo Y docs/SEGURIDAD.md), en vez de que pase por un "pequeño cambio". Nunca imprime lo que encuentra: solo el archivo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { redact } = require('../lib/credenciales');
const { sinBom } = require('../lib/textoseguro');
const { dirEstado } = require('../lib/paths');
const S = require('../lib/snapshot');

const RAIZ = path.resolve(__dirname, '..');
const OMITIR_DIR = new Set(['node_modules', '.git', 'snapshot']);                          // snapshot/ es local: se revisa aparte
const LOCAL = path.join('config', 'pipeline.config.json');                                  // local (IDs de la BU): se revisa aparte
function* archivos(dir = RAIZ) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name); const rel = path.relative(RAIZ, p);
    if (e.isDirectory()) { if (!OMITIR_DIR.has(e.name)) yield* archivos(p); } else if (rel !== LOCAL) yield rel;
  }
}
const norm = (f) => f.replace(/\\/g, '/');
const TODOS = [...archivos()].sort();
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const CODIGO = TODOS.filter(f => /^(lib|scripts)[\\/][^\\/]+\.js$/.test(f));
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');   // "https://" (precedido de ":") se conserva

// Entradas FALSAS a proposito, para probar que el redactor las borra. (a) Los tokens del HTTP falso de las pruebas ("Bearer tok-1", "tok-2"…) son sinteticos por construccion.
// (b) Dos lineas concretas, [archivo, texto]: una excepcion nueva se decide a conciencia. Se arman por partes para que ESTE archivo no contenga el patron que describe.
const PORTADOR = ['Bear', 'er '].join('');
const FALSOS_DE_PRUEBA = [['tests/credenciales.test.js', 'Authorization: ' + PORTADOR + '${jwt}'], ['tests/snapshot.test.js', "'" + PORTADOR + 'abcdefghijklmnop' + "'"]];
const TOKEN_DEL_HTTP_FALSO = new RegExp(PORTADOR + 'tok-\\d+', 'g');
const sinFalsos = (f, t) => t.replace(TOKEN_DEL_HTTP_FALSO, 'token-falso').split('\n').filter(l => !FALSOS_DE_PRUEBA.some(([a, s]) => norm(f) === a && l.includes(s))).join('\n');

test('hay codigo que revisar (la prueba no es vacia)', () => {
  assert.ok(CODIGO.length >= 25, `solo ${CODIGO.length} archivos de lib/ y scripts/`); assert.ok(TODOS.length >= 50);
});
test('las excepciones de falsos de prueba existen de verdad (si una linea desaparece, se quita de la lista)', () => {
  for (const [f, s] of FALSOS_DE_PRUEBA) assert.ok(leer(f).includes(s), `${f} ya no contiene «${s}»: quita la excepcion`);
});
test('ningun archivo del kit lleva algo con forma de secreto o de token (se revisa TODO, pruebas y guias incluidas)', () => {
  const sucios = TODOS.filter(f => /\.(js|cjs|mjs|json|md|txt|ya?ml|ps1|sh|sql|example)$/i.test(f) || path.basename(f).startsWith('.')).filter(f => { const t = sinFalsos(f, leer(f)); return redact(t) !== t; });
  assert.deepEqual(sucios, [], 'archivos con forma de secreto (no se muestra el contenido)');
});
test('no hay archivos de credenciales ni llaves en el arbol del kit', () => {
  const malos = TODOS.filter(f => /^conexion.*\.(txt|json|env|ini|cfg|conf|ya?ml)$/i.test(path.basename(f)) || /^\.env/i.test(path.basename(f)) || /\.(pem|key|pfx|p12|secret|crt|jks)$/i.test(f) || /^id_(rsa|ed25519|ecdsa)/.test(path.basename(f)));
  assert.deepEqual(malos, []);
});
test('.gitignore deja fuera todo lo local o secreto', () => {
  const lineas = leer('.gitignore').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  for (const necesaria of ['config/pipeline.config.json', 'snapshot/', '.env', 'conexion*.txt', '*.secret', '*.pem']) assert.ok(lineas.includes(necesaria), `.gitignore no lista ${necesaria}`);
});
test('las fotos de referencia versionadas son solo ESTRUCTURA: sin filas de datos y sin campos de credenciales', () => {
  const fotos = TODOS.filter(f => /^tests[\\/]fixtures[\\/].+\.json$/.test(f)); assert.ok(fotos.length >= 1);
  const MALAS = /secret|password|passwd|token|api[_-]?key|authorization|clientsecret/i;
  for (const f of fotos) {
    const visitar = (o, ruta) => {
      if (Array.isArray(o)) return o.forEach((x, i) => visitar(x, `${ruta}[${i}]`));
      if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { assert.ok(k !== 'datos', `${f}: trae filas de datos en ${ruta}.${k}`); assert.ok(!MALAS.test(k), `${f}: tiene un campo "${k}" que suena a credencial`); visitar(v, `${ruta}.${k}`); }
    };
    visitar(JSON.parse(sinBom(leer(f))), '$');
  }
});
test('lo local que ya exista (la config y las fotos de esta maquina: en la carpeta de estado, o dentro del kit si quedaron de una version vieja) tampoco lleva secretos', () => {
  for (const cfg of [path.join(RAIZ, LOCAL), path.join(dirEstado(), 'pipeline.config.json')]) if (fs.existsSync(cfg)) { const t = fs.readFileSync(cfg, 'utf8'); assert.equal(redact(t), t, 'la config local tiene algo con forma de secreto'); }
  for (const dir of [path.join(RAIZ, 'snapshot'), path.join(dirEstado(), 'snapshot')]) {
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) assert.equal(S.contieneSecreto(JSON.parse(sinBom(fs.readFileSync(path.join(dir, f), 'utf8')))), false, `snapshot/${f} tiene algo con forma de secreto`);
  }
});

// ---------- escrituras en disco, procesos y red ----------
const ESCRIBEN = ['lib/config.js', 'lib/snapshot.js'];                                    // los UNICOS: la config (descubrir.js) y las fotos (snapshot.js); ambos via paths.exigirEscrituraSegura
// fs, fs.promises y el alias fsp (el unico alias que permite la prueba de abajo). open*/write*/mkdir* tambien cuentan: abrir con "w" o escribir por descriptor escribe igual que writeFile.
const FS_ESCRIBE = /\b(?:fs(?:\.promises)?|fsp)\.(writeFile|writeFileSync|appendFile|appendFileSync|rename|renameSync|copyFile|copyFileSync|cp|cpSync|createWriteStream|truncate|truncateSync|ftruncate|ftruncateSync|symlink|symlinkSync|link|linkSync|mkdtemp|mkdtempSync|mkdir|mkdirSync|open|openSync|write|writeSync|writev|writevSync|chmod|chmodSync|fchmod|fchmodSync|lchmod|lchmodSync|chown|chownSync|fchown|fchownSync|lchown|lchownSync|utimes|utimesSync|futimes|futimesSync|lutimes|lutimesSync)\b/;
const FS_BORRA = /\b(?:fs(?:\.promises)?|fsp)\.(unlink|unlinkSync|rm|rmSync|rmdir|rmdirSync)\b/;

test('todo acceso al modulo fs se hace como fs.* (para que estas pruebas lo vean): sin imports desestructurados, con otro nombre ni require("fs") en linea', () => {
  for (const f of CODIGO) {
    const t = sinComentarios(leer(f));
    for (const m of t.matchAll(/require\(\s*['"](?:node:)?fs(?:\/promises)?['"]\s*\)/g)) {
      const antes = t.slice(Math.max(0, m.index - 40), m.index);
      assert.match(antes, /(?:^|[^\w.])(?:const|let|var)\s+(?:fs|fsp)\s*=\s*$/, `${f}: importa fs desestructurado, con otro nombre o lo usa en linea (require('fs').x): no lo vería esta revisión`);
    }
    assert.ok(!/\bimport\b[^;\n]*\bfrom\s+['"](?:node:)?fs/.test(t), `${f}: importa fs con import`);
  }
});
test('no hay require dinamico, ni import(), ni eval, ni new Function, ni vm: lo que se carga y lo que se ejecuta se ve en el texto', () => {
  for (const f of CODIGO) {
    const t = sinComentarios(leer(f));
    for (const m of t.matchAll(/(?<![\w.])require\s*\(\s*([^)]*?)\s*\)/g)) assert.match(m[1], /^(['"])[^'"]+\1$/, `${f}: require con un argumento que no es un texto literal`);
    assert.ok(!/(?<![\w.])import\s*\(/.test(t), `${f}: usa import(): carga codigo que esta revision no ve`);
    assert.ok(!/(?<![\w.])eval\s*\(|new\s+Function\s*\(|\brequire\(\s*['"](?:node:)?vm['"]|process\.binding\s*\(/.test(t), `${f}: usa eval, new Function, vm o process.binding`);
  }
});
test('el kit solo ESCRIBE archivos en dos modulos (config y fotos) y NUNCA borra uno', () => {
  const escriben = CODIGO.filter(f => FS_ESCRIBE.test(sinComentarios(leer(f)))).map(norm).sort();
  assert.deepEqual(escriben, ESCRIBEN, 'cambió quién escribe en disco: revisa que pase por paths.exigirEscrituraSegura y actualiza esta lista y docs/SEGURIDAD.md');
  assert.deepEqual(CODIGO.filter(f => FS_BORRA.test(sinComentarios(leer(f)))).map(norm), [], 'el kit no borra archivos locales (lo temporal vive en SFMC y lo borra la guardia)');
  for (const f of ESCRIBEN) assert.match(leer(f), /exigirEscrituraSegura\(/, `${f} escribe sin pasar por exigirEscrituraSegura`);
});
test('el kit no lanza procesos (ni spawn, ni execSync, ni child_process); .exec( de las expresiones regulares no cuenta', () => {
  const mal = CODIGO.filter(f => /child_process|(?<![.\w])(execSync|execFile|execFileSync|spawn|spawnSync|fork)\s*\(/.test(sinComentarios(leer(f))));
  assert.deepEqual(mal.map(norm), []);
});
test('solo habla con SFMC: https unicamente en lib/sfmc.js, nada de fetch/http/net/websockets, y las URLs del codigo son de marketingcloudapis.com', () => {
  const usaHttps = CODIGO.filter(f => /require\(\s*['"](?:node:)?https['"]\s*\)/.test(leer(f))).map(norm); assert.deepEqual(usaHttps, ['lib/sfmc.js']);
  const mal = CODIGO.filter(f => /require\(\s*['"](?:node:)?(?:http|http2|net|tls|dgram|dns|worker_threads|cluster)['"]\s*\)|\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b/.test(sinComentarios(leer(f))));
  assert.deepEqual(mal.map(norm), []);
  const NAMESPACES_XML = ['www.w3.org', 'schemas.xmlsoap.org', 'exacttarget.com'];         // identificadores xmlns del sobre SOAP: JAMAS se piden por red
  for (const f of CODIGO) for (const m of sinComentarios(leer(f)).matchAll(/https?:\/\/([^\s'"`/)\\]+)/g)) {
    const host = m[1].replace(/^\$\{[^}]*\}\.?/, '');                                      // https://${tenant}.auth.marketingcloudapis.com -> auth.marketingcloudapis.com
    if (NAMESPACES_XML.includes(host)) { assert.ok(['lib/sfmc.js', 'lib/xml.js'].includes(norm(f)), `${f}: cita ${host} fuera del sobre SOAP`); continue; }
    assert.match(host, /(^|\.)marketingcloudapis\.com$|^$/, `${f}: llama o cita un dominio que no es de SFMC: ${m[1].slice(0, 60)}`);
  }
});

// ---------- lo que NUNCA debe aparecer: barandales que cuestan una linea y evitan un descuido caro ----------
test('nunca se relaja la verificacion TLS: ni rejectUnauthorized, ni NODE_TLS_REJECT_UNAUTHORIZED, ni checkServerIdentity, ni opciones de cifrado propias', () => {
  const mal = CODIGO.filter(f => /rejectUnauthorized|NODE_TLS_REJECT_UNAUTHORIZED|strictSSL|checkServerIdentity|\binsecure\b|secureOptions|secureProtocol|\bciphers\s*:|\bminVersion\b|\bmaxVersion\b/.test(sinComentarios(leer(f))));
  assert.deepEqual(mal.map(norm), []);
});
test('el kit no modifica el entorno del proceso: process.env se LEE, nunca se escribe, se borra ni se reemplaza', () => {
  const mal = CODIGO.filter(f => /process\.env(?:\.\w+|\[[^\]]+\])\s*(?:=(?!=)|\+=|\|\|=|\?\?=)|Object\.assign\(\s*process\.env|delete\s+process\.env|process\.env\s*=(?!=)/.test(sinComentarios(leer(f))));
  assert.deepEqual(mal.map(norm), []);
});
test('las credenciales no se vuelcan: ni JSON.stringify / util.inspect / console.dir de la credencial, ni el secret o el token metidos en un texto armado a mano', () => {
  const mal = [];
  for (const f of CODIGO) {
    const t = sinComentarios(leer(f));
    if (/JSON\.stringify\(\s*(?:this\.)?cred\b|\butil\.inspect|\bconsole\.dir\b/.test(t)) mal.push(norm(f) + ': vuelca la credencial o inspecciona objetos');
    if (/\$\{[^}]*(?:clientSecret|_tok\b|access_token)/.test(t)) mal.push(norm(f) + ': mete el secret o el token en una plantilla de texto');
    if (/(?:clientSecret|\._tok\b)\s*\+\s*['"`]|['"`]\s*\+\s*(?:this\.)?(?:cred\.)?(?:clientSecret|_tok\b)/.test(t)) mal.push(norm(f) + ': concatena el secret o el token a un texto');
  }
  assert.deepEqual(mal, []);
});
test('los encabezados de credencial (Authorization, fueloauth) solo se arman en lib/sfmc.js: ningun otro modulo puede mandar el token a ningun lado', () => {
  assert.deepEqual(CODIGO.filter(f => /\bAuthorization\b|\bfueloauth\b/i.test(sinComentarios(leer(f)))).map(norm), ['lib/sfmc.js']);
});

// ---------- texto invisible y salida a la terminal ----------
// "Trojan Source": un caracter bidireccional o de ancho cero dentro del codigo, de una guia o de una prueba hace que lo que se LEE no sea lo que se EJECUTA (o se sigue).
// Se revisa TODO texto del kit. El salto de linea, el retorno y el tabulador son normales; cualquier otro que no se ve es un hallazgo. Se reporta archivo, linea:columna y codigo, nunca el contenido.
const INVISIBLE_O_CONTROL = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cn}\p{Cs}]/gu;
const hallazgosInvisibles = (texto) => {
  const out = [];
  texto.split('\n').forEach((linea, i) => { for (const m of linea.matchAll(INVISIBLE_O_CONTROL)) if (m[0] !== '\r' && m[0] !== '\t') out.push(`${i + 1}:${m.index + 1} U+${m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`); });
  return out;
};
const ES_TEXTO = (f) => /\.(js|cjs|mjs|json|md|txt|ya?ml|ps1|sh|sql|example)$/i.test(f) || path.basename(f).startsWith('.');

test('la revision de invisibles NO es vacia: detecta un BOM, un RLO, un ancho cero, un tag character, un ESC y un NEL (y deja pasar acentos, emojis, tabuladores y retornos)', () => {
  for (const n of [0xfeff, 0x202e, 0x200b, 0xe0041, 0x1b, 0x2066, 0x85]) assert.equal(hallazgosInvisibles('a' + String.fromCodePoint(n) + 'b').length, 1, `U+${n.toString(16)} debia detectarse`);
  assert.deepEqual(hallazgosInvisibles('Café ñ → ⚠️ ' + String.fromCodePoint(0x1f600) + '\tx\r'), []);
});
test('ningun archivo de texto del kit lleva caracteres invisibles o de control bidireccional (Trojan Source), ni siquiera un BOM: ni en el codigo, ni en las guias, ni en las pruebas', () => {
  const malos = {};
  for (const f of TODOS.filter(ES_TEXTO)) { const h = hallazgosInvisibles(leer(f)); if (h.length) malos[norm(f)] = h.slice(0, 5); }
  assert.deepEqual(malos, {}, 'hay caracteres invisibles (archivo → linea:columna codigo). Si una prueba necesita uno, construyelo con String.fromCodePoint');
});
test('toda salida de los scripts pasa por la salida segura: cada script llama ejecutar(main), nadie escribe directo en stdout/stderr y nadie imprime JSON por su cuenta (salidaJson / jsonSeguro)', () => {
  const scripts = CODIGO.filter(f => /^scripts[\\/]/.test(f)); assert.ok(scripts.length >= 8, `solo ${scripts.length} scripts`);
  for (const f of scripts) {
    const t = sinComentarios(leer(f));
    assert.match(t, /\bejecutar\(main\)/, `${f}: no llama ejecutar(main), asi que no tendria la salida segura`);
    assert.ok(!/,\s*null,\s*2\s*\)/.test(t), `${f}: imprime JSON con JSON.stringify(…, null, 2) en vez de salidaJson/jsonSeguro (lo invisible llegaria crudo)`);
  }
  const directo = CODIGO.filter(f => /process\.(?:stdout|stderr)\.write|\bwriteSync\(\s*[12]\s*,/.test(sinComentarios(leer(f)))).map(norm);
  assert.deepEqual(directo, [], 'escribe directo en stdout/stderr: se salta la salida segura');
});
test('ejecutar() instala la salida segura ANTES de correr main (el orden importa: lo primero que imprime main ya sale filtrado)', () => {
  assert.match(sinComentarios(leer('lib/cli.js')), /function ejecutar\(main\)\s*\{\s*instalarSalidaSegura\(\);\s*Promise\.resolve\(\)\.then\(main\)/);
});
