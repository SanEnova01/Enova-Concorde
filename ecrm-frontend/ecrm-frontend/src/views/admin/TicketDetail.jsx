import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function TicketDetail() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  
  // Estados de Usuario / Autenticación
  const [userRole, setUserRole] = useState('client');
  const [userName, setUserName] = useState('');

  const [ticket, setTicket] = useState(null);
  const [storesList, setStoresList] = useState([]);
  const [associatedStore, setAssociatedStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ticketError, setTicketError] = useState(false);

  // Estados para el Chat Flotante
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chatScrollRef = useRef(null); // Para hacer auto-scroll al fondo del chat

  // Estados para el buscador desplegable de Tiendas
  const [storeSearch, setStoreSearch] = useState('');
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const storeDropdownRef = useRef(null);

  // ESTADO PARA EL MODAL PERSONALIZADO
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'alert',
    status: 'success',
    message: '',
    onConfirm: null
  });

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
  
  const priorityOptions = [
    { label: 'BAJA', value: 'LOW' },
    { label: 'MEDIA', value: 'MEDIUM' },
    { label: 'ALTA', value: 'HIGH' },
    { label: 'CRÍTICA', value: 'CRITICAL' }
  ];

  const taskTypes = [
    { label: 'CONSULTA', value: 'CONSULTA' },
    { label: 'CAMBIO', value: 'CAMBIO' },
    { label: 'BUG FIX', value: 'BUG_FIX' },
    { label: 'TAREA INTERNA', value: 'TASK_INTERNA' }
  ];

  const extraerArreglo = (response) => {
    if (!response || !response.data) return [];
    if (Array.isArray(response.data)) return response.data;
    if (response.data.data && Array.isArray(response.data.data)) return response.data.data;
    if (response.data.result && Array.isArray(response.data.result)) return response.data.result;
    return Object.values(response.data).find(val => Array.isArray(val)) || [];
  };

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (token) {
      try {
        const payload = JSON.parse(window.atob(token.split('.')[1]));
        setUserRole(payload.role);
        setUserName(payload.name || payload.email);
      } catch(e) { console.error(e); }
    }

    fetchTicketData();
    fetchMessages();
  }, [ticketId]);

  // Auto-scroll al fondo del chat cuando se abre o hay nuevos mensajes
  useEffect(() => {
    if (isChatOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [isChatOpen, messages]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target)) {
        setIsStoreDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      console.error('Error:', error);
      setTicketError(true);
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await crmApi.get(`/tickets/${ticketId}/messages`);
      if (response.data && response.data.success) {
        setMessages(response.data.data);
      }
    } catch (error) {
      console.error('Error al cargar mensajes:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const response = await crmApi.post(`/tickets/${ticketId}/messages`, {
        sender: userName,
        body: newMessage
      });
      if (response.data && response.data.success) {
        setMessages([...messages, response.data.data]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      showAlert('Hubo un error al enviar tu comentario.', 'error');
    }
  };

  const showAlert = (message, status = 'success', onConfirm = null) => {
    setModalConfig({ isOpen: true, type: 'alert', status, message, onConfirm });
  };

  const showConfirm = (message, onConfirm) => {
    setModalConfig({ isOpen: true, type: 'confirm', status: 'warning', message, onConfirm });
  };

  const closeModal = () => {
    if (modalConfig.type === 'alert' && modalConfig.onConfirm) {
      modalConfig.onConfirm();
    }
    setModalConfig({ ...modalConfig, isOpen: false });
  };

  const handleConfirmAction = () => {
    if (modalConfig.onConfirm) modalConfig.onConfirm();
    setModalConfig({ ...modalConfig, isOpen: false });
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
        showAlert('Estado del ticket actualizado exitosamente.', 'success');
      }
    } catch (error) {
      console.error(error);
      showAlert('Ocurrió un error al intentar cambiar el estado.', 'error');
    }
  };

  const handleSaveTicketDetails = async (e) => {
    e.preventDefault();
    try {
      const response = await crmApi.put(`/tickets/${ticketId}`, editForm);
      if (response.status === 200 || response.data?.success) {
        showAlert('Los datos del ticket fueron actualizados correctamente.', 'success');
        setIsEditing(false);
        fetchTicketData();
      }
    } catch (error) {
      console.error('Error:', error);
      showAlert('Hubo un error al guardar los cambios del ticket.', 'error');
    }
  };

  const handleDeleteTicket = () => {
    showConfirm(`¿Estás seguro de eliminar el ticket ${ticket.serial_number}? Esta acción es permanente y lo borrará también de HubSpot.`, async () => {
      try {
        const response = await crmApi.delete(`/tickets/${ticketId}`);
        if (response.status === 200 || response.data?.success) {
          showAlert('Ticket eliminado exitosamente del sistema.', 'success', () => {
            navigate('/admin/tickets');
          });
        }
      } catch (error) {
        console.error('Error:', error);
        showAlert('Ocurrió un error al intentar eliminar el ticket.', 'error');
      }
    });
  };

  const filteredStores = storesList.filter(st => 
    (st.name || '').toLowerCase().includes(storeSearch.toLowerCase())
  );
  const selectedStoreObj = storesList.find(s => String(s.id) === String(editForm.store_id));

  if (loading) return <div className="crm-text-loading">Cargando detalles del ticket...</div>;
  if (ticketError || !ticket) {
    return (
      <div className="crm-card-paper" style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center' }}>
        <h3>Ticket no encontrado</h3>
        <p className="crm-text-muted">El identificador no corresponde a ningún registro activo.</p>
        <button onClick={() => navigate('/admin/tickets')} className="crm-btn-black" style={{ marginTop: '16px' }}>Volver a Tickets</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', paddingBottom: '80px' }}>
      <style>{`
        @keyframes flyConcorde {
          0% { transform: translateX(-40px) rotate(90deg) scale(0.8); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateX(380px) rotate(90deg) scale(0.8); opacity: 0; }
        }
        .concorde-plane {
          position: absolute; top: 26px; left: 0; color: #e0e0e0;
          animation: flyConcorde 2s ease-in-out forwards; pointer-events: none; z-index: 0;
        }
        .crm-modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(2px);
          display: flex; align-items: center; justify-content: center; z-index: 9999;
        }
        .crm-modal-box {
          background: #fff; padding: 32px 24px 24px; border-radius: 8px; width: 90%; max-width: 380px;
          text-align: center; border: 2px solid #000; box-shadow: 0 15px 35px rgba(0,0,0,0.2);
          position: relative; overflow: hidden;
        }
      `}</style>

      {/* RENDERIZADO DEL MODAL PERSONALIZADO */}
      {modalConfig.isOpen && (
        <div className="crm-modal-overlay">
          <div className="crm-modal-box">
            {(modalConfig.status === 'success' || modalConfig.type === 'confirm') && (
              <svg className="concorde-plane" viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
                <path d="M21,16v-2l-8-5V3.5C13,2.67,12.33,2,11.5,2S10,2.67,10,3.5V9l-8,5v2l8-2.5V19l-2,1.5V22l3.5-1l3.5,1v-1.5L13,19v-5.5L21,16z"/>
              </svg>
            )}
            <div style={{ position: 'relative', zIndex: 10 }}>
              <h3 style={{ marginTop: 0, fontSize: '18px', fontWeight: 'bold' }}>
                {modalConfig.type === 'confirm' ? 'Confirmar Acción' : (modalConfig.status === 'error' ? 'Aviso' : 'Concorde System')}
              </h3>
              <p style={{ fontSize: '14px', color: '#444', lineHeight: '1.5', margin: '16px 0 24px' }}>
                {modalConfig.message}
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                {modalConfig.type === 'confirm' && (
                  <button onClick={closeModal} className="crm-btn-border" style={{ flex: 1 }}>Cancelar</button>
                )}
                <button onClick={modalConfig.type === 'confirm' ? handleConfirmAction : closeModal} className="crm-btn-black" style={{ flex: 1 }}>
                  {modalConfig.type === 'confirm' ? 'Sí, proceder' : 'Aceptar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WIDGET FLOTANTE DE CHAT */}
      <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        
        {/* Ventana del Chat */}
        {isChatOpen && (
          <div style={{
            width: '340px', height: '450px', backgroundColor: '#ffffff', border: '1px solid #111111', 
            borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', display: 'flex', 
            flexDirection: 'column', overflow: 'hidden', marginBottom: '16px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Header del Chat */}
            <div style={{ backgroundColor: '#111111', color: '#ffffff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 'bold', fontSize: '14px', display: 'block' }}>Chat del Ticket</span>
                <span style={{ fontSize: '11px', opacity: 0.8 }}>{ticket.serial_number}</span>
              </div>
              <button onClick={() => setIsChatOpen(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>
                ✕
              </button>
            </div>

            {/* Mensajes */}
            <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#f5f4f0' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', margin: 'auto', color: '#666666', fontSize: '13px' }}>
                  <p>No hay mensajes aún.</p><p>¡Inicia la conversación!</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender === userName;
                  return (
                    <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      <span style={{ fontSize: '10px', color: '#666', marginBottom: '4px', display: 'block', textAlign: isMe ? 'right' : 'left' }}>
                        {msg.sender} • {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      <div style={{ backgroundColor: isMe ? '#111111' : '#ffffff', color: isMe ? '#ffffff' : '#111111', border: isMe ? 'none' : '1px solid #d0d0d0', padding: '10px 14px', borderRadius: '8px', borderTopRightRadius: isMe ? 0 : '8px', borderTopLeftRadius: !isMe ? 0 : '8px' }}>
                        <p style={{ margin: 0, fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{msg.body}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} style={{ padding: '12px', borderTop: '1px solid #d0d0d0', backgroundColor: '#ffffff', display: 'flex', gap: '8px' }}>
              <input 
                type="text"
                value={newMessage} 
                onChange={e => setNewMessage(e.target.value)} 
                placeholder="Escribe un mensaje..." 
                style={{ flex: 1, padding: '10px 12px', borderRadius: '20px', border: '1px solid #d0d0d0', fontSize: '13px', outline: 'none' }}
                required 
              />
              <button type="submit" style={{ backgroundColor: '#111111', color: '#ffffff', border: 'none', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          </div>
        )}

        {/* Botón de la Burbuja */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          style={{
            width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#111111', color: '#ffffff', 
            border: 'none', cursor: 'pointer', boxShadow: '0 6px 16px rgba(0,0,0,0.3)', 
            display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isChatOpen ? (
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          )}
          
          {/* Badge de mensajes no leídos (solo si el chat está cerrado y hay mensajes) */}
          {messages.length > 0 && !isChatOpen && (
            <span style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#d9534f', color: '#ffffff', fontSize: '11px', fontWeight: 'bold', minWidth: '22px', height: '22px', borderRadius: '11px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid #f5f4f0' }}>
              {messages.length}
            </span>
          )}
        </button>
      </div>

      {/* INTERFAZ DEL DETALLE */}
      <div className="crm-actions-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Ticket: {ticket.serial_number}</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          
          {/* CINTURÓN DE SEGURIDAD: Solo Admin / Super Admin ven estos botones */}
          {userRole !== 'client' && (
            <>
              <button onClick={() => setIsEditing(!isEditing)} className="crm-btn-black">
                {isEditing ? 'Cancelar Edición' : 'Editar / Clasificar Ticket'}
              </button>
              <button onClick={handleDeleteTicket} className="crm-btn-border" style={{ color: '#d9534f', borderColor: '#d9534f', fontWeight: 'bold' }}>
                Eliminar Ticket
              </button>
            </>
          )}

          <button onClick={() => navigate(-1)} className="crm-btn-border">Volver</button>
        </div>
      </div>

      {isEditing && userRole !== 'client' ? (
        <form onSubmit={handleSaveTicketDetails} className="crm-card-paper" style={{ marginBottom: '24px' }}>
          <h3 className="crm-section-title" style={{ marginTop: 0 }}>Editar / Clasificar Datos del Ticket</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Asunto / Nombre</label>
              <input type="text" className="crm-select-dropdown" style={{ width: '100%' }} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>

            <div ref={storeDropdownRef} style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Tienda / Cliente</label>
              <input type="text" className="crm-select-dropdown" style={{ width: '100%', cursor: 'pointer' }} placeholder="🔍 Escribe para buscar tienda..." value={isStoreDropdownOpen ? storeSearch : (selectedStoreObj ? selectedStoreObj.name : storeSearch)} onFocus={() => { setIsStoreDropdownOpen(true); setStoreSearch(''); }} onChange={(e) => { setStoreSearch(e.target.value); setIsStoreDropdownOpen(true); }} />
              {isStoreDropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '220px', overflowY: 'auto', backgroundColor: '#ffffff', border: '1px solid #d0d0d0', borderRadius: '6px', boxShadow: '0 6px 16px rgba(0,0,0,0.12)', zIndex: 1000, marginTop: '4px' }}>
                  <div style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', color: '#777', borderBottom: '1px solid #eee' }} onMouseDown={() => { setEditForm({ ...editForm, store_id: '' }); setIsStoreDropdownOpen(false); setStoreSearch(''); }}>-- Sin Tienda / Limpiar Selección --</div>
                  {filteredStores.length > 0 ? filteredStores.map(st => (
                    <div key={st.id} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '14px', backgroundColor: String(st.id) === String(editForm.store_id) ? '#f0f0f0' : '#ffffff', fontWeight: String(st.id) === String(editForm.store_id) ? 'bold' : 'normal' }} onMouseDown={() => { setEditForm({ ...editForm, store_id: st.id }); setIsStoreDropdownOpen(false); setStoreSearch(''); }}>
                      {st.name}
                    </div>
                  )) : <div style={{ padding: '12px 14px', fontSize: '13px', color: '#888' }}>No se encontraron tiendas</div>}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Nivel de Prioridad</label>
              <select className="crm-select-dropdown" style={{ width: '100%' }} value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                {priorityOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Tipo de Tarea</label>
              <select className="crm-select-dropdown" style={{ width: '100%' }} value={editForm.task_type} onChange={(e) => setEditForm({ ...editForm, task_type: e.target.value })}>
                {taskTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Responsable (Opcional)</label>
              <input type="text" className="crm-select-dropdown" style={{ width: '100%' }} placeholder="Ej: Juan Pérez" value={editForm.assigned_to} onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })} />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Descripción Detallada</label>
              <textarea className="crm-select-dropdown" style={{ width: '100%', minHeight: '100px', fontFamily: 'inherit' }} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="crm-btn-black">Guardar Cambios</button>
        </form>
      ) : null}

      <div className="crm-grid-two-columns">
        <div className="crm-card-paper">
          <h3 className="crm-section-title" style={{ marginTop: 0 }}>Metadatos de Soporte</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0', borderBottom: '1px dotted #cccccc', marginBottom: '12px' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold' }}>{associatedStore ? associatedStore.name : 'Cliente / Tienda No Asignado'}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#555555' }}>ID Tienda: {ticket.store_id || 'Sin asignar'}</p>
            </div>
          </div>
          <p className="crm-text-muted"><strong>Asunto / Nombre:</strong> {ticket.name}</p>
          <p className="crm-text-muted"><strong>Prioridad Operativa:</strong> <span className="crm-badge">{ticket.priority}</span></p>
          <p className="crm-text-muted"><strong>Tipo de Tarea:</strong> {ticket.task_type || 'No especificado'}</p>
          <p className="crm-text-muted"><strong>Responsable:</strong> {ticket.assigned_to || 'Sin asignar'}</p>
          
          {/* CINTURÓN DE SEGURIDAD: Solo Admin puede cambiar estados aquí */}
          {userRole !== 'client' && (
            <div style={{ marginTop: '20px', borderTop: '1px dotted #cccccc', paddingTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Cambiar Estado Actual:</label>
              <select value={ticket.status} onChange={(e) => handleUpdateStatus(e.target.value)} className="crm-select-dropdown" style={{ width: '100%' }}>
                {statuses.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="crm-card-paper">
          <h3 className="crm-section-title" style={{ marginTop: 0 }}>Auditoría de Tiempos</h3>
          <p className="crm-text-muted"><strong>Fecha y Hora de Apertura:</strong> {new Date(ticket.created_at).toLocaleString()}</p>
          <p className="crm-text-muted"><strong>Fecha y Hora de Cierre:</strong> {ticket.closed_at ? new Date(ticket.closed_at).toLocaleString() : 'Abierto / En resolución'}</p>
          <p className="crm-text-muted"><strong>Estado Actual:</strong> <span className="crm-badge">{ticket.status}</span></p>
        </div>
      </div>

      <div className="crm-card-paper" style={{ marginTop: '24px' }}>
        <h3 className="crm-section-title" style={{ marginTop: 0 }}>Descripción Detallada del Problema</h3>
        {/* Utilizamos dangerouslySetInnerHTML para renderizar el HTML proveniente del scraper o notas normales */}
        <div style={{ margin: 0, fontSize: '15px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: ticket.description || 'No se han ingresado notas adicionales.' }} />
      </div>

    </div>
  );
}

export default TicketDetail;