import { sfmcSoap, xmlUnesc, xmlEsc } from '../client.js';

// El REST /data/v1/messageList/email/sends devuelve 404 en TODOS los tenants — ese endpoint
// no existe en la API de SFMC. Las métricas de envío viven en los objetos SOAP `Send` y
// `*Event`. Verificado 31-jul-2026 contra GEPP (MID 534016943) y Nestlé (MID 10966050).

// --- Helpers SOAP ---
// Los resultados vienen como <Results xsi:type="Send">, así que el regex TIENE que tolerar
// atributos. Un /<Results>/ pelón cuenta 0 filas y parece que no hay datos.
function soapRows(xml, props) {
  const bloques = [...xml.matchAll(/<Results[^>]*>([\s\S]*?)<\/Results>/g)].map(m => m[1]);
  return bloques.map(b => {
    const row = {};
    for (const p of props) {
      const m = new RegExp(`<${p}>([\\s\\S]*?)<\\/${p}>`).exec(b);
      // xmlUnesc: sin esto las URLs con UTMs vuelven con &amp; literal.
      // .trim(): SFMC rellena EmailName a 100 chars y Subject a 200 con espacios —
      // era el 22% del peso de la respuesta y rompía las comparaciones por igualdad.
      if (m) row[p] = xmlUnesc(m[1]).trim();
    }
    return row;
  });
}

const soapStatus = xml => /<OverallStatus>([^<]+)<\/OverallStatus>/.exec(xml)?.[1] || 'Unknown';
const soapMessage = xml => /<StatusMessage>([^<]+)<\/StatusMessage>/.exec(xml)?.[1] || null;

const NS = 'xmlns="http://exacttarget.com/wsdl/partnerAPI"';
const XSI = 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';

function filtroIgual(prop, valor) {
  return `<Filter xsi:type="SimpleFilterPart" ${XSI}><Property>${prop}</Property>` +
    `<SimpleOperator>equals</SimpleOperator><Value>${xmlEsc(valor)}</Value></Filter>`;
}

function filtroFechas(prop, desde, hasta) {
  if (desde && hasta) {
    return `<Filter xsi:type="SimpleFilterPart" ${XSI}><Property>${prop}</Property>` +
      `<SimpleOperator>between</SimpleOperator>` +
      `<Value>${xmlEsc(desde)}</Value><Value>${xmlEsc(hasta)}</Value></Filter>`;
  }
  const op = desde ? 'greaterThan' : 'lessThan';
  return `<Filter xsi:type="SimpleFilterPart" ${XSI}><Property>${prop}</Property>` +
    `<SimpleOperator>${op}</SimpleOperator><Value>${xmlEsc(desde || hasta)}</Value></Filter>`;
}

const LOTES_MAX = 40;

// Retrieve con paginación por RequestID/ContinueRequest.
// 🔴 `truncated` tiene que ser true en TODOS los caminos donde se descartan filas.
// Antes se decidía con el status del lote actual, así que un resultado que cabía en un
// solo lote (<=2500) y era recortado por maxRows salía con truncated:false — se perdían
// filas afirmando que eso era todo. Ahora hay tres causas y se reportan por separado.
async function retrieveAll(objectType, props, filtro, maxRows) {
  const P = props.map(p => `<Properties>${p}</Properties>`).join('');
  const armar = cont => cont
    ? `<RetrieveRequestMsg ${NS}><RetrieveRequest><ContinueRequest>${cont}</ContinueRequest>` +
      `<ObjectType>${objectType}</ObjectType>${P}</RetrieveRequest></RetrieveRequestMsg>`
    : `<RetrieveRequestMsg ${NS}><RetrieveRequest><ObjectType>${objectType}</ObjectType>${P}` +
      `${filtro || ''}</RetrieveRequest></RetrieveRequestMsg>`;

  const rows = [];
  let cont = null, lotes = 0, causa = null;
  do {
    const xml = await sfmcSoap('Retrieve', armar(cont));
    const status = soapStatus(xml);
    if (!/^(OK|MoreDataAvailable)$/.test(status)) {
      return { error: status, detail: soapMessage(xml), rows: rows.slice(0, maxRows), batches: lotes };
    }
    rows.push(...soapRows(xml, props));
    lotes++;
    cont = status === 'MoreDataAvailable' ? /<RequestID>([^<]+)<\/RequestID>/.exec(xml)?.[1] : null;

    if (rows.length >= maxRows) {                       // (1) tope de la tool
      causa = rows.length > maxRows || cont ? 'maxRows' : null;
      break;
    }
    if (cont && lotes >= LOTES_MAX) { causa = 'lotes'; break; }   // (2) tope de lotes
  } while (cont);

  return {
    rows: rows.slice(0, maxRows),
    retrieved: rows.length,
    batches: lotes,
    truncated: causa !== null,
    truncatedBy: causa,
  };
}

const n = v => (v === undefined || v === '' ? 0 : Number(v) || 0);
const pct = (a, b) => (b ? Number(((a / b) * 100).toFixed(2)) : null);

const PROPS_SEND = ['ID', 'EmailName', 'Subject', 'SentDate', 'Status', 'FromName', 'FromAddress',
  'NumberSent', 'NumberDelivered', 'UniqueOpens', 'UniqueClicks',
  'HardBounces', 'SoftBounces', 'OtherBounces', 'Unsubscribes', 'ForwardedEmails'];

function normalizarSend(r) {
  const enviados = n(r.NumberSent), entregados = n(r.NumberDelivered);
  const rebotes = n(r.HardBounces) + n(r.SoftBounces) + n(r.OtherBounces);
  return {
    jobId: n(r.ID),
    emailName: r.EmailName || null,
    subject: r.Subject || null,
    sentDate: r.SentDate || null,
    status: r.Status || null,
    fromName: r.FromName || null,
    sent: enviados,
    delivered: entregados,
    uniqueOpens: n(r.UniqueOpens),
    uniqueClicks: n(r.UniqueClicks),
    hardBounces: n(r.HardBounces),
    softBounces: n(r.SoftBounces),
    otherBounces: n(r.OtherBounces),
    unsubscribes: n(r.Unsubscribes),
    forwards: n(r.ForwardedEmails),
    // Tasas sobre ENTREGADOS, que es el denominador estándar de la industria.
    deliveryRate: pct(entregados, enviados),
    openRate: pct(n(r.UniqueOpens), entregados),
    clickRate: pct(n(r.UniqueClicks), entregados),
    ctor: pct(n(r.UniqueClicks), n(r.UniqueOpens)),
    bounceRate: pct(rebotes, enviados),
    unsubRate: pct(n(r.Unsubscribes), entregados),
  };
}

export const trackingTools = [
  {
    name: 'sfmc_list_sends',
    description: 'Lista envíos de email con sus métricas (enviados, entregados, opens/clicks únicos, bounces, unsubs) y tasas calculadas. Vía SOAP objeto Send — sirve tanto para envíos batch como para los de journey. ⚠️ SIEMPRE pasa dateFrom/dateTo: sin filtro SFMC devuelve del envío MÁS ANTIGUO al más nuevo. Para periodos grandes usa summaryOnly:true — un mes de una BU activa no cabe en la respuesta.',
    inputSchema: {
      type: 'object',
      properties: {
        dateFrom: { type: 'string', description: 'Fecha inicio, ej "2026-07-01" o "2026-07-01T00:00:00"' },
        dateTo: { type: 'string', description: 'Fecha fin, ej "2026-07-31T23:59:59"' },
        nameFilter: { type: 'string', description: 'Filtra por EmailName (contiene, case-insensitive). ⚠️ Se aplica EN CLIENTE sobre lo que se alcanzó a traer: si el resultado salió truncado, un envío que quedó fuera del corte dará 0 resultados aunque exista.' },
        summaryOnly: { type: 'boolean', description: 'Solo totales del periodo, sin el detalle por envío. Úsalo para periodos largos.' },
        maxRows: { type: 'number', description: 'Tope de registros crudos a traer (default 200). Súbelo si truncated sale true.' },
      },
    },
    handler: async ({ dateFrom, dateTo, nameFilter, summaryOnly = false, maxRows = 200 } = {}) => {
      const filtro = (dateFrom || dateTo) ? filtroFechas('SentDate', dateFrom, dateTo) : null;
      const res = await retrieveAll('Send', PROPS_SEND, filtro, maxRows);
      if (res.error) return res;

      let sends = res.rows.map(normalizarSend).filter(s => s.sent > 0);
      if (nameFilter) {
        const nf = nameFilter.toLowerCase();
        sends = sends.filter(s => (s.emailName || '').toLowerCase().includes(nf));
      }
      sends.sort((a, b) => String(b.sentDate).localeCompare(String(a.sentDate)));

      const tot = sends.reduce((a, s) => ({
        sent: a.sent + s.sent, delivered: a.delivered + s.delivered,
        opens: a.opens + s.uniqueOpens, clicks: a.clicks + s.uniqueClicks,
      }), { sent: 0, delivered: 0, opens: 0, clicks: 0 });
      const totales = { ...tot, openRate: pct(tot.opens, tot.delivered), clickRate: pct(tot.clicks, tot.delivered) };

      // 🔴 Si el resultado salió truncado, estos totales NO son los del periodo — son los
      // de un subconjunto arbitrario (SFMC no entrega ordenado). Publicarlos como `totals`
      // hacía que se leyeran como el total del mes: en julio de Nestlé reportaban la mitad
      // de los clicks reales. Por eso cambian de nombre cuando no son confiables.
      const clave = res.truncated ? 'totals_PARCIALES' : 'totals';

      return {
        count: sends.length,
        // `retrieved` es el crudo de SFMC; `count` ya excluye los Send con 0 enviados
        // (borradores, tests abortados) y lo filtrado por nameFilter.
        retrieved: res.retrieved,
        truncated: res.truncated,
        ...(res.truncated ? {
          warning: `INCOMPLETO: se cortó por ${res.truncatedBy === 'lotes' ? 'el tope de ' + LOTES_MAX + ' lotes' : 'maxRows=' + maxRows}. ` +
            `Los totales son de un subconjunto ARBITRARIO, no del periodo. Acota dateFrom/dateTo o sube maxRows.`,
        } : {}),
        ...((!dateFrom && !dateTo) ? { warning_sinFiltro: 'Sin dateFrom/dateTo esto trae los envíos MÁS VIEJOS del tenant, no los recientes.' } : {}),
        [clave]: totales,
        ...(summaryOnly ? {} : { sends }),
      };
    },
  },

  {
    name: 'sfmc_get_send_metrics',
    description: 'Métricas completas de UN envío por su Job ID, con tasas calculadas (delivery, open, click, CTOR, bounce, unsub).',
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      properties: {
        jobId: { type: 'number', description: 'Job ID del envío (Email Studio > Tracking, o sfmc_list_sends)' },
      },
    },
    handler: async ({ jobId }) => {
      const res = await retrieveAll('Send', PROPS_SEND, filtroIgual('ID', jobId), 5);
      if (res.error) return res;
      if (!res.rows.length) return { jobId, found: false, error: `No existe un Send con ID ${jobId} en esta BU.` };
      return { found: true, ...normalizarSend(res.rows[0]) };
    },
  },

  {
    name: 'sfmc_get_bounces',
    description: 'Lista los bounces de un envío (subscriber, fecha, categoría y motivo SMTP). Vía SOAP objeto BounceEvent. Devuelve datos a nivel suscriptor.',
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      properties: {
        jobId: { type: 'number', description: 'Job ID del envío' },
        maxRows: { type: 'number', description: 'Tope de filas (default 500)' },
      },
    },
    handler: async ({ jobId, maxRows = 500 }) => {
      const props = ['SendID', 'SubscriberKey', 'EventDate', 'BounceCategory', 'BounceType', 'SMTPCode', 'SMTPReason'];
      const res = await retrieveAll('BounceEvent', props, filtroIgual('SendID', jobId), maxRows);
      if (res.error) return res;

      const porCategoria = {};
      for (const r of res.rows) {
        const k = r.BounceCategory || r.BounceType || 'sin categoría';
        porCategoria[k] = (porCategoria[k] || 0) + 1;
      }
      return {
        jobId, count: res.rows.length,
        truncated: res.truncated,
        ...(res.truncated ? {
          warning: `INCOMPLETO: se cortó por ${res.truncatedBy === 'lotes' ? 'el tope de lotes' : 'maxRows=' + maxRows}. ` +
            `El desglose byCategory es de ese subconjunto, no del total del envío.`,
        } : {}),
        byCategory: porCategoria,
        bounces: res.rows.map(r => ({
          subscriberKey: r.SubscriberKey, eventDate: r.EventDate,
          category: r.BounceCategory || null, type: r.BounceType || null,
          smtpCode: r.SMTPCode || null, smtpReason: r.SMTPReason || null,
        })),
      };
    },
  },

  {
    name: 'sfmc_get_clicks',
    description: 'Lista los clicks de un envío (subscriber, fecha y URL) y un resumen de clicks por URL. Vía SOAP objeto ClickEvent.',
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      properties: {
        jobId: { type: 'number', description: 'Job ID del envío' },
        maxRows: { type: 'number', description: 'Tope de filas (default 500)' },
        summaryOnly: { type: 'boolean', description: 'Si true, devuelve solo el conteo por URL sin el detalle por suscriptor' },
      },
    },
    handler: async ({ jobId, maxRows = 500, summaryOnly = false }) => {
      const props = ['SendID', 'SubscriberKey', 'EventDate', 'URL'];
      const res = await retrieveAll('ClickEvent', props, filtroIgual('SendID', jobId), maxRows);
      if (res.error) return res;

      const porUrl = {};
      for (const r of res.rows) {
        const u = r.URL || 'sin URL';
        porUrl[u] = (porUrl[u] || 0) + 1;
      }
      const topUrls = Object.entries(porUrl)
        .sort((a, b) => b[1] - a[1])
        .map(([url, clicks]) => ({ url, clicks }));

      return {
        jobId,
        count: res.rows.length,
        uniqueSubscribers: new Set(res.rows.map(r => r.SubscriberKey)).size,
        truncated: res.truncated,
        ...(res.truncated ? {
          warning: `INCOMPLETO: se cortó por ${res.truncatedBy === 'lotes' ? 'el tope de lotes' : 'maxRows=' + maxRows}. ` +
            `topUrls y uniqueSubscribers son de ese subconjunto, no del total del envío.`,
        } : {}),
        topUrls,
        ...(summaryOnly ? {} : {
          clicks: res.rows.map(r => ({
            subscriberKey: r.SubscriberKey, eventDate: r.EventDate, url: r.URL || null,
          })),
        }),
      };
    },
  },
];
