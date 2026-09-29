import React, { useState, useEffect } from 'react';
import crmApi from '../../../api/crmApi'; // 🌟 LA CORRECCIÓN CLAVE: Usar la API configurada

const StoreReviewHistory = ({ storeId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyReviews, setDailyReviews] = useState([]); // Fechas con "store_daily_reviews"
  const [qaReviews, setQaReviews] = useState({});       // Datos de "manual_reviews"
  const [loading, setLoading] = useState(true);

  // Modal para ver el detalle del QA de un día
  const [selectedDayQA, setSelectedDayQA] = useState(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const monthsNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const monthFilter = String(currentMonth + 1).padStart(2, '0');
      
      const token = localStorage.getItem('crm_token') || localStorage.getItem('token');
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      let dailyDates = [];
      let qaMap = {};

      // 1. Traer revisiones diarias (Monitor Concorde)
      try {
        const resDaily = await crmApi.get(`/daily-reviews/monthly?store_id=${storeId}&year=${currentYear}&month=${monthFilter}`, config);
        if (resDaily.data && resDaily.data.success) {
          dailyDates = resDaily.data.data;
        }
      } catch (error) {
        console.error('Error obteniendo monitor diario:', error);
      }

      // 2. Traer revisiones QA (manual_reviews)
      try {
        const resQA = await crmApi.get(`/manual-reviews/${storeId}`, config);
        if (resQA.data && resQA.data.success) {
          resQA.data.data.forEach(rev => {
            const d = new Date(rev.review_date);
            const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
            if (!qaMap[dateStr]) qaMap[dateStr] = [];
            qaMap[dateStr].push(rev);
          });
        }
      } catch (error) {
        console.error('Error obteniendo revisiones QA:', error);
      }

      setDailyReviews(dailyDates);
      setQaReviews(qaMap);
      setLoading(false);
    };

    if (storeId) fetchData();
  }, [storeId, currentDate, currentMonth, currentYear]);

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentYear, currentMonth + offset, 1));
  };

  const getQAStatus = (qaList) => {
    if (!qaList || qaList.length === 0) return 'NONE';
    const hasObservations = qaList.some(r => 
      r.home_page === 'OBSERVED' || r.blog === 'OBSERVED' || r.pdp === 'OBSERVED' || 
      r.cart === 'OBSERVED' || r.checkout === 'OBSERVED' || (r.observations && r.observations.trim() !== '')
    );
    return hasObservations ? 'OBSERVED' : 'OK';
  };

  const renderIcon = (state) => {
    if (state === 'OK') return <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ OK</span>;
    if (state === 'OBSERVED') return <span style={{ color: '#ea580c', fontWeight: 'bold' }}>⚠️ Obs</span>;
    return <span style={{ color: '#9ca3af' }}>-</span>;
  };

  const renderCalendarCells = () => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startOffset = new Date(currentYear, currentMonth, 1).getDay();
    const cells = [];

    // Celdas vacías previas al inicio del mes
    for (let i = 0; i < startOffset; i++) {
      cells.push(<div key={`empty-${i}`} style={{ backgroundColor: 'transparent', padding: '10px' }}></div>);
    }

    // Celdas de los días
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const isDailyChecked = dailyReviews.includes(dateString);
      const dayQA = qaReviews[dateString];
      const qaStatus = getQAStatus(dayQA);

      const hasInteractiveData = dayQA && dayQA.length > 0;

      cells.push(
        <div 
          key={day} 
          onClick={() => hasInteractiveData && setSelectedDayQA({ date: dateString, data: dayQA })}
          style={{ 
            backgroundColor: '#fff', 
            border: '1px solid #e5e7eb', 
            borderRadius: '6px', 
            padding: '8px', 
            height: '80px',
            display: 'flex', 
            flexDirection: 'column',
            cursor: hasInteractiveData ? 'pointer' : 'default',
            boxShadow: hasInteractiveData ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
            transition: 'all 0.15s'
          }}
          onMouseEnter={e => { if(hasInteractiveData) e.currentTarget.style.borderColor = '#111'; }}
          onMouseLeave={e => { if(hasInteractiveData) e.currentTarget.style.borderColor = '#e5e7eb'; }}
        >
          <span style={{ fontSize: '13px', fontWeight: '900', color: '#111', alignSelf: 'flex-end' }}>{day}</span>
          
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Etiqueta Monitor / Daily Review */}
            <div style={{ 
              backgroundColor: isDailyChecked ? '#dcfce7' : '#f3f4f6', 
              color: isDailyChecked ? '#166534' : '#9ca3af', 
              padding: '2px 4px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' 
            }}>
              {isDailyChecked ? '✓ Monitor' : '○ Monitor'}
            </div>

            {/* Etiqueta QA Módulos */}
            <div style={{ 
              backgroundColor: qaStatus === 'OK' ? '#dcfce7' : (qaStatus === 'OBSERVED' ? '#ffedd5' : '#f3f4f6'), 
              color: qaStatus === 'OK' ? '#166534' : (qaStatus === 'OBSERVED' ? '#c2410c' : '#9ca3af'), 
              padding: '2px 4px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' 
            }}>
              {qaStatus === 'OK' ? '✓ QA Web' : (qaStatus === 'OBSERVED' ? '⚠️ QA Web' : '○ QA Web')}
            </div>
          </div>
        </div>
      );
    }
    return cells;
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Navegación del Calendario */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', backgroundColor: '#f9fafb', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        <button onClick={() => changeMonth(-1)} style={{ padding: '6px 12px', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>◀ Anterior</button>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', textTransform: 'uppercase' }}>{monthsNames[currentMonth]} {currentYear}</h2>
        <button onClick={() => changeMonth(1)} style={{ padding: '6px 12px', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Siguiente ▶</button>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '13px' }}>Cargando datos del mes...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontWeight: 'bold', marginBottom: '8px', fontSize: '12px', color: '#666' }}>
            <div>Dom</div><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {renderCalendarCells()}
          </div>
        </>
      )}

      {/* Modal Detalles QA */}
      {selectedDayQA && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', 
          zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }} onClick={() => setSelectedDayQA(null)}>
          <div style={{
            backgroundColor: '#fff', padding: '24px', borderRadius: '12px', 
            width: '90%', maxWidth: '600px', border: '2px solid #111', 
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #111', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900' }}>Detalle QA: {selectedDayQA.date}</h3>
              <button onClick={() => setSelectedDayQA(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {selectedDayQA.data.map(qa => (
                <div key={qa.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', backgroundColor: '#f9fafb' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', textAlign: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '10px', color: '#666', fontWeight: 'bold' }}>HOME</span>
                      <span style={{ fontSize: '13px' }}>{renderIcon(qa.home_page)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '10px', color: '#666', fontWeight: 'bold' }}>BLOG</span>
                      <span style={{ fontSize: '13px' }}>{renderIcon(qa.blog)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '10px', color: '#666', fontWeight: 'bold' }}>PDP</span>
                      <span style={{ fontSize: '13px' }}>{renderIcon(qa.pdp)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '10px', color: '#666', fontWeight: 'bold' }}>CARRITO</span>
                      <span style={{ fontSize: '13px' }}>{renderIcon(qa.cart)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '10px', color: '#666', fontWeight: 'bold' }}>CHECKOUT</span>
                      <span style={{ fontSize: '13px' }}>{renderIcon(qa.checkout)}</span>
                    </div>
                  </div>
                  
                  <div style={{ backgroundColor: '#fff', border: '1px dashed #d1d5db', padding: '12px', borderRadius: '6px' }}>
                    <strong style={{ display: 'block', fontSize: '11px', color: '#4b5563', marginBottom: '4px' }}>OBSERVACIONES DEL AGENTE:</strong>
                    <span style={{ fontSize: '13px', color: '#b91c1c', fontWeight: '500' }}>{qa.observations || 'Sin observaciones.'}</span>
                    <div style={{ marginTop: '8px', textAlign: 'right', fontSize: '11px', color: '#9ca3af', fontWeight: 'bold' }}>Firma: {qa.reviewer_name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreReviewHistory;