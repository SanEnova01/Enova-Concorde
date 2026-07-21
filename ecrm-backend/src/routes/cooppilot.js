const express = require('express');
const router = express.Router();
const db = require('../config/db');
const OpenAI = require('openai');
const TicketRepository = require('../repositories/TicketRepository');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

// GET: Consultar configuración y licencia pública de la tienda
router.get('/config/:store_id', async (req, res) => {
  try {
    const { store_id } = req.params;
    let store = await db('stores').where({ id: store_id }).first();
    
    if ((!store || !store.has_cooppilot) && store_id === 'enova.agency') {
      const activeStore = await db('stores').where({ has_cooppilot: true }).first();
      if (activeStore) store = activeStore;
    }

    if (!store) return res.status(404).json({ success: false, error: 'Tienda no encontrada.' });

    res.json({
      success: true,
      data: {
        id: store.id,
        name: store.name,
        logo_url: store.logo_url,
        has_cooppilot: !!store.has_cooppilot,
        has_tracking: store.has_tracking !== false,
        has_returns: store.has_returns !== false
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al consultar la tienda.' });
  }
});

// POST: Validar pedido (Rastreo Real con Shopify API)
router.post('/verify-order', async (req, res) => {
  try {
    const { store_id, order_number, email } = req.body;
    const store = await db('stores').where({ id: store_id || 'enova.agency' }).first();
    
    if (!store) return res.status(404).json({ success: false, error: 'Tienda no encontrada.' });
    if (!store.has_cooppilot) return res.status(403).json({ success: false, disabled: true, error: 'Módulo inactivo.' });

    if (!order_number) {
      return res.status(400).json({ success: false, error: 'Ingresa un número de pedido válido (Ej: #1024).' });
    }

    const cleanOrderNum = order_number.trim();
    const cleanEmail = String(email || '').toLowerCase().trim();

    // 🌟 SI LA TIENDA TIENE CONFIGURADO TOKEN DE SHOPIFY Y DOMINIO EN DB, CONSULTA LA API REAL
    if (store.shopify_access_token && store.web) {
      // Extraer dominio de la URL web
      const storeDomain = store.web.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const shopifyUrl = `https://${storeDomain}/admin/api/2024-01/orders.json?name=${encodeURIComponent(cleanOrderNum)}&status=any`;

      try {
        const shopifyRes = await fetch(shopifyUrl, {
          headers: {
            'X-Shopify-Access-Token': store.shopify_access_token,
            'Content-Type': 'application/json'
          }
        });

        if (shopifyRes.ok) {
          const shopifyData = await shopifyRes.json();
          const orders = shopifyData.orders || [];

          // Validar que coincida el email de la orden con el ingresado por el cliente
          const matchedOrder = orders.find(o => 
            (o.email && o.email.toLowerCase().trim() === cleanEmail) ||
            (o.customer && o.customer.email && o.customer.email.toLowerCase().trim() === cleanEmail)
          );

          if (matchedOrder) {
            const fulfillment = matchedOrder.fulfillments?.[0] || {};
            const trackingCompany = fulfillment.tracking_company || 'Procesando Envío';
            const trackingNumber = fulfillment.tracking_number || 'Pendiente de Guía';

            let statusText = 'EN PREPARACIÓN';
            if (matchedOrder.cancelled_at) {
              statusText = 'CANCELADO';
            } else if (matchedOrder.fulfillment_status === 'fulfilled') {
              statusText = 'EN TRÁNSITO / ENTREGADO';
            } else if (matchedOrder.financial_status === 'paid') {
              statusText = 'PAGO CONFIRMADO - PREPARANDO PAQUETE';
            }

            return res.json({ 
              success: true, 
              data: {
                order_number: matchedOrder.name,
                customer_email: matchedOrder.email,
                purchase_date: matchedOrder.created_at,
                status: statusText,
                tracking_company: trackingCompany,
                tracking_number: trackingNumber,
                items: (matchedOrder.line_items || []).map(i => ({
                  id: i.id,
                  name: i.title,
                  size: i.variant_title || 'Estándar',
                  price: i.price
                }))
              },
              store_branding: { name: store.name, logo_url: store.logo_url }
            });
          } else {
            return res.status(404).json({ 
              success: false, 
              error: 'No se encontró ningún pedido que coincida con ese número y correo.' 
            });
          }
        }
      } catch (err) {
        console.error("Error consultando API de Shopify:", err);
      }
    }

    // 🌟 SIMULACRO DE FALLBACK (Si la tienda aún no configura su token de Shopify)
    res.json({ 
      success: true, 
      data: {
        order_number: cleanOrderNum,
        customer_email: cleanEmail,
        purchase_date: new Date().toISOString(),
        status: 'ENTREGADO (Modo Simulacro)',
        tracking_company: 'Courier Demo',
        tracking_number: 'TRK-998877',
        items: [{ id: '1', name: 'Producto Demo de Shopify', size: 'M', price: 100 }]
      },
      store_branding: { name: store.name, logo_url: store.logo_url }
    });
  } catch (error) {
    console.error("Error en verify-order:", error);
    res.status(500).json({ success: false, error: 'Error al verificar la orden.' });
  }
});

// POST: Asistente de IA (Chatbot con RAG)
router.post('/chat', async (req, res) => {
  try {
    const { store_id, query } = req.body;
    if (!query) return res.status(400).json({ success: false, error: 'Escribe una pregunta.' });

    const activeStoreId = store_id || 'enova.agency';
    const store = await db('stores').where({ id: activeStoreId }).first();

    if (!store) return res.status(404).json({ success: false, error: 'Tienda no encontrada.' });
    if (!store.has_cooppilot) return res.status(403).json({ success: false, disabled: true, response: 'IA inactiva.' });

    let knowledgeContext = "No hay políticas o documentos cargados para esta tienda aún.";

    if (process.env.OPENAI_API_KEY) {
      const embedRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
      });
      const queryVector = `[${embedRes.data[0].embedding.join(',')}]`;

      const kbRules = await db.raw(`
        SELECT category, question, answer, 1 - (embedding <=> ?) as similarity
        FROM knowledge_base
        WHERE store_id = ? AND is_active = true AND embedding IS NOT NULL
        ORDER BY embedding <=> ?
        LIMIT 3
      `, [queryVector, activeStoreId, queryVector]);

      if (kbRules.rows && kbRules.rows.length > 0) {
        knowledgeContext = kbRules.rows.map(r => 
          `### FRAGMENTO RELEVANTE (${r.category}): ${r.question}\n${r.answer}\n---`
        ).join("\n");
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres CoopPilot, el asistente virtual de "${store.name}". Responde de forma concisa usando SOLO esta base de conocimiento:\n${knowledgeContext}`
          },
          { role: 'user', content: query }
        ],
        temperature: 0.3,
      });

      return res.json({ success: true, response: completion.choices[0]?.message?.content || "No pude procesar la consulta." });
    }

    res.json({ success: true, response: "Modo simulacro: Necesitas configurar la API de OpenAI." });
  } catch (error) {
    console.error("Error en chat CoopPilot:", error);
    res.status(500).json({ success: false, error: 'Error procesando tu consulta.' });
  }
});

// POST: Escalación a Humano (Ticket desde Hub)
router.post('/ticket', async (req, res) => {
  try {
    const { store_id, name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Nombre, correo y mensaje son obligatorios.' });
    }

    const phoneText = phone ? `Teléfono: ${phone}\n` : '';

    const newTicket = await TicketRepository.create({
      name: `${subject || 'Soporte'} - ${name}`,
      description: `Cliente: ${name} (${email})\n${phoneText}\nMensaje:\n${message}`,
      store_id: store_id || 'enova.agency',
      priority: 'MEDIUM',
      task_type: 'CONSULTA',
      is_b2c: true
    });

    res.json({ success: true, data: newTicket });
  } catch (error) {
    console.error("Error creando ticket desde Hub:", error);
    res.status(500).json({ success: false, error: 'Error al enviar tu solicitud de soporte.' });
  }
});

module.exports = router;