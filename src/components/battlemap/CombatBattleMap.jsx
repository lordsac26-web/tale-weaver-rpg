import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Map as MapIcon, ZoomIn, ZoomOut, Crosshair, Move, Ruler } from 'lucide-react';
import {
  GRID_SIZE, CELL_PX, cellKey, distance,
  createEmptyGrid, createToken, getMovementRange, getCellsInRange,
} from './mapUtils';
import GridCell from './GridCell';
import TokenDisplay from './TokenDisplay';
import MeasureOverlay from './MeasureOverlay';

/**
 * CombatBattleMap — lightweight map that auto-populates from combat data.
 * Designed to be embedded in the Game page during combat.
 * 
 * Props:
 *   combat - CombatLog entity with combatants
 *   character - player Character entity
 */
export default function CombatBattleMap({ combat, character }) {
  const [grid, setGrid] = useState(() => createEmptyGrid());
  const [zoom, setZoom] = useState(0.85);
  const [activeTool, setActiveTool] = useState('select');
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [measureFrom, setMeasureFrom] = useState(null);
  const [measureTo, setMeasureTo] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);
  const [moveCells, setMoveCells] = useState([]);
  const [rangeCells, setRangeCells] = useState([]);
  const [tokens, setTokens] = useState([]);
  const initializedRef = useRef(false);

  const cellSize = Math.round(CELL_PX * zoom);

  // ── Auto-populate tokens from combat data ──
  useEffect(() => {
    if (!combat?.combatants || initializedRef.current) return;
    initializedRef.current = true;

    const combatants = combat.combatants;
    const placedTokens = [];
    const usedCells = new Set();

    // Place player near bottom-center
    const playerStart = { row: GRID_SIZE - 3, col: Math.floor(GRID_SIZE / 2) };
    // Place enemies in upper portion
    const enemyStartRow = 3;

    combatants.forEach((c, i) => {
      let row, col;
      if (c.type === 'player') {
        row = playerStart.row;
        col = playerStart.col;
      } else {
        // Spread enemies across the upper section
        const enemyIdx = placedTokens.filter(t => t.type === 'enemy').length;
        row = enemyStartRow + Math.floor(enemyIdx / 4);
        col = Math.floor(GRID_SIZE / 2) - 2 + (enemyIdx % 4) * 2;
      }

      // Avoid overlap
      const key = cellKey(row, col);
      if (usedCells.has(key)) {
        for (let r = row; r < GRID_SIZE; r++) {
          for (let cc = 0; cc < GRID_SIZE; cc++) {
            const k = cellKey(r, cc);
            if (!usedCells.has(k)) { row = r; col = cc; r = GRID_SIZE; break; }
          }
        }
      }
      usedCells.add(cellKey(row, col));

      placedTokens.push(createToken(
        c.id || `tok_${i}`,
        c.name,
        c.type,
        row, col,
        {
          hp_current: c.hp_current ?? c.hp ?? 10,
          hp_max: c.hp_max ?? c.hp ?? 10,
          ac: c.ac ?? 13,
          speed: c.speed ?? 30,
          initiative: c.initiative_total ?? 0,
          conditions: c.conditions || [],
          characterClass: c.type === 'player' ? character?.class : null,
          race: c.type === 'player' ? character?.race : null,
        }
      ));
    });

    setTokens(placedTokens);
  }, [combat, character]);

  // Sync HP/conditions from combat data
  useEffect(() => {
    if (!combat?.combatants || !initializedRef.current) return;
    setTokens(prev => prev.map(token => {
      const combatant = combat.combatants.find(c => c.id === token.id || c.name === token.name);
      if (!combatant) return token;
      return {
        ...token,
        hp_current: combatant.hp_current ?? token.hp_current,
        conditions: combatant.conditions || token.conditions,
      };
    }));
  }, [combat?.combatants]);

  const selectedToken = tokens.find(t => t.id === selectedTokenId);

  // ── Cell click ──
  const handleCellClick = useCallback((row, col) => {
    if (activeTool === 'measure') {
      if (!measureFrom) {
        setMeasureFrom({ row, col }); setMeasureTo(null);
      } else {
        setMeasureTo({ row, col }); setMeasureFrom(null);
      }
      return;
    }
    if (activeTool === 'move' && selectedToken) {
      const range = getMovementRange(selectedToken);
      const dist = distance(selectedToken.row, selectedToken.col, row, col) / 5;
      const terrainKey = cellKey(row, col);
      const terrain = grid[terrainKey];
      if (terrain === 'wall' || terrain === 'pit') return;
      const occupied = tokens.some(t => t.id !== selectedToken.id && t.row === row && t.col === col && t.hp_current > 0);
      if (occupied) return;
      if (dist <= range && !selectedToken.moved_this_turn) {
        setTokens(prev => prev.map(t =>
          t.id === selectedToken.id ? { ...t, row, col, moved_this_turn: true } : t
        ));
        setMoveCells([]);
      }
      return;
    }
    const tokenAtCell = tokens.find(t => t.row === row && t.col === col);
    if (tokenAtCell) {
      handleSelectToken(tokenAtCell.id);
    } else {
      setSelectedTokenId(null); setMoveCells([]); setRangeCells([]);
    }
  }, [activeTool, selectedToken, tokens, grid, measureFrom]);

  const handleSelectToken = useCallback((id) => {
    setSelectedTokenId(id);
    const token = tokens.find(t => t.id === id);
    if (token && activeTool === 'move' && !token.moved_this_turn && token.hp_current > 0) {
      setMoveCells(getCellsInRange(token.row, token.col, getMovementRange(token) * 5));
    } else {
      setMoveCells([]);
    }
    if (token && token.hp_current > 0) {
      setRangeCells(getCellsInRange(token.row, token.col, 30));
    } else {
      setRangeCells([]);
    }
  }, [tokens, activeTool]);

  const moveCellSet = useMemo(() => new Set(moveCells.map(c => cellKey(c.row, c.col))), [moveCells]);
  const rangeCellSet = useMemo(() => new Set(rangeCells.map(c => cellKey(c.row, c.col))), [rangeCells]);

  const activeTokenId = combat?.combatants?.[combat.current_turn_index]?.id;

  const TOOLS = [
    { id: 'select', icon: Crosshair, label: 'Select' },
    { id: 'move', icon: Move, label: 'Move' },
    { id: 'measure', icon: Ruler, label: 'Measure' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'rgba(6,3,1,0.98)' }}>
      {/* Mini toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(184,115,51,0.2)', background: 'rgba(10,5,2,0.95)' }}>
        <MapIcon className="w-3.5 h-3.5" style={{ color: 'rgba(212,149,90,0.4)' }} />
        <span className="font-fantasy text-xs tracking-widest mr-2" style={{ color: 'rgba(212,149,90,0.4)', fontSize: '0.6rem' }}>BATTLE MAP</span>

        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)}
            className="p-1.5 rounded-lg transition-all" title={t.label}
            style={{
              background: activeTool === t.id ? 'rgba(80,40,10,0.6)' : 'transparent',
              border: `1px solid ${activeTool === t.id ? 'rgba(212,149,90,0.5)' : 'transparent'}`,
              color: activeTool === t.id ? '#d4955a' : 'rgba(201,169,110,0.3)',
            }}>
            <t.icon className="w-3.5 h-3.5" />
          </button>
        ))}

        <div className="flex-1" />

        <button onClick={() => setZoom(z => Math.max(0.4, z - 0.15))}
          className="p-1 rounded" style={{ color: 'rgba(201,169,110,0.3)' }}>
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.3)', fontSize: '0.6rem' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={() => setZoom(z => Math.min(2, z + 0.15))}
          className="p-1 rounded" style={{ color: 'rgba(201,169,110,0.3)' }}>
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        {hoverCell && selectedToken && (
          <span className="ml-2 text-xs font-body" style={{ color: 'rgba(201,169,110,0.25)', fontSize: '0.6rem' }}>
            {distance(selectedToken.row, selectedToken.col, hoverCell.row, hoverCell.col)}ft
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto relative">
        <div className="relative inline-block" style={{ margin: '8px' }}
          onMouseLeave={() => setHoverCell(null)}>
          <div className="grid" style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, ${cellSize}px)`,
            border: '1px solid rgba(184,115,51,0.15)',
          }}>
            {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
              const row = Math.floor(i / GRID_SIZE);
              const col = i % GRID_SIZE;
              const key = cellKey(row, col);
              return (
                <GridCell key={key}
                  row={row} col={col}
                  terrain={grid[key] || 'floor'}
                  isSelected={selectedToken?.row === row && selectedToken?.col === col}
                  isMoveCell={moveCellSet.has(key)}
                  isRangeCell={!moveCellSet.has(key) && rangeCellSet.has(key)}
                  cellSize={cellSize}
                  onClick={() => handleCellClick(row, col)}
                  onMouseEnter={() => setHoverCell({ row, col })}
                />
              );
            })}
          </div>

          {tokens.map(token => (
            <TokenDisplay key={token.id}
              token={token}
              isActive={activeTokenId === token.id}
              isSelected={selectedTokenId === token.id}
              cellSize={cellSize}
              onClick={(t) => handleSelectToken(t.id)}
            />
          ))}

          <MeasureOverlay from={measureFrom} to={measureTo || hoverCell} cellSize={cellSize} />
        </div>
      </div>
    </div>
  );
}