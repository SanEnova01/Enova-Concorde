import React, { useState, useEffect } from 'react';
import crmApi from '../../api/crmApi';

function KnowledgeBase() {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [knowledgeList, setKnowledgeList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estado del formulario
  const [formData, setFormData] = useState({
    category: 'FAQ',
    question: '',
    answer: ''
  });

  // Cargar tiendas al montar
  useEffect(() => {
    fetchStores();
  }, []);

  // Cargar conocimiento cada vez que cambie la tienda seleccionada
  useEffect(() => {
    if (selectedStore) {
      fetchKnowledge();
    } else {
      setKnowledgeList([]);
    }
  }, [selectedStore]);

  const fetchStores = async () => {
    try {
      const res = await crmApi.get('/stores');
      setStores(res.data);
      if (res.data.length > 0) {
        setSelectedStore(res.data[0].id); // Seleccionar la primera por defecto
      }
    } catch (err) {
      console.error('Error cargando tiendas:', err);
    }
  };

  const fetchKnowledge = async () => {
    setLoading(true);
    try {
      const res = await crmApi.get(`/knowledge/${selectedStore}`);
      if (res.data.success) {
        setKnowledgeList(res.data.data);
      }
    } catch (err) {
      console.error('Error cargando conocimiento:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!selectedStore) {
      setError('Debes seleccionar una tienda primero.');
      return;
    }

    try {
      const payload = { store_id: selectedStore, ...formData };
      const res = await crmApi.post('/knowledge', payload);
      
      if (res.data.success) {
        // Limpiar formulario y recargar lista
        setFormData({ category: 'FAQ', question: '', answer: '' });
        fetchKnowledge();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar la regla.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta regla? La IA dejará de saber esto.')) return;
    
    try {
      await crmApi.delete(`/knowledge/${id}`);
      fetchKnowledge();
    } catch (err) {
      console.error('Error eliminando:', err);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', borderBottom: '2px solid #111', paddingBottom: '10px', marginBottom: '20px' }}>
        🧠 Entrenamiento de IA (Base de Conocimiento)
      </h1>
      
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Añade políticas y preguntas frecuentes. La IA de CoopPilot leerá estas reglas antes de responder a los clientes.
      </p>

      {/* Selector de Tienda */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Seleccionar Tienda:</label>
        <select 
          value={selectedStore} 
          onChange={(e) => setSelectedStore(e.target.value)} 
          className="crm-select-dropdown"
          style={{ width: '300px' }}
        >
          <option value="">-- Elige una tienda --</option>
          {stores.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
        
        {/* FORMULARIO PARA AGREGAR CONOCIMIENTO */}
        <div style={{ backgroundColor: '#fff', border: '2px solid #111', padding: '20px', borderRadius: '8px', boxShadow: '4px 4px 0px #111', height: 'fit-content' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Nueva Regla</h2>
          {error && <div style={{ color: 'red', marginBottom: '10px', fontSize: '14px' }}>{error}</div>}
          
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
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Pregunta o Escenario</label>
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

        {/* LISTA DE CONOCIMIENTO (MEMORIA ACTUAL) */}
        <div style={{ backgroundColor: '#fff', border: '2px solid #111', padding: '20px', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Memoria de la Tienda</h2>
          
          {loading ? (
            <p>Cargando datos neuronales...</p>
          ) : knowledgeList.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>Esta tienda aún no tiene reglas. La IA no sabrá qué responder.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {knowledgeList.map(item => (
                <div key={item.id} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', backgroundColor: '#111', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
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
                  <p style={{ margin: 0, fontSize: '14px', color: '#444' }}>A: {item.answer}</p>
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