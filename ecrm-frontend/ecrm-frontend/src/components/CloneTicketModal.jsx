import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import crmApi from '../api/crmApi';
import StoreMultiPicker from './StoreMultiPicker';

/**
 * Clona un ticket a otras tiendas. Cada copia es un ticket independiente con el
 * número del original + letra (SOP-2026-2008A, B, C...).
 */
export default function CloneTicketModal({ ticket, stores, onClose, onCloned }) {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const sourceStore = stores.find((s) => String(s.id) === String(ticket.store_id));
  const storeName = (id) => stores.find((s) => String(s.id) === String(id))?.name || id;

  const submit = async () => {
    if (selected.length === 0 || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await crmApi.post(`/tickets/${ticket.id}/clone`, { store_ids: selected });
      setResult(res.data?.data || { created: [], skipped: [] });
      if (onCloned) onCloned(res.data?.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo clonar el ticket.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="crm-modal-mask" onClick={onClose}>
      <div className="crm-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <h3 className="crm-section-title" style={{ marginTop: 0 }}>Clonar ticket a otras tiendas</h3>

        {!result && (
          <>
            <p style={{ fontSize: '13px', color: '#4b5563', marginTop: 0 }}>
              Se crea un ticket independiente por cada tienda, con el mismo asunto, descripción, prioridad, tipo y responsables.
              Los números serán <b>{ticket.serial_number}A</b>, <b>B</b>, <b>C</b>… y cada uno tendrá su propio estado.
            </p>
            <StoreMultiPicker
              stores={stores}
              selected={selected}
              onChange={setSelected}
              excludeId={ticket.store_id}
              brandStore={sourceStore}
            />
            {error && <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>{error}</div>}
            <div className="crm-pagination-box" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
              <button type="button" className="crm-btn-black" disabled={selected.length === 0 || saving} onClick={submit}
                style={{ opacity: selected.length === 0 ? 0.5 : 1 }}>
                {saving ? 'Clonando…' : `Clonar a ${selected.length} tienda(s)`}
              </button>
              <button type="button" onClick={onClose} className="crm-btn-red">Cancelar</button>
            </div>
          </>
        )}

        {result && (
          <>
            <p style={{ fontSize: '13px', marginTop: 0 }}>✅ Se crearon {result.created.length} ticket(s):</p>
            <ul style={{ fontSize: '13px', paddingLeft: '18px' }}>
              {result.created.map((t) => (
                <li key={t.id}>
                  <Link to={`/admin/tickets/${t.id}`} onClick={onClose}><b>{t.serial_number}</b></Link> — {storeName(t.store_id)}
                </li>
              ))}
            </ul>
            {result.skipped?.length > 0 && (
              <p style={{ fontSize: '12px', color: '#92400e' }}>
                Omitidas: {result.skipped.map((s) => `${storeName(s.store_id)} (${s.reason})`).join(', ')}
              </p>
            )}
            <div className="crm-pagination-box" style={{ marginTop: '16px', justifyContent: 'flex-end' }}>
              <button type="button" className="crm-btn-black" onClick={onClose}>Listo</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
