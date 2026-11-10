import React from 'react';
import QuickAnalysis from './QuickAnalysis';

const ClientQuickAnalysisPanel = ({ client, quickOpen, setQuickOpen }) => (
  <div className="crm-card-paper" style={{ padding: 0, overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
    <button
      type="button"
      onClick={() => setQuickOpen(o => !o)}
      aria-expanded={quickOpen}
      style={{
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 18px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '900',
        backgroundColor: quickOpen ? '#111111' : '#ffffff', color: quickOpen ? '#FFD700' : '#111111'
      }}
    >
      <span>⚡ Monitor de Rendimiento en Tiempo Real</span>
      <span style={{ fontSize: '12px' }}>{quickOpen ? '▲ Cerrar' : '▼ Abrir'}</span>
    </button>
    {/* Se mantiene montado (solo oculto) para no perder un análisis en curso al plegar */}
    <div style={{ display: quickOpen ? 'block' : 'none' }}>
      <QuickAnalysis storeId={client.id} storeUrl={client.web} />
    </div>
  </div>
);

export default ClientQuickAnalysisPanel;
