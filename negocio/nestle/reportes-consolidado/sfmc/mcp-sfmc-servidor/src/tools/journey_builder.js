import { sfmcGet, sfmcPost } from '../client.js';

export const journeyBuilderTools = [
  {
    name: 'sfmc_list_journeys',
    description: 'Lista journeys de Journey Builder con su estado (Draft, Active, Paused, Stopped).',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filtrar por estado: Draft, Active, Paused, Stopped' },
        nameFilter: { type: 'string', description: 'Filtrar por nombre (parcial)' },
        page: { type: 'number', default: 1 },
        pageSize: { type: 'number', default: 25 },
      },
    },
    handler: async ({ status, nameFilter, page = 1, pageSize = 25 } = {}) => {
      const params = { $page: page, $pageSize: pageSize, extras: 'all' };
      if (status) params.status = status;
      if (nameFilter) params.nameFilter = nameFilter;

      const data = await sfmcGet('/interaction/v1/interactions', params);
      const items = (data.items || []).map(j => ({
        id: j.id,
        key: j.key,
        name: j.name,
        status: j.status,
        version: j.version,
        entryMode: j.entryMode,
        definitionType: j.definitionType,
        modifiedDate: j.modifiedDate,
        stats: j.stats,
      }));
      return { total: data.count, page, journeys: items };
    },
  },

  {
    name: 'sfmc_get_journey',
    description: 'Obtiene la definición completa de una journey por ID o key.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID de la journey (UUID)' },
        key: { type: 'string', description: 'Key de la journey (alternativa al ID)' },
        version: { type: 'number', description: 'Versión específica (opcional)' },
      },
    },
    handler: async ({ id, key, version }) => {
      if (!id && !key) throw new Error('Debes proporcionar id o key.');
      const path = id
        ? `/interaction/v1/interactions/${id}${version ? `?versionNumber=${version}` : ''}`
        : `/interaction/v1/interactions/key:${key}${version ? `?versionNumber=${version}` : ''}`;
      const def = await sfmcGet(path);

      // ⚠️ `extras=stats` NO funciona en la forma de RUTA (/interactions/{id}) — devuelve 200
      // sin stats. Solo lo entrega la forma de QUERY (/interactions?id={uuid}&extras=stats).
      // Verificado 31-jul-2026. Por eso se pide aparte y se pega aquí.
      let stats = null;
      let statsError = null;
      if (id) {
        try {
          const s = await sfmcGet('/interaction/v1/interactions', { id, extras: 'stats' });
          stats = s?.items?.[0]?.stats || s?.stats || null;
        } catch (e) {
          // Antes este catch era vacío y colapsaba tres estados en un mismo stats:null.
          // Un fallo transitorio (token vencido entre las dos llamadas, 429, 500) se leía
          // como "no entró nadie al journey", que para un reporte de alcance es peor que
          // un error visible.
          statsError = e?.response?.data ?? e?.message ?? 'fallo desconocido al pedir stats';
        }
      }

      return {
        ...def,
        stats,
        // cumulativePopulation = cuántos ENTRARON al journey. No es opens ni clicks:
        // esas métricas no viven en Journey Builder.
        ...(statsError ? {
          stats_error: statsError,
          stats_hint: 'La journey se leyó bien, pero la llamada de stats falló. stats:null aquí NO significa 0 entradas — reintenta.',
        } : {}),
        // El hint solo aplica cuando de verdad se pidió por key. Antes salía también
        // cuando pediste por id, mandándote a hacer lo que ya habías hecho.
        ...((!stats && !statsError && !id) ? {
          stats_hint: 'Pide la journey por `id` (UUID), no por `key`: los stats solo llegan por la forma de query, que necesita el id.',
        } : {}),
      };
    },
  },

  {
    name: 'sfmc_fire_entry_event',
    description: 'Inyecta un contacto en una journey disparando su entry event. Útil para triggers individuales.',
    inputSchema: {
      type: 'object',
      required: ['eventDefinitionKey', 'contactKey'],
      properties: {
        eventDefinitionKey: { type: 'string', description: 'Key del entry event (se ve en Journey Builder > Entry Source > API Event)' },
        contactKey: { type: 'string', description: 'Identificador único del contacto (ej: email o subscriber key)' },
        data: {
          type: 'object',
          description: 'Datos adicionales a pasar al entry event (deben coincidir con los atributos del evento)',
          additionalProperties: true,
        },
      },
    },
    handler: async ({ eventDefinitionKey, contactKey, data = {} }) => {
      const body = {
        ContactKey: contactKey,
        EventDefinitionKey: eventDefinitionKey,
        Data: data,
      };
      return await sfmcPost('/interaction/v1/events', body);
    },
  },

  {
    name: 'sfmc_pause_journey',
    description: 'Pausa una journey activa.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'ID de la journey' },
        version: { type: 'number', description: 'Versión a pausar' },
      },
    },
    handler: async ({ id, version }) => {
      const params = version ? { versionNumber: version } : {};
      return await sfmcPost(`/interaction/v1/interactions/pause/${id}`, params);
    },
  },

  {
    name: 'sfmc_resume_journey',
    description: 'Reanuda una journey pausada.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'ID de la journey' },
        version: { type: 'number' },
      },
    },
    handler: async ({ id, version }) => {
      const params = version ? { versionNumber: version } : {};
      return await sfmcPost(`/interaction/v1/interactions/resume/${id}`, params);
    },
  },

  {
    name: 'sfmc_stop_journey',
    description: 'Detiene (stops) una journey activa o pausada. No se puede reanudar después.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'ID de la journey' },
        version: { type: 'number' },
      },
    },
    handler: async ({ id, version }) => {
      const params = version ? { versionNumber: version } : {};
      return await sfmcPost(`/interaction/v1/interactions/stop/${id}`, params);
    },
  },
];
