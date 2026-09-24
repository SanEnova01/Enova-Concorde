import React, { useState, useEffect, useRef } from 'react';
import crmApi from '../../api/crmApi';

const QuotesDashboard = () => {
  // ==========================================
  // ESTADOS GLOBALES Y DE PESTAÑAS
  // ==========================================
  const [activeTab, setActiveTab] = useState('list'); // 'list' o 'generator'
  const [quotes, setQuotes] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  // ==========================================
  // ESTADOS DEL GENERADOR DE PDF
  // ==========================================
  const [isGenerating, setIsGenerating] = useState(false);
  const [stores, setStores] = useState([]);
  const [isNewLead, setIsNewLead] = useState(false);

  // Buscador predictivo
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
    tag: '',
    title: '',
    pitch: '',
    conceptName: '',
    quantity: '',
    unitPriceStandard: '',
    subtotalStandard: '',
    unitPricePref: '',
    totalPref: '',
    discountText: '',
    footerNote: '',
    oldPriceBanner: '',
    newPriceBanner: ''
  });

  const [items, setItems] = useState([{ name: '', price: '' }]);

  // ==========================================
  // EFECTOS
  // ==========================================
  // 1. Cargar las tiendas para el buscador del formulario (1 sola vez)
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

  // 2. Cargar cotizaciones cuando la pestaña sea 'list'
  const fetchQuotes = async () => {
    setLoadingList(true);
    try {
      const res = await crmApi.get('/quotes');
      if (res.data && res.data.success) {
        setQuotes(res.data.data);
      }
    } catch (error) {
      console.error("Error al cargar las cotizaciones:", error);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'list') {
      fetchQuotes();
    }
  }, [activeTab]);

  // 3. Cerrar dropdown del buscador predictivo al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowStoreDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ==========================================
  // FUNCIONES DE LA TABLA (LISTA)
  // ==========================================
  const handleUpdateQuote = async (id, field, value) => {
    const updatedQuotes = quotes.map(q => q.id === id ? { ...q, [field]: value } : q);
    setQuotes(updatedQuotes);

    try {
      await crmApi.put(`/quotes/${id}`, { [field]: value });
    } catch (error) {
      console.error(`Error actualizando ${field}:`, error);
      alert("Hubo un error al guardar los cambios. Se recargará la tabla.");
      fetchQuotes();
    }
  };

  const formatMonth = (mesStr) => {
    if (!mesStr) return '-';
    const [year, month] = mesStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  // ==========================================
  // FUNCIONES DEL GENERADOR (FORMULARIO)
  // ==========================================
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

  const handleGeneratePDF = async (e) => {
    e.preventDefault();
    
    if (!isNewLead && !crmData.store_id) {
      return alert("Por favor selecciona un cliente de la lista.");
    }

    setIsGenerating(true);
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

      const res = await crmApi.post('/quotes/generate', payload, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Cotizacion_${crmData.nombre_comercial || 'Enova'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      alert('¡Cotización generada y registrada exitosamente!');
      
      // Regresar a la lista y recargar
      setActiveTab('list');
    } catch (error) {
      console.error('Error procesando cotización:', error);
      alert('Error al generar la cotización.');
    } finally {
      setIsGenerating(false);
    }
  };

  // ==========================================
  // RENDER PRINCIPAL
  // ==========================================
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      
      {/* 🌟 ENCABEZADO Y PESTAÑAS GLOBALES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #111', paddingBottom: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
            Requerimientos Adicionales
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '13px', fontWeight: 'bold' }}>
            Control de facturación, estado de pago y comisiones.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', backgroundColor: '#e5e5e5', padding: '4px', borderRadius: '8px' }}>
          <button 
            onClick={() => setActiveTab('list')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              backgroundColor: activeTab === 'list' ? '#111' : 'transparent',
              color: activeTab === 'list' ? '#fff' : '#555',
              transition: 'all 0.2s'
            }}
          >
            📋 Tabla de Cotizaciones
          </button>
          <button 
            onClick={() => setActiveTab('generator')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              backgroundColor: activeTab === 'generator' ? '#14B8A6' : 'transparent',
              color: activeTab === 'generator' ? '#000' : '#555',
              transition: 'all 0.2s'
            }}
          >
            📄 Generar Nuevo PDF
          </button>
        </div>
      </div>

      {/* 🌟 CONDICIONAL DE PESTAÑAS */}
      {activeTab === 'list' ? (
        /* =========================================
           TABLA DE COTIZACIONES
           ========================================= */
        <div className="crm-card-paper" style={{ padding: 0, overflow: 'hidden' }}>
          {loadingList ? (
            <div style={{ padding: '40px', textAlign: 'center', fontWeight: 'bold', color: '#666' }}>
              Cargando registros desde la base de datos...
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: '#fff' }}>
                <thead>
                  <tr style={{ backgroundColor: '#111', color: '#fff' }}>
                    <th style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cliente (Razón Social / Comercial)</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>N° Factura</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '25%' }}>Descripción del Servicio</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mes</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monto</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#666' }}>No hay cotizaciones registradas aún.</td>
                    </tr>
                  ) : (
                    quotes.map((quote) => (
                      <tr key={quote.id} style={{ borderBottom: '1px solid #e5e5e5' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <strong style={{ display: 'block', fontSize: '13px', color: '#111' }}>{quote.nombre_comercial}</strong>
                          <span style={{ fontSize: '11px', color: '#666' }}>{quote.razon_social}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <input 
                            type="text" 
                            placeholder="Ej: F001-1586"
                            value={quote.factura_id || ''}
                            onChange={(e) => handleUpdateQuote(quote.id, 'factura_id', e.target.value)}
                            style={{ width: '110px', padding: '6px 8px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f9fafb' }}
                          />
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#333' }}>{quote.descripcion || 'Sin descripción'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 'bold' }}>{formatMonth(quote.mes)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '900', color: '#111' }}>${Number(quote.monto || 0).toFixed(2)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <select 
                            value={quote.status || 'PENDIENTE'}
                            onChange={(e) => handleUpdateQuote(quote.id, 'status', e.target.value)}
                            style={{
                              padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', appearance: 'none', textTransform: 'uppercase',
                              backgroundColor: quote.status === 'PAGADO' ? '#dcfce7' : '#991b1b', color: quote.status === 'PAGADO' ? '#166534' : '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                          >
                            <option value="PENDIENTE" style={{ background: '#fff', color: '#000' }}>Pendiente</option>
                            <option value="PAGADO" style={{ background: '#fff', color: '#000' }}>Pagado</option>
                          </select>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <select 
                            value={quote.comision || 'PENDIENTE'}
                            onChange={(e) => handleUpdateQuote(quote.id, 'comision', e.target.value)}
                            style={{
                              padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', appearance: 'none', textTransform: 'uppercase',
                              backgroundColor: quote.comision === 'APLICADO' ? '#166534' : '#991b1b', color: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                          >
                            <option value="PENDIENTE" style={{ background: '#fff', color: '#000' }}>Pendiente</option>
                            <option value="APLICADO" style={{ background: '#fff', color: '#000' }}>Aplicado</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* =========================================
           FORMULARIO GENERADOR DE PDF
           ========================================= */
        <div className="crm-card-paper" style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '900', borderBottom: '2px solid #111', paddingBottom: '12px', marginBottom: '24px' }}>
            Constructor de Propuesta Comercial
          </h2>
          <form onSubmit={handleGeneratePDF} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
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
                          setCrmData({ ...crmData, store_id: '' }); 
                        }}
                        onFocus={() => setShowStoreDropdown(true)}
                        placeholder="Buscar cliente..."
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
                    <input type="text" name="nombre_tienda_nueva" value={crmData.nombre_tienda_nueva} onChange={handleCrmChange} placeholder="Ej: Nueva Empresa S.A." required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
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
                  <input type="text" name="razon_social" value={crmData.razon_social} onChange={handleCrmChange} placeholder="Ej: Importaciones SAC" required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Nombre Comercial</label>
                  <input type="text" name="nombre_comercial" value={crmData.nombre_comercial} onChange={handleCrmChange} placeholder="Ej: Tienda Demo" required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </div>
              </div>
            </div>

            <div style={{ borderTop: '2px dashed #ccc', paddingTop: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '900', color: '#111' }}>2. Diseño del PDF (Editable)</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Etiqueta (Tag)</label>
                  <input type="text" name="tag" value={pdfData.tag} onChange={handlePdfChange} placeholder="Ej: Cliente Preferencial / Fee Activo" style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Título Principal (Usa &lt;br&gt; para saltos)</label>
                  <input type="text" name="title" value={pdfData.title} onChange={handlePdfChange} placeholder="Ej: Expansión E-Commerce:<br>Desarrollo de 6 Landing Pages" style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Argumento de Venta (Pitch)</label>
                <textarea name="pitch" value={pdfData.pitch} onChange={handlePdfChange} rows="3" placeholder="Ej: El desarrollo de estas 6 landing pages en Shopify tiene un valor estándar de $120 USD..." style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
              </div>

              <h4 style={{ fontSize: '14px', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '12px' }}>Costos Base</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Concepto</label>
                  <input type="text" name="conceptName" value={pdfData.conceptName} onChange={handlePdfChange} placeholder="Ej: Landing Page Estática" style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Cantidad</label>
                  <input type="text" name="quantity" value={pdfData.quantity} onChange={handlePdfChange} placeholder="Ej: 6 páginas" style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Precio Unit. Estándar</label>
                  <input type="text" name="unitPriceStandard" value={pdfData.unitPriceStandard} onChange={handlePdfChange} placeholder="Ej: $120.00 USD c/u" style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Precio Unit. Preferencial</label>
                  <input type="text" name="unitPricePref" value={pdfData.unitPricePref} onChange={handlePdfChange} placeholder="Ej: $83.33 USD c/u" style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Subtotal Estándar</label>
                  <input type="text" name="subtotalStandard" value={pdfData.subtotalStandard} onChange={handlePdfChange} placeholder="Ej: $720.00 USD" style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Total Preferencial (Monto BD)</label>
                  <input type="text" name="totalPref" value={pdfData.totalPref} onChange={handlePdfChange} placeholder="Ej: $500.00 USD" style={{ width: '100%', padding: '8px', border: '1px solid #14B8A6', backgroundColor: '#f0fdfa' }} title="Este valor se registrará en el Dashboard" />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Texto de Descuento</label>
                  <input type="text" name="discountText" value={pdfData.discountText} onChange={handlePdfChange} placeholder="Ej: Ahorro total aplicado: $220 USD" style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
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
                      <input type="text" value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} placeholder="Ej: 1. Solera" style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Precio</label>
                      <input type="text" value={item.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} placeholder="Ej: $83.33 USD +IGV" style={{ width: '120px', padding: '8px', border: '1px solid #ccc' }} />
                    </div>
                    <button type="button" onClick={() => removeItem(index)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', height: '35px', display: 'flex', alignItems: 'center' }}>X</button>
                  </div>
                ))}
              </div>

              <h4 style={{ fontSize: '14px', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '12px' }}>Banner Final</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Precio Tachado</label>
                  <input type="text" name="oldPriceBanner" value={pdfData.oldPriceBanner} onChange={handlePdfChange} placeholder="Ej: $720.00 USD" style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Precio Destacado</label>
                  <input type="text" name="newPriceBanner" value={pdfData.newPriceBanner} onChange={handlePdfChange} placeholder="Ej: $500.00" style={{ width: '100%', padding: '8px', border: '1px solid #ccc', fontWeight: 'bold' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Nota al pie</label>
                  <input type="text" name="footerNote" value={pdfData.footerNote} onChange={handlePdfChange} placeholder="Ej: A facturar de manera independiente..." style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }} />
                </div>
              </div>
            </div>

            <button type="submit" disabled={isGenerating} style={{ backgroundColor: '#111', color: '#FFD700', padding: '16px', fontWeight: '900', fontSize: '16px', border: 'none', borderRadius: '6px', cursor: isGenerating ? 'not-allowed' : 'pointer', textTransform: 'uppercase', marginTop: '16px' }}>
              {isGenerating ? 'Generando PDF y Guardando...' : 'Crear Cotización y Descargar PDF'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default QuotesDashboard;