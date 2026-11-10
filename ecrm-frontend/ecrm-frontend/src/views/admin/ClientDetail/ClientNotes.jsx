import React from 'react';

const ClientNotes = ({ client, isEditingNotes, setIsEditingNotes, notesText, setNotesText, onSave }) => (
  <div className="crm-card-paper" style={{ width: '100%', boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
      <h3 className="crm-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Notas Internas</h3>
      {!isEditingNotes ? (
        <button onClick={() => setIsEditingNotes(true)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>Editar</button>
      ) : (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onSave} className="crm-btn-black" style={{ padding: '4px 10px', fontSize: '12px' }}>Guardar</button>
          <button onClick={() => { setIsEditingNotes(false); setNotesText(client.notes || ''); }} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>Cancelar</button>
        </div>
      )}
    </div>
    {isEditingNotes ? (
      <textarea value={notesText} onChange={(e) => setNotesText(e.target.value)} className="crm-input-text" style={{ width: '100%', height: '100px', boxSizing: 'border-box', resize: 'none' }} />
    ) : (
      <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{client.notes || 'Sin anotaciones particulares sobre este cliente.'}</p>
    )}
  </div>
);

export default ClientNotes;
