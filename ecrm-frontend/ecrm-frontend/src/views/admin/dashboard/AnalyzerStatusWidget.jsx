import React, { useState, useEffect } from 'react';
import crmApi from '../../../api/crmApi';
import { startVisiblePolling } from '../../../utils/visiblePolling';

// 🌟 SUBCOMPONENTE: Widget del Concorde Analyzer
const AnalyzerStatusWidget = () => {
  const [botStatus, setBotStatus] = useState({ status: 'LOADING', last_heartbeat: null, is_running: false });

  useEffect(() => {
    const checkBotStatus = async () => {
      try {
        const res = await crmApi.get('/metrics/bot-status');
        if (res.data?.success) {
          const statusInfo = res.data.data || res.data;
          setBotStatus(statusInfo);
        }
      } catch (error) {
        setBotStatus({ status: 'OFFLINE', last_heartbeat: null, is_running: false });
      }
    };

    checkBotStatus();
    return startVisiblePolling(checkBotStatus, 30000);
  }, []);

  const isOnline = botStatus.status === 'ONLINE';

  return (
    <div 
      onClick={() => window.location.href = 'https://enova-concorde-2027.up.railway.app/admin/analyzer'}
      style={{ 
        display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer',
        backgroundColor: '#ffffff', padding: '8px 16px', 
        borderRadius: '8px', border: '1px solid #c8c6c1', 
        borderLeft: isOnline ? '4px solid #16a34a' : '4px solid #dc2626',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)', fontFamily: "'Nunito', system-ui, sans-serif",
        transition: 'background-color 0.2s ease'
    }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fcfbfa'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
    >
      <div style={{
        width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
        backgroundColor: isOnline ? '#16a34a' : '#dc2626',
        boxShadow: isOnline ? '0 0 8px #16a34a' : '0 0 8px #dc2626'
      }} />
      <div style={{ lineHeight: '1.2' }}>
        <span style={{ fontSize: '9px', fontWeight: '900', color: '#666666', letterSpacing: '0.5px' }}>CONCORDE ANALYZER</span><br/>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#111111' }}>
          {botStatus.status} {botStatus.is_running && <span style={{ color: '#d97706' }}>(ANALIZANDO...)</span>}
        </span>
      </div>
    </div>
  );
};

export default AnalyzerStatusWidget;
