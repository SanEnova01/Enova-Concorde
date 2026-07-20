const express = require('express');
const router = express.Router();
const db = require('../config/db');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

// GET: Consultar configuración y licencia pública de la tienda
router.get('/config/:store_id', async (req, res) => {
  try {
    const { store_id } = req.params;
    let store = await db('stores').where({ id: store_id }).first();
    
    // Si buscan 'enova.agency' o una tienda inactiva sin parámetro, buscar la primera tienda que SÍ tenga CoopPilot activo
    if ((!store || !store.has_cooppilot) && store_id === 'enova.agency') {
      const activeStore = await db('stores').where({ has_cooppilot: true }).first();
      if (activeStore) {
        store = activeStore;
      }
    }

    if (!store) {
      return res.status(404).json({ success: false, error: 'Tienda no encontrada.' });
    }

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
    if (!store) {
      return res.status(404).json({ success: false, error: 'Tienda no encontrada.' });
    }

    // 🛑 VALIDACIÓN DE LICENCIA COOPPILOT
    if (!store.has_cooppilot) {
      return res.status(403).json({ 
        success: false, 
        disabled: true,
        error: 'El servicio CoopPilot no está habilitado para esta tienda.' 
      });
    }

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

// POST: Asistente de IA (Chatbot)
router.post('/chat', async (req, res) => {
  try {
    const { store_id, query } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Escribe una pregunta.' });
    }

    const activeStoreId = store_id || 'enova.agency';
    const store = await db('stores').where({ id: activeStoreId }).first();

    if (!store) {
      return res.status(404).json({ success: false, error: 'Tienda no encontrada.' });
    }

    // 🛑 VALIDACIÓN DE LICENCIA COOPPILOT
    if (!store.has_cooppilot) {
      return res.status(403).json({ 
        success: false, 
        disabled: true,
        response: 'El servicio de IA CoopPilot no está activo para esta tienda. Por favor contacta al administrador.' 
      });
    }

   // Traer documentos de la Base de Conocimiento
    const kbRules = await db('knowledge_base')
      .where({ store_id: activeStoreId, is_active: true });

    let knowledgeContext = "No hay políticas o documentos cargados para esta tienda aún.";
    if (kbRules.length > 0) {
      // 🧠 Formateamos el contexto como documentos completos para que la IA los analice globalmente
      knowledgeContext = kbRules.map(r => 
        `### DOCUMENTO: ${r.question} (Tipo: ${r.category})\n${r.answer}\n---`
      ).join("\n\n");
    }

    if (!process.env.OPENAI_API_KEY) {
      // Fallback a motor de palabras clave si no hay API Key
      const text = query.toLowerCase();
      const match = kbRules.find(r => r.question && text.includes(r.question.toLowerCase()));
      return res.json({
        success: true,
        response: match ? match.answer : "No encontré información específica. Te sugiero usar 'Soporte Especializado'."
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Eres CoopPilot, el asistente virtual de "${store.name}". Responde amablemente en base a esta Base de Conocimiento:\n${knowledgeContext}`
        },
        { role: 'user', content: query }
      ],
      temperature: 0.3,
    });

    res.json({
      success: true,
      response: completion.choices[0]?.message?.content || "No pude procesar la consulta."
    });

  } catch (error) {
    console.error("Error en chat CoopPilot:", error);
    res.status(500).json({ success: false, error: 'Error procesando tu consulta.' });
  }
});
const TicketRepository = require('../repositories/TicketRepository');

// POST: Crear un ticket de soporte directamente desde el Hub Público
router.post('/ticket', async (req, res) => {
  try {
    const { store_id, name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Nombre, correo y mensaje son obligatorios.' });
    }

    // Usamos el repositorio para inyectarlo directo al Kanban de la agencia
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