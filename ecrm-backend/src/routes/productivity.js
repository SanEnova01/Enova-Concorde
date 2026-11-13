const express = require('express');
const router = express.Router();
const ProductivityRepository = require('../repositories/ProductivityRepository');

// Productividad del equipo (solo staff: se monta con verificarToken + requireStaff en index.js)
// GET /api/productivity?from=YYYY-MM-DD&to=YYYY-MM-DD&assignee=Nombre
router.get('/', async (req, res) => {
  try {
    const data = await ProductivityRepository.getReport(req.query);
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof ProductivityRepository.FilterError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('Error en productividad:', error);
    res.status(500).json({ success: false, error: 'No se pudo calcular la productividad.' });
  }
});

module.exports = router;
