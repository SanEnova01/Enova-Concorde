import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function ClientsList() {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estado para el formulario de nueva tienda
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    web: '',
    emails: '',
    phone: '',
    plan_type: 'GO',
    tecnologia: '',
    notes: '',
    logo_url: '' // Aquí guardaremos la ruta devuelta por el servidor
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9; 

  const navigate = useNavigate();

  const fetchClients = async () => {
    try {
      const response = await crmApi.get('/stores');
      if (response.data.success) {
        setClients(response.data.data);
        setFilteredClients(response.data.data);
      }
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    let result = clients;
    
    if (planFilter !== 'ALL') {
      result = result.filter(c => c.plan_type === planFilter);
    }
    
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.id.toLowerCase().includes(query)
      );
    }
    
    setFilteredClients(result);
    setCurrentPage(1);
  }, [planFilter, searchQuery, clients]);

  // =================================================================
  // RESOLUTOR DE LOGO (Construye la URL absoluta para el listado)
  // =================================================================
  const getLogoUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const apiBase = crmApi.defaults.baseURL || '';
    const domain = apiBase.replace(/\/api$/, ''); 
    return `${domain}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // =================================================================
  // NUEVA FUNCIÓN: Subir imagen al servidor usando Multer
  // =================================================================
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
      console.error("Error al subir el logo:", error);
      alert('Error al subir la imagen al servidor. Revisa tu consola.');
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
          id: '',
          name: '',
          web: '',
          emails: '',
          phone: '',
          plan_type: 'GO',
          tecnologia: '',
          notes: '',
          logo_url: '',
        });
        fetchClients(); 
      }
    } catch (error) {
      console.error(error);
      alert('Error al registrar el cliente en el servidor.');
    }
  };

  // =================================================================
  // ESTILOS PARA BADGE DE TECNOLOGÍA
  // =================================================================
  const getTechBadgeStyle = (tech) => {
    const baseStyle = {
      padding: '2px 10px',
      borderRadius: '12px', // Esquinas redondeadas
      fontSize: '10px',
      fontWeight: 'bold',
      marginLeft: '8px',
      display: 'inline-block',
      textTransform: 'uppercase'
    };

    if (!tech) return { ...baseStyle, backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db' }; // Gris

    const t = tech.toLowerCase();
    if (t === 'shopify') {
      return { ...baseStyle, backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }; // Verde
    } else if (t === 'woocommerce') {
      return { ...baseStyle, backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #e9d5ff' }; // Morado
    } else if (t === 'vtex') {
      return { ...baseStyle, backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }; // Rojo
    } else {
      return { ...baseStyle, backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db' }; // Gris (Magento, Custom, etc.)
    }
  };

  // Calculos de paginacion
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredClients.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);

  if (loading) return <div className="crm-text-loading">Cargando listado...</div>;

  return (
    <div>
      {/* Barra de Acciones y Filtros */}
      <div className="crm-actions-bar">
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Gestión de Clientes</h1>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input 
            type="text"
            placeholder="Buscar por nombre o ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="crm-input-text"
          />

          <select 
            value={planFilter} 
            onChange={(e) => setPlanFilter(e.target.value)}
            className="crm-select-dropdown"
          >
            <option value="ALL">Todos los planes</option>
            <option value="GO">GO</option>
            <option value="GROWTH">GROWTH</option>
            <option value="ESCALE">ESCALE</option>
            <option value="WARRANTY">WARRANTY</option>
            <option value="OUT_OF_WARRANTY">OUT OF WARRANTY</option>
            <option value="LEAD">LEAD</option>
          </select>

          <button 
            onClick={() => setShowForm(!showForm)} 
            className="crm-btn-black"
          >
            {showForm ? 'Cancelar' : 'Nuevo Cliente'}
          </button>
        </div>
      </div>

      {/* Formulario de registro condicional */}
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
            
            {/* NUEVO CAMPO DE SUBIDA DE IMAGEN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="crm-stat-label">Subir Logotipo de la Tienda</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleLogoUpload} 
                className="crm-input-text" 
                style={{ width: 'auto', padding: '5px' }} 
              />
              {formData.logo_url && (
                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>
                  ✓ Imagen subida y lista para guardar
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
              <label className="crm-stat-label">Notas o comentarios internos</label>
              <textarea name="notes" value={formData.notes} onChange={handleInputChange} className="crm-input-text" style={{ height: '60px', resize: 'none', width: 'auto' }} />
            </div>
          </div>
          <button type="submit" className="crm-btn-black">Guardar Cliente en Base de Datos</button>
        </form>
      )}

      {/* Grid de 3 Columnas Kindle E-ink */}
      <div className="crm-grid-three-columns">
        {currentItems.map(client => (
          <div 
            key={client.id} 
            className="crm-card-paper-clickable"
            onClick={() => navigate(`/admin/clientes/${client.id}`)}
          >
            {/* Cabecera de la tarjeta con el Logo resuelto mediante getLogoUrl */}
            <div className="crm-card-header-line" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: '#f2f1ec', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #111111', overflow: 'hidden', flexShrink: 0 }}>
                {client.logo_url ? (
                  <img src={getLogoUrl(client.logo_url)} alt={`Logo de ${client.name}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '9px', fontWeight: 'bold' }}>LOGO</span>
                )}
              </div>
              <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                  {client.name}
                </h3>
                <span className="crm-badge">{client.plan_type}</span>
              </div>
            </div>

            {/* ESTO REEMPLAZA AL DIV INFERIOR DE CADA TARJETA */}
            <div style={{ marginTop: '12px' }}>
              <p className="crm-text-muted" style={{ margin: '6px 0' }}><strong>ID:</strong> {client.id}</p>
              
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

      {filteredClients.length === 0 && (
        <div className="crm-text-loading">No se encontraron clientes con los criterios ingresados.</div>
      )}

      {/* Controles de Paginacion */}
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