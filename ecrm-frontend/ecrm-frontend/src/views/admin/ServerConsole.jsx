import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
// Cámbialo a la ruta donde realmente lo guardaste:
import ServerConsole from './views/admin/ServerConsole';
const ServerConsole = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (!token) return;

    try {
      const payload = JSON.parse(window.atob(token.split('.')[1]));
      if (payload.role !== 'super admin') return;
    } catch (e) {
      return;
    }

    const backendUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3000' 
      : window.location.origin;

    const socket = io(backendUrl, {
      auth: { token }
    });

    socket.on('connect', () => {
      addLog('SYSTEM', 'info', 'Conexión segura establecida con el núcleo de Concorde.');
    });

    socket.on('server-log', (data) => {
      addLog(data.source, data.type, data.message);
    });

    socket.on('connect_error', (err) => {
      addLog('SYSTEM', 'error', `Fallo de conexión WebSocket: ${err.message}`);
    });

    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };

    ['log', 'warn', 'error'].forEach((method) => {
      console[method] = (...args) => {
        originalConsole[method].apply(console, args);
        const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        addLog('FRONTEND', method, msg);
      };
    });

    // 🌟 EVENT LISTENERS PARA ABRIR/CERRAR LA TERMINAL 🌟
    const handleToggleEvent = () => setIsOpen(prev => !prev);
    
    const handleKeyDown = (e) => {
      // Combinación: Ctrl + \ ó Cmd + \
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('toggle-terminal', handleToggleEvent);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      socket.disconnect();
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      window.removeEventListener('toggle-terminal', handleToggleEvent);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const addLog = (source, type, message) => {
    setLogs((prev) => {
      const newLogs = [...prev, { source, type, message, id: Date.now() + Math.random() }];
      return newLogs.slice(-200); 
    });
  };

  useEffect(() => {
    if (isOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  const token = localStorage.getItem('crm_token');
  if (!token) return null;
  try {
    const payload = JSON.parse(window.atob(token.split('.')[1]));
    if (payload.role !== 'super admin') return null;
  } catch (e) { return null; }

  const getColor = (type, source) => {
    if (type === 'error') return '#ef4444'; 
    if (type === 'warn') return '#f59e0b'; 
    if (source === 'FRONTEND') return '#60a5fa'; 
    return '#10b981'; 
  };

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
      {/* Ventana de Consola */}
      {isOpen && (
        <div style={{
          position: 'absolute', bottom: '10px', right: '10px', width: '600px', height: '400px',
          backgroundColor: 'rgba(0, 0, 0, 0.95)', border: '1px solid #333', borderRadius: '8px',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
        }}>
          <div style={{ backgroundColor: '#111', padding: '8px 12px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>CONCORDE DEVELOPER TERMINAL</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setLogs([])} style={{ backgroundColor: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>CLEAR</button>
              <button onClick={() => setIsOpen(false)} style={{ backgroundColor: 'transparent', color: '#666', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>X</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', fontFamily: '"Courier New", Courier, monospace', fontSize: '12px', color: '#d1d5db', lineHeight: '1.4' }}>
            {logs.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>Esperando eventos del sistema...</div>}
            
            {logs.map((log) => (
              <div key={log.id} style={{ marginBottom: '6px', wordBreak: 'break-all' }}>
                <span style={{ color: '#6b7280', marginRight: '8px' }}>
                  {new Date().toLocaleTimeString()}
                </span>
                <span style={{ 
                  backgroundColor: log.source === 'FRONTEND' ? 'rgba(96, 165, 250, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: log.source === 'FRONTEND' ? '#60a5fa' : '#10b981',
                  padding: '2px 4px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', marginRight: '8px'
                }}>
                  {log.source}
                </span>
                <span style={{ color: getColor(log.type, log.source) }}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerConsole;