import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';

// Componentes Core y Vistas Administrativas
import AdminDashboard from './views/admin/AdminDashboard';
import ClientsList from './views/admin/ClientsList';
import ClientDetail from './views/admin/ClientDetail';
import TotalTickets from './views/admin/TotalTickets';
import TicketDetail from './views/admin/TicketDetail';
import MetricsPage from './views/admin/MetricsPage';
import UsersManagement from './views/admin/UsersManagement';
import KnowledgeBase from "./views/admin/KnowledgeBase";

// Vista de Tickets para el Cliente
import ClientTickets from './views/client/ClientTickets';

// Vistas Públicas (CoopPilot)
import CoopPilotReturns from './views/public/CoopPilotReturns';
import CoopPilotHub from './views/public/CoopPilotHub';
import CoopPilotTracking from "./views/public/CoopPilotTracking";
import PublicAuditForm from './views/public/PublicAuditForm';
import PublicAuditReport from './views/public/PublicAuditReport';
import AdminAuditRequests from './views/admin/AdminAuditRequests';    

import ConcordeAnalyzerView from './views/admin/ConcordeAnalyzerView';
// Autenticación y Protección
import Login from './views/admin/Login';
import ProtectedRoute from './components/ProtectedRoute';
import crmApi from './api/crmApi';

function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const token = localStorage.getItem('crm_token');
  let userRole = 'client';
  let userName = 'Desconocido';
  let userEmail = 'sin-correo@sistema.local';
  const [hasCoopPilot, setHasCoopPilot] = useState(false);

  if (token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const payload = JSON.parse(jsonPayload);
      userRole = payload.role || 'client';
      userEmail = payload.email || 'sin-correo@sistema.local';
      
      const emailName = userEmail.split('@')[0];
      const capitalizedEmailName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
      
      userName = (payload.name && payload.name.trim() !== '') ? payload.name : capitalizedEmailName;

    } catch (e) {
      console.error("Error al decodificar credenciales:", e);
    }
  }

  // Verificar si el cliente tiene CoopPilot activo
  useEffect(() => {
    if (userRole === 'client') {
      crmApi.get('/stores/cuentacliente')
        .then(res => {
          const store = res.data.data || res.data;
          if (store && store.has_cooppilot) {
            setHasCoopPilot(true);
          }
        })
        .catch(err => console.error("Error al verificar licencia CoopPilot:", err));
    }
  }, [userRole]);

  // Definición de menú lateral por roles
  const allNavItems = [
    { path: '/admin', label: 'Inicio', allowed: ['super admin', 'admin'] },
    { path: '/admin/clientes', label: 'Clientes / Tiendas', allowed: ['super admin', 'admin'] },
    { path: '/admin/tickets', label: 'Tickets Totales', allowed: ['super admin', 'admin'] },
    { path: '/admin/clientes/cuentacliente', label: 'Mi Cuenta', allowed: ['client'] },
    { path: '/client/tickets', label: 'Tablero de Tickets', allowed: ['client'] }, // 👈 NUEVO ENLACE EN SIDEBAR
    
    // RUTA DE IA PARA LA AGENCIA
    
    
    
    { path: '/admin/analyzer', label: 'Concorde Analyzer', allowed: ['super admin', 'admin'] },
    { path: '/admin/metricas', label: 'Métricas Generales', allowed: ['super admin', 'admin'] },
    { path: '/admin/knowledge', label: 'Base de Conocimiento IA', allowed: ['super admin', 'admin'] },
    // RUTA DE IA PARA EL CLIENTE (Solo visible si pagó el adicional)
    { path: '/client/knowledge', label: 'Base de Conocimiento IA', allowed: (userRole === 'client' && hasCoopPilot) ? ['client'] : [] },
    { path: '/admin/usuarios', label: 'Crear Cuentas', allowed: ['super admin'] }
  ];

  const visibleNavItems = allNavItems.filter(item => item.allowed.includes(userRole));

  const handleLogout = () => {
    localStorage.removeItem('crm_token');
    navigate('/login');
  };

  return (
    <div className="crm-layout">
      <div className="crm-sidebar" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div className="crm-logo-box" style={{ borderBottom: 'none', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img 
                src="/favicon.svg" 
                alt="Enova Concord Logo" 
                style={{ width: '82px', height: '82px', objectFit: 'contain' }} 
              />
              <h2 className="crm-logo-text" style={{ margin: 0 }}>Concorde</h2>
            </div>
          </div>

          <div style={{
            backgroundColor: '#ffffff',
            border: '2px solid #111',
            borderRadius: '6px',
            margin: '0 16px 16px 16px',
            padding: '12px',
            boxShadow: '3px 3px 0px #111',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderTop: '24px solid #d9534f', borderLeft: '24px solid transparent' }}></div>

            <div style={{ borderBottom: '3px solid #111', paddingBottom: '4px', marginBottom: '10px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '18px', fontWeight: '900', fontFamily: 'Impact, system-ui, sans-serif', letterSpacing: '0.5px', color: '#111', lineHeight: '1' }}>CONCORDE ONLY</span>
              <span style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '1.5px', color: '#111' }}>AUTHORIZED PERSONNEL</span>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', borderBottom: '1px solid #111', marginBottom: '2px', textTransform: 'uppercase' }}>NAME</span>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#111', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userName}
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', borderBottom: '1px solid #111', marginBottom: '2px', textTransform: 'uppercase' }}>CONTACT</span>
              <span style={{ fontSize: '11px', color: '#111', fontFamily: 'monospace', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userEmail}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '2px solid #111', paddingTop: '8px' }}>
              <div style={{
                border: '2px solid #111',
                padding: '2px 8px',
                fontWeight: '900',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: userRole === 'super admin' ? '#d9534f' : '#111',
                backgroundColor: '#f5f4f0'
              }}>
                {userRole}
              </div>
              
              <div style={{ display: 'flex', gap: '2px', height: '22px' }}>
                <div style={{ width: '2px', backgroundColor: '#111' }}></div>
                <div style={{ width: '4px', backgroundColor: '#111' }}></div>
                <div style={{ width: '1px', backgroundColor: '#111' }}></div>
                <div style={{ width: '3px', backgroundColor: '#111' }}></div>
                <div style={{ width: '2px', backgroundColor: '#111' }}></div>
                <div style={{ width: '1px', backgroundColor: '#111' }}></div>
                <div style={{ width: '5px', backgroundColor: '#111' }}></div>
                <div style={{ width: '1px', backgroundColor: '#111' }}></div>
              </div>
            </div>
          </div>

          <nav className="crm-nav-container" style={{ paddingTop: 0 }}>
            {visibleNavItems.map(item => {
              const isActive = location.pathname === item.path || 
                (item.path === '/admin/clientes' && location.pathname.startsWith('/admin/clientes/') && !location.pathname.includes('cuentacliente')) ||
                (item.path === '/admin/tickets' && location.pathname.startsWith('/admin/tickets/'));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={isActive ? "crm-link-active" : "crm-link-inactive"}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div style={{ padding: '16px', borderTop: '1px dashed #111111' }}>
          <button onClick={handleLogout} className="crm-btn-border" style={{ width: '100%', padding: '8px', fontSize: '12px', cursor: 'pointer' }}>
            Cerrar Sesión
          </button>
        </div>
      </div>
      
      <div className="crm-main-content">
        {children}
      </div>
    </div>
  );
}

function ClientKnowledgeGuard() {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    crmApi.get('/stores/cuentacliente')
      .then(res => {
        const store = res.data.data || res.data;
        if (store && store.has_cooppilot) {
          setHasAccess(true);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '20px' }}>Verificando suscripción CoopPilot...</div>;

  if (!hasAccess) {
    return <Navigate to="/admin/clientes/cuentacliente" replace />;
  }

  return <KnowledgeBase />;
}

function App() {
  const token = localStorage.getItem('crm_token');
  let isClient = false;
  if (token) {
    try {
      isClient = JSON.parse(window.atob(token.split('.')[1])).role === 'client';
    } catch(e){}
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC / AUTH */}
        <Route path="/login" element={<Login />} />
        
        {/* RUTAS PÚBLICAS DE COOPPILOT (B2B2C) */}
        <Route path="/cooppilot" element={<Navigate to="/login" replace />} />
        <Route path="/cooppilot/:storeId" element={<CoopPilotHub />} />
        <Route path="/cooppilot/:storeId/devoluciones" element={<CoopPilotReturns />} />
        <Route path="/cooppilot/:storeId/rastreo" element={<CoopPilotTracking />} />

        {/* RUTAS PROTEGIDAS DEL DASHBOARD */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['super admin', 'admin']}>
            <AdminLayout><AdminDashboard /></AdminLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/admin/knowledge" element={
          <ProtectedRoute allowedRoles={['super admin', 'admin']}>
            <AdminLayout><KnowledgeBase /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/client/knowledge" element={
          <ProtectedRoute allowedRoles={['client']}>
            <AdminLayout><ClientKnowledgeGuard /></AdminLayout>
          </ProtectedRoute>
        } />

        {/* RUTA DE TABLERO DE TICKETS PARA CLIENTES */}
        <Route path="/client/tickets" element={
          <ProtectedRoute allowedRoles={['client']}>
            <AdminLayout><ClientTickets /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/admin/clientes" element={
          <ProtectedRoute allowedRoles={['super admin', 'admin']}>
            <AdminLayout><ClientsList /></AdminLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/admin/clientes/:storeId" element={
          <ProtectedRoute allowedRoles={['super admin', 'admin', 'client']}>
            <AdminLayout><ClientDetail /></AdminLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/admin/tickets" element={
          <ProtectedRoute allowedRoles={['super admin', 'admin']}>
            <AdminLayout><TotalTickets /></AdminLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/admin/tickets/:ticketId" element={
          <ProtectedRoute allowedRoles={['super admin', 'admin', 'client']}>
            <AdminLayout><TicketDetail /></AdminLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/admin/metricas" element={
          <ProtectedRoute allowedRoles={['super admin', 'admin']}>
            <AdminLayout><MetricsPage /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="/admin/usuarios" element={
          <ProtectedRoute allowedRoles={['super admin']}>
            <AdminLayout><UsersManagement /></AdminLayout>
          </ProtectedRoute>
        } />

        <Route path="*" element={
          isClient ? <Navigate to="/admin/clientes/cuentacliente" replace /> : <Navigate to="/login" replace />
        } />

           {/* Nuevas rutas publicas */}
<Route path="/auditoria" element={<PublicAuditForm />} />
<Route path="/reporte/:id" element={<PublicAuditReport />} />

{/* Nueva ruta protegida dentro de las rutas de Admin */}
<Route path="/admin/auditorias" element={<ProtectedRoute><AdminAuditRequests /></ProtectedRoute>} />

         
        <Route path="/admin/analyzer" element={
  <ProtectedRoute allowedRoles={['super admin', 'admin']}>
    <AdminLayout><ConcordeAnalyzerView /></AdminLayout>
  </ProtectedRoute>
} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;