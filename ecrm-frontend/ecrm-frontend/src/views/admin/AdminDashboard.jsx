import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

// Importación de logos
import wooIcon from '../../assets/woo-icon.png';
import vtexIcon from '../../assets/vtex-icon.png';
import shopifyIcon from '../../assets/shopify-icon.png';

// 🌟 SUBCOMPONENTE: Widget del Concorde Analyzer
const AnalyzerStatusWidget = () => {
  const [botStatus, setBotStatus] = useState({ status: 'LOADING', last_heartbeat: null, is_running: false });

  useEffect(() => {
    const checkBotStatus = async () => {
      try {
        const res = await crmApi.get('/metrics/bot-status');
        if (res.data?.success) {
          const statusInfo = res.data.data || res.data;
          setBotStatus(statusInfo);
        }
      } catch (error) {
        setBotStatus({ status: 'OFFLINE', last_heartbeat: null, is_running: false });
      }
    };

    checkBotStatus();
    const interval = setInterval(checkBotStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const isOnline = botStatus.status === 'ONLINE';

  return (
    <div style={{ 
      display: 'flex', gap: '10px', alignItems: 'center', 
      backgroundColor: '#ffffff', padding: '8px 16px', 
      borderRadius: '8px', border: '1px solid #c8c6c1', 
      borderLeft: isOnline ? '4px solid #16a34a' : '4px solid #dc2626',
      boxShadow: '0 2px 4px rgba(0,0,0,0.02)', fontFamily: "'Nunito', system-ui, sans-serif" 
    }}>
      <div style={{
        width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
        backgroundColor: isOnline ? '#16a34a' : '#dc2626',
        boxShadow: isOnline ? '0 0 8px #16a34a' : '0 0 8px #dc2626'
      }} />
      <div style={{ lineHeight: '1.2' }}>
        <span style={{ fontSize: '9px', fontWeight: '900', color: '#666666', letterSpacing: '0.5px' }}>CONCORDE ANALYZER</span><br/>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#111111' }}>
          {botStatus.status} {botStatus.is_running && <span style={{ color: '#d97706' }}>(ANALIZANDO...)</span>}
        </span>
      </div>
    </div>
  );
};

// 🌟 SUBCOMPONENTE: Zonas Horarias, Fecha y Clima Local
const TopBarWidget = () => {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState({ temp: '--', status: 'Cargando...' });

  useEffect(() => {
    // Reloj local en tiempo real
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    // Conexión a API pública de clima (Coordenadas de Lima, Perú)
    fetch('https://api.open-meteo.com/v1/forecast?latitude=-12.0432&longitude=-77.0282&current_weather=true')
      .then(res => res.json())
      .then(data => {
        if (data && data.current_weather) {
          setWeather({
            temp: data.current_weather.temperature,
            status: 'Despejado' // Placeholder base
          });
        }
      })
      .catch(() => setWeather({ temp: '--', status: 'Offline' }));

    return () => clearInterval(timer);
  }, []);

  const dateString = time.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();

  // Configuración de zonas horarias a mostrar
  const timeZones = [
    { label: 'PERÚ', tz: 'America/Lima' },
    { label: 'EE.UU (EST)', tz: 'America/New_York' },
    { label: 'EUR (CET)', tz: 'Europe/Madrid' },
    { label: 'ASIA (JST)', tz: 'Asia/Tokyo' }
  ];

  return (
    <div style={{ 
      display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap',
      backgroundColor: '#ffffff', padding: '8px 16px', 
      borderRadius: '8px', border: '1px solid #c8c6c1', 
      boxShadow: '0 2px 4px rgba(0,0,0,0.02)', fontFamily: "'Nunito', system-ui, sans-serif" 
    }}>
      
      {/* 1. Múltiples Zonas Horarias */}
      <div style={{ display: 'flex', gap: '16px' }}>
        {timeZones.map((z, i) => (
          <div key={i} style={{ textAlign: 'center', lineHeight: '1.2' }}>
            <span style={{ fontSize: '9px', fontWeight: '900', color: '#666666', letterSpacing: '0.5px' }}>{z.label}</span><br/>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#111111' }}>
              {time.toLocaleTimeString('es-PE', { timeZone: z.tz, hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>

      <div style={{ width: '1px', height: '28px', backgroundColor: '#e5e5e5' }}></div>

      {/* 2. Fecha Local */}
      <div style={{ textAlign: 'center', lineHeight: '1.2' }}>
        <span style={{ fontSize: '9px', fontWeight: '900', color: '#666666', letterSpacing: '0.5px' }}>FECHA</span><br/>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#111111' }}>{dateString}</span>
      </div>

      <div style={{ width: '1px', height: '28px', backgroundColor: '#e5e5e5' }}></div>

      {/* 3. Clima y Estado Local */}
      <div style={{ lineHeight: '1.2', textAlign: 'center' }}>
        <span style={{ fontSize: '9px', fontWeight: '900', color: '#666666', letterSpacing: '0.5px' }}>LIMA, PE</span><br/>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#111111' }}>{weather.temp}°C</span>
          <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 'bold', marginLeft: '6px' }}>● {weather.status}</span>
        </div>
      </div>

    </div>
  );
};

// SUBCOMPONENTE: Widget de Monitoreo (se mantiene igual)
const StatusWidget = ({ title, data, icon }) => {
  if (!data) return <div className="crm-card-paper" style={{ padding: '16px' }}><div className="crm-text-loading">Cargando {title}...</div></div>;

  const isOperational = data.global?.indicator === 'none';

  return (
    <div className="crm-card-paper" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dotted #111111', paddingBottom: '12px', marginBottom: '14px' }}>
        
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

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

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
      {/* 🌟 ENCABEZADO CON WIDGETS INTEGRADOS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid #111111', paddingBottom: '12px', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <h1 className="crm-main-title" style={{ border: 'none', margin: 0, padding: 0 }}>Panel de Control Principal</h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <AnalyzerStatusWidget />
          <TopBarWidget />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* COLUMNA IZQUIERDA: CONTADORES + LISTA DE CLIENTES */}
        <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
          
          <div className="crm-grid-stats" style={{ marginBottom: 0 }}>
            <div className="crm-card-paper">
              <span className="crm-stat-label">Tickets Totales</span>
              <span className="crm-stat-number">{stats.tickets}</span>
            </div>
            <div className="crm-card-paper">
              <span className="crm-stat-label">Clientes Registrados</span>
              <span className="crm-stat-number">{stats.clients}</span>
            </div>
          </div>

          <div className="crm-card-paper" style={{ margin: 0 }}>
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
        </div>

        {/* COLUMNA DERECHA: STATUS DE TECNOLOGÍAS */}
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