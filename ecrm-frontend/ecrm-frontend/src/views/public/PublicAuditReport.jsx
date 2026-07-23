import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import crmApi from '../../api/crmApi';

// Componente para barras gráficas nativas
const MetricBar = ({ label, value, max, unit, color, description }) => {
    const percentage = Math.min((value / max) * 100, 100);
    return (
        <div style={{ marginBottom: '30px', textAlign: 'left', backgroundColor: '#fff', border: '3px solid #111', padding: '20px', boxShadow: '6px 6px 0px #111' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <span style={{ fontWeight: '900', fontSize: '18px', textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontSize: '24px', fontWeight: '900', color: color }}>{value} <span style={{ fontSize: '14px', color: '#111' }}>{unit}</span></span>
            </div>
            <div style={{ height: '24px', border: '2px solid #111', backgroundColor: '#f2f1ec', width: '100%', position: 'relative' }}>
                <div style={{ height: '100%', width: `${percentage}%`, backgroundColor: color, borderRight: percentage < 100 ? '2px solid #111' : 'none', transition: 'width 1s ease-in-out' }}></div>
            </div>
            <p style={{ fontSize: '14px', color: '#444', marginTop: '15px', lineHeight: '1.5', fontWeight: '500' }}>{description}</p>
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
            .catch(err => {
                console.error("Error cargando reporte de auditoría:", err);
            });
    }, [id]);

    const header = (
        <header style={{ borderBottom: '3px solid #111', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <img src="/favicon.svg" alt="Concorde Logo" style={{ width: '35px', height: '35px' }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px', color: '#111', textTransform: 'uppercase' }}>Enova Agency</h1>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', color: '#666' }}>PERFORMANCE REPORT</span>
                </div>
            </div>
        </header>
    );

    const footer = (
        <footer style={{ borderTop: '3px solid #111', backgroundColor: '#fff', padding: '40px', marginTop: 'auto', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#111', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
                CONFIDENCIAL - GENERADO POR CONCORDE ANALYZER PARA {audit ? audit.company_name : ''}
            </div>
        </footer>
    );

    if (!audit) return <div style={{ backgroundColor: '#f2f1ec', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>{header}<main style={{ padding: '60px', textAlign: 'center', fontWeight: '900', fontSize: '24px' }}>Cargando diagnóstico...</main></div>;
    
    if (audit.status === 'PENDING') {
        return (
            <div style={{ backgroundColor: '#f2f1ec', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: '#111', display: 'flex', flexDirection: 'column' }}>
                {header}
                <main style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
                    <div style={{ backgroundColor: '#fff', border: '3px solid #111', boxShadow: '8px 8px 0px #111', padding: '60px 40px', textAlign: 'center', maxWidth: '600px' }}>
                        <h2 style={{ fontSize: '32px', fontWeight: '900', margin: '0 0 15px 0' }}>ANÁLISIS EN COLA ⚙️</h2>
                        <p style={{ fontSize: '16px', color: '#444', lineHeight: '1.6', margin: 0 }}>
                            Nuestros bots están escaneando la tienda. Los resultados no están listos aún.
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
    const pagespeed = metrics?.pagespeed;

    // Colores tipo semáforo
    const getLoadColor = (val) => val > 4.5 ? '#d9534f' : val > 2.5 ? '#f0ad4e' : '#5cb85c';
    const getDomColor = (val) => val > 3.0 ? '#d9534f' : val > 1.5 ? '#f0ad4e' : '#5cb85c';
    const getRamColor = (val) => val > 180 ? '#d9534f' : val > 100 ? '#f0ad4e' : '#5cb85c';
    const getScoreColor = (val) => val < 50 ? '#d9534f' : val < 90 ? '#f0ad4e' : '#5cb85c';

    return (
        <div style={{ backgroundColor: '#f2f1ec', color: '#111', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
            {header}
            
            <main style={{ flexGrow: 1, padding: '60px 20px' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    
                    {/* Título Principal */}
                    <div style={{ marginBottom: '50px', borderBottom: '3px solid #111', paddingBottom: '30px' }}>
                        <div style={{ display: 'inline-block', border: '2px solid #111', padding: '4px 12px', fontSize: '13px', fontWeight: '900', letterSpacing: '1px', marginBottom: '20px', backgroundColor: '#fff' }}>
                            RESULTADOS DEL ESCÁNER
                        </div>
                        <h1 style={{ fontSize: '54px', fontWeight: '900', margin: '0 0 10px 0', letterSpacing: '-2px', textTransform: 'uppercase' }}>
                            {audit.company_name}
                        </h1>
                        <a href={audit.store_url} target="_blank" rel="noreferrer" style={{ fontSize: '20px', color: '#111', textDecoration: 'none', fontWeight: 'bold' }}>
                            🔗 {audit.store_url}
                        </a>
                    </div>

                    {/* 🌟 TARJETA DE GOOGLE PAGESPEED SCORE (SI EXISTE) */}
                    {pagespeed && (
                        <div style={{ backgroundColor: '#fff', border: '3px solid #111', padding: '30px', boxShadow: '8px 8px 0px #111', marginBottom: '50px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                            <div>
                                <span style={{ fontSize: '12px', fontWeight: '900', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Auditoría Oficial </span>
                                <h3 style={{ margin: '5px 0 0 0', fontSize: '24px', fontWeight: '900' }}>Puntuación Móvil PageSpeed</h3>
                            </div>
                            <div style={{ 
                                width: '90px', height: '90px', borderRadius: '50%', border: '4px solid #111', 
                                backgroundColor: getScoreColor(pagespeed.score), color: '#fff', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                fontSize: '36px', fontWeight: '900', boxShadow: '3px 3px 0px #111' 
                            }}>
                                {pagespeed.score}
                            </div>
                        </div>
                    )}
                    
                    {/* Gráficas de Rendimiento */}
                    <div style={{ marginBottom: '60px' }}>
                        <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '30px' }}>Métricas Clave de Rendimiento</h2>
                        
                        <MetricBar 
                            label="Tiempo de Carga Total (Load)" 
                            value={loadSeconds} 
                            max={8} 
                            unit="segundos" 
                            color={getLoadColor(loadSeconds)} 
                            description="Mide cuánto tarda la página en cargar todos sus recursos visuales. Reducir este tiempo previene el abandono temprano de usuarios."
                        />

                        <MetricBar 
                            label="Interactividad Inicial (DOM)" 
                            value={domSeconds} 
                            max={6} 
                            unit="segundos" 
                            color={getDomColor(domSeconds)} 
                            description="El momento en el que el comprador puede hacer clic o interactuar. A mayor velocidad de respuesta, mayor tasa de conversión."
                        />

                        <MetricBar 
                            label="Exigencia de Memoria RAM" 
                            value={metrics.ram_core_mb} 
                            max={300} 
                            unit="MB" 
                            color={getRamColor(metrics.ram_core_mb)} 
                            description="Indica el consumo de memoria en el celular del comprador. Optimizar este consumo evita ralentizaciones y cierres de pestañas."
                        />
                    </div>

                    {/* Fila de Datos Secundarios */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '60px' }}>
                        <div style={{ backgroundColor: '#fff', border: '3px solid #111', padding: '30px', textAlign: 'center', boxShadow: '4px 4px 0px #111' }}>
                            <span style={{ display: 'block', fontSize: '13px', fontWeight: '900', color: '#666', textTransform: 'uppercase', marginBottom: '10px' }}>Peticiones Internas</span>
                            <span style={{ fontSize: '32px', fontWeight: '900' }}>{metrics.total_requests} <span style={{fontSize: '16px'}}>req</span></span>
                        </div>
                        <div style={{ backgroundColor: '#fff', border: '3px solid #111', padding: '30px', textAlign: 'center', boxShadow: '4px 4px 0px #111' }}>
                            <span style={{ display: 'block', fontSize: '13px', fontWeight: '900', color: '#666', textTransform: 'uppercase', marginBottom: '10px' }}>Peso de Descarga</span>
                            <span style={{ fontSize: '32px', fontWeight: '900' }}>{metrics.total_weight_mb} <span style={{fontSize: '16px'}}>MB</span></span>
                        </div>
                    </div>

                    {/* Call To Action Universal */}
                    <div style={{ border: '3px solid #111', backgroundColor: '#fff', padding: '50px', textAlign: 'center', boxShadow: '8px 8px 0px #111' }}>
                        <h2 style={{ fontSize: '32px', fontWeight: '900', margin: '0 0 15px 0' }}>¿Quieres maximizar el rendimiento de tu e-commerce?</h2>
                        <p style={{ fontSize: '18px', color: '#444', margin: '0 auto 30px auto', maxWidth: '600px', lineHeight: '1.6', fontWeight: '500' }}>
                            Reducir los tiempos de carga y optimizar recursos puede ayudarte a recuperar e incrementar hasta un <strong>40% de conversiones</strong>. En Enova Agency optimizamos la arquitectura técnica de tu tienda para llevarla al siguiente nivel.
                        </p>
                        <a href="https://enova.agency/contacto" target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '18px 36px', backgroundColor: '#111', color: '#fff', fontSize: '16px', fontWeight: '900', textTransform: 'uppercase', textDecoration: 'none', border: '3px solid #111', boxShadow: '4px 4px 0px #d9534f' }}>
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