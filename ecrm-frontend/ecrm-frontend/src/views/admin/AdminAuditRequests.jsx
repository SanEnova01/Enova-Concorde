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
                fetchRequests(); // Recargar la lista para mostrar estado completado
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
            <h1 className="crm-page-title">Solicitudes de Auditoria (Prospectos)</h1>
            <div className="crm-card-paper">
                <table className="crm-table-data" style={{ width: '100%' }}>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Empresa</th>
                            <th>Contacto</th>
                            <th>URL</th>
                            <th>Estado</th>
                            <th>Accion</th>
                        </tr>
                    </thead>
                    <tbody>
                        {requests.map(req => (
                            <tr key={req.id}>
                                <td>{new Date(req.created_at).toLocaleDateString()}</td>
                                <td>{req.company_name}</td>
                                <td>{req.prospect_name} ({req.email})</td>
                                <td><a href={req.store_url} target="_blank" rel="noreferrer" style={{ color: '#00c2ff' }}>Ver web</a></td>
                                <td>
                                    <span style={{ color: req.status === 'COMPLETED' ? '#22c55e' : '#f97316', fontWeight: 'bold' }}>
                                        {req.status}
                                    </span>
                                </td>
                                <td>
                                    {req.status === 'PENDING' ? (
                                        <button 
                                            className="crm-btn-border" 
                                            onClick={() => runAudit(req.id)}
                                            disabled={loadingId === req.id}
                                        >
                                            {loadingId === req.id ? 'Analizando...' : 'Ejecutar Bot'}
                                        </button>
                                    ) : (
                                        <a href={`/reporte/${req.id}`} target="_blank" rel="noreferrer" className="crm-btn-border" style={{ textDecoration: 'none' }}>
                                            Ver Reporte
                                        </a>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default AdminAuditRequests;