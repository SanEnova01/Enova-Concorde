import React from 'react';
import { Search, Filter, AlertTriangle } from 'lucide-react';

// BARRA DE BÚSQUEDA Y FILTROS
const MonitorFilters = ({ count, conteoUrgencia, searchTerm, setSearchTerm, planFilter, setPlanFilter, urgencyFilter, setUrgencyFilter }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', flexWrap: 'wrap', gap: '12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '12px', fontWeight: '800', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Tiendas Monitoreadas ({count})
      </span>
      {conteoUrgencia.critical > 0 && (
        <span style={{ fontSize: '10px', fontWeight: '800', color: '#991b1b', backgroundColor: '#fee2e2', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '9999px' }}>
          {conteoUrgencia.critical} urgente(s)
        </span>
      )}
      {conteoUrgencia.warning > 0 && (
        <span style={{ fontSize: '10px', fontWeight: '800', color: '#92400e', backgroundColor: '#fef3c7', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '9999px' }}>
          {conteoUrgencia.warning} en atención
        </span>
      )}
    </div>

    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
        <input 
          type="text" 
          placeholder="Buscar tienda o ID..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: '6px 10px 6px 30px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', width: '220px', outline: 'none', backgroundColor: '#fafafa' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Filter size={13} color="#6b7280" />
        <select 
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', backgroundColor: '#fff', color: '#374151', fontWeight: '500' }}
        >
          <option value="ALL">Todos los planes</option>
          <option value="GO">GO</option>
          <option value="GROWTH">GROWTH</option>
          <option value="ESCALE">ESCALE</option>
          <option value="SCALE">SCALE</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <AlertTriangle size={13} color="#6b7280" />
        <select
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
          style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', backgroundColor: '#fff', color: '#374151', fontWeight: '500' }}
        >
          <option value="ALL">Toda urgencia</option>
          <option value="CRITICAL">Solo urgentes</option>
          <option value="WARNING">Solo en atención</option>
        </select>
      </div>
    </div>
  </div>
);

export default MonitorFilters;
