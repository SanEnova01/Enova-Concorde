import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function CoopPilotHub() {
  const navigate = useNavigate();
  const [storeBranding, setStoreBranding] = useState({ name: 'Cargando...', logo_url: '' });
  const [chatQuery, setChatQuery] = useState('');

  // Simulador de Multitenancy: En el futuro esto leerá el subdominio real (ej. ayuda.rumah.pe)
  useEffect(() => {
    // Por ahora simulamos que detectó a "Rumah"
    setStoreBranding({
      name: 'RUMAH',
      logo_url: '' // Aquí iría el logo de Rumah si lo tuvieras
    });
  }, []);

  const handleAISearch = (e) => {
    e.preventDefault();
    alert(`Aquí la IA analizará: "${chatQuery}" y dará una solución instantánea antes de crear el ticket.`);
    // Próximo paso: Conectar a OpenAI/Asistente
  };

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
        <p style={{ color: '#666', fontSize: '14px', letterSpacing: '1px' }}>POWERED BY COOPPILOT (ENOVA)</p>
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
          </form>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '12px' }}>
            Nuestro asistente virtual intentará resolver tu duda al instante. Si no puede, te comunicará con un agente de inmediato.
          </p>
        </div>
      </div>

      {/* 3. ACCESOS RÁPIDOS (EL MENÚ DEL HUB) */}
      <div style={{ width: '100%', maxWidth: '800px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        
        <div 
          onClick={() => alert('Próximamente: Rastreador de envíos')}
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