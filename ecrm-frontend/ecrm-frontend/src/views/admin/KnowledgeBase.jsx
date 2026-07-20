import React, { useState, useEffect } from 'react';
import crmApi from '../../api/crmApi';

// Helper ultra-seguro para decodificar JWT sin romper la app
const getUserFromToken = () => {
  const token = localStorage.getItem('crm_token');
  if (!token) return { role: 'client', store_id: '' };
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Error decodificando token:", e);
    return { role: 'client', store_id: '' };
  }
};

function KnowledgeBase() {
  const currentUser = getUserFromToken();
  const isClient = currentUser.role === 'client';

  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [knowledgeList, setKnowledgeList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [formData, setFormData] = useState({
    category: 'FAQ',
    question: '',
    answer: ''
  });

  useEffect(() => {
    if (isClient) {
      setSelectedStore(currentUser.store_id || '');
    } else {
      fetchStores();
    }
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchKnowledge();
    } else {
      setKnowledgeList([]);
    }
  }, [selectedStore]);

  // Garantiza que la respuesta siempre se convierta en Arreglo (evita pantalla blanca)
  const fetchStores = async () => {
    try {
      const res = await crmApi.get('/stores');
      const storeData = Array.isArray(res.data) 
        ? res.data 
        : (Array.isArray(res.data?.data) ? res.data.data : []);
      
      setStores(storeData);
      if (storeData.length > 0) {
        setSelectedStore(storeData[0].id);
      }
    } catch (err) {
      console.error('Error cargando tiendas:', err);
      setStores([]);
    }
  };

  const fetchKnowledge = async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const res = await crmApi.get(`/knowledge/${selectedStore}`);
      const kbData = Array.isArray(res.data) 
        ? res.data 
        : (Array.isArray(res.data?.data) ? res.data.data : []);
      
      setKnowledgeList(kbData);
    } catch (err) {
      console.error('Error cargando conocimiento:', err);
      setKnowledgeList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    if (!selectedStore) {
      setError('Error: No hay una tienda seleccionada.');
      return;
    }

    try {
      const payload = { store_id: selectedStore, ...formData };
      const res = await crmApi.post('/knowledge', payload);
      
      if (res.data && (res.data.success || res.status === 200)) {
        setSuccessMsg('✅ Regla procesada e inyectada correctamente en PostgreSQL.');
        setFormData({ category: 'FAQ', question: '', answer: '' });
        fetchKnowledge();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar e inyectar la regla.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta regla?')) return;
    try {
      await crmApi.delete(`/knowledge/${id}`);
      fetchKnowledge();
    } catch (err) {
      console.error('Error eliminando:', err);
    }
  };

  const safeStores = Array.isArray(stores) ? stores : [];
  const safeKnowledgeList = Array.isArray(knowledgeList) ? knowledgeList : [];

  return (
    <div style={{ padding: '20px', maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* CABECERA */}
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', borderBottom: '2px solid #111', paddingBottom: '10px', marginBottom: '15px' }}>
        🧠 Entrenamiento y Auditoría de IA
      </h1>

      {/* BARRA DE ESTADO Y AUDITORÍA DE PROCESAMIENTO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        
        <div style={{ backgroundColor: '#fff', border: '2px solid #111', padding: '12px 16px', borderRadius: '6px', boxShadow: '3px 3px 0px #111' }}>
          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>ESTADO DEL SERVIDOR</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>BD Conectada</span>
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', border: '2px solid #111', padding: '12px 16px', borderRadius: '6px', boxShadow: '3px 3px 0px #111' }}>
          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>REGLAS PROCESADAS</span>
          <p style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: '900' }}>{safeKnowledgeList.length}</p>
        </div>

        <div style={{ backgroundColor: '#fff', border: '2px solid #111', padding: '12px 16px', borderRadius: '6px', boxShadow: '3px 3px 0px #111' }}>
          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase' }}>TIENDA ACTIVA</span>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedStore || 'Ninguna'}
          </p>
        </div>

      </div>

      {/* SELECTOR DE TIENDAS PARA LA AGENCIA */}
      {!isClient && (
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e5e7eb', borderRadius: '8px', border: '1px dashed #111' }}>
          <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Auditar la IA de:</label>
          <select 
            value={selectedStore} 
            onChange={(e) => setSelectedStore(e.target.value)} 
            className="crm-select-dropdown"
            style={{ width: '300px' }}
          >
            <option value="">-- Elige una tienda --</option>
            {safeStores.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
            ))}
          </select>
        </div>
      )}

      {/* MENSAJES DE ESTADO DE PROCESAMIENTO */}
      {successMsg && (
        <div style={{ padding: '12px', backgroundColor: '#dcfce7', color: '#15803d', border: '2px solid #15803d', borderRadius: '6px', marginBottom: '20px', fontWeight: 'bold' }}>
          {successMsg}
        </div>
      )}
      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', border: '2px solid #991b1b', borderRadius: '6px', marginBottom: '20px', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
        
        {/* FORMULARIO DE INYECCIÓN */}
        <div style={{ backgroundColor: '#fff', border: '2px solid #111', padding: '20px', borderRadius: '8px', boxShadow: '4px 4px 0px #111', height: 'fit-content' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Nueva Regla</h2>
          
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Categoría</label>
              <select 
                value={formData.category} 
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="crm-select-dropdown" style={{ width: '100%' }}
              >
                <option value="FAQ">Pregunta Frecuente (FAQ)</option>
                <option value="POLITICA_DEVOLUCION">Política de Devolución</option>
                <option value="TIEMPOS_ENVIO">Tiempos de Envío</option>
                <option value="TONO_MARCA">Tono de Marca (Instrucción IA)</option>
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Pregunta o Palabras Clave</label>
              <input 
                type="text" 
                placeholder="Ej: ¿Cuánto tiempo tengo para devolver?" 
                value={formData.question}
                onChange={e => setFormData({...formData, question: e.target.value})}
                className="crm-input-text" style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Respuesta de la IA</label>
              <textarea 
                placeholder="Ej: Tienes 30 días. Las prendas deben estar con etiquetas..." 
                value={formData.answer}
                onChange={e => setFormData({...formData, answer: e.target.value})}
                className="crm-input-text" style={{ width: '100%', minHeight: '100px', resize: 'vertical' }}
                required
              />
            </div>

            <button type="submit" disabled={!selectedStore} className="crm-btn-black" style={{ width: '100%' }}>
              Inyectar a la IA
            </button>
          </form>
        </div>

        {/* REGISTRO DE LO APRENDIDO (AUDITORÍA) */}
        <div style={{ backgroundColor: '#fff', border: '2px solid #111', padding: '20px', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Memoria Procesada en Sistema</h2>
          
          {loading ? (
            <p style={{ fontStyle: 'italic', color: '#666' }}>Consultando base de conocimiento...</p>
          ) : safeKnowledgeList.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>Esta tienda aún no tiene reglas registradas.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {safeKnowledgeList.map(item => (
                <div key={item.id} style={{ border: '1px solid #111', padding: '15px', borderRadius: '6px', backgroundColor: '#f9f9f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', backgroundColor: '#111', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                      {item.category}
                    </span>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      style={{ background: 'none', border: 'none', color: '#d9534f', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      [ BORRAR ]
                    </button>
                  </div>
                  {item.question && <p style={{ fontWeight: 'bold', margin: '0 0 5px 0', fontSize: '14px' }}>Q: {item.question}</p>}
                  <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>A: {item.answer}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default KnowledgeBase;