import React from 'react';
import { monthsNames } from './ticketConstants';

// VISTA 3: CALENDARIO
const TicketsCalendarView = ({ tickets, calendarDate, setCalendarDate, onSelectDay, navigate }) => {
  const currentYear = calendarDate.getFullYear();
  const currentMonth = calendarDate.getMonth();

  const renderCalendarCells = () => {
    const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startOffset = new Date(currentYear, currentMonth, 1).getDay();
    const cells = [];

    for (let i = 0; i < startOffset; i++) cells.push(<div key={`empty-${i}`} style={{ backgroundColor: 'transparent' }}></div>);

    for (let day = 1; day <= daysCount; day++) {
      const dayString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const matching = tickets.filter(t => t.created_at && t.created_at.startsWith(dayString));

      cells.push(
        <div key={day} className="crm-calendar-cell" onClick={() => onSelectDay({ dateLabel: `${day} de ${monthsNames[currentMonth]}`, list: matching })}>
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{day}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: '60px' }}>
            {matching.map(t => (
              <div 
                key={t.id} 
                onClick={(e) => { e.stopPropagation(); navigate(`/admin/tickets/${t.id}`); }}
                style={{ backgroundColor: '#111111', color: '#ffffff', fontSize: '10px', padding: '2px 4px', borderRadius: '2px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {t.serial_number || t.id}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return cells;
  };

  return (
    <div className="crm-card-paper" style={{ marginTop: '16px' }}>
      <div className="crm-calendar-nav">
        <button onClick={() => setCalendarDate(new Date(currentYear, currentMonth - 1, 1))} className="crm-btn-border">Anterior</button>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'normal' }}>{monthsNames[currentMonth]} {currentYear}</h2>
        <button onClick={() => setCalendarDate(new Date(currentYear, currentMonth + 1, 1))} className="crm-btn-border">Siguiente</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontWeight: 'bold', marginBottom: '10px', fontSize: '12px', color: '#666' }}>
        <div>Dom</div><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div>
      </div>
      <div className="crm-calendar-grid">{renderCalendarCells()}</div>
    </div>
  );
};

export default TicketsCalendarView;
