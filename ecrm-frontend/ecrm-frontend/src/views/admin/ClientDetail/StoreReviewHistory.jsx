import React, { useState, useEffect } from 'react';
import axios from 'axios';

const StoreReviewHistory = ({ storeId }) => {
  const [groupedReviews, setGroupedReviews] = useState({});
  const [openDays, setOpenDays] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const token = localStorage.getItem('crm_token') || localStorage.getItem('token');
        const { data } = await axios.get(`/api/manual-reviews/${storeId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (data.success) {
          // Agrupar las revisiones por fecha exacta
          const groups = data.data.reduce((acc, rev) => {
            const dateStr = new Date(rev.review_date).toLocaleDateString('es-ES', { 
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            });
            if (!acc[dateStr]) acc[dateStr] = [];
            acc[dateStr].push(rev);
            return acc;
          }, {});
          
          setGroupedReviews(groups);

          // Abrir automáticamente el primer acordeón (el más reciente)
          const firstDate = Object.keys(groups)[0];
          if (firstDate) {
            setOpenDays({ [firstDate]: true });
          }
        }
      } catch (error) {
        console.error('Error obteniendo historial de revisiones', error);
      } finally {
        setLoading(false);
      }
    };

    if (storeId) fetchReviews();
  }, [storeId]);

  const toggleDay = (date) => {
    setOpenDays(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const renderStatus = (val) => val ? (
    <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ OK</span>
  ) : (
    <span style={{ color: '#dc2626', fontWeight: 'bold' }}>✗ Falla</span>
  );

  if (loading) return <div style={{ fontSize: '13px', color: '#666' }}>Cargando historial de revisiones...</div>;

  const dates = Object.keys(groupedReviews);

  if (dates.length === 0) {
    return (
      <div style={{ backgroundColor: '#f9f9f9', padding: '20px', textAlign: 'center', borderRadius: '8px', border: '1px dashed #ccc', fontSize: '13px', color: '#666' }}>
        El equipo aún no ha registrado revisiones manuales para esta tienda.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {dates.map((date) => (
        <div key={date} style={{ border: '2px solid #111', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
          
          {/* Cabecera del Acordeón */}
          <div 
            onClick={() => toggleDay(date)} 
            style={{ 
              backgroundColor: openDays[date] ? '#111' : '#f5f4f0', 
              color: openDays[date] ? '#fff' : '#111',
              padding: '12px 16px', 
              cursor: 'pointer', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: '900', textTransform: 'capitalize' }}>
              📅 Revisión del {date}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
              {openDays[date] ? 'CERRAR ▲' : 'VER DETALLE ▼'}
            </span>
          </div>

          {/* Contenido Desplegable */}
          {openDays[date] && (
            <div style={{ padding: '16px', borderTop: '2px solid #111' }}>
              {groupedReviews[date].map((rev, idx) => (
                <div key={rev.id} style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(5, 1fr)', 
                  gap: '12px', 
                  textAlign: 'center',
                  paddingTop: idx > 0 ? '16px' : '0',
                  marginTop: idx > 0 ? '16px' : '0',
                  borderTop: idx > 0 ? '1px dashed #ccc' : 'none'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase' }}>Home Page</span>
                    <div style={{ backgroundColor: rev.home_page ? '#dcfce7' : '#fee2e2', padding: '6px', borderRadius: '4px', fontSize: '13px' }}>
                      {renderStatus(rev.home_page)}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase' }}>Blog</span>
                    <div style={{ backgroundColor: rev.blog ? '#dcfce7' : '#fee2e2', padding: '6px', borderRadius: '4px', fontSize: '13px' }}>
                      {renderStatus(rev.blog)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase' }}>Producto (PDP)</span>
                    <div style={{ backgroundColor: rev.pdp ? '#dcfce7' : '#fee2e2', padding: '6px', borderRadius: '4px', fontSize: '13px' }}>
                      {renderStatus(rev.pdp)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase' }}>Carrito</span>
                    <div style={{ backgroundColor: rev.cart ? '#dcfce7' : '#fee2e2', padding: '6px', borderRadius: '4px', fontSize: '13px' }}>
                      {renderStatus(rev.cart)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase' }}>Checkout</span>
                    <div style={{ backgroundColor: rev.checkout ? '#dcfce7' : '#fee2e2', padding: '6px', borderRadius: '4px', fontSize: '13px' }}>
                      {renderStatus(rev.checkout)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default StoreReviewHistory;