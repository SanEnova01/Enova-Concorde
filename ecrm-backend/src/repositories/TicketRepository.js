const db = require('../config/db');

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

class TicketRepository {
  // 🌟 AHORA DETERMINA EL PREFIJO DEPENDIENDO SI ES B2B (SOP) O B2C (HUB)
  static async generateSerialNumber(isB2C = false) {
    const year = new Date().getFullYear();
    const prefix = isB2C ? 'HUB' : 'SOP';

    const lastTicket = await db('tickets')
      .where('serial_number', 'like', `${prefix}-${year}-%`)
      .orderBy('created_at', 'desc')
      .first();

    let nextNumber = 1;
    if (lastTicket) {
      const parts = lastTicket.serial_number.split('-');
      if (parts.length >= 3) {
        nextNumber = parseInt(parts[2], 10) + 1;
      }
    }

    const paddedNumber = nextNumber.toString().padStart(4, '0');
    return `${prefix}-${year}-${paddedNumber}`;
  }

  static async create(ticketData) {
    try {
      const isB2C = !!ticketData.is_b2c;
      // 👈 Genera el serial pasando la bandera de B2C
      const serial_number = await this.generateSerialNumber(isB2C);
      
      const validPriority = sanitizePriority(ticketData.priority);
      const validTaskType = sanitizeTaskType(ticketData.task_type);

      let finalStoreId = ticketData.store_id;
      if (!finalStoreId || finalStoreId === 'null') {
        const defaultStore = await db('stores').first();
        finalStoreId = defaultStore ? defaultStore.id : 'enova.agency';
      }

      const newTicket = await db.transaction(async (trx) => {
        const [insertedTicket] = await trx('tickets').insert({
          serial_number,
          name: ticketData.name || 'Ticket Automático',
          description: ticketData.description || null,
          store_id: finalStoreId,
          priority: validPriority,
          task_type: validTaskType,
          status: 'OPEN',
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

      return newTicket;
    } catch (error) {
      throw new Error('Error al crear el ticket: ' + error.message);
    }
  }

  static async getAll() {
    try {
      return await db('tickets').orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error('Error al obtener los tickets: ' + error.message);
    }
  }

  static async update(id, data) {
    const validPriority = sanitizePriority(data.priority);
    const validTaskType = sanitizeTaskType(data.task_type);
    
    const updatePayload = {
      name: data.name,
      description: data.description,
      assigned_to: data.assigned_to || null,
      priority: validPriority,
      task_type: validTaskType
    };

    if (data.store_id && data.store_id !== 'null') {
      updatePayload.store_id = data.store_id;
    }

    const [updated] = await db('tickets')
      .where({ id })
      .update(updatePayload)
      .returning('*');
      
    return updated;
  }

  static async delete(id) {
    return await db('tickets').where({ id }).del();
  }
  
  static async updateStatus(id, status) {
    try {
      const updateData = { status };
      if (status === 'CLOSED' || status === 'RESOLVED') {
        updateData.closed_at = db.fn.now();
      } else {
        updateData.closed_at = null;
      }

      const [updatedTicket] = await db('tickets')
        .where({ id })
        .update(updateData)
        .returning('*');
      return updatedTicket;
    } catch (error) {
      throw new Error('Error al actualizar el estado: ' + error.message);
    }
  }
}

module.exports = TicketRepository;