import React from 'react';
import { statuses } from './ticketConstants';

// VISTA 2: KANBAN
const TicketsKanbanView = ({
  tickets, statusTab, kanbanPages, setKanbanPages, handleDrop, handleDragStart, handleSingleFieldChange, navigate
}) => (
  <div className="crm-kanban-grid" style={{ marginTop: '16px' }}>
    {(statusTab === 'CLOSED' ? ['CLOSED'] : ['OPEN', 'IN_PROGRESS', 'RESOLVED']).map(status => {
      const statusTickets = tickets.filter(t => t.status === status);
      const currentPage = kanbanPages[status] || 1;
      const itemsPerPage = 6;
      const totalPages = Math.ceil(statusTickets.length / itemsPerPage) || 1;

      const indexOfLast = currentPage * itemsPerPage;
      const indexOfFirst = indexOfLast - itemsPerPage;
      const currentKanbanTickets = statusTickets.slice(indexOfFirst, indexOfLast);

      return (
        <div key={status} className="crm-kanban-column" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, status)}>
          <div className="crm-kanban-column-title-box">
            <span>{status}</span>
            <span className="crm-badge">{statusTickets.length}</span>
          </div>

          <div style={{ minHeight: '380px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentKanbanTickets.length === 0 ? (
              <p className="crm-text-muted" style={{ textAlign: 'center', padding: '20px 0', fontSize: '12px' }}>Sin tickets</p>
            ) : (
              currentKanbanTickets.map(t => (
                <div 
                  key={t.id} 
                  className="crm-ticket-card" 
                  draggable 
                  onDragStart={(e) => handleDragStart(e, t.id)} 
                  onClick={() => navigate(`/admin/tickets/${t.id}`)}
                  title={t.description ? t.description.substring(0, 300) + (t.description.length > 300 ? '...' : '') : 'Sin descripción'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#666666' }}>{t.serial_number || t.id}</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {(() => {
                        const match = t.description?.match(/\[GMAIL_ID:\s*([a-zA-Z0-9]+)\]/);
                        if (match && match[1]) {
                          return (
                            <a
                              href={`https://mail.google.com/mail/u/1/#all/${match[1]}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontSize: '10px', backgroundColor: '#ea4335', color: '#fff', padding: '2px 4px', borderRadius: '4px', textDecoration: 'none' }}
                            >
                              ✉️
                            </a>
                          );
                        }
                        return null;
                      })()}
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: t.priority === 'HIGH' || t.priority === 'CRITICAL' ? '#dc2626' : '#111111' }}>{t.priority}</span>
                    </div>
                  </div>
                  <h4 style={{ margin: '6px 0', fontSize: '14px', fontWeight: 'normal' }}>{t.name}</h4>
                  <p style={{ margin: 0, fontSize: '11px', color: '#666666' }}>{t.task_type} {t.assigned_to && `| Resp: ${t.assigned_to}`}</p>

                  <div style={{ display: 'flex', gap: '4px', marginTop: '12px' }} onClick={e => e.stopPropagation()}>
                    {status !== 'OPEN' && <button onClick={() => handleSingleFieldChange(t.id, 'status', statuses[statuses.indexOf(status) - 1])} className="crm-btn-border" style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}>Ant</button>}
                    {status !== 'CLOSED' && <button onClick={() => handleSingleFieldChange(t.id, 'status', statuses[statuses.indexOf(status) + 1])} className="crm-btn-black" style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}>Sig</button>}
                  </div>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
              <button 
                disabled={currentPage === 1}
                onClick={() => setKanbanPages(prev => ({ ...prev, [status]: currentPage - 1 }))}
                className="crm-btn-border"
                style={{ padding: '2px 8px', fontSize: '10px' }}
              >
                Anterior
              </button>
              <span style={{ fontSize: '10px', fontWeight: 'bold' }}>{currentPage} / {totalPages}</span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setKanbanPages(prev => ({ ...prev, [status]: currentPage + 1 }))}
                className="crm-btn-border"
                style={{ padding: '2px 8px', fontSize: '10px' }}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export default TicketsKanbanView;
