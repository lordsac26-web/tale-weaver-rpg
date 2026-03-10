// ─── Battle Map Utilities ──────────────────────────────────────────────────────

export const GRID_SIZE = 20; // 20x20 grid
export const CELL_PX = 40;  // pixels per cell at default zoom

export const TERRAIN_TYPES = {
  floor:    { label: 'Floor',    color: 'rgba(40,22,8,0.6)',    icon: '' },
  wall:     { label: 'Wall',     color: 'rgba(20,10,4,0.95)',   icon: '🧱', blocked: true },
  water:    { label: 'Water',    color: 'rgba(20,50,80,0.7)',   icon: '🌊', difficult: true },
  lava:     { label: 'Lava',     color: 'rgba(120,20,5,0.8)',   icon: '🔥', difficult: true, damage: true },
  tree:     { label: 'Trees',    color: 'rgba(15,45,15,0.7)',   icon: '🌲', cover: 'half' },
  rock:     { label: 'Boulder',  color: 'rgba(60,55,50,0.8)',   icon: '🪨', cover: 'three_quarter' },
  door:     { label: 'Door',     color: 'rgba(90,50,15,0.8)',   icon: '🚪' },
  pit:      { label: 'Pit',      color: 'rgba(5,3,2,0.95)',     icon: '⬛', blocked: true },
  chest:    { label: 'Chest',    color: 'rgba(120,80,20,0.7)',  icon: '📦' },
};

export const TOKEN_COLORS = {
  player:  { bg: 'rgba(34,197,94,0.85)', border: '#4ade80', text: '#fff' },
  ally:    { bg: 'rgba(59,130,246,0.85)', border: '#60a5fa', text: '#fff' },
  enemy:   { bg: 'rgba(220,38,38,0.85)',  border: '#f87171', text: '#fff' },
  neutral: { bg: 'rgba(180,160,100,0.7)', border: '#d4b36a', text: '#fff' },
};

export function cellKey(row, col) {
  return `${row},${col}`;
}

export function parseKey(key) {
  const [r, c] = key.split(',').map(Number);
  return { row: r, col: c };
}

export function distance(r1, c1, r2, c2) {
  // D&D 5e uses the "max of dx/dy" for diagonal movement (each square = 5ft)
  const dx = Math.abs(c2 - c1);
  const dy = Math.abs(r2 - r1);
  return Math.max(dx, dy) * 5;
}

export function createEmptyGrid() {
  const grid = {};
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      grid[cellKey(r, c)] = 'floor';
    }
  }
  return grid;
}

export function createToken(id, name, type, row, col, extraData = {}) {
  return {
    id,
    name,
    type, // 'player' | 'enemy' | 'ally' | 'neutral'
    row,
    col,
    hp_current: extraData.hp_current ?? 10,
    hp_max: extraData.hp_max ?? 10,
    ac: extraData.ac ?? 10,
    speed: extraData.speed ?? 30,
    conditions: extraData.conditions ?? [],
    initiative: extraData.initiative ?? 0,
    size: extraData.size ?? 1, // 1=medium, 2=large, 3=huge
    emoji: extraData.emoji ?? null,
    moved_this_turn: false,
  };
}

export function getMovementRange(token) {
  // Returns number of cells (speed / 5)
  return Math.floor((token.speed || 30) / 5);
}

export function getCellsInRange(row, col, rangeFt) {
  const rangeCells = Math.floor(rangeFt / 5);
  const cells = [];
  for (let r = row - rangeCells; r <= row + rangeCells; r++) {
    for (let c = col - rangeCells; c <= col + rangeCells; c++) {
      if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) continue;
      if (distance(row, col, r, c) <= rangeFt) {
        cells.push({ row: r, col: c });
      }
    }
  }
  return cells;
}