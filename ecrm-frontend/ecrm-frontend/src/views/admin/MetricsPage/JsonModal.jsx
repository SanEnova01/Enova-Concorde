import React from 'react';
import { Copy, Check, X } from 'lucide-react';

// MODAL DE DATOS COMPLETOS EN FORMATO JSON
const JsonModal = ({ jsonModalData, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyJson = () => {
    const jsonString = JSON.stringify(jsonModalData, null, 2);
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="crm-modal-mask" 
      onClick={() => onClose()} 
      style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div 
        className="crm-modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          width: '850px', 
          maxWidth: '95vw', 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '20px', 
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '2px solid #111827',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
        }}
      >
        {/* CABECERA DEL MODAL */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #111827', paddingBottom: '12px', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#111827', textTransform: 'uppercase' }}>
              Datos Completos de Telemetría // {jsonModalData.store_name}
            </h3>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>
              Capturado: {new Date(jsonModalData.scanned_at).toLocaleString()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleCopyJson}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '800',
                backgroundColor: copied ? '#15803d' : '#111827',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? '¡Copiado!' : 'Copiar JSON'}
            </button>

            <button
              type="button"
              onClick={() => onClose()}
              style={{
                padding: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: '#f3f4f6',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={16} color="#111827" />
            </button>
          </div>
        </div>

        {/* VISUALIZADOR DE CÓDIGO JSON */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#0f172a', borderRadius: '8px', padding: '16px', border: '1px solid #1e293b' }}>
          <pre style={{ margin: 0, color: '#38bdf8', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            <code>{JSON.stringify(jsonModalData, null, 2)}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default JsonModal;
