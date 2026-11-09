import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

// COMPONENTES HIJOS MODULARIZADOS
import ClientPerformance from './ClientDetail/ClientPerformance';
import ClientMemoryVu from './ClientDetail/ClientMemoryVu';
import ClientTickets from './ClientDetail/ClientTickets';
import ClientMetricsHistory from './ClientDetail/ClientMetricsHistory';
import ClientExternalMonitor from './ClientDetail/ClientExternalMonitor';
import QuickAnalysis from './ClientDetail/QuickAnalysis';
import StoreReviewHistory from './ClientDetail/StoreReviewHistory';
import ClientHtmlScan from './ClientDetail/ClientHtmlScan';
// 🌟 SUBCOMPONENTE: Contador Odómetro Analógico (Tamaño Reducido)
import DailyReviewModal from '../../components/DailyReviewModal';

// ============================================================
// REGISTRO DE MÓDULOS
// - id: identificador estable (se guarda en BD y en localStorage)
// - span: 'full' ocupa toda la fila, 'half' media fila
// - configurable: si el admin puede ocultarlo por plan / por cliente
// ============================================================
const MODULES = [
  { id: 'quick_analysis',   label: 'Monitor de Rendimiento en Tiempo Real', span: 'full', configurable: true },
  { id: 'contact',          label: 'Datos de Contacto',                     span: 'half', configurable: true },
  { id: 'external_monitor', label: 'Monitor externo (Shopify / VTEX / Woo)', span: 'half', configurable: true },
  { id: 'performance',      label: 'Gráfico de Rendimiento',                span: 'half', configurable: true },
  { id: 'memory',           label: 'Memoria (VU)',                          span: 'half', configurable: true },
  { id: 'tickets',          label: 'Tickets',                               span: 'half', configurable: true },
  { id: 'metrics_history',  label: 'Historial de Métricas',                 span: 'half', configurable: true },
  { id: 'html_scan',        label: 'Radiografía HTML del Escaneo',          span: 'full', configurable: true },
  { id: 'quality',          label: 'Control de Calidad y Revisiones Manuales', span: 'full', configurable: true },
  { id: 'notes',            label: 'Notas Internas',                        span: 'full', configurable: false } // solo admins, nunca para clientes
];

const DEFAULT_ORDER = MODULES.map(m => m.id);
const CONFIGURABLE_IDS = MODULES.filter(m => m.configurable).map(m => m.id);

// ------------------------------------------------------------
// MÓDULOS POR PLAN (edita aquí qué ve cada plan por defecto)
// Hoy TODOS los planes ven TODOS los módulos, para no cambiar lo que ven
// los clientes actuales. Quita ids de la lista de un plan para ocultárselos.
// Un cliente concreto puede sobreescribir esto desde "Módulos del cliente".
// ------------------------------------------------------------
const PLAN_MODULES = {
  GO:         [...CONFIGURABLE_IDS],
  GROWTH:     [...CONFIGURABLE_IDS],
  ESCALE:     [...CONFIGURABLE_IDS],
  SCALE:      [...CONFIGURABLE_IDS],
  SCALE_PLUS: [...CONFIGURABLE_IDS]
};

const planDefaultEnabled = (planKey, id) => {
  const list = PLAN_MODULES[planKey];
  return list ? list.includes(id) : true; // planes no listados (WARRANTY, LEAD...) ven todo
};

const parseJsonSafe = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};

const SmallAnalogOdometer = ({ value, digits = 4 }) => {
  const paddedValue = String(value).padStart(digits, '0');

  return (
    <div style={{
      display: 'inline-flex',
      gap: '2px',
      backgroundColor: '#e5e5e5',
      padding: '3px 4px',
      borderRadius: '4px',
      border: '1px solid #cccccc',
      boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0,0,0,0.05)'
    }}>
      {paddedValue.split('').map((digit, index) => (
        <div key={index} style={{
          backgroundColor: '#ffffff',
          color: '#111111',
          fontSize: '16px',
          fontWeight: 'bold',
          fontFamily: "'Courier New', Courier, monospace",
          padding: '1px 5px',
          borderRadius: '3px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.9)',
          background: 'linear-gradient(180deg, #f8f8f8 0%, #ffffff 40%, #ffffff 60%, #ececec 100%)',
          textAlign: 'center',
          minWidth: '14px',
          border: '1px solid #cfcfcf'
        }}>
          {digit}
        </div>
      ))}
    </div>
  );
};

function ClientDetail() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  const [showReviewModal, setShowReviewModal] = useState(false);

  // ESTADOS PARA MULTI-TENANT (TABS)
  const [authorizedStores, setAuthorizedStores] = useState([]);
  const [activeStoreId, setActiveStoreId] = useState(null);

  // ESTADOS DE DATOS
  const [client, setClient] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [clientError, setClientError] = useState(false);

  // ESTADOS PARA EDICIÓN DE NOTAS Y MODAL
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});

  // ESTADOS PARA MONITORES EXTERNOS
  const [shopifyStatus, setShopifyStatus] = useState(null);
  const [vtexStatus, setVtexStatus] = useState(null);
  const [wooStatus, setWooStatus] = useState(null);

  // AUTENTICACIÓN
  const token = localStorage.getItem('crm_token');
  let userRole = 'client';
  let userEmail = '';
  if (token) {
    try {
      const payload = JSON.parse(window.atob(token.split('.')[1]));
      userRole = payload.role;
      userEmail = payload.email;
    } catch (e) {
      console.error("Error decodificando token:", e);
    }
  }
  const isAdminRole = userRole === 'super admin' || userRole === 'admin';

  // ESTADOS DE PERSONALIZACIÓN DE VISTA
  const layoutKey = `crm_client_layout_v1_${userEmail || userRole}`;
  const [order, setOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(layoutKey));
      if (Array.isArray(saved)) {
        const valid = saved.filter(id => DEFAULT_ORDER.includes(id));
        const missing = DEFAULT_ORDER.filter(id => !valid.includes(id));
        return [...valid, ...missing];
      }
    } catch (e) { /* localStorage no disponible: se usa el orden por defecto */ }
    return DEFAULT_ORDER;
  });
  const [layoutEdit, setLayoutEdit] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [quickOpen, setQuickOpen] = useState(false); // el Monitor siempre arranca cerrado
  const [previewAsClient, setPreviewAsClient] = useState(false);
  const [showModulesModal, setShowModulesModal] = useState(false);
  const [draftModules, setDraftModules] = useState({});

  // Guardar el orden elegido (por usuario, en este navegador)
  useEffect(() => {
    try { localStorage.setItem(layoutKey, JSON.stringify(order)); } catch (e) { /* ignorar */ }
  }, [order, layoutKey]);

  // El Monitor vuelve a cerrarse al cambiar de tienda
  useEffect(() => { setQuickOpen(false); }, [activeStoreId]);

  // 1. EFECTO DE INICIALIZACIÓN: Buscar todas las tiendas autorizadas
  useEffect(() => {
    const initAuthorizedStores = async () => {
      setLoadingInit(true);
      setClientError(false);
      try {
        let targetStores = [];

        if (userRole === 'client') {
          if (storeId !== 'cuentacliente') {
            alert('Acceso Denegado: No tiene autorización.');
            localStorage.removeItem('crm_token');
            navigate('/login', { replace: true });
            return;
          }

          const storesRes = await crmApi.get('/stores');
          const listaTiendas = Array.isArray(storesRes.data.data)
            ? storesRes.data.data
            : (Array.isArray(storesRes.data) ? storesRes.data : []);

          const correoLimpio = String(userEmail).toLowerCase().trim();

          targetStores = listaTiendas.filter(store => {
            if (!store.emails) return false;
            const correosDB = String(store.emails).toLowerCase();
            return correosDB.includes(correoLimpio);
          });

          if (targetStores.length === 0) {
            setClientError(true);
            setLoadingInit(false);
            return;
          }
        } else {
          const clientRes = await crmApi.get(`/stores/${storeId}`);
          const clientData = clientRes.data.data || clientRes.data;
          if (clientData) {
            targetStores = [clientData];
          }
        }

        targetStores.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        setAuthorizedStores(targetStores);
        if (targetStores.length > 0) {
          setActiveStoreId(targetStores[0].id);
        } else {
          setClientError(true);
        }
        setLoadingInit(false);
      } catch (error) {
        setClientError(true);
        setLoadingInit(false);
      }
    };
    initAuthorizedStores();
  }, [storeId, navigate, userRole, userEmail]);

  // 2. EFECTO SECUNDARIO: Cargar los datos específicos de la tienda ACTIVA
  useEffect(() => {
    if (!activeStoreId) return;

    const fetchActiveStoreDetails = async () => {
      setLoadingDetails(true);
      try {
        const clientRes = await crmApi.get(`/stores/${activeStoreId}`);
        const clientData = clientRes.data.data || clientRes.data;
        setClient(clientData);
        setNotesText(clientData.notes || '');

        try {
          const ticketsRes = await crmApi.get('/tickets');
          const ticketsList = Array.isArray(ticketsRes.data) ? ticketsRes.data : (ticketsRes.data.data || []);
          setTickets(ticketsList.filter(t => String(t.store_id) === String(activeStoreId)));
        } catch (ticketError) {}

        try {
          const metricsRes = await crmApi.get('/metrics');
          const metricsList = Array.isArray(metricsRes.data) ? metricsRes.data : (metricsRes.data.data || []);
          setMetrics(metricsList
            .filter(m => String(m.store_id) === String(activeStoreId))
            .sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at))
          );
        } catch (metricError) {}

        setShopifyStatus(null);
        setVtexStatus(null);
        setWooStatus(null);

        if (clientData) {
          const techDetectada = String(clientData.tecnologia).toLowerCase();
          if (techDetectada.includes('shopify')) {
            try { const res = await crmApi.get('/external/shopify-status'); if (res.data?.success) setShopifyStatus(res.data); } catch (err) {}
          } else if (techDetectada.includes('vtex')) {
            try { const res = await crmApi.get('/external/vtex-status'); if (res.data?.success) setVtexStatus(res.data); } catch (err) {}
          } else if (techDetectada.includes('woo')) {
            try { const res = await crmApi.get(`/external/woocommerce-status?url=${encodeURIComponent(clientData.web)}`); if (res.data?.success) setWooStatus(res.data); } catch (err) {}
          }
        }

        setLoadingDetails(false);
      } catch (error) {
        console.error("Error al cambiar de tienda:", error);
        setLoadingDetails(false);
      }
    };

    fetchActiveStoreDetails();
  }, [activeStoreId]);

  const getLogoUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const domain = (crmApi.defaults.baseURL || '').replace(/\/api$/, '');
    return `${domain}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const handleSaveNotes = async () => {
    try {
      const response = await crmApi.patch(`/stores/${client.id}`, { notes: notesText });
      if (response.data.success || response.status === 200) {
        setClient(prev => ({ ...prev, notes: notesText }));
        setIsEditingNotes(false);
      }
    } catch (error) { alert('Error al actualizar las notas.'); }
  };

  const openEditModal = () => {
    setEditFormData({
      name: client.name || '', web: client.web || '', emails: client.emails || '', phone: client.phone || '',
      plan_type: client.plan_type || 'GO', tecnologia: client.tecnologia || '', logo_url: client.logo_url || '',
      has_cooppilot: client.has_cooppilot || false, has_tracking: client.has_tracking !== false, has_returns: client.has_returns !== false
    });
    setShowEditModal(true);
  };

  const handleEditInputChange = (e) => setEditFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const uploadData = new FormData();
    uploadData.append('logo', file);
    try {
      const response = await crmApi.post('/upload', uploadData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (response.data.success) {
        setEditFormData(prev => ({ ...prev, logo_url: response.data.url }));
        alert('Imagen subida exitosamente.');
      }
    } catch (error) { alert('Error al subir imagen.'); }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const response = await crmApi.patch(`/stores/${client.id}`, editFormData);
      if (response.data.success || response.status === 200) {
        setClient(prev => ({ ...prev, ...editFormData }));

        setAuthorizedStores(prevStores => prevStores.map(s =>
          s.id === client.id ? { ...s, name: editFormData.name } : s
        ));

        setShowEditModal(false);
        alert('Datos actualizados con éxito.');
      }
    } catch (error) { alert('Error al guardar los cambios.'); }
  };

  // ============================================================
  // MÓDULOS: visibilidad por plan / por cliente
  // ============================================================
  const planKey = String(client?.plan_type || '').toUpperCase().trim();
  const overrides = parseJsonSafe(client?.modules_config) || {};

  const isModuleEnabled = (id) => {
    const mod = MODULES.find(m => m.id === id);
    if (!mod || !mod.configurable) return true;
    if (typeof overrides[id] === 'boolean') return overrides[id];
    return planDefaultEnabled(planKey, id);
  };

  const openModulesModal = () => {
    const draft = {};
    CONFIGURABLE_IDS.forEach(id => { draft[id] = isModuleEnabled(id); });
    setDraftModules(draft);
    setShowModulesModal(true);
  };

  const resetDraftToPlan = () => {
    const draft = {};
    CONFIGURABLE_IDS.forEach(id => { draft[id] = planDefaultEnabled(planKey, id); });
    setDraftModules(draft);
  };

  const handleSaveModules = async () => {
    // Solo se guardan las diferencias frente al plan, para que un cambio de plan siga aplicando
    const diff = {};
    CONFIGURABLE_IDS.forEach(id => {
      if (draftModules[id] !== planDefaultEnabled(planKey, id)) diff[id] = draftModules[id];
    });

    try {
      const response = await crmApi.patch(`/stores/${client.id}`, { modules_config: diff });
      if (response.data?.success || response.status === 200) {
        setClient(prev => ({ ...prev, modules_config: diff }));
        setShowModulesModal(false);
      }
    } catch (error) {
      alert('No se pudo guardar la configuración de módulos. Verifica que la tabla stores tenga la columna modules_config (jsonb) y que el PATCH la acepte.');
    }
  };

  // ============================================================
  // MÓDULOS: arrastrar y soltar (HTML5 nativo)
  // ============================================================
  const moveModule = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    setOrder(prev => {
      const fromIdx = prev.indexOf(fromId);
      const toIdx = prev.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = prev.filter(id => id !== fromId);
      const targetIdx = next.indexOf(toId);
      next.splice(fromIdx < toIdx ? targetIdx + 1 : targetIdx, 0, fromId);
      return next;
    });
  };

  const resetLayout = () => setOrder(DEFAULT_ORDER);

  if (loadingInit) return <div className="crm-text-loading">Verificando credenciales corporativas...</div>;
  if (clientError) return (<div className="crm-card-paper" style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center' }}><h3>No se encontraron tiendas asignadas</h3></div>);

  // El cliente solo ve módulos habilitados. El admin ve todos (los ocultos se marcan),
  // salvo que active "Ver como cliente".
  const applyClientFilter = !isAdminRole || previewAsClient;

  const hasExternalMonitor = client
    && String(client.tecnologia).toLowerCase().match(/shopify|vtex|woo/)
    && (shopifyStatus || vtexStatus || wooStatus);

  const renderModule = (id) => {
    if (!client) return null;
    switch (id) {
      case 'quick_analysis':
        return (
          <div className="crm-card-paper" style={{ padding: 0, overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
            <button
              type="button"
              onClick={() => setQuickOpen(o => !o)}
              aria-expanded={quickOpen}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 18px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '900',
                backgroundColor: quickOpen ? '#111111' : '#ffffff', color: quickOpen ? '#FFD700' : '#111111'
              }}
            >
              <span>⚡ Monitor de Rendimiento en Tiempo Real</span>
              <span style={{ fontSize: '12px' }}>{quickOpen ? '▲ Cerrar' : '▼ Abrir'}</span>
            </button>
            {/* Se mantiene montado (solo oculto) para no perder un análisis en curso al plegar */}
            <div style={{ display: quickOpen ? 'block' : 'none' }}>
              <QuickAnalysis storeId={client.id} storeUrl={client.web} />
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="crm-card-paper" style={{ margin: 0, flex: 1, boxSizing: 'border-box' }}>
            <h3 className="crm-section-title" style={{ marginTop: 0, marginBottom: '16px', borderBottom: '1px dotted #ccc', paddingBottom: '8px' }}>Datos de Contacto</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '800', color: '#111', minWidth: '95px', fontSize: '13px' }}>SITIO WEB:</span>
                {client.web ? <a href={client.web} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>{client.web}</a> : <span className="crm-text-muted" style={{ fontSize: '13px' }}>No registrado</span>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '800', color: '#111', minWidth: '95px', fontSize: '13px' }}>TECNOLOGÍA:</span>
                <span style={{ backgroundColor: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', color: '#374151' }}>
                  {client.tecnologia || 'No registrada'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '800', color: '#111', minWidth: '95px', fontSize: '13px' }}>CORREOS:</span>
                <span style={{ color: '#4b5563', fontSize: '13px', lineHeight: '1.4' }}>{client.emails ? client.emails.split(',').join(', ') : 'No registrados'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '800', color: '#111', minWidth: '95px', fontSize: '13px' }}>TELÉFONO:</span>
                <span style={{ color: '#4b5563', fontSize: '13px' }}>{client.phone || 'No registrado'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <span style={{ fontWeight: '800', color: '#111', minWidth: '95px', fontSize: '13px' }}>TICKETS:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <SmallAnalogOdometer value={tickets.length} digits={4} />
                  <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'bold' }}>CREADOS</span>
                </div>
              </div>

              {client.has_cooppilot && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <span style={{ fontWeight: '800', color: '#111', minWidth: '95px', fontSize: '13px' }}>COOPPILOT:</span>
                  <a href={`/cooppilot/${client.id}`} target="_blank" rel="noreferrer" style={{ backgroundColor: '#111', color: '#FFD700', padding: '4px 10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', textDecoration: 'none' }}>✨ ACTIVO ↗</a>
                </div>
              )}
            </div>
          </div>
        );

      case 'external_monitor':
        // Solo existe para Shopify / VTEX / Woo con estado disponible (igual que antes)
        if (!hasExternalMonitor) return null;
        return (
          <ClientExternalMonitor
            client={client}
            shopifyStatus={shopifyStatus}
            vtexStatus={vtexStatus}
            wooStatus={wooStatus}
          />
        );

      case 'performance':
        return <ClientPerformance metrics={metrics} />;

      case 'memory':
        return <ClientMemoryVu metrics={metrics} />;

      case 'tickets':
        return <ClientTickets tickets={tickets} />;

      case 'metrics_history':
        return <ClientMetricsHistory metrics={metrics} />;

      case 'html_scan':
        return <ClientHtmlScan metrics={metrics} />;

      case 'quality':
        return (
          <div className="crm-card-paper" style={{ width: '100%', boxSizing: 'border-box' }}>
            <h3 className="crm-section-title" style={{ marginTop: 0, marginBottom: '16px' }}>Control de Calidad y Revisiones Manuales</h3>
            <StoreReviewHistory storeId={client.id} />
          </div>
        );

      case 'notes':
        if (userRole === 'client') return null;
        return (
          <div className="crm-card-paper" style={{ width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="crm-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Notas Internas</h3>
              {!isEditingNotes ? (
                <button onClick={() => setIsEditingNotes(true)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>Editar</button>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleSaveNotes} className="crm-btn-black" style={{ padding: '4px 10px', fontSize: '12px' }}>Guardar</button>
                  <button onClick={() => { setIsEditingNotes(false); setNotesText(client.notes || ''); }} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>Cancelar</button>
                </div>
              )}
            </div>
            {isEditingNotes ? (
              <textarea value={notesText} onChange={(e) => setNotesText(e.target.value)} className="crm-input-text" style={{ width: '100%', height: '100px', boxSizing: 'border-box', resize: 'none' }} />
            ) : (
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{client.notes || 'Sin anotaciones particulares sobre este cliente.'}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Lista final de módulos a pintar, en el orden elegido
  const modulesToRender = order
    .map(id => {
      const def = MODULES.find(m => m.id === id);
      if (!def) return null;
      const enabled = isModuleEnabled(id);
      if (applyClientFilter && !enabled) return null;
      const node = renderModule(id);
      if (!node) return null;
      return { def, node, hiddenForClient: !enabled };
    })
    .filter(Boolean);

  const toolbarBtn = (active) => ({
    backgroundColor: active ? '#111111' : undefined,
    color: active ? '#FFD700' : undefined,
    fontWeight: 'bold'
  });

  return (
    <div>
      {/* Grilla de módulos: 2 columnas, 1 en pantallas angostas */}
      <style>{`
        .cd-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; align-items: stretch; }
        .cd-full { grid-column: 1 / -1; }
        @media (max-width: 900px) { .cd-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>

      {/* NAVEGACIÓN DE PESTAÑAS */}
      {authorizedStores.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #111', paddingBottom: '12px', marginBottom: '24px', overflowX: 'auto' }}>
          {authorizedStores.map(store => (
            <button
              key={store.id}
              onClick={() => setActiveStoreId(store.id)}
              style={{
                padding: '10px 18px',
                backgroundColor: activeStoreId === store.id ? '#111' : 'transparent',
                color: activeStoreId === store.id ? '#FFD700' : '#4b5563',
                border: activeStoreId === store.id ? '2px solid #111' : '2px solid transparent',
                borderRadius: '6px',
                fontWeight: '900',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {store.name}
            </button>
          ))}
        </div>
      )}

      {/* CONTROLES ADMINISTRATIVOS */}
      <div className="crm-actions-bar" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        {userRole !== 'client' ? (
          <button onClick={() => navigate('/admin/clientes')} className="crm-btn-border">Volver a Clientes</button>
        ) : <div />}

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>

          {/* 🌟 NUEVAS FLECHAS DE NAVEGACIÓN ENTRE TIENDAS 🌟 */}
          {authorizedStores.length > 1 && (
            <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
              <button
                onClick={() => {
                  const idx = authorizedStores.findIndex(s => s.id === activeStoreId);
                  if (idx > 0) setActiveStoreId(authorizedStores[idx - 1].id);
                }}
                disabled={authorizedStores.findIndex(s => s.id === activeStoreId) === 0}
                className="crm-btn-border"
                style={{ padding: '6px 12px', fontSize: '14px', opacity: authorizedStores.findIndex(s => s.id === activeStoreId) === 0 ? 0.4 : 1, cursor: authorizedStores.findIndex(s => s.id === activeStoreId) === 0 ? 'not-allowed' : 'pointer' }}
                title="Tienda Anterior"
              >
                ◀
              </button>
              <button
                onClick={() => {
                  const idx = authorizedStores.findIndex(s => s.id === activeStoreId);
                  if (idx < authorizedStores.length - 1) setActiveStoreId(authorizedStores[idx + 1].id);
                }}
                disabled={authorizedStores.findIndex(s => s.id === activeStoreId) === authorizedStores.length - 1}
                className="crm-btn-border"
                style={{ padding: '6px 12px', fontSize: '14px', opacity: authorizedStores.findIndex(s => s.id === activeStoreId) === authorizedStores.length - 1 ? 0.4 : 1, cursor: authorizedStores.findIndex(s => s.id === activeStoreId) === authorizedStores.length - 1 ? 'not-allowed' : 'pointer' }}
                title="Siguiente Tienda"
              >
                ▶
              </button>
            </div>
          )}

          {/* PERSONALIZAR VISTA (todos los roles) */}
          {client && !loadingDetails && (
            <>
              <button
                onClick={() => setLayoutEdit(v => !v)}
                className="crm-btn-border"
                style={toolbarBtn(layoutEdit)}
                title="Arrastra los módulos para reordenarlos"
              >
                {layoutEdit ? '✓ Listo' : '🎛️ Personalizar vista'}
              </button>
              {layoutEdit && (
                <button onClick={resetLayout} className="crm-btn-border" title="Volver al orden original">
                  ↺ Restablecer orden
                </button>
              )}
            </>
          )}

          {isAdminRole && client && !loadingDetails && (
            <>
              <button
                onClick={() => setPreviewAsClient(v => !v)}
                className="crm-btn-border"
                style={toolbarBtn(previewAsClient)}
                title="Muestra la página tal como la ve el cliente"
              >
                👁 Ver como cliente
              </button>
              <button onClick={openModulesModal} className="crm-btn-border" style={{ fontWeight: 'bold' }}>
                🧩 Módulos del cliente
              </button>
            </>
          )}

          {isAdminRole && client && !loadingDetails && (
            <button
              onClick={() => setShowReviewModal(true)}
              className="crm-btn-border"
              style={{ backgroundColor: '#f0fdf4', color: '#16a34a', borderColor: '#16a34a', fontWeight: 'bold' }}
            >
              📅 Registro Diario
            </button>
          )}

          {isAdminRole && client && !loadingDetails && (
            <button onClick={openEditModal} className="crm-btn-black">
              Editar Datos del Cliente
            </button>
          )}
        </div>
      </div>
      {loadingDetails || !client ? (
        <div className="crm-text-loading">Cargando datos de la tienda...</div>
      ) : (
        <>
          {/* HEADER DE LA TIENDA (fijo, no es un módulo) */}
          <div className="crm-card-paper" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ width: '64px', height: '64px', backgroundColor: '#f2f1ec', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #111111', overflow: 'hidden', flexShrink: 0, borderRadius: '8px' }}>
              {client.logo_url ? <img src={getLogoUrl(client.logo_url)} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontWeight: 'bold' }}>{client.name.substring(0, 2).toUpperCase()}</span>}
            </div>
            <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{client.name}</h1>
                <p className="crm-text-muted" style={{ margin: '4px 0 0 0' }}>ID de registro: {client.id}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <span className="crm-badge">Plan: {client.plan_type}</span>
                {String(client.tecnologia).toLowerCase().includes('shopify') && <img src="/assets/shopify-icon.png" alt="Shopify" style={{ height: '35px', objectFit: 'contain', marginTop: '4px' }} />}
                {String(client.tecnologia).toLowerCase().includes('woo') && <img src="/assets/woo-icon.png" alt="WooCommerce" style={{ height: '40px', objectFit: 'contain', marginTop: '4px' }} />}
                {String(client.tecnologia).toLowerCase().includes('vtex') && <img src="/assets/vtex-icon.png" alt="VTEX" style={{ height: '45px', objectFit: 'contain', marginTop: '4px' }} />}
                {!String(client.tecnologia).toLowerCase().match(/shopify|woo|vtex/) && <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', marginTop: '4px' }}>{client.tecnologia}</span>}
              </div>
            </div>
          </div>

          {layoutEdit && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '13px', color: '#92400e' }}>
              Modo personalizar: arrastra cada módulo y suéltalo sobre otro para cambiar su posición. El orden se guarda en este navegador. Pulsa "Listo" para volver a usar la página con normalidad.
            </div>
          )}

          {isAdminRole && previewAsClient && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '13px', color: '#1e40af' }}>
              Estás viendo la página como la vería el cliente (solo módulos habilitados para el plan {planKey || '—'}).
            </div>
          )}

          {/* GRILLA DE MÓDULOS ARRASTRABLES */}
          <div className="cd-grid">
            {modulesToRender.map(({ def, node, hiddenForClient }) => {
              const isDragging = dragId === def.id;
              const isTarget = overId === def.id && dragId && dragId !== def.id;
              return (
                <div
                  key={def.id}
                  className={def.span === 'full' ? 'cd-full' : ''}
                  draggable={layoutEdit}
                  onDragStart={(e) => {
                    if (!layoutEdit) return;
                    setDragId(def.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', def.id); // Firefox exige datos para iniciar el arrastre
                  }}
                  onDragOver={(e) => {
                    if (!layoutEdit || !dragId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (overId !== def.id) setOverId(def.id);
                  }}
                  onDrop={(e) => {
                    if (!layoutEdit) return;
                    e.preventDefault();
                    moveModule(dragId, def.id);
                    setDragId(null);
                    setOverId(null);
                  }}
                  onDragEnd={() => { setDragId(null); setOverId(null); }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    borderRadius: '10px',
                    opacity: isDragging ? 0.4 : (hiddenForClient ? 0.65 : 1),
                    outline: layoutEdit ? (isTarget ? '3px solid #111' : '2px dashed #9ca3af') : 'none',
                    outlineOffset: '4px',
                    cursor: layoutEdit ? 'grab' : 'auto',
                    transition: 'opacity 0.15s ease'
                  }}
                >
                  {(layoutEdit || hiddenForClient) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '11px', fontWeight: '800' }}>
                      {layoutEdit && <span style={{ color: '#374151' }}>⠿ {def.label}</span>}
                      {hiddenForClient && (
                        <span style={{ padding: '1px 6px', borderRadius: '4px', backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                          Oculto para este cliente
                        </span>
                      )}
                    </div>
                  )}
                  {/* En modo personalizar se desactivan los clics internos para que el arrastre no choque con gráficos o botones */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', pointerEvents: layoutEdit ? 'none' : 'auto' }}>
                    {node}
                  </div>
                </div>
              );
            })}
          </div>

          {modulesToRender.length === 0 && (
            <div className="crm-card-paper" style={{ textAlign: 'center', color: '#6b7280' }}>
              No hay módulos habilitados para esta tienda.
            </div>
          )}

          {/* MODAL: MÓDULOS VISIBLES PARA ESTE CLIENTE */}
          {showModulesModal && (
            <div className="crm-modal-mask" onClick={() => setShowModulesModal(false)}>
              <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
                <h3 className="crm-section-title" style={{ marginTop: 0 }}>Módulos de {client.name}</h3>
                <p className="crm-text-muted" style={{ marginTop: 0, fontSize: '13px' }}>
                  Plan <strong>{planKey || '—'}</strong>. Las casillas parten de lo que el plan incluye; lo que cambies aquí solo aplica a este cliente.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '14px 0' }}>
                  {MODULES.filter(m => m.configurable).map(m => {
                    const byPlan = planDefaultEnabled(planKey, m.id);
                    const changed = draftModules[m.id] !== byPlan;
                    return (
                      <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: `1px solid ${changed ? '#f59e0b' : '#e5e7eb'}`, borderRadius: '6px', cursor: 'pointer', backgroundColor: changed ? '#fffbeb' : '#ffffff' }}>
                        <input
                          type="checkbox"
                          checked={!!draftModules[m.id]}
                          onChange={(e) => setDraftModules(prev => ({ ...prev, [m.id]: e.target.checked }))}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span style={{ flex: 1, fontSize: '13px', fontWeight: '600' }}>{m.label}</span>
                        <span style={{ fontSize: '10px', color: '#6b7280' }}>
                          {changed ? (byPlan ? 'Quitado del plan' : 'Añadido al plan') : (byPlan ? 'Incluido en el plan' : 'No incluido en el plan')}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="crm-pagination-box" style={{ justifyContent: 'space-between' }}>
                  <button type="button" onClick={handleSaveModules} className="crm-btn-black">Guardar</button>
                  <button type="button" onClick={resetDraftToPlan} className="crm-btn-border">Restablecer al plan</button>
                  <button type="button" onClick={() => setShowModulesModal(false)} className="crm-btn-red">Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL DE EDICIÓN */}
          {showEditModal && (
            <div className="crm-modal-mask" onClick={() => setShowEditModal(false)}>
              <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
                <h3 className="crm-section-title" style={{ marginTop: 0 }}>Editar Datos del Cliente</h3>
                <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label className="crm-stat-label">Nombre del Cliente / Tienda</label>
                    <input type="text" name="name" value={editFormData.name} onChange={handleEditInputChange} className="crm-input-text" required />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label className="crm-stat-label">Sitio Web</label>
                      <input type="url" name="web" value={editFormData.web} onChange={handleEditInputChange} className="crm-input-text" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label className="crm-stat-label">Teléfono</label>
                      <input type="text" name="phone" value={editFormData.phone} onChange={handleEditInputChange} className="crm-input-text" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label className="crm-stat-label">Correos de contacto</label>
                      <input type="text" name="emails" value={editFormData.emails} onChange={handleEditInputChange} className="crm-input-text" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label className="crm-stat-label">Tipo de Plan</label>
                      <select name="plan_type" value={editFormData.plan_type} onChange={handleEditInputChange} className="crm-select-dropdown">
                        <option value="GO">GO</option>
                        <option value="GROWTH">GROWTH</option>
                        <option value="ESCALE">ESCALE</option>
                        <option value="WARRANTY">WARRANTY</option>
                        <option value="OUT_OF_WARRANTY">OUT OF WARRANTY</option>
                        <option value="LEAD">LEAD</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label className="crm-stat-label">Actualizar Logotipo</label>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="crm-input-text" style={{ padding: '5px' }} />
                    {editFormData.logo_url && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>✓ Logo cargado</span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label className="crm-stat-label">Tecnología E-commerce</label>
                    <select name="tecnologia" value={editFormData.tecnologia || ''} onChange={handleEditInputChange} className="crm-select-dropdown">
                      <option value="">Selecciona tecnología</option>
                      <option value="Shopify">Shopify</option>
                      <option value="Woocommerce">WooCommerce</option>
                      <option value="Vtex">VTEX</option>
                      <option value="Magento">Magento</option>
                      <option value="Custom">Custom / Propio</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: '#f9f9f6', border: '1px solid #ccc', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input type="checkbox" checked={!!editFormData.has_cooppilot} onChange={(e) => setEditFormData(prev => ({ ...prev, has_cooppilot: e.target.checked }))} style={{ width: '18px', height: '18px', cursor: 'pointer' }}/>
                      <label className="crm-stat-label" style={{ cursor: 'pointer', margin: 0, fontWeight: 'bold' }}>🚀 Habilitar Módulo CoopPilot</label>
                    </div>
                  </div>

                  <div className="crm-pagination-box" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
                    <button type="submit" className="crm-btn-black">Guardar Cambios</button>
                    <button type="button" onClick={() => setShowEditModal(false)} className="crm-btn-red">Cancelar</button>
                  </div>

                </form>
              </div>
            </div>
          )}

          {/* MODAL DE REVISIÓN DIARIA INDEPENDIENTE */}
          {showReviewModal && client && (
            <DailyReviewModal
              isOpen={showReviewModal}
              storeId={client.id}
              storeName={client.name}
              onClose={() => setShowReviewModal(false)}
            />
          )}

        </>
      )}
    </div>
  );
}

export default ClientDetail;
