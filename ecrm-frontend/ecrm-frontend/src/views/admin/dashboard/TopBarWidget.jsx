import React, { useState, useEffect } from 'react';

// 🌟 SUBCOMPONENTE: Zonas Horarias, Fecha y Clima Local
const TopBarWidget = () => {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState({ temp: '--', status: 'Cargando...' });

  useEffect(() => {
    // El reloj muestra horas y minutos: basta con actualizar cada 10 s, y no con la pestaña oculta
    const timer = setInterval(() => { if (!document.hidden) setTime(new Date()); }, 10000);
    
    fetch('https://api.open-meteo.com/v1/forecast?latitude=-12.0432&longitude=-77.0282&current_weather=true')
      .then(res => res.json())
      .then(data => {
        if (data && data.current_weather) {
          setWeather({
            temp: data.current_weather.temperature,
            status: 'Despejado'
          });
        }
      })
      .catch(() => setWeather({ temp: '--', status: 'Offline' }));

    return () => clearInterval(timer);
  }, []);

  const dateString = time.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();

  const timeZones = [
    { label: 'PERÚ', tz: 'America/Lima' },
    { label: 'EE.UU (EST)', tz: 'America/New_York' },
    { label: 'EUR (CET)', tz: 'Europe/Madrid' },
    { label: 'ASIA (JST)', tz: 'Asia/Tokyo' }
  ];

  return (
    <div style={{ 
      display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap',
      backgroundColor: '#ffffff', padding: '8px 16px', 
      borderRadius: '8px', border: '1px solid #c8c6c1', 
      boxShadow: '0 2px 4px rgba(0,0,0,0.02)', fontFamily: "'Nunito', system-ui, sans-serif" 
    }}>
      <div style={{ display: 'flex', gap: '16px' }}>
        {timeZones.map((z, i) => (
          <div key={i} style={{ textAlign: 'center', lineHeight: '1.2' }}>
            <span style={{ fontSize: '9px', fontWeight: '900', color: '#666666', letterSpacing: '0.5px' }}>{z.label}</span><br/>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#111111' }}>
              {time.toLocaleTimeString('es-PE', { timeZone: z.tz, hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>

      <div style={{ width: '1px', height: '28px', backgroundColor: '#e5e5e5' }}></div>

      <div style={{ textAlign: 'center', lineHeight: '1.2' }}>
        <span style={{ fontSize: '9px', fontWeight: '900', color: '#666666', letterSpacing: '0.5px' }}>FECHA</span><br/>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#111111' }}>{dateString}</span>
      </div>

      <div style={{ width: '1px', height: '28px', backgroundColor: '#e5e5e5' }}></div>

      <div style={{ lineHeight: '1.2', textAlign: 'center' }}>
        <span style={{ fontSize: '9px', fontWeight: '900', color: '#666666', letterSpacing: '0.5px' }}>LIMA, PE</span><br/>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#111111' }}>{weather.temp}°C</span>
          <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 'bold', marginLeft: '6px' }}>● {weather.status}</span>
        </div>
      </div>
    </div>
  );
};

export default TopBarWidget;
