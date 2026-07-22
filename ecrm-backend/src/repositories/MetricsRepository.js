const db = require('../config/db');

class MetricsRepository {
  static async create(metricData) {
    try {
      const {
        store_id,
        date,
        redirect_ms,
        dns_ms,
        tcp_ms,
        ttfb_ms,
        dom_interactive_ms,
        dom_ms,
        load_ms,
        total_weight_mb,
        total_requests,
        ram_core_mb,
        ram_total_mb,
        ram_usage,
        load_s,
        dom_s
      } = metricData;

      const [newMetric] = await db('daily_metrics').insert({
        store_id,
        date: date ? new Date(date).toISOString() : db.fn.now(),
        redirect_ms: parseInt(redirect_ms) || 0,
        dns_ms: parseInt(dns_ms) || 0,
        tcp_ms: parseInt(tcp_ms) || 0,
        ttfb_ms: parseInt(ttfb_ms) || 0,
        dom_interactive_ms: parseInt(dom_interactive_ms) || 0,
        dom_ms: dom_ms ? parseInt(dom_ms) : (dom_s ? Math.round(parseFloat(dom_s) * 1000) : 0),
        load_ms: load_ms ? parseInt(load_ms) : (load_s ? Math.round(parseFloat(load_s) * 1000) : 0),
        total_weight_mb: parseFloat(total_weight_mb) || 0,
        total_requests: parseInt(total_requests) || 0,
        ram_core_mb: parseFloat(ram_core_mb || 0),
        ram_total_mb: parseFloat(ram_total_mb || ram_usage || 0) 
      }).returning('*');

      return newMetric;
    } catch (error) {
      throw new Error('Error al guardar la métrica en la base de datos: ' + error.message);
    }
  }

  static async getAll() {
    try {
      return await db('daily_metrics').orderBy('date', 'desc');
    } catch (error) {
      throw new Error('Error al obtener todas las métricas: ' + error.message);
    }
  }

  static async getAllByStore(storeId) {
    try {
      return await db('daily_metrics')
        .where({ store_id: storeId })
        .orderBy('date', 'desc');
    } catch (error) {
      throw new Error('Error al obtener las métricas de la tienda: ' + error.message);
    }
  }

  // 🌟 CONSULTAS AGRUPADAS POR PERÍODO (Diario, Mensual, Anual)
  static async getAggregatedMetrics(storeId, period) {
    try {
      let dateFormat = 'YYYY-MM-DD';
      if (period === 'monthly') dateFormat = 'YYYY-MM';
      if (period === 'yearly') dateFormat = 'YYYY';

      // 1. Iniciamos la consulta seleccionando la fecha formateada y los promedios
      let query = db('daily_metrics')
        .select(
          db.raw(`TO_CHAR(date, '${dateFormat}') as period_date`),
          'store_id' // <- Queremos saber de qué tienda son estos promedios
        )
        .avg('load_ms as avg_load_ms')
        .avg('dom_ms as avg_dom_ms')
        .avg('ram_core_mb as avg_ram_core')
        .avg('ram_total_mb as avg_ram_total')
        .avg('ttfb_ms as avg_ttfb_ms')
        .count('id as total_analyses');

      // 2. Agrupamos por la fecha formateada Y por el ID de la tienda (Obligatorio en Postgres)
      query = query.groupBy(db.raw(`TO_CHAR(date, '${dateFormat}')`), 'store_id');

      // 3. Ordenamos por fecha descendente
      query = query.orderBy('period_date', 'desc');

      // 4. Aplicamos el filtro de tienda si el usuario seleccionó una específica
      if (storeId && storeId !== 'ALL') {
        query = query.where({ store_id: storeId });
      }

      return await query;
    } catch (error) {
      throw new Error('Error al agrupar métricas: ' + error.message);
    }
  }
}

module.exports = MetricsRepository;