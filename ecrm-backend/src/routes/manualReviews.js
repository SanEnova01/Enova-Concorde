const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 🟢 GET: Obtener los días revisados de un mes específico para el calendario
router.get('/monthly', async (req, res) => {
  try {
    const { store_id, year, month } = req.query;
    
    // 🔥 FIX: Calcular el último día real del mes (28, 29, 30 o 31)
    // En JS, el día '0' del mes siguiente nos da el último día del mes actual
    const lastDay = new Date(year, month, 0).getDate();
    
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const reviews = await db('store_daily_reviews')
      .where({ store_id })
      .where('review_date', '>=', startStr)
      .where('review_date', '<=', endStr)
      .select(db.raw("to_char(review_date, 'YYYY-MM-DD') as formatted_date"));

    const dates = reviews.map(r => r.formatted_date);

    res.json({ success: true, data: dates });
  } catch (error) {
    console.error('Error obteniendo revisiones:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
});

// 🔵 POST: Guardar el Check Diario (con firma) y registrar en Auditoría
router.post('/register', async (req, res) => {
  try {
    const { store_id, date, reviewer_name } = req.body;
    
    if (!store_id || !date || !reviewer_name) {
      return res.status(400).json({ success: false, error: 'Faltan parámetros.' });
    }

    const exists = await db('store_daily_reviews').where({ store_id, review_date: date }).first();
    
    if (exists) {
      return res.status(400).json({ success: false, error: 'La tienda ya fue verificada el día de hoy.' });
    }

    await db('store_daily_reviews').insert({ 
        store_id, 
        review_date: date,
        reviewer_name 
    });

    if (req.logActivity) {
      req.logActivity(
        'REGISTRO_DIARIO', 
        `Verificación diaria completada para la tienda "${store_id}" por ${reviewer_name}`
      );
    }

    res.json({ success: true, message: 'Revisión diaria registrada exitosamente' });
  } catch (error) {
    console.error('Error guardando revisión diaria:', error);
    res.status(500).json({ success: false, error: 'Error al registrar la revisión' });
  }
});

module.exports = router;