import React, { useState } from 'react';
import crmApi from '../../api/crmApi';

function ImageExtractorView() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ total: 0, scanned: 0, phase: '' });

  const handleExtractImages = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      alert('Por favor, ingresa la URL de una tienda.');
      return;
    }

    setLoading(true);
    setProgress({ total: 0, scanned: 0, phase: 'Iniciando motor de rastreo...' });

    // 🌟 INICIAR EL POLLING DE PROGRESO (Pregunta cada 1.5 segundos)
    const pollInterval = setInterval(async () => {
      try {
        const res = await crmApi.get(`/metrics/extract-progress?url=${encodeURIComponent(url)}`);
        if (res.data) setProgress(res.data);
      } catch (err) {
        // Ignoramos errores temporales de red
      }
    }, 1500);

    try {
      // Lanzamos la petición pesada que generará el CSV
      const response = await crmApi.post('/metrics/extract-images', { url }, { responseType: 'blob' });
      
      // Limpiamos el temporizador
      clearInterval(pollInterval);
      setProgress(prev => ({ ...prev, phase: '¡Archivo generado con éxito!', scanned: prev.total }));

      // Descargamos el archivo
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', `auditoria_imagenes_${new URL(url).hostname.replace('www.', '')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error(error);
      clearInterval(pollInterval);
      setProgress({ total: 0, scanned: 0, phase: 'Error en el análisis. Inténtalo de nuevo.' });
      alert('Hubo un error al generar el CSV. Verifica que la URL sea válida.');
    }
    
    setLoading(false);
  };

  // Calcular porcentaje para la barra visual (Evita NaN si total es 0)
  const percent = progress.total > 0 ? Math.round((progress.scanned / progress.total) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Extractor de Imágenes</h1>
      </div>

      <div className="crm-card-paper" style={{ maxWidth: '700px' }}>
        <h2 className="crm-section-title" style={{ marginTop: 0 }}>Auditoría de Assets (Shopify / Woo)</h2>
        <p className="crm-text-muted" style={{ marginBottom: '24px', lineHeight: '1.5' }}>
          Ingresa la URL de la tienda para extraer todas las imágenes del Home y el catálogo de productos. 
          Se generará un archivo <strong>.CSV</strong> al vuelo con ubicación, peso real, resolución y etiquetas.
        </p>

        <form onSubmit={handleExtractImages} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="crm-stat-label">URL de la Tienda</label>
            <input 
              type="url" 
              className="crm-input-text" 
              placeholder="Ej: https://mitienda.com" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="crm-btn-black" 
            disabled={loading}
            style={{ 
              padding: '14px', 
              fontSize: '14px', 
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '⏳ Analizando tienda...' : '⬇️ Escanear y Descargar CSV'}
          </button>
        </form>

        {/* =========================================
            BARRA DE PROGRESO (SOLO VISIBLE CARGANDO)
            ========================================= */}
        {loading && (
          <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: '#111' }}>
              <span>{progress.phase}</span>
              <span>{percent}%</span>
            </div>
            
            {/* Contenedor de la barra */}
            <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
              {/* Relleno de la barra animado */}
              <div style={{ 
                width: `${percent}%`, 
                height: '100%', 
                backgroundColor: '#111', 
                transition: 'width 0.5s ease-out' 
              }}></div>
            </div>

            {/* Contadores exactos */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
              <span>📸 Imágenes Detectadas: <strong>{progress.total}</strong></span>
              <span>⚙️ Analizadas / Pesadas: <strong>{progress.scanned}</strong></span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default ImageExtractorView;