// Pruebas contra un Postgres REAL. Corren en el CI (GitHub Actions levanta Postgres).
// En local se saltan si no hay DB_HOST definido.
const test = require('node:test');
const assert = require('node:assert');

const enabled = !!process.env.DB_HOST && process.env.RUN_DB_TESTS === '1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'x';
process.env.API_KEY = process.env.API_KEY || 'k';

test('integración con Postgres', { skip: !enabled && 'sin DB_HOST/RUN_DB_TESTS (corre en el CI)' }, async (t) => {
  const db = require('../src/config/db');
  const TicketRepository = require('../src/repositories/TicketRepository');
  const MetricsRepository = require('../src/repositories/MetricsRepository');
  const DailyTicketService = require('../src/services/DailyTicketService');

  // Esquema mínimo con las columnas que usa el código
  await db.raw('DROP TABLE IF EXISTS tickets, stores, daily_metrics CASCADE');
  await db.raw(`CREATE TABLE stores (id text PRIMARY KEY, emails text, web text, ticket_count int DEFAULT 0)`);
  await db.raw(`CREATE TABLE tickets (
    id serial PRIMARY KEY, serial_number text, name text, description text, store_id text,
    priority text, task_type text, status text, assigned_to text, is_b2c boolean DEFAULT false,
    is_apolo_sync boolean DEFAULT false, closed_at timestamptz, created_at timestamptz DEFAULT now())`);
  await db.raw(`CREATE TABLE daily_metrics (
    id serial PRIMARY KEY, store_id text, date timestamptz, redirect_ms int, dns_ms int, tcp_ms int,
    ttfb_ms int, dom_interactive_ms int, dom_ms int, load_ms int, total_weight_mb float,
    total_requests int, ram_core_mb float, ram_total_mb float, html_analysis text)`);
  await db('stores').insert([{ id: 's1' }, { id: 's2' }]);
  await require('../src/db/ensureIndexes')();

  await t.test('20 tickets creados a la vez reciben números distintos y consecutivos', async () => {
    const creados = await Promise.all(Array.from({ length: 20 }, (_, i) =>
      TicketRepository.create({ name: `t${i}`, store_id: 's1', task_type: 'CONSULTA' })));
    const nums = creados.map((c) => parseInt(c.serial_number.split('-')[2], 10)).sort((a, b) => a - b);
    assert.deepStrictEqual(nums, Array.from({ length: 20 }, (_, i) => i + 1));
    const store = await db('stores').where({ id: 's1' }).first();
    assert.strictEqual(store.ticket_count, 20);
  });

  await t.test('stats del dashboard: totales, por estado, por tienda y pendientes propios', async () => {
    await TicketRepository.create({ name: 'cerrado', store_id: 's2', status: 'CLOSED' });
    await TicketRepository.create({ name: 'mío', store_id: 's2', assigned_to: 'Ana, Luis' });
    await TicketRepository.create({ name: 'de Anabel', store_id: 's2', assigned_to: 'Anabel' });
    const s = await TicketRepository.getStats('Ana');
    assert.strictEqual(s.total, 23);
    assert.strictEqual(s.by_status.CLOSED, 1);
    assert.strictEqual(s.by_status.OPEN, 22);
    assert.deepStrictEqual(s.by_store.s2, { total: 3, active: 2 });
    assert.deepStrictEqual(s.mine.map((m) => m.name), ['mío']);
  });

  await t.test('ticket diario: uno por tienda y día (hora de Lima) con ingestas simultáneas', async () => {
    const r = await Promise.all([1, 2, 3].map(() => DailyTicketService.ensureDailyTicket('s1', { load_ms: 1 }, 'BOT')));
    assert.strictEqual(r.filter((x) => x.created).length, 1);
    // Un ticket diario creado "ayer" en Lima no cuenta como el de hoy
    await db('tickets').insert({ name: DailyTicketService.DAILY_TICKET_NAME, store_id: 's2', created_at: db.raw("now() - interval '1 day'") });
    const hoy = await DailyTicketService.ensureDailyTicket('s2', { load_ms: 1 }, 'BOT');
    assert.strictEqual(hoy.created, true);
  });

  await t.test('métricas: misma corrida se detecta como duplicado; otra corrida no', async () => {
    await MetricsRepository.create({ store_id: 's1', date: '2026-11-10T14:00:00Z', load_ms: 1000 });
    assert.ok(await MetricsRepository.findSameRun('s1', '2026-11-10T14:03:00Z'));
    assert.strictEqual(await MetricsRepository.findSameRun('s1', '2026-11-10T23:00:00Z'), undefined);
    assert.strictEqual(await MetricsRepository.findSameRun('s2', '2026-11-10T14:00:00Z'), undefined);
    const ultimos = await MetricsRepository.getAll({ days: 100000, storeId: 's1' });
    assert.strictEqual(ultimos.length, 1);
  });

  await t.test('clonar: dos clonaciones simultáneas del mismo ticket no repiten letra', async () => {
    await db('stores').insert([{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }, { id: 'k4' }]);
    const original = await TicketRepository.create({ name: 'Pedido Kuna', store_id: 's1' });
    const [a, b] = await Promise.all([
      TicketRepository.cloneToStores(original.id, ['k1', 'k2']),
      TicketRepository.cloneToStores(original.id, ['k3', 'k4'])
    ]);
    const serials = [...a.created, ...b.created].map((x) => x.serial_number).sort();
    assert.deepStrictEqual(serials, ['A', 'B', 'C', 'D'].map((l) => `${original.serial_number}${l}`));
    const siguiente = await TicketRepository.create({ name: 'nuevo', store_id: 's1' });
    assert.strictEqual(
      parseInt(siguiente.serial_number.split('-')[2], 10),
      parseInt(original.serial_number.split('-')[2], 10) + 1
    );
  });

  await t.test('productividad: conteos, tiempos y días en hora de Lima', async () => {
    const Productivity = require('../src/repositories/ProductivityRepository');
    await db.raw('DROP TABLE IF EXISTS store_daily_reviews, audit_logs CASCADE');
    await db.raw('CREATE TABLE store_daily_reviews (id serial PRIMARY KEY, store_id text, review_date date, reviewer_name text)');
    await db.raw(`CREATE TABLE audit_logs (id serial PRIMARY KEY, user_name text, user_email text, action text,
      details text, ip_address text, created_at timestamptz DEFAULT now())`);
    // Octubre 2026 (no choca con los tickets "de hoy" de las pruebas anteriores). Lima = UTC-5.
    await db('tickets').insert([
      { name: 'p1', store_id: 'ps', assigned_to: 'Pia, Rodo', status: 'RESOLVED', created_at: '2026-10-01T15:00:00Z', closed_at: '2026-10-01T19:00:00Z' },
      { name: 'p2', store_id: 'ps', assigned_to: 'Pia', status: 'CLOSED', created_at: '2026-10-01T15:00:00Z', closed_at: '2026-10-02T15:00:00Z' },
      { name: 'p3', store_id: 'ps', assigned_to: 'Pia', status: 'OPEN', priority: 'HIGH', created_at: '2026-10-02T15:00:00Z' },
      // 22:00 del 3 en Lima (ya es 4 en UTC): se crea dentro del rango; se cierra el 4 en Lima, fuera
      { name: 'p4', store_id: 'ps', assigned_to: 'Pia', status: 'CLOSED', created_at: '2026-10-04T03:00:00Z', closed_at: '2026-10-04T06:00:00Z' },
      // El ticket diario del bot no cuenta
      { name: DailyTicketService.DAILY_TICKET_NAME, store_id: 'ps', assigned_to: 'Pia', status: 'CLOSED', created_at: '2026-10-01T15:00:00Z', closed_at: '2026-10-01T16:00:00Z' }
    ]);
    await db('store_daily_reviews').insert([
      { store_id: 's1', review_date: '2026-10-01', reviewer_name: 'Pia' },
      { store_id: 's2', review_date: '2026-10-01', reviewer_name: 'Pia' },
      { store_id: 's1', review_date: '2026-10-03', reviewer_name: ' Pia ' },
      { store_id: 's1', review_date: '2026-10-04', reviewer_name: 'Pia' }
    ]);
    await db('audit_logs').insert([
      { user_name: 'Pia', action: 'LOGIN', created_at: '2026-10-02T12:00:00Z' },
      { user_name: 'Pia', action: 'LOGIN', created_at: '2026-10-02T13:00:00Z' },
      { user_name: 'Pia', action: 'TICKET', created_at: '2026-10-04T04:00:00Z' }, // 23:00 del 3 en Lima
      { user_name: 'Pia', action: 'TICKET', created_at: '2026-10-04T05:30:00Z' } // 00:30 del 4 en Lima
    ]);

    const r = await Productivity.getReport({ from: '2026-10-01', to: '2026-10-03', assignee: 'pia' });
    assert.deepStrictEqual(r.warnings, []);
    assert.deepStrictEqual(r.resumen, { creados: 4, resueltos: 2, pendientes: 1, horas_promedio: 14 });
    assert.deepStrictEqual(r.resueltos, [{ responsable: 'Pia', resueltos: 2, cerrados: 1, horas_promedio: 14, horas_mediana: 14 }]);
    assert.strictEqual(r.carga.length, 1);
    assert.strictEqual(r.carga[0].pendientes, 1);
    assert.strictEqual(r.carga[0].alta_prioridad, 1);
    assert.deepStrictEqual(r.tiendas, [{ store_id: 'ps', creados: 4, cerrados: 2, activos: 1 }]);
    assert.deepStrictEqual(r.tendencia, [
      { dia: '2026-10-01', creados: 2, cerrados: 1 },
      { dia: '2026-10-02', creados: 1, cerrados: 1 },
      { dia: '2026-10-03', creados: 1, cerrados: 0 }
    ]);
    assert.deepStrictEqual(r.revisiones, [{ revisor: 'Pia', revisiones: 3, tiendas: 2, dias: 2 }]);
    assert.strictEqual(r.actividad[0].total, 3);
    assert.deepStrictEqual(r.actividad[0].acciones[0], { accion: 'LOGIN', n: 2 });

    // Sin filtro de responsable: un ticket con dos responsables cuenta para ambos
    const todos = await Productivity.getReport({ from: '2026-10-01', to: '2026-10-03' });
    const rodo = todos.resueltos.find((x) => x.responsable === 'Rodo');
    assert.deepStrictEqual(rodo, { responsable: 'Rodo', resueltos: 1, cerrados: 0, horas_promedio: 4, horas_mediana: 4 });
    assert.ok(todos.carga.some((x) => x.responsable === 'Sin asignar'), 'los tickets sin responsable aparecen como "Sin asignar"');
  });

  await db.destroy();
});
