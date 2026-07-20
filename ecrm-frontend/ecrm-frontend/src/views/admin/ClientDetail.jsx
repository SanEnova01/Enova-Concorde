import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function ClientDetail() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  // Estados principales
  const [client, setClient] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientError, setClientError] = useState(false);

  // Estados para la edición de notas
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');

  // Estados para edición general
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});

  // Paginaciones Estrictas
  const [ticketCurrentPage, setTicketCurrentPage] = useState(1);
  const [metricCurrentPage, setMetricCurrentPage] = useState(1);
  
 // 🌟 ESTADOS PARA MONITORES EXTERNOS
  const [shopifyStatus, setShopifyStatus] = useState(null);
  const [vtexStatus, setVtexStatus] = useState(null);
  const [wooStatus, setWooStatus] = useState(null);
  
  const itemsPerPage = 5;

  // 🔒 EXTRACCIÓN MAESTRA DE SEGURIDAD
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

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        setLoading(true);
        setClientError(false);
        
        let targetStoreId = storeId;

        // 🛡️ CORTAFUEGOS MULTI-TENANT
        if (userRole === 'client') {
          if (storeId !== 'cuentacliente') {
            alert('Acceso Denegado: No tiene autorización para forzar esta consulta.');
            localStorage.removeItem('crm_token');
            navigate('/login', { replace: true });
            return;
          }

          const storesRes = await crmApi.get('/stores');
          const listaTiendas = storesRes.data.data || storesRes.data || [];
          const correoLimpio = String(userEmail).toLowerCase().trim();

          const miTiendaReal = listaTiendas.find(store => {
            const listaCorreos = String(store.emails).toLowerCase().split(/[\s,;]+/).map(e => e.trim());
            return listaCorreos.includes(correoLimpio);
          });

          if (!miTiendaReal) {
            alert('Su cuenta no tiene asignado ningún perfil activo.');
            setClientError(true);
            setLoading(false);
            return;
          }
          
          targetStoreId = miTiendaReal.id;
        }

        const clientRes = await crmApi.get(`/stores/${targetStoreId}`);
        const clientData = clientRes.data.data || clientRes.data; 
        
        if (clientData) {
          setClient(clientData);
          setNotesText(clientData.notes || '');
        } else {
          setClientError(true);
          setLoading(false);
          return;
        }

        try {
          const ticketsRes = await crmApi.get('/tickets');
          const ticketsList = Array.isArray(ticketsRes.data) ? ticketsRes.data : (ticketsRes.data.data || []);
          setTickets(ticketsList.filter(t => String(t.store_id) === String(targetStoreId)));
        } catch (ticketError) {
          console.error('Error secundario al cargar tickets:', ticketError);
        }

        try {
          const metricsRes = await crmApi.get('/metrics');
          const metricsList = Array.isArray(metricsRes.data) ? metricsRes.data : (metricsRes.data.data || []);
          
          const filteredMetrics = metricsList
            .filter(m => String(m.store_id) === String(targetStoreId))
            .sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at));
            
          setMetrics(filteredMetrics);
        } catch (metricError) {
          console.error('Error secundario al cargar métricas:', metricError);
        }

        // 🌟 🛍️ NUEVO BLOQUE: INTERCEPTAR ESTADO DE SHOPIFY, VTEX O WOOCOMMERCE
        if (clientData) {
          const techDetectada = String(clientData.tecnologia).toLowerCase();
          
          if (techDetectada.includes('shopify')) {
            try {
              const shopifyRes = await crmApi.get('/external/shopify-status');
              if (shopifyRes.data?.success) setShopifyStatus(shopifyRes.data);
            } catch (err) { console.error('Error Shopify:', err); }
          } 
          else if (techDetectada.includes('vtex')) {
            try {
              const vtexRes = await crmApi.get('/external/vtex-status');
              if (vtexRes.data?.success) setVtexStatus(vtexRes.data);
            } catch (err) { console.error('Error VTEX:', err); }
          }
          else if (techDetectada.includes('woo')) {
            try {
              const wooRes = await crmApi.get(`/external/woocommerce-status?url=${encodeURIComponent(clientData.web)}`);
              if (wooRes.data?.success) setWooStatus(wooRes.data);
            } catch (err) { console.error('Error WooCommerce Status:', err); }
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error principal en el servidor:', error);
        setClientError(true);
        setLoading(false);
      }
    };
    fetchClientData();
  }, [storeId, navigate, userRole, userEmail]);

  const getLogoUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const apiBase = crmApi.defaults.baseURL || '';
    const domain = apiBase.replace(/\/api$/, ''); 
    return `${domain}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const handleSaveNotes = async () => {
    try {
      const response = await crmApi.patch(`/stores/${client.id}`, { notes: notesText });
      if (response.data.success || response.status === 200) {
        setClient(prev => ({ ...prev, notes: notesText }));
        setIsEditingNotes(false);
      } else {
        alert('No se pudieron guardar los cambios en las notas.');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión al actualizar las notas.');
    }
  };

  const openEditModal = () => {
    setEditFormData({
      name: client.name || '',
      web: client.web || '',
      emails: client.emails || '',
      phone: client.phone || '',
      plan_type: client.plan_type || 'GO',
      tecnologia: client.tecnologia || '',
      logo_url: client.logo_url || '',
      has_cooppilot: client.has_cooppilot || false // 👈 AGREGAR ESTA LÍNEA
    });
    setShowEditModal(true);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('logo', file);

    try {
      const response = await crmApi.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setEditFormData(prev => ({ ...prev, logo_url: response.data.url }));
        alert('Imagen subida exitosamente.');
      }
    } catch (error) {
      console.error("Error al subir el logo:", error);
      alert('Error del servidor: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editFormData.name.trim()) {
      alert('El nombre de la tienda es obligatorio.');
      return;
    }

    try {
      const response = await crmApi.patch(`/stores/${client.id}`, editFormData);
      if (response.data.success || response.status === 200) {
        setClient(prev => ({ ...prev, ...editFormData }));
        setShowEditModal(false);
        alert('Datos actualizados con éxito.');
      }
    } catch (error) {
      console.error(error);
      alert('Error al guardar los cambios.');
    }
  };

  if (loading) return <div className="crm-text-loading">Cargando perfil de cliente...</div>;
  
  if (clientError || !client) {
    return (
      <div className="crm-card-paper" style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center' }}>
        <h3>Cliente no encontrado</h3>
        <p className="crm-text-muted">El identificador no corresponde a ninguna tienda registrada.</p>
        {userRole !== 'client' && (
          <button onClick={() => navigate('/admin/clientes')} className="crm-btn-black" style={{ marginTop: '16px' }}>
            Volver al listado
          </button>
        )}
      </div>
    );
  }

  const indexOfLastTicket = ticketCurrentPage * itemsPerPage;
  const indexOfFirstTicket = indexOfLastTicket - itemsPerPage;
  const currentTickets = tickets.slice(indexOfFirstTicket, indexOfLastTicket);
  const totalTicketPages = Math.ceil(tickets.length / itemsPerPage) || 1;

  const indexOfLastMetric = metricCurrentPage * itemsPerPage;
  const indexOfFirstMetric = indexOfLastMetric - itemsPerPage;
  const currentMetrics = metrics.slice(indexOfFirstMetric, indexOfLastMetric);
  const totalMetricPages = Math.ceil(metrics.length / itemsPerPage) || 1;

  // 🌟 CONFIGURACIÓN GRÁFICA TIEMPOS (LINEAS)
  const chartMetrics = metrics.slice(-8); 
  const viewW = 650;
  const viewH = 220;
  const padL = 50; 
  const padR = 40; 
  const padT = 30; 
  const padB = 40; 
  
  const graphW = viewW - padL - padR;
  const graphH = viewH - padT - padB;

  const maxTime = Math.max(
    ...chartMetrics.flatMap(m => [
      (Number(m.load_ms) / 1000) || 0,
      (Number(m.dom_ms) / 1000) || 0
    ]), 
    1
  );

  const getX = (index) => padL + (index * graphW) / Math.max(chartMetrics.length - 1, 1);
  const getYTime = (val) => viewH - padB - ((Number(val) || 0) / maxTime) * graphH;

  const loadPoints = chartMetrics.map((m, i) => `${getX(i)},${getYTime(m.load_ms / 1000)}`).join(' ');
  const domPoints = chartMetrics.map((m, i) => `${getX(i)},${getYTime(m.dom_ms / 1000)}`).join(' ');

  // 🌟 CONFIGURACIÓN DE LOS DOS VÚMETROS
  const latestMetric = chartMetrics[chartMetrics.length - 1] || {};
  
  const latestRamCore = Number(latestMetric.ram_core_mb) || 0;
  const vuCoreMax = Math.max(200, ...chartMetrics.map(m => Number(m.ram_core_mb) || 0)); 
  const needleCoreAngle = Math.min((latestRamCore / vuCoreMax) * 180, 180) - 90; 

  const latestRamTotal = Number(latestMetric.ram_total_mb) || 0;
  const vuTotalMax = Math.max(500, ...chartMetrics.map(m => Number(m.ram_total_mb) || 0)); 
  const needleTotalAngle = Math.min((latestRamTotal / vuTotalMax) * 180, 180) - 90; 

 // 🌟 CONTROLADOR DEL MONITOR EXTERNO (100% AUTÓNOMO SIN PLUGINS)
  const techStr = client ? String(client.tecnologia).toLowerCase() : '';
  const showShopifyWidget = techStr.includes('shopify') && shopifyStatus;
  const showVtexWidget = techStr.includes('vtex') && vtexStatus;
  const showWooWidget = techStr.includes('woo'); 

  const showExternalMonitor = showShopifyWidget || showVtexWidget || showWooWidget;

// Si aún está cargando la respuesta del proxy, pintamos el esqueleto con las nuevas métricas externas
  const activeMonitor = showShopifyWidget 
    ? shopifyStatus 
    : showVtexWidget 
      ? vtexStatus 
      : (wooStatus || {
          global: { status: 'Analizando conexión con la tienda...', indicator: 'minor' },
          components: [
            { name: 'Resolución de DNS y SSL', status: 'under_maintenance' },
            { name: 'Tiempo de Respuesta (TTFB)', status: 'under_maintenance' },
            { name: 'Estabilidad de Base de Datos', status: 'under_maintenance' },
            { name: 'Núcleo de Aplicación (PHP)', status: 'under_maintenance' }
          ]
        });
      
  const activeMonitorName = showShopifyWidget 
    ? 'Ecosistema Shopify Inc.' 
    : showVtexWidget 
      ? 'Plataforma VTEX Global' 
      : 'Monitoreo Externo WooCommerce';

  return (
    <div>
      <div className="crm-actions-bar" style={{ marginBottom: '16px' }}>
        {userRole !== 'client' && (
          <button onClick={() => navigate('/admin/clientes')} className="crm-btn-border">Volver a Clientes</button>
        )}
        
        {(userRole === 'super admin' || userRole === 'admin') && (
          <button onClick={openEditModal} className="crm-btn-black">Editar Datos del Cliente</button>
        )}
      </div>

      <div className="crm-card-paper" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ width: '64px', height: '64px', backgroundColor: '#f2f1ec', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #111111', overflow: 'hidden', flexShrink: 0 }}>
          {client.logo_url ? (
            <img src={getLogoUrl(client.logo_url)} alt={`Logo de ${client.name}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>LOGO</span>
          )}
        </div>
        
        {/* 🌟 CONTENEDOR PRINCIPAL DEL HEADER MODIFICADO */}
        <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          
          {/* Lado Izquierdo: Nombre e ID */}
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'normal' }}>{client.name}</h1>
            <p className="crm-text-muted" style={{ margin: '4px 0 0 0' }}>ID de registro: {client.id}</p>
          </div>

          {/* Lado Derecho: Columna de Badges (Plan y Tecnología) */}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
        <span className="crm-badge">Plan: {client.plan_type}</span>
        
        {/* 🌟 LÓGICA AUTO-DETECTABLE DEL ÍCONO DE TECNOLOGÍA (SOLO EL LOGO LIMPIO) */}
{(() => {
  const tech = String(client.tecnologia || '').toLowerCase();
  
  if (tech.includes('shopify')) {
    return (
      <img src="/assets/shopify-icon.png" alt="Shopify" title="Shopify" style={{ height: '40px', width: 'auto', objectFit: 'contain', marginTop: '4px' }} />
    );
  }
  if (tech.includes('woo')) {
    return (
      <img src="/assets/woo-icon.png" alt="WooCommerce" title="WooCommerce" style={{ height: '60px', width: 'auto', objectFit: 'contain', marginTop: '4px' }} />
    );
  }
  if (tech.includes('vtex')) {
    return (
      <img src="/assets/vtex-icon.png" alt="VTEX" title="VTEX" style={{ height: '70px', width: 'auto', objectFit: 'contain', marginTop: '4px' }} />
    );
  }
  if (client.tecnologia) {
    // Fallback: Si es una tecnología distinta que no tiene ícono, mostramos el texto en gris
    return (
      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#666666', textTransform: 'uppercase', marginTop: '4px' }} title={client.tecnologia}>
        {client.tecnologia}
      </span>
    );
  }
  return null;
})()}

      </div>
        </div>
      </div>

      {/* 🌟 FILA 1: DATOS DE CONTACTO Y STATUS (LADO A LADO SI HAY MONITOR) */}
      <div className={showExternalMonitor ? "crm-grid-two-columns" : "crm-card-paper"} style={{ marginBottom: '24px', padding: showExternalMonitor ? 0 : undefined, border: showExternalMonitor ? 'none' : undefined, backgroundColor: showExternalMonitor ? 'transparent' : undefined}}>
        
        <div className="crm-card-paper" style={{ height: '100%', boxSizing: 'border-box' }}>
          <h3 className="crm-section-title" style={{ marginTop: 0 }}>Datos de Contacto</h3>
          <p className="crm-text-muted"><strong>Sitio Web:</strong> {client.web ? <a href={client.web} target="_blank" rel="noreferrer" style={{ color: '#111111' }}>{client.web}</a> : 'No registrado'}</p>
          <p className="crm-text-muted"><strong>Tecnología:</strong> {client.tecnologia || 'No registrada'}</p>
          <p className="crm-text-muted"><strong>Correos:</strong> {client.emails || 'No registrados'}</p>
          <p className="crm-text-muted"><strong>Teléfono:</strong> {client.phone || 'No registrado'}</p>
          <p className="crm-text-muted"><strong>Contador de Soportes:</strong> {client.ticket_count || 0} creados en total</p>
          {client.has_cooppilot && (
  <p className="crm-text-muted" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
    <strong>CoopPilot (IA):</strong>
    <span style={{ 
      backgroundColor: '#111111', 
      color: '#FFD700', 
      padding: '2px 8px', 
      borderRadius: '4px', 
      fontWeight: 'bold', 
      fontSize: '11px',
      letterSpacing: '0.5px',
      border: '1px solid #FFD700',
      display: 'inline-block'
    }}>
      ✨ CoopPilot Activo
    </span>
  </p>
)}
        </div>

        {showExternalMonitor && (
          <div className="crm-card-paper" style={{ height: '100%', boxSizing: 'border-box' }}>
            <div style={{ 
              padding: '16px', 
              borderRadius: '8px', 
              backgroundColor: '#ffffff', 
              border: '1px solid #cccccc',
              fontFamily: 'system-ui, sans-serif',
              boxSizing: 'border-box',
              height: '100%'
            }}>
              {/* Encabezado Global Dinámico */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                borderBottom: '1px dotted #111111',
                paddingBottom: '12px',
                marginBottom: '14px'
              }}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Infraestructura Externa</span>
                  <h4 style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: 'bold', color: '#111111' }}>
                    {activeMonitorName}: {activeMonitor.global?.status}
                  </h4>
                </div>
                <span style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  backgroundColor: activeMonitor.global?.indicator === 'none' ? '#16a34a' : '#dc2626',
                  display: 'inline-block',
                  boxShadow: activeMonitor.global?.indicator === 'none' ? '0 0 8px #16a34a' : '0 0 8px #dc2626'
                }}></span>
              </div>

              {/* Grilla de Componentes Individuales */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                gap: '10px',
                maxHeight: '280px',
                overflowY: 'auto',
                paddingRight: '4px'
              }}>
                {(activeMonitor.components || []).map((comp, idx) => {
                  let statusLabel = 'Operativo';
                  let statusColor = '#16a34a'; 
                  let statusBg = '#f0fdf4';
                  let statusIcon = '✓';

                  if (comp.status === 'degraded_performance') {
                    statusLabel = 'Rendimiento deficiente';
                    statusColor = '#eab308'; 
                    statusBg = '#fef9c3';
                    statusIcon = '➖';
                  } else if (comp.status === 'partial_outage') {
                    statusLabel = 'Interrupción parcial';
                    statusColor = '#f97316'; 
                    statusBg = '#ffedd5';
                    statusIcon = '⚠️';
                  } else if (comp.status === 'major_outage') {
                    statusLabel = 'Interrupción importante';
                    statusColor = '#dc2626'; 
                    statusBg = '#fef2f2';
                    statusIcon = '❌';
                  } else if (comp.status === 'under_maintenance') {
                    statusLabel = 'Mantenimiento';
                    statusColor = '#2563eb'; 
                    statusBg = '#eff6ff';
                    statusIcon = '🔧';
                  }

                  return (
                    <div key={idx} style={{ 
                      padding: '10px', 
                      borderRadius: '6px', 
                      backgroundColor: '#fcfbfa', 
                      border: '1px solid #e5e5e5',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '6px'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={comp.name}>
                        {comp.name}
                      </span>
                      
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        backgroundColor: statusBg,
                        width: 'fit-content'
                      }}>
                        <span style={{ fontSize: '10px', color: statusColor, fontWeight: 'bold' }}>{statusIcon}</span>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: statusColor }}>{statusLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🌟 FILA 2: RENDIMIENTO Y GRÁFICOS */}
      <div className="crm-grid-two-columns" style={{ marginTop: '24px' }}>
        <div className="crm-card-paper">
          <h2 className="crm-section-title" style={{ marginTop: 0 }}>Rendimiento: Tiempos de Carga (Segundos)</h2>
          {chartMetrics.length < 2 ? (
            <p className="crm-text-muted" style={{ textAlign: 'center', padding: '32px 0' }}>Inserta al menos 2 registros de métricas en la base de datos para trazar las líneas de tendencia.</p>
          ) : (
            <div>
              <div style={{ width: '100%', overflowX: 'auto', backgroundColor: '#fcfbfa', border: '1px solid #cccccc', padding: '10px 0' }}>
                <svg viewBox={`0 0 ${viewW} ${viewH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                  <line x1={padL} y1={padT} x2={viewW - padR} y2={padT} stroke="#e5e5e5" strokeWidth="1" strokeDasharray="3,3" />
                  <line x1={padL} y1={padT + graphH / 2} x2={viewW - padR} y2={padT + graphH / 2} stroke="#e5e5e5" strokeWidth="1" strokeDasharray="3,3" />
                  <line x1={padL} y1={viewH - padB} x2={viewW - padR} y2={viewH - padB} stroke="#111111" strokeWidth="1.5" />
                  <line x1={padL} y1={padT} x2={padL} y2={viewH - padB} stroke="#111111" strokeWidth="1.5" />

                  <polyline fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="4,4" points={domPoints} />
                  <polyline fill="none" stroke="#16a34a" strokeWidth="3" points={loadPoints} />

                  {chartMetrics.map((m, i) => {
                    const cx = getX(i);
                    const dateStr = m.date ? new Date(m.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) : '04/06';
                    const loadInSeconds = m.load_ms !== null && m.load_ms !== undefined ? (m.load_ms / 1000) : 0;
                    const domInSeconds = m.dom_ms !== null && m.dom_ms !== undefined ? (m.dom_ms / 1000) : 0;
                    
                    return (
                      <g key={m.id}>
                        <circle cx={cx} cy={getYTime(domInSeconds)} r="4" fill="#2563eb" />
                        <circle cx={cx} cy={getYTime(loadInSeconds)} r="5" fill="#16a34a" />

                        <text x={cx} y={viewH - 15} textAnchor="middle" style={{ fontSize: '10px', fontFamily: 'monospace', fill: '#555555' }}>
                          {dateStr}
                        </text>
                        <text x={cx} y={getYTime(loadInSeconds) - 12} textAnchor="middle" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#16a34a' }}>
                          {m.load_ms !== null ? `${loadInSeconds.toFixed(2)}s` : ''}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div style={{ display: 'flex', gap: '24px', marginTop: '14px', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '24px', height: '0px', borderTop: '3px solid #16a34a', display: 'inline-block' }}></span> 
                  <strong>Tiempo Carga (Load)</strong> <span style={{ color: '#666666' }}>(Pico: {maxTime.toFixed(2)}s)</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '24px', height: '0px', borderTop: '2px dashed #2563eb', display: 'inline-block' }}></span> 
                  <strong>Tiempo DOM</strong>
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="crm-card-paper">
          <h2 className="crm-section-title" style={{ marginTop: 0 }}>Memoria JS Heap (Navegador Cliente)</h2>
          <p className="crm-text-muted" style={{ fontSize: '11px', marginBottom: '16px' }}>
            Mide el peso del código ejecutado en el dispositivo del cliente. Valores altos indican riesgo de cierres en móviles.
          </p>
          
          {chartMetrics.length === 0 ? (
            <p className="crm-text-muted" style={{ textAlign: 'center', padding: '32px 0' }}>Inserta métricas para generar este gráfico.</p>
          ) : (
            <div>
              <style>
                {`
                  @keyframes needleVibrate {
                    0% { transform: rotate(-0.6deg); }
                    25% { transform: rotate(0.8deg); }
                    50% { transform: rotate(-0.3deg); }
                    75% { transform: rotate(0.6deg); }
                    100% { transform: rotate(0deg); }
                  }
                `}
              </style>

              <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px' }}>
                <div style={{ flex: 1, minWidth: '200px', backgroundColor: '#fcfbfa', border: '1px solid #cccccc', padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#111111', textTransform: 'uppercase' }}>RAM Core (Motor JS)</h4>
                  <svg viewBox="0 0 650 280" style={{ width: '100%', maxWidth: '300px', height: 'auto', display: 'block', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="vuGradientCore" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#16a34a" /> 
                        <stop offset="50%" stopColor="#eab308" />
                        <stop offset="75%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#dc2626" />
                      </linearGradient>
                    </defs>

                    <path d="M 125 200 A 200 200 0 0 1 525 200" fill="none" stroke="#e5e5e5" strokeWidth="30" strokeLinecap="round" />
                    <path d="M 125 200 A 200 200 0 0 1 525 200" fill="none" stroke="url(#vuGradientCore)" strokeWidth="30" strokeLinecap="round" />

                    <text x="125" y="240" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 'bold', fill: '#16a34a' }}>0</text>
                    <text x="325" y="40" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 'bold', fill: '#eab308' }}>{Math.round(vuCoreMax / 2)}</text>
                    <text x="525" y="240" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 'bold', fill: '#dc2626' }}>{Math.round(vuCoreMax)}</text>

                    <g transform={`rotate(${needleCoreAngle}, 325, 200)`} style={{ transition: 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                      <g style={{ transformOrigin: '325px 200px', animation: 'needleVibrate 0.1s infinite linear alternate' }}>
                        <polygon points="321,200 325,50 329,200" fill="#111111" />
                        <circle cx="325" cy="200" r="14" fill="#111111" />
                        <circle cx="325" cy="200" r="5" fill="#ffffff" />
                      </g>
                    </g>
                    
                    <text x="325" y="165" textAnchor="middle" style={{ fontSize: '46px', fontWeight: 'bold', fill: '#111111' }}>{latestRamCore.toFixed(1)}</text>
                    <text x="325" y="120" textAnchor="middle" style={{ fontSize: '13px', fill: '#666666', letterSpacing: '1px' }}>MB Actuales</text>
                  </svg>
                </div>

                <div style={{ flex: 1, minWidth: '200px', backgroundColor: '#fcfbfa', border: '1px solid #cccccc', padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#111111', textTransform: 'uppercase' }}>RAM Total (Pestaña)</h4>
                  <svg viewBox="0 0 650 280" style={{ width: '100%', maxWidth: '300px', height: 'auto', display: 'block', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="vuGradientTotal" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#16a34a" /> 
                        <stop offset="40%" stopColor="#eab308" />
                        <stop offset="80%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#dc2626" />
                      </linearGradient>
                    </defs>

                    <path d="M 125 200 A 200 200 0 0 1 525 200" fill="none" stroke="#e5e5e5" strokeWidth="30" strokeLinecap="round" />
                    <path d="M 125 200 A 200 200 0 0 1 525 200" fill="none" stroke="url(#vuGradientTotal)" strokeWidth="30" strokeLinecap="round" />

                    <text x="125" y="240" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 'bold', fill: '#16a34a' }}>0</text>
                    <text x="325" y="40" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 'bold', fill: '#eab308' }}>{Math.round(vuTotalMax / 2)}</text>
                    <text x="525" y="240" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 'bold', fill: '#dc2626' }}>{Math.round(vuTotalMax)}</text>

                    <g transform={`rotate(${needleTotalAngle}, 325, 200)`} style={{ transition: 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                      <g style={{ transformOrigin: '325px 200px', animation: 'needleVibrate 0.1s infinite linear alternate' }}>
                        <polygon points="321,200 325,50 329,200" fill="#111111" />
                        <circle cx="325" cy="200" r="14" fill="#111111" />
                        <circle cx="325" cy="200" r="5" fill="#ffffff" />
                      </g>
                    </g>
                    
                    <text x="325" y="165" textAnchor="middle" style={{ fontSize: '46px', fontWeight: 'bold', fill: '#111111' }}>{latestRamTotal.toFixed(1)}</text>
                    <text x="325" y="120" textAnchor="middle" style={{ fontSize: '13px', fill: '#666666', letterSpacing: '1px' }}>MB Actuales</text>
                  </svg>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px', fontSize: '12px' }}>
                <span style={{ color: '#666666', textAlign: 'center' }}>
                  Mostrando el estado del <strong>último registro procesado</strong> ({latestMetric.date ? new Date(latestMetric.date).toLocaleDateString() : 'Hoy'}).
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🌟 FILA 3: TICKETS Y REGISTROS HISTÓRICOS */}
      <div className="crm-grid-two-columns" style={{ marginTop: '24px' }}>
        <div className="crm-card-paper">
          <h2 className="crm-section-title" style={{ marginTop: 0 }}>Tickets de Soporte Técnico</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '260px' }}>
            {currentTickets.length === 0 ? (
              <p className="crm-text-muted">No cuenta con registros de soporte abiertos actualmente.</p>
            ) : (
              currentTickets.map(ticket => (
                <div 
                  key={ticket.id} 
                  onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                  className="crm-table-row-interactive"
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', border: '1px solid #cccccc', backgroundColor: '#fcfbfa', cursor: 'pointer' }}
                >
                  <div>
                    <span style={{ fontSize: '11px', color: '#555555', fontWeight: 'bold' }}>{ticket.serial_number}</span>
                    <h4 style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: 'normal' }}>{ticket.name}</h4>
                  </div>
                  <div>
                    <span className="crm-badge">{ticket.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {totalTicketPages > 1 && (
            <div className="crm-pagination-box" style={{ marginTop: '16px' }}>
              <button disabled={ticketCurrentPage === 1} onClick={() => setTicketCurrentPage(prev => prev - 1)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>Anterior</button>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{ticketCurrentPage} / {totalTicketPages}</span>
              <button disabled={ticketCurrentPage === totalTicketPages} onClick={() => setTicketCurrentPage(prev => prev + 1)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>Siguiente</button>
            </div>
          )}
        </div>

        <div className="crm-card-paper">
          <h2 className="crm-section-title" style={{ marginTop: 0 }}>Registros Históricos de Actividad</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '260px', overflowX: 'auto' }}>
            {currentMetrics.length === 0 ? (
              <p className="crm-text-muted">No cuenta con métricas diarias registradas.</p>
            ) : (
              <table className="crm-table-data" style={{ minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Req</th>
                    <th>Peso</th>
                    <th>RAM Core</th>
                    <th>RAM Total</th>
                    <th>Load</th>
                    <th>DOM</th>
                  </tr>
                </thead>
                <tbody>
                  {currentMetrics.map(metric => (
                    <tr key={metric.id}>
                      <td>{metric.date ? new Date(metric.date).toLocaleDateString() : (metric.created_at ? new Date(metric.created_at).toLocaleDateString() : '—')}</td>
                      <td>{metric.total_requests || '—'}</td>
                      <td>{metric.total_weight_mb !== null && metric.total_weight_mb !== undefined ? `${metric.total_weight_mb} MB` : '—'}</td>
                      <td>{metric.ram_core_mb !== null && metric.ram_core_mb !== undefined ? `${metric.ram_core_mb} MB` : '—'}</td>
                      <td>{metric.ram_total_mb !== null && metric.ram_total_mb !== undefined ? `${metric.ram_total_mb} MB` : '—'}</td>
                      <td>{metric.load_ms !== null && metric.load_ms !== undefined ? `${(metric.load_ms / 1000).toFixed(2)}s` : '—'}</td>
                      <td>{metric.dom_ms !== null && metric.dom_ms !== undefined ? `${(metric.dom_ms / 1000).toFixed(2)}s` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {totalMetricPages > 1 && (
            <div className="crm-pagination-box" style={{ marginTop: '16px' }}>
              <button disabled={metricCurrentPage === 1} onClick={() => setMetricCurrentPage(prev => prev - 1)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>Anterior</button>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{metricCurrentPage} / {totalMetricPages}</span>
              <button disabled={metricCurrentPage === totalMetricPages} onClick={() => setMetricCurrentPage(prev => prev + 1)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>Siguiente</button>
            </div>
          )}
        </div>
      </div>

      {/* 🌟 FILA 4: NOTAS INTERNAS (AL FINAL DE TODO Y FULL WIDTH) */}
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
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              className="crm-input-text"
              style={{ width: '100%', height: '100px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'none' }}
            />
          ) : (
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
              {client.notes || 'Sin anotaciones particulares sobre este cliente.'}
            </p>
          )}
        </div>
      )}

      {showEditModal && (
        <div className="crm-modal-mask" onClick={() => setShowEditModal(false)}>
          <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="crm-section-title" style={{ marginTop: 0 }}>Editar Datos del Cliente</h3>
            
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Nombre del Cliente / Tienda</label>
                <input type="text" name="name" value={editFormData.name} onChange={handleEditInputChange} className="crm-input-text" style={{ width: 'auto' }} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Sitio Web</label>
                  <input type="url" name="web" value={editFormData.web} onChange={handleEditInputChange} className="crm-input-text" style={{ width: 'auto' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Teléfono</label>
                  <input type="text" name="phone" value={editFormData.phone} onChange={handleEditInputChange} className="crm-input-text" style={{ width: 'auto' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Correos de contacto</label>
                  <input type="text" name="emails" value={editFormData.emails} onChange={handleEditInputChange} className="crm-input-text" style={{ width: 'auto' }} />
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
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="crm-input-text" style={{ width: 'auto', padding: '5px' }} />
                {editFormData.logo_url && (
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>
                    ✓ Logo cargado ({editFormData.logo_url.split('/').pop()})
                  </span>
                )}
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', padding: '10px', backgroundColor: '#f9f9f6', border: '1px solid #ccc', borderRadius: '4px' }}>
                <input 
                  type="checkbox" 
                  name="has_cooppilot"
                  id="has_cooppilot_checkbox"
                  checked={!!editFormData.has_cooppilot} 
                  onChange={(e) => setEditFormData(prev => ({ ...prev, has_cooppilot: e.target.checked }))}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="has_cooppilot_checkbox" className="crm-stat-label" style={{ cursor: 'pointer', margin: 0, fontWeight: 'bold' }}>
                  🚀 Habilitar Servicio CoopPilot (IA & Postventa)
                </label>
              </div>

              <div className="crm-pagination-box" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
                <button type="submit" className="crm-btn-black">Guardar Cambios</button>
                <button type="button" onClick={() => setShowEditModal(false)} className="crm-btn-red">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientDetail;