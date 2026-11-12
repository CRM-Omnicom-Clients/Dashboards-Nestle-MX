import { sfmcGet, sfmcPost } from '../client.js';

// Query Activities de Automation Studio. Es la UNICA via para consultar las Data Views
// (_Job, _Sent, _Open, _Click, _Bounce, _Unsubscribe): no hay endpoint de "correr SQL".
// El SQL escribe a una Data Extension y de ahi se lee con sfmc_get_de_rows.

const PAGINA = 50;
const TOPE_PAGINAS = 60;   // 60 x 50 = 3000. Nestle ya anda en ~1900 queries.

// Baja TODAS las paginas de un endpoint paginado de Automation Studio.
// 🔴 Devuelve `incompleto` en vez de truncar callado: un subconjunto silencioso se lee
// como "eso es todo", y con un filtro encima da 0 resultados para algo que si existe.
async function bajarTodo(ruta) {
  const todas = new Map();
  let total = null, paginas = 0, incompleto = false;

  for (let pag = 1; pag <= TOPE_PAGINAS; pag++) {
    const d = await sfmcGet(ruta, { $page: pag, $pageSize: PAGINA });
    const items = d?.items || [];
    // Ojo: `total` puede venir null. Antes la salida era `todas.size >= (total || 0)`,
    // que con total=null es 0 y da true SIEMPRE -> salia en la pagina 1 con 50 filas.
    if (typeof d?.count === 'number') total = d.count;
    paginas = pag;
    if (!items.length) break;
    for (const it of items) todas.set(it.queryDefinitionId || it.id || it.key, it);
    if (total !== null && todas.size >= total) break;
    if (pag === TOPE_PAGINAS) incompleto = true;
  }

  // Si SFMC nunca dijo cuantas hay, no podemos afirmar que bajamos todo.
  if (total === null) incompleto = true;
  return { items: [...todas.values()], total, paginas, incompleto };
}

// Empaqueta la respuesta distinguiendo TRES numeros que antes se colapsaban en uno:
// cuantas hay en la BU, cuantas matchearon el filtro, y cuantas se devuelven.
function empacar(clave, filas, matched, total, maxRows, incompleto) {
  const cortado = matched > maxRows;
  return {
    totalEnLaBU: total,
    matched,                       // cuantas cumplen el filtro (antes no existia)
    count: filas.length,           // cuantas van en esta respuesta
    ...(cortado || incompleto ? { truncated: true } : {}),
    ...(cortado ? { warning: `Hay ${matched} que cumplen el filtro y se devuelven ${filas.length} (maxRows). Sube maxRows.` } : {}),
    ...(incompleto ? { warning_paginacion: `No se pudo confirmar que se bajara todo (tope de ${TOPE_PAGINAS} paginas o la API no reporto total). Un filtro puede dar 0 para algo que si existe.` } : {}),
    [clave]: filas,
  };
}

// Ordena por fecha descendente dejando los SIN fecha al final.
// Antes se comparaban como texto: 'undefined' y 'null' ganaban a cualquier ISO y las
// filas sin fecha se quedaban con todo el cupo de maxRows.
const porFechaDesc = (campo) => (a, b) => {
  const ta = Date.parse(a[campo] ?? ''), tb = Date.parse(b[campo] ?? '');
  const va = isNaN(ta) ? -Infinity : ta, vb = isNaN(tb) ? -Infinity : tb;
  return vb - va;
};

export const automationTools = [
  {
    name: 'sfmc_list_queries',
    description: 'Lista las Query Activities (SQL sobre Data Views/DEs) con su SQL, DE destino y fecha de modificación. Filtra por nombre o por la DE a la que escriben. Devuelve `matched` (cuántas cumplen el filtro) aparte de `count` (cuántas van en la respuesta).',
    inputSchema: {
      type: 'object',
      properties: {
        nameFilter: { type: 'string', description: 'Filtra por nombre de la query (contiene, case-insensitive)' },
        targetFilter: { type: 'string', description: 'Filtra por nombre de la DE destino (contiene)' },
        includeSql: { type: 'boolean', description: 'Incluir el queryText completo (default false — es largo)' },
        maxRows: { type: 'number', description: 'Tope de filas a devolver (default 100)' },
      },
    },
    handler: async ({ nameFilter, targetFilter, includeSql = false, maxRows = 100 } = {}) => {
      const { items, total, incompleto } = await bajarTodo('/automation/v1/queries');

      let rows = items;
      if (nameFilter) {
        const f = nameFilter.toLowerCase();
        rows = rows.filter(q => (q.name || '').toLowerCase().includes(f));
      }
      if (targetFilter) {
        const f = targetFilter.toLowerCase();
        rows = rows.filter(q => (q.targetName || '').toLowerCase().includes(f));
      }
      const matched = rows.length;
      rows.sort(porFechaDesc('modifiedDate'));

      return empacar('queries', rows.slice(0, maxRows).map(q => ({
        queryDefinitionId: q.queryDefinitionId,
        name: q.name,
        key: q.key,
        target: q.targetName,
        updateType: q.targetUpdateTypeName,
        modified: q.modifiedDate ?? null,
        ...(includeSql ? { sql: q.queryText } : {}),
      })), matched, total, maxRows, incompleto);
    },
  },

  {
    name: 'sfmc_run_query',
    description: 'DISPARA una Query Activity existente por su queryDefinitionId. ⚠️ ESCRIBE EN PRODUCCIÓN: si la query es de tipo Overwrite, BORRA todo el contenido de su DE destino antes de repoblarlo. Usar solo cuando el usuario lo pida explícitamente. Corre asíncrono y NO devuelve filas: después hay que leer la DE con sfmc_get_de_rows. Antes de disparar, la tool resuelve y te dice qué query es y a qué DE escribe.',
    inputSchema: {
      type: 'object',
      required: ['queryDefinitionId'],
      properties: {
        queryDefinitionId: { type: 'string', description: 'GUID de la query (de sfmc_list_queries). Es un UUID, NO el nombre.' },
      },
    },
    handler: async ({ queryDefinitionId }) => {
      // Un GUID mal copiado (o el nombre en vez del id) disparaba otra query sin que
      // nadie se enterara: la respuesta solo repetia el id que le entro.
      if (!/^[0-9a-fA-F-]{36}$/.test(String(queryDefinitionId))) {
        return { error: `"${queryDefinitionId}" no tiene forma de GUID. Saca el queryDefinitionId de sfmc_list_queries.` };
      }

      let info = null;
      try {
        const q = await sfmcGet(`/automation/v1/queries/${encodeURIComponent(queryDefinitionId)}`);
        info = { name: q?.name, target: q?.targetName, updateType: q?.targetUpdateTypeName };
      } catch (e) {
        return { error: `No pude leer la query ${queryDefinitionId} antes de dispararla`,
                 detail: e?.response?.data ?? e.message };
      }

      const r = await sfmcPost(`/automation/v1/queries/${encodeURIComponent(queryDefinitionId)}/actions/start/`, {});
      return {
        started: true,
        queryDefinitionId,
        ...info,
        response: r,
        hint: 'Corre asíncrono. Para saber si YA terminó hacen falta TRES condiciones a la vez, ' +
              'porque un Overwrite borra y repuebla y leer a media escritura devuelve una mezcla ' +
              'que se ve plausible: (1) el campo de fecha de refresco es estrictamente MAYOR al de ' +
              'antes de disparar, (2) ese campo es UNIFORME en todas las filas (min === max; dos ' +
              'valores = filas de dos corridas), y (3) la PK no tiene duplicados. ' +
              'Contar filas, o mirar si la fecha es de hoy, NO sirve.',
      };
    },
  },

  {
    name: 'sfmc_list_automations',
    description: 'Lista las Automations con su estado, su última corrida y su programación (recurrencia, próxima corrida, zona horaria) cuando la API la expone.',
    inputSchema: {
      type: 'object',
      properties: {
        nameFilter: { type: 'string', description: 'Filtra por nombre (contiene, case-insensitive)' },
        maxRows: { type: 'number', description: 'Tope de filas a devolver (default 50)' },
      },
    },
    handler: async ({ nameFilter, maxRows = 50 } = {}) => {
      const { items, total, incompleto } = await bajarTodo('/automation/v1/automations');

      let rows = items;
      if (nameFilter) {
        const f = nameFilter.toLowerCase();
        rows = rows.filter(a => (a.name || '').toLowerCase().includes(f));
      }
      const matched = rows.length;
      // El listado venia en orden alfabetico crudo: con maxRows=50 sobre 778, Nestle
      // devolvia solo nombres que empiezan con espacio, tab y "01/02/03 CES Migration".
      rows.sort(porFechaDesc('lastRunTime'));

      return empacar('automations', rows.slice(0, maxRows).map(a => {
        const s = a.schedule || {};
        return {
          id: a.id,
          name: a.name,
          key: a.key,
          status: a.status,
          type: a.type ?? null,
          // `modifiedDate` NO existe en este endpoint: salia undefined y se borraba del
          // JSON, asi que la columna simplemente no aparecia. La API si trae lastRunTime.
          lastRunTime: a.lastRunTime ?? null,
          schedule: (s.icalRecur || s.scheduledTime || s.startDate) ? {
            recurrencia: s.icalRecur ?? null,
            proxima: s.scheduledTime ?? null,
            desde: s.startDate ?? null,
            tz: s.timezoneName ?? null,
            estado: s.scheduleStatus ?? null,
          } : null,
        };
      }), matched, total, maxRows, incompleto);
    },
  },
];
