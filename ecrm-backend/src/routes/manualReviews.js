const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Ajusta tu conexión a BD

// 🟢 GET: Obtener los días revisados de un mes específico para una tienda
router.get('/monthly', async (req, res) => {
  try {
    const { store_id, year, month } = req.query;
    
    if (!store_id || !year || !month) {
      return res.status(400).json({ success: false, error: 'Faltan parámetros.' });
    }
    
    const reviews = await db('store_daily_reviews')
      .where('store_id', store_id)
      .whereRaw('EXTRACT(YEAR FROM review_date) = ?', [year])
      .whereRaw('EXTRACT(MONTH FROM review_date) = ?', [month])
      .select('review_date');

    const dates = reviews.map(r => {
      const d = new Date(r.review_date);
      return d.toISOString().split('T')[0];
    });

    res.json({ success: true, data: dates });
  } catch (error) {
    console.error('Error obteniendo revisiones:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
});

// 🔵 POST: Marcar o desmarcar un día
router.post('/toggle', async (req, res) => {
  try {
    const { store_id, date, checked } = req.body;
    
    if (!store_id || !date) {
      return res.status(400).json({ success: false, error: 'Faltan parámetros.' });
    }

    if (checked) {
      const exists = await db('store_daily_reviews').where({ store_id, review_date: date }).first();
      if (!exists) {
        await db('store_daily_reviews').insert({ store_id, review_date: date });
      }
    } else {
      await db('store_daily_reviews').where({ store_id, review_date: date }).del();
    }

    res.json({ success: true, message: 'Revisión actualizada' });
  } catch (error) {
    console.error('Error guardando revisión:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar revisión' });
  }
});

module.exports = router;