const db = require('../config/db');
const HubSyncService = require('../services/HubSyncService');

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

  static async create(ticketData) {
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
        const serial_number = await this.generateSerialNumber(isB2C, trx);

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

  static async getAll(filters = {}) {
    try {
      let query = db('tickets').orderBy('created_at', 'desc');

      if (filters.is_apolo_sync) {
        query = query.where({ is_apolo_sync: true });
      }
      if (filters.store_id) {
        query = query.where({ store_id: filters.store_id });
      }

      return await query;
    } catch (error) {
      throw new Error('Error al obtener los tickets: ' + error.message);
    }
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