import React from 'react';

// 🌟 SUBCOMPONENTE: Contador estilo Odómetro Analógico Claro (Blanco con texto Negro)
const AnalogOdometer = ({ value, digits = 5 }) => {
  const paddedValue = String(value).padStart(digits, '0');

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center',
      width: '100%',
      boxSizing: 'border-box',
      gap: '3px', 
      backgroundColor: '#e5e5e5',
      padding: '5px 6px', 
      borderRadius: '6px', 
      border: '1px solid #cccccc',
      boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0,0,0,0.05)'
    }}>
      {paddedValue.split('').map((digit, index) => (
        <div key={index} style={{
          backgroundColor: '#ffffff',
          color: '#111111',
          fontSize: '26px',
          fontWeight: 'bold',
          fontFamily: "'Courier New', Courier, monospace",
          padding: '2px 7px',
          borderRadius: '3px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.9)',
          background: 'linear-gradient(180deg, #f8f8f8 0%, #ffffff 40%, #ffffff 60%, #ececec 100%)',
          textAlign: 'center',
          minWidth: '20px',
          border: '1px solid #cfcfcf'
        }}>
          {digit}
        </div>
      ))}
    </div>
  );
};

export default AnalogOdometer;
