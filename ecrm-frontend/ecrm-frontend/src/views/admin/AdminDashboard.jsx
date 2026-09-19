import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

// 🌟 Importación de logos
import wooIcon from '../../assets/woo-icon.png';
import vtexIcon from '../../assets/vtex-icon.png';
import shopifyIcon from '../../assets/shopify-icon.png';

// 🌟 SUBCOMPONENTE: Widget de Monitoreo con soporte para Logo
const StatusWidget = ({ title, data, icon }) => {
  if (!data) return <div className="crm-card-paper" style={{ padding: '16px' }}><div className="crm-text-loading">Cargando {title}...</div></div>;

  const isOperational = data.global?.indicator === 'none';

  return (
    <div className="crm-card-paper" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dotted #111111', paddingBottom: '12px', marginBottom: '14px' }}>
        
        {/* Contenedor del Logo y los Títulos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {icon && (
            <img 
              src={icon} 
              alt={`Logo de ${title}`} 
              style={{ width: '28px', height: '28px', objectFit: 'contain', flexShrink: 0 }} 
            />
          )}
          <div>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Infraestructura Externa</span>
            <h4 style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: 'bold', color: '#111111' }}>
              {title}: {data.global?.status}
            </h4>
          </div>
        </div>

        {/* Indicador de Estado (Punto Verde/Rojo) */}
        <span style={{ 
          width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
          backgroundColor: isOperational ? '#16a34a' : '#dc2626',
          boxShadow: isOperational ? '0 0 8px #16a34a' : '0 0 8px #dc2626'
        }}></span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
        {(data.components || []).map((comp, idx) => {
          let statusLabel = 'Operativo';
          let statusColor = '#16a34a'; 
          let statusBg = '#f0fdf4';
          let statusIcon = '✓';

          if (comp.status === 'degraded_performance') {
            statusLabel = 'Rendimiento deficiente';
            statusColor = '#eab308'; statusBg = '#fef9c3'; statusIcon = '➖';
          } else if (comp.status === 'partial_outage') {
            statusLabel = 'Interrupción parcial';
            statusColor = '#f97316'; statusBg = '#ffedd5'; statusIcon = '⚠️';
          } else if (comp.status === 'major_outage') {
            statusLabel = 'Interrupción importante';
            statusColor = '#dc2626'; statusBg = '#fef2f2'; statusIcon = '❌';
          } else if (comp.status === 'under_maintenance' || comp.status === 'maintenance') {
            statusLabel = 'Mantenimiento';
            statusColor = '#2563eb'; statusBg = '#eff6ff'; statusIcon = '🔧';
          }

          return (
            <div key={idx} style={{ 
              padding: '8px 10px', borderRadius: '6px', backgroundColor: '#fcfbfa', 
              border: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={comp.name}>
                {comp.name}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '4px', backgroundColor: statusBg }}>
                <span style={{ fontSize: '10px', color: statusColor, fontWeight: 'bold' }}>{statusIcon}</span>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: statusColor }}>{statusLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


function AdminDashboard() {
  const [stats, setStats] = useState({ tickets: 0, clients: 0 });
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Estados para Búsqueda y Ordenamiento
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Estado para Status de Tecnologías
  const [techStatus, setTechStatus] = useState({
    shopify: {
      global: { status: 'Todos los sistemas operativos', indicator: 'none' },
      components: [
        { name: 'Shopify Checkout', status: 'operational' },
        { name: 'Shopify Admin', status: 'operational' },
        { name: 'Storefront', status: 'operational' },
        { name: 'Third-party apps', status: 'operational' }
      ]
    },
    vtex: {
      global: { status: 'Todos los sistemas operativos', indicator: 'none' },
      components: [
        { name: 'VTEX Checkout', status: 'operational' },
        { name: 'VTEX IO', status: 'operational' },
        { name: 'API REST', status: 'operational' },
        { name: 'Portal Admin', status: 'operational' }
      ]
    },
    woo: {
      global: { status: 'Operativo / Analizando...', indicator: 'none' },
      components: [
        { name: 'Resolución de DNS y SSL', status: 'operational' },
        { name: 'Tiempo de Respuesta (TTFB)', status: 'operational' },
        { name: 'Estabilidad de Base de Datos', status: 'operational' },
        { name: 'Núcleo de Aplicación (PHP)', status: 'operational' }
      ]
    }
  });

  useEffect(() => {
    let intervalId; 

    const dataInitialization = async () => {
      try {
        const token = localStorage.getItem('crm_token');
        if (token) {
          const payload = JSON.parse(window.atob(token.split('.')[1]));
          
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

        const fetchData = async () => {
          try {
            const [ticketsRes, clientsRes] = await Promise.all([
              crmApi.get('/tickets'),
              crmApi.get('/stores')
            ]);
            
            if (ticketsRes.data.success && clientsRes.data.success) {
              setStats({
                tickets: ticketsRes.data.data.length,
                clients: clientsRes.data.data.length
              });
              setClients(clientsRes.data.data);
            }
          } catch (error) {
            console.error("Error en polling:", error);
          }
        };

        await fetchData();
        setLoading(false);

        intervalId = setInterval(fetchData, 10000);

      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    
    dataInitialization();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [navigate]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const processedClients = [...clients]
    .filter(client => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        client.name.toLowerCase().includes(query) ||
        (client.web && client.web.toLowerCase().includes(query)) ||
        client.plan_type.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      
      const valA = String(a[sortConfig.key] || '').toLowerCase();
      const valB = String(b[sortConfig.key] || '').toLowerCase();

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  if (loading) return <div className="crm-text-loading">Cargando resumen...</div>;

  return (
    <div>
      <h1 className="crm-main-title">Panel de Control Principal</h1>
      
      {/* INDICADORES TOP */}
      <div className="crm-grid-stats">
        <div className="crm-card-paper">
          <span className="crm-stat-label">Tickets Totales</span>
          <span className="crm-stat-number">{stats.tickets}</span>
        </div>
        <div className="crm-card-paper">
          <span className="crm-stat-label">Clientes Registrados</span>
          <span className="crm-stat-number">{stats.clients}</span>
        </div>
      </div>

      {/* LAYOUT EN DOS COLUMNAS */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* COLUMNA IZQUIERDA: LISTA DE CLIENTES */}
        <div className="crm-card-paper" style={{ flex: '2 1 600px', minWidth: 0, margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 className="crm-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Lista General de Clientes</h2>
            <input 
              type="text" 
              placeholder="Buscar por cliente o plan..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
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
                  <th>Tickets Creados</th>
                </tr>
              </thead>
              <tbody>
                {processedClients.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="crm-text-loading" style={{ textAlign: 'center', padding: '24px' }}>
                      No se encontraron clientes que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  processedClients.map(client => (
                    <tr key={client.id} className="crm-table-row-interactive" onClick={() => navigate(`/admin/clientes/${client.id}`)} style={{ cursor: 'pointer' }}>
                      <td><strong>{client.name}</strong></td>
                      <td>{client.web || 'No asignada'}</td>
                      <td><span className="crm-badge">{client.plan_type}</span></td>
                      <td>{client.ticket_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* COLUMNA DERECHA: STATUS DE TECNOLOGÍAS (AHORA CON ICONOS) */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <StatusWidget title="Ecosistema Shopify Inc." data={techStatus.shopify} icon={shopifyIcon} />
          <StatusWidget title="Plataforma VTEX Global" data={techStatus.vtex} icon={vtexIcon} />
          <StatusWidget title="WooCommerce Monitoreo" data={techStatus.woo} icon={wooIcon} />
        </div>
        
      </div>
    </div>
  );
}

export default AdminDashboard;