import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';
import AdminKanban from '../admin/AdminKanban';

function ClientTickets() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);
  const [tickets, setTickets] = useState([]);
  
  const [viewMode, setViewMode] = useState('KANBAN'); // KANBAN, LIST, CALENDAR
  const [ticketView, setTicketView] = useState('B2B'); // B2B, B2C
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDayTickets, setSelectedDayTickets] = useState(null);

  const monthsNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const currentYear = calendarDate.getFullYear();
  const currentMonth = calendarDate.getMonth();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [storeRes, ticketsRes] = await Promise.all([
          crmApi.get('/stores/cuentacliente'),
          crmApi.get('/tickets')
        ]);

        const currentStore = storeRes.data?.data || storeRes.data;
        setStore(currentStore);

        const allTickets = Array.isArray(ticketsRes.data) ? ticketsRes.data : (ticketsRes.data?.data || []);
        const storeTickets = allTickets.filter(t => t.store_id === currentStore.id);
        setTickets(storeTickets);
      } catch (error) {
        console.error("Error cargando tickets de tienda:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredTickets = tickets.filter(t => ticketView === 'B2B' ? !t.is_b2c : t.is_b2c);

  const renderCalendarCells = () => {
    const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startOffset = new Date(currentYear, currentMonth, 1).getDay();
    const cells = [];

    for (let i = 0; i < startOffset; i++) cells.push(<div key={`empty-${i}`} style={{ backgroundColor: 'transparent' }}></div>);

    for (let day = 1; day <= daysCount; day++) {
      const dayString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const matching = filteredTickets.filter(t => t.created_at && t.created_at.startsWith(dayString));
      
      cells.push(
        <div key={day} className="crm-calendar-cell" onClick={() => setSelectedDayTickets({ dateLabel: `${day} de ${monthsNames[currentMonth]}`, list: matching })}>
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{day}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: '60px' }}>
            {matching.map(t => (
              <div 
                key={t.id} 
                onClick={(e) => { e.stopPropagation(); navigate(`/admin/tickets/${t.id}`); }}
                style={{ backgroundColor: '#111111', color: '#ffffff', fontSize: '10px', padding: '2px 4px', borderRadius: '2px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {t.serial_number}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return cells;
  };

  if (loading) return <div className="crm-text-loading">Cargando tablero de tickets...</div>;

  return (
    <div>
      <div className="crm-actions-bar" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>
            Tablero de Tickets - {store?.name || 'Mi Tienda'}
          </h1>
          <span style={{ fontSize: '11px', backgroundColor: '#e5e7eb', color: '#374151', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
            🔒 Modo Lectura
          </span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-end', borderBottom: '2px solid #e5e7eb', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
          {/* TABS */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setTicketView('B2B')} 
              style={{ 
                padding: '10px 20px', 
                backgroundColor: ticketView === 'B2B' ? '#111' : '#f3f4f6', 
                color: ticketView === 'B2B' ? '#FFD700' : '#4b5563', 
                border: '2px solid #111', 
                borderRadius: '6px 6px 0 0', 
                fontWeight: '900', 
                cursor: 'pointer', 
                borderBottom: ticketView === 'B2B' ? 'none' : '2px solid #111', 
                marginBottom: '-18px' 
              }}
            >
              🏢 Soporte Técnico (B2B)
            </button>

            {/* TAB B2C: SOLO VISIBLE SI TIENE COOPPILOT ACTIVO */}
            {store?.has_cooppilot && (
              <button 
                onClick={() => setTicketView('B2C')} 
                style={{ 
                  padding: '10px 20px', 
                  backgroundColor: ticketView === 'B2C' ? '#111' : '#f3f4f6', 
                  color: ticketView === 'B2C' ? '#FFD700' : '#4b5563', 
                  border: '2px solid #111', 
                  borderRadius: '6px 6px 0 0', 
                  fontWeight: '900', 
                  cursor: 'pointer', 
                  borderBottom: ticketView === 'B2C' ? 'none' : '2px solid #111', 
                  marginBottom: '-18px' 
                }}
              >
                🛒 Atención a Clientes (B2C)
              </button>
            )}
          </div>

          {/* SELECTORES DE VISTA */}
          <div style={{ display: 'flex', gap: '8px', backgroundColor: '#f3f4f6', padding: '4px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
            <button onClick={() => setViewMode('KANBAN')} style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'KANBAN' ? '#fff' : 'transparent', boxShadow: viewMode === 'KANBAN' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Kanban</button>
            <button onClick={() => setViewMode('LIST')} style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'LIST' ? '#fff' : 'transparent', boxShadow: viewMode === 'LIST' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Lista</button>
            <button onClick={() => setViewMode('CALENDAR')} style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'CALENDAR' ? '#fff' : 'transparent', boxShadow: viewMode === 'CALENDAR' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Calendario</button>
          </div>
        </div>
      </div>

      {/* VISTA 1: KANBAN (SOLO LECTURA) */}
      {viewMode === 'KANBAN' && (
        <AdminKanban tickets={filteredTickets} readOnly={true} />
      )}

      {/* VISTA 2: LISTA */}
      {viewMode === 'LIST' && (
        <div style={{ overflowX: 'auto', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>ID</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>Asunto</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>Estado</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>Prioridad</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>No hay tickets registrados en esta vista.</td></tr>
              ) : (
                filteredTickets.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={() => navigate(`/admin/tickets/${t.id}`)} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 'bold', color: '#111' }}>{t.serial_number}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{t.name}</td>
                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '12px', backgroundColor: t.status === 'CLOSED' ? '#d1fae5' : '#fef3c7', color: t.status === 'CLOSED' ? '#059669' : '#d97706', fontWeight: 'bold' }}>{t.status}</span></td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 'bold', color: t.priority === 'HIGH' ? '#ef4444' : '#4b5563' }}>{t.priority}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VISTA 3: CALENDARIO */}
      {viewMode === 'CALENDAR' && (
        <div className="crm-card-paper">
          <div className="crm-calendar-nav">
            <button onClick={() => setCalendarDate(new Date(currentYear, currentMonth - 1, 1))} className="crm-btn-border">Anterior</button>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'normal' }}>{monthsNames[currentMonth]} {currentYear}</h2>
            <button onClick={() => setCalendarDate(new Date(currentYear, currentMonth + 1, 1))} className="crm-btn-border">Siguiente</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontWeight: 'bold', marginBottom: '10px', fontSize: '12px', color: '#666' }}>
            <div>Dom</div><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div>
          </div>
          <div className="crm-calendar-grid">{renderCalendarCells()}</div>
        </div>
      )}

      {/* MODAL DETALLE DE DÍA DEL CALENDARIO */}
      {selectedDayTickets && (
        <div className="crm-modal-mask" onClick={() => setSelectedDayTickets(null)}>
          <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="crm-section-title" style={{ marginTop: 0 }}>Tickets del {selectedDayTickets.dateLabel}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedDayTickets.list.length === 0 ? (
                <p className="crm-text-loading">No hay tickets registrados este día.</p>
              ) : (
                selectedDayTickets.list.map(t => (
                  <div 
                    key={t.id} 
                    className="crm-card-paper-clickable"
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', cursor: 'pointer' }} 
                    onClick={() => { setSelectedDayTickets(null); navigate(`/admin/tickets/${t.id}`); }}
                  >
                    <span>{t.serial_number} - {t.name}</span>
                    <span className="crm-badge">{t.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientTickets;