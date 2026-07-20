import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function CoopPilotHub() {
  const navigate = useNavigate();
  const [storeBranding, setStoreBranding] = useState({ name: 'CARGANDO...', logo_url: '', has_cooppilot: true });
  const [loading, setLoading] = useState(true);
  
  const [chatQuery, setChatQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aiResponse, setAiResponse] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const activeStoreId = urlParams.get('store') || 'enova.agency';

  useEffect(() => {
    // Consultar estado de la tienda
    crmApi.get(`/cooppilot/config/${activeStoreId}`)
      .then(res => {
        if (res.data.success) {
          setStoreBranding({
            name: res.data.data.name.toUpperCase(),
            logo_url: res.data.data.logo_url,
            has_cooppilot: res.data.data.has_cooppilot
          });
        }
      })
      .catch(() => {
        setStoreBranding({ name: 'CENTRO DE AYUDA', logo_url: '', has_cooppilot: false });
      })
      .finally(() => setLoading(false));
  }, [activeStoreId]);

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>Cargando portal de atención...</div>;
  }

  // 🛑 SI COOPPILOT NO ESTÁ HABILITADO
  if (!storeBranding.has_cooppilot) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f4f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px', padding: '40px', maxWidth: '500px', textAlign: 'center', boxShadow: '4px 4px 0px #111' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>{storeBranding.name}</h1>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔒</div>
          <h2 style={{ fontSize: '18px', color: '#991b1b', marginBottom: '10px' }}>Servicio CoopPilot No Activo</h2>
          <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.5' }}>
            Esta tienda no tiene habilitado el portal de atención automatizada ni la Inteligencia Artificial.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f4f0', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }}>
      
      {/* 1. CABECERA MULTITENANT */}
      <div style={{ marginBottom: '40px', textAlign: 'center', width: '100%', maxWidth: '800px' }}>
        {storeBranding.logo_url ? (
          <img src={storeBranding.logo_url} alt={storeBranding.name} style={{ maxHeight: '60px', marginBottom: '16px' }} />
        ) : (
          <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#111', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 16px 0' }}>
            {storeBranding.name} <span style={{ color: '#d9534f' }}>SUPPORT</span>
          </h1>
        )}
        <p style={{ color: '#666', fontSize: '14px', letterSpacing: '1px' }}>POWERED BY Enova Concorde:CoopPilot </p>
      </div>

      {/* 2. EL BUSCADOR IA (EL PRIMER FILTRO) */}
      <div style={{ width: '100%', maxWidth: '800px', marginBottom: '40px' }}>
        <div style={{ backgroundColor: '#fff', border: '3px solid #111', borderRadius: '12px', padding: '24px', boxShadow: '6px 6px 0px #111' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Hola, ¿en qué te podemos ayudar hoy?</h2>
          <form onSubmit={handleAISearch} style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Ej. Mi tarjeta no pasa / ¿Dónde está mi pedido?" 
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              className="crm-input-text" 
              style={{ flex: 1, padding: '16px', fontSize: '16px' }}
            />
            <button type="submit" className="crm-btn-black" style={{ padding: '0 32px', fontSize: '16px' }}>
              Preguntar
            </button>
            {/* ÁREA DE RESPUESTA DE LA IA */}
          {(isTyping || aiResponse) && (
            <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f5f4f0', borderRadius: '8px', borderLeft: '4px solid #111' }}>
              {isTyping ? (
                <div style={{ color: '#666', fontStyle: 'italic', fontSize: '14px' }}>
                  El asistente está escribiendo...
                </div>
              ) : (
                <div>
                  <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '12px', color: '#111' }}>ASISTENTE COOPPILOT</p>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-line' }}>{aiResponse}</p>
                </div>
              )}
            </div>
          )}
          </form>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '12px' }}>
            Nuestro asistente virtual intentará resolver tu duda al instante. Si no puede, te comunicará con un agente de inmediato.
          </p>
        </div>
      </div>

      {/* 3. ACCESOS RÁPIDOS (EL MENÚ DEL HUB) */}
      <div style={{ width: '100%', maxWidth: '800px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        
        <div 
          onClick={() => navigate('/cooppilot/rastreo' + window.location.search)}
          style={{ backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px', padding: '24px', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>📦 Rastrear Pedido</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Conoce el estado exacto de tu envío.</p>
        </div>

        <div 
          onClick={() => navigate('/cooppilot/devoluciones')}
          style={{ backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px', padding: '24px', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>🔄 Cambios y Devoluciones</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Inicia un trámite de RMA o garantía.</p>
        </div>

        <div 
          onClick={() => alert('Próximamente: FAQ')}
          style={{ backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px', padding: '24px', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>📚 Base de Conocimiento</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Políticas, tallas y preguntas frecuentes.</p>
        </div>

        <div 
          onClick={() => alert('Crear ticket manual')}
          style={{ backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px', padding: '24px', cursor: 'pointer', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>💬 Soporte Especializado</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Abre un ticket con nuestros especialistas.</p>
        </div>

      </div>

    </div>
  );
}

export default CoopPilotHub;