import React from 'react';

// SUBCOMPONENTE: Widget de Monitoreo
const StatusWidget = ({ title, data, icon }) => {
  if (!data) return <div className="crm-card-paper" style={{ padding: '16px' }}><div className="crm-text-loading">Cargando {title}...</div></div>;

  const isOperational = data.global?.indicator === 'none';

  return (
    <div className="crm-card-paper" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dotted #111111', paddingBottom: '12px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {icon && (
            <img 
              src={icon} 
              alt={`Logo de ${title}`} 
              style={{ width: '28px', height: '28px', objectFit: 'contain', flexShrink: 0 }} 
            />
          )}
          <div>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Infraestructura Externa</span>
            <h4 style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: 'bold', color: '#111111' }}>
              {title}: {data.global?.status}
            </h4>
          </div>
        </div>

        <span style={{ 
          width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
          backgroundColor: isOperational ? '#16a34a' : '#dc2626',
          boxShadow: isOperational ? '0 0 8px #16a34a' : '0 0 8px #dc2626'
        }}></span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
        {(data.components || []).map((comp, idx) => {
          let statusLabel = 'Operativo';
          let statusColor = '#16a34a'; 
          let statusBg = '#f0fdf4';
          let statusIcon = '✓';

          if (comp.status === 'degraded_performance') {
            statusLabel = 'Rendimiento deficiente';
            statusColor = '#eab308'; statusBg = '#fef9c3'; statusIcon = '➖';
          } else if (comp.status === 'partial_outage') {
            statusLabel = 'Interrupción parcial';
            statusColor = '#f97316'; statusBg = '#ffedd5'; statusIcon = '⚠️';
          } else if (comp.status === 'major_outage') {
            statusLabel = 'Interrupción importante';
            statusColor = '#dc2626'; statusBg = '#fef2f2'; statusIcon = '❌';
          } else if (comp.status === 'under_maintenance' || comp.status === 'maintenance') {
            statusLabel = 'Mantenimiento';
            statusColor = '#2563eb'; statusBg = '#eff6ff'; statusIcon = '🔧';
          }

          return (
            <div key={idx} style={{ 
              padding: '8px 10px', borderRadius: '6px', backgroundColor: '#fcfbfa', 
              border: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={comp.name}>
                {comp.name}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '4px', backgroundColor: statusBg }}>
                <span style={{ fontSize: '10px', color: statusColor, fontWeight: 'bold' }}>{statusIcon}</span>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: statusColor }}>{statusLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusWidget;
