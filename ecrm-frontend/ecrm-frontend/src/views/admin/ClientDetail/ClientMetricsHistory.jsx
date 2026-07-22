import React, { useState } from 'react';

function ClientMetricsHistory({ metrics = [] }) {
  const [metricCurrentPage, setMetricCurrentPage] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);

  // Si está expandido mostramos 15 filas, si no, solo 5
  const itemsPerPage = isExpanded ? 15 : 5;

  const indexOfLastMetric = metricCurrentPage * itemsPerPage;
  const indexOfFirstMetric = indexOfLastMetric - itemsPerPage;
  const currentMetrics = metrics.slice(indexOfFirstMetric, indexOfLastMetric);
  const totalMetricPages = Math.ceil(metrics.length / itemsPerPage) || 1;

  const renderContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 className="crm-section-title" style={{ marginTop: 0, marginBottom: 0 }}>Registros Históricos de Actividad</h2>
        {!isExpanded && (
          <button onClick={() => setIsExpanded(true)} className="crm-btn-border" style={{ fontSize: '11px', padding: '4px 8px' }}>
            ↗ Ampliar Vista
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1, overflowX: 'auto' }}>
        {currentMetrics.length === 0 ? (
          <p className="crm-text-muted">No cuenta con métricas diarias registradas.</p>
        ) : (
          <table className="crm-table-data" style={{ minWidth: '600px', fontSize: '13px', width: '100%' }}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Req</th>
                <th>Peso</th>
                <th>RAM Core</th>
                <th>RAM Total</th>
                <th>Load</th>
                <th>DOM</th>
              </tr>
            </thead>
            <tbody>
              {currentMetrics.map(metric => (
                <tr key={metric.id || Math.random()}>
                  <td>{metric.date ? new Date(metric.date).toLocaleDateString() : (metric.created_at ? new Date(metric.created_at).toLocaleDateString() : '—')}</td>
                  <td>{metric.total_requests || '—'}</td>
                  <td>{metric.total_weight_mb !== null && metric.total_weight_mb !== undefined ? `${metric.total_weight_mb} MB` : '—'}</td>
                  
                  {/* 🌟 Removidas las referencias a getRamColor y getLoadColor */}
                  <td style={{ fontWeight: 'bold' }}>
                    {metric.ram_core_mb !== null && metric.ram_core_mb !== undefined ? `${metric.ram_core_mb} MB` : '—'}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>
                    {metric.ram_total_mb !== null && metric.ram_total_mb !== undefined ? `${metric.ram_total_mb} MB` : '—'}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>
                    {metric.load_ms !== null && metric.load_ms !== undefined ? `${(metric.load_ms / 1000).toFixed(2)}s` : '—'}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>
                    {metric.dom_ms !== null && metric.dom_ms !== undefined ? `${(metric.dom_ms / 1000).toFixed(2)}s` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalMetricPages > 1 && (
        <div className="crm-pagination-box" style={{ marginTop: '16px' }}>
          <button disabled={metricCurrentPage === 1} onClick={() => setMetricCurrentPage(prev => prev - 1)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>Anterior</button>
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{metricCurrentPage} / {totalMetricPages}</span>
          <button disabled={metricCurrentPage === totalMetricPages} onClick={() => setMetricCurrentPage(prev => prev + 1)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>Siguiente</button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="crm-card-paper">
        {renderContent()}
      </div>

      {/* MODAL EMERGENTE PANTALLA COMPLETA */}
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

export default ClientMetricsHistory;