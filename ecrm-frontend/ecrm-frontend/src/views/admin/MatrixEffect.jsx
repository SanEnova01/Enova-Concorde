import React, { useEffect, useRef, useState } from 'react';

const MatrixEffect = ({ targetRef }) => {
  const canvasRef = useRef(null);
  const [words, setWords] = useState([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!targetRef?.current) return;

    // 1. Extraer texto SOLO del dashboard (ignora el navbar)
    const text = targetRef.current.innerText;
    // Limpiar texto y sacar palabras de más de 3 letras (nombres de clientes, métricas, etc.)
    const extractedWords = text.split(/[\s\n]+/).filter(w => w.trim().length > 3);
    setWords(extractedWords.length > 0 ? extractedWords : ['ERROR', 'SISTEMA']);

    // 2. Medir el dashboard para que la lluvia solo cubra esa zona
    const rect = targetRef.current.getBoundingClientRect();
    setDimensions({ width: rect.width, height: targetRef.current.scrollHeight });
  }, [targetRef]);

  useEffect(() => {
    if (words.length === 0 || dimensions.width === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const fontSize = 16;
    const columnWidth = fontSize * 8; // Espacio para que quepan las palabras
    const columns = Math.floor(canvas.width / columnWidth);

    // Iniciar las "gotas" en posiciones Y negativas aleatorias para un inicio más natural
    const drops = Array(columns).fill(0).map(() => Math.random() * -50);

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; // Fondo para dejar rastro
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0F0';
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';

      for (let i = 0; i < drops.length; i++) {
        if (drops[i] > 0) {
          // Escoger una palabra aleatoria de las que sacó de tu web
          const word = words[Math.floor(Math.random() * words.length)];
          ctx.fillText(word, i * columnWidth + (columnWidth / 2), drops[i] * fontSize);
        }

        // Reiniciar cuando llega abajo
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.95) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 50); // Velocidad de Matrix
    return () => clearInterval(interval);
  }, [words, dimensions]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', // Absolute para que se confine dentro del contenedor padre
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 99999,
        backgroundColor: '#000',
        pointerEvents: 'none'
      }}
    />
  );
};

export default MatrixEffect;