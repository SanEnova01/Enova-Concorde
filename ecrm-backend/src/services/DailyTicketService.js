const db = require('../config/db');
const TicketRepository = require('../repositories/TicketRepository');

const DAILY_TICKET_NAME = 'Revisión técnica Status diario';

// Candado en memoria por tienda: si llegan dos ingestas casi a la vez (p. ej. dos
// instancias del bot), la segunda espera a la primera y ve el ticket ya creado.
const locks = new Map();

function withStoreLock(storeId, fn) {
  const prev = locks.get(storeId) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  locks.set(storeId, tail);
  tail.then(() => { if (locks.get(storeId) === tail) locks.delete(storeId); });
  return run;
}

function buildDescription(metric, origin) {
  const loadMs = parseInt(metric.load_ms) || 0;
  const ttfbMs = parseInt(metric.ttfb_ms) || 0;
  const weightMb = parseFloat(metric.total_weight_mb) || 0;
  const requests = parseInt(metric.total_requests) || 0;
  const ram = parseFloat(metric.ram_core_mb) || 0;

  const origenTexto = {
    BOT: 'el primer análisis automático del día (escaneo masivo)',
    MANUAL: 'una ejecución manual desde el panel',
    TRIGGER: 'un disparo manual para esta tienda'
  }[origin] || 'el primer análisis del día';

  const avisoFuente = metric.data_source && metric.data_source !== 'LIVE'
    ? `\n\n⚠️ Fuente de datos: ${metric.data_source}. El escáner no pudo medir todo hoy; se repitieron valores del último análisis válido.`
    : '';

  return `📌 ¿Qué hace esta revisión técnica?
Este ticket se genera automáticamente con ${origenTexto} para verificar la salud y velocidad de la tienda online.

🔍 Acciones realizadas por el bot:
1. Simulación de usuario: El sistema entra a la tienda simulando la visita de un cliente desde un teléfono móvil.
2. Respuesta del servidor (TTFB): Mide cuánto tarda el servidor en dar la primera respuesta desde que el cliente da clic.
3. Tiempo de carga total: Mide cuántos milisegundos tarda la pantalla en mostrarse completamente funcional.
4. Peso y elementos: Suma el peso de todas las imágenes y scripts descargados (MB) y cuenta cuántas peticiones se hicieron a la red.
5. Recursos del sistema: Revisa el consumo de memoria RAM utilizado durante el renderizado.

📊 Resultado de la prueba de hoy:
- Tiempo de carga total: ${loadMs} ms
- Respuesta inicial del servidor (TTFB): ${ttfbMs} ms
- Peso total de la página: ${weightMb} MB
- Cantidad de elementos cargados (Requests): ${requests}
- Consumo de memoria RAM: ${ram} MB${avisoFuente}`;
}

/**
 * Crea el ticket "Revisión técnica Status diario" de UNA tienda, como máximo uno por día.
 * Se puede llamar de forma independiente por cliente (ingesta del bot, análisis manual
 * o endpoint de disparo manual).
 *
 * @returns {{ created: boolean, ticket: object }}
 */
async function ensureDailyTicket(storeId, metric, origin = 'BOT') {
  if (!storeId) throw new Error('store_id es obligatorio para el ticket diario');

  return withStoreLock(String(storeId), async () => {
    const existing = await db('tickets')
      .where({ store_id: storeId, name: DAILY_TICKET_NAME })
      // "Hoy" según la hora de Lima (antes UTC: después de las 19:00 en Lima ya contaba como mañana)
      .whereRaw("(created_at AT TIME ZONE 'America/Lima')::date = (now() AT TIME ZONE 'America/Lima')::date")
      .first();

    if (existing) return { created: false, ticket: existing };

    const ticket = await TicketRepository.create({
      name: DAILY_TICKET_NAME,
      description: buildDescription(metric || {}, origin),
      store_id: storeId,
      priority: 'MEDIUM',
      task_type: 'TASK_INTERNA'
    });

    console.log(`🎫 [DailyTicket] Ticket diario creado store=${storeId} origen=${origin} serial=${ticket?.serial_number}`);
    return { created: true, ticket };
  });
}

module.exports = { ensureDailyTicket, DAILY_TICKET_NAME };
