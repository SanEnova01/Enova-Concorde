const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const streamifier = require('streamifier');
const MetricsRepository = require('../repositories/MetricsRepository');

// Configuración de multer en memoria (no guarda el archivo en el disco, lo procesa directo en RAM)
const upload = multer({ storage: multer.memoryStorage() });

// NUEVA RUTA: Recibir y procesar el CSV
router.post('/upload-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

  const results = [];
  
  streamifier.createReadStream(req.file.buffer)
    .pipe(csv())
    .on('data', (data) => {
      // Mapeo exacto a las 13 columnas de tu CSV y tu nueva BD
      results.push({
        store_id: data['store_id'],
        redirect_ms: parseInt(data['redirect_ms']) || 0,
        dns_ms: parseInt(data['dns_ms']) || 0,
        tcp_ms: parseInt(data['tcp_ms']) || 0,
        ttfb_ms: parseInt(data['ttfb_ms']) || 0,
        dom_interactive_ms: parseInt(data['dom_interactive_ms']) || 0,
        dom_ms: parseInt(data['dom_ms']) || 0,
        load_ms: parseInt(data['load_ms']) || 0,
        total_weight_mb: parseFloat(data['total_weight_mb']) || 0,
        total_requests: parseInt(data['total_requests']) || 0,
        // Aquí capturamos las dos métricas por separado
        ram_core_mb: parseFloat(data['ram_core_mb']) || 0, 
        ram_total_mb: parseFloat(data['ram_total_mb']) || 0
      });
    })
    .on('end', async () => {
      try {
        await MetricsRepository.createBulk(results);
        res.status(200).json({ success: true, message: 'Data procesada exitosamente con doble métrica de RAM' });
      } catch (error) {
        console.error('Error de base de datos:', error);
        res.status(500).json({ error: 'Fallo al insertar en DB' });
      }
    });
});

// POST: Crear una nueva revisión diaria
router.post('/', async (req, res) => {
  try {
    const metricData = req.body;

    // Validación básica: el ID de la tienda es obligatorio
    if (!metricData.store_id) {
      return res.status(400).json({ error: 'El campo store_id es obligatorio.' });
    }

    const result = await MetricsRepository.create(metricData);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// NUEVO GET: Obtener TODAS las métricas (Ruta que generaba el error 404)
router.get('/', async (req, res) => {
  try {
    const results = await MetricsRepository.getAll();
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// GET: Obtener métricas de una tienda específica para la vista de ClientDetail
router.get('/:store_id', async (req, res) => {
  try {
    const storeId = req.params.store_id;
    const results = await MetricsRepository.getAllByStore(storeId);
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

module.exports = router;