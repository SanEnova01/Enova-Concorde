import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, Server, Clock, AlertTriangle, AlertCircle, 
  CheckCircle2, ChevronRight, Terminal, Search, Filter, 
  Code, ShieldCheck, ShieldAlert, Globe, Layers, ArrowUpRight,
  Copy, Check, X
} from 'lucide-react';
import crmApi from '../../api/crmApi';

// ============================================================
// CONFIGURACIÓN DE PRIORIDAD
// ============================================================

// Solo se muestran y se filtran estos planes (SCALE_PLUS queda fuera)
const PLANES_PERMITIDOS = ['GO', 'GROWTH', 'ESCALE', 'SCALE'];

// Umbrales. Referencias públicas: TTFB bueno <= 800 ms y malo > 1800 ms (web.dev);
// DOM: Lighthouse avisa > ~800 nodos y marca error > ~1400. Como muchas tiendas
// WooCommerce superan 1400 siempre, el DOM y la carga se juzgan sobre todo
// contra la línea base de la propia tienda (mediana de sus escaneos previos).
const UMBRALES = {
  TTFB_WARN_MS: 800,
  TTFB_CRIT_MS: 1800,
  LOAD_RATIO_WARN: 1.5,   // +50% frente a su mediana
  LOAD_RATIO_CRIT: 2.5,   // +150% frente a su mediana
  LOAD_MIN_DELTA_MS: 1000, // ignora variaciones pequeñas en valores absolutos
  NODES_RATIO_WARN: 1.3,  // +30% de nodos DOM frente a su mediana
  BASELINE_MAX_RECORDS: 14
};

const LEVEL_RANK = { CRITICAL: 0, WARNING: 1, OK: 2 };

const LEVEL_STYLE = {
  CRITICAL: { border: '#dc2626', bg: '#fef2f2', text: '#991b1b', soft: '#fee2e2', label: 'URGENTE' },
  WARNING: { border: '#f59e0b', bg: '#fffbeb', text: '#92400e', soft: '#fef3c7', label: 'ATENCIÓN' },
  OK: { border: '#e5e7eb', bg: '#ffffff', text: '#166534', soft: '#f0fdf4', label: 'OK' }
};

const median = (values) => {
  const nums = values.map(Number).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

const parseJsonSafe = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// Una radiografía válida siempre trae "tech". Descarta objetos de diagnóstico antiguos.
const parseHtmlValido = (raw) => {
  const parsed = parseJsonSafe(raw);
  return parsed && typeof parsed === 'object' && parsed.tech ? parsed : null;
};

const normalizarPlan = (store) =>
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
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

// true si el escaneo actual NO es peor que el previo y mejora al menos una métrica
const esRecuperacion = (cur, prev, ttfbCur, ttfbPrev) => {
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

const clasificarAlerta = (alert, ctx) => {
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

export default function HubMonitorGeneral() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState([]);
  const [stores, setStores] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [botStatus, setBotStatus] = useState({ status: 'OFFLINE', minutes_ago: null, is_running: false });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'WARNING'
  const [feedFilter, setFeedFilter] = useState('ALL'); // 'ALL' | 'ALERTS' | 'SUCCESS'
  const [jsonModalData, setJsonModalData] = useState(null);
  const [copied, setCopied] = useState(false);
  const chatBottomRef = useRef(null);

  const handleCopyJson = () => {
    if (!jsonModalData) return;
    const jsonString = JSON.stringify(jsonModalData, null, 2);
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  // Marcar alertas como atendidas (optimista; si el endpoint falla se revierte)
  const marcarAtendidas = async (url, matches) => {
    const previo = alerts;
    const ahora = new Date().toISOString();
    setAlerts(prev => prev.map(a => (matches(a) && !a.resolved_at ? { ...a, resolved_at: ahora } : a)));
    try {
      await crmApi.post(url, {});
    } catch (e) {
      console.error('Error al marcar alerta como atendida', e);
      setAlerts(previo);
      window.alert('No se pudo marcar como atendida. Verifica que el endpoint exista en el backend.');
    }
  };
  const resolverAlerta = (alertId) =>
    marcarAtendidas(`/metrics/alerts/${alertId}/resolve`, a => String(a.id) === String(alertId));
  const resolverTienda = (storeId) =>
    marcarAtendidas(`/metrics/alerts/resolve-store/${storeId}`, a => String(a.store_id) === String(storeId));

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [alerts, metrics]);

  const fetchData = async () => {
    try {
      // 1. Status del bot
      try {
        const botRes = await crmApi.get('/metrics/bot-status');
        if (botRes.data?.success) {
          setBotStatus({
            status: botRes.data.status,
            minutes_ago: botRes.data.minutes_ago,
            is_running: botRes.data.is_running
          });
        }
      } catch (e) { console.error("Error status bot", e); }

      // 2. Tiendas
      let tiendasList = [];
      try {
        const storeRes = await crmApi.get('/stores');
        tiendasList = storeRes.data?.data || storeRes.data || [];
        setStores(tiendasList);
      } catch (e) { console.error("Error tiendas", e); }

      // 3. Métricas históricas
      try {
        const metricsRes = await crmApi.get('/metrics');
        let dataM = metricsRes.data?.data || metricsRes.data || [];
        dataM.sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
        setMetrics(dataM);
      } catch (e) { console.error("Error métricas", e); }

      // 4. Alertas IA desde la BD
      try {
        const alertsRes = await crmApi.get('/metrics/alerts');
        if (alertsRes.data?.success) {
          const dataAlerts = alertsRes.data.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          setAlerts(dataAlerts);
        }
      } catch (e) { console.error("Error alertas IA", e); }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

// Consolidar última telemetría con estructura HTML
  const activeMonitors = useMemo(() => {
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
  }, [stores, metrics, alerts]);

  // Feed combinado del lateral: Alertas de IA + Logs de escaneos limpios
  const timelineFeed = useMemo(() => {
    const list = [];

    // Solo tiendas visibles (planes permitidos con métricas)
    const idsVisibles = new Set(activeMonitors.map(m => String(m.id)));

    // Estado de cada alerta según el ciclo de vida calculado por tienda
    const statusById = {};
    activeMonitors.forEach(m => Object.assign(statusById, m.alertStatus));
    const SEV_BY_STATUS = { OPEN: 'CRITICAL', RECOVERY: 'SUCCESS', INFO: 'INFO', SUPERSEDED: 'HISTORY', RESOLVED: 'HISTORY' };

    // Alertas de la BD: solo las abiertas van en rojo; el resto es historial
    alerts.filter(a => idsVisibles.has(String(a.store_id))).forEach(alert => {
      const status = statusById[alert.id] || 'SUPERSEDED';
      list.push({
        id: `alert-${alert.id}`,
        alert_id: alert.id,
        status,
        type: 'AI_ALERT',
        severity: SEV_BY_STATUS[status],
        original_severity: alert.severity,
        alert_type: alert.alert_type,
        store_id: alert.store_id,
        store_name: alert.store_name || `Tienda #${alert.store_id}`,
        message: alert.message,
        timestamp: new Date(alert.created_at || Date.now())
      });
    });

    // Logs rutinarios de cada escaneo activo
    activeMonitors.forEach(monitor => {
      // Solo se registra "escaneo OK" si hubo radiografía real y nada urgente
      const hasErrors = monitor.html && monitor.html.error_elements > 0;
      if (monitor.html && !hasErrors && monitor.urgency.level === 'OK' && monitor.status === 'ONLINE') {
        list.push({
          id: `scan-${monitor.id}-${monitor.date}`,
          type: 'SCAN_LOG',
          severity: 'SUCCESS',
          alert_type: 'ESTRUCTURA_OK',
          store_id: monitor.id,
          store_name: monitor.name,
          message: `Escaneo DOM completado: ${monitor.html?.total_dom_nodes ?? '--'} nodos, ${monitor.html?.total_scripts ?? '--'} scripts, 0 errores en plantilla.`,
          timestamp: new Date(monitor.date)
        });
      }
    });

    list.sort((a, b) => a.timestamp - b.timestamp);

    if (feedFilter === 'OPEN') return list.filter(item => item.status === 'OPEN');
    if (feedFilter === 'ALERTS') return list.filter(item => item.type === 'AI_ALERT');
    if (feedFilter === 'SUCCESS') return list.filter(item => item.severity === 'SUCCESS');
    return list;
  }, [alerts, activeMonitors, feedFilter]);

  // Filtrado + orden: lo urgente primero (rojo, luego ámbar, luego OK; dentro de cada nivel por puntaje)
  const filteredMonitors = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return activeMonitors
      .filter(store => {
        const matchesSearch = String(store.name || '').toLowerCase().includes(term) ||
                              String(store.id).toLowerCase().includes(term);
        const matchesPlan = planFilter === 'ALL' || store.plan_type === planFilter;
        const matchesUrgency = urgencyFilter === 'ALL' || store.urgency.level === urgencyFilter;
        return matchesSearch && matchesPlan && matchesUrgency;
      })
      .sort((a, b) =>
        LEVEL_RANK[a.urgency.level] - LEVEL_RANK[b.urgency.level] ||
        b.urgency.score - a.urgency.score ||
        String(a.name || '').localeCompare(String(b.name || ''))
      );
  }, [activeMonitors, searchTerm, planFilter, urgencyFilter]);

  const conteoUrgencia = useMemo(() => ({
    critical: activeMonitors.filter(m => m.urgency.level === 'CRITICAL').length,
    warning: activeMonitors.filter(m => m.urgency.level === 'WARNING').length
  }), [activeMonitors]);

  // Estilos de badges con color
  const getPlanBadgeStyle = (plan) => {
    switch(plan) {
      case 'GROWTH':
        return { backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe' };
      case 'ESCALE':
      case 'SCALE':
        return { backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' };
      case 'SCALE_PLUS':
        return { backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' };
      default: // GO
        return { backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' };
    }
  };

  const getStatusBadgeStyle = (status) => {
    const isOnline = status === 'ONLINE';
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '3px 8px',
      borderRadius: '9999px',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      backgroundColor: isOnline ? '#ecfdf5' : '#fef2f2',
      color: isOnline ? '#065f46' : '#991b1b',
      border: `1px solid ${isOnline ? '#a7f3d0' : '#fecaca'}`
    };
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', color: '#111827', fontFamily: 'inherit' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <Activity size={28} className="animate-spin" color="#111827" />
          <span style={{ fontSize: '13px', fontWeight: '600' }}>Sincronizando telemetría y radiografías HTML...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f9fafb', overflow: 'hidden', fontFamily: 'inherit' }}>
      
      {/* HEADER DE CONTROL */}
      <div style={{ padding: '16px 24px', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#111827', letterSpacing: '-0.5px' }}>Hub General de Monitoreo</h1>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>Telemetría en tiempo real, DOM estructural y detección de anomalías IA</p>
        </div>

        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: botStatus.status === 'ONLINE' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${botStatus.status === 'ONLINE' ? '#bbf7d0' : '#fecaca'}`, borderRadius: '6px' }}>
            <Server size={15} color={botStatus.status === 'ONLINE' ? '#15803d' : '#b91c1c'} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', fontWeight: '800', color: botStatus.status === 'ONLINE' ? '#166534' : '#991b1b' }}>
                BOT SCRAPER: {botStatus.status}
              </span>
              <span style={{ fontSize: '9px', color: '#6b7280' }}>
                {botStatus.minutes_ago !== null ? `Latido hace ${botStatus.minutes_ago} min` : 'Desconectado'}
              </span>
            </div>
          </div>
          
          <button onClick={fetchData} className="crm-btn-black" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', borderRadius: '6px' }}>
            <Activity size={13} /> Sincronizar
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* PANEL PRINCIPAL DE CARDS */}
        <div style={{ flex: '1', padding: '20px 24px', overflowY: 'auto', backgroundColor: '#f3f4f6' }}>
          
          {/* BARRA DE BÚSQUEDA Y FILTROS */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Tiendas Monitoreadas ({filteredMonitors.length})
              </span>
              {conteoUrgencia.critical > 0 && (
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#991b1b', backgroundColor: '#fee2e2', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '9999px' }}>
                  {conteoUrgencia.critical} urgente(s)
                </span>
              )}
              {conteoUrgencia.warning > 0 && (
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#92400e', backgroundColor: '#fef3c7', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '9999px' }}>
                  {conteoUrgencia.warning} en atención
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Buscar tienda o ID..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ padding: '6px 10px 6px 30px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', width: '220px', outline: 'none', backgroundColor: '#fafafa' }}
                />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={13} color="#6b7280" />
                <select 
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', backgroundColor: '#fff', color: '#374151', fontWeight: '500' }}
                >
                  <option value="ALL">Todos los planes</option>
                  <option value="GO">GO</option>
                  <option value="GROWTH">GROWTH</option>
                  <option value="ESCALE">ESCALE</option>
                  <option value="SCALE">SCALE</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={13} color="#6b7280" />
                <select
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', backgroundColor: '#fff', color: '#374151', fontWeight: '500' }}
                >
                  <option value="ALL">Toda urgencia</option>
                  <option value="CRITICAL">Solo urgentes</option>
                  <option value="WARNING">Solo en atención</option>
                </select>
              </div>
            </div>
          </div>

          {/* GRID DE CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '16px' }}>
            {filteredMonitors.map(store => {
              const lv = LEVEL_STYLE[store.urgency.level];
              const isUrgent = store.urgency.level !== 'OK';
              return (
              <div
                key={store.id}
                onClick={() => navigate(`/admin/clientes/${store.id}`)}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: isUrgent ? `2px solid ${lv.border}` : '1px solid #e5e7eb',
                  padding: isUrgent ? '15px' : '16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = isUrgent ? lv.border : '#111827'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = isUrgent ? lv.border : '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
              >
                {/* BANNER DE URGENCIA: motivos por los que esta tienda va primero */}
                {isUrgent && (
                  <div style={{ backgroundColor: lv.bg, border: `1px solid ${lv.border}`, borderRadius: '8px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '900', color: lv.text, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={12} color={lv.border} /> {lv.label}
                    </span>
                    {store.urgency.reasons.slice(0, 3).map((r, i) => (
                      <span key={i} style={{ fontSize: '11px', color: r.level === 'CRITICAL' ? '#991b1b' : '#92400e', lineHeight: '1.35' }}>
                        <strong>{r.source === 'IA' ? 'IA: ' : ''}</strong>{r.text}
                      </span>
                    ))}
                    {store.urgency.reasons.length > 3 && (
                      <span style={{ fontSize: '10px', color: '#6b7280' }}>+{store.urgency.reasons.length - 3} motivo(s) más</span>
                    )}
                    {store.urgency.ai_alerts > 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); resolverTienda(store.id); }}
                        style={{ alignSelf: 'flex-start', marginTop: '2px', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', cursor: 'pointer' }}
                      >
                        ✓ Marcar alertas IA como atendidas
                      </button>
                    )}
                  </div>
                )}

                {/* Alertas corregidas: el último escaneo ya no empeora respecto al anterior */}
                {store.recoveries.length > 0 && store.urgency.ai_alerts === 0 && (
                  <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', color: '#166534' }}>
                    ✓ Corregido: el último escaneo mejoró frente al anterior.
                  </div>
                )}

                {/* CABECERA DE LA TIENDA */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '70%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {store.name}
                      </h3>
                      <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', ...getPlanBadgeStyle(store.plan_type) }}>
                        {store.plan_type}
                      </span>
                    </div>
                    {store.web && (
                      <span style={{ fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {store.web.replace(/^https?:\/\//, '')}
                      </span>
                    )}
                  </div>

                  <div style={getStatusBadgeStyle(store.status)}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: store.status === 'ONLINE' ? '#10b981' : '#ef4444' }} />
                    {store.status}
                  </div>
                </div>

                {/* BLOQUE 1: MÉTRICAS PURAS DE RED (NÚMEROS NEGROS NEUTROS) */}
                <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '10px 12px', border: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Activity size={12} color="#6b7280" /> Rendimiento de Carga
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <div>
                      <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>Carga Total</span>
                      <span style={{ fontSize: '15px', fontWeight: '900', color: '#111827' }}>
                        {store.loadMs ? (store.loadMs / 1000).toFixed(2) + 's' : '--'}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>TTFB</span>
                      <span style={{ fontSize: '15px', fontWeight: '900', color: '#111827' }}>
                        {store.ttfb ? store.ttfb + 'ms' : '--'}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>RAM Total</span>
                      <span style={{ fontSize: '15px', fontWeight: '900', color: '#111827' }}>
                        {store.ramTotal ? Math.round(store.ramTotal) + 'MB' : '--'}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>Peso</span>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>
                        {store.totalWeight ? store.totalWeight + 'MB' : '--'}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>Peticiones</span>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>
                        {store.totalRequests ?? '--'}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>DOM Ready</span>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>
                        {store.domMs ? (store.domMs / 1000).toFixed(2) + 's' : '--'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* BLOQUE 2: RADIOGRAFÍA ESTRUCTURAL HTML (NÚMEROS NEUTROS + INDICADORES CON COLOR) */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '10px 12px', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Code size={12} color="#4b5563" /> Radiografía DOM & HTML
                      <span style={{ fontWeight: '600', color: '#9ca3af', textTransform: 'none', letterSpacing: 0 }}>
                        · {store.html_date ? new Date(store.html_date).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--'}{store.html_is_stale ? ' (no es el último escaneo)' : ''}
                      </span>
                    </span>

                    {/* INDICADOR DE ERRORES CON COLOR */}
                    {store.html?.error_elements > 0 ? (
                      <span style={{ fontSize: '10px', fontWeight: '800', color: '#991b1b', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <ShieldAlert size={11} color="#dc2626" /> {store.html.error_elements} error(es)
                      </span>
                    ) : (
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#166534', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <ShieldCheck size={11} color="#16a34a" /> 0 errores
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center', marginBottom: '8px' }}>
                    <div style={{ backgroundColor: '#f9fafb', padding: '6px 4px', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '700' }}>Nodos DOM</span>
                      <span style={{ fontSize: '13px', fontWeight: '900', color: '#111827' }}>
                        {store.html?.total_dom_nodes ? Number(store.html.total_dom_nodes).toLocaleString() : '--'}
                      </span>
                    </div>

                    <div style={{ backgroundColor: '#f9fafb', padding: '6px 4px', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '700' }}>Scripts</span>
                      <span style={{ fontSize: '13px', fontWeight: '900', color: '#111827' }}>
                        {store.html?.total_scripts ?? '--'}
                      </span>
                    </div>

                    <div style={{ backgroundColor: '#f9fafb', padding: '6px 4px', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '700' }}>Iframes</span>
                      <span style={{ fontSize: '13px', fontWeight: '900', color: '#111827' }}>
                        {store.html?.total_iframes ?? '--'}
                      </span>
                    </div>
                  </div>

                  {/* DOMINIOS EXTERNOS (CHIPS CON COLOR AZUL SUTIL) */}
                  <div style={{ marginTop: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: '600' }}>Dominios externos:</span>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: '#2563eb' }}>
                        {store.html?.external_domains?.length || 0} detectados
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '42px', overflowY: 'hidden' }}>
                      {store.html?.external_domains && store.html.external_domains.length > 0 ? (
                        store.html.external_domains.slice(0, 3).map((dom, i) => (
                          <span key={i} style={{ fontSize: '9px', fontWeight: '600', padding: '2px 6px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbeafe', borderRadius: '4px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '130px' }}>
                            {dom}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>Origen limpio (sin externos)</span>
                      )}
                      {store.html?.external_domains?.length > 3 && (
                        <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 5px', backgroundColor: '#f3f4f6', color: '#4b5563', borderRadius: '4px' }}>
                          +{store.html.external_domains.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* PIE DE TARJETA */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px', borderTop: '1px dashed #e5e7eb' }}>
                  <span style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} color="#9ca3af" /> {new Date(store.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setJsonModalData({
                          store_id: store.id,
                          store_name: store.name,
                          plan_type: store.plan_type,
                          web: store.web,
                          scanned_at: store.date,
                          urgency: store.urgency,
                          metrics: {
                            server_status: store.status,
                            web_flow: store.web_flow,
                            load_ms: store.loadMs,
                            dom_ms: store.domMs,
                            ttfb_ms: store.ttfb,
                            total_weight_mb: store.totalWeight,
                            total_requests: store.totalRequests,
                            ram_core_mb: store.ramCore,
                            ram_total_mb: store.ramTotal
                          },
                          html_analysis: store.html,
                          raw_db_record: store.raw_record
                        });
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: '#f3f4f6',
                        color: '#111827',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <Code size={12} /> JSON
                    </button>

                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#111827', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      Auditoría <ArrowUpRight size={13} />
                    </span>
                  </div>
                </div>
              </div>
              );
            })}

            {filteredMonitors.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                No se encontraron tiendas que coincidan con los criterios de búsqueda.
              </div>
            )}
          </div>
        </div>

        {/* PANEL LATERAL: HISTORIAL DE ALERTAS Y LOGS DE ESCANEO */}
        <div style={{ width: '420px', backgroundColor: '#ffffff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '900', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={16} color="#111827" /> Feed de Telemetría e IA
              </h2>
            </div>
            
            <p style={{ margin: '4px 0 12px 0', fontSize: '11px', color: '#6b7280' }}>
              Incidencias detectadas y registros de escaneos exitosos en tiempo real.
            </p>

            {/* FILTRO DE LOGS */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                onClick={() => setFeedFilter('ALL')}
                style={{ flex: 1, padding: '4px 8px', fontSize: '10px', fontWeight: '700', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: feedFilter === 'ALL' ? '#111827' : '#ffffff', color: feedFilter === 'ALL' ? '#ffffff' : '#374151', cursor: 'pointer' }}
              >
                Todos
              </button>
              <button
                onClick={() => setFeedFilter('OPEN')}
                style={{ flex: 1, padding: '4px 8px', fontSize: '10px', fontWeight: '700', borderRadius: '4px', border: '1px solid #fecaca', backgroundColor: feedFilter === 'OPEN' ? '#991b1b' : '#ffffff', color: feedFilter === 'OPEN' ? '#ffffff' : '#991b1b', cursor: 'pointer' }}
              >
                Abiertas
              </button>
              <button
                onClick={() => setFeedFilter('ALERTS')}
                style={{ flex: 1, padding: '4px 8px', fontSize: '10px', fontWeight: '700', borderRadius: '4px', border: '1px solid #fecaca', backgroundColor: feedFilter === 'ALERTS' ? '#dc2626' : '#fef2f2', color: feedFilter === 'ALERTS' ? '#ffffff' : '#991b1b', cursor: 'pointer' }}
              >
                Alertas IA
              </button>
              <button 
                onClick={() => setFeedFilter('SUCCESS')}
                style={{ flex: 1, padding: '4px 8px', fontSize: '10px', fontWeight: '700', borderRadius: '4px', border: '1px solid #bbf7d0', backgroundColor: feedFilter === 'SUCCESS' ? '#16a34a' : '#f0fdf4', color: feedFilter === 'SUCCESS' ? '#ffffff' : '#166534', cursor: 'pointer' }}
              >
                Escaneos OK
              </button>
            </div>
          </div>

          {/* LISTADO DE ITEMS DEL CHAT */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#fcfcfc' }}>
            {timelineFeed.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', textAlign: 'center' }}>
                <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: '8px', opacity: 0.6 }} />
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>Sistemas en Normalidad</span>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>Sin eventos pendientes en el filtro seleccionado.</span>
              </div>
            ) : (
              timelineFeed.map((item) => {
                const isCritical = item.severity === 'CRITICAL';
                const isWarning = item.severity === 'WARNING';
                const isSuccess = item.severity === 'SUCCESS';
                const isHistory = item.severity === 'HISTORY';

                let cardBg = '#ffffff';
                let borderColor = '#e5e7eb';
                let tagColor = { bg: '#f3f4f6', text: '#374151' };

                if (isHistory) {
                  cardBg = '#f9fafb';
                  borderColor = '#e5e7eb';
                } else if (isCritical) {
                  cardBg = '#fef2f2';
                  borderColor = '#fecaca';
                  tagColor = { bg: '#fee2e2', text: '#991b1b' };
                } else if (isWarning) {
                  cardBg = '#fffbeb';
                  borderColor = '#fde68a';
                  tagColor = { bg: '#fef3c7', text: '#92400e' };
                } else if (isSuccess) {
                  cardBg = '#f0fdf4';
                  borderColor = '#bbf7d0';
                  tagColor = { bg: '#dcfce7', text: '#166534' };
                }

                return (
                  <div 
                    key={item.id} 
                    style={{ 
                      display: 'flex', 
                      gap: '10px', 
                      padding: '12px', 
                      backgroundColor: cardBg, 
                      border: `1px solid ${borderColor}`, 
                      borderRadius: '8px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      opacity: isHistory ? 0.65 : 1
                    }}
                  >
                    <div style={{ paddingTop: '2px' }}>
                      {isCritical && <AlertTriangle size={15} color="#dc2626" />}
                      {isWarning && <AlertCircle size={15} color="#d97706" />}
                      {isSuccess && <CheckCircle2 size={15} color="#16a34a" />}
                      {!isCritical && !isWarning && !isSuccess && <Activity size={15} color={isHistory ? '#9ca3af' : '#2563eb'} />}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span 
                          style={{ fontSize: '12px', fontWeight: '800', color: '#111827', cursor: 'pointer' }} 
                          onClick={() => navigate(`/admin/clientes/${item.store_id}`)}
                        >
                          {item.store_name}
                        </span>
                        <span style={{ fontSize: '10px', color: '#6b7280' }}>
                          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase', backgroundColor: tagColor.bg, color: tagColor.text }}>
                          {item.alert_type}
                        </span>
                        {item.type === 'AI_ALERT' && item.status !== 'OPEN' && (
                          <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase', backgroundColor: item.status === 'RECOVERY' ? '#dcfce7' : '#e5e7eb', color: item.status === 'RECOVERY' ? '#166534' : '#4b5563' }}>
                            {{ RECOVERY: 'Corregido', INFO: 'Info', SUPERSEDED: 'Histórica', RESOLVED: 'Atendida' }[item.status]}
                          </span>
                        )}
                        {item.status === 'OPEN' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); resolverAlerta(item.alert_id); }}
                            style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', cursor: 'pointer' }}
                          >
                            ✓ Marcar atendida
                          </button>
                        )}
                      </div>

                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#374151', lineHeight: '1.4' }}>
                        {item.message}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
        </div>

      </div>
    </div>

    {/* MODAL DE DATOS COMPLETOS EN FORMATO JSON */}
    {jsonModalData && (
      <div 
        className="crm-modal-mask" 
        onClick={() => setJsonModalData(null)} 
        style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div 
          className="crm-modal-content" 
          onClick={(e) => e.stopPropagation()} 
          style={{ 
            width: '850px', 
            maxWidth: '95vw', 
            maxHeight: '90vh', 
            display: 'flex', 
            flexDirection: 'column', 
            padding: '20px', 
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '2px solid #111827',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}
        >
          {/* CABECERA DEL MODAL */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #111827', paddingBottom: '12px', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#111827', textTransform: 'uppercase' }}>
                Datos Completos de Telemetría // {jsonModalData.store_name}
              </h3>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>
                Capturado: {new Date(jsonModalData.scanned_at).toLocaleString()}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleCopyJson}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '800',
                  backgroundColor: copied ? '#15803d' : '#111827',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '¡Copiado!' : 'Copiar JSON'}
              </button>

              <button
                type="button"
                onClick={() => setJsonModalData(null)}
                style={{
                  padding: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} color="#111827" />
              </button>
            </div>
          </div>

          {/* VISUALIZADOR DE CÓDIGO JSON */}
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#0f172a', borderRadius: '8px', padding: '16px', border: '1px solid #1e293b' }}>
            <pre style={{ margin: 0, color: '#38bdf8', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              <code>{JSON.stringify(jsonModalData, null, 2)}</code>
            </pre>
          </div>
        </div>
      </div>
    )}
  </div>
  );
}