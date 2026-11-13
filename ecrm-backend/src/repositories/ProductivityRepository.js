const db = require('../config/db');
const { DAILY_TICKET_NAME } = require('../services/DailyTicketService');

// Productividad del equipo (Concorde Tools). Todo se calcula en Postgres.
// - Fechas: los días del filtro son días de Lima; los timestamptz se comparan contra
//   el inicio/fin de ese día en America/Lima.
// - assigned_to es una lista separada por comas: un ticket cuenta para cada responsable.
// - Los tickets automáticos "Revisión técnica Status diario" del bot no cuentan.

const TZ = 'America/Lima';
const UNASSIGNED_LABEL = 'Sin asignar';
const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 30;
const DONE = "('RESOLVED', 'CLOSED')";
const STATUS = "UPPER(COALESCE(t.status, 'OPEN'))";

const limaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
  && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

class FilterError extends Error {}

// Valida y completa los filtros de la query (?from=YYYY-MM-DD&to=YYYY-MM-DD&assignee=Nombre)
function parseFilters(query = {}) {
  const to = query.to ? String(query.to) : limaToday();
  const from = query.from ? String(query.from) : addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  if (!isYmd(from) || !isYmd(to)) throw new FilterError('Fechas inválidas: usa el formato YYYY-MM-DD.');
  if (from > to) throw new FilterError('La fecha inicial no puede ser posterior a la final.');
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (days > MAX_RANGE_DAYS) throw new FilterError(`El rango máximo es de ${MAX_RANGE_DAYS} días.`);
  const assignee = String(query.assignee || '').trim().slice(0, 120) || null;
  return { from, to, days, assignee };
}

// "col está dentro de [from, to] en días de Lima"
const inRange = (col) => `${col} >= ((?::date)::timestamp AT TIME ZONE '${TZ}') AND ${col} < (((?::date) + 1)::timestamp AT TIME ZONE '${TZ}')`;
const rangeBindings = (f) => [f.from, f.to];

// Responsables de un ticket (sin vacíos ni repetidos)
const NAMES_OF = (alias) => `SELECT DISTINCT btrim(x) AS nombre FROM unnest(string_to_array(${alias}.assigned_to, ',')) x WHERE btrim(x) <> ''`;

// Filtro por responsable sobre la tabla tickets (alias t)
function assigneeClause(f) {
  if (!f.assignee) return { sql: '', bindings: [] };
  if (f.assignee.toLowerCase() === UNASSIGNED_LABEL.toLowerCase()) {
    return { sql: ` AND NOT EXISTS (${NAMES_OF('t')})`, bindings: [] };
  }
  return { sql: ` AND EXISTS (SELECT 1 FROM (${NAMES_OF('t')}) n WHERE lower(n.nombre) = lower(?))`, bindings: [f.assignee] };
}

// Tickets con un renglón por responsable, ya filtrados (ticket diario fuera, responsable si aplica)
function ticketsByPerson(f) {
  const a = assigneeClause(f);
  const personFilter = f.assignee
    ? ` WHERE lower(responsable) = lower(?)`
    : '';
  return {
    sql: `
      SELECT * FROM (
        SELECT t.id, t.store_id, ${STATUS} AS status, UPPER(COALESCE(t.priority, 'MEDIUM')) AS priority,
               t.created_at, t.closed_at, COALESCE(n.nombre, '${UNASSIGNED_LABEL}') AS responsable
        FROM tickets t
        LEFT JOIN LATERAL (${NAMES_OF('t')}) n ON true
        WHERE t.name IS DISTINCT FROM ?${a.sql}
      ) tp${personFilter}`,
    bindings: [DAILY_TICKET_NAME, ...a.bindings, ...(f.assignee ? [f.assignee] : [])]
  };
}

const rowsOf = (r) => (r && Array.isArray(r.rows) ? r.rows : []);
const num = (v) => (v === null || v === undefined ? null : Number(v));
const round1 = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 10) / 10);

// 1) Resueltos/cerrados en el período y tiempo de resolución, por responsable
async function getResolved(f) {
  const tp = ticketsByPerson(f);
  const r = await db.raw(`
    SELECT responsable,
           COUNT(*)::int AS resueltos,
           SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END)::int AS cerrados,
           AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600) AS horas_promedio,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600) AS horas_mediana
    FROM (${tp.sql}) tp
    WHERE status IN ${DONE} AND closed_at IS NOT NULL AND ${inRange('closed_at')}
    GROUP BY responsable
    ORDER BY resueltos DESC, responsable`, [...tp.bindings, ...rangeBindings(f)]);
  return rowsOf(r).map((x) => ({
    responsable: x.responsable,
    resueltos: num(x.resueltos),
    cerrados: num(x.cerrados),
    horas_promedio: round1(x.horas_promedio),
    horas_mediana: round1(x.horas_mediana)
  }));
}

// 2) Carga actual (no depende del rango de fechas): pendientes por responsable
async function getWorkload(f) {
  const tp = ticketsByPerson(f);
  const r = await db.raw(`
    SELECT responsable,
           COUNT(*)::int AS pendientes,
           SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END)::int AS en_progreso,
           SUM(CASE WHEN priority IN ('HIGH', 'CRITICAL') THEN 1 ELSE 0 END)::int AS alta_prioridad,
           MIN(created_at) AS mas_antiguo,
           FLOOR(EXTRACT(EPOCH FROM (now() - MIN(created_at))) / 86400)::int AS dias_mas_antiguo
    FROM (${tp.sql}) tp
    WHERE status NOT IN ${DONE}
    GROUP BY responsable
    ORDER BY pendientes DESC, responsable`, tp.bindings);
  return rowsOf(r).map((x) => ({
    responsable: x.responsable,
    pendientes: num(x.pendientes),
    en_progreso: num(x.en_progreso),
    alta_prioridad: num(x.alta_prioridad),
    mas_antiguo: x.mas_antiguo,
    dias_mas_antiguo: num(x.dias_mas_antiguo)
  }));
}

// 3) Por tienda: creados y cerrados en el período, activos hoy (un ticket cuenta una sola vez)
async function getStores(f) {
  const a = assigneeClause(f);
  const r = await db.raw(`
    SELECT t.store_id,
           SUM(CASE WHEN ${inRange('t.created_at')} THEN 1 ELSE 0 END)::int AS creados,
           SUM(CASE WHEN ${STATUS} IN ${DONE} AND t.closed_at IS NOT NULL AND ${inRange('t.closed_at')} THEN 1 ELSE 0 END)::int AS cerrados,
           SUM(CASE WHEN ${STATUS} NOT IN ${DONE} THEN 1 ELSE 0 END)::int AS activos
    FROM tickets t
    WHERE t.store_id IS NOT NULL AND t.name IS DISTINCT FROM ?${a.sql}
    GROUP BY t.store_id
    HAVING SUM(CASE WHEN ${inRange('t.created_at')} THEN 1 ELSE 0 END) > 0
        OR SUM(CASE WHEN ${STATUS} IN ${DONE} AND t.closed_at IS NOT NULL AND ${inRange('t.closed_at')} THEN 1 ELSE 0 END) > 0
        OR SUM(CASE WHEN ${STATUS} NOT IN ${DONE} THEN 1 ELSE 0 END) > 0
    ORDER BY activos DESC, creados DESC, t.store_id`,
  [...rangeBindings(f), ...rangeBindings(f), DAILY_TICKET_NAME, ...a.bindings, ...rangeBindings(f), ...rangeBindings(f)]);
  return rowsOf(r).map((x) => ({ store_id: x.store_id, creados: num(x.creados), cerrados: num(x.cerrados), activos: num(x.activos) }));
}

// 4) Serie diaria (días de Lima): creados vs resueltos/cerrados
async function getTrend(f) {
  const a = assigneeClause(f);
  const r = await db.raw(`
    WITH dias AS (
      SELECT generate_series(?::date, ?::date, interval '1 day')::date AS dia
    ),
    base AS (
      SELECT (t.created_at AT TIME ZONE '${TZ}')::date AS creado,
             CASE WHEN ${STATUS} IN ${DONE} THEN (t.closed_at AT TIME ZONE '${TZ}')::date END AS cerrado
      FROM tickets t
      WHERE t.name IS DISTINCT FROM ?${a.sql}
    )
    SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia,
           (SELECT COUNT(*) FROM base b WHERE b.creado = d.dia)::int AS creados,
           (SELECT COUNT(*) FROM base b WHERE b.cerrado = d.dia)::int AS cerrados
    FROM dias d
    ORDER BY d.dia`, [f.from, f.to, DAILY_TICKET_NAME, ...a.bindings]);
  return rowsOf(r).map((x) => ({ dia: x.dia, creados: num(x.creados), cerrados: num(x.cerrados) }));
}

// 5) Revisiones diarias de tiendas por revisor (review_date ya es un día)
async function getReviews(f) {
  const who = f.assignee ? ' AND lower(btrim(reviewer_name)) = lower(?)' : '';
  const r = await db.raw(`
    SELECT COALESCE(NULLIF(btrim(reviewer_name), ''), '${UNASSIGNED_LABEL}') AS revisor,
           COUNT(*)::int AS revisiones,
           COUNT(DISTINCT store_id)::int AS tiendas,
           COUNT(DISTINCT review_date)::int AS dias
    FROM store_daily_reviews
    WHERE review_date >= ?::date AND review_date <= ?::date${who}
    GROUP BY 1
    ORDER BY revisiones DESC, revisor`, [f.from, f.to, ...(f.assignee ? [f.assignee] : [])]);
  return rowsOf(r).map((x) => ({ revisor: x.revisor, revisiones: num(x.revisiones), tiendas: num(x.tiendas), dias: num(x.dias) }));
}

// 6) Actividad registrada en audit_logs por usuario, con sus acciones más frecuentes
async function getActivity(f) {
  const who = f.assignee ? ' AND lower(btrim(user_name)) = lower(?)' : '';
  const r = await db.raw(`
    SELECT usuario, SUM(n)::int AS total,
           json_agg(json_build_object('accion', action, 'n', n) ORDER BY n DESC, action) AS acciones
    FROM (
      SELECT COALESCE(NULLIF(btrim(user_name), ''), 'Sistema') AS usuario, action, COUNT(*)::int AS n
      FROM audit_logs
      WHERE ${inRange('created_at')}${who}
      GROUP BY 1, 2
    ) s
    GROUP BY usuario
    ORDER BY total DESC, usuario`, [...rangeBindings(f), ...(f.assignee ? [f.assignee] : [])]);
  return rowsOf(r).map((x) => ({
    usuario: x.usuario,
    total: num(x.total),
    acciones: (typeof x.acciones === 'string' ? JSON.parse(x.acciones) : x.acciones || []).slice(0, 5)
  }));
}

// Totales del período (cada ticket una vez, aunque tenga varios responsables)
async function getSummary(f) {
  const a = assigneeClause(f);
  const r = await db.raw(`
    SELECT
      SUM(CASE WHEN ${inRange('t.created_at')} THEN 1 ELSE 0 END)::int AS creados,
      SUM(CASE WHEN ${STATUS} IN ${DONE} AND t.closed_at IS NOT NULL AND ${inRange('t.closed_at')} THEN 1 ELSE 0 END)::int AS resueltos,
      SUM(CASE WHEN ${STATUS} NOT IN ${DONE} THEN 1 ELSE 0 END)::int AS pendientes,
      AVG(CASE WHEN ${STATUS} IN ${DONE} AND t.closed_at IS NOT NULL AND ${inRange('t.closed_at')}
               THEN EXTRACT(EPOCH FROM (t.closed_at - t.created_at)) / 3600 END) AS horas_promedio
    FROM tickets t
    WHERE t.name IS DISTINCT FROM ?${a.sql}`,
  [...rangeBindings(f), ...rangeBindings(f), ...rangeBindings(f), DAILY_TICKET_NAME, ...a.bindings]);
  const x = rowsOf(r)[0] || {};
  return {
    creados: num(x.creados) || 0,
    resueltos: num(x.resueltos) || 0,
    pendientes: num(x.pendientes) || 0,
    horas_promedio: round1(x.horas_promedio)
  };
}

// Las tablas de revisiones y auditoría son opcionales: si fallan, el resto del reporte sigue
async function optional(fn, f, warnings, label) {
  try {
    return await fn(f);
  } catch (err) {
    warnings.push(`${label}: ${err.message}`);
    return null;
  }
}

async function getReport(query) {
  const f = parseFilters(query);
  const warnings = [];
  const [resumen, resueltos, carga, tiendas, tendencia, revisiones, actividad] = await Promise.all([
    getSummary(f),
    getResolved(f),
    getWorkload(f),
    getStores(f),
    getTrend(f),
    optional(getReviews, f, warnings, 'Revisiones diarias'),
    optional(getActivity, f, warnings, 'Actividad (audit_logs)')
  ]);
  return {
    filtros: { from: f.from, to: f.to, dias: f.days, assignee: f.assignee, zona_horaria: TZ },
    resumen, resueltos, carga, tiendas, tendencia, revisiones, actividad, warnings
  };
}

module.exports = { getReport, parseFilters, FilterError, UNASSIGNED_LABEL, limaToday };
