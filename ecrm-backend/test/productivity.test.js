const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { createFakeDb, mockModule, resetSrcCache } = require('./helpers/fakeDb');

process.env.JWT_SECRET = 'test-secret';
process.env.API_KEY = 'bot-key';

// El SQL real se prueba en integration.test.js. Aquí: filtros, permisos, bindings y forma de la respuesta.
let failTables = [];
const rawResponder = (sql) => {
  if (failTables.some((t) => sql.includes(t))) throw new Error(`relation "${failTables[0]}" does not exist`);
  if (sql.includes('percentile_cont')) return { rows: [{ responsable: 'Ana', resueltos: '3', cerrados: '1', horas_promedio: '5.04', horas_mediana: '4.46' }] };
  if (sql.includes('dias_mas_antiguo')) return { rows: [{ responsable: 'Sin asignar', pendientes: 2, en_progreso: 0, alta_prioridad: 1, mas_antiguo: '2026-01-01T00:00:00Z', dias_mas_antiguo: '10' }] };
  if (sql.includes('WITH dias AS')) return { rows: [{ dia: '2026-11-01', creados: '2', cerrados: '1' }] };
  if (sql.includes('store_daily_reviews')) return { rows: [{ revisor: 'Luis', revisiones: '4', tiendas: '2', dias: '3' }] };
  if (sql.includes('audit_logs')) return { rows: [{ usuario: 'Ana', total: '7', acciones: JSON.stringify([{ accion: 'LOGIN', n: 4 }, { accion: 'A', n: 1 }, { accion: 'B', n: 1 }, { accion: 'C', n: 1 }, { accion: 'D', n: 0 }, { accion: 'E', n: 0 }]) }] };
  if (sql.includes('GROUP BY t.store_id')) return { rows: [{ store_id: 's1', creados: '2', cerrados: '1', activos: '3' }] };
  if (sql.includes('AS pendientes,')) return { rows: [{ creados: '5', resueltos: '3', pendientes: '4', horas_promedio: '12.345' }] };
  return { rows: [] };
};

let db;
let server;
let base;
let signToken;
let Repo;

test.before(async () => {
  resetSrcCache();
  db = createFakeDb({ stores: [{ id: 's1', emails: 'cliente@x.com' }] }, { onRaw: rawResponder });
  mockModule('config/db.js', db);
  mockModule('services/HubSyncService.js', { registrarTicketEnHub: async () => {} });
  const auth = require('../src/middleware/auth');
  signToken = auth.signToken;
  Repo = require('../src/repositories/ProductivityRepository');
  const app = express();
  app.use(express.json());
  app.use('/api/productivity', auth.verificarToken, auth.requireStaff, require('../src/routes/productivity'));
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const bearer = (role, email = 'a@enova') => ({ authorization: 'Bearer ' + signToken({ id: 1, name: 'u', email, role }) });
const get = async (qs = '', headers = bearer('admin')) => {
  const r = await fetch(base + '/api/productivity' + qs, { headers });
  return { status: r.status, body: await r.json() };
};

test('permisos: sin token 401/403, cliente 403, admin y super admin 200', async () => {
  const sinToken = await fetch(base + '/api/productivity');
  assert.ok([401, 403].includes(sinToken.status));
  assert.strictEqual((await get('', bearer('client', 'cliente@x.com'))).status, 403);
  assert.strictEqual((await get('', bearer('admin'))).status, 200);
  assert.strictEqual((await get('', bearer('super admin'))).status, 200);
});

test('filtros por defecto: últimos 30 días hasta hoy en Lima', () => {
  const f = Repo.parseFilters({});
  assert.strictEqual(f.to, Repo.limaToday());
  assert.strictEqual(f.days, 30);
  assert.strictEqual(f.assignee, null);
});

test('filtros inválidos responden 400 con mensaje', async () => {
  for (const qs of ['?from=2026-13-01', '?from=ayer', '?from=2026-02-30&to=2026-03-01', '?from=2026-05-02&to=2026-05-01', '?from=2024-01-01&to=2026-01-01']) {
    const { status, body } = await get(qs);
    assert.strictEqual(status, 400, qs);
    assert.ok(body.error, qs);
  }
});

test('respuesta: números convertidos, redondeo a 1 decimal y top 5 de acciones', async () => {
  const { status, body } = await get('?from=2026-11-01&to=2026-11-10');
  assert.strictEqual(status, 200);
  const d = body.data;
  assert.deepStrictEqual(d.filtros, { from: '2026-11-01', to: '2026-11-10', dias: 10, assignee: null, excluir_enova_team: false, zona_horaria: 'America/Lima' });
  assert.deepStrictEqual(d.resumen, { creados: 5, resueltos: 3, pendientes: 4, horas_promedio: 12.3, largos: 0 });
  assert.deepStrictEqual(d.resueltos[0], { responsable: 'Ana', resueltos: 3, cerrados: 1, horas_promedio: 5, horas_mediana: 4.5, largos: 0 });
  assert.strictEqual(d.carga[0].dias_mas_antiguo, 10);
  assert.deepStrictEqual(d.tiendas[0], { store_id: 's1', creados: 2, cerrados: 1, activos: 3 });
  assert.deepStrictEqual(d.tendencia[0], { dia: '2026-11-01', creados: 2, cerrados: 1 });
  assert.deepStrictEqual(d.revisiones[0], { revisor: 'Luis', revisiones: 4, tiendas: 2, dias: 3 });
  assert.strictEqual(d.actividad[0].total, 7);
  assert.strictEqual(d.actividad[0].acciones.length, 5);
  assert.deepStrictEqual(d.warnings, []);
});

test('SQL: fechas en hora de Lima, incluye el ticket diario y bindings completos', async () => {
  db.log.raw.length = 0;
  await get('?from=2026-11-01&to=2026-11-10&assignee=Ana');
  assert.strictEqual(db.log.raw.length, 7);
  for (const { sql, bindings } of db.log.raw) {
    const marks = (sql.match(/\?/g) || []).length;
    assert.strictEqual(marks, bindings.length, `placeholders vs bindings en: ${sql.slice(0, 80)}`);
    if (sql.includes('FROM tickets')) {
      assert.ok(!bindings.includes('Revisión técnica Status diario'), 'no excluye el ticket diario');
      assert.doesNotMatch(sql, /IS DISTINCT FROM/);
      assert.ok(bindings.includes('Ana'), 'filtra por responsable');
    }
  }
  const resolved = db.log.raw.find((r) => r.sql.includes('percentile_cont'));
  assert.match(resolved.sql, /AT TIME ZONE 'America\/Lima'/);
  assert.ok(resolved.bindings.includes('2026-11-01') && resolved.bindings.includes('2026-11-10'));
});

test('"Sin asignar" filtra tickets sin responsable (sin binding de nombre en tickets)', async () => {
  db.log.raw.length = 0;
  await get('?assignee=' + encodeURIComponent('Sin asignar'));
  const store = db.log.raw.find((r) => r.sql.includes('GROUP BY t.store_id'));
  assert.match(store.sql, /NOT EXISTS/);
  assert.ok(!store.bindings.includes('Sin asignar'));
});

test('tiempo de resolución en horas hábiles: L-V 9:00-19:00 hora de Lima', async () => {
  db.log.raw.length = 0;
  const { body } = await get();
  assert.deepStrictEqual(body.data.horario, { dias: 'lunes a viernes', desde: '09:00', hasta: '19:00', horas_por_dia: 10, max_horas_promedio: 30 });
  for (const key of ['percentile_cont', 'AS pendientes,']) {
    const q = db.log.raw.find((r) => r.sql.includes(key));
    assert.match(q.sql, /ISODOW/);
    assert.match(q.sql, /time '09:00'/);
    assert.match(q.sql, /time '19:00'/);
    assert.ok(q.sql.includes('FILTER (WHERE horas <= 30)'), 'los tickets de más de 3 días hábiles no entran al promedio');
    assert.ok(q.sql.includes('FILTER (WHERE horas > 30)'), 'y se cuentan aparte');
    assert.doesNotMatch(q.sql, /EXTRACT\(EPOCH FROM \((t\.)?closed_at - /);
  }
});

test('excluir Enova Team: solo tickets con responsable y revisores con nombre', async () => {
  assert.strictEqual(Repo.parseFilters({ exclude_team: '1' }).excludeTeam, true);
  assert.strictEqual(Repo.parseFilters({ exclude_team: '0' }).excludeTeam, false);
  db.log.raw.length = 0;
  const { status, body } = await get('?exclude_team=1');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.data.filtros.excluir_enova_team, true);
  for (const { sql } of db.log.raw.filter((r) => r.sql.includes('FROM tickets'))) {
    assert.match(sql, /AND EXISTS \(SELECT DISTINCT btrim/);
  }
  const reviews = db.log.raw.find((r) => r.sql.includes('store_daily_reviews'));
  assert.match(reviews.sql, /IS NOT NULL/);
});

test('si falta la tabla de revisiones o auditoría, el resto sigue y se avisa', async () => {
  failTables = ['store_daily_reviews'];
  try {
    const { status, body } = await get();
    assert.strictEqual(status, 200);
    assert.strictEqual(body.data.revisiones, null);
    assert.ok(Array.isArray(body.data.actividad));
    assert.match(body.data.warnings[0], /Revisiones diarias/);
  } finally {
    failTables = [];
  }
});

test('si falla una consulta de tickets responde 500 sin filtrar detalles', async () => {
  failTables = ['percentile_cont'];
  try {
    const { status, body } = await get();
    assert.strictEqual(status, 500);
    assert.strictEqual(body.error, 'No se pudo calcular la productividad.');
  } finally {
    failTables = [];
  }
});
