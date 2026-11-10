const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const PetService = require('../services/PetService');

// Montado en /api/pet con verificarToken + requireStaff (index.js). Los clientes no tienen mascota.

// Configuración que necesita el navegador (sin secretos)
router.get('/config', async (req, res) => {
  try {
    res.json({ success: true, data: await PetService.getConfig() });
  } catch (error) {
    console.error('[PET] Error leyendo configuración:', error.message);
    res.status(500).json({ success: false, error: 'No se pudo leer la configuración de la mascota.' });
  }
});

// Freno extra contra clics repetidos: 12 mensajes por minuto por usuario
const talkLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  keyGenerator: (req) => `pet:${req.adminUser?.id || req.adminUser?.email || 'anon'}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muy rápido 😅 Espera un momento.' }
});

router.post('/talk', talkLimiter, async (req, res) => {
  try {
    const mode = req.body?.mode === 'tip' ? 'tip' : 'chat';
    const result = await PetService.talk({ user: req.adminUser, message: req.body?.message, mode });
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[PET] Error:', error.message);
    res.status(500).json({ success: false, error: 'La mascota no pudo responder.' });
  }
});

module.exports = router;
