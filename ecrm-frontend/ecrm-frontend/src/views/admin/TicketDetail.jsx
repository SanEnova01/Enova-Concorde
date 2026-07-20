import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function TicketDetail() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  
  const [ticket, setTicket] = useState(null);
  const [storesList, setStoresList] = useState([]);
  const [associatedStore, setAssociatedStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ticketError, setTicketError] = useState(false);

  // Estado para el buscador de tiendas (+50 tiendas)
  const [storeSearch, setStoreSearch] = useState('');

  // Estados para el modo de edición
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    store_id: '',
    assigned_to: '',
    priority: 'MEDIUM',
    task_type: 'CONSULTA',
    description: ''
  });

  const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  
  // Valores de prioridad alineados con los constraints de PostgreSQL (MEDIUM, HIGH, etc.)
  const priorityOptions = [
    { label: 'BAJA', value: 'LOW' },
    { label: 'MEDIA', value: 'MEDIUM' },
    { label: 'ALTA', value: 'HIGH' },
    { label: 'CRÍTICA', value: 'CRITICAL' }
  ];

  const taskTypes = ['CONSULTA', 'CAMBIO', 'BUG FIX', 'TAREA INTERNA'];

  const extraerArreglo = (response) => {
    if (!response || !response.data) return [];
    if (Array.isArray(response.data)) return response.data;
    if (response.data.data && Array.isArray(response.data.data)) return response.data.data;
    if (response.data.result && Array.isArray(response.data.result)) return response.data.result;
    const arregloEncontrado = Object.values(response.data).find(val => Array.isArray(val));
    return arregloEncontrado || [];
  };

  useEffect(() => {
    fetchTicketData();
  }, [ticketId]);

  const fetchTicketData = async () => {
    try {
      setLoading(true);
      setTicketError(false);
      
      const [ticketsRes, storesRes] = await Promise.all([
        crmApi.get('/tickets'),
        crmApi.get('/stores')
      ]);
      
      const tickets = extraerArreglo(ticketsRes);
      const stores = extraerArreglo(storesRes);
      
      setStoresList(stores);
      
      const foundTicket = tickets.find(t => String(t.id) === String(ticketId));
      
      if (foundTicket) {
        setTicket(foundTicket);
        
        setEditForm({
          name: foundTicket.name || '',
          store_id: foundTicket.store_id || '',
          assigned_to: foundTicket.assigned_to || '',
          priority: foundTicket.priority || 'MEDIUM',
          task_type: foundTicket.task_type || 'CONSULTA',
          description: foundTicket.description || ''
        });

        const foundStore = stores.find(s => String(s.id) === String(foundTicket.store_id));
        setAssociatedStore(foundStore || null);
      } else {
        setTicketError(true);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error al cargar detalle de ticket:', error);
      setTicketError(true);
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      const response = await crmApi.patch(`/tickets/${ticketId}/status`, { status: newStatus });
      if (response.data?.success || response.status === 200) {
        setTicket(prev => ({ 
          ...prev, 
          status: newStatus, 
          closed_at: newStatus === 'CLOSED' ? new Date().toISOString() : prev.closed_at 
        }));
        alert('Estado actualizado exitosamente.');
      }
    } catch (error) {
      console.error(error);
      alert('Error al cambiar el estado.');
    }
  };

  // Guardar cambios generales (Resuelve el 404)
  const handleSaveTicketDetails = async (e) => {
    e.preventDefault();
    try {
      const response = await crmApi.put(`/tickets/${ticketId}`, editForm);
      if (response.status === 200 || response.data?.success) {
        alert('Ticket actualizado correctamente.');
        setIsEditing(false);
        fetchTicketData();
      }
    } catch (error) {
      console.error('Error al actualizar ticket:', error);
      alert('Error al guardar los cambios del ticket. Verifica las rutas del backend.');
    }
  };

  // Eliminar ticket de la DB
  const handleDeleteTicket = async () => {
    const confirmDelete = window.confirm(`¿Estás seguro de eliminar el ticket ${ticket.serial_number}? Esta acción no se puede deshacer.`);
    if (!confirmDelete) return;

    try {
      const response = await crmApi.delete(`/tickets/${ticketId}`);
      if (response.status === 200 || response.data?.success) {
        alert('Ticket eliminado de la base de datos.');
        navigate('/admin/tickets');
      }
    } catch (error) {
      console.error('Error al eliminar ticket:', error);
      alert('Error al intentar eliminar el ticket.');
    }
  };

  // Filtro dinámico para el dropdown de tiendas
  const filteredStores = storesList.filter(st => 
    (st.name || '').toLowerCase().includes(storeSearch.toLowerCase())
  );

  if (loading) return <div className="crm-text-loading">Cargando detalles del ticket...</div>;
  
  if (ticketError || !ticket) {
    return (
      <div className="crm-card-paper" style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center' }}>
        <h3>Ticket no encontrado</h3>
        <p className="crm-text-muted">El identificador no corresponde a ningún registro activo.</p>
        <button onClick={() => navigate('/admin/tickets')} className="crm-btn-black" style={{ marginTop: '16px' }}>
          Volver a Tickets
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="crm-actions-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Ticket: {ticket.serial_number}</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setIsEditing(!isEditing)} 
            className="crm-btn-black" 
          >
            {isEditing ? 'Cancelar Edición' : 'Editar / Clasificar Ticket'}
          </button>
          
          {/* Botón de eliminación */}
          <button 
            onClick={handleDeleteTicket} 
            className="crm-btn-border"
            style={{ color: '#d9534f', borderColor: '#d9534f', fontWeight: 'bold' }}
          >
            Eliminar Ticket
          </button>

          <button onClick={() => navigate(-1)} className="crm-btn-border">Volver</button>
        </div>
      </div>

      {/* FORMULARIO DE EDICIÓN CON BUSCADOR DE TIENDAS */}
      {isEditing ? (
        <form onSubmit={handleSaveTicketDetails} className="crm-card-paper" style={{ marginBottom: '24px' }}>
          <h3 className="crm-section-title" style={{ marginTop: 0 }}>Editar / Clasificar Datos del Ticket</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Asunto / Nombre</label>
              <input 
                type="text" 
                className="crm-select-dropdown" 
                style={{ width: '100%' }}
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>

            {/* SELECCIÓN DE TIENDA CON FILTRO BUSCADOR */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Tienda / Cliente</label>
              <input 
                type="text" 
                placeholder="🔍 Buscar tienda..." 
                className="crm-select-dropdown"
                style={{ width: '100%', marginBottom: '6px', fontSize: '12px' }}
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
              />
              <select 
                className="crm-select-dropdown" 
                style={{ width: '100%' }}
                value={editForm.store_id}
                onChange={(e) => setEditForm({ ...editForm, store_id: e.target.value })}
              >
                <option value="">-- Seleccionar Tienda ({filteredStores.length} encontradas) --</option>
                {filteredStores.map(st => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Nivel de Prioridad</label>
              <select 
                className="crm-select-dropdown" 
                style={{ width: '100%' }}
                value={editForm.priority}
                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
              >
                {priorityOptions.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Tipo de Tarea</label>
              <select 
                className="crm-select-dropdown" 
                style={{ width: '100%' }}
                value={editForm.task_type}
                onChange={(e) => setEditForm({ ...editForm, task_type: e.target.value })}
              >
                {taskTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Responsable (Opcional)</label>
              <input 
                type="text" 
                className="crm-select-dropdown" 
                style={{ width: '100%' }}
                placeholder="Ej: Juan Pérez"
                value={editForm.assigned_to}
                onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Descripción Detallada</label>
              <textarea 
                className="crm-select-dropdown" 
                style={{ width: '100%', minHeight: '100px', fontFamily: 'inherit' }}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
          </div>

          <button type="submit" className="crm-btn-black">Guardar Cambios</button>
        </form>
      ) : null}

      {/* VISTA DE LECTURA */}
      <div className="crm-grid-two-columns">
        <div className="crm-card-paper">
          <h3 className="crm-section-title" style={{ marginTop: 0 }}>Metadatos de Soporte</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0', borderBottom: '1px dotted #cccccc', marginBottom: '12px' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold' }}>
                {associatedStore ? associatedStore.name : 'Cliente / Tienda No Asignado'}
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#555555' }}>ID Tienda: {ticket.store_id || 'Sin asignar'}</p>
            </div>
          </div>

          <p className="crm-text-muted"><strong>Asunto / Nombre:</strong> {ticket.name}</p>
          <p className="crm-text-muted"><strong>Prioridad Operativa:</strong> <span className="crm-badge">{ticket.priority}</span></p>
          <p className="crm-text-muted"><strong>Tipo de Tarea:</strong> {ticket.task_type || 'No especificado'}</p>
          <p className="crm-text-muted"><strong>Responsable:</strong> {ticket.assigned_to || 'Sin asignar'}</p>
          
          <div style={{ marginTop: '20px', borderTop: '1px dotted #cccccc', paddingTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Cambiar Estado Actual:</label>
            <select 
              value={ticket.status} 
              onChange={(e) => handleUpdateStatus(e.target.value)} 
              className="crm-select-dropdown"
              style={{ width: '100%' }}
            >
              {statuses.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="crm-card-paper">
          <h3 className="crm-section-title" style={{ marginTop: 0 }}>Auditoría de Tiempos</h3>
          <p className="crm-text-muted"><strong>Fecha y Hora de Apertura:</strong> {new Date(ticket.created_at).toLocaleString()}</p>
          <p className="crm-text-muted"><strong>Fecha y Hora de Cierre:</strong> {ticket.closed_at ? new Date(ticket.closed_at).toLocaleString() : 'Abierto / En resolución'}</p>
        </div>
      </div>

      <div className="crm-card-paper" style={{ marginTop: '24px' }}>
        <h3 className="crm-section-title" style={{ marginTop: 0 }}>Descripción Detallada del Problema</h3>
        <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
          {ticket.description || 'No se han ingresado notas adicionales en la descripción de este soporte.'}
        </p>
      </div>
    </div>
  );
}

export default TicketDetail;