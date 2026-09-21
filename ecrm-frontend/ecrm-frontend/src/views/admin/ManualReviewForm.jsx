import React, { useState, useEffect } from 'react';
import crmApi from '../../api/crmApi';

const PLANES_ELEGIBLES = ['go', 'growth', 'scale', 'escale', 'scale_plus', 'warranty'];

const ManualReviewForm = () => {
  const [stores, setStores] = useState([]);
  const [checks, setChecks] = useState({});
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState({});

  useEffect(() => {
    const fetchStores = async () => {
      try {
        // Usamos crmApi que ya tiene el baseURL y el token configurado
        const res = await crmApi.get('/stores');
        
        const rawStores = Array.isArray(res.data.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        
        const validStores = rawStores.filter(store => {
          if (!store.plan_type) return false;
          const plan = String(store.plan_type).toLowerCase().trim();
          return PLANES_ELEGIBLES.includes(plan);
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
        console.error('Error cargando tiendas:', error);
        setLoading(false);
      }
    };
    fetchStores();
  }, []);

  const handleCheck = (storeId, field) => {
    setChecks(prev => ({
      ...prev,
      [storeId]: {
        ...prev[storeId],
        [field]: !prev[storeId][field]
      }
    }));
  };

  const handleSaveRow = async (store) => {
    try {
      const payload = {
        store_id: store.id,
        review_date: reviewDate,
        ...checks[store.id],
        reviewer_name: 'Control de Calidad'
      };

      // Usamos crmApi para enviar la data
      await crmApi.post('/manual-reviews', payload);

      setSaveStatus(prev => ({ ...prev, [store.id]: 'success' }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [store.id]: null }));
        setChecks(prev => ({
          ...prev,
          [store.id]: { home_page: false, blog: false, pdp: false, cart: false, checkout: false }
        }));
      }, 2000);

    } catch (error) {
      alert(`Error al guardar la revisión de ${store.name}`);
    }
  };

  if (loading) return <div className="crm-text-loading" style={{ padding: '40px' }}>Cargando lista de tiendas...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111', margin: '0 0 8px 0' }}>Registro de Calidad (Q/A)</h1>
          <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>Verifica las vistas principales de los clientes con planes activos.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #111', boxShadow: '2px 2px 0px #111' }}>
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Fecha de Auditoría:</span>
          <input 
            type="date" 
            value={reviewDate} 
            onChange={(e) => setReviewDate(e.target.value)} 
            style={{ border: 'none', outline: 'none', fontWeight: 'bold', fontFamily: 'inherit', color: '#111', cursor: 'pointer' }}
          />
        </div>
      </div>

      <div className="crm-card-paper" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #111', backgroundColor: '#f9f9f9' }}>
              <th style={{ padding: '16px', textAlign: 'left', fontWeight: '900' }}>CLIENTE / TIENDA</th>
              <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>HOME</th>
              <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>BLOG</th>
              <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>PDP</th>
              <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>CARRITO</th>
              <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>CHECKOUT</th>
              <th style={{ padding: '16px', textAlign: 'center', fontWeight: '900' }}>ACCIÓN</th>
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

                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  {saveStatus[store.id] === 'success' ? (
                    <span style={{ display: 'inline-block', padding: '6px 12px', backgroundColor: '#16a34a', color: 'white', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' }}>
                      ✅ OK
                    </span>
                  ) : (
                    <button onClick={() => handleSaveRow(store)} className="crm-btn-black" style={{ padding: '6px 12px', fontSize: '12px' }}>
                      Guardar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {stores.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#666' }}>
                  No hay tiendas elegibles registradas en la base de datos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default ManualReviewForm;