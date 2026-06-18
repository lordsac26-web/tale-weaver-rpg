import React, { useState, useEffect } from 'react';
import { CLASSES } from './gameData';
import { base44 } from '@/api/base44Client';

// Splits the Subclass entity's markdown `description` into per-feature blocks.
// The ingested format uses "##### Feature Name" headers followed by the
// explanation of what the ability does and how to use it.
function parseFeatureBlocks(description) {
  if (!description) return [];
  const parts = description.split(/#{2,6}\s+/g).map(s => s.trim()).filter(Boolean);
  const blocks = [];
  parts.forEach(part => {
    const newlineIdx = part.indexOf('\n');
    if (newlineIdx === -1) return; // intro paragraph with no header — skip
    const name = part.slice(0, newlineIdx).trim();
    const body = part.slice(newlineIdx + 1).trim().replace(/[*]/g, '');
    if (name && body) blocks.push({ name, body });
  });
  return blocks;
}

// Displays the character's subclass (e.g. "Rune Knight") with a description and
// the subclass features unlocked at or below the character's level — including
// the detailed "how to use" text pulled from the ingested Subclass entity.
// Renders nothing if the character has no subclass.
export default function SubclassSection({ character, Section }) {
  const [entity, setEntity] = useState(null);

  useEffect(() => {
    let active = true;
    if (!character?.subclass || !character?.class) { setEntity(null); return; }
    base44.entities.Subclass.filter({ class_name: character.class, name: character.subclass }, 'name', 1)
      .then(res => { if (active) setEntity(res?.[0] || null); })
      .catch(() => { if (active) setEntity(null); });
    return () => { active = false; };
  }, [character?.subclass, character?.class]);

  if (!character?.subclass) return null;

  const classData = CLASSES[character.class] || {};
  const staticSub = (classData.subclasses || []).find(s => s.name === character.subclass);
  const level = character.level || 1;

  // Prefer the ingested entity's per-feature descriptions ("how to use them").
  const featureBlocks = parseFeatureBlocks(entity?.description);
  const blockByName = Object.fromEntries(featureBlocks.map(b => [b.name.toLowerCase(), b.body]));

  // Build the unlocked feature list from the entity's features_by_level
  // (preferred) or fall back to the static CLASSES data.
  const featuresByLevel = entity?.features_by_level || staticSub?.features || {};
  const unlocked = [];
  Object.entries(featuresByLevel).forEach(([lvl, feats]) => {
    if (parseInt(lvl) <= level) {
      (Array.isArray(feats) ? feats : [feats]).forEach(f => {
        const name = typeof f === 'string' ? f : (f?.name || '');
        if (name) unlocked.push({ name, level: parseInt(lvl), desc: blockByName[name.toLowerCase()] || '' });
      });
    }
  });

  const intro = staticSub?.desc || entity?.short_description || '';

  return (
    <Section title={character.subclass} icon="🌿">
      {intro && (
        <p className="text-sm mb-3 leading-relaxed"
          style={{ color: 'rgba(200,180,140,0.75)', fontFamily: 'EB Garamond, serif', lineHeight: '1.7' }}>
          {intro}
        </p>
      )}
      {unlocked.length === 0 ? (
        <div className="text-center py-3 text-sm" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>
          No subclass features unlocked yet at level {level}.
        </div>
      ) : (
        <div className="space-y-2">
          {unlocked.map((f, i) => (
            <div key={i} className="py-2 px-3 rounded-lg"
              style={{ background: 'rgba(12,28,16,0.45)', border: '1px solid rgba(60,160,90,0.12)' }}>
              <div className="flex items-start gap-2.5">
                <span className="text-xs px-1.5 py-0.5 rounded font-fantasy flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(20,50,28,0.7)', border: '1px solid rgba(80,200,120,0.25)', color: 'rgba(140,230,170,0.7)', fontSize: '0.6rem' }}>
                  Lv.{f.level}
                </span>
                <span className="text-sm font-fantasy" style={{ color: 'rgba(210,235,200,0.9)' }}>{f.name}</span>
              </div>
              {f.desc && (
                <p className="text-xs mt-1.5 ml-1 leading-relaxed whitespace-pre-line"
                  style={{ color: 'rgba(190,215,180,0.6)', fontFamily: 'EB Garamond, serif', lineHeight: '1.6' }}>
                  {f.desc}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}