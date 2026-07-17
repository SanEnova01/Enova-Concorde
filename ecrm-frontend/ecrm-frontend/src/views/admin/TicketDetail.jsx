import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function TicketDetail() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  
  const [ticket, setTicket] = useState(null);
  const [associatedStore, setAssociatedStore] = useState(null); // Nuevo estado para guardar la tienda asociada
  const [loading, setLoading] = useState(true);
  const [ticketError, setTicketError] = useState(false);

  const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

  // Función de extracción segura para evitar errores 404/arreglos envueltos
  const extraerArreglo = (response) => {
    if (!response || !response.data) return [];
    if (Array.isArray(response.data)) return response.data;
    if (response.data.data && Array.isArray(response.data.data)) return response.data.data;
    if (response.data.result && Array.isArray(response.data.result)) return response.data.result;
    const arregloEncontrado = Object.values(response.data).find(val => Array.isArray(val));
    return arregloEncontrado || [];
  };

  useEffect(() => {
    const fetchTicketData = async () => {
      try {
        setLoading(true);
        setTicketError(false);
        
        // Consultamos tickets y tiendas simultáneamente
        const [ticketsRes, storesRes] = await Promise.all([
          crmApi.get('/tickets'),
          crmApi.get('/stores')
        ]);
        
        const ticketsList = extraerArreglo(ticketsRes);
        const storesList = extraerArreglo(storesRes);
        
        // Buscamos el ticket por su ID
        const foundTicket = ticketsList.find(t => String(t.id) === String(ticketId));
        
        if (foundTicket) {
          setTicket(foundTicket);
          
          // Cruzamos el store_id del ticket con la lista de tiendas para obtener el logo
          const foundStore = storesList.find(s => String(s.id) === String(foundTicket.store_id));
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
    fetchTicketData();
  }, [ticketId]);

  // Permite actualizar el estado directamente desde la ficha de detalle
  const handleUpdateStatus = async (newStatus) => {
    try {
      const response = await crmApi.patch(`/tickets/${ticketId}/status`, { status: newStatus });
      if (response.data.success || response.status === 200) {
        setTicket(prev => ({ 
          ...prev, 
          status: newStatus, 
          closed_at: newStatus === 'CLOSED' ? new Date().toISOString() : prev.closed_at 
        }));
        alert('Estado del ticket actualizado exitosamente.');
      }
    } catch (error) {
      console.error(error);
      alert('Error al cambiar el estado en el servidor.');
    }
  };

  if (loading) return <div className="crm-text-loading">Cargando detalles del ticket...</div>;
  
  if (ticketError || !ticket) {
    return (
      <div className="crm-card-paper" style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center' }}>
        <h3>Ticket no encontrado</h3>
        <p className="crm-text-muted">El identificador no corresponde a ningún registro de soporte técnico activo.</p>
        <button onClick={() => navigate('/admin/tickets')} className="crm-btn-black" style={{ marginTop: '16px' }}>
          Volver a Tickets
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="crm-actions-bar">
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Ticket: {ticket.serial_number}</h1>
        <button onClick={() => navigate(-1)} className="crm-btn-border">Volver</button>
      </div>

      <div className="crm-grid-two-columns">
        {/* Ficha Técnica Estilo Libro Kindle */}
        <div className="crm-card-paper">
          <h3 className="crm-section-title" style={{ marginTop: 0 }}>Metadatos de Soporte</h3>
          
          {/* Identidad Corporativa / Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0', borderBottom: '1px dotted #cccccc', marginBottom: '12px' }}>
           
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold' }}>
                {associatedStore ? associatedStore.name : 'Cliente Desconocido'}
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#555555' }}>ID: {ticket.store_id}</p>
            </div>
          </div>

          <p className="crm-text-muted"><strong>Asunto / Nombre:</strong> {ticket.name}</p>
          <p className="crm-text-muted"><strong>Prioridad Operativa:</strong> <span className="crm-badge">{ticket.priority}</span></p>
          <p className="crm-text-muted"><strong>Tipo de Tarea:</strong> {ticket.task_type || 'No especificado'}</p>
          {ticket.assigned_to && <p className="crm-text-muted"><strong>Responsable:</strong> {ticket.assigned_to}</p>}
          
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

        {/* Cronología de Tiempos */}
        <div className="crm-card-paper">
          <h3 className="crm-section-title" style={{ marginTop: 0 }}>Auditoría de Tiempos</h3>
          <p className="crm-text-muted"><strong>Fecha y Hora de Apertura:</strong> {new Date(ticket.created_at).toLocaleString()}</p>
          <p className="crm-text-muted"><strong>Fecha y Hora de Cierre:</strong> {ticket.closed_at ? new Date(ticket.closed_at).toLocaleString() : 'Abierto / En resolución'}</p>
        </div>
      </div>

      {/* Caja Ampliada de Descripción */}
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