import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function CoopPilotHub() {
  const navigate = useNavigate();
  const { storeId } = useParams(); // 👈 Toma el ID directo de la URL limpia

  const [loading, setLoading] = useState(true);
  const [storeInfo, setStoreInfo] = useState(null);
  const [logoError, setLogoError] = useState(false);
  
  // Estados para Escalación a Soporte
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supportData, setSupportData] = useState({ name: '', email: '', subject: '', message: '' });
  const [supportStatus, setSupportStatus] = useState('');
  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    setSupportStatus('Enviando...');
    try {
      const res = await crmApi.post('/cooppilot/ticket', { ...supportData, store_id: storeId });
      if (res.data.success) {
        setSupportStatus('✅ Solicitud enviada con éxito. Nuestro equipo te contactará pronto.');
        setSupportData({ name: '', email: '', subject: '', message: '' });
        setTimeout(() => { setShowSupportForm(false); setSupportStatus(''); }, 3000);
      }
    } catch (err) {
      setSupportStatus('❌ Error al enviar la solicitud.');
    }
  };
  // Estados para el Chatbot de IA
  const [query, setQuery] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Helper para construir la URL absoluta del logo hacia el Backend
  const getLogoUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const apiBase = crmApi.defaults.baseURL || '';
    const domain = apiBase.replace(/\/api$/, '');
    return `${domain}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  useEffect(() => {
    setLoading(true);
    setLogoError(false);

    crmApi.get(`/cooppilot/config/${storeId}`)
      .then(res => {
        if (res.data.success) {
          setStoreInfo(res.data.data);
        }
      })
      .catch(err => {
        console.error("Error cargando configuración de la tienda:", err);
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  const handleSendChat = async (inputQuery) => {
    const textToSend = inputQuery || query;
    if (!textToSend || !textToSend.trim()) return;

    setIsTyping(true);
    setChatResponse('');

    try {
      const res = await crmApi.post('/cooppilot/chat', {
        store_id: storeId,
        query: textToSend
      });

      if (res.data.success) {
        setChatResponse(res.data.response);
      } else {
        setChatResponse(res.data.error || "Ocurrió un contratiempo al procesar tu solicitud.");
      }
    } catch (err) {
      setChatResponse("⚠️ No fue posible establecer comunicación con el centro de mando de la IA.");
    } finally {
      setIsTyping(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#090a0f', color: '#FFD700', fontFamily: 'monospace' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'spin 1.5s linear infinite' }}>✈️</div>
        <p style={{ letterSpacing: '2px', fontSize: '13px', textTransform: 'uppercase' }}>Iniciando Sistemas de Vuelo Concorde...</p>
      </div>
    );
  }

  // BLOQUEO SI LA TIENDA NO TIENE LICENCIA
  if (!storeInfo || !storeInfo.has_cooppilot) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#090a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ backgroundColor: '#12141d', border: '1px solid #222', borderRadius: '12px', padding: '40px 30px', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#FFD700', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Servicio Restringido
          </h2>
          <p style={{ fontSize: '14px', color: '#a0a5b5', lineHeight: '1.6', margin: 0 }}>
            El módulo <strong>CoopPilot (IA & Autogestión)</strong> no se encuentra contratado o activo para la marca <strong>{storeInfo?.name || storeId}</strong>.
          </p>
        </div>
      </div>
    );
  }

  const storeInitial = storeInfo.name ? storeInfo.name.charAt(0).toUpperCase() : 'E';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090a0f', color: '#f3f4f6', padding: '30px 16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '850px', margin: '0 auto' }}>
        
        {/* BARRA SUPERIOR TELEMETRÍA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '8px 16px', backgroundColor: '#12141d', border: '1px solid #1f2430', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace', color: '#9ca3af' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
            <span>CONCORDE AI ENGINE // ONLINE</span>
          </div>
          <div style={{ color: '#FFD700', fontWeight: 'bold', letterSpacing: '1px' }}>
            COOPPILOT v2.4
          </div>
        </div>

        {/* CABECERA PRINCIPAL CON BRANDING DE LA TIENDA */}
        <div style={{ backgroundColor: '#12141d', border: '1px solid #2a2e3d', padding: '24px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#FFD700', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: '4px' }}>
              CENTRO DE ATENCIÓN AUTOMATIZADA
            </span>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.5px' }}>
              {storeInfo.name}
            </h1>
          </div>

          {/* RENDERING DINÁMICO DEL LOGO CON FALLBACK INTEGRADO */}
          <div style={{ width: '60px', height: '60px', borderRadius: '10px', backgroundColor: '#1e2230', border: '1px solid #374151', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {storeInfo.logo_url && !logoError ? (
              <img 
                src={getLogoUrl(storeInfo.logo_url)} 
                alt={`Logo ${storeInfo.name}`} 
                onError={() => setLogoError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} 
              />
            ) : (
              <span style={{ fontSize: '24px', fontWeight: '900', color: '#FFD700' }}>
                {storeInitial}
              </span>
            )}
          </div>
        </div>

        {/* TARJETAS DE ACCIÓN RÁPIDA (SOLO SI ESTÁN ACTIVAS) */}
        {(storeInfo.has_tracking || storeInfo.has_returns) && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: (storeInfo.has_tracking && storeInfo.has_returns) ? '1fr 1fr' : '1fr', 
            gap: '16px', 
            marginBottom: '24px' 
          }}>
            {storeInfo.has_tracking && (
              <button 
                onClick={() => navigate(`/cooppilot/${storeId}/rastreo`)}
                style={{ backgroundColor: '#12141d', border: '1px solid #2a2e3d', padding: '22px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#FFD700'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2e3d'}
              >
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>📦</div>
                <strong style={{ fontSize: '16px', color: '#ffffff', display: 'block', marginBottom: '4px' }}>Rastrear Pedido</strong>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>Consulta el estado del envío en tiempo real</span>
              </button>
            )}

            {storeInfo.has_returns && (
              <button 
                onClick={() => navigate(`/cooppilot/${storeId}/devoluciones`)}
                style={{ backgroundColor: '#12141d', border: '1px solid #2a2e3d', padding: '22px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#FFD700'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2e3d'}
              >
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔄</div>
                <strong style={{ fontSize: '16px', color: '#ffffff', display: 'block', marginBottom: '4px' }}>Cambios y Devoluciones</strong>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>Gestiona el cambio de producto o talla</span>
              </button>
            )}
          </div>
        )}

        {/* MÓDULO INTERACTIVO DE ASISTENTE VIRTUAL IA */}
        <div style={{ backgroundColor: '#12141d', border: '1px solid #2a2e3d', padding: '24px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ fontSize: '20px' }}>🤖</span>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>Asistente Virtual CoopPilot</h2>
          </div>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 20px 0', lineHeight: '1.5' }}>
            Consulta cualquier duda sobre políticas de compra, envíos, métodos de pago o garantías de <strong>{storeInfo.name}</strong>.
          </p>

          {/* BOTONES DE SUGERENCIA RÁPIDA */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[
              "¿Cuáles son los tiempos de envío?",
              "¿Cómo solicito una devolución?",
              "¿Tienen tienda física?"
            ].map((promptText, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(promptText);
                  handleSendChat(promptText);
                }}
                style={{ backgroundColor: '#1a1d29', border: '1px solid #374151', color: '#d1d5db', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2e3d'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1a1d29'}
              >
                💬 {promptText}
              </button>
            ))}
          </div>
         {/* BOTÓN DE ESCALACIÓN A SOPORTE HUMANO */}
        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '10px' }}>¿La inteligencia artificial no pudo resolver tu duda?</p>
          <button 
            onClick={() => setShowSupportForm(!showSupportForm)}
            style={{ backgroundColor: 'transparent', color: '#FFD700', border: '1px solid #FFD700', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s' }}
          >
            {showSupportForm ? 'Cerrar Formulario' : 'Contactar Soporte Humano'}
          </button>
        </div>

        {/* FORMULARIO DE SOPORTE */}
        {showSupportForm && (
          <div style={{ backgroundColor: '#12141d', border: '1px solid #2a2e3d', padding: '24px', borderRadius: '12px', marginTop: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '18px' }}>Envíanos un mensaje</h3>
            <form onSubmit={handleSupportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Tu Nombre" required value={supportData.name} onChange={e => setSupportData({...supportData, name: e.target.value})} style={{ padding: '12px', backgroundColor: '#090a0f', border: '1px solid #374151', borderRadius: '6px', color: '#fff' }} />
              <input type="email" placeholder="Tu Correo" required value={supportData.email} onChange={e => setSupportData({...supportData, email: e.target.value})} style={{ padding: '12px', backgroundColor: '#090a0f', border: '1px solid #374151', borderRadius: '6px', color: '#fff' }} />
              <input type="text" placeholder="Asunto (Ej: Ayuda con mi pedido)" required value={supportData.subject} onChange={e => setSupportData({...supportData, subject: e.target.value})} style={{ padding: '12px', backgroundColor: '#090a0f', border: '1px solid #374151', borderRadius: '6px', color: '#fff' }} />
              <textarea placeholder="Detalla tu problema aquí..." required value={supportData.message} onChange={e => setSupportData({...supportData, message: e.target.value})} style={{ padding: '12px', backgroundColor: '#090a0f', border: '1px solid #374151', borderRadius: '6px', color: '#fff', minHeight: '100px' }} />
              <button type="submit" style={{ backgroundColor: '#FFD700', color: '#111', padding: '12px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Enviar Solicitud</button>
            </form>
            {supportStatus && <p style={{ color: supportStatus.includes('✅') ? '#10b981' : '#f87171', marginTop: '12px', fontSize: '13px', textAlign: 'center' }}>{supportStatus}</p>}
          </div>
        )}
          <form onSubmit={(e) => { e.preventDefault(); handleSendChat(); }} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input 
              type="text" 
              placeholder="Escribe tu consulta aquí..." 
              value={query} 
              onChange={e => setQuery(e.target.value)}
              style={{ flex: 1, padding: '14px 16px', backgroundColor: '#090a0f', border: '1px solid #374151', borderRadius: '8px', color: '#ffffff', fontSize: '14px', outline: 'none' }}
            />
            <button 
              type="submit" 
              disabled={isTyping}
              style={{ backgroundColor: '#FFD700', color: '#111111', border: 'none', padding: '0 24px', borderRadius: '8px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              {isTyping ? 'Pensando...' : 'Consultar'}
            </button>
          </form>

          {chatResponse && (
            <div style={{ padding: '20px', backgroundColor: '#1a1d2d', borderLeft: '4px solid #FFD700', borderRadius: '0 8px 8px 0', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#FFD700', textTransform: 'uppercase', letterSpacing: '1px' }}>RESPUESTA OFICIAL COOPPILOT</span>
                <span style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' }}>VERIFIED BY CONCORDE</span>
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#f3f4f6', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {chatResponse}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default CoopPilotHub;