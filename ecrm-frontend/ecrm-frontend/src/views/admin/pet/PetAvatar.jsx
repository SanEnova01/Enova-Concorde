import React from 'react';

// ==========================================
// Mascota Concorde en pixel art (low bit).
// Todo se dibuja sobre una cuadrícula de 20x20 "bits"; cada bit es un cuadrado.
// ==========================================
const GRID = 20;
const U = 6; // tamaño de cada bit en el viewBox (20 * 6 = 120)

// Color base según el estado de ánimo (mismos tonos de la mascota original)
const BASE = {
  idle: '#F59E0B', talking: '#F59E0B', walk: '#F59E0B',
  thinking: '#6366F1', love: '#EC4899', celebrate: '#EC4899',
  panic: '#EF4444', tired: '#60A5FA', hungry: '#EAB308',
  coffee: '#D97706', sleep: '#94A3B8',
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const INK = '#111111';

// Cuerpo (16x15). o = borde, h = brillo, l = claro, b = base, d = sombra, . = vacío
const BODY = [
  '...oooooooooo...',
  '..ohhlllllllbo..',
  '.ohllllllllllbo.',
  'ohlllllllllllbbo',
  'olbbbbbbbbbbbbdo',
  'obbbbbbbbbbbbbdo',
  'obbbbbbbbbbbbbdo',
  'obbbbbbbbbbbbbdo',
  'obbbbbbbbbbbbbdo',
  'obbbbbbbbbbbbbdo',
  'obbbbbbbbbbbbbdo',
  'obbbbbbbbbbbbddo',
  '.obbbbbbbbbbddo.',
  '..oddddddddddo..',
  '...oooooooooo...',
];
const BODY_X = 2; // columna donde empieza el cuerpo en la cuadrícula
const BODY_Y = 4; // fila donde empieza el cuerpo

// Convierte un dibujo de texto en bits. colors: { caracter: color }
function sprite(rows, x0, y0, colors, keyPrefix) {
  const out = [];
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const color = colors[ch];
      if (color) out.push(<rect key={`${keyPrefix}-${r}-${c}`} x={(x0 + c) * U} y={(y0 + r) * U} width={U} height={U} fill={color} />);
    });
  });
  return out;
}

// Un bit suelto en coordenadas de la cuadrícula
const bit = (c, r, color, key) => <rect key={key || `${c}-${r}-${color}`} x={c * U} y={r * U} width={U} height={U} fill={color} />;

// Ojos: columnas 6-7 (izquierdo) y 12-13 (derecho), filas 9-11
function eyes(mood, look, blink) {
  const L = 6;
  const R = 12;
  const top = 9;
  const out = [];
  if (mood === 'sleep' || blink) {
    [L, R].forEach((x) => { out.push(bit(x, top + 2, INK, `e1${x}`), bit(x + 1, top + 2, INK, `e2${x}`)); });
    return out;
  }
  if (mood === 'love') {
    const heart = ['x.x', 'xxx', '.x.'];
    return [...sprite(heart, L - 1, top, { x: '#e11d48' }, 'hl'), ...sprite(heart, R - 1, top, { x: '#e11d48' }, 'hr')];
  }
  const gx = look.x > 0.3 ? 1 : 0; // el brillo se mueve hacia donde mira
  const gy = look.y > 0.3 ? 1 : 0;
  [L, R].forEach((x) => {
    if (mood === 'panic') {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) out.push(bit(x + c, top + r, '#ffffff', `p${x}${r}${c}`));
      out.push(bit(x + gx, top + 1 + gy, INK, `pp${x}`));
      return;
    }
    const startRow = mood === 'tired' ? top + 1 : top; // cansado: párpado a media altura
    for (let r = startRow; r < top + 3; r++) for (let c = 0; c < 2; c++) out.push(bit(x + c, r, INK, `o${x}${r}${c}`));
    if (mood !== 'tired') out.push(bit(x + gx, top + gy, '#ffffff', `g${x}`));
  });
  if (mood === 'tired') {
    out.push(bit(L - 1, top - 1, INK, 'bl1'), bit(L, top - 1, INK, 'bl2'), bit(R + 1, top - 1, INK, 'br1'), bit(R + 2, top - 1, INK, 'br2'));
  }
  return out;
}

// Boca: alrededor de las columnas 8-11, filas 13-14
function mouth(mood, open) {
  const dark = '#7f1d1d';
  const pink = '#f87171';
  if (mood === 'sleep' || mood === 'thinking') return [8, 9, 10, 11].map((c) => bit(c, 14, INK, `m${c}`));
  if (mood === 'panic') return [bit(9, 13, dark, 'p1'), bit(10, 13, dark, 'p2'), bit(9, 14, dark, 'p3'), bit(10, 14, dark, 'p4')];
  if (mood === 'tired') return [bit(8, 14, INK, 't1'), bit(9, 13, INK, 't2'), bit(10, 14, INK, 't3'), bit(11, 13, INK, 't4')];
  if (open || mood === 'talking') {
    return [bit(8, 13, dark, 'o1'), bit(9, 13, dark, 'o2'), bit(10, 13, dark, 'o3'), bit(11, 13, dark, 'o4'),
      bit(8, 14, dark, 'o5'), bit(9, 14, pink, 'o6'), bit(10, 14, pink, 'o7'), bit(11, 14, dark, 'o8')];
  }
  if (mood === 'celebrate' || mood === 'love') {
    return [bit(7, 13, INK, 'c1'), bit(12, 13, INK, 'c2'), bit(8, 14, INK, 'c3'), bit(9, 14, INK, 'c4'), bit(10, 14, INK, 'c5'), bit(11, 14, INK, 'c6')];
  }
  return [bit(8, 13, INK, 's1'), bit(11, 13, INK, 's2'), bit(9, 14, INK, 's3'), bit(10, 14, INK, 's4')];
}

// Accesorios en pixel art (coordenadas de la cuadrícula completa)
const ACCESSORIES = {
  crown: { x: 7, y: 1, rows: ['y.y.y', 'yyryy', 'yyyyy'], colors: { y: '#facc15', r: '#ef4444' } },
  pilot: { x: 4, y: 1, rows: ['..nnnnnnn..', '.nnnnynnnnn', 'nnnnnnnnnnn', 'kkkkkkk....'], colors: { n: '#1e3a8a', y: '#facc15', k: INK } },
  glasses: { x: 5, y: 9, rows: ['kkkk..kkkk', 'kwkkkkkwkk', 'kkkk..kkkk'], colors: { k: INK, w: '#9ca3af' } },
  headphones: {
    x: 0, y: 2,
    rows: [
      '....kkkkkkkkkkkk....', '...k............k...', '..k..............k..',
      '..k..............k..', '.k................k.', '.k................k.',
      'bb................bb', 'bb................bb', 'bb................bb', 'bb................bb',
    ],
    colors: { k: INK, b: '#2563eb' },
  },
};

// Efectos (esquina superior izquierda)
const EFFECTS = {
  sleep: { rows: ['zzz', '..z', '.z.', 'zzz'], colors: { z: '#64748b' } },
  panic: { rows: ['r', 'r', 'r', '.', 'r'], colors: { r: '#dc2626' } },
  love: { rows: ['x.x', 'xxx', '.x.'], colors: { x: '#e11d48' } },
  celebrate: { rows: ['.y.', 'yyy', '.y.'], colors: { y: '#facc15' } },
  hungry: { rows: ['.cc.', 'cdcc', 'ccdc', '.cc.'], colors: { c: '#d97706', d: '#78350f' } },
  coffee: { rows: ['.s.s.', 'kkkkk.', 'kcccckk', 'kwwwk.k', 'kwwwkk.', '.kkk...'], colors: { s: '#94a3b8', w: '#f5f5f4', c: '#78350f', k: INK } },
};

/**
 * Mascota Concorde: pixel art puro (low bit), sin curvas ni extremidades.
 * Las props son las mismas de siempre: mood, look, blink, mouthOpen, accessory, size, reducedMotion.
 */
export default function PetAvatar({
  mood = 'idle', look = { x: 0, y: 0 }, blink = false, mouthOpen = false,
  accessory = 'default', size = 76, reducedMotion = false,
}) {
  const base = BASE[mood] || BASE.idle;
  const bodyColors = {
    o: INK, h: '#ffffff', l: shade(base, 0.35), b: base, d: shade(base, -0.3),
  };
  const acc = ACCESSORIES[accessory];
  const fx = EFFECTS[mood];
  const cheeks = mood === 'love' || mood === 'celebrate' ? '#f472b6' : shade(base, 0.25);

  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${GRID * U} ${GRID * U}`} role="img"
      aria-label={`Mascota Concorde (${mood})`} shapeRendering="crispEdges"
      style={{ overflow: 'visible', display: 'block', imageRendering: 'pixelated' }}
    >
      {sprite(BODY, BODY_X, BODY_Y, bodyColors, 'body')}
      {/* Mejillas */}
      {bit(4, 12, cheeks, 'ck1')}{bit(15, 12, cheeks, 'ck2')}
      {eyes(mood, look, blink)}
      {mouth(mood, mouthOpen)}
      {acc && sprite(acc.rows, acc.x, acc.y, acc.colors, `acc-${accessory}`)}
      {mood === 'thinking' && (
        <g fill="#6366f1">
          {[0, 1, 2].map((i) => (
            <rect key={i} x={i * 2 * U} y={2 * U} width={U} height={U} className={reducedMotion ? '' : 'pet-dot'} style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </g>
      )}
      {fx && <g className={reducedMotion ? '' : 'pet-float-fx'}>{sprite(fx.rows, 0, 0, fx.colors, `fx-${mood}`)}</g>}
    </svg>
  );
}
