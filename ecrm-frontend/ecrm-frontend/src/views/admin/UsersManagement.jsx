import React, { useState, useEffect } from 'react';
import crmApi from '../../api/crmApi';

// Componente reutilizable para inputs
const FormInput = ({ label, type = "text", value, onChange, placeholder, required = false, description }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
    <label className="crm-stat-label">{label}</label>
    <input type={type} value={value} onChange={onChange} className="crm-input-text" placeholder={placeholder} required={required} />
    {description && <span style={{ fontSize: '11px', color: '#666' }}>{description}</span>}
  </div>
);

function UsersManagement() {
  // Estados de datos
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [tickets, setTickets] = useState([]);
  
  // Estados de la UI
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('TEAM'); // 'TEAM' | 'CLIENTS'
  
  // Estados de Modales
  const [showFormModal, setShowFormModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const initialFormState = { name: '', email: '', password: '', role: 'client' };
  const [formData, setFormData] = useState(initialFormState);

  // 🌟 Cargar todos los datos necesarios para cruzar información
  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, storesRes, ticketsRes] = await Promise.all([
        crmApi.get('/users').catch(() => ({ data: { success: false, data: [] } })),
        crmApi.get('/stores').catch(() => ({ data: { success: false, data: [] } })),
        crmApi.get('/tickets').catch(() => ({ data: { success: false, data: [] } }))
      ]);

      if (usersRes.data?.success) setUsers(usersRes.data.data);
      if (storesRes.data?.success) setStores(Array.isArray(storesRes.data.data) ? storesRes.data.data : []);
      if (ticketsRes.data?.success) setTickets(Array.isArray(ticketsRes.data.data) ? ticketsRes.data.data : []);
      
    } catch (error) {
      console.error('Error cargando la vista de usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 🌟 FILTROS POR PESTAÑAS
  const filteredUsers = users.filter(u => {
    if (activeTab === 'TEAM') return u.role === 'admin' || u.role === 'super admin';
    return u.role === 'client';
  });

  // 🌟 FUNCIONES DE MODALES
  const handleOpenForm = (user = null) => {
    if (user) {
      setIsEditing(true);
      setCurrentUser(user);
      setFormData({ name: user.name, email: user.email, password: '', role: user.role });
    } else {
      setIsEditing(false);
      setCurrentUser(null);
      setFormData({ ...initialFormState, role: activeTab === 'TEAM' ? 'admin' : 'client' });
    }
    setShowFormModal(true);
  };

  const handleOpenStats = (user) => {
    setCurrentUser(user);
    setShowStatsModal(true);
  };

  const closeModals = () => {
    setShowFormModal(false);
    setShowStatsModal(false);
    setCurrentUser(null);
  };

  // 🌟 ACCIONES CRUD
  const handleDelete = async (id, name) => {
    if (window.confirm(`¿Estás seguro de eliminar a ${name}?`)) {
      setIsSubmitting(true);
      try {
        await crmApi.delete(`/users/${id}`);
        setUsers(prev => prev.filter(u => u.id !== id));
        alert(`Usuario eliminado.`);
      } catch (error) {
        alert('Error al eliminar.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await crmApi.put(`/users/${currentUser.id}`, formData);
        alert('Actualizado correctamente.');
      } else {
        await crmApi.post('/users', formData);
        alert('Creado exitosamente.');
      }
      closeModals();
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al guardar los datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🌟 LÓGICA DE ESTADÍSTICAS DEL USUARIO
  const getUserStats = (user) => {
    if (!user) return null;
    const nameLower = user.name.toLowerCase();

    // Tiendas asignadas a este usuario
    const myStores = stores.filter(s => s.assigned_to && s.assigned_to.toLowerCase().includes(nameLower));
    
    // Tickets asignados a este usuario
    const myTickets = tickets.filter(t => t.assigned_to && t.assigned_to.toLowerCase().includes(nameLower));
    const openTickets = myTickets.filter(t => t.status !== 'CLOSED' && t.status !== 'RESOLVED').length;
    const resolvedTickets = myTickets.filter(t => t.status === 'CLOSED' || t.status === 'RESOLVED').length;

    // Última actividad (Buscamos el ticket más reciente que tenga asignado)
    let lastActivity = new Date(user.created_at);
    if (myTickets.length > 0) {
      const sortedTickets = [...myTickets].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
      const latestDate = new Date(sortedTickets[0].updated_at || sortedTickets[0].created_at);
      if (latestDate > lastActivity) lastActivity = latestDate;
    }

    return { myStores, openTickets, resolvedTickets, totalTickets: myTickets.length, lastActivity };
  };

  if (loading) return <div className="crm-text-loading">Cargando base de datos global...</div>;

  const stats = getUserStats(currentUser);

  return (
    <div>
      {/* 🌟 CABECERA Y PESTAÑAS */}
      <div className="crm-actions-bar" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Gestión de Accesos</h1>
          <button onClick={() => handleOpenForm()} className="crm-btn-black" disabled={isSubmitting}>
            + Nuevo Usuario
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e5e7eb', width: '100%', paddingBottom: '8px' }}>
          <button 
            onClick={() => setActiveTab('TEAM')}
            style={{ padding: '8px 16px', backgroundColor: activeTab === 'TEAM' ? '#111' : '#f3f4f6', color: activeTab === 'TEAM' ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px', fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            👨‍💻 Equipo Interno (Admins)
          </button>
          <button 
            onClick={() => setActiveTab('CLIENTS')}
            style={{ padding: '8px 16px', backgroundColor: activeTab === 'CLIENTS' ? '#111' : '#f3f4f6', color: activeTab === 'CLIENTS' ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px', fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            🛒 Clientes / Marcas
          </button>
        </div>
      </div>

      {/* 🌟 TABLA ESTANDARIZADA */}
      <div className="crm-card-paper crm-table-container">
        <table className="crm-table-data">
          <thead style={{ backgroundColor: '#f9fafb' }}>
            <tr>
              <th>ID</th>
              <th>Nombre Completo</th>
              <th>Correo Electrónico</th>
              <th>Nivel de Acceso</th>
              <th>Fecha de Creación</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#666' }}>No hay usuarios en esta categoría.</td>
              </tr>
            ) : (
              filteredUsers.map(u => (
                <tr key={u.id} className="crm-table-row-interactive">
                  <td style={{ fontWeight: 'bold' }}>{u.id}</td>
                  <td style={{ fontWeight: 'bold', color: '#111' }}>{u.name}</td>
                  <td style={{ color: '#4b5563' }}>{u.email}</td>
                  <td>
                    <span className="crm-badge" style={{ 
                      backgroundColor: u.role === 'super admin' ? '#fee2e2' : u.role === 'admin' ? '#e0e7ff' : '#f3f4f6',
                      color: u.role === 'super admin' ? '#991b1b' : u.role === 'admin' ? '#3730a3' : '#1f2937'
                    }}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: '#666' }}>
                    {new Date(u.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {activeTab === 'TEAM' && (
                      <button onClick={() => handleOpenStats(u)} className="crm-btn-border" style={{ padding: '6px 12px', marginRight: '8px', backgroundColor: '#fefce8', borderColor: '#fef08a' }}>
                        📊 Perfil
                      </button>
                    )}
                    <button onClick={() => handleOpenForm(u)} className="crm-btn-border" style={{ padding: '6px 12px', marginRight: '8px' }} disabled={isSubmitting}>
                      Editar
                    </button>
                    <button onClick={() => handleDelete(u.id, u.name)} className="crm-btn-red" style={{ padding: '6px 12px' }} disabled={isSubmitting}>
                      Borrar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 🌟 MODAL: CREAR / EDITAR USUARIO */}
      {showFormModal && (
        <div className="crm-modal-mask" onClick={closeModals}>
          <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="crm-section-title" style={{ marginTop: 0 }}>
              {isEditing ? 'Editar Cuenta de Usuario' : 'Registrar Nuevo Usuario'}
            </h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <FormInput label="Nombre Completo" value={formData.name} onChange={handleInputChange('name')} required />
              <FormInput label="Correo Electrónico" type="email" value={formData.email} onChange={handleInputChange('email')} required />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Nivel de Acceso (Rol)</label>
                <select value={formData.role} onChange={handleInputChange('role')} className="crm-select-dropdown">
                  <option value="client">Cliente / Marca (Solo ve su tienda)</option>
                  <option value="admin">Administrador (Agencia Operativa)</option>
                  <option value="super admin">Super Admin (Control Total)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px dashed #ccc' }}>
                <FormInput 
                  label={isEditing ? 'Restablecer Contraseña' : 'Crear Contraseña'}
                  type="text" value={formData.password} onChange={handleInputChange('password')} 
                  placeholder={isEditing ? "Deja en blanco para no cambiarla" : "Escribe una contraseña..."}
                  required={!isEditing}
                  description={isEditing ? "Escribe aquí para sobrescribir la contraseña actual." : null}
                />
              </div>

              <div className="crm-pagination-box" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
                <button type="submit" className="crm-btn-black" disabled={isSubmitting}>
                  {isSubmitting ? 'Procesando...' : (isEditing ? 'Guardar Cambios' : 'Crear Cuenta')}
                </button>
                <button type="button" onClick={closeModals} className="crm-btn-border">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 MODAL: ESTADÍSTICAS Y ASIGNACIONES */}
      {showStatsModal && currentUser && stats && (
        <div className="crm-modal-mask" onClick={closeModals}>
          <div className="crm-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
            
            <div style={{ borderBottom: '2px solid #111', paddingBottom: '16px', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontWeight: '900', fontSize: '24px' }}>{currentUser.name}</h2>
              <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '13px' }}>{currentUser.email} • {currentUser.role.toUpperCase()}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Carga de Tickets</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginTop: '8px' }}>
                  <span style={{ fontSize: '32px', fontWeight: '900', lineHeight: '1' }}>{stats.totalTickets}</span>
                  <span style={{ fontSize: '12px', color: '#666', paddingBottom: '4px' }}>Históricos</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <span style={{ fontSize: '11px', backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{stats.openTickets} Abiertos</span>
                  <span style={{ fontSize: '11px', backgroundColor: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{stats.resolvedTickets} Cerrados</span>
                </div>
              </div>

              <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Última Actividad</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111', marginTop: '8px' }}>
                  {stats.lastActivity.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                  {stats.lastActivity.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '900', margin: '0 0 12px 0' }}>Tiendas Asignadas ({stats.myStores.length})</h3>
              {stats.myStores.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f3f4f6', borderRadius: '8px', color: '#666', fontSize: '13px' }}>
                  Este usuario no tiene tiendas asignadas en este momento.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                  {stats.myStores.map(store => (
                    <span key={store.id} style={{ padding: '6px 12px', backgroundColor: '#111', color: '#FFD700', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                      🏢 {store.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              <button onClick={closeModals} className="crm-btn-black">Cerrar Perfil</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default UsersManagement;