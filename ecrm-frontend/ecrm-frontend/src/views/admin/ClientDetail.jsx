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
// 🌟 SUBCOMPONENTE: Contador Odómetro Analógico (Tamaño Reducido)
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

  if (loadingInit) return <div className="crm-text-loading">Verificando credenciales corporativas...</div>;
  if (clientError) return (<div className="crm-card-paper" style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center' }}><h3>No se encontraron tiendas asignadas</h3></div>);

  return (
    <div>
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
      <div className="crm-actions-bar" style={{ marginBottom: '16px' }}>
        {userRole !== 'client' && <button onClick={() => navigate('/admin/clientes')} className="crm-btn-border">Volver a Clientes</button>}
        {(userRole === 'super admin' || userRole === 'admin') && client && !loadingDetails && <button onClick={openEditModal} className="crm-btn-black">Editar Datos del Cliente</button>}
      </div>

      {loadingDetails || !client ? (
        <div className="crm-text-loading">Cargando datos de la tienda...</div>
      ) : (
        <>
          <QuickAnalysis storeId={client.id} storeUrl={client.web} />

          {/* HEADER DE LA TIENDA */}
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

          {/* FILA 1: DATOS DE CONTACTO Y MONITOR EXTERNO */}
          <div className={(String(client.tecnologia).toLowerCase().match(/shopify|vtex|woo/) && (shopifyStatus || vtexStatus || wooStatus)) ? "crm-grid-two-columns" : ""} style={{ marginBottom: '24px' }}>
            
            {/* 🌟 NUEVA ESTRUCTURA DE DATOS DE CONTACTO */}
            <div className="crm-card-paper" style={{ margin: 0, height: '100%', boxSizing: 'border-box' }}>
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

            <ClientExternalMonitor 
              client={client} 
              shopifyStatus={shopifyStatus} 
              vtexStatus={vtexStatus} 
              wooStatus={wooStatus} 
            />
          </div>

          {/* COMPONENTES MODULARIZADOS: GRÁFICOS Y MÉTRICAS */}
          <div className="crm-grid-two-columns" style={{ marginTop: '24px' }}>
            <ClientPerformance metrics={metrics} />
            <ClientMemoryVu metrics={metrics} />
          </div>

          <div className="crm-grid-two-columns" style={{ marginTop: '24px' }}>
            <ClientTickets tickets={tickets} />
            <ClientMetricsHistory metrics={metrics} />
          </div>

          <div className="crm-card-paper" style={{ marginTop: '24px', width: '100%', boxSizing: 'border-box' }}>
            <h3 className="crm-section-title" style={{ marginTop: 0, marginBottom: '16px' }}>Control de Calidad y Revisiones Manuales</h3>
            <StoreReviewHistory storeId={client.id} />
          </div>

          {/* NOTAS INTERNAS */}
          {userRole !== 'client' && (
            <div className="crm-card-paper" style={{ marginTop: '24px', width: '100%', boxSizing: 'border-box' }}>
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
        </>
      )}
    </div>
  );
}

export default ClientDetail;