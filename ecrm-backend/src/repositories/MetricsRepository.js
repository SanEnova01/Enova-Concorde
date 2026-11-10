const db = require('../config/db');

class MetricsRepository {
  // Convierte un registro recibido (bot, CSV, manual) en la fila de daily_metrics
  static toRow(metricData) {
      const {
        store_id, date, redirect_ms, dns_ms, tcp_ms, ttfb_ms,
        dom_interactive_ms, dom_ms, load_ms, total_weight_mb,
        total_requests, ram_core_mb, ram_total_mb, ram_usage, load_s, dom_s,
        html_analysis // 🌟 SE ATRAPA LA RADIOGRAFÍA HTML
      } = metricData;

      return {
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
        html_analysis: typeof html_analysis === 'object' && html_analysis !== null ? JSON.stringify(html_analysis) : (html_analysis || null)
      };
  }

  static async create(metricData) {
    try {
      const [newMetric] = await db('daily_metrics').insert(this.toRow(metricData)).returning('*');
      return newMetric;
    } catch (error) {
      throw new Error('Error al guardar la métrica: ' + error.message);
    }
  }

  // Inserción masiva (carga por CSV). Se omiten filas sin store_id; todo o nada (transacción).
  static async createBulk(rows) {
    const validRows = (rows || []).filter((r) => r && r.store_id).map((r) => this.toRow(r));
    if (validRows.length === 0) return { inserted: 0, skipped: (rows || []).length };
    try {
      await db.transaction(async (trx) => {
        await trx.batchInsert('daily_metrics', validRows, 500);
      });
      return { inserted: validRows.length, skipped: rows.length - validRows.length };
    } catch (error) {
      throw new Error('Error al guardar métricas en bloque: ' + error.message);
    }
  }

  // Sin opciones devuelve toda la tabla (compatibilidad). Con days/store_id filtra en la base.
  static async getAll({ days, storeId } = {}) {
    let query = db('daily_metrics').orderBy('date', 'desc');
    if (storeId) query = query.where({ store_id: storeId });
    const nDays = parseInt(days, 10);
    if (nDays > 0) query = query.where('date', '>=', db.raw(`now() - (? * interval '1 day')`, [nDays]));
    return await query;
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
      .whereRaw("(html_analysis::jsonb)->>'tech' IS NOT NULL") // ignora registros sin radiografía real
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

  // Marca UNA alerta como atendida
  static async resolveAlert(id, by = null) {
    const [row] = await db('system_alerts')
      .where({ id })
      .whereNull('resolved_at')
      .update({ resolved_at: db.fn.now(), resolved_by: by })
      .returning('*');
    return row || null;
  }

  // Marca TODAS las alertas abiertas de una tienda como atendidas
  static async resolveStoreAlerts(storeId, by = null) {
    return db('system_alerts')
      .where({ store_id: storeId })
      .whereNull('resolved_at')
      .update({ resolved_at: db.fn.now(), resolved_by: by });
  }
}

module.exports = MetricsRepository;