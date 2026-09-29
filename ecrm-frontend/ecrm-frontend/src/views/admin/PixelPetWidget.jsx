import React, { useState, useEffect, useRef } from 'react';

const PixelPetWidget = ({ ticketStatusStats, myTickets }) => {
  // --- ESTADOS DE POSICIÓN Y ARRASTRE ---
  const [pos, setPos] = useState({ x: window.innerWidth - 120, y: window.innerHeight - 120 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // --- ESTADOS DEL PET ---
  const [mood, setMood] = useState('idle'); // idle, talking, sleep, panic
  const [dialog, setDialog] = useState('Sistemas operativos...');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Estados para animar la cara pixelada
  const [mouthOpen, setMouthOpen] = useState(false);
  const [facingRight, setFacingRight] = useState(false);

  // --- MÉTRICAS DEL SISTEMA ---
  const openTickets = (ticketStatusStats['OPEN'] || 0) + (ticketStatusStats['IN_PROGRESS'] || 0);
  const myPending = myTickets?.length || 0;
  const CRITICAL_LOAD = 50;

  // --- LÓGICA DE DRAG & DROP ---
  const handlePointerDown = (e) => {
    setIsDragging(true);
    // Calculamos dónde hizo clic exactamente dentro del cuadradito
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
  }, [isDragging]);

  // --- MOTOR DE IA Y DATOS (Game Loop) ---
  useEffect(() => {
    const brainLoop = setInterval(() => {
      if (isDragging || isMenuOpen) return; // Si lo estás arrastrando o viendo el menú, no hace nada autónomo

      // 1. Alerta Crítica (Forzada)
      if (openTickets >= CRITICAL_LOAD) {
        setMood('panic');
        setDialog(`¡CRÍTICO! ${openTickets} tickets activos. El servidor está sudando.`);
        // Tiembla y se mueve poquito
        setPos(p => ({ 
          x: Math.max(0, Math.min(window.innerWidth - 60, p.x + (Math.random() * 40 - 20))), 
          y: Math.max(0, Math.min(window.innerHeight - 60, p.y + (Math.random() * 40 - 20))) 
        }));
        return;
      }

      // 2. Comportamiento aleatorio
      const randomAction = Math.random();

      // Banco de datos del sistema para que el Pet "hable"
      const systemPhrases = [
        `Métricas: Hay ${openTickets} tickets globales en curso.`,
        `Jefe, tienes ${myPending} tickets asignados a tu nombre.`,
        `Carga CPU aproximada: ${(openTickets / CRITICAL_LOAD * 100).toFixed(0)}%.`,
        `Monitoreo de tiendas: Estable.`,
        `Sincronización con APOLO: OK.`,
        `Memoria RAM optimizada.`,
        `Buscando anomalías... Ninguna por ahora.`
      ];

      if (randomAction < 0.3) {
        // Caminar a un punto aleatorio cercano
        const newX = Math.max(0, Math.min(window.innerWidth - 100, pos.x + (Math.random() * 140 - 70)));
        const newY = Math.max(0, Math.min(window.innerHeight - 100, pos.y + (Math.random() * 100 - 50)));
        setFacingRight(newX > pos.x);
        setPos({ x: newX, y: newY });
        setMood('walk');
        setDialog('');
      } else if (randomAction < 0.65) {
        // Hablar y dar un reporte del sistema
        setMood('talking');
        setDialog(systemPhrases[Math.floor(Math.random() * systemPhrases.length)]);
      } else if (randomAction < 0.85) {
        // Idle
        setMood('idle');
        setDialog('');
      } else {
        // Dormir
        setMood('sleep');
        setDialog('Zzz...');
      }
    }, 4500);

    return () => clearInterval(brainLoop);
  }, [openTickets, myPending, isDragging, isMenuOpen, pos]);

  // --- ANIMACIÓN DE BOCA Y OJOS ---
  useEffect(() => {
    const blinkLoop = setInterval(() => {
      if (mood === 'talking' || mood === 'panic') {
        // Si habla o entra en pánico, la boca se abre y cierra rápido
        setMouthOpen(prev => !prev);
      } else if (mood === 'sleep') {
        setMouthOpen(false);
      } else {
        // Parpadeos aleatorios o ruiditos
        setMouthOpen(Math.random() > 0.8);
      }
    }, 250);
    return () => clearInterval(blinkLoop);
  }, [mood]);

  // --- LÓGICA DE COLORES DEL PET ---
  let petColor = '#14B8A6'; // Verde Teal (Sano)
  if (mood === 'panic') petColor = '#EF4444'; // Rojo (Crítico)
  else if (myPending > 0) petColor = '#F59E0B'; // Amarillo (Tiene trabajo)
  if (mood === 'sleep') petColor = '#808080'; // Gris (Durmiendo)

  return (
    <>
      <style>{`
        .w95-btn { background-color: #c0c0c0; border: 2px solid; border-color: #fff #808080 #808080 #fff; padding: 4px 8px; font-weight: bold; cursor: pointer; font-size: 11px; font-family: 'MS Sans Serif', sans-serif; width: 100%; text-align: left; margin-bottom: 4px; color: #000;}
        .w95-btn:active { border-color: #808080 #fff #fff #808080; }
      `}</style>

      {/* CONTENEDOR PRINCIPAL FLOTANTE (Draggable) */}
      <div style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // Si el usuario lo está agarrando quitamos la transición para que el mouse lo siga perfecto.
        // Si la IA lo está moviendo, usamos transition para que "camine" suavemente.
        transition: isDragging ? 'none' : 'left 2s ease-in-out, top 2s ease-in-out',
        touchAction: 'none' // Evita que en móviles la pantalla haga scroll al arrastrarlo
      }}>
        
        {/* Globo de Diálogo (Aparece si hay texto y el menú está cerrado) */}
        {dialog && !isMenuOpen && (
          <div style={{
            backgroundColor: '#ffffe1',
            border: '1px solid #000',
            padding: '6px 10px',
            fontSize: '11px',
            fontFamily: "'MS Sans Serif', 'Segoe UI', sans-serif",
            color: '#000',
            marginBottom: '8px',
            borderRadius: '2px',
            boxShadow: '2px 2px 0px rgba(0,0,0,0.2)',
            width: '140px',
            textAlign: 'center',
            position: 'relative',
            pointerEvents: 'none' // Para que no interrumpa el drag si pasas el mouse por encima
          }}>
            {dialog}
            <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: '6px', height: '6px', backgroundColor: '#ffffe1', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}></div>
          </div>
        )}

        {/* PIXEL PET (Dibujado con puros Divs) */}
        <div 
          onPointerDown={handlePointerDown}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          style={{
            width: '36px', 
            height: '36px',
            backgroundColor: petColor,
            border: '3px solid #000',
            boxShadow: 'inset -3px -3px 0px rgba(0,0,0,0.2), 3px 3px 0px rgba(0,0,0,0.3)',
            position: 'relative',
            cursor: isDragging ? 'grabbing' : 'grab',
            // Voltear el pet según la dirección
            transform: `scaleX(${facingRight ? -1 : 1})`,
            boxSizing: 'border-box'
          }}
          title="Arrastrame o haz clic"
        >
          {/* Ojo Izquierdo */}
          <div style={{
            position: 'absolute', top: '8px', left: '4px',
            width: '6px', height: mood === 'sleep' ? '2px' : '6px', // Si duerme se hace una raya
            backgroundColor: '#000'
          }}></div>
          
          {/* Ojo Derecho */}
          <div style={{
            position: 'absolute', top: '8px', right: '4px',
            width: '6px', height: mood === 'sleep' ? '2px' : '6px',
            backgroundColor: '#000'
          }}></div>
          
          {/* Boca Dinámica */}
          <div style={{
            position: 'absolute', bottom: '6px', left: '12px',
            width: '6px', 
            height: mouthOpen ? '8px' : '2px', // Simula que habla
            backgroundColor: '#000',
            transition: 'height 0.1s'
          }}></div>
        </div>
        
        {/* Sombrita del Pet */}
        <div style={{ width: '28px', height: '4px', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '50%', marginTop: '4px', pointerEvents: 'none' }}></div>
      </div>

      {/* MENÚ DE INTERACCIÓN W95 (Aparece al hacer clic) */}
      {isMenuOpen && (
        <div style={{
          position: 'fixed',
          top: `${Math.min(window.innerHeight - 150, pos.y + 40)}px`,
          left: `${Math.min(window.innerWidth - 180, pos.x + 40)}px`,
          zIndex: 10000,
          backgroundColor: '#c0c0c0',
          border: '2px solid',
          borderColor: '#ffffff #808080 #808080 #ffffff',
          padding: '2px',
          fontFamily: "'MS Sans Serif', 'Segoe UI', sans-serif",
          width: '160px',
          boxShadow: '4px 4px 0px rgba(0,0,0,0.2)'
        }}>
          <div style={{ backgroundColor: '#000080', color: '#ffffff', padding: '2px 4px', fontWeight: 'bold', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>PET_CONTROL</span>
            <button onClick={() => setIsMenuOpen(false)} style={{ backgroundColor: '#c0c0c0', border: '1px solid', borderColor: '#fff #000 #000 #fff', width: '14px', height: '14px', fontSize: '9px', cursor: 'pointer', color: '#000', fontWeight: 'bold', padding: 0 }}>X</button>
          </div>
          
          <div style={{ padding: '6px' }}>
            <button className="w95-btn" onClick={() => { setMood('talking'); setDialog('¡Reporte enviado!'); setIsMenuOpen(false); }}>📊 Forzar Reporte</button>
            <button className="w95-btn" onClick={() => { setMood('sleep'); setDialog('Zzz...'); setIsMenuOpen(false); }}>💤 Mandar a dormir</button>
            <div style={{ borderTop: '1px solid #808080', borderBottom: '1px solid #fff', margin: '6px 0' }}></div>
            <button className="w95-btn" onClick={() => setIsMenuOpen(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
};

export default PixelPetWidget;