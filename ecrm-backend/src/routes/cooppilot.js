const express = require('express');
const router = express.Router();
const db = require('../config/db');

// POST: "Frictionless Login" - Validar pedido de un cliente final
router.post('/verify-order', async (req, res) => {
  try {
    const { store_id, order_number, email } = req.body;

    if (!store_id || !order_number || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan datos. Necesitamos la tienda, el número de pedido y el correo.' 
      });
    }

    // Validar que la tienda exista en Concorde
    const store = await db('stores').where({ id: store_id }).first();
    if (!store) {
      return res.status(404).json({ success: false, error: 'Tienda no encontrada.' });
    }

    // ====================================================================
    // 🔌 AQUÍ IRÍA LA CONEXIÓN REAL A LA API DE SHOPIFY / VTEX / WOOCOMMERCE
    // ====================================================================
    // Por ahora, simularemos que la API de la tienda nos devuelve un carrito exitoso
    // si el correo tiene un formato válido y el pedido empieza con "#".
    
    if (!order_number.startsWith('#')) {
      return res.status(400).json({ success: false, error: 'El número de pedido debe incluir un "#". Ej: #1024' });
    }

    // Data simulada que vendría del e-commerce
    const mockOrderData = {
      order_number: order_number,
      customer_email: email,
      purchase_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Hace 7 días
      status: 'DELIVERED',
      items: [
        { id: 'prod_1', name: 'Zapatillas Urbanas', size: '42', price: 120.00, image: 'https://via.placeholder.com/150' },
        { id: 'prod_2', name: 'Camiseta de Algodón', size: 'L', price: 35.00, image: 'https://via.placeholder.com/150' }
      ]
    };

    res.json({ 
      success: true, 
      data: mockOrderData,
      store_branding: {
        name: store.name,
        logo_url: store.logo_url
      }
    });

  } catch (error) {
    console.error("Error validando pedido en CoopPilot:", error);
    res.status(500).json({ success: false, error: 'Error interno del servidor al validar el pedido.' });
  }
});

// POST: Asistente de IA (Primer Filtro Conversacional usando la Base de Conocimiento)
router.post('/chat', async (req, res) => {
  try {
    const { store_id, query } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Por favor, escribe una pregunta.' });
    }

    // 1. Buscar si tenemos la tienda en la BD (o usar la tienda por defecto)
    const activeStoreId = store_id || 'enova.agency';

    // 2. Traer todas las reglas activas que le pertenecen a esta tienda
    const kbRules = await db('knowledge_base')
      .where({ store_id: activeStoreId, is_active: true });

    // 3. Motor de Búsqueda de Contexto (Simulación de RAG)
    const textQuery = query.toLowerCase();
    let matchedRule = null;

    if (kbRules.length > 0) {
      // Buscar la regla que mejor coincida con lo que preguntó el cliente
      matchedRule = kbRules.find(rule => {
        const questionMatch = rule.question && textQuery.includes(rule.question.toLowerCase());
        const categoryMatch = textQuery.includes(rule.category.toLowerCase().replace('_', ' '));
        const keywordMatch = rule.answer.toLowerCase().split(' ').some(word => word.length > 4 && textQuery.includes(word));
        
        return questionMatch || categoryMatch || keywordMatch;
      });
    }

    // 4. Determinar la respuesta final
    let aiResponse = "";

    if (matchedRule) {
      // 🎯 ¡La IA encontró una respuesta en su Base de Conocimiento!
      aiResponse = matchedRule.answer;
    } else {
      // Fallback si no encuentra nada en la Base de Conocimiento
      aiResponse = "Entiendo tu consulta. No encontré una regla específica para este caso en nuestra base de datos, por lo que te recomiendo seleccionar la opción 'Soporte Especializado' para derivarte con un agente humano de inmediato.";
    }

    // Simulamos latencia ligera para que la UI marque "Escribiendo..."
    setTimeout(() => {
      res.json({ 
        success: true, 
        response: aiResponse,
        has_matched_knowledge: !!matchedRule
      });
    }, 800);

  } catch (error) {
    console.error("Error en el chat de CoopPilot:", error);
    res.status(500).json({ success: false, error: 'Error procesando tu consulta.' });
  }
});
module.exports = router;