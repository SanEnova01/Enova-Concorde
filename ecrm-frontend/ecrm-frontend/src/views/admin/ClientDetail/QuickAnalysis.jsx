import React, { useState } from 'react';
import crmApi from '../../../api/crmApi';

function QuickAnalysis({ storeId, storeUrl }) {
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // 1. LEER EL ROL DEL USUARIO
  const token = localStorage.getItem('crm_token');
  let userRole = 'client';
  if (token) {
    try {
      const payload = JSON.parse(window.atob(token.split('.')[1]));
      userRole = payload.role;
    } catch (e) {
      console.error("Error decodificando token en QuickAnalysis:", e);
    }
  }

  // 2. FUNCIÓN PARA ADMINS: EJECUTA EL BOT INMEDIATAMENTE
  const handleRunAnalysis = async () => {
    if (!storeUrl) {
      alert("El cliente no tiene una URL configurada.");
      return;
    }
    
    setLoading(true);
    try {
      const response = await crmApi.post('/metrics/run-single-client', {
        store_id: storeId,
        url: storeUrl
      });
      
      if (response.data.success) {
        alert("✅ Análisis On-Demand ejecutado con éxito. Los datos se han actualizado.");
        window.location.reload(); // Recarga para que los gráficos absorban el nuevo dato
      }
    } catch (error) {
      console.error("Error al ejecutar análisis:", error);
      alert("❌ Ocurrió un error al intentar comunicar con el motor de análisis.");
    }
    setLoading(false);
  };

  // 3. FUNCIÓN PARA CLIENTES: CREA UN TICKET INTERNO
  const handleRequestAudit = async () => {
    setRequesting(true);
    try {
      const ticketPayload = {
        name: `[AUDITORÍA ON-DEMAND] - ${storeUrl || 'Tienda'}`,
        description: `El cliente ha solicitado un análisis de rendimiento profundo On-Demand.\n\nCódigo de Autorización: AUDIT-REQ-${storeId}\nURL Objetivo: ${storeUrl || 'No registrada'}`,
        store_id: storeId,
        priority: 'HIGH', // Alta prioridad para que el Admin lo vea rápido
        task_type: 'TASK_INTERNA',
        is_b2c: false // Es para la agencia (interno)
      };

      const res = await crmApi.post('/tickets', ticketPayload);
      
      if (res.data.success || res.status === 201) {
        alert("✅ Solicitud enviada correctamente. Nuestro equipo técnico ejecutará la auditoría en breve.");
      }
    } catch (error) {
      console.error("Error al crear ticket de auditoría:", error);
      alert("❌ Hubo un error al procesar la solicitud. Intente nuevamente.");
    }
    setRequesting(false);
  };

  return (
    <div className="crm-card-paper" style={{ marginBottom: '24px', border: '2px solid #111', backgroundColor: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        
        <div>
          <h3 className="crm-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
            ⚡ Monitor de Rendimiento en Tiempo Real
          </h3>
          <p className="crm-text-muted" style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
            {userRole === 'client' 
              ? 'Solicite una auditoría profunda de Core Web Vitals y carga estructural.' 
              : 'Dispara un análisis forzado usando el motor de Puppeteer.'}
          </p>
        </div>

        <div>
          {/* RENDERIZADO CONDICIONAL DE BOTONES SEGÚN EL ROL */}
          {userRole === 'client' ? (
            <button 
              onClick={handleRequestAudit} 
              disabled={requesting}
              className="crm-btn-black"
              style={{ padding: '10px 20px', cursor: requesting ? 'not-allowed' : 'pointer', opacity: requesting ? 0.7 : 1 }}
            >
              {requesting ? '⏳ Enviando ticket...' : '✋ Solicitar Análisis On-Demand'}
            </button>
          ) : (
            <button 
              onClick={handleRunAnalysis} 
              disabled={loading}
              className="crm-btn-black"
              style={{ backgroundColor: '#FFD700', color: '#111', padding: '10px 20px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? '⚙️ Analizando tienda...' : '🚀 Ejecutar Análisis Ahora'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default QuickAnalysis;