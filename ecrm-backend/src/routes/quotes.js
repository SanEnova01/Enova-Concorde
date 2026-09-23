const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 🔒 Middleware de seguridad interno para asegurar que sea Super Admin
const checkSuperAdmin = (req, res, next) => {
  const user = req.adminUser || req.user; 
  if (!user || user.role !== 'super admin') {
    return res.status(403).json({ success: false, error: 'Acceso denegado. Exclusivo para Super Admins.' });
  }
  next();
};

// ==========================================
// 1. POST: GENERAR COTIZACIÓN Y PDF
// ==========================================
router.post('/generate', checkSuperAdmin, async (req, res) => {
  try {
    const { 
      store_id, 
      nombre_tienda_nueva, 
      razon_social, 
      nombre_comercial, 
      descripcion, 
      mes, 
      monto,
      pdfData
    } = req.body;

    let finalStoreId = store_id;

    if (!finalStoreId && nombre_tienda_nueva) {
      finalStoreId = `lead_${Date.now()}`;
      await db('stores').insert({
        id: finalStoreId,
        name: nombre_tienda_nueva,
        status: 'LEAD',
        created_at: db.fn.now()
      });
      console.log(`[QUOTES] Nuevo Lead creado: ${nombre_tienda_nueva}`);
    }

    const [nuevaCotizacion] = await db('quotes').insert({
      store_id: finalStoreId,
      razon_social,
      nombre_comercial,
      descripcion,
      mes,
      monto,
      status: 'PENDIENTE',
      json_data: JSON.stringify(pdfData)
    }).returning('*');

    const breakdownItemsHTML = pdfData.items.map(item => `
      <div class="breakdown-item">
        <span>${item.name || ''}</span>
        <span>${item.price || ''}</span>
      </div>
    `).join('');

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <style>
            * { box-sizing: border-box; }
            @page { size: A4; margin: 10mm 15mm; }
            body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #F1F0EA; color: #111; line-height: 1.4; font-size: 13px; }
            .container { width: 100%; max-width: 100%; }
            .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 4px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .logo-title { font-size: 24px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: -1px; }
            .logo-subtitle { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 1px; margin: 2px 0 0 0; font-weight: bold; }
            .header-badge { background: #000; color: #fff; padding: 5px 10px; font-size: 11px; font-weight: 900; text-transform: uppercase; }
            .main-title { font-size: 28px; font-weight: 900; text-transform: uppercase; line-height: 1.1; margin: 0 0 15px 0; letter-spacing: -1px; }
            .tag { display: inline-block; border: 2px solid #000; background: #14B8A6; color: #000; font-weight: 900; font-size: 10px; padding: 3px 8px; text-transform: uppercase; margin-bottom: 10px; }
            .pitch-box { border: 3px solid #000; font-size: 13.5px; font-weight: bold; color: #111; margin-bottom: 20px; background: #fff; padding: 15px; box-shadow: 4px 4px 0px #000; }
            .card { background: #fff; border: 3px solid #000; box-shadow: 5px 5px 0px #000; padding: 20px; margin-bottom: 20px; }
            .card-title { font-size: 14px; font-weight: 900; text-transform: uppercase; border-bottom: 3px solid #000; padding-bottom: 8px; margin: 0 0 15px 0; }
            .table-wrapper { margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; border: 3px solid #000; }
            th { background: #000; color: #fff; padding: 10px; font-size: 11px; font-weight: 900; text-transform: uppercase; text-align: left; border: 2px solid #000; }
            td { padding: 12px 10px; border: 2px solid #000; font-size: 13px; font-weight: bold; vertical-align: middle; }
            td.center { text-align: center; }
            td.right { text-align: right; }
            td.highlight-bg { background-color: #f0fdfa; }
            .price-strike { text-decoration: line-through; color: #EF4444; font-size: 12px; display: block; margin-bottom: 4px; font-weight: 900; }
            .price-final { color: #14B8A6; font-size: 16px; font-weight: 900; display: block; }
            .price-standard { font-size: 14px; color: #555; }
            .discount-text { font-size: 12px; font-weight: 900; color: #EF4444; margin: 0; text-align: right; text-transform: uppercase; }
            .breakdown-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
            .breakdown-item { border: 2px solid #000; padding: 10px; display: flex; justify-content: space-between; align-items: center; font-weight: 900; font-size: 11px; text-transform: uppercase; background: #fcfcfc; }
            .breakdown-item span:last-child { color: #14B8A6; font-size: 12px; }
            .total-banner { background: #14B8A6; border: 3px solid #000; box-shadow: 6px 6px 0px #000; padding: 20px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
            .total-info h3 { margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase; }
            .total-info p { margin: 5px 0 0 0; font-weight: bold; font-size: 11px; max-width: 350px; }
            .total-price-box { text-align: right; background: #fff; border: 3px solid #000; padding: 12px 20px; transform: rotate(-2deg); box-shadow: 4px 4px 0px #000; }
            .total-price-box .old-price { text-decoration: line-through; color: #EF4444; font-weight: 900; font-size: 14px; display: block; margin-bottom: 2px; }
            .total-price-box .new-price { font-size: 30px; font-weight: 900; margin: 0; line-height: 1; color: #000; }
            .total-price-box .igv-tag { font-size: 14px; font-weight: 900; color: #000; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div>
                    <h2 class="logo-title">ENOVA AGENCY</h2>
                    <h3 class="logo-subtitle">Concorde Radar // Cotizaciones</h3>
                </div>
                <div class="header-badge">Propuesta Comercial</div>
            </div>

            <div class="tag">${pdfData.tag}</div>
            <h1 class="main-title">${pdfData.title}</h1>

            <div class="pitch-box">"${pdfData.pitch}"</div>

            <div class="card">
                <h2 class="card-title">Resumen de Inversión</h2>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th width="35%">Concepto</th>
                                <th width="15%" class="center">Cantidad</th>
                                <th width="25%" class="right">Precio Estándar (+ IGV)</th>
                                <th width="25%" class="right">Precio Preferencial (+ IGV)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${pdfData.conceptName}</td>
                                <td class="center" style="font-size: 14px;">${pdfData.quantity}</td>
                                <td class="right">
                                    <span class="price-strike">${pdfData.unitPriceStandard}</span>
                                    <span class="price-standard">Subtotal: ${pdfData.subtotalStandard}</span>
                                </td>
                                <td class="right highlight-bg">
                                    <span style="font-size: 13px; display:block; margin-bottom: 4px;">${pdfData.unitPricePref}</span>
                                    <span class="price-final">Total: ${pdfData.totalPref}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p class="discount-text">${pdfData.discountText}</p>
            </div>

            <div class="card" style="margin-bottom: 0;">
                <h2 class="card-title">Desglose por Ítem</h2>
                <div class="breakdown-grid">
                    ${breakdownItemsHTML}
                </div>
            </div>

            <div class="total-banner">
                <div class="total-info">
                    <h3>Monto Total del Proyecto</h3>
                    <p>${pdfData.footerNote}</p>
                </div>
                <div class="total-price-box">
                    <span class="old-price">${pdfData.oldPriceBanner}</span>
                    <span class="new-price">${pdfData.newPriceBanner}</span>
                    <span class="igv-tag">USD + I.G.V.</span>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    // 🌟 IMPORTACIÓN DINÁMICA DE PUPPETEER PARA EVITAR ERR_REQUIRE_ESM
    const { default: puppeteer } = await import('puppeteer');
    
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cotizacion_${nombre_comercial || 'enova'}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    res.end(pdfBuffer);
  } catch (error) {
    console.error("Error generando PDF y Cotización:", error);
    res.status(500).json({ error: 'Fallo al procesar la cotización.' });
  }
});

router.get('/', checkSuperAdmin, async (req, res) => {
  try {
    const quotes = await db('quotes').orderBy('created_at', 'desc');
    res.json({ success: true, data: quotes });
  } catch (error) {
    console.error("Error obteniendo cotizaciones:", error);
    res.status(500).json({ success: false, error: 'Error al consultar las cotizaciones.' });
  }
});

router.put('/:id', checkSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, factura_id, comision } = req.body;

    const [updatedQuote] = await db('quotes')
      .where({ id })
      .update({
        status,
        factura_id: factura_id || null,
        comision: comision || 0.00
      })
      .returning('*');

    if (!updatedQuote) {
      return res.status(404).json({ success: false, error: 'Cotización no encontrada.' });
    }

    res.json({ success: true, data: updatedQuote });
  } catch (error) {
    console.error("Error actualizando cotización:", error);
    res.status(500).json({ success: false, error: 'Error al actualizar datos en BD.' });
  }
});

module.exports = router;