const test = require('node:test');
const assert = require('node:assert');

process.env.API_KEY = 'llave-nueva';
process.env.API_KEY_PREVIOUS = 'llave-anterior';
process.env.JWT_SECRET = 'secreto';
delete process.env.CORS_ORIGINS;

const security = require('../src/config/security');
const { isPublicHttpUrl } = require('../src/utils/urlSafety');

test('API key: acepta la actual y la anterior, rechaza vacías y las viejas del código', () => {
  assert.ok(security.isValidApiKey('llave-nueva'));
  assert.ok(security.isValidApiKey('llave-anterior'));
  assert.ok(!security.isValidApiKey(''));
  assert.ok(!security.isValidApiKey(undefined));
  assert.ok(!security.isValidApiKey('ENOVA_SECRET_API_KEY_2026'));
  assert.ok(!security.isValidApiKey('LLAVE_MAESTRA_SECRETA_DEL_CRM_2026'));
});

test('JWT_SECRET sale de la variable de entorno', () => {
  assert.strictEqual(security.JWT_SECRET, 'secreto');
});

test('CORS: solo dominios del CRM; sin Origin (servidor a servidor) se permite', () => {
  assert.ok(security.isAllowedOrigin('https://enova-concorde-2027.up.railway.app'));
  assert.ok(security.isAllowedOrigin('https://enova-concorde-2027.up.railway.app/'));
  assert.ok(security.isAllowedOrigin(undefined));
  assert.ok(!security.isAllowedOrigin('https://sitio-malicioso.com'));
});

test('Roles: admin y super admin son equipo; client no', () => {
  assert.ok(security.isStaffRole('Admin '));
  assert.ok(security.isStaffRole('super admin'));
  assert.ok(!security.isStaffRole('client'));
  assert.ok(!security.isStaffRole(undefined));
});

test('Proxy WooCommerce: bloquea direcciones internas (SSRF)', () => {
  assert.ok(isPublicHttpUrl('https://tienda.com'));
  const bloqueadas = [
    'http://localhost:3000', 'http://127.0.0.1', 'http://10.0.0.1', 'http://172.20.1.1',
    'http://192.168.1.1', 'http://169.254.169.254/latest', 'http://[::1]/', 'ftp://x.com',
    'http://bot.railway.internal', 'no-es-url'
  ];
  for (const url of bloqueadas) assert.ok(!isPublicHttpUrl(url), url);
});
