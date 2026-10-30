const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { generateJSON, hasAiKey } = require('../ai/models');

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

    if (!hasAiKey()) {
      return res.json({
        success: true,
        greeting: `¡Hola, ${userName}!`,
        headline: `Panel de Control Principal`,
        subtext: `Tienes ${contextoBD.total_tickets} tickets registrados y ${contextoBD.total_clientes} clientes activos. (AI Key no detectada)`
      });
    }

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

    const { data: parsedAiData, model, usage, costUsd } = await generateJSON({
      task: 'dashboard',
      module: 'DASHBOARD',
      system: 'Eres el copiloto inteligente del CRM Concorde. Tu trabajo es dar reportes ultraconcisos y profesionales al super admin. Responde siempre en JSON puro, sin markdown.',
      prompt: promptText,
      validate: (j) => {
        if (!j.greeting || !j.headline || !j.subtext) throw new Error('Respuesta inválida: faltan campos');
        return j;
      }
    });

    return res.json({
      success: true,
      data: parsedAiData,
      usage: {
        model,
        prompt_tokens: usage.input,
        completion_tokens: usage.output,
        total_tokens: usage.total,
        estimated_cost_usd: parseFloat(costUsd.toFixed(6))
      }
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