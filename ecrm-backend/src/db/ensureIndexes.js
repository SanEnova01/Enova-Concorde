const db = require('../config/db');

// Índices para las consultas más frecuentes (métricas por tienda/fecha, tickets por tienda/fecha).
// IF NOT EXISTS: es seguro ejecutarlo en cada arranque. Si una columna no existe, solo se avisa.
// (En la fase de estructura esto pasa a migraciones de knex.)
const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_daily_metrics_store_date ON daily_metrics (store_id, date DESC)',
  'CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics (date DESC)',
  'CREATE INDEX IF NOT EXISTS idx_tickets_store_created ON tickets (store_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets (created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_system_alerts_created ON system_alerts (created_at DESC)'
];

async function ensureIndexes() {
  let fallidos = 0;
  for (const sql of INDEXES) {
    try {
      await db.raw(sql);
    } catch (err) {
      fallidos++;
      console.warn(`[DB] No se pudo crear índice (${sql.split(' ')[5]}): ${err.message}`);
    }
  }
  if (fallidos === 0) console.log('✅ [DB] Índices verificados');
  else console.warn(`⚠️ [DB] ${fallidos} de ${INDEXES.length} índices no se pudieron verificar`);
}

module.exports = ensureIndexes;
