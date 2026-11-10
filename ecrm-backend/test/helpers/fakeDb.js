// Base de datos en memoria con la parte de la API de knex que usa el backend.
// Permite probar la lógica sin Postgres. No interpreta SQL crudo: whereRaw se ignora
// y raw() se responde con el manejador que defina cada prueba.
const path = require('path');

function createFakeDb(initial = {}, { onRaw } = {}) {
  const tables = JSON.parse(JSON.stringify(initial));
  const log = { raw: [], inserts: [] };
  let nextId = 1000;

  const builder = (table) => {
    tables[table] = tables[table] || [];
    let filters = [];
    const rows = () => tables[table].filter((r) => filters.every((f) => f(r)));
    const q = {
      where(cond, op, val) {
        if (typeof cond === 'object') {
          filters.push((r) => Object.entries(cond).every(([k, v]) => String(r[k]) === String(v)));
        } else if (val === undefined) {
          filters.push((r) => String(r[cond]) === String(op));
        } else if (op === '>=') {
          filters.push(() => true); // comparaciones de fecha: no se simulan
        }
        return q;
      },
      whereRaw() { return q; },
      whereNotNull(col) { filters.push((r) => r[col] != null); return q; },
      orderBy() { return q; },
      select() { return q; },
      first() { return Promise.resolve(rows()[0]); },
      then(resolve, reject) { return Promise.resolve(rows()).then(resolve, reject); },
      insert(row) {
        const list = (Array.isArray(row) ? row : [row]).map((r) => ({ id: r.id ?? nextId++, ...r }));
        tables[table].push(...list);
        log.inserts.push({ table, rows: list });
        const p = Promise.resolve(list);
        p.returning = () => Promise.resolve(list);
        p.onConflict = () => ({ merge: () => Promise.resolve(list) });
        return p;
      },
      increment(col, n = 1) {
        rows().forEach((r) => { r[col] = (r[col] || 0) + n; });
        return Promise.resolve(1);
      },
      update(data) {
        const list = rows();
        list.forEach((r) => Object.assign(r, data));
        const p = Promise.resolve(list.length);
        p.returning = () => Promise.resolve(list);
        return p;
      },
      del() {
        const keep = tables[table].filter((r) => !filters.every((f) => f(r)));
        const removed = tables[table].length - keep.length;
        tables[table] = keep;
        return Promise.resolve(removed);
      }
    };
    return q;
  };

  const db = (table) => builder(table);
  db.raw = async (sql, bindings) => {
    log.raw.push({ sql, bindings });
    return onRaw ? onRaw(sql, bindings, tables) : { rows: [] };
  };
  db.fn = { now: () => 'NOW()' };
  db.batchInsert = async (table, rows) => builder(table).insert(rows);
  db.transaction = async (fn) => fn(db);
  db.schema = { hasTable: async () => true, createTable: async () => {} };
  db.tables = tables;
  db.log = log;
  return db;
}

// Reemplaza config/db.js (y otros módulos) en el caché de require antes de cargar el código a probar
const SRC = path.join(__dirname, '..', '..', 'src');
function mockModule(relPath, exportsValue) {
  require.cache[require.resolve(path.join(SRC, relPath))] = { exports: exportsValue };
}
function freshRequire(relPath) {
  const full = require.resolve(path.join(SRC, relPath));
  delete require.cache[full];
  return require(full);
}
function resetSrcCache() {
  Object.keys(require.cache).forEach((k) => { if (k.startsWith(SRC)) delete require.cache[k]; });
}

module.exports = { createFakeDb, mockModule, freshRequire, resetSrcCache, SRC };
