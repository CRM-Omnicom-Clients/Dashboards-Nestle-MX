'use strict';
// Cliente SFMC (REST + SOAP) — portable, sin dependencias.
//  - Token con CACHE y auto-renovacion (el token dura ~18 min; un refresco largo lo sobrevive).
//  - Reintentos SOLO para lecturas (GET / Retrieve / token). Una escritura NUNCA se reintenta: un POST con error de red
//    pudo haberse ejecutado y reintentarlo duplicaria filas.
//  - Toda peticion que NO sea lectura pasa por la guardia (lib/guardia.js). Sin guardia => el cliente es de SOLO LECTURA.
//  - Todo mensaje de error sale redactado (sin secretos ni tokens).
const https = require('https');
const { redact, registrarSecreto, esUrlSfmc, DOMINIO_SFMC } = require('./credenciales');
const { resumen } = require('./xml');
const { ErrorEscritura, crearGuardia } = require('./guardia');
const { RegistroTemp } = require('./temp');

class ErrorSfmc extends Error {
  constructor(msg, extra) { super(msg); this.name = 'ErrorSfmc'; Object.assign(this, extra || {}); }
}
const dormirReal = (ms) => new Promise(r => setTimeout(r, ms));

class ClienteSfmc {
  constructor(cred, { guardia = null, httpsRequest = null, ahora = Date.now, dormir = dormirReal } = {}) {
    // 🔴 Ultima barrera: aunque alguien arme la credencial a mano, el cliente solo habla con hosts de SFMC (por https). Un secret nunca sale hacia otro dominio.
    for (const clave of ['authUrl', 'restUrl', 'soapUrl']) {
      if (!esUrlSfmc(cred && cred[clave])) throw new ErrorSfmc(`La credencial trae ${clave} = "${String(cred && cred[clave]).slice(0, 60)}", que no es un host https de SFMC (…${DOMINIO_SFMC}): el kit nunca envía credenciales a otro dominio.`);
    }
    registrarSecreto(cred.clientSecret);
    this.cred = { ...cred };
    this.guardia = guardia;
    this.ahora = ahora;
    this.dormir = dormir;
    this._agent = httpsRequest ? null : new https.Agent({ keepAlive: true, maxSockets: 6 });
    this._request = httpsRequest || ((o, cb) => https.request({ ...o, agent: this._agent }, cb));
    this._tok = null; this._expira = 0; this._scopes = []; this._pendiente = null;
  }

  get mid() { return this.cred.accountId; }
  get scopes() { return this._scopes.slice(); }
  _secretos() { return [this.cred.clientSecret, this._tok].filter(Boolean); }
  _txt(s) { return redact(s, this._secretos()); }

  // ---------- transporte ----------
  _unaVez(urlBase, ruta, metodo, headers, cuerpo, timeoutMs) {
    const u = new URL(urlBase);
    return new Promise((resolve) => {
      const h = { ...headers };
      if (cuerpo != null) h['Content-Length'] = Buffer.byteLength(cuerpo);
      const req = this._request({ host: u.host, path: ruta, method: metodo, headers: h, timeout: timeoutMs }, (res) => {
        let d = '';
        if (res.setEncoding) res.setEncoding('utf8');
        res.on('data', (c) => { d += c; });
        res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch { /* no es JSON (SOAP/HTML) */ } resolve({ status: res.statusCode, json: j, raw: d }); });
      });
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, json: null, raw: '', error: 'ETIMEDOUT' }); });
      req.on('error', (e) => resolve({ status: 0, json: null, raw: '', error: e.code || e.message }));
      if (cuerpo != null) req.write(cuerpo);
      req.end();
    });
  }
  /** Con reintentos (backoff 1s, 2s…) ante red caida / 429 / 502-504. reintentos=0 para escrituras. */
  async http(urlBase, ruta, metodo, headers, cuerpo, { timeoutMs = 60000, reintentos = 2 } = {}) {
    for (let i = 0; ; i++) {
      const r = await this._unaVez(urlBase, ruta, metodo, headers, cuerpo, timeoutMs);
      const transitorio = r.status === 0 || r.status === 429 || r.status === 502 || r.status === 503 || r.status === 504;
      if (!transitorio || i >= reintentos) return r;
      await this.dormir(1000 * Math.pow(2, i));
    }
  }

  // ---------- token ----------
  _errorToken(r) {
    const j = r.json || {};
    const desc = this._txt(String(j.error_description || r.raw || r.error || '')).slice(0, 200);          // primero se REDACTA y luego se recorta: al revés, el corte parte un secret y deja una mitad a la vista
    let guia;
    if (r.status === 0) guia = 'Sin respuesta de red (' + r.error + ').';
    else if (/client ID/i.test(desc)) guia = 'El CLIENT_ID no existe en este tenant: ¿el package se borró o expiró, o el AUTH_URI es de otro tenant?';
    else if (/business unit|account/i.test(desc)) guia = 'Apunta al MID (account_id).';
    else guia = '"invalid_client" no distingue entre secret, client id y MID equivocados: revisa los tres (docs/CONEXION.md).';
    return new ErrorSfmc('No pude obtener token de SFMC (HTTP ' + r.status + '): ' + desc + '\n  → ' + guia, { status: r.status, tipo: 'token' });
  }
  async _postToken(payload) {
    const u = new URL(this.cred.authUrl);
    const r = await this.http(u.origin, u.pathname, 'POST', { 'Content-Type': 'application/json' }, JSON.stringify(payload), { timeoutMs: 30000, reintentos: 2 });
    if (!r.json || !r.json.access_token) throw this._errorToken(r);
    registrarSecreto(r.json.access_token);          // el token tambien es un secreto: cualquier redact() (el de de.js, el de los scripts) lo borra si un error lo repite
    return r.json;
  }
  async _pedirToken() {
    const base = { grant_type: 'client_credentials', client_id: this.cred.clientId, client_secret: this.cred.clientSecret };
    if (!this.cred.accountId) {
      // Descubrir el MID: token sin account_id -> tokenContext.
      const t0 = await this._postToken(base);
      const ctx = await this.http(this.cred.restUrl, '/platform/v1/tokenContext', 'GET', { Authorization: 'Bearer ' + t0.access_token }, null, { timeoutMs: 30000 });
      const mid = String((ctx.json && ctx.json.organization && ctx.json.organization.id) || '');
      if (!mid) throw new ErrorSfmc('No pude descubrir el MID (tokenContext). Defínelo con SFMC_ACCOUNT_ID o MID= en conexion.txt.');
      this.cred.accountId = mid;
    }
    const t = await this._postToken({ ...base, account_id: this.cred.accountId });
    this._tok = t.access_token;
    this._expira = this.ahora() + (Number(t.expires_in) || 1080) * 1000;
    this._scopes = String(t.scope || '').split(/\s+/).filter(Boolean);
    return this._tok;
  }
  /** Token vigente (renueva si faltan <2 min para que expire). Una sola peticion en vuelo. */
  async token(forzar = false) {
    if (!forzar && this._tok && this._expira - this.ahora() > 120000) return this._tok;
    if (!this._pendiente) this._pendiente = this._pedirToken().finally(() => { this._pendiente = null; });
    return this._pendiente;
  }

  // ---------- guardia ----------
  _autorizar(op) {
    if (!this.guardia) {
      throw new ErrorEscritura('Este cliente es de SOLO LECTURA (no tiene guardia de escritura: falta la config del pipeline; corre scripts/descubrir.js). Intento: ' +
        (op.canal === 'rest' ? op.metodo + ' ' + op.ruta : 'SOAP ' + op.accion));
    }
    this.guardia.verificar(op);
  }

  // ---------- REST ----------
  /** Devuelve { status, json, raw } (misma forma que el qd.js viejo). Lecturas con reintento; escrituras via guardia. */
  async rest(rutaCruda, metodo = 'GET', cuerpoCrudo = null, { timeoutMs = 60000 } = {}) {
    // 🔴 Cada valor se convierte UNA sola vez: lo que la guardia juzga es EXACTAMENTE lo que sale al cable. Un objeto con toString/getter/toJSON con estado no puede
    //    ensenarle una cosa a la guardia y mandar otra: la guardia ve el JSON ya serializado y vuelto a leer, y al cable va ese mismo texto.
    const m = String(metodo).toUpperCase();
    const ruta = String(rutaCruda);
    const texto = cuerpoCrudo == null ? null : JSON.stringify(cuerpoCrudo);
    if (texto === undefined) throw new ErrorSfmc('El cuerpo no se puede convertir a JSON (¿una función o un valor sin forma?): no se envía nada.');
    const cuerpo = texto == null ? null : JSON.parse(texto);
    if (m !== 'GET') this._autorizar({ canal: 'rest', metodo: m, ruta, cuerpo });
    const reintentos = m === 'GET' ? 2 : 0;
    const una = async () => {
      const tok = await this.token();
      return this.http(this.cred.restUrl, ruta, m, { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, texto, { timeoutMs, reintentos });
    };
    let r = await una();
    if (r.status === 401) { await this.token(true); r = await una(); }
    return r;
  }
  /** Como rest() pero lanza ErrorSfmc si HTTP >= 300. */
  async restOk(ruta, metodo = 'GET', cuerpo = null, opts) {
    const r = await this.rest(ruta, metodo, cuerpo, opts);
    if (r.status < 200 || r.status >= 300) {
      throw new ErrorSfmc(String(metodo).toUpperCase() + ' ' + String(ruta).split('?')[0] + ' -> HTTP ' + r.status + ': ' + this._txt(String(r.raw || r.error || '')).slice(0, 300), { status: r.status });
    }
    return r;
  }
  /** Recorre una lista REST paginada ($page/$pagesize) y devuelve todos los items. */
  async paginar(rutaBase, { tam = 50, max = 80 } = {}) {
    const todos = [];
    for (let pag = 1; pag <= max; pag++) {
      const sep = rutaBase.includes('?') ? '&' : '?';
      const r = await this.restOk(`${rutaBase}${sep}$page=${pag}&$pagesize=${tam}`);
      const it = (r.json && r.json.items) || [];
      todos.push(...it);
      const total = Number(r.json && r.json.count) || 0;
      if (!it.length || (total && pag * tam >= total)) break;
    }
    return todos;
  }

  // ---------- SOAP ----------
  /** Devuelve el XML crudo. Retrieve es lectura (con reintento); Create/Update/Delete pasan por la guardia y NO se reintentan. */
  async soap(accionCruda, interiorCrudo, { timeoutMs = 120000 } = {}) {
    const accion = String(accionCruda), interior = String(interiorCrudo);          // una sola conversion: la guardia juzga lo mismo que se envia (ver rest())
    const lectura = accion === 'Retrieve';
    if (!lectura) this._autorizar({ canal: 'soap', accion, xml: interior });
    const msg = { Retrieve: 'RetrieveRequestMsg', Create: 'CreateRequest', Update: 'UpdateRequest', Delete: 'DeleteRequest' }[accion];
    if (!msg) throw new ErrorSfmc('Acción SOAP no soportada: ' + accion);
    const host = new URL(this.cred.soapUrl).host;
    const una = async () => {
      const tok = await this.token();
      const env = `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"><s:Header><a:Action s:mustUnderstand="1">${accion}</a:Action><a:To s:mustUnderstand="1">https://${host}/Service.asmx</a:To><fueloauth xmlns="http://exacttarget.com">${tok}</fueloauth></s:Header><s:Body><${msg} xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${interior}</${msg}></s:Body></s:Envelope>`;
      return this.http(this.cred.soapUrl, '/Service.asmx', 'POST', { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: accion }, env, { timeoutMs, reintentos: lectura ? 2 : 0 });
    };
    let r = await una();
    if (r.status === 401 || /<(?:\w+:)?faultstring>[^<]*(token|not authorized|authentication)/i.test(r.raw)) { await this.token(true); r = await una(); }
    if (r.status === 0) throw new ErrorSfmc('SOAP ' + accion + ' sin respuesta (' + r.error + ')');
    return r.raw;
  }
  /** soap() + exige estado OK (o MoreDataAvailable). Devuelve { xml, res }. */
  async soapOk(accion, interior, opts) {
    const xml = await this.soap(accion, interior, opts);
    const res = resumen(xml);
    if (res.fault || !res.ok) throw new ErrorSfmc('SOAP ' + accion + ' falló: ' + this._txt(String(res.fault || (res.estado + ' · ' + res.mensajes.join(' | ')))).slice(0, 400), { soap: res });
    return { xml, res };
  }

  cerrar() { if (this._agent) { this._agent.destroy(); this._agent = null; } }
}

/** Fabrica: con cfg => cliente con guardia (escritura solo del reporte); sin cfg => SOLO LECTURA. */
function crearCliente({ cred, cfg = null, registro = new RegistroTemp(), instalacion = null, ...resto } = {}) {
  const guardia = cfg ? crearGuardia({ cfg, registro, instalacion }) : null;          // `instalacion` solo lo pasa un script instalador (ver guardia.js: MODO INSTALACION)
  const cli = new ClienteSfmc(cred, { guardia, ...resto });
  cli.registro = registro;
  return cli;
}

module.exports = { ClienteSfmc, crearCliente, ErrorSfmc };
