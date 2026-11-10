const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); 
const db = require('./config/db'); // Conexión Knex a tu PostgreSQL
const { isAllowedOrigin, requestHasValidApiKey, JWT_SECRET } = require('./config/security');
const { verificarToken, requireSuperAdmin, signToken } = require('./middleware/auth');
const app = express();

// 🌟 AUTO-CREACIÓN DE LA TABLA AUDIT_LOGS EN POSTGRESQL
db.schema.hasTable('audit_logs').then(exists => {
  if (!exists) {
    return db.schema.createTable('audit_logs', table => {
      table.increments('id').primary();
      table.string('user_name').nullable();
      table.string('user_email').nullable();
      table.string('action').notNullable();
      table.text('details').nullable();
      table.string('ip_address').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    }).then(() => console.log('✅ Tabla audit_logs inicializada correctamente en PostgreSQL'));
  }
}).catch(err => console.error("Error verificando tabla audit_logs:", err.message));

require('./db/ensureIndexes')().catch((err) => console.error('[DB] Error verificando índices:', err.message));

// 🌟 HELPER BASE DE REGISTRO DE AUDITORÍA
const logActivity = async (req, action, details = '') => {
  try {
    const user = req.adminUser || {};
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const ip = String(rawIp).split(',')[0].trim();
    
    await db('audit_logs').insert({
      user_name: user.name || req.body?.email || req.body?.username || 'Sistema/Anónimo',
      user_email: user.email || req.body?.email || 'sistema@enova.agency',
      action: action,
      details: typeof details === 'object' ? JSON.stringify(details) : String(details),
      ip_address: ip
    });
  } catch (e) {
    console.error("Error guardando audit_log:", e.message);
  }
};

app.set('trust proxy', 1);

// ==========================================
// 0.1 CORS: DEBE IR ANTES QUE CUALQUIER OTRO MIDDLEWARE
// ==========================================
app.use(cors({
  // Solo los dominios del CRM (config/security.js o variable CORS_ORIGINS)
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-API-KEY']
}));

// ==========================================
// CIBERSEGURIDAD CENTRAL (MIDDLEWARES)
// ==========================================
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// Límite general: se cuenta POR USUARIO (no por IP, porque una oficina comparte IP)
// y no aplica al bot ni a servicios internos con API key.
const usuarioDelToken = (req) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
};

const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  limit: (req) => (usuarioDelToken(req) ? 5000 : 1500),
  keyGenerator: (req) => {
    const user = usuarioDelToken(req);
    return user?.id ? `user:${user.id}` : `ip:${ipKeyGenerator(req.ip)}`;
  },
  skip: (req) => requestHasValidApiKey(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const user = usuarioDelToken(req);
    console.warn(`[RATE-LIMIT] 429 ${req.method} ${req.originalUrl} ${user ? `user=${user.email}` : `ip=${req.ip}`}`);
    res.status(options.statusCode).json({
      success: false,
      error: 'Has superado el límite de actividad para tu cuenta. Por favor, espera unos minutos antes de continuar.'
    });
  }
});
// 🌟 MIDDLEWARE GLOBAL DE AUDITORÍA
app.use((req, res, next) => {
  req.logActivity = (action, details) => logActivity(req, action, details);
  next();
});
app.use(generalLimiter);

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 5,
  skipSuccessfulRequests: true, // solo cuentan los intentos fallidos
  message: { success: false, error: 'Demasiados intentos de sesión fallidos. Bloqueado por 5 minutos.' }
});


app.use(express.json());

// ==========================================
// 🚀 RUTAS PÚBLICAS Y AUDITORÍAS (REGISTRADAS AQUÍ)
// ==========================================
// Límites propios para rutas públicas que crean tickets o consumen IA
const publicChatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: 'Demasiadas consultas. Espera un momento.' }
});
const publicCreateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' }
});
app.use('/api/cooppilot/chat', publicChatLimiter);
app.use('/api/cooppilot/ticket', publicCreateLimiter);
app.use('/api/audits/request', publicCreateLimiter);

app.use('/api/cooppilot', require('./routes/cooppilot'));
app.use('/api/audits', require('./routes/audits'));

// ==========================================
// MIDDLEWARE: GUARDIÁN DE RUTAS INTERNAS (SOPORTA JWT Y API KEY DEL BOT)
// ==========================================
// La lógica vive en middleware/auth.js: API key por variable de entorno, JWT y permisos por rol
// (un usuario "client" solo accede a los datos de sus propias tiendas).

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
// ENDPOINT: LOGIN POR USUARIO O CORREO Y CONTRASEÑA (CON AUTO-REPARACIÓN)
// ==========================================
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    // 🌟 Aceptamos 'email' por compatibilidad con el front, o 'username'
    const identifier = req.body.email || req.body.username; 
    const { password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'El usuario/correo y la contraseña son obligatorios.' });
    }

    const cleanIdentifier = String(identifier).toLowerCase().trim();

    // 🌟 Buscamos al usuario en PostgreSQL por email O por nombre (username)
    const user = await db('users')
      .whereRaw('LOWER(email) = ?', [cleanIdentifier])
      .orWhereRaw('LOWER(name) = ?', [cleanIdentifier])
      .first();
    
    // Mismo mensaje si el usuario no existe o la contraseña falla (no revela qué correos existen).
    // Se eliminó la "auto-reparación" con 123456: permitía entrar a CUALQUIER cuenta con esa clave.
    const credencialesInvalidas = () => res.status(400).json({
      success: false,
      error: 'Usuario o contraseña incorrectos.'
    });

    if (!user || !user.password) return credencialesInvalidas();

    const passwordValido = await bcrypt.compare(password, user.password).catch(() => false);
    if (!passwordValido) {
      await logActivity(req, 'LOGIN_FALLIDO', `Intento fallido para ${cleanIdentifier}`);
      return credencialesInvalidas();
    }

    const token = signToken(user);

    // 🌟 REGISTRAMOS EL ÚLTIMO LOGIN REAL EN LA BD Y EL EVENTO EN AUDITORÍA
    await db('users').where({ id: user.id }).update({ last_login: db.fn.now() }).catch(() => {});
    await logActivity(req, 'INICIO_SESION', `Inicio de sesión exitoso de ${user.name} (${user.email})`);

    res.status(200).json({
      success: true,
      token: token,
      user: { name: user.name, email: user.email }
    });

  } catch (error) {
    console.error("Error en auth login:", error);
    res.status(500).json({ success: false, error: 'Error del servidor.' });
  }
});

// ==========================================
// RUTAS DE LA API CENTRAL (PROTEGIDAS)
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API del CRM seguro y operativo.' });
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
// 🚀 ENDPOINT PÚBLICO PARA MEDIDOR.JS (INGESTA DE MÉTRICAS)
// ==========================================
app.post('/api/ingest', async (req, res) => {
  if (!requestHasValidApiKey(req)) {
    return res.status(401).json({ success: false, error: 'API Key inválida o ausente.' });
  }

  try {
    const metricData = req.body;
    if (!metricData.store_id) {
      return res.status(400).json({ error: 'El campo store_id es obligatorio.' });
    }

    // 1. Inserción de la métrica diaria
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

    // 2. Ticket diario (uno por tienda y día) — misma lógica que /api/metrics/ingest
    try {
      await require('./services/DailyTicketService').ensureDailyTicket(metricData.store_id, metricData, 'BOT');
    } catch (ticketErr) {
      console.error('⚠️ Error al generar ticket automático:', ticketErr.message);
    }

    res.status(201).json({ success: true, data: insertedRow });
  } catch (error) {
    console.error("Error en /api/ingest:", error);
    res.status(500).json({ success: false, error: 'Error inyectando métrica en DB: ' + error.message });
  }
});

// ==========================================
// RUTAS PROTEGIDAS POR JWT / API KEY
// ==========================================
app.use('/api/metrics', verificarToken, require('./routes/metrics'));
app.use('/api/tickets', verificarToken, require('./routes/tickets'));
app.use('/api/stores', verificarToken, require('./routes/stores'));
app.use('/api/manual-reviews', verificarToken, require('./routes/reviews'));
app.use('/api/daily-reviews', verificarToken, require('./routes/manualReviews'));
app.use('/api/knowledge', verificarToken, require('./routes/knowledge'));
app.use('/api/ai', verificarToken, require('./routes/ai'));
app.use('/api/quotes', verificarToken, require('./routes/quotes'));
app.use('/api/settings', verificarToken, requireSuperAdmin, require('./routes/settings'));
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
// Evita que este proxy se use para consultar servicios internos (SSRF)
const isPublicHttpUrl = (raw) => {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h === '::1' || h === '0.0.0.0') return false;
    if (/^(127|10|0)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    if (/^(fc|fd|fe80)/.test(h) && h.includes(':')) return false;
    return true;
  } catch (e) {
    return false;
  }
};

app.get('/api/external/woocommerce-status', verificarToken, async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Falta la URL de la tienda.' });
    }
    if (!isPublicHttpUrl(url)) {
      return res.status(400).json({ success: false, error: 'URL no permitida.' });
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
// NUEVAS RUTAS: GESTIÓN COMPLETA DE USUARIOS & AUDITORÍA
// ==========================================

// 0. 🌟 NUEVO ENDPOINT: HISTORIAL DE LOGS (EXCLUSIVO SUPER ADMIN)
app.get('/api/audit-logs', verificarToken, async (req, res) => {
  try {
    const userRole = String(req.adminUser.role || '').toLowerCase().trim();
    if (userRole !== 'super admin') {
      return res.status(403).json({ success: false, error: 'Acceso denegado. Exclusivo para Super Admin.' });
    }

    const logs = await db('audit_logs')
      .orderBy('created_at', 'desc')
      .limit(500);

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error("Error consultando audit_logs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1. Obtener lista de admins
app.get('/api/users/admins', verificarToken, async (req, res) => {
  try {
    const admins = await db('users')
      .whereRaw('LOWER(role) IN (?, ?)', ['admin', 'super admin'])
      .select('id', 'name', 'email', 'role');
    res.json({ success: true, data: admins });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. ENDPOINT ESTADÍSTICAS DE USUARIO
app.get('/api/users/:id/stats', verificarToken, async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await db('users').where({ id: userId }).first();
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const userName = String(user.name || '').trim();

    let assignedStores = [];
    if (userName) {
      try {
        assignedStores = await db('stores')
          .whereNotNull('assigned_to')
          .andWhereRaw('LOWER("assigned_to") LIKE LOWER(?)', [`%${userName}%`])
          .select('id', 'name', 'plan_type');
      } catch (e) {
        console.error("Aviso BD Stores:", e.message);
      }
    }

    let assignedTickets = [];
    if (userName) {
      try {
        assignedTickets = await db('tickets')
          .whereNotNull('assigned_to')
          .andWhereRaw('LOWER("assigned_to") LIKE LOWER(?)', [`%${userName}%`])
          .select('id', 'status', 'created_at');
      } catch (e) {
        console.error("Aviso BD Tickets:", e.message);
      }
    }

    const openTickets = assignedTickets.filter(t => t.status !== 'CLOSED' && t.status !== 'RESOLVED').length;
    const resolvedTickets = assignedTickets.filter(t => t.status === 'CLOSED' || t.status === 'RESOLVED').length;

    let lastActivity = user.last_login || user.created_at || new Date();
    const userLastTime = new Date(lastActivity).getTime();

    if (assignedTickets.length > 0) {
      const sortedTickets = assignedTickets.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });
      const lastTicketTime = new Date(sortedTickets[0].created_at || 0).getTime();

      if (lastTicketTime > userLastTime) {
        lastActivity = sortedTickets[0].created_at;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        myStores: assignedStores,
        totalTickets: assignedTickets.length,
        openTickets,
        resolvedTickets,
        lastActivity
      }
    });
  } catch (error) {
    console.error("Error crítico obteniendo stats:", error);
    return res.status(500).json({ success: false, error: 'Error del servidor: ' + error.message });
  }
});

// 3. Listar usuarios
app.get('/api/users', verificarToken, async (req, res) => {
  try {
    if (String(req.adminUser.role).toLowerCase() !== 'super admin') {
      return res.status(403).json({ success: false, error: 'Permiso denegado.' });
    }
    const users = await db('users').select('*');
    const safeUsers = users.map(u => {
      delete u.password;
      return u;
    });
    res.json({ success: true, data: safeUsers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Crear usuario (Con Auditoría)
app.post('/api/users', verificarToken, async (req, res) => {
  try {
    if (String(req.adminUser.role).toLowerCase() !== 'super admin') {
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

    await logActivity(req, 'CREAR_USUARIO', `Cuenta creada para ${name} (${email}) con rol [${role}]`);

    res.status(201).json({ success: true, message: 'Cuenta creada exitosamente.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno del servidor al registrar usuario.' });
  }
});

// 5. Actualizar usuario (Con Auditoría)
app.put('/api/users/:id', verificarToken, async (req, res) => {
  try {
    if (String(req.adminUser.role).toLowerCase() !== 'super admin') {
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
    await logActivity(req, 'EDITAR_USUARIO', `Usuario ID ${id} (${name}) actualizado`);

    res.json({ success: true, message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Eliminar usuario (Con Auditoría)
app.delete('/api/users/:id', verificarToken, async (req, res) => {
  try {
    if (String(req.adminUser.role).toLowerCase() !== 'super admin') {
      return res.status(403).json({ success: false, error: 'Permiso denegado.' });
    }
    const { id } = req.params;
    await db('users').where({ id }).del();
    await logActivity(req, 'ELIMINAR_USUARIO', `Se eliminó al usuario con ID ${id}`);

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

// ==========================================
// 🚀 INICIALIZACIÓN DE SERVICIOS EN SEGUNDO PLANO
// ==========================================
require('./services/GmailSyncService');
// ==========================================
// 🔴 NUEVO: SISTEMA DE WEBSOCKETS Y CONSOLA
// ==========================================
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), methods: ['GET', 'POST'] }
});

// Middleware de seguridad para WebSockets (Solo Super Admins)
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Sin token de autorización'));

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (String(decoded.role || '').toLowerCase().trim() !== 'super admin') {
      return next(new Error('Permiso denegado. Se requiere rol de super admin.'));
    }
    // Si es super admin, lo unimos a la sala especial
    socket.join('super_admin_room');
    next();
  } catch (error) {
    next(new Error('Token inválido o expirado'));
  }
});

// Interceptor de Consola Global (Atrapa logs de Server, Gmail Bot, etc.)
['log', 'warn', 'error', 'info'].forEach((method) => {
  const originalMethod = console[method];
  console[method] = function (...args) {
    // 1. Imprime en la consola real de Railway/Terminal
    originalMethod.apply(console, args);
    
    // 2. Procesa y envía por Socket a la sala de super admins
    try {
      // Solo se procesa si hay un super admin con la consola abierta (antes se serializaba todo siempre)
      const room = io.sockets.adapter.rooms.get('super_admin_room');
      if (!room || room.size === 0) return;

      const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');

      // Evitamos un bucle infinito filtrando los logs internos de socket.io
      if (!message.includes('socket.io')) {
        io.to('super_admin_room').emit('server-log', {
          source: 'BACKEND',
          type: method,
          message: message,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      // Ignorar errores de serialización silenciosamente
    }
  };
});

// ==========================================
// ARRANQUE DEL SERVIDOR (ACTUALIZADO A HTTP)
// ==========================================
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; 

// 🚨 IMPORTANTE: Ahora usamos server.listen en lugar de app.listen
server.listen(PORT, HOST, () => {
  console.log(`[SYSTEM] Servidor central y WebSockets corriendo en ${HOST}:${PORT}`);
});