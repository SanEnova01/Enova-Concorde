import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function TotalTickets() {
  const navigate = useNavigate();
  
  // 1. ESTADOS
  const [tickets, setTickets] = useState([]);
  const [stores, setStores] = useState([]);
  // 👈 1. VISTA POR DEFECTO: LISTA
  const [viewMode, setViewMode] = useState('LIST'); 
  const [selectedDayTickets, setSelectedDayTickets] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // ESTADO PARA SELECCIÓN MASIVA EN MODO LISTA
  const [selectedIds, setSelectedIds] = useState([]);

  // ESTADO PARA PAGINACIÓN KANBAN (6 en 6 por columna)
  const [kanbanPages, setKanbanPages] = useState({
    OPEN: 1,
    IN_PROGRESS: 1,
    RESOLVED: 1,
    CLOSED: 1
  });

  // 2. FILTRO DE PESTAÑAS (B2B / B2C)
  const [ticketView, setTicketView] = useState('B2B');
  const filteredTickets = tickets.filter(t => ticketView === 'B2B' ? !t.is_b2c : t.is_b2c);

  // Formulario de nuevo ticket
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    store_id: '', 
    priority: 'MEDIUM', 
    task_type: 'CONSULTA',
    assigned_to: ''
  });

  const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const taskTypes = ['CONSULTA', 'CAMBIO', 'BUG_FIX', 'TASK_INTERNA'];
  const monthsNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const currentYear = calendarDate.getFullYear();
  const currentMonth = calendarDate.getMonth();

  const fetchData = async () => {
    try {
      const [ticketsRes, storesRes] = await Promise.all([crmApi.get('/tickets'), crmApi.get('/stores')]);
      
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

  // Limpiar seleccionados al cambiar de pestaña B2B / B2C
  useEffect(() => {
    setSelectedIds([]);
  }, [ticketView]);

  // ==========================================
  // EDICIÓN INDIVIDUAL EN LISTADO
  // ==========================================
  const handleSingleFieldChange = async (ticketId, field, value) => {
    try {
      if (field === 'status') {
        await crmApi.patch(`/tickets/${ticketId}/status`, { status: value });
      } else {
        await crmApi.patch(`/tickets/${ticketId}`, { [field]: value });
      }
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, [field]: value } : t));
    } catch (error) {
      console.error(`Error actualizando ${field}:`, error);
      // Fallback local
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, [field]: value } : t));
    }
  };

  // ==========================================
  // SELECCIÓN Y EDICIÓN MASIVA
  // ==========================================
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredTickets.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (e, ticketId) => {
    e.stopPropagation();
    if (selectedIds.includes(ticketId)) {
      setSelectedIds(selectedIds.filter(id => id !== ticketId));
    } else {
      setSelectedIds([...selectedIds, ticketId]);
    }
  };

  const handleBulkUpdate = async (field, value) => {
    if (!value || selectedIds.length === 0) return;
    try {
      await Promise.all(
        selectedIds.map(id => {
          if (field === 'status') {
            return crmApi.patch(`/tickets/${id}/status`, { status: value });
          }
          return crmApi.patch(`/tickets/${id}`, { [field]: value });
        })
      );
      setTickets(prev => prev.map(t => selectedIds.includes(t.id) ? { ...t, [field]: value } : t));
      setSelectedIds([]);
      alert(`Se actualizó ${field} en ${selectedIds.length} tickets seleccionados.`);
    } catch (error) {
      console.error('Error en actualización masiva:', error);
      setTickets(prev => prev.map(t => selectedIds.includes(t.id) ? { ...t, [field]: value } : t));
      setSelectedIds([]);
    }
  };

  // Drag and Drop Kanban
  const handleDragStart = (e, ticketId) => { e.dataTransfer.setData('text/plain', ticketId); };
  
  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('text/plain');
    if (ticketId) handleSingleFieldChange(ticketId, 'status', newStatus);
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

  if (loading) return <div className="crm-text-loading">Cargando operaciones...</div>;

  return (
    <div>
      {/* =========================================
          CABECERA Y CONTROLES
          ========================================= */}
      <div className="crm-actions-bar" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Gestión de Tickets</h1>
          <button onClick={() => setShowCreateModal(true)} className="crm-btn-black">Nuevo Ticket</button>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-end', borderBottom: '2px solid #e5e7eb', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* PESTAÑAS (TABS B2B / B2C) */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setTicketView('B2B')} style={{ padding: '10px 20px', backgroundColor: ticketView === 'B2B' ? '#111' : '#f3f4f6', color: ticketView === 'B2B' ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px 6px 0 0', fontWeight: '900', cursor: 'pointer', borderBottom: ticketView === 'B2B' ? 'none' : '2px solid #111', marginBottom: '-18px' }}>
              🏢 Agencia (Interno)
            </button>
            <button onClick={() => setTicketView('B2C')} style={{ padding: '10px 20px', backgroundColor: ticketView === 'B2C' ? '#111' : '#f3f4f6', color: ticketView === 'B2C' ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px 6px 0 0', fontWeight: '900', cursor: 'pointer', borderBottom: ticketView === 'B2C' ? 'none' : '2px solid #111', marginBottom: '-18px' }}>
              🛒 Clientes (Hub)
            </button>
          </div>

          {/* SELECTORES DE VISTA (LISTA ES LA PRIMERA OPCIÓN) */}
          <div style={{ display: 'flex', gap: '8px', backgroundColor: '#f3f4f6', padding: '4px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
            <button onClick={() => setViewMode('LIST')} style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'LIST' ? '#111' : 'transparent', color: viewMode === 'LIST' ? '#FFD700' : '#4b5563', boxShadow: viewMode === 'LIST' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Lista</button>
            <button onClick={() => setViewMode('KANBAN')} style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'KANBAN' ? '#111' : 'transparent', color: viewMode === 'KANBAN' ? '#FFD700' : '#4b5563', boxShadow: viewMode === 'KANBAN' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Kanban</button>
            <button onClick={() => setViewMode('CALENDAR')} style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'CALENDAR' ? '#111' : 'transparent', color: viewMode === 'CALENDAR' ? '#FFD700' : '#4b5563', boxShadow: viewMode === 'CALENDAR' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Calendario</button>
          </div>
        </div>
      </div>

      {/* =========================================
          BARRA DE ACCIONES MASIVAS (SÓLO MODO LISTA)
          ========================================= */}
      {viewMode === 'LIST' && selectedIds.length > 0 && (
        <div style={{ backgroundColor: '#111', color: '#FFD700', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
            ✓ {selectedIds.length} ticket(s) seleccionado(s)
          </span>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* CAMBIAR ESTADO MASIVO */}
            <select 
              defaultValue="" 
              onChange={(e) => { handleBulkUpdate('status', e.target.value); e.target.value = ''; }}
              style={{ padding: '6px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #FFD700', backgroundColor: '#222', color: '#fff', cursor: 'pointer' }}
            >
              <option value="" disabled>Cambiar Estado...</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* CAMBIAR PRIORIDAD MASIVA */}
            <select 
              defaultValue="" 
              onChange={(e) => { handleBulkUpdate('priority', e.target.value); e.target.value = ''; }}
              style={{ padding: '6px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #FFD700', backgroundColor: '#222', color: '#fff', cursor: 'pointer' }}
            >
              <option value="" disabled>Cambiar Prioridad...</option>
              {priorities.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {/* CAMBIAR TIPO DE TAREA MASIVO */}
            <select 
              defaultValue="" 
              onChange={(e) => { handleBulkUpdate('task_type', e.target.value); e.target.value = ''; }}
              style={{ padding: '6px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #FFD700', backgroundColor: '#222', color: '#fff', cursor: 'pointer' }}
            >
              <option value="" disabled>Cambiar Tipo Tarea...</option>
              {taskTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <button 
              onClick={() => setSelectedIds([])}
              style={{ backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* =========================================
          VISTA 1: LISTA (EDICIÓN EN LÍNEA & MASIVA)
          ========================================= */}
      {viewMode === 'LIST' && (
        <div style={{ overflowX: 'auto', backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px', boxShadow: '4px 4px 0px #111' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #111' }}>
              <tr>
                <th style={{ padding: '12px 16px', width: '40px', textAlign: 'center' }}>
                  <input 
                    type="checkbox"
                    checked={filteredTickets.length > 0 && selectedIds.length === filteredTickets.length}
                    onChange={handleSelectAll}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111' }}>ID</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111' }}>Asunto</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111' }}>Tienda</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111' }}>Estado</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111' }}>Prioridad</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111' }}>Tipo de Tarea</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111' }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>No hay tickets registrados en esta vista.</td></tr>
              ) : (
                filteredTickets.map(t => {
                  const isSelected = selectedIds.includes(t.id);
                  return (
                    <tr 
                      key={t.id} 
                      onClick={() => navigate(`/admin/tickets/${t.id}`)}
                      style={{ 
                        borderBottom: '1px solid #e5e7eb', 
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#fefce8' : 'transparent',
                        transition: 'background-color 0.15s'
                      }} 
                      onMouseEnter={e => { if(!isSelected) e.currentTarget.style.backgroundColor = '#f3f4f6'; }} 
                      onMouseLeave={e => { if(!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {/* CHECKBOX SELECCIÓN */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectOne(e, t.id)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      </td>

                      {/* ID */}
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 'bold', color: '#111' }}>
                        {t.serial_number}
                      </td>

                      {/* ASUNTO */}
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#111', fontWeight: '500' }}>
                        {t.name}
                      </td>

                      {/* TIENDA */}
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#4b5563' }}>
                        {t.store_id}
                      </td>

                      {/* ESTADO EDITABLE */}
                      <td style={{ padding: '8px 12px' }} onClick={e => e.stopPropagation()}>
                        <select 
                          value={t.status || 'OPEN'}
                          onChange={(e) => handleSingleFieldChange(t.id, 'status', e.target.value)}
                          style={{ 
                            padding: '4px 8px', 
                            borderRadius: '12px', 
                            fontSize: '11px', 
                            fontWeight: 'bold',
                            border: '1px solid #d1d5db',
                            backgroundColor: t.status === 'CLOSED' ? '#dcfce7' : t.status === 'RESOLVED' ? '#e0f2fe' : t.status === 'IN_PROGRESS' ? '#fef3c7' : '#f3f4f6',
                            color: t.status === 'CLOSED' ? '#166534' : t.status === 'RESOLVED' ? '#0369a1' : t.status === 'IN_PROGRESS' ? '#92400e' : '#374151',
                            cursor: 'pointer'
                          }}
                        >
                          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>

                      {/* PRIORIDAD EDITABLE */}
                      <td style={{ padding: '8px 12px' }} onClick={e => e.stopPropagation()}>
                        <select 
                          value={t.priority || 'MEDIUM'}
                          onChange={(e) => handleSingleFieldChange(t.id, 'priority', e.target.value)}
                          style={{ 
                            padding: '4px 8px', 
                            borderRadius: '6px', 
                            fontSize: '11px', 
                            fontWeight: 'bold',
                            border: '1px solid #d1d5db',
                            backgroundColor: t.priority === 'CRITICAL' || t.priority === 'HIGH' ? '#fee2e2' : '#f3f4f6',
                            color: t.priority === 'CRITICAL' || t.priority === 'HIGH' ? '#991b1b' : '#374151',
                            cursor: 'pointer'
                          }}
                        >
                          {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>

                      {/* TIPO DE TAREA EDITABLE */}
                      <td style={{ padding: '8px 12px' }} onClick={e => e.stopPropagation()}>
                        <select 
                          value={t.task_type || 'CONSULTA'}
                          onChange={(e) => handleSingleFieldChange(t.id, 'task_type', e.target.value)}
                          style={{ 
                            padding: '4px 8px', 
                            borderRadius: '6px', 
                            fontSize: '11px', 
                            fontWeight: 'bold',
                            border: '1px solid #d1d5db',
                            backgroundColor: '#fff',
                            color: '#111',
                            cursor: 'pointer'
                          }}
                        >
                          {taskTypes.map(tt => <option key={tt} value={tt}>{tt}</option>)}
                        </select>
                      </td>

                      {/* FECHA */}
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* =========================================
          VISTA 2: KANBAN (PAGINACIÓN 6 EN 6)
          ========================================= */}
      {viewMode === 'KANBAN' && (
        <div className="crm-kanban-grid">
          {statuses.map(status => {
            const statusTickets = filteredTickets.filter(t => t.status === status);
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
                      <div key={t.id} className="crm-ticket-card" draggable onDragStart={(e) => handleDragStart(e, t.id)} onClick={() => navigate(`/admin/tickets/${t.id}`)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#666666' }}>{t.serial_number}</span>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: t.priority === 'HIGH' || t.priority === 'CRITICAL' ? '#dc2626' : '#111111' }}>{t.priority}</span>
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

                {/* CONTROLES DE PAGINACIÓN KANBAN (6 en 6) */}
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
      )}

      {/* =========================================
          VISTA 3: CALENDARIO
          ========================================= */}
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

      {/* MODAL PARA CREAR TICKET */}
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