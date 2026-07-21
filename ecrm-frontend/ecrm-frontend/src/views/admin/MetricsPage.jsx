import React, { useState, useEffect } from 'react';
import crmApi from '../../api/crmApi';

// 🌟 FUNCIONES EVALUADORAS DE COLOR (SEMAFORIZACIÓN)
const getLoadColorMs = (ms) => {
  if (ms === null || ms === undefined) return 'inherit';
  const sec = ms / 1000;
  if (sec < 2.5) return '#16a34a'; // Verde
  if (sec < 4.0) return '#eab308'; // Amarillo
  return '#dc2626'; // Rojo
};

const getRamColor = (mb) => {
  if (mb === null || mb === undefined) return 'inherit';
  if (mb < 150) return '#16a34a'; // Verde
  if (mb < 300) return '#eab308'; // Amarillo
  return '#dc2626'; // Rojo
};

function MetricsPage() {
  const [metrics, setMetrics] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 🌟 ESTADO DE LAS PESTAÑAS
  const [activeTab, setActiveTab] = useState('CHARTS'); // 'CHARTS' | 'HISTORY'

  // Filtros de búsqueda para el historial operativo
  const [metricsSearchQuery, setMetricsSearchQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStoreId, setFilterStoreId] = useState('ALL');

  // Paginación para la Tabla Histórica
  const [tableCurrentPage, setTableCurrentPage] = useState(1);
  const tableItemsPerPage = 10; 

  useEffect(() => {
    setTableCurrentPage(1);
  }, [metricsSearchQuery, filterStartDate, filterEndDate, filterStoreId]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      await crmApi.post('/metrics/upload-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('¡CSV procesado y guardado correctamente!');
      fetchMetricsData(); 
    } catch (error) {
      console.error(error);
      alert('Error al procesar el archivo CSV.');
    } finally {
      setIsUploading(false);
      e.target.value = null; 
    }
  };

  const [chartCurrentPage, setChartCurrentPage] = useState(1);
  const chartStoresPerPage = 5; // 🌟 MÁXIMO 5 DE ANCHO COMO PEDISTE

  const [formData, setFormData] = useState({
    store_id: '',
    date: new Date().toISOString().split('T')[0], 
    server_status: 'ONLINE',
    ram_core_mb: '', 
    ram_total_mb: '', 
    web_flow: '',
    load_s: '', 
    dom_s: ''   
  });

  const extraerArreglo = (response) => {
    if (!response || !response.data) return [];
    if (Array.isArray(response.data)) return response.data;
    if (response.data.data && Array.isArray(response.data.data)) return response.data.data;
    if (response.data.result && Array.isArray(response.data.result)) return response.data.result;
    
    const arregloEncontrado = Object.values(response.data).find(val => Array.isArray(val));
    return arregloEncontrado || [];
  };

  const fetchMetricsData = async () => {
    try {
      setLoading(true);

      try {
        const storesRes = await crmApi.get('/stores');
        const tiendasProcesadas = extraerArreglo(storesRes);
        setStores(tiendasProcesadas);
        
        if (tiendasProcesadas.length > 0) {
          setFormData(prev => ({ ...prev, store_id: tiendasProcesadas[0].id }));
        }
      } catch (e) {
        console.error("Error al recuperar tiendas:", e);
      }

      try {
        const metricsRes = await crmApi.get('/metrics');
        const metricasProcesadas = extraerArreglo(metricsRes);
        const sortedMetrics = metricasProcesadas.sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
        setMetrics(sortedMetrics);
      } catch (e) {
        console.error("Error al recuperar métricas:", e);
      }

      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetricsData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.store_id) return;

    try {
      const dataToSend = {
        store_id: formData.store_id,
        date: formData.date, 
        server_status: formData.server_status,
        ram_core_mb: parseFloat(formData.ram_core_mb || 0), 
        ram_total_mb: parseFloat(formData.ram_total_mb || 0), 
        web_flow: formData.web_flow.trim(),
        load_s: parseFloat(formData.load_s || 0),   
        dom_s: parseFloat(formData.dom_s || 0)      
      };

      const response = await crmApi.post('/metrics', dataToSend);
      if (response.data.success || response.status === 200 || response.status === 201) {
        alert('Métricas registradas con éxito.');
        setShowPopup(false);
        setFormData(prev => ({
          ...prev,
          ram_core_mb: '',
          ram_total_mb: '',
          web_flow: '',
          load_s: '',
          dom_s: ''
        }));
        fetchMetricsData(); 
      }
    } catch (error) {
      console.error(error);
      alert('Error al guardar en el servidor.');
    }
  };

  // ==========================================================================
  // FILTRADO DINÁMICO DE LA TABLA HISTÓRICA
  // ==========================================================================
  const filteredMetrics = metrics.filter(m => {
    if (!m) return false;
    
    const storeObj = stores.find(s => String(s.id) === String(m.store_id));
    const nombreTienda = storeObj ? storeObj.name.toLowerCase() : '';
    const idTienda = m.store_id ? String(m.store_id).toLowerCase() : '';
    const webFlowText = m.web_flow ? String(m.web_flow).toLowerCase() : '';
    const query = metricsSearchQuery.toLowerCase().trim();

    const matchesSearch = nombreTienda.includes(query) || idTienda.includes(query) || webFlowText.includes(query);
    const matchesStore = filterStoreId === 'ALL' || String(m.store_id) === filterStoreId;

    let matchesDate = true;
    if (m.date || m.created_at) {
      const metricDate = new Date(m.date || m.created_at).toISOString().split('T')[0];
      if (filterStartDate && metricDate < filterStartDate) matchesDate = false;
      if (filterEndDate && metricDate > filterEndDate) matchesDate = false;
    }

    return matchesSearch && matchesStore && matchesDate;
  });

  const indexOfLastTableItem = tableCurrentPage * tableItemsPerPage;
  const indexOfFirstTableItem = indexOfLastTableItem - tableItemsPerPage;
  const currentTableMetrics = filteredMetrics.slice(indexOfFirstTableItem, indexOfLastTableItem);
  const totalTablePages = Math.ceil(filteredMetrics.length / tableItemsPerPage) || 1; 

  // ==========================================================================
  // PROCESAMIENTO DEL GRÁFICO (TABLERO DE AVIÓN)
  // ==========================================================================
  const storeChartGroups = stores.map(store => {
    const storeRecords = metrics.filter(m => String(m.store_id) === String(store.id));
    
    // 🌟 FILTRO: SI NO TIENE REGISTROS, LO DESCARTAMOS
    if (storeRecords.length === 0) return null;

    const validLoad = storeRecords.filter(m => m.load_ms !== null && m.load_ms !== undefined);
    const validDom = storeRecords.filter(m => m.dom_ms !== null && m.dom_ms !== undefined);
    const validRamCore = storeRecords.filter(m => m.ram_core_mb !== null && m.ram_core_mb !== undefined);
    const validRamTotal = storeRecords.filter(m => m.ram_total_mb !== null && m.ram_total_mb !== undefined);

    const avgLoadMs = validLoad.length > 0 ? validLoad.reduce((sum, m) => sum + parseFloat(m.load_ms || 0), 0) / validLoad.length : 0;
    const avgDomMs = validDom.length > 0 ? validDom.reduce((sum, m) => sum + parseFloat(m.dom_ms || 0), 0) / validDom.length : 0;
    const avgRamCore = validRamCore.length > 0 ? validRamCore.reduce((sum, m) => sum + parseFloat(m.ram_core_mb || 0), 0) / validRamCore.length : 0;
    const avgRamTotal = validRamTotal.length > 0 ? validRamTotal.reduce((sum, m) => sum + parseFloat(m.ram_total_mb || 0), 0) / validRamTotal.length : 0;

    return {
      id: store.id,
      name: store.name,
      avgLoadMs,
      avgDomMs,
      avgRamCore,
      avgRamTotal
    };
  }).filter(Boolean); // 🌟 ELIMINA LOS NULLS (TIENDAS SIN REGISTROS)

  const indexOfLastChartItem = chartCurrentPage * chartStoresPerPage;
  const indexOfFirstChartItem = indexOfLastChartItem - chartStoresPerPage;
  const currentChartStores = storeChartGroups.slice(indexOfFirstChartItem, indexOfLastChartItem);
  const totalChartPages = Math.ceil(storeChartGroups.length / chartStoresPerPage) || 1;

  // 🌟 RENDERIZADOR DEL VÚMETRO (ESTILO CABINA OSCURA)
  const renderMiniVu = (value, maxVal, label) => {
    const safeVal = Number(value) || 0;
    const angle = Math.min((safeVal / maxVal) * 180, 180) - 90; 
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '85px' }}>
        <svg viewBox="0 0 100 65" style={{ width: '100%', overflow: 'visible' }}>
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#333" strokeWidth="12" strokeLinecap="round" />
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="url(#vuGradient)" strokeWidth="12" strokeLinecap="round" />
          
          <g transform={`rotate(${angle}, 50, 50)`} style={{ transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <g style={{ transformOrigin: '50px 50px', animation: 'needleVibrate 0.1s infinite linear alternate' }}>
              <polygon points="48,50 50,15 52,50" fill="#ffffff" />
              <circle cx="50" cy="50" r="6" fill="#ffffff" />
              <circle cx="50" cy="50" r="2" fill="#111111" />
            </g>
          </g>
          <text x="50" y="68" textAnchor="middle" style={{ fontSize: '15px', fontWeight: 'bold', fill: '#FFD700' }}>{Math.round(safeVal)}M</text>
        </svg>
        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#9ca3af', marginTop: '6px', letterSpacing: '1px' }}>{label}</span>
      </div>
    );
  };

  if (loading) return <div className="crm-text-loading">Cargando analíticas...</div>;

  return (
    <div>
      <svg style={{ width: 0, height: 0, position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="vuGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>
      </svg>
      <style>
        {`
          @keyframes needleVibrate {
            0% { transform: rotate(-1deg); }
            25% { transform: rotate(1deg); }
            50% { transform: rotate(-0.5deg); }
            75% { transform: rotate(1.5deg); }
            100% { transform: rotate(0deg); }
          }
        `}
      </style>

      {/* BARRA DE ACCIONES PRINCIPAL */}
      <div className="crm-actions-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: '16px' }}>
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Análisis de Rendimiento</h1>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <label className="crm-btn-border" style={{ cursor: 'pointer', opacity: isUploading ? 0.5 : 1 }}>
            {isUploading ? 'Subiendo...' : 'Cargar CSV Local'}
            <input 
              type="file" 
              accept=".csv" 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
              disabled={isUploading}
            />
          </label>
          <button onClick={() => setShowPopup(true)} className="crm-btn-black">
            Registro Manual
          </button>
        </div>
      </div>

      {/* 🌟 PESTAÑAS (TABS) */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e5e7eb', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('CHARTS')} 
          style={{ padding: '10px 20px', backgroundColor: activeTab === 'CHARTS' ? '#111' : '#f3f4f6', color: activeTab === 'CHARTS' ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px 6px 0 0', fontWeight: '900', cursor: 'pointer', borderBottom: activeTab === 'CHARTS' ? 'none' : '2px solid #111', marginBottom: '-2px' }}
        >
          🎛️ Tablero de Control
        </button>
        <button 
          onClick={() => setActiveTab('HISTORY')} 
          style={{ padding: '10px 20px', backgroundColor: activeTab === 'HISTORY' ? '#111' : '#f3f4f6', color: activeTab === 'HISTORY' ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px 6px 0 0', fontWeight: '900', cursor: 'pointer', borderBottom: activeTab === 'HISTORY' ? 'none' : '2px solid #111', marginBottom: '-2px' }}
        >
          📋 Registros Históricos
        </button>
      </div>

      {/* =========================================
          TAB 1: TABLERO DE CONTROL (AVIÓN)
          ========================================= */}
      {activeTab === 'CHARTS' && (
        <div style={{ backgroundColor: '#1a1a1a', padding: '24px', borderRadius: '8px', border: '4px solid #111', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)', marginBottom: '32px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', color: '#e5e7eb', letterSpacing: '1px' }}>
              Telemetría de Tiendas Activas
            </h3>
            <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: '#9ca3af', fontWeight: 'bold' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#0ea5e9', borderRadius: '2px' }}></div> Load (s)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#f43f5e', borderRadius: '2px' }}></div> DOM (s)
              </span>
            </div>
          </div>

          {currentChartStores.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0', fontSize: '14px', fontWeight: 'bold' }}>
              NO HAY TIENDAS CON MÉTRICAS REGISTRADAS.
            </div>
          ) : (
            // 🌟 GRID DE MÁXIMO 5 COLUMNAS
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {currentChartStores.map(sc => {
                const avgLoadSec = sc.avgLoadMs / 1000;
                const avgDomSec = sc.avgDomMs / 1000;

                const hLoad = Math.min((avgLoadSec / 5) * 100, 100);
                const hDom = Math.min((avgDomSec / 5) * 100, 100);

                return (
                  <div key={sc.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '2px solid #333', padding: '16px 12px', borderRadius: '8px', backgroundColor: '#222', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                    
                    {/* BARRAS DE TIEMPO (Top) */}
                    <div style={{ display: 'flex', gap: '16px', height: '100px', alignItems: 'flex-end', justifyContent: 'center', width: '100%', borderBottom: '1px solid #444', paddingBottom: '12px' }}>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30px', height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ height: `${Math.max(hLoad, 6)}%`, backgroundColor: '#0ea5e9', width: '100%', position: 'relative', borderRadius: '2px 2px 0 0' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#e5e7eb', position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)' }}>
                            {avgLoadSec.toFixed(1)}s
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30px', height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ height: `${Math.max(hDom, 6)}%`, backgroundColor: '#f43f5e', width: '100%', position: 'relative', borderRadius: '2px 2px 0 0' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#e5e7eb', position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)' }}>
                            {avgDomSec.toFixed(1)}s
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* VÚMETROS DUALES (Bottom) */}
                    <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', marginTop: '16px', gap: '8px' }}>
                      {renderMiniVu(sc.avgRamCore, 200, 'RAM CORE')}
                      {renderMiniVu(sc.avgRamTotal, 500, 'RAM TOTAL')}
                    </div>

                    <span style={{ fontSize: '12px', marginTop: '16px', textAlign: 'center', fontWeight: 'bold', color: '#FFD700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {sc.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {totalChartPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', borderTop: '1px solid #333', paddingTop: '16px' }}>
              <button disabled={chartCurrentPage === 1} onClick={() => setChartCurrentPage(prev => prev - 1)} style={{ backgroundColor: 'transparent', color: '#e5e7eb', border: '1px solid #555', padding: '6px 12px', borderRadius: '4px', cursor: chartCurrentPage === 1 ? 'not-allowed' : 'pointer' }}>Anterior</button>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af' }}>Banco de Tiendas: {chartCurrentPage} / {totalChartPages}</span>
              <button disabled={chartCurrentPage === totalChartPages} onClick={() => setChartCurrentPage(prev => prev + 1)} style={{ backgroundColor: 'transparent', color: '#e5e7eb', border: '1px solid #555', padding: '6px 12px', borderRadius: '4px', cursor: chartCurrentPage === totalChartPages ? 'not-allowed' : 'pointer' }}>Siguiente</button>
            </div>
          )}
        </div>
      )}

      {/* =========================================
          TAB 2: HISTORIAL OPERATIVO (COLORES)
          ========================================= */}
      {activeTab === 'HISTORY' && (
        <div className="crm-card-paper">
          <h3 className="crm-section-title" style={{ margin: 0, paddingBottom: '16px', border: 'none' }}>Registros Históricos de Rendimiento</h3>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px dotted #111111' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="crm-stat-label">Búsqueda (Tienda o Flujo)</label>
              <input type="text" placeholder="Ej: TiendaCentro" value={metricsSearchQuery} onChange={(e) => setMetricsSearchQuery(e.target.value)} className="crm-input-text" style={{ width: '220px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="crm-stat-label">Tienda</label>
              <select value={filterStoreId} onChange={(e) => setFilterStoreId(e.target.value)} className="crm-select-dropdown" style={{ width: '200px' }}>
                <option value="ALL">Todas las tiendas</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Desde</label>
                <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="crm-input-text" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Hasta</label>
                <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="crm-input-text" />
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'flex-end', marginLeft: 'auto' }}>
              <button onClick={() => { setMetricsSearchQuery(''); setFilterStoreId('ALL'); setFilterStartDate(''); setFilterEndDate(''); }} className="crm-btn-border">
                Limpiar Filtros
              </button>
            </div>
          </div>

          <div className="crm-table-container">
            <table className="crm-table-data">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tienda / Cliente</th>
                  <th>RAM Core</th>
                  <th>RAM Total</th>
                  <th>Redirect</th>
                  <th>DNS</th>
                  <th>TCP</th>
                  <th>TTFB</th>
                  <th>DOM</th>
                  <th>Load</th>
                </tr>
              </thead>
              <tbody>
                {currentTableMetrics.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="crm-text-loading">No se encontraron registros indexados en el sistema con esos filtros.</td>
                  </tr>
                ) : (
                  currentTableMetrics.map(m => {
                    const associatedStore = stores.find(s => String(s.id) === String(m.store_id));
                    return (
                      <tr key={m.id}>
                        <td>{m.date ? new Date(m.date).toLocaleDateString() : (m.created_at ? new Date(m.created_at).toLocaleDateString() : '—')}</td>
                        <td><strong>{associatedStore ? associatedStore.name : m.store_id}</strong></td>
                        
                        {/* 🌟 COLUMNAS CON SEMAFORIZACIÓN DE COLORES */}
                        <td style={{ color: getRamColor(m.ram_core_mb), fontWeight: 'bold' }}>
                          {m.ram_core_mb !== null && m.ram_core_mb !== undefined ? `${m.ram_core_mb} MB` : '---'}
                        </td>
                        <td style={{ color: getRamColor(m.ram_total_mb), fontWeight: 'bold' }}>
                          {m.ram_total_mb !== null && m.ram_total_mb !== undefined ? `${m.ram_total_mb} MB` : '---'}
                        </td>

                        <td style={{ color: '#4b5563' }}>{m.redirect_ms !== null && m.redirect_ms !== undefined ? `${m.redirect_ms}ms` : '---'}</td>
                        <td style={{ color: '#4b5563' }}>{m.dns_ms !== null && m.dns_ms !== undefined ? `${m.dns_ms}ms` : '---'}</td>
                        <td style={{ color: '#4b5563' }}>{m.tcp_ms !== null && m.tcp_ms !== undefined ? `${m.tcp_ms}ms` : '---'}</td>
                        <td style={{ color: '#4b5563' }}>{m.ttfb_ms !== null && m.ttfb_ms !== undefined ? `${m.ttfb_ms}ms` : '---'}</td>
                        
                        <td style={{ color: getLoadColorMs(m.dom_ms), fontWeight: 'bold' }}>
                          {m.dom_ms !== null && m.dom_ms !== undefined ? `${(m.dom_ms / 1000).toFixed(3)}s` : '---'}
                        </td>
                        <td style={{ color: getLoadColorMs(m.load_ms), fontWeight: 'bold' }}>
                          {m.load_ms !== null && m.load_ms !== undefined ? `${(m.load_ms / 1000).toFixed(3)}s` : '---'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalTablePages > 1 && (
            <div className="crm-pagination-box" style={{ marginTop: '16px', borderTop: '1px dotted #c8c6c1', paddingTop: '12px' }}>
              <button disabled={tableCurrentPage === 1} onClick={() => setTableCurrentPage(prev => prev - 1)} className="crm-btn-border">Anterior</button>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Página {tableCurrentPage} de {totalTablePages}</span>
              <button disabled={tableCurrentPage === totalTablePages} onClick={() => setTableCurrentPage(prev => prev + 1)} className="crm-btn-border">Siguiente</button>
            </div>
          )}
        </div>
      )}

      {/* =========================================
          MODAL DE REGISTRO MANUAL
          ========================================= */}
      {showPopup && (
        <div className="crm-modal-mask" onClick={() => setShowPopup(false)}>
          <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="crm-section-title" style={{ marginTop: 0 }}>Registro Técnico Diario</h3>
            
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Tienda / Cliente</label>
                <select name="store_id" value={formData.store_id} onChange={handleInputChange} className="crm-select-dropdown" required>
                  {stores.length === 0 ? (
                    <option value="">Cargando tiendas...</option>
                  ) : (
                    stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                  )}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Fecha del Registro</label>
                  <input type="date" name="date" value={formData.date || ''} onChange={handleInputChange} className="crm-input-text" required style={{ width: 'auto' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Server Status</label>
                  <select name="server_status" value={formData.server_status} onChange={handleInputChange} className="crm-select-dropdown">
                    <option value="ONLINE">ONLINE</option>
                    <option value="OFFLINE">OFFLINE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">RAM Core (MB)</label>
                  <input type="number" step="0.01" name="ram_core_mb" value={formData.ram_core_mb} onChange={handleInputChange} className="crm-input-text" placeholder="Ej: 50" required style={{ width: 'auto' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">RAM Total (MB)</label>
                  <input type="number" step="0.01" name="ram_total_mb" value={formData.ram_total_mb} onChange={handleInputChange} className="crm-input-text" placeholder="Ej: 250" required style={{ width: 'auto' }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Web Flow</label>
                <input type="text" name="web_flow" value={formData.web_flow} onChange={handleInputChange} className="crm-input-text" placeholder="Ej: Ok, Estable..." required style={{ width: 'auto' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Load (s)</label>
                  <input type="number" step="0.001" name="load_s" value={formData.load_s} onChange={handleInputChange} className="crm-input-text" placeholder="Segundos" required style={{ width: 'auto' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">DOM (s)</label>
                  <input type="number" step="0.001" name="dom_s" value={formData.dom_s} onChange={handleInputChange} className="crm-input-text" placeholder="Segundos" required style={{ width: 'auto' }} />
                </div>
              </div>

              <div className="crm-pagination-box" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
                <button type="submit" className="crm-btn-black">Guardar Registro</button>
                <button type="button" onClick={() => setShowPopup(false)} className="crm-btn-red">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MetricsPage;