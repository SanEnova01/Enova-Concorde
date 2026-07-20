import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function CoopPilotReturns() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storeId = searchParams.get('store') || 'enova-digital';

  const [loading, setLoading] = useState(true);
  const [storeInfo, setStoreInfo] = useState(null);

  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSearching] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
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

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    if (!orderNumber || !email || !reason) {
      setErrorMsg('Todos los campos son obligatorios.');
      return;
    }

    setIsSearching(true);
    setErrorMsg('');

    try {
      // Simulación o llamado de solicitud
      await new Promise(r => setTimeout(r, 1200));
      setSuccessMsg(`Solicitud registrada para el pedido ${orderNumber}. Se ha enviado un correo con las instrucciones.`);
    } catch (err) {
      setErrorMsg('Ocurrió un error al procesar la solicitud.');
    } finally {
      setIsSearching(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#090a0f', color: '#FFD700', fontFamily: 'monospace' }}>
        <p>Cargando módulo de devoluciones...</p>
      </div>
    );
  }

  // 🔒 BLOQUEO SI NO TIENE COOPPILOT O EL MÓDULO DE DEVOLUCIONES DESACTIVADO
  if (!storeInfo || !storeInfo.has_cooppilot || !storeInfo.has_returns) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#090a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ backgroundColor: '#12141d', border: '1px solid #222', borderRadius: '12px', padding: '40px 30px', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#FFD700', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
            Módulo No Disponible
          </h2>
          <p style={{ fontSize: '14px', color: '#a0a5b5', lineHeight: '1.6', margin: '0 0 20px 0' }}>
            El portal de <strong>Cambios y Devoluciones</strong> no se encuentra activo para la tienda <strong>{storeInfo?.name || storeId}</strong>.
          </p>
          <button 
            onClick={() => navigate(`/cooppilot?store=${storeId}`)}
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
            <span style={{ fontSize: '32px' }}>🔄</span>
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#ffffff' }}>Cambios y Devoluciones</h1>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>{storeInfo.name}</span>
            </div>
          </div>

          {!successMsg ? (
            <form onSubmit={handleSubmitReturn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#d1d5db', marginBottom: '6px' }}>
                  Número de Pedido
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
                  Correo Electrónico
                </label>
                <input 
                  type="email" 
                  placeholder="cliente@ejemplo.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px', backgroundColor: '#090a0f', border: '1px solid #374151', borderRadius: '8px', color: '#ffffff', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#d1d5db', marginBottom: '6px' }}>
                  Motivo de Cambio o Devolución
                </label>
                <textarea 
                  placeholder="Ej: Deseo cambiar por una talla M..." 
                  value={reason} 
                  onChange={e => setReason(e.target.value)}
                  style={{ width: '100%', padding: '12px', backgroundColor: '#090a0f', border: '1px solid #374151', borderRadius: '8px', color: '#ffffff', fontSize: '14px', minHeight: '90px', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              {errorMsg && (
                <div style={{ padding: '12px', backgroundColor: '#3f1d1d', border: '1px solid #dc2626', borderRadius: '6px', color: '#f87171', fontSize: '13px' }}>
                  {errorMsg}
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSubmitting}
                style={{ backgroundColor: '#FFD700', color: '#111', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
              >
                {isSubmitting ? 'Procesando...' : 'Solicitar Cambio / Devolución'}
              </button>
            </form>
          ) : (
            <div style={{ padding: '20px', backgroundColor: '#1a2e22', border: '1px solid #10b981', borderRadius: '8px' }}>
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>✓ SOLICITUD RECIBIDA</span>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#ecfdf5', lineHeight: '1.5' }}>
                {successMsg}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default CoopPilotReturns;