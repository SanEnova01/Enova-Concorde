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

// POST: Validar pedido (Rastreo)
router.post('/verify-order', async (req, res) => {
  try {
    const { store_id, order_number, email } = req.body;
    const store = await db('stores').where({ id: store_id || 'enova.agency' }).first();
    
    if (!store) return res.status(404).json({ success: false, error: 'Tienda no encontrada.' });
    if (!store.has_cooppilot) return res.status(403).json({ success: false, disabled: true, error: 'Módulo inactivo.' });

    if (!order_number || !order_number.startsWith('#')) {
      return res.status(400).json({ success: false, error: 'El número de pedido debe incluir "#". Ej: #1024' });
    }

    res.json({ 
      success: true, 
      data: {
        order_number: order_number,
        customer_email: email,
        purchase_date: new Date().toISOString(),
        status: 'DELIVERED',
        items: [{ id: '1', name: 'Producto de prueba', size: 'M', price: 100 }]
      },
      store_branding: { name: store.name, logo_url: store.logo_url }
    });
  } catch (error) {
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
      // 1. Convertir la pregunta a Vector
      const embedRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
      });
      const queryVector = `[${embedRes.data[0].embedding.join(',')}]`;

      // 2. Buscar similitud en la BD (RAG)
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
    const { store_id, name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Nombre, correo y mensaje son obligatorios.' });
    }

    const newTicket = await TicketRepository.create({
      name: `[HUB] ${subject || 'Soporte'} - ${name}`,
      description: `Cliente: ${name} (${email})\n\nMensaje:\n${message}`,
      store_id: store_id || 'enova.agency',
      priority: 'MEDIUM',
      task_type: 'CONSULTA'
    });

    res.json({ success: true, data: newTicket });
  } catch (error) {
    console.error("Error creando ticket desde Hub:", error);
    res.status(500).json({ success: false, error: 'Error al enviar tu solicitud de soporte.' });
  }
});

module.exports = router;