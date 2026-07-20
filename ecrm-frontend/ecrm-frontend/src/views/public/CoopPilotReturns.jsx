import React, { useState } from 'react';
import crmApi from '../../api/crmApi';

function CoopPilotReturns() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Paso 1: Login sin fricción (Usamos enova.agency como tienda por defecto para probar)
  const [loginData, setLoginData] = useState({ order_number: '', email: '', store_id: 'enova.agency' }); 
  
  // Datos del pedido recuperado
  const [order, setOrder] = useState(null);
  const [storeBranding, setStoreBranding] = useState(null);

  // Paso 2 y 3: Selección de devolución
  const [selectedItem, setSelectedItem] = useState(null);
  const [returnDetails, setReturnDetails] = useState({
    reason: '',
    resolution: 'STORE_CREDIT' // Por defecto intentamos retener el dinero (Upselling)
  });

  const handleVerifyOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await crmApi.post('/cooppilot/verify-order', loginData);
      
      if (response.data.success) {
        setOrder(response.data.data);
        setStoreBranding(response.data.store_branding);
        setStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'No pudimos encontrar tu pedido. Verifica los datos.');
    } finally {
      setLoading(false);
    }
  };

  const submitReturnRequest = async () => {
    setLoading(true);
    // Simulación de envío exitoso (luego lo conectaremos a la BD)
    setTimeout(() => {
      setLoading(false);
      setStep(4);
    }, 1500);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f4f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      
      {/* Cabecera dinámica de la marca */}
      <div style={{ marginBottom: '30px', textAlign: 'center' }}>
        {storeBranding?.logo_url ? (
          <img src={storeBranding.logo_url} alt={storeBranding.name} style={{ maxHeight: '60px' }} />
        ) : (
          <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111', textTransform: 'uppercase', letterSpacing: '2px' }}>
            {storeBranding?.name || 'CENTRO DE SOPORTE'}
          </h1>
        )}
        <p style={{ color: '#666', fontSize: '12px', letterSpacing: '1px' }}>POWERED BY COOPPILOT</p>
      </div>

      <div style={{ backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px', boxShadow: '4px 4px 0px #111', width: '100%', maxWidth: '500px', overflow: 'hidden' }}>
        
        {/* PROGRESS BAR */}
        <div style={{ display: 'flex', backgroundColor: '#111', color: '#fff', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>
          <div style={{ flex: 1, padding: '10px', textAlign: 'center', backgroundColor: step >= 1 ? '#111' : '#333', opacity: step >= 1 ? 1 : 0.5 }}>1. IDENTIFICACIÓN</div>
          <div style={{ flex: 1, padding: '10px', textAlign: 'center', backgroundColor: step >= 2 ? '#111' : '#333', opacity: step >= 2 ? 1 : 0.5 }}>2. SELECCIÓN</div>
          <div style={{ flex: 1, padding: '10px', textAlign: 'center', backgroundColor: step >= 3 ? '#111' : '#333', opacity: step >= 3 ? 1 : 0.5 }}>3. RESOLUCIÓN</div>
        </div>

        <div style={{ padding: '32px 24px' }}>
          
          {/* PASO 1: LOGIN */}
          {step === 1 && (
            <form onSubmit={handleVerifyOrder}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Inicia tu Cambio o Devolución</h2>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>Ingresa los datos de tu compra para buscar tu pedido.</p>
              
              {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #f87171', borderRadius: '4px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Número de Pedido</label>
                <input type="text" placeholder="Ej: #1024" value={loginData.order_number} onChange={e => setLoginData({...loginData, order_number: e.target.value})} className="crm-input-text" required />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Correo Electrónico</label>
                <input type="email" placeholder="El correo con el que compraste" value={loginData.email} onChange={e => setLoginData({...loginData, email: e.target.value})} className="crm-input-text" required />
              </div>

              <button type="submit" disabled={loading} className="crm-btn-black" style={{ width: '100%', padding: '12px', fontSize: '14px' }}>
                {loading ? 'Buscando pedido...' : 'Buscar Pedido'}
              </button>
            </form>
          )}

          {/* PASO 2: SELECCIÓN DE PRODUCTOS */}
          {step === 2 && order && (
            <div>
              <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Pedido {order.order_number}</h2>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>¿Qué artículo deseas cambiar o devolver?</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {order.items.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedItem(item)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', 
                      border: selectedItem?.id === item.id ? '2px solid #111' : '1px solid #ccc', 
                      borderRadius: '6px', cursor: 'pointer', backgroundColor: selectedItem?.id === item.id ? '#f5f4f0' : '#fff'
                    }}
                  >
                    <div style={{ width: '50px', height: '50px', backgroundColor: '#e0e0e0', borderRadius: '4px', backgroundImage: `url(${item.image})`, backgroundSize: 'cover' }}></div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', fontSize: '14px' }}>{item.name}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Talla: {item.size} | ${item.price.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setStep(1)} className="crm-btn-border" style={{ flex: 1 }}>Volver</button>
                <button onClick={() => setStep(3)} disabled={!selectedItem} className="crm-btn-black" style={{ flex: 1 }}>Continuar</button>
              </div>
            </div>
          )}

          {/* PASO 3: MOTIVO Y RESOLUCIÓN */}
          {step === 3 && (
            <div>
              <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Detalles de la Solicitud</h2>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>¿Por qué devuelves el producto?</label>
                <select value={returnDetails.reason} onChange={e => setReturnDetails({...returnDetails, reason: e.target.value})} className="crm-select-dropdown" style={{ width: '100%' }}>
                  <option value="">Selecciona un motivo...</option>
                  <option value="TOO_SMALL">Me quedó pequeño</option>
                  <option value="TOO_BIG">Me quedó grande</option>
                  <option value="DAMAGED">Llegó dañado o defectuoso</option>
                  <option value="NOT_AS_EXPECTED">No es lo que esperaba</option>
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '12px' }}>¿Cómo prefieres resolverlo?</label>
                
                <label style={{ display: 'block', padding: '12px', border: returnDetails.resolution === 'STORE_CREDIT' ? '2px solid #111' : '1px solid #ccc', borderRadius: '6px', marginBottom: '10px', cursor: 'pointer', backgroundColor: returnDetails.resolution === 'STORE_CREDIT' ? '#f5f4f0' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="radio" name="resolution" value="STORE_CREDIT" checked={returnDetails.resolution === 'STORE_CREDIT'} onChange={() => setReturnDetails({...returnDetails, resolution: 'STORE_CREDIT'})} />
                    <div>
                      <span style={{ fontWeight: 'bold', display: 'block', fontSize: '14px' }}>Crédito en Tienda (+5% de Regalo) 🎁</span>
                      <span style={{ fontSize: '12px', color: '#666' }}>Recibe el valor de tu prenda al instante para comprar otra cosa.</span>
                    </div>
                  </div>
                </label>

                <label style={{ display: 'block', padding: '12px', border: returnDetails.resolution === 'EXCHANGE' ? '2px solid #111' : '1px solid #ccc', borderRadius: '6px', marginBottom: '10px', cursor: 'pointer', backgroundColor: returnDetails.resolution === 'EXCHANGE' ? '#f5f4f0' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="radio" name="resolution" value="EXCHANGE" checked={returnDetails.resolution === 'EXCHANGE'} onChange={() => setReturnDetails({...returnDetails, resolution: 'EXCHANGE'})} />
                    <div>
                      <span style={{ fontWeight: 'bold', display: 'block', fontSize: '14px' }}>Cambiar Talla</span>
                      <span style={{ fontSize: '12px', color: '#666' }}>Te enviaremos una talla diferente a la misma dirección.</span>
                    </div>
                  </div>
                </label>

                <label style={{ display: 'block', padding: '12px', border: returnDetails.resolution === 'REFUND' ? '2px solid #111' : '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', backgroundColor: returnDetails.resolution === 'REFUND' ? '#f5f4f0' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="radio" name="resolution" value="REFUND" checked={returnDetails.resolution === 'REFUND'} onChange={() => setReturnDetails({...returnDetails, resolution: 'REFUND'})} />
                    <div>
                      <span style={{ fontWeight: 'bold', display: 'block', fontSize: '14px' }}>Reembolso al método original</span>
                      <span style={{ fontSize: '12px', color: '#666' }}>Tarda entre 5 a 10 días hábiles.</span>
                    </div>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setStep(2)} className="crm-btn-border" style={{ flex: 1 }}>Volver</button>
                <button onClick={submitReturnRequest} disabled={!returnDetails.reason || loading} className="crm-btn-black" style={{ flex: 1 }}>
                  {loading ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

          {/* PASO 4: CONFIRMACIÓN */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: '60px', height: '60px', backgroundColor: '#111', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '30px' }}>✓</div>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '22px' }}>¡Solicitud Recibida!</h2>
              <p style={{ fontSize: '14px', color: '#444', lineHeight: '1.5', marginBottom: '24px' }}>
                Hemos creado tu solicitud. Te enviamos un correo a <strong>{loginData.email}</strong> con las instrucciones.
              </p>
              <button onClick={() => window.location.reload()} className="crm-btn-border">Volver al Inicio</button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default CoopPilotReturns;