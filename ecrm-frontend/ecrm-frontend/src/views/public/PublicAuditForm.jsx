import React, { useState } from 'react';

function PublicAuditForm() {
    const [formData, setFormData] = useState({ prospect_name: '', email: '', company_name: '', store_url: '' });
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/audits/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                setSubmitted(true);
            }
        } catch (error) {
            console.error("Error enviando formulario", error);
        }
        setLoading(false);
    };

    if (submitted) {
        return (
            <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: '#000', color: '#fff', minHeight: '100vh' }}>
                <h2 style={{ color: '#FFD700', fontSize: '28px' }}>Solicitud Recibida Correctamente</h2>
                <p style={{ color: '#aaa', marginTop: '20px' }}>Nuestro motor de diagnostico procesara su sitio web en breve. Nos contactaremos con los resultados al correo proporcionado.</p>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ padding: '40px', backgroundColor: '#111', borderRadius: '8px', maxWidth: '500px', width: '100%', border: '1px solid #333' }}>
                <h2 style={{ color: '#FFD700', marginBottom: '10px', textAlign: 'center' }}>Auditoria de Rendimiento</h2>
                <p style={{ color: '#aaa', textAlign: 'center', marginBottom: '30px', fontSize: '14px' }}>Descubra que esta frenando las ventas en su e-commerce.</p>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input required type="text" placeholder="Su Nombre" 
                        value={formData.prospect_name}
                        onChange={e => setFormData({...formData, prospect_name: e.target.value})} 
                        style={{ padding: '12px', backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}/>
                    
                    <input required type="email" placeholder="Correo Corporativo" 
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})} 
                        style={{ padding: '12px', backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}/>
                    
                    <input required type="text" placeholder="Empresa o Marca" 
                        value={formData.company_name}
                        onChange={e => setFormData({...formData, company_name: e.target.value})} 
                        style={{ padding: '12px', backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}/>
                    
                    <input required type="url" placeholder="URL de la Tienda (Ej. https://mitienda.com)" 
                        value={formData.store_url}
                        onChange={e => setFormData({...formData, store_url: e.target.value})} 
                        style={{ padding: '12px', backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}/>
                    
                    <button type="submit" disabled={loading} style={{ padding: '15px', backgroundColor: '#FFD700', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}>
                        {loading ? 'Procesando...' : 'Solicitar Diagnostico Gratuito'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default PublicAuditForm;