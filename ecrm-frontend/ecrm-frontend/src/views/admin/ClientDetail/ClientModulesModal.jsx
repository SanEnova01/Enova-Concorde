import React from 'react';
import { MODULES, planDefaultEnabled } from './clientModules';

// MODAL: MÓDULOS VISIBLES PARA ESTE CLIENTE
const ClientModulesModal = ({ client, planKey, draftModules, setDraftModules, onSave, onReset, onClose }) => (
    <div className="crm-modal-mask" onClick={() => onClose()}>
      <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
        <h3 className="crm-section-title" style={{ marginTop: 0 }}>Módulos de {client.name}</h3>
        <p className="crm-text-muted" style={{ marginTop: 0, fontSize: '13px' }}>
          Plan <strong>{planKey || '—'}</strong>. Las casillas parten de lo que el plan incluye; lo que cambies aquí solo aplica a este cliente.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '14px 0' }}>
          {MODULES.filter(m => m.configurable).map(m => {
            const byPlan = planDefaultEnabled(planKey, m.id);
            const changed = draftModules[m.id] !== byPlan;
            return (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: `1px solid ${changed ? '#f59e0b' : '#e5e7eb'}`, borderRadius: '6px', cursor: 'pointer', backgroundColor: changed ? '#fffbeb' : '#ffffff' }}>
                <input
                  type="checkbox"
                  checked={!!draftModules[m.id]}
                  onChange={(e) => setDraftModules(prev => ({ ...prev, [m.id]: e.target.checked }))}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ flex: 1, fontSize: '13px', fontWeight: '600' }}>{m.label}</span>
                <span style={{ fontSize: '10px', color: '#6b7280' }}>
                  {changed ? (byPlan ? 'Quitado del plan' : 'Añadido al plan') : (byPlan ? 'Incluido en el plan' : 'No incluido en el plan')}
                </span>
              </label>
            );
          })}
        </div>

        <div className="crm-pagination-box" style={{ justifyContent: 'space-between' }}>
          <button type="button" onClick={onSave} className="crm-btn-black">Guardar</button>
          <button type="button" onClick={onReset} className="crm-btn-border">Restablecer al plan</button>
          <button type="button" onClick={() => onClose()} className="crm-btn-red">Cancelar</button>
        </div>
      </div>
    </div>
);

export default ClientModulesModal;
