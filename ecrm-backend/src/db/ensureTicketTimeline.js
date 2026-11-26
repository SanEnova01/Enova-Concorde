const db = require('../config/db');

// Momento en que un ticket pasa a IN_PROGRESS (tickets.in_progress_at).
// Productividad mide el tiempo de resolución desde aquí hasta closed_at (OPEN = solo creado).
// - Agrega la columna si no existe (IF NOT EXISTS: seguro en cada arranque).
// - Rellena los tickets antiguos con el PRIMER cambio a [IN_PROGRESS] registrado en audit_logs
//   (detalle "Ticket ID <id> (...) cambió a estado [IN_PROGRESS]"; el id puede ser número o UUID).
// Mientras la columna no esté confirmada, el resto del código no la escribe (isReady()).

let ready = false;
const isReady = () => ready;

const BACKFILL_SQL = `
  UPDATE tickets t
  SET in_progress_at = l.first_at
  FROM (
    SELECT substring(details from '^Ticket ID ([^ ]+) ') AS ticket_id, MIN(created_at) AS first_at
    FROM audit_logs
    WHERE action = 'CAMBIAR_ESTADO_TICKET' AND details LIKE '%[IN_PROGRESS]%'
    GROUP BY 1
  ) l
  WHERE l.ticket_id IS NOT NULL AND t.id::text = l.ticket_id AND t.in_progress_at IS NULL`;

// Diagnóstico para los logs del arranque
const STATS_SQL = `
  SELECT (SELECT COUNT(*) FROM audit_logs WHERE action = 'CAMBIAR_ESTADO_TICKET' AND details LIKE '%[IN_PROGRESS]%')::int AS logs,
         (SELECT COUNT(*) FROM tickets WHERE in_progress_at IS NOT NULL)::int AS con_inicio`;

async function ensureTicketTimeline() {
  await db.raw('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS in_progress_at timestamptz');
  ready = true;
  try {
    if (await db.schema.hasTable('audit_logs')) {
      const r = await db.raw(BACKFILL_SQL);
      const n = r?.rowCount || 0;
      const c = await db.raw(STATS_SQL);
      const st = (c && c.rows && c.rows[0]) || {};
      console.log(`[DB] in_progress_at: ${n} tickets completados ahora desde audit_logs (cambios a En progreso registrados: ${st.logs ?? '?'}; tickets con inicio: ${st.con_inicio ?? '?'})`);
    }
  } catch (err) {
    console.warn('[DB] No se pudo completar in_progress_at desde audit_logs:', err.message);
  }
}

module.exports = ensureTicketTimeline;
module.exports.isReady = isReady;
module.exports.BACKFILL_SQL = BACKFILL_SQL;
