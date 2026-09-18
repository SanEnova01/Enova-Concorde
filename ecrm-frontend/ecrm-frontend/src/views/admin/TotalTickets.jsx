import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function TotalTickets() {
  const navigate = useNavigate();
  
  // 1. ESTADOS PRINCIPALES
  const [tickets, setTickets] = useState([]);
  const [stores, setStores] = useState([]);
  const [viewMode, setViewMode] = useState('LIST'); 
  const [selectedDayTickets, setSelectedDayTickets] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // ESTADOS DE SELECCIÓN Y BÚSQUEDA
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');     // Buscador por ID, Asunto o Store ID
  const [storeFilterSearch, setStoreFilterSearch] = useState(''); // Filtro en selector de tienda masivo

  // TAB DE ESTADO: ACTIVOS (Sin CLOSED) VS CERRADOS (CLOSED)
  const [statusTab, setStatusTab] = useState('ACTIVE');  // 'ACTIVE' | 'CLOSED'
  const [ticketView, setTicketView] = useState('B2B');   // 'B2B' | 'B2C'

  // PAGINACIÓN DE 10 POR PÁGINA EN LISTA
  const [listPage, setListPage] = useState(1);
  const listItemsPerPage = 20;

  // PAGINACIÓN KANBAN (6 por columna)
  const [kanbanPages, setKanbanPages] = useState({
    OPEN: 1,
    IN_PROGRESS: 1,
    RESOLVED: 1,
    CLOSED: 1
  });

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

  useEffect(() => {
    fetchData();
  }, []);

  // PIPELINE DE FILTRADO (B2B/B2C -> ACTIVOS/CERRADOS -> BUSCADOR ID/ASUNTO/STORE_ID)
  const typeFiltered = tickets.filter(t => ticketView === 'B2B' ? !t.is_b2c : t.is_b2c);

  const statusFiltered = typeFiltered.filter(t => {
    if (statusTab === 'CLOSED') {
      return t.status === 'CLOSED';
    }
    return t.status !== 'CLOSED';
  });

  const searchedTickets = statusFiltered.filter(t => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const serialMatch = String(t.serial_number || t.id || '').toLowerCase().includes(term);
    const nameMatch = String(t.name || '').toLowerCase().includes(term);
    const storeMatch = String(t.store_id || '').toLowerCase().includes(term);
    return serialMatch || nameMatch || storeMatch;
  });

  // CÁLCULO DE PAGINACIÓN DE 10 EN 10 PARA VISTA DE LISTA
  const totalListPages = Math.ceil(searchedTickets.length / listItemsPerPage) || 1;
  const paginatedTickets = searchedTickets.slice((listPage - 1) * listItemsPerPage, listPage * listItemsPerPage);

  // Limpiar seleccionados y reiniciar a página 1 al cambiar filtros o búsqueda
  useEffect(() => {
    setSelectedIds([]);
    setListPage(1);
  }, [ticketView, statusTab, searchTerm]);

  // EDICIÓN INDIVIDUAL EN LÍNEA
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
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, [field]: value } : t));
    }
  };

  // SELECCIÓN MASIVA
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(searchedTickets.map(t => t.id));
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

  // ACTUALIZACIÓN MASIVA (ESTADO, PRIORIDAD, TIPO TAREA, STORE ID)
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
      alert(`Se actualizó ${field} en ${selectedIds.length} ticket(s) seleccionado(s).`);
    } catch (error) {
      console.error('Error en actualización masiva:', error);
      setTickets(prev => prev.map(t => selectedIds.includes(t.id) ? { ...t, [field]: value } : t));
      setSelectedIds([]);
    }
  };

  // ELIMINACIÓN MASIVA DE TICKETS
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmDelete = window.confirm(`¿Estás seguro de que deseas ELIMINAR PERMANENTEMENTE ${selectedIds.length} ticket(s) seleccionado(s)?`);
    if (!confirmDelete) return;

    try {
      await Promise.all(
        selectedIds.map(id => crmApi.delete(`/tickets/${id}`))
      );
      setTickets(prev => prev.filter(t => !selectedIds.includes(t.id)));
      setSelectedIds([]);
      alert(`Se eliminaron ${selectedIds.length} ticket(s) correctamente.`);
    } catch (error) {
      console.error('Error en eliminación masiva:', error);
      alert('Ocurrió un error al intentar eliminar algunos tickets.');
      fetchData();
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
      const matching = searchedTickets.filter(t => t.created_at && t.created_at.startsWith(dayString));
      
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
                {t.serial_number || t.id}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return cells;
  };

  if (loading) return <div className="crm-text-loading">Cargando operaciones...</div>;

  const storesFiltradas = stores.filter(s => 
    s.id.toLowerCase().includes(storeFilterSearch.toLowerCase()) || 
    (s.name && s.name.toLowerCase().includes(storeFilterSearch.toLowerCase()))
  );

  return (
    <div>
      {/* CABECERA Y CONTROLES */}
      <div className="crm-actions-bar" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Gestión de Tickets</h1>
          <button onClick={() => setShowCreateModal(true)} className="crm-btn-black">Nuevo Ticket</button>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-end', borderBottom: '2px solid #e5e7eb', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* PESTAÑAS PRINCIPALES (B2B / B2C) */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setTicketView('B2B')} style={{ padding: '10px 20px', backgroundColor: ticketView === 'B2B' ? '#111' : '#f3f4f6', color: ticketView === 'B2B' ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px 6px 0 0', fontWeight: '900', cursor: 'pointer', borderBottom: ticketView === 'B2B' ? 'none' : '2px solid #111', marginBottom: '-18px' }}>
              🏢 Agencia (Interno)
            </button>
            <button onClick={() => setTicketView('B2C')} style={{ padding: '10px 20px', backgroundColor: ticketView === 'B2C' ? '#111' : '#f3f4f6', color: ticketView === 'B2C' ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px 6px 0 0', fontWeight: '900', cursor: 'pointer', borderBottom: ticketView === 'B2C' ? 'none' : '2px solid #111', marginBottom: '-18px' }}>
              🛒 Clientes (Hub)
            </button>
          </div>

          {/* SELECTORES DE VISTA */}
          <div style={{ display: 'flex', gap: '8px', backgroundColor: '#f3f4f6', padding: '4px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
            <button onClick={() => setViewMode('LIST')} style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'LIST' ? '#111' : 'transparent', color: viewMode === 'LIST' ? '#FFD700' : '#4b5563', boxShadow: viewMode === 'LIST' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Lista</button>
            <button onClick={() => setViewMode('KANBAN')} style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'KANBAN' ? '#111' : 'transparent', color: viewMode === 'KANBAN' ? '#FFD700' : '#4b5563', boxShadow: viewMode === 'KANBAN' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Kanban</button>
            <button onClick={() => setViewMode('CALENDAR')} style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'CALENDAR' ? '#111' : 'transparent', color: viewMode === 'CALENDAR' ? '#FFD700' : '#4b5563', boxShadow: viewMode === 'CALENDAR' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Calendario</button>
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA MULTI-CAMPO Y TABS ACTIVOS / CERRADOS */}
        <div style={{ display: 'flex', gap: '12px', width: '100%', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
          
          {/* BUSCADOR */}
          <div style={{ flex: '1', minWidth: '280px' }}>
            <input 
              type="text"
              placeholder="🔍 Buscar por ID, Asunto o Store ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: '6px',
                border: '2px solid #111',
                fontSize: '13px',
                outline: 'none',
                backgroundColor: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* SELECCIÓN ACTIVOS / CERRADOS */}
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#e5e7eb', padding: '4px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
            <button
              onClick={() => setStatusTab('ACTIVE')}
              style={{
                padding: '7px 16px',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold',
                fontSize: '12px',
                cursor: 'pointer',
                backgroundColor: statusTab === 'ACTIVE' ? '#111' : 'transparent',
                color: statusTab === 'ACTIVE' ? '#FFD700' : '#4b5563'
              }}
            >
              🟢 Activos ({typeFiltered.filter(t => t.status !== 'CLOSED').length})
            </button>
            <button
              onClick={() => setStatusTab('CLOSED')}
              style={{
                padding: '7px 16px',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold',
                fontSize: '12px',
                cursor: 'pointer',
                backgroundColor: statusTab === 'CLOSED' ? '#111' : 'transparent',
                color: statusTab === 'CLOSED' ? '#FFD700' : '#4b5563'
              }}
            >
              🔴 Cerrados ({typeFiltered.filter(t => t.status === 'CLOSED').length})
            </button>
          </div>
        </div>
      </div>

      {/* BARRA DE ACCIONES MASIVAS (EDICIÓN Y ELIMINACIÓN) */}
      {viewMode === 'LIST' && selectedIds.length > 0 && (
        <div style={{ backgroundColor: '#111', color: '#FFD700', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
            ✓ {selectedIds.length} ticket(s) seleccionado(s)
          </span>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            
            {/* CAMBIAR STORE ID MASIVO CON BÚSQUEDA */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <select 
                defaultValue="" 
                onChange={(e) => { handleBulkUpdate('store_id', e.target.value); e.target.value = ''; }}
                style={{ padding: '6px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #FFD700', backgroundColor: '#222', color: '#fff', cursor: 'pointer', maxWidth: '160px' }}
              >
                <option value="" disabled>🔍 Cambiar Store ID...</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.id} ({s.name})</option>
                ))}
              </select>
            </div>

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

            {/* BORRAR MASIVAMENTE */}
            <button 
              onClick={handleBulkDelete}
              style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🗑️ Eliminar ({selectedIds.length})
            </button>

            <button 
              onClick={() => setSelectedIds([])}
              style={{ backgroundColor: 'transparent', color: '#9ca3af', border: '1px solid #4b5563', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* VISTA 1: LISTA (PAGINADA A MÁXIMO 10 POR PÁGINA) */}
      {viewMode === 'LIST' && (
        <div style={{ marginTop: '16px', backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px', boxShadow: '4px 4px 0px #111', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #111' }}>
                <tr>
                  <th style={{ padding: '12px 16px', width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox"
                      checked={searchedTickets.length > 0 && selectedIds.length === searchedTickets.length}
                      onChange={handleSelectAll}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111' }}>ID</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111' }}>Asunto</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111' }}>Store ID / Tienda</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111' }}>Estado</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111' }}>Prioridad</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111' }}>Tipo de Tarea</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111' }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTickets.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                      No se encontraron tickets en esta vista.
                    </td>
                  </tr>
                ) : (
                  paginatedTickets.map(t => {
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
                        <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectOne(e, t.id)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 'bold', color: '#111' }}>
                          {t.serial_number || t.id}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#111', fontWeight: '500' }}>
                          {t.name}
                        </td>

                        {/* EDITAR STORE ID EN LÍNEA */}
                        <td style={{ padding: '8px 12px' }} onClick={e => e.stopPropagation()}>
                          <select
                            value={t.store_id || ''}
                            onChange={(e) => handleSingleFieldChange(t.id, 'store_id', e.target.value)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              border: '1px solid #d1d5db',
                              backgroundColor: '#f3f4f6',
                              color: '#111',
                              cursor: 'pointer',
                              maxWidth: '140px'
                            }}
                          >
                            {stores.map(s => (
                              <option key={s.id} value={s.id}>{s.id}</option>
                            ))}
                          </select>
                        </td>

                        {/* EDITAR ESTADO EN LÍNEA */}
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

                        {/* EDITAR PRIORIDAD EN LÍNEA */}
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

                        {/* EDITAR TIPO DE TAREA EN LÍNEA */}
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

          {/* CONTROLES DE PAGINACIÓN DE 10 EN 10 */}
          {searchedTickets.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '2px solid #111', backgroundColor: '#f9fafb', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#4b5563', fontWeight: 'bold' }}>
                Mostrando {((listPage - 1) * listItemsPerPage) + 1} - {Math.min(listPage * listItemsPerPage, searchedTickets.length)} de {searchedTickets.length} tickets
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  disabled={listPage === 1}
                  onClick={() => setListPage(prev => Math.max(prev - 1, 1))}
                  className="crm-btn-border"
                  style={{ padding: '4px 12px', fontSize: '12px', opacity: listPage === 1 ? 0.5 : 1, cursor: listPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  Anterior
                </button>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                  Página {listPage} de {totalListPages}
                </span>
                <button
                  disabled={listPage >= totalListPages}
                  onClick={() => setListPage(prev => Math.min(prev + 1, totalListPages))}
                  className="crm-btn-border"
                  style={{ padding: '4px 12px', fontSize: '12px', opacity: listPage >= totalListPages ? 0.5 : 1, cursor: listPage >= totalListPages ? 'not-allowed' : 'pointer' }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VISTA 2: KANBAN */}
      {viewMode === 'KANBAN' && (
        <div className="crm-kanban-grid" style={{ marginTop: '16px' }}>
          {(statusTab === 'CLOSED' ? ['CLOSED'] : ['OPEN', 'IN_PROGRESS', 'RESOLVED']).map(status => {
            const statusTickets = searchedTickets.filter(t => t.status === status);
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
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#666666' }}>{t.serial_number || t.id}</span>
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

      {/* VISTA 3: CALENDARIO */}
      {viewMode === 'CALENDAR' && (
        <div className="crm-card-paper" style={{ marginTop: '16px' }}>
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

      {/* MODAL CREAR TICKET */}
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

      {/* MODAL CALENDARIO DIA */}
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
                    <span>{t.serial_number || t.id} - {t.name}</span>
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