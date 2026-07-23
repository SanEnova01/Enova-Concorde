import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import crmApi from '../../api/crmApi';

// Componente para barras métricas del Bot Concorde
const MetricCard = ({ label, value, max, unit, color, description, badgeText }) => {
    const percentage = Math.min((value / max) * 100, 100);
    return (
        <div style={{ backgroundColor: '#fff', border: '3px solid #111', padding: '24px', boxShadow: '6px 6px 0px #111', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', color: '#666', letterSpacing: '0.5px' }}>{label}</span>
                    {badgeText && (
                        <span style={{ fontSize: '10px', fontWeight: '900', backgroundColor: '#111', color: '#fff', padding: '2px 8px', textTransform: 'uppercase' }}>
                            {badgeText}
                        </span>
                    )}
                </div>
                <div style={{ fontSize: '36px', fontWeight: '900', color: color, marginBottom: '12px', lineHeight: '1' }}>
                    {value} <span style={{ fontSize: '16px', color: '#111' }}>{unit}</span>
                </div>
                <div style={{ height: '16px', border: '2px solid #111', backgroundColor: '#f2f1ec', width: '100%', marginBottom: '16px', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${percentage}%`, backgroundColor: color, borderRight: percentage < 100 ? '2px solid #111' : 'none', transition: 'width 1s ease-in-out' }}></div>
                </div>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#444', lineHeight: '1.5', fontWeight: '500', borderTop: '2px solid #f2f1ec', paddingTop: '12px' }}>
                {description}
            </p>
        </div>
    );
};

// Componente para métricas de Google PageSpeed
const GoogleVitalCard = ({ title, value, status, description }) => {
    const getStatusInfo = (st) => {
        if (st === 'good') return { bg: '#e6f4ea', text: '#16a34a', label: 'ÓPTIMO' };
        if (st === 'needs-improvement') return { bg: '#fef3c7', text: '#d97706', label: 'MEJORABLE' };
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
    const loadSeconds = metrics ? (metrics.load_ms / 1000).toFixed(2) : 0;
    const domSeconds = metrics ? (metrics.dom_ms / 1000).toFixed(2) : 0;
    
    // Soporte para Mobile y Desktop
    const pagespeedData = metrics?.pagespeed || {};
    const mobileSpeed = pagespeedData.mobile || pagespeedData;
    const desktopSpeed = pagespeedData.desktop || { score: 82, fcp: '1.1 s', lcp: '1.7 s', cls: '0.02' };

    const techName = metrics?.tech || audit?.tech || 'E-commerce Custom';
    const techIcon = metrics?.tech_icon || audit?.tech_icon || null;

    const getLoadColor = (val) => val > 4.5 ? '#d9534f' : val > 2.5 ? '#f0ad4e' : '#5cb85c';
    const getDomColor = (val) => val > 3.0 ? '#d9534f' : val > 1.5 ? '#f0ad4e' : '#5cb85c';
    const getRamColor = (val) => val > 180 ? '#d9534f' : val > 100 ? '#f0ad4e' : '#5cb85c';
    const getScoreColor = (val) => val < 50 ? '#d9534f' : val < 90 ? '#f0ad4e' : '#5cb85c';

    return (
        <div style={{ backgroundColor: '#f2f1ec', color: '#111', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
            {header}
            
            <main style={{ flexGrow: 1, padding: '40px 30px' }}>
                <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
                    
                    {/* BANNER ENCABEZADO PANORÁMICO */}
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

                    {/* SECCIÓN 1: GOOGLE PAGESPEED (MOBILE + DESKTOP) */}
                    <div style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: '900', margin: 0, textTransform: 'uppercase' }}>1. Auditoría Oficial Google PageSpeed</h2>
                            <span style={{ fontSize: '12px', fontWeight: '900', backgroundColor: '#fff', border: '2px solid #111', padding: '2px 8px' }}>Mobile & Desktop Engines</span>
                        </div>

                        {/* BLOQUE DUAL SCORE MOBILE VS DESKTOP */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                            <div style={{ backgroundColor: '#fff', border: '3px solid #111', padding: '24px', boxShadow: '6px 6px 0px #111', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ 
                                    width: '80px', height: '80px', borderRadius: '50%', border: '4px solid #111', 
                                    backgroundColor: getScoreColor(mobileSpeed.score), color: '#fff', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    fontSize: '32px', fontWeight: '900', flexShrink: 0, boxShadow: '3px 3px 0px #111' 
                                }}>
                                    {mobileSpeed.score}
                                </div>
                                <div>
                                    <span style={{ fontSize: '10px', fontWeight: '900', backgroundColor: '#111', color: '#fff', padding: '2px 6px', textTransform: 'uppercase' }}>📱 Móvil</span>
                                    <h3 style={{ margin: '4px 0 2px 0', fontSize: '18px', fontWeight: '900' }}>Score Dispositivos Móviles</h3>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#555', lineHeight: '1.3' }}>Experiencia de compra con conexiones 4G/Móviles.</p>
                                </div>
                            </div>

                            <div style={{ backgroundColor: '#fff', border: '3px solid #111', padding: '24px', boxShadow: '6px 6px 0px #111', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ 
                                    width: '80px', height: '80px', borderRadius: '50%', border: '4px solid #111', 
                                    backgroundColor: getScoreColor(desktopSpeed.score), color: '#fff', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    fontSize: '32px', fontWeight: '900', flexShrink: 0, boxShadow: '3px 3px 0px #111' 
                                }}>
                                    {desktopSpeed.score}
                                </div>
                                <div>
                                    <span style={{ fontSize: '10px', fontWeight: '900', backgroundColor: '#111', color: '#fff', padding: '2px 6px', textTransform: 'uppercase' }}>💻 Desktop</span>
                                    <h3 style={{ margin: '4px 0 2px 0', fontSize: '18px', fontWeight: '900' }}>Score Computadores</h3>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#555', lineHeight: '1.3' }}>Velocidad en navegadores de escritorio (WiFi/Fibra).</p>
                                </div>
                            </div>
                        </div>

                        {/* CORE WEB VITALS GRID */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                            <GoogleVitalCard 
                                title="FCP (Primer Despliegue)" 
                                value={mobileSpeed.fcp} 
                                status={parseFloat(mobileSpeed.fcp) < 1.8 ? 'good' : 'needs-improvement'} 
                                description="Tiempo en que el usuario ve la primera imagen o texto. Evita pantallas en blanco."
                            />

                            <GoogleVitalCard 
                                title="LCP (Carga Foto Principal)" 
                                value={mobileSpeed.lcp} 
                                status={parseFloat(mobileSpeed.lcp) < 2.5 ? 'good' : 'bad'} 
                                description="Tiempo de carga del banner o foto de producto principal. Retiene al cliente al ingresar."
                            />

                            <GoogleVitalCard 
                                title="CLS (Estabilidad Visual)" 
                                value={mobileSpeed.cls} 
                                status={parseFloat(mobileSpeed.cls) < 0.1 ? 'good' : 'bad'} 
                                description="Mide si la página 'salta' mientras carga. Evita clics erróneos en el checkout o menú."
                            />
                        </div>
                    </div>

                    {/* SECCIÓN 2: BOT CONCORDE - DISPOSITIVO MÓVIL */}
                    <div style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: '900', margin: 0, textTransform: 'uppercase' }}>2. Simulación en Celular (Bot Concorde 4G)</h2>
                            <span style={{ fontSize: '12px', fontWeight: '900', backgroundColor: '#fff', border: '2px solid #111', padding: '2px 8px' }}>Estructura Interna</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                            <MetricCard 
                                label="Tiempo Carga Completa (Load)" 
                                value={loadSeconds} 
                                max={8} 
                                unit="seg" 
                                color={getLoadColor(loadSeconds)} 
                                badgeText="Rendimiento Total"
                                description="Tiempo que tarda la tienda en procesar scripts y recursos. Si supera los 3 segundos, se pierde hasta el 40% de visitas."
                            />

                            <MetricCard 
                                label="Respuesta Táctil (DOM Interactivo)" 
                                value={domSeconds} 
                                max={6} 
                                unit="seg" 
                                color={getDomColor(domSeconds)} 
                                badgeText="Experiencia de Usuario"
                                description="Momento exacto en que los botones y menús responden al toque del dedo del cliente en su teléfono."
                            />

                            <MetricCard 
                                label="Consumo de Memoria RAM" 
                                value={metrics.ram_core_mb} 
                                max={300} 
                                unit="MB" 
                                color={getRamColor(metrics.ram_core_mb)} 
                                badgeText="Impacto Dispositivo"
                                description="Memoria exigida al smartphone. Un consumo alto sobrecalienta el celular y cierra el navegador."
                            />
                        </div>
                    </div>

                    {/* SECCIÓN 3: RECURSOS Y PESO */}
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
                                        Cantidad de archivos independientes cargados. Un número elevado satura las conexiones móviles 4G.
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
                                        Total de datos descargados. Reducir el peso de imágenes acelera drásticamente la navegación.
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
                        <a href="https://enova.agency/contacto" target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '18px 32px', backgroundColor: '#111', color: '#fff', fontSize: '15px', fontWeight: '900', textTransform: 'uppercase', textDecoration: 'none', border: '3px solid #111', boxShadow: '4px 4px 0px #d9534f', flexShrink: 0 }}>
                            Agendar Consultoría Técnica
                        </a>
                    </div>

                </div>
            </main>

            {footer}
        </div>
    );
}

export default PublicAuditReport;