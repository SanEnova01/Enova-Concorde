import React from 'react';
import { Activity, AlertCircle, AlertTriangle, CheckCircle2, Terminal } from 'lucide-react';

// PANEL LATERAL: HISTORIAL DE ALERTAS Y LOGS DE ESCANEO
const FeedPanel = ({ feedFilter, setFeedFilter, timelineFeed, navigate, resolverAlerta, chatBottomRef }) => (
    <div style={{ width: '420px', backgroundColor: '#ffffff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '900', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} color="#111827" /> Feed de Telemetría e IA
          </h2>
        </div>

        <p style={{ margin: '4px 0 12px 0', fontSize: '11px', color: '#6b7280' }}>
          Incidencias detectadas y registros de escaneos exitosos en tiempo real.
        </p>

        {/* FILTRO DE LOGS */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            onClick={() => setFeedFilter('ALL')}
            style={{ flex: 1, padding: '4px 8px', fontSize: '10px', fontWeight: '700', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: feedFilter === 'ALL' ? '#111827' : '#ffffff', color: feedFilter === 'ALL' ? '#ffffff' : '#374151', cursor: 'pointer' }}
          >
            Todos
          </button>
          <button
            onClick={() => setFeedFilter('OPEN')}
            style={{ flex: 1, padding: '4px 8px', fontSize: '10px', fontWeight: '700', borderRadius: '4px', border: '1px solid #fecaca', backgroundColor: feedFilter === 'OPEN' ? '#991b1b' : '#ffffff', color: feedFilter === 'OPEN' ? '#ffffff' : '#991b1b', cursor: 'pointer' }}
          >
            Abiertas
          </button>
          <button
            onClick={() => setFeedFilter('ALERTS')}
            style={{ flex: 1, padding: '4px 8px', fontSize: '10px', fontWeight: '700', borderRadius: '4px', border: '1px solid #fecaca', backgroundColor: feedFilter === 'ALERTS' ? '#dc2626' : '#fef2f2', color: feedFilter === 'ALERTS' ? '#ffffff' : '#991b1b', cursor: 'pointer' }}
          >
            Alertas IA
          </button>
          <button 
            onClick={() => setFeedFilter('SUCCESS')}
            style={{ flex: 1, padding: '4px 8px', fontSize: '10px', fontWeight: '700', borderRadius: '4px', border: '1px solid #bbf7d0', backgroundColor: feedFilter === 'SUCCESS' ? '#16a34a' : '#f0fdf4', color: feedFilter === 'SUCCESS' ? '#ffffff' : '#166534', cursor: 'pointer' }}
          >
            Escaneos OK
          </button>
        </div>
      </div>

      {/* LISTADO DE ITEMS DEL CHAT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#fcfcfc' }}>
        {timelineFeed.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', textAlign: 'center' }}>
            <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: '8px', opacity: 0.6 }} />
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>Sistemas en Normalidad</span>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>Sin eventos pendientes en el filtro seleccionado.</span>
          </div>
        ) : (
          timelineFeed.map((item) => {
            const isCritical = item.severity === 'CRITICAL';
            const isWarning = item.severity === 'WARNING';
            const isSuccess = item.severity === 'SUCCESS';
            const isHistory = item.severity === 'HISTORY';

            let cardBg = '#ffffff';
            let borderColor = '#e5e7eb';
            let tagColor = { bg: '#f3f4f6', text: '#374151' };

            if (isHistory) {
              cardBg = '#f9fafb';
              borderColor = '#e5e7eb';
            } else if (isCritical) {
              cardBg = '#fef2f2';
              borderColor = '#fecaca';
              tagColor = { bg: '#fee2e2', text: '#991b1b' };
            } else if (isWarning) {
              cardBg = '#fffbeb';
              borderColor = '#fde68a';
              tagColor = { bg: '#fef3c7', text: '#92400e' };
            } else if (isSuccess) {
              cardBg = '#f0fdf4';
              borderColor = '#bbf7d0';
              tagColor = { bg: '#dcfce7', text: '#166534' };
            }

            return (
              <div 
                key={item.id} 
                style={{ 
                  display: 'flex', 
                  gap: '10px', 
                  padding: '12px', 
                  backgroundColor: cardBg, 
                  border: `1px solid ${borderColor}`, 
                  borderRadius: '8px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  opacity: isHistory ? 0.65 : 1
                }}
              >
                <div style={{ paddingTop: '2px' }}>
                  {isCritical && <AlertTriangle size={15} color="#dc2626" />}
                  {isWarning && <AlertCircle size={15} color="#d97706" />}
                  {isSuccess && <CheckCircle2 size={15} color="#16a34a" />}
                  {!isCritical && !isWarning && !isSuccess && <Activity size={15} color={isHistory ? '#9ca3af' : '#2563eb'} />}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span 
                      style={{ fontSize: '12px', fontWeight: '800', color: '#111827', cursor: 'pointer' }} 
                      onClick={() => navigate(`/admin/clientes/${item.store_id}`)}
                    >
                      {item.store_name}
                    </span>
                    <span style={{ fontSize: '10px', color: '#6b7280' }}>
                      {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase', backgroundColor: tagColor.bg, color: tagColor.text }}>
                      {item.alert_type}
                    </span>
                    {item.type === 'AI_ALERT' && item.status !== 'OPEN' && (
                      <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase', backgroundColor: item.status === 'RECOVERY' ? '#dcfce7' : '#e5e7eb', color: item.status === 'RECOVERY' ? '#166534' : '#4b5563' }}>
                        {{ RECOVERY: 'Corregido', INFO: 'Info', SUPERSEDED: 'Histórica', RESOLVED: 'Atendida' }[item.status]}
                      </span>
                    )}
                    {item.status === 'OPEN' && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); resolverAlerta(item.alert_id); }}
                        style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', cursor: 'pointer' }}
                      >
                        ✓ Marcar atendida
                      </button>
                    )}
                  </div>

                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#374151', lineHeight: '1.4' }}>
                    {item.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatBottomRef} />
    </div>

  </div>
);

export default FeedPanel;
