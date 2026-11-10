const crypto = require('crypto');

// ==========================================
// SECRETOS: solo desde variables de entorno (Railway → Variables)
// ==========================================

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Sin secreto definido, se usa uno aleatorio: el sistema sigue funcionando,
  // pero las sesiones se invalidan en cada reinicio. Nunca un valor fijo del código.
  JWT_SECRET = crypto.randomBytes(48).toString('hex');
  console.error('🚨 [SECURITY] JWT_SECRET no está definido. Se generó uno temporal: las sesiones se cerrarán en cada reinicio. Defínelo en Railway.');
}

// API_KEY: llave del bot y servicios internos.
// API_KEY_PREVIOUS (opcional): llave anterior aceptada durante una rotación.
const API_KEYS = [process.env.API_KEY, process.env.API_KEY_PREVIOUS]
  .map((k) => (k || '').trim())
  .filter(Boolean);

if (API_KEYS.length === 0) {
  console.error('🚨 [SECURITY] API_KEY no está definida. El bot no podrá autenticarse contra el backend.');
}

// Llave que el backend envía cuando llama al bot
const OUTBOUND_API_KEY = (process.env.API_KEY || '').trim();

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getApiKeyFromRequest(req) {
  return String(req.headers['x-api-key'] || '').trim();
}

function isValidApiKey(key) {
  if (!key) return false;
  return API_KEYS.some((valid) => safeEqual(key, valid));
}

function requestHasValidApiKey(req) {
  return isValidApiKey(getApiKeyFromRequest(req));
}

// ==========================================
// CORS: orígenes permitidos
// ==========================================
const DEFAULT_ORIGINS = [
  'https://enova-concorde-2027.up.railway.app',
  'https://enova-concorde.up.railway.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : DEFAULT_ORIGINS
).map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);

function isAllowedOrigin(origin) {
  // Sin Origin = llamadas servidor a servidor (bot, Hub, curl): CORS no aplica
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin.replace(/\/+$/, ''));
}

// ==========================================
// ROLES
// ==========================================
const normalizeRole = (role) => String(role || '').toLowerCase().trim();
const STAFF_ROLES = ['admin', 'super admin'];
const isStaffRole = (role) => STAFF_ROLES.includes(normalizeRole(role));

module.exports = {
  JWT_SECRET,
  OUTBOUND_API_KEY,
  isValidApiKey,
  requestHasValidApiKey,
  ALLOWED_ORIGINS,
  isAllowedOrigin,
  normalizeRole,
  isStaffRole
};
