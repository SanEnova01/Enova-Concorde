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
          initialChecks[s.id] = { home_page: false, blog: false, pdp: false, cart: false, checkout: false };
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

  const handleCheck = (storeId, field) => {
    setChecks(prev => ({
      ...prev,
      [storeId]: {
        ...prev[storeId],
        [field]: !prev[storeId][field]
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
      return c && (c.home_page || c.blog || c.pdp || c.cart || c.checkout);
    });

    if (filtered.length === 0) {
      alert('No has marcado ninguna vista en ninguna tienda. Marca al menos una para registrar la auditoría.');
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
        resetChecks[store.id] = { home_page: false, blog: false, pdp: false, cart: false, checkout: false };
      });
      setChecks(resetChecks);
      
      setShowModal(false);
      alert('Auditoría masiva guardada exitosamente.');
    } catch (error) {
      alert('Ocurrió un error guardando el registro.');
    }
    setIsSaving(false);
  };

  const renderIcon = (val) => val ? '✅' : '❌';

  if (loading) return <div className="crm-text-loading" style={{ padding: '40px' }}>Cargando infraestructura...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #111', paddingBottom: '12px', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('FORM')}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: activeTab === 'FORM' ? '#111' : 'transparent', 
            color: activeTab === 'FORM' ? '#FFD700' : '#4b5563', 
            border: activeTab === 'FORM' ? '2px solid #111' : '2px solid transparent', 
            borderRadius: '6px', 
            fontWeight: '900', 
            cursor: 'pointer'
          }}
        >
          Registro Diario
        </button>
        <button 
          onClick={() => setActiveTab('HISTORY')}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: activeTab === 'HISTORY' ? '#111' : 'transparent', 
            color: activeTab === 'HISTORY' ? '#FFD700' : '#4b5563', 
            border: activeTab === 'HISTORY' ? '2px solid #111' : '2px solid transparent', 
            borderRadius: '6px', 
            fontWeight: '900', 
            cursor: 'pointer'
          }}
        >
          Historial Global
        </button>
      </div>

      {activeTab === 'FORM' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111', margin: '0 0 8px 0' }}>Hoja de Control (Q/A)</h1>
              <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>Marca únicamente las vistas que presentan incidencias o revisiones aprobadas. Las tiendas en blanco serán ignoradas.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #111' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Firma del Agente:</span>
                <input 
                  type="text" 
                  value={reviewerName} 
                  onChange={(e) => setReviewerName(e.target.value)} 
                  placeholder="Ej. Juan Pérez"
                  style={{ border: 'none', outline: 'none', fontWeight: 'bold', fontFamily: 'inherit', color: '#111', width: '120px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #111' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Fecha:</span>
                <input 
                  type="date" 
                  value={reviewDate} 
                  onChange={(e) => setReviewDate(e.target.value)} 
                  style={{ border: 'none', outline: 'none', fontWeight: 'bold', fontFamily: 'inherit', color: '#111', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          <div className="crm-card-paper" style={{ padding: 0, overflowX: 'auto', marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #111', backgroundColor: '#f9f9f9' }}>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '900' }}>CLIENTE / TIENDA</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>HOME</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>BLOG</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>PDP</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>CARRITO</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>CHECKOUT</th>
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
                        <input 
                          type="checkbox" 
                          checked={checks[store.id]?.[field] || false}
                          onChange={() => handleCheck(store.id, field)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#111' }}
                        />
                      </td>
                    ))}
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
          <div className="crm-modal-content" style={{ maxWidth: '800px', width: '90%' }}>
            <h2 style={{ marginTop: 0, fontWeight: '900', borderBottom: '2px solid #111', paddingBottom: '12px' }}>
              Confirmación de Registro
            </h2>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>
              Estás a punto de guardar la auditoría del día <strong>{reviewDate}</strong> bajo la firma de <strong>{reviewerName}</strong>. 
              Se registrarán las siguientes tiendas (las omitidas no generarán registro):
            </p>

            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9f9f9', borderBottom: '1px solid #111' }}>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Tienda</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Home</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Blog</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>PDP</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Cart</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Checkout</th>
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
                <button 
                  onClick={() => setShowModal(false)} 
                  className="crm-btn-border"
                  disabled={isSaving}
                >
                  Volver a Editar
                </button>
                <button 
                  onClick={handleConfirmSave} 
                  className="crm-btn-black"
                  disabled={isSaving}
                >
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