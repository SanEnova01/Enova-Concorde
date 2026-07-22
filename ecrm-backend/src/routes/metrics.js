const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const streamifier = require('streamifier');
const nodemailer = require('nodemailer');
const MetricsRepository = require('../repositories/MetricsRepository');

const upload = multer({ storage: multer.memoryStorage() });

// Configuración Transporter Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// === ESTADO DEL BOT EN MEMORIA ===
let botStatusInfo = {
  last_heartbeat: null,
  is_running: false
};

// ======================================================
// 1. RUTAS ESTÁTICAS DEL BOT Y ACCIONES (DEBEN IR ARRIBA)
// ======================================================

// POST: El bot envía su latido
router.post('/bot-heartbeat', (req, res) => {
  console.log('🟢 [BACKEND] RECIBÍ UN LATIDO DEL BOT. Datos:', req.body);
  
  const rawKey = req.headers['x-api-key'] || '';
  if (rawKey.trim() !== 'ENOVA_SECRET_API_KEY_2026' && rawKey.trim() !== 'LLAVE_MAESTRA_SECRETA_DEL_CRM_2026') {
    console.log('🔴 [BACKEND] RECHAZADO: API KEY INCORRECTA');
    return res.status(401).json({ success: false, error: 'API Key no autorizada' });
  }

  botStatusInfo.last_heartbeat = new Date().toISOString();
  if (typeof req.body?.is_running !== 'undefined') {
    botStatusInfo.is_running = !!req.body.is_running;
  }
  res.json({ success: true, timestamp: botStatusInfo.last_heartbeat });
});

// GET: El Frontend consulta el estado
router.get('/bot-status', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (!botStatusInfo.last_heartbeat) {
    return res.json({ success: true, status: 'OFFLINE', last_heartbeat: null, is_running: false });
  }

  const now = new Date();
  const lastBeat = new Date(botStatusInfo.last_heartbeat);
  const diffMinutes = (now - lastBeat) / (1000 * 60);

  // 🌟 Margen de 70 minutos para dar espacio al latido de cada 30 minutos (tolerancia de 2 latidos)
  const isOnline = diffMinutes <= 70;

  res.json({
    success: true,
    status: isOnline ? 'ONLINE' : 'OFFLINE',
    last_heartbeat: botStatusInfo.last_heartbeat,
    minutes_ago: Math.floor(diffMinutes),
    is_running: isOnline ? botStatusInfo.is_running : false
  });
});


// POST: Ruta para forzar análisis manual
router.post('/force-run', async (req, res) => {
  console.log('⚡ [BACKEND] FRONTEND PIDIÓ FORZAR ANÁLISIS');
  try {
    const BOT_SERVICE_URL = process.env.BOT_SERVICE_URL || 'http://localhost:3001';
    console.log(`⚡ [BACKEND] INTENTANDO LLAMAR AL BOT EN: ${BOT_SERVICE_URL}/run-force`);
    
    const botRes = await fetch(`${BOT_SERVICE_URL}/run-force`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'ENOVA_SECRET_API_KEY_2026'
      }
    });

    console.log(`⚡ [BACKEND] RESPUESTA DEL BOT RECIBIDA. Status: ${botRes.status}`);
    const data = await botRes.json();
    return res.json(data);
  } catch (error) {
    console.error("🔴 [BACKEND] ERROR FATAL CONECTANDO AL BOT:", error.message);
    res.status(500).json({ success: false, error: 'Error interno: ' + error.message });
  }
});

// POST: Notificar fin de análisis automático
router.post('/notify-completion', async (req, res) => {
  const rawKey = req.headers['x-api-key'] || '';
  if (rawKey.trim() !== 'ENOVA_SECRET_API_KEY_2026' && rawKey.trim() !== 'LLAVE_MAESTRA_SECRETA_DEL_CRM_2026') {
    return res.status(401).json({ success: false, error: 'API Key no autorizada' });
  }

  const { total_stores, success_count, failed_count, date } = req.body;

  try {
    if (process.env.SMTP_USER) {
      await transporter.sendMail({
        from: `"Concorde Analyzer Bot" <${process.env.SMTP_USER}>`,
        to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
        subject: `✅ Reporte de Análisis Ejecutado - ${new Date().toLocaleDateString()}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #111; color: #fff; border-radius: 8px;">
            <h2 style="color: #FFD700;">🚀 Concorde Analyzer Report</h2>
            <p>Se ha completado la ronda de análisis de rendimiento diario.</p>
            <ul>
              <li><strong>Fecha:</strong> ${new Date(date).toLocaleString()}</li>
              <li><strong>Tiendas Analizadas:</strong> ${total_stores}</li>
              <li><strong>Exitosas:</strong> <span style="color: #16a34a;">${success_count}</span></li>
              <li><strong>Fallidas / Crash:</strong> <span style="color: #dc2626;">${failed_count}</span></li>
            </ul>
            <p>Puedes revisar el tablero detallado directamente en la plataforma Concorde.</p>
          </div>
        `
      });
    }
    res.json({ success: true, message: 'Notificación procesada' });
  } catch (error) {
    console.error('Error enviando mail de reporte:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Métricas agregadas (Diaria, Mensual, Anual)
router.get('/aggregated', async (req, res) => {
  try {
    const { store_id, period } = req.query; // period: 'daily' | 'monthly' | 'yearly'
    const results = await MetricsRepository.getAggregatedMetrics(store_id, period || 'daily');
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error al agrupar métricas' });
  }
});

// POST: Carga masiva mediante CSV
router.post('/upload-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  const results = [];
  streamifier.createReadStream(req.file.buffer)
    .pipe(csv())
    .on('data', (data) => {
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
        ram_core_mb: parseFloat(data['ram_core_mb']) || 0, 
        ram_total_mb: parseFloat(data['ram_total_mb']) || 0
      });
    })
    .on('end', async () => {
      try {
        await MetricsRepository.createBulk(results);
        res.status(200).json({ success: true, message: 'Data procesada exitosamente' });
      } catch (error) {
        res.status(500).json({ error: 'Fallo al insertar en DB' });
      }
    });
});

// ======================================================
// 2. RUTAS DE BÚSQUEDA GENERAL Y DINÁMICAS (HASTA ABAJO)
// ======================================================

// POST: Registrar métrica individual
router.post('/', async (req, res) => {
  try {
    const metricData = req.body;
    if (!metricData.store_id) return res.status(400).json({ error: 'El campo store_id es obligatorio.' });
    const result = await MetricsRepository.create(metricData);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// GET: Obtener todas las métricas
router.get('/', async (req, res) => {
  try {
    const results = await MetricsRepository.getAll();
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// GET: Obtener métricas por ID de tienda (SIEMPRE DEBE IR AL FINAL DE LOS GETs)
router.get('/:store_id', async (req, res) => {
  try {
    const storeId = req.params.store_id;
    const results = await MetricsRepository.getAllByStore(storeId);
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

module.exports = router;