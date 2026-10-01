import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function ClientsList() {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const handleCopyEmailTemplate = () => {
    const textToCopy = `Buenos dias,

Se creó un ticket de atención para este requerimiento.

Les avisare apenas tengamos alguna actualización.

Recordar enviarnos siempre las solicitudes a estos correos:

Atención General: soporte@enova.agency
Jefatura de Área: santiago@enova.agency

Saludos!`;

    navigator.clipboard.writeText(textToCopy)
      .then(() => alert('¡Mensaje copiado al portapapeles! 📧'))
      .catch(() => alert('No se pudo copiar el texto.'));
  };
  // FILTROS
  const [planFilter, setPlanFilter] = useState('ALL');
  const [techFilter, setTechFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // VISTA (grid o table)
  const [viewMode, setViewMode] = useState('grid');
  
  // Formulario nueva tienda
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    id: '', name: '', web: '', emails: '', phone: '', plan_type: 'GO', tecnologia: '', notes: '', logo_url: '', assigned_to: '' 
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = viewMode === 'table' ? 15 : 9;
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState('');
  const [showMyStoresOnly, setShowMyStoresOnly] = useState(false);

  const fetchClients = async () => {
    try {
      const storesRes = await crmApi.get('/stores');
      if (storesRes.data && storesRes.data.success) {
        setClients(storesRes.data.data);
        setFilteredClients(storesRes.data.data);
      }
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (token) {
      try {
        const payload = JSON.parse(window.atob(token.split('.')[1]));
        setCurrentUser(payload.name || payload.email || '');
      } catch (e) {}
    }
    fetchClients();
  }, []);

  useEffect(() => {
    let result = [...clients];
    
    // FILTRAR MIS TIENDAS ASIGNADAS
    if (showMyStoresOnly) {
      if (!currentUser || !currentUser.trim()) {
        result = [];
      } else {
        const userLower = currentUser.toLowerCase().trim();
        result = result.filter(c => {
          if (!c.assigned_to) return false;
          const asignados = String(c.assigned_to).toLowerCase().split(',').map(s => s.trim());
          return asignados.some(a => a.includes(userLower) || userLower.includes(a));
        });
      }
    }

    // Filtrar por Plan
    if (planFilter !== 'ALL') {
      result = result.filter(c => c.plan_type === planFilter);
    }

    // Filtrar por Tecnología
    if (techFilter !== 'ALL') {
      result = result.filter(c => {
        if (!c.tecnologia) return false;
        return c.tecnologia.toLowerCase() === techFilter.toLowerCase();
      });
    }
    
    // Búsqueda
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.id.toLowerCase().includes(query)
      );
    }

    const planPriority = {
      'ESCALE': 1,
      'GROWTH': 2,
      'GO': 3,
      'WARRANTY': 4,
      'LEAD': 5,
      'OUT_OF_WARRANTY': 6
    };

    result.sort((a, b) => {
      const priorityA = planPriority[a.plan_type] || 99;
      const priorityB = planPriority[b.plan_type] || 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return (a.name || '').localeCompare(b.name || '');
    });
    
    setFilteredClients(result);
    setCurrentPage(1);
  }, [planFilter, techFilter, searchQuery, clients, showMyStoresOnly, currentUser]);

  const getLogoUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const apiBase = crmApi.defaults.baseURL || '';
    const domain = apiBase.replace(/\/api$/, ''); 
    return `${domain}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const uploadData = new FormData();
    uploadData.append('logo', file);
    try {
      const response = await crmApi.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data.success) {
        setFormData(prev => ({ ...prev, logo_url: response.data.url }));
        alert('Imagen procesada y lista para adjuntar al cliente.');
      }
    } catch (error) {
      alert('Error al subir la imagen al servidor.');
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('El nombre de la tienda es obligatorio');
      return;
    }
    try {
      const dataToSend = { ...formData };
      if (!dataToSend.id.trim()) delete dataToSend.id;

      const response = await crmApi.post('/stores', dataToSend);
      if (response.data.success) {
        alert('Cliente registrado con éxito');
        setShowForm(false);
        setFormData({
          id: '', name: '', web: '', emails: '', phone: '', plan_type: 'GO', tecnologia: '', notes: '', logo_url: ''
        });
        fetchClients(); 
      }
    } catch (error) {
      alert('Error al registrar el cliente en el servidor.');
    }
  };

  const getTechBadgeStyle = (tech) => {
    const baseStyle = {
      padding: '2px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', marginLeft: '8px', display: 'inline-block', textTransform: 'uppercase'
    };
    if (!tech) return { ...baseStyle, backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db' }; 
    const t = tech.toLowerCase();
    if (t === 'shopify') return { ...baseStyle, backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }; 
    if (t === 'woocommerce') return { ...baseStyle, backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #e9d5ff' }; 
    if (t === 'vtex') return { ...baseStyle, backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }; 
    return { ...baseStyle, backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db' }; 
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredClients.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);

  if (loading) return <div className="crm-text-loading">Cargando listado...</div>;

  return (
    <div>
      <div className="crm-actions-bar" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Gestión de Clientes</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => { setShowMyStoresOnly(false); setCurrentPage(1); }}
              style={{ padding: '8px 16px', backgroundColor: !showMyStoresOnly ? '#111' : '#f3f4f6', color: !showMyStoresOnly ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px', fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              🏢 Todas las Tiendas
            </button>
            <button 
              onClick={() => { setShowMyStoresOnly(true); setCurrentPage(1); }}
              style={{ padding: '8px 16px', backgroundColor: showMyStoresOnly ? '#111' : '#f3f4f6', color: showMyStoresOnly ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px', fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              👤 Mis Tiendas Asignadas
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#e5e7eb', padding: '4px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '8px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', transition: 'all 0.2s',
                backgroundColor: viewMode === 'grid' ? '#111' : 'transparent',
                color: viewMode === 'grid' ? '#FFD700' : '#4b5563'
              }}
            >
              ⊞ Cuadrícula
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '8px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', transition: 'all 0.2s',
                backgroundColor: viewMode === 'table' ? '#111' : 'transparent',
                color: viewMode === 'table' ? '#FFD700' : '#4b5563'
              }}
            >
              ☰ Tabla
            </button>
          </div>

          <input 
            type="text"
            placeholder="Buscar por nombre o ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="crm-input-text"
          />

          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="crm-select-dropdown">
            <option value="ALL">Todos los planes</option>
            <option value="GO">GO</option>
            <option value="GROWTH">GROWTH</option>
            <option value="ESCALE">ESCALE</option>
            <option value="WARRANTY">WARRANTY</option>
            <option value="OUT_OF_WARRANTY">OUT OF WARRANTY</option>
            <option value="LEAD">LEAD</option>
          </select>

          <select value={techFilter} onChange={(e) => setTechFilter(e.target.value)} className="crm-select-dropdown">
            <option value="ALL">Todas las tecnologías</option>
            <option value="Shopify">Shopify</option>
            <option value="Woocommerce">WooCommerce</option>
            <option value="Vtex">VTEX</option>
            <option value="Magento">Magento</option>
            <option value="Custom">Custom / Propio</option>
          </select>

          <button 
  onClick={handleCopyEmailTemplate} 
  className="crm-btn-border" 
  title="Copiar plantilla de correo"
  style={{ padding: '8px 12px', fontSize: '16px', cursor: 'pointer' }}
>
  📧
</button>

<button onClick={() => setShowForm(!showForm)} className="crm-btn-black">
  {showForm ? 'Cancelar' : 'Nuevo Cliente'}
</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleFormSubmit} className="crm-card-paper" style={{ marginBottom: '32px' }}>
          <h3 className="crm-section-title" style={{ marginTop: 0 }}>Registrar Nueva Tienda / Cliente</h3>
          <div className="crm-grid-two-columns" style={{ gap: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="crm-stat-label">ID Personalizado (Opcional)</label>
              <input type="text" name="id" value={formData.id} onChange={handleInputChange} className="crm-input-text" placeholder="Generado automaticamente si se deja vacio" style={{ width: 'auto' }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="crm-stat-label">Nombre del Cliente / Tienda</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="crm-input-text" style={{ width: 'auto' }} required />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="crm-stat-label">Sitio Web</label>
              <input type="url" name="web" value={formData.web} onChange={handleInputChange} className="crm-input-text" placeholder="https://ejemplo.com" style={{ width: 'auto' }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="crm-stat-label">Correos de contacto</label>
              <input type="text" name="emails" value={formData.emails} onChange={handleInputChange} className="crm-input-text" style={{ width: 'auto' }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="crm-stat-label">Numero de contacto</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} className="crm-input-text" style={{ width: 'auto' }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="crm-stat-label">Tipo de Plan</label>
              <select name="plan_type" value={formData.plan_type} onChange={handleInputChange} className="crm-select-dropdown">
                <option value="GO">GO</option>
                <option value="GROWTH">GROWTH</option>
                <option value="ESCALE">ESCALE</option>
                <option value="WARRANTY">WARRANTY</option>
                <option value="OUT_OF_WARRANTY">OUT OF WARRANTY</option>
                <option value="LEAD">LEAD</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="crm-stat-label">Tecnología E-commerce</label>
              <select name="tecnologia" value={formData.tecnologia} onChange={handleInputChange} className="crm-select-dropdown">
                <option value="">Selecciona tecnología</option>
                <option value="Shopify">Shopify</option>
                <option value="Woocommerce">WooCommerce</option>
                <option value="Vtex">VTEX</option>
                <option value="Magento">Magento</option>
                <option value="Custom">Custom / Propio</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="crm-stat-label">Subir Logotipo de la Tienda</label>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="crm-input-text" style={{ width: 'auto', padding: '5px' }} />
              {formData.logo_url && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>✓ Imagen subida y lista para guardar</span>}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
              <label className="crm-stat-label">Notas o comentarios internos</label>
              <textarea name="notes" value={formData.notes} onChange={handleInputChange} className="crm-input-text" style={{ height: '60px', resize: 'none', width: 'auto' }} />
            </div>
          </div>
          <button type="submit" className="crm-btn-black">Guardar Cliente en Base de Datos</button>
        </form>
      )}

      {viewMode === 'grid' ? (
        <div className="crm-grid-three-columns">
          {currentItems.map(client => (
            <div 
              key={client.id} 
              className="crm-card-paper-clickable"
              onClick={() => navigate(`/admin/clientes/${client.id}`)}
            >
              <div className="crm-card-header-line" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', backgroundColor: '#f2f1ec', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #111111', overflow: 'hidden', flexShrink: 0 }}>
                  {client.logo_url ? (
                    <img src={getLogoUrl(client.logo_url)} alt={`Logo de ${client.name}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px' }}>
                      {client.name ? client.name.substring(0, 2).toUpperCase() : 'NA'}
                    </span>
                  )}
                </div>
                <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                    {client.name}
                  </h3>
                  <span className="crm-badge">{client.plan_type}</span>
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <p className="crm-text-muted" style={{ margin: '6px 0' }}><strong>ID:</strong> {client.id}</p>
                
                {/* 🌟 VISTA SOLO LECTURA DEL RESPONSABLE */}
                <div style={{ margin: '6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong className="crm-text-muted">Asignado a:</strong>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: client.assigned_to ? '#111' : '#6b7280', backgroundColor: client.assigned_to ? '#f3f4f6' : 'transparent', padding: '2px 6px', borderRadius: '4px' }}>
                    {client.assigned_to || 'Sin asignar'}
                  </span>
                </div>

                <p className="crm-text-muted" style={{ margin: '6px 0', display: 'flex', alignItems: 'center' }}>
                  <strong>Tecnología:</strong> 
                  <span style={getTechBadgeStyle(client.tecnologia)}>
                    {client.tecnologia || 'No indicada'}
                  </span>
                </p>
                <p className="crm-text-muted" style={{ margin: '6px 0' }}><strong>Web:</strong> {client.web || 'No indicada'}</p>
                <p className="crm-text-muted" style={{ margin: '6px 0' }}><strong>Tickets:</strong> {client.ticket_count}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px', boxShadow: '4px 4px 0px #111', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #111' }}>
              <tr>
                <th style={{ padding: '14px', fontWeight: '900', color: '#111', borderRight: '1px solid #e5e7eb', width: '50px' }}>Logo</th>
                <th style={{ padding: '14px', fontWeight: '900', color: '#111', borderRight: '1px solid #e5e7eb' }}>Tienda & ID</th>
                <th style={{ padding: '14px', fontWeight: '900', color: '#111', borderRight: '1px solid #e5e7eb' }}>Plan</th>
                <th style={{ padding: '14px', fontWeight: '900', color: '#111', borderRight: '1px solid #e5e7eb' }}>Responsable</th>
                <th style={{ padding: '14px', fontWeight: '900', color: '#111', borderRight: '1px solid #e5e7eb' }}>Tecnología</th>
                <th style={{ padding: '14px', fontWeight: '900', color: '#111', borderRight: '1px solid #e5e7eb' }}>Web</th>
                <th style={{ padding: '14px', fontWeight: '900', color: '#111', textAlign: 'center' }}>Tickets</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map(client => (
                <tr 
                  key={client.id}
                  onClick={() => navigate(`/admin/clientes/${client.id}`)}
                  style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer', transition: 'background-color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '10px 14px', borderRight: '1px solid #e5e7eb' }}>
                    <div style={{ width: '36px', height: '36px', backgroundColor: '#f2f1ec', border: '1px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: '4px' }}>
                      {client.logo_url ? (
                        <img src={getLogoUrl(client.logo_url)} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>
                          {client.name ? client.name.substring(0, 2).toUpperCase() : 'NA'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', borderRight: '1px solid #e5e7eb' }}>
                    <div style={{ fontWeight: 'bold', color: '#111', fontSize: '14px' }}>{client.name}</div>
                    <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>ID: {client.id}</div>
                  </td>
                  <td style={{ padding: '10px 14px', borderRight: '1px solid #e5e7eb' }}>
                    <span className="crm-badge">{client.plan_type}</span>
                  </td>
                  {/* 🌟 VISTA SOLO LECTURA DEL RESPONSABLE EN TABLA */}
                  <td style={{ padding: '10px 14px', borderRight: '1px solid #e5e7eb', color: '#111', fontWeight: 'bold', fontSize: '12px' }}>
                    {client.assigned_to ? (
                      <span style={{ backgroundColor: '#f3f4f6', padding: '4px 8px', borderRadius: '4px' }}>
                        {client.assigned_to}
                      </span>
                    ) : (
                      <span style={{ color: '#9ca3af', fontWeight: 'normal' }}>Sin asignar</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', borderRight: '1px solid #e5e7eb' }}>
                    <span style={getTechBadgeStyle(client.tecnologia)}>{client.tecnologia || 'No indicada'}</span>
                  </td>
                  <td style={{ padding: '10px 14px', borderRight: '1px solid #e5e7eb', color: '#4b5563' }}>
                    {client.web || '-'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold', color: '#111' }}>
                    {client.ticket_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredClients.length === 0 && (
        <div className="crm-text-loading" style={{ marginTop: '20px' }}>No se encontraron clientes con los criterios ingresados.</div>
      )}

      {totalPages > 1 && (
        <div className="crm-pagination-box">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="crm-btn-border"
          >
            Anterior
          </button>
          <span style={{ fontWeight: 'bold' }}>Página {currentPage} de {totalPages}</span>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="crm-btn-border"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}

export default ClientsList;