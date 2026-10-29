import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Server, Clock, AlertTriangle, AlertCircle, CheckCircle2, ChevronRight, ActivitySquare, Terminal, Search, Filter } from 'lucide-react';
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
  const chatBottomRef = useRef(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [alerts]);

  const fetchData = async () => {
    try {
      try {
        const botRes = await crmApi.get('/metrics/bot-status');
        if (botRes.data.success) {
          setBotStatus({
            status: botRes.data.status,
            minutes_ago: botRes.data.minutes_ago,
            is_running: botRes.data.is_running
          });
        }
      } catch (e) { console.error("Error status bot", e); }

      let tiendasList = [];
      try {
        const storeRes = await crmApi.get('/stores');
        tiendasList = storeRes.data.data || storeRes.data || [];
        setStores(tiendasList);
      } catch (e) { console.error("Error tiendas", e); }

      try {
        const metricsRes = await crmApi.get('/metrics');
        let dataM = metricsRes.data.data || metricsRes.data || [];
        dataM.sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
        setMetrics(dataM);
      } catch (e) { console.error("Error métricas", e); }

      try {
        const alertsRes = await crmApi.get('/metrics/alerts');
        if (alertsRes.data.success) {
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

  const activeMonitors = stores.map(store => {
    const storeRecords = metrics.filter(m => String(m.store_id) === String(store.id));
    if (storeRecords.length === 0) return null;
    
    const latest = storeRecords[0];
    return {
      id: store.id,
      name: store.name,
      plan_type: store.plan_type || 'GO',
      status: latest.server_status || 'ONLINE',
      loadMs: latest.load_ms,
      ramTotal: latest.ram_total_mb,
      ttfb: latest.ttfb_ms,
      date: latest.date || latest.created_at,
      web_flow: latest.web_flow
    };
  }).filter(Boolean);

  const filteredMonitors = activeMonitors.filter(store => {
    const matchesSearch = store.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = planFilter === 'ALL' || store.plan_type === planFilter;
    return matchesSearch && matchesPlan;
  });

  const getSeverityIcon = (severity) => {
    switch(severity) {
      case 'CRITICAL': return <AlertTriangle size={16} color="#000000" />;
      case 'WARNING': return <AlertCircle size={16} color="#4b5563" />;
      case 'INFO': return <ActivitySquare size={16} color="#6b7280" />;
      case 'SYSTEM_LOG': return <CheckCircle2 size={16} color="#6b7280" />;
      default: return <ActivitySquare size={16} color="#9ca3af" />;
    }
  };

  if (loading) return <div className="crm-text-loading" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', color: '#111827' }}>Cargando telemetría del servidor...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f9fafb', overflow: 'hidden' }}>
      
      {/* HEADER PRINCIPAL */}
      <div style={{ padding: '20px 24px', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#111827', letterSpacing: '-0.5px' }}>Hub General de Monitoreo</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>Visión en tiempo real del rendimiento de todas las tiendas de clientes</p>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '6px' }}>
            <Server size={16} color={botStatus.status === 'ONLINE' ? '#111827' : '#9ca3af'} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#111827' }}>
                SCRAPER: {botStatus.status}
              </span>
              <span style={{ fontSize: '10px', color: '#6b7280' }}>
                {botStatus.minutes_ago !== null ? `Último latido hace ${botStatus.minutes_ago} min` : 'Desconectado'}
              </span>
            </div>
          </div>
          
          <button onClick={fetchData} className="crm-btn-black" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <Activity size={14} /> Refrescar Panel
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* PANEL IZQUIERDO: MONITORES */}
        <div style={{ flex: '1', padding: '24px', overflowY: 'auto', backgroundColor: '#f3f4f6' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#111827', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Nodos de Cliente Activos ({filteredMonitors.length})
            </h2>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="#6b7280" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Buscar tienda..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ padding: '8px 8px 8px 30px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', width: '220px', outline: 'none' }}
                />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={14} color="#6b7280" />
                <select 
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  style={{ padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none', backgroundColor: '#fff' }}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {filteredMonitors.map(store => (
              <div 
                key={store.id} 
                onClick={() => navigate(`/admin/clientes/${store.id}`)}
                style={{ 
                  backgroundColor: '#ffffff', 
                  borderRadius: '8px', 
                  border: '1px solid #e5e7eb', 
                  padding: '16px', 
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#9ca3af'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
              >
                <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: 'bold' }}>{store.status}</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: store.status === 'ONLINE' ? '#111827' : '#9ca3af' }}></div>
                </div>

                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '900', color: '#111827', paddingRight: '60px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {store.name}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold' }}>Carga Completa</span>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: '#111827' }}>
                      {store.loadMs ? (store.loadMs / 1000).toFixed(2) + 's' : '--'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold' }}>Memoria RAM</span>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: '#111827' }}>
                      {store.ramTotal ? Math.round(store.ramTotal) + 'MB' : '--'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '12px', borderTop: '1px dashed #e5e7eb' }}>
                  <span style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12}/> Última aud. {new Date(store.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                  <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 'bold' }}>{store.web_flow}</span>
                </div>
              </div>
            ))}
            
            {filteredMonitors.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                No se encontraron tiendas que coincidan con los filtros actuales.
              </div>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: LOGS Y ALERTAS */}
        <div style={{ width: '400px', backgroundColor: '#ffffff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          
          <div style={{ padding: '20px 16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={16}/> Registro del Sistema e IA
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#6b7280' }}>Auditoría estructural y alertas de rendimiento en tiempo real.</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#fff' }}>
            {alerts.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', textAlign: 'center' }}>
                <CheckCircle2 size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#111827' }}>Sistema Estable</span>
                <span style={{ fontSize: '11px' }}>A la espera de los escaneos estructurales del servidor.</span>
              </div>
            ) : (
              alerts.map((alert) => (
                <div 
                  key={alert.id} 
                  style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    padding: '12px', 
                    backgroundColor: alert.severity === 'CRITICAL' ? '#f9fafb' : alert.severity === 'WARNING' ? '#ffffff' : '#ffffff', 
                    border: `1px solid ${alert.severity === 'CRITICAL' ? '#d1d5db' : '#e5e7eb'}`, 
                    borderRadius: '8px',
                    boxShadow: alert.severity === 'CRITICAL' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  <div style={{ paddingTop: '2px' }}>
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#111827', cursor: 'pointer' }} onClick={() => navigate(`/admin/clientes/${alert.store_id}`)}>
                        {alert.store_name || `Tienda #${alert.store_id}`}
                      </span>
                      <span style={{ fontSize: '10px', color: '#6b7280' }}>
                        {new Date(alert.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '900', color: alert.severity === 'CRITICAL' ? '#111827' : '#4b5563' }}>
                      {alert.alert_type}
                    </span>
                    <p style={{ margin: 0, fontSize: '12px', color: '#374151', lineHeight: '1.4' }}>
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={chatBottomRef} />
          </div>

        </div>
      </div>
    </div>
  );
}