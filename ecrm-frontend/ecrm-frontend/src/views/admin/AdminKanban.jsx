import React from 'react';

function AdminKanban({ tickets = [], onTicketMoved }) {
  const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

  return (
    <div style={styles.container}>
      <div style={styles.board}>
        {statuses.map(status => {
          const filteredTickets = tickets.filter(t => t.status === status);
          return (
            <div key={status} style={styles.column}>
              <div style={styles.columnHeader}>
                <span style={styles.columnTitle}>{status}</span>
                <span style={styles.badge}>{filteredTickets.length}</span>
              </div>
              <div style={styles.cardContainer}>
                {filteredTickets.length === 0 ? (
                  <div style={styles.emptyState}>Sin tickets</div>
                ) : (
                  filteredTickets.map(ticket => (
                    <div key={ticket.id} style={styles.card}>
                      <div style={styles.cardHeader}>
                        <span style={styles.serial}>{ticket.serial_number}</span>
                        <span style={{ ...styles.priority, ...(styles[ticket.priority] || styles.MEDIUM) }}>
                          {ticket.priority}
                        </span>
                      </div>
                      <h3 style={styles.cardName}>{ticket.name}</h3>
                      {ticket.description && (
                        <p style={styles.cardDesc}>{ticket.description}</p>
                      )}
                      <div style={styles.cardFooter}>
                        <span style={styles.store}>Tienda: {ticket.store_id}</span>
                      </div>
                      <div style={styles.actions}>
                        {status !== 'OPEN' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onTicketMoved(ticket.id, statuses[statuses.indexOf(status) - 1]); }}
                            style={styles.actionButton}
                          >
                            Anterior
                          </button>
                        )}
                        {status !== 'CLOSED' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onTicketMoved(ticket.id, statuses[statuses.indexOf(status) + 1]); }}
                            style={{ ...styles.actionButton, ...styles.nextButton }}
                          >
                            Avanzar
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  centered: { textAlign: 'center', padding: '20px', color: '#666' },
  container: { width: '100%', overflowX: 'auto' },
  board: { display: 'flex', gap: '16px', paddingBottom: '16px', minWidth: '1000px' },
  column: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '16px', minWidth: '280px' },
  columnHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '2px solid #111', paddingBottom: '8px' },
  columnTitle: { fontWeight: '900', color: '#111' },
  badge: { backgroundColor: '#111', color: '#FFD700', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' },
  cardContainer: { display: 'flex', flexDirection: 'column', gap: '12px' },
  emptyState: { textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '20px' },
  card: { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '16px', boxShadow: '2px 2px 0px rgba(0,0,0,0.1)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  serial: { fontSize: '11px', color: '#6b7280', fontWeight: 'bold' },
  priority: { fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' },
  HIGH: { backgroundColor: '#fee2e2', color: '#ef4444' },
  CRITICAL: { backgroundColor: '#fee2e2', color: '#ef4444' },
  MEDIUM: { backgroundColor: '#e0e7ff', color: '#3730a3' },
  LOW: { backgroundColor: '#f3f4f6', color: '#4b5563' },
  cardName: { fontSize: '14px', margin: '0 0 8px 0', color: '#111' },
  cardDesc: { fontSize: '12px', color: '#6b7280', margin: '0 0 8px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardFooter: { fontSize: '11px', color: '#4b5563', marginBottom: '12px' },
  store: {},
  actions: { display: 'flex', justifyContent: 'space-between' },
  actionButton: { fontSize: '11px', padding: '4px 8px', cursor: 'pointer', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#fff' },
  nextButton: { border: 'none', backgroundColor: '#111', color: '#FFD700', marginLeft: 'auto' }
};

export default AdminKanban;