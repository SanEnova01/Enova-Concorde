import React from 'react';
import SmallAnalogOdometer from './SmallAnalogOdometer';

const ClientContactCard = ({ client, tickets }) => (
  <div className="crm-card-paper" style={{ margin: 0, flex: 1, boxSizing: 'border-box' }}>
    <h3 className="crm-section-title" style={{ marginTop: 0, marginBottom: '16px', borderBottom: '1px dotted #ccc', paddingBottom: '8px' }}>Datos de Contacto</h3>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontWeight: '800', color: '#111', minWidth: '95px', fontSize: '13px' }}>SITIO WEB:</span>
        {client.web ? <a href={client.web} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px' }}>{client.web}</a> : <span className="crm-text-muted" style={{ fontSize: '13px' }}>No registrado</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontWeight: '800', color: '#111', minWidth: '95px', fontSize: '13px' }}>TECNOLOGÍA:</span>
        <span style={{ backgroundColor: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', color: '#374151' }}>
          {client.tecnologia || 'No registrada'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontWeight: '800', color: '#111', minWidth: '95px', fontSize: '13px' }}>CORREOS:</span>
        <span style={{ color: '#4b5563', fontSize: '13px', lineHeight: '1.4' }}>{client.emails ? client.emails.split(',').join(', ') : 'No registrados'}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontWeight: '800', color: '#111', minWidth: '95px', fontSize: '13px' }}>TELÉFONO:</span>
        <span style={{ color: '#4b5563', fontSize: '13px' }}>{client.phone || 'No registrado'}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
        <span style={{ fontWeight: '800', color: '#111', minWidth: '95px', fontSize: '13px' }}>TICKETS:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SmallAnalogOdometer value={tickets.length} digits={4} />
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'bold' }}>CREADOS</span>
        </div>
      </div>

      {client.has_cooppilot && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
          <span style={{ fontWeight: '800', color: '#111', minWidth: '95px', fontSize: '13px' }}>COOPPILOT:</span>
          <a href={`/cooppilot/${client.id}`} target="_blank" rel="noreferrer" style={{ backgroundColor: '#111', color: '#FFD700', padding: '4px 10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', textDecoration: 'none' }}>✨ ACTIVO ↗</a>
        </div>
      )}
    </div>
  </div>
);

export default ClientContactCard;
