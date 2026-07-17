const express = require('express');
const router = express.Router();
const TicketRepository = require('../repositories/TicketRepository');

// POST: Crear un nuevo ticket
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
    // AQUÍ ESTÁ LA MAGIA: Enviamos el error real de PostgreSQL al frontend
    res.status(500).json({ success: false, error: error.message });
  }
});
// GET: Listar todos los tickets (Para tu Kanban / Admin)
router.get('/', async (req, res) => {
  try {
    const results = await TicketRepository.getAll();
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// PATCH: Actualizar el estado de un ticket (Arrastrar en el Kanban)
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
module.exports = router;