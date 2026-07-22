import React, { useState } from 'react';

function QuickAnalysis({ storeId, storeUrl }) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const runAnalysis = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('crm_token');
            const res = await fetch('/api/metrics/run-single-client', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ store_id: storeId, url: storeUrl })
            });
            const data = await res.json();
            if (data.success) {
                setResult(data.data);
                setShowModal(true);
            } else {
                alert("Error: " + data.error);
            }
        } catch (error) {
            console.error("Error ejecutando analisis individual", error);
        }
        setLoading(false);
    };

    return (
        <div style={{ marginBottom: '20px' }}>
            <button 
                onClick={runAnalysis} 
                disabled={loading} 
                className="crm-btn-border"
                style={{ width: '100%', padding: '10px', fontWeight: 'bold' }}
            >
                {loading ? 'Analizando en segundo plano (30s)...' : 'Analisis Rapido On-Demand'}
            </button>

            {showModal && result && (
                <div className="crm-modal-mask" onClick={() => setShowModal(false)} style={{ zIndex: 9999 }}>
                    <div className="crm-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <h2 className="crm-section-title">Resultados en Vivo</h2>
                        <table className="crm-table-data" style={{ width: '100%', marginTop: '15px' }}>
                            <tbody>
                                <tr>
                                    <td><strong>Tiempo de Carga (Load):</strong></td>
                                    <td>{(result.load_ms / 1000).toFixed(2)}s</td>
                                </tr>
                                <tr>
                                    <td><strong>DOM Interactive:</strong></td>
                                    <td>{(result.dom_ms / 1000).toFixed(2)}s</td>
                                </tr>
                                <tr>
                                    <td><strong>RAM Dispositivo:</strong></td>
                                    <td>{result.ram_core_mb} MB</td>
                                </tr>
                                <tr>
                                    <td><strong>Peticiones de red:</strong></td>
                                    <td>{result.total_requests}</td>
                                </tr>
                                <tr>
                                    <td><strong>Peso transferido:</strong></td>
                                    <td>{result.total_weight_mb} MB</td>
                                </tr>
                            </tbody>
                        </table>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button className="crm-btn-red" onClick={() => setShowModal(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default QuickAnalysis;