import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

// Importación de logos
import wooIcon from '../../assets/woo-icon.png';
import vtexIcon from '../../assets/vtex-icon.png';
import shopifyIcon from '../../assets/shopify-icon.png';

// 🌟 SUBCOMPONENTE: Contador estilo Odómetro Analógico Claro (Blanco con texto Negro)
const AnalogOdometer = ({ value, digits = 5 }) => {
  const paddedValue = String(value).padStart(digits, '0');

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center',
      width: '100%',
      boxSizing: 'border-box',
      gap: '3px', 
      backgroundColor: '#e5e5e5',
      padding: '5px 6px', 
      borderRadius: '6px', 
      border: '1px solid #cccccc',
      boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0,0,0,0.05)'
    }}>
      {paddedValue.split('').map((digit, index) => (
        <div key={index} style={{
          backgroundColor: '#ffffff',
          color: '#111111',
          fontSize: '26px',
          fontWeight: 'bold',
          fontFamily: "'Courier New', Courier, monospace",
          padding: '2px 7px',
          borderRadius: '3px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.9)',
          background: 'linear-gradient(180deg, #f8f8f8 0%, #ffffff 40%, #ffffff 60%, #ececec 100%)',
          textAlign: 'center',
          minWidth: '20px',
          border: '1px solid #cfcfcf'
        }}>
          {digit}
        </div>
      ))}
    </div>
  );
};

// 🌟 SUBCOMPONENTE: Manejador Inteligente de Logo de Cliente con Fallback de Iniciales
const ClientLogo = ({ url, name }) => {
  const [hasError, setHasError] = useState(false);

  const fullUrl = React.useMemo(() => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // Si la URL es relativa (/assets/logo-xxx.png), le adjuntamos el host del backend
    const baseURL = crmApi.defaults.baseURL || '';
    const host = baseURL.replace(/\/api\/?$/, '');
    return `${host}${url.startsWith('/') ? '' : '/'}${url}`;
  }, [url]);

  if (!fullUrl || hasError) {
    return (
      <div style={{ 
        width: '32px', 
        height: '32px', 
        borderRadius: '6px', 
        backgroundColor: '#111111', 
        color: '#ffffff', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '12px',
        flexShrink: 0
      }}>
        {name ? name.substring(0, 2).toUpperCase() : 'CL'}
      </div>
    );
  }

  return (
    <img 
      src={fullUrl} 
      alt={name} 
      onError={() => setHasError(true)}
      style={{ 
        width: '32px', 
        height: '32px', 
        borderRadius: '6px', 
        objectFit: 'contain',
        backgroundColor: '#ffffff',
        border: '1px solid #e0e0e0',
        padding: '2px',
        flexShrink: 0
      }} 
    />
  );
};

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
    <div 
      onClick={() => window.location.href = 'https://enova-concorde-2027.up.railway.app/admin/analyzer'}
      style={{ 
        display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer',
        backgroundColor: '#ffffff', padding: '8px 16px', 
        borderRadius: '8px', border: '1px solid #c8c6c1', 
        borderLeft: isOnline ? '4px solid #16a34a' : '4px solid #dc2626',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)', fontFamily: "'Nunito', system-ui, sans-serif",
        transition: 'background-color 0.2s ease'
    }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fcfbfa'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
    >
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
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    fetch('https://api.open-meteo.com/v1/forecast?latitude=-12.0432&longitude=-77.0282&current_weather=true')
      .then(res => res.json())
      .then(data => {
        if (data && data.current_weather) {
          setWeather({
            temp: data.current_weather.temperature,
            status: 'Despejado'
          });
        }
      })
      .catch(() => setWeather({ temp: '--', status: 'Offline' }));

    return () => clearInterval(timer);
  }, []);

  const dateString = time.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();

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

      <div style={{ textAlign: 'center', lineHeight: '1.2' }}>
        <span style={{ fontSize: '9px', fontWeight: '900', color: '#666666', letterSpacing: '0.5px' }}>FECHA</span><br/>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#111111' }}>{dateString}</span>
      </div>

      <div style={{ width: '1px', height: '28px', backgroundColor: '#e5e5e5' }}></div>

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

// SUBCOMPONENTE: Widget de Monitoreo
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

  const [techStatus] = useState({
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

        // 🌟 2. CONSULTAS A LA BD: Estas sí se actualizan en vivo sin gasto de IA
        const fetchData = async () => {
          try {
            const [ticketsRes, clientsRes] = await Promise.all([
              crmApi.get('/tickets'),
              crmApi.get('/stores')
            ]);
            
            if (ticketsRes.data.success && clientsRes.data.success) {
              const allTickets = ticketsRes.data.data || [];
              const allStores = clientsRes.data.data || [];

              const ticketCountsMap = {};
              const tStatusCounts = {};
              
              allTickets.forEach(t => {
                if (t.store_id) {
                  ticketCountsMap[t.store_id] = (ticketCountsMap[t.store_id] || 0) + 1;
                }
                const st = String(t.status || 'OPEN').toUpperCase();
                tStatusCounts[st] = (tStatusCounts[st] || 0) + 1;
              });
              
              setTicketStatusStats(tStatusCounts);

              const storesWithRealCounts = allStores.map(store => ({
                ...store,
                real_ticket_count: ticketCountsMap[store.id] || 0
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
                tickets: allTickets.length,
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

        // Polling cada 10 segundos SOLO para datos livianos de PostgreSQL
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

  const filteredClients = clients
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
    <div>
      {/* 🌟 ENCABEZADO CON CARD OSCURA DE IA + WIDGETS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e5e5', paddingBottom: '16px', marginBottom: '28px', flexWrap: 'wrap', gap: '20px' }}>
        
        {/* TARJETA / CARD OSCURA PARA LA INFORMACIÓN DE IA */}
        <div style={{ 
          flex: '1 1 450px', 
          minWidth: 0,
          backgroundColor: '#111111',
          color: '#ffffff',
          padding: '16px 20px 16px 24px',
          borderRadius: '10px',
          border: '1px solid #222222',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Lógica de acento de línea vertical a la izquierda */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '4px',
            height: '100%',
            backgroundColor: '#2563eb'
          }} />

          <span style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '1px', color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
            {aiBanner.greeting}
          </span>
          <h1 className="crm-main-title" style={{ border: 'none', margin: '0 0 6px 0', padding: 0, fontSize: '20px', lineHeight: '1.2', color: '#ffffff' }}>
            {aiBanner.headline}
          </h1>
          <p style={{ margin: 0, fontSize: '12px', color: '#d1d5db', lineHeight: '1.4', maxWidth: '750px' }}>
            {aiBanner.subtext}
          </p>
        </div>

        {/* WIDGETS DERECHOS */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <AnalyzerStatusWidget />
          <TopBarWidget />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* COLUMNA IZQUIERDA: CONTADORES + LISTA DE CLIENTES */}
        <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
          
          <div className="crm-grid-stats" style={{ marginBottom: 0 }}>
            {/* CARD: TICKETS TOTALES */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h2 className="crm-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Lista General de Clientes</h2>
              <input 
                type="text" 
                placeholder="Buscar por cliente o plan..." 
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
                        <td><strong>{client.real_ticket_count}</strong></td>
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
          <StatusWidget title="Ecosistema Shopify Inc." data={techStatus.shopify} icon={shopifyIcon} />
          <StatusWidget title="Plataforma VTEX Global" data={techStatus.vtex} icon={vtexIcon} />
          <StatusWidget title="WooCommerce Monitoreo" data={techStatus.woo} icon={wooIcon} />
        </div>
        
      </div>
    </div>
  );
}

export default AdminDashboard;