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

// POST: Asistente de IA (Primer Filtro Conversacional)
router.post('/chat', async (req, res) => {
  try {
    const { store_id, query } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Por favor, escribe una pregunta.' });
    }

    // ====================================================================
    // 🧠 AQUÍ CONECTAREMOS OPENAI Y LA BASE DE CONOCIMIENTO (RAG)
    // ====================================================================
    // Por ahora, crearemos un motor de reglas básico para simular la IA
    // y demostrar cómo ataja los problemas antes de crear un ticket.

    let aiResponse = "He recibido tu consulta. En este momento estoy aprendiendo las políticas de la tienda, por lo que te sugiero hacer clic en 'Soporte Especializado' para hablar con un humano.";
    let actionType = 'none';

    const text = query.toLowerCase();

    if (text.includes('tarjeta') || text.includes('pago') || text.includes('comprar')) {
      aiResponse = "Si tu tarjeta no pasa, suele ser por un bloqueo preventivo de tu banco para compras online. Te sugiero:\n1. Llamar a tu banco para autorizar la compra.\n2. Intentar con una tarjeta distinta.\n3. Usar un método de pago alternativo si está disponible en el checkout.";
      actionType = 'info';
    } 
    else if (text.includes('pedido') || text.includes('envío') || text.includes('dónde está')) {
      aiResponse = "Para conocer el estado exacto de tu envío, por favor utiliza la opción 'Rastrear Pedido' que se encuentra en el menú inferior. Solo necesitarás tu número de pedido y correo electrónico.";
      actionType = 'redirect_tracking';
    }
    else if (text.includes('cambio') || text.includes('devolver') || text.includes('talla')) {
      aiResponse = "¡Claro que sí! Tienes hasta 30 días para solicitar un cambio de talla o devolución. Puedes iniciar el proceso automáticamente desde la opción 'Cambios y Devoluciones' aquí abajo.";
      actionType = 'redirect_rma';
    }

    // Simulamos un pequeño "pensamiento" de la IA para que se sienta real
    setTimeout(() => {
      res.json({ 
        success: true, 
        response: aiResponse,
        action: actionType
      });
    }, 1000);

  } catch (error) {
    console.error("Error en el chat de CoopPilot:", error);
    res.status(500).json({ success: false, error: 'Error procesando tu consulta.' });
  }
});
module.exports = router;