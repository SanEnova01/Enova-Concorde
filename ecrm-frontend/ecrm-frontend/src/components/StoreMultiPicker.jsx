import React, { useMemo, useState } from 'react';
import { brandOf } from '../utils/storeBrand';

/**
 * Selector de varias tiendas con buscador y atajo "misma marca".
 * - stores: lista de tiendas { id, name }
 * - selected: ids elegidos; onChange(ids)
 * - excludeId: tienda que no se puede elegir (la del ticket original)
 * - brandStore: tienda de referencia para sugerir las de su misma marca
 */
export default function StoreMultiPicker({ stores = [], selected = [], onChange, excludeId, brandStore }) {
  const [search, setSearch] = useState('');
  const selectedSet = useMemo(() => new Set(selected.map(String)), [selected]);

  const available = useMemo(
    () => stores.filter((s) => String(s.id) !== String(excludeId)),
    [stores, excludeId]
  );

  const brand = brandOf(brandStore);
  const sameBrand = useMemo(
    () => (brand.length >= 3 ? available.filter((s) => brandOf(s) === brand) : []),
    [available, brand]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? available.filter((s) => String(s.name || '').toLowerCase().includes(q) || String(s.id).toLowerCase().includes(q))
      : available;
    // Primero las elegidas y las de la misma marca
    return [...list].sort((a, b) => {
      const score = (s) => (selectedSet.has(String(s.id)) ? 2 : 0) + (brandOf(s) === brand ? 1 : 0);
      return score(b) - score(a) || String(a.name || a.id).localeCompare(String(b.name || b.id));
    });
  }, [available, search, selectedSet, brand]);

  const toggle = (id) => {
    const key = String(id);
    onChange(selectedSet.has(key) ? selected.filter((x) => String(x) !== key) : [...selected, key]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {sameBrand.length > 0 && (
        <button
          type="button"
          className="crm-btn-border"
          onClick={() => onChange([...new Set([...selected.map(String), ...sameBrand.map((s) => String(s.id))])])}
          style={{ fontSize: '12px', alignSelf: 'flex-start' }}
        >
          ➕ Agregar todas las de "{brand}" ({sameBrand.length})
        </button>
      )}

      <input
        type="text"
        className="crm-input-text"
        placeholder="Buscar tienda…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
        {filtered.length === 0 && <div style={{ padding: '10px', fontSize: '12px', color: '#6b7280' }}>Sin resultados.</div>}
        {filtered.map((s) => {
          const checked = selectedSet.has(String(s.id));
          return (
            <label
              key={s.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', cursor: 'pointer',
                fontSize: '13px', borderBottom: '1px solid #f3f4f6', background: checked ? '#fef9c3' : 'transparent',
              }}
            >
              <input type="checkbox" checked={checked} onChange={() => toggle(s.id)} />
              <span style={{ fontWeight: checked ? 700 : 400 }}>{s.name || s.id}</span>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>{s.id}</span>
            </label>
          );
        })}
      </div>

      <div style={{ fontSize: '12px', color: '#374151' }}>
        {selected.length === 0 ? 'Ninguna tienda elegida.' : `${selected.length} tienda(s) elegida(s).`}
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} style={{ marginLeft: '8px', fontSize: '11px', background: 'none', border: 'none', color: '#d9534f', cursor: 'pointer' }}>
            Quitar todas
          </button>
        )}
      </div>
    </div>
  );
}
