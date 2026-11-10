import React, { useState } from 'react';
import crmApi from '../../../api/crmApi';

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

export default ClientLogo;
