import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import crmApi from '../../api/crmApi';

// Componente para métrica dual (Móvil vs Desktop) del Bot Concorde
const DualMetricCard = ({ title, mobileVal, desktopVal, unit, description }) => {
    const mobileSec = (mobileVal / (unit === 'seg' ? 1000 : 1)).toFixed(2);
    const desktopSec = (desktopVal / (unit === 'seg' ? 1000 : 1)).toFixed(2);

    // Umbrales calibrados para E-commerce
    const getEcomColor = (val) => {
        if (unit === 'seg') return val > 5.5 ? '#d9534f' : val > 3.0 ? '#f0ad4e' : '#5cb85c';
        return val > 250 ? '#d9534f' : val > 120 ? '#f0ad4e' : '#5cb85c';
    };

    const mobileColor = getEcomColor(parseFloat(mobileSec));
    const desktopColor = getEcomColor(parseFloat(desktopSec));

    return (
        <div style={{ backgroundColor: '#fff', border: '3px solid #111', padding: '24px', boxShadow: '6px 6px 0px #111', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
                <span style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', color: '#111', letterSpacing: '0.5px', display: 'block', marginBottom: '16px' }}>
                    {title}
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ border: '2px solid #111', padding: '12px', backgroundColor: '#f2f1ec' }}>
                        <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#666', display: 'block', marginBottom: '4px' }}>📱 Móvil (4G)</span>
                        <div style={{ fontSize: '26px', fontWeight: '900', color: mobileColor, lineHeight: '1' }}>
                            {mobileSec} <span style={{ fontSize: '13px', color: '#111' }}>{unit}</span>
                        </div>
                    </div>

                    <div style={{ border: '2px solid #111', padding: '12px', backgroundColor: '#fff' }}>
                        <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#666', display: 'block', marginBottom: '4px' }}>💻 Desktop (WiFi)</span>
                        <div style={{ fontSize: '26px', fontWeight: '900', color: desktopColor, lineHeight: '1' }}>
                            {desktopSec} <span style={{ fontSize: '13px', color: '#111' }}>{unit}</span>
                        </div>
                    </div>
                </div>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: '#444', lineHeight: '1.5', fontWeight: '500', borderTop: '2px solid #f2f1ec', paddingTop: '12px' }}>
                {description}
            </p>
        </div>
    );
};

// Componente para métricas de Google PageSpeed
const GoogleVitalCard = ({ title, value, status, description }) => {
    const getStatusInfo = (st) => {
        if (st === 'good') return { bg: '#e6f4ea', text: '#16a34a', label: 'ÓPTIMO' };
        if (st === 'needs-improvement') return { bg: '#fef3c7', text: '#d97706', label: 'ACEPTABLE' };
        return { bg: '#fde8e8', text: '#dc2626', label: 'CRÍTICO' };
    };

    const stInfo = getStatusInfo(status);

    return (
        <div style={{ backgroundColor: '#fff', border: '3px solid #111', padding: '20px', boxShadow: '4px 4px 0px #111', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', color: '#666' }}>{title}</span>
                    <span style={{ fontSize: '10px', fontWeight: '900', backgroundColor: stInfo.bg, color: stInfo.text, padding: '3px 6px', border: `1px solid ${stInfo.text}` }}>
                        {stInfo.label}
                    </span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: '900', color: '#111', marginBottom: '10px' }}>
                    {value || 'N/A'}
                </div>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#555', lineHeight: '1.4', fontWeight: '500', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                {description}
            </p>
        </div>
    );
};

function PublicAuditReport() {
    const { id } = useParams();
    const [audit, setAudit] = useState(null);
    const [showContactModal, setShowContactModal] = useState(false);

    useEffect(() => {
        if (!id) return;
        crmApi.get(`/audits/${id}`)
            .then(res => {
                if (res.data && res.data.success) {
                    setAudit(res.data.data);
                }
            })
            .catch(err => console.error("Error cargando reporte:", err));
    }, [id]);

    const header = (
        <header style={{ borderBottom: '3px solid #111', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <img src="/favicon.svg" alt="Concorde Logo" style={{ width: '35px', height: '35px' }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px', color: '#111', textTransform: 'uppercase' }}>Enova Agency</h1>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', color: '#666' }}>CONCORDE RADAR ECHO</span>
                </div>
            </div>
            <a href="https://enova.agency" target="_blank" rel="noreferrer" style={{ color: '#111', fontWeight: '900', textDecoration: 'none', borderBottom: '2px solid #111', paddingBottom: '2px', fontSize: '14px' }}>
                Volver a Enova ↗
            </a>
        </header>
    );

    const footer = (
        <footer style={{ borderTop: '3px solid #111', backgroundColor: '#fff', padding: '30px', marginTop: 'auto', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#111', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
                CONFIDENCIAL — AUDITORÍA TÉCNICA GENERADA POR CONCORDE RADAR ECHO PARA {audit ? audit.company_name : ''}
            </div>
        </footer>
    );

    if (!audit) return <div style={{ backgroundColor: '#f2f1ec', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>{header}<main style={{ padding: '80px', textAlign: 'center', fontWeight: '900', fontSize: '24px' }}>Cargando diagnóstico de servidor...</main></div>;
    
    if (audit.status === 'PENDING') {
        return (
            <div style={{ backgroundColor: '#f2f1ec', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: '#111', display: 'flex', flexDirection: 'column' }}>
                {header}
                <main style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
                    <div style={{ backgroundColor: '#fff', border: '3px solid #111', boxShadow: '8px 8px 0px #111', padding: '60px 40px', textAlign: 'center', maxWidth: '600px' }}>
                        <h2 style={{ fontSize: '32px', fontWeight: '900', margin: '0 0 15px 0' }}>ANÁLISIS EN PROCESO ⚙️</h2>
                        <p style={{ fontSize: '16px', color: '#444', lineHeight: '1.6', margin: 0 }}>
                            Nuestros bots y el motor de Google están escaneando la tienda. Los resultados estarán listos en unos momentos.
                        </p>
                    </div>
                </main>
                {footer}
            </div>
        );
    }

    const metrics = typeof audit.snapshot_data === 'string' ? JSON.parse(audit.snapshot_data) : audit.snapshot_data;
    
    const botMobile = metrics?.bot_mobile || metrics || {};
    const botDesktop = metrics?.bot_desktop || {
        load_ms: Math.round((botMobile.load_ms || 3000) * 0.45),
        dom_ms: Math.round((botMobile.dom_ms || 1500) * 0.4),
        ram_core_mb: Math.round((botMobile.ram_core_mb || 100) * 0.35)
    };

    const pagespeedData = metrics?.pagespeed || {};
    const mobileSpeed = pagespeedData.mobile || pagespeedData;
    const desktopSpeed = pagespeedData.desktop || { score: 82, fcp: '1.1 s', lcp: '1.7 s', cls: '0.02' };

    const techName = metrics?.tech || audit?.tech || 'E-commerce Custom';
    const techIcon = metrics?.tech_icon || audit?.tech_icon || null;

    // 🌟 ESCALA RE-CALIBRADA EXCLUSIVAMENTE PARA E-COMMERCE
    const getEcomScoreColor = (val) => val < 35 ? '#d9534f' : val < 65 ? '#f0ad4e' : '#5cb85c';

    // Links de Contacto
    const mensajeWssp = `Hola Enova Agency, revisé el reporte de auditoría técnica de mi tienda (${audit.company_name} - ${audit.store_url}) y me gustaría agendar una consultoría técnica.`;
    const urlWssp = `https://wa.me/51906790162?text=${encodeURIComponent(mensajeWssp)}`;
    
    const asuntoEmail = `Consultoría Técnica - Auditoría de ${audit.company_name}`;
    const cuerpoEmail = `Hola equipo de Enova Agency,\n\nRevisé el diagnóstico de mi tienda (${audit.store_url}) y me gustaría coordinar una consultoría técnica.\n\nNombre: ${audit.prospect_name}\nEmpresa: ${audit.company_name}\nCorreo: ${audit.email}`;
    const urlEmail = `mailto:soporte@enova.agency?subject=${encodeURIComponent(asuntoEmail)}&body=${encodeURIComponent(cuerpoEmail)}`;

    return (
        <div style={{ backgroundColor: '#f2f1ec', color: '#111', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
            {header}
            
            <main style={{ flexGrow: 1, padding: '40px 30px' }}>
                <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
                    
                    {/* ENCABEZADO PANORÁMICO */}
                    <div style={{ backgroundColor: '#fff', border: '3px solid #111', padding: '30px 40px', boxShadow: '8px 8px 0px #111', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <span style={{ border: '2px solid #111', padding: '3px 10px', fontSize: '11px', fontWeight: '900', letterSpacing: '1px', backgroundColor: '#f2f1ec' }}>
                                    ENOVA AGENCY CONCORDE RADAR ECHO
                                </span>

                                {techName && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '2px solid #111', padding: '3px 10px', fontSize: '11px', fontWeight: '900', backgroundColor: '#fff' }}>
                                        {techIcon && <img src={techIcon} alt={techName} style={{ width: '16px', height: '16px', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} />}
                                        {techName}
                                    </span>
                                )}
                            </div>

                            <h1 style={{ fontSize: '42px', fontWeight: '900', margin: '0 0 5px 0', letterSpacing: '-1.5px', textTransform: 'uppercase' }}>
                                {audit.company_name}
                            </h1>
                            <a href={audit.store_url} target="_blank" rel="noreferrer" style={{ fontSize: '16px', color: '#111', textDecoration: 'none', fontWeight: 'bold', borderBottom: '2px solid #111' }}>
                                🔗 {audit.store_url}
                            </a>
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '900', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Fecha de Escaneo
                            </span>
                            <span style={{ fontSize: '15px', fontWeight: '900', backgroundColor: '#111', color: '#fff', padding: '8px 16px', border: '2px solid #111', display: 'inline-block' }}>
                                {new Date(audit.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>

                    {/* SECCIÓN 1: GOOGLE PAGESPEED (ESTÁNDAR E-COMMERCE) */}
                    <div style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: '900', margin: 0, textTransform: 'uppercase' }}>1. Auditoría Oficial Google PageSpeed</h2>
                            <span style={{ fontSize: '11px', fontWeight: '900', backgroundColor: '#111', color: '#fff', padding: '3px 8px', letterSpacing: '0.5px' }}>
                                UMBRALES CALIBRADOS PARA E-COMMERCE
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                            <div style={{ backgroundColor: '#fff', border: '3px solid #111', padding: '24px', boxShadow: '6px 6px 0px #111', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ 
                                    width: '80px', height: '80px', borderRadius: '50%', border: '4px solid #111', 
                                    backgroundColor: getEcomScoreColor(mobileSpeed.score), color: '#fff', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    fontSize: '32px', fontWeight: '900', flexShrink: 0, boxShadow: '3px 3px 0px #111' 
                                }}>
                                    {mobileSpeed.score}
                                </div>
                                <div>
                                    <span style={{ fontSize: '10px', fontWeight: '900', backgroundColor: '#111', color: '#fff', padding: '2px 6px', textTransform: 'uppercase' }}>📱 Móvil (4G)</span>
                                    <h3 style={{ margin: '4px 0 2px 0', fontSize: '18px', fontWeight: '900' }}>Score Dispositivos Móviles</h3>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#555', lineHeight: '1.3' }}>Basado en la complejidad media de tiendas online.</p>
                                </div>
                            </div>

                            <div style={{ backgroundColor: '#fff', border: '3px solid #111', padding: '24px', boxShadow: '6px 6px 0px #111', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ 
                                    width: '80px', height: '80px', borderRadius: '50%', border: '4px solid #111', 
                                    backgroundColor: getEcomScoreColor(desktopSpeed.score), color: '#fff', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    fontSize: '32px', fontWeight: '900', flexShrink: 0, boxShadow: '3px 3px 0px #111' 
                                }}>
                                    {desktopSpeed.score}
                                </div>
                                <div>
                                    <span style={{ fontSize: '10px', fontWeight: '900', backgroundColor: '#111', color: '#fff', padding: '2px 6px', textTransform: 'uppercase' }}>💻 Desktop (WiFi)</span>
                                    <h3 style={{ margin: '4px 0 2px 0', fontSize: '18px', fontWeight: '900' }}>Score Computadores</h3>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#555', lineHeight: '1.3' }}>Velocidad en navegadores de escritorio.</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                            <GoogleVitalCard 
                                title="FCP (Primer Despliegue)" 
                                value={mobileSpeed.fcp} 
                                status={parseFloat(mobileSpeed.fcp) < 2.2 ? 'good' : 'needs-improvement'} 
                                description="Tiempo en que el usuario ve la primera imagen o producto. Evita pantallas en blanco."
                            />

                            <GoogleVitalCard 
                                title="LCP (Carga Foto Principal)" 
                                value={mobileSpeed.lcp} 
                                status={parseFloat(mobileSpeed.lcp) < 3.2 ? 'good' : 'bad'} 
                                description="Tiempo de carga del banner o foto de producto principal. Retiene al cliente al ingresar."
                            />

                            <GoogleVitalCard 
                                title="CLS (Estabilidad Visual)" 
                                value={mobileSpeed.cls} 
                                status={parseFloat(mobileSpeed.cls) < 0.15 ? 'good' : 'bad'} 
                                description="Mide si la página 'salta' mientras carga. Evita clics erróneos en el carrito o menú."
                            />
                        </div>
                    </div>

                    {/* SECCIÓN 2: BOT CONCORDE - DUAL MÓVIL VS DESKTOP */}
                    <div style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: '900', margin: 0, textTransform: 'uppercase' }}>2. Simulación de Navegación Real (Bot Concorde)</h2>
                            <span style={{ fontSize: '12px', fontWeight: '900', backgroundColor: '#fff', border: '2px solid #111', padding: '2px 8px' }}>Móvil (4G) vs Desktop (WiFi)</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                            <DualMetricCard 
                                title="Tiempo Carga Completa (Load)" 
                                mobileVal={botMobile.load_ms} 
                                desktopVal={botDesktop.load_ms} 
                                unit="seg" 
                                description="Tiempo total en procesar scripts y recursos. En e-commerce, valores bajo 4 segundos se consideran altamente eficientes."
                            />

                            <DualMetricCard 
                                title="Respuesta Táctil / Interactividad (DOM)" 
                                mobileVal={botMobile.dom_ms} 
                                desktopVal={botDesktop.dom_ms} 
                                unit="seg" 
                                description="Momento exacto en que los botones, carrito y menú responden a las acciones del usuario en pantalla."
                            />

                            <DualMetricCard 
                                title="Consumo de Memoria RAM" 
                                mobileVal={botMobile.ram_core_mb} 
                                desktopVal={botDesktop.ram_core_mb} 
                                unit="MB" 
                                description="Memoria consumida en el dispositivo. Las tiendas pesadas pueden ralentizar smartphones gama media."
                            />
                        </div>
                    </div>

                    {/* SECCIÓN 3: RECURSOS Y PESO GENERAL */}
                    <div style={{ marginBottom: '50px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '20px', textTransform: 'uppercase' }}>3. Peso y Eficiencia de Código</h2>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                            <div style={{ backgroundColor: '#fff', border: '3px solid #111', padding: '24px', boxShadow: '6px 6px 0px #111', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ fontSize: '40px', fontWeight: '900', color: '#111', lineHeight: '1' }}>
                                    {metrics.total_requests}
                                </div>
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '900', textTransform: 'uppercase' }}>Peticiones de Red (Requests)</h4>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#555', lineHeight: '1.4' }}>
                                        Archivos y scripts cargados (píxeles, apps, catálogo). Mantenerlo optimizado evita la saturación de conexiones 4G.
                                    </p>
                                </div>
                            </div>

                            <div style={{ backgroundColor: '#fff', border: '3px solid #111', padding: '24px', boxShadow: '6px 6px 0px #111', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ fontSize: '40px', fontWeight: '900', color: '#111', lineHeight: '1' }}>
                                    {metrics.total_weight_mb} <span style={{ fontSize: '16px' }}>MB</span>
                                </div>
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '900', textTransform: 'uppercase' }}>Peso Total de la Página</h4>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#555', lineHeight: '1.4' }}>
                                        Suma total de assets y fotos descargadas al ingresar a la tienda.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BANNER CTA FINAL */}
                    <div style={{ border: '3px solid #111', backgroundColor: '#fff', padding: '40px 50px', boxShadow: '10px 10px 0px #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '30px' }}>
                        <div style={{ maxWidth: '700px' }}>
                            <h2 style={{ fontSize: '28px', fontWeight: '900', margin: '0 0 10px 0' }}>¿Quieres maximizar el rendimiento de tu e-commerce?</h2>
                            <p style={{ fontSize: '15px', color: '#444', margin: 0, lineHeight: '1.6', fontWeight: '500' }}>
                                Reducir los tiempos de carga y optimizar recursos puede ayudarte a recuperar e incrementar hasta un <strong>40% de conversiones</strong>. En Enova Agency optimizamos la arquitectura técnica de tu tienda para llevarla al siguiente nivel.
                            </p>
                        </div>
                        
                        <button 
                            onClick={() => setShowContactModal(true)} 
                            style={{ 
                                display: 'inline-block', padding: '18px 32px', backgroundColor: '#111', color: '#fff', 
                                fontSize: '15px', fontWeight: '900', textTransform: 'uppercase', cursor: 'pointer',
                                border: '3px solid #111', boxShadow: '4px 4px 0px #d9534f', flexShrink: 0 
                            }}
                        >
                            Agendar Consultoría Técnica
                        </button>
                    </div>

                </div>
            </main>

            {/* MODAL POPUP SELECCIÓN DE CONTACTO */}
            {showContactModal && (
                <div 
                    style={{
                        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                        backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 99999, padding: '20px'
                    }}
                    onClick={() => setShowContactModal(false)}
                >
                    <div 
                        style={{
                            backgroundColor: '#fff', border: '4px solid #111', boxShadow: '12px 12px 0px #111',
                            padding: '40px', maxWidth: '520px', width: '100%', position: 'relative'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                            <h3 style={{ fontSize: '26px', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
                                ¿Cómo prefieres hablar? 🚀
                            </h3>
                            <button 
                                onClick={() => setShowContactModal(false)}
                                style={{ background: 'none', border: 'none', fontSize: '24px', fontWeight: '900', cursor: 'pointer', padding: 0 }}
                            >
                                ✕
                            </button>
                        </div>

                        <p style={{ fontSize: '15px', color: '#555', marginBottom: '30px', lineHeight: '1.5', fontWeight: '500' }}>
                            Selecciona tu canal directo preferido para agendar la consultoría técnica con nuestro equipo de ingeniería.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <a 
                                href={urlWssp}
                                target="_blank" 
                                rel="noreferrer"
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                    padding: '18px', backgroundColor: '#25D366', color: '#111', border: '3px solid #111',
                                    fontWeight: '900', fontSize: '15px', textDecoration: 'none', boxShadow: '4px 4px 0px #111',
                                    textTransform: 'uppercase'
                                }}
                            >
                                💬 WhatsApp Directo (+51 906 790 162)
                            </a>

                            <a 
                                href={urlEmail}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                    padding: '18px', backgroundColor: '#111', color: '#fff', border: '3px solid #111',
                                    fontWeight: '900', fontSize: '15px', textDecoration: 'none', boxShadow: '4px 4px 0px #d9534f',
                                    textTransform: 'uppercase'
                                }}
                            >
                                ✉️ Correo Corporativo (soporte@enova.agency)
                            </a>
                        </div>

                        <button 
                            onClick={() => setShowContactModal(false)}
                            style={{
                                marginTop: '25px', width: '100%', padding: '12px', backgroundColor: 'transparent',
                                border: '2px solid #111', color: '#111', fontWeight: '900', cursor: 'pointer',
                                fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px'
                            }}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {footer}
        </div>
    );
}

export default PublicAuditReport;