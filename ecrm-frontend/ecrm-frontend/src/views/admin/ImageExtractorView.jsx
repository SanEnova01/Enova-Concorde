import React, { useState } from 'react';
import crmApi from '../../api/crmApi';

function ImageExtractorView() {
  const [url, setUrl] = useState('');
  
  // Estados para controlar el flujo de la interfaz
  const [status, setStatus] = useState('IDLE'); // Puede ser: IDLE, SCANNING, COMPLETE, ERROR
  const [progress, setProgress] = useState({ total: 0, scanned: 0, phase: '' });
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleExtractImages = async (e) => {
    e.preventDefault(); // Esto evita que el formulario refresque la página
    if (!url.trim()) {
      alert('Por favor, ingresa la URL de una tienda.');
      return;
    }

    setStatus('SCANNING');
    setProgress({ total: 0, scanned: 0, phase: 'Iniciando motor de rastreo...' });
    setDownloadUrl(null);

    // 🌟 INICIAR EL POLLING DE PROGRESO
    const pollInterval = setInterval(async () => {
      try {
        const res = await crmApi.get(`/metrics/extract-progress?url=${encodeURIComponent(url)}`);
        if (res.data) setProgress(res.data);
      } catch (err) {
        // Ignoramos errores temporales de red en el polling
      }
    }, 1500);

    try {
      // Lanzamos la petición pesada
      const response = await crmApi.post('/metrics/extract-images', { url }, { responseType: 'blob' });
      
      // Limpiamos el temporizador
      clearInterval(pollInterval);
      
      // 🌟 CREAMOS LA URL DEL ARCHIVO EN MEMORIA
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const objectUrl = window.URL.createObjectURL(blob);
      
      // Guardamos la URL para el botón de descarga y cambiamos el estado
      setDownloadUrl(objectUrl);
      setProgress(prev => ({ ...prev, phase: '¡Escaneo completado!', scanned: prev.total }));
      setStatus('COMPLETE');
      
    } catch (error) {
      console.error(error);
      clearInterval(pollInterval);
      setProgress({ total: 0, scanned: 0, phase: 'Error en el análisis. Inténtalo de nuevo.' });
      setStatus('ERROR');
      alert('Hubo un error al generar el CSV. Verifica que la URL sea válida.');
    }
  };

  // Resetea el formulario para escanear otra web
  const resetForm = () => {
    setStatus('IDLE');
    setUrl('');
    setDownloadUrl(null);
    setProgress({ total: 0, scanned: 0, phase: '' });
  };

  const percent = progress.total > 0 ? Math.round((progress.scanned / progress.total) * 100) : 0;

  return (
    // 🌟 CONTENEDOR PRINCIPAL CENTRADO
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingTop: '20px' }}>
      
      <div style={{ width: '100%', maxWidth: '700px' }}>
        <h1 className="crm-main-title" style={{ margin: '0 0 24px 0', border: 'none', textAlign: 'center' }}>
          Extractor de Imágenes
        </h1>

        <div className="crm-card-paper">
          <h2 className="crm-section-title" style={{ marginTop: 0 }}>AUDITORÍA DE ASSETS (SHOPIFY / WOO)</h2>
          <p className="crm-text-muted" style={{ marginBottom: '24px', lineHeight: '1.5' }}>
            Ingresa la URL de la tienda para extraer todas las imágenes del Home y el catálogo de productos. 
            Se generará un archivo <strong>.CSV</strong> al vuelo con ubicación, peso real, resolución y etiquetas.
          </p>

          <form onSubmit={handleExtractImages} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="crm-stat-label">URL DE LA TIENDA</label>
              <input 
                type="url" 
                className="crm-input-text" 
                placeholder="https://mitienda.com" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={status === 'SCANNING' || status === 'COMPLETE'}
              />
            </div>

            {/* BOTÓN DE INICIO DE ESCANEO (Se oculta al terminar) */}
            {status !== 'COMPLETE' && (
              <button 
                type="submit" 
                className="crm-btn-black" 
                disabled={status === 'SCANNING'}
                style={{ 
                  padding: '14px', 
                  fontSize: '14px', 
                  opacity: status === 'SCANNING' ? 0.7 : 1,
                  cursor: status === 'SCANNING' ? 'not-allowed' : 'pointer'
                }}
              >
                {status === 'SCANNING' ? '⏳ Escaneando tienda...' : '⬇️ Iniciar Escaneo'}
              </button>
            )}
          </form>

          {/* =========================================
              BARRA DE PROGRESO (Visible escaneando y completado)
              ========================================= */}
          {(status === 'SCANNING' || status === 'COMPLETE') && (
            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: '#111' }}>
                <span>{progress.phase}</span>
                <span>{status === 'COMPLETE' ? '100' : percent}%</span>
              </div>
              
              {/* Contenedor de la barra */}
              <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${status === 'COMPLETE' ? 100 : percent}%`, 
                  height: '100%', 
                  backgroundColor: status === 'COMPLETE' ? '#16a34a' : '#111', // Verde al terminar
                  transition: 'width 0.5s ease-out, background-color 0.3s' 
                }}></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
                <span>📸 Detectadas: <strong>{progress.total}</strong></span>
                <span>⚙️ Analizadas: <strong>{status === 'COMPLETE' ? progress.total : progress.scanned}</strong></span>
              </div>
            </div>
          )}

          {/* =========================================
              BOTÓN DE DESCARGA MANUAL (Solo visible al terminar)
              ========================================= */}
          {status === 'COMPLETE' && downloadUrl && (
            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a 
                href={downloadUrl} 
                download={`auditoria_imagenes_${new URL(url).hostname.replace('www.', '')}.csv`}
                className="crm-btn-black"
                style={{ 
                  textDecoration: 'none', 
                  textAlign: 'center', 
                  padding: '14px', 
                  fontSize: '14px',
                  backgroundColor: '#111',
                  color: '#FFD700',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              >
                📥 Descargar Reporte CSV
              </a>
              
              <button 
                onClick={resetForm} 
                className="crm-btn-border"
                style={{ padding: '10px' }}
              >
                Escanear otra tienda
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default ImageExtractorView;