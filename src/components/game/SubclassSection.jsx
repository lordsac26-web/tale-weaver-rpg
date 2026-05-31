import React from 'react';
import { CLASSES } from './gameData';

// Displays the character's subclass (e.g. "Path of the Totem Warrior") with its
// description and the subclass features unlocked at or below the character's level.
// Data-driven from CLASSES[class].subclasses — works for every class/subclass.
// Renders nothing if the character has no subclass or no matching data.
export default function SubclassSection({ character, Section }) {
  if (!character?.subclass) return null;

  const classData = CLASSES[character.class] || {};
  const sub = (classData.subclasses || []).find(s => s.name === character.subclass);
  if (!sub) return null;

  const level = character.level || 1;
  const unlocked = [];
  Object.entries(sub.features || {}).forEach(([lvl, feats]) => {
    if (parseInt(lvl) <= level) {
      (feats || []).forEach(f => unlocked.push({ name: f, level: parseInt(lvl) }));
    }
  });

  return (
    <Section title={character.subclass} icon="🌿">
      {sub.desc && (
        <p className="text-sm mb-3 leading-relaxed"
          style={{ color: 'rgba(200,180,140,0.75)', fontFamily: 'EB Garamond, serif', lineHeight: '1.7' }}>
          {sub.desc}
        </p>
      )}
      {unlocked.length === 0 ? (
        <div className="text-center py-3 text-sm" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>
          No subclass features unlocked yet at level {level}.
        </div>
      ) : (
        <div className="space-y-1">
          {unlocked.map((f, i) => (
            <div key={i} className="flex items-start gap-2.5 py-2 px-3 rounded-lg"
              style={{ background: 'rgba(12,28,16,0.45)', borderBottom: '1px solid rgba(60,160,90,0.08)' }}>
              <span className="text-xs px-1.5 py-0.5 rounded font-fantasy flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(20,50,28,0.7)', border: '1px solid rgba(80,200,120,0.25)', color: 'rgba(140,230,170,0.7)', fontSize: '0.6rem' }}>
                Lv.{f.level}
              </span>
              <span className="text-sm" style={{ color: 'rgba(210,235,200,0.85)', fontFamily: 'EB Garamond, serif' }}>{f.name}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}