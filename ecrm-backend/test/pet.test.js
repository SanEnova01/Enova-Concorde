const test = require('node:test');
const assert = require('node:assert');
const { createFakeDb, mockModule } = require('./helpers/fakeDb');

process.env.JWT_SECRET = 'x';
process.env.API_KEY = 'k';

const db = createFakeDb({ app_settings: [], tickets: [], system_alerts: [] });
const aiCalls = [];
let aiResponse = { reply: 'Hola equipo, todo en orden ✈️', mood: 'celebrate', action: 'none' };
let aiFails = false;
mockModule('config/db.js', db);
mockModule('ai/models.js', {
  hasAiKey: () => true,
  generateJSON: async (opts) => {
    aiCalls.push(opts);
    if (aiFails) throw new Error('429 rate limit');
    return { data: opts.validate(aiResponse) };
  }
});
const SettingsService = require('../src/services/SettingsService');
const PetService = require('../src/services/PetService');

const user = { id: 7, name: 'Ana Pérez', email: 'ana@enova', role: 'admin' };
const setSetting = async (key, value) => { await SettingsService.set(key, value, 'test'); };

test('configuración por defecto: mascota e IA encendidas con todas las acciones', async () => {
  const cfg = await PetService.getConfig();
  assert.strictEqual(cfg.enabled, true);
  assert.strictEqual(cfg.ai_enabled, true);
  assert.deepStrictEqual(cfg.actions, { alerts: true, walk: true, games: true, chat: true });
});

test('ajustes: valida tipos, opciones y rangos', async () => {
  await assert.rejects(() => SettingsService.set('pet_ai_model', 'modelo/inventado', 't'), /Opción no válida/);
  await assert.rejects(() => SettingsService.set('pet_ai_daily_limit', 9999, 't'), /máximo/i);
  await assert.rejects(() => SettingsService.set('pet_custom_instructions', 'x'.repeat(601), 't'), /600/);
  await assert.rejects(() => SettingsService.set('pet_enabled', 'si', 't'), /true o false/);
  assert.strictEqual(await SettingsService.set('pet_proactive_minutes', '15', 't'), 15);
});

test('chat con IA: usa el modelo y la personalidad de Configuración y los datos reales', async () => {
  await setSetting('pet_ai_model', 'anthropic/claude-haiku-5.5');
  await setSetting('pet_personality', 'profesional');
  await setSetting('pet_custom_instructions', 'Habla como piloto');
  const r = await PetService.talk({ user, message: '¿cómo vamos?', mode: 'chat' });
  assert.strictEqual(r.source, 'ai');
  assert.strictEqual(r.mood, 'celebrate');
  const call = aiCalls.at(-1);
  assert.strictEqual(call.model, 'anthropic/claude-haiku-5.5');
  assert.match(call.system, /profesional/);
  assert.match(call.system, /Habla como piloto/);
  assert.match(call.prompt, /tickets_abiertos/);
  assert.match(call.prompt, /¿cómo vamos\?/);
});

test('respuesta de la IA fuera de formato se corrige (mood/acción desconocidos, texto largo)', () => {
  const r = PetService.validateReply({ reply: 'x'.repeat(500), mood: 'enojado', action: 'borrar_todo' });
  assert.strictEqual(r.reply.length, 260);
  assert.strictEqual(r.mood, 'talking');
  assert.strictEqual(r.action, 'none');
  assert.throws(() => PetService.validateReply({ reply: '  ' }));
});

test('si la IA falla, responde con frases fijas en vez de romperse', async () => {
  aiFails = true;
  const r = await PetService.talk({ user, message: 'hola', mode: 'chat' });
  aiFails = false;
  assert.strictEqual(r.source, 'fallback');
  assert.ok(r.reply.length > 0);
});

test('IA apagada en Configuración: no llama a la IA', async () => {
  await setSetting('pet_ai_enabled', false);
  const antes = aiCalls.length;
  const r = await PetService.talk({ user, message: 'hola', mode: 'chat' });
  assert.strictEqual(r.source, 'fallback');
  assert.strictEqual(aiCalls.length, antes);
  await setSetting('pet_ai_enabled', true);
});

test('límite diario por persona: al llegar al tope deja de usar IA', async () => {
  await setSetting('pet_ai_daily_limit', 2);
  PetService._usage.clear();
  const otro = { id: 99, name: 'Luis' };
  const a = await PetService.talk({ user: otro, message: '1' });
  const b = await PetService.talk({ user: otro, message: '2' });
  const c = await PetService.talk({ user: otro, message: '3' });
  assert.deepStrictEqual([a.source, b.source, c.source], ['ai', 'ai', 'fallback']);
  assert.strictEqual(c.limit_reached, true);
});

test('chat desactivado o mascota apagada → error claro', async () => {
  await setSetting('pet_action_chat', false);
  assert.strictEqual((await PetService.talk({ user, message: 'hola', mode: 'chat' })).status, 403);
  await setSetting('pet_action_chat', true);
  await setSetting('pet_enabled', false);
  assert.strictEqual((await PetService.talk({ user, message: '', mode: 'tip' })).status, 403);
  await setSetting('pet_enabled', true);
  assert.strictEqual((await PetService.talk({ user, message: '   ', mode: 'chat' })).status, 400);
});
