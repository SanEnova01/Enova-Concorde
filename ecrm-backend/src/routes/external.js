const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');

// Montado en /api/external (index.js). Shopify y VTEX son públicos; WooCommerce exige sesión.

// ==========================================
// 🛍️ PROXY EN TIEMPO REAL: RESUMEN DETALLADO DE SHOPIFY
// ==========================================
router.get('/shopify-status', async (req, res) => {
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
router.get('/vtex-status', async (req, res) => {
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
const { isPublicHttpUrl } = require('../utils/urlSafety');

router.get('/woocommerce-status', verificarToken, async (req, res) => {
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

module.exports = router;
