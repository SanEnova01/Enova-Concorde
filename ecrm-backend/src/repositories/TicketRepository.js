const db = require('../config/db');
const HubSyncService = require('../services/HubSyncService');

// Listado paginado de tickets
const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const SORTABLE_COLUMNS = ['serial_number', 'name', 'store_id', 'status', 'priority', 'task_type', 'assigned_to', 'is_apolo_sync', 'created_at', 'id'];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const UNASSIGNED = '__UNASSIGNED__';
// Los comodines de LIKE que escriba el usuario se toman como texto literal
const escapeLike = (v) => String(v).trim().replace(/[\\%_]/g, (c) => '\\' + c);

// ESCUDOS AUTO-CORRECTORES (Evitan que PostgreSQL rechace la data)
const sanitizePriority = (p) => {
  if (!p) return 'MEDIUM';
  const upper = String(p).toUpperCase();
  if (upper.includes('BAJA') || upper === 'LOW') return 'LOW';
  if (upper.includes('MEDIA') || upper === 'MEDIUM') return 'MEDIUM';
  if (upper.includes('ALTA') || upper === 'HIGH') return 'HIGH';
  if (upper.includes('CRITIC') || upper === 'CRITICAL') return 'CRITICAL';
  return 'MEDIUM';
};

const sanitizeTaskType = (t) => {
  if (!t) return 'CONSULTA';
  const upper = String(t).toUpperCase();
  if (upper.includes('BUG')) return 'BUG_FIX';
  if (upper.includes('INTERNA')) return 'TASK_INTERNA';
  if (upper.includes('CAMBIO')) return 'CAMBIO';
  return 'CONSULTA'; 
};

const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

// Sufijos de clones: 0 → A, 25 → Z, 26 → AA, 27 → AB...
const toLetters = (n) => {
  let out = '';
  let x = n + 1;
  while (x > 0) {
    const r = (x - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    x = Math.floor((x - 1) / 26);
  }
  return out;
};
const fromLetters = (str) => [...str].reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
// Número base de un ticket: SOP-2026-2008B → SOP-2026-2008
const baseSerial = (serial) => String(serial || '').replace(/(\d)[A-Z]+$/, '$1');

class TicketRepository {
  // 🌟 AHORA DETERMINA EL PREFIJO DEPENDIENDO SI ES B2B (SOP) O B2C (HUB)
  // Debe llamarse DENTRO de una transacción (conn = trx): toma un candado de Postgres por
  // prefijo y año, así dos tickets creados a la vez no pueden recibir el mismo número.
  static async generateSerialNumber(isB2C = false, conn = db) {
    // Año según la hora de Lima (el 31/12 a las 20:00 en Lima todavía es el mismo año)
    const year = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric' }).format(new Date());
    const prefix = isB2C ? 'HUB' : 'SOP';
    const pattern = `${prefix}-${year}-%`;

    await conn.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`ticket_serial:${prefix}-${year}`]);

    // Mayor número usado (antes: el del último ticket por fecha, que podía no ser el mayor)
    const result = await conn.raw(
      `SELECT MAX(CAST(NULLIF(regexp_replace(split_part(serial_number, '-', 3), '[^0-9]', '', 'g'), '') AS int)) AS n
       FROM tickets WHERE serial_number LIKE ?`,
      [pattern]
    );
    const lastNumber = parseInt(result.rows?.[0]?.n, 10) || 0;

    const paddedNumber = (lastNumber + 1).toString().padStart(4, '0');
    return `${prefix}-${year}-${paddedNumber}`;
  }

  /**
   * Clona un ticket a otras tiendas (ej. Kuna Perú, Chile, WW, USA): crea un ticket
   * independiente por tienda, con su propio número, copiando asunto, descripción,
   * prioridad, tipo y responsables. Cada copia nace OPEN y referencia al original.
   * Devuelve { source, created: [...], skipped: [{ store_id, reason }] }.
   */
  static async cloneToStores(sourceId, storeIds) {
    const source = await db('tickets').where({ id: sourceId }).first();
    if (!source) {
      const err = new Error('Ticket no encontrado.');
      err.status = 404;
      throw err;
    }

    const wanted = [...new Set((storeIds || []).map((s) => String(s).trim()).filter(Boolean))];
    const existing = wanted.length ? await db('stores').whereIn('id', wanted).select('id', 'name') : [];
    const existingIds = new Set(existing.map((s) => String(s.id)));

    const skipped = [];
    const targets = [];
    for (const id of wanted) {
      if (id === String(source.store_id)) skipped.push({ store_id: id, reason: 'Es la tienda del ticket original' });
      else if (!existingIds.has(id)) skipped.push({ store_id: id, reason: 'La tienda no existe' });
      else targets.push(id);
    }

    const sourceStore = await db('stores').where({ id: source.store_id }).first();
    const origin = `${source.serial_number || `#${source.id}`}${sourceStore?.name ? ` (${sourceStore.name})` : ''}`;
    // Se quita la marca de Gmail para que las copias no se enlacen al mismo correo
    const baseDescription = String(source.description || '').replace(/\[GMAIL_ID:[^\]]*\]/g, '').trim();

    const created = [];
    const base = baseSerial(source.serial_number);
    if (targets.length === 0) return { source, created, skipped };

    // Las copias llevan el número del original + letra (SOP-2026-2008A, B, C...).
    // Candado por número base: dos clonaciones simultáneas del mismo ticket no repiten letra.
    await db.transaction(async (trx) => {
      let next = 0;
      if (base) {
        await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`ticket_clone:${base}`]);
        const siblings = await trx('tickets').where('serial_number', 'like', `${base}%`).select('serial_number');
        siblings.forEach(({ serial_number: sn }) => {
          const value = String(sn || '');
          if (!value.startsWith(base)) return;
          const suffix = value.slice(base.length);
          if (/^[A-Z]+$/.test(suffix)) next = Math.max(next, fromLetters(suffix) + 1);
        });
      }

      for (const storeId of targets) {
        const serialNumber = base ? `${base}${toLetters(next++)}` : undefined;
        created.push(await this.create({
          name: source.name,
          description: `🔁 Clonado de ${origin}

${baseDescription}`.trim(),
          store_id: storeId,
          priority: source.priority,
          task_type: source.task_type,
          assigned_to: source.assigned_to,
          is_b2c: source.is_b2c,
          status: 'OPEN'
        }, { serialNumber }));
      }
    });
    return { source, created, skipped };
  }

  // options.serialNumber: solo para uso interno (clones); nunca viene del cuerpo de la petición
  static async create(ticketData, options = {}) {
    try {
      const isB2C = !!ticketData.is_b2c;
      
      const validPriority = sanitizePriority(ticketData.priority);
      const validTaskType = sanitizeTaskType(ticketData.task_type);

      let finalStoreId = ticketData.store_id;
      if (!finalStoreId || finalStoreId === 'null') {
        // 🌟 FIX: Asignar al buzón central por defecto, nunca a un cliente al azar
        finalStoreId = 'enova.agency';
      }

      // Estado inicial: el que se pida si es válido (antes siempre OPEN)
      const status = VALID_STATUSES.includes(String(ticketData.status || '').toUpperCase())
        ? String(ticketData.status).toUpperCase()
        : 'OPEN';

      const newTicket = await db.transaction(async (trx) => {
        // 👈 Genera el serial (B2B SOP / B2C HUB) con candado, dentro de la transacción
        const serial_number = options.serialNumber || await this.generateSerialNumber(isB2C, trx);

        const [insertedTicket] = await trx('tickets').insert({
          serial_number,
          name: ticketData.name || 'Ticket Automático',
          description: ticketData.description || null,
          store_id: finalStoreId,
          priority: validPriority,
          task_type: validTaskType,
          status,
          ...(status === 'CLOSED' || status === 'RESOLVED' ? { closed_at: db.fn.now() } : {}),
          assigned_to: ticketData.assigned_to || null,
          is_b2c: isB2C
        }).returning('*');

        if (finalStoreId) {
          await trx('stores')
            .where({ id: finalStoreId })
            .increment('ticket_count', 1);
        }

        return insertedTicket;
      });

      // 🌟 INVOCACIÓN SILENCIOSA AL HUB AL CREAR
      if (newTicket) {
        HubSyncService.registrarTicketEnHub(newTicket).catch(err => {
            console.error('❌ [Hub Sync Fatal Error]', err.message);
        });
      }

      return newTicket;
    } catch (error) {
      throw new Error('Error al crear el ticket: ' + error.message);
    }
  }

  // Aplica los filtros del listado. Sin filtros no toca la consulta (comportamiento original).
  static _applyListFilters(query, filters = {}) {
    if (filters.is_apolo_sync) {
      query = query.where({ is_apolo_sync: true });
    }
    if (filters.store_id) {
      query = query.where({ store_id: filters.store_id });
    }
    // Tiendas permitidas (rol cliente): el filtro va en la base para que paginar no se salte el acceso.
    // Una lista vacía significa "ninguna tienda" (no "todas").
    if (Array.isArray(filters.store_ids)) {
      query = query.whereIn('store_id', filters.store_ids.map(String));
    }
    if (filters.status) {
      const status = String(filters.status).toUpperCase();
      if (status === 'ACTIVE') {
        query = query.where((b) => b.whereNull('status').orWhereNot('status', 'CLOSED'));
      } else if (TICKET_STATUSES.includes(status)) {
        query = query.where({ status });
      }
    }
    if (filters.is_b2c !== undefined) {
      query = filters.is_b2c
        ? query.where({ is_b2c: true })
        : query.where((b) => b.whereNull('is_b2c').orWhere({ is_b2c: false }));
    }
    if (filters.assigned_to === UNASSIGNED) {
      query = query.where((b) => b.whereNull('assigned_to').orWhere('assigned_to', ''));
    } else if (filters.assigned_to) {
      query = query.where('assigned_to', 'ilike', `%${escapeLike(filters.assigned_to)}%`);
    }
    if (filters.search) {
      const pattern = `%${escapeLike(filters.search)}%`;
      query = query.where((b) => b
        .where('serial_number', 'ilike', pattern)
        .orWhere('name', 'ilike', pattern)
        .orWhere('store_id', 'ilike', pattern));
    }
    return query;
  }

  static async getAll(filters = {}) {
    try {
      return await TicketRepository._applyListFilters(db('tickets'), filters).orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error('Error al obtener los tickets: ' + error.message);
    }
  }

  // Listado paginado: devuelve la página pedida y el total que cumple los filtros
  static async getPage(filters = {}, { page = 1, limit = DEFAULT_PAGE_SIZE, sort = 'created_at', order = 'desc' } = {}) {
    try {
      const safeLimit = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
      const safePage = Math.max(parseInt(page, 10) || 1, 1);
      const sortCol = SORTABLE_COLUMNS.includes(sort) ? sort : 'created_at';
      const sortDir = String(order).toLowerCase() === 'asc' ? 'asc' : 'desc';

      // El conteo va en una consulta aparte y sin ORDER BY (Postgres no lo admite con count(*))
      const countRow = await TicketRepository._applyListFilters(db('tickets'), filters).count('* as n').first();
      const total = Number(countRow?.n || 0);

      let query = TicketRepository._applyListFilters(db('tickets'), filters).orderBy(sortCol, sortDir);
      if (sortCol !== 'id') query = query.orderBy('id', 'desc'); // desempate estable entre páginas
      const rows = await query.limit(safeLimit).offset((safePage - 1) * safeLimit);

      return { rows, total, page: safePage, limit: safeLimit, totalPages: Math.max(Math.ceil(total / safeLimit), 1) };
    } catch (error) {
      throw new Error('Error al obtener los tickets: ' + error.message);
    }
  }

  // Conteos para el dashboard calculados en la base (antes se bajaban todos los tickets al navegador)
  static async getStats(assigneeName) {
    const statusExpr = "UPPER(COALESCE(status, 'OPEN'))";
    const [totalRow, byStatusRows, byStoreRows, mineRows] = await Promise.all([
      db('tickets').count('* as n').first(),
      db('tickets').select(db.raw(`${statusExpr} as status`)).count('* as n').groupByRaw(statusExpr),
      db('tickets')
        .whereNotNull('store_id')
        .select('store_id')
        .count('* as total')
        .select(db.raw(`SUM(CASE WHEN ${statusExpr} NOT IN ('CLOSED', 'RESOLVED') THEN 1 ELSE 0 END) as active`))
        .groupBy('store_id'),
      assigneeName
        ? db('tickets')
          .whereRaw(`${statusExpr} <> 'CLOSED'`)
          .where('assigned_to', 'ilike', `%${String(assigneeName).replace(/[%_]/g, '')}%`)
          .select('id', 'serial_number', 'name', 'store_id', 'status', 'priority', 'task_type', 'assigned_to', 'created_at')
          .orderBy('created_at', 'desc')
        : Promise.resolve([])
    ]);

    const by_status = {};
    byStatusRows.forEach((r) => { by_status[r.status] = Number(r.n); });
    const by_store = {};
    byStoreRows.forEach((r) => { by_store[r.store_id] = { total: Number(r.total), active: Number(r.active) }; });
    // assigned_to es una lista separada por comas: se confirma el nombre exacto
    const mine = mineRows.filter((t) => String(t.assigned_to || '').split(',').map((n) => n.trim()).includes(assigneeName));

    return { total: Number(totalRow?.n || 0), by_status, by_store, mine };
  }

  static async update(id, data) {
    const updatePayload = {};

    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description;
    
    const assigneeValue = data.assigned_to !== undefined ? data.assigned_to : data.assignee;
    if (assigneeValue !== undefined) updatePayload.assigned_to = assigneeValue || null;
    
    if (data.priority !== undefined) updatePayload.priority = sanitizePriority(data.priority);
    if (data.task_type !== undefined) updatePayload.task_type = sanitizeTaskType(data.task_type);
    if (data.store_id !== undefined && data.store_id !== 'null') updatePayload.store_id = data.store_id;
    
    if (data.is_apolo_sync !== undefined) updatePayload.is_apolo_sync = data.is_apolo_sync;

    const [updated] = await db('tickets')
      .where({ id })
      .update(updatePayload)
      .returning('*');
      
    // 🌟 INVOCACIÓN SILENCIOSA AL HUB AL EDITAR
    if (updated) {
        HubSyncService.registrarTicketEnHub(updated).catch(err => {
            console.error('❌ [Hub Sync Fatal Error]', err.message);
        });
    }

    return updated;
  }

  static async updateStatus(id, status, assigned_to) {
    try {
      const updateData = { status };
      if (status === 'CLOSED' || status === 'RESOLVED') {
        updateData.closed_at = db.fn.now();
      } else {
        updateData.closed_at = null;
      }

      if (assigned_to !== undefined) {
        updateData.assigned_to = assigned_to || null;
      }

      const [updatedTicket] = await db('tickets')
        .where({ id })
        .update(updateData)
        .returning('*');

      // 🌟 INVOCACIÓN SILENCIOSA AL HUB AL CAMBIAR ESTADO
      if (updatedTicket) {
        HubSyncService.registrarTicketEnHub(updatedTicket).catch(err => {
            console.error('❌ [Hub Sync Fatal Error]', err.message);
        });
      }

      return updatedTicket;
    } catch (error) {
      throw new Error('Error al actualizar el estado: ' + error.message);
    }
  }
}

module.exports = TicketRepository;