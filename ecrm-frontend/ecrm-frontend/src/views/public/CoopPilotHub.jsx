import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function CoopPilotHub() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Obtener el ID de la tienda desde la URL (?store=id) o usar el valor por defecto
  const storeId = searchParams.get('store') || 'enova.agency';

  const [loading, setLoading] = useState(true);
  const [storeInfo, setStoreInfo] = useState(null);
  
  // Estados para el Chatbot
  const [query, setQuery] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // 🔍 Consultar configuración y estado de licencia de la tienda
    crmApi.get(`/cooppilot/config/${storeId}`)
      .then(res => {
        if (res.data.success) {
          setStoreInfo(res.data.data);
        }
      })
      .catch(err => {
        console.error("Error al cargar la tienda:", err);
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsTyping(true);
    setChatResponse('');

    try {
      const res = await crmApi.post('/cooppilot/chat', {
        store_id: storeId,
        query: query
      });

      if (res.data.success) {
        setChatResponse(res.data.response);
      } else {
        setChatResponse(res.data.error || "Ocurrió un error al procesar tu consulta.");
      }
    } catch (err) {
      setChatResponse("No fue posible conectar con el asistente virtual en este momento.");
    } finally {
      setIsTyping(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f5f4f0' }}>
        <p style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>Cargando Centro de Atención...</p>
      </div>
    );
  }

  // 🔒 BLOQUEO DE ACCESO SI COOPPILOT NO ESTÁ ACTIVO
  if (!storeInfo || !storeInfo.has_cooppilot) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f5f4f0', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '20px' 
      }}>
        <div style={{ 
          backgroundColor: '#ffffff', 
          border: '2px solid #111111', 
          borderRadius: '8px', 
          padding: '40px 30px', 
          maxWidth: '480px', 
          width: '100%', 
          textAlign: 'center', 
          boxShadow: '4px 4px 0px #111111' 
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#111111', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
            Servicio No Disponible
          </h2>
          <p style={{ fontSize: '14px', color: '#555555', lineHeight: '1.5', margin: 0 }}>
            El módulo <strong>CoopPilot (IA & Autogestión)</strong> no se encuentra activo para la tienda <strong>{storeInfo?.name || storeId}</strong>.
          </p>
        </div>
      </div>
    );
  }

  // 🚀 VISTA NORMAL DEL HUB (CUANDO SÍ TIENE LICENCIA ACTIVA)
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f4f0', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* CABECERA */}
        <div style={{ backgroundColor: '#ffffff', border: '2px solid #111', padding: '20px', borderRadius: '8px', boxShadow: '4px 4px 0px #111', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>CENTRO DE AYUDA Y SOPORTE</span>
            <h1 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: 'bold' }}>{storeInfo.name}</h1>
          </div>
          {storeInfo.logo_url && (
            <img src={storeInfo.logo_url} alt="Logo" style={{ height: '45px', objectFit: 'contain' }} />
          )}
        </div>

        {/* ACCIONES RÁPIDAS (RASTREO / DEVOLUCIONES) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <button 
            onClick={() => navigate(`/cooppilot/rastreo?store=${storeId}`)}
            style={{ backgroundColor: '#ffffff', border: '2px solid #111', padding: '20px', borderRadius: '8px', boxShadow: '3px 3px 0px #111', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>📦</span>
            <strong style={{ fontSize: '16px', display: 'block' }}>Rastrear mi Pedido</strong>
            <span style={{ fontSize: '12px', color: '#666' }}>Consulta el estado del envío en tiempo real</span>
          </button>

          <button 
            onClick={() => navigate(`/cooppilot/devoluciones?store=${storeId}`)}
            style={{ backgroundColor: '#ffffff', border: '2px solid #111', padding: '20px', borderRadius: '8px', boxShadow: '3px 3px 0px #111', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>🔄</span>
            <strong style={{ fontSize: '16px', display: 'block' }}>Cambios y Devoluciones</strong>
            <span style={{ fontSize: '12px', color: '#666' }}>Solicita el cambio de talla o devolución</span>
          </button>
        </div>

        {/* CHATBOT CON IA */}
        <div style={{ backgroundColor: '#ffffff', border: '2px solid #111', padding: '24px', borderRadius: '8px', boxShadow: '4px 4px 0px #111' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>💬 Asistente Virtual Inteligente</h2>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>Pregúntale a nuestra IA sobre políticas de envío, tiempos de entrega, métodos de pago, etc.</p>

          <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input 
              type="text" 
              placeholder="Ej: ¿Cuáles son las políticas de devolución?" 
              value={query} 
              onChange={e => setQuery(e.target.value)}
              style={{ flex: 1, padding: '12px', border: '2px solid #111', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
            />
            <button 
              type="submit" 
              disabled={isTyping}
              style={{ backgroundColor: '#111', color: '#fff', border: 'none', padding: '0 24px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {isTyping ? 'Pensando...' : 'Consultar'}
            </button>
          </form>

          {chatResponse && (
            <div style={{ padding: '16px', backgroundColor: '#f9f9f6', border: '1px solid #111', borderRadius: '6px' }}>
              <strong style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '6px' }}>RESPUESTA DE COOPPILOT:</strong>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{chatResponse}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default CoopPilotHub;