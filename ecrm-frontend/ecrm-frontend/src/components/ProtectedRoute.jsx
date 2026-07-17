import React from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('crm_token');

  // 1. Si no hay token, directo al login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  try {
    // 2. Desencriptamos la carga útil (payload) del JWT de forma nativa
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));

    // 3. Si la ruta exige roles específicos y el usuario no lo tiene, lo expulsamos
    if (allowedRoles && !allowedRoles.includes(payload.role)) {
      alert('Acceso denegado: No tienes los permisos requeridos para esta sección.');
      return <Navigate to="/login" replace />;
    }

    return children;
  } catch (error) {
    localStorage.removeItem('crm_token');
    return <Navigate to="/login" replace />;
  }
}

export default ProtectedRoute;