import React, { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { ArrowLeft, Map as MapIcon } from 'lucide-react';
import {
  GRID_SIZE, CELL_PX, cellKey, parseKey, distance,
  createEmptyGrid, createToken, getMovementRange, getCellsInRange,
} from '@/components/battlemap/mapUtils';
import GridCell from '@/components/battlemap/GridCell';
import TokenDisplay from '@/components/battlemap/TokenDisplay';
import TokenPanel from '@/components/battlemap/TokenPanel';
import MapToolbar from '@/components/battlemap/MapToolbar';
import MeasureOverlay from '@/components/battlemap/MeasureOverlay';

export default function BattleMap() {
  const [grid, setGrid] = useState(() => createEmptyGrid());
  const [tokens, setTokens] = useState([]);
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [activeTool, setActiveTool] = useState('select');
  const [activeTerrainType, setActiveTerrainType] = useState('wall');
  const [zoom, setZoom] = useState(1);
  const [round, setRound] = useState(1);
  const [activeTokenIndex, setActiveTokenIndex] = useState(0);
  const [measureFrom, setMeasureFrom] = useState(null);
  const [measureTo, setMeasureTo] = useState(null);
  const [moveCells, setMoveCells] = useState([]);
  const [rangeCells, setRangeCells] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [hoverCell, setHoverCell] = useState(null);
  const idCounter = useRef(1);

  const cellSize = Math.round(CELL_PX * zoom);
  const selectedToken = tokens.find(t => t.id === selectedTokenId);
  const activeToken = tokens[activeTokenIndex];

  // ── Cell click handler ──
  const handleCellClick = useCallback((row, col) => {
    if (activeTool === 'terrain') {
      setGrid(prev => ({ ...prev, [cellKey(row, col)]: activeTerrainType }));
      return;
    }

    if (activeTool === 'measure') {
      if (!measureFrom) {
        setMeasureFrom({ row, col });
        setMeasureTo(null);
      } else {
        setMeasureTo({ row, col });
        setMeasureFrom(null);
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

    // Select tool — check if there's a token at this cell
    const tokenAtCell = tokens.find(t => t.row === row && t.col === col);
    if (tokenAtCell) {
      setSelectedTokenId(tokenAtCell.id);
    } else {
      setSelectedTokenId(null);
      setMoveCells([]);
      setRangeCells([]);
    }
  }, [activeTool, activeTerrainType, selectedToken, tokens, grid, measureFrom]);

  // ── Show move range when selecting a token in move mode ──
  const handleSelectToken = useCallback((id) => {
    setSelectedTokenId(id);
    const token = tokens.find(t => t.id === id);
    if (token && activeTool === 'move' && !token.moved_this_turn && token.hp_current > 0) {
      const range = getMovementRange(token);
      setMoveCells(getCellsInRange(token.row, token.col, range * 5));
    } else {
      setMoveCells([]);
    }
    // Show weapon range (30ft default)
    if (token && token.hp_current > 0) {
      setRangeCells(getCellsInRange(token.row, token.col, 30));
    } else {
      setRangeCells([]);
    }
  }, [tokens, activeTool]);

  // ── Token CRUD ──
  const handleAddToken = useCallback((data) => {
    const id = `tok_${idCounter.current++}`;
    // Find empty cell near center
    let row = Math.floor(GRID_SIZE / 2), col = Math.floor(GRID_SIZE / 2);
    for (let r = row; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (!tokens.some(t => t.row === r && t.col === c) && grid[cellKey(r, c)] !== 'wall') {
          row = r; col = c; r = GRID_SIZE; break;
        }
      }
    }
    const token = createToken(id, data.name, data.type, row, col, data);
    setTokens(prev => [...prev, token]);
    setSelectedTokenId(id);
  }, [tokens, grid]);

  const handleRemoveToken = useCallback((id) => {
    setTokens(prev => prev.filter(t => t.id !== id));
    if (selectedTokenId === id) setSelectedTokenId(null);
  }, [selectedTokenId]);

  const handleUpdateToken = useCallback((id, updates) => {
    setTokens(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  // ── Round management ──
  const handleNextRound = () => {
    setRound(r => r + 1);
    setTokens(prev => prev.map(t => ({ ...t, moved_this_turn: false })));
    setActiveTokenIndex(0);
  };

  // ── Clear map ──
  const handleClearMap = () => {
    setGrid(createEmptyGrid());
    setTokens([]);
    setSelectedTokenId(null);
    setRound(1);
    setActiveTokenIndex(0);
  };

  // ── AI Generate ──
  const handleAIGenerate = async () => {
    setAiLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a D&D 5e tactical battle map as a JSON object. The map is a ${GRID_SIZE}x${GRID_SIZE} grid.

Return a JSON with:
1. "terrain": array of objects {row, col, type} where type is one of: wall, water, lava, tree, rock, door, pit, chest. Only include non-floor cells.
2. "tokens": array of objects {name, type, row, col, hp, ac, speed, emoji} where type is "enemy" or "neutral". Place 3-5 enemies and 0-2 neutrals. Use fun D&D monster names. Include 1-2 emoji for each token.
3. "description": a short flavor text for the encounter.

Create an interesting tactical layout with chokepoints, cover, and varied terrain. Place enemies strategically.`,
      response_json_schema: {
        type: 'object',
        properties: {
          terrain: { type: 'array', items: { type: 'object', properties: { row: { type: 'number' }, col: { type: 'number' }, type: { type: 'string' } } } },
          tokens: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' }, row: { type: 'number' }, col: { type: 'number' }, hp: { type: 'number' }, ac: { type: 'number' }, speed: { type: 'number' }, emoji: { type: 'string' } } } },
          description: { type: 'string' },
        },
      },
    });

    // Apply terrain
    const newGrid = createEmptyGrid();
    (result.terrain || []).forEach(t => {
      if (t.row >= 0 && t.row < GRID_SIZE && t.col >= 0 && t.col < GRID_SIZE) {
        newGrid[cellKey(t.row, t.col)] = t.type;
      }
    });
    setGrid(newGrid);

    // Apply tokens
    const newTokens = (result.tokens || []).map((t, i) => {
      const id = `tok_${idCounter.current++}`;
      return createToken(id, t.name, t.type === 'enemy' ? 'enemy' : 'neutral',
        Math.min(GRID_SIZE - 1, Math.max(0, t.row)),
        Math.min(GRID_SIZE - 1, Math.max(0, t.col)),
        { hp_current: t.hp || 20, hp_max: t.hp || 20, ac: t.ac || 13, speed: t.speed || 30, emoji: t.emoji });
    });
    setTokens(newTokens);
    setRound(1);
    setActiveTokenIndex(0);
    setAiLoading(false);
  };

  // ── Build move/range cell sets for fast lookup ──
  const moveCellSet = new Set(moveCells.map(c => cellKey(c.row, c.col)));
  const rangeCellSet = new Set(rangeCells.map(c => cellKey(c.row, c.col)));

  return (
    <div className="h-screen flex flex-col parchment-bg" style={{ color: 'var(--text-bright)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
        style={{ background: 'rgba(10,5,2,0.97)', borderBottom: '1px solid rgba(184,115,51,0.3)' }}>
        <Link to={createPageUrl('Home')} className="p-1.5 rounded-lg" style={{ color: 'rgba(212,149,90,0.5)' }}>
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #e8b86d, #b87333)' }} />
        <MapIcon className="w-4 h-4" style={{ color: 'var(--brass-gold)' }} />
        <span className="font-fantasy text-sm tracking-widest" style={{ color: 'var(--brass-gold)' }}>Battle Map</span>
        {hoverCell && (
          <span className="ml-auto text-xs font-body" style={{ color: 'rgba(201,169,110,0.3)' }}>
            ({hoverCell.row}, {hoverCell.col})
            {selectedToken && ` · ${distance(selectedToken.row, selectedToken.col, hoverCell.row, hoverCell.col)}ft`}
          </span>
        )}
      </div>

      {/* Toolbar */}
      <MapToolbar
        activeTool={activeTool} onToolChange={setActiveTool}
        activeTerrainType={activeTerrainType} onTerrainTypeChange={setActiveTerrainType}
        zoom={zoom} onZoomIn={() => setZoom(z => Math.min(2, z + 0.15))} onZoomOut={() => setZoom(z => Math.max(0.4, z - 0.15))}
        onClearMap={handleClearMap} onAIGenerate={handleAIGenerate} aiLoading={aiLoading}
        round={round} onNextRound={handleNextRound}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Grid area */}
        <div className="flex-1 overflow-auto relative" style={{ background: 'rgba(6,3,1,0.95)' }}>
          <div className="relative inline-block" style={{ margin: '12px' }}>
            {/* Grid cells */}
            <div className="grid" style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${GRID_SIZE}, ${cellSize}px)`,
              border: '1px solid rgba(184,115,51,0.2)',
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
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setGrid(prev => ({ ...prev, [key]: 'floor' }));
                    }}
                  />
                );
              })}
            </div>

            {/* Tokens */}
            {tokens.map(token => (
              <TokenDisplay key={token.id}
                token={token}
                isActive={activeToken?.id === token.id}
                isSelected={selectedTokenId === token.id}
                cellSize={cellSize}
                onClick={(t) => handleSelectToken(t.id)}
              />
            ))}

            {/* Measure overlay */}
            <MeasureOverlay from={measureFrom} to={measureTo || hoverCell} cellSize={cellSize} />
          </div>
        </div>

        {/* Token panel */}
        <div className="flex-shrink-0 overflow-hidden" style={{ width: '240px', borderLeft: '1px solid rgba(184,115,51,0.2)' }}>
          <TokenPanel
            tokens={tokens}
            selectedTokenId={selectedTokenId}
            onAddToken={handleAddToken}
            onRemoveToken={handleRemoveToken}
            onUpdateToken={handleUpdateToken}
            onSelectToken={handleSelectToken}
          />
        </div>
      </div>
    </div>
  );
}