const db = require('../config/db');

class TicketRepository {
  static async generateSerialNumber() {
    const year = new Date().getFullYear();
    const lastTicket = await db('tickets')
      .where('serial_number', 'like', `SOP-${year}-%`)
      .orderBy('created_at', 'desc')
      .first();

    let nextNumber = 1;
    if (lastTicket) {
      const parts = lastTicket.serial_number.split('-');
      nextNumber = parseInt(parts[2], 10) + 1;
    }

    const paddedNumber = nextNumber.toString().padStart(4, '0');
    return `SOP-${year}-${paddedNumber}`;
  }

  static async create(ticketData) {
    try {
      const serial_number = await this.generateSerialNumber();
      
      // Iniciamos una transacción segura en PostgreSQL
      const newTicket = await db.transaction(async (trx) => {
        // 1. Insertamos el ticket incluyendo descripción/nota
        const [insertedTicket] = await trx('tickets').insert({
          serial_number,
          name: ticketData.name,
          description: ticketData.description || null, // <-- CAMPO EDITADO: NOTA/DESCRIPCIÓN
          store_id: ticketData.store_id,
          priority: ticketData.priority || 'MEDIUM',
          task_type: ticketData.task_type,
          status: 'OPEN',
          assigned_to: ticketData.assigned_to || null,
        }).returning('*');

        // 2. Incrementamos +1 de forma automática en el contador de la tienda asociada
        await trx('stores')
          .where({ id: ticketData.store_id })
          .increment('ticket_count', 1);

        return insertedTicket;
      });

      return newTicket;
    } catch (error) {
      throw new Error('Error al crear el ticket y actualizar el contador: ' + error.message);
    }
  }

  static async getAll() {
    try {
      return await db('tickets').orderBy('created_at', 'desc');
    } catch (error) {
      throw new Error('Error al obtener los tickets: ' + error.message);
    }
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