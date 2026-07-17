import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';

// Componentes Core y Vistas Administrativas
import AdminDashboard from './views/admin/AdminDashboard';
import ClientsList from './views/admin/ClientsList';
import ClientDetail from './views/admin/ClientDetail';
import TotalTickets from './views/admin/TotalTickets';
import TicketDetail from './views/admin/TicketDetail';
import MetricsPage from './views/admin/MetricsPage';
import UsersManagement from './views/admin/UsersManagement'; // <-- Importación agregada

// Autenticación y Protección de Canales
import Login from './views/admin/Login';
import ProtectedRoute from './components/ProtectedRoute';

function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const token = localStorage.getItem('crm_token');
  let userRole = 'client'; 
  if (token) {
    try {
      const payload = JSON.parse(window.atob(token.split('.')[1]));
      userRole = payload.role;
    } catch (e) {
      console.error("Error al decodificar credenciales:", e);
    }
  }

  // Definición de rutas adaptada (Comas revisadas y corregidas)
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
          <div className="crm-logo-box">
            
            {/* 🌟 Contenedor Flex para alinear el SVG y el texto horizontalmente */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <img 
                src="/favicon.svg" 
                alt="Enova Concord Logo" 
                style={{ width: '82px', height: '82px', objectFit: 'contain' }} 
              />
              <h2 className="crm-logo-text" style={{ margin: 0 }}>Concorde</h2>
            </div>
            
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', display: 'block', opacity: 0.7 }}>
              [{userRole}]
            </span>
          </div>
          <nav className="crm-nav-container">
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

        {/* Ruta para el gestor de cuentas del Super Admin */}
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