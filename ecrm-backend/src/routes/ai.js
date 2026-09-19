const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * GET /api/ai/dashboard-summary
 * Genera el texto dinámico para la cabecera del Dashboard consultando la BD
 */
router.get('/dashboard-summary', async (req, res) => {
  try {
    const userName = req.adminUser ? req.adminUser.name : 'Santiago';

    // 1. Extraemos métricas y estado actual directamente de la BD
    const totalTickets = await db('tickets').count('id as count').first();
    const ticketsPorPrioridad = await db('tickets')
      .select('priority')
      .count('id as count')
      .groupBy('priority');
    
    const clientesActivos = await db('stores').count('id as count').first();
    
    // Obtenemos hasta 5 tickets recientes abiertos
    const ticketsPendientes = await db('tickets')
      .select('name', 'priority', 'task_type')
      .whereNot('status', 'CLOSED')
      .orderBy('created_at', 'desc')
      .limit(5);

    // 2. Preparamos el contexto para la IA
    const contextoBD = {
      usuario: userName,
      total_tickets: parseInt(totalTickets.count) || 0,
      total_clientes: parseInt(clientesActivos.count) || 0,
      desglose_prioridades: ticketsPorPrioridad,
      pendientes_recientes: ticketsPendientes
    };

    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.json({
        success: true,
        greeting: `¡Hola, ${userName}!`,
        headline: `Panel de Control Principal`,
        subtext: `Tienes ${contextoBD.total_tickets} tickets registrados y ${contextoBD.total_clientes} clientes activos. (AI Key no detectada)`
      });
    }

    // 3. Carga dinámica del SDK de Vercel (ESM)
    const { generateText } = await import('ai');
    const { createOpenAI } = await import('@ai-sdk/openai');

    const vercelGateway = createOpenAI({
      baseURL: 'https://ai-gateway.vercel.sh/v1',
      apiKey: apiKey,
    });

    const promptText = `
Genera un saludo, un titular llamativo y un comentario ejecutivo muy conciso para el banner principal del CRM.

DATOS EN TIEMPO REAL DE LA BD:
- Nombre del Administrador: ${userName}
- Clientes Activos: ${contextoBD.total_clientes}
- Tickets Totales: ${contextoBD.total_tickets}
- Resumen de tickets pendientes: ${JSON.stringify(contextoBD.pendientes_recientes)}

REQUISITOS DE RESPUESTA:
Responde ÚNICAMENTE en JSON válido con la siguiente estructura:
{
  "greeting": "Un saludo cordial según el momento del día y el nombre del usuario (ej: ¡Hola Santiago! / Buenas noches, Santiago)",
  "headline": "Frase ejecutiva o resumen del estado del trabajo (máximo 8 palabras)",
  "subtext": "Un comentario de 1 o 2 oraciones indicando las tareas críticas pendientes o resaltando la actividad de los clientes."
}`;

    const { text } = await generateText({
      model: vercelGateway('openai/gpt-4o-mini'),
      system: 'Eres el copiloto inteligente del CRM Concorde. Tu trabajo es dar reportes ultraconcisos y profesionales al super admin.',
      prompt: promptText
    });

    const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedAiData = JSON.parse(cleanJson);

    return res.json({
      success: true,
      data: parsedAiData
    });

  } catch (error) {
    console.error('❌ [Error AI Dashboard]:', error.message);
    return res.status(500).json({ 
      success: false, 
      error: 'Error al generar resumen inteligente: ' + error.message 
    });
  }
});

// 🌟 Aquí podrás ir agregando más rutas de IA en el futuro...
// router.post('/analizar-cliente', ...)
// router.post('/sugerir-prioridad', ...)

module.exports = router;