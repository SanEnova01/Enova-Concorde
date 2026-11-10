// Polling que se pausa cuando la pestaña no está visible y se pone al día al volver.
// Evita que pestañas olvidadas sigan consultando al backend (una de las causas del 429).
// Devuelve una función para detenerlo (usar en el cleanup del useEffect).
export function startVisiblePolling(fn, intervalMs) {
  let timer = null;
  let lastRun = Date.now();

  const tick = () => {
    lastRun = Date.now();
    Promise.resolve(fn()).catch(() => {});
  };

  const start = () => {
    if (timer) return;
    timer = setInterval(tick, intervalMs);
  };

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      // Si los datos quedaron viejos mientras estaba oculta, refrescar al instante
      if (Date.now() - lastRun >= intervalMs) tick();
      start();
    } else {
      stop();
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  if (document.visibilityState === 'visible') start();

  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
