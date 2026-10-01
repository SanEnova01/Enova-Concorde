import React, { useState, useEffect, useMemo } from 'react';
import crmApi from '../../api/crmApi';

const FormInput = ({ label, type = "text", value, onChange, placeholder, required = false, description }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
    <label className="crm-stat-label">{label}</label>
    <input type={type} value={value} onChange={onChange} className="crm-input-text" placeholder={placeholder} required={required} />
    {description && <span style={{ fontSize: '11px', color: '#666' }}>{description}</span>}
  </div>
);

function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [allStores, setAllStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('TEAM'); 
  
  const [showFormModal, setShowFormModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [userStats, setUserStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // 🌟 ESTADO PARA BÚSQUEDA PREDICTIVA DE TIENDAS
  const [storeSearch, setStoreSearch] = useState('');

  const initialFormState = { name: '', email: '', password: '', role: 'client' };
  const [formData, setFormData] = useState(initialFormState);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await crmApi.get('/users');
      if (response.data?.success) setUsers(response.data.data);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const res = await crmApi.get('/stores');
      if (res.data?.success) setAllStores(res.data.data || []);
    } catch (e) {
      console.error('Error cargando tiendas:', e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchStores();
  }, []);

  const handleInputChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const filteredUsers = users.filter(u => {
    const r = String(u.role).toLowerCase().trim();
    if (activeTab === 'TEAM') return r === 'admin' || r === 'super admin';
    return r === 'client';
  });

  // 🌟 FILTRADO PREDICTIVO DE TIENDAS
  const filteredStoresToAssign = useMemo(() => {
    const query = storeSearch.toLowerCase().trim();
    if (!query) return allStores;
    return allStores.filter(store => {
      const nameMatch = store.name && store.name.toLowerCase().includes(query);
      const idMatch = store.id && String(store.id).toLowerCase().includes(query);
      const planMatch = store.plan_type && store.plan_type.toLowerCase().includes(query);
      return nameMatch || idMatch || planMatch;
    });
  }, [allStores, storeSearch]);

  const handleOpenForm = (user = null) => {
    if (user) {
      setIsEditing(true);
      setCurrentUser(user);
      setFormData({ name: user.name || '', email: user.email || '', password: '', role: user.role || 'client' });
    } else {
      setIsEditing(false);
      setCurrentUser(null);
      setFormData({ ...initialFormState, role: activeTab === 'TEAM' ? 'admin' : 'client' });
    }
    setShowFormModal(true);
  };

  const handleOpenStats = async (user) => {
    setCurrentUser(user);
    setStoreSearch('');
    setShowStatsModal(true);
    setLoadingStats(true);
    try {
      const res = await crmApi.get(`/users/${user.id}/stats`);
      if (res.data.success) {
        const stats = res.data.data;
        stats.lastActivity = stats.lastActivity ? new Date(stats.lastActivity) : new Date();
        setUserStats(stats);
      }
    } catch (error) {
      console.error("Error obteniendo estadísticas:", error);
      alert("No se pudieron cargar las métricas de este usuario.");
      setShowStatsModal(false);
    } finally {
      setLoadingStats(false);
    }
  };

  // 🌟 CAMBIO INDIVIDUAL DE TIENDA
  const handleToggleStoreAssignment = async (store) => {
    if (!currentUser || isSubmitting) return;
    const userName = currentUser.name;
    const currentAssignees = store.assigned_to 
      ? store.assigned_to.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    
    const isAssigned = currentAssignees.some(a => a.toLowerCase() === userName.toLowerCase());
    
    let newAssignees;
    if (isAssigned) {
      newAssignees = currentAssignees.filter(a => a.toLowerCase() !== userName.toLowerCase());
    } else {
      newAssignees = [...currentAssignees, userName];
    }

    const newAssignedToString = newAssignees.join(', ');

    try {
      await crmApi.put(`/stores/${store.id}`, { assigned_to: newAssignedToString });
      
      setAllStores(prev => prev.map(s => s.id === store.id ? { ...s, assigned_to: newAssignedToString } : s));

      setUserStats(prev => {
        if (!prev) return prev;
        const updatedMyStores = isAssigned
          ? prev.myStores.filter(s => s.id !== store.id)
          : [...prev.myStores, { ...store, assigned_to: newAssignedToString }];
        return { ...prev, myStores: updatedMyStores };
      });
    } catch (err) {
      alert("Error al actualizar la asignación de la tienda.");
    }
  };

  // 🌟 ACCIÓN MASIVA (BULK ASSIGN) PARA ASIGNAR/DESASIGNAR CIENTOS DE TIENDAS EN LOTE
  const handleBulkAssign = async (storesToUpdate, shouldAssign) => {
    if (!currentUser || storesToUpdate.length === 0 || isSubmitting) return;
    const userName = currentUser.name;
    setIsSubmitting(true);

    try {
      await Promise.all(
        storesToUpdate.map(store => {
          const currentAssignees = store.assigned_to
            ? store.assigned_to.split(',').map(s => s.trim()).filter(Boolean)
            : [];
          
          const isAssigned = currentAssignees.some(a => a.toLowerCase() === userName.toLowerCase());

          if (shouldAssign && !isAssigned) {
            const newAssignees = [...currentAssignees, userName].join(', ');
            return crmApi.put(`/stores/${store.id}`, { assigned_to: newAssignees });
          } else if (!shouldAssign && isAssigned) {
            const newAssignees = currentAssignees.filter(a => a.toLowerCase() !== userName.toLowerCase()).join(', ');
            return crmApi.put(`/stores/${store.id}`, { assigned_to: newAssignees });
          }
          return Promise.resolve();
        })
      );

      await fetchStores();
      const res = await crmApi.get(`/users/${currentUser.id}/stats`);
      if (res.data?.success) {
        const stats = res.data.data;
        stats.lastActivity = stats.lastActivity ? new Date(stats.lastActivity) : new Date();
        setUserStats(stats);
      }
    } catch (err) {
      alert("Error procesando la asignación masiva de tiendas.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModals = () => {
    setShowFormModal(false);
    setShowStatsModal(false);
    setCurrentUser(null);
    setUserStats(null);
    setStoreSearch('');
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`¿Estás seguro de eliminar a ${name}?`)) {
      setIsSubmitting(true);
      try {
        await crmApi.delete(`/users/${id}`);
        setUsers(prev => prev.filter(u => u.id !== id));
      } catch (error) {
        alert('Error al eliminar el usuario.');
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
      } else {
        await crmApi.post('/users', formData);
      }
      closeModals();
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al guardar los datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="crm-text-loading">Cargando base de datos global...</div>;

  return (
    <div>
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
            style={{ padding: '8px 16px', backgroundColor: activeTab === 'TEAM' ? '#111' : '#f3f4f6', color: activeTab === 'TEAM' ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px', fontWeight: '900', cursor: 'pointer' }}
          >
            👨‍💻 Equipo Interno (Admins)
          </button>
          <button 
            onClick={() => setActiveTab('CLIENTS')}
            style={{ padding: '8px 16px', backgroundColor: activeTab === 'CLIENTS' ? '#111' : '#f3f4f6', color: activeTab === 'CLIENTS' ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px', fontWeight: '900', cursor: 'pointer' }}
          >
            🛒 Clientes / Marcas
          </button>
        </div>
      </div>

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
                      backgroundColor: String(u.role).toLowerCase() === 'super admin' ? '#fee2e2' : String(u.role).toLowerCase() === 'admin' ? '#e0e7ff' : '#f3f4f6',
                      color: String(u.role).toLowerCase() === 'super admin' ? '#991b1b' : String(u.role).toLowerCase() === 'admin' ? '#3730a3' : '#1f2937'
                    }}>
                      {String(u.role).toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: '#666' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No registrada'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {activeTab === 'TEAM' && (
                      <button onClick={() => handleOpenStats(u)} className="crm-btn-border" style={{ padding: '6px 12px', marginRight: '8px', backgroundColor: '#fefce8', borderColor: '#fef08a' }}>
                        📊 Perfil / Stats
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

      {showStatsModal && currentUser && (
        <div className="crm-modal-mask" onClick={closeModals}>
          <div className="crm-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', width: '90%' }}>
            <div style={{ borderBottom: '2px solid #111', paddingBottom: '16px', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontWeight: '900', fontSize: '24px' }}>{currentUser.name}</h2>
              <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '13px' }}>{currentUser.email} • {String(currentUser.role).toUpperCase()}</p>
            </div>

            {loadingStats ? (
              <div className="crm-text-loading" style={{ padding: '40px' }}>Calculando métricas en el servidor...</div>
            ) : userStats ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Carga de Tickets</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginTop: '8px' }}>
                      <span style={{ fontSize: '32px', fontWeight: '900', lineHeight: '1' }}>{userStats.totalTickets}</span>
                      <span style={{ fontSize: '12px', color: '#666', paddingBottom: '4px' }}>Históricos</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <span style={{ fontSize: '11px', backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{userStats.openTickets} Abiertos</span>
                      <span style={{ fontSize: '11px', backgroundColor: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{userStats.resolvedTickets} Cerrados</span>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' }}>Última Actividad</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111', marginTop: '8px' }}>
                      {userStats.lastActivity.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                      {userStats.lastActivity.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* 🌟 GESTIÓN DE TIENDAS CON BÚSQUEDA PREDICTIVA Y ACCIONES MASIVAS */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '900', margin: 0 }}>
                      Tiendas Asignadas ({userStats.myStores.length})
                    </h3>
                  </div>

                  {userStats.myStores.length === 0 ? (
                    <div style={{ padding: '12px', textAlign: 'center', backgroundColor: '#f3f4f6', borderRadius: '8px', color: '#666', fontSize: '13px', marginBottom: '12px' }}>
                      Este usuario no tiene tiendas asignadas en este momento.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', maxHeight: '120px', overflowY: 'auto', paddingRight: '4px' }}>
                      {userStats.myStores.map(store => (
                        <span key={store.id} style={{ padding: '6px 12px', backgroundColor: '#111', color: '#FFD700', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          🏢 {store.name}
                          <button 
                            onClick={() => handleToggleStoreAssignment(store)} 
                            disabled={isSubmitting}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontWeight: 'bold', fontSize: '14px', lineHeight: 1 }}
                            title="Desasignar tienda"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 🔍 PANEL DE BÚSQUEDA PREDICTIVA Y SELECCIÓN EN LOTE */}
                  <div style={{ backgroundColor: '#f9fafb', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <label className="crm-stat-label" style={{ fontWeight: 'bold', margin: 0 }}>
                        ➕ Buscar y Asignar Tiendas ({allStores.length} en catálogo):
                      </label>

                      {filteredStoresToAssign.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleBulkAssign(filteredStoresToAssign, true)}
                            style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: '#111', color: '#FFD700', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            title="Asignar todas las tiendas que coinciden con la búsqueda actual"
                          >
                            + Asignar {filteredStoresToAssign.length} visibles
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleBulkAssign(filteredStoresToAssign, false)}
                            style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            title="Desasignar todas las tiendas que coinciden con la búsqueda actual"
                          >
                            - Quitar {filteredStoresToAssign.length} visibles
                          </button>
                        </div>
                      )}
                    </div>

                    <input 
                      type="text"
                      placeholder="🔍 Escribe para buscar tienda por nombre, ID o plan (ej. GO, Escale, #102)..."
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      className="crm-input-text"
                      style={{ marginBottom: '10px', width: '100%', boxSizing: 'border-box' }}
                    />

                    <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {filteredStoresToAssign.length === 0 ? (
                        <span style={{ fontSize: '12px', color: '#9ca3af', padding: '12px', textAlign: 'center' }}>
                          No se encontraron tiendas que coincidan con "{storeSearch}"
                        </span>
                      ) : (
                        filteredStoresToAssign.slice(0, 100).map(store => {
                          const isAssigned = (store.assigned_to || '')
                            .split(',')
                            .map(s => s.trim().toLowerCase())
                            .includes(currentUser.name.toLowerCase());

                          return (
                            <label key={store.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px', backgroundColor: isAssigned ? '#edf2f7' : 'transparent' }}>
                              <input 
                                type="checkbox"
                                checked={isAssigned}
                                disabled={isSubmitting}
                                onChange={() => handleToggleStoreAssignment(store)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                              <span style={{ fontWeight: isAssigned ? 'bold' : 'normal', color: isAssigned ? '#111' : '#4b5563' }}>
                                {store.name} <span style={{ fontSize: '10px', color: '#6b7280' }}>({store.id} • {store.plan_type || 'SIN PLAN'})</span>
                              </span>
                            </label>
                          );
                        })
                      )}

                      {filteredStoresToAssign.length > 100 && (
                        <span style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', padding: '6px 0', borderTop: '1px solid #e5e7eb' }}>
                          ℹ️ Mostrando 100 de {filteredStoresToAssign.length} coincidencias. Escribe más en el buscador para afinar.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

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