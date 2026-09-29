import React, { useState, useEffect } from 'react';
import crmApi from '../api/crmApi';

const DailyReviewModal = ({ isOpen, storeId, storeName, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
  const [reviewerName, setReviewerName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Forzamos zona horaria local (Latam)
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (isOpen && storeId) checkTodayRecord();
  }, [isOpen, storeId]);

  const checkTodayRecord = async () => {
    try {
      const [year, month] = localDate.split('-');
      const res = await crmApi.get(`/manual-reviews/monthly?store_id=${storeId}&year=${year}&month=${month}`);
      
      if (res.data.success && res.data.data.includes(localDate)) {
         setIsAlreadyRegistered(true);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!reviewerName.trim()) return alert("Por favor ingresa tu firma (Nombre).");
    setIsSaving(true);
    try {
      await crmApi.post('/manual-reviews/daily', {
        store_id: storeId,
        review_date: localDate,
        reviewer_name: reviewerName
      });
      setIsAlreadyRegistered(true);
      alert("✅ Registro diario de monitor guardado con éxito.");
      setTimeout(() => {
        onClose();
        window.location.reload(); // Recarga rápida para actualizar el calendario debajo
      }, 1000);
    } catch (error) {
      alert(error.response?.data?.error || "Error al guardar el registro.");
    }
    setIsSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="crm-modal-mask" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="crm-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', textAlign: 'center' }}>
        
        <h2 style={{ marginTop: 0, fontWeight: '900', fontSize: '20px', color: '#111' }}>Revisión de Monitor</h2>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>Tienda: <strong>{storeName}</strong><br/>Fecha: {localDate}</p>

        {loading ? (
          <div style={{ padding: '20px', color: '#666' }}>Verificando estado actual...</div>
        ) : isAlreadyRegistered ? (
          <div style={{ backgroundColor: '#dcfce7', border: '1px solid #16a34a', padding: '20px', borderRadius: '8px' }}>
            <span style={{ fontSize: '30px', display: 'block', marginBottom: '10px' }}>✅</span>
            <strong style={{ color: '#166534', display: 'block' }}>El registro de hoy ya fue completado.</strong>
            <p style={{ fontSize: '12px', color: '#166534', marginTop: '8px' }}>No es necesario volver a registrarlo. Vuelve mañana.</p>
            <button onClick={onClose} className="crm-btn-black" style={{ marginTop: '16px', width: '100%' }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px dashed #ccc', textAlign: 'left' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#4b5563' }}>Confirmo que he revisado las métricas de rendimiento y estado operativo de esta tienda.</p>
              <label style={{ display: 'block', fontWeight: 'bold', fontSize: '12px', marginBottom: '6px' }}>Firma del Agente:</label>
              <input 
                type="text" 
                value={reviewerName} 
                onChange={(e) => setReviewerName(e.target.value)} 
                placeholder="Ej. Juan Pérez" 
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', outline: 'none', fontWeight: 'bold' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={onClose} className="crm-btn-border" style={{ flex: 1 }} disabled={isSaving}>Cancelar</button>
              <button onClick={handleSave} className="crm-btn-black" style={{ flex: 1, backgroundColor: '#16a34a', borderColor: '#16a34a' }} disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Firmar y Registrar'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DailyReviewModal;