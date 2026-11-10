const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { verificarToken } = require('../middleware/auth');
const { logActivity } = require('../services/AuditLogService');

// Montado en /api (index.js): /api/audit-logs y /api/users/*. Cada ruta lleva su verificarToken.

// ==========================================
// NUEVAS RUTAS: GESTIÓN COMPLETA DE USUARIOS & AUDITORÍA
// ==========================================

// 0. 🌟 NUEVO ENDPOINT: HISTORIAL DE LOGS (EXCLUSIVO SUPER ADMIN)
router.get('/audit-logs', verificarToken, async (req, res) => {
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
router.get('/users/admins', verificarToken, async (req, res) => {
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
router.get('/users/:id/stats', verificarToken, async (req, res) => {
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
router.get('/users', verificarToken, async (req, res) => {
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
router.post('/users', verificarToken, async (req, res) => {
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
router.put('/users/:id', verificarToken, async (req, res) => {
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
router.delete('/users/:id', verificarToken, async (req, res) => {
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

module.exports = router;
