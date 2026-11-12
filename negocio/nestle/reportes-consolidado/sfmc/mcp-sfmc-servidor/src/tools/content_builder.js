import { sfmcGet, sfmcPost, sfmcPatch, sfmcDelete } from '../client.js';

export const contentBuilderTools = [
  {
    name: 'sfmc_list_folders',
    description: 'Lista carpetas de CONTENT BUILDER (assets, emails). ⚠️ NO sirve para crear Data Extensions — para eso usa sfmc_list_de_folders. Soporta paginación: Nestlé tiene ~2,600 carpetas.',
    inputSchema: {
      type: 'object',
      properties: {
        contentType: { type: 'string', description: 'Tipo: "asset" (default)', default: 'asset' },
        parentId: { type: 'number', description: 'ID de carpeta padre. Filtra a sus hijas directas.' },
        page: { type: 'number', description: 'Página (default 1)' },
        pageSize: { type: 'number', description: 'Tamaño de página (default 50, máx 500)' },
      },
    },
    handler: async ({ contentType = 'asset', parentId, page = 1, pageSize = 50 } = {}) => {
      const params = { $page: page, $pageSize: Math.min(pageSize, 500), contentType };
      // parentId como parámetro suelto NO lo reconoce el endpoint: SFMC lo ignoraba y
      // devolvía la lista SIN filtrar, con pinta de correcta. Va como $filter.
      if (parentId !== undefined) params.$filter = `parentId eq ${Number(parentId)}`;

      const data = await sfmcGet('/asset/v1/content/categories', params);
      const items = (data.items || []).map(f => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        // `contentType` no viene en este endpoint: mapearlo era código muerto.
      }));
      const total = data.count;
      const devueltas = (page - 1) * pageSize + items.length;
      return {
        total, page, pageSize, count: items.length,
        ...(total > devueltas ? {
          truncated: true,
          warning: `Se devuelven ${items.length} de ${total}. Pide page=${page + 1} o sube pageSize.`,
        } : {}),
        folders: items,
      };
    },
  },

  {
    name: 'sfmc_create_folder',
    description: 'Crea una carpeta en Content Builder.',
    inputSchema: {
      type: 'object',
      required: ['name', 'parentId'],
      properties: {
        name: { type: 'string', description: 'Nombre de la carpeta' },
        parentId: { type: 'number', description: 'ID de la carpeta padre' },
        contentType: { type: 'string', default: 'asset', description: 'Tipo de contenido' },
      },
    },
    handler: async ({ name, parentId, contentType = 'asset' }) => {
      return await sfmcPost('/asset/v1/content/categories', { name, parentId, contentType });
    },
  },

  {
    name: 'sfmc_list_assets',
    description: 'Busca assets en Content Builder (emails, templates, imágenes, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Filtrar por nombre (búsqueda parcial)' },
        assetType: { type: 'string', description: 'Tipo: "htmlemail", "templatebasedemail", "image", "block", "template"' },
        categoryId: { type: 'number', description: 'ID de carpeta donde buscar' },
        page: { type: 'number', default: 1 },
        pageSize: { type: 'number', default: 25 },
      },
    },
    handler: async ({ name, assetType, categoryId, page = 1, pageSize = 25 } = {}) => {
      // 🔴 La Simple Query API de SFMC NO acepta '=' como operador: exige 'eq'.
      // Con '=' cualquier llamada con assetType o categoryId reventaba con error 10003
      // en AMBOS tenants, o sea la tool no servía para su caso de uso principal
      // (encontrar un email concreto). Solo 'name' funcionaba, porque usa 'like'.
      const filters = [];
      if (name) filters.push(`name like '%${name}%'`);
      if (assetType) filters.push(`assetType.name eq '${assetType}'`);
      if (categoryId) filters.push(`category.id eq ${Number(categoryId)}`);

      const params = { $page: page, $pageSize: pageSize };
      if (filters.length) params.$filter = filters.join(' and ');

      const data = await sfmcGet('/asset/v1/content/assets', params);
      const items = (data.items || []).map(a => ({
        id: a.id,
        name: a.name,
        assetType: a.assetType?.name,
        categoryId: a.category?.id,
        categoryName: a.category?.name,
        modifiedDate: a.modifiedDate,
        status: a.status?.name,
      }));
      return { total: data.count, page, assets: items };
    },
  },

  {
    name: 'sfmc_get_asset',
    description: 'Obtiene los detalles completos de un asset por ID (incluye HTML content).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'number', description: 'ID del asset' },
      },
    },
    handler: async ({ id }) => {
      return await sfmcGet(`/asset/v1/content/assets/${id}`);
    },
  },

  {
    name: 'sfmc_create_email',
    description: 'Crea un email HTML en Content Builder.',
    inputSchema: {
      type: 'object',
      required: ['name', 'html', 'categoryId'],
      properties: {
        name: { type: 'string', description: 'Nombre del email' },
        html: { type: 'string', description: 'Contenido HTML completo del email' },
        subject: { type: 'string', description: 'Línea de asunto' },
        preHeader: { type: 'string', description: 'Pre-header / preview text' },
        categoryId: { type: 'number', description: 'ID de la carpeta donde guardar' },
      },
    },
    handler: async ({ name, html, subject, preHeader, categoryId }) => {
      const body = {
        name,
        assetType: { name: 'htmlemail', id: 208 },
        category: { id: categoryId },
        views: {
          html: { content: html },
          subjectline: { content: subject || name },
          preheader: { content: preHeader || '' },
        },
      };
      return await sfmcPost('/asset/v1/content/assets', body);
    },
  },

  {
    name: 'sfmc_update_asset',
    description: 'Actualiza un asset existente (HTML, nombre, subject, etc.)',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'number', description: 'ID del asset a actualizar' },
        name: { type: 'string' },
        html: { type: 'string', description: 'Nuevo HTML (solo si cambia)' },
        subject: { type: 'string' },
        preHeader: { type: 'string' },
        categoryId: { type: 'number', description: 'ID de la carpeta destino (para mover el asset)' },
      },
    },
    handler: async ({ id, name, html, subject, preHeader, categoryId }) => {
      const body = {};
      if (name) body.name = name;
      if (categoryId) body.category = { id: categoryId };
      if (html || subject || preHeader) {
        body.views = {};
        if (html) body.views.html = { content: html };
        if (subject) body.views.subjectline = { content: subject };
        if (preHeader) body.views.preheader = { content: preHeader };
      }
      return await sfmcPatch(`/asset/v1/content/assets/${id}`, body);
    },
  },

  {
    name: 'sfmc_delete_asset',
    description: 'Elimina un asset de Content Builder.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'number', description: 'ID del asset a eliminar' },
      },
    },
    handler: async ({ id }) => {
      await sfmcDelete(`/asset/v1/content/assets/${id}`);
      return { success: true, deleted: id };
    },
  },
];
