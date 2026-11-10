const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { createFakeDb, mockModule } = require('./helpers/fakeDb');

process.env.JWT_SECRET = 'x';
process.env.API_KEY = 'bot-key';

const db = createFakeDb({ daily_metrics: [], tickets: [] });
const calls = { ai: 0, tickets: [] };
mockModule('config/db.js', db);
mockModule('ai/htmlInsights.js', { analyzeAndStore: async () => { calls.ai++; } });
mockModule('services/DailyTicketService.js', {
  ensureDailyTicket: async (storeId) => { calls.tickets.push(storeId); return { created: true }; }
});
const metricsRouter = require('../src/routes/metrics');

let base;
let server;
test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/metrics', metricsRouter);
  app.post('/api/ingest', (req, res) => metricsRouter.ingestHandler(req, res));
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const post = (path, body, key = 'bot-key') => fetch(base + path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}) },
  body: JSON.stringify(body)
});

test('ingesta sin API key → 401', async () => {
  const r = await post('/api/metrics/ingest', { store_id: 's1' }, null);
  assert.strictEqual(r.status, 401);
});

test('ingesta sin store_id → 400', async () => {
  const r = await post('/api/metrics/ingest', { load_ms: 1 });
  assert.strictEqual(r.status, 400);
});

test('ingesta válida: guarda la métrica y pide el ticket diario de esa tienda', async () => {
  const r = await post('/api/metrics/ingest', { store_id: 's1', date: '2026-11-10T14:00:00.000Z', load_ms: 1500 });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(db.tables.daily_metrics.length, 1);
  assert.strictEqual(db.tables.daily_metrics[0].load_ms, 1500);
  await new Promise((res) => setImmediate(res));
  assert.deepStrictEqual(calls.tickets, ['s1']);
});

test('misma tienda y misma corrida (segundo bot o reintento) → se ignora, sin duplicar', async () => {
  const r = await post('/api/metrics/ingest', { store_id: 's1', date: '2026-11-10T14:00:05.000Z', load_ms: 1600 });
  const body = await r.json();
  assert.strictEqual(r.status, 200);
  assert.strictEqual(body.duplicate, true);
  assert.strictEqual(db.tables.daily_metrics.length, 1);
});

test('la ruta antigua /api/ingest usa la misma lógica', async () => {
  const r = await post('/api/ingest', { store_id: 's2', date: '2026-11-10T14:00:00.000Z', load_ms: 900 });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(db.tables.daily_metrics.filter((m) => m.store_id === 's2').length, 1);
});
