import React, { useEffect, useRef } from 'react';
import { X, Info } from 'lucide-react';
import { useCanonicalSpell } from './contentDetails';

const levelLabel = (level) => Number(level) === 0 ? 'Cantrip' : `Level ${level ?? 1}`;

export default function SpellInfoPane({ spell, spellName, isKnown, isPrepared, onClose }) {
  const closeRef = useRef(null);
  const { detail } = useCanonicalSpell(spell || { name: spellName }, spell || {});
  useEffect(() => { closeRef.current?.focus(); }, []);
  const higher = detail.higher_level_scaling || detail.higher_levels || detail.raw_data?.higher_level;
  const description = detail.description || 'No rules description is available.';

  return <div className="fixed inset-0 z-[70] flex items-end sm:items-stretch sm:justify-end" role="dialog" aria-modal="true" aria-label={`${spellName} details`}>
    <button className="absolute inset-0 bg-black/70" aria-label="Close spell details" onClick={onClose} />
    <section className="relative w-full sm:w-[29rem] max-h-[85dvh] sm:max-h-full rounded-t-2xl sm:rounded-none overflow-hidden flex flex-col glass-panel" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-amber-200/15">
        <div><div className="flex items-center gap-2"><Info className="w-4 h-4 text-amber-300" /><h2 className="font-fantasy text-lg text-amber-100">{spellName}</h2></div><p className="text-xs text-amber-100/60 mt-1">{levelLabel(detail.level)} · {detail.school || 'Spell'}{isPrepared ? ' · Prepared' : isKnown ? ' · Known' : ''}</p></div>
        <button ref={closeRef} onClick={onClose} className="min-w-11 min-h-11 grid place-items-center rounded-lg text-amber-100/70 hover:text-amber-100" aria-label="Close spell details"><X className="w-5 h-5" /></button>
      </header>
      <div className="overflow-y-auto px-5 py-4 space-y-5">
        <section><h3 className="tavern-section-label mb-2">What it does</h3><p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-amber-50/85">{description}</p>{higher && <p className="text-sm mt-3 text-amber-200/80"><strong>At higher levels:</strong> {higher}</p>}</section>
        <section><h3 className="tavern-section-label mb-2">Casting details</h3><dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">{[['Casting time', detail.casting_time], ['Range', detail.range], ['Components', detail.components], ['Duration', detail.duration], ['Attack', detail.attack_type?.replaceAll('_', ' ')], ['Save', detail.save_type?.toUpperCase()], ['Damage', detail.damage_dice && `${detail.damage_dice} ${detail.damage_type || ''}`], ['Healing', detail.heal_dice && `${detail.heal_dice} HP`]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-amber-100/45 text-xs">{label}</dt><dd className="text-amber-50/85 capitalize">{value}</dd></div>)}</dl>
          <div className="flex flex-wrap gap-2 mt-4">{(detail.concentration || detail.requires_concentration) && <span className="badge-arcane px-2 py-1 rounded">Concentration</span>}{detail.ritual && <span className="badge-gold px-2 py-1 rounded">Ritual</span>}</div>
        </section>
      </div>
    </section>
  </div>;
}