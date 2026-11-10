import React from 'react';
import { Activity, Server } from 'lucide-react';

// HEADER DE CONTROL
const MonitorHeader = ({ botStatus, onSync }) => (
  <div style={{ padding: '16px 24px', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
    <div>
      <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#111827', letterSpacing: '-0.5px' }}>Hub General de Monitoreo</h1>
      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>Telemetría en tiempo real, DOM estructural y detección de anomalías IA</p>
    </div>

    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: botStatus.status === 'ONLINE' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${botStatus.status === 'ONLINE' ? '#bbf7d0' : '#fecaca'}`, borderRadius: '6px' }}>
        <Server size={15} color={botStatus.status === 'ONLINE' ? '#15803d' : '#b91c1c'} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '10px', fontWeight: '800', color: botStatus.status === 'ONLINE' ? '#166534' : '#991b1b' }}>
            BOT SCRAPER: {botStatus.status}
          </span>
          <span style={{ fontSize: '9px', color: '#6b7280' }}>
            {botStatus.minutes_ago !== null ? `Latido hace ${botStatus.minutes_ago} min` : 'Desconectado'}
          </span>
        </div>
      </div>

      <button onClick={onSync} className="crm-btn-black" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', borderRadius: '6px' }}>
        <Activity size={13} /> Sincronizar
      </button>
    </div>
  </div>
);

export default MonitorHeader;
