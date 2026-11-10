// Base de datos en memoria con la parte de la API de knex que usa el backend.
// Permite probar la lógica sin Postgres. No interpreta SQL crudo: whereRaw se ignora
// y raw() se responde con el manejador que defina cada prueba.
const path = require('path');

function createFakeDb(initial = {}, { onRaw } = {}) {
  const tables = JSON.parse(JSON.stringify(initial));
  const log = { raw: [], inserts: [] };
  let nextId = 1000;

  // Condiciones: lista de { bool: 'and' | 'or', test } evaluada de izquierda a derecha.
  // Soporta grupos (where(fn)), whereIn, whereNull/whereNot, ilike y orWhere*, lo que usan los listados paginados.
  // LIKE/ILIKE sin regex: % = cualquier texto, _ = un carácter, barra invertida escapa el siguiente
  const BACKSLASH = String.fromCharCode(92);
  const likeToRegex = (pattern) => {
    const tokens = [];
    const str = String(pattern);
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === BACKSLASH && i + 1 < str.length) tokens.push({ lit: str[++i].toLowerCase() });
      else if (ch === '%') tokens.push({ any: true });
      else if (ch === '_') tokens.push({ one: true });
      else tokens.push({ lit: ch.toLowerCase() });
    }
    const match = (t, s) => {
      if (t === tokens.length) return s.length === 0;
      const tk = tokens[t];
      if (tk.any) { for (let k = 0; k <= s.length; k++) if (match(t + 1, s.slice(k))) return true; return false; }
      if (!s.length) return false;
      if (tk.one || tk.lit === s[0]) return match(t + 1, s.slice(1));
      return false;
    };
    return { test: (value) => match(0, String(value).toLowerCase()) };
  };

  const makeConds = () => {
    const conds = [];
    const evaluate = (row) => conds.reduce((acc, c, i) => {
      const v = c.test(row);
      if (i === 0) return v;
      return c.bool === 'or' ? (acc || v) : (acc && v);
    }, true);
    const add = (bool) => ({
      where(cond, op, val) {
        if (typeof cond === 'function') {
          const sub = makeConds();
          cond(sub.api);
          conds.push({ bool, test: sub.evaluate });
        } else if (typeof cond === 'object') {
          conds.push({ bool, test: (r) => Object.entries(cond).every(([k, v]) => String(r[k]) === String(v)) });
        } else if (val === undefined) {
          conds.push({ bool, test: (r) => String(r[cond]) === String(op) });
        } else if (String(op).toLowerCase() === 'ilike' || String(op).toLowerCase() === 'like') {
          const re = likeToRegex(val);
          conds.push({ bool, test: (r) => r[cond] != null && re.test(String(r[cond])) });
        } else if (op === '>=') {
          conds.push({ bool, test: () => true }); // comparaciones de fecha: no se simulan
        }
      },
      whereNot(col, val) { conds.push({ bool, test: (r) => String(r[col]) !== String(val) }); },
      whereNull(col) { conds.push({ bool, test: (r) => r[col] == null }); },
      whereNotNull(col) { conds.push({ bool, test: (r) => r[col] != null }); },
      whereIn(col, list) { conds.push({ bool, test: (r) => list.map(String).includes(String(r[col])) }); }
    });
    const and = add('and');
    const or = add('or');
    const api = {
      where(...a) { and.where(...a); return api; },
      orWhere(...a) { or.where(...a); return api; },
      whereNot(...a) { and.whereNot(...a); return api; },
      orWhereNot(...a) { or.whereNot(...a); return api; },
      whereNull(...a) { and.whereNull(...a); return api; },
      orWhereNull(...a) { or.whereNull(...a); return api; },
      whereNotNull(...a) { and.whereNotNull(...a); return api; },
      whereIn(...a) { and.whereIn(...a); return api; }
    };
    return { api, evaluate, conds };
  };

  const builder = (table) => {
    tables[table] = tables[table] || [];
    const { api: filterApi, evaluate } = makeConds();
    let orders = [];
    let limitN = null;
    let offsetN = 0;
    let countAs = null;
    const rows = () => {
      let list = tables[table].filter((r) => evaluate(r));
      if (orders.length) {
        list = [...list].sort((a, b) => {
          for (const { col, dir } of orders) {
            const va = a[col] ?? '';
            const vb = b[col] ?? '';
            if (va < vb) return dir === 'desc' ? 1 : -1;
            if (va > vb) return dir === 'desc' ? -1 : 1;
          }
          return 0;
        });
      }
      if (offsetN) list = list.slice(offsetN);
      if (limitN !== null) list = list.slice(0, limitN);
      return list;
    };
    const q = {
      ...Object.fromEntries(Object.keys(filterApi).map((k) => [k, (...a) => { filterApi[k](...a); return q; }])),
      whereRaw() { return q; },
      orderBy(col, dir = 'asc') { orders.push({ col, dir: String(dir).toLowerCase() }); return q; },
      limit(n) { limitN = n; return q; },
      offset(n) { offsetN = n; return q; },
      count(spec = '* as n') {
        countAs = String(spec).split(/\s+as\s+/i)[1] || 'count';
        return q;
      },
      select() { return q; },
      first() {
        if (countAs) return Promise.resolve({ [countAs]: tables[table].filter((r) => evaluate(r)).length });
        return Promise.resolve(rows()[0]);
      },
      then(resolve, reject) {
        const result = countAs ? [{ [countAs]: tables[table].filter((r) => evaluate(r)).length }] : rows();
        return Promise.resolve(result).then(resolve, reject);
      },
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
        const keep = tables[table].filter((r) => !evaluate(r));
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
