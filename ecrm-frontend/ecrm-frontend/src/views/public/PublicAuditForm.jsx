import React, { useState } from 'react';
import crmApi from '../../api/crmApi'; // 🌟 Importación corregida de tu API

function PublicAuditForm() {
    const [formData, setFormData] = useState({ prospect_name: '', email: '', company_name: '', store_url: '' });
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // 🌟 Petición corregida usando crmApi
            const res = await crmApi.post('/audits/request', formData);
            if (res.data && res.data.success) {
                setSubmitted(true);
            }
        } catch (error) {
            console.error("Error enviando formulario", error);
            alert("Ocurrió un problema de conexión. Intenta nuevamente.");
        }
        setLoading(false);
    };

    const header = (
        <header style={{ borderBottom: '3px solid #111', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <img src="/favicon.svg" alt="Concorde Logo" style={{ width: '35px', height: '35px' }} />
                <div>   
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px', color: '#111', textTransform: 'uppercase' }}>Enova Agency</h1>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', color: '#666' }}>CONCORDE RADAR</span>
                </div>
            </div>
            <a href="https://enova.agency" target="_blank" rel="noreferrer" style={{ color: '#111', fontWeight: 'bold', textDecoration: 'none', borderBottom: '2px solid #111', paddingBottom: '2px' }}>
                Volver a Enova
            </a>
        </header>
    );

    const footer = (
        <footer style={{ borderTop: '3px solid #111', backgroundColor: '#fff', padding: '60px 20px', marginTop: 'auto' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <h3 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '30px', borderBottom: '2px solid #111', paddingBottom: '10px', display: 'inline-block' }}>Preguntas Frecuentes</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px' }}>
                    <div>
                        <h4 style={{ margin: '0 0 10px 0', fontWeight: '900', fontSize: '18px' }}>¿Qué analiza el motor?</h4>
                        <p style={{ margin: 0, fontSize: '15px', color: '#444', lineHeight: '1.6' }}>Simulamos una visita desde un dispositivo móvil con conexión 4G estándar para medir el tiempo real de carga interactiva (DOM) y el consumo de memoria RAM que exige tu e-commerce.</p>
                    </div>
                    <div>
                        <h4 style={{ margin: '0 0 10px 0', fontWeight: '900', fontSize: '18px' }}>¿Tiene algún costo?</h4>
                        <p style={{ margin: 0, fontSize: '15px', color: '#444', lineHeight: '1.6' }}>No, este snapshot inicial es un diagnóstico completamente gratuito de cortesía de Enova Agency para ayudarte a identificar cuellos de botella técnicos en tu embudo de ventas.</p>
                    </div>
                </div>
                <div style={{ marginTop: '60px', textAlign: 'center', fontSize: '12px', color: '#111', fontWeight: '900', letterSpacing: '2px' }}>
                    © 2026 ENOVA AGENCY - CONCORDE
                </div>
            </div>
        </footer>
    );

    if (submitted) {
        return (
            <div style={{ backgroundColor: '#f2f1ec', color: '#111', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
                {header}
                <main style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
                    <div style={{ backgroundColor: '#fff', border: '3px solid #111', boxShadow: '8px 8px 0px #111', padding: '60px 40px', textAlign: 'center', maxWidth: '600px' }}>
                        <h2 style={{ fontSize: '32px', fontWeight: '900', margin: '0 0 15px 0' }}>¡SOLICITUD EN COLA! 🚀</h2>
                        <p style={{ fontSize: '16px', color: '#444', lineHeight: '1.6', margin: '0 0 30px 0' }}>
                            Nuestro motor de diagnóstico procesará su sitio web en breve. Nos contactaremos con los resultados al correo proporcionado.
                        </p>
                        <button onClick={() => setSubmitted(false)} style={{ padding: '12px 24px', backgroundColor: '#fff', color: '#111', border: '3px solid #111', fontWeight: '900', cursor: 'pointer', boxShadow: '4px 4px 0px #111' }}>
                            ANALIZAR OTRA TIENDA
                        </button>
                    </div>
                </main>
                {footer}
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: '#f2f1ec', color: '#111', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
            {header}
            <main style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', maxWidth: '1100px', width: '100%', gap: '60px', alignItems: 'center' }}>
                    
                    <div>
                        <div style={{ display: 'inline-block', border: '2px solid #111', padding: '4px 12px', fontSize: '13px', fontWeight: '900', letterSpacing: '1px', marginBottom: '20px', backgroundColor: '#fff' }}>
                             ANÁLISIS DE PERFORMANCE
                        </div>
                        <h2 style={{ fontSize: '56px', fontWeight: '900', lineHeight: '1', margin: '0 0 25px 0', letterSpacing: '-2px' }}>
                            La salud de tu ecommerce te puede estar costando clientes.
                        </h2>
                        <p style={{ fontSize: '18px', color: '#444', lineHeight: '1.6', margin: 0, fontWeight: '500' }}>
                            La velocidad técnica de tu tienda dicta tus conversiones. Solicita un escaneo gratuito con el motor <strong style={{ color: '#111' }}>Concorde</strong> y conoce tus métricas reales de impacto en todos los dispositivos.
                        </p>
                    </div>

                    <div style={{ backgroundColor: '#fff', border: '3px solid #111', boxShadow: '12px 12px 0px #111', padding: '40px', borderRadius: '0px' }}>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}>Nombre Completo</label>
                                <input required type="text" placeholder="Ej. Juan Pérez" 
                                    value={formData.prospect_name}
                                    onChange={e => setFormData({...formData, prospect_name: e.target.value})} 
                                    style={{ padding: '14px', border: '2px solid #111', backgroundColor: '#f2f1ec', fontSize: '16px', outline: 'none', fontWeight: '500' }}/>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}>Correo Corporativo</label>
                                <input required type="email" placeholder="juan@tuempresa.com" 
                                    value={formData.email}
                                    onChange={e => setFormData({...formData, email: e.target.value})} 
                                    style={{ padding: '14px', border: '2px solid #111', backgroundColor: '#f2f1ec', fontSize: '16px', outline: 'none', fontWeight: '500' }}/>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}>Empresa / Marca</label>
                                <input required type="text" placeholder="Tu Tienda Online" 
                                    value={formData.company_name}
                                    onChange={e => setFormData({...formData, company_name: e.target.value})} 
                                    style={{ padding: '14px', border: '2px solid #111', backgroundColor: '#f2f1ec', fontSize: '16px', outline: 'none', fontWeight: '500' }}/>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}>URL de la Tienda</label>
                                <input required type="url" placeholder="https://..." 
                                    value={formData.store_url}
                                    onChange={e => setFormData({...formData, store_url: e.target.value})} 
                                    style={{ padding: '14px', border: '2px solid #111', backgroundColor: '#f2f1ec', fontSize: '16px', outline: 'none', fontWeight: '500' }}/>
                            </div>

                            <button type="submit" disabled={loading} style={{ 
                                padding: '18px', backgroundColor: '#111', color: '#fff', 
                                fontSize: '16px', fontWeight: '900', textTransform: 'uppercase', 
                                border: '3px solid #111', cursor: loading ? 'not-allowed' : 'pointer', 
                                marginTop: '10px', transition: 'all 0.2s', boxShadow: '4px 4px 0px #d9534f'
                            }}>
                                {loading ? 'ESCANENANDO...' : 'SOLICITAR AUDITORÍA'}
                            </button>
                        </form>
                    </div>
                </div>
            </main>
            {footer}
        </div>
    );
}

export default PublicAuditForm;