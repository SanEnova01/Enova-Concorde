import React, { useState } from 'react';
import crmApi from '../../api/crmApi';

function ImageExtractorView() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExtractImages = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      alert('Por favor, ingresa la URL de una tienda.');
      return;
    }

    setLoading(true);
    try {
      // 🌟 Petición a tu API (devuelve un Blob para no tocar el disco del servidor)
      const response = await crmApi.post('/metrics/extract-images', { url }, { responseType: 'blob' });
      
      // 🌟 Generación y descarga ultraligera del CSV en la memoria del navegador
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', `auditoria_imagenes_${new URL(url).hostname.replace('www.', '')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error(error);
      alert('Hubo un error al generar el CSV. Verifica que la URL sea válida y que la tienda permita el escaneo.');
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Extractor de Imágenes</h1>
      </div>

      <div className="crm-card-paper" style={{ maxWidth: '700px' }}>
        <h2 className="crm-section-title" style={{ marginTop: 0 }}>Auditoría de Assets (Shopify / Woo)</h2>
        <p className="crm-text-muted" style={{ marginBottom: '24px', lineHeight: '1.5' }}>
          Ingresa la URL de la tienda para extraer todas las imágenes del Home y el catálogo de productos. 
          Se generará un archivo <strong>.CSV</strong> al vuelo con ubicación, peso real (KB/MB), resolución y etiquetas Alt.
          <br/><br/>
          <span style={{ color: '#d9534f', fontWeight: 'bold' }}>Nota:</span> Los datos se construyen en la memoria RAM y se destruyen automáticamente tras la descarga.
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
            {loading ? '⏳ Analizando tienda y generando CSV...' : '⬇️ Escanear y Descargar CSV'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ImageExtractorView;