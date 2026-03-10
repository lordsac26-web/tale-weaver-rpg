import React, { useState } from 'react';
import { Plus, Trash2, RotateCcw, Heart, Shield, Zap } from 'lucide-react';
import { CONDITIONS } from '../game/gameData';
import { TOKEN_COLORS } from './mapUtils';
import { getTokenIcon } from './tokenIcons';

const TOKEN_TYPES = [
  { value: 'player', label: 'Player', emoji: '🟢' },
  { value: 'ally', label: 'Ally', emoji: '🔵' },
  { value: 'enemy', label: 'Enemy', emoji: '🔴' },
  { value: 'neutral', label: 'Neutral', emoji: '🟡' },
];

export default function TokenPanel({ tokens, selectedTokenId, onAddToken, onRemoveToken, onUpdateToken, onSelectToken }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newToken, setNewToken] = useState({ name: '', type: 'enemy', hp: 20, ac: 13, speed: 30 });

  const selected = tokens.find(t => t.id === selectedTokenId);
  const conditionKeys = Object.keys(CONDITIONS);

  const handleAdd = () => {
    if (!newToken.name.trim()) return;
    onAddToken({
      name: newToken.name,
      type: newToken.type,
      hp_current: Number(newToken.hp),
      hp_max: Number(newToken.hp),
      ac: Number(newToken.ac),
      speed: Number(newToken.speed),
    });
    setNewToken({ name: '', type: 'enemy', hp: 20, ac: 13, speed: 30 });
    setShowAdd(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'rgba(10,5,2,0.95)' }}>
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(184,115,51,0.2)' }}>
        <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(212,149,90,0.5)' }}>TOKENS</span>
        <button onClick={() => setShowAdd(v => !v)}
          className="p-1 rounded-lg transition-all"
          style={{ color: 'var(--brass-gold)', border: '1px solid rgba(184,115,51,0.3)' }}>
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Add token form */}
      {showAdd && (
        <div className="p-3 space-y-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(184,115,51,0.15)', background: 'rgba(20,10,3,0.8)' }}>
          <input value={newToken.name} onChange={e => setNewToken(p => ({ ...p, name: e.target.value }))}
            placeholder="Token name..." className="w-full input-fantasy rounded-lg px-3 py-1.5 text-xs" />
          <div className="grid grid-cols-2 gap-1.5">
            {TOKEN_TYPES.map(t => (
              <button key={t.value} onClick={() => setNewToken(p => ({ ...p, type: t.value }))}
                className="py-1 rounded-lg text-xs font-fantasy transition-all"
                style={{
                  background: newToken.type === t.value ? TOKEN_COLORS[t.value].bg : 'rgba(12,7,2,0.7)',
                  border: `1px solid ${newToken.type === t.value ? TOKEN_COLORS[t.value].border : 'rgba(80,50,10,0.2)'}`,
                  color: newToken.type === t.value ? '#fff' : 'rgba(201,169,110,0.4)',
                }}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="text-xs" style={{ color: 'rgba(201,169,110,0.35)', fontSize: '0.6rem' }}>HP</label>
              <input type="number" value={newToken.hp} onChange={e => setNewToken(p => ({ ...p, hp: e.target.value }))}
                className="w-full input-fantasy rounded-lg px-2 py-1 text-xs text-center" />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'rgba(201,169,110,0.35)', fontSize: '0.6rem' }}>AC</label>
              <input type="number" value={newToken.ac} onChange={e => setNewToken(p => ({ ...p, ac: e.target.value }))}
                className="w-full input-fantasy rounded-lg px-2 py-1 text-xs text-center" />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'rgba(201,169,110,0.35)', fontSize: '0.6rem' }}>Speed</label>
              <input type="number" value={newToken.speed} onChange={e => setNewToken(p => ({ ...p, speed: e.target.value }))}
                className="w-full input-fantasy rounded-lg px-2 py-1 text-xs text-center" step={5} />
            </div>
          </div>
          <button onClick={handleAdd} className="w-full py-1.5 rounded-lg text-xs font-fantasy btn-fantasy">
            <Plus className="w-3 h-3 inline mr-1" /> Add Token
          </button>
        </div>
      )}

      {/* Token list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
        {tokens.map(token => {
          const colors = TOKEN_COLORS[token.type] || TOKEN_COLORS.neutral;
          const isDead = token.hp_current <= 0;
          const isSelected = token.id === selectedTokenId;
          return (
            <button key={token.id} onClick={() => onSelectToken(token.id)}
              className="w-full p-2 rounded-lg text-left transition-all"
              style={{
                background: isSelected ? 'rgba(60,30,8,0.7)' : 'rgba(15,8,3,0.6)',
                border: `1px solid ${isSelected ? 'rgba(212,149,90,0.55)' : 'rgba(80,50,10,0.15)'}`,
                opacity: isDead ? 0.4 : 1,
              }}>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
                  <img src={getTokenIcon({ name: token.name, type: token.type, characterClass: token.characterClass, race: token.race })}
                    alt="" className="w-3.5 h-3.5"
                    onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                  <span style={{ display: 'none', color: colors.text, fontSize: '0.55rem', fontWeight: 700 }}>
                    {token.name?.slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-fantasy truncate" style={{ color: isSelected ? 'var(--parchment)' : 'rgba(201,169,110,0.7)' }}>
                    {token.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(201,169,110,0.35)', fontSize: '0.6rem' }}>
                    <span>❤️ {token.hp_current}/{token.hp_max}</span>
                    <span>🛡️ {token.ac}</span>
                  </div>
                </div>
                {token.conditions?.length > 0 && (
                  <div className="flex gap-0.5">
                    {token.conditions.slice(0, 2).map((c, i) => (
                      <span key={i} style={{ fontSize: '0.65rem' }}>{CONDITIONS[c]?.icon || '❓'}</span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected token details */}
      {selected && (
        <div className="flex-shrink-0 p-3 space-y-2"
          style={{ borderTop: '1px solid rgba(184,115,51,0.2)', background: 'rgba(15,8,3,0.9)' }}>
          <div className="flex items-center justify-between">
            <span className="font-fantasy text-sm font-bold" style={{ color: 'var(--parchment)' }}>{selected.name}</span>
            <button onClick={() => onRemoveToken(selected.id)} className="p-1 rounded transition-all"
              style={{ color: 'rgba(220,50,50,0.5)' }}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick HP adjust */}
          <div className="flex items-center gap-2">
            <Heart className="w-3 h-3" style={{ color: '#ef4444' }} />
            <button onClick={() => onUpdateToken(selected.id, { hp_current: Math.max(0, selected.hp_current - 1) })}
              className="w-6 h-6 rounded text-xs font-bold"
              style={{ background: 'rgba(120,20,20,0.5)', border: '1px solid rgba(220,50,50,0.3)', color: '#fca5a5' }}>−</button>
            <span className="text-xs font-fantasy flex-1 text-center" style={{ color: 'var(--parchment)' }}>
              {selected.hp_current}/{selected.hp_max}
            </span>
            <button onClick={() => onUpdateToken(selected.id, { hp_current: Math.min(selected.hp_max, selected.hp_current + 1) })}
              className="w-6 h-6 rounded text-xs font-bold"
              style={{ background: 'rgba(10,60,20,0.5)', border: '1px solid rgba(40,160,75,0.3)', color: '#86efac' }}>+</button>
          </div>

          {/* Conditions */}
          <div>
            <span className="text-xs" style={{ color: 'rgba(212,149,90,0.4)', fontSize: '0.6rem', letterSpacing: '0.1em' }}>CONDITIONS</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {conditionKeys.map(c => {
                const active = selected.conditions?.includes(c);
                return (
                  <button key={c}
                    onClick={() => {
                      const newConds = active
                        ? selected.conditions.filter(x => x !== c)
                        : [...(selected.conditions || []), c];
                      onUpdateToken(selected.id, { conditions: newConds });
                    }}
                    className="px-1.5 py-0.5 rounded text-xs transition-all"
                    style={{
                      background: active ? 'rgba(120,60,20,0.6)' : 'rgba(12,7,2,0.6)',
                      border: `1px solid ${active ? 'rgba(212,149,90,0.5)' : 'rgba(80,50,10,0.15)'}`,
                      color: active ? 'var(--parchment)' : 'rgba(201,169,110,0.3)',
                      fontSize: '0.6rem',
                    }}
                    title={CONDITIONS[c]?.description}>
                    {CONDITIONS[c]?.icon} {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset movement */}
          <button onClick={() => onUpdateToken(selected.id, { moved_this_turn: false })}
            className="w-full py-1.5 rounded-lg text-xs font-fantasy flex items-center justify-center gap-1.5"
            style={{ background: 'rgba(60,30,8,0.5)', border: '1px solid rgba(184,115,51,0.25)', color: 'var(--brass-gold)' }}>
            <RotateCcw className="w-3 h-3" /> Reset Movement
          </button>
        </div>
      )}
    </div>
  );
}