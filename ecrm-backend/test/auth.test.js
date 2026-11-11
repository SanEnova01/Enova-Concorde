const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const { createFakeDb, mockModule } = require('./helpers/fakeDb');

process.env.JWT_SECRET = 'test-secret';
process.env.API_KEY = 'bot-key';

const db = createFakeDb({
  stores: [
    { id: 's1', emails: 'ana@x.com, ops@x.com', web: 'https://s1.com' },
    { id: 's2', emails: 'juana@x.com', web: 'https://s2.com' }
  ],
  tickets: [{ id: 't1', store_id: 's1' }, { id: 't2', store_id: 's2' }],
  knowledge_base: [{ id: 'k1', store_id: 's1' }, { id: 'k2', store_id: 's2' }]
});
mockModule('config/db.js', db);
const { verificarToken, requireSuperAdmin, signToken } = require('../src/middleware/auth');

const tok = (role, email) => 'Bearer ' + signToken({ id: 1, name: 'u', email, role });
const ana = tok('client', 'ana@x.com');
const juana = tok('client', 'juana@x.com');
const admin = tok('admin', 'a@enova');

// Ejecuta el middleware y devuelve 'ALLOW', el código HTTP, o los ids filtrados si es un listado
async function run({ method = 'GET', url, auth, key, body = {}, query = {}, list }) {
  const req = { method, originalUrl: url, headers: {}, body, query };
  if (auth) req.headers.authorization = auth;
  if (key) req.headers['x-api-key'] = key;
  let status = 200;
  let out;
  let nexted = false;
  const res = { status(c) { status = c; return res; }, json(b) { out = b; return res; } };
  await verificarToken(req, res, () => { nexted = true; });
  if (!nexted) return { result: status, req };
  if (list) {
    res.json({ success: true, data: list });
    return { result: out.data.map((r) => r.id).join(','), req };
  }
  return { result: 'ALLOW', req };
}
const expect = async (opts, want) => assert.strictEqual((await run(opts)).result, want);

test('sin token → 401; token firmado con el secreto viejo → 403', async () => {
  await expect({ url: '/api/tickets' }, 401);
  const viejo = 'Bearer ' + jwt.sign({ role: 'super admin' }, 'LLAVE_MAESTRA_SECRETA_DEL_CRM_2026');
  await expect({ url: '/api/stores', auth: viejo }, 403);
});

test('API key: la actual entra, la vieja del código no', async () => {
  await expect({ url: '/api/stores', key: 'bot-key' }, 'ALLOW');
  await expect({ url: '/api/stores', key: 'ENOVA_SECRET_API_KEY_2026' }, 401);
});

test('admin entra a rutas de equipo; cliente y rol desconocido no', async () => {
  await expect({ url: '/api/users', auth: admin }, 'ALLOW');
  await expect({ url: '/api/users', auth: ana }, 403);
  await expect({ url: '/api/tickets', auth: tok('otro', 'z@z') }, 403);
});

test('cliente: listados filtrados a sus tiendas (correo exacto, no parecido)', async () => {
  await expect({ url: '/api/tickets', auth: ana, list: db.tables.tickets }, 't1');
  await expect({ url: '/api/tickets', auth: juana, list: db.tables.tickets }, 't2');
  await expect({ url: '/api/stores', auth: ana, list: db.tables.stores }, 's1');
});

test('cliente: solo sus tiendas, tickets, métricas y conocimiento', async () => {
  await expect({ url: '/api/stores/s1', auth: ana }, 'ALLOW');
  await expect({ url: '/api/stores/s2', auth: ana }, 403);
  await expect({ url: '/api/stores/cuentacliente', auth: ana }, 'ALLOW');
  await expect({ url: '/api/tickets/t1', auth: ana }, 'ALLOW');
  await expect({ url: '/api/tickets/t2', auth: ana }, 403);
  await expect({ url: '/api/tickets/t1/messages', auth: ana }, 'ALLOW');
  await expect({ url: '/api/tickets/t2/messages', auth: ana }, 403);
  await expect({ url: '/api/metrics/s1', auth: ana }, 'ALLOW');
  await expect({ url: '/api/metrics/aggregated', auth: ana, query: { store_id: 's2' } }, 403);
  await expect({ method: 'DELETE', url: '/api/knowledge/k2', auth: ana }, 403);
  await expect({ url: '/api/knowledge/cuentacliente', auth: ana }, 'ALLOW');
});

test('cliente: no puede editar tiendas, cambiar estados ni usar herramientas internas', async () => {
  await expect({ method: 'PATCH', url: '/api/stores/s1', auth: ana }, 403);
  await expect({ method: 'PATCH', url: '/api/tickets/t1/status', auth: ana }, 403);
  await expect({ method: 'POST', url: '/api/metrics/force-run', auth: ana }, 403);
  await expect({ url: '/api/metrics/bot-status', auth: ana }, 403);
  await expect({ url: '/api/settings', auth: ana }, 403);
});

test('cliente: crea tickets solo para su tienda; si no indica tienda se usa la suya', async () => {
  await expect({ method: 'POST', url: '/api/tickets', auth: ana, body: { store_id: 's2' } }, 403);
  const { result, req } = await run({ method: 'POST', url: '/api/tickets', auth: ana, body: {} });
  assert.strictEqual(result, 'ALLOW');
  assert.strictEqual(req.body.store_id, 's1');
});

test('cliente: el escaneo manual siempre usa la web registrada de su tienda', async () => {
  const { result, req } = await run({
    method: 'POST', url: '/api/metrics/run-single-client', auth: ana,
    body: { store_id: 's1', url: 'http://otro-sitio' }
  });
  assert.strictEqual(result, 'ALLOW');
  assert.strictEqual(req.body.url, 'https://s1.com');
});

test('403 por permiso trae code FORBIDDEN; token vencido trae SESSION_EXPIRED', async () => {
  let body;
  const res = { status() { return res; }, json(b) { body = b; return res; } };
  const req = (auth) => ({ method: 'GET', originalUrl: '/api/users', headers: { authorization: auth }, body: {}, query: {} });
  await verificarToken(req(ana), res, () => {});
  assert.strictEqual(body.code, 'FORBIDDEN');
  const vencido = 'Bearer ' + jwt.sign({ role: 'admin', exp: Math.floor(Date.now() / 1000) - 10 }, 'test-secret');
  await verificarToken(req(vencido), res, () => {});
  assert.strictEqual(body.code, 'SESSION_EXPIRED');
});

test('clonar tickets: solo el equipo (cliente bloqueado)', async () => {
  await expect({ method: 'POST', url: '/api/tickets/t1/clone', auth: ana, body: { store_ids: ['s2'] } }, 403);
  await expect({ method: 'POST', url: '/api/tickets/t1/clone', auth: admin, body: { store_ids: ['s2'] } }, 'ALLOW');
});

test('mascota (/api/pet): cliente bloqueado; admin pasa el guardián', async () => {
  await expect({ url: '/api/pet/config', auth: ana }, 403);
  await expect({ method: 'POST', url: '/api/pet/talk', auth: ana, body: { message: 'hola' } }, 403);
  await expect({ method: 'POST', url: '/api/pet/talk', auth: admin, body: { message: 'hola' } }, 'ALLOW');
});

test('requireStaff: solo admin y super admin (ni cliente ni API key sin usuario)', () => {
  const { requireStaff } = require('../src/middleware/auth');
  const check = (adminUser) => {
    let ok = false;
    requireStaff({ adminUser }, { status() { return this; }, json() {} }, () => { ok = true; });
    return ok;
  };
  assert.ok(check({ role: 'admin' }));
  assert.ok(check({ role: 'Super Admin' }));
  assert.ok(!check({ role: 'client' }));
  assert.ok(!check(undefined));
});

test('requireSuperAdmin: solo super admin', () => {
  const check = (adminUser) => {
    let ok = false;
    requireSuperAdmin({ adminUser }, { status() { return this; }, json() {} }, () => { ok = true; });
    return ok;
  };
  assert.ok(check({ role: 'super admin' }));
  assert.ok(!check({ role: 'admin' }));
  assert.ok(!check({ role: 'client' }));
  assert.ok(!check(undefined));
});
