import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function AdminDashboard() {
  const [stats, setStats] = useState({ tickets: 0, clients: 0 });
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 🌟 NUEVOS ESTADOS PARA BÚSQUEDA Y ORDENAMIENTO
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  useEffect(() => {
    const dataInitialization = async () => {
      try {
        const token = localStorage.getItem('crm_token');
        if (token) {
          const payload = JSON.parse(window.atob(token.split('.')[1]));
          
          if (payload.role === 'client') {
            const clientsRes = await crmApi.get('/stores');
            const listaTiendas = clientsRes.data.data || clientsRes.data || [];
            const correoUsuario = String(payload.email).toLowerCase().trim();
            
            // 🔍 PARSEO MULTI-EMAIL
            const miTienda = listaTiendas.find(store => {
              const listaCorreos = String(store.emails).toLowerCase().split(/[\s,;]+/).map(e => e.trim());
              return listaCorreos.includes(correoUsuario);
            });

            if (miTienda) {
              navigate(`/admin/clientes/cuentacliente`, { replace: true });
              return;
            } else {
              alert('Error: Su cuenta de correo no coincide con ninguna de las credenciales autorizadas en las tiendas.');
              localStorage.removeItem('crm_token');
              navigate('/login', { replace: true });
              return;
            }
          }
        }

        const [ticketsRes, clientsRes] = await Promise.all([
          crmApi.get('/tickets'),
          crmApi.get('/stores')
        ]);
        
        if (ticketsRes.data.success && clientsRes.data.success) {
          setStats({
            tickets: ticketsRes.data.data.length,
            clients: clientsRes.data.data.length
          });
          setClients(clientsRes.data.data);
        }
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    
    dataInitialization();
  }, [navigate]);

  // 🌟 FUNCIÓN PARA ACCIONAR EL FILTRO DE ORDENAMIENTO AL DAR CLIC
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 🌟 PROCESAMIENTO EN TIEMPO REAL: FILTRADO + ORDENAMIENTO
  const processedClients = [...clients]
    .filter(client => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        client.name.toLowerCase().includes(query) ||
        (client.web && client.web.toLowerCase().includes(query)) ||
        client.plan_type.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      
      const valA = String(a[sortConfig.key] || '').toLowerCase();
      const valB = String(b[sortConfig.key] || '').toLowerCase();

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  if (loading) return <div className="crm-text-loading">Cargando resumen...</div>;

  return (
    <div>
      <h1 className="crm-main-title">Panel de Control Principal</h1>
      
      <div className="crm-grid-stats">
        <div className="crm-card-paper">
          <span className="crm-stat-label">Tickets Totales</span>
          <span className="crm-stat-number">{stats.tickets}</span>
        </div>
        <div className="crm-card-paper">
          <span className="crm-stat-label">Clientes Registrados</span>
          <span className="crm-stat-number">{stats.clients}</span>
        </div>
      </div>

      <div className="crm-card-paper">
        {/* 🌟 CABECERA DINÁMICA CON BARRA DE BÚSQUEDA INTEGRADA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 className="crm-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Lista General de Clientes</h2>
          <input 
            type="text" 
            placeholder="Buscar por cliente o plan..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="crm-input-text"
            style={{ width: '250px' }}
          />
        </div>

        <div className="crm-table-container">
          <table className="crm-table-data">
            <thead>
              <tr>
                {/* 🌟 CABECERAS INTERACTIVAS CON INDICADORES DE DIRECCIÓN ↑ ↓ */}
                <th 
                  onClick={() => handleSort('name')} 
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  title="Haz clic para ordenar por Nombre"
                >
                  Nombre del Cliente {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                </th>
                <th>Sitio Web</th>
                <th 
                  onClick={() => handleSort('plan_type')} 
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  title="Haz clic para ordenar por Plan"
                >
                  Plan Contratado {sortConfig.key === 'plan_type' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                </th>
                <th>Tickets Creados</th>
              </tr>
            </thead>
            <tbody>
              {processedClients.length === 0 ? (
                <tr>
                  <td colSpan="4" className="crm-text-loading" style={{ textAlign: 'center', padding: '24px' }}>
                    No se encontraron clientes que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                processedClients.map(client => (
                  <tr 
                    key={client.id} 
                    className="crm-table-row-interactive"
                    onClick={() => navigate(`/admin/clientes/${client.id}`)}
                  >
                    <td><strong>{client.name}</strong></td>
                    <td>{client.web || 'No asignada'}</td>
                    <td><span className="crm-badge">{client.plan_type}</span></td>
                    <td>{client.ticket_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;