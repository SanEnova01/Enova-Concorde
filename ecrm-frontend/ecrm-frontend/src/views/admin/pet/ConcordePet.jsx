import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import crmApi from '../../../api/crmApi';
import { startVisiblePolling } from '../../../utils/visiblePolling';
import PetAvatar from './PetAvatar';

/**
 * Mascota Concorde
 * - Personaje SVG con expresiones, ojos que siguen el cursor y alas animadas.
 * - Inteligencia con IA vía backend (/api/pet/talk → Vercel AI Gateway). La llave nunca llega al navegador.
 * - Todo se controla desde Configuración (super admin): encendido, IA, modelo, personalidad, acciones.
 * - El minijuego (XP, monedas, inventario) se guarda en el navegador de cada persona.
 */
const STORAGE_KEY = 'concorde-pixel-pet-v2'; // se conserva para no perder el progreso anterior
const DAY_MS = 24 * 60 * 60 * 1000;
const SIZE = 76;

// Si el backend todavía no tiene /api/pet (o falla), la mascota funciona sin IA
const FALLBACK_CONFIG = {
  enabled: true, ai_enabled: false, ai_available: false, personality: 'divertido', proactive_minutes: 0,
  actions: { alerts: true, walk: true, games: true, chat: false },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const todayKey = () => new Date().toISOString().slice(0, 10);

const defaultPetData = () => ({
  xp: 0, coins: 25, hunger: 72, happiness: 82, energy: 90, cleanliness: 90,
  streak: 0, lastVisit: '', lastRewardedResolved: 0, lastDailyClaim: '', lastMissionClaim: '',
  inventory: ['default'], equipped: 'default', reducedMotion: false,
});

const readPetData = () => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultPetData(), ...JSON.parse(saved) } : defaultPetData();
  } catch {
    return defaultPetData();
  }
};

const SHOP = [
  { id: 'default', name: '✈️ Aspecto clásico', price: 0 },
  { id: 'pilot', name: '🧑‍✈️ Gorra de piloto', price: 25 },
  { id: 'crown', name: '👑 Corona', price: 30 },
  { id: 'headphones', name: '🎧 Auriculares', price: 20 },
  { id: 'glasses', name: '🕶️ Gafas', price: 15 },
];

const SUGGESTIONS = ['¿Cómo vamos hoy?', '¿Cuáles son mis tickets?', 'Correos de contacto de una tienda', 'Estado del ticket SOP-…', 'Tickets abiertos de una tienda'];

// Solo admin y super admin tienen mascota (el backend también lo exige en /api/pet)
const isStaffSession = () => {
  try {
    const token = window.localStorage.getItem('crm_token');
    const role = JSON.parse(window.atob(token.split('.')[1])).role;
    return ['admin', 'super admin'].includes(String(role || '').toLowerCase().trim());
  } catch {
    return false;
  }
};

// Nombres legibles de las consultas que hizo la IA
const TOOL_LABELS = {
  buscar_tienda: 'tiendas', ver_ticket: 'ticket', buscar_tickets: 'tickets',
  tickets_de_tienda: 'tickets de tienda', metricas_tienda: 'métricas', alertas_tienda: 'alertas',
};

// Plantillas que el usuario completa antes de enviar
const TEMPLATES = {
  'Correos de contacto de una tienda': 'Dame los correos de contacto de ',
  'Estado del ticket SOP-…': '¿En qué estado está el ticket SOP-',
  'Tickets abiertos de una tienda': '¿Qué tickets abiertos tiene ',
};

const ConcordePet = ({ ticketStatusStats = {}, myTickets = [] }) => {
  const [allowed] = useState(isStaffSession);
  const [config, setConfig] = useState(null);

  // --- Posición y arrastre ---
  const [pos, setPos] = useState(() => ({
    x: Math.max(12, window.innerWidth - 130),
    y: Math.max(12, window.innerHeight - 170),
  }));
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const pointerStart = useRef({ x: 0, y: 0 });
  const draggedRef = useRef(false);
  const actionTimeoutRef = useRef(null);

  // --- Estado visual ---
  const [mood, setMood] = useState('idle');
  const [dialog, setDialog] = useState('¡Concorde listo para despegar! ✈️');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('hablar');
  const [sleepMode, setSleepMode] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [blink, setBlink] = useState(false);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [showStats, setShowStats] = useState(true);
  const [toast, setToast] = useState('');
  const [petData, setPetData] = useState(readPetData);

  // --- Chat ---
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const talkingUntil = useRef(0);
  const chatEndRef = useRef(null);

  // --- Métricas reales (solo lectura) ---
  const stats = ticketStatusStats || {};
  const openTickets = Number(stats.OPEN || 0) + Number(stats.IN_PROGRESS || 0);
  const resolvedTickets = Number(stats.RESOLVED || 0);
  const myPending = Array.isArray(myTickets) ? myTickets.length : 0;
  const isCritical = openTickets >= 50;
  const level = Math.floor(Math.max(0, petData.xp) / 100) + 1;
  const xpInLevel = Math.max(0, petData.xp) % 100;

  const actions = config?.actions || FALLBACK_CONFIG.actions;
  const alertsOn = actions.alerts;
  const gamesOn = actions.games;
  const chatOn = actions.chat;
  const walkOn = actions.walk;

  // Estado actual para los temporizadores (evita reiniciarlos en cada render)
  const live = useRef({});
  live.current = { isMenuOpen, sleepMode, isDragging, thinking, mood, isCritical, openTickets, myPending, petData, alertsOn, gamesOn, walkOn };

  const ticketHealth = useMemo(() => {
    if (isCritical) return { label: 'Carga crítica', color: '#ef4444' };
    if (openTickets >= 30) return { label: 'Carga alta', color: '#f59e0b' };
    return { label: 'Operación estable', color: '#22c55e' };
  }, [isCritical, openTickets]);

  // --- Configuración desde el backend (se refresca cada 5 min con la pestaña visible) ---
  useEffect(() => {
    if (!allowed) return undefined;
    const load = () => crmApi.get('/pet/config')
      .then((res) => setConfig(res.data?.data || FALLBACK_CONFIG))
      .catch(() => setConfig((prev) => prev || FALLBACK_CONFIG));
    load();
    return startVisiblePolling(load, 5 * 60 * 1000);
  }, [allowed]);

  // Si el chat está apagado, abrir en otra pestaña
  useEffect(() => {
    if (!config) return;
    setActiveTab((tab) => {
      if (tab === 'hablar' && !chatOn) return gamesOn ? 'cuidados' : 'concorde';
      if ((tab === 'cuidados' || tab === 'inventario') && !gamesOn) return chatOn ? 'hablar' : 'concorde';
      return tab;
    });
  }, [config, chatOn, gamesOn]);

  // --- Persistencia local ---
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(petData)); } catch { /* sin almacenamiento */ }
  }, [petData]);

  // Racha diaria
  useEffect(() => {
    const today = todayKey();
    setPetData((prev) => {
      if (prev.lastVisit === today) return prev;
      const yesterday = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
      return { ...prev, lastVisit: today, streak: prev.lastVisit === yesterday ? prev.streak + 1 : 1 };
    });
  }, []);

  // XP por tickets resueltos (solo el incremento observado)
  const initializedResolvedRef = useRef(false);
  useEffect(() => {
    if (!initializedResolvedRef.current) {
      initializedResolvedRef.current = true;
      setPetData((prev) => (prev.lastRewardedResolved !== 0 || resolvedTickets === 0 ? prev : { ...prev, lastRewardedResolved: resolvedTickets }));
      return;
    }
    setPetData((prev) => {
      const delta = Math.max(0, resolvedTickets - Number(prev.lastRewardedResolved || 0));
      if (!delta) return prev;
      return { ...prev, xp: prev.xp + delta * 10, coins: prev.coins + delta * 3, happiness: clamp(prev.happiness + delta * 2, 0, 100), lastRewardedResolved: resolvedTickets };
    });
  }, [resolvedTickets]);

  // --- Acciones visuales ---
  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const showAction = useCallback((nextMood, message, duration = 4000) => {
    window.clearTimeout(actionTimeoutRef.current);
    setMood(nextMood);
    setDialog(message);
    talkingUntil.current = Date.now() + Math.min(4000, (message || '').length * 45);
    actionTimeoutRef.current = window.setTimeout(() => {
      const s = live.current;
      if (s.sleepMode) return;
      if (s.alertsOn && s.isCritical) {
        setMood('panic');
        setDialog(`🚨 ${s.openTickets} tickets activos.`);
      } else {
        setMood('idle');
        setDialog('');
      }
    }, duration);
  }, []);

  const moveRandom = useCallback((range = 160) => {
    setPos((prev) => ({
      x: clamp(prev.x + (Math.random() * range * 2 - range), 8, Math.max(8, window.innerWidth - SIZE - 8)),
      y: clamp(prev.y + (Math.random() * range - range / 2), 60, Math.max(60, window.innerHeight - SIZE - 40)),
    }));
  }, []);

  // Aplica lo que decidió la IA (estado de ánimo + acción)
  const applyReply = useCallback(({ reply, mood: m, action }) => {
    if (action === 'sleep') {
      setSleepMode(true);
      setMood('sleep');
      setDialog(reply);
      return;
    }
    if (action === 'walk' && live.current.walkOn) moveRandom(120);
    if (action === 'alert') return showAction('panic', reply, 6000);
    if (action === 'celebrate') return showAction('celebrate', reply, 5000);
    showAction(m === 'panic' && !live.current.isCritical ? 'talking' : (m || 'talking'), reply, Math.max(4000, reply.length * 70));
  }, [moveRandom, showAction]);

  const askPet = useCallback(async (message, mode = 'chat') => {
    if (live.current.thinking) return;
    setThinking(true);
    setSleepMode(false);
    if (mode === 'chat') {
      setChat((prev) => [...prev.slice(-10), { from: 'user', text: message }]);
      setMood('thinking');
      setDialog('Pensando…');
    }
    try {
      const res = await crmApi.post('/pet/talk', { message, mode });
      const data = res.data?.data;
      if (!data?.reply) throw new Error('sin respuesta');
      if (mode === 'chat') setChat((prev) => [...prev.slice(-10), { from: 'pet', text: data.reply, source: data.source, consultas: data.consultas }]);
      applyReply(data);
    } catch (err) {
      const msg = err.response?.data?.error || 'No pude conectarme ahora 😵‍💫';
      if (mode === 'chat') {
        setChat((prev) => [...prev.slice(-10), { from: 'pet', text: msg, source: 'error' }]);
        showAction('tired', msg);
      }
    } finally {
      setThinking(false);
    }
  }, [applyReply, showAction]);

  // Comentarios espontáneos (IA o frases fijas) cada N minutos, solo con la pestaña visible
  useEffect(() => {
    const minutes = config?.proactive_minutes || 0;
    if (!config?.enabled || minutes <= 0) return undefined;
    return startVisiblePolling(() => {
      const s = live.current;
      if (s.isMenuOpen || s.sleepMode || s.isDragging || s.thinking) return;
      askPet('', 'tip');
    }, minutes * 60 * 1000);
  }, [config, askPet]);

  // Necesidades del minijuego
  useEffect(() => {
    if (!gamesOn) return undefined;
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      setPetData((prev) => ({
        ...prev,
        hunger: clamp(prev.hunger - 1, 0, 100),
        happiness: clamp(prev.happiness - (prev.hunger < 20 ? 2 : 0.5), 0, 100),
        energy: live.current.sleepMode ? clamp(prev.energy + 2, 0, 100) : clamp(prev.energy - 0.5, 0, 100),
        cleanliness: clamp(prev.cleanliness - 0.25, 0, 100),
      }));
    }, 60000);
    return () => window.clearInterval(interval);
  }, [gamesOn]);

  // Personalidad local (sin IA): alertas, necesidades y paseos
  useEffect(() => {
    const brain = window.setInterval(() => {
      if (document.hidden) return;
      const s = live.current;
      if (s.isDragging || s.isMenuOpen || s.sleepMode || s.thinking) return;
      if (['love', 'coffee', 'celebrate', 'thinking'].includes(s.mood) || Date.now() < talkingUntil.current) return;

      if (s.alertsOn && s.isCritical) {
        setMood('panic');
        setDialog(`🚨 ¡Carga crítica! ${s.openTickets} tickets activos.`);
        return;
      }
      if (s.gamesOn && s.petData.hunger < 25) { setMood('hungry'); setDialog('Tengo hambre de datos… ¿me das un snack?'); return; }
      if (s.gamesOn && s.petData.energy < 15) { setMood('tired'); setDialog('Necesito recargar combustible. ¿Una siesta?'); return; }
      if (s.alertsOn && s.myPending > 0 && Math.random() < 0.15) {
        setMood('talking');
        setDialog(`Tienes ${s.myPending} ticket(s) esperándote 📋`);
        return;
      }
      const roll = Math.random();
      if (s.walkOn && roll < 0.3) {
        setMood('walk');
        setDialog('');
        moveRandom(140);
      } else {
        setMood('idle');
        setDialog('');
      }
    }, 9000);
    return () => window.clearInterval(brain);
  }, [moveRandom]);

  // Parpadeo y boca al hablar
  useEffect(() => {
    if (petData.reducedMotion) return undefined;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const talking = Date.now() < talkingUntil.current || live.current.mood === 'talking';
      setMouthOpen(talking ? Math.random() > 0.4 : false);
      if (Math.random() < 0.06) {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
      }
    }, 180);
    return () => window.clearInterval(timer);
  }, [petData.reducedMotion]);

  // Ojos que siguen el cursor (con requestAnimationFrame para no saturar)
  const posRef = useRef(pos);
  posRef.current = pos;
  useEffect(() => {
    if (petData.reducedMotion) return undefined;
    let frame = null;
    let last = null;
    const onMove = (e) => {
      last = e;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const cx = posRef.current.x + SIZE / 2;
        const cy = posRef.current.y + SIZE / 2;
        const dx = last.clientX - cx;
        const dy = last.clientY - cy;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const next = { x: Math.round((dx / dist) * 10) / 10, y: Math.round((dy / dist) * 10) / 10 };
        setLook((prev) => (prev.x === next.x && prev.y === next.y ? prev : next));
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [petData.reducedMotion]);

  useEffect(() => () => window.clearTimeout(actionTimeoutRef.current), []);

  useEffect(() => {
    const resize = () => setPos((prev) => ({
      x: clamp(prev.x, 8, Math.max(8, window.innerWidth - SIZE - 8)),
      y: clamp(prev.y, 8, Math.max(8, window.innerHeight - SIZE - 30)),
    }));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (activeTab === 'hablar') chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [chat, activeTab, isMenuOpen]);

  // --- Acciones del menú ---
  const handleAction = (type) => {
    if (type === 'report') {
      setIsMenuOpen(false);
      setShowStats(true);
      showAction('talking', `📊 ${openTickets} activos · ${resolvedTickets} resueltos · ${myPending} tuyos.`);
      return;
    }
    if (type === 'sleep_toggle') {
      setIsMenuOpen(false);
      if (sleepMode) {
        setSleepMode(false);
        setPetData((p) => ({ ...p, energy: clamp(p.energy + 5, 0, 100) }));
        showAction('idle', '¡Motores encendidos! ☀️');
      } else {
        setSleepMode(true);
        setMood('sleep');
        setDialog('Zzz… cargando combustible');
      }
      return;
    }
    if (type === 'feed') {
      if (petData.coins < 5) { showAction('hungry', 'Me faltan 5 monedas para el snack.'); return; }
      setPetData((p) => ({ ...p, coins: p.coins - 5, hunger: clamp(p.hunger + 35, 0, 100), happiness: clamp(p.happiness + 8, 0, 100), xp: p.xp + 2 }));
      setSleepMode(false);
      showAction('love', '¡Ñam! Snack de datos 🍪 +2 XP');
      return;
    }
    if (type === 'play') {
      if (petData.energy < 12) { showAction('tired', 'Estoy agotado. ¡Primero una siesta!'); return; }
      setPetData((p) => ({ ...p, happiness: clamp(p.happiness + 18, 0, 100), energy: clamp(p.energy - 8, 0, 100), hunger: clamp(p.hunger - 5, 0, 100), coins: p.coins + 1, xp: p.xp + 5 }));
      setSleepMode(false);
      showAction('celebrate', '¡Looping perfecto! +5 XP y +1 moneda 🎾');
      return;
    }
    if (type === 'clean') {
      setPetData((p) => ({ ...p, cleanliness: 100, happiness: clamp(p.happiness + 6, 0, 100), xp: p.xp + 3 }));
      showAction('love', '¡Brillo de fuselaje nuevo! ✨');
      return;
    }
    if (type === 'pet') {
      setPetData((p) => ({ ...p, happiness: clamp(p.happiness + 12, 0, 100), xp: p.xp + 1 }));
      setSleepMode(false);
      showAction('love', '¡Gracias por el cariño! ♥');
      return;
    }
    if (type === 'coffee') {
      setPetData((p) => ({ ...p, energy: clamp(p.energy + 15, 0, 100), happiness: clamp(p.happiness + 4, 0, 100) }));
      setSleepMode(false);
      showAction('coffee', '¡CAFÉ DE DEPURACIÓN! ☕', 3000);
      if (walkOn) moveRandom(90);
      return;
    }
    if (type === 'daily') {
      if (petData.lastDailyClaim === todayKey()) { showAction('talking', 'La recompensa diaria ya está reclamada. ¡Vuelve mañana!'); return; }
      setPetData((p) => ({ ...p, coins: p.coins + 15, xp: p.xp + 10, happiness: clamp(p.happiness + 10, 0, 100), lastDailyClaim: todayKey() }));
      showAction('celebrate', '¡Recompensa diaria! +15 monedas · +10 XP 🎁');
      return;
    }
    if (type === 'mission') {
      if (petData.lastMissionClaim === todayKey()) { showAction('talking', 'Misión de hoy completada. ¡Mañana hay otra!'); return; }
      if (resolvedTickets < 1) { showAction('talking', 'Resuelve al menos un ticket para completar la misión.'); return; }
      setPetData((p) => ({ ...p, coins: p.coins + 20, xp: p.xp + 20, happiness: clamp(p.happiness + 12, 0, 100), lastMissionClaim: todayKey() }));
      showAction('celebrate', 'Misión cumplida: +20 monedas y +20 XP 🏆');
      return;
    }
    if (type === 'patrol') {
      setIsMenuOpen(false);
      setSleepMode(false);
      moveRandom(200);
      showAction('walk', '¡Patrullando el tablero de Concorde!');
      return;
    }
    if (type === 'motion_toggle') {
      setPetData((p) => ({ ...p, reducedMotion: !p.reducedMotion }));
      notify(petData.reducedMotion ? 'Animaciones activadas.' : 'Movimiento reducido activado.');
      return;
    }
    if (type === 'reset') {
      if (window.confirm('¿Reiniciar el progreso de la mascota? No se modifican los tickets de Concorde.')) {
        setPetData(defaultPetData());
        setSleepMode(false);
        showAction('idle', 'Nueva aventura iniciada. ¡Despegamos!');
      }
    }
  };

  const buyOrEquip = (item) => {
    const owned = petData.inventory.includes(item.id);
    if (owned) {
      setPetData((p) => ({ ...p, equipped: item.id }));
      notify(`${item.name} equipado.`);
    } else if (petData.coins >= item.price) {
      setPetData((p) => ({ ...p, coins: p.coins - item.price, inventory: [...p.inventory, item.id], equipped: item.id, xp: p.xp + 5 }));
      notify(`${item.name} desbloqueado. +5 XP`);
    } else {
      notify('No tienes suficientes monedas.');
    }
  };

  const sendChat = (text) => {
    if (text && TEMPLATES[text]) {
      setChatInput(TEMPLATES[text]); // plantilla: el usuario completa el nombre o número
      return;
    }
    const msg = (text ?? chatInput).trim();
    if (!msg || thinking) return;
    setChatInput('');
    askPet(msg, 'chat');
  };

  if (!allowed || !config || !config.enabled) return null;

  const displayMood = sleepMode ? 'sleep' : (thinking ? 'thinking' : mood);
  const animation = petData.reducedMotion ? 'none'
    : displayMood === 'panic' ? 'cpPanic .25s infinite'
    : displayMood === 'walk' ? 'cpWalk .6s infinite'
    : displayMood === 'love' || displayMood === 'celebrate' ? 'cpBounce .7s infinite'
    : displayMood === 'sleep' ? 'cpSleep 2.4s infinite'
    : !isDragging ? 'cpFloat 3.2s ease-in-out infinite' : 'none';

  const bar = (label, value, color) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
        <span>{label}</span><span>{Math.round(value)}%</span>
      </div>
      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${clamp(value, 0, 100)}%`, height: '100%', background: color, transition: 'width .25s' }} />
      </div>
    </div>
  );

  const tabs = [
    chatOn && { id: 'hablar', label: '💬 Hablar' },
    gamesOn && { id: 'cuidados', label: '❤️ Cuidados' },
    { id: 'concorde', label: '📊 Concorde' },
    gamesOn && { id: 'inventario', label: '🎒 Objetos' },
  ].filter(Boolean);

  return (
    <>
      <style>{`
        @keyframes cpFloat { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-5px) rotate(-2deg); } }
        @keyframes cpWalk { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-6px) rotate(3deg); } }
        @keyframes cpPanic { 0% { transform: translate(2px,1px); } 25% { transform: translate(-2px,-1px); } 50% { transform: translate(1px,-2px); } 75% { transform: translate(-1px,2px); } 100% { transform: translate(2px,1px); } }
        @keyframes cpBounce { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-10px) scale(1.05); } }
        @keyframes cpSleep { 0%,100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
        @keyframes cpWingF { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-14deg); } }
        @keyframes cpWingB { 0%,100% { transform: rotate(0); } 50% { transform: rotate(10deg); } }
        @keyframes cpFx { 0%,100% { transform: translateY(0); opacity: .7; } 50% { transform: translateY(-5px); opacity: 1; } }
        @keyframes cpDot { 0%,100% { opacity: .25; } 50% { opacity: 1; } }
        .pet-wing-front { animation: cpWingF .35s ease-in-out infinite; }
        .pet-wing-back { animation: cpWingB .35s ease-in-out infinite; }
        .pet-float-fx { animation: cpFx 1.4s ease-in-out infinite; }
        .pet-dot { animation: cpDot .9s ease-in-out infinite; }
        .cp-panel { font-family: 'Inter','Segoe UI',system-ui,sans-serif; }
        .cp-btn { background:#fff; border:1px solid #d1d5db; border-radius:8px; padding:7px 9px; font-weight:600; cursor:pointer; font-size:12px; width:100%; text-align:left; margin-bottom:5px; color:#111; transition: background .15s; }
        .cp-btn:hover { background:#f3f4f6; }
        .cp-tab { border:none; background:transparent; padding:6px 4px; font-size:11px; cursor:pointer; flex:1; border-radius:6px; color:#374151; font-weight:600; }
        .cp-tab.active { background:#111; color:#FFD700; }
        .cp-chip { font-size:10px; border-radius:999px; padding:3px 7px; background:#f3f4f6; color:#111; font-weight:600; }
        .cp-sugg { font-size:10px; border:1px solid #d1d5db; border-radius:999px; padding:3px 8px; background:#fff; cursor:pointer; }
        .cp-sugg:hover { background:#fef3c7; }
        @media (prefers-reduced-motion: reduce) { .pet-wing-front, .pet-wing-back, .pet-float-fx, .pet-dot { animation: none !important; } }
      `}</style>

      <div style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        transition: isDragging ? 'none' : 'left 1.4s cubic-bezier(.45,.05,.3,1), top 1.4s cubic-bezier(.45,.05,.3,1)',
        touchAction: 'none', userSelect: 'none',
      }}>
        {dialog && !isMenuOpen && (
          <div className="cp-panel" style={{
            background: '#fff', border: '2px solid #111', padding: '7px 10px', fontSize: 12, color: '#111',
            marginBottom: 6, borderRadius: 12, boxShadow: '3px 3px 0 rgba(0,0,0,.15)', width: 'max-content',
            maxWidth: 230, textAlign: 'center', position: 'relative', pointerEvents: 'none', lineHeight: 1.4,
          }}>
            {dialog}
            <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 9, height: 9, background: '#fff', borderRight: '2px solid #111', borderBottom: '2px solid #111' }} />
          </div>
        )}

        {showStats && gamesOn && !isMenuOpen && (
          <div style={{ background: 'rgba(17,17,17,.85)', color: '#fff', padding: '3px 8px', marginBottom: 4, borderRadius: 8, font: '10px monospace', textAlign: 'center' }}>
            {alertsOn && <div style={{ color: ticketHealth.color, fontWeight: 'bold' }}>● {ticketHealth.label}</div>}
            <div>LVL {level} · {xpInLevel}/100 XP</div>
          </div>
        )}

        <div
          onPointerDown={(e) => {
            e.preventDefault();
            draggedRef.current = false;
            pointerStart.current = { x: e.clientX, y: e.clientY };
            dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
            setIsDragging(true);
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
          }}
          onPointerMove={(e) => {
            if (!isDragging) return;
            if (Math.abs(e.clientX - pointerStart.current.x) + Math.abs(e.clientY - pointerStart.current.y) > 5) draggedRef.current = true;
            if (draggedRef.current) {
              setPos({
                x: clamp(e.clientX - dragOffset.current.x, 4, Math.max(4, window.innerWidth - SIZE)),
                y: clamp(e.clientY - dragOffset.current.y, 4, Math.max(4, window.innerHeight - SIZE)),
              });
            }
          }}
          onPointerUp={() => {
            setIsDragging(false);
            if (!draggedRef.current) setIsMenuOpen((v) => !v);
            else notify('¡Nueva pista de aterrizaje!');
          }}
          onPointerCancel={() => setIsDragging(false)}
          role="button"
          tabIndex={0}
          aria-label="Mascota Concorde. Arrastra para mover o pulsa para abrir el menú."
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsMenuOpen((v) => !v); }}
          title="Arrástrame · clic para hablar conmigo"
          style={{ cursor: isDragging ? 'grabbing' : 'grab', animation, filter: 'drop-shadow(2px 4px 3px rgba(0,0,0,.25))' }}
        >
          <PetAvatar
            mood={displayMood}
            look={look}
            blink={blink}
            mouthOpen={mouthOpen}
            accessory={gamesOn ? petData.equipped : 'default'}
            size={SIZE}
            reducedMotion={petData.reducedMotion}
          />
        </div>
        <div style={{ width: 44, height: 6, background: 'rgba(0,0,0,.15)', borderRadius: '50%', marginTop: 2, pointerEvents: 'none' }} />
        {toast && <div className="cp-panel" style={{ marginTop: 5, background: '#111', color: '#FFD700', padding: '4px 8px', borderRadius: 8, fontSize: 11, whiteSpace: 'nowrap' }}>{toast}</div>}
      </div>

      {isMenuOpen && (
        <div className="cp-panel" style={{
          position: 'fixed',
          top: clamp(pos.y - 120, 8, Math.max(8, window.innerHeight - 470)),
          left: clamp(pos.x - 270, 8, Math.max(8, window.innerWidth - 268)),
          zIndex: 10000, background: '#fff', border: '2px solid #111', borderRadius: 14,
          width: 260, maxHeight: 460, display: 'flex', flexDirection: 'column',
          boxShadow: '5px 5px 0 rgba(0,0,0,.18)', color: '#111', overflow: 'hidden',
        }}>
          <div style={{ background: '#111', color: '#FFD700', padding: '8px 10px', fontWeight: 900, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>✈ CONCORDE {config.ai_enabled ? <span style={{ fontSize: 9, background: '#FFD700', color: '#111', borderRadius: 999, padding: '1px 6px', marginLeft: 4 }}>IA</span> : null}</span>
            <button onClick={() => setIsMenuOpen(false)} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ display: 'flex', gap: 2, padding: 6, borderBottom: '1px solid #eee' }}>
            {tabs.map((t) => (
              <button key={t.id} className={`cp-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>

          <div style={{ padding: 10, overflowY: 'auto', flex: 1 }}>
            {gamesOn && activeTab !== 'hablar' && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                <span className="cp-chip">⭐ Nivel {level}</span>
                <span className="cp-chip">🪙 {petData.coins}</span>
                <span className="cp-chip">🔥 Racha {petData.streak}</span>
              </div>
            )}

            {activeTab === 'hablar' && chatOn && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {!config.ai_enabled && (
                  <div style={{ fontSize: 10, background: '#fef3c7', borderRadius: 8, padding: 6 }}>
                    La IA está apagada{config.ai_available ? ' en Configuración' : ' (falta la llave del AI Gateway)'}: respondo con datos fijos.
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 120, maxHeight: 220, overflowY: 'auto' }}>
                  {chat.length === 0 && <div style={{ fontSize: 11, color: '#6b7280' }}>Pregúntame por un cliente, un número de ticket, sus métricas o cómo va el día. Solo consulto, no modifico nada.</div>}
                  {chat.map((m, i) => (
                    <div key={i} style={{
                      alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%',
                      background: m.from === 'user' ? '#111' : (m.source === 'error' ? '#fee2e2' : '#f3f4f6'),
                      color: m.from === 'user' ? '#fff' : '#111', borderRadius: 10, padding: '6px 9px', fontSize: 12, lineHeight: 1.35,
                    }}>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                      {m.consultas?.length > 0 && (
                        <div style={{ fontSize: 9, color: '#6b7280', marginTop: 3 }}>
                          🔎 Consultó: {[...new Set(m.consultas)].map((c) => TOOL_LABELS[c] || c).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                  {thinking && <div style={{ fontSize: 11, color: '#6366f1' }}>Concorde está pensando…</div>}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {SUGGESTIONS.map((s) => <button key={s} className="cp-sugg" disabled={thinking} onClick={() => sendChat(s)}>{s}</button>)}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} style={{ display: 'flex', gap: 4 }}>
                  <input
                    value={chatInput} onChange={(e) => setChatInput(e.target.value)} maxLength={400}
                    placeholder="Escríbele a Concorde…" disabled={thinking}
                    style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}
                  />
                  <button type="submit" disabled={thinking || !chatInput.trim()} style={{ background: '#111', color: '#FFD700', border: 'none', borderRadius: 8, padding: '0 10px', fontWeight: 900, cursor: 'pointer' }}>➤</button>
                </form>
              </div>
            )}

            {activeTab === 'cuidados' && gamesOn && (
              <>
                {bar('Hambre', petData.hunger, '#f59e0b')}
                {bar('Felicidad', petData.happiness, '#ec4899')}
                {bar('Energía', petData.energy, '#38bdf8')}
                {bar('Brillo', petData.cleanliness, '#22c55e')}
                <div style={{ height: 6 }} />
                <button className="cp-btn" onClick={() => handleAction('feed')}>🍪 Dar snack (5 monedas)</button>
                <button className="cp-btn" onClick={() => handleAction('play')}>🎾 Jugar (+XP)</button>
                <button className="cp-btn" onClick={() => handleAction('clean')}>🧽 Pulir el fuselaje</button>
                <button className="cp-btn" onClick={() => handleAction('pet')}>🖐️ Acariciar</button>
                <button className="cp-btn" onClick={() => handleAction('coffee')}>☕ Café de depuración</button>
                <button className="cp-btn" onClick={() => handleAction('sleep_toggle')}>{sleepMode ? '☀️ Despertar' : '💤 Dormir / recargar'}</button>
              </>
            )}

            {activeTab === 'concorde' && (
              <>
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: 8, marginBottom: 8, fontSize: 11, lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 'bold', color: ticketHealth.color }}>● {ticketHealth.label}</div>
                  <div>Tickets activos: <b>{openTickets}</b></div>
                  <div>Tickets resueltos: <b>{resolvedTickets}</b></div>
                  <div>Tickets en tu lista: <b>{myPending}</b></div>
                </div>
                <button className="cp-btn" onClick={() => handleAction('report')}>📊 Reporte rápido</button>
                {chatOn && <button className="cp-btn" disabled={thinking} onClick={() => { setActiveTab('hablar'); sendChat('Dame un resumen de cómo vamos hoy'); }}>🧠 Resumen con IA</button>}
                {walkOn && <button className="cp-btn" onClick={() => handleAction('patrol')}>🔍 Patrullar el tablero</button>}
                {gamesOn && <button className="cp-btn" onClick={() => handleAction('mission')}>🏆 Reclamar misión diaria</button>}
                {gamesOn && <button className="cp-btn" onClick={() => handleAction('daily')}>🎁 Recompensa diaria</button>}
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>Concorde solo lee datos: no crea, modifica ni cierra tickets.</div>
              </>
            )}

            {activeTab === 'inventario' && gamesOn && (
              <>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>Desbloquea accesorios con monedas.</div>
                {SHOP.map((item) => {
                  const owned = petData.inventory.includes(item.id);
                  const equipped = petData.equipped === item.id;
                  return (
                    <button key={item.id} className="cp-btn" onClick={() => buyOrEquip(item)}
                      style={equipped ? { background: '#fef3c7', borderColor: '#f59e0b' } : undefined}>
                      {equipped ? '✓ ' : ''}{item.name} {owned ? (equipped ? '(equipado)' : '— equipar') : `— ${item.price} 🪙`}
                    </button>
                  );
                })}
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 4, padding: 6, borderTop: '1px solid #eee', fontSize: 10 }}>
            {gamesOn && <button className="cp-sugg" onClick={() => setShowStats((v) => !v)}>{showStats ? 'Ocultar HUD' : 'Mostrar HUD'}</button>}
            <button className="cp-sugg" onClick={() => handleAction('motion_toggle')}>{petData.reducedMotion ? 'Animar' : 'Menos movimiento'}</button>
            {gamesOn && <button className="cp-sugg" onClick={() => handleAction('reset')}>Reiniciar</button>}
          </div>
        </div>
      )}
    </>
  );
};

export default ConcordePet;
