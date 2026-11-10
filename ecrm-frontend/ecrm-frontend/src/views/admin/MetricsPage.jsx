import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import crmApi from '../../api/crmApi';
import { startVisiblePolling } from '../../utils/visiblePolling';

// Subcomponentes y lógica del hub (antes en este mismo archivo) → ./MetricsPage/
import { LEVEL_RANK, buildActiveMonitors } from './MetricsPage/metricsLogic';
import MonitorHeader from './MetricsPage/MonitorHeader';
import MonitorFilters from './MetricsPage/MonitorFilters';
import StoreCard from './MetricsPage/StoreCard';
import FeedPanel from './MetricsPage/FeedPanel';
import JsonModal from './MetricsPage/JsonModal';

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
  const chatBottomRef = useRef(null);

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
    return startVisiblePolling(fetchData, 60000);
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
        // Últimos 60 días: suficiente para la base de comparación HTML (10 radiografías) sin traer toda la tabla
        const metricsRes = await crmApi.get('/metrics?days=60');
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
  const activeMonitors = useMemo(() => buildActiveMonitors(stores, metrics, alerts), [stores, metrics, alerts]);

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
      
      <MonitorHeader botStatus={botStatus} onSync={fetchData} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* PANEL PRINCIPAL DE CARDS */}
        <div style={{ flex: '1', padding: '20px 24px', overflowY: 'auto', backgroundColor: '#f3f4f6' }}>
          
          <MonitorFilters
            count={filteredMonitors.length}
            conteoUrgencia={conteoUrgencia}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            planFilter={planFilter}
            setPlanFilter={setPlanFilter}
            urgencyFilter={urgencyFilter}
            setUrgencyFilter={setUrgencyFilter}
          />

          {/* GRID DE CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '16px' }}>
            {filteredMonitors.map(store => (
              <StoreCard
                key={store.id}
                store={store}
                navigate={navigate}
                onResolveStore={resolverTienda}
                onShowJson={setJsonModalData}
              />
            ))}

            {filteredMonitors.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>
                No se encontraron tiendas que coincidan con los criterios de búsqueda.
              </div>
            )}
          </div>
        </div>

        <FeedPanel
          feedFilter={feedFilter}
          setFeedFilter={setFeedFilter}
          timelineFeed={timelineFeed}
          navigate={navigate}
          resolverAlerta={resolverAlerta}
          chatBottomRef={chatBottomRef}
        />
    </div>

    {jsonModalData && <JsonModal jsonModalData={jsonModalData} onClose={() => setJsonModalData(null)} />}
  </div>
  );
}