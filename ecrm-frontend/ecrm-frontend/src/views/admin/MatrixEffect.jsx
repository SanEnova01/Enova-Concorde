import React, { useEffect, useRef } from 'react';

const MatrixEffect = ({ targetRef }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!targetRef?.current) return;
    
    const container = targetRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Extraer texto seguro directamente del DOM (ignora el Navbar si está fuera)
    const text = container.textContent || '';
    const words = text.split(/[\s\n]+/).filter(w => w.trim().length > 3);
    const finalWords = words.length > 0 ? words : ['SISTEMA', 'CRITICO', 'ANALIZANDO'];

    // Forzar tamaño exacto del contenedor actual
    const resizeCanvas = () => {
      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;
    };
    resizeCanvas();

    const fontSize = 16;
    const columnWidth = fontSize * 8; 
    const columns = Math.floor(canvas.width / columnWidth) || 1;
    
    const drops = Array(columns).fill(0).map(() => Math.random() * -50);

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; // Rastro
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0F0';
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';

      for (let i = 0; i < drops.length; i++) {
        if (drops[i] > 0) {
          const word = finalWords[Math.floor(Math.random() * finalWords.length)];
          ctx.fillText(word, i * columnWidth + (columnWidth / 2), drops[i] * fontSize);
        }

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.95) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 50);
    
    window.addEventListener('resize', resizeCanvas);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [targetRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 9999,
        backgroundColor: '#000',
        pointerEvents: 'none'
      }}
    />
  );
};

export default MatrixEffect;