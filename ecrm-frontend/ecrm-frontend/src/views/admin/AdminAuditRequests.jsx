import React, { useEffect, useState } from 'react';
import crmApi from '../../api/crmApi';

function AdminAuditRequests() {
    const [requests, setRequests] = useState([]);
    const [loadingId, setLoadingId] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const res = await crmApi.get('/audits');
            if (res.data && res.data.success) {
                setRequests(res.data.data);
                setSelectedIds([]);
            }
        } catch (error) {
            console.error("Error obteniendo solicitudes", error);
        }
    };

    const runAudit = async (id) => {
        setLoadingId(id);
        try {
            const res = await crmApi.post(`/audits/${id}/run`);
            if (res.data && res.data.success) {
                fetchRequests();
            } else {
                alert("Error al ejecutar auditoría: " + (res.data?.error || "Error desconocido"));
            }
        } catch (error) {
            console.error("Error ejecutando auditoría:", error);
            alert("Ocurrió un error al intentar ejecutar el Bot.");
        }
        setLoadingId(null);
    };

    // Manejo de Checkboxes de selección
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(requests.map(r => r.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectRow = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(item => item !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    // Eliminar seleccionados
    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`¿Estás seguro de eliminar ${selectedIds.length} registro(s)?`)) return;

        setDeleting(true);
        try {
            const res = await crmApi.delete('/audits/batch', { data: { ids: selectedIds } });
            if (res.data && res.data.success) {
                fetchRequests();
            } else {
                alert("Error al eliminar: " + (res.data?.error || "Error desconocido"));
            }
        } catch (error) {
            console.error("Error eliminando registros:", error);
            alert("Ocurrió un problema al eliminar los registros.");
        }
        setDeleting(false);
    };

    return (
        <div className="crm-admin-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 className="crm-page-title" style={{ margin: 0 }}>Solicitudes de Auditoría</h1>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                    {selectedIds.length > 0 && (
                        <button 
                            onClick={handleDeleteSelected}
                            disabled={deleting}
                            style={{ 
                                padding: '10px 18px', backgroundColor: '#d9534f', color: '#fff', 
                                border: '3px solid #111', fontWeight: '900', cursor: 'pointer', 
                                boxShadow: '3px 3px 0px #111', textTransform: 'uppercase', fontSize: '13px' 
                            }}
                        >
                            {deleting ? 'Eliminando...' : `🗑️ Eliminar (${selectedIds.length})`}
                        </button>
                    )}
                    
                    <a 
    href="/performance-radar" 
    target="_blank" 
    rel="noreferrer" 
    className="crm-btn-black"
    style={{ textDecoration: 'none', display: 'inline-block' }}
>
    Ver Formulario Público ↗
</a>
                </div>
            </div>

            <div className="crm-card-paper">
                <table className="crm-table-data" style={{ width: '100%' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '40px', textAlign: 'center' }}>
                                <input 
                                    type="checkbox" 
                                    onChange={handleSelectAll} 
                                    checked={requests.length > 0 && selectedIds.length === requests.length}
                                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                />
                            </th>
                            <th>Fecha</th>
                            <th>Empresa</th>
                            <th>Contacto</th>
                            <th>URL</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {requests.length === 0 ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>No hay solicitudes pendientes.</td></tr>
                        ) : (
                            requests.map(req => (
                                <tr key={req.id} style={{ backgroundColor: selectedIds.includes(req.id) ? '#fef3c7' : 'transparent' }}>
                                    <td style={{ textAlign: 'center' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedIds.includes(req.id)}
                                            onChange={() => handleSelectRow(req.id)}
                                            style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                        />
                                    </td>
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
                                        <div style={{ display: 'flex', gap: '8px' }}>
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
                                                <>
                                                    <a 
                                                        href={`/reporte/${req.id}`} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        className="crm-btn-border" 
                                                        style={{ textDecoration: 'none', padding: '6px 12px', fontSize: '12px', display: 'inline-block' }}
                                                    >
                                                        Ver Reporte
                                                    </a>
                                                    <button 
                                                        className="crm-btn-border" 
                                                        onClick={() => runAudit(req.id)}
                                                        disabled={loadingId === req.id}
                                                        style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                                                        title="Volver a escanear"
                                                    >
                                                        {loadingId === req.id ? '...' : '🔄'}
                                                    </button>
                                                </>
                                            )}
                                        </div>
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