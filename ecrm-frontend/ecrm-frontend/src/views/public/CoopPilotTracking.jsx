import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function CoopPilotTracking() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [storeBranding, setStoreBranding] = useState({ name: 'CENTRO DE AYUDA', logo_url: '' });
  const [trackData, setTrackData] = useState({ order_number: '', email: '' });
  const [orderInfo, setOrderInfo] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const storeQuery = urlParams.get('store');
    if (storeQuery) {
      setStoreBranding({ name: storeQuery.toUpperCase(), logo_url: '' });
      setTrackData(prev => ({ ...prev, store_id: storeQuery }));
    } else {
      setTrackData(prev => ({ ...prev, store_id: 'enova.agency' })); // Fallback
    }
  }, []);

  const handleTrackOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setOrderInfo(null);
    
    try {
      // Reutilizamos el endpoint que ya habíamos creado para validar pedidos
      const response = await crmApi.post('/cooppilot/verify-order', trackData);
      
      if (response.data.success) {
        setOrderInfo(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'No pudimos encontrar tu pedido. Verifica los datos.');
    } finally {
      setLoading(false);
    }
  };

  // Función para determinar qué paso del timeline está activo
  const getStatusLevel = (status) => {
    const levels = { 'PENDING': 1, 'PROCESSING': 2, 'SHIPPED': 3, 'DELIVERED': 4 };
    return levels[status] || 1;
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f4f0', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }}>
      
      <div style={{ marginBottom: '30px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111', textTransform: 'uppercase', letterSpacing: '2px' }}>
          {storeBranding.name}
        </h1>
        <p style={{ color: '#666', fontSize: '12px', letterSpacing: '1px' }}>RASTREO DE PEDIDO</p>
      </div>

      <div style={{ backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px', boxShadow: '4px 4px 0px #111', width: '100%', maxWidth: '500px', overflow: 'hidden', padding: '32px 24px' }}>
        
        {!orderInfo ? (
          <form onSubmit={handleTrackOrder}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Localiza tu paquete</h2>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>Ingresa tus datos para ver el estado de tu envío en tiempo real.</p>
            
            {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #f87171', borderRadius: '4px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Número de Pedido</label>
              <input type="text" placeholder="Ej: #1024" value={trackData.order_number} onChange={e => setTrackData({...trackData, order_number: e.target.value})} className="crm-input-text" required />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Correo Electrónico</label>
              <input type="email" placeholder="El correo con el que compraste" value={trackData.email} onChange={e => setTrackData({...trackData, email: e.target.value})} className="crm-input-text" required />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => navigate('/cooppilot')} className="crm-btn-border" style={{ flex: 1 }}>Volver</button>
              <button type="submit" disabled={loading} className="crm-btn-black" style={{ flex: 2 }}>
                {loading ? 'Buscando...' : 'Rastrear'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Pedido {orderInfo.order_number}</h2>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '30px' }}>Actualizado hace un momento</p>

            {/* TIMELINE VISUAL */}
            <div style={{ position: 'relative', borderLeft: '2px solid #e0e0e0', marginLeft: '12px', paddingBottom: '20px' }}>
              
              <div style={{ position: 'relative', paddingLeft: '30px', marginBottom: '30px' }}>
                <div style={{ position: 'absolute', left: '-9px', top: '0', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: getStatusLevel(orderInfo.status) >= 1 ? '#111' : '#fff', border: '2px solid #111' }}></div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: getStatusLevel(orderInfo.status) >= 1 ? '#111' : '#999' }}>Pedido Confirmado</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Hemos recibido tu pedido correctamente.</p>
              </div>

              <div style={{ position: 'relative', paddingLeft: '30px', marginBottom: '30px' }}>
                <div style={{ position: 'absolute', left: '-9px', top: '0', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: getStatusLevel(orderInfo.status) >= 2 ? '#111' : '#fff', border: '2px solid #111' }}></div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: getStatusLevel(orderInfo.status) >= 2 ? '#111' : '#999' }}>En Preparación</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Tu paquete está siendo empacado en nuestro almacén.</p>
              </div>

              <div style={{ position: 'relative', paddingLeft: '30px', marginBottom: '30px' }}>
                <div style={{ position: 'absolute', left: '-9px', top: '0', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: getStatusLevel(orderInfo.status) >= 3 ? '#111' : '#fff', border: '2px solid #111' }}></div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: getStatusLevel(orderInfo.status) >= 3 ? '#111' : '#999' }}>En Camino</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Entregado a la empresa de transporte.</p>
              </div>

              <div style={{ position: 'relative', paddingLeft: '30px' }}>
                <div style={{ position: 'absolute', left: '-9px', top: '0', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: getStatusLevel(orderInfo.status) === 4 ? '#22c55e' : '#fff', border: '2px solid #111' }}></div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: getStatusLevel(orderInfo.status) === 4 ? '#111' : '#999' }}>Entregado</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>El paquete llegó a su destino final.</p>
              </div>
            </div>

            <button onClick={() => setOrderInfo(null)} className="crm-btn-border" style={{ width: '100%', marginTop: '24px' }}>Rastrear otro pedido</button>
          </div>
        )}

      </div>
    </div>
  );
}

export default CoopPilotTracking;