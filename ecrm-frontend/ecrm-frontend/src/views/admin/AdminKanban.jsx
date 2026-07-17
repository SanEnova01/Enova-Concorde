import React, { useState, useEffect } from 'react';
import crmApi from '../../api/crmApi';

function AdminKanban() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await crmApi.get('/tickets');
      if (response.data && response.data.success) {
        setTickets(response.data.data);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los tickets del servidor.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      const response = await crmApi.patch(`/tickets/${ticketId}/status`, { status: newStatus });
      if (response.data && response.data.success) {
        setTickets(prevTickets =>
          prevTickets.map(t => (t.id === ticketId ? { ...t, status: newStatus } : t))
        );
      }
    } catch (err) {
      console.error(err);
      alert('Error al actualizar el estado del ticket.');
    }
  };

  if (loading) return <div style={styles.centered}>Cargando tablero...</div>;
  if (error) return <div style={{ ...styles.centered, color: '#ef4444' }}>{error}</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Tablero Kanban de Soporte</h1>
        <button onClick={fetchTickets} style={styles.refreshButton}>Actualizar</button>
      </div>

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
                        <span style={{ ...styles.priority, ...styles[ticket.priority] }}>
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
                            onClick={() => handleStatusChange(ticket.id, statuses[statuses.indexOf(status) - 1])}
                            style={styles.actionButton}
                          >
                            Anterior
                          </button>
                        )}
                        {status !== 'CLOSED' && (
                          <button 
                            onClick={() => handleStatusChange(ticket.id, statuses[statuses.indexOf(status) + 1])}
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



export default AdminKanban;