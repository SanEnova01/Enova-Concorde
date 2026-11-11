const db = require('../config/db');
// 'ai' es un módulo ESM: en Node 18 (Railway) no se puede usar require(); se carga con import() al construir las herramientas

// ==========================================
// HERRAMIENTAS DE CONSULTA DE LA MASCOTA (solo lectura)
// La IA no escribe SQL: elige una de estas consultas fijas y el backend la ejecuta.
// Ninguna modifica datos. Cada uso queda en audit_logs (MASCOTA_CONSULTA).
// ==========================================

const MAX_ROWS = 10;
const MAX_TEXT = 60;

// Texto de búsqueda seguro para LIKE: sin comodines, recortado
const clean = (v) => String(v || '').replace(/[%_\\]/g, '').trim().slice(0, MAX_TEXT);

const pick = (row, fields) => Object.fromEntries(fields.filter((f) => row[f] !== undefined && row[f] !== null && row[f] !== '').map((f) => [f, row[f]]));

const STORE_FIELDS = ['id', 'name', 'web', 'emails', 'phone', 'plan_type', 'tecnologia', 'assigned_to', 'ticket_count', 'has_cooppilot'];
const TICKET_FIELDS = ['serial_number', 'name', 'status', 'priority', 'task_type', 'store_id', 'assigned_to', 'is_b2c', 'created_at', 'closed_at'];

async function findStores(texto, limit = 5) {
  const q = clean(texto);
  if (!q) return [];
  const rows = await db('stores')
    .where((b) => b.where('id', 'ilike', `%${q}%`).orWhere('name', 'ilike', `%${q}%`))
    .select('*')
    .limit(limit);
  return rows.map((r) => pick(r, STORE_FIELDS));
}

// Resuelve una tienda por id exacto o por nombre parecido (la primera coincidencia)
async function resolveStore(texto) {
  const q = clean(texto);
  if (!q) return null;
  const exact = await db('stores').where({ id: q }).first();
  if (exact) return exact;
  const [first] = await db('stores')
    .where((b) => b.where('id', 'ilike', `%${q}%`).orWhere('name', 'ilike', `%${q}%`))
    .select('*')
    .limit(1);
  return first || null;
}

function describeTicket(t, withDescription = false) {
  const out = pick(t, TICKET_FIELDS);
  if (withDescription && t.description) {
    out.description = String(t.description).replace(/\[GMAIL_ID:[^\]]*\]/g, '').trim().slice(0, 600);
  }
  return out;
}

const HANDLERS = {
  async buscar_tienda({ texto }) {
    const tiendas = await findStores(texto);
    return tiendas.length ? { tiendas } : { resultado: `No encontré tiendas que coincidan con "${clean(texto)}".` };
  },

  async ver_ticket({ numero }) {
    const n = clean(numero);
    if (!n) return { resultado: 'Falta el número de ticket.' };
    let ticket = await db('tickets').where('serial_number', 'ilike', n).first();
    if (!ticket && /^\d+$/.test(n)) {
      ticket = await db('tickets').where({ id: Number(n) }).first();
      // "42" también puede ser SOP-AAAA-0042
      if (!ticket) ticket = await db('tickets').where('serial_number', 'ilike', `%-${n.padStart(4, '0')}`).orderBy('created_at', 'desc').first();
    }
    return ticket ? { ticket: describeTicket(ticket, true) } : { resultado: `No existe el ticket "${n}".` };
  },

  async buscar_tickets({ texto }) {
    const q = clean(texto);
    if (!q) return { resultado: 'Falta el texto a buscar.' };
    const rows = await db('tickets')
      .where((b) => b.where('name', 'ilike', `%${q}%`).orWhere('serial_number', 'ilike', `%${q}%`))
      .orderBy('created_at', 'desc')
      .limit(MAX_ROWS);
    return { tickets: rows.map((t) => describeTicket(t)) };
  },

  async tickets_de_tienda({ tienda, solo_abiertos = true }) {
    const store = await resolveStore(tienda);
    if (!store) return { resultado: `No encontré la tienda "${clean(tienda)}".` };
    let q = db('tickets').where({ store_id: store.id });
    if (solo_abiertos) q = q.whereNotIn('status', ['CLOSED', 'RESOLVED']);
    const rows = await q.orderBy('created_at', 'desc').limit(MAX_ROWS);
    return { tienda: store.name || store.id, store_id: store.id, total_mostrados: rows.length, tickets: rows.map((t) => describeTicket(t)) };
  },

  async metricas_tienda({ tienda }) {
    const store = await resolveStore(tienda);
    if (!store) return { resultado: `No encontré la tienda "${clean(tienda)}".` };
    const rows = await db('daily_metrics')
      .where({ store_id: store.id })
      .orderBy('date', 'desc')
      .limit(3)
      .select('date', 'load_ms', 'ttfb_ms', 'dom_ms', 'total_weight_mb', 'total_requests');
    return { tienda: store.name || store.id, ultimas_mediciones: rows };
  },

  async alertas_tienda({ tienda }) {
    const store = await resolveStore(tienda);
    if (!store) return { resultado: `No encontré la tienda "${clean(tienda)}".` };
    const rows = await db('system_alerts')
      .where({ store_id: store.id })
      .whereNull('resolved_at')
      .orderBy('created_at', 'desc')
      .limit(5);
    return {
      tienda: store.name || store.id,
      alertas_sin_atender: rows.map((a) => pick(a, ['alert_type', 'severity', 'message', 'created_at']))
    };
  }
};

const SCHEMAS = {
  buscar_tienda: {
    description: 'Busca tiendas (clientes) por nombre o id. Devuelve web, correos de contacto, teléfono, plan, tecnología y responsable.',
    params: { texto: { type: 'string', description: 'Nombre o id de la tienda, ej. "Barker"' } },
    required: ['texto']
  },
  ver_ticket: {
    description: 'Detalle de un ticket por su número (ej. SOP-2026-0042, HUB-2026-0003, o solo 42).',
    params: { numero: { type: 'string', description: 'Número de ticket' } },
    required: ['numero']
  },
  buscar_tickets: {
    description: 'Busca tickets por texto en el título o número (los 10 más recientes).',
    params: { texto: { type: 'string', description: 'Texto a buscar' } },
    required: ['texto']
  },
  tickets_de_tienda: {
    description: 'Tickets de una tienda (por defecto solo los abiertos o en progreso, máximo 10).',
    params: {
      tienda: { type: 'string', description: 'Nombre o id de la tienda' },
      solo_abiertos: { type: 'boolean', description: 'true = solo abiertos/en progreso (por defecto)' }
    },
    required: ['tienda']
  },
  metricas_tienda: {
    description: 'Últimas 3 mediciones de rendimiento de una tienda (carga, TTFB, peso, peticiones).',
    params: { tienda: { type: 'string', description: 'Nombre o id de la tienda' } },
    required: ['tienda']
  },
  alertas_tienda: {
    description: 'Alertas de IA sin atender de una tienda.',
    params: { tienda: { type: 'string', description: 'Nombre o id de la tienda' } },
    required: ['tienda']
  }
};

/**
 * Herramientas para el SDK de IA. onUse(nombre, args) se llama en cada consulta (auditoría).
 */
async function buildTools({ onUse } = {}) {
  const { tool, jsonSchema } = await import('ai');
  return Object.fromEntries(Object.entries(SCHEMAS).map(([name, s]) => [name, tool({
    description: s.description,
    inputSchema: jsonSchema({ type: 'object', properties: s.params, required: s.required, additionalProperties: false }),
    execute: async (args) => {
      try {
        if (onUse) onUse(name, args);
        const result = await HANDLERS[name](args || {});
        // Límite de tamaño de lo que vuelve al modelo
        const json = JSON.stringify(result);
        return json.length > 4000 ? { resultado_recortado: json.slice(0, 4000) } : result;
      } catch (err) {
        console.warn(`[PET] Herramienta ${name} falló:`, err.message);
        return { error: 'No se pudo consultar ese dato ahora.' };
      }
    }
  })]));
}

module.exports = { buildTools, HANDLERS, clean };
