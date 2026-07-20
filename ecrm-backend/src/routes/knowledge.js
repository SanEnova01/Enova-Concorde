const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET: Leer todo el conocimiento de una tienda
router.get('/:store_id', async (req, res) => {
  try {
    const { store_id } = req.params;
    const kb = await db('knowledge_base').where({ store_id }).orderBy('created_at', 'desc');
    res.json({ success: true, data: kb });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al obtener la base de conocimiento.' });
  }
});

// POST: Agregar una nueva regla/política a la IA
router.post('/', async (req, res) => {
  try {
    const { store_id, category, question, answer } = req.body;
    
    if (!store_id || !category || !answer) {
      return res.status(400).json({ success: false, error: 'Faltan datos obligatorios.' });
    }

    const [newEntry] = await db('knowledge_base').insert({
      store_id,
      category,
      question,
      answer
    }).returning('*');

    res.json({ success: true, data: newEntry });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al guardar en la base de conocimiento.' });
  }
});

// DELETE: Borrar una regla
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db('knowledge_base').where({ id }).del();
    res.json({ success: true, message: 'Regla eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al eliminar.' });
  }
});

module.exports = router;