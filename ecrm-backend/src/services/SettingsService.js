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
  if (def.type === 'boolean') return value === true || value === 'true';
  if (def.type === 'number') return Number(value);
  return value;
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
    value: stored[key] ? coerce(def, stored[key].value) : def.default,
    updated_by: stored[key]?.updated_by || null,
    updated_at: stored[key]?.updated_at || null
  }));
}

async function set(key, value, updatedBy) {
  const def = DEFINITIONS[key];
  if (!def) throw new Error(`Ajuste desconocido: ${key}`);
  if (def.type === 'boolean' && typeof value !== 'boolean') throw new Error('El valor debe ser true o false.');

  await ensureTable();
  await db(TABLE)
    .insert({ key, value: JSON.stringify(value), updated_by: updatedBy || null, updated_at: db.fn.now() })
    .onConflict('key')
    .merge();
  cache = null;
  console.log(`[Settings] ${key} = ${JSON.stringify(value)} (por ${updatedBy || 'desconocido'})`);
  return value;
}

module.exports = { get, list, set, DEFINITIONS };
