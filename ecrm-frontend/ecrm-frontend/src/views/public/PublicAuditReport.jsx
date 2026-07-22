import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

function PublicAuditReport() {
    const { id } = useParams();
    const [audit, setAudit] = useState(null);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/audits/${id}`)
            .then(res => res.json())
            .then(data => {
                if(data.success) setAudit(data.data);
            });
    }, [id]);

    if (!audit) return <div style={{ padding: '40px', color: '#fff', backgroundColor: '#000', minHeight: '100vh' }}>Cargando reporte...</div>;
    
    if (audit.status === 'PENDING') {
        return <div style={{ padding: '40px', color: '#fff', backgroundColor: '#000', minHeight: '100vh' }}>El analisis esta en cola de ejecucion. Regresa mas tarde.</div>;
    }

    const metrics = typeof audit.snapshot_data === 'string' ? JSON.parse(audit.snapshot_data) : audit.snapshot_data;
    const loadSeconds = metrics ? (metrics.load_ms / 1000).toFixed(1) : 0;
    const domSeconds = metrics ? (metrics.dom_ms / 1000).toFixed(1) : 0;

    return (
        <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '40px 20px', fontFamily: 'sans-serif' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#111', border: '1px solid #333', padding: '40px', borderRadius: '8px' }}>
                <h1 style={{ color: '#FFD700', textAlign: 'center', marginBottom: '5px' }}>Reporte de Rendimiento Web</h1>
                <h3 style={{ textAlign: 'center', color: '#aaa', marginTop: 0, fontWeight: 'normal' }}>
                    {audit.company_name} | <a href={audit.store_url} style={{ color: '#00c2ff' }}>{audit.store_url}</a>
                </h3>
                
                <hr style={{ borderColor: '#333', margin: '30px 0' }} />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '30px', textAlign: 'center' }}>
                    <div style={{ backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '8px', border: '1px solid #222' }}>
                        <h4 style={{ color: '#FFD700', margin: '0 0 10px 0' }}>Carga Total</h4>
                        <p style={{ fontSize: '36px', fontWeight: 'bold', margin: '0 0 10px 0', color: loadSeconds > 5 ? '#ef4444' : '#22c55e' }}>
                            {loadSeconds}s
                        </p>
                        <span style={{ fontSize: '13px', color: '#888' }}>El tiempo que tus clientes esperan viendo una pantalla de carga.</span>
                    </div>

                    <div style={{ backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '8px', border: '1px solid #222' }}>
                        <h4 style={{ color: '#FFD700', margin: '0 0 10px 0' }}>Interaccion (DOM)</h4>
                        <p style={{ fontSize: '36px', fontWeight: 'bold', margin: '0 0 10px 0', color: domSeconds > 3 ? '#f97316' : '#22c55e' }}>
                            {domSeconds}s
                        </p>
                        <span style={{ fontSize: '13px', color: '#888' }}>El tiempo hasta que el usuario puede hacer clic o deslizar.</span>
                    </div>

                    <div style={{ backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '8px', border: '1px solid #222' }}>
                        <h4 style={{ color: '#FFD700', margin: '0 0 10px 0' }}>Memoria Dispositivo</h4>
                        <p style={{ fontSize: '36px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#f97316' }}>
                            {metrics.ram_core_mb} MB
                        </p>
                        <span style={{ fontSize: '13px', color: '#888' }}>Consumo de RAM que la tienda le exige al celular del comprador.</span>
                    </div>
                </div>

                <div style={{ marginTop: '40px', textAlign: 'center', backgroundColor: '#1a1a1a', padding: '30px', borderRadius: '8px', border: '1px solid #333' }}>
                    <h3 style={{ margin: '0 0 15px 0' }}>Optimiza tu tienda y aumenta conversiones</h3>
                    <p style={{ fontSize: '15px', color: '#aaa', margin: '0 0 25px 0' }}>Cada segundo de lentitud reduce las ventas moviles. Unete a Concorde para recibir monitoreo diario y soporte proactivo.</p>
                    <button style={{ padding: '15px 30px', backgroundColor: '#FFD700', color: '#000', fontSize: '16px', fontWeight: 'bold', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
                        Contactar a un Asesor
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PublicAuditReport;