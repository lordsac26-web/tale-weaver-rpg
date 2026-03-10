import React from 'react';
import { distance, CELL_PX } from './mapUtils';

export default function MeasureOverlay({ from, to, cellSize }) {
  if (!from || !to) return null;
  const size = cellSize || CELL_PX;
  const dist = distance(from.row, from.col, to.row, to.col);

  const x1 = from.col * size + size / 2;
  const y1 = from.row * size + size / 2;
  const x2 = to.col * size + size / 2;
  const y2 = to.row * size + size / 2;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <svg className="absolute inset-0 pointer-events-none z-20" style={{ overflow: 'visible' }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="rgba(251,191,36,0.7)" strokeWidth={2} strokeDasharray="6,4" />
      <circle cx={x1} cy={y1} r={4} fill="#fbbf24" />
      <circle cx={x2} cy={y2} r={4} fill="#fbbf24" />
      <rect x={midX - 22} y={midY - 12} width={44} height={22} rx={6}
        fill="rgba(10,5,2,0.9)" stroke="rgba(251,191,36,0.5)" strokeWidth={1} />
      <text x={midX} y={midY + 4} textAnchor="middle" fill="#fbbf24"
        fontSize="11" fontFamily="Cinzel, serif" fontWeight="bold">
        {dist}ft
      </text>
    </svg>
  );
}