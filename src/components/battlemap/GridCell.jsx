import React from 'react';
import { TERRAIN_TYPES, CELL_PX } from './mapUtils';

export default function GridCell({
  row, col, terrain, isHighlighted, highlightColor, isSelected,
  isRangeCell, isMoveCell, onClick, onContextMenu, cellSize,
}) {
  const t = TERRAIN_TYPES[terrain] || TERRAIN_TYPES.floor;
  const size = cellSize || CELL_PX;

  let bg = t.color;
  if (isSelected) bg = 'rgba(212,149,90,0.4)';
  else if (isMoveCell) bg = 'rgba(34,197,94,0.15)';
  else if (isRangeCell) bg = 'rgba(239,68,68,0.12)';
  else if (isHighlighted) bg = highlightColor || 'rgba(184,115,51,0.2)';

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="relative flex items-center justify-center transition-colors duration-100"
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        background: bg,
        borderRight: '1px solid rgba(184,115,51,0.08)',
        borderBottom: '1px solid rgba(184,115,51,0.08)',
        cursor: 'pointer',
        boxShadow: isSelected ? 'inset 0 0 0 2px rgba(212,149,90,0.7)' : 'none',
      }}
    >
      {t.icon && (
        <span className="pointer-events-none select-none" style={{ fontSize: size * 0.45, opacity: 0.7 }}>
          {t.icon}
        </span>
      )}
    </div>
  );
}