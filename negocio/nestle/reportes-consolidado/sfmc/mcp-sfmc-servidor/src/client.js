import axios from 'axios';
import { getToken } from './auth.js';

// --- Utilidades XML compartidas ---
// En un nodo de texto XML el & SIEMPRE viene escapado (si no, el documento no sería
// bien formado). Sin des-escapar, toda URL con UTMs vuelve con &amp; literal y cualquier
// nombre con & sale corrupto. Verificado 3-ago-2026 contra URLs reales de Nestlé.
export function xmlUnesc(s) {
  if (typeof s !== 'string' || s.indexOf('&') === -1) return s;
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');   // al final: si no, re-expande las demás entidades
}

// Escapa un valor para meterlo en un nodo de texto o en un ObjectType[...] del sobre SOAP.
export function xmlEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sfmcGet(path, params = {}) {
  const token = await getToken();
  const res = await axios.get(`${process.env.SFMC_REST_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

export async function sfmcPost(path, body) {
  const token = await getToken();
  const res = await axios.post(`${process.env.SFMC_REST_URL}${path}`, body, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return res.data;
}

export async function sfmcPatch(path, body) {
  const token = await getToken();
  const res = await axios.patch(`${process.env.SFMC_REST_URL}${path}`, body, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return res.data;
}

export async function sfmcDelete(path) {
  const token = await getToken();
  const res = await axios.delete(`${process.env.SFMC_REST_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

// SOAP: el REST no expone listar/borrar Data Extensions de forma fiable (list da 404).
// Retrieve de DataExtension por SOAP es la vía confiable. Devuelve el XML crudo.
export async function sfmcSoap(action, innerBody) {
  const token = await getToken();
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing">
<s:Header><a:Action s:mustUnderstand="1">${action}</a:Action>
<a:To s:mustUnderstand="1">${process.env.SFMC_SOAP_URL}/Service.asmx</a:To>
<fueloauth xmlns="http://exacttarget.com">${token}</fueloauth></s:Header>
<s:Body>${innerBody}</s:Body></s:Envelope>`;
  const res = await axios.post(`${process.env.SFMC_SOAP_URL}/Service.asmx`, envelope, {
    headers: { 'Content-Type': 'text/xml', SOAPAction: action },
  });
  return res.data;
}
