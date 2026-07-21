import React, { useState } from 'react';
import { Heart, X, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Lay on Hands amount picker (PHB p.84): choose how many points of the pool to
// spend on healing, or spend 1 point to cure a disease / neutralize a poison.
export default function LayOnHandsModal({ character, onClose, onMessage, onCharacterUpdate, onAbilityUsed }) {
  const level = character.level || 1;
  const lohMax = level * 5;
  const lra = character.long_rest_abilities || {};
  const lohUsed = lra.lay_on_hands_used || 0;
  const lohLeft = Math.max(0, lohMax - lohUsed);
  const missingHp = Math.max(0, (character.hp_max || 1) - (character.hp_current || 0));
  const healCap = Math.min(lohLeft, missingHp);
  const [amount, setAmount] = useState(Math.max(1, healCap));
  const [busy, setBusy] = useState(false);

  const spend = async (points, isCure) => {
    if (busy || points <= 0 || points > lohLeft) return;
    setBusy(true);
    const newLra = { ...lra, lay_on_hands_used: lohUsed + points };
    const updates = { long_rest_abilities: newLra };
    let newHp = character.hp_current || 0;
    if (!isCure) {
      newHp = Math.min(character.hp_max, newHp + points);
      updates.hp_current = newHp;
    }
    await base44.entities.Character.update(character.id, updates);
    onCharacterUpdate?.((prev) => prev ? { ...prev, ...updates } : prev);
    onMessage?.(isCure
      ? `🙏 Lay on Hands! ${character.name} spends 1 point to cure a disease or neutralize a poison. Pool: ${lohLeft - 1}/${lohMax}.`
      : `🙏 Lay on Hands! ${character.name} heals ${points} HP (${newHp}/${character.hp_max}). Pool: ${lohLeft - points}/${lohMax}.`);
    onAbilityUsed?.('lay_on_hands', { points, isCure, newHp });
    setBusy(false);
    onClose();
  };

  const clamp = (v) => Math.max(1, Math.min(healCap, v));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="glass-panel rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-fantasy text-base flex items-center gap-2" style={{ color: '#86efac' }}>
            <Heart className="w-4 h-4" /> Lay on Hands
          </h3>
          <button onClick={onClose} className="p-1 rounded text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs mb-4 font-body" style={{ color: 'var(--text-mid)' }}>
          Healing pool: <span className="font-bold" style={{ color: '#86efac' }}>{lohLeft}/{lohMax}</span> points
          · HP: {character.hp_current}/{character.hp_max}
        </div>

        {healCap > 0 ? (
          <div className="mb-4">
            <label className="tavern-section-label block mb-2">Heal amount</label>
            <div className="flex items-center gap-3 mb-2">
              <input
                type="range" min={1} max={healCap} value={Math.min(amount, healCap)}
                onChange={(e) => setAmount(clamp(parseInt(e.target.value) || 1))}
                className="flex-1"
              />
              <span className="font-bold w-10 text-center text-lg" style={{ color: '#86efac' }}>{Math.min(amount, healCap)}</span>
            </div>
            <div className="flex gap-1.5 mb-3">
              {[1, Math.ceil(healCap / 2), healCap].filter((v, i, a) => a.indexOf(v) === i).map(v => (
                <button key={v} onClick={() => setAmount(clamp(v))}
                  className="px-2.5 py-1 rounded text-xs btn-fantasy">
                  {v === healCap ? `Max (${v})` : v}
                </button>
              ))}
            </div>
            <button onClick={() => spend(Math.min(amount, healCap), false)} disabled={busy}
              className="w-full py-2.5 rounded-xl btn-fantasy text-sm font-bold disabled:opacity-50">
              Heal {Math.min(amount, healCap)} HP
            </button>
          </div>
        ) : (
          <div className="text-xs mb-4 font-body italic" style={{ color: 'var(--text-dim)' }}>
            {lohLeft === 0 ? 'Healing pool depleted — recovers on a long rest.' : 'Already at full HP — nothing to heal.'}
          </div>
        )}

        <button onClick={() => spend(1, true)} disabled={busy || lohLeft < 1}
          className="w-full py-2 rounded-xl btn-arcane text-xs disabled:opacity-50 flex items-center justify-center gap-2">
          <Sparkles className="w-3.5 h-3.5" /> Cure disease / neutralize poison (1 point)
        </button>
      </div>
    </div>
  );
}