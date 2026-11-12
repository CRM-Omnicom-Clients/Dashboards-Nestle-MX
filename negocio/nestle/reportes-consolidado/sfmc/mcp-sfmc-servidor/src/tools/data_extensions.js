import { sfmcGet, sfmcPost, sfmcDelete, sfmcSoap, xmlUnesc, xmlEsc } from '../client.js';

// --- Helpers para parsear el XML de SOAP sin dependencias ---
function soapRows(xml, props) {
  // Extrae cada <Results>...</Results> y saca los props pedidos + Properties (name/value)
  const results = [...xml.matchAll(/<Results[^>]*>([\s\S]*?)<\/Results>/g)].map(m => m[1]);
  return results.map(block => {
    const row = {};
    for (const p of props) {
      const re = new RegExp(`<${p}>([\\s\\S]*?)<\\/${p}>`);
      const m = re.exec(block);
      if (m) row[p] = xmlUnesc(m[1]);   // sin esto, un '&' vuelve como '&amp;'
    }
    // Campos de la DE (Fields) si vienen
    const fields = [...block.matchAll(/<Field>([\s\S]*?)<\/Field>/g)].map(f => {
      const nm = /<Name>([^<]+)<\/Name>/.exec(f[1]);
      const tp = /<FieldType>([^<]+)<\/FieldType>/.exec(f[1]);
      const pk = /<IsPrimaryKey>([^<]+)<\/IsPrimaryKey>/.exec(f[1]);
      return { name: nm?.[1], type: tp?.[1], isPrimaryKey: pk?.[1] === 'true' };
    });
    if (fields.length) row.fields = fields;
    return row;
  });
}
function soapStatus(xml) {
  return /<OverallStatus>([^<]+)<\/OverallStatus>/.exec(xml)?.[1] || 'Unknown';
}

export const dataExtensionTools = [
  {
    name: 'sfmc_list_data_extensions',
    description: 'Lista las Data Extensions (nombre, external key/CustomerKey, categoryId/folder). Vía SOAP (el REST no lo expone). Opcional: filtrar por nombre parcial.',
    inputSchema: {
      type: 'object',
      properties: {
        nameFilter: { type: 'string', description: 'Filtrar por nombre (contiene, case-insensitive)' },
      },
    },
    handler: async ({ nameFilter } = {}) => {
      // 🔴 SFMC corta el Retrieve en lotes de 2500. Sin ContinueRequest esta tool se
      // quedaba con el primer lote y filtraba en cliente SOBRE ESE LOTE, así que en
      // Nestlé (3,730 DEs) reportaba count:0 para DEs que sí existen — incluida
      // CRM_Email_Performance. Un falso negativo indistinguible de "no existe".
      const PROPS = ['Name', 'CustomerKey', 'CategoryID', 'IsSendable'];
      const P = PROPS.map(p => `<Properties>${p}</Properties>`).join('');
      const armar = cont => `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
<RetrieveRequest>${cont ? `<ContinueRequest>${cont}</ContinueRequest>` : ''}<ObjectType>DataExtension</ObjectType>${P}
</RetrieveRequest></RetrieveRequestMsg>`;

      const rowsAll = [];
      let cont = null, vueltas = 0, incompleto = false;
      do {
        const xml = await sfmcSoap('Retrieve', armar(cont));
        const status = soapStatus(xml);
        if (!/^(OK|MoreDataAvailable)$/.test(status)) {
          return { error: status, detail: /<StatusMessage>([^<]+)<\/StatusMessage>/.exec(xml)?.[1] };
        }
        rowsAll.push(...soapRows(xml, PROPS));
        cont = status === 'MoreDataAvailable' ? /<RequestID>([^<]+)<\/RequestID>/.exec(xml)?.[1] : null;
        if (cont && ++vueltas >= 20) { incompleto = true; break; }
      } while (cont);

      let rows = rowsAll;
      if (nameFilter) {
        const nf = nameFilter.toLowerCase();
        rows = rows.filter(r => (r.Name || '').toLowerCase().includes(nf));
      }
      return {
        count: rows.length,
        totalEnLaBU: rowsAll.length,
        ...(incompleto ? { truncated: true, warning: 'Se alcanzó el tope de 20 lotes: la lista está INCOMPLETA y un nameFilter puede dar 0 para una DE que sí existe.' } : {}),
        dataExtensions: rows,
      };
    },
  },

  {
    name: 'sfmc_list_de_folders',
    description: 'Lista las carpetas de DATA EXTENSIONS con su categoryId y ruta completa (objeto SOAP DataFolder). ⚠️ NO confundir con sfmc_list_folders, que pega a /asset/v1/content/categories y solo devuelve carpetas de Content Builder — esas NO sirven como categoryId al crear una DE. Usa esta para obtener el categoryId que exige sfmc_create_data_extension.',
    inputSchema: {
      type: 'object',
      properties: {
        nameFilter: { type: 'string', description: 'Filtrar por ruta (contiene, case-insensitive). Ej: "7UP"' },
      },
    },
    handler: async ({ nameFilter } = {}) => {
      const NS = 'xmlns="http://exacttarget.com/wsdl/partnerAPI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
      const PROPS = '<Properties>ID</Properties><Properties>Name</Properties><Properties>ContentType</Properties><Properties>ParentFolder.ID</Properties>';
      const req = (cont) => cont
        ? `<RetrieveRequestMsg ${NS}><RetrieveRequest><ContinueRequest>${cont}</ContinueRequest><ObjectType>DataFolder</ObjectType>${PROPS}</RetrieveRequest></RetrieveRequestMsg>`
        : `<RetrieveRequestMsg ${NS}><RetrieveRequest><ObjectType>DataFolder</ObjectType>${PROPS}` +
          `<Filter xsi:type="SimpleFilterPart"><Property>ContentType</Property><SimpleOperator>equals</SimpleOperator><Value>dataextension</Value></Filter>` +
          `</RetrieveRequest></RetrieveRequestMsg>`;

      const folders = [];
      let cont = null, vueltas = 0;
      do {
        const xml = await sfmcSoap('Retrieve', req(cont));
        const status = soapStatus(xml);
        if (!/^(OK|MoreDataAvailable)$/.test(status)) {
          return { error: status, detail: /<StatusMessage>([^<]+)<\/StatusMessage>/.exec(xml)?.[1] };
        }
        for (const m of xml.matchAll(/<Results[^>]*>([\s\S]*?)<\/Results>/g)) {
          const b = m[1];
          const one = t => new RegExp(`<${t}>([\\s\\S]*?)<\\/${t}>`).exec(b)?.[1];
          const parent = /<ParentFolder>([\s\S]*?)<\/ParentFolder>/.exec(b);
          folders.push({
            categoryId: Number(one('ID')),
            name: one('Name'),
            parentId: parent ? Number(/<ID>([^<]+)<\/ID>/.exec(parent[1])?.[1]) : 0,
          });
        }
        cont = status === 'MoreDataAvailable' ? /<RequestID>([^<]+)<\/RequestID>/.exec(xml)?.[1] : null;
      } while (cont && ++vueltas < 25);

      const byId = new Map(folders.map(f => [f.categoryId, f]));
      const ruta = f => { const p = []; let c = f, g = 0; while (c && g++ < 20) { p.unshift(c.name); c = byId.get(c.parentId); } return p.join(' / '); };
      let rows = folders.map(f => ({ categoryId: f.categoryId, name: f.name, path: ruta(f) }));
      if (nameFilter) {
        const nf = nameFilter.toLowerCase();
        rows = rows.filter(r => r.path.toLowerCase().includes(nf));
      }
      rows.sort((a, b) => a.path.localeCompare(b.path));
      return { count: rows.length, folders: rows };
    },
  },

  {
    name: 'sfmc_get_de_fields',
    description: 'Devuelve el esquema (campos: nombre, tipo, primary key, longitud) de una Data Extension. Filtra por nombre (default) o por external key.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'Nombre de la DE (o external key si by="key")' },
        by: { type: 'string', description: '"name" (default) o "key" para filtrar por CustomerKey' },
      },
    },
    handler: async ({ name, by = 'name' }) => {
      // DataExtensionField SOLO es filtrable por DataExtension.CustomerKey.
      // Si viene un nombre, primero resolvemos su CustomerKey.
      let customerKey = name;
      if (by !== 'key') {
        const inner0 = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
<RetrieveRequest><ObjectType>DataExtension</ObjectType><Properties>Name</Properties><Properties>CustomerKey</Properties>
<Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<Property>Name</Property><SimpleOperator>equals</SimpleOperator><Value>${name}</Value></Filter>
</RetrieveRequest></RetrieveRequestMsg>`;
        const xml0 = await sfmcSoap('Retrieve', inner0);
        const de = soapRows(xml0, ['Name', 'CustomerKey'])[0];
        if (!de) return { name, fieldCount: 0, fields: [], error: `No existe DE con nombre "${name}"` };
        customerKey = de.CustomerKey;
      }
      const inner = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">
<RetrieveRequest><ObjectType>DataExtensionField</ObjectType>
<Properties>Name</Properties><Properties>FieldType</Properties><Properties>IsPrimaryKey</Properties><Properties>MaxLength</Properties><Properties>IsRequired</Properties><Properties>Ordinal</Properties>
<Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<Property>DataExtension.CustomerKey</Property><SimpleOperator>equals</SimpleOperator><Value>${customerKey}</Value></Filter>
</RetrieveRequest></RetrieveRequestMsg>`;
      const xml = await sfmcSoap('Retrieve', inner);
      const fields = soapRows(xml, ['Name', 'FieldType', 'IsPrimaryKey', 'MaxLength', 'IsRequired', 'Ordinal'])
        .sort((a, b) => (parseInt(a.Ordinal) || 0) - (parseInt(b.Ordinal) || 0));
      return { name, customerKey, fieldCount: fields.length, fields };
    },
  },

  {
    name: 'sfmc_get_de_rows',
    description: 'Lee filas de una Data Extension. Se pide por NOMBRE de la DE (no external key). Vía SOAP DataExtensionObject — el REST /data/v1/customobjectdata devuelve 400 en este tenant para cualquier DE. Opcionalmente filtra por un campo.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'NOMBRE de la Data Extension (ej: "CRM_Email_Performance")' },
        fields: { type: 'array', description: 'Campos a traer. Si se omite, se resuelven solos con el esquema de la DE.', items: { type: 'string' } },
        filterField: { type: 'string', description: 'Campo por el que filtrar (opcional)' },
        filterOperator: { type: 'string', description: 'equals | notEquals | greaterThan | lessThan | like (default equals)' },
        filterValue: { type: 'string', description: 'Valor del filtro' },
        maxRows: { type: 'number', description: 'Tope de filas (default 500)' },
      },
    },
    handler: async ({ name, fields, filterField, filterOperator = 'equals', filterValue, maxRows = 500 }) => {
      const OPS = ['equals', 'notEquals', 'greaterThan', 'lessThan', 'like',
        'isNull', 'isNotNull', 'between', 'IN'];

      // El filtro se descartaba en silencio si faltaba una pieza: se traían las primeras
      // maxRows de TODA la DE y la respuesta no decía nada. Ahora es un error explícito.
      if ((filterField === undefined) !== (filterValue === undefined)) {
        return { error: 'Filtro incompleto: filterField y filterValue van juntos o ninguno.' };
      }
      if (filterField !== undefined && !OPS.includes(filterOperator)) {
        return { error: `filterOperator "${filterOperator}" no es válido. Usa: ${OPS.join(' | ')}` };
      }

      const NS = 'xmlns="http://exacttarget.com/wsdl/partnerAPI"';
      const XSI = 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
      const nombreEsc = xmlEsc(name);   // una DE llamada "Tips & Recetas" rompía el sobre

      // Si no dan campos, se sacan del esquema — un Retrieve sin <Properties> falla.
      let cols = fields;
      if (!cols || !cols.length) {
        const inner = `<RetrieveRequestMsg ${NS}>
<RetrieveRequest><ObjectType>DataExtension</ObjectType><Properties>Name</Properties><Properties>CustomerKey</Properties>
<Filter xsi:type="SimpleFilterPart" ${XSI}>
<Property>Name</Property><SimpleOperator>equals</SimpleOperator><Value>${nombreEsc}</Value></Filter>
</RetrieveRequest></RetrieveRequestMsg>`;
        const xmlDe = await sfmcSoap('Retrieve', inner);
        // Sin revisar OverallStatus, un fallo de permisos o un fault se reportaba como
        // "no existe la DE" y el StatusMessage real se perdía.
        const stDe = soapStatus(xmlDe);
        if (!/^(OK|MoreDataAvailable)$/.test(stDe)) {
          return { error: `No pude resolver el esquema de "${name}": ${stDe}`,
                   detail: /<StatusMessage>([^<]+)<\/StatusMessage>/.exec(xmlDe)?.[1] };
        }
        const des = soapRows(xmlDe, ['Name', 'CustomerKey']);
        if (!des.length) return { error: `No existe una DE llamada "${name}"` };
        if (des.length > 1) {
          return { error: `Hay ${des.length} DEs llamadas "${name}" (el Name no es único en SFMC; el CustomerKey sí). ` +
            `Pasa 'fields' explícitamente para elegir, o renombra una.` };
        }
        const xf = `<RetrieveRequestMsg ${NS}>
<RetrieveRequest><ObjectType>DataExtensionField</ObjectType><Properties>Name</Properties><Properties>Ordinal</Properties>
<Filter xsi:type="SimpleFilterPart" ${XSI}>
<Property>DataExtension.CustomerKey</Property><SimpleOperator>equals</SimpleOperator><Value>${xmlEsc(des[0].CustomerKey)}</Value></Filter>
</RetrieveRequest></RetrieveRequestMsg>`;
        const xmlF = await sfmcSoap('Retrieve', xf);
        const stF = soapStatus(xmlF);
        if (!/^(OK|MoreDataAvailable)$/.test(stF)) {
          return { error: `No pude leer los campos de "${name}": ${stF}`,
                   detail: /<StatusMessage>([^<]+)<\/StatusMessage>/.exec(xmlF)?.[1] };
        }
        cols = soapRows(xmlF, ['Name', 'Ordinal'])
          .sort((a, b) => (parseInt(a.Ordinal) || 0) - (parseInt(b.Ordinal) || 0))
          .map(f => f.Name);
        if (!cols.length) return { error: `La DE "${name}" existe pero no reportó campos.` };
      }

      const P = cols.map(c => `<Properties>${xmlEsc(c)}</Properties>`).join('');
      const filtro = filterField !== undefined
        ? `<Filter xsi:type="SimpleFilterPart" ${XSI}>` +
          `<Property>${xmlEsc(filterField)}</Property><SimpleOperator>${xmlEsc(filterOperator)}</SimpleOperator>` +
          `<Value>${xmlEsc(filterValue)}</Value></Filter>`
        : '';

      const rows = [];
      let cont = null, vueltas = 0, causa = null;
      do {
        const inner = cont
          ? `<RetrieveRequestMsg ${NS}><RetrieveRequest><ContinueRequest>${cont}</ContinueRequest><ObjectType>DataExtensionObject[${nombreEsc}]</ObjectType>${P}</RetrieveRequest></RetrieveRequestMsg>`
          : `<RetrieveRequestMsg ${NS}><RetrieveRequest><ObjectType>DataExtensionObject[${nombreEsc}]</ObjectType>${P}${filtro}</RetrieveRequest></RetrieveRequestMsg>`;
        const xml = await sfmcSoap('Retrieve', inner);
        const status = soapStatus(xml);
        if (!/^(OK|MoreDataAvailable)$/.test(status)) {
          return { name, error: status, detail: /<StatusMessage>([^<]+)<\/StatusMessage>/.exec(xml)?.[1],
                   count: Math.min(rows.length, maxRows), fields: cols, rows: rows.slice(0, maxRows) };
        }
        for (const bloque of xml.split(/<Results[^>]*>/).slice(1)) {
          const o = {};
          for (const m of bloque.matchAll(/<Name>([^<]*)<\/Name>\s*<Value>([^<]*)<\/Value>/g)) {
            o[xmlUnesc(m[1])] = xmlUnesc(m[2]);
          }
          if (Object.keys(o).length) rows.push(o);
        }
        cont = status === 'MoreDataAvailable' ? /<RequestID>([^<]+)<\/RequestID>/.exec(xml)?.[1] : null;

        // 🔴 truncated decidido por si se DESCARTAN filas, no por el status del lote.
        // Antes: una DE de 800 filas con maxRows=500 devolvía 500 y truncated:false.
        if (rows.length >= maxRows) { causa = rows.length > maxRows || cont ? 'maxRows' : null; break; }
        if (cont && ++vueltas >= 40) { causa = 'lotes'; break; }
      } while (cont);

      return {
        name,
        count: Math.min(rows.length, maxRows),
        retrieved: rows.length,
        fields: cols,
        ...(filterField !== undefined ? { filtroAplicado: `${filterField} ${filterOperator} ${filterValue}` } : {}),
        truncated: causa !== null,
        ...(causa ? {
          warning: `INCOMPLETO: se cortó por ${causa === 'lotes' ? 'el tope de 40 lotes' : 'maxRows=' + maxRows}. Hay más filas.`,
        } : {}),
        rows: rows.slice(0, maxRows),
      };
    },
  },

  {
    name: 'sfmc_create_data_extension',
    description: 'CREA una Data Extension nueva. Requiere categoryId del árbol de DATA EXTENSIONS — obtenlo con sfmc_list_de_folders, NO con sfmc_list_folders (esa devuelve carpetas de Content Builder, que no sirven aquí). Necesita al menos un campo primary key no nulo.',
    inputSchema: {
      type: 'object',
      required: ['name', 'categoryId', 'fields'],
      properties: {
        name: { type: 'string', description: 'Nombre de la DE' },
        categoryId: { type: 'number', description: 'ID del folder donde crearla (OBLIGATORIO)' },
        isSendable: { type: 'boolean', description: 'Si es sendable (default false)' },
        sendableCustomObjectField: { type: 'string', description: 'Campo que liga al subscriber (requerido si isSendable)' },
        sendableSubscriberField: { type: 'string', description: 'Normalmente "_SubscriberKey" (requerido si isSendable)' },
        fields: {
          type: 'array',
          description: 'Campos: [{name, type, length?, isPrimaryKey?, isNullable?}]. type: Text|EmailAddress|Number|Date|Boolean|Decimal|Phone|Locale',
          items: { type: 'object', additionalProperties: true },
        },
      },
    },
    handler: async ({ name, categoryId, isSendable = false, sendableCustomObjectField, sendableSubscriberField, fields }) => {
      const mapped = fields.map((f, i) => ({
        name: f.name,
        type: f.type || 'Text',
        length: f.length ?? (f.type === 'EmailAddress' ? 254 : (f.type === 'Text' ? 50 : undefined)),
        ordinal: i + 1,
        IsPrimaryKey: !!f.isPrimaryKey,
        isNullable: f.isPrimaryKey ? false : (f.isNullable ?? true),
        isTemplateField: false, isInheritable: true, isOverridable: true,
        isHidden: false, isReadOnly: false, mustOverride: false,
      }));
      const body = { name, key: '', isSendable, categoryId, fields: mapped };
      if (isSendable) {
        body.sendableCustomObjectField = sendableCustomObjectField;
        body.sendableSubscriberField = sendableSubscriberField || '_SubscriberKey';
      }
      const res = await sfmcPost('/data/v1/customobjects', body);
      return { created: true, name: res.name, key: res.key, id: res.id, categoryId: res.categoryId };
    },
  },

  {
    name: 'sfmc_delete_data_extension',
    description: 'BORRA una Data Extension por su id (el que devuelve sfmc_create_data_extension). Irreversible — usar con cuidado.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'id (GUID) de la Data Extension' } },
    },
    handler: async ({ id }) => {
      await sfmcDelete(`/data/v1/customobjects/${id}`);
      return { deleted: true, id };
    },
  },

  {
    name: 'sfmc_upsert_de_rows',
    description: 'Inserta o actualiza filas en una Data Extension (upsert por primary key).',
    inputSchema: {
      type: 'object',
      required: ['externalKey', 'rows'],
      properties: {
        externalKey: { type: 'string', description: 'External Key de la Data Extension' },
        keyFields: { type: 'array', description: 'Nombres de los campos que son primary key (para separar keys de values)', items: { type: 'string' } },
        rows: {
          type: 'array',
          description: 'Array de objetos con los campos a insertar/actualizar',
          items: { type: 'object', additionalProperties: true },
        },
      },
    },
    handler: async ({ externalKey, rows, keyFields = [] }) => {
      // El endpoint /hub/v1/dataevents espera { items: [{ keys: {...}, values: {...} }] }
      const items = rows.map(r => {
        const keys = {}, values = {};
        for (const [k, v] of Object.entries(r)) {
          if (keyFields.includes(k)) keys[k] = v; else values[k] = v;
        }
        return { keys, values };
      });
      return await sfmcPost(`/hub/v1/dataevents/key:${externalKey}/rowset`, items);
    },
  },
];
