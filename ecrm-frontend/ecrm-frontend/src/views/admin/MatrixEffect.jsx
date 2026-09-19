import React, { useEffect, useRef } from 'react';

const MatrixEffect = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Hacer que el canvas ocupe toda la pantalla
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Caracteres a utilizar (letras, números y símbolos)
    const matrix = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%+-/~{[|`]}';
    const characters = matrix.split('');

    const fontSize = 16;
    const columns = canvas.width / fontSize;

    // Arreglo para rastrear la posición Y de cada gota
    const drops = [];
    for (let x = 0; x < columns; x++) {
      drops[x] = 1;
    }

    const draw = () => {
      // Fondo translúcido para crear el rastro de la cascada
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0F0'; // Color verde clásico de Matrix
      ctx.font = fontSize + 'px monospace';

      for (let i = 0; i < drops.length; i++) {
        const text = characters[Math.floor(Math.random() * characters.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        // Reiniciar la gota al principio aleatoriamente cuando sale de la pantalla
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    // Velocidad de la cascada
    const interval = setInterval(draw, 33);

    // Ajustar si el usuario cambia el tamaño de la ventana
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999, // Asegura que cubra todos los componentes
        backgroundColor: '#000',
        pointerEvents: 'none' // Evita que bloquee clics accidentales si intentan refrescar con F5
      }}
    />
  );
};

export default MatrixEffect;