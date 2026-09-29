import React, { useState, useEffect, useRef } from 'react';

const PixelPetWidget = ({ ticketStatusStats, myTickets }) => {
  // --- ESTADOS DE POSICIÓN Y ARRASTRE ---
  const [pos, setPos] = useState({ x: window.innerWidth - 120, y: window.innerHeight - 120 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // --- ESTADOS DEL PET ---
  const [mood, setMood] = useState('idle'); // idle, talking, sleep, panic, walk, love, coffee
  const [dialog, setDialog] = useState('Sistemas operativos...');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sleepMode, setSleepMode] = useState(false);
  
  // Animación de la cara
  const [mouthOpen, setMouthOpen] = useState(false);
  const [facingRight, setFacingRight] = useState(false);

  const actionTimeoutRef = useRef(null);

  // --- MÉTRICAS DEL SISTEMA ---
  const openTickets = (ticketStatusStats['OPEN'] || 0) + (ticketStatusStats['IN_PROGRESS'] || 0);
  const resolvedTickets = ticketStatusStats['RESOLVED'] || 0;
  const myPending = myTickets?.length || 0;
  const CRITICAL_LOAD = 50;

  // --- LÓGICA DE DRAG & DROP ---
  const handlePointerDown = (e) => {
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    };
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDragging) return;
      setPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      });
    };

    const handlePointerUp = () => {
      if (isDragging) setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, pos]);

  // --- MOTOR DE IA (Game Loop) ---
  useEffect(() => {
    const brainLoop = setInterval(() => {
      if (isDragging || isMenuOpen || sleepMode) return; 
      if (mood === 'coffee' || mood === 'love') return; // No interrumpir si está jugando

      if (openTickets >= CRITICAL_LOAD) {
        setMood('panic');
        setDialog(`¡CRÍTICO! ${openTickets} tickets activos.`);
        setPos(p => ({ 
          x: Math.max(0, Math.min(window.innerWidth - 60, p.x + (Math.random() * 40 - 20))), 
          y: Math.max(0, Math.min(window.innerHeight - 60, p.y + (Math.random() * 40 - 20))) 
        }));
        return;
      }

      const randomAction = Math.random();
      const systemPhrases = [
        `Métricas: ${openTickets} tickets globales en curso.`,
        `Tienes ${myPending} tareas urgentes.`,
        `Carga de red: ${(openTickets / CRITICAL_LOAD * 100).toFixed(0)}%.`,
        `Se han resuelto ${resolvedTickets} anomalías.`,
        `Servidores estables.`,
        `Buscando cuellos de botella...`
      ];

      if (randomAction < 0.3) {
        const newX = Math.max(0, Math.min(window.innerWidth - 100, pos.x + (Math.random() * 140 - 70)));
        const newY = Math.max(0, Math.min(window.innerHeight - 100, pos.y + (Math.random() * 100 - 50)));
        setFacingRight(newX > pos.x);
        setPos({ x: newX, y: newY });
        setMood('walk');
        setDialog('');
      } else if (randomAction < 0.65) {
        setMood('talking');
        setDialog(systemPhrases[Math.floor(Math.random() * systemPhrases.length)]);
      } else {
        setMood('idle');
        setDialog('');
      }
    }, 5500);

    return () => clearInterval(brainLoop);
  }, [openTickets, myPending, resolvedTickets, isDragging, isMenuOpen, sleepMode, pos, mood]);

  // --- ANIMACIÓN DE BOCA Y OJOS ---
  useEffect(() => {
    const blinkLoop = setInterval(() => {
      if (mood === 'talking' || mood === 'panic' || mood === 'coffee') {
        setMouthOpen(prev => !prev);
      } else if (mood === 'sleep') {
        setMouthOpen(false);
      } else {
        setMouthOpen(Math.random() > 0.85); 
      }
    }, 250);
    return () => clearInterval(blinkLoop);
  }, [mood]);

  // --- INTERACCIONES DEL USUARIO ---
  const handleAction = (actionType) => {
    setIsMenuOpen(false);
    clearTimeout(actionTimeoutRef.current);

    if (actionType === 'report') {
      setSleepMode(false);
      setMood('talking');
      setDialog(`📊 STATUS: ${openTickets} Abiertos | ${resolvedTickets} Resueltos | ${myPending} Tuyos.`);
    } else if (actionType === 'sleep_toggle') {
      if (sleepMode) {
        setSleepMode(false);
        setMood('idle');
        setDialog('¡Sistemas en línea!');
      } else {
        setSleepMode(true);
        setMood('sleep');
        setDialog('Zzz...');
      }
      return; // El sleep no tiene timeout de reseteo
    } else if (actionType === 'pet') {
      setSleepMode(false);
      setMood('love');
      setDialog('¡Gracias! Moral +20% ♥');
    } else if (actionType === 'coffee') {
      setSleepMode(false);
      setMood('coffee');
      setDialog('¡CAFEÍNA AL MÁXIMO!');
      setPos(p => ({ 
        x: Math.max(0, Math.min(window.innerWidth - 60, p.x + (Math.random() * 200 - 100))), 
        y: Math.max(0, Math.min(window.innerHeight - 60, p.y + (Math.random() * 200 - 100))) 
      }));
    } else if (actionType === 'patrol') {
      setSleepMode(false);
      setMood('walk');
      setDialog('¡Patrullando sector!');
      setFacingRight(prev => !prev);
      setPos(p => ({ x: Math.max(0, Math.min(window.innerWidth - 60, p.x + (facingRight ? -100 : 100))), y: p.y }));
    }

    // Volver a la normalidad después de unos segundos
    actionTimeoutRef.current = setTimeout(() => {
      if (!sleepMode) {
        setMood('idle');
        setDialog('');
      }
    }, 4000);
  };

  // --- LÓGICA DE COLORES Y ANIMACIONES ---
  let petColor = '#F59E0B'; // Naranja por defecto
  if (mood === 'panic') petColor = '#EF4444'; // Rojo
  if (sleepMode) petColor = '#808080'; // Gris
  if (mood === 'love') petColor = '#EC4899'; // Rosa
  if (mood === 'coffee') petColor = '#D97706'; // Naranja oscuro

  let petAnim = '';
  if (mood === 'panic' || mood === 'coffee') petAnim = 'panic 0.2s infinite';
  else if (mood === 'walk') petAnim = 'walk 0.5s infinite';
  else if (mood === 'love') petAnim = 'bounce 1s infinite';
  else if (!isDragging && !sleepMode) petAnim = 'float 3s ease-in-out infinite';

  return (
    <>
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes walk { 0%, 100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-2px) rotate(5deg); } 75% { transform: translateY(-2px) rotate(-5deg); } }
        @keyframes panic { 0% { transform: translate(2px, 2px); } 25% { transform: translate(-2px, -2px); } 50% { transform: translate(2px, -2px); } 75% { transform: translate(-2px, 2px); } 100% { transform: translate(2px, 2px); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .w95-btn { background-color: #c0c0c0; border: 2px solid; border-color: #fff #808080 #808080 #fff; padding: 4px 8px; font-weight: bold; cursor: pointer; font-size: 11px; font-family: 'MS Sans Serif', sans-serif; width: 100%; text-align: left; margin-bottom: 4px; color: #000;}
        .w95-btn:active { border-color: #808080 #fff #fff #808080; }
      `}</style>

      <div style={{
        position: 'fixed', left: `${pos.x}px`, top: `${pos.y}px`, zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        transition: isDragging ? 'none' : 'left 2s ease-in-out, top 2s ease-in-out',
        touchAction: 'none'
      }}>
        
        {dialog && !isMenuOpen && (
          <div style={{
            backgroundColor: '#ffffe1', border: '1px solid #000', padding: '6px 10px',
            fontSize: '11px', fontFamily: "'MS Sans Serif', 'Segoe UI', sans-serif",
            color: '#000', marginBottom: '8px', borderRadius: '2px',
            boxShadow: '2px 2px 0px rgba(0,0,0,0.2)', width: 'max-content', maxWidth: '160px',
            textAlign: 'center', position: 'relative', pointerEvents: 'none'
          }}>
            {dialog}
            <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: '6px', height: '6px', backgroundColor: '#ffffe1', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}></div>
          </div>
        )}

        {/* PIXEL PET DIBUJADO */}
        <div 
          onPointerDown={handlePointerDown}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          style={{
            width: '36px', height: '36px', backgroundColor: petColor,
            border: '3px solid #000', boxShadow: 'inset -3px -3px 0px rgba(0,0,0,0.2), 3px 3px 0px rgba(0,0,0,0.3)',
            position: 'relative', cursor: isDragging ? 'grabbing' : 'grab',
            transform: `scaleX(${facingRight ? -1 : 1})`, boxSizing: 'border-box',
            animation: petAnim
          }}
          title="Arrastrame o haz clic"
        >
          {/* Ojos y Boca */}
          <div style={{ position: 'absolute', top: '8px', left: '4px', width: '6px', height: mood === 'sleep' ? '2px' : '6px', backgroundColor: '#000' }}></div>
          <div style={{ position: 'absolute', top: '8px', right: '4px', width: '6px', height: mood === 'sleep' ? '2px' : '6px', backgroundColor: '#000' }}></div>
          <div style={{ position: 'absolute', bottom: '6px', left: '12px', width: '6px', height: mouthOpen ? '8px' : '2px', backgroundColor: '#000', transition: 'height 0.1s' }}></div>
        </div>
        
        <div style={{ width: '28px', height: '4px', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '50%', marginTop: '4px', pointerEvents: 'none' }}></div>
      </div>

      {/* MENÚ DE INTERACCIÓN W95 */}
      {isMenuOpen && (
        <div style={{
          position: 'fixed', top: `${Math.min(window.innerHeight - 200, pos.y + 40)}px`, left: `${Math.min(window.innerWidth - 180, pos.x + 40)}px`,
          zIndex: 10000, backgroundColor: '#c0c0c0', border: '2px solid', borderColor: '#ffffff #808080 #808080 #ffffff',
          padding: '2px', fontFamily: "'MS Sans Serif', 'Segoe UI', sans-serif", width: '160px', boxShadow: '4px 4px 0px rgba(0,0,0,0.2)'
        }}>
          <div style={{ backgroundColor: '#000080', color: '#ffffff', padding: '2px 4px', fontWeight: 'bold', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>PET_CONTROL</span>
            <button onClick={() => setIsMenuOpen(false)} style={{ backgroundColor: '#c0c0c0', border: '1px solid', borderColor: '#fff #000 #000 #fff', width: '14px', height: '14px', fontSize: '9px', cursor: 'pointer', color: '#000', fontWeight: 'bold', padding: 0 }}>X</button>
          </div>
          
          <div style={{ padding: '6px' }}>
            <button className="w95-btn" onClick={() => handleAction('report')}>📊 Forzar Reporte</button>
            <button className="w95-btn" onClick={() => handleAction('sleep_toggle')}>
              {sleepMode ? '☀️ Despertar' : '💤 Mandar a dormir'}
            </button>
            
            <div style={{ borderTop: '1px solid #808080', borderBottom: '1px solid #fff', margin: '6px 0' }}></div>
            
            <button className="w95-btn" onClick={() => handleAction('coffee')}>☕ Darle Café</button>
            <button className="w95-btn" onClick={() => handleAction('pet')}>🖐️ Acariciar</button>
            <button className="w95-btn" onClick={() => handleAction('patrol')}>🔍 Patrullar</button>

            <div style={{ borderTop: '1px solid #808080', borderBottom: '1px solid #fff', margin: '6px 0' }}></div>
            <button className="w95-btn" onClick={() => setIsMenuOpen(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
};

export default PixelPetWidget;