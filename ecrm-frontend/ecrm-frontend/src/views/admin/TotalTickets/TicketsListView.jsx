import React from 'react';
import { statuses, priorities, taskTypes } from './ticketConstants';

// VISTA 1: LISTA (paginada desde el servidor)
const TicketsListView = ({
  tickets, total, listPage, setListPage, listItemsPerPage, totalListPages, listLoading,
  sortConfig, handleSort, selectedIds, handleSelectAll, handleSelectOne,
  stores, handleSingleFieldChange, navigate
}) => (
  <div style={{ marginTop: '16px', opacity: listLoading ? 0.6 : 1, transition: 'opacity 0.15s', backgroundColor: '#fff', border: '2px solid #111', borderRadius: '8px', boxShadow: '4px 4px 0px #111', overflow: 'hidden' }}>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #111' }}>
          <tr>
            <th style={{ padding: '12px 16px', width: '40px', textAlign: 'center' }}>
              <input 
                type="checkbox"
                checked={tickets.length > 0 && tickets.every(t => selectedIds.includes(t.id))}
                onChange={handleSelectAll}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
            </th>
            <th onClick={() => handleSort('serial_number')} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111', cursor: 'pointer', userSelect: 'none' }}>
              ID {sortConfig.key === 'serial_number' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </th>
            <th onClick={() => handleSort('name')} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111', cursor: 'pointer', userSelect: 'none' }}>
              Asunto {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </th>
            <th onClick={() => handleSort('store_id')} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111', cursor: 'pointer', userSelect: 'none' }}>
              Store ID / Tienda {sortConfig.key === 'store_id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </th>
            <th onClick={() => handleSort('status')} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111', cursor: 'pointer', userSelect: 'none' }}>
              Estado {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </th>
            <th onClick={() => handleSort('priority')} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111', cursor: 'pointer', userSelect: 'none' }}>
              Prioridad {sortConfig.key === 'priority' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </th>
            <th onClick={() => handleSort('task_type')} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111', cursor: 'pointer', userSelect: 'none' }}>
              Tipo de Tarea {sortConfig.key === 'task_type' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </th>
            <th onClick={() => handleSort('assigned_to')} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111', cursor: 'pointer', userSelect: 'none' }}>
              Responsable {sortConfig.key === 'assigned_to' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </th>
            <th onClick={() => handleSort('is_apolo_sync')} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
              Apolo Sync {sortConfig.key === 'is_apolo_sync' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </th>
            <th onClick={() => handleSort('created_at')} style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '900', color: '#111', cursor: 'pointer', userSelect: 'none' }}>
              Fecha {sortConfig.key === 'created_at' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
            </th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 ? (
            <tr>
              <td colSpan="10" style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                No se encontraron tickets en esta vista.
              </td>
            </tr>
          ) : (
            tickets.map(t => {
              const isSelected = selectedIds.includes(t.id);
              return (
                <tr 
                  key={t.id} 
                  title={t.description ? t.description.substring(0, 300) + (t.description.length > 300 ? '...' : '') : 'Sin descripción'}
                  style={{ 
                    borderBottom: '1px solid #e5e7eb', 
                    backgroundColor: isSelected ? '#fefce8' : 'transparent',
                    transition: 'background-color 0.15s'
                  }} 
                  onMouseEnter={e => { if(!isSelected) e.currentTarget.style.backgroundColor = '#f3f4f6'; }} 
                  onMouseLeave={e => { if(!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleSelectOne(e, t.id)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </td>

                  {/* CELDA ID COMO ENLACE REAL */}
                  <td style={{ padding: 0 }}>
                    <a 
                      href={`/admin/tickets/${t.id}`}
                      onClick={e => { if(!e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); navigate(`/admin/tickets/${t.id}`); } }}
                      style={{ display: 'block', padding: '12px 16px', fontSize: '13px', fontWeight: 'bold', color: '#111', textDecoration: 'none' }}
                    >
                      {t.serial_number || t.id}
                    </a>
                  </td>

                  {/* CELDA ASUNTO COMO ENLACE REAL + BOTÓN GMAIL */}
                  <td style={{ padding: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px' }}>
                      <a 
                        href={`/admin/tickets/${t.id}`}
                        onClick={e => { if(!e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); navigate(`/admin/tickets/${t.id}`); } }}
                        style={{ display: 'block', fontSize: '13px', color: '#111', fontWeight: '500', textDecoration: 'none' }}
                      >
                        {t.name}
                      </a>
                      {(() => {
                        const match = t.description?.match(/\[GMAIL_ID:\s*([a-zA-Z0-9]+)\]/);
                        if (match && match[1]) {
                          return (
                            <a
                              href={`https://mail.google.com/mail/u/1/#all/${match[1]}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ display: 'inline-block', marginLeft: '8px', fontSize: '10px', backgroundColor: '#ea4335', color: '#fff', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold' }}
                            >
                              ✉️ Ir a Gmail
                            </a>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </td>

                  {/* EDITAR STORE ID EN LÍNEA */}
                  <td style={{ padding: '8px 12px' }} onClick={e => e.stopPropagation()}>
                    <select
                      value={t.store_id || ''}
                      onChange={(e) => handleSingleFieldChange(t.id, 'store_id', e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        border: '1px solid #d1d5db',
                        backgroundColor: '#f3f4f6',
                        color: '#111',
                        cursor: 'pointer',
                        maxWidth: '140px'
                      }}
                    >
                      {stores.map(s => (
                        <option key={s.id} value={s.id}>{s.id}</option>
                      ))}
                    </select>
                  </td>

                  {/* EDITAR ESTADO EN LÍNEA */}
                  <td style={{ padding: '8px 12px' }} onClick={e => e.stopPropagation()}>
                    <select 
                      value={t.status || 'OPEN'}
                      onChange={(e) => handleSingleFieldChange(t.id, 'status', e.target.value)}
                      style={{ 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        fontSize: '11px', 
                        fontWeight: 'bold',
                        border: '1px solid #d1d5db',
                        backgroundColor: t.status === 'CLOSED' ? '#dcfce7' : t.status === 'RESOLVED' ? '#e0f2fe' : t.status === 'IN_PROGRESS' ? '#fef3c7' : '#f3f4f6',
                        color: t.status === 'CLOSED' ? '#166534' : t.status === 'RESOLVED' ? '#0369a1' : t.status === 'IN_PROGRESS' ? '#92400e' : '#374151',
                        cursor: 'pointer'
                      }}
                    >
                      {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>

                  {/* EDITAR PRIORIDAD EN LÍNEA */}
                  <td style={{ padding: '8px 12px' }} onClick={e => e.stopPropagation()}>
                    <select 
                      value={t.priority || 'MEDIUM'}
                      onChange={(e) => handleSingleFieldChange(t.id, 'priority', e.target.value)}
                      style={{ 
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        fontSize: '11px', 
                        fontWeight: 'bold',
                        border: '1px solid #d1d5db',
                        backgroundColor: t.priority === 'CRITICAL' || t.priority === 'HIGH' ? '#fee2e2' : '#f3f4f6',
                        color: t.priority === 'CRITICAL' || t.priority === 'HIGH' ? '#991b1b' : '#374151',
                        cursor: 'pointer'
                      }}
                    >
                      {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>

                  {/* EDITAR TIPO DE TAREA EN LÍNEA */}
                  <td style={{ padding: '8px 12px' }} onClick={e => e.stopPropagation()}>
                    <select 
                      value={t.task_type || 'CONSULTA'}
                      onChange={(e) => handleSingleFieldChange(t.id, 'task_type', e.target.value)}
                      style={{ 
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        fontSize: '11px', 
                        fontWeight: 'bold',
                        border: '1px solid #d1d5db',
                        backgroundColor: '#fff',
                        color: '#111',
                        cursor: 'pointer'
                      }}
                    >
                      {taskTypes.map(tt => <option key={tt} value={tt}>{tt}</option>)}
                    </select>
                  </td>

                  {/* 🌟 CELDAS ESTÁTICAS DE SÓLO LECTURA */}
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#4b5563', fontWeight: '600' }}>
                    {t.assigned_to ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {t.assigned_to.split(',').filter(Boolean).map((name, idx) => (
                          <span key={idx} style={{ whiteSpace: 'nowrap' }}>
                            - {name.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin asignar</span>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px', fontSize: '12px', textAlign: 'center' }}>
                    {t.is_apolo_sync ? (
                      <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                        ✓ Apolo
                      </span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>-</span>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>

    {/* CONTROLES DE PAGINACIÓN DE 10 EN 10 */}
    {total > 0 && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '2px solid #111', backgroundColor: '#f9fafb', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: '#4b5563', fontWeight: 'bold' }}>
          Mostrando {((listPage - 1) * listItemsPerPage) + 1} - {Math.min(listPage * listItemsPerPage, total)} de {total} tickets
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            disabled={listPage === 1}
            onClick={() => setListPage(prev => Math.max(prev - 1, 1))}
            className="crm-btn-border"
            style={{ padding: '4px 12px', fontSize: '12px', opacity: listPage === 1 ? 0.5 : 1, cursor: listPage === 1 ? 'not-allowed' : 'pointer' }}
          >
            Anterior
          </button>
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
            Página {listPage} de {totalListPages}
          </span>
          <button
            disabled={listPage >= totalListPages}
            onClick={() => setListPage(prev => Math.min(prev + 1, totalListPages))}
            className="crm-btn-border"
            style={{ padding: '4px 12px', fontSize: '12px', opacity: listPage >= totalListPages ? 0.5 : 1, cursor: listPage >= totalListPages ? 'not-allowed' : 'pointer' }}
          >
            Siguiente
          </button>
        </div>
      </div>
    )}
  </div>
);

export default TicketsListView;
