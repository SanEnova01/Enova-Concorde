// Prueba el circuito completo IA ↔ herramientas con el modelo simulado del SDK (sin gastar IA real)
const test = require('node:test');
const assert = require('node:assert');
const { createFakeDb, mockModule } = require('./helpers/fakeDb');

process.env.JWT_SECRET = 'x';
process.env.API_KEY = 'k';
process.env.AI_GATEWAY_API_KEY = 'test'; // hasAiKey() = true; el modelo real nunca se llama

const db = createFakeDb({
  app_settings: [],
  audit_logs: [],
  ai_usage_logs: [],
  system_alerts: [{ id: 1, store_id: 'barker', alert_type: 'TTFB', message: 'Servidor lento', resolved_at: null }],
  stores: [
    { id: 'barker', name: 'Barker', emails: 'ana@barker.pe, ops@barker.pe', phone: '999', plan_type: 'growth', password: 'NO-DEBE-SALIR' },
    { id: 'kuna', name: 'Kuna Chile', emails: 'hola@kuna.cl', plan_type: 'go' }
  ],
  tickets: [
    { id: 5, serial_number: 'SOP-2026-0042', name: 'Checkout caído', status: 'OPEN', store_id: 'barker', description: 'Detalle [GMAIL_ID: abc123] del problema', created_at: '2026-11-10' },
    { id: 6, serial_number: 'SOP-2026-0043', name: 'Banner', status: 'CLOSED', store_id: 'barker', created_at: '2026-11-09' }
  ],
  daily_metrics: []
});
mockModule('config/db.js', db);

const { HANDLERS, clean } = require('../src/services/PetTools');
const PetService = require('../src/services/PetService');

const user = { id: 1, name: 'Ana', email: 'ana@enova', role: 'admin' };

test('buscar_tienda devuelve contactos y nunca columnas no permitidas', async () => {
  const r = await HANDLERS.buscar_tienda({ texto: 'bark' });
  assert.strictEqual(r.tiendas.length, 1);
  assert.strictEqual(r.tiendas[0].emails, 'ana@barker.pe, ops@barker.pe');
  assert.strictEqual(r.tiendas[0].password, undefined);
});

test('ver_ticket: por número completo o corto, sin la marca de Gmail', async () => {
  const a = await HANDLERS.ver_ticket({ numero: 'SOP-2026-0042' });
  assert.strictEqual(a.ticket.name, 'Checkout caído');
  assert.ok(!a.ticket.description.includes('GMAIL_ID'));
  const b = await HANDLERS.ver_ticket({ numero: '42' });
  assert.strictEqual(b.ticket.serial_number, 'SOP-2026-0042');
  const c = await HANDLERS.ver_ticket({ numero: 'SOP-1999-9999' });
  assert.match(c.resultado, /No existe/);
});

test('tickets_de_tienda: por defecto solo abiertos; alertas sin atender', async () => {
  const t = await HANDLERS.tickets_de_tienda({ tienda: 'Barker' });
  assert.deepStrictEqual(t.tickets.map((x) => x.serial_number), ['SOP-2026-0042']);
  const todos = await HANDLERS.tickets_de_tienda({ tienda: 'barker', solo_abiertos: false });
  assert.strictEqual(todos.tickets.length, 2);
  const al = await HANDLERS.alertas_tienda({ tienda: 'barker' });
  assert.strictEqual(al.alertas_sin_atender[0].message, 'Servidor lento');
});

test('el texto de búsqueda no puede usar comodines SQL', () => {
  assert.strictEqual(clean('%_\\barker%'), 'barker');
  assert.strictEqual(clean('x'.repeat(200)).length, 60);
});

test('chat: la IA consulta la base con una herramienta y responde con el dato (queda auditado)', async () => {
  const { MockLanguageModelV4 } = await import('ai/test');
  let call = 0;
  const usage = { inputTokens: { total: 10, noCache: 10 }, outputTokens: { total: 5, text: 5 } };
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      call++;
      if (call === 1) {
        return {
          content: [{ type: 'tool-call', toolCallId: 't1', toolName: 'buscar_tienda', input: JSON.stringify({ texto: 'Barker' }) }],
          finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage, warnings: []
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ reply: 'Los correos de Barker son ana@barker.pe y ops@barker.pe', mood: 'talking', action: 'none' }) }],
        finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: []
      };
    }
  });

  const r = await PetService.talk({ user, message: 'dame los correos de contacto de Barker', mode: 'chat', languageModel: model });
  assert.strictEqual(r.source, 'ai', JSON.stringify(r));
  assert.match(r.reply, /ana@barker\.pe/);
  assert.deepStrictEqual(r.consultas, ['buscar_tienda']);
  await new Promise((res) => setImmediate(res));
  const audit = db.tables.audit_logs.find((a) => a.action === 'MASCOTA_CONSULTA');
  assert.ok(audit, 'la consulta debe quedar en audit_logs');
  assert.match(audit.details, /buscar_tienda/);
  assert.strictEqual(audit.user_email, 'ana@enova');
});
