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

// 🌟 DETECTOR DE TECNOLOGÍA E-COMMERCE
async function detectEcommerceTech(targetUrl) {
    try {
        let urlLimpia = targetUrl.trim();
        if (!urlLimpia.startsWith('http')) urlLimpia = `https://${urlLimpia}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(urlLimpia, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: controller.signal
        });
        clearTimeout(timeout);

        const html = (await res.text()).toLowerCase();

        if (html.includes('cdn.shopify.com') || html.includes('shopify.theme')) {
            return { tech: 'Shopify', icon: '/assets/shopify.svg' };
        }
        if (html.includes('vtex.img') || html.includes('vtexassets') || html.includes('vtex.cm')) {
            return { tech: 'VTEX', icon: '/assets/vtex.svg' };
        }
        if (html.includes('wp-content') || html.includes('woocommerce')) {
            return { tech: 'WooCommerce', icon: '/assets/woocommerce.svg' };
        }
        if (html.includes('mage/cookies') || html.includes('magento')) {
            return { tech: 'Magento', icon: '/assets/magento.svg' };
        }
        if (html.includes('prestashop')) {
            return { tech: 'PrestaShop', icon: '/assets/prestashop.svg' };
        }

        return { tech: 'E-commerce Custom', icon: null };
    } catch (e) {
        return { tech: 'E-commerce', icon: null };
    }
}

// 🌟 Consulta a Google PageSpeed API
async function getPageSpeedMetrics(targetUrl) {
    try {
        let urlLimpia = targetUrl.trim();
        if (!urlLimpia.startsWith('http')) urlLimpia = `https://${urlLimpia}`;

        const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(urlLimpia)}&category=PERFORMANCE&strategy=mobile`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        const res = await fetch(apiUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) return null;

        const data = await res.json();
        const lh = data.lighthouseResult;

        if (!lh || !lh.categories || !lh.categories.performance) return null;

        return {
            score: Math.round((lh.categories.performance.score || 0) * 100),
            fcp: lh.audits['first-contentful-paint']?.displayValue || 'N/A',
            lcp: lh.audits['largest-contentful-paint']?.displayValue || 'N/A',
            cls: lh.audits['cumulative-layout-shift']?.displayValue || 'N/A'
        };
    } catch (err) {
        return null;
    }
}

// PÚBLICO: Crear solicitud desde landing
router.post('/request', async (req, res) => {
    try {
        const { prospect_name, email, company_name, store_url } = req.body;
        const [result] = await db('audit_requests').insert({
            prospect_name, email, company_name, store_url
        }).returning('id');
        res.status(201).json({ success: true, id: result.id || result });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// PÚBLICO: Obtener reporte por ID
router.get('/:id', async (req, res) => {
    try {
        const result = await db('audit_requests').where({ id: req.params.id }).first();
        if (!result) return res.status(404).json({ success: false, error: 'No encontrado' });
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// PROTEGIDO: Listar solicitudes
router.get('/', verificarTokenAdmin, async (req, res) => {
    try {
        const results = await db('audit_requests').orderBy('created_at', 'desc');
        res.json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// PROTEGIDO: Ejecutar análisis completo (Bot + Google + Tech Detector en paralelo)
router.post('/:id/run', verificarTokenAdmin, async (req, res) => {
    try {
        const audit = await db('audit_requests').where({ id: req.params.id }).first();
        if (!audit) return res.status(404).json({ success: false, error: 'No encontrado' });

        const targetUrl = audit.store_url;

        // 🚀 Ejecución simultánea de Bot, PageSpeed y Detector de Tecnología
        const [botRes, googleData, techInfo] = await Promise.all([
            fetch(`${BOT_SERVICE_URL}/run-single`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.API_KEY || 'ENOVA_SECRET_API_KEY_2026'
                },
                body: JSON.stringify({ url: targetUrl })
            }),
            getPageSpeedMetrics(targetUrl),
            detectEcommerceTech(targetUrl)
        ]);

        const botData = await botRes.json();
        if (!botRes.ok || !botData.success) {
            throw new Error(botData.error || 'Fallo en el motor del Bot');
        }

        const snapshotCompleto = {
            ...botData.data,
            pagespeed: googleData,
            tech: techInfo.tech,
            tech_icon: techInfo.icon
        };

        const [result] = await db('audit_requests')
            .where({ id: req.params.id })
            .update({
                status: 'COMPLETED',
                snapshot_data: JSON.stringify(snapshotCompleto),
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