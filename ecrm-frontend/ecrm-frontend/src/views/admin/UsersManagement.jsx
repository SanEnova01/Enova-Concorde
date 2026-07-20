import React, { useState, useEffect } from 'react';
import crmApi from '../../api/crmApi';

function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para el Modal
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Datos del formulario
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'client'
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await crmApi.get('/users');
      if (response.data && response.data.success) {
        setUsers(response.data.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setCurrentUser(null);
    setFormData({ name: '', email: '', password: '', role: 'client' });
    setShowModal(true);
  };

  const handleOpenEdit = (user) => {
    setIsEditing(true);
    setCurrentUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Se deja vacío para que solo se actualice si se escribe algo nuevo
      role: user.role
    });
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`¿Estás súper seguro de eliminar la cuenta de ${name}? Esta acción no se puede deshacer.`)) {
      try {
        await crmApi.delete(`/users/${id}`);
        fetchUsers();
      } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Hubo un error al intentar eliminar el usuario.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        // Petición PUT para editar
        await crmApi.put(`/users/${currentUser.id}`, formData);
        alert('Usuario actualizado correctamente.');
      } else {
        // Petición POST para crear
        await crmApi.post('/users', formData);
        alert('Usuario creado exitosamente.');
      }
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      console.error('Error guardando usuario:', error);
      alert(error.response?.data?.error || 'Ocurrió un error al guardar los datos.');
    }
  };

  if (loading) return <div className="crm-text-loading">Cargando base de datos de usuarios...</div>;

  return (
    <div>
      <div className="crm-actions-bar">
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Gestor de Cuentas (Super Admin)</h1>
        <button onClick={handleOpenCreate} className="crm-btn-black">Crear Nuevo Usuario</button>
      </div>

      <div className="crm-card-paper crm-table-container">
        <table className="crm-table-data">
          <thead>
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
            {users.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#666' }}>No hay usuarios registrados.</td>
              </tr>
            ) : (
              users.map(u => (
                <tr key={u.id} className="crm-table-row-interactive">
                  <td style={{ fontWeight: 'bold' }}>{u.id}</td>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className="crm-badge" style={{ 
                    backgroundColor: u.role === 'super admin' ? '#fee2e2' : u.role === 'admin' ? '#e0e7ff' : '#f3f4f6',
                    color: u.role === 'super admin' ? '#991b1b' : u.role === 'admin' ? '#3730a3' : '#1f2937',
                    border: 'none'
                  }}>{u.role.toUpperCase()}</span></td>
                  <td style={{ fontSize: '12px' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => handleOpenEdit(u)} className="crm-btn-border" style={{ padding: '6px 12px', marginRight: '8px' }}>Editar</button>
                    <button onClick={() => handleDelete(u.id, u.name)} className="crm-btn-red" style={{ padding: '6px 12px' }}>Borrar</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CREACIÓN / EDICIÓN */}
      {showModal && (
        <div className="crm-modal-mask" onClick={() => setShowModal(false)}>
          <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="crm-section-title" style={{ marginTop: 0 }}>
              {isEditing ? 'Editar Cuenta de Usuario' : 'Registrar Nuevo Usuario'}
            </h3>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Nombre Completo</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="crm-input-text" required />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Correo Electrónico de Acceso</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="crm-input-text" required />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Nivel de Acceso (Rol)</label>
                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="crm-select-dropdown">
                  <option value="client">Cliente / Marca (Solo ve su tienda)</option>
                  <option value="admin">Administrador (Agencia Operativa)</option>
                  <option value="super admin">Super Admin (Control Total)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px dashed #ccc' }}>
                <label className="crm-stat-label" style={{ color: '#d9534f' }}>
                  {isEditing ? 'Restablecer Contraseña' : 'Crear Contraseña'}
                </label>
                <input 
                  type="text" 
                  placeholder={isEditing ? "Deja en blanco para no cambiarla" : "Escribe una contraseña..."} 
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                  className="crm-input-text" 
                  required={!isEditing} 
                />
                {isEditing && <span style={{ fontSize: '11px', color: '#666' }}>Si el cliente olvidó su clave, escribe una nueva aquí. Se sobreescribirá la anterior.</span>}
              </div>

              <div className="crm-pagination-box" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
                <button type="submit" className="crm-btn-black">{isEditing ? 'Guardar Cambios' : 'Crear Cuenta'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="crm-btn-border">Cancelar</button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersManagement;