import React, { useState, useMemo } from 'react';

function ClientPerformance({ metrics }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 1. Obtener los meses disponibles únicos (Ej: "2026-07")
  const availableMonths = useMemo(() => {
    if (!metrics || metrics.length === 0) return [];
    const months = new Set(metrics.map(m => {
      const d = new Date(m.date || m.created_at);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }));
    return Array.from(months).sort().reverse(); // Del más reciente al más antiguo
  }, [metrics]);

  // 2. Estado para el mes seleccionado (por defecto el más reciente)
  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] || '');

  // 3. Filtrar las métricas según el mes seleccionado
  const chartMetrics = useMemo(() => {
    if (!selectedMonth) return [];
    return metrics.filter(m => {
      const d = new Date(m.date || m.created_at);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return mStr === selectedMonth;
    }).sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at));
  }, [metrics, selectedMonth]);

  // Configuración del gráfico (SVG)
  const viewW = isExpanded ? 1000 : 650;
  const viewH = isExpanded ? 400 : 220;
  const padL = 50; const padR = 40; const padT = 30; const padB = 40; 
  const graphW = viewW - padL - padR;
  const graphH = viewH - padT - padB;

  const maxTime = Math.max(
    ...chartMetrics.flatMap(m => [
      (Number(m.load_ms) / 1000) || 0,
      (Number(m.dom_ms) / 1000) || 0
    ]), 
    1
  );

  const getX = (index) => padL + (index * graphW) / Math.max(chartMetrics.length - 1, 1);
  const getYTime = (val) => viewH - padB - ((Number(val) || 0) / maxTime) * graphH;

  const loadPoints = chartMetrics.map((m, i) => `${getX(i)},${getYTime(m.load_ms / 1000)}`).join(' ');
  const domPoints = chartMetrics.map((m, i) => `${getX(i)},${getYTime(m.dom_ms / 1000)}`).join(' ');

  const renderContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 className="crm-section-title" style={{ margin: 0 }}>Rendimiento: Tiempos de Carga</h2>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="crm-select-dropdown"
            style={{ padding: '4px 8px', fontSize: '12px' }}
          >
            {availableMonths.length === 0 ? <option value="">Sin datos</option> : null}
            {availableMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          
          {!isExpanded && (
            <button onClick={() => setIsExpanded(true)} className="crm-btn-border" style={{ fontSize: '11px', padding: '4px 8px' }}>
              ↗ Ampliar
            </button>
          )}
        </div>
      </div>

      {chartMetrics.length < 2 ? (
        <p className="crm-text-muted" style={{ textAlign: 'center', padding: '32px 0', flexGrow: 1 }}>
          Inserta al menos 2 registros en {selectedMonth || 'este mes'} para trazar la gráfica.
        </p>
      ) : (
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: '100%', overflowX: 'auto', backgroundColor: '#fcfbfa', border: '1px solid #cccccc', padding: '10px 0', flexGrow: 1 }}>
            <svg viewBox={`0 0 ${viewW} ${viewH}`} style={{ width: '100%', height: isExpanded ? '100%' : 'auto', display: 'block' }}>
              <line x1={padL} y1={padT} x2={viewW - padR} y2={padT} stroke="#e5e5e5" strokeWidth="1" strokeDasharray="3,3" />
              <line x1={padL} y1={padT + graphH / 2} x2={viewW - padR} y2={padT + graphH / 2} stroke="#e5e5e5" strokeWidth="1" strokeDasharray="3,3" />
              <line x1={padL} y1={viewH - padB} x2={viewW - padR} y2={viewH - padB} stroke="#111111" strokeWidth="1.5" />
              <line x1={padL} y1={padT} x2={padL} y2={viewH - padB} stroke="#111111" strokeWidth="1.5" />

              <polyline fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="4,4" points={domPoints} />
              <polyline fill="none" stroke="#16a34a" strokeWidth="3" points={loadPoints} />

              {chartMetrics.map((m, i) => {
                const cx = getX(i);
                const dateStr = m.date ? new Date(m.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) : '04/06';
                const loadInSeconds = m.load_ms !== null ? (m.load_ms / 1000) : 0;
                const domInSeconds = m.dom_ms !== null ? (m.dom_ms / 1000) : 0;
                
                return (
                  <g key={m.id || i}>
                    <circle cx={cx} cy={getYTime(domInSeconds)} r="4" fill="#2563eb" />
                    <circle cx={cx} cy={getYTime(loadInSeconds)} r="5" fill="#16a34a" />
                    <text x={cx} y={viewH - 15} textAnchor="middle" style={{ fontSize: '10px', fontFamily: 'monospace', fill: '#555555' }}>
                      {dateStr}
                    </text>
                    <text x={cx} y={getYTime(loadInSeconds) - 12} textAnchor="middle" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#16a34a' }}>
                      {m.load_ms !== null ? `${loadInSeconds.toFixed(2)}s` : ''}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div style={{ display: 'flex', gap: '24px', marginTop: '14px', fontSize: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '24px', height: '0px', borderTop: '3px solid #16a34a', display: 'inline-block' }}></span> 
              <strong>Tiempo Carga (Load)</strong> <span style={{ color: '#666666' }}>(Pico: {maxTime.toFixed(2)}s)</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '24px', height: '0px', borderTop: '2px dashed #2563eb', display: 'inline-block' }}></span> 
              <strong>Tiempo DOM</strong>
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
            style={{ width: '90vw', height: '80vh', maxWidth: '1200px', display: 'flex', flexDirection: 'column' }}
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

export default ClientPerformance;