import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function ConcordeAnalyzerView() {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [period, setPeriod] = useState('daily');
  const [aggregatedData, setAggregatedData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estado de ejecución manual
  const [triggering, setTriggering] = useState(false);
  const [botStatus, setBotStatus] = useState({ status: 'LOADING', last_heartbeat: null, is_running: false });

  useEffect(() => {
    crmApi.get('/stores')
      .then(res => setStores(res.data.data || res.data || []))
      .catch(err => console.error(err));

    checkBotStatus();
    const interval = setInterval(checkBotStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // ✅ CÓDIGO CORREGIDO:
const checkBotStatus = async () => {
  try {
    const res = await crmApi.get('/metrics/bot-status');
    if (res.data?.success) {
      // Extraemos la información interna (res.data.data) o caemos en res.data
      const statusInfo = res.data.data || res.data;
      setBotStatus(statusInfo);
    }
  } catch (error) {
    setBotStatus({ status: 'OFFLINE', last_heartbeat: null, is_running: false });
  }
};

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

  // Handler para el botón de disparo forzado
  const handleForceRun = async () => {
    if (!window.confirm("¿Deseas iniciar un análisis forzado en todas las tiendas con plan activo?")) return;
    
    try {
      setTriggering(true);
      const res = await crmApi.post('/metrics/force-run');
      if (res.data?.success) {
        alert("🚀 " + res.data.message);
        checkBotStatus();
      } else {
        alert("⚠️ " + (res.data?.message || res.data?.error || "Error al iniciar el análisis."));
      }
    } catch (error) {
      alert("❌ Error de comunicación con el servidor.");
    } finally {
      setTriggering(false);
    }
  };

  const getStoreName = (storeId) => {
    const found = stores.find(s => String(s.id) === String(storeId));
    return found ? found.name : storeId;
  };

  return (
    <div>
      <div className="crm-actions-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Concorde Analyzer Hub</h1>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* ⚡ BOTÓN DE ANÁLISIS FORZADO */}
          <button 
            onClick={handleForceRun} 
            disabled={triggering || botStatus.is_running || botStatus.status === 'OFFLINE'}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: botStatus.is_running ? '#d97706' : '#16a34a', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '4px', 
              fontWeight: 'bold', 
              cursor: (triggering || botStatus.is_running) ? 'not-allowed' : 'pointer' 
            }}
          >
            {botStatus.is_running ? '⏳ Análisis en Curso...' : 'Ejecutar Análisis Forzado'}
          </button>

          <button onClick={() => navigate('/admin/metricas')} className="crm-btn-border">
            Volver a Métricas
          </button>
        </div>
      </div>

      {/* WIDGET DE ESTADO */}
      <div className="crm-card-paper" style={{ marginBottom: '20px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: botStatus.status === 'ONLINE' ? '6px solid #16a34a' : '6px solid #dc2626' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            backgroundColor: botStatus.status === 'ONLINE' ? '#16a34a' : '#dc2626',
            boxShadow: botStatus.status === 'ONLINE' ? '0 0 10px #16a34a' : '0 0 10px #dc2626'
          }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase' }}>
              Estado del Motor: <strong>{botStatus.status}</strong> {botStatus.is_running && ' (ANALIZANDO TIENDAS...)'}
            </h3>
            <span style={{ fontSize: '12px', color: '#666' }}>
              {botStatus.last_heartbeat 
                ? `Último latido: ${new Date(botStatus.last_heartbeat).toLocaleString()}`
                : 'Sin señal del bot'}
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#111' }}>
            Filtro de Planes Automáticos
          </span>
          <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 'bold' }}>
            Go, Growth, Escale 
          </span>
        </div>
      </div>

      {/* PESTAÑAS VISTAS Y TABLA */}
      <div className="crm-card-paper" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
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

      <div className="crm-card-paper">
        <h3 className="crm-section-title" style={{ marginTop: 0 }}>
          Análisis Registrados ({period === 'daily' ? 'Por Día' : period === 'monthly' ? 'Por Mes' : 'Por Año'})
        </h3>

        {loading ? (
          <div className="crm-text-loading">Cargando métricas...</div>
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
                    <td colSpan="7" className="crm-text-loading">No hay análisis para este filtro.</td>
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