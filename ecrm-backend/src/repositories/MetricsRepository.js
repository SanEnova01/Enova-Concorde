const db = require('../config/db');

class MetricsRepository {
  static async create(metricData) {
    try {
      const {
        store_id, date, redirect_ms, dns_ms, tcp_ms, ttfb_ms,
        dom_interactive_ms, dom_ms, load_ms, total_weight_mb,
        total_requests, ram_core_mb, ram_total_mb, ram_usage, load_s, dom_s,
        html_analysis // 🌟 SE ATRAPA LA RADIOGRAFÍA HTML
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
        ram_total_mb: parseFloat(ram_total_mb || ram_usage || 0),
        html_analysis: html_analysis ? JSON.stringify(html_analysis) : null // 🌟 SE GUARDA EN POSTGRES
      }).returning('*');

      return newMetric;
    } catch (error) {
      throw new Error('Error al guardar la métrica: ' + error.message);
    }
  }

  static async getAll() {
    return await db('daily_metrics').orderBy('date', 'desc');
  }

  static async getAllByStore(storeId) {
    return await db('daily_metrics').where({ store_id: storeId }).orderBy('date', 'desc');
  }

  // Se mantiene tu FIX exacto del GROUP BY
  static async getAggregatedMetrics(storeId, period) {
    let dateFormat = 'YYYY-MM-DD';
    if (period === 'monthly') dateFormat = 'YYYY-MM';
    if (period === 'yearly') dateFormat = 'YYYY';

    let query = db('daily_metrics')
      .select(
        db.raw(`TO_CHAR(date, '${dateFormat}') as period_date`),
        'store_id'
      )
      .avg('load_ms as avg_load_ms')
      .avg('dom_ms as avg_dom_ms')
      .avg('ram_core_mb as avg_ram_core')
      .avg('ram_total_mb as avg_ram_total')
      .avg('ttfb_ms as avg_ttfb_ms')
      .count('id as total_analyses')
      .groupByRaw(`TO_CHAR(date, '${dateFormat}'), store_id`)
      .orderBy('period_date', 'desc');

    if (storeId && storeId !== 'ALL') {
      query = query.where({ store_id: storeId });
    }
    return await query;
  }

  // ==========================================
  // NUEVAS FUNCIONES PARA ALERTAS E IA
  // ==========================================
  
  // Obtiene el último escaneo con HTML de una tienda para compararlo
  static async getLastMorningScan(storeId) {
    return await db('daily_metrics')
      .where({ store_id: storeId })
      .whereNotNull('html_analysis')
      .orderBy('date', 'desc')
      .first();
  }

  static async createAlert(alertData) {
    try {
      const [newAlert] = await db('system_alerts').insert(alertData).returning('*');
      return newAlert;
    } catch (error) {
      console.error('Error guardando alerta:', error.message);
      return null;
    }
  }

  static async getRecentAlerts(limit = 50) {
    try {
      return await db('system_alerts')
        .select('system_alerts.*', 'stores.name as store_name')
        .leftJoin('stores', 'system_alerts.store_id', 'stores.id')
        .orderBy('created_at', 'desc')
        .limit(limit);
    } catch (error) {
      return [];
    }
  }
}

module.exports = MetricsRepository;