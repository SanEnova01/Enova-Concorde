import React, { useState } from 'react';

function ClientMemoryVu({ metrics }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const chartMetrics = metrics.slice(-8);
  const latestMetric = chartMetrics[chartMetrics.length - 1] || {};
  
  const latestRamCore = Number(latestMetric.ram_core_mb) || 0;
  const vuCoreMax = Math.max(200, ...chartMetrics.map(m => Number(m.ram_core_mb) || 0)); 
  const needleCoreAngle = Math.min((latestRamCore / vuCoreMax) * 180, 180) - 90; 

  const latestRamTotal = Number(latestMetric.ram_total_mb) || 0;
  const vuTotalMax = Math.max(500, ...chartMetrics.map(m => Number(m.ram_total_mb) || 0)); 
  const needleTotalAngle = Math.min((latestRamTotal / vuTotalMax) * 180, 180) - 90; 

  const renderContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 className="crm-section-title" style={{ margin: 0 }}>Memoria JS Heap (Navegador Cliente)</h2>
          <p className="crm-text-muted" style={{ fontSize: '11px', margin: '4px 0 0 0' }}>
            Mide el peso del código ejecutado en el dispositivo del cliente.
          </p>
        </div>
        {!isExpanded && (
          <button onClick={() => setIsExpanded(true)} className="crm-btn-border" style={{ fontSize: '11px', padding: '4px 8px' }}>
            ↗ Ampliar
          </button>
        )}
      </div>

      {chartMetrics.length === 0 ? (
        <p className="crm-text-muted" style={{ textAlign: 'center', padding: '32px 0', flexGrow: 1 }}>
          Inserta métricas para generar este gráfico.
        </p>
      ) : (
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <style>
            {`
              @keyframes needleVibrate {
                0% { transform: rotate(-0.6deg); }
                25% { transform: rotate(0.8deg); }
                50% { transform: rotate(-0.3deg); }
                75% { transform: rotate(0.6deg); }
                100% { transform: rotate(0deg); }
              }
            `}
          </style>

          <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px' }}>
            <div style={{ flex: 1, minWidth: '200px', backgroundColor: '#fcfbfa', border: '1px solid #cccccc', padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#111111', textTransform: 'uppercase' }}>RAM Core (Motor JS)</h4>
              <svg viewBox="0 0 650 280" style={{ width: '100%', maxWidth: isExpanded ? '500px' : '300px', height: 'auto', display: 'block', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="vuGradientCore" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#16a34a" /> 
                    <stop offset="50%" stopColor="#eab308" />
                    <stop offset="75%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>
                <path d="M 125 200 A 200 200 0 0 1 525 200" fill="none" stroke="#e5e5e5" strokeWidth="30" strokeLinecap="round" />
                <path d="M 125 200 A 200 200 0 0 1 525 200" fill="none" stroke="url(#vuGradientCore)" strokeWidth="30" strokeLinecap="round" />
                <text x="125" y="240" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 'bold', fill: '#16a34a' }}>0</text>
                <text x="325" y="40" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 'bold', fill: '#eab308' }}>{Math.round(vuCoreMax / 2)}</text>
                <text x="525" y="240" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 'bold', fill: '#dc2626' }}>{Math.round(vuCoreMax)}</text>
                <g transform={`rotate(${needleCoreAngle}, 325, 200)`} style={{ transition: 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                  <g style={{ transformOrigin: '325px 200px', animation: 'needleVibrate 0.1s infinite linear alternate' }}>
                    <polygon points="321,200 325,50 329,200" fill="#111111" />
                    <circle cx="325" cy="200" r="14" fill="#111111" />
                    <circle cx="325" cy="200" r="5" fill="#ffffff" />
                  </g>
                </g>
                <text x="325" y="165" textAnchor="middle" style={{ fontSize: '46px', fontWeight: 'bold', fill: '#111111' }}>{latestRamCore.toFixed(1)}</text>
                <text x="325" y="120" textAnchor="middle" style={{ fontSize: '13px', fill: '#666666', letterSpacing: '1px' }}>MB Actuales</text>
              </svg>
            </div>

            <div style={{ flex: 1, minWidth: '200px', backgroundColor: '#fcfbfa', border: '1px solid #cccccc', padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#111111', textTransform: 'uppercase' }}>RAM Total (Pestaña)</h4>
              <svg viewBox="0 0 650 280" style={{ width: '100%', maxWidth: isExpanded ? '500px' : '300px', height: 'auto', display: 'block', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="vuGradientTotal" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#16a34a" /> 
                    <stop offset="40%" stopColor="#eab308" />
                    <stop offset="80%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>
                <path d="M 125 200 A 200 200 0 0 1 525 200" fill="none" stroke="#e5e5e5" strokeWidth="30" strokeLinecap="round" />
                <path d="M 125 200 A 200 200 0 0 1 525 200" fill="none" stroke="url(#vuGradientTotal)" strokeWidth="30" strokeLinecap="round" />
                <text x="125" y="240" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 'bold', fill: '#16a34a' }}>0</text>
                <text x="325" y="40" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 'bold', fill: '#eab308' }}>{Math.round(vuTotalMax / 2)}</text>
                <text x="525" y="240" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 'bold', fill: '#dc2626' }}>{Math.round(vuTotalMax)}</text>
                <g transform={`rotate(${needleTotalAngle}, 325, 200)`} style={{ transition: 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                  <g style={{ transformOrigin: '325px 200px', animation: 'needleVibrate 0.1s infinite linear alternate' }}>
                    <polygon points="321,200 325,50 329,200" fill="#111111" />
                    <circle cx="325" cy="200" r="14" fill="#111111" />
                    <circle cx="325" cy="200" r="5" fill="#ffffff" />
                  </g>
                </g>
                <text x="325" y="165" textAnchor="middle" style={{ fontSize: '46px', fontWeight: 'bold', fill: '#111111' }}>{latestRamTotal.toFixed(1)}</text>
                <text x="325" y="120" textAnchor="middle" style={{ fontSize: '13px', fill: '#666666', letterSpacing: '1px' }}>MB Actuales</text>
              </svg>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px', fontSize: '12px' }}>
            <span style={{ color: '#666666', textAlign: 'center' }}>
              Mostrando el estado del <strong>último registro procesado</strong> ({latestMetric.date ? new Date(latestMetric.date).toLocaleDateString() : 'Hoy'}).
            </span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="crm-card-paper">
        {renderContent()}
      </div>

      {isExpanded && (
        <div className="crm-modal-mask" onClick={() => setIsExpanded(false)} style={{ zIndex: 9999 }}>
          <div 
            className="crm-modal-content" 
            onClick={e => e.stopPropagation()}
            style={{ width: '90vw', height: '80vh', maxWidth: '1000px', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <button onClick={() => setIsExpanded(false)} className="crm-btn-red" style={{ padding: '6px 12px' }}>Cerrar ✕</button>
            </div>
            {renderContent()}
          </div>
        </div>
      )}
    </>
  );
}

export default ClientMemoryVu;