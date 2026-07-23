import React, { useEffect, useState } from 'react';

function AdminAuditRequests() {
    const [requests, setRequests] = useState([]);
    const [loadingId, setLoadingId] = useState(null);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        const token = localStorage.getItem('crm_token');
        try {
            const res = await fetch('/api/audits', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setRequests(data.data);
            }
        } catch (error) {
            console.error("Error obteniendo solicitudes", error);
        }
    };

    const runAudit = async (id) => {
        setLoadingId(id);
        const token = localStorage.getItem('crm_token');
        try {
            const res = await fetch(`/api/audits/${id}/run`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                fetchRequests();
            } else {
                alert("Error al ejecutar auditoria: " + data.error);
            }
        } catch (error) {
            console.error("Error", error);
        }
        setLoadingId(null);
    };

    return (
        <div className="crm-admin-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 className="crm-page-title" style={{ margin: 0 }}>Solicitudes de Auditoría</h1>
                <a 
                    href="/auditoria" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="crm-btn-black"
                    style={{ textDecoration: 'none', display: 'inline-block' }}
                >
                    Ver Formulario Público ↗
                </a>
            </div>

            <div className="crm-card-paper">
                <table className="crm-table-data" style={{ width: '100%' }}>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Empresa</th>
                            <th>Contacto</th>
                            <th>URL</th>
                            <th>Estado</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {requests.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No hay solicitudes pendientes.</td></tr>
                        ) : (
                            requests.map(req => (
                                <tr key={req.id}>
                                    <td>{new Date(req.created_at).toLocaleDateString()}</td>
                                    <td><strong>{req.company_name}</strong></td>
                                    <td>{req.prospect_name}<br/><span style={{ fontSize: '12px', color: '#666' }}>{req.email}</span></td>
                                    <td><a href={req.store_url} target="_blank" rel="noreferrer" style={{ color: '#111', fontWeight: 'bold' }}>Link</a></td>
                                    <td>
                                        <span style={{ 
                                            backgroundColor: req.status === 'COMPLETED' ? '#e6f4ea' : '#fcf8e3', 
                                            color: req.status === 'COMPLETED' ? '#16a34a' : '#f97316', 
                                            padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid currentColor' 
                                        }}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td>
                                        {req.status === 'PENDING' ? (
                                            <button 
                                                className="crm-btn-black" 
                                                onClick={() => runAudit(req.id)}
                                                disabled={loadingId === req.id}
                                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                            >
                                                {loadingId === req.id ? 'Analizando...' : 'Ejecutar Bot'}
                                            </button>
                                        ) : (
                                            <a 
                                                href={`/reporte/${req.id}`} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                className="crm-btn-border" 
                                                style={{ textDecoration: 'none', padding: '6px 12px', fontSize: '12px', display: 'inline-block' }}
                                            >
                                                Ver Resultados
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default AdminAuditRequests;