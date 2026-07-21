import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function TotalTickets() {
  const navigate = useNavigate();
  
  // 1. PRIMERO LOS ESTADOS
  const [tickets, setTickets] = useState([]);
  const [stores, setStores] = useState([]);
  const [viewMode, setViewMode] = useState('KANBAN'); 
  const [selectedDayTickets, setSelectedDayTickets] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // 2. LUEGO EL FILTRO DE PESTAÑAS
  const [ticketView, setTicketView] = useState('B2B');
  const filteredTickets = tickets.filter(t => ticketView === 'B2B' ? !t.is_b2c : t.is_b2c);

  // Estado del formulario
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    store_id: '', 
    priority: 'MEDIUM', 
    task_type: 'CONSULTA',
    assigned_to: ''
  });

  const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  const monthsNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const currentYear = calendarDate.getFullYear();
  const currentMonth = calendarDate.getMonth();

  const fetchData = async () => {
    try {
      const [ticketsRes, storesRes] = await Promise.all([crmApi.get('/tickets'), crmApi.get('/stores')]);
      
      // Extracción segura (fallback para evitar arreglos vacíos)
      if (ticketsRes.data) {
        setTickets(Array.isArray(ticketsRes.data) ? ticketsRes.data : (ticketsRes.data.data || []));
      }
      
      if (storesRes.data) {
        const parsedStores = Array.isArray(storesRes.data) ? storesRes.data : (storesRes.data.data || []);
        setStores(parsedStores);
        if (parsedStores.length > 0) {
          setFormData(prev => ({ ...prev, store_id: parsedStores[0].id }));
        }
      }
      setLoading(false);
    } catch (error) { 
      console.error(error); 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      const response = await crmApi.patch(`/tickets/${ticketId}/status`, { status: newStatus });
      if (response.data.success || response.status === 200) {
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
        if (selectedDayTickets) {
          setSelectedDayTickets(prev => ({ ...prev, list: prev.list.map(t => t.id === ticketId ? { ...t, status: newStatus } : t) }));
        }
      }
    } catch (error) { console.error(error); }
  };

  const handleDragStart = (e, ticketId) => { e.dataTransfer.setData('text/plain', ticketId); };
  
  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('text/plain');
    if (ticketId) handleStatusChange(ticketId, newStatus);
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!formData.store_id) {
      alert("Selecciona una tienda válida.");
      return;
    }

    try {
      const response = await crmApi.post('/tickets', formData);
      if (response.data.success || response.status === 201) {
        alert('Ticket creado exitosamente');
        setShowCreateModal(false);
        // Reseteo del formulario
        setFormData(prev => ({ 
          ...prev, 
          name: '', 
          description: '', 
          priority: 'MEDIUM', 
          task_type: 'CONSULTA',
          assigned_to: ''
        }));
        fetchData();
      }
    } catch (error) { 
      console.error(error); 
      alert("Error al registrar el ticket.");
    }
  };

  const renderCalendarCells = () => {
    const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startOffset = new Date(currentYear, currentMonth, 1).getDay();
    const cells = [];

    for (let i = 0; i < startOffset; i++) cells.push(<div key={`empty-${i}`} style={{ backgroundColor: 'transparent' }}></div>);

    for (let day = 1; day <= daysCount; day++) {
      const dayString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const matching = tickets.filter(t => t.created_at && t.created_at.startsWith(dayString));
      
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

  if (loading) return <div className="crm-text-loading">Cargando operaciones...</div>;

  return (
    <div>
      <div className="crm-actions-bar">
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Gestión de Tickets</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setShowCreateModal(true)} className="crm-btn-black">Nuevo Ticket</button>
          <button onClick={() => setViewMode(viewMode === 'KANBAN' ? 'CALENDAR' : 'KANBAN')} className="crm-btn-border">Alternar Vista</button>
        </div>
      </div>

      {viewMode === 'KANBAN' ? (
        <div className="crm-kanban-grid">
          {statuses.map(status => {
            const filtered = tickets.filter(t => t.status === status);
            return (
              <div key={status} className="crm-kanban-column" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, status)}>
                <div className="crm-kanban-column-title-box">
                  <span>{status}</span>
                  <span className="crm-badge">{filtered.length}</span>
                </div>
                {filtered.map(t => (
                  <div key={t.id} className="crm-ticket-card" draggable onDragStart={(e) => handleDragStart(e, t.id)} onClick={() => navigate(`/admin/tickets/${t.id}`)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#666666' }}>{t.serial_number}</span>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#111111' }}>{t.priority}</span>
                    </div>
                    <h4 style={{ margin: '6px 0', fontSize: '14px', fontWeight: 'normal' }}>{t.name}</h4>
                    <p style={{ margin: 0, fontSize: '11px', color: '#666666' }}>{t.task_type} {t.assigned_to && `| Resp: ${t.assigned_to}`}</p>
                    
                    <div style={{ display: 'flex', gap: '4px', marginTop: '12px' }} onClick={e => e.stopPropagation()}>
                      {status !== 'OPEN' && <button onClick={() => handleStatusChange(t.id, statuses[statuses.indexOf(status) - 1])} className="crm-btn-border" style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}>Ant</button>}
                      {status !== 'CLOSED' && <button onClick={() => handleStatusChange(t.id, statuses[statuses.indexOf(status) + 1])} className="crm-btn-black" style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }}>Sig</button>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="crm-card-paper">
          <div className="crm-calendar-nav">
            <button onClick={() => setCalendarDate(new Date(currentYear, currentMonth - 1, 1))} className="crm-btn-border">Anterior</button>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'normal' }}>{monthsNames[currentMonth]} {currentYear}</h2>
            <button onClick={() => setCalendarDate(new Date(currentYear, currentMonth + 1, 1))} className="crm-btn-border">Siguiente</button>
          </div>
          <div className="crm-calendar-grid">{renderCalendarCells()}</div>
        </div>
      )}

      {/* MODAL PARA CREAR TICKET - CAMPOS DE LA BD */}
      {showCreateModal && (
        <div className="crm-modal-mask" onClick={() => setShowCreateModal(false)}>
          <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="crm-section-title" style={{ marginTop: 0 }}>Apertura de Soporte</h3>
            
            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Asunto / Nombre del Ticket</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="crm-input-text" required style={{ width: 'auto' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Tienda / Cliente</label>
                  <select value={formData.store_id} onChange={e => setFormData({...formData, store_id: e.target.value})} className="crm-select-dropdown" required>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Responsable (Opcional)</label>
                  <input type="text" value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})} className="crm-input-text" placeholder="Ej: Juan Pérez" style={{ width: 'auto' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Nivel de Prioridad</label>
                  <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="crm-select-dropdown">
                    <option value="LOW">BAJA</option>
                    <option value="MEDIUM">MEDIA</option>
                    <option value="HIGH">ALTA</option>
                    <option value="CRITICAL">CRÍTICA</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
  <label className="crm-stat-label">Tipo de Tarea</label>
  <select value={formData.task_type} onChange={e => setFormData({...formData, task_type: e.target.value})} className="crm-select-dropdown">
    {/* El 'value' es lo que va a la BD, el texto en mayúsculas es lo que lee el usuario */}
    <option value="CONSULTA">CONSULTA</option>
    <option value="CAMBIO">CAMBIO</option>
    <option value="BUG_FIX">BUG FIX</option>
    <option value="TASK_INTERNA">TAREA INTERNA</option>
  </select>
</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Descripción Detallada</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="crm-input-text" style={{ height: '70px', resize: 'none', width: 'auto' }} />
              </div>

              <div className="crm-pagination-box" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
                <button type="submit" className="crm-btn-black">Guardar Ticket</button>
                <button type="button" onClick={() => setShowCreateModal(false)} className="crm-btn-red">Cancelar</button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Lista del Día del Calendario */}
      {selectedDayTickets && (
        <div className="crm-modal-mask" onClick={() => setSelectedDayTickets(null)}>
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

export default TotalTickets;