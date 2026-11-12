#!/usr/bin/env node
'use strict';
const { parseArgs, contexto, ejecutar, salidaJson } = require('../lib/cli');
const { agregarPieza, formatearResultado, POR_DEFINIR } = require('../lib/agregar');

const AYUDA = `agregar-pieza.js — da de alta UNA pieza en el catálogo (CRM_Reporte_Config). Por defecto es SIMULACRO.

Uso:  node scripts/agregar-pieza.js --email-name "<EmailName EXACTO de _Job>" --marca "<…>" --campana "<…>" --touchpoint "<…>" [opciones]

  --email-name   🔴 el EmailName EXACTO de _Job (encuéntralo con scripts/resolver-emailname.js). Nunca el código del asset del brief.
  --marca / --campana / --touchpoint   obligatorios. Si algo aún no se sabe, usa "${POR_DEFINIR}".
                 Marca, Campaña y BU deben ser EXACTAS como ya están en el catálogo; Marca ≠ Campaña (nunca cruzadas).
  --bu           si falta se toma la BU que el catálogo usa para esa marca
  --segmento     por defecto "${POR_DEFINIR}"
  --fup          es un Follow Up (EmailType "Follow Up"; si no, "Principal")
  --inferido     dimensiones que TÚ infieres, separadas por coma (bu,marca,campana,touchpoint,segmento): llevan "*" al final
  --notas        texto libre (máx. 200); por defecto "PROVISIONAL - alta <fecha> con agregar-pieza.js."
  --codigo-nc    por defecto se lee del propio EmailName (NC######)
  --configkey    solo en el esquema actual (PK ConfigKey); por defecto TMP-<MARCA>-<TOUCHPOINT>[-FUP]
  --permitir-valores-nuevos   acepta una Marca/Campaña/BU que aún no existe (por defecto es error: evita typos que parten el reporte)
  --escribir     INSERTA la fila. Sin esto solo se muestra qué se haría.
  --json         salida legible por máquina

Este script nunca asigna números de pieza ni identificadores (la columna PiezaID se eliminó el 22-oct-2026; si alguna tabla la conservara, quedaría "${POR_DEFINIR}").
Solo escribe en el catálogo (la guardia lo exige) y relee la fila para comprobar que quedó igual.
Código de salida: 0 simulacro válido / alta verificada · 1 error o rechazo · 2 el EmailName NO existe en _Job · 3 ya está en el catálogo.`;

async function main() {
  const args = parseArgs(process.argv.slice(2), { booleanos: ['fup', 'permitir-valores-nuevos', 'escribir', 'json', 'help'], ayuda: AYUDA });
  if (args.help) { console.log(AYUDA); return 0; }
  const texto = (k) => (args[k] === true || args[k] == null ? undefined : String(args[k]));
  if (!texto('email-name')) { console.log(AYUDA); return 1; }

  const { cli, cfg } = await contexto({ soloLectura: false });
  const entrada = {
    emailName: texto('email-name'), bu: texto('bu'), marca: texto('marca'), campana: texto('campana'), touchpoint: texto('touchpoint'), segmento: texto('segmento'),
    fup: !!args.fup, emailType: texto('email-type'), estado: texto('estado'), notas: texto('notas'), codigoNC: texto('codigo-nc'), configKey: texto('configkey'),
    inferido: texto('inferido'), permitirNuevos: !!args['permitir-valores-nuevos'],
  };
  if (!args.json) console.error(`${args.escribir ? 'ALTA' : 'SIMULACRO de alta'} de ${JSON.stringify(entrada.emailName)} …`);
  const r = await agregarPieza(cli, cfg, entrada, { escribir: !!args.escribir, log: args.json ? () => {} : (s) => console.error(s) });
  const codigo = { duplicado: 3, 'no-existe-en-job': 2, escrita: 0, simulacro: 0 }[r.estado] ?? 1;
  if (args.json) { console.log(salidaJson(r)); return codigo; }
  const { lineas, codigo: salida } = formatearResultado(r);        // lo que viene de SFMC sale por paraMostrar (lib/agregar.js)
  for (const l of lineas) console.log(l);
  return salida;
}

ejecutar(main);
