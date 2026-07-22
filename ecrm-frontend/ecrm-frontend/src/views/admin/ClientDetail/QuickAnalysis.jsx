import React, { useState } from 'react';
import crmApi from '../../../api/crmApi'; // Importamos tu instancia de Axios configurada

function QuickAnalysis({ storeId, storeUrl }) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const runAnalysis = async () => {
        setLoading(true);
        try {
            // 🌟 1. Usamos crmApi.post para evitar el error 405 y asegurar los headers
            // 🌟 2. Solo enviamos la URL específica de ESTA tienda
            const response = await crmApi.post('/metrics/run-single-client', { 
                store_id: storeId, 
                url: storeUrl 
            });
            
            if (response.data && response.data.success) {
                setResult(response.data.data);
                setShowModal(true);
            } else {
                alert("Error: " + (response.data?.error || "Ocurrió un error en el servidor."));
            }
        } catch (error) {
            console.error("Error ejecutando análisis individual:", error);
            alert("Error de conexión. Si acabas de subir código, espera un minuto a que Railway termine de compilar.");
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
                {loading ? 'Analizando en segundo plano (30s)...' : '⚡ Análisis Rápido On-Demand'}
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