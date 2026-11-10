const jwt = require('jsonwebtoken');
const db = require('../config/db');
const {
  JWT_SECRET,
  requestHasValidApiKey,
  normalizeRole,
  isStaffRole
} = require('../config/security');

// ==========================================
// Tiendas de un cliente: coincidencia EXACTA del correo en stores.emails
// (antes se usaba includes(), y "ana@x.com" coincidía con "juana@x.com")
// ==========================================
function emailList(raw) {
  return String(raw || '')
    .toLowerCase()
    .split(/[\s,;<>]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

async function getStoreIdsForEmail(email) {
  const clean = String(email || '').toLowerCase().trim();
  if (!clean) return [];
  const stores = await db('stores').select('id', 'emails');
  return stores
    .filter((s) => emailList(s.emails).includes(clean))
    .map((s) => String(s.id));
}

// ==========================================
// Reglas de acceso para el rol "client".
// Todo lo que no esté en esta lista queda prohibido para clientes.
// ==========================================
const CLIENT_RULES = [
  // Tiendas
  { method: 'GET', path: /^\/api\/stores$/, filter: (row, own) => own.has(String(row.id)) },
  { method: 'GET', path: /^\/api\/stores\/cuentacliente$/ },
  { method: 'GET', path: /^\/api\/stores\/([^/]+)$/, store: (req, m) => m[1] },

  // Tickets
  { method: 'GET', path: /^\/api\/tickets$/, filter: (row, own) => own.has(String(row.store_id)) },
  { method: 'POST', path: /^\/api\/tickets$/, store: (req) => req.body?.store_id, defaultStore: true },
  { method: 'GET', path: /^\/api\/tickets\/([^/]+)\/messages$/, ticket: (req, m) => m[1] },
  { method: 'POST', path: /^\/api\/tickets\/([^/]+)\/messages$/, ticket: (req, m) => m[1] },

  // Métricas (rutas fijas antes que /:store_id)
  { method: 'GET', path: /^\/api\/metrics$/, filter: (row, own) => own.has(String(row.store_id)) },
  { method: 'GET', path: /^\/api\/metrics\/alerts$/, filter: (row, own) => own.has(String(row.store_id)) },
  { method: 'GET', path: /^\/api\/metrics\/aggregated$/, store: (req) => req.query.store_id },
  { method: 'POST', path: /^\/api\/metrics\/run-single-client$/, store: (req) => req.body?.store_id, forceStoreUrl: true },
  { method: 'GET', path: /^\/api\/metrics\/(bot-status|force-run|extract-progress)$/, deny: true },
  { method: 'GET', path: /^\/api\/metrics\/([^/]+)$/, store: (req, m) => m[1] },

  // Base de conocimiento
  { method: 'GET', path: /^\/api\/knowledge\/([^/]+)$/, store: (req, m) => m[1] },
  { method: 'POST', path: /^\/api\/knowledge$/, store: (req) => req.body?.store_id },
  { method: 'DELETE', path: /^\/api\/knowledge\/([^/]+)$/, knowledge: (req, m) => m[1] },

  // Revisiones
  { method: 'GET', path: /^\/api\/manual-reviews\/([^/]+)$/, store: (req, m) => m[1] },
  { method: 'GET', path: /^\/api\/daily-reviews\/monthly$/, store: (req) => req.query.store_id },

  // Estado de plataformas externas (monitor del cliente)
  { method: 'GET', path: /^\/api\/external\/[a-z-]+$/ }
];

function forbidden(res) {
  return res.status(403).json({ success: false, code: 'FORBIDDEN', error: 'No tienes permiso para esta acción.' });
}

function filterJsonResponse(res, predicate) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (Array.isArray(body)) return originalJson(body.filter(predicate));
    if (body && Array.isArray(body.data)) return originalJson({ ...body, data: body.data.filter(predicate) });
    return originalJson(body);
  };
}

async function clientAccess(req, res) {
  const path = req.originalUrl.split('?')[0].replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  for (const rule of CLIENT_RULES) {
    if (rule.method !== method) continue;
    const match = path.match(rule.path);
    if (!match) continue;
    if (rule.deny) return forbidden(res);

    const ownIds = await getStoreIdsForEmail(req.adminUser?.email);
    const own = new Set(ownIds);
    req.clientStoreIds = ownIds;

    if (rule.filter) {
      filterJsonResponse(res, (row) => rule.filter(row, own));
      return true;
    }

    if (rule.store) {
      let storeId = rule.store(req, match);
      if ((!storeId || storeId === 'null') && rule.defaultStore && ownIds.length > 0) {
        storeId = ownIds[0];
        req.body.store_id = storeId;
      }
      // 'cuentacliente' lo resuelve cada ruta con el correo del token
      if (storeId !== 'cuentacliente' && !own.has(String(storeId))) return forbidden(res);

      if (rule.forceStoreUrl) {
        // El cliente solo puede escanear la web registrada de su tienda, no cualquier URL
        const store = await db('stores').where({ id: storeId }).first('web');
        if (!store?.web) return forbidden(res);
        req.body.url = store.web;
      }
      return true;
    }

    if (rule.ticket) {
      const ticket = await db('tickets').where({ id: rule.ticket(req, match) }).first('store_id');
      if (!ticket || !own.has(String(ticket.store_id))) return forbidden(res);
      return true;
    }

    if (rule.knowledge) {
      const row = await db('knowledge_base').where({ id: rule.knowledge(req, match) }).first('store_id');
      if (!row || !own.has(String(row.store_id))) return forbidden(res);
      return true;
    }

    return true; // regla sin restricción adicional
  }

  return forbidden(res);
}

// ==========================================
// GUARDIÁN PRINCIPAL: API key del bot o JWT de usuario + permisos por rol
// ==========================================
const verificarToken = async (req, res, next) => {
  // 1. Bot / servicios internos con API key (definida en variables de entorno)
  if (requestHasValidApiKey(req)) {
    req.isServiceCall = true;
    return next();
  }

  // 2. Usuario con JWT
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, error: 'Acceso denegado. Inicie sesión.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(403).json({ success: false, code: 'SESSION_EXPIRED', error: 'Sesión expirada. Vuelva a autenticarse.' });
  }
  req.adminUser = decoded;

  // 3. Permisos por rol
  const role = normalizeRole(decoded.role);
  if (isStaffRole(role)) return next();

  if (role === 'client') {
    try {
      const allowed = await clientAccess(req, res);
      if (allowed === true) return next();
      return; // ya respondió 403
    } catch (error) {
      console.error('[AUTH] Error validando acceso de cliente:', error.message);
      return res.status(500).json({ success: false, error: 'Error validando permisos.' });
    }
  }

  return forbidden(res);
};

// Solo admin / super admin (no clientes, no API key)
const requireStaff = (req, res, next) => {
  if (req.adminUser && isStaffRole(req.adminUser.role)) return next();
  return forbidden(res);
};

// Solo super admin (menú de configuración y funciones ocultas)
const requireSuperAdmin = (req, res, next) => {
  if (req.adminUser && normalizeRole(req.adminUser.role) === 'super admin') return next();
  return forbidden(res);
};

const signToken = (user) => jwt.sign(
  { id: user.id, name: user.name, email: user.email, role: user.role },
  JWT_SECRET,
  { expiresIn: '12h' }
);

module.exports = { verificarToken, requireStaff, requireSuperAdmin, signToken, getStoreIdsForEmail, emailList };
