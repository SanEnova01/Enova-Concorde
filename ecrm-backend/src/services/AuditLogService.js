const db = require('../config/db');

// Registro de auditoría (tabla audit_logs). Antes vivía dentro de index.js.

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

module.exports = { logActivity };
