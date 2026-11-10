const db = require('../config/db');

// ==========================================
// CONFIGURACIÓN DEL SISTEMA (menú "Configuración", solo super admin)
// Para agregar un switch nuevo: sumarlo a DEFINITIONS y leerlo con SettingsService.get(key).
// ==========================================
const DEFINITIONS = {
  audit_dummy_metrics: {
    type: 'boolean',
    default: true,
    group: 'Concorde Radar (auditorías)',
    label: 'Métricas de respaldo (dummie) en auditorías',
    description: 'Si el bot o PageSpeed fallan, la auditoría se completa con valores estimados. Si lo desactivas, la auditoría se detiene y muestra qué falló, sin inventar datos.'
  },

  // ---------- Mascota Concorde (dashboard) ----------
  pet_enabled: {
    type: 'boolean', default: true, group: 'Mascota Concorde',
    label: 'Mostrar la mascota',
    description: 'Apaga la mascota del dashboard para todo el equipo.'
  },
  pet_ai_enabled: {
    type: 'boolean', default: true, group: 'Mascota Concorde',
    label: 'Inteligencia artificial',
    description: 'La mascota responde con IA (Vercel AI Gateway) usando los datos reales de Concorde. Apagado: solo frases fijas, sin costo.'
  },
  pet_ai_model: {
    type: 'select', default: 'openai/gpt-6-luna', group: 'Mascota Concorde',
    label: 'Modelo de IA',
    description: 'Modelo que usa la mascota. Todos pasan por el AI Gateway de Vercel.',
    options: [
      { value: 'openai/gpt-6-luna', label: 'GPT-6 Luna (rápido y barato)' },
      { value: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5 (rápido, buen español)' },
      { value: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash (económico)' }
    ]
  },
  pet_personality: {
    type: 'select', default: 'divertido', group: 'Mascota Concorde',
    label: 'Personalidad',
    description: 'Cómo habla la mascota.',
    options: [
      { value: 'divertido', label: 'Divertido y cercano' },
      { value: 'profesional', label: 'Profesional y directo' },
      { value: 'motivador', label: 'Motivador (coach)' },
      { value: 'sarcastico', label: 'Sarcástico (suave, nunca ofensivo)' }
    ]
  },
  pet_custom_instructions: {
    type: 'text', default: '', group: 'Mascota Concorde', maxLength: 600,
    label: 'Instrucciones extra para la IA',
    description: 'Opcional. Ej.: "Recuérdanos priorizar los tickets de clientes Scale" o "Habla como piloto de avión".'
  },
  pet_ai_daily_limit: {
    type: 'number', default: 40, min: 0, max: 500, group: 'Mascota Concorde',
    label: 'Mensajes de IA por persona al día',
    description: 'Tope de respuestas con IA por usuario y día (controla el costo). 0 = sin IA.'
  },
  pet_proactive_minutes: {
    type: 'number', default: 20, min: 0, max: 240, group: 'Mascota Concorde',
    label: 'Comentarios espontáneos (minutos)',
    description: 'Cada cuántos minutos la mascota comenta algo por su cuenta sobre el estado de Concorde. 0 = nunca.'
  },
  pet_action_alerts: {
    type: 'boolean', default: true, group: 'Mascota Concorde',
    label: 'Acción: avisar carga crítica y tickets propios',
    description: 'Se alarma cuando hay muchos tickets activos y te recuerda los tuyos.'
  },
  pet_action_walk: {
    type: 'boolean', default: true, group: 'Mascota Concorde',
    label: 'Acción: pasear por la pantalla',
    description: 'Se mueve sola de vez en cuando.'
  },
  pet_action_games: {
    type: 'boolean', default: true, group: 'Mascota Concorde',
    label: 'Acción: cuidados, XP, monedas e inventario',
    description: 'El minijuego (alimentar, jugar, misiones, accesorios). Se guarda en el navegador de cada persona.'
  },
  pet_action_chat: {
    type: 'boolean', default: true, group: 'Mascota Concorde',
    label: 'Acción: chatear con la mascota',
    description: 'Muestra la pestaña "Hablar" para hacerle preguntas sobre Concorde.'
  }
};

const TABLE = 'app_settings';
const CACHE_MS = 30 * 1000;
let cache = null;
let cacheAt = 0;
let tableReady = null;

function ensureTable() {
  if (!tableReady) {
    tableReady = db.schema.hasTable(TABLE).then((exists) => {
      if (exists) return;
      return db.schema.createTable(TABLE, (t) => {
        t.string('key').primary();
        t.jsonb('value');
        t.string('updated_by').nullable();
        t.timestamp('updated_at').defaultTo(db.fn.now());
      }).then(() => console.log(`✅ Tabla ${TABLE} creada`));
    }).catch((err) => {
      tableReady = null; // reintentar en la próxima llamada
      throw err;
    });
  }
  return tableReady;
}

async function loadStored() {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;
  await ensureTable();
  const rows = await db(TABLE).select('key', 'value', 'updated_by', 'updated_at');
  cache = Object.fromEntries(rows.map((r) => [r.key, r]));
  cacheAt = Date.now();
  return cache;
}

function coerce(def, value) {
  // jsonb normalmente llega ya convertido; si llega como texto JSON ("\"abc\""), se decodifica
  if (typeof value === 'string' && value.startsWith('"')) {
    try { value = JSON.parse(value); } catch (e) { /* se usa tal cual */ }
  }
  if (def.type === 'boolean') return value === true || value === 'true';
  if (def.type === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : def.default;
  }
  if (def.type === 'select') return def.options.some((o) => o.value === value) ? value : def.default;
  if (def.type === 'text') return typeof value === 'string' ? value : def.default;
  return value;
}

// Valida y normaliza un valor nuevo según el tipo del ajuste (lanza error si no es válido)
function validate(def, value) {
  if (def.type === 'boolean') {
    if (typeof value !== 'boolean') throw new Error('El valor debe ser true o false.');
    return value;
  }
  if (def.type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error('El valor debe ser un número.');
    if (def.min !== undefined && n < def.min) throw new Error(`El mínimo es ${def.min}.`);
    if (def.max !== undefined && n > def.max) throw new Error(`El máximo es ${def.max}.`);
    return Math.round(n);
  }
  if (def.type === 'select') {
    if (!def.options.some((o) => o.value === value)) throw new Error('Opción no válida.');
    return value;
  }
  if (def.type === 'text') {
    if (typeof value !== 'string') throw new Error('El valor debe ser texto.');
    const max = def.maxLength || 1000;
    if (value.length > max) throw new Error(`Máximo ${max} caracteres.`);
    return value.trim();
  }
  throw new Error('Tipo de ajuste no soportado.');
}

// Valor efectivo de un ajuste. Si la base falla, se usa el valor por defecto (nunca rompe el flujo).
async function get(key) {
  const def = DEFINITIONS[key];
  if (!def) throw new Error(`Ajuste desconocido: ${key}`);
  try {
    const stored = await loadStored();
    return stored[key] ? coerce(def, stored[key].value) : def.default;
  } catch (err) {
    console.error(`[Settings] No se pudo leer ${key}, se usa el valor por defecto:`, err.message);
    return def.default;
  }
}

async function list() {
  const stored = await loadStored();
  return Object.entries(DEFINITIONS).map(([key, def]) => ({
    key,
    type: def.type,
    group: def.group,
    label: def.label,
    description: def.description,
    default: def.default,
    options: def.options,
    min: def.min,
    max: def.max,
    maxLength: def.maxLength,
    value: stored[key] ? coerce(def, stored[key].value) : def.default,
    updated_by: stored[key]?.updated_by || null,
    updated_at: stored[key]?.updated_at || null
  }));
}

async function set(key, value, updatedBy) {
  const def = DEFINITIONS[key];
  if (!def) throw new Error(`Ajuste desconocido: ${key}`);
  value = validate(def, value);

  await ensureTable();
  await db(TABLE)
    .insert({ key, value: JSON.stringify(value), updated_by: updatedBy || null, updated_at: db.fn.now() })
    .onConflict('key')
    .merge();
  cache = null;
  console.log(`[Settings] ${key} = ${JSON.stringify(value)} (por ${updatedBy || 'desconocido'})`);
  return value;
}

// Varios ajustes a la vez (ej. todos los que empiezan con "pet_")
async function getByPrefix(prefix) {
  const out = {};
  for (const key of Object.keys(DEFINITIONS).filter((k) => k.startsWith(prefix))) {
    out[key] = await get(key);
  }
  return out;
}

module.exports = { get, list, set, getByPrefix, DEFINITIONS };
