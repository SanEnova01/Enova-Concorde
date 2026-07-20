import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';

// Componentes Core y Vistas Administrativas
import AdminDashboard from './views/admin/AdminDashboard';
import ClientsList from './views/admin/ClientsList';
import ClientDetail from './views/admin/ClientDetail';
import TotalTickets from './views/admin/TotalTickets';
import TicketDetail from './views/admin/TicketDetail';
import MetricsPage from './views/admin/MetricsPage';
import UsersManagement from './views/admin/UsersManagement';

// Autenticación y Protección de Canales
import Login from './views/admin/Login';
import ProtectedRoute from './components/ProtectedRoute';

function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const token = localStorage.getItem('crm_token');
  let userRole = 'client';
  let userName = 'Desconocido';
  let userEmail = 'sin-correo@sistema.local';

  if (token) {
    try {
      const payload = JSON.parse(window.atob(token.split('.')[1]));
      userRole = payload.role;
      userName = payload.name || 'Desconocido';
      userEmail = payload.email || 'sin-correo@sistema.local';
    } catch (e) {
      console.error("Error al decodificar credenciales:", e);
    }
  }

  // Definición de rutas
  const allNavItems = [
    { path: '/admin', label: 'Inicio', allowed: ['super admin', 'admin'] },
    { path: '/admin/tickets', label: 'Tickets Totales', allowed: ['super admin', 'admin'] },
    { path: '/admin/clientes/cuentacliente', label: 'Mi Cuenta', allowed: ['client'] },
    { path: '/admin/clientes', label: 'Clientes / Tiendas', allowed: ['super admin', 'admin'] },
    { path: '/admin/metricas', label: 'Métricas Generales', allowed: ['super admin', 'admin'] },
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

          {/* 🌟 NERV ID CARD STYLING */}
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
            {/* Triángulo acento tipo Sello NERV (Rojo) */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderTop: '24px solid #d9534f', borderLeft: '24px solid transparent' }}></div>

            {/* Cabecera Técnica */}
            <div style={{ borderBottom: '3px solid #111', paddingBottom: '4px', marginBottom: '10px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '18px', fontWeight: '900', fontFamily: 'Impact, system-ui, sans-serif', letterSpacing: '0.5px', color: '#111', lineHeight: '1' }}>CONCORDE ONLY</span>
              <span style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '1.5px', color: '#111' }}>関係者以外使用禁止</span> {/* "Uso exclusivo para personal autorizado" */}
            </div>

            {/* Información del Usuario */}
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', borderBottom: '1px solid #111', marginBottom: '2px', textTransform: 'uppercase' }}>品名 (Name)</span>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#111', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userName}
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', borderBottom: '1px solid #111', marginBottom: '2px', textTransform: 'uppercase' }}>管理番号 (Contact)</span>
              <span style={{ fontSize: '11px', color: '#111', fontFamily: 'monospace', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userEmail}
              </span>
            </div>

            {/* Footer: Rol y Código de Barras */}
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
              
              {/* Código de barras CSS simulado */}
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
          {/* FIN NERV ID CARD */}

          <nav className="crm-nav-container" style={{ paddingTop: 0 }}>
            {visibleNavItems.map(item => {
              const isActive = location.pathname === item.path || 
                (item.path === '/admin/clientes' && location.pathname.startsWith('/admin/clientes/')) ||
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
        <Route path="/login" element={<Login />} />

        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['super admin', 'admin']}>
            <AdminLayout><AdminDashboard /></AdminLayout>
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;