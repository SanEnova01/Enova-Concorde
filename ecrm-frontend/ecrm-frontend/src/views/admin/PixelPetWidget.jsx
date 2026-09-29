import React, { useState } from 'react';

const PixelPetWidget = ({ ticketStatusStats, myTickets }) => {
  const [isPetVisible, setIsPetVisible] = useState(false);
  
  const openTickets = (ticketStatusStats['OPEN'] || 0) + (ticketStatusStats['IN_PROGRESS'] || 0);
  const myPending = myTickets?.length || 0;
  
  let petMood = 'idle';
  let petEmoji = '👾';
  let petMessage = 'Sistemas estables.';
  let bgColor = '#c0c0c0';

  if (openTickets >= 10) {
    petMood = 'stressed';
    petEmoji = '🔥';
    petMessage = '¡CUELLO DE BOTELLA! ¡AYUDA!';
    bgColor = '#d87070';
  } else if (myPending > 0) {
    petMood = 'working';
    petEmoji = '👀';
    petMessage = `Tienes ${myPending} tickets asignados.`;
    bgColor = '#e6d070';
  } else if (openTickets === 0) {
    petMood = 'sleeping';
    petEmoji = '💤';
    petMessage = 'Todo limpio. Hora de la siesta.';
    bgColor = '#98c698';
  }

  const petAnimation = petMood === 'stressed' ? 'shake 0.5s infinite' : petMood === 'sleeping' ? 'float 3s ease-in-out infinite' : 'bounce 2s infinite';

  return (
    <>
      <style>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes shake { 0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 30% { transform: translate(3px, 2px) rotate(0deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 50% { transform: translate(-1px, 2px) rotate(-1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { transform: translate(3px, 1px) rotate(-1deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 90% { transform: translate(1px, 2px) rotate(0deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } }
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-8px); } 100% { transform: translateY(0px); } }
      `}</style>

      {isPetVisible && (
        <div style={{
          position: 'fixed', bottom: '80px', right: '20px', zIndex: 9999,
          backgroundColor: bgColor, border: '2px solid', borderColor: '#ffffff #808080 #808080 #ffffff',
          padding: '2px', display: 'flex', flexDirection: 'column',
          fontFamily: "'MS Sans Serif', 'Segoe UI', sans-serif", width: '180px',
          boxShadow: '4px 4px 0px rgba(0,0,0,0.2)'
        }}>
          <div style={{
            backgroundColor: '#000080', color: '#ffffff', padding: '2px 4px',
            fontWeight: 'bold', fontSize: '11px', display: 'flex', justifyContent: 'space-between',
            fontFamily: "'Courier New', Courier, monospace"
          }}>
            <span>PET.EXE</span>
            <button onClick={() => setIsPetVisible(false)} style={{ backgroundColor: '#c0c0c0', border: '1px solid', borderColor: '#fff #000 #000 #fff', width: '14px', height: '14px', fontSize: '9px', cursor: 'pointer', color: '#000', fontWeight: 'bold', padding: 0 }}>X</button>
          </div>
          <div style={{ padding: '10px', textAlign: 'center', backgroundColor: '#fff', border: '1px solid', borderColor: '#888 #fff #fff #888', margin: '2px', minHeight: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ backgroundColor: '#fcfcfc', border: '1px solid #000', borderRadius: '8px', padding: '6px', fontSize: '10px', marginBottom: '12px', position: 'relative', width: '100%' }}>
              {petMessage}
              <div style={{ position: 'absolute', bottom: '-5px', left: '50%', transform: 'translateX(-50%)', width: '10px', height: '10px', backgroundColor: '#fcfcfc', borderRight: '1px solid #000', borderBottom: '1px solid #000', rotate: '45deg' }}></div>
            </div>
            <div style={{ fontSize: '42px', animation: petAnimation, filter: 'drop-shadow(2px 2px 0px #888)' }}>
              {petEmoji}
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setIsPetVisible(!isPetVisible)} style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 9998,
          width: '50px', height: '50px', backgroundColor: '#c0c0c0',
          border: isPetVisible ? '2px solid' : '2px solid',
          borderColor: isPetVisible ? '#808080 #ffffff #ffffff #808080' : '#ffffff #808080 #808080 #ffffff',
          cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontSize: '24px', boxShadow: '2px 2px 0px rgba(0,0,0,0.2)'
      }}>
        {isPetVisible ? '🔽' : '👾'}
      </button>
    </>
  );
};

export default PixelPetWidget;