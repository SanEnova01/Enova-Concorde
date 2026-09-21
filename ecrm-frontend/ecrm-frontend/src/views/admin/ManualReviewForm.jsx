import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

const PLANES_ELEGIBLES = ['go', 'growth', 'scale', 'escale', 'scale_plus', 'warranty'];

const ManualReviewForm = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('FORM');
  const [stores, setStores] = useState([]);
  const [checks, setChecks] = useState({});
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().split('T')[0]);
  const [reviewerName, setReviewerName] = useState('');
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [storesToSubmit, setStoresToSubmit] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // ESTADOS PARA EL HISTORIAL POR CARPETAS
  const [historyByStore, setHistoryByStore] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedStore, setExpandedStore] = useState(null);
  const [storeViewMode, setStoreViewMode] = useState('LIST'); 
  const [compareSelection, setCompareSelection] = useState({ a: 0, b: 1 }); 
  
  // 🌟 NUEVO ESTADO: Buscador de historial
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await crmApi.get('/stores');
        const rawStores = Array.isArray(res.data.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        
        const validStores = rawStores.filter(store => {
          if (!store.plan_type) return false;
          return PLANES_ELEGIBLES.includes(String(store.plan_type).toLowerCase().trim());
        });

        validStores.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setStores(validStores);

        const initialChecks = {};
        validStores.forEach(s => {
          initialChecks[s.id] = { home_page: 'NONE', blog: 'NONE', pdp: 'NONE', cart: 'NONE', checkout: 'NONE', observations: '' };
        });
        setChecks(initialChecks);
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    fetchStores();
  }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await crmApi.get('/manual-reviews/all');
      if (res.data.success) {
        const grouped = res.data.data.reduce((acc, curr) => {
          if (!acc[curr.store_id]) {
            acc[curr.store_id] = { id: curr.store_id, name: curr.store_name, reviews: [] };
          }
          acc[curr.store_id].reviews.push(curr);
          return acc;
        }, {});

        Object.values(grouped).forEach(store => {
          store.reviews.sort((a, b) => new Date(b.review_date) - new Date(a.review_date));
        });

        setHistoryByStore(grouped);
      }
    } catch (error) {
      console.error(error);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      loadHistory();
      setExpandedStore(null);
      setHistorySearchTerm('');
    }
  }, [activeTab]);

  const handleCycleCheck = (storeId, field) => {
    setChecks(prev => {
      const currentState = prev[storeId][field];
      let nextState = 'NONE';
      if (currentState === 'NONE') nextState = 'OK';
      else if (currentState === 'OK') nextState = 'OBSERVED';
      else if (currentState === 'OBSERVED') nextState = 'NONE';

      return {
        ...prev,
        [storeId]: { ...prev[storeId], [field]: nextState }
      };
    });
  };

  const handleObsChange = (storeId, text) => {
    setChecks(prev => ({
      ...prev,
      [storeId]: { ...prev[storeId], observations: text }
    }));
  };

  const handlePreSave = () => {
    if (!reviewerName.trim()) {
      alert('Debes ingresar la firma (Nombre del Agente) antes de guardar.');
      return;
    }

    const filtered = stores.filter(store => {
      const c = checks[store.id];
      return c.home_page !== 'NONE' || c.blog !== 'NONE' || c.pdp !== 'NONE' || c.cart !== 'NONE' || c.checkout !== 'NONE' || c.observations.trim() !== '';
    });

    if (filtered.length === 0) {
      alert('No has marcado ninguna vista ni agregado observaciones. Haz al menos un registro.');
      return;
    }

    const requiresObs = filtered.some(s => 
      (checks[s.id].home_page === 'OBSERVED' || checks[s.id].blog === 'OBSERVED' || checks[s.id].pdp === 'OBSERVED' || checks[s.id].cart === 'OBSERVED' || checks[s.id].checkout === 'OBSERVED') 
      && checks[s.id].observations.trim() === ''
    );

    if (requiresObs) {
      alert('Has marcado estados de "Observación" (Naranja) en algunas tiendas, pero no has escrito el detalle en la columna de observaciones.');
      return;
    }

    setStoresToSubmit(filtered);
    setShowModal(true);
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);
    try {
      const promises = storesToSubmit.map(store => {
        const payload = {
          store_id: store.id,
          review_date: reviewDate,
          ...checks[store.id],
          reviewer_name: reviewerName
        };
        return crmApi.post('/manual-reviews', payload);
      });

      await Promise.all(promises);
      
      const resetChecks = { ...checks };
      storesToSubmit.forEach(store => {
        resetChecks[store.id] = { home_page: 'NONE', blog: 'NONE', pdp: 'NONE', cart: 'NONE', checkout: 'NONE', observations: '' };
      });
      setChecks(resetChecks);
      
      setShowModal(false);
      alert('Auditoría masiva guardada exitosamente.');
    } catch (error) {
      alert('Ocurrió un error guardando el registro.');
    }
    setIsSaving(false);
  };

  const renderIcon = (state) => {
    if (state === 'OK') return <div style={{ width: '22px', height: '22px', backgroundColor: '#16a34a', color: 'white', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', margin: '0 auto' }}>✓</div>;
    if (state === 'OBSERVED') return <div style={{ width: '22px', height: '22px', backgroundColor: '#f97316', color: 'white', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', margin: '0 auto' }}>!</div>;
    return <div style={{ width: '22px', height: '22px', border: '2px solid #d1d5db', borderRadius: '4px', margin: '0 auto' }}></div>;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  // 🌟 Filtrado de carpetas
  const filteredHistoryStores = Object.values(historyByStore).filter(store => 
    store.name.toLowerCase().includes(historySearchTerm.toLowerCase()) || 
    store.id.toLowerCase().includes(historySearchTerm.toLowerCase())
  );

  if (loading) return <div className="crm-text-loading" style={{ padding: '40px' }}>Cargando infraestructura...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #111', paddingBottom: '12px', marginBottom: '16px' }}>
        <button 
          onClick={() => setActiveTab('FORM')}
          style={{ padding: '10px 20px', backgroundColor: activeTab === 'FORM' ? '#111' : 'transparent', color: activeTab === 'FORM' ? '#FFD700' : '#4b5563', border: activeTab === 'FORM' ? '2px solid #111' : '2px solid transparent', borderRadius: '6px', fontWeight: '900', cursor: 'pointer' }}
        >
          Registro Diario
        </button>
        <button 
          onClick={() => setActiveTab('HISTORY')}
          style={{ padding: '10px 20px', backgroundColor: activeTab === 'HISTORY' ? '#111' : 'transparent', color: activeTab === 'HISTORY' ? '#FFD700' : '#4b5563', border: activeTab === 'HISTORY' ? '2px solid #111' : '2px solid transparent', borderRadius: '6px', fontWeight: '900', cursor: 'pointer' }}
        >
          Historial Global (Por Carpetas)
        </button>
      </div>

      {activeTab === 'FORM' && (
        <div style={{ position: 'relative' }}>
          {/* 🌟 CABECERA STICKY CON BOTÓN A LA DERECHA */}
          <div style={{ 
            position: 'sticky', 
            top: 0, 
            zIndex: 10, 
            backgroundColor: '#f9f9f9', 
            padding: '16px', 
            borderBottom: '2px solid #111', 
            marginBottom: '24px',
            borderRadius: '8px',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            flexWrap: 'wrap', 
            gap: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111', margin: '0 0 4px 0' }}>Hoja de Control (Q/A)</h1>
              <p style={{ color: '#666', margin: 0, fontSize: '13px' }}>1 Clic: OK (Verde) | 2 Clics: Observado (Naranja) | 3 Clics: Limpiar</p>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Firma:</span>
                <input type="text" value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} placeholder="Ej. Juan Pérez" style={{ border: 'none', outline: 'none', fontWeight: 'bold', fontFamily: 'inherit', color: '#111', width: '120px' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Fecha:</span>
                <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} style={{ border: 'none', outline: 'none', fontWeight: 'bold', fontFamily: 'inherit', color: '#111', cursor: 'pointer' }} />
              </div>

              {/* 🌟 BOTÓN DE GUARDADO MOVIDO ARRIBA */}
              <button onClick={handlePreSave} className="crm-btn-black" style={{ padding: '10px 24px', fontSize: '15px' }}>
                Revisar y Guardar
              </button>
            </div>
          </div>

          <div className="crm-card-paper" style={{ padding: 0, overflowX: 'auto', marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #111', backgroundColor: '#f9f9f9' }}>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '900', width: '20%' }}>CLIENTE / TIENDA</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>HOME</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>BLOG</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>PDP</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>CARRITO</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>CHECKOUT</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '900', width: '30%' }}>OBSERVACIONES</th>
                </tr>
              </thead>
              <tbody>
                {stores.map(store => (
                  <tr key={store.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#111', fontSize: '14px' }}>{store.name}</div>
                          <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', marginTop: '4px' }}>Plan: {store.plan_type}</div>
                        </div>
                        {/* 🌟 BOTÓN PARA ABRIR PÁGINA INDIVIDUAL */}
                        {store.web && (
                          <button 
                            onClick={() => window.open(store.web.startsWith('http') ? store.web : `https://${store.web}`, '_blank')}
                            style={{ 
                              marginLeft: 'auto', 
                              padding: '6px', 
                              fontSize: '12px', 
                              backgroundColor: '#f3f4f6', 
                              border: '1px solid #d1d5db', 
                              borderRadius: '6px', 
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                            title="Abrir web en nueva pestaña"
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                          >
                            🌐
                          </button>
                        )}
                      </div>
                    </td>
                    {['home_page', 'blog', 'pdp', 'cart', 'checkout'].map(field => (
                      <td key={field} style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ cursor: 'pointer' }} onClick={() => handleCycleCheck(store.id, field)}>
                          {renderIcon(checks[store.id]?.[field])}
                        </div>
                      </td>
                    ))}
                    <td style={{ padding: '12px 16px' }}>
                      <input 
                        type="text" 
                        placeholder="Si hay ⚠️, detalla aquí..." 
                        value={checks[store.id]?.observations || ''}
                        onChange={(e) => handleObsChange(store.id, e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none', fontFamily: 'inherit' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA DE HISTORIAL POR CARPETAS */}
      {activeTab === 'HISTORY' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111', margin: 0 }}>Directorios de Auditoría por Tienda</h1>
            
            {/* 🌟 BARRA DE BÚSQUEDA PARA CARPETAS */}
            <input 
              type="text" 
              placeholder="🔍 Buscar carpeta por nombre o ID..." 
              value={historySearchTerm}
              onChange={e => setHistorySearchTerm(e.target.value)}
              style={{ 
                width: '100%', 
                maxWidth: '350px', 
                padding: '10px 16px', 
                borderRadius: '8px', 
                border: '2px solid #111', 
                outline: 'none', 
                fontSize: '14px',
                backgroundColor: '#fff'
              }}
            />
          </div>

          {loadingHistory ? (
            <div className="crm-text-loading">Cargando registros...</div>
          ) : Object.keys(historyByStore).length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px' }}>
              No hay auditorías registradas en el sistema.
            </div>
          ) : filteredHistoryStores.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#fff', border: '2px dashed #ccc', borderRadius: '8px', color: '#666' }}>
              No se encontraron carpetas con ese nombre.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: expandedStore ? '300px 1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }}>
              
              {/* LISTADO DE CARPETAS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredHistoryStores.map(store => (
                  <div 
                    key={store.id} 
                    onClick={() => {
                      setExpandedStore(store.id);
                      setStoreViewMode('LIST');
                      setCompareSelection({ a: 0, b: store.reviews.length > 1 ? 1 : 0 });
                    }}
                    style={{ 
                      padding: '16px', 
                      backgroundColor: expandedStore === store.id ? '#111' : '#fff', 
                      color: expandedStore === store.id ? '#FFD700' : '#111',
                      border: '2px solid #111', 
                      borderRadius: '8px', 
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: expandedStore === store.id ? 'none' : '2px 2px 0px #111',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>📁 {store.name}</div>
                    <div style={{ fontSize: '12px', backgroundColor: expandedStore === store.id ? '#FFD700' : '#f3f4f6', color: '#111', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                      {store.reviews.length} regs
                    </div>
                  </div>
                ))}
              </div>

              {/* PANEL DE DETALLE EXPANDIDO */}
              {expandedStore && historyByStore[expandedStore] && (
                <div style={{ backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px', boxShadow: '4px 4px 0px #111', overflow: 'hidden', position: 'sticky', top: '20px' }}>
                  
                  {/* CABECERA DEL PANEL */}
                  <div style={{ backgroundColor: '#f9fafb', padding: '16px 24px', borderBottom: '2px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900' }}>{historyByStore[expandedStore].name}</h2>
                      <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>ID: {historyByStore[expandedStore].id}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button 
                        onClick={() => navigate(`/admin/clientes/${historyByStore[expandedStore].id}`)} 
                        className="crm-btn-border" style={{ fontSize: '13px', padding: '6px 12px' }}
                      >
                        Ir al Perfil de la Tienda ↗
                      </button>
                    </div>
                  </div>

                  {/* TABS INTERNOS: HISTORIAL VS COMPARADOR */}
                  <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f3f4f6' }}>
                    <button 
                      onClick={() => setStoreViewMode('LIST')}
                      style={{ flex: 1, padding: '12px', border: 'none', backgroundColor: storeViewMode === 'LIST' ? '#fff' : 'transparent', fontWeight: 'bold', cursor: 'pointer', borderBottom: storeViewMode === 'LIST' ? '2px solid #111' : 'none' }}
                    >
                      📄 Historial Completo
                    </button>
                    <button 
                      onClick={() => setStoreViewMode('COMPARE')}
                      style={{ flex: 1, padding: '12px', border: 'none', backgroundColor: storeViewMode === 'COMPARE' ? '#fff' : 'transparent', fontWeight: 'bold', cursor: 'pointer', borderBottom: storeViewMode === 'COMPARE' ? '2px solid #111' : 'none' }}
                    >
                      ⚖️ Comparador (Día vs Día)
                    </button>
                  </div>

                  <div style={{ padding: '24px' }}>
                    
                    {/* VISTA 1: LISTA COMPLETA */}
                    {storeViewMode === 'LIST' && (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #111', color: '#666' }}>
                              <th style={{ padding: '12px', textAlign: 'left' }}>Fecha</th>
                              <th style={{ padding: '12px', textAlign: 'center' }}>Home</th>
                              <th style={{ padding: '12px', textAlign: 'center' }}>Blog</th>
                              <th style={{ padding: '12px', textAlign: 'center' }}>PDP</th>
                              <th style={{ padding: '12px', textAlign: 'center' }}>Cart</th>
                              <th style={{ padding: '12px', textAlign: 'center' }}>Check</th>
                              <th style={{ padding: '12px', textAlign: 'left' }}>Observaciones</th>
                              <th style={{ padding: '12px', textAlign: 'right' }}>Agente</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyByStore[expandedStore].reviews.map((rev, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{formatDate(rev.review_date)}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{renderIcon(rev.home_page)}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{renderIcon(rev.blog)}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{renderIcon(rev.pdp)}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{renderIcon(rev.cart)}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{renderIcon(rev.checkout)}</td>
                                <td style={{ padding: '12px', color: '#dc2626', fontWeight: '500' }}>{rev.observations || '-'}</td>
                                <td style={{ padding: '12px', textAlign: 'right', color: '#666' }}>{rev.reviewer_name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* VISTA 2: COMPARADOR */}
                    {storeViewMode === 'COMPARE' && (
                      <div>
                        {historyByStore[expandedStore].reviews.length < 2 ? (
                          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                            Se necesitan al menos 2 registros históricos para hacer una comparación.
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>FECHA A (Base):</label>
                                <select 
                                  value={compareSelection.a} 
                                  onChange={(e) => setCompareSelection(p => ({ ...p, a: Number(e.target.value) }))}
                                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontWeight: 'bold', backgroundColor: '#fff' }}
                                >
                                  {historyByStore[expandedStore].reviews.map((rev, idx) => (
                                    <option key={idx} value={idx}>{formatDate(rev.review_date)}</option>
                                  ))}
                                </select>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '20px', color: '#9ca3af' }}>VS</div>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#4b5563' }}>FECHA B (Comparar):</label>
                                <select 
                                  value={compareSelection.b} 
                                  onChange={(e) => setCompareSelection(p => ({ ...p, b: Number(e.target.value) }))}
                                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontWeight: 'bold', backgroundColor: '#fff' }}
                                >
                                  {historyByStore[expandedStore].reviews.map((rev, idx) => (
                                    <option key={idx} value={idx}>{formatDate(rev.review_date)}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#111', color: '#fff' }}>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', borderRadius: '8px 0 0 0' }}>Módulo Examinado</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#FFD700' }}>{formatDate(historyByStore[expandedStore].reviews[compareSelection.a].review_date)}</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#FFD700', borderRadius: '0 8px 0 0' }}>{formatDate(historyByStore[expandedStore].reviews[compareSelection.b].review_date)}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {['home_page', 'blog', 'pdp', 'cart', 'checkout'].map(field => {
                                  const valA = historyByStore[expandedStore].reviews[compareSelection.a][field];
                                  const valB = historyByStore[expandedStore].reviews[compareSelection.b][field];
                                  const changed = valA !== valB;
                                  
                                  return (
                                    <tr key={field} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: changed ? '#fefce8' : '#fff' }}>
                                      <td style={{ padding: '16px', fontWeight: 'bold', textTransform: 'capitalize' }}>{field.replace('_', ' ')}</td>
                                      <td style={{ padding: '16px', textAlign: 'center' }}>{renderIcon(valA)}</td>
                                      <td style={{ padding: '16px', textAlign: 'center' }}>{renderIcon(valB)}</td>
                                    </tr>
                                  );
                                })}
                                <tr style={{ backgroundColor: '#fff' }}>
                                  <td style={{ padding: '16px', fontWeight: 'bold', verticalAlign: 'top' }}>Observaciones Registradas</td>
                                  <td style={{ padding: '16px', color: '#dc2626', fontSize: '13px', verticalAlign: 'top', borderLeft: '1px solid #e5e7eb' }}>
                                    {historyByStore[expandedStore].reviews[compareSelection.a].observations || 'Sin observaciones.'}
                                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#9ca3af', fontWeight: 'bold' }}>Firma: {historyByStore[expandedStore].reviews[compareSelection.a].reviewer_name}</div>
                                  </td>
                                  <td style={{ padding: '16px', color: '#dc2626', fontSize: '13px', verticalAlign: 'top', borderLeft: '1px solid #e5e7eb' }}>
                                    {historyByStore[expandedStore].reviews[compareSelection.b].observations || 'Sin observaciones.'}
                                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#9ca3af', fontWeight: 'bold' }}>Firma: {historyByStore[expandedStore].reviews[compareSelection.b].reviewer_name}</div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE GUARDADO */}
      {showModal && (
        <div className="crm-modal-mask">
          <div className="crm-modal-content" style={{ maxWidth: '900px', width: '90%' }}>
            <h2 style={{ marginTop: 0, fontWeight: '900', borderBottom: '2px solid #111', paddingBottom: '12px' }}>
              Confirmación de Registro
            </h2>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>
              Estás a punto de guardar la auditoría del día <strong>{reviewDate}</strong> bajo la firma de <strong>{reviewerName}</strong>. 
            </p>

            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9f9f9', borderBottom: '1px solid #111' }}>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left', width: '20%' }}>Tienda</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Home</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Blog</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>PDP</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Cart</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Check</th>
                    <th style={{ padding: '8px', textAlign: 'left', width: '30%' }}>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {storesToSubmit.map(store => (
                    <tr key={store.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{store.name}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{renderIcon(checks[store.id].home_page)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{renderIcon(checks[store.id].blog)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{renderIcon(checks[store.id].pdp)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{renderIcon(checks[store.id].cart)}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{renderIcon(checks[store.id].checkout)}</td>
                      <td style={{ padding: '8px', color: '#dc2626', fontWeight: '500' }}>{checks[store.id].observations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#16a34a' }}>
                Total a registrar: {storesToSubmit.length} tiendas
              </span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowModal(false)} className="crm-btn-border" disabled={isSaving}>
                  Volver a Editar
                </button>
                <button onClick={handleConfirmSave} className="crm-btn-black" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Confirmar y Guardar Todo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ManualReviewForm;