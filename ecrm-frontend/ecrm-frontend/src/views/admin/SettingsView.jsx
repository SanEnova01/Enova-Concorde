import React, { useEffect, useState } from 'react';
import crmApi from '../../api/crmApi';

// Menú de Configuración (solo super admin).
// Los ajustes vienen del backend (services/SettingsService.js): para sumar un switch
// nuevo basta con agregarlo allí; esta pantalla lo muestra sola.
function Switch({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: '52px', height: '28px', borderRadius: '999px', border: '2px solid #111',
        backgroundColor: checked ? '#111' : '#fff', position: 'relative',
        cursor: disabled ? 'wait' : 'pointer', flexShrink: 0, transition: 'background-color .15s'
      }}
    >
      <span style={{
        position: 'absolute', top: '2px', left: checked ? '26px' : '2px', width: '20px', height: '20px',
        borderRadius: '50%', backgroundColor: checked ? '#FFD700' : '#111', transition: 'left .15s'
      }} />
    </button>
  );
}

// Número: se guarda al salir del campo o con Enter
function NumberField({ setting, disabled, onSave }) {
  const [draft, setDraft] = useState(String(setting.value ?? ''));
  const commit = () => {
    if (draft === '' || Number(draft) === setting.value) return;
    onSave(Number(draft));
  };
  return (
    <input
      type="number" className="crm-input-text" style={{ width: '90px' }}
      min={setting.min} max={setting.max} value={draft} disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

// Texto largo: se guarda con el botón
function TextField({ setting, disabled, onSave }) {
  const [draft, setDraft] = useState(setting.value || '');
  const changed = draft !== (setting.value || '');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '320px', maxWidth: '100%' }}>
      <textarea
        className="crm-input-text" rows={3} maxLength={setting.maxLength} value={draft} disabled={disabled}
        onChange={(e) => setDraft(e.target.value)} style={{ resize: 'vertical' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#999' }}>
        <span>{draft.length}/{setting.maxLength || 1000}</span>
        <button type="button" className="crm-btn-black" disabled={!changed || disabled} onClick={() => onSave(draft)}
          style={{ padding: '4px 10px', fontSize: '12px', opacity: changed ? 1 : 0.4 }}>Guardar</button>
      </div>
    </div>
  );
}

function SettingControl({ setting, disabled, onSave }) {
  if (setting.type === 'boolean') {
    return <Switch checked={!!setting.value} disabled={disabled} onChange={onSave} />;
  }
  if (setting.type === 'select') {
    return (
      <select className="crm-select-dropdown" value={setting.value} disabled={disabled}
        onChange={(e) => onSave(e.target.value)} style={{ minWidth: '220px' }}>
        {(setting.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (setting.type === 'number') return <NumberField setting={setting} disabled={disabled} onSave={onSave} />;
  if (setting.type === 'text') return <TextField setting={setting} disabled={disabled} onSave={onSave} />;
  return null;
}

function SettingsView() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const res = await crmApi.get('/settings');
      setSettings(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar la configuración.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateSetting = async (key, value) => {
    setSavingKey(key);
    try {
      const res = await crmApi.put(`/settings/${key}`, { value });
      const saved = res.data?.data?.value ?? value; // el servidor devuelve el valor normalizado
      setSettings(prev => prev.map(s => s.key === key
        ? { ...s, value: saved, updated_at: new Date().toISOString() }
        : s));
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo guardar el cambio.');
    } finally {
      setSavingKey(null);
    }
  };

  const groups = settings.reduce((acc, s) => {
    (acc[s.group || 'General'] = acc[s.group || 'General'] || []).push(s);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Configuración</h1>
        <p style={{ margin: '6px 0 0', color: '#666', fontSize: '13px' }}>
          Funciones del sistema. Solo visible para super admin. Cada cambio queda registrado en la auditoría.
        </p>
      </div>

      {loading && <div className="crm-card-paper">Cargando…</div>}
      {error && <div className="crm-card-paper" style={{ color: '#dc2626' }}>{error}</div>}

      {!loading && !error && Object.entries(groups).map(([group, items]) => (
        <div key={group} className="crm-card-paper" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 900 }}>{group}</h2>
          {items.map(s => (
            <div key={s.key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
              padding: '12px 0', borderTop: '1px solid #eee'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{s.label}</div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', maxWidth: '640px' }}>{s.description}</div>
                {s.updated_by && (
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                    Último cambio: {s.updated_by}{s.updated_at ? ` · ${new Date(s.updated_at).toLocaleString()}` : ''}
                  </div>
                )}
              </div>
              <SettingControl
                setting={s}
                disabled={savingKey === s.key}
                onSave={(v) => updateSetting(s.key, v)}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default SettingsView;
