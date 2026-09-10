import React from 'react';
import { X, Activity, Ban, Sparkles, Gem, Zap } from 'lucide-react';
import { evaluateActiveEffects } from '@/lib/activeEffects';

/**
 * Full-time status truth panel. Reads the same authoritative active-effect
 * state the Ask the DM queries and the story engine use — every condition
 * with its source, mechanical effect, and remaining duration.
 */
export default function StatusTruthPanel({ character, session, onClose }) {
  if (!character) return null;
  const truth = evaluateActiveEffects({ character, session });

  const Section = ({ icon: Icon, label, color, children }) => (
    <div className="rounded-lg p-3" style={{ background: 'rgba(10,6,2,0.65)', border: '1px solid rgba(184,115,51,0.25)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="font-fantasy text-[0.65rem] tracking-widest uppercase" style={{ color: 'rgba(232,178,120,0.92)' }}>{label}</span>
      </div>
      {children}
    </div>
  );

  return (
    <div className="border-t" style={{ borderColor: 'rgba(201,169,110,0.25)', background: 'linear-gradient(160deg, rgba(28,14,5,0.98), rgba(18,9,3,0.99))' }}>
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: 'var(--brass-gold)' }} />
            <span className="font-fantasy text-sm tracking-wide" style={{ color: 'var(--brass-gold)' }}>Status Truth</span>
            <span className="text-[0.65rem] italic" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>authoritative active effects</span>
          </div>
          <button onClick={onClose} className="p-1 rounded" style={{ color: 'rgba(201,169,110,0.5)' }} aria-label="Close status panel">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <Section icon={Sparkles} label="Active Effects" color="#86efac">
            {truth.active.length ? (
              <div className="space-y-1.5">
                {truth.active.map((effect, i) => (
                  <div key={i} className="text-xs leading-snug" style={{ fontFamily: 'EB Garamond, serif' }}>
                    <span className="font-semibold" style={{ color: 'var(--brass-gold)' }}>{effect.name}</span>
                    <span style={{ color: 'rgba(220,185,135,0.85)' }}> — {effect.mechanical_effect}</span>
                    <span className="italic" style={{ color: 'rgba(184,155,110,0.6)' }}> · {effect.remaining_duration} · source: {effect.source}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs italic" style={{ color: 'rgba(184,155,110,0.6)', fontFamily: 'EB Garamond, serif' }}>No active effects.</p>
            )}
          </Section>

          <Section icon={Ban} label="Hindrances" color="#fca5a5">
            {truth.hindrances.length ? (
              <div className="space-y-1.5">
                {truth.hindrances.map((effect, i) => (
                  <div key={i} className="text-xs leading-snug" style={{ fontFamily: 'EB Garamond, serif' }}>
                    <span className="font-semibold" style={{ color: '#fca5a5' }}>{effect.name}</span>
                    <span style={{ color: 'rgba(220,185,135,0.85)' }}> — {effect.mechanical_effect}</span>
                    <span className="italic" style={{ color: 'rgba(184,155,110,0.6)' }}> · {effect.remaining_duration}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs italic" style={{ color: 'rgba(184,155,110,0.6)', fontFamily: 'EB Garamond, serif' }}>Nothing is hindering you.</p>
            )}
          </Section>

          <Section icon={Zap} label="Spell Slots" color="#c4b5fd">
            {truth.spell_slots.length ? (
              <div className="space-y-1.5">
                {truth.spell_slots.map((slot) => (
                  <div key={slot.level} className="flex items-center gap-2 text-xs" style={{ fontFamily: 'EB Garamond, serif' }}>
                    <span className="w-16" style={{ color: 'rgba(220,185,135,0.9)' }}>Level {slot.level}</span>
                    <span className="font-bold" style={{ color: 'var(--brass-gold)' }}>{slot.remaining}/{slot.max}</span>
                    <span style={{ color: 'rgba(184,155,110,0.6)' }}>({slot.used} used)</span>
                  </div>
                ))}
                <p className="text-[0.65rem] italic" style={{ color: 'rgba(184,155,110,0.5)' }}>{truth.slot_derivation}</p>
              </div>
            ) : (
              <p className="text-xs italic" style={{ color: 'rgba(184,155,110,0.6)', fontFamily: 'EB Garamond, serif' }}>No spell slots from current classes.</p>
            )}
          </Section>

          <Section icon={Gem} label="Attunements" color="#93c5fd">
            {truth.attunements.length ? (
              <p className="text-xs" style={{ fontFamily: 'EB Garamond, serif', color: 'rgba(220,185,135,0.9)' }}>{truth.attunements.join(', ')}</p>
            ) : (
              <p className="text-xs italic" style={{ color: 'rgba(184,155,110,0.6)', fontFamily: 'EB Garamond, serif' }}>Not attuned to any magic items.</p>
            )}
            {truth.exhaustion_level > 0 && (
              <p className="text-xs mt-2" style={{ color: '#fca5a5', fontFamily: 'EB Garamond, serif' }}>Exhaustion level {truth.exhaustion_level}</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}