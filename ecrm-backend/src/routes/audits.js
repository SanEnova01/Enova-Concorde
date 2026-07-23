const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

// Middleware de seguridad exclusivo para las acciones privadas del CRM
const verificarTokenAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Acceso denegado.' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'LLAVE_MAESTRA_SECRETA_DEL_CRM_2026');
        req.adminUser = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, error: 'Sesión expirada.' });
    }
};

const BOT_SERVICE_URL = process.env.BOT_SERVICE_URL || 'http://localhost:3001';

// 🌟 PÚBLICO: Crear solicitud desde la landing (SIN TOKEN)
router.post('/request', async (req, res) => {
    try {
        const { prospect_name, email, company_name, store_url } = req.body;
        const [result] = await db('audit_requests').insert({
            prospect_name, 
            email, 
            company_name, 
            store_url
        }).returning('id');
        
        res.status(201).json({ success: true, id: result.id || result });
    } catch (error) {
        console.error('[ERROR] Guardando petición de auditoría:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// 🌟 PÚBLICO: Obtener reporte único por ID (SIN TOKEN)
router.get('/:id', async (req, res) => {
    try {
        const result = await db('audit_requests').where({ id: req.params.id }).first();
        if (!result) return res.status(404).json({ success: false, error: 'No encontrado' });
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[ERROR] Obteniendo auditoría por ID:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// 🔒 PROTEGIDO: Listar todas las solicitudes (Para el panel CRM)
router.get('/', verificarTokenAdmin, async (req, res) => {
    try {
        const results = await db('audit_requests').orderBy('created_at', 'desc');
        res.json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// 🔒 PROTEGIDO: Forzar análisis desde el panel y guardar snapshot
router.post('/:id/run', verificarTokenAdmin, async (req, res) => {
    try {
        const audit = await db('audit_requests').where({ id: req.params.id }).first();
        if (!audit) return res.status(404).json({ success: false, error: 'No encontrado' });

        const targetUrl = audit.store_url;

        const botRes = await fetch(`${BOT_SERVICE_URL}/run-single`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.API_KEY || 'ENOVA_SECRET_API_KEY_2026'
            },
            body: JSON.stringify({ url: targetUrl })
        });
        
        const botData = await botRes.json();
        
        if (!botRes.ok || !botData.success) {
            throw new Error(botData.error || 'Fallo en el motor del Bot');
        }

        const [result] = await db('audit_requests')
            .where({ id: req.params.id })
            .update({
                status: 'COMPLETED',
                snapshot_data: JSON.stringify(botData.data),
                updated_at: db.fn.now()
            })
            .returning('*');

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[ERROR] Ejecutando auditoría:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;