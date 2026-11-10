import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';
import { startVisiblePolling } from '../../utils/visiblePolling';

import MatrixEffect from './MatrixEffect';
import PixelPetWidget from './PixelPetWidget';
// Widgets del dashboard (antes en este mismo archivo) → ./dashboard/
import AnalogOdometer from './dashboard/AnalogOdometer';
import ClientLogo from './dashboard/ClientLogo';
import AnalyzerStatusWidget from './dashboard/AnalyzerStatusWidget';
import TopBarWidget from './dashboard/TopBarWidget';
import MyTicketsWidget from './dashboard/MyTicketsWidget';
import StoreMonitorWidget from './dashboard/StoreMonitorWidget';

function AdminDashboard() {
  const [stats, setStats] = useState({ tickets: 0, clients: 0 });
  const [planStats, setPlanStats] = useState({ go: 0, growth: 0, escale: 0, warranty: 0, leads: 0 });
  const [ticketStatusStats, setTicketStatusStats] = useState({}); 
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
const [aiBanner, setAiBanner] = useState({
    greeting: 'CARGANDO STATUS...',
    headline: 'Panel de Control Principal',
    subtext: 'Analizando tickets y clientes registrados en la base de datos...'
  });
  // Paginación a 11 elementos
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 11;

  // 🌟 NUEVOS ESTADOS PARA LOS TICKETS Y TIENDAS ASIGNADAS
  const [currentUser, setCurrentUser] = useState('');
  const [, setUserRole] = useState(''); 
  const [myTickets, setMyTickets] = useState([]);
  const [showMyStoresOnly, setShowMyStoresOnly] = useState(false); // 🌟 Filtro de Mis Tiendas

  // (se eliminó techStatus: datos fijos de Shopify/VTEX que no se mostraban en ningún lado)
  const dashboardRef = useRef(null); // <-- Agrega esto
const [isMatrixMode, setIsMatrixMode] = useState(false);
  useEffect(() => {
    let stopPolling; 

    // 🌟 1. CONSULTA DE IA: Se ejecuta SÓLO UNA VEZ al montar la pantalla (Cero gasto innecesario de tokens)
    crmApi.get('/ai/dashboard-summary')
      .then(res => {
        if (res.data?.success && res.data?.data) {
          setAiBanner(res.data.data);
        }
      })
      .catch(err => console.error("Error al cargar banner IA:", err));

    const dataInitialization = async () => {
          try {
            const token = localStorage.getItem('crm_token');
            let currentUserName = '';
            if (token) {
              const payload = JSON.parse(window.atob(token.split('.')[1]));
              currentUserName = payload.name || payload.email;
              setCurrentUser(currentUserName);
              setUserRole(payload.role);
              if (payload.role === 'client') {
                const clientsRes = await crmApi.get('/stores');
                const listaTiendas = clientsRes.data.data || clientsRes.data || [];
                const correoUsuario = String(payload.email).toLowerCase().trim();
                
                const miTienda = listaTiendas.find(store => {
                  const listaCorreos = String(store.emails).toLowerCase().split(/[\s,;]+/).map(e => e.trim());
                  return listaCorreos.includes(correoUsuario);
                });

                if (miTienda) {
                  navigate(`/admin/clientes/cuentacliente`, { replace: true });
                  return;
                } else {
                  alert('Error: Su cuenta de correo no coincide con ninguna de las credenciales autorizadas en las tiendas.');
                  localStorage.removeItem('crm_token');
                  navigate('/login', { replace: true });
                  return;
                }
              }
            }

            // 🌟 2. CONSULTAS A LA BD: Estas sí se actualizan en vivo sin gasto de IA
            const fetchData = async () => {
              try {
                // Conteos calculados en la base de datos (antes se descargaban todos los tickets)
                const [statsRes, clientsRes] = await Promise.all([
                  crmApi.get('/tickets/stats'),
                  crmApi.get('/stores')
                ]);
                
                if (statsRes.data.success && clientsRes.data.success) {
                  const ticketStats = statsRes.data.data || {};
                  const allStores = clientsRes.data.data || [];
                  const byStore = ticketStats.by_store || {};

                  setTicketStatusStats(ticketStats.by_status || {});
                  setMyTickets(ticketStats.mine || []);

              const storesWithRealCounts = allStores.map(store => ({
                ...store,
                real_ticket_count: byStore[store.id]?.total || 0, // histórico de la tabla
                active_ticket_count: byStore[store.id]?.active || 0, // abiertos/en progreso (widget W95)
                load_ms: store.load_ms || 0,
                ttfb_ms: store.ttfb_ms || 0
              }));

              const planesValidos = ['go', 'growth', 'escale', 'scale', 'scale_plus', 'warranty', 'leads', 'lead'];
              const counts = { go: 0, growth: 0, escale: 0, warranty: 0, leads: 0 };

              const clientesActivos = storesWithRealCounts.filter(client => {
                const planLimpio = String(client.plan_type || '').toLowerCase().trim();
                
                if (planLimpio === 'go') counts.go++;
                else if (planLimpio === 'growth') counts.growth++;
                else if (planLimpio === 'escale' || planLimpio === 'scale' || planLimpio === 'scale_plus') counts.escale++;
                else if (planLimpio === 'warranty') counts.warranty++;
                else if (planLimpio === 'leads' || planLimpio === 'lead') counts.leads++;

                return planesValidos.includes(planLimpio);
              });

              setStats({
                tickets: ticketStats.total || 0,
                clients: clientesActivos.length
              });

              setPlanStats(counts);
              setClients(storesWithRealCounts);
            }
          } catch (error) {
            console.error("Error en polling:", error);
          }
        };

        await fetchData();
        setLoading(false);

        // Polling cada 30 s, pausado si la pestaña no está visible
        stopPolling = startVisiblePolling(fetchData, 30000);

      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    
    dataInitialization();

    return () => {
      if (stopPolling) stopPolling();
    };
  }, [navigate]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredClients = clients
    .filter(client => {
      // 🌟 1. FILTRO DE TABS (Mis Tiendas vs Todas)
      if (showMyStoresOnly) {
        if (!client.assigned_to) return false;
        const asignados = String(client.assigned_to).toLowerCase().split(',').map(s => s.trim());
        if (!asignados.includes(currentUser.toLowerCase())) return false;
      }

      // 🌟 2. FILTRO DE BÚSQUEDA TEXTUAL
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        (client.name && client.name.toLowerCase().includes(query)) ||
        (client.web && client.web.toLowerCase().includes(query)) ||
        (client.plan_type && client.plan_type.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      if (sortConfig.key === 'real_ticket_count') {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  // Paginación a 11 elementos
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentClients = filteredClients.slice(indexOfFirstItem, indexOfLastItem);

  if (loading) return <div className="crm-text-loading">Cargando resumen...</div>;

  return (
    // 1. DIV CONTENEDOR PRINCIPAL: Se agrega el ref y posición relativa
    <div ref={dashboardRef} style={{ position: 'relative', width: '100%', minHeight: '100%' }}>
      
      {/* 🌟 AQUÍ HACES LA LLAMADA AL PIXEL PET */}
      <PixelPetWidget 
        ticketStatusStats={ticketStatusStats} 
        myTickets={myTickets} 
      />

      {isMatrixMode && <MatrixEffect targetRef={dashboardRef} />}

      {/* 3. ENVOLTURA DEL CONTENIDO: Esto oculta todo (opacity: 0) cuando se activa la Matrix */}
      <div style={{ opacity: isMatrixMode ? 0 : 1, transition: 'opacity 0.2s', pointerEvents: isMatrixMode ? 'none' : 'auto' }}>
        
        {/* 🌟 ENCABEZADO SIMÉTRICO CON CARD GRIS CLARO DE IA + WIDGETS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', borderBottom: '1px solid #e5e5e5', paddingBottom: '16px', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* TARJETA DE IA - ESTILO GRIS CLARO Y MISMA ALTURA/DISENO QUE LOS WIDGETS */}
          <div style={{ 
            flex: '1 1 400px', 
            minWidth: 0,
            backgroundColor: '#f8f9fa',
            color: '#111111',
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #c8c6c1',
            borderLeft: '4px solid #2563eb',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            fontFamily: "'Nunito', system-ui, sans-serif"
          }}>
            <span style={{ fontSize: '9px', fontWeight: '900', letterSpacing: '0.5px', color: '#666666', textTransform: 'uppercase', marginBottom: '1px' }}>
              {aiBanner.greeting}
            </span>
            <h1 className="crm-main-title" style={{ border: 'none', margin: 0, padding: 0, fontSize: '14px', fontWeight: 'bold', color: '#111111', lineHeight: '1.2' }}>
              {aiBanner.headline}
            </h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#555555', lineHeight: '1.3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {aiBanner.subtext}
            </p>
          </div>

          {/* WIDGETS DERECHOS */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch', flexWrap: 'wrap' }}>
            <AnalyzerStatusWidget />
            <TopBarWidget />
          </div>
        </div>
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* COLUMNA IZQUIERDA: CONTADORES + LISTA DE CLIENTES */}
        <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
          
          <div className="crm-grid-stats" style={{ marginBottom: 0 }}>
            {/* CARD: TICKETS TOTALES (VISIBLE PARA TODOS) */}
            <div className="crm-card-paper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', flex: 1 }}>
              <span className="crm-stat-label" style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px' }}>TICKETS TOTALES</span>
              
              <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <AnalogOdometer value={stats.tickets} digits={5} />
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {Object.entries(ticketStatusStats).map(([status, count]) => (
                    <span key={status} className="crm-badge" style={{ fontSize: '9px', padding: '2px 5px', backgroundColor: '#f0f0f0' }}>
                      {status}: <strong>{count}</strong>
                    </span>
                  ))}
                  {Object.keys(ticketStatusStats).length === 0 && (
                    <span className="crm-badge" style={{ fontSize: '9px', padding: '2px 5px', backgroundColor: '#f0f0f0' }}>SIN TICKETS</span>
                  )}
                </div>
              </div>
            </div>

            {/* CARD: CLIENTES ACTIVOS CON DESGROSE DE PLANES */}
            <div className="crm-card-paper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1 }}>
              <span className="crm-stat-label" style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px' }}>CLIENTES ACTIVOS</span>
              
              <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <AnalogOdometer value={stats.clients} digits={4} /> 
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span className="crm-badge" style={{ fontSize: '9px', padding: '2px 5px', backgroundColor: '#f0f0f0' }}>GO: <strong>{planStats.go}</strong></span>
                  <span className="crm-badge" style={{ fontSize: '9px', padding: '2px 5px', backgroundColor: '#f0f0f0' }}>GROWTH: <strong>{planStats.growth}</strong></span>
                  <span className="crm-badge" style={{ fontSize: '9px', padding: '2px 5px', backgroundColor: '#f0f0f0' }}>ESCALE: <strong>{planStats.escale}</strong></span>
                  <span className="crm-badge" style={{ fontSize: '9px', padding: '2px 5px', backgroundColor: '#f0f0f0' }}>WARRANTY: <strong>{planStats.warranty}</strong></span>
                  <span className="crm-badge" style={{ fontSize: '9px', padding: '2px 5px', backgroundColor: '#f0f0f0' }}>LEADS: <strong>{planStats.leads}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="crm-card-paper" style={{ margin: 0 }}>
            {/* Cabecera Principal con Botón a Tiendas */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h2 className="crm-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Lista General de Clientes</h2>
              <button 
                onClick={() => navigate('/admin/clientes')}
                style={{ padding: '6px 12px', backgroundColor: '#111', color: '#FFD700', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Ir a Gestión de Tiendas ↗
              </button>
            </div>

            {/* Fila de Controles: Tabs y Buscador */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              
              {/* 🌟 TABS DE FILTRADO DE TIENDAS */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => { setShowMyStoresOnly(false); setCurrentPage(1); }}
                  style={{ padding: '6px 12px', backgroundColor: !showMyStoresOnly ? '#111' : '#f3f4f6', color: !showMyStoresOnly ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  🏢 Todas las Tiendas
                </button>
                <button 
                  onClick={() => { setShowMyStoresOnly(true); setCurrentPage(1); }}
                  style={{ padding: '6px 12px', backgroundColor: showMyStoresOnly ? '#111' : '#f3f4f6', color: showMyStoresOnly ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  👤 Mis Tiendas Asignadas
                </button>
              </div>

              <input 
                type="text" 
                placeholder="🔍 Buscar por cliente o plan..." 
                value={searchQuery} 
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }} 
                className="crm-input-text"
                style={{ width: '250px' }}
              />
            </div>
            <div className="crm-table-container">
              <table className="crm-table-data">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Haz clic para ordenar por Nombre">
                      Nombre del Cliente {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                    </th>
                    <th>Sitio Web</th>
                    <th onClick={() => handleSort('plan_type')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Haz clic para ordenar por Plan">
                      Plan Contratado {sortConfig.key === 'plan_type' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                    </th>
                    <th onClick={() => handleSort('real_ticket_count')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Haz clic para ordenar por Tickets">
                      Tickets Creados {sortConfig.key === 'real_ticket_count' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentClients.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="crm-text-loading" style={{ textAlign: 'center', padding: '24px' }}>
                        No se encontraron clientes que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    currentClients.map(client => (
                      <tr key={client.id} className="crm-table-row-interactive" onClick={() => navigate(`/admin/clientes/${client.id}`)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* 🌟 MANEJADOR DE LOGOS CON FALLBACK Y COMPATIBILIDAD CON RUTA BACKEND */}
                            <ClientLogo url={client.logo_url} name={client.name} />
                            <strong>{client.name}</strong>
                          </div>
                        </td>
                        <td>{client.web || 'No asignada'}</td>
                        <td><span className="crm-badge">{client.plan_type}</span></td>
                        <td>
                          <strong>{client.real_ticket_count}</strong>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* CONTROLES DE PAGINACIÓN A 11 ELEMENTOS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #eeeeee', paddingTop: '12px' }}>
              <span style={{ fontSize: '12px', color: '#666' }}>
                Mostrando {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredClients.length)} de {filteredClients.length} clientes
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="crm-button-secondary"
                  style={{ padding: '4px 12px', fontSize: '12px', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  Anterior
                </button>
                <span style={{ fontSize: '12px', fontWeight: 'bold', padding: '0 8px' }}>
                  Página {currentPage} de {totalPages}
                </span>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="crm-button-secondary"
                  style={{ padding: '4px 12px', fontSize: '12px', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Siguiente
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* COLUMNA DERECHA: STATUS DE TECNOLOGÍAS */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 🌟 NUEVO WIDGET W95 */}
          <MyTicketsWidget myTickets={myTickets} navigate={navigate} />

          {/* 🌟 NUEVO MONITOR DE MÓDULOS W95 (VISIBLE PARA TODOS) */}
          <StoreMonitorWidget 
            clients={clients} 
            ticketStatusStats={ticketStatusStats} 
          />
                    
          {/* BOTÓN EASTER EGG */}
          <button 
            onClick={() => setIsMatrixMode(true)}
            style={{ 
              marginTop: '10px',
              padding: '8px', 
              backgroundColor: '#000000', 
              color: '#00FF41', 
              border: '1px solid #00FF41', 
              borderRadius: '6px', 
              cursor: 'pointer',
              fontFamily: "'Courier New', Courier, monospace",
              fontWeight: 'bold',
              opacity: 0.1, // Está casi oculto para que solo los curiosos lo vean
              transition: 'all 0.3s ease',
              boxShadow: '0 0 5px rgba(0, 255, 65, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 65, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.1';
              e.currentTarget.style.boxShadow = '0 0 5px rgba(0, 255, 65, 0.2)';
            }}
          >
            ¿Sistema Crítico?
          </button>
        </div>
        
      </div>
      </div>
    </div>
  );
}
export default AdminDashboard;