const test = require('node:test');
const assert = require('node:assert');
const { createFakeDb, mockModule, resetSrcCache } = require('./helpers/fakeDb');

process.env.JWT_SECRET = 'x';
process.env.API_KEY = 'k';

// Simula el MAX() del número de ticket leyendo la tabla en memoria
function serialRaw(sql, bindings, tables) {
  if (!sql.includes('MAX(')) return { rows: [] };
  const prefix = bindings[0].replace('%', '');
  const nums = (tables.tickets || [])
    .filter((t) => String(t.serial_number || '').startsWith(prefix))
    .map((t) => parseInt(t.serial_number.split('-')[2], 10));
  return { rows: [{ n: nums.length ? Math.max(...nums) : null }] };
}

function load(initial = {}) {
  resetSrcCache();
  const db = createFakeDb(initial, { onRaw: serialRaw });
  const hubCalls = [];
  mockModule('config/db.js', db);
  mockModule('services/HubSyncService.js', { registrarTicketEnHub: async (t) => { hubCalls.push(t.serial_number); } });
  const TicketRepository = require('../src/repositories/TicketRepository');
  const DailyTicketService = require('../src/services/DailyTicketService');
  const MetricsRepository = require('../src/repositories/MetricsRepository');
  return { db, hubCalls, TicketRepository, DailyTicketService, MetricsRepository };
}

const year = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric' }).format(new Date());

test('número de ticket: toma el mayor existente (no el último por fecha) y bloquea antes de leer', async () => {
  const { db, TicketRepository } = load({
    stores: [{ id: 's1', ticket_count: 0 }],
    tickets: [{ id: 1, serial_number: `SOP-${year}-0041` }, { id: 2, serial_number: `SOP-${year}-0007` }]
  });
  const t = await TicketRepository.create({ name: 'x', store_id: 's1', task_type: 'TASK_INTERNA' });
  assert.strictEqual(t.serial_number, `SOP-${year}-0042`);
  assert.match(db.log.raw[0].sql, /pg_advisory_xact_lock/);
  assert.strictEqual(db.tables.stores[0].ticket_count, 1);
});

test('número de ticket: B2C usa prefijo HUB con su propia numeración', async () => {
  const { TicketRepository } = load({ tickets: [{ id: 1, serial_number: `SOP-${year}-0010` }] });
  const t = await TicketRepository.create({ name: 'x', store_id: 's1', is_b2c: true });
  assert.strictEqual(t.serial_number, `HUB-${year}-0001`);
});

test('estado al crear: se respeta si es válido, si no queda OPEN; cerrado llena closed_at', async () => {
  const { TicketRepository } = load();
  const cerrado = await TicketRepository.create({ name: 'x', store_id: 's1', status: 'CLOSED' });
  assert.strictEqual(cerrado.status, 'CLOSED');
  assert.strictEqual(cerrado.closed_at, 'NOW()');
  const raro = await TicketRepository.create({ name: 'x', store_id: 's1', status: 'loquesea' });
  assert.strictEqual(raro.status, 'OPEN');
  assert.strictEqual(raro.closed_at, undefined);
});

test('sin tienda, el ticket va al buzón central y se envía una sola vez al Hub', async () => {
  const { TicketRepository, hubCalls } = load();
  const t = await TicketRepository.create({ name: 'x' });
  assert.strictEqual(t.store_id, 'enova.agency');
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(hubCalls.length, 1);
});

test('ticket diario: uno por tienda y día aunque lleguen ingestas a la vez', async () => {
  const { db, DailyTicketService } = load();
  const resultados = await Promise.all([
    DailyTicketService.ensureDailyTicket('s1', { load_ms: 1000 }, 'BOT'),
    DailyTicketService.ensureDailyTicket('s1', { load_ms: 1100 }, 'BOT'),
    DailyTicketService.ensureDailyTicket('s2', { load_ms: 900 }, 'BOT')
  ]);
  assert.deepStrictEqual(resultados.map((r) => r.created), [true, false, true]);
  assert.strictEqual(db.tables.tickets.filter((t) => t.store_id === 's1').length, 1);
  const segundo = await DailyTicketService.ensureDailyTicket('s1', {}, 'BOT');
  assert.strictEqual(segundo.created, false);
});

test('ticket diario: avisa en la descripción si los datos no fueron medidos en vivo', async () => {
  const { DailyTicketService } = load();
  const { ticket } = await DailyTicketService.ensureDailyTicket('s1', { load_ms: 1, data_source: 'CARRIED_OVER' }, 'BOT');
  assert.match(ticket.description, /CARRIED_OVER/);
});

test('createBulk (CSV): omite filas sin tienda y convierte segundos a milisegundos', async () => {
  const { db, MetricsRepository } = load();
  const r = await MetricsRepository.createBulk([
    { store_id: 's1', load_ms: '1200' },
    { load_ms: 5 },
    { store_id: 's2', load_s: '2.5' }
  ]);
  assert.deepStrictEqual(r, { inserted: 2, skipped: 1 });
  assert.deepStrictEqual(db.tables.daily_metrics.map((m) => m.load_ms), [1200, 2500]);
});

test('clonar ticket: uno independiente por tienda, con su número y referencia al original', async () => {
  const { db, TicketRepository, hubCalls } = load({
    stores: [
      { id: 'kuna-pe', name: 'Kuna Perú', ticket_count: 0 }, { id: 'kuna-cl', name: 'Kuna Chile', ticket_count: 0 },
      { id: 'kuna-ww', name: 'Kuna WW', ticket_count: 0 }, { id: 'kuna-us', name: 'Kuna USA', ticket_count: 0 }
    ],
    tickets: [{
      id: 1, serial_number: `SOP-${year}-0010`, name: 'Cambiar banner de Navidad', store_id: 'kuna-pe',
      description: 'Subir banner nuevo [GMAIL_ID: abc]', priority: 'HIGH', task_type: 'CAMBIO',
      assigned_to: 'Ana, Luis', status: 'IN_PROGRESS'
    }]
  });
  const { created, skipped } = await TicketRepository.cloneToStores(1, ['kuna-cl', 'kuna-ww', 'kuna-us', 'kuna-pe', 'no-existe', 'kuna-cl']);

  assert.deepStrictEqual(created.map((t) => t.store_id), ['kuna-cl', 'kuna-ww', 'kuna-us']);
  assert.deepStrictEqual(created.map((t) => t.serial_number), [`SOP-${year}-0010A`, `SOP-${year}-0010B`, `SOP-${year}-0010C`]);
  for (const t of created) {
    assert.strictEqual(t.name, 'Cambiar banner de Navidad');
    assert.strictEqual(t.status, 'OPEN');
    assert.strictEqual(t.priority, 'HIGH');
    assert.strictEqual(t.task_type, 'CAMBIO');
    assert.strictEqual(t.assigned_to, 'Ana, Luis');
    assert.ok(t.description.includes(`Clonado de SOP-${year}-0010 (Kuna Perú)`), t.description);
    assert.ok(!t.description.includes('GMAIL_ID'), 'las copias no se enlazan al mismo correo');
  }
  assert.deepStrictEqual(skipped.map((s) => s.store_id), ['kuna-pe', 'no-existe']);
  assert.strictEqual(db.tables.stores.find((s) => s.id === 'kuna-cl').ticket_count, 1);
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(hubCalls.length, 3);
});

test('clonar otra vez (o desde una copia) sigue la misma serie de letras; los tickets nuevos no se saltan números', async () => {
  const { TicketRepository } = load({
    stores: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
    tickets: [
      { id: 1, serial_number: `SOP-${year}-2008`, name: 'Pedido', store_id: 'a' },
      { id: 2, serial_number: `SOP-${year}-2008A`, name: 'Pedido', store_id: 'b' }
    ]
  });
  const r1 = await TicketRepository.cloneToStores(1, ['c']);
  assert.deepStrictEqual(r1.created.map((t) => t.serial_number), [`SOP-${year}-2008B`]);
  const r2 = await TicketRepository.cloneToStores(2, ['d']); // desde la copia A
  assert.deepStrictEqual(r2.created.map((t) => t.serial_number), [`SOP-${year}-2008C`]);
  const nuevo = await TicketRepository.create({ name: 'otro', store_id: 'a' });
  assert.strictEqual(nuevo.serial_number, `SOP-${year}-2009`);
});

test('el cuerpo de la petición no puede elegir el número de ticket', async () => {
  const { TicketRepository } = load({ tickets: [{ id: 1, serial_number: `SOP-${year}-0005` }] });
  const t = await TicketRepository.create({ name: 'x', store_id: 's', serial_number: 'SOP-HACK-0001' });
  assert.strictEqual(t.serial_number, `SOP-${year}-0006`);
});

test('clonar ticket inexistente → error 404', async () => {
  const { TicketRepository } = load();
  await assert.rejects(() => TicketRepository.cloneToStores(999, ['x']), (e) => e.status === 404);
});
