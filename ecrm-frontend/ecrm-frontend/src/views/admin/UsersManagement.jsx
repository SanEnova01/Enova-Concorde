import React, { useState, useEffect } from 'react';
import crmApi from '../../api/crmApi';

// Componente reutilizable para los inputs del formulario
const FormInput = ({ label, type = "text", value, onChange, placeholder, required = false, description }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
    <label className="crm-stat-label">{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      className="crm-input-text"
      placeholder={placeholder}
      required={required}
    />
    {description && <span style={{ fontSize: '11px', color: '#666' }}>{description}</span>}
  </div>
);

function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // Estado para deshabilitar botones durante peticiones
  
  // Estados para el Modal
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Datos del formulario
  const initialFormState = { name: '', email: '', password: '', role: 'client' };
  const [formData, setFormData] = useState(initialFormState);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await crmApi.get('/users');
      if (response?.data?.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      alert('Error al cargar la lista de usuarios. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenModal = (user = null) => {
    if (user) {
      setIsEditing(true);
      setCurrentUser(user);
      setFormData({ name: user.name, email: user.email, password: '', role: user.role });
    } else {
      setIsEditing(false);
      setCurrentUser(null);
      setFormData(initialFormState);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData(initialFormState);
    setCurrentUser(null);
    setIsEditing(false);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`¿Estás súper seguro de eliminar la cuenta de ${name}? Esta acción no se puede deshacer.`)) {
      setIsSubmitting(true);
      try {
        await crmApi.delete(`/users/${id}`);
        setUsers(prevUsers => prevUsers.filter(user => user.id !== id)); // Optimistic UI update
        alert(`Usuario ${name} eliminado correctamente.`);
      } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Hubo un error al intentar eliminar el usuario. Revise la consola.');
        fetchUsers(); // Revert optimistic update on failure
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleInputChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await crmApi.put(`/users/${currentUser.id}`, formData);
        alert('Usuario actualizado correctamente.');
      } else {
        await crmApi.post('/users', formData);
        alert('Usuario creado exitosamente.');
      }
      handleCloseModal();
      fetchUsers();
    } catch (error) {
      console.error('Error guardando usuario:', error);
      alert(error.response?.data?.error || 'Ocurrió un error al guardar los datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Función auxiliar para obtener el color del badge según el rol
  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'super admin': return { backgroundColor: '#fee2e2', color: '#991b1b' };
      case 'admin': return { backgroundColor: '#e0e7ff', color: '#3730a3' };
      default: return { backgroundColor: '#f3f4f6', color: '#1f2937' };
    }
  };

  if (loading) return <div className="crm-text-loading">Cargando base de datos de usuarios...</div>;

  return (
    <div>
      <div className="crm-actions-bar">
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Gestor de Cuentas (Super Admin)</h1>
        <button onClick={() => handleOpenModal()} className="crm-btn-black" disabled={isSubmitting}>
          Crear Nuevo Usuario
        </button>
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
                  <td>
                    <span className="crm-badge" style={{ ...getRoleBadgeStyle(u.role), border: 'none' }}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px' }}>{new Date(u.created_at).toLocaleDateString('es-ES')}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      onClick={() => handleOpenModal(u)} 
                      className="crm-btn-border" 
                      style={{ padding: '6px 12px', marginRight: '8px' }}
                      disabled={isSubmitting}
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDelete(u.id, u.name)} 
                      className="crm-btn-red" 
                      style={{ padding: '6px 12px' }}
                      disabled={isSubmitting}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="crm-modal-mask" onClick={handleCloseModal}>
          <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="crm-section-title" style={{ marginTop: 0 }}>
              {isEditing ? 'Editar Cuenta de Usuario' : 'Registrar Nuevo Usuario'}
            </h3>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <FormInput 
                label="Nombre Completo" 
                value={formData.name} 
                onChange={handleInputChange('name')} 
                required 
              />
              
              <FormInput 
                label="Correo Electrónico de Acceso" 
                type="email" 
                value={formData.email} 
                onChange={handleInputChange('email')} 
                required 
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Nivel de Acceso (Rol)</label>
                <select 
                  value={formData.role} 
                  onChange={handleInputChange('role')} 
                  className="crm-select-dropdown"
                >
                  <option value="client">Cliente / Marca (Solo ve su tienda)</option>
                  <option value="admin">Administrador (Agencia Operativa)</option>
                  <option value="super admin">Super Admin (Control Total)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px dashed #ccc' }}>
                <FormInput 
                  label={isEditing ? 'Restablecer Contraseña' : 'Crear Contraseña'}
                  type="text" 
                  value={formData.password} 
                  onChange={handleInputChange('password')} 
                  placeholder={isEditing ? "Deja en blanco para no cambiarla" : "Escribe una contraseña..."}
                  required={!isEditing}
                  description={isEditing ? "Si el cliente olvidó su clave, escribe una nueva aquí. Se sobreescribirá la anterior." : null}
                />
              </div>

              <div className="crm-pagination-box" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
                <button type="submit" className="crm-btn-black" disabled={isSubmitting}>
                  {isSubmitting ? 'Procesando...' : (isEditing ? 'Guardar Cambios' : 'Crear Cuenta')}
                </button>
                <button type="button" onClick={handleCloseModal} className="crm-btn-border" disabled={isSubmitting}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersManagement;