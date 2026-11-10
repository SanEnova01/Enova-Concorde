const express = require('express');
const router = express.Router();
const db = require('../config/db');
const TicketRepository = require('../repositories/TicketRepository');
const { registrarTicketEnHub } = require('../services/HubSyncService');
// POST: Crear un nuevo ticket (Con Auditoría)
router.post('/', async (req, res) => {
  try {
    const ticketData = req.body;

    if (!ticketData.name || !ticketData.store_id || !ticketData.task_type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan campos obligatorios: name, store_id o task_type.' 
      });
    }

    // Solo el equipo puede crear tickets ya cerrados o en progreso; un cliente siempre crea OPEN
    const role = String(req.adminUser?.role || '').toLowerCase().trim();
    if (role !== 'admin' && role !== 'super admin') delete ticketData.status;

    const result = await TicketRepository.create(ticketData);

    if (req.logActivity) {
      req.logActivity(
        'CREAR_TICKET', 
        `Ticket "${result.serial_number || result.id}" (${ticketData.name}) creado para la tienda "${ticketData.store_id}"`
      );
    }

    // El envío al Hub ya lo hace TicketRepository.create (antes se enviaba dos veces)

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Error capturado en backend:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Listar todos los tickets
router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.is_apolo_sync === 'true' || req.query.is_apolo_sync === true) {
      filters.is_apolo_sync = true;
    }
    if (req.query.store_id) filters.store_id = String(req.query.store_id);

    let results = await TicketRepository.getAll(filters);

    // ?fields=summary: sin la descripción (texto largo). Lo usa el dashboard, que solo cuenta tickets.
    if (req.query.fields === 'summary') {
      results = results.map(({ description, ...rest }) => rest);
    }
    // ?fields=list: descripción recortada a 300 caracteres (lo que muestra la tabla de Tickets
    // Totales como tooltip) conservando la marca [GMAIL_ID: ...] que usa para enlazar el correo.
    if (req.query.fields === 'list') {
      results = results.map((t) => {
        const d = t.description || '';
        if (d.length <= 300) return t;
        const gmailTag = d.match(/\[GMAIL_ID:\s*[a-zA-Z0-9]+\]/);
        return { ...t, description: d.slice(0, 300) + '…' + (gmailTag ? ` ${gmailTag[0]}` : ''), description_truncated: true };
      });
    }
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// GET: Conteos del dashboard (totales, por estado, por tienda y los pendientes del usuario)
router.get('/stats', async (req, res) => {
  try {
    const assignee = req.adminUser?.name || req.adminUser?.email || null;
    res.status(200).json({ success: true, data: await TicketRepository.getStats(assignee) });
  } catch (error) {
    console.error('[TICKETS] Error en stats:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// GET: Un solo ticket (antes el detalle descargaba todos los tickets para buscar uno)
router.get('/:id', async (req, res) => {
  try {
    const ticket = await db('tickets').where({ id: req.params.id }).first();
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket no encontrado.' });
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// PATCH: Actualizar el estado de un ticket en Kanban (Con Auditoría)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assigned_to, assignee } = req.body;

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Estado inválido o ausente.' 
      });
    }

    const finalAssignee = assigned_to !== undefined ? assigned_to : assignee;
    const result = await TicketRepository.updateStatus(id, status, finalAssignee);
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Ticket no encontrado.' });
    }

    if (req.logActivity) {
      req.logActivity(
        'CAMBIAR_ESTADO_TICKET', 
        `Ticket ID ${id} (${result.serial_number || ''}) cambió a estado [${status}]${finalAssignee ? ` - Asignado a: ${finalAssignee}` : ''}`
      );
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// PUT: Actualizar datos de un ticket (Con Auditoría)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedTicket = await TicketRepository.update(id, req.body);
    if (!updatedTicket) {
      return res.status(404).json({ success: false, error: 'Ticket no encontrado.' });
    }

    if (req.logActivity) {
      req.logActivity(
        'EDITAR_TICKET', 
        `Ticket ID ${id} (${updatedTicket.serial_number || ''}) actualizado. Responsable: ${updatedTicket.assigned_to || 'Sin asignar'}`
      );
    }

    res.status(200).json({ success: true, data: updatedTicket });
  } catch (error) {
    console.error('Error al actualizar ticket:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedTicket = await TicketRepository.update(id, req.body);
    if (!updatedTicket) {
      return res.status(404).json({ success: false, error: 'Ticket no encontrado.' });
    }

    if (req.logActivity) {
      req.logActivity(
        'EDITAR_TICKET', 
        `Ticket ID ${id} (${updatedTicket.serial_number || ''}) actualizado`
      );
    }

    res.status(200).json({ success: true, data: updatedTicket });
  } catch (error) {
    console.error('Error al actualizar ticket:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE: Borrar ticket (Con Auditoría)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await db('tickets').where({ id }).first();

    if (ticket && ticket.description) {
      const match = ticket.description.match(/\[HUBSPOT_ID:\s*(\d+)\]/);
      if (match && match[1]) {
        const hsId = match[1];
        const token = process.env.HUBSPOT_ACCESS_TOKEN;

        if (token) {
          await fetch(`https://api.hubapi.com/crm/v3/objects/tickets/${hsId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }
      }
    }

    await db('tickets').where({ id }).del();

    if (req.logActivity) {
      req.logActivity(
        'ELIMINAR_TICKET', 
        `Ticket ID ${id} (${ticket?.serial_number || ticket?.name || ''}) fue eliminado permanentemente`
      );
    }

    return res.json({ 
      success: true, 
      message: 'Ticket eliminado correctamente de Concorde y HubSpot.' 
    });
  } catch (error) {
    console.error('Error al eliminar ticket:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await db('ticket_messages')
      .where({ ticket_id: id })
      .orderBy('created_at', 'asc');
    
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { sender, body } = req.body;
    
    if (!body) {
      return res.status(400).json({ success: false, error: 'El cuerpo del mensaje es requerido' });
    }

    const [newMessage] = await db('ticket_messages').insert({
      ticket_id: id,
      sender: sender || 'Usuario Desconocido',
      body: body
    }).returning('*');

    res.json({ success: true, data: newMessage });
  } catch (error) {
    console.error('Error al guardar mensaje:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;