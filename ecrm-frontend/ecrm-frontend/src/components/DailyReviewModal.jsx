import React, { useState, useEffect } from 'react';
import crmApi from '../api/crmApi';

const DailyReviewModal = ({ isOpen, onClose, storeId, storeName }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [checkedDays, setCheckedDays] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !storeId) return;
    const fetchReviews = async () => {
      setLoading(true);
      try {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        const res = await crmApi.get(`/manual-reviews/monthly?store_id=${storeId}&year=${year}&month=${month}`);
        if (res.data?.success) {
          setCheckedDays(res.data.data || []);
        }
      } catch (error) {
        console.warn('Endpoint de revisiones no configurado o falló.', error);
      }
      setLoading(false);
    };
    fetchReviews();
  }, [isOpen, storeId, currentDate]);

  if (!isOpen) return null;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); 
  const daysArray = Array(firstDayIndex).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const handleToggleDay = async (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isChecked = checkedDays.includes(dateStr);
    
    setCheckedDays(prev => isChecked ? prev.filter(d => d !== dateStr) : [...prev, dateStr]);

    try {
      await crmApi.post('/manual-reviews/toggle', {
        store_id: storeId,
        date: dateStr,
        checked: !isChecked
      });
    } catch (error) {
      alert('Error al guardar la revisión. Verifica la conexión.');
      setCheckedDays(prev => isChecked ? [...prev, dateStr] : prev.filter(d => d !== dateStr));
    }
  };

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  return (
    <div className="crm-modal-mask" onClick={onClose} style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="crm-modal-content" onClick={e => e.stopPropagation()} style={{ width: '450px', padding: '24px', borderRadius: '12px', backgroundColor: '#fff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#111' }}>Registro Diario de Revisión</h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#666', fontWeight: 'bold' }}>{storeName}</p>
          </div>
          <button onClick={onClose} style={{ backgroundColor: '#f3f4f6', color: '#374151', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cerrar</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', backgroundColor: '#111', color: '#fff', padding: '8px 12px', borderRadius: '6px' }}>
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>{'<'} Ant</button>
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{monthNames[month]} {year}</span>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>Sig {'>'}</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666', fontSize: '13px', fontWeight: 'bold' }}>Cargando calendario...</div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', marginBottom: '8px' }}>
              {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(d => <span key={d} style={{ fontSize: '11px', fontWeight: 'bold', color: '#666' }}>{d}</span>)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
              {daysArray.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} />;
                
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const checked = checkedDays.includes(dateStr);
                const todayStyle = isToday(day) ? { border: '2px solid #111' } : { border: '1px solid #eee' };

                return (
                  <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px', borderRadius: '6px', backgroundColor: checked ? '#f0fdf4' : '#fafafa', transition: 'all 0.2s', ...todayStyle }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: checked ? '#16a34a' : '#111', marginBottom: '4px' }}>{day}</span>
                    <input 
                      type="checkbox" 
                      checked={checked} 
                      onChange={() => handleToggleDay(day)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#16a34a' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyReviewModal;