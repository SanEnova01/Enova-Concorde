import React, { useState, useEffect, useRef } from 'react';
import crmApi from '../../api/crmApi'; 

const QuoteGenerator = () => {
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState([]);
  const [isNewLead, setIsNewLead] = useState(false);

  // Estados para el buscador predictivo
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const [crmData, setCrmData] = useState({
    store_id: '',
    nombre_tienda_nueva: '',
    razon_social: '',
    nombre_comercial: '',
    mes: new Date().toISOString().slice(0, 7) 
  });

  const [pdfData, setPdfData] = useState({
    tag: 'Cliente Preferencial / Fee Activo',
    title: 'Expansión E-Commerce:<br>Desarrollo de 6 Landing Pages',
    pitch: 'El desarrollo de estas 6 landing pages en Shopify tiene un valor estándar de $120 USD por página...',
    conceptName: 'Landing Page Estática (Shopify)',
    quantity: '6 páginas',
    unitPriceStandard: '$120.00 USD c/u',
    subtotalStandard: '$720.00 USD',
    unitPricePref: '$83.33 USD c/u',
    totalPref: '$500.00 USD',
    discountText: 'Ahorro total aplicado: $220 USD',
    footerNote: 'A facturar de manera independiente o adicional a su fee mensual operativo de $150 USD.',
    oldPriceBanner: '$720.00 USD',
    newPriceBanner: '$500.00'
  });

  const [items, setItems] = useState([
    { name: '1. Solera', price: '$83.33 USD +IGV' },
    { name: '2. Nosotros', price: '$83.33 USD +IGV' }
  ]);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await crmApi.get('/stores');
        setStores(res.data.data || []);
      } catch (error) {
        console.error('Error cargando tiendas:', error);
      }
    };
    fetchStores();
  }, []);

  // Cerrar el dropdown si se hace clic fuera de él
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowStoreDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCrmChange = (e) => setCrmData({ ...crmData, [e.target.name]: e.target.value });
  const handlePdfChange = (e) => setPdfData({ ...pdfData, [e.target.name]: e.target.value });
  
  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { name: '', price: '' }]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  const filteredStores = stores.filter(s => s.name.toLowerCase().includes(storeSearchTerm.toLowerCase()));

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isNewLead && !crmData.store_id) {
      return alert("Por favor selecciona un cliente de la lista.");
    }

    setLoading(true);
    try {
      const montoLimpio = parseFloat(pdfData.totalPref.replace(/[^0-9.-]+/g,"")) || 0;

      const payload = {
        store_id: isNewLead ? '' : crmData.store_id,
        nombre_tienda_nueva: isNewLead ? crmData.nombre_tienda_nueva : '',
        razon_social: crmData.razon_social,
        nombre_comercial: crmData.nombre_comercial,
        descripcion: pdfData.title.replace(/<br>/g, ' '),
        mes: crmData.mes,
        monto: montoLimpio,
        pdfData: { ...pdfData, items } 
      };

      const res = await crmApi.post('/quotes/generate', payload, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Cotizacion_${crmData.nombre_comercial || 'Enova'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      alert('¡Cotización generada y registrada en el Dashboard exitosamente!');
    } catch (error) {
      console.error('Error procesando cotización:', error);
      alert('Error al generar la cotización.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="crm-card-paper" style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '900', borderBottom: '2px solid #111', paddingBottom: '12px', marginBottom: '24px' }}>
        Generador de Propuestas Comerciales
      </h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div style={{ backgroundColor: '#f9fafb', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '900', color: '#111' }}>1. Datos para el Dashboard y Finanzas</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Cliente Destino</label>
                <label style={{ fontSize: '12px', cursor: 'pointer', color: '#16a34a', fontWeight: 'bold' }}>
                  <input type="checkbox" checked={isNewLead} onChange={(e) => {
                    setIsNewLead(e.target.checked);
                    setStoreSearchTerm('');
                    setCrmData({...crmData, store_id: '', nombre_tienda_nueva: ''});
                  }} style={{ marginRight: '4px' }}/>
                  Es un nuevo Lead
                </label>
              </div>
              
              {!isNewLead ? (
                <div style={{ position: 'relative' }} ref={dropdownRef}>
                  <input 
                    type="text" 
                    value={storeSearchTerm}
                    onChange={(e) => {
                      setStoreSearchTerm(e.target.value);
                      setShowStoreDropdown(true);
                      setCrmData({ ...crmData, store_id: '' }); // Limpia el id si edita el texto
                    }}
                    onFocus={() => setShowStoreDropdown(true)}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} 
                  />
                  {showStoreDropdown && (
                    <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #ccc', borderTop: 'none', borderRadius: '0 0 4px 4px', maxHeight: '200px', overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none', zIndex: 50, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                      {filteredStores.length > 0 ? filteredStores.map(s => (
                        <li 
                          key={s.id} 
                          onClick={() => {
                            setCrmData({ ...crmData, store_id: s.id });
                            setStoreSearchTerm(s.name);
                            setShowStoreDropdown(false);
                          }}
                          style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          {s.name}
                        </li>
                      )) : (
                        <li style={{ padding: '10px', fontSize: '13px', color: '#666', fontStyle: 'italic' }}>No se encontraron resultados</li>
                      )}
                    </ul>
                  )}
                </div>
              ) : (
                <input type="text" name="nombre_tienda_nueva" value={crmData.nombre_tienda_nueva} onChange={handleCrmChange} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
              )}
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Mes de Proyección</label>
              <input type="month" name="mes" value={crmData.mes} onChange={handleCrmChange} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Razón Social (Facturación)</label>
              <input type="text" name="razon_social" value={crmData.razon_social} onChange={handleCrmChange} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Nombre Comercial</label>
              <input type="text" name="nombre_comercial" value={crmData.nombre_comercial} onChange={handleCrmChange} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
            </div>
          </div>
        </div>

        <div style={{ borderTop: '2px dashed #ccc', paddingTop: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '900', color: '#111' }}>2. Diseño del PDF (Editable)</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Etiqueta (Tag)</label>
              <input type="text" name="tag" value={pdfData.tag} onChange={handlePdfChange} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Título Principal (Usa &lt;br&gt; para saltos)</label>
              <input type="text" name="title" value={pdfData.title} onChange={handlePdfChange} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Argumento de Venta (Pitch)</label>
            <textarea name="pitch" value={pdfData.pitch} onChange={handlePdfChange} rows="3" style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
          </div>

          <h4 style={{ fontSize: '14px', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '12px' }}>Costos Base</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Concepto</label>
              <input type="text" name="conceptName" value={pdfData.conceptName} onChange={handlePdfChange} style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Cantidad</label>
              <input type="text" name="quantity" value={pdfData.quantity} onChange={handlePdfChange} style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Precio Unit. Estándar</label>
              <input type="text" name="unitPriceStandard" value={pdfData.unitPriceStandard} onChange={handlePdfChange} style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Precio Unit. Preferencial</label>
              <input type="text" name="unitPricePref" value={pdfData.unitPricePref} onChange={handlePdfChange} style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Subtotal Estándar</label>
              <input type="text" name="subtotalStandard" value={pdfData.subtotalStandard} onChange={handlePdfChange} style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Total Preferencial (Monto BD)</label>
              <input type="text" name="totalPref" value={pdfData.totalPref} onChange={handlePdfChange} style={{ width: '100%', padding: '8px', border: '1px solid #14B8A6', backgroundColor: '#f0fdfa' }} title="Este valor se registrará en el Dashboard" />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Texto de Descuento</label>
              <input type="text" name="discountText" value={pdfData.discountText} onChange={handlePdfChange} style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
            </div>
          </div>

          <h4 style={{ fontSize: '14px', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Desglose de Ítems (Opcional)
            <button type="button" onClick={addItem} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>+ Agregar Ítem</button>
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            {items.map((item, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Nombre del Ítem</label>
                  <input type="text" value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Precio</label>
                  <input type="text" value={item.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} style={{ width: '120px', padding: '8px', border: '1px solid #ccc' }} />
                </div>
                <button type="button" onClick={() => removeItem(index)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', height: '35px', display: 'flex', alignItems: 'center' }}>X</button>
              </div>
            ))}
          </div>

          <h4 style={{ fontSize: '14px', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '12px' }}>Banner Final</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Precio Tachado</label>
              <input type="text" name="oldPriceBanner" value={pdfData.oldPriceBanner} onChange={handlePdfChange} style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Precio Destacado</label>
              <input type="text" name="newPriceBanner" value={pdfData.newPriceBanner} onChange={handlePdfChange} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', fontWeight: 'bold' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Nota al pie</label>
              <input type="text" name="footerNote" value={pdfData.footerNote} onChange={handlePdfChange} style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} style={{ backgroundColor: '#111', color: '#FFD700', padding: '16px', fontWeight: '900', fontSize: '16px', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', marginTop: '16px' }}>
          {loading ? 'Generando PDF y Guardando en BD...' : 'Crear Cotización y Descargar PDF'}
        </button>
      </form>
    </div>
  );
};

export default QuoteGenerator;