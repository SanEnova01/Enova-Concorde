import React, { useState } from 'react';

// 🌟 SUBCOMPONENTE: Mis Tickets Asignados (Estilo Windows 95/99 adaptado al theme)
const MyTicketsWidget = ({ myTickets, navigate }) => {
  const [page, setPage] = useState(1);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(myTickets.length / itemsPerPage) || 1;
  
  const indexOfLastItem = page * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTickets = myTickets.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div style={{
      backgroundColor: '#f3f4f6',
      border: '2px solid',
      borderColor: '#ffffff #9ca3af #9ca3af #ffffff',
      padding: '2px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Courier New', Courier, monospace",
      color: '#111',
      boxShadow: 'inset 1px 1px 0px #e5e7eb, inset -1px -1px 0px #4b5563, 0 4px 6px rgba(0,0,0,0.1)'
    }}>
      {/* Barra de Título */}
      <div style={{
        backgroundColor: '#111111',
        color: '#FFD700',
        padding: '4px 8px',
        fontWeight: 'bold',
        fontSize: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>TICKETS ASIGNADOS</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button style={{ backgroundColor: '#c0c0c0', border: '1px solid', borderColor: '#fff #000 #000 #fff', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>_</button>
          <button style={{ backgroundColor: '#c0c0c0', border: '1px solid', borderColor: '#fff #000 #000 #fff', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>X</button>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ padding: '8px', backgroundColor: '#ffffff', border: '1px solid', borderColor: '#888 #fff #fff #888', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        {myTickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '12px', color: '#666' }}>
            No hay tickets pendientes asignados a ti.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {currentTickets.map(t => (
              <div key={t.id} style={{ borderBottom: '1px dashed #ccc', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#111', textDecoration: 'underline' }}>{t.serial_number || t.id}</div>
                  <div style={{ fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.name}>{t.name}</div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>Estado: {t.status} | {t.priority}</div>
                </div>
                <button 
                  onClick={() => navigate(`/admin/tickets/${t.id}`)}
                  style={{ backgroundColor: '#e5e5e5', border: '1px solid', borderColor: '#fff #666 #666 #fff', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}
                  onMouseDown={(e) => { e.currentTarget.style.borderColor = '#666 #fff #fff #666'; }}
                  onMouseUp={(e) => { e.currentTarget.style.borderColor = '#fff #666 #666 #fff'; }}
                >
                  Abrir
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Paginación W95 */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '6px', borderTop: '1px solid #ccc', fontSize: '11px' }}>
            <button disabled={page === 1} onClick={() => setPage(p => Math.max(p - 1, 1))} style={{ backgroundColor: '#e5e5e5', border: '1px solid', borderColor: '#fff #666 #666 #fff', padding: '2px 8px', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>&lt; Ant</button>
            <span>Pg {page}/{totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(p + 1, totalPages))} style={{ backgroundColor: '#e5e5e5', border: '1px solid', borderColor: '#fff #666 #666 #fff', padding: '2px 8px', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>Sig &gt;</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTicketsWidget;
