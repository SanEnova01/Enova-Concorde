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
      await crmApi.put(`/settings/${key}`, { value });
      setSettings(prev => prev.map(s => s.key === key
        ? { ...s, value, updated_at: new Date().toISOString() }
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
              {s.type === 'boolean' && (
                <Switch
                  checked={!!s.value}
                  disabled={savingKey === s.key}
                  onChange={(v) => updateSetting(s.key, v)}
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default SettingsView;
