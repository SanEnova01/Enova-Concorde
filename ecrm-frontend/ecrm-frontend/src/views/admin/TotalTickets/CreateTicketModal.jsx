import React, { useState } from 'react';
import StoreMultiPicker from '../../../components/StoreMultiPicker';

// MODAL CREAR TICKET
const CreateTicketModal = ({ formData, setFormData, stores, adminUsers, onSubmit, onClose }) => {
  const [multiOpen, setMultiOpen] = useState((formData.extra_store_ids || []).length > 0);
  const extra = formData.extra_store_ids || [];
  return (
  <div className="crm-modal-mask" onClick={onClose}>
    <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
      <h3 className="crm-section-title" style={{ marginTop: 0 }}>Apertura de Soporte</h3>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label className="crm-stat-label">Asunto / Nombre del Ticket</label>
          <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="crm-input-text" required style={{ width: 'auto' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="crm-stat-label">Tienda / Cliente</label>
            <select value={formData.store_id} onChange={e => setFormData({...formData, store_id: e.target.value})} className="crm-select-dropdown" required>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="crm-stat-label">Responsable (Opcional)</label>
            <select 
              value={formData.assigned_to} 
              onChange={e => setFormData({...formData, assigned_to: e.target.value})} 
              className="crm-select-dropdown"
            >
              <option value="">Sin asignar</option>
              {adminUsers.map(user => (
                <option key={user.id} value={user.name}>{user.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="crm-stat-label">Nivel de Prioridad</label>
            <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="crm-select-dropdown">
              <option value="LOW">BAJA</option>
              <option value="MEDIUM">MEDIA</option>
              <option value="HIGH">ALTA</option>
              <option value="CRITICAL">CRÍTICA</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="crm-stat-label">Tipo de Tarea</label>
            <select value={formData.task_type} onChange={e => setFormData({...formData, task_type: e.target.value})} className="crm-select-dropdown">
              <option value="CONSULTA">CONSULTA</option>
              <option value="CAMBIO">CAMBIO</option>
              <option value="BUG_FIX">BUG FIX</option>
              <option value="TASK_INTERNA">TAREA INTERNA</option>
            </select>
          </div>
        </div>

        {/* Mismo pedido para varias tiendas (ej. Kuna Perú, Chile, WW, USA) */}
        <div style={{ border: '1px dashed #d1d5db', borderRadius: '8px', padding: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" checked={multiOpen} onChange={(e) => {
              setMultiOpen(e.target.checked);
              if (!e.target.checked) setFormData({ ...formData, extra_store_ids: [] });
            }} />
            Crear también para otras tiendas {extra.length > 0 ? `(${extra.length})` : ''}
          </label>
          {multiOpen && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
                Se crea un ticket por tienda con el número del principal + letra (…A, …B, …C).
              </div>
              <StoreMultiPicker
                stores={stores}
                selected={extra}
                onChange={(ids) => setFormData({ ...formData, extra_store_ids: ids })}
                excludeId={formData.store_id}
                brandStore={stores.find((s) => String(s.id) === String(formData.store_id))}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label className="crm-stat-label">Descripción Detallada</label>
          <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="crm-input-text" style={{ height: '70px', resize: 'none', width: 'auto' }} />
        </div>

        <div className="crm-pagination-box" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
          <button type="submit" className="crm-btn-black">{extra.length > 0 ? `Guardar ${extra.length + 1} tickets` : 'Guardar Ticket'}</button>
          <button type="button" onClick={onClose} className="crm-btn-red">Cancelar</button>
        </div>
      </form>
    </div>
  </div>
  );
};

export default CreateTicketModal;
