import React from 'react';
import { X, Backpack, Archive } from 'lucide-react';

/**
 * Bag of Holding contents pane. Lists every stowed item with its quantity and
 * story provenance; updated automatically on stow/remove intents.
 */
export default function StowedItemsPane({ character, onClose }) {
  if (!character) return null;
  const stowed = Array.isArray(character.stowed_items) ? character.stowed_items : [];
  const byContainer = stowed.reduce((groups, item) => {
    const key = item?.container || 'Container';
    (groups[key] = groups[key] || []).push(item);
    return groups;
  }, {});

  return (
    <div className="border-t" style={{ borderColor: 'rgba(201,169,110,0.25)', background: 'linear-gradient(160deg, rgba(28,14,5,0.98), rgba(18,9,3,0.99))' }}>
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Backpack className="w-4 h-4" style={{ color: 'var(--brass-gold)' }} />
            <span className="font-fantasy text-sm tracking-wide" style={{ color: 'var(--brass-gold)' }}>Bag of Holding</span>
            <span className="text-[0.65rem] italic" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>{stowed.length} stowed item{stowed.length === 1 ? '' : 's'}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded" style={{ color: 'rgba(201,169,110,0.5)' }} aria-label="Close bag pane">
            <X className="w-4 h-4" />
          </button>
        </div>

        {stowed.length ? Object.entries(byContainer).map(([container, items]) => (
          <div key={container} className="rounded-lg p-3" style={{ background: 'rgba(10,6,2,0.65)', border: '1px solid rgba(184,115,51,0.25)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Archive className="w-3.5 h-3.5" style={{ color: 'rgba(232,178,120,0.92)' }} />
              <span className="font-fantasy text-[0.65rem] tracking-widest uppercase" style={{ color: 'rgba(232,178,120,0.92)' }}>{container}</span>
            </div>
            <div className="space-y-1.5">
              {items.map((item, i) => (
                <div key={`${item.name}-${i}`} className="text-xs leading-snug" style={{ fontFamily: 'EB Garamond, serif' }}>
                  <span className="font-semibold" style={{ color: 'var(--brass-gold)' }}>
                    {item.name}{Number(item.quantity) > 1 ? ` ×${item.quantity}` : ''}
                  </span>
                  {item.description ? <span style={{ color: 'rgba(220,185,135,0.8)' }}> — {String(item.description).slice(0, 140)}</span> : null}
                  <span className="italic" style={{ color: 'rgba(184,155,110,0.55)' }}>
                    {item.is_identified === false ? ' · unidentified' : ''}
                    {item.provenance?.acquired_at ? ` · acquired ${String(item.provenance.acquired_at).slice(0, 10)}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )) : (
          <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(10,6,2,0.65)', border: '1px dashed rgba(184,115,51,0.3)' }}>
            <p className="text-xs italic" style={{ color: 'rgba(184,155,110,0.6)', fontFamily: 'EB Garamond, serif' }}>
              The extradimensional space is silent — nothing is stowed yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}