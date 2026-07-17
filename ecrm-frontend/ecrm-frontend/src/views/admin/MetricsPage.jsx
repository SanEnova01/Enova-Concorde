import React, { useState, useEffect } from 'react';
import crmApi from '../../api/crmApi';

function MetricsPage() {
  const [metrics, setMetrics] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Filtros de búsqueda para el historial operativo
  const [metricsSearchQuery, setMetricsSearchQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStoreId, setFilterStoreId] = useState('ALL');

  // Paginación para la Tabla Histórica
  const [tableCurrentPage, setTableCurrentPage] = useState(1);
  const tableItemsPerPage = 10; // Muestra 10 registros por página

  // Si el usuario cambia algún filtro, regresamos a la página 1 automáticamente
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
  const chartStoresPerPage = 5; // Bajamos a 5 para que los vúmetros tengan más espacio

  // 🌟 CAMPOS ACTUALIZADOS (RAM CORE Y RAM TOTAL)
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
      // 🌟 ENVÍO ADAPTADO A LOS NUEVOS CAMPOS DEL BACKEND
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

  // ==========================================================================
  // PAGINACIÓN DE LA TABLA HISTÓRICA
  // ==========================================================================
  const indexOfLastTableItem = tableCurrentPage * tableItemsPerPage;
  const indexOfFirstTableItem = indexOfLastTableItem - tableItemsPerPage;
  const currentTableMetrics = filteredMetrics.slice(indexOfFirstTableItem, indexOfLastTableItem);
  const totalTablePages = Math.ceil(filteredMetrics.length / tableItemsPerPage) || 1; 

  // ==========================================================================
  // PROCESAMIENTO DEL GRÁFICO HORIZONTAL CON VÚMETROS
  // ==========================================================================
  const storeChartGroups = stores.map(store => {
    const storeRecords = metrics.filter(m => String(m.store_id) === String(store.id));
    
    const validLoad = storeRecords.filter(m => m.load_ms !== null && m.load_ms !== undefined);
    const validDom = storeRecords.filter(m => m.dom_ms !== null && m.dom_ms !== undefined);
    // 🌟 SEPARAMOS RAM CORE Y TOTAL
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
  });

  const indexOfLastChartItem = chartCurrentPage * chartStoresPerPage;
  const indexOfFirstChartItem = indexOfLastChartItem - chartStoresPerPage;
  const currentChartStores = storeChartGroups.slice(indexOfFirstChartItem, indexOfLastChartItem);
  const totalChartPages = Math.ceil(storeChartGroups.length / chartStoresPerPage) || 1;

  // Renderizador del Mini-Vúmetro en SVG
  const renderMiniVu = (value, maxVal, label) => {
    const safeVal = Number(value) || 0;
    const angle = Math.min((safeVal / maxVal) * 180, 180) - 90; // Rango -90 a +90
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '85px' }}>
        <svg viewBox="0 0 100 65" style={{ width: '100%', overflow: 'visible' }}>
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e5e5e5" strokeWidth="12" strokeLinecap="round" />
          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="url(#vuGradient)" strokeWidth="12" strokeLinecap="round" />
          
          <g transform={`rotate(${angle}, 50, 50)`} style={{ transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <g style={{ transformOrigin: '50px 50px', animation: 'needleVibrate 0.1s infinite linear alternate' }}>
              <polygon points="48,50 50,15 52,50" fill="#111111" />
              <circle cx="50" cy="50" r="6" fill="#111111" />
              <circle cx="50" cy="50" r="2" fill="#ffffff" />
            </g>
          </g>
          <text x="50" y="68" textAnchor="middle" style={{ fontSize: '15px', fontWeight: 'bold', fill: '#111111' }}>{Math.round(safeVal)}M</text>
        </svg>
        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#666666', marginTop: '6px' }}>{label}</span>
      </div>
    );
  };

  if (loading) return <div className="crm-text-loading">Cargando analíticas...</div>;

  return (
    <div>
      {/* 🌟 RECURSOS GLOBALES SVG Y CSS PARA VÚMETROS */}
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

      {/* Barra de Acciones */}
      <div className="crm-actions-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Métricas Generales</h1>
        
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

      {/* Gráfico de Distribución Horizontal */}
      <div className="crm-card-paper" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px dotted #111111', paddingBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif' }}>Rendimiento Técnico por Tienda</h3>
          
          <div style={{ display: 'flex', gap: '14px', fontSize: '12px', fontFamily: 'system-ui, sans-serif' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#111111' }}></div> Load (s)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#555555' }}></div> DOM (s)</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px', justifyContent: 'flex-start', alignItems: 'flex-end', minHeight: '280px', paddingBottom: '12px', overflowX: 'auto' }}>
          {currentChartStores.length === 0 ? (
            <div className="crm-text-loading" style={{ width: '100%' }}>No hay suficientes datos para procesar el gráfico.</div>
          ) : (
            currentChartStores.map(sc => {
              const avgLoadSec = sc.avgLoadMs / 1000;
              const avgDomSec = sc.avgDomMs / 1000;

              const hLoad = Math.min((avgLoadSec / 5) * 100, 100);
              const hDom = Math.min((avgDomSec / 5) * 100, 100);

              return (
                <div key={sc.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #c8c6c1', padding: '16px 12px', borderRadius: '8px', backgroundColor: '#fcfbfa', minWidth: '220px' }}>
                  
                  {/* BARRAS DE TIEMPO (Top) */}
                  <div style={{ display: 'flex', gap: '16px', height: '120px', alignItems: 'flex-end', justifyContent: 'center', width: '100%', borderBottom: '1px solid #111111', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '36px', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ height: `${Math.max(hLoad, 6)}%`, backgroundColor: '#111111', width: '100%', position: 'relative' }}>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#111111', position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{avgLoadSec.toFixed(1)}s</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '36px', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ height: `${Math.max(hDom, 6)}%`, backgroundColor: '#555555', width: '100%', position: 'relative' }}>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#111111', position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{avgDomSec.toFixed(1)}s</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* VÚMETROS DUALES (Bottom) */}
                  <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', marginTop: '16px', gap: '12px' }}>
                    {renderMiniVu(sc.avgRamCore, 200, 'RAM CORE')}
                    {renderMiniVu(sc.avgRamTotal, 500, 'RAM TOTAL')}
                  </div>

                  <span style={{ fontSize: '13px', marginTop: '16px', textAlign: 'center', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{sc.name}</span>
                </div>
              );
            })
          )}
        </div>

        {totalChartPages > 1 && (
          <div className="crm-pagination-box" style={{ marginTop: '16px', borderTop: '1px dotted #c8c6c1', paddingTop: '12px' }}>
            <button disabled={chartCurrentPage === 1} onClick={() => setChartCurrentPage(prev => prev - 1)} className="crm-btn-border">Anterior</button>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Páginas de Tiendas: {chartCurrentPage} / {totalChartPages}</span>
            <button disabled={chartCurrentPage === totalChartPages} onClick={() => setChartCurrentPage(prev => prev + 1)} className="crm-btn-border">Siguiente</button>
          </div>
        )}
      </div>

      {/* Historial Operativo */}
      <div className="crm-card-paper">
        <h3 className="crm-section-title" style={{ margin: 0, paddingBottom: '16px', border: 'none' }}>Registros Históricos de Rendimiento</h3>
        
        {/* CONTROLES DE FILTRO */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px dotted #111111' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="crm-stat-label">Búsqueda (Tienda o Flujo)</label>
            <input 
              type="text" 
              placeholder="Ej: TiendaCentro" 
              value={metricsSearchQuery} 
              onChange={(e) => setMetricsSearchQuery(e.target.value)} 
              className="crm-input-text"
              style={{ width: '220px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="crm-stat-label">Tienda</label>
            <select 
              value={filterStoreId} 
              onChange={(e) => setFilterStoreId(e.target.value)} 
              className="crm-select-dropdown"
              style={{ width: '200px' }}
            >
              <option value="ALL">Todas las tiendas</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="crm-stat-label">Desde</label>
              <input 
                type="date" 
                value={filterStartDate} 
                onChange={(e) => setFilterStartDate(e.target.value)} 
                className="crm-input-text"
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="crm-stat-label">Hasta</label>
              <input 
                type="date" 
                value={filterEndDate} 
                onChange={(e) => setFilterEndDate(e.target.value)} 
                className="crm-input-text"
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', marginLeft: 'auto' }}>
            <button 
              onClick={() => {
                setMetricsSearchQuery('');
                setFilterStoreId('ALL');
                setFilterStartDate('');
                setFilterEndDate('');
              }} 
              className="crm-btn-border"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>

        {/* TABLA CON RESULTADOS FILTRADOS Y PAGINADOS */}
        <div className="crm-table-container">
          <table className="crm-table-data">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tienda / Cliente</th>
                <th>RAM Core</th>
                <th>RAM Total</th>
                <th>Redirect (ms)</th>
                <th>DNS (ms)</th>
                <th>TCP (ms)</th>
                <th>TTFB (ms)</th>
                <th>DOM (s)</th>
                <th>Load (s)</th>
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
                      {/* 🌟 NUEVAS COLUMNAS DE RAM EN LA TABLA */}
                      <td>{m.ram_core_mb !== null && m.ram_core_mb !== undefined ? `${m.ram_core_mb} MB` : '---'}</td>
                      <td>{m.ram_total_mb !== null && m.ram_total_mb !== undefined ? `${m.ram_total_mb} MB` : '---'}</td>
                      <td>{m.redirect_ms !== null && m.redirect_ms !== undefined ? `${m.redirect_ms}ms` : '---'}</td>
                      <td>{m.dns_ms !== null && m.dns_ms !== undefined ? `${m.dns_ms}ms` : '---'}</td>
                      <td>{m.tcp_ms !== null && m.tcp_ms !== undefined ? `${m.tcp_ms}ms` : '---'}</td>
                      <td>{m.ttfb_ms !== null && m.ttfb_ms !== undefined ? `${m.ttfb_ms}ms` : '---'}</td>
                      <td>{m.dom_ms !== null && m.dom_ms !== undefined ? `${(m.dom_ms / 1000).toFixed(3)}s` : '---'}</td>
                      <td>{m.load_ms !== null && m.load_ms !== undefined ? `${(m.load_ms / 1000).toFixed(3)}s` : '---'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalTablePages > 1 && (
          <div className="crm-pagination-box" style={{ marginTop: '16px', borderTop: '1px dotted #c8c6c1', paddingTop: '12px' }}>
            <button 
              disabled={tableCurrentPage === 1} 
              onClick={() => setTableCurrentPage(prev => prev - 1)} 
              className="crm-btn-border"
            >
              Anterior
            </button>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
              Página {tableCurrentPage} de {totalTablePages}
            </span>
            <button 
              disabled={tableCurrentPage === totalTablePages} 
              onClick={() => setTableCurrentPage(prev => prev + 1)} 
              className="crm-btn-border"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Formulario Pop-up */}
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
                    stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))
                  )}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Fecha del Registro</label>
                  <input 
                    type="date" 
                    name="date" 
                    value={formData.date || ''} 
                    onChange={handleInputChange} 
                    className="crm-input-text" 
                    required 
                    style={{ width: 'auto' }} 
                  />
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

              {/* 🌟 FORMULARIO ACTUALIZADO PARA RECIBIR RAM CORE Y TOTAL */}
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