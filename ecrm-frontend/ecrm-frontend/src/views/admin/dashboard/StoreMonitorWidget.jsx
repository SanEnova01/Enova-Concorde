import React, { useState, useEffect } from 'react';

// 🌟 SUBCOMPONENTE: Monitor de Carga de Trabajo (Estilo Windows 99 unificado con el Theme)
const StoreMonitorWidget = ({ clients, ticketStatusStats }) => {
  const openTickets = (ticketStatusStats['OPEN'] || 0) + (ticketStatusStats['IN_PROGRESS'] || 0);
  const bottleneckPercent = Math.min(100, Math.max(0, (openTickets / 20) * 100));

  // Colores W95 apagados (menos saturación)
  const colorOk = '#98c698';     // Verde pastel
  const colorWarn = '#e6d070';   // Amarillo suave
  const colorCrit = '#d87070';   // Rojo suave

  // 🌟 Color dinámico: 0% -> Verde (Hue 120), 50% -> Amarillo (Hue 60), 100% -> Rojo (Hue 0)
  const hue = (100 - bottleneckPercent) * 1.2;
  const colorBar = `hsl(${Math.max(0, hue)}, 80%, 35%)`;

  // 🌟 Estado para el orden aleatorio de las tiendas
  const [displayClients, setDisplayClients] = useState([]);

  useEffect(() => {
    setDisplayClients(clients);
  }, [clients]);

  // 🌟 Aleatorización cada 5 segundos SOLO si la pestaña está activa/visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setDisplayClients(prev => {
          if (!prev || prev.length <= 1) return prev;
          const array = [...prev];
          for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
          }
          return array;
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      backgroundColor: '#f3f4f6',
      border: '2px solid',
      borderColor: '#ffffff #9ca3af #9ca3af #ffffff',
      padding: '2px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Courier New', Courier, monospace",
      color: '#111',
      boxShadow: 'inset 1px 1px 0px #e5e7eb, inset -1px -1px 0px #4b5563, 0 4px 6px rgba(0,0,0,0.1)'
    }}>
      {/* Barra de Título (Unificada Negra/Dorada) */}
      <div style={{
        backgroundColor: '#111111',
        color: '#FFD700',
        padding: '4px 8px',
        fontWeight: 'bold',
        fontSize: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>SYSTEM_MONITOR</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button style={{ backgroundColor: '#c0c0c0', border: '1px solid', borderColor: '#fff #000 #000 #fff', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#000', fontWeight: 'bold' }}>_</button>
          <button style={{ backgroundColor: '#c0c0c0', border: '1px solid', borderColor: '#fff #000 #000 #fff', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#000', fontWeight: 'bold' }}>X</button>
        </div>
      </div>

      {/* Contenido Principal (Fondo Blanco) */}
      <div style={{ padding: '8px', backgroundColor: '#ffffff', border: '1px solid', borderColor: '#888 #fff #fff #888', minHeight: '220px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Barra de Cuello de Botella (Bottleneck) */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Carga de Cuello de Botella (Tickets Activos):</div>
          <div style={{ 
            width: '100%', 
            height: '18px', 
            border: '1px solid', 
            borderColor: '#888 #fff #fff #888', 
            backgroundColor: '#e5e5e5', 
            position: 'relative'
          }}>
            <div style={{ 
              width: `${bottleneckPercent}%`, 
              height: '100%', 
              backgroundColor: colorBar, 
              transition: 'width 0.5s, background-color 0.5s'
            }}></div>
          </div>
          <div style={{ fontSize: '10px', marginTop: '4px', textAlign: 'right', fontWeight: 'bold' }}>{openTickets} TICKETS GLOBALES</div>
        </div>

        {/* Cuadrícula de Módulos (Tiendas) */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Módulos de Tiendas (Carga de Trabajo):</div>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '6px', 
            padding: '8px', 
            border: '1px solid', 
            borderColor: '#888 #fff #fff #888', 
            backgroundColor: '#e5e5e5', 
            minHeight: '100px', 
            alignContent: 'flex-start',
            justifyContent: 'center'
          }}>
            {displayClients.map(store => {
              const tickets = store.active_ticket_count || 0;
              
              // Colores estilo W95 Apagados
              let bgColor = colorOk; 
              let textColor = '#000';
              if (tickets > 0 && tickets <= 2) {
                bgColor = colorWarn; 
              } else if (tickets > 2) {
                bgColor = colorCrit; 
                textColor = '#fff';
              }

              return (
                <div 
                  key={store.id}
                  title={`${store.name} - Tickets pendientes: ${tickets}`}
                  style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: bgColor,
                    color: textColor,
                    border: '2px solid',
                    borderColor: '#ffffff #808080 #808080 #ffffff', 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'help'
                  }}
                >
                  {tickets}
                </div>
              );
            })}
            {displayClients.length === 0 && <span style={{ fontSize: '11px' }}>No hay módulos detectados.</span>}
          </div>
        </div>
        
        {/* Leyenda W95 */}
        <div style={{ display: 'flex', gap: '12px', fontSize: '10px', justifyContent: 'center', borderTop: '1px dashed #ccc', paddingTop: '8px', fontWeight: 'bold' }}>
          <span style={{display:'flex', alignItems:'center', gap:'4px'}}><div style={{width:'10px',height:'10px',backgroundColor:colorOk,border:'1px solid #666'}}></div> 0</span>
          <span style={{display:'flex', alignItems:'center', gap:'4px'}}><div style={{width:'10px',height:'10px',backgroundColor:colorWarn,border:'1px solid #666'}}></div> 1-2</span>
          <span style={{display:'flex', alignItems:'center', gap:'4px'}}><div style={{width:'10px',height:'10px',backgroundColor:colorCrit,border:'1px solid #666'}}></div> +3</span>
        </div>

      </div>
    </div>
  );
};

export default StoreMonitorWidget;
