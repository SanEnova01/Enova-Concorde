const db = require('../config/db');

// Momento en que un ticket pasa a IN_PROGRESS (tickets.in_progress_at).
// Productividad mide el tiempo de resolución desde aquí hasta closed_at (OPEN = solo creado).
// - Agrega la columna si no existe (IF NOT EXISTS: seguro en cada arranque).
// - Rellena los tickets antiguos con el PRIMER cambio a [IN_PROGRESS] registrado en audit_logs.
// Mientras la columna no esté confirmada, el resto del código no la escribe (isReady()).

let ready = false;
const isReady = () => ready;

const BACKFILL_SQL = `
  UPDATE tickets t
  SET in_progress_at = l.first_at
  FROM (
    SELECT substring(details from '^Ticket ID ([0-9]+) ') AS ticket_id, MIN(created_at) AS first_at
    FROM audit_logs
    WHERE action = 'CAMBIAR_ESTADO_TICKET' AND details LIKE '%[IN_PROGRESS]%'
    GROUP BY 1
  ) l
  WHERE l.ticket_id IS NOT NULL AND t.id::text = l.ticket_id AND t.in_progress_at IS NULL`;

async function ensureTicketTimeline() {
  await db.raw('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS in_progress_at timestamptz');
  ready = true;
  try {
    if (await db.schema.hasTable('audit_logs')) {
      const r = await db.raw(BACKFILL_SQL);
      const n = r?.rowCount || 0;
      if (n > 0) console.log(`✅ [DB] in_progress_at completado para ${n} tickets desde audit_logs`);
    }
  } catch (err) {
    console.warn('[DB] No se pudo completar in_progress_at desde audit_logs:', err.message);
  }
}

module.exports = ensureTicketTimeline;
module.exports.isReady = isReady;
module.exports.BACKFILL_SQL = BACKFILL_SQL;
