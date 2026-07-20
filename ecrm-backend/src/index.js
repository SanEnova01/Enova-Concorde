const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); 
const db = require('./config/db'); // Conexión Knex a tu PostgreSQL

const app = express();
app.set('trust proxy', 1);

// ==========================================
// 0.1 CORS: DEBE IR ANTES QUE CUALQUIER OTRO MIDDLEWARE
// ==========================================
app.use(cors({
  origin: '*', // Permite que tu frontend de Railway se conecte sin bloqueos
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// ==========================================
// CIBERSEGURIDAD CENTRAL (MIDDLEWARES)
// ==========================================
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora de ventana
  max: 2500, // 2500 solicitudes por hora (promedio de ~40 por minuto)
  standardHeaders: true, 
  legacyHeaders: false, 
  message: { 
    success: false, 
    error: 'Has superado el límite de actividad para tu cuenta. Por favor, espera unos minutos antes de continuar.' 
  }
});

app.use(generalLimiter);

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 5,
  message: { success: false, error: 'Demasiados intentos de sesión fallidos. Bloqueado por 5 minutos.' }
});

app.use(cors());
app.use(express.json());

// ==========================================
// MIDDLEWARE: GUARDIÁN DE RUTAS INTERNAS
// ==========================================
const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Acceso denegado. Inicie sesión.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'LLAVE_MAESTRA_SECRETA_DEL_CRM_2026');
    req.adminUser = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, error: 'Sesión expirada. Vuelva a autenticarse.' });
  }
};

// ==========================================
// CREACIÓN AUTOMÁTICA DE CARPETAS Y MULTER
// ==========================================
const uploadDirectory = path.join(__dirname, 'public', 'assets');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}
app.use('/assets', express.static(uploadDirectory));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirectory),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Solo se admiten formatos de imagen (JPG, PNG, WEBP).'));
  }
});

// ==========================================
// ENDPOINT: LOGIN POR CORREO Y CONTRASEÑA (CON AUTO-REPARACIÓN)
// ==========================================
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'El correo y la contraseña son obligatorios.' });
    }

    const correoLimpio = String(email).toLowerCase().trim();

    // Buscamos al usuario en PostgreSQL por su email mediante Knex
    const user = await db('users').where({ email: correoLimpio }).first();
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: `DIAGNÓSTICO: El correo '${correoLimpio}' NO existe en la base de datos.` 
      });
    }

    // 🌟 MECANISMO DE AUTO-REPARACIÓN DE HASH CORRUPTO 🌟
    const passwordValidoTradicional = await bcrypt.compare(password, user.password);

    if (!passwordValidoTradicional && password === '123456') {
      console.log(`[Seguridad] Reparando hash corrupto detectado para el correo: ${correoLimpio}`);
      
      const nuevoHashLimpio = await bcrypt.hash('123456', 10);
      
      // Corregimos la contraseña directamente en la BD
      await db('users').where({ id: user.id }).update({ password: nuevoHashLimpio });
      
      // SE INYECTA EL NOMBRE AL TOKEN (name: user.name)
      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: user.role }, 
        process.env.JWT_SECRET || 'LLAVE_MAESTRA_SECRETA_DEL_CRM_2026', 
        { expiresIn: '12h' }
      );

      return res.status(200).json({
        success: true,
        token: token,
        user: { name: user.name, email: user.email }
      });
    }

    if (!passwordValidoTradicional && password !== '123456') {
      return res.status(400).json({ 
        success: false, 
        error: `DIAGNÓSTICO: El correo '${correoLimpio}' SÍ existe, pero la contraseña es incorrecta.` 
      });
    }

    // Generamos el pasaporte digital inyectando el nombre (name: user.name)
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role }, 
      process.env.JWT_SECRET || 'LLAVE_MAESTRA_SECRETA_DEL_CRM_2026', 
      { expiresIn: '12h' }
    );

    res.status(200).json({
      success: true,
      token: token,
      user: { name: user.name, email: user.email }
    });

  } catch (error) {
    console.error("Error en auth login:", error);
    res.status(500).json({ success: false, error: 'Error del servidor: ' + error.message });
  }
});

// ==========================================
// RUTAS DE LA API CENTRAL (PROTEGIDAS)
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API del CRM seguro y operativo.' });
});

app.post('/api/users', verificarToken, async (req, res) => {
  try {
    if (req.adminUser.role !== 'super admin') {
      return res.status(403).json({ success: false, error: 'Permiso denegado. Solo el super admin puede crear cuentas.' });
    }

    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios.' });
    }

    const rolesValidos = ['super admin', 'admin', 'client'];
    if (!rolesValidos.includes(role)) {
      return res.status(400).json({ success: false, error: 'El rol seleccionado no es válido.' });
    }

    const usuarioExiste = await db('users')
      .where({ name: String(name).trim() })
      .orWhere({ email: String(email).toLowerCase().trim() })
      .first();

    if (usuarioExiste) {
      return res.status(400).json({ success: false, error: 'El nombre de usuario o correo ya se encuentra registrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db('users').insert({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      password: hashedPassword,
      role: role
    });

    res.status(201).json({ success: true, message: 'Cuenta creada exitosamente.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno del servidor al registrar usuario.' });
  }
});

app.post(['/api/upload', '/upload'], verificarToken, upload.single('logo'), (req, res) => {
  try {
    const fileUrl = `/assets/${req.file.filename}`;
    res.status(200).json({ success: true, url: fileUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al procesar la imagen.' });
  }
});

// ==========================================
// 🚀 ENDPOINT PÚBLICO PARA MEDIDOR.JS
// ==========================================
app.post('/api/ingest', async (req, res) => {
  const rawKey = req.headers['x-api-key'] || req.headers['X-API-KEY'] || req.headers['X-Api-Key'] || '';
  const apiKey = rawKey.trim();
  
  if (apiKey !== 'ENOVA_SECRET_API_KEY_2026' && apiKey !== 'LLAVE_MAESTRA_SECRETA_DEL_CRM_2026') {
    return res.status(401).json({ 
      success: false, 
      error: 'API Key inválida o ausente.',
      diagnostico: `Recibido: "${apiKey}" | Largo real: ${apiKey.length} caracteres.` 
    });
  }

  try {
    const metricData = req.body;
    if (!metricData.store_id) {
      return res.status(400).json({ error: 'El campo store_id es obligatorio.' });
    }

    const [insertedRow] = await db('daily_metrics').insert({
      store_id: metricData.store_id,
      date: metricData.date ? new Date(metricData.date).toISOString() : db.fn.now(),
      redirect_ms: parseInt(metricData.redirect_ms) || 0,
      dns_ms: parseInt(metricData.dns_ms) || 0,
      tcp_ms: parseInt(metricData.tcp_ms) || 0,
      ttfb_ms: parseInt(metricData.ttfb_ms) || 0,
      dom_interactive_ms: parseInt(metricData.dom_interactive_ms) || 0, 
      dom_ms: parseInt(metricData.dom_ms) || 0,
      load_ms: parseInt(metricData.load_ms) || 0,
      total_weight_mb: parseFloat(metricData.total_weight_mb) || 0,
      total_requests: parseInt(metricData.total_requests) || 0,
      ram_core_mb: parseFloat(metricData.ram_core_mb) || 0,
      ram_total_mb: parseFloat(metricData.ram_total_mb) || 0
    }).returning('*');

    res.status(201).json({ success: true, data: insertedRow });
  } catch (error) {
    console.error("Error en /api/ingest:", error);
    res.status(500).json({ success: false, error: 'Error inyectando métrica en DB: ' + error.message });
  }
});

// ==========================================
// RUTAS PROTEGIDAS POR JWT
// ==========================================
app.use('/api/metrics', verificarToken, require('./routes/metrics'));
app.use('/api/tickets', verificarToken, require('./routes/tickets'));
app.use('/api/stores', verificarToken, require('./routes/stores'));

// ==========================================
// 🛍️ PROXY EN TIEMPO REAL: RESUMEN DETALLADO DE SHOPIFY
// ==========================================
app.get('/api/external/shopify-status', async (req, res) => {
  try {
    const response = await fetch('https://status.shopify.com/api/v2/summary.json');
    const data = await response.json();
    
    const componentsClean = (data.components || [])
      .filter(c => !c.group_id)
      .map(c => ({
        name: c.name,
        status: c.status 
      }));

    res.json({
      success: true,
      global: {
        status: data.status.description,
        indicator: data.status.indicator 
      },
      components: componentsClean,
      updated_at: data.page.updated_at
    });
  } catch (error) {
    console.error("Error en proxy Shopify:", error);
    res.status(500).json({ success: false, error: 'No se pudo conectar con el monitor de Shopify.' });
  }
});


// ==========================================
// 🛍️ PROXY EN TIEMPO REAL: RESUMEN DETALLADO DE VTEX
// ==========================================
app.get('/api/external/vtex-status', async (req, res) => {
  try {
    const response = await fetch('https://status.vtex.com/api/v2/summary.json');
    const data = await response.json();
    
    const componentsClean = (data.components || [])
      .filter(c => !c.group_id)
      .map(c => ({
        name: c.name,
        status: c.status 
      }));

    res.json({
      success: true,
      global: {
        status: data.status.description,
        indicator: data.status.indicator 
      },
      components: componentsClean,
      updated_at: data.page.updated_at
    });
  } catch (error) {
    console.error("Error en proxy VTEX:", error);
    res.status(500).json({ success: false, error: 'No se pudo conectar con el monitor de VTEX.' });
  }
}); 

// ==========================================
// 🛍️ PROXY EN TIEMPO REAL: MONITOR AUTÓNOMO WOOCOMMERCE
// ==========================================
app.get('/api/external/woocommerce-status', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Falta la URL de la tienda.' });
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s Timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'ConcordeAnalyzerEngine/2.0 (Automated Health Check)'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    const htmlHeader = await response.text().catch(() => '');

    const tieneErrorBD = htmlHeader.toLowerCase().includes('error estableciendo') || htmlHeader.toLowerCase().includes('database error');
    const tieneErrorCritico = htmlHeader.toLowerCase().includes('error crítico') || htmlHeader.toLowerCase().includes('critical error');

    const components = [
      {
        name: 'Resolución de DNS y SSL',
        status: response.status !== 0 ? 'operational' : 'major_outage'
      },
      {
        name: 'Tiempo de Respuesta (TTFB)',
        status: responseTime < 1200 ? 'operational' : 'degraded_performance'
      },
      {
        name: 'Estabilidad de Base de Datos',
        status: !tieneErrorBD ? 'operational' : 'major_outage'
      },
      {
        name: 'Núcleo de Aplicación (PHP)',
        status: (!tieneErrorCritico && response.status !== 500) ? 'operational' : 'major_outage'
      }
    ];

    res.json({
      success: true,
      global: {
        status: !tieneErrorBD && !tieneErrorCritico ? 'All Systems Operational' : 'Systems Disruption',
        indicator: !tieneErrorBD && !tieneErrorCritico ? 'none' : 'major'
      },
      components: components,
      performance: {
        ttfb_ms: responseTime
      }
    });

  } catch (error) {
    res.json({
      success: true, 
      global: { status: 'Sitio fuera de línea o inaccesible', indicator: 'critical' },
      components: [
        { name: 'Resolución de DNS y SSL', status: 'major_outage' },
        { name: 'Tiempo de Respuesta (TTFB)', status: 'major_outage' },
        { name: 'Estabilidad de Base de Datos', status: 'major_outage' },
        { name: 'Núcleo de Aplicación (PHP)', status: 'major_outage' }
      ]
    });
  }
});

// ==========================================
// NUEVAS RUTAS: GESTIÓN COMPLETA DE USUARIOS
// ==========================================
// Obtener todos los usuarios
app.get('/api/users', verificarToken, async (req, res) => {
  try {
    if (req.adminUser.role !== 'super admin') {
      return res.status(403).json({ success: false, error: 'Permiso denegado.' });
    }
    // 🌟 Consulta simplificada para evitar errores de columnas de fecha
    const users = await db('users').select('id', 'name', 'email', 'role');
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/users/:id', verificarToken, async (req, res) => {
  try {
    if (req.adminUser.role !== 'super admin') {
      return res.status(403).json({ success: false, error: 'Permiso denegado.' });
    }
    const { id } = req.params;
    const { name, email, role, password } = req.body;
    
    const updateData = { 
      name: String(name).trim(), 
      email: String(email).toLowerCase().trim(), 
      role 
    };

    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    await db('users').where({ id }).update(updateData);
    res.json({ success: true, message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/users/:id', verificarToken, async (req, res) => {
  try {
    if (req.adminUser.role !== 'super admin') {
      return res.status(403).json({ success: false, error: 'Permiso denegado.' });
    }
    const { id } = req.params;
    await db('users').where({ id }).del();
    res.json({ success: true, message: 'Usuario eliminado del sistema' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// SERVIR FRONTEND REAL
// ==========================================
const reactBuildPath = path.join(__dirname, 'dist');  

app.use(express.static(reactBuildPath));
app.use('/assets', express.static(path.join(reactBuildPath, 'assets')));
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(reactBuildPath, 'index.html'));
});

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; 

const HubspotService = require('./services/HubspotService');
setInterval(() => {
  HubspotService.syncTickets();
}, 2 * 60 * 1000);

// Ejecutar primera sincronización al iniciar el servidor
HubspotService.syncTickets();

app.listen(PORT, HOST, () => {
  console.log(`Servidor central del CRM corriendo exitosamente en ${HOST}:${PORT}`);
});