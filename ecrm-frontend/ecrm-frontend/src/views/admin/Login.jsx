import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim() || !password) {
      setError('Todos los campos son obligatorios.');
      return;
    }

    try {
      setLoading(true);
      // Enviamos 'email' y 'password' al servidor
      const response = await crmApi.post('/auth/login', { email, password });

      if (response.data.success && response.data.token) {
        localStorage.setItem('crm_token', response.data.token);
        
        const payload = JSON.parse(window.atob(response.data.token.split('.')[1]));
        
        if (payload.role === 'client') {
          navigate('/admin/clientes/cuentacliente');
        } else {
          navigate('/admin');
        }
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Error de conexión con el servidor central de accesos.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f2f1ec', fontFamily: 'system-ui, sans-serif' }}>
  <div className="crm-card-paper" style={{ width: '100%', maxWidth: '380px', padding: '32px', boxSizing: 'border-box', border: '2px solid #111111' }}>
    
    {/* LOGO CORPORATIVO ENOVA CONCORD */}
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
      <img 
        src="/favicon.svg" 
        alt="Logo Enova Concord" 
        style={{ 
          width: '100px', // Puedes aumentar o reducir este valor según necesites
          height: 'auto', 
          objectFit: 'contain' 
        }} 
      />
    </div>
    
    <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'normal', textAlign: 'center' }}>Concorde</h1>
    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'normal', textAlign: 'center' }}>CRM Gateway</h2>
    <p className="crm-text-muted" style={{ margin: '0 0 24px 0', fontSize: '13px', textAlign: 'center' }}>Login</p>
        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #ef4444', color: '#b91c1c', padding: '10px', fontSize: '12px', marginBottom: '16px', fontWeight: 'bold', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="crm-stat-label" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Correo Electrónico</label>
            <input 
              type="text" 
              placeholder="nombre@enova.agency"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="crm-input-text"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px' }}
              required
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="crm-stat-label" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Contraseña</label>
            <input 
              type="password" 
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="crm-input-text"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px' }}
              required
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="crm-btn-black" 
            style={{ width: '100%', padding: '12px', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}
            disabled={loading}
          >
            {loading ? 'Verificando credenciales...' : 'Iniciar Sesión'}
          </button>
        </form>

      </div>
    </div>
  );
}

export default Login;