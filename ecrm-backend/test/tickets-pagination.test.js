const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { createFakeDb, mockModule, resetSrcCache } = require('./helpers/fakeDb');

process.env.JWT_SECRET = 'test-secret';
process.env.API_KEY = 'bot-key';

// 30 tickets de s1 (los pares cerrados), 5 de s2 y uno B2C sin asignar
const tickets = [];
for (let i = 1; i <= 30; i++) {
  tickets.push({
    id: i,
    serial_number: `SOP-2026-${String(i).padStart(4, '0')}`,
    name: i === 7 ? 'Error en el checkout' : `Tarea ${i}`,
    store_id: 's1',
    status: i % 2 === 0 ? 'CLOSED' : 'OPEN',
    assigned_to: i % 3 === 0 ? 'Ana Pérez' : (i % 3 === 1 ? 'Luis' : null),
    is_b2c: false,
    created_at: new Date(2026, 0, i).toISOString()
  });
}
for (let i = 31; i <= 35; i++) {
  tickets.push({ id: i, serial_number: `SOP-2026-${i}`, name: `Otra tienda ${i}`, store_id: 's2', status: 'OPEN', assigned_to: 'Zoe', is_b2c: false, created_at: new Date(2026, 1, i - 30).toISOString() });
}
tickets.push({ id: 36, serial_number: 'HUB-2026-0001', name: 'Consulta Hub', store_id: 's1', status: 'OPEN', assigned_to: '', is_b2c: true, created_at: new Date(2026, 2, 1).toISOString() });

let db;
let server;
let base;
let signToken;

test.before(async () => {
  resetSrcCache();
  db = createFakeDb({
    stores: [
      { id: 's1', emails: 'ana@x.com' },
      { id: 's2', emails: 'juana@x.com' }
    ],
    tickets
  });
  mockModule('config/db.js', db);
  mockModule('services/HubSyncService.js', { registrarTicketEnHub: async () => {} });
  const auth = require('../src/middleware/auth');
  signToken = auth.signToken;
  const app = express();
  app.use(express.json());
  app.use('/api/tickets', auth.verificarToken, require('../src/routes/tickets'));
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const bearer = (role, email) => ({ authorization: 'Bearer ' + signToken({ id: 1, name: 'u', email, role }) });
const admin = () => bearer('admin', 'a@enova');
const get = async (path, headers = admin()) => {
  const r = await fetch(base + '/api/tickets' + path, { headers });
  return { status: r.status, body: await r.json() };
};

test('sin parámetros: igual que antes, todos los tickets y sin bloque de paginación', async () => {
  const { status, body } = await get('');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.data.length, 36);
  assert.strictEqual(body.pagination, undefined);
});

test('page + limit: devuelve solo esa página y el total', async () => {
  const { body } = await get('?page=2&limit=10');
  assert.strictEqual(body.data.length, 10);
  assert.deepStrictEqual(body.pagination, { page: 2, limit: 10, total: 36, totalPages: 4 });
  // orden por defecto: más reciente primero (id 36 es el más nuevo; la página 2 empieza en el 11.º más nuevo)
  const ids = body.data.map((t) => t.id);
  const todos = (await get('?page=1&limit=100')).body.data.map((t) => t.id);
  assert.deepStrictEqual(ids, todos.slice(10, 20));
});

test('las páginas no se repiten ni se saltan tickets', async () => {
  const vistos = [];
  for (let p = 1; p <= 4; p++) vistos.push(...(await get(`?page=${p}&limit=10`)).body.data.map((t) => t.id));
  assert.strictEqual(new Set(vistos).size, 36);
});

test('limit se acota (máx. 100) y valores raros caen al valor por defecto', async () => {
  assert.strictEqual((await get('?page=1&limit=5000')).body.pagination.limit, 100);
  const raro = (await get('?page=abc&limit=-3')).body.pagination;
  assert.strictEqual(raro.page, 1);
  assert.strictEqual(raro.limit, 1);
  assert.strictEqual((await get('?limit=0')).body.pagination.limit, 20);
});

test('status=ACTIVE excluye cerrados y status=CLOSED solo los cerrados', async () => {
  const activos = (await get('?page=1&limit=100&status=ACTIVE')).body;
  assert.ok(activos.data.every((t) => t.status !== 'CLOSED'));
  assert.strictEqual(activos.pagination.total, 21); // 15 abiertos de s1 + 5 de s2 + 1 hub
  const cerrados = (await get('?page=1&limit=100&status=CLOSED')).body;
  assert.strictEqual(cerrados.pagination.total, 15);
});

test('store_id, is_b2c y assigned_to filtran en el servidor y se pueden combinar', async () => {
  assert.strictEqual((await get('?page=1&limit=100&store_id=s2')).body.pagination.total, 5);
  assert.strictEqual((await get('?page=1&limit=100&is_b2c=true')).body.pagination.total, 1);
  assert.strictEqual((await get('?page=1&limit=100&is_b2c=false')).body.pagination.total, 35);
  assert.strictEqual((await get('?page=1&limit=100&assigned_to=ana')).body.pagination.total, 10);
  // sin asignar: null y vacío
  const sin = (await get('?page=1&limit=100&assigned_to=__UNASSIGNED__')).body;
  assert.strictEqual(sin.pagination.total, 11); // 10 con null (i%3===2) + el del Hub con ''
  const mezcla = (await get('?page=1&limit=100&store_id=s1&status=ACTIVE&is_b2c=false')).body;
  assert.strictEqual(mezcla.pagination.total, 15);
});

test('search busca por serial, asunto o tienda sin distinguir mayúsculas', async () => {
  assert.strictEqual((await get('?page=1&limit=100&search=checkout')).body.data[0].id, 7);
  assert.strictEqual((await get('?page=1&limit=100&search=SOP-2026-0030')).body.pagination.total, 1);
  assert.strictEqual((await get('?page=1&limit=100&search=S2')).body.pagination.total, 5);
  // los comodines del usuario son texto literal
  assert.strictEqual((await get('?page=1&limit=100&search=%25')).body.pagination.total, 0);
});

test('sort + order: ordena toda la tabla antes de paginar; columnas no permitidas se ignoran', async () => {
  const asc = (await get('?page=1&limit=3&sort=created_at&order=asc')).body.data.map((t) => t.id);
  assert.deepStrictEqual(asc, [1, 2, 3]);
  const porNombre = (await get('?page=1&limit=1&sort=name&order=asc')).body.data[0].name;
  assert.strictEqual(porNombre, 'Consulta Hub');
  const raro = await get('?page=1&limit=1&sort=password;DROP&order=asc');
  assert.strictEqual(raro.status, 200);
});

test('fields=list sigue recortando la descripción en cada página', async () => {
  db.tables.tickets.find((t) => t.id === 36).description = 'x'.repeat(500) + ' [GMAIL_ID: abc123]';
  const { body } = await get('?page=1&limit=1&fields=list');
  assert.strictEqual(body.data[0].id, 36);
  assert.strictEqual(body.data[0].description_truncated, true);
  assert.match(body.data[0].description, /\[GMAIL_ID: abc123\]$/);
});

test('cliente: la paginación respeta sus tiendas (datos, total y páginas)', async () => {
  const ana = bearer('client', 'ana@x.com'); // solo s1: 31 tickets
  const p1 = (await get('?page=1&limit=10', ana)).body;
  assert.strictEqual(p1.pagination.total, 31);
  assert.strictEqual(p1.pagination.totalPages, 4);
  assert.ok(p1.data.every((t) => t.store_id === 's1'));
  const ultima = (await get('?page=4&limit=10', ana)).body;
  assert.strictEqual(ultima.data.length, 1);

  const juana = bearer('client', 'juana@x.com'); // solo s2: 5 tickets
  const j = (await get('?page=1&limit=10', juana)).body;
  assert.strictEqual(j.pagination.total, 5);
  assert.ok(j.data.every((t) => t.store_id === 's2'));
});

test('cliente: pedir la tienda de otro o filtrar por búsqueda no filtra datos ajenos', async () => {
  const ana = bearer('client', 'ana@x.com');
  const ajena = (await get('?page=1&limit=10&store_id=s2', ana)).body;
  assert.strictEqual(ajena.pagination.total, 0);
  assert.strictEqual(ajena.data.length, 0);
  const buscar = (await get('?page=1&limit=100&search=Otra%20tienda', ana)).body;
  assert.strictEqual(buscar.pagination.total, 0);
});

test('cliente sin tiendas: lista vacía, nunca todos los tickets', async () => {
  const nadie = bearer('client', 'nadie@x.com');
  const paginado = (await get('?page=1&limit=10', nadie)).body;
  assert.strictEqual(paginado.pagination.total, 0);
  assert.strictEqual(paginado.data.length, 0);
  const sinPaginar = (await get('', nadie)).body;
  assert.strictEqual(sinPaginar.data.length, 0);
});

test('cliente sin paginar: sigue viendo solo sus tickets', async () => {
  const juana = bearer('client', 'juana@x.com');
  const { body } = await get('', juana);
  assert.strictEqual(body.data.length, 5);
  assert.strictEqual(body.pagination, undefined);
});
