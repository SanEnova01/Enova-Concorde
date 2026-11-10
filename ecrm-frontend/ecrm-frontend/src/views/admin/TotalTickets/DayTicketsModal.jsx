import React from 'react';

// MODAL CALENDARIO DIA
const DayTicketsModal = ({ selectedDayTickets, onClose, navigate }) => (
  <div className="crm-modal-mask" onClick={() => onClose()}>
    <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
      <h3 className="crm-section-title" style={{ marginTop: 0 }}>Tickets del {selectedDayTickets.dateLabel}</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {selectedDayTickets.list.length === 0 ? (
          <p className="crm-text-loading">No hay operaciones registradas este día.</p>
        ) : (
          selectedDayTickets.list.map(t => (
            <div 
              key={t.id} 
              className="crm-card-paper-clickable"
              style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', cursor: 'pointer' }} 
              onClick={() => { onClose(); navigate(`/admin/tickets/${t.id}`); }}
            >
              <span>{t.serial_number || t.id} - {t.name}</span>
              <span className="crm-badge">{t.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
);

export default DayTicketsModal;
