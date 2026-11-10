import React from 'react';
import { statuses, priorities, taskTypes } from './ticketConstants';

// BARRA DE ACCIONES MASIVAS (EDICIÓN Y ELIMINACIÓN)
const BulkActionsBar = ({ selectedIds, setSelectedIds, stores, handleBulkUpdate, handleBulkDelete }) => (
  <div style={{ backgroundColor: '#111', color: '#FFD700', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
    <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
      ✓ {selectedIds.length} ticket(s) seleccionado(s)
    </span>

    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>

      {/* CAMBIAR STORE ID MASIVO CON BÚSQUEDA */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <select 
          defaultValue="" 
          onChange={(e) => { handleBulkUpdate('store_id', e.target.value); e.target.value = ''; }}
          style={{ padding: '6px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #FFD700', backgroundColor: '#222', color: '#fff', cursor: 'pointer', maxWidth: '160px' }}
        >
          <option value="" disabled>🔍 Cambiar Store ID...</option>
          {stores.map(s => (
            <option key={s.id} value={s.id}>{s.id} ({s.name})</option>
          ))}
        </select>
      </div>

      {/* CAMBIAR ESTADO MASIVO */}
      <select 
        defaultValue="" 
        onChange={(e) => { handleBulkUpdate('status', e.target.value); e.target.value = ''; }}
        style={{ padding: '6px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #FFD700', backgroundColor: '#222', color: '#fff', cursor: 'pointer' }}
      >
        <option value="" disabled>Cambiar Estado...</option>
        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      {/* CAMBIAR PRIORIDAD MASIVA */}
      <select 
        defaultValue="" 
        onChange={(e) => { handleBulkUpdate('priority', e.target.value); e.target.value = ''; }}
        style={{ padding: '6px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #FFD700', backgroundColor: '#222', color: '#fff', cursor: 'pointer' }}
      >
        <option value="" disabled>Cambiar Prioridad...</option>
        {priorities.map(p => <option key={p} value={p}>{p}</option>)}
      </select>

      {/* CAMBIAR TIPO DE TAREA MASIVO */}
      <select 
        defaultValue="" 
        onChange={(e) => { handleBulkUpdate('task_type', e.target.value); e.target.value = ''; }}
        style={{ padding: '6px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #FFD700', backgroundColor: '#222', color: '#fff', cursor: 'pointer' }}
      >
        <option value="" disabled>Cambiar Tipo Tarea...</option>
        {taskTypes.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {/* BORRAR MASIVAMENTE */}
      <button 
        onClick={handleBulkDelete}
        style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
      >
        🗑️ Eliminar ({selectedIds.length})
      </button>

      <button 
        onClick={() => setSelectedIds([])}
        style={{ backgroundColor: 'transparent', color: '#9ca3af', border: '1px solid #4b5563', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
      >
        Cancelar
      </button>
    </div>
  </div>
);

export default BulkActionsBar;
