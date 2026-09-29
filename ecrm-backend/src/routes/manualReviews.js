const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 🟢 GET: Obtener los días revisados de un mes específico para el calendario
router.get('/monthly', async (req, res) => {
  try {
    const { store_id, year, month } = req.query;
    
    // Rango seguro de búsqueda sin usar EXTRACT (que a veces falla con strings)
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month).padStart(2, '0')}-31`;

    const reviews = await db('store_daily_reviews')
      .where({ store_id })
      .where('review_date', '>=', startStr)
      .where('review_date', '<=', endStr)
      .select('review_date');

    // 🛑 MAGIA AQUÍ: Convertimos a ISO y cortamos el String para evitar que 
    // la zona horaria de Perú le reste un día a la fecha original de la BD.
    const dates = reviews.map(r => {
      const isoString = new Date(r.review_date).toISOString();
      return isoString.split('T')[0]; 
    });

    res.json({ success: true, data: dates });
  } catch (error) {
    console.error('Error obteniendo revisiones:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
});

// 🔵 POST: Guardar el Check Diario (con firma) y bloquear duplicados
router.post('/register', async (req, res) => {
  try {
    const { store_id, date, reviewer_name } = req.body;
    
    if (!store_id || !date || !reviewer_name) {
      return res.status(400).json({ success: false, error: 'Faltan parámetros.' });
    }

    // Verificar si ya se registró hoy
    const exists = await db('store_daily_reviews').where({ store_id, review_date: date }).first();
    
    if (exists) {
      return res.status(400).json({ success: false, error: 'La tienda ya fue verificada el día de hoy.' });
    }

    // Registrar
    await db('store_daily_reviews').insert({ 
        store_id, 
        review_date: date,
        reviewer_name 
    });

    res.json({ success: true, message: 'Revisión diaria registrada exitosamente' });
  } catch (error) {
    console.error('Error guardando revisión diaria:', error);
    res.status(500).json({ success: false, error: 'Error al registrar la revisión' });
  }
});

module.exports = router;