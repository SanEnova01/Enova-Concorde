import React, { useState, useRef } from 'react';

const sec1Data = [
  { cat: "Área Crítica (Detienen las Ventas)", column: "left", items: [
      { id: "c1", label: "Caída del sitio web (Downtime)", defG: "Monitoreado. 99.99% de Uptime registrado." },
      { id: "c2", label: "Errores en la pasarela de pagos", defG: "Monitoreado, sin incidencias." },
      { id: "c3", label: "Fallos en el proceso de checkout", defG: "Monitoreado, sin incidencias." }
  ]},
  { cat: "Área de Seguridad", column: "left", items: [
      { id: "s1", label: "Infecciones por malware o virus", defG: "Monitoreado. Escaneos de seguridad limpios." },
      { id: "s2", label: "Vulnerabilidades por software", defG: "Mitigado mediante actualizaciones." },
      { id: "s3", label: "Robo de datos de clientes", defG: "Protocolos verificados y activos." }
  ]},
  { cat: "Área de Rendimiento", column: "right", items: [
      { id: "r1", label: "Tiempos de carga lentos", defG: "Monitoreado y óptimo." },
      { id: "r2", label: "Imágenes o videos no optimizados", defG: "Revisado." }
  ]},
  { cat: "Área de Operación y Datos", column: "right", items: [
      { id: "o1", label: "Desincronización de inventario", defG: "Monitoreado, sin incidencias reportadas." },
      { id: "o2", label: "Errores en precios o descripciones", defG: "Revisado, sin incidencias detectadas." },
      { id: "o3", label: "Fallos en recepción/gestión pedidos", defG: "Monitoreado, sin incidencias." }
  ]},
  { cat: "Área de Experiencia de Usuario (UX)", column: "right", items: [
      { id: "x1", label: "Enlaces rotos y errores 404", defG: "Revisado. Sin problemas." },
      { id: "x2", label: "Visualización en móviles", defG: "Monitoreado. Experiencia correcta." },
      { id: "x3", label: "Fallos en formularios de contacto", defG: "Pruebas realizadas, operando normal." }
  ]}
];

const getInitialStatuses = () => {
  const st = {};
  sec1Data.forEach(cat => cat.items.forEach(item => { st[item.id] = { status: 'G', text: item.defG }; }));
  return st;
};

function ReportGenerator() {
  const [platform, setPlatform] = useState('woo');
  const [clientName, setClientName] = useState('Florería San Borja');
  const [timeLoad, setTimeLoad] = useState('5.65');
  const [timeDom, setTimeDom] = useState('4.65');
  const [statuses, setStatuses] = useState(getInitialStatuses());
  const [images, setImages] = useState({ scan: null, waterfall: null, flow: null });
  const [plugins, setPlugins] = useState({ req: '', ok: '', del: '' });
  
  // Pestaña activa (pdf o email)
  const [activeTab, setActiveTab] = useState('pdf');

  const [showTexts, setShowTexts] = useState({
    webScan: true,
    pentest: true,
    backup: true,
    speedIntro: true,
    network: true,
    continuity: true
  });

  const fileInputRefs = {
    scan: useRef(null), waterfall: useRef(null), flow: useRef(null)
  };
  
  const emailTableRef = useRef(null);

  const exportPDF = () => {
    const element = document.getElementById('document-to-print');
    if (!element) return;
    
    const nameSafe = clientName.replace(/\s+/g, '_') || 'Reporte';
    const opt = {
        margin:       [0, 0, 0, 0], 
        filename:     `Informe_Soporte_${nameSafe}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    if (window.html2pdf) {
        window.html2pdf().set(opt).from(element).save();
    } else {
        alert("La librería PDF aún no ha cargado. Verifica el script en index.html");
    }
  };

  const copyToGmail = () => {
    const table = emailTableRef.current;
    const range = document.createRange();
    range.selectNode(table);
    
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    try {
        document.execCommand('copy');
        alert('¡Diseño copiado con éxito! Ve a Gmail y presiona Ctrl+V');
    } catch(err) {
        alert('Hubo un error al intentar copiar. Presiona Ctrl+C manualmente.');
    }
    
    selection.removeAllRanges();
  };

  const handleStatusChange = (id, color, defText) => {
    setStatuses(prev => ({
      ...prev,
      [id]: { 
        status: color, 
        text: color === 'G' ? defText : (color === 'Y' ? 'Atención requerida.' : 'Incidencia crítica detectada.')
      }
    }));
  };

  const handleCustomText = (id, val) => {
    setStatuses(prev => ({ ...prev, [id]: { ...prev[id], text: val } }));
  };

  const toggleText = (key) => {
    setShowTexts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleImageRead = (file, key) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => setImages(prev => ({ ...prev, [key]: e.target.result }));
    reader.readAsDataURL(file);
  };

  const handlePaste = (e, key) => {
    e.preventDefault();
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
      if (item.type.indexOf('image') === 0) {
        handleImageRead(item.getAsFile(), key);
        break;
      }
    }
  };

  const handleDrop = (e, key) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleImageRead(e.dataTransfer.files[0], key);
  };

  const renderPluginList = (text) => {
    const lines = text.split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return <li>Sin datos registrados.</li>;
    return lines.map((l, i) => <li key={i}>{l}</li>);
  };

  return (
    <div className="rg-container">
      {/* PANEL LATERAL */}
      <div className="rg-sidebar">
        
        <h2 className="rg-panel-title">Configuración</h2>
        <div className="rg-form-group">
          <label>Plataforma / Cliente</label>
          <select className="rg-input" value={platform} onChange={e => setPlatform(e.target.value)}>
            <option value="woo">WooCommerce</option>
            <option value="shopify">Shopify / VTEX</option>
          </select>
          <input type="text" className="rg-input" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nombre del cliente" style={{marginTop: '10px'}} />
        </div>

        <h2 className="rg-panel-title">1. Monitoreo (Estados)</h2>
        {sec1Data.map(cat => (
          <div className="rg-form-group" key={cat.cat}>
            <div style={{ fontWeight: 'bold', color: '#3b82f6', marginBottom: '10px' }}>{cat.cat}</div>
            {cat.items.map(item => {
              const st = statuses[item.id];
              return (
                <div className="rg-status-row" key={item.id}>
                  <div className="rg-status-label">{item.label}</div>
                  <div className="rg-status-btn-group">
                    <button type="button" className={`rg-btn-status rg-btn-g ${st.status === 'G' ? 'active' : ''}`} onClick={() => handleStatusChange(item.id, 'G', item.defG)}>VERDE</button>
                    <button type="button" className={`rg-btn-status rg-btn-y ${st.status === 'Y' ? 'active' : ''}`} onClick={() => handleStatusChange(item.id, 'Y')}>AMARILLO</button>
                    <button type="button" className={`rg-btn-status rg-btn-r ${st.status === 'R' ? 'active' : ''}`} onClick={() => handleStatusChange(item.id, 'R')}>ROJO</button>
                  </div>
                  {st.status !== 'G' && (
                    <input type="text" className="rg-input" value={st.text} onChange={e => handleCustomText(item.id, e.target.value)} placeholder="Escribe el estado custom..." />
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <h2 className="rg-panel-title">2. Seguridad y Fiabilidad</h2>
        <div className="rg-form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal', color: '#fff', marginBottom: '6px' }}>
            <input type="checkbox" checked={showTexts.webScan} onChange={() => toggleText('webScan')} /> 
            Mostrar texto: "Análisis de Integridad (Web Scan)"
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal', color: '#fff', marginBottom: '6px' }}>
            <input type="checkbox" checked={showTexts.pentest} onChange={() => toggleText('pentest')} /> 
            Mostrar texto: "Pruebas Pentesting"
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal', color: '#fff', marginBottom: '15px' }}>
            <input type="checkbox" checked={showTexts.backup} onChange={() => toggleText('backup')} /> 
            Mostrar texto: "Verificación de Backups"
          </label>

          <label>Imagen: Análisis de Integridad</label>
          <div className="rg-drop-zone" tabIndex="0" onPaste={(e) => handlePaste(e, 'scan')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, 'scan')}>
            {!images.scan ? <span>Presiona Ctrl+V o arrastra la imagen</span> : <img src={images.scan} alt="Preview" />}
          </div>
          <input type="file" ref={fileInputRefs.scan} style={{display:'none'}} accept="image/*" onChange={(e) => handleImageRead(e.target.files[0], 'scan')} />
          <button type="button" className="rg-input" style={{backgroundColor: '#4b5563', cursor:'pointer'}} onClick={() => fileInputRefs.scan.current.click()}>📂 Subir archivo</button>
        </div>

        <h2 className="rg-panel-title">3. Análisis de Rendimiento</h2>
        <div className="rg-form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal', color: '#fff', marginBottom: '6px' }}>
            <input type="checkbox" checked={showTexts.speedIntro} onChange={() => toggleText('speedIntro')} /> 
            Mostrar texto intro: "La velocidad es clave..."
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal', color: '#fff', marginBottom: '6px' }}>
            <input type="checkbox" checked={showTexts.network} onChange={() => toggleText('network')} /> 
            Mostrar texto: "Análisis Carga de Red"
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal', color: '#fff', marginBottom: '15px' }}>
            <input type="checkbox" checked={showTexts.continuity} onChange={() => toggleText('continuity')} /> 
            Mostrar texto: "Garantía Flujo Comercial"
          </label>

          <label style={{ borderTop: '1px solid #555', paddingTop: '15px' }}>Métricas Obtenidas (Segundos)</label>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#aaa' }}>Carga Completa</span>
              <input type="number" className="rg-input" value={timeLoad} onChange={e => setTimeLoad(e.target.value)} step="0.01" />
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#aaa' }}>DOM Content Loaded</span>
              <input type="number" className="rg-input" value={timeDom} onChange={e => setTimeDom(e.target.value)} step="0.01" />
            </div>
          </div>

          <label>Imagen: Waterfall de Red</label>
          <div className="rg-drop-zone" tabIndex="0" onPaste={(e) => handlePaste(e, 'waterfall')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, 'waterfall')}>
            {!images.waterfall ? <span>Presiona Ctrl+V o arrastra la imagen</span> : <img src={images.waterfall} alt="Preview" />}
          </div>
          <input type="file" ref={fileInputRefs.waterfall} style={{display:'none'}} accept="image/*" onChange={(e) => handleImageRead(e.target.files[0], 'waterfall')} />
          <button type="button" className="rg-input" style={{backgroundColor: '#4b5563', cursor:'pointer', marginBottom: '15px'}} onClick={() => fileInputRefs.waterfall.current.click()}>📂 Subir archivo</button>

          <label>Imagen: Gráfica Flujo (DOM/Load)</label>
          <div className="rg-drop-zone" tabIndex="0" onPaste={(e) => handlePaste(e, 'flow')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, 'flow')}>
            {!images.flow ? <span>Presiona Ctrl+V o arrastra la imagen</span> : <img src={images.flow} alt="Preview" />}
          </div>
          <input type="file" ref={fileInputRefs.flow} style={{display:'none'}} accept="image/*" onChange={(e) => handleImageRead(e.target.files[0], 'flow')} />
          <button type="button" className="rg-input" style={{backgroundColor: '#4b5563', cursor:'pointer'}} onClick={() => fileInputRefs.flow.current.click()}>📂 Subir archivo</button>
        </div>

        {platform === 'woo' && (
          <>
            <h2 className="rg-panel-title">4. Plugins (Solo Woo)</h2>
            <div className="rg-form-group">
              <label>A. Acción Requerida</label>
              <textarea className="rg-input" rows="3" value={plugins.req} onChange={e => setPlugins({...plugins, req: e.target.value})} placeholder="Pega la lista aquí..."></textarea>
              <label>B. Al Día</label>
              <textarea className="rg-input" rows="3" value={plugins.ok} onChange={e => setPlugins({...plugins, ok: e.target.value})} placeholder="Pega la lista aquí..."></textarea>
              <label>C. Inactivos (Desinstalar)</label>
              <textarea className="rg-input" rows="2" value={plugins.del} onChange={e => setPlugins({...plugins, del: e.target.value})} placeholder="Pega la lista aquí..."></textarea>
            </div>
          </>
        )}

        <button type="button" className="rg-btn-export" style={{ marginBottom: '15px' }} onClick={exportPDF}>Generar PDF</button>
      </div>

      {/* ÁREA PRINCIPAL DERECHA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#555', overflow: 'hidden' }}>
        
        {/* TABS SUPERIORES FIJOS */}
        <div style={{ display: 'flex', gap: '10px', padding: '15px 40px', backgroundColor: '#2d2d2d', borderBottom: '2px solid #000' }}>
          <button 
            type="button"
            onClick={() => setActiveTab('pdf')}
            style={{ padding: '10px 20px', backgroundColor: activeTab === 'pdf' ? '#10b981' : 'transparent', color: activeTab === 'pdf' ? '#000' : '#fff', border: activeTab === 'pdf' ? 'none' : '1px solid #777', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}
          >
            📄 Vista Previa PDF
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('email')}
            style={{ padding: '10px 20px', backgroundColor: activeTab === 'email' ? '#3b82f6' : 'transparent', color: '#fff', border: activeTab === 'email' ? 'none' : '1px solid #777', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}
          >
            ✉️ Plantilla de Correo
          </button>
        </div>

        {/* ÁREA CON SCROLL PARA LA VISTA PREVIA ACTIVA */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', justifyContent: 'center' }}>
          
          {/* ==================================
              VISTA 1: PDF PREVIEW
          ================================== */}
          <div style={{ display: activeTab === 'pdf' ? 'block' : 'none', minWidth: '210mm', maxWidth: '210mm' }}>
            <div id="document-to-print" style={{ margin: '0 auto' }}>
              <div className="header-container">
                <div>
                  <h2 className="logo-title">ENOVA AGENCY</h2>
                  <h3 className="logo-subtitle">Concorde Radar // Soporte Web</h3>
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '9pt', textTransform: 'uppercase' }}>Reporte Mensual</div>
              </div>

              <div className="tag-sup">CLIENTE: {clientName || '...'}</div>
              <h1>INFORME DE SOPORTE Y MANTENIMIENTO</h1>
              <p style={{ fontSize: '10pt', marginBottom: '20px' }}>
                Hola equipo de <span>{clientName || '...'}</span>,<br/>
                Te compartimos el informe de las acciones de soporte y mantenimiento preventivo realizadas para el e-commerce durante esta temporada. El estado general del sitio es óptimo, seguro y opera con normalidad.
              </p>

              <div className="card">
                <h2 className="card-header">1. Monitoreo Proactivo y Prevención de Incidencias</h2>
                <div style={{ display: 'flex', gap: '15px' }}>
                  {['left', 'right'].map(col => (
                    <div style={{ flex: 1 }} key={col}>
                      {sec1Data.filter(c => c.column === col).map(category => (
                        <div key={category.cat}>
                          <div className="section-title">{category.cat}</div>
                          <ul className="item-list-none">
                            {category.items.map(item => {
                              const st = statuses[item.id];
                              const bg = st.status === 'G' ? 'bg-g' : (st.status === 'Y' ? 'bg-y' : 'bg-r');
                              const tx = st.status === 'G' ? 'OK' : (st.status === 'Y' ? 'WARN' : 'CRIT');
                              return (
                                <li key={item.id}>
                                  <div><span className={`badge ${bg}`}>{tx}</span></div>
                                  <div><b>{item.label}:</b> {st.text}</div>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h2 className="card-header">2. Verificaciones de Seguridad y Fiabilidad</h2>
                
                {showTexts.webScan && <div style={{ fontSize: '9.5pt', marginBottom: '10px' }}><b>Análisis de Integridad (Web Scan):</b> Se realizaron escaneos externos que resultaron negativos para malware, inyecciones de código o inclusiones en listas negras.</div>}
                
                {images.scan && <div className="doc-image-container" style={{display:'block'}}><img src={images.scan} alt="Scan"/></div>}
                
                {showTexts.pentest && <div style={{ fontSize: '9.5pt', marginBottom: '10px' }}><b>Pruebas Pentesting:</b> Se ejecutaron pruebas automatizadas sobre los puntos de entrada clave (formularios, checkout) para verificar la robustez del sitio ante vectores de ataque comunes.</div>}
                
                {showTexts.backup && <div style={{ fontSize: '9.5pt', marginBottom: '10px' }}><b>Verificación de Backups:</b> Se validó la integridad de la última copia de seguridad automática.</div>}
              </div>

              <div className="card">
                <h2 className="card-header">3. Análisis de Rendimiento y Velocidad de Carga</h2>
                
                {showTexts.speedIntro && <div style={{ fontSize: '9.5pt', marginBottom: '10px' }}>La velocidad del sitio es un factor clave para la conversión y el SEO.</div>}
                
                {showTexts.network && <div style={{ fontSize: '9.5pt', marginBottom: '10px' }}><b>Análisis de Carga de Red:</b> Se realizó un análisis del "waterfall" de carga de red del sitio. Los resultados muestran un tiempo de carga completo de <b>{timeLoad || '0'} seg</b> y un DOMContentLoaded en <b>{timeDom || '0'} seg</b>. Estos tiempos se encuentran dentro de los rangos óptimos.</div>}
                
                {images.waterfall && <div className="doc-image-container" style={{display:'block'}}><img src={images.waterfall} alt="Waterfall"/></div>}
                
                {showTexts.continuity && <div style={{ fontSize: '9.5pt', marginBottom: '10px', marginTop: '15px' }}><b>Garantía de Continuidad y Flujo Comercial:</b> Se ha realizado un seguimiento diario para verificar que los tiempos de respuesta se mantienen correctos y funcionales, tal como se muestra en la gráfica. Donde el DOM (barras rojas) es el tiempo que tarda la estructura en estar lista, y Load (barras azules) es la descarga total.</div>}
                
                {images.flow && <div className="doc-image-container" style={{display:'block'}}><img src={images.flow} alt="Flow"/></div>}
              </div>

              {platform === 'woo' && (
                <div className="card">
                  <h2 className="card-header">4. Actualización de Componentes y Plugins</h2>
                  <div style={{ fontSize: '9.5pt', marginBottom: '10px' }}>Para garantizar la seguridad y compatibilidad del sitio, se han actualizado los siguientes componentes a sus últimas versiones estables:</div>
                  
                  <div className="section-title" style={{ background:'#EF4444' }}>A. Plugins con acción requerida</div>
                  <ul className="plugin-ul">{renderPluginList(plugins.req)}</ul>

                  <div className="section-title" style={{ background:'#10b981', color:'#000' }}>B. Plugins al día</div>
                  <ul className="plugin-ul">{renderPluginList(plugins.ok)}</ul>

                  <div className="section-title" style={{ background:'#f59e0b', color:'#000' }}>C. Plugins Inactivos (Acción Recomendada: Desinstalar)</div>
                  <ul className="plugin-ul">{renderPluginList(plugins.del)}</ul>
                </div>
              )}

              <div style={{ borderTop: '3px solid #000', paddingTop: '10px', fontWeight: 'bold', fontSize: '9pt', textAlign: 'center', marginTop:'20px' }}>
                  El sitio se encuentra estable y protegido. No se requieren acciones por su parte.<br/>
                  <span style={{ fontWeight:'normal', fontSize:'8.5pt' }}>En caso de necesitar una reunión para ayudarlos con la interpretación, por favor indicarnos su disponibilidad.<br/>Quedamos a su disposición. Saludos cordiales.</span>
              </div>
            </div>
          </div>

          {/* ==================================
              VISTA 2: EMAIL PREVIEW
          ================================== */}
          <div style={{ display: activeTab === 'email' ? 'flex' : 'none', width: '100%', maxWidth: '800px', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* BOTÓN COPIAR */}
            <div style={{ textAlign: 'center', marginBottom: '20px', background: '#2d2d2d', padding: '20px', borderRadius: '8px', width: '100%' }}>
              <p style={{ fontSize: '14px', color: '#ccc', margin: '0 0 15px 0' }}>El correo se copiará automáticamente con el ícono de Concorde y el formato listo para enviar por Gmail.</p>
              <button type="button" className="rg-btn-export" style={{ backgroundColor: '#3b82f6', width: 'auto', padding: '10px 30px' }} onClick={copyToGmail}>
                📋 Copiar Diseño para Gmail
              </button>
            </div>

            {/* TABLA DEL CORREO */}
            <div style={{ background: '#F1F0EA', padding: '40px', borderRadius: '8px', width: '100%' }}>
              <table ref={emailTableRef} align="center" border="0" cellPadding="0" cellSpacing="0" width="100%" style={{ maxWidth: '600px', backgroundColor: '#ffffff', border: '3px solid #000000', boxShadow: '6px 6px 0px #000000', borderCollapse: 'collapse', fontFamily: 'Arial, Helvetica, sans-serif', color: '#111' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '20px', borderBottom: '3px solid #000000' }}>
                      <table border="0" cellPadding="0" cellSpacing="0" width="100%">
                        <tbody>
                          <tr>
                            <td width="55" align="left" valign="middle">
                              <img src="/favicon.svg" alt="Enova Concord Logo" width="45" height="45" style={{ display: 'block', borderRadius: '4px', objectFit: 'contain' }} />
                            </td>
                            <td align="left" valign="middle">
                              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>ENOVA AGENCY</h2>
                              <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px' }}>Soporte Web / Concorde Radar</p>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '35px 25px' }}>
                      <div style={{ display: 'inline-block', border: '2px solid #000', padding: '4px 10px', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', marginBottom: '15px', background: '#10b981', color: '#000' }}>
                        REPORTE MENSUAL ADJUNTO
                      </div>
                      <p style={{ margin: '0 0 15px 0', fontSize: '14.5px', lineHeight: 1.6, color: '#111' }}>
                        Hola <strong>Equipo</strong>,<br/><br/>
                        Te compartimos el informe de las acciones de soporte y mantenimiento preventivo realizadas para el e-commerce durante esta temporada. El estado general del sitio es óptimo, seguro y opera con normalidad.<br/><br/>
                        El enfoque de nuestro servicio es el monitoreo constante para prevenir los problemas clave que impactan a las tiendas online. A continuación, el detalle:
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '25px', backgroundColor: '#f1f0ea', borderTop: '3px solid #000000' }}>
                      <table border="0" cellPadding="0" cellSpacing="0" width="100%">
                        <tbody>
                          <tr>
                            <td width="35" align="left" valign="top" style={{ fontSize: '24px' }}>💬</td>
                            <td align="left">
                              <h3 style={{ margin: '0 0 5px 0', fontSize: '13px', fontWeight: 900, textTransform: 'uppercase' }}>¿Necesitan ayuda con la interpretación?</h3>
                              <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#333' }}>
                                Si tienen dudas con alguna métrica o requieren revisar los detalles, <strong>pueden responder directamente a este correo</strong> o comunicarse a nuestros números de atención.
                              </p>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

export default ReportGenerator;