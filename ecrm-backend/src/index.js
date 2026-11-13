const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { isAllowedOrigin, requestHasValidApiKey, JWT_SECRET } = require('./config/security');
const { verificarToken, requireSuperAdmin, requireStaff } = require('./middleware/auth');
const app = express();

require('./db/ensureIndexes')().catch((err) => console.error('[DB] Error verificando índices:', err.message));

// Registro de auditoría (tabla audit_logs y helper) → services/AuditLogService.js
const { logActivity } = require('./services/AuditLogService');

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


// Logos: /assets, /api/upload y /upload → routes/uploads.js
app.use(require('./routes/uploads'));

// Login → routes/auth.js
app.use('/api/auth', require('./routes/auth'));

// ==========================================
// RUTAS DE LA API CENTRAL (PROTEGIDAS)
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API del CRM seguro y operativo.' });
});


// ==========================================
// 🚀 ENDPOINT PÚBLICO PARA MEDIDOR.JS (INGESTA DE MÉTRICAS)
// ==========================================
// Ruta antigua: usa exactamente la misma lógica que /api/metrics/ingest
// (antes no guardaba la radiografía HTML ni lanzaba la IA)
app.post('/api/ingest', (req, res) => require('./routes/metrics').ingestHandler(req, res));

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
app.use('/api/pet', verificarToken, requireStaff, require('./routes/pet'));
app.use('/api/productivity', verificarToken, requireStaff, require('./routes/productivity'));

// Estado de plataformas externas → routes/external.js
app.use('/api/external', require('./routes/external'));

// Usuarios y registro de auditoría → routes/users.js
app.use('/api', require('./routes/users'));

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
// WEBSOCKETS Y CONSOLA EN VIVO → realtime/consoleSocket.js
// ==========================================
const http = require('http');
const server = http.createServer(app);
require('./realtime/consoleSocket').attachConsoleSocket(server);


// ==========================================
// ARRANQUE DEL SERVIDOR (ACTUALIZADO A HTTP)
// ==========================================
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; 

// 🚨 IMPORTANTE: Ahora usamos server.listen en lugar de app.listen
server.listen(PORT, HOST, () => {
  console.log(`[SYSTEM] Servidor central y WebSockets corriendo en ${HOST}:${PORT}`);
});