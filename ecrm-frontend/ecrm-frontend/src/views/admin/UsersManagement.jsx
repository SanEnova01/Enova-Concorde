import React, { useState } from 'react';
import crmApi from '../../api/crmApi';

function UsersManagement() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('client');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false });

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setMessage({ text: '', isError: false });

    if (!name.trim() || !email.trim() || !password || !role) {
      setMessage({ text: 'Todos los campos son estrictamente obligatorios.', isError: true });
      return;
    }

    try {
      setLoading(true);
      const response = await crmApi.post('/users', { name, email, password, role });

      if (response.data.success) {
        setMessage({ text: 'Usuario registrado exitosamente. Ya puede iniciar sesión.', isError: false });
        setName('');
        setEmail('');
        setPassword('');
        setRole('client');
      }
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.error || 'Error de comunicación con el servidor.';
      setMessage({ text: errorMsg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '500px' }}>
      <h1 className="crm-main-title">Control de Accesos Globales</h1>
      
      <div className="crm-card-paper">
        <h3 className="crm-section-title" style={{ marginTop: 0 }}>Crear Nueva Cuenta de Acceso</h3>
        
        {message.text && (
          <div style={{ 
            backgroundColor: message.isError ? '#fef2f2' : '#f0fdf4', 
            border: message.isError ? '1px solid #ef4444' : '1px solid #22c55e', 
            color: message.isError ? '#b91c1c' : '#16a34a', 
            padding: '12px', 
            fontSize: '13px', 
            marginBottom: '20px', 
            fontWeight: 'bold' 
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="crm-stat-label">Nombre de Usuario (Para el Login)</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="crm-input-text" 
              placeholder="Ej: TiendaCentro"
              required 
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="crm-stat-label">Correo Identificador (Para enlazar la Tienda)</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="crm-input-text" 
              placeholder="Ej: contacto@tiendacentro.com"
              required 
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="crm-stat-label">Contraseña Inicial</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="crm-input-text" 
              placeholder="••••••••"
              required 
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="crm-stat-label">Nivel de Rango (Rol)</label>
            <select 
              value={role} 
              onChange={(e) => setRole(e.target.value)} 
              className="crm-select-dropdown"
              disabled={loading}
            >
              <option value="client">client (Tiendas Externas)</option>
              <option value="admin">admin (Staff / Soporte Agencia)</option>
              <option value="super admin">super admin (Control Total)</option>
            </select>
          </div>

          <button 
            type="submit" 
            className="crm-btn-black" 
            style={{ width: '100%', padding: '12px', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Escribiendo en registro seguro...' : 'Generar Credenciales Oficiales'}
          </button>

        </form>
      </div>
    </div>
  );
}

export default UsersManagement;