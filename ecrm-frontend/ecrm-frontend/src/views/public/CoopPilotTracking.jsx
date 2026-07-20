import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function CoopPilotTracking() {
  const navigate = useNavigate();
  const { storeId } = useParams();

  const [loading, setLoading] = useState(true);
  const [storeInfo, setStoreInfo] = useState(null);

  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    crmApi.get(`/cooppilot/config/${storeId}`)
      .then(res => {
        if (res.data.success) {
          setStoreInfo(res.data.data);
        }
      })
      .catch(err => console.error("Error al consultar tienda:", err))
      .finally(() => setLoading(false));
  }, [storeId]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!orderNumber || !email) {
      setErrorMsg('Por favor ingresa tu número de pedido y correo.');
      return;
    }

    setIsSearching(true);
    setErrorMsg('');
    setTrackingData(null);

    try {
      const res = await crmApi.post('/cooppilot/verify-order', {
        store_id: storeId,
        order_number: orderNumber,
        email: email
      });

      if (res.data.success) {
        setTrackingData(res.data.data);
      } else {
        setErrorMsg(res.data.error || 'No se encontró la orden especificada.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Error verificando la orden.');
    } finally {
      setIsSearching(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#090a0f', color: '#FFD700', fontFamily: 'monospace' }}>
        <p>Cargando módulo de rastreo...</p>
      </div>
    );
  }

  // 🔒 BLOQUEO SI NO TIENE COOPPILOT O EL MÓDULO DE RASTREO DESACTIVADO
  if (!storeInfo || !storeInfo.has_cooppilot || !storeInfo.has_tracking) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#090a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ backgroundColor: '#12141d', border: '1px solid #222', borderRadius: '12px', padding: '40px 30px', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#FFD700', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
            Módulo No Disponible
          </h2>
          <p style={{ fontSize: '14px', color: '#a0a5b5', lineHeight: '1.6', margin: '0 0 20px 0' }}>
            El servicio de <strong>Rastreo de Pedidos</strong> no se encuentra activo para la tienda <strong>{storeInfo?.name || storeId}</strong>.
          </p>
          <button 
            onClick={() => navigate(`/cooppilot/${storeId}`)}
            style={{ backgroundColor: '#FFD700', color: '#111', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Volver al Centro de Ayuda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090a0f', color: '#f3f4f6', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '650px', margin: '0 auto' }}>
        
        <button 
          onClick={() => navigate(`/cooppilot?store=${storeId}`)}
          style={{ backgroundColor: 'transparent', border: 'none', color: '#FFD700', fontSize: '13px', cursor: 'pointer', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          ← Volver al Centro de Ayuda
        </button>

        <div style={{ backgroundColor: '#12141d', border: '1px solid #2a2e3d', padding: '30px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ fontSize: '32px' }}>📦</span>
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#ffffff' }}>Rastrear Pedido</h1>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>{storeInfo.name}</span>
            </div>
          </div>

          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#d1d5db', marginBottom: '6px' }}>
                Número de Pedido (Ej: #1024)
              </label>
              <input 
                type="text" 
                placeholder="#1001" 
                value={orderNumber} 
                onChange={e => setOrderNumber(e.target.value)}
                style={{ width: '100%', padding: '12px', backgroundColor: '#090a0f', border: '1px solid #374151', borderRadius: '8px', color: '#ffffff', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#d1d5db', marginBottom: '6px' }}>
                Correo Electrónico de la Compra
              </label>
              <input 
                type="email" 
                placeholder="cliente@ejemplo.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '12px', backgroundColor: '#090a0f', border: '1px solid #374151', borderRadius: '8px', color: '#ffffff', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            {errorMsg && (
              <div style={{ padding: '12px', backgroundColor: '#3f1d1d', border: '1px solid #dc2626', borderRadius: '6px', color: '#f87171', fontSize: '13px' }}>
                {errorMsg}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSearching}
              style={{ backgroundColor: '#FFD700', color: '#111', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
            >
              {isSearching ? 'Buscando...' : 'Consultar Estado'}
            </button>
          </form>

          {trackingData && (
            <div style={{ marginTop: '24px', padding: '20px', backgroundColor: '#1a1d2d', border: '1px solid #FFD700', borderRadius: '8px' }}>
              <span style={{ fontSize: '11px', color: '#FFD700', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>ESTADO DEL ENVÍO</span>
              <h3 style={{ margin: '6px 0 12px 0', fontSize: '18px', color: '#ffffff' }}>Pedido {trackingData.order_number}</h3>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#d1d5db' }}>
                <strong>Estado actual:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>{trackingData.status}</span>
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
                Registrado para: {trackingData.customer_email}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default CoopPilotTracking;