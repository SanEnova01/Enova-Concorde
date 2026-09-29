import React, { useState, useEffect, useRef } from 'react';

const PixelPetWidget = ({ ticketStatusStats, myTickets }) => {
  // --- ESTADOS DEL PET ---
  const [position, setPosition] = useState(80); // Posición en VW (Viewport Width)
  const [facingRight, setFacingRight] = useState(false);
  const [mood, setMood] = useState('idle'); // idle, walk, sleep, panic, working, love, coffee
  const [dialog, setDialog] = useState('Iniciando sistemas...');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // --- MÉTRICAS REALES ---
  // Subimos el umbral de cuello de botella a 50 tickets
  const openTickets = (ticketStatusStats['OPEN'] || 0) + (ticketStatusStats['IN_PROGRESS'] || 0);
  const myPending = myTickets?.length || 0;
  const CRITICAL_LOAD = 50; 

  // --- MOTOR DE COMPORTAMIENTO (Game Loop) ---
  const actionTimeoutRef = useRef(null);

  useEffect(() => {
    // El "cerebro" de la mascota se ejecuta cada 3 segundos
    const brainLoop = setInterval(() => {
      if (isMenuOpen) return; // Si el menú está abierto, se queda quieto esperando órdenes

      // 1. Reacciones forzadas por el sistema
      if (openTickets >= CRITICAL_LOAD) {
        setMood('panic');
        setDialog(`¡ALERTA ROJA! ${openTickets} tickets incendiando el servidor.`);
        setFacingRight(prev => !prev); // Corre en círculos
        return;
      }

      if (myPending > 0) {
        setMood('working');
        setDialog(`Jefe, tenemos ${myPending} tickets asignados. A trabajar.`);
        return;
      }

      // 2. Comportamiento libre (Roaming)
      const randomAction = Math.random();
      
      // Si está durmiendo, tiene un 70% de probabilidad de seguir durmiendo
      if (mood === 'sleep' && randomAction < 0.7) return;

      if (randomAction < 0.3) {
        // Caminar a la izquierda
        setMood('walk');
        setFacingRight(false);
        setDialog('');
        setPosition(prev => Math.max(2, prev - (Math.random() * 10 + 5))); // Se mueve entre 5 y 15vw
      } else if (randomAction < 0.6) {
        // Caminar a la derecha
        setMood('walk');
        setFacingRight(true);
        setDialog('');
        setPosition(prev => Math.min(85, prev + (Math.random() * 10 + 5)));
      } else if (randomAction < 0.85) {
        // Quedarse quieto
        setMood('idle');
        setDialog('Patrullando la red...');
      } else {
        // Dormir
        setMood('sleep');
        setDialog('Zzz... (Cero tickets)... Zzz...');
      }

    }, 3500);

    return () => clearInterval(brainLoop);
  }, [openTickets, myPending, mood, isMenuOpen]);


  // --- DICCIONARIO DE SPRITES (Kaomojis/Emojis) ---
  const getSprite = () => {
    switch (mood) {
      case 'walk': return '🚶‍♂️';
      case 'sleep': return '🛌';
      case 'panic': return '🔥👾🔥';
      case 'working': return '👾⌐■_■';
      case 'love': return '🥰👾';
      case 'coffee': return '☕👾💨';
      default: return '👾'; // idle
    }
  };

  // --- INTERACCIONES DEL USUARIO ---
  const handleAction = (actionType) => {
    setIsMenuOpen(false);
    clearTimeout(actionTimeoutRef.current);

    if (actionType === 'pet') {
      setMood('love');
      setDialog('¡Gracias! La moral ha subido un 20%.');
    } else if (actionType === 'coffee') {
      setMood('coffee');
      setDialog('¡SOBRECARGA DE CAFEÍNA INICIADA!');
      // Se vuelve loco y corre por la pantalla
      setPosition(Math.random() * 80);
    } else if (actionType === 'patrol') {
      setMood('walk');
      setDialog('¡Entendido! Revisando bases de datos...');
      setFacingRight(prev => !prev);
      setPosition(prev => facingRight ? Math.max(2, prev - 20) : Math.min(85, prev + 20));
    }

    // Volver a la normalidad después de 4 segundos
    actionTimeoutRef.current = setTimeout(() => {
      setMood('idle');
      setDialog('');
    }, 4000);
  };

  return (
    <>
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes walk { 0%, 100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-2px) rotate(5deg); } 75% { transform: translateY(-2px) rotate(-5deg); } }
        @keyframes panic { 0% { transform: translate(2px, 2px); } 25% { transform: translate(-2px, -2px); } 50% { transform: translate(2px, -2px); } 75% { transform: translate(-2px, 2px); } 100% { transform: translate(2px, 2px); } }
        .pet-sprite { cursor: pointer; user-select: none; transition: transform 0.5s linear; }
        .w95-btn { background-color: #c0c0c0; border: 2px solid; border-color: #fff #808080 #808080 #fff; padding: 4px 8px; font-weight: bold; cursor: pointer; font-size: 11px; font-family: 'MS Sans Serif', sans-serif; width: 100%; text-align: left; margin-bottom: 4px;}
        .w95-btn:active { border-color: #808080 #fff #fff #808080; }
      `}</style>

      {/* CONTENEDOR PRINCIPAL DEL PET (Posición absoluta atada al fondo de la pantalla) */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: `${position}vw`,
        transition: 'left 3.5s linear', // Interpolación suave para caminar
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        
        {/* Globo de Diálogo Flotante */}
        {dialog && !isMenuOpen && (
          <div style={{
            backgroundColor: '#ffffe1', // Amarillo clásico de Tooltip de Windows
            border: '1px solid #000',
            padding: '6px 10px',
            fontSize: '11px',
            fontFamily: "'MS Sans Serif', 'Segoe UI', sans-serif",
            color: '#000',
            marginBottom: '8px',
            borderRadius: '4px',
            boxShadow: '2px 2px 0px rgba(0,0,0,0.2)',
            maxWidth: '150px',
            textAlign: 'center',
            position: 'relative'
          }}>
            {dialog}
            {/* Piquito del globo */}
            <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: '6px', height: '6px', backgroundColor: '#ffffe1', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}></div>
          </div>
        )}

        {/* El Sprite del Pet */}
        <div 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="pet-sprite"
          style={{
            fontSize: '48px',
            filter: 'drop-shadow(2px 2px 0px rgba(0,0,0,0.3))',
            // Gira el sprite si camina a la izquierda, y aplica animación según el humor
            transform: `scaleX(${facingRight ? 1 : -1})`,
            animation: mood === 'panic' ? 'panic 0.2s infinite' : mood === 'walk' ? 'walk 0.5s infinite' : 'float 3s ease-in-out infinite'
          }}
          title="¡Clickeame!"
        >
          {getSprite()}
        </div>

        {/* SOMBRA */}
        <div style={{ width: '30px', height: '6px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '50%', marginTop: '2px' }}></div>
      </div>

      {/* MENÚ DE INTERACCIÓN W95 (Aparece al lado del Pet al hacer clic) */}
      {isMenuOpen && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          left: `${Math.min(position, 75)}vw`, // Evita que el menú se salga por la derecha
          zIndex: 9999,
          backgroundColor: '#c0c0c0',
          border: '2px solid',
          borderColor: '#ffffff #808080 #808080 #ffffff',
          padding: '2px',
          fontFamily: "'MS Sans Serif', 'Segoe UI', sans-serif",
          width: '200px',
          boxShadow: '4px 4px 0px rgba(0,0,0,0.2)'
        }}>
          {/* Cabecera del Menú W95 */}
          <div style={{ backgroundColor: '#000080', color: '#ffffff', padding: '3px 4px', fontWeight: 'bold', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Opciones de Mascota</span>
            <button onClick={() => setIsMenuOpen(false)} style={{ backgroundColor: '#c0c0c0', border: '1px solid', borderColor: '#fff #000 #000 #fff', width: '14px', height: '14px', fontSize: '9px', cursor: 'pointer', color: '#000', fontWeight: 'bold', padding: 0 }}>X</button>
          </div>
          
          <div style={{ padding: '8px' }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#000' }}>
              <strong>Status:</strong> {mood.toUpperCase()}<br/>
              <strong>Carga CPU:</strong> {(openTickets / CRITICAL_LOAD * 100).toFixed(0)}%
            </p>
            
            <button className="w95-btn" onClick={() => handleAction('coffee')}>☕ Darle Café (Speed Boost)</button>
            <button className="w95-btn" onClick={() => handleAction('pet')}>🖐️ Acariciar Mascota</button>
            <button className="w95-btn" onClick={() => handleAction('patrol')}>🔍 Mandar a Patrullar</button>
            
            <div style={{ borderTop: '1px solid #808080', borderBottom: '1px solid #fff', margin: '8px 0' }}></div>
            
            <button className="w95-btn" onClick={() => setIsMenuOpen(false)}>Cerrar Menú</button>
          </div>
        </div>
      )}
    </>
  );
};

export default PixelPetWidget;