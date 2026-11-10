const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, isAllowedOrigin } = require('../config/security');

// WebSockets de la consola en vivo (solo super admin) + reenvío de console.* a esa sala.
function attachConsoleSocket(server) {
  // ==========================================
  // 🔴 NUEVO: SISTEMA DE WEBSOCKETS Y CONSOLA
  // ==========================================
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

  return io;
}

module.exports = { attachConsoleSocket };
