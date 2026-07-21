import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function ClientTickets({ tickets }) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [ticketCurrentPage, setTicketCurrentPage] = useState(1);
  const itemsPerPage = isExpanded ? 10 : 5; // Muestra más si está expandido

  const indexOfLastTicket = ticketCurrentPage * itemsPerPage;
  const indexOfFirstTicket = indexOfLastTicket - itemsPerPage;
  const currentTickets = tickets.slice(indexOfFirstTicket, indexOfLastTicket);
  const totalTicketPages = Math.ceil(tickets.length / itemsPerPage) || 1;

  const renderContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 className="crm-section-title" style={{ margin: 0 }}>Tickets de Soporte Técnico</h2>
        {!isExpanded && (
          <button onClick={() => setIsExpanded(true)} className="crm-btn-border" style={{ fontSize: '11px', padding: '4px 8px' }}>
            ↗ Ampliar
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1, overflowY: 'auto' }}>
        {currentTickets.length === 0 ? (
          <p className="crm-text-muted">No cuenta con registros de soporte abiertos actualmente.</p>
        ) : (
          currentTickets.map(ticket => (
            <div 
              key={ticket.id} 
              onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
              className="crm-table-row-interactive"
              style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', border: '1px solid #cccccc', backgroundColor: '#fcfbfa', cursor: 'pointer' }}
            >
              <div>
                <span style={{ fontSize: '11px', color: '#555555', fontWeight: 'bold' }}>{ticket.serial_number}</span>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: 'normal' }}>{ticket.name}</h4>
              </div>
              <div>
                <span className="crm-badge">{ticket.status}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {totalTicketPages > 1 && (
        <div className="crm-pagination-box" style={{ marginTop: '16px' }}>
          <button disabled={ticketCurrentPage === 1} onClick={() => setTicketCurrentPage(prev => prev - 1)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>Anterior</button>
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{ticketCurrentPage} / {totalTicketPages}</span>
          <button disabled={ticketCurrentPage === totalTicketPages} onClick={() => setTicketCurrentPage(prev => prev + 1)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>Siguiente</button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="crm-card-paper">
        {renderContent()}
      </div>

      {isExpanded && (
        <div className="crm-modal-mask" onClick={() => setIsExpanded(false)} style={{ zIndex: 9999 }}>
          <div 
            className="crm-modal-content" 
            onClick={e => e.stopPropagation()}
            style={{ width: '90vw', height: '80vh', maxWidth: '800px', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <button onClick={() => setIsExpanded(false)} className="crm-btn-red" style={{ padding: '6px 12px' }}>Cerrar ✕</button>
            </div>
            {renderContent()}
          </div>
        </div>
      )}
    </>
  );
}

export default ClientTickets;