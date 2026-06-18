import React from 'react';
import { Mountain, Hammer, Flame, Snowflake, Cloud, CloudLightning } from 'lucide-react';

// The six Rune Knight runes (Tasha's Cauldron of Everything).
// Each entry describes the *invoked* (activated) benefit and the temporary
// modifier it applies to the character while active. `modifier` is what gets
// written into character.active_modifiers so the combat engine picks it up.
export const RUNE_KNIGHT_RUNES = [
  {
    id: 'cloud_rune',
    name: 'Cloud Rune',
    icon: Cloud,
    color: '#bae6fd',
    effect: 'Reaction: redirect an attack/effect targeting you to another creature within 30 ft.',
    // Defensive/utility — no flat stat bonus, tracked as an active effect.
    modifier: { source: 'Cloud Rune (invoked)', value: 0, duration: 'until your next turn', effect: 'redirect_attack' },
  },
  {
    id: 'fire_rune',
    name: 'Fire Rune',
    icon: Flame,
    color: '#fca5a5',
    effect: 'On a hit: target makes a STR save or is shackled, takes 2d6 fire & has disadvantage.',
    modifier: { source: 'Fire Rune (invoked)', value: 0, duration: '1 minute', effect: 'fire_shackle', bonus_damage: '2d6 fire' },
  },
  {
    id: 'frost_rune',
    name: 'Frost Rune',
    icon: Snowflake,
    color: '#93c5fd',
    effect: 'Advantage on Strength & Constitution checks for 10 minutes.',
    modifier: { source: 'Frost Rune (invoked)', value: 2, duration: '10 minutes', effect: 'frost_advantage', stats: ['strength', 'constitution'] },
  },
  {
    id: 'stone_rune',
    name: 'Stone Rune',
    icon: Mountain,
    color: '#d6d3d1',
    effect: 'Reaction: force a creature within 30 ft to make a WIS save or be charmed for 1 minute.',
    modifier: { source: 'Stone Rune (invoked)', value: 0, duration: '1 minute', effect: 'stone_charm' },
  },
  {
    id: 'storm_rune',
    name: 'Storm Rune',
    icon: CloudLightning,
    color: '#c4b5fd',
    effect: 'Advantage on Initiative; you & allies gain +1d6 to attacks or saves you choose.',
    modifier: { source: 'Storm Rune (invoked)', value: 0, duration: '1 minute', effect: 'storm_prophecy', bonus: '+1d6 attacks/saves' },
  },
  {
    id: 'hill_rune',
    name: 'Hill Rune',
    icon: Hammer,
    color: '#bef264',
    effect: 'Resistance to poison damage & advantage on saves vs being poisoned.',
    modifier: { source: 'Hill Rune (invoked)', value: 0, duration: '1 minute', effect: 'hill_resilience', resistance: 'poison' },
  },
];

/**
 * RuneKnightPanel — active control panel for the Rune Knight subclass.
 * Each rune can be toggled on/off; toggling adds or removes its temporary
 * effect from character.active_modifiers so it carries into combat resolution.
 *
 * Props:
 *  - character: the current Character entity
 *  - onUpdate(updates): persists changes to the character
 */
export default function RuneKnightPanel({ character, onUpdate }) {
  const isRuneKnight = (character?.subclass || '').toLowerCase().includes('rune knight');
  if (!isRuneKnight) return null;

  const level = character.level || 1;
  const modifiers = character.active_modifiers || [];

  const isActive = (rune) => modifiers.some(m => m.source === rune.modifier.source);

  const toggleRune = (rune) => {
    if (isActive(rune)) {
      onUpdate({ active_modifiers: modifiers.filter(m => m.source !== rune.modifier.source) });
    } else {
      onUpdate({ active_modifiers: [...modifiers, { ...rune.modifier }] });
    }
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(120,200,160,0.2)' }}>
      <div className="flex items-center justify-between px-3 py-2"
        style={{ background: 'rgba(8,40,28,0.6)', borderBottom: '1px solid rgba(120,200,160,0.15)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm">🔨</span>
          <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(150,230,180,0.75)', fontSize: '0.65rem' }}>
            RUNE KNIGHT — ACTIVE RUNES
          </span>
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded font-fantasy"
          style={{ background: 'rgba(20,55,38,0.7)', border: '1px solid rgba(80,200,120,0.25)', color: 'rgba(140,230,170,0.7)', fontSize: '0.58rem' }}>
          Lv.{level}
        </span>
      </div>

      <div className="p-3" style={{ background: 'rgba(8,14,10,0.5)' }}>
        <p className="text-xs mb-2.5 leading-relaxed" style={{ color: 'rgba(160,200,170,0.55)', fontFamily: 'EB Garamond, serif' }}>
          Toggle a rune to invoke its giant magic — active runes apply their temporary effect directly into combat.
        </p>
        <div className="space-y-1.5">
          {RUNE_KNIGHT_RUNES.map((rune) => {
            const active = isActive(rune);
            const Icon = rune.icon;
            return (
              <button key={rune.id}
                onClick={() => toggleRune(rune)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                style={active ? {
                  background: 'rgba(12,45,30,0.7)',
                  border: `1px solid ${rune.color}55`,
                } : {
                  background: 'rgba(12,18,12,0.4)',
                  border: '1px solid rgba(80,140,100,0.18)',
                }}>
                <div className="flex-shrink-0" style={{ color: active ? rune.color : 'rgba(120,160,130,0.4)' }}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-fantasy font-semibold" style={{ color: active ? rune.color : 'rgba(180,210,185,0.7)', fontSize: '0.72rem' }}>
                    {rune.name}
                  </div>
                  <div className="font-body italic leading-snug"
                    style={{ color: active ? `${rune.color}aa` : 'rgba(150,180,155,0.45)', fontSize: '0.64rem' }}>
                    {rune.effect}
                  </div>
                </div>
                <div className="w-3 h-3 rounded-full flex-shrink-0"
                  style={active ? {
                    background: rune.color, boxShadow: `0 0 6px ${rune.color}88`,
                  } : {
                    background: 'rgba(30,45,32,0.6)', border: '1px solid rgba(80,140,100,0.3)',
                  }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}