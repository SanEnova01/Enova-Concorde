import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function ConcordeAnalyzerView() {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [period, setPeriod] = useState('daily'); // 'daily' | 'monthly' | 'yearly'
  const [aggregatedData, setAggregatedData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmApi.get('/stores')
      .then(res => setStores(res.data.data || res.data || []))
      .catch(err => console.error(err));
  }, []);

  const fetchAggregatedData = async () => {
    try {
      setLoading(true);
      const res = await crmApi.get(`/metrics/aggregated?store_id=${selectedStore}&period=${period}`);
      if (res.data?.success) {
        setAggregatedData(res.data.data || []);
      }
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAggregatedData();
  }, [selectedStore, period]);

  const getStoreName = (storeId) => {
    const found = stores.find(s => String(s.id) === String(storeId));
    return found ? found.name : storeId;
  };

  return (
    <div>
      <div className="crm-actions-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>🛸 Concorde Analyzer Hub</h1>
        <button onClick={() => navigate('/admin/metricas')} className="crm-btn-border">
          Volver a Métricas
        </button>
      </div>

      {/* FILTROS Y PESTAÑAS */}
      <div className="crm-card-paper" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          
          {/* SELECTOR DE PERÍODO */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setPeriod('daily')} 
              style={{ padding: '8px 16px', backgroundColor: period === 'daily' ? '#111' : '#f3f4f6', color: period === 'daily' ? '#FFD700' : '#111', border: '1px solid #111', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              📅 Vista Diaria
            </button>
            <button 
              onClick={() => setPeriod('monthly')} 
              style={{ padding: '8px 16px', backgroundColor: period === 'monthly' ? '#111' : '#f3f4f6', color: period === 'monthly' ? '#FFD700' : '#111', border: '1px solid #111', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🗓️ Vista Mensual
            </button>
            <button 
              onClick={() => setPeriod('yearly')} 
              style={{ padding: '8px 16px', backgroundColor: period === 'yearly' ? '#111' : '#f3f4f6', color: period === 'yearly' ? '#FFD700' : '#111', border: '1px solid #111', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              📊 Vista Anual
            </button>
          </div>

          {/* FILTRO DE TIENDA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="crm-stat-label">Filtrar Tienda:</label>
            <select 
              value={selectedStore} 
              onChange={e => setSelectedStore(e.target.value)} 
              className="crm-select-dropdown"
              style={{ width: '220px' }}
            >
              <option value="ALL">Todas las Tiendas</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* TABLA DE RESULTADOS HISTÓRICOS */}
      <div className="crm-card-paper">
        <h3 className="crm-section-title" style={{ marginTop: 0 }}>
          Análisis de Telemetría Registrados ({period === 'daily' ? 'Por Día' : period === 'monthly' ? 'Por Mes' : 'Por Año'})
        </h3>

        {loading ? (
          <div className="crm-text-loading">Cargando consolidado de análisis...</div>
        ) : (
          <div className="crm-table-container">
            <table className="crm-table-data">
              <thead>
                <tr>
                  <th>Período / Fecha</th>
                  <th>Tienda</th>
                  <th>Análisis Ejecutados</th>
                  <th>Promedio Load</th>
                  <th>Promedio DOM</th>
                  <th>RAM Core Promedio</th>
                  <th>RAM Total Promedio</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedData.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="crm-text-loading">No se registraron análisis para la selección de filtro elegida.</td>
                  </tr>
                ) : (
                  aggregatedData.map((row, idx) => {
                    const avgLoadSec = (parseFloat(row.avg_load_ms || 0) / 1000).toFixed(2);
                    const avgDomSec = (parseFloat(row.avg_dom_ms || 0) / 1000).toFixed(2);
                    return (
                      <tr key={idx} onClick={() => navigate(`/admin/clientes/${row.store_id}`)} style={{ cursor: 'pointer' }}>
                        <td><strong>{row.period_date}</strong></td>
                        <td>{getStoreName(row.store_id)}</td>
                        <td><span className="crm-badge">{row.total_analyses} ejecuciones</span></td>
                        <td style={{ color: avgLoadSec < 3 ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>{avgLoadSec}s</td>
                        <td style={{ color: '#2563eb', fontWeight: 'bold' }}>{avgDomSec}s</td>
                        <td>{Math.round(row.avg_ram_core || 0)} MB</td>
                        <td>{Math.round(row.avg_ram_total || 0)} MB</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConcordeAnalyzerView;