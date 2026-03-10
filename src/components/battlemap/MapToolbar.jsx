import React from 'react';
import { MousePointer, Move, PaintBucket, Ruler, Wand2, Trash2, RotateCcw, ZoomIn, ZoomOut, Sparkles } from 'lucide-react';
import { TERRAIN_TYPES } from './mapUtils';

const TOOLS = [
  { id: 'select',  icon: MousePointer, label: 'Select',  color: 'var(--brass-gold)' },
  { id: 'move',    icon: Move,          label: 'Move',    color: '#86efac' },
  { id: 'terrain', icon: PaintBucket,   label: 'Terrain', color: '#93c5fd' },
  { id: 'measure', icon: Ruler,         label: 'Measure', color: '#fbbf24' },
];

export default function MapToolbar({
  activeTool, onToolChange, activeTerrainType, onTerrainTypeChange,
  zoom, onZoomIn, onZoomOut, onClearMap, onAIGenerate, aiLoading,
  round, onNextRound,
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 flex-wrap"
      style={{ background: 'rgba(10,5,2,0.95)', borderBottom: '1px solid rgba(184,115,51,0.2)' }}>
      
      {/* Tool buttons */}
      <div className="flex gap-1">
        {TOOLS.map(t => {
          const active = activeTool === t.id;
          return (
            <button key={t.id} onClick={() => onToolChange(t.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-fantasy transition-all"
              title={t.label}
              style={{
                background: active ? 'rgba(60,30,8,0.8)' : 'transparent',
                border: `1px solid ${active ? 'rgba(212,149,90,0.5)' : 'transparent'}`,
                color: active ? t.color : 'rgba(201,169,110,0.35)',
              }}>
              <t.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Terrain picker (when terrain tool active) */}
      {activeTool === 'terrain' && (
        <div className="flex gap-1 ml-1 pl-2" style={{ borderLeft: '1px solid rgba(184,115,51,0.15)' }}>
          {Object.entries(TERRAIN_TYPES).map(([key, t]) => (
            <button key={key} onClick={() => onTerrainTypeChange(key)}
              className="px-2 py-1 rounded-lg text-xs transition-all"
              title={t.label}
              style={{
                background: activeTerrainType === key ? t.color : 'rgba(12,7,2,0.6)',
                border: `1px solid ${activeTerrainType === key ? 'rgba(255,255,255,0.2)' : 'rgba(80,50,10,0.15)'}`,
                color: activeTerrainType === key ? '#fff' : 'rgba(201,169,110,0.35)',
                fontSize: '0.7rem',
              }}>
              {t.icon || '⬜'} {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {/* Round tracker */}
      <div className="flex items-center gap-2 mr-2">
        <span className="font-fantasy text-xs" style={{ color: 'rgba(212,149,90,0.4)' }}>Round</span>
        <span className="font-fantasy font-bold text-sm" style={{ color: 'var(--brass-gold)' }}>{round}</span>
        <button onClick={onNextRound}
          className="px-2 py-1 rounded-lg text-xs font-fantasy"
          style={{ background: 'rgba(60,30,8,0.5)', border: '1px solid rgba(184,115,51,0.25)', color: 'var(--brass-gold)' }}>
          Next
        </button>
      </div>

      {/* Zoom */}
      <div className="flex gap-1">
        <button onClick={onZoomOut} className="p-1.5 rounded-lg"
          style={{ color: 'rgba(201,169,110,0.4)', border: '1px solid rgba(80,50,10,0.15)' }}>
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-fantasy self-center px-1" style={{ color: 'rgba(201,169,110,0.35)' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={onZoomIn} className="p-1.5 rounded-lg"
          style={{ color: 'rgba(201,169,110,0.4)', border: '1px solid rgba(80,50,10,0.15)' }}>
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* AI Generate */}
      <button onClick={onAIGenerate} disabled={aiLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-fantasy btn-arcane disabled:opacity-40">
        {aiLoading ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
        {aiLoading ? 'Generating...' : 'AI Map'}
      </button>

      {/* Clear */}
      <button onClick={onClearMap} className="p-1.5 rounded-lg"
        style={{ color: 'rgba(220,50,50,0.4)', border: '1px solid rgba(180,50,50,0.15)' }}
        title="Clear Map">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}