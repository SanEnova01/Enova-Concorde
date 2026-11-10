import React from 'react';

// Contador Odómetro Analógico (tamaño reducido)
const SmallAnalogOdometer = ({ value, digits = 4 }) => {
  const paddedValue = String(value).padStart(digits, '0');

  return (
    <div style={{
      display: 'inline-flex',
      gap: '2px',
      backgroundColor: '#e5e5e5',
      padding: '3px 4px',
      borderRadius: '4px',
      border: '1px solid #cccccc',
      boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0,0,0,0.05)'
    }}>
      {paddedValue.split('').map((digit, index) => (
        <div key={index} style={{
          backgroundColor: '#ffffff',
          color: '#111111',
          fontSize: '16px',
          fontWeight: 'bold',
          fontFamily: "'Courier New', Courier, monospace",
          padding: '1px 5px',
          borderRadius: '3px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.9)',
          background: 'linear-gradient(180deg, #f8f8f8 0%, #ffffff 40%, #ffffff 60%, #ececec 100%)',
          textAlign: 'center',
          minWidth: '14px',
          border: '1px solid #cfcfcf'
        }}>
          {digit}
        </div>
      ))}
    </div>
  );
};

export default SmallAnalogOdometer;
