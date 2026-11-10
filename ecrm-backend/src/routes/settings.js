const express = require('express');
const router = express.Router();
const SettingsService = require('../services/SettingsService');

// Montado en /api/settings con verificarToken + requireSuperAdmin (index.js)

router.get('/', async (req, res) => {
  try {
    res.json({ success: true, data: await SettingsService.list() });
  } catch (error) {
    console.error('[Settings] Error listando ajustes:', error.message);
    res.status(500).json({ success: false, error: 'No se pudo leer la configuración.' });
  }
});

router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!SettingsService.DEFINITIONS[key]) {
      return res.status(404).json({ success: false, error: 'Ajuste no encontrado.' });
    }
    const value = await SettingsService.set(key, req.body?.value, req.adminUser?.email);
    req.logActivity?.('CONFIGURACION_CAMBIADA', `${key} = ${JSON.stringify(value)}`);
    res.json({ success: true, data: { key, value } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
