import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Concorde Pixel Pet
 * - Mantiene la API existente: <PixelPetWidget ticketStatusStats={...} myTickets={...} />
 * - No requiere dependencias ni endpoints nuevos.
 * - Las métricas de Concorde son de solo lectura; la gamificación se guarda localmente.
 */
const STORAGE_KEY = 'concorde-pixel-pet-v2';
const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const todayKey = () => new Date().toISOString().slice(0, 10);

const defaultPetData = () => ({
  xp: 0,
  coins: 25,
  hunger: 72,
  happiness: 82,
  energy: 90,
  cleanliness: 90,
  streak: 0,
  lastVisit: '',
  lastRewardedResolved: 0,
  lastDailyClaim: '',
  lastMissionClaim: '',
  inventory: ['default'],
  equipped: 'default',
  soundEnabled: false,
  reducedMotion: false,
});

const readPetData = () => {
  try {
    if (typeof window === 'undefined') return defaultPetData();
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultPetData(), ...JSON.parse(saved) } : defaultPetData();
  } catch {
    return defaultPetData();
  }
};

const PixelPetWidget = ({ ticketStatusStats = {}, myTickets = [] }) => {
  // --- Posición y arrastre: conserva la mascota flotante existente ---
  const [pos, setPos] = useState(() => ({
    x: typeof window !== 'undefined' ? Math.max(12, window.innerWidth - 100) : 800,
    y: typeof window !== 'undefined' ? Math.max(12, window.innerHeight - 150) : 600,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const pointerStart = useRef({ x: 0, y: 0 });
  const draggedRef = useRef(false);
  const actionTimeoutRef = useRef(null);
  const [hasMoved, setHasMoved] = useState(false);

  // --- Estado visual y personalidad ---
  const [mood, setMood] = useState('idle');
  const [dialog, setDialog] = useState('¡Concorde en línea!');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('cuidados');
  const [sleepMode, setSleepMode] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [facingRight, setFacingRight] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [toast, setToast] = useState('');
  const [petData, setPetData] = useState(readPetData);

  // --- Métricas reales de Concorde (solo lectura) ---
  const stats = ticketStatusStats || {};
  const openTickets = Number(stats.OPEN || 0) + Number(stats.IN_PROGRESS || 0);
  const resolvedTickets = Number(stats.RESOLVED || 0);
  const myPending = Array.isArray(myTickets) ? myTickets.length : 0;
  const criticalLoad = 50;
  const isCritical = openTickets >= criticalLoad;
  const level = Math.floor(Math.max(0, petData.xp) / 100) + 1;
  const xpInLevel = Math.max(0, petData.xp) % 100;
  const moodScore = Math.round((petData.happiness + petData.energy + petData.cleanliness) / 3);

  const ticketHealth = useMemo(() => {
    if (isCritical) return { label: 'Carga crítica', color: '#ef4444' };
    if (openTickets >= 30) return { label: 'Carga alta', color: '#f59e0b' };
    return { label: 'Operación estable', color: '#22c55e' };
  }, [isCritical, openTickets]);

  // --- Persistencia local de la mascota ---
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(petData));
    } catch {
      // El widget sigue funcionando aunque el navegador bloquee el almacenamiento.
    }
  }, [petData]);

  // Racha diaria: no se usa GPS ni se envían datos a un servidor.
  useEffect(() => {
    const today = todayKey();
    setPetData((previous) => {
      if (previous.lastVisit === today) return previous;
      const yesterday = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
      const nextStreak = previous.lastVisit === yesterday ? previous.streak + 1 : 1;
      return { ...previous, lastVisit: today, streak: nextStreak };
    });
  }, []);

  // Premia únicamente el incremento observado de tickets resueltos.
  // La cifra inicial se toma como referencia para evitar regalar XP retroactiva al instalar.
  const initializedResolvedRef = useRef(false);
  useEffect(() => {
    if (!initializedResolvedRef.current) {
      initializedResolvedRef.current = true;
      setPetData((previous) => {
        if (previous.lastRewardedResolved !== 0 || resolvedTickets === 0) return previous;
        return { ...previous, lastRewardedResolved: resolvedTickets };
      });
      return;
    }
    setPetData((previous) => {
      const delta = Math.max(0, resolvedTickets - Number(previous.lastRewardedResolved || 0));
      if (!delta) return previous;
      return {
        ...previous,
        xp: previous.xp + delta * 10,
        coins: previous.coins + delta * 3,
        happiness: clamp(previous.happiness + delta * 2, 0, 100),
        lastRewardedResolved: resolvedTickets,
      };
    });
  }, [resolvedTickets]);

  // Necesidades bajan lentamente mientras la app está abierta. En descanso no se agota la energía.
  useEffect(() => {
    const interval = window.setInterval(() => {
      setPetData((previous) => ({
        ...previous,
        hunger: clamp(previous.hunger - 1, 0, 100),
        happiness: clamp(previous.happiness - (previous.hunger < 20 ? 2 : 0.5), 0, 100),
        energy: sleepMode
          ? clamp(previous.energy + 2, 0, 100)
          : clamp(previous.energy - 0.5, 0, 100),
        cleanliness: clamp(previous.cleanliness - 0.25, 0, 100),
      }));
    }, 60000);
    return () => window.clearInterval(interval);
  }, [sleepMode]);

  // Motor de personalidad: prioriza alertas útiles de Concorde y respeta el descanso.
  useEffect(() => {
    const brainLoop = window.setInterval(() => {
      if (isDragging || isMenuOpen || sleepMode) return;
      if (mood === 'love' || mood === 'coffee' || mood === 'celebrate') return;

      if (isCritical) {
        setMood('panic');
        setDialog(`🚨 ¡Carga crítica! ${openTickets} tickets activos.`);
        return;
      }
      if (petData.hunger <= 20) {
        setMood('hungry');
        setDialog('Tengo hambre de datos… ¿me das un snack?');
        return;
      }
      if (petData.energy <= 18) {
        setMood('tired');
        setDialog('Necesito recargar energía. ¿Una pausa?');
        return;
      }

      const phrases = [
        `Concorde registra ${openTickets} tickets activos.`,
        `¡Llevas ${resolvedTickets} tickets resueltos!`,
        `Veo ${myPending} tareas en tu bandeja.`,
        'Escaneando la terminal… todo bajo control.',
        'Un ticket a la vez. ¡Tú puedes!',
        `Nivel ${level}: sigo aprendiendo contigo.`,
        'Consejo: una buena descripción acelera el diagnóstico.',
        'Revisando el radar de incidencias…',
      ];
      const roll = Math.random();
      if (roll < 0.25) {
        setMood('walk');
        setFacingRight((previous) => !previous);
        setDialog('');
        setPos((previous) => ({
          x: clamp(previous.x + (Math.random() * 100 - 50), 8, Math.max(8, window.innerWidth - 60)),
          y: clamp(previous.y + (Math.random() * 70 - 35), 8, Math.max(8, window.innerHeight - 100)),
        }));
      } else if (roll < 0.7) {
        setMood('talking');
        setDialog(phrases[Math.floor(Math.random() * phrases.length)]);
      } else {
        setMood('idle');
        setDialog('');
      }
    }, 7000);
    return () => window.clearInterval(brainLoop);
  }, [
    isDragging, isMenuOpen, sleepMode, mood, isCritical, openTickets,
    resolvedTickets, myPending, petData.hunger, petData.energy, level,
  ]);

  // Parpadeo/boca, con movimiento reducido opcional.
  useEffect(() => {
    const blinkLoop = window.setInterval(() => {
      if (mood === 'sleep' || sleepMode) setMouthOpen(false);
      else setMouthOpen(Math.random() > (mood === 'talking' || mood === 'panic' ? 0.35 : 0.82));
    }, 320);
    return () => window.clearInterval(blinkLoop);
  }, [mood, sleepMode]);

  useEffect(() => () => window.clearTimeout(actionTimeoutRef.current), []);

  // Mantener la mascota dentro de la ventana al cambiar tamaño.
  useEffect(() => {
    const resize = () => setPos((previous) => ({
      x: clamp(previous.x, 8, Math.max(8, window.innerWidth - 52)),
      y: clamp(previous.y, 8, Math.max(8, window.innerHeight - 75)),
    }));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const showAction = (nextMood, message, duration = 3500) => {
    window.clearTimeout(actionTimeoutRef.current);
    setMood(nextMood);
    setDialog(message);
    actionTimeoutRef.current = window.setTimeout(() => {
      if (!sleepMode) {
        setMood(isCritical ? 'panic' : 'idle');
        setDialog(isCritical ? `🚨 ${openTickets} tickets activos.` : '');
      }
    }, duration);
  };

  const handleAction = (actionType) => {
    setIsMenuOpen(false);

    if (actionType === 'report') {
      setShowStats(true);
      showAction('talking', `📊 ${openTickets} activos · ${resolvedTickets} resueltos · ${myPending} tuyos.`);
      return;
    }

    if (actionType === 'sleep_toggle') {
      if (sleepMode) {
        setSleepMode(false);
        setPetData((previous) => ({ ...previous, energy: clamp(previous.energy + 5, 0, 100) }));
        showAction('idle', '¡Sistemas en línea! ☀️');
      } else {
        setSleepMode(true);
        setMood('sleep');
        setDialog('Zzz… recargando energía');
      }
      return;
    }

    if (actionType === 'feed') {
      if (petData.coins < 5) {
        showAction('hungry', 'Me faltan 5 monedas para el snack.');
        notify('No tienes suficientes monedas.');
        return;
      }
      setPetData((previous) => ({
        ...previous,
        coins: previous.coins - 5,
        hunger: clamp(previous.hunger + 35, 0, 100),
        happiness: clamp(previous.happiness + 8, 0, 100),
        xp: previous.xp + 2,
      }));
      setSleepMode(false);
      showAction('love', '¡Ñam! Snack de datos 🍪 +2 XP');
      return;
    }

    if (actionType === 'play') {
      if (petData.energy < 12) {
        showAction('tired', 'Estoy agotado. ¡Primero necesito dormir!');
        return;
      }
      setPetData((previous) => ({
        ...previous,
        happiness: clamp(previous.happiness + 18, 0, 100),
        energy: clamp(previous.energy - 8, 0, 100),
        hunger: clamp(previous.hunger - 5, 0, 100),
        coins: previous.coins + 1,
        xp: previous.xp + 5,
      }));
      setSleepMode(false);
      showAction('celebrate', '¡Buen combo! +5 XP y +1 moneda 🎾');
      return;
    }

    if (actionType === 'clean') {
      setPetData((previous) => ({
        ...previous,
        cleanliness: 100,
        happiness: clamp(previous.happiness + 6, 0, 100),
        xp: previous.xp + 3,
      }));
      showAction('love', '¡Brilla como un servidor nuevo! ✨');
      return;
    }

    if (actionType === 'daily') {
      if (petData.lastDailyClaim === todayKey()) {
        showAction('talking', 'La recompensa diaria ya está reclamada. ¡Vuelve mañana!');
        return;
      }
      setPetData((previous) => ({
        ...previous,
        coins: previous.coins + 15,
        xp: previous.xp + 10,
        happiness: clamp(previous.happiness + 10, 0, 100),
        lastDailyClaim: todayKey(),
      }));
      showAction('celebrate', '¡Recompensa diaria! +15 monedas · +10 XP 🎁');
      return;
    }

    if (actionType === 'mission') {
      if (petData.lastMissionClaim === todayKey()) {
        showAction('talking', 'Misión diaria completada. ¡Mañana habrá otra!');
        return;
      }
      if (resolvedTickets < 1) {
        showAction('talking', 'Resuelve al menos un ticket hoy para completar la misión.');
        return;
      }
      setPetData((previous) => ({
        ...previous,
        coins: previous.coins + 20,
        xp: previous.xp + 20,
        happiness: clamp(previous.happiness + 12, 0, 100),
        lastMissionClaim: todayKey(),
      }));
      showAction('celebrate', 'Misión cumplida: +20 monedas y +20 XP 🏆');
      return;
    }

    if (actionType === 'coffee') {
      setPetData((previous) => ({
        ...previous,
        energy: clamp(previous.energy + 15, 0, 100),
        happiness: clamp(previous.happiness + 4, 0, 100),
      }));
      setSleepMode(false);
      showAction('coffee', '¡CAFÉ DE DEPURACIÓN! ☕', 3000);
      setPos((previous) => ({
        x: clamp(previous.x + (Math.random() * 160 - 80), 8, Math.max(8, window.innerWidth - 60)),
        y: clamp(previous.y + (Math.random() * 100 - 50), 8, Math.max(8, window.innerHeight - 100)),
      }));
      return;
    }

    if (actionType === 'pet') {
      setPetData((previous) => ({
        ...previous,
        happiness: clamp(previous.happiness + 12, 0, 100),
        xp: previous.xp + 1,
      }));
      setSleepMode(false);
      showAction('love', '¡Moral +12! Gracias por el cariño ♥');
      return;
    }

    if (actionType === 'patrol') {
      setSleepMode(false);
      setFacingRight((previous) => !previous);
      setPos((previous) => ({
        x: clamp(previous.x + (facingRight ? -100 : 100), 8, Math.max(8, window.innerWidth - 60)),
        y: previous.y,
      }));
      showAction('walk', '¡Patrullando el tablero de Concorde!');
      return;
    }

    if (actionType === 'stats_toggle') {
      setShowStats((previous) => !previous);
      return;
    }

    if (actionType === 'motion_toggle') {
      setPetData((previous) => ({ ...previous, reducedMotion: !previous.reducedMotion }));
      notify(petData.reducedMotion ? 'Animaciones activadas.' : 'Movimiento reducido activado.');
      return;
    }

    if (actionType === 'sound_toggle') {
      setPetData((previous) => ({ ...previous, soundEnabled: !previous.soundEnabled }));
      notify(petData.soundEnabled ? 'Sonido desactivado.' : 'Preferencia de sonido activada (sin audio externo).');
      return;
    }

    if (actionType === 'reset') {
      if (window.confirm('¿Reiniciar el progreso de la mascota? No se modificarán los tickets de Concorde.')) {
        setPetData(defaultPetData());
        setSleepMode(false);
        showAction('idle', 'Nueva aventura iniciada. ¡Vamos!');
      }
    }
  };

  // --- Apariencia ---
  let petColor = '#F59E0B';
  if (mood === 'panic' || isCritical) petColor = '#EF4444';
  if (sleepMode || mood === 'sleep') petColor = '#94A3B8';
  if (mood === 'love' || mood === 'celebrate') petColor = '#EC4899';
  if (mood === 'coffee') petColor = '#D97706';
  if (mood === 'hungry') petColor = '#EAB308';
  if (mood === 'tired') petColor = '#60A5FA';

  const animation = petData.reducedMotion
    ? 'none'
    : mood === 'panic' ? 'petPanic .2s infinite'
    : mood === 'walk' ? 'petWalk .5s infinite'
    : mood === 'love' || mood === 'celebrate' ? 'petBounce .65s infinite'
    : sleepMode ? 'petSleep 2s infinite'
    : !isDragging ? 'petFloat 3s ease-in-out infinite' : 'none';

  const bar = (label, value, color) => (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
        <span>{label}</span><span>{Math.round(value)}%</span>
      </div>
      <div style={{ height: 6, background: '#777', border: '1px inset #eee' }}>
        <div style={{ width: `${clamp(value, 0, 100)}%`, height: '100%', background: color, transition: 'width .25s' }} />
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes petFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes petWalk { 0%,100% { transform: translateY(0) rotate(0); } 25% { transform: translateY(-3px) rotate(5deg); } 75% { transform: translateY(-3px) rotate(-5deg); } }
        @keyframes petPanic { 0% { transform: translate(2px,2px); } 25% { transform: translate(-2px,-2px); } 50% { transform: translate(2px,-2px); } 75% { transform: translate(-2px,2px); } 100% { transform: translate(2px,2px); } }
        @keyframes petBounce { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-8px) scale(1.04); } }
        @keyframes petSleep { 0%,100% { transform: translateY(0); } 50% { transform: translateY(2px); } }
        @keyframes petSparkle { 0%,100% { opacity: .25; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.2); } }
        .cp-btn { background:#c0c0c0; border:2px solid; border-color:#fff #666 #666 #fff; padding:5px 7px; font-weight:bold; cursor:pointer; font-size:11px; font-family:'MS Sans Serif','Segoe UI',sans-serif; width:100%; text-align:left; margin-bottom:4px; color:#111; }
        .cp-btn:active { border-color:#666 #fff #fff #666; }
        .cp-btn:disabled { opacity:.5; cursor:not-allowed; }
        .cp-tab { background:#c0c0c0; border:1px solid #777; padding:4px 5px; font-size:10px; cursor:pointer; flex:1; }
        .cp-tab.active { background:#fff; font-weight:bold; border-bottom:2px solid #000080; }
        .cp-chip { font-size:10px; border:1px solid #777; padding:2px 4px; background:#eee; color:#111; }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration:.01ms !important; } }
      `}</style>

      <div style={{
        position: 'fixed', left: `${pos.x}px`, top: `${pos.y}px`, zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        transition: isDragging ? 'none' : 'left 1.1s ease, top 1.1s ease',
        touchAction: 'none', userSelect: 'none',
      }}>
        {dialog && !isMenuOpen && (
          <div style={{
            background: '#ffffe1', border: '1px solid #000', padding: '6px 9px',
            fontSize: 11, fontFamily: "'MS Sans Serif','Segoe UI',sans-serif", color: '#000',
            marginBottom: 7, borderRadius: 2, boxShadow: '2px 2px 0 rgba(0,0,0,.2)',
            width: 'max-content', maxWidth: 190, textAlign: 'center', position: 'relative',
            pointerEvents: 'none', lineHeight: 1.35,
          }}>
            {dialog}
            <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 6, height: 6, background: '#ffffe1', borderRight: '1px solid #000', borderBottom: '1px solid #000' }} />
          </div>
        )}

        {showStats && !isMenuOpen && (
          <div style={{ background: 'rgba(0,0,0,.82)', color: '#fff', padding: '4px 6px', marginBottom: 5, border: '1px solid #444', font: '10px monospace', minWidth: 88, textAlign: 'center' }}>
            <div style={{ color: ticketHealth.color, fontWeight: 'bold' }}>● {ticketHealth.label}</div>
            <div>LVL {level} · {xpInLevel}/100 XP</div>
            <div style={{ width: 76, height: 4, background: '#555', margin: '3px auto 0' }}>
              <div style={{ height: '100%', width: `${xpInLevel}%`, background: '#38bdf8' }} />
            </div>
          </div>
        )}

        <div
          onPointerDown={(event) => {
            event.preventDefault();
            draggedRef.current = false;
            pointerStart.current = { x: event.clientX, y: event.clientY };
            dragOffset.current = { x: event.clientX - pos.x, y: event.clientY - pos.y };
            setIsDragging(true);
            setHasMoved(false);
            try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
          }}
          onPointerMove={(event) => {
            if (!isDragging) return;
            const dx = event.clientX - pointerStart.current.x;
            const dy = event.clientY - pointerStart.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 5) {
              draggedRef.current = true;
              setHasMoved(true);
            }
            if (draggedRef.current) {
              setPos({
                x: clamp(event.clientX - dragOffset.current.x, 4, Math.max(4, window.innerWidth - 44)),
                y: clamp(event.clientY - dragOffset.current.y, 4, Math.max(4, window.innerHeight - 55)),
              });
            }
          }}
          onPointerUp={() => {
            setIsDragging(false);
            if (!draggedRef.current) setIsMenuOpen((previous) => !previous);
            else notify('¡Puesto de control reubicado!');
          }}
          onPointerCancel={() => setIsDragging(false)}
          role="button"
          tabIndex={0}
          aria-label="Mascota de Concorde. Arrastra para mover o pulsa para abrir controles."
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') setIsMenuOpen((previous) => !previous);
          }}
          title="Arrástrame para moverme · clic para abrir PET_CONTROL"
          style={{
            width: 42, height: 42, backgroundColor: petColor, border: '3px solid #000',
            boxShadow: 'inset -3px -3px rgba(0,0,0,.2), 3px 3px rgba(0,0,0,.3)',
            position: 'relative', cursor: isDragging ? 'grabbing' : 'grab',
            transform: `scaleX(${facingRight ? -1 : 1})`, boxSizing: 'border-box',
            animation, outline: isCritical ? '2px solid #ef4444' : 'none', outlineOffset: 2,
          }}
        >
          {/* Accesorios visuales desbloqueables */}
          {petData.equipped === 'crown' && <div style={{ position: 'absolute', top: -13, left: 7, fontSize: 15, transform: `scaleX(${facingRight ? -1 : 1})` }}>👑</div>}
          {petData.equipped === 'headphones' && <div style={{ position: 'absolute', top: 0, left: -4, fontSize: 13, transform: `scaleX(${facingRight ? -1 : 1})` }}>🎧</div>}
          {petData.equipped === 'glasses' && <div style={{ position: 'absolute', top: 7, left: 3, fontSize: 12, transform: `scaleX(${facingRight ? -1 : 1})` }}>🕶️</div>}
          {mood === 'hungry' && <div style={{ position: 'absolute', right: -9, top: -8, fontSize: 12 }}>🍪</div>}
          {mood === 'tired' && <div style={{ position: 'absolute', right: -9, top: -9, fontSize: 12 }}>💤</div>}
          {mood === 'celebrate' && <div style={{ position: 'absolute', right: -8, top: -10, fontSize: 12, animation: petData.reducedMotion ? 'none' : 'petSparkle .6s infinite' }}>✨</div>}
          <div style={{ position: 'absolute', top: 9, left: 5, width: 6, height: mood === 'sleep' || sleepMode ? 2 : 6, background: '#000' }} />
          <div style={{ position: 'absolute', top: 9, right: 5, width: 6, height: mood === 'sleep' || sleepMode ? 2 : 6, background: '#000' }} />
          <div style={{ position: 'absolute', bottom: 6, left: 15, width: 6, height: mouthOpen ? 7 : 2, background: '#000', transition: 'height .1s' }} />
          {mood === 'panic' && <div style={{ position: 'absolute', top: -13, right: -8, fontSize: 12 }}>❗</div>}
        </div>
        <div style={{ width: 30, height: 4, background: 'rgba(0,0,0,.2)', borderRadius: '50%', marginTop: 5, pointerEvents: 'none' }} />
        {toast && <div style={{ marginTop: 5, background: '#ffffe1', border: '1px solid #000', color: '#000', padding: '4px 6px', fontSize: 10, whiteSpace: 'nowrap' }}>{toast}</div>}
      </div>

      {isMenuOpen && (
        <div style={{
          position: 'fixed',
          top: clamp(pos.y + 48, 8, Math.max(8, window.innerHeight - 390)),
          left: clamp(pos.x + 44, 8, Math.max(8, window.innerWidth - 235)),
          zIndex: 10000, background: '#c0c0c0', border: '2px solid',
          borderColor: '#fff #666 #666 #fff', padding: 2,
          fontFamily: "'MS Sans Serif','Segoe UI',sans-serif", width: 220,
          maxHeight: '80vh', overflowY: 'auto', boxShadow: '4px 4px 0 rgba(0,0,0,.2)',
          color: '#111',
        }}>
          <div style={{ background: '#000080', color: '#fff', padding: '4px 5px', fontWeight: 'bold', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>✈ CONCORDE_PET v2.0</span>
            <button onClick={() => setIsMenuOpen(false)} aria-label="Cerrar menú" style={{ background: '#c0c0c0', border: '1px solid', borderColor: '#fff #000 #000 #fff', width: 17, height: 16, fontSize: 10, cursor: 'pointer', color: '#000', fontWeight: 'bold', padding: 0 }}>X</button>
          </div>

          <div style={{ padding: 6 }}>
            <div style={{ display: 'flex', gap: 3, marginBottom: 7 }}>
              <button className={`cp-tab ${activeTab === 'cuidados' ? 'active' : ''}`} onClick={() => setActiveTab('cuidados')}>Cuidados</button>
              <button className={`cp-tab ${activeTab === 'operaciones' ? 'active' : ''}`} onClick={() => setActiveTab('operaciones')}>Concorde</button>
              <button className={`cp-tab ${activeTab === 'coleccion' ? 'active' : ''}`} onClick={() => setActiveTab('coleccion')}>Inventario</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginBottom: 7 }}>
              <span className="cp-chip">⭐ Nivel {level}</span>
              <span className="cp-chip">🪙 {petData.coins}</span>
              <span className="cp-chip">🔥 Racha {petData.streak}</span>
            </div>

            {activeTab === 'cuidados' && (
              <>
                {bar('Hambre', petData.hunger, '#f59e0b')}
                {bar('Felicidad', petData.happiness, '#ec4899')}
                {bar('Energía', petData.energy, '#38bdf8')}
                {bar('Higiene', petData.cleanliness, '#22c55e')}
                <div style={{ borderTop: '1px solid #777', margin: '7px 0' }} />
                <button className="cp-btn" onClick={() => handleAction('feed')}>🍪 Dar snack (5 monedas)</button>
                <button className="cp-btn" onClick={() => handleAction('play')}>🎾 Jugar (+XP)</button>
                <button className="cp-btn" onClick={() => handleAction('clean')}>🧽 Limpiar a la mascota</button>
                <button className="cp-btn" onClick={() => handleAction('pet')}>🖐️ Acariciar (+felicidad)</button>
                <button className="cp-btn" onClick={() => handleAction('sleep_toggle')}>{sleepMode ? '☀️ Despertar' : '💤 Dormir / recargar'}</button>
              </>
            )}

            {activeTab === 'operaciones' && (
              <>
                <div style={{ background: '#eee', border: '1px inset #fff', padding: 6, marginBottom: 6, fontSize: 10, lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 'bold', color: ticketHealth.color }}>● {ticketHealth.label}</div>
                  <div>Tickets activos: <b>{openTickets}</b></div>
                  <div>Tickets resueltos: <b>{resolvedTickets}</b></div>
                  <div>Tickets en tu lista: <b>{myPending}</b></div>
                  <div>Estado de mascota: <b>{sleepMode ? 'Descansando' : mood}</b></div>
                </div>
                <button className="cp-btn" onClick={() => handleAction('report')}>📊 Mostrar reporte rápido</button>
                <button className="cp-btn" onClick={() => handleAction('patrol')}>🔍 Patrullar / explorar</button>
                <button className="cp-btn" onClick={() => handleAction('coffee')}>☕ Café de depuración</button>
                <button className="cp-btn" onClick={() => handleAction('mission')}>🏆 Reclamar misión diaria</button>
                <button className="cp-btn" onClick={() => handleAction('daily')}>🎁 Recompensa diaria</button>
                <div style={{ fontSize: 9, lineHeight: 1.4, marginTop: 4 }}>La mascota lee las métricas recibidas por props. No crea, modifica ni cierra tickets.</div>
              </>
            )}

            {activeTab === 'coleccion' && (
              <>
                <div style={{ background: '#eee', border: '1px inset #fff', padding: 6, fontSize: 10, marginBottom: 6 }}>
                  Desbloquea objetos con monedas. El accesorio equipado cambia la apariencia de la mascota.
                </div>
                {[
                  { id: 'default', name: '🤖 Aspecto clásico', price: 0 },
                  { id: 'crown', name: '👑 Corona (30)', price: 30 },
                  { id: 'headphones', name: '🎧 Auriculares (20)', price: 20 },
                  { id: 'glasses', name: '🕶️ Gafas pixel (15)', price: 15 },
                ].map((item) => {
                  const owned = petData.inventory.includes(item.id);
                  const equipped = petData.equipped === item.id;
                  return (
                    <button
                      key={item.id}
                      className="cp-btn"
                      onClick={() => {
                        if (owned) {
                          setPetData((previous) => ({ ...previous, equipped: item.id }));
                          notify(`${item.name} equipado.`);
                        } else if (petData.coins >= item.price) {
                          setPetData((previous) => ({
                            ...previous,
                            coins: previous.coins - item.price,
                            inventory: [...previous.inventory, item.id],
                            equipped: item.id,
                          }));
                          setPetData((previous) => ({ ...previous, xp: previous.xp + 5 }));
                          notify(`${item.name} desbloqueado. +5 XP`);
                        } else {
                          notify('No tienes suficientes monedas.');
                        }
                      }}
                    >
                      {equipped ? '✓ ' : ''}{item.name} {owned ? (equipped ? '(Equipado)' : '(Equipar)') : '— Comprar'}
                    </button>
                  );
                })}
                <button className="cp-btn" onClick={() => handleAction('daily')}>🎁 Reclamar regalo diario</button>
              </>
            )}

            <div style={{ borderTop: '1px solid #777', borderBottom: '1px solid #fff', margin: '7px 0' }} />
            <button className="cp-btn" onClick={() => handleAction('stats_toggle')}>{showStats ? '📉 Ocultar HUD flotante' : '📈 Mostrar HUD flotante'}</button>
            <button className="cp-btn" onClick={() => handleAction('motion_toggle')}>{petData.reducedMotion ? '✨ Activar animaciones' : '🧘 Reducir movimiento'}</button>
            <button className="cp-btn" onClick={() => handleAction('sound_toggle')}>{petData.soundEnabled ? '🔇 Desactivar preferencia de sonido' : '🔈 Preferencia de sonido'}</button>
            <button className="cp-btn" onClick={() => handleAction('reset')}>♻ Reiniciar progreso local</button>
            <button className="cp-btn" onClick={() => setIsMenuOpen(false)}>Cerrar menú</button>
          </div>
        </div>
      )}
    </>
  );
};

export default PixelPetWidget;
