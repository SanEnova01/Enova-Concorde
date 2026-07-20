const express = require('express');
const router = express.Router();
const db = require('../config/db'); // <-- CORRECCIÓN 1: Importante para que no falle el DELETE
const TicketRepository = require('../repositories/TicketRepository');

// POST: Crear un nuevo ticket
router.post('/', async (req, res) => {
  try {
    const ticketData = req.body;

    // Validación básica de campos obligatorios
    if (!ticketData.name || !ticketData.store_id || !ticketData.task_type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan campos obligatorios: name, store_id o task_type.' 
      });
    }

    const result = await TicketRepository.create(ticketData);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Error capturado en backend:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Listar todos los tickets
router.get('/', async (req, res) => {
  try {
    const results = await TicketRepository.getAll();
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// PATCH: Actualizar el estado de un ticket (Kanban drag&drop)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Estado inválido o ausente.' 
      });
    }

    const result = await TicketRepository.updateStatus(id, status);
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Ticket no encontrado.' });
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// CORRECCIÓN 2: Ruta PUT agregada para solucionar el error 404 al guardar la edición
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedTicket = await TicketRepository.update(id, req.body);
    
    if (!updatedTicket) {
      return res.status(404).json({ success: false, error: 'Ticket no encontrado.' });
    }
    
    res.status(200).json({ success: true, data: updatedTicket });
  } catch (error) {
    console.error('Error al actualizar ticket:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE: Borra localmente y en HubSpot
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Consultar el ticket antes de borrarlo (Ahora sí funciona porque db está importado)
    const ticket = await db('tickets').where({ id }).first();

    if (ticket && ticket.description) {
      const match = ticket.description.match(/\[HUBSPOT_ID:\s*(\d+)\]/);
      if (match && match[1]) {
        const hsId = match[1];
        const token = process.env.HUBSPOT_ACCESS_TOKEN;

        if (token) {
          // 2. Eliminar el ticket directamente en HubSpot
          const hsRes = await fetch(`https://api.hubapi.com/crm/v3/objects/tickets/${hsId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (hsRes.ok) {
            console.log(`[HubSpot Sync] Ticket ${hsId} eliminado exitosamente de HubSpot.`);
          } else {
            console.warn(`[HubSpot Sync] No se pudo borrar en HubSpot (Status: ${hsRes.status}).`);
          }
        }
      }
    }

    // 3. Eliminar de la base de datos local de Concorde
    await TicketRepository.delete(id);

    return res.json({ 
      success: true, 
      message: 'Ticket eliminado correctamente de Concorde y HubSpot.' 
    });
  } catch (error) {
    console.error('Error al eliminar ticket:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;