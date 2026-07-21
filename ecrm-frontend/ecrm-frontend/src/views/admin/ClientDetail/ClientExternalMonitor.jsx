import React from 'react';

function ClientExternalMonitor({ client, shopifyStatus, vtexStatus, wooStatus }) {
  const techStr = String(client?.tecnologia || '').toLowerCase();
  const showShopifyWidget = techStr.includes('shopify') && shopifyStatus;
  const showVtexWidget = techStr.includes('vtex') && vtexStatus;
  const showWooWidget = techStr.includes('woo'); 

  const showExternalMonitor = showShopifyWidget || showVtexWidget || showWooWidget;
  if (!showExternalMonitor) return null;

  const activeMonitorName = showShopifyWidget 
    ? 'Ecosistema Shopify Inc.' 
    : showVtexWidget 
      ? 'Plataforma VTEX Global' 
      : 'Monitoreo Externo WooCommerce';

  const activeMonitor = showShopifyWidget 
    ? shopifyStatus 
    : showVtexWidget 
      ? vtexStatus 
      : (wooStatus || {
          global: { status: 'Analizando conexión con la tienda...', indicator: 'minor' },
          components: [
            { name: 'Resolución de DNS y SSL', status: 'operational' },
            { name: 'Tiempo de Respuesta (TTFB)', status: 'operational' },
            { name: 'Estabilidad de Base de Datos', status: 'operational' },
            { name: 'Núcleo de Aplicación (PHP)', status: 'operational' }
          ]
        });

  return (
    <div className="crm-card-paper" style={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dotted #111111', paddingBottom: '12px', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Infraestructura Externa</span>
          <h4 style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 'bold', color: '#111111', wordBreak: 'break-word' }}>
            {activeMonitorName}: {activeMonitor.global?.status}
          </h4>
        </div>
        <span style={{ 
          width: '12px', 
          height: '12px', 
          borderRadius: '50%', 
          backgroundColor: activeMonitor.global?.indicator === 'none' ? '#16a34a' : '#dc2626',
          flexShrink: 0,
          boxShadow: activeMonitor.global?.indicator === 'none' ? '0 0 8px #16a34a' : '0 0 8px #dc2626'
        }}></span>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
        gap: '10px',
        maxHeight: '240px',
        overflowY: 'auto',
        paddingRight: '2px'
      }}>
        {(activeMonitor.components || []).map((comp, idx) => {
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
              padding: '10px', 
              borderRadius: '6px', 
              backgroundColor: '#fcfbfa', 
              border: '1px solid #e5e5e5',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '6px'
            }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={comp.name}>
                {comp.name}
              </span>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                padding: '4px 6px',
                borderRadius: '4px',
                backgroundColor: statusBg,
                width: 'fit-content'
              }}>
                <span style={{ fontSize: '10px', color: statusColor, fontWeight: 'bold' }}>{statusIcon}</span>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: statusColor }}>{statusLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ClientExternalMonitor;