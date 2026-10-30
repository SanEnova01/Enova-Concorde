const db = require('../config/db');
const MetricsRepository = require('../repositories/MetricsRepository');
const { generateJSON, hasAiKey } = require('./models');
const { normalizeTech, techLabel, isSaas, constraintText, playbookText } = require('./playbooks');

const CATEGORY_RULES = [
  ['analytics', ['google-analytics.com', 'googletagmanager.com', 'analytics.google.com', 'hotjar', 'clarity.ms', 'mixpanel', 'segment.com', 'segment.io', 'amplitude', 'plausible', 'matomo', 'fullstory', 'mouseflow', 'luckyorange']],
  ['ads_pixels', ['facebook.net', 'facebook.com', 'doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 'analytics.tiktok.com', 'tiktok.com', 'snap.licdn.com', 'ads-twitter.com', 'ct.pinterest.com', 'criteo', 'taboola', 'outbrain', 'bat.bing.com', 'adroll']],
  ['chat_support', ['tawk.to', 'intercom', 'crisp.chat', 'zdassets.com', 'zendesk', 'livechatinc', 'tidio', 'drift.com', 'respond.io', 'gupshup']],
  ['payments', ['stripe.com', 'paypal.com', 'paypalobjects.com', 'mercadopago', 'mlstatic.com', 'culqi.com', 'izipay', 'vnforapps.com', 'payu', 'wompi', 'openpay', 'addi.com', 'kushki', 'pagoefectivo']],
  ['marketing_reviews', ['klaviyo', 'mailchimp', 'chimpstatic', 'hubspot', 'hs-scripts', 'hsforms', 'omnisend', 'privy', 'sendinblue', 'brevo', 'judge.me', 'yotpo', 'stamped.io', 'trustpilot', 'loox']],
  ['platform_cdn', ['cdn.shopify.com', 'shopify.com', 'shopifycdn', 'myshopify.com', 'wp.com', 'wordpress.com', 's.w.org', 'vtex.com', 'vteximg', 'vtexassets', 'vtexcommercestable', 'cloudflare', 'cloudfront.net', 'jsdelivr', 'unpkg.com', 'cdnjs', 'jquery.com', 'bootstrapcdn', 'akamai']],
  ['fonts_media', ['fonts.googleapis.com', 'fonts.gstatic.com', 'typekit', 'fontawesome', 'youtube.com', 'youtube-nocookie.com', 'ytimg.com', 'vimeo']],
  ['security_antispam', ['recaptcha', 'hcaptcha.com', 'challenges.cloudflare.com']],
  ['maps_embeds', ['maps.googleapis.com', 'maps.google.com']]
];

function classifyDomain(host) {
  const h = String(host || '').toLowerCase();
  for (const [category, needles] of CATEGORY_RULES) {
    if (needles.some((n) => h.includes(n))) return category;
  }
  return 'unknown';
}

function parseSnapshot(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  return raw;
}

function hostOf(url) {
  try {
    const u = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {
    return '';
  }
}

function isFirstParty(host, ownHost) {
  if (!ownHost) return false;
  const h = host.replace(/^www\./, '');
  return h === ownHost || h.endsWith(`.${ownHost}`);
}

function pct(now, before) {
  const a = Number(before) || 0;
  const b = Number(now) || 0;
  if (a === 0) return null;
  return Math.round(((b - a) / a) * 1000) / 10;
}

function listDiff(prevList, currList) {
  const prev = new Set(prevList || []);
  const curr = new Set(currList || []);
  return {
    added: [...curr].filter((x) => !prev.has(x)),
    removed: [...prev].filter((x) => !curr.has(x))
  };
}

function diffSnapshots(prev, curr, ownHost) {
  const domains = listDiff(
    (prev.external_domains || []).filter((d) => !isFirstParty(d, ownHost)),
    (curr.external_domains || []).filter((d) => !isFirstParty(d, ownHost))
  );

  const addedByCategory = {};
  domains.added.forEach((d) => {
    const c = classifyDomain(d);
    (addedByCategory[c] = addedByCategory[c] || []).push(d);
  });

  const hasPluginData = Array.isArray(prev.plugins) && Array.isArray(curr.plugins);
  const hasAppData = Array.isArray(prev.apps) && Array.isArray(curr.apps);
  const plugins = hasPluginData ? listDiff(prev.plugins, curr.plugins) : { added: [], removed: [] };
  const apps = hasAppData ? listDiff(prev.apps, curr.apps) : { added: [], removed: [] };

  return {
    nodes_prev: prev.total_dom_nodes,
    nodes_now: curr.total_dom_nodes,
    nodes_pct: pct(curr.total_dom_nodes, prev.total_dom_nodes),
    scripts_prev: prev.total_scripts,
    scripts_now: curr.total_scripts,
    scripts_delta: (Number(curr.total_scripts) || 0) - (Number(prev.total_scripts) || 0),
    scripts_pct: pct(curr.total_scripts, prev.total_scripts),
    new_domains: domains.added,
    removed_domains: domains.removed,
    new_domains_by_category: addedByCategory,
    unknown_new_domains: addedByCategory.unknown || [],
    new_plugins: plugins.added,
    removed_plugins: plugins.removed,
    new_apps: apps.added,
    removed_apps: apps.removed,
    theme_changed: prev.theme !== undefined && curr.theme !== undefined && prev.theme !== curr.theme && Boolean(prev.theme || curr.theme),
    theme_prev: prev.theme || null,
    theme_now: curr.theme || null,
    tech_changed: Boolean(prev.tech) && Boolean(curr.tech) && prev.tech !== curr.tech,
    blocking_scripts_delta: (Number(curr.blocking_scripts) || 0) - (Number(prev.blocking_scripts) || 0),
    errors_now: Number(curr.error_elements) || 0
  };
}

function perfDiff(prevRow, curr) {
  const prev = prevRow || {};
  return {
    load_ms: { prev: prev.load_ms ?? null, now: curr.load_ms ?? null, pct: pct(curr.load_ms, prev.load_ms) },
    ttfb_ms: { prev: prev.ttfb_ms ?? null, now: curr.ttfb_ms ?? null, pct: pct(curr.ttfb_ms, prev.ttfb_ms) },
    weight_mb: { prev: prev.total_weight_mb ?? null, now: curr.total_weight_mb ?? null, pct: pct(curr.total_weight_mb, prev.total_weight_mb) },
    requests: { prev: prev.total_requests ?? null, now: curr.total_requests ?? null, pct: pct(curr.total_requests, prev.total_requests) }
  };
}

function hasSignal(diff, perf) {
  const loadGrew = perf.load_ms.pct !== null && perf.load_ms.pct >= 40 && (perf.load_ms.now - perf.load_ms.prev) >= 1000;
  const weightGrew = perf.weight_mb.pct !== null && perf.weight_mb.pct >= 30 && (perf.weight_mb.now - perf.weight_mb.prev) >= 0.5;
  const requestsGrew = perf.requests.pct !== null && perf.requests.pct >= 30 && (perf.requests.now - perf.requests.prev) >= 15;
  const ttfbGrew = perf.ttfb_ms.pct !== null && perf.ttfb_ms.pct >= 60 && (perf.ttfb_ms.now - perf.ttfb_ms.prev) >= 400;

  return (
    (diff.nodes_pct !== null && Math.abs(diff.nodes_pct) >= 25) ||
    diff.scripts_delta >= 5 ||
    (diff.scripts_pct !== null && diff.scripts_pct >= 20) ||
    diff.unknown_new_domains.length > 0 ||
    diff.new_domains.length >= 3 ||
    diff.new_plugins.length > 0 ||
    diff.removed_plugins.length > 0 ||
    diff.new_apps.length > 0 ||
    diff.removed_apps.length > 0 ||
    diff.theme_changed ||
    diff.tech_changed ||
    diff.errors_now > 0 ||
    diff.blocking_scripts_delta >= 3 ||
    loadGrew || weightGrew || requestsGrew || ttfbGrew
  );
}

function severityFloor(diff) {
  if (diff.nodes_pct !== null && diff.nodes_pct <= -50) return 'CRITICAL';
  if (diff.unknown_new_domains.length >= 3) return 'WARNING';
  return 'INFO';
}

const SEVERITY_ORDER = { INFO: 0, WARNING: 1, CRITICAL: 2 };

function maxSeverity(a, b) {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

function buildPrompt({ store, techKey, prevSnap, currSnap, diff, perf }) {
  const label = techKey ? techLabel(techKey) : 'Desconocida';
  return `Eres el auditor técnico de Concorde CRM. Analiza qué cambió en la tienda "${store.name || store.id}" (${store.web || 'sin URL'}) entre el escaneo anterior y el de hoy, y entrega un insight accionable.

TECNOLOGÍA: ${label}
RESTRICCIONES DE LA PLATAFORMA: ${constraintText(techKey)}

${techKey ? `PLAYBOOK DE LA PLATAFORMA:\n${playbookText(techKey)}\n` : ''}
CAMBIOS ESTRUCTURALES (ayer -> hoy):
${JSON.stringify(diff, null, 2)}

RENDIMIENTO (escaneo anterior -> hoy):
${JSON.stringify(perf, null, 2)}

ESTADO ACTUAL DE LA PÁGINA:
- Tema: ${currSnap.theme || 'No detectado'}
- Plugins/Apps detectados hoy: ${[...(currSnap.plugins || []), ...(currSnap.apps || [])].join(', ') || 'Ninguno detectado'}
- Scripts que bloquean el render: ${currSnap.blocking_scripts ?? 'N/D'}
- Imágenes sin carga diferida: ${currSnap.images_total !== undefined ? currSnap.images_total - (currSnap.images_lazy || 0) : 'N/D'} de ${currSnap.images_total ?? 'N/D'}
- Elementos de error en pantalla: ${currSnap.error_elements ?? 0}

REGLAS DE EVALUACIÓN:
1. Si los nodos DOM cayeron más del 50%, la tienda probablemente se rompió: CRITICAL.
2. Dominios nuevos de categoría "unknown" son los más sospechosos: evalúa posible inyección maliciosa. Dominios nuevos de analytics, ads_pixels, chat_support o marketing_reviews suelen ser herramientas añadidas por el cliente: son un riesgo de rendimiento, no de seguridad, salvo que coincidan con otros indicios.
3. Relaciona siempre cambios estructurales con cambios de rendimiento cuando ambos existan (por ejemplo, scripts nuevos y carga más lenta).
4. Si la variación es mínima y no hay errores, la severidad es INFO.
5. Adapta las acciones a la plataforma. En Shopify o VTEX no propongas acceso a servidor ni a base de datos; la causa suele estar en una app, el tema o la configuración, y si es de infraestructura la acción es escalar al soporte de la plataforma. En WooCommerce y otras plataformas autoalojadas puedes proponer revisar plugins, caché, PHP y logs del hosting, con copia de seguridad previa.
6. Usa solo rutas y menús que figuren en el playbook o que conozcas con certeza; no inventes plugins ni apps que no aparezcan en los datos.
7. Entre 1 y 4 acciones, ordenadas por prioridad.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "severity": "INFO" | "WARNING" | "CRITICAL",
  "type": "PERFORMANCE" | "SECURITY" | "SYSTEM",
  "message": "Qué cambió y qué impacto tiene, en 1 o 2 oraciones.",
  "probable_cause": "Causa más probable en 1 oración.",
  "editable_by_agency": true | false,
  "platform_constraint": "Limitación de la plataforma que condiciona la solución, o null.",
  "actions": [
    { "step": "Acción concreta", "where": "Ruta exacta o panel", "owner": "agencia" | "cliente" | "plataforma" }
  ]
}`;
}

function validateInsight(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Respuesta inválida: no es un objeto');
  const severity = String(raw.severity || '').toUpperCase();
  if (!(severity in SEVERITY_ORDER)) throw new Error('Respuesta inválida: severity');
  const type = String(raw.type || '').toUpperCase();
  const owners = ['agencia', 'cliente', 'plataforma'];
  const actions = Array.isArray(raw.actions)
    ? raw.actions
        .map((a) => ({
          step: String(a?.step || '').trim().slice(0, 300),
          where: String(a?.where || '').trim().slice(0, 300),
          owner: owners.includes(String(a?.owner || '').toLowerCase()) ? String(a.owner).toLowerCase() : 'agencia'
        }))
        .filter((a) => a.step)
        .slice(0, 4)
    : [];
  return {
    severity,
    type: ['PERFORMANCE', 'SECURITY', 'SYSTEM'].includes(type) ? type : 'SYSTEM',
    message: String(raw.message || '').trim().slice(0, 400),
    probable_cause: String(raw.probable_cause || '').trim().slice(0, 300),
    editable_by_agency: raw.editable_by_agency !== false,
    platform_constraint: raw.platform_constraint ? String(raw.platform_constraint).trim().slice(0, 300) : null,
    actions
  };
}

function composeMessage(insight) {
  const parts = [insight.message];
  if (insight.probable_cause) parts.push(`Causa probable: ${insight.probable_cause}`);
  if (insight.actions.length > 0) {
    parts.push(`Acciones: ${insight.actions.map((a, i) => `${i + 1}) ${a.step}${a.where ? ` (${a.where})` : ''}`).join(' ')}`);
  }
  return parts.join(' ').slice(0, 480);
}

async function analyzeAndStore({ metricData, previousScan }) {
  if (!hasAiKey()) return null;

  const currSnap = parseSnapshot(metricData.html_analysis);
  const prevSnap = parseSnapshot(previousScan && previousScan.html_analysis);
  if (!currSnap || !prevSnap) return null;

  if (currSnap.blocked_suspect) {
    console.warn(`[HTML Insights] ${metricData.store_id}: escaneo bloqueado por WAF o captcha, se omite la comparación.`);
    return null;
  }

  const store = (await db('stores').where({ id: metricData.store_id }).first()) || { id: metricData.store_id };
  const techKey = normalizeTech(store.tecnologia) || normalizeTech(currSnap.tech);
  const ownHost = hostOf(store.web || '');

  const diff = diffSnapshots(prevSnap, currSnap, ownHost);
  const perf = perfDiff(previousScan, metricData);

  if (!hasSignal(diff, perf)) return null;

  const { data, model } = await generateJSON({
    task: 'html_insights',
    module: 'HTML_INSIGHTS',
    system: 'Responde siempre en formato JSON puro, sin markdown ni comillas invertidas. Escribe en español.',
    prompt: buildPrompt({ store, techKey, prevSnap, currSnap, diff, perf }),
    validate: validateInsight
  });

  const severity = maxSeverity(data.severity, severityFloor(diff));
  if (severity === 'INFO') return null;

  const insight = { ...data, severity };
  const alert = await MetricsRepository.createAlert({
    store_id: metricData.store_id,
    alert_type: insight.type,
    severity: insight.severity,
    message: composeMessage(insight),
    raw_data: JSON.stringify({
      ayer: prevSnap,
      hoy: currSnap,
      diff,
      rendimiento: perf,
      tecnologia: techKey,
      saas: techKey ? isSaas(techKey) : null,
      insight,
      modelo: model
    })
  });

  return alert;
}

module.exports = {
  classifyDomain,
  diffSnapshots,
  perfDiff,
  hasSignal,
  severityFloor,
  validateInsight,
  composeMessage,
  analyzeAndStore
};
