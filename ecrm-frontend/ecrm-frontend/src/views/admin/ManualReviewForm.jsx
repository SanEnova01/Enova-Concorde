import React, { useState, useEffect } from 'react';
import crmApi from '../../api/crmApi';

const PLANES_ELEGIBLES = ['go', 'growth', 'scale', 'escale', 'scale_plus', 'warranty'];

const ManualReviewForm = () => {
  const [activeTab, setActiveTab] = useState('FORM');
  const [stores, setStores] = useState([]);
  const [checks, setChecks] = useState({});
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().split('T')[0]);
  const [reviewerName, setReviewerName] = useState('');
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [storesToSubmit, setStoresToSubmit] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const [historyData, setHistoryData] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);

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
          const dateStr = new Date(curr.review_date).toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          });
          if (!acc[dateStr]) acc[dateStr] = [];
          acc[dateStr].push(curr);
          return acc;
        }, {});
        setHistoryData(grouped);
      }
    } catch (error) {
      console.error(error);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      loadHistory();
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
        [storeId]: {
          ...prev[storeId],
          [field]: nextState
        }
      };
    });
  };

  const handleObsChange = (storeId, text) => {
    setChecks(prev => ({
      ...prev,
      [storeId]: {
        ...prev[storeId],
        observations: text
      }
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

  if (loading) return <div className="crm-text-loading" style={{ padding: '40px' }}>Cargando infraestructura...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #111', paddingBottom: '12px', marginBottom: '24px' }}>
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
          Historial Global
        </button>
      </div>

      {activeTab === 'FORM' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111', margin: '0 0 8px 0' }}>Hoja de Control (Q/A)</h1>
              <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>1 Clic: OK (Verde) | 2 Clics: Observado (Naranja) | 3 Clics: Limpiar</p>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #111' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Firma del Agente:</span>
                <input type="text" value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} placeholder="Ej. Juan Pérez" style={{ border: 'none', outline: 'none', fontWeight: 'bold', fontFamily: 'inherit', color: '#111', width: '120px' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #111' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Fecha:</span>
                <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} style={{ border: 'none', outline: 'none', fontWeight: 'bold', fontFamily: 'inherit', color: '#111', cursor: 'pointer' }} />
              </div>
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
                      <div style={{ fontWeight: 'bold', color: '#111', fontSize: '14px' }}>{store.name}</div>
                      <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', marginTop: '4px' }}>Plan: {store.plan_type}</div>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handlePreSave} className="crm-btn-black" style={{ padding: '12px 24px', fontSize: '16px' }}>
              Revisar y Guardar Registro Diario
            </button>
          </div>
        </>
      )}

      {activeTab === 'HISTORY' && (
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111', marginBottom: '24px' }}>Historial de Auditorías</h1>
          {loadingHistory ? (
            <div className="crm-text-loading">Cargando registros...</div>
          ) : Object.keys(historyData).length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px' }}>
              No hay auditorías registradas en el sistema.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {Object.keys(historyData).map(dateKey => (
                <div key={dateKey} style={{ border: '2px solid #111', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
                  <div style={{ backgroundColor: '#111', color: '#FFD700', padding: '12px 16px', fontWeight: '900', textTransform: 'capitalize' }}>
                    {dateKey}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #ccc', backgroundColor: '#f5f4f0' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left' }}>Tienda</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Home</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Blog</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>PDP</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Carrito</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Checkout</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left' }}>Observaciones</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Auditor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData[dateKey].map((rev, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px 16px', fontWeight: 'bold' }}>{rev.store_name}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{renderIcon(rev.home_page)}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{renderIcon(rev.blog)}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{renderIcon(rev.pdp)}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{renderIcon(rev.cart)}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>{renderIcon(rev.checkout)}</td>
                          <td style={{ padding: '10px 16px', color: '#dc2626', fontWeight: '500' }}>{rev.observations || '-'}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: '#666', fontStyle: 'italic' }}>{rev.reviewer_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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