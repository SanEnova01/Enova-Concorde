import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, Server, Clock, AlertTriangle, AlertCircle, 
  CheckCircle2, ChevronRight, Terminal, Search, Filter, 
  Code, ShieldCheck, ShieldAlert, Globe, Layers, ArrowUpRight,
  Copy, Check, X
} from 'lucide-react';
import crmApi from '../../api/crmApi';

export default function HubMonitorGeneral() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState([]);
  const [stores, setStores] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [botStatus, setBotStatus] = useState({ status: 'OFFLINE', minutes_ago: null, is_running: false });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');
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

  const parseJsonSafe = (raw) => {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

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
      const storeRecords = metrics.filter(m => String(m.store_id) === String(store.id));
      if (storeRecords.length === 0) return null;
      
      const latest = storeRecords[0];
      const htmlData = parseJsonSafe(latest.html_analysis);

      return {
        id: store.id,
        name: store.name,
        plan_type: (store.plan_type || 'GO').toUpperCase(),
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
        raw_record: latest
      };
    }).filter(Boolean);
  }, [stores, metrics]);

  // Feed combinado del lateral: Alertas de IA + Logs de escaneos limpios
  const timelineFeed = useMemo(() => {
    const list = [];

    // Alertas de la BD
    alerts.forEach(alert => {
      list.push({
        id: `alert-${alert.id}`,
        type: 'AI_ALERT',
        severity: alert.severity, // 'CRITICAL' | 'WARNING' | 'INFO'
        alert_type: alert.alert_type,
        store_id: alert.store_id,
        store_name: alert.store_name || `Tienda #${alert.store_id}`,
        message: alert.message,
        timestamp: new Date(alert.created_at || Date.now())
      });
    });

    // Logs rutinarios de cada escaneo activo
    activeMonitors.forEach(monitor => {
      const hasErrors = monitor.html && monitor.html.error_elements > 0;
      if (!hasErrors && monitor.status === 'ONLINE') {
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

    if (feedFilter === 'ALERTS') return list.filter(item => item.type === 'AI_ALERT');
    if (feedFilter === 'SUCCESS') return list.filter(item => item.severity === 'SUCCESS');
    return list;
  }, [alerts, activeMonitors, feedFilter]);

  const filteredMonitors = useMemo(() => {
    return activeMonitors.filter(store => {
      const matchesSearch = store.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            store.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlan = planFilter === 'ALL' || store.plan_type === planFilter;
      return matchesSearch && matchesPlan;
    });
  }, [activeMonitors, searchTerm, planFilter]);

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
            </div>
          </div>

          {/* GRID DE CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '16px' }}>
            {filteredMonitors.map(store => (
              <div 
                key={store.id} 
                onClick={() => navigate(`/admin/clientes/${store.id}`)}
                style={{ 
                  backgroundColor: '#ffffff', 
                  borderRadius: '10px', 
                  border: '1px solid #e5e7eb', 
                  padding: '16px', 
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#111827'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
              >
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
            ))}

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

                let cardBg = '#ffffff';
                let borderColor = '#e5e7eb';
                let tagColor = { bg: '#f3f4f6', text: '#374151' };

                if (isCritical) {
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
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div style={{ paddingTop: '2px' }}>
                      {isCritical && <AlertTriangle size={15} color="#dc2626" />}
                      {isWarning && <AlertCircle size={15} color="#d97706" />}
                      {isSuccess && <CheckCircle2 size={15} color="#16a34a" />}
                      {!isCritical && !isWarning && !isSuccess && <Activity size={15} color="#2563eb" />}
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