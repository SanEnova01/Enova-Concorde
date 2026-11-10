import React from 'react';

// 🌟 SUBCOMPONENTE: Centro de Comando Orbital (Concorde Spaceship)
const ConcordeSpaceshipWidget = ({ stats, planStats, ticketStatusStats }) => {
  const openTickets = (ticketStatusStats['OPEN'] || 0) + (ticketStatusStats['IN_PROGRESS'] || 0);
  
  // Lógica de estado de la nave
  const shieldIntegrity = Math.max(0, 100 - (openTickets * 2));
  const isAlert = openTickets > 10;
  const systemStatus = isAlert ? 'ALERTA AMARILLA' : 'ÓRBITA ESTABLE';
  const statusColor = isAlert ? '#f59e0b' : '#16a34a';

  return (
    <div style={{
      backgroundColor: '#0a0a0a',
      borderRadius: '8px',
      padding: '20px',
      color: '#e5e7eb',
      fontFamily: "'Courier New', Courier, monospace",
      boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8), 0 4px 10px rgba(0,0,0,0.2)',
      border: '2px solid #333',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <style>{`
        @keyframes radarSweep { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pulseAlert { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}</style>
      
      {/* Header del Comando */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #444', paddingBottom: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '24px' }}>🚀</div>
          <div>
            <div style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', letterSpacing: '2px' }}>NAVE INSIGNIA</div>
            <div style={{ fontSize: '16px', color: '#FFD700', fontWeight: '900', letterSpacing: '1px' }}>CONCORDE O.S.</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', color: '#888', letterSpacing: '1px' }}>ESTADO DEL SISTEMA</div>
          <div style={{ 
            fontSize: '12px', 
            color: statusColor, 
            fontWeight: 'bold', 
            animation: isAlert ? 'pulseAlert 1.5s infinite' : 'none',
            backgroundColor: isAlert ? 'rgba(245, 158, 11, 0.1)' : 'rgba(22, 163, 74, 0.1)',
            padding: '4px 8px',
            borderRadius: '4px',
            marginTop: '4px',
            border: `1px solid ${statusColor}`
          }}>
            ● {systemStatus}
          </div>
        </div>
      </div>

      {/* Subsistemas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Tripulación (Clientes) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', padding: '10px 12px', borderRadius: '6px', border: '1px solid #222' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>👨‍🚀</span>
            <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 'bold' }}>TRIPULACIÓN CONECTADA</span>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', textShadow: '0 0 5px rgba(255,255,255,0.5)' }}>
            {stats.clients} ALMAS
          </span>
        </div>

        {/* Escudos y Casco (Tickets Abiertos) */}
        <div style={{ backgroundColor: '#111', padding: '12px', borderRadius: '6px', border: '1px solid #222' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#aaa', marginBottom: '8px', fontWeight: 'bold' }}>
            <span>INTEGRIDAD DEL CASCO (DEFENSA)</span>
            <span style={{ color: shieldIntegrity < 50 ? '#ef4444' : '#16a34a' }}>{shieldIntegrity}%</span>
          </div>
          <div style={{ width: '100%', backgroundColor: '#000', height: '12px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #333' }}>
            <div style={{ 
              width: `${shieldIntegrity}%`, 
              backgroundColor: shieldIntegrity < 50 ? '#ef4444' : (shieldIntegrity < 80 ? '#f59e0b' : '#16a34a'), 
              height: '100%', 
              transition: 'width 1s ease-in-out',
              boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
            }}></div>
          </div>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Anomalías reportadas (Tickets):</span>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>{openTickets} Activas</span>
          </div>
        </div>

        {/* Módulos de Soporte Vital (Planes) */}
        <div>
          <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '8px', fontWeight: 'bold', letterSpacing: '1px' }}>MÓDULOS DE EXPANSIÓN EN ÓRBITA</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ backgroundColor: '#1a1a1a', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #FFD700' }}>
              <div style={{ fontSize: '9px', color: '#888' }}>MÓDULO GROWTH</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#FFD700' }}>{planStats.growth} <span style={{fontSize:'9px', color:'#555'}}>ON</span></div>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #2563eb' }}>
              <div style={{ fontSize: '9px', color: '#888' }}>MÓDULO ESCALE</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb' }}>{planStats.escale} <span style={{fontSize:'9px', color:'#555'}}>ON</span></div>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #16a34a' }}>
              <div style={{ fontSize: '9px', color: '#888' }}>CÁPSULAS GO</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#16a34a' }}>{planStats.go} <span style={{fontSize:'9px', color:'#555'}}>ON</span></div>
            </div>
            <div style={{ backgroundColor: '#1a1a1a', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #9333ea' }}>
              <div style={{ fontSize: '9px', color: '#888' }}>SONDAS LEADS</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#9333ea' }}>{planStats.leads} <span style={{fontSize:'9px', color:'#555'}}>ON</span></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ConcordeSpaceshipWidget;
