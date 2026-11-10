import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

// Subcomponentes de la pantalla (antes en este mismo archivo) → ./TotalTickets/
import TicketsToolbar from './TotalTickets/TicketsToolbar';
import BulkActionsBar from './TotalTickets/BulkActionsBar';
import TicketsListView from './TotalTickets/TicketsListView';
import TicketsKanbanView from './TotalTickets/TicketsKanbanView';
import TicketsCalendarView from './TotalTickets/TicketsCalendarView';
import CreateTicketModal from './TotalTickets/CreateTicketModal';
import DayTicketsModal from './TotalTickets/DayTicketsModal';

const LIST_ITEMS_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 300;

// Lo que devuelve la API puede venir como arreglo plano o dentro de { data }
const unwrapList = (res) => (Array.isArray(res.data) ? res.data : (res.data?.data || []));

function TotalTickets() {
  const navigate = useNavigate();

  // 1. ESTADOS PRINCIPALES
  // En la vista Lista `tickets` es solo la página actual (el servidor filtra, ordena y pagina).
  // En Kanban y Calendario es el conjunto completo, que se filtra aquí como antes.
  const [tickets, setTickets] = useState([]);
  const [stores, setStores] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]); // Usuarios reales de la BD
  const [viewMode, setViewMode] = useState('LIST');
  const [selectedDayTickets, setSelectedDayTickets] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Totales de las pestañas Activos / Cerrados (de toda la tabla, no de la página)
  const [counts, setCounts] = useState({ active: 0, closed: 0 });
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 1 });

  // ESTADOS DE SELECCIÓN Y BÚSQUEDA
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');           // Lo que escribe el usuario
  const [debouncedSearch, setDebouncedSearch] = useState(''); // Lo que se envía al servidor

  // Filtro de asignación y ordenamiento
  const [currentUser, setCurrentUser] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState(''); // '' = Todos, 'ME' = Mis Tickets, 'UNASSIGNED' = Sin Asignar
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  // TAB DE ESTADO: ACTIVOS (Sin CLOSED) VS CERRADOS (CLOSED)
  const [statusTab, setStatusTab] = useState('ACTIVE');  // 'ACTIVE' | 'CLOSED'
  const [ticketView, setTicketView] = useState('B2B');   // 'B2B' | 'B2C'

  // PAGINACIÓN EN LISTA
  const [listPage, setListPage] = useState(1);

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

  const isList = viewMode === 'LIST';

  // Los filtros del servidor y la página forman la "llave" de la consulta de la lista
  const assignedParam = assigneeFilter === 'ME' ? currentUser
    : (assigneeFilter === 'UNASSIGNED' ? '__UNASSIGNED__' : assigneeFilter);
  const listParams = {
    fields: 'list', // descripción recortada a 300 caracteres (conserva [GMAIL_ID: ...])
    page: listPage,
    limit: LIST_ITEMS_PER_PAGE,
    status: statusTab,
    is_b2c: ticketView === 'B2C',
    sort: sortConfig.key,
    order: sortConfig.direction,
    ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    ...(assignedParam ? { assigned_to: assignedParam } : {})
  };
  const queryKey = isList ? JSON.stringify(listParams) : 'ALL';

  // Descarta respuestas viejas si el usuario cambió de filtro mientras llegaban
  const requestSeq = useRef(0);
  const latestQuery = useRef({ isList, listParams });
  // Se actualiza en un efecto declarado antes del que pide los tickets, así siempre lee la consulta vigente
  useEffect(() => {
    latestQuery.current = { isList, listParams };
  });

  const fetchTickets = useCallback(async () => {
    const seq = ++requestSeq.current;
    const { isList: listMode, listParams: params } = latestQuery.current;
    setListLoading(true);
    try {
      const res = listMode
        ? await crmApi.get('/tickets', { params })
        : await crmApi.get('/tickets?fields=list');
      if (seq !== requestSeq.current) return;

      const rows = unwrapList(res);
      setTickets(rows);

      if (listMode) {
        const pagination = res.data?.pagination;
        if (pagination) {
          setPageInfo({ total: pagination.total, totalPages: pagination.totalPages });
          // Si se borró la última página, vuelve a la última que exista
          if (rows.length === 0 && pagination.page > 1 && pagination.totalPages < pagination.page) {
            setListPage(pagination.totalPages);
          }
        } else {
          setPageInfo({ total: rows.length, totalPages: 1 });
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      if (seq === requestSeq.current) {
        setListLoading(false);
        setTicketsLoaded(true);
      }
    }
  }, []);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await crmApi.get('/tickets/stats');
      const stats = res.data?.data;
      if (stats) {
        const closed = Number(stats.by_status?.CLOSED || 0);
        setCounts({ active: Math.max(Number(stats.total || 0) - closed, 0), closed });
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  // Recarga lo que depende de los datos (después de crear, editar o borrar)
  const refreshData = useCallback(() => {
    fetchTickets();
    fetchCounts();
  }, [fetchTickets, fetchCounts]);

  // Carga inicial: tiendas, responsables y totales (los tickets los pide el efecto de abajo)
  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (token) {
      const payload = JSON.parse(window.atob(token.split('.')[1]));
      setCurrentUser(payload.name || payload.email);
    }

    const loadStatic = async () => {
      try {
        const [storesRes, usersRes] = await Promise.all([
          crmApi.get('/stores'),
          crmApi.get('/users/admins')
        ]);

        if (storesRes.data) {
          const parsedStores = Array.isArray(storesRes.data) ? storesRes.data : (storesRes.data.data || []);
          setStores(parsedStores);
          if (parsedStores.length > 0) {
            setFormData(prev => ({ ...prev, store_id: parsedStores[0].id }));
          }
        }

        if (usersRes.data && usersRes.data.success) {
          setAdminUsers(usersRes.data.data || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setInitDone(true);
      }
    };

    loadStatic();
    fetchCounts();
  }, [fetchCounts]);

  // Pide los tickets cada vez que cambia algo de la consulta (filtros, orden, página o vista)
  useEffect(() => {
    fetchTickets();
  }, [queryKey, fetchTickets]);

  // El buscador espera a que el usuario deje de escribir antes de consultar
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setListPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Limpiar seleccionados al cambiar filtros, página o vista
  useEffect(() => {
    setSelectedIds([]);
  }, [ticketView, statusTab, debouncedSearch, assigneeFilter, listPage, viewMode]);

  // Cambiar un filtro del servidor siempre vuelve a la página 1
  const withFirstPage = (setter) => (value) => {
    setter(value);
    setListPage(1);
  };

  // 2. FILTRADO LOCAL (solo Kanban y Calendario; la Lista ya llega filtrada y ordenada del servidor)
  const searchedTickets = isList ? tickets : tickets
    .filter(t => (ticketView === 'B2B' ? !t.is_b2c : t.is_b2c))
    .filter(t => (statusTab === 'CLOSED' ? t.status === 'CLOSED' : t.status !== 'CLOSED'))
    .filter(t => {
      if (assigneeFilter === '') return true;

      const hasAssignee = t.assigned_to && t.assigned_to.trim() !== '';
      if (assigneeFilter === 'UNASSIGNED') return !hasAssignee;
      if (!hasAssignee) return false;

      const asignados = t.assigned_to.split(',').map(n => n.trim().toLowerCase());

      if (assigneeFilter === 'ME') {
        return asignados.some(a => a.includes(currentUser.toLowerCase()) || currentUser.toLowerCase().includes(a));
      }

      // Compara el nombre exacto extraído de la BD con lo que haya tipeado el usuario en el ticket
      return asignados.some(a => a.includes(assigneeFilter.toLowerCase()) || assigneeFilter.toLowerCase().includes(a));
    })
    .filter(t => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      return (
        String(t.serial_number || t.id || '').toLowerCase().includes(term) ||
        String(t.name || '').toLowerCase().includes(term) ||
        String(t.store_id || '').toLowerCase().includes(term)
      );
    });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
    setListPage(1);
  };

  // EDICIÓN INDIVIDUAL EN LÍNEA
  const handleSingleFieldChange = async (ticketId, field, value) => {
    try {
      if (field === 'status') {
        await crmApi.patch(`/tickets/${ticketId}/status`, { status: value });
      } else {
        await crmApi.put(`/tickets/${ticketId}`, { [field]: value });
      }
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, [field]: value } : t));
      // En la lista un cambio de estado (o de tienda) puede sacar el ticket de la vista actual
      if (isList) fetchTickets();
      if (field === 'status') fetchCounts();
    } catch (error) {
      console.error(`Error actualizando ${field}:`, error);
      alert(`No se pudo guardar el cambio de ${field} en la base de datos.`);
      refreshData(); // Recarga los datos reales si falló
    }
  };

  // SELECCIÓN MASIVA (la página visible en la lista; todo lo filtrado en las otras vistas)
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
          return crmApi.put(`/tickets/${id}`, { [field]: value });
        })
      );
      setTickets(prev => prev.map(t => selectedIds.includes(t.id) ? { ...t, [field]: value } : t));
      setSelectedIds([]);
      alert(`Se actualizó ${field} en ${selectedIds.length} ticket(s) seleccionado(s).`);
      refreshData();
    } catch (error) {
      console.error('Error en actualización masiva:', error);
      alert('Ocurrió un error al guardar los cambios masivos.');
      refreshData();
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
      refreshData();
    } catch (error) {
      console.error('Error en eliminación masiva:', error);
      alert('Ocurrió un error al intentar eliminar algunos tickets.');
      refreshData();
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
        refreshData();
      }
    } catch (error) {
      console.error(error);
      alert("Error al registrar el ticket.");
    }
  };

  if (!initDone || !ticketsLoaded) return <div className="crm-text-loading">Cargando operaciones...</div>;

  return (
    <div>
      {/* CABECERA Y CONTROLES */}
      <TicketsToolbar
        ticketView={ticketView}
        setTicketView={withFirstPage(setTicketView)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        assigneeFilter={assigneeFilter}
        setAssigneeFilter={withFirstPage(setAssigneeFilter)}
        adminUsers={adminUsers}
        statusTab={statusTab}
        setStatusTab={withFirstPage(setStatusTab)}
        counts={counts}
        onNewTicket={() => setShowCreateModal(true)}
      />

      {/* BARRA DE ACCIONES MASIVAS (EDICIÓN Y ELIMINACIÓN) */}
      {isList && selectedIds.length > 0 && (
        <BulkActionsBar
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          stores={stores}
          handleBulkUpdate={handleBulkUpdate}
          handleBulkDelete={handleBulkDelete}
        />
      )}

      {/* VISTA 1: LISTA (paginada desde el servidor) */}
      {isList && (
        <TicketsListView
          tickets={tickets}
          total={pageInfo.total}
          listPage={listPage}
          setListPage={setListPage}
          listItemsPerPage={LIST_ITEMS_PER_PAGE}
          totalListPages={pageInfo.totalPages}
          listLoading={listLoading}
          sortConfig={sortConfig}
          handleSort={handleSort}
          selectedIds={selectedIds}
          handleSelectAll={handleSelectAll}
          handleSelectOne={handleSelectOne}
          stores={stores}
          handleSingleFieldChange={handleSingleFieldChange}
          navigate={navigate}
        />
      )}

      {/* VISTA 2: KANBAN */}
      {viewMode === 'KANBAN' && (
        <TicketsKanbanView
          tickets={searchedTickets}
          statusTab={statusTab}
          kanbanPages={kanbanPages}
          setKanbanPages={setKanbanPages}
          handleDrop={handleDrop}
          handleDragStart={handleDragStart}
          handleSingleFieldChange={handleSingleFieldChange}
          navigate={navigate}
        />
      )}

      {/* VISTA 3: CALENDARIO */}
      {viewMode === 'CALENDAR' && (
        <TicketsCalendarView
          tickets={searchedTickets}
          calendarDate={calendarDate}
          setCalendarDate={setCalendarDate}
          onSelectDay={setSelectedDayTickets}
          navigate={navigate}
        />
      )}

      {/* MODAL CREAR TICKET */}
      {showCreateModal && (
        <CreateTicketModal
          formData={formData}
          setFormData={setFormData}
          stores={stores}
          adminUsers={adminUsers}
          onSubmit={handleCreateTicket}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* MODAL CALENDARIO DIA */}
      {selectedDayTickets && (
        <DayTicketsModal
          selectedDayTickets={selectedDayTickets}
          onClose={() => setSelectedDayTickets(null)}
          navigate={navigate}
        />
      )}
    </div>
  );
}

export default TotalTickets;
