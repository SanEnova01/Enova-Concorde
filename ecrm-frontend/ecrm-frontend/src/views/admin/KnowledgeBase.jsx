import React, { useState, useEffect } from 'react';
import crmApi from '../../api/crmApi';

// COMPONENTE TARJETA ACCORDION (CONTRAÍBLE)
function KnowledgeItem({ item, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      border: '2px solid #111',
      borderRadius: '6px',
      padding: '12px',
      marginBottom: '12px',
      backgroundColor: '#ffffff',
      boxShadow: '3px 3px 0px #111',
      transition: 'all 0.2s'
    }}>
      {/* CABECERA: CATEGORÍA Y BOTÓN BORRAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{
          fontSize: '10px',
          fontWeight: '900',
          backgroundColor: '#111',
          color: '#FFD700',
          padding: '3px 8px',
          borderRadius: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {item.category || 'GENERAL'}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          style={{
            color: '#d9534f',
            background: 'none',
            border: 'none',
            fontWeight: '900',
            cursor: 'pointer',
            fontSize: '11px',
            letterSpacing: '0.5px'
          }}
        >
          [ BORRAR ]
        </button>
      </div>

      {/* ÁREA CLICKEABLE PARA EXPANDIR / CONTRAER */}
      <div 
        onClick={() => setExpanded(!expanded)} 
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 'bold', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{item.question || 'Documento / Pregunta sin título'}</span>
          <span style={{ fontSize: '11px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '4px', border: '1px solid #d1d5db', marginLeft: '8px' }}>
            {expanded ? '▲ Ocultar' : '▼ Expandir'}
          </span>
        </h4>

        {expanded ? (
          <div style={{ 
            fontSize: '12px', 
            color: '#374151', 
            lineHeight: '1.6', 
            whiteSpace: 'pre-wrap', 
            backgroundColor: '#f9fafb', 
            padding: '12px', 
            borderRadius: '6px', 
            border: '1px solid #e5e7eb',
            marginTop: '8px',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {item.answer}
          </div>
        ) : (
          <p style={{ 
            margin: 0, 
            fontSize: '12px', 
            color: '#6b7280', 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis' 
          }}>
            {item.answer}
          </p>
        )}
      </div>
    </div>
  );
}

function KnowledgeBase() {
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('cuentacliente');
  const [knowledgeList, setKnowledgeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Formulario
  const [category, setCategory] = useState('Preguntas Frecuentes');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  // Identificar Rol del usuario
  const token = localStorage.getItem('crm_token');
  let userRole = 'client';
  if (token) {
    try {
      userRole = JSON.parse(window.atob(token.split('.')[1])).role || 'client';
    } catch (e) {}
  }

  const isStaff = userRole === 'super admin' || userRole === 'admin';

  // Cargar tiendas si es Staff
  useEffect(() => {
    if (isStaff) {
      crmApi.get('/stores')
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : (res.data.data || []);
          setStores(list);
          if (list.length > 0) {
            setSelectedStoreId(list[0].id);
          }
        })
        .catch(err => console.error("Error cargando tiendas:", err));
    }
  }, [isStaff]);

  // Cargar elementos de la base de conocimiento
  const fetchKnowledge = () => {
    setLoading(true);
    crmApi.get(`/knowledge/${selectedStoreId}`)
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setKnowledgeList(list);
      })
      .catch(err => console.error("Error cargando base de conocimiento:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchKnowledge();
  }, [selectedStoreId]);

  // Agregar nuevo documento / regla
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!answer.trim()) {
      alert("El contenido no puede estar vacío.");
      return;
    }

    setSaving(true);
    try {
      const res = await crmApi.post('/knowledge', {
        store_id: selectedStoreId,
        category,
        question: question || category,
        answer
      });

      if (res.data.success || res.status === 200) {
        alert("Documento procesado y guardado en memoria exitosamente.");
        setQuestion('');
        setAnswer('');
        fetchKnowledge();
      }
    } catch (err) {
      console.error(err);
      alert("Error al guardar en la base de conocimiento.");
    } finally {
      setSaving(false);
    }
  };

  // Borrar documento / regla
  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta regla de la memoria de la IA?")) return;

    try {
      const res = await crmApi.delete(`/knowledge/${id}`);
      if (res.data.success || res.status === 200) {
        fetchKnowledge();
      }
    } catch (err) {
      console.error(err);
      alert("Error al eliminar la regla.");
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Base de Conocimiento IA</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
            Inyecta políticas, FAQs y reglas de negocio para alimentar las respuestas inteligentes de CoopPilot.
          </p>
        </div>

        {/* SELECTOR DE TIENDA (SOLO PARA ADMINS) */}
        {isStaff && stores.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Tienda:</label>
            <select
              value={selectedStoreId}
              onChange={e => setSelectedStoreId(e.target.value)}
              className="crm-select-dropdown"
              style={{ minWidth: '200px' }}
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* PANEL IZQUIERDO: FORMULARIO DE INYECCIÓN */}
        <div style={{ backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px', padding: '20px', boxShadow: '4px 4px 0px #111' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '900', color: '#111' }}>
            Inyectar Documento a la IA
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="crm-stat-label">Tipo de Documento</label>
              <select 
                value={category} 
                onChange={e => setCategory(e.target.value)}
                className="crm-select-dropdown"
              >
                <option value="Preguntas Frecuentes">Preguntas Frecuentes (FAQs)</option>
                <option value="Términos y Condiciones">Términos y Condiciones</option>
                <option value="Políticas de Envío">Políticas de Envío</option>
                <option value="Devoluciones y Cambios">Devoluciones y Cambios</option>
                <option value="Garantías">Garantías</option>
                <option value="General">General / Otros</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="crm-stat-label">Nombre / Referencia del Texto</label>
              <input 
                type="text" 
                placeholder="Ej: Políticas de Envío 2026..." 
                value={question}
                onChange={e => setQuestion(e.target.value)}
                className="crm-input-text"
                style={{ width: 'auto' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="crm-stat-label">Contenido Completo (Copy/Paste)</label>
              <textarea 
                placeholder="Pega aquí todo el texto de tu documento o políticas..." 
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                className="crm-input-text"
                style={{ height: '220px', resize: 'vertical', width: 'auto', fontFamily: 'sans-serif' }}
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={saving} 
              className="crm-btn-black"
              style={{ marginTop: '8px', padding: '12px' }}
            >
              {saving ? 'Procesando en IA...' : 'Procesar y Guardar en Memoria'}
            </button>
          </form>
        </div>

        {/* PANEL DERECHO: MEMORIA PROCESADA (LISTA DE ACCORDEONES) */}
        <div style={{ backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px', padding: '20px', boxShadow: '4px 4px 0px #111', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#111' }}>
              Memoria Procesada en Sistema
            </h3>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#666' }}>
              {knowledgeList.length} registros
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '550px', paddingRight: '4px' }}>
            {loading ? (
              <div className="crm-text-loading">Cargando memoria...</div>
            ) : knowledgeList.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 20px', fontSize: '13px' }}>
                No hay documentos cargados en la memoria de esta tienda.
              </div>
            ) : (
              knowledgeList.map(item => (
                <KnowledgeItem 
                  key={item.id} 
                  item={item} 
                  onDelete={handleDelete} 
                />
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default KnowledgeBase;