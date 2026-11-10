import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

// COMPONENTES HIJOS MODULARIZADOS
import ClientPerformance from './ClientDetail/ClientPerformance';
import ClientMemoryVu from './ClientDetail/ClientMemoryVu';
import ClientTickets from './ClientDetail/ClientTickets';
import ClientMetricsHistory from './ClientDetail/ClientMetricsHistory';
import ClientExternalMonitor from './ClientDetail/ClientExternalMonitor';
import StoreReviewHistory from './ClientDetail/StoreReviewHistory';
import ClientHtmlScan from './ClientDetail/ClientHtmlScan';
import ClientHeader from './ClientDetail/ClientHeader';
import ClientContactCard from './ClientDetail/ClientContactCard';
import ClientNotes from './ClientDetail/ClientNotes';
import ClientQuickAnalysisPanel from './ClientDetail/ClientQuickAnalysisPanel';
import ClientModulesModal from './ClientDetail/ClientModulesModal';
import ClientEditModal from './ClientDetail/ClientEditModal';
import { MODULES, DEFAULT_ORDER, CONFIGURABLE_IDS, planDefaultEnabled, parseJsonSafe } from './ClientDetail/clientModules';
import DailyReviewModal from '../../components/DailyReviewModal';

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
          const ticketsRes = await crmApi.get(`/tickets?store_id=${encodeURIComponent(activeStoreId)}`);
          const ticketsList = Array.isArray(ticketsRes.data) ? ticketsRes.data : (ticketsRes.data.data || []);
          setTickets(ticketsList.filter(t => String(t.store_id) === String(activeStoreId)));
        } catch (ticketError) {}

        try {
          // Solo las métricas de esta tienda (antes se descargaba la tabla completa)
          const metricsRes = await crmApi.get(`/metrics/${encodeURIComponent(activeStoreId)}`);
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
          <ClientQuickAnalysisPanel client={client} quickOpen={quickOpen} setQuickOpen={setQuickOpen} />
        );

      case 'contact':
        return (
          <ClientContactCard client={client} tickets={tickets} />
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
          <ClientNotes
            client={client}
            isEditingNotes={isEditingNotes}
            setIsEditingNotes={setIsEditingNotes}
            notesText={notesText}
            setNotesText={setNotesText}
            onSave={handleSaveNotes}
          />
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
          <ClientHeader client={client} />

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
            <ClientModulesModal
              client={client}
              planKey={planKey}
              draftModules={draftModules}
              setDraftModules={setDraftModules}
              onSave={handleSaveModules}
              onReset={resetDraftToPlan}
              onClose={() => setShowModulesModal(false)}
            />
          )}

          {/* MODAL DE EDICIÓN */}
          {showEditModal && (
            <ClientEditModal
              editFormData={editFormData}
              setEditFormData={setEditFormData}
              onInputChange={handleEditInputChange}
              onLogoUpload={handleLogoUpload}
              onSubmit={handleSaveEdit}
              onClose={() => setShowEditModal(false)}
            />
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
