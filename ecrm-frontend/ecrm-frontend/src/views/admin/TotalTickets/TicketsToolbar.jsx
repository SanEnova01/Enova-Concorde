import React from 'react';
import SmallAnalogOdometer from './SmallAnalogOdometer';
import handleCopyEmailTemplate from './copyEmailTemplate';

// CABECERA Y CONTROLES (pestañas B2B/B2C, vista, búsqueda, responsable, activos/cerrados)
const TicketsToolbar = ({
  ticketView, setTicketView, viewMode, setViewMode, searchTerm, setSearchTerm,
  assigneeFilter, setAssigneeFilter, adminUsers, statusTab, setStatusTab, counts, onNewTicket
}) => (
  <div className="crm-actions-bar" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
      <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Gestión de Tickets</h1>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button 
          type="button"
          onClick={handleCopyEmailTemplate} 
          className="crm-btn-border" 
          title="Copiar respuesta rápida para cliente"
          style={{ padding: '8px 12px', fontSize: '16px', cursor: 'pointer' }}
        >
          📧
        </button>
        <button onClick={onNewTicket} className="crm-btn-black">Nuevo Ticket</button>
      </div>
    </div>

    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-end', borderBottom: '2px solid #e5e7eb', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>

      {/* PESTAÑAS PRINCIPALES (B2B / B2C) */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => setTicketView('B2B')} style={{ padding: '10px 20px', backgroundColor: ticketView === 'B2B' ? '#111' : '#f3f4f6', color: ticketView === 'B2B' ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px 6px 0 0', fontWeight: '900', cursor: 'pointer', borderBottom: ticketView === 'B2B' ? 'none' : '2px solid #111', marginBottom: '-18px' }}>
          🏢 Agencia (Interno)
        </button>
        <button onClick={() => setTicketView('B2C')} style={{ padding: '10px 20px', backgroundColor: ticketView === 'B2C' ? '#111' : '#f3f4f6', color: ticketView === 'B2C' ? '#FFD700' : '#4b5563', border: '2px solid #111', borderRadius: '6px 6px 0 0', fontWeight: '900', cursor: 'pointer', borderBottom: ticketView === 'B2C' ? 'none' : '2px solid #111', marginBottom: '-18px' }}>
          🛒 Clientes (Hub)
        </button>
      </div>

      {/* SELECTORES DE VISTA */}
      <div style={{ display: 'flex', gap: '8px', backgroundColor: '#f3f4f6', padding: '4px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
        <button onClick={() => setViewMode('LIST')} style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'LIST' ? '#111' : 'transparent', color: viewMode === 'LIST' ? '#FFD700' : '#4b5563', boxShadow: viewMode === 'LIST' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Lista</button>
        <button onClick={() => setViewMode('KANBAN')} style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'KANBAN' ? '#111' : 'transparent', color: viewMode === 'KANBAN' ? '#FFD700' : '#4b5563', boxShadow: viewMode === 'KANBAN' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Kanban</button>
        <button onClick={() => setViewMode('CALENDAR')} style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'CALENDAR' ? '#111' : 'transparent', color: viewMode === 'CALENDAR' ? '#FFD700' : '#4b5563', boxShadow: viewMode === 'CALENDAR' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Calendario</button>
      </div>
    </div>

    {/* BARRA DE BÚSQUEDA MULTI-CAMPO Y TABS ACTIVOS / CERRADOS */}
    <div style={{ display: 'flex', gap: '12px', width: '100%', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>

      {/* BUSCADOR Y FILTRO MIS TICKETS */}
      <div style={{ flex: '1', minWidth: '280px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input 
          type="text"
          placeholder="🔍 Buscar por ID, Asunto o Store ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: '1',
            minWidth: '200px',
            padding: '9px 14px',
            borderRadius: '6px',
            border: '2px solid #111',
            fontSize: '13px',
            outline: 'none',
            backgroundColor: '#fff',
            boxSizing: 'border-box'
          }}
        />
        {/* 🌟 SELECTOR DINÁMICO DE RESPONSABLES (DESDE LA BD) */}
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          style={{
            padding: '0 16px',
            backgroundColor: assigneeFilter !== '' ? '#111' : '#fff',
            color: assigneeFilter !== '' ? '#FFD700' : '#111',
            border: '2px solid #111',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
            outline: 'none',
            height: '38px'
          }}
        >
          <option value="">👥 Todos los tickets</option>
          <option value="ME">🗂️ Mis Tickets</option>
          <option value="UNASSIGNED">⚠️ Sin asignar</option>
          <optgroup label="Filtrar por Empleado">
            {adminUsers.map(user => (
              <option key={user.id} value={user.name}>👤 {user.name}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* SELECCIÓN ACTIVOS / CERRADOS */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#e5e7eb', padding: '4px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
        <button
          onClick={() => setStatusTab('ACTIVE')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 12px',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            fontSize: '12px',
            cursor: 'pointer',
            backgroundColor: statusTab === 'ACTIVE' ? '#111' : 'transparent',
            color: statusTab === 'ACTIVE' ? '#FFD700' : '#4b5563'
          }}
        >
          🟢 Activos 
          <SmallAnalogOdometer value={counts.active} digits={4} />
        </button>
        <button
          onClick={() => setStatusTab('CLOSED')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 12px',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            fontSize: '12px',
            cursor: 'pointer',
            backgroundColor: statusTab === 'CLOSED' ? '#111' : 'transparent',
            color: statusTab === 'CLOSED' ? '#FFD700' : '#4b5563'
          }}
        >
          🔴 Cerrados 
          <SmallAnalogOdometer value={counts.closed} digits={4} />
        </button>
      </div>
    </div>
  </div>
);

export default TicketsToolbar;
