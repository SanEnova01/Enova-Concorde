const db = require('../config/db');

const HAIKU = 'anthropic/claude-haiku-5.5';
const LUNA = 'openai/gpt-6-luna';
const DEEPSEEK_FLASH = 'deepseek/deepseek-v4-flash';
const DEEPSEEK_PRO = 'deepseek/deepseek-v4-pro';

const PRICING = {
  [HAIKU]: { in: 0.10, out: 0.50 },
  [LUNA]: { in: 0.10, out: 0.50 },
  [DEEPSEEK_FLASH]: { in: 0.15, out: 0.60 },
  [DEEPSEEK_PRO]: { in: 0.66, out: 1.98 },
  'openai/gpt-4o-mini': { in: 0.15, out: 0.60 }
};

const TASKS = {
  tickets: {
    primary: process.env.AI_MODEL_TICKETS || HAIKU,
    fallback: process.env.AI_MODEL_TICKETS_FALLBACK || LUNA,
    maxOutputTokens: 2500
  },
  html_insights: {
    primary: process.env.AI_MODEL_HTML_INSIGHTS || HAIKU,
    fallback: process.env.AI_MODEL_HTML_INSIGHTS_FALLBACK || LUNA,
    maxOutputTokens: 1500
  },
  dashboard: {
    primary: process.env.AI_MODEL_DASHBOARD || LUNA,
    fallback: process.env.AI_MODEL_DASHBOARD_FALLBACK || HAIKU,
    maxOutputTokens: 500
  }
};

function priceFor(modelId) {
  const envKey = modelId.replace(/[^a-z0-9]+/gi, '_').toUpperCase();
  const envIn = parseFloat(process.env[`AI_PRICE_${envKey}_IN`]);
  const envOut = parseFloat(process.env[`AI_PRICE_${envKey}_OUT`]);
  const base = PRICING[modelId] || { in: 0, out: 0 };
  return {
    in: Number.isFinite(envIn) ? envIn : base.in,
    out: Number.isFinite(envOut) ? envOut : base.out
  };
}

function normalizeUsage(usage) {
  const input = Number(usage?.inputTokens ?? usage?.promptTokens ?? 0) || 0;
  const output = Number(usage?.outputTokens ?? usage?.completionTokens ?? 0) || 0;
  const total = Number(usage?.totalTokens ?? input + output) || input + output;
  return { input, output, total };
}

function estimateCostUsd(modelId, usage) {
  const p = priceFor(modelId);
  return (usage.input / 1e6) * p.in + (usage.output / 1e6) * p.out;
}

function extractJson(text) {
  if (!text) throw new Error('Respuesta vacía del modelo');
  const cleaned = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  const start = cleaned.indexOf('{');
  if (start === -1) throw new Error('No se encontró un objeto JSON en la respuesta');

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
    }
  }
  throw new Error('JSON incompleto en la respuesta del modelo');
}

function isRetryable(err) {
  const msg = String(err?.message || err);
  return /429|rate limit|timeout|timed out|ECONNRESET|5\d\d|overloaded|temporar/i.test(msg);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let providerPromise = null;

async function getProvider() {
  if (providerPromise) return providerPromise;
  providerPromise = (async () => {
    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    const { createOpenAI } = await import('@ai-sdk/openai');
    return createOpenAI({
      baseURL: process.env.AI_GATEWAY_URL || 'https://ai-gateway.vercel.sh/v1',
      apiKey
    });
  })();
  return providerPromise;
}

function hasAiKey() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY);
}

async function logUsage(moduleName, modelId, usage) {
  try {
    await db('ai_usage_logs').insert({
      module: moduleName,
      prompt_tokens: usage.input,
      completion_tokens: usage.output,
      total_tokens: usage.total,
      cost_usd: estimateCostUsd(modelId, usage),
      created_at: new Date()
    });
  } catch (e) {
    console.warn('⚠️ No se pudo registrar log de IA:', e.message);
  }
}

async function generateJSON({ task, system, prompt, module: moduleName, validate }) {
  const cfg = TASKS[task];
  if (!cfg) throw new Error(`Tarea de IA desconocida: ${task}`);

  const provider = await getProvider();
  if (!provider) throw new Error('NO_AI_KEY');

  const { generateText } = await import('ai');
  const chain = [cfg.primary, cfg.fallback].filter((m, i, a) => m && a.indexOf(m) === i);
  let lastError = null;

  for (const modelId of chain) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const model = typeof provider.chat === 'function' ? provider.chat(modelId) : provider(modelId);
        const { text, usage } = await generateText({
          model,
          system,
          prompt,
          maxOutputTokens: cfg.maxOutputTokens
        });

        const u = normalizeUsage(usage);
        let data = extractJson(text);
        if (validate) data = validate(data);

        await logUsage(moduleName || task.toUpperCase(), modelId, u);
        const costUsd = estimateCostUsd(modelId, u);
        console.log(
          `🤖 [AI:${task}] ${modelId} | in ${u.input} out ${u.output} | $${costUsd.toFixed(6)}` +
          (modelId !== cfg.primary ? ' (FALLBACK)' : '')
        );
        return { data, model: modelId, usage: u, costUsd };
      } catch (err) {
        lastError = err;
        const parseProblem = /JSON|vacía|inválid/i.test(err.message);
        console.warn(`⚠️ [AI:${task}] ${modelId} intento ${attempt} falló: ${err.message}`);
        if (attempt === 1 && (isRetryable(err) || parseProblem)) {
          await sleep(1500);
          continue;
        }
        break;
      }
    }
  }

  throw lastError || new Error('Todos los modelos de IA fallaron');
}

module.exports = {
  generateJSON,
  extractJson,
  normalizeUsage,
  estimateCostUsd,
  hasAiKey,
  TASKS,
  MODELS: { HAIKU, LUNA, DEEPSEEK_FLASH, DEEPSEEK_PRO }
};
