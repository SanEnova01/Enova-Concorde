import React, { useState, useEffect } from 'react';
import axios from 'axios';

const QuoteGenerator = () => {
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState([]);
  const [isNewLead, setIsNewLead] = useState(false);

  // 1. DATOS INTERNOS (Para la BD y el Dashboard)
  const [crmData, setCrmData] = useState({
    store_id: '',
    nombre_tienda_nueva: '',
    razon_social: '',
    nombre_comercial: '',
    mes: new Date().toISOString().slice(0, 7) // Formato YYYY-MM por defecto
  });

  // 2. DATOS DEL PDF (Estéticos)
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

  // Desglose dinámico de ítems para el PDF
  const [items, setItems] = useState([
    { name: '1. Solera', price: '$83.33 USD' },
    { name: '2. Nosotros', price: '$83.33 USD' },
    { name: '3. Fabricación Tableros', price: '$83.33 USD' },
    { name: '4. Soluciones Empresas', price: '$83.33 USD' },
    { name: '5. Distribuidores', price: '$83.33 USD' },
    { name: '6. Contacto', price: '$83.33 USD' }
  ]);

  // Cargar las tiendas existentes al montar el componente
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await axios.get('/api/stores', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setStores(res.data.data || []);
      } catch (error) {
        console.error('Error cargando tiendas:', error);
      }
    };
    fetchStores();
  }, []);

  const handleCrmChange = (e) => setCrmData({ ...crmData, [e.target.name]: e.target.value });
  const handlePdfChange = (e) => setPdfData({ ...pdfData, [e.target.name]: e.target.value });
  
  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Extraemos el monto numérico del campo totalPref para guardarlo limpio en BD
      const montoLimpio = parseFloat(pdfData.totalPref.replace(/[^0-9.-]+/g,"")) || 0;

      const payload = {
        store_id: isNewLead ? '' : crmData.store_id,
        nombre_tienda_nueva: isNewLead ? crmData.nombre_tienda_nueva : '',
        razon_social: crmData.razon_social,
        nombre_comercial: crmData.nombre_comercial,
        descripcion: pdfData.title.replace(/<br>/g, ' '), // Título limpio como descripción
        mes: crmData.mes,
        monto: montoLimpio,
        pdfData: { ...pdfData, items } // Empaquetamos todo lo del PDF en un objeto
      };

      const res = await axios.post('/api/quotes/generate', payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        responseType: 'blob' // Fundamental para que el navegador entienda que viene un archivo PDF
      });

      // Descargar el PDF generado
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
        
        {/* BLOQUE 1: DATOS INTERNOS (CRM) */}
        <div style={{ backgroundColor: '#f9fafb', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '900', color: '#111' }}>1. Datos para el Dashboard y Finanzas</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Cliente Destino</label>
                <label style={{ fontSize: '12px', cursor: 'pointer', color: '#16a34a', fontWeight: 'bold' }}>
                  <input type="checkbox" checked={isNewLead} onChange={(e) => setIsNewLead(e.target.checked)} style={{ marginRight: '4px' }}/>
                  Es un nuevo Lead
                </label>
              </div>
              
              {!isNewLead ? (
                <select name="store_id" value={crmData.store_id} onChange={handleCrmChange} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
                  <option value="">Seleccione un cliente existente...</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <input type="text" name="nombre_tienda_nueva" value={crmData.nombre_tienda_nueva} onChange={handleCrmChange} placeholder="Ej. Ferreterías XYZ" required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
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
              <input type="text" name="razon_social" value={crmData.razon_social} onChange={handleCrmChange} placeholder="Ej. Inversiones XYZ S.A.C." required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Nombre Comercial</label>
              <input type="text" name="nombre_comercial" value={crmData.nombre_comercial} onChange={handleCrmChange} placeholder="Ej. XYZ Retail" required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
            </div>
          </div>
        </div>

        {/* BLOQUE 2: CONTENIDO VISUAL DEL PDF */}
        <div style={{ borderTop: '2px dashed #ccc', paddingTop: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '900', color: '#111' }}>2. Diseño del PDF (Editable)</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
            <input type="text" name="tag" placeholder="Tag (Ej. Cliente Preferencial)" value={pdfData.tag} onChange={handlePdfChange} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
            <input type="text" name="title" placeholder="Título (Usa <br> para saltos)" value={pdfData.title} onChange={handlePdfChange} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
          </div>

          <textarea name="pitch" placeholder="Argumento de Venta..." value={pdfData.pitch} onChange={handlePdfChange} rows="3" style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '16px' }} />

          <h4 style={{ fontSize: '14px', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '12px' }}>Costos Base</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <input type="text" name="conceptName" placeholder="Concepto" value={pdfData.conceptName} onChange={handlePdfChange} style={{ padding: '8px', border: '1px solid #ccc' }} />
            <input type="text" name="quantity" placeholder="Cantidad" value={pdfData.quantity} onChange={handlePdfChange} style={{ padding: '8px', border: '1px solid #ccc' }} />
            <input type="text" name="unitPriceStandard" placeholder="Unit. Estándar" value={pdfData.unitPriceStandard} onChange={handlePdfChange} style={{ padding: '8px', border: '1px solid #ccc' }} />
            <input type="text" name="unitPricePref" placeholder="Unit. Preferencial" value={pdfData.unitPricePref} onChange={handlePdfChange} style={{ padding: '8px', border: '1px solid #ccc' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <input type="text" name="subtotalStandard" placeholder="Subtotal Estándar" value={pdfData.subtotalStandard} onChange={handlePdfChange} style={{ padding: '8px', border: '1px solid #ccc' }} />
            <input type="text" name="totalPref" placeholder="Total Preferencial (Monto BD)" value={pdfData.totalPref} onChange={handlePdfChange} style={{ padding: '8px', border: '1px solid #14B8A6', backgroundColor: '#f0fdfa' }} title="Este valor se registrará en el Dashboard" />
            <input type="text" name="discountText" placeholder="Texto Descuento" value={pdfData.discountText} onChange={handlePdfChange} style={{ padding: '8px', border: '1px solid #ccc' }} />
          </div>

          <h4 style={{ fontSize: '14px', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '12px' }}>Desglose de Ítems (Opcional)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            {items.map((item, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} placeholder={`Ítem ${index + 1}`} style={{ flex: 1, padding: '8px', border: '1px solid #ccc' }} />
                <input type="text" value={item.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} placeholder="$0.00" style={{ width: '100px', padding: '8px', border: '1px solid #ccc' }} />
              </div>
            ))}
          </div>

          <h4 style={{ fontSize: '14px', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '12px' }}>Banner Final</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <input type="text" name="oldPriceBanner" placeholder="Precio Tachado" value={pdfData.oldPriceBanner} onChange={handlePdfChange} style={{ padding: '8px', border: '1px solid #ccc' }} />
            <input type="text" name="newPriceBanner" placeholder="Precio Destacado" value={pdfData.newPriceBanner} onChange={handlePdfChange} style={{ padding: '8px', border: '1px solid #ccc', fontWeight: 'bold' }} />
            <input type="text" name="footerNote" placeholder="Nota al pie (Fee, etc.)" value={pdfData.footerNote} onChange={handlePdfChange} style={{ padding: '8px', border: '1px solid #ccc' }} />
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