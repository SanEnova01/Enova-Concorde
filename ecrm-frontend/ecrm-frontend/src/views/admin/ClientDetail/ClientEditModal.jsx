import React from 'react';

// MODAL DE EDICIÓN
const ClientEditModal = ({ editFormData, setEditFormData, onInputChange, onLogoUpload, onSubmit, onClose }) => (
  <div className="crm-modal-mask" onClick={() => onClose()}>
    <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
      <h3 className="crm-section-title" style={{ marginTop: 0 }}>Editar Datos del Cliente</h3>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label className="crm-stat-label">Nombre del Cliente / Tienda</label>
          <input type="text" name="name" value={editFormData.name} onChange={onInputChange} className="crm-input-text" required />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="crm-stat-label">Sitio Web</label>
            <input type="url" name="web" value={editFormData.web} onChange={onInputChange} className="crm-input-text" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="crm-stat-label">Teléfono</label>
            <input type="text" name="phone" value={editFormData.phone} onChange={onInputChange} className="crm-input-text" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="crm-stat-label">Correos de contacto</label>
            <input type="text" name="emails" value={editFormData.emails} onChange={onInputChange} className="crm-input-text" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="crm-stat-label">Tipo de Plan</label>
            <select name="plan_type" value={editFormData.plan_type} onChange={onInputChange} className="crm-select-dropdown">
              <option value="GO">GO</option>
              <option value="GROWTH">GROWTH</option>
              <option value="ESCALE">ESCALE</option>
              <option value="WARRANTY">WARRANTY</option>
              <option value="OUT_OF_WARRANTY">OUT OF WARRANTY</option>
              <option value="LEAD">LEAD</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label className="crm-stat-label">Actualizar Logotipo</label>
          <input type="file" accept="image/*" onChange={onLogoUpload} className="crm-input-text" style={{ padding: '5px' }} />
          {editFormData.logo_url && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>✓ Logo cargado</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label className="crm-stat-label">Tecnología E-commerce</label>
          <select name="tecnologia" value={editFormData.tecnologia || ''} onChange={onInputChange} className="crm-select-dropdown">
            <option value="">Selecciona tecnología</option>
            <option value="Shopify">Shopify</option>
            <option value="Woocommerce">WooCommerce</option>
            <option value="Vtex">VTEX</option>
            <option value="Magento">Magento</option>
            <option value="Custom">Custom / Propio</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: '#f9f9f6', border: '1px solid #ccc', borderRadius: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" checked={!!editFormData.has_cooppilot} onChange={(e) => setEditFormData(prev => ({ ...prev, has_cooppilot: e.target.checked }))} style={{ width: '18px', height: '18px', cursor: 'pointer' }}/>
            <label className="crm-stat-label" style={{ cursor: 'pointer', margin: 0, fontWeight: 'bold' }}>🚀 Habilitar Módulo CoopPilot</label>
          </div>
        </div>

        <div className="crm-pagination-box" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
          <button type="submit" className="crm-btn-black">Guardar Cambios</button>
          <button type="button" onClick={() => onClose()} className="crm-btn-red">Cancelar</button>
        </div>

      </form>
    </div>
  </div>
);

export default ClientEditModal;
