const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');
const db = require('../config/db');
const { signToken } = require('../middleware/auth');
const { logActivity } = require('../services/AuditLogService');

// Montado en /api/auth (index.js)

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 5,
  skipSuccessfulRequests: true, // solo cuentan los intentos fallidos
  message: { success: false, error: 'Demasiados intentos de sesión fallidos. Bloqueado por 5 minutos.' }
});

// ==========================================
// ENDPOINT: LOGIN POR USUARIO O CORREO Y CONTRASEÑA (CON AUTO-REPARACIÓN)
// ==========================================
router.post('/login', loginLimiter, async (req, res) => {
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

module.exports = router;
