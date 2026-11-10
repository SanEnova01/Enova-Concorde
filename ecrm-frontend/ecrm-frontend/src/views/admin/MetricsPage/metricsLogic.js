// ============================================================
// CONFIGURACIÓN DE PRIORIDAD
// ============================================================

// Solo se muestran y se filtran estos planes (SCALE_PLUS queda fuera)
export const PLANES_PERMITIDOS = ['GO', 'GROWTH', 'ESCALE', 'SCALE'];

// Umbrales. Referencias públicas: TTFB bueno <= 800 ms y malo > 1800 ms (web.dev);
// DOM: Lighthouse avisa > ~800 nodos y marca error > ~1400. Como muchas tiendas
// WooCommerce superan 1400 siempre, el DOM y la carga se juzgan sobre todo
// contra la línea base de la propia tienda (mediana de sus escaneos previos).
export const UMBRALES = {
  TTFB_WARN_MS: 800,
  TTFB_CRIT_MS: 1800,
  LOAD_RATIO_WARN: 1.5,   // +50% frente a su mediana
  LOAD_RATIO_CRIT: 2.5,   // +150% frente a su mediana
  LOAD_MIN_DELTA_MS: 1000, // ignora variaciones pequeñas en valores absolutos
  NODES_RATIO_WARN: 1.3,  // +30% de nodos DOM frente a su mediana
  BASELINE_MAX_RECORDS: 14
};

export const LEVEL_RANK = { CRITICAL: 0, WARNING: 1, OK: 2 };

export const LEVEL_STYLE = {
  CRITICAL: { border: '#dc2626', bg: '#fef2f2', text: '#991b1b', soft: '#fee2e2', label: 'URGENTE' },
  WARNING: { border: '#f59e0b', bg: '#fffbeb', text: '#92400e', soft: '#fef3c7', label: 'ATENCIÓN' },
  OK: { border: '#e5e7eb', bg: '#ffffff', text: '#166534', soft: '#f0fdf4', label: 'OK' }
};

export const median = (values) => {
  const nums = values.map(Number).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

export const parseJsonSafe = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// Una radiografía válida siempre trae "tech". Descarta objetos de diagnóstico antiguos.
export const parseHtmlValido = (raw) => {
  const parsed = parseJsonSafe(raw);
  return parsed && typeof parsed === 'object' && parsed.tech ? parsed : null;
};

export const normalizarPlan = (store) =>
  String(store.plan_type || store.plan || '').toUpperCase().trim();

// ============================================================
// CICLO DE VIDA DE LAS ALERTAS IA
// La IA compara escaneos (eventos). Un evento NO es un estado permanente.
//   OPEN       -> alerta del último escaneo con radiografía y que sigue "empeorando". Cuenta como URGENTE.
//   RECOVERY   -> el último escaneo es igual o mejor que el anterior: la alerta describe un cambio que ya se corrigió.
//   INFO       -> severidad informativa, no urgente.
//   SUPERSEDED -> anterior al último escaneo con radiografía: ya hay datos más nuevos.
//   RESOLVED   -> alguien la marcó como atendida (resolved_at).
// Solo OPEN suma a la urgencia. El resto queda como historial.
// ============================================================
export const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

// true si el escaneo actual NO es peor que el previo y mejora al menos una métrica
export const esRecuperacion = (cur, prev, ttfbCur, ttfbPrev) => {
  if (!cur || !prev) return false;
  const keys = ['error_elements', 'total_dom_nodes', 'total_scripts', 'total_iframes', 'blocking_scripts'];
  let mejora = false;
  for (const k of keys) {
    const c = num(cur[k]);
    const p = num(prev[k]);
    if (c > p) return false;
    if (c < p) mejora = true;
  }
  const prevDom = new Set(prev.external_domains || []);
  if ((cur.external_domains || []).some(d => !prevDom.has(d))) return false;
  const prevPl = new Set(prev.plugins || []);
  if ((cur.plugins || []).some(d => !prevPl.has(d))) return false;
  if (ttfbPrev > 0 && ttfbCur > ttfbPrev * 1.3 && ttfbCur - ttfbPrev > 300) return false;
  return mejora || num(cur.error_elements) === 0;
};

export const clasificarAlerta = (alert, ctx) => {
  if (alert.resolved_at) return 'RESOLVED';
  const sev = String(alert.severity || '').toUpperCase();
  const tipo = String(alert.alert_type || '').toUpperCase();
  const created = new Date(alert.created_at).getTime();
  if (ctx.scanTime && created < ctx.scanTime - 2 * 60 * 1000) return 'SUPERSEDED';
  if (['INFO', 'LOW', 'SUCCESS'].includes(sev)) return 'INFO';
  if (/RECUP|RESUELT|NORMALIZ|RESTAUR|MEJOR/.test(tipo)) return 'RECOVERY';
  if (ctx.recuperado) return 'RECOVERY';
  return 'OPEN';
};

// Consolida la última telemetría de cada tienda con su radiografía HTML y calcula la urgencia
export const buildActiveMonitors = (stores, metrics, alerts) => {
  return stores.map(store => {
    // Solo planes permitidos (GO, GROWTH, ESCALE, SCALE)
    const plan = normalizarPlan(store);
    if (!PLANES_PERMITIDOS.includes(plan)) return null;

    const storeRecords = metrics.filter(m => String(m.store_id) === String(store.id));
    if (storeRecords.length === 0) return null;

    const latest = storeRecords[0];
    const latestWithHtml = storeRecords.find(m => parseHtmlValido(m.html_analysis)) || latest;
    const htmlData = parseHtmlValido(latestWithHtml.html_analysis);

    // ---------- URGENCIA ----------
    const reasons = [];
    const addReason = (level, source, text) => reasons.push({ level, source, text });

    // 1) Alertas de la IA vigentes: las generadas desde el último escaneo con radiografía
    const scanTime = new Date(latestWithHtml.date || latestWithHtml.created_at).getTime();
    const prevHtmlRecord = storeRecords
      .slice(storeRecords.indexOf(latestWithHtml) + 1)
      .find(m => parseHtmlValido(m.html_analysis));
    const recuperado = esRecuperacion(
      htmlData,
      prevHtmlRecord ? parseHtmlValido(prevHtmlRecord.html_analysis) : null,
      num(latestWithHtml.ttfb_ms),
      prevHtmlRecord ? num(prevHtmlRecord.ttfb_ms) : 0
    );

    const alertStatus = {};
    const alertasVigentes = [];
    const recuperaciones = [];
    alerts
      .filter(a => String(a.store_id) === String(store.id))
      .forEach(a => {
        const st = clasificarAlerta(a, { scanTime, recuperado });
        alertStatus[a.id] = st;
        if (st === 'OPEN') alertasVigentes.push(a);
        if (st === 'RECOVERY') recuperaciones.push(a);
      });
    alertasVigentes.forEach(a => {
      addReason('CRITICAL', 'IA', a.message || a.alert_type || 'Alerta detectada por la IA');
    });

    // 2) Estado del servidor
    if ((latest.server_status || 'ONLINE') !== 'ONLINE') {
      addReason('CRITICAL', 'REGLA', `Servidor ${latest.server_status}`);
    }

    // 3) Radiografía HTML
    if (htmlData) {
      if (htmlData.error_elements > 0) {
        addReason('CRITICAL', 'REGLA', `${htmlData.error_elements} elemento(s) de error visibles en la plantilla`);
      }
      if (htmlData.blocked_suspect) {
        addReason('WARNING', 'REGLA', 'Posible bloqueo WAF/captcha: la medición puede no ser real');
      }

      const historialHtml = storeRecords
        .filter(m => m !== latestWithHtml)
        .map(m => parseHtmlValido(m.html_analysis))
        .filter(Boolean)
        .slice(0, 10);
      const baseNodes = median(historialHtml.map(h => h.total_dom_nodes));
      if (baseNodes && htmlData.total_dom_nodes > baseNodes * UMBRALES.NODES_RATIO_WARN) {
        addReason('WARNING', 'REGLA', `Nodos DOM +${Math.round((htmlData.total_dom_nodes / baseNodes - 1) * 100)}% frente a su normal (${htmlData.total_dom_nodes} vs ~${Math.round(baseNodes)})`);
      }
    }

    // 4) Rendimiento (último registro)
    const ttfb = Number(latest.ttfb_ms) || 0;
    if (ttfb > UMBRALES.TTFB_CRIT_MS) {
      addReason('CRITICAL', 'REGLA', `TTFB ${ttfb} ms (malo: > ${UMBRALES.TTFB_CRIT_MS} ms)`);
    } else if (ttfb > UMBRALES.TTFB_WARN_MS) {
      addReason('WARNING', 'REGLA', `TTFB ${ttfb} ms (mejorable: > ${UMBRALES.TTFB_WARN_MS} ms)`);
    }

    const load = Number(latest.load_ms) || 0;
    const baseLoad = median(
      storeRecords.slice(1, 1 + UMBRALES.BASELINE_MAX_RECORDS).map(m => m.load_ms)
    );
    let loadRatio = 0;
    if (baseLoad && load > 0) {
      loadRatio = load / baseLoad;
      const delta = load - baseLoad;
      if (loadRatio >= UMBRALES.LOAD_RATIO_CRIT && delta > UMBRALES.LOAD_MIN_DELTA_MS) {
        addReason('CRITICAL', 'REGLA', `Carga ${(load / 1000).toFixed(2)}s, ${Math.round((loadRatio - 1) * 100)}% más lenta que su normal (~${(baseLoad / 1000).toFixed(2)}s)`);
      } else if (loadRatio >= UMBRALES.LOAD_RATIO_WARN && delta > UMBRALES.LOAD_MIN_DELTA_MS) {
        addReason('WARNING', 'REGLA', `Carga ${(load / 1000).toFixed(2)}s, ${Math.round((loadRatio - 1) * 100)}% más lenta que su normal (~${(baseLoad / 1000).toFixed(2)}s)`);
      }
    }

    const criticos = reasons.filter(r => r.level === 'CRITICAL').length;
    const avisos = reasons.filter(r => r.level === 'WARNING').length;
    const level = criticos > 0 ? 'CRITICAL' : (avisos > 0 ? 'WARNING' : 'OK');
    const score = criticos * 100 + avisos * 10 + Math.min(ttfb / 1000, 5) + loadRatio;

    return {
      id: store.id,
      name: store.name,
      plan_type: plan,
      urgency: { level, score, reasons, ai_alerts: alertasVigentes.length },
      alertStatus,
      recoveries: recuperaciones,
      html_date: latestWithHtml.date || latestWithHtml.created_at,
      html_is_stale: latestWithHtml !== latest,
      web: store.web || store.url || '',
      status: latest.server_status || 'ONLINE',
      loadMs: latest.load_ms,
      ramTotal: latest.ram_total_mb,
      ramCore: latest.ram_core_mb,
      ttfb: latest.ttfb_ms,
      domMs: latest.dom_ms,
      totalWeight: latest.total_weight_mb,
      totalRequests: latest.total_requests,
      date: latest.date || latest.created_at,
      web_flow: latest.web_flow || 'Real-Browser',
      html: htmlData,
      raw_record: latestWithHtml
    };
  }).filter(Boolean);
};
