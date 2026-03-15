import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Sparkles, Circle, CheckCircle2, Loader2, Book, Zap, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { calcStatMod, PROFICIENCY_BY_LEVEL } from '@/components/game/gameData';

const SPELL_SLOTS_BY_LEVEL = {
  1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  2: [3, 0, 0, 0, 0, 0, 0, 0, 0],
  3: [4, 2, 0, 0, 0, 0, 0, 0, 0],
  4: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  5: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  7: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
  10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

const SPELLCASTING_ABILITY = {
  Wizard: 'intelligence',
  Sorcerer: 'charisma',
  Warlock: 'charisma',
  Cleric: 'wisdom',
  Druid: 'wisdom',
  Bard: 'charisma',
  Paladin: 'charisma',
  Ranger: 'wisdom',
  Artificer: 'intelligence',
};

const SCHOOL_COLORS = {
  Abjuration: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(96,165,250,0.4)', color: '#93c5fd' },
  Conjuration: { bg: 'rgba(168,85,247,0.15)', border: 'rgba(192,132,252,0.4)', color: '#d8b4fe' },
  Divination: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(250,204,21,0.4)', color: '#fde047' },
  Enchantment: { bg: 'rgba(236,72,153,0.15)', border: 'rgba(244,114,182,0.4)', color: '#f9a8d4' },
  Evocation: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(248,113,113,0.4)', color: '#fca5a5' },
  Illusion: { bg: 'rgba(139,92,246,0.15)', border: 'rgba(167,139,250,0.4)', color: '#c4b5fd' },
  Necromancy: { bg: 'rgba(71,85,105,0.15)', border: 'rgba(100,116,139,0.4)', color: '#cbd5e1' },
  Transmutation: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(74,222,128,0.4)', color: '#86efac' },
};

export default function SpellManagement() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const characterId = urlParams.get('character_id');

  const [character, setCharacter] = useState(null);
  const [spells, setSpells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterSchool, setFilterSchool] = useState('all');
  const [showPreparedOnly, setShowPreparedOnly] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const chars = await base44.entities.Character.filter({ id: characterId });
    const char = chars[0];
    if (!char) { navigate(-1); return; }
    setCharacter(char);

    // Load all known spells
    const knownSpells = char.spells_known || [];
    const allSpells = await base44.entities.Spell.list('-level', 500);
    const characterSpells = allSpells.filter(s => knownSpells.includes(s.name));
    setSpells(characterSpells);
    setLoading(false);
  };

  const spellcastingAbility = SPELLCASTING_ABILITY[character?.class] || 'intelligence';
  const abilityMod = character ? calcStatMod(character[spellcastingAbility]) : 0;
  const profBonus = character ? PROFICIENCY_BY_LEVEL[(character.level || 1) - 1] || 2 : 2;
  const spellSaveDC = 8 + abilityMod + profBonus;
  const spellAttackBonus = abilityMod + profBonus;

  const maxSlots = SPELL_SLOTS_BY_LEVEL[character?.level || 1] || [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const currentSlots = character?.spell_slots || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };

  const togglePrepared = async (spellName) => {
    const prepared = character.prepared_spells || [];
    const newPrepared = prepared.includes(spellName)
      ? prepared.filter(n => n !== spellName)
      : [...prepared, spellName];
    
    setSaving(true);
    await base44.entities.Character.update(characterId, { prepared_spells: newPrepared });
    setCharacter({ ...character, prepared_spells: newPrepared });
    setSaving(false);
  };

  const useSpellSlot = async (level) => {
    if (currentSlots[level] >= maxSlots[level - 1]) return;
    const newSlots = { ...currentSlots, [level]: (currentSlots[level] || 0) + 1 };
    setSaving(true);
    await base44.entities.Character.update(characterId, { spell_slots: newSlots });
    setCharacter({ ...character, spell_slots: newSlots });
    setSaving(false);
  };

  const restoreSlot = async (level) => {
    if (currentSlots[level] <= 0) return;
    const newSlots = { ...currentSlots, [level]: Math.max(0, currentSlots[level] - 1) };
    setSaving(true);
    await base44.entities.Character.update(characterId, { spell_slots: newSlots });
    setCharacter({ ...character, spell_slots: newSlots });
    setSaving(false);
  };

  const restoreAllSlots = async () => {
    const resetSlots = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    setSaving(true);
    await base44.entities.Character.update(characterId, { spell_slots: resetSlots });
    setCharacter({ ...character, spell_slots: resetSlots });
    setSaving(false);
  };

  const filteredSpells = spells.filter(s => {
    const matchLevel = filterLevel === 'all' || s.level === parseInt(filterLevel);
    const matchSchool = filterSchool === 'all' || s.school === filterSchool;
    const matchPrepared = !showPreparedOnly || (character?.prepared_spells || []).includes(s.name);
    return matchLevel && matchSchool && matchPrepared;
  });

  const spellsByLevel = {};
  filteredSpells.forEach(s => {
    const lvl = s.level || 0;
    if (!spellsByLevel[lvl]) spellsByLevel[lvl] = [];
    spellsByLevel[lvl].push(s);
  });

  const schools = [...new Set(spells.map(s => s.school).filter(Boolean))];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center parchment-bg">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#c9a96e' }} />
    </div>
  );

  return (
    <div className="min-h-screen parchment-bg flex flex-col" style={{ color: '#e8d5b7' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: 'rgba(8,5,2,0.95)', borderBottom: '1px solid rgba(140,80,220,0.3)' }}>
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg" style={{ color: 'rgba(201,169,110,0.5)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Sparkles className="w-5 h-5" style={{ color: '#c084fc' }} />
        <div className="flex-1">
          <h1 className="font-fantasy font-bold text-base" style={{ color: '#c084fc' }}>Spell Management</h1>
          <p className="text-xs" style={{ color: 'rgba(201,169,110,0.4)' }}>
            {character?.name} · Lvl {character?.level} {character?.class}
          </p>
        </div>
        <button onClick={restoreAllSlots} disabled={saving}
          className="px-3 py-1.5 rounded-lg text-xs font-fantasy btn-arcane disabled:opacity-50">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : '🌙'} Long Rest
        </button>
      </div>

      {/* Spellcasting Stats */}
      <div className="px-4 py-3 flex-shrink-0"
        style={{ background: 'rgba(55,25,90,0.2)', borderBottom: '1px solid rgba(140,80,220,0.15)' }}>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(30,15,50,0.5)', border: '1px solid rgba(140,80,220,0.2)' }}>
            <div className="text-xs tavern-section-label mb-1">Spellcasting Ability</div>
            <div className="font-fantasy font-bold text-lg" style={{ color: '#c084fc' }}>
              {spellcastingAbility.toUpperCase().slice(0, 3)}
            </div>
            <div className="text-xs" style={{ color: 'rgba(192,132,252,0.6)' }}>+{abilityMod}</div>
          </div>
          <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(30,15,50,0.5)', border: '1px solid rgba(140,80,220,0.2)' }}>
            <div className="text-xs tavern-section-label mb-1">Spell Save DC</div>
            <div className="font-fantasy font-bold text-lg" style={{ color: '#c084fc' }}>{spellSaveDC}</div>
          </div>
          <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(30,15,50,0.5)', border: '1px solid rgba(140,80,220,0.2)' }}>
            <div className="text-xs tavern-section-label mb-1">Spell Attack</div>
            <div className="font-fantasy font-bold text-lg" style={{ color: '#c084fc' }}>+{spellAttackBonus}</div>
          </div>
        </div>
      </div>

      {/* Spell Slots */}
      <div className="px-4 py-3 flex-shrink-0"
        style={{ background: 'rgba(25,15,40,0.4)', borderBottom: '1px solid rgba(140,80,220,0.12)' }}>
        <div className="tavern-section-label mb-2">Spell Slots</div>
        <div className="grid grid-cols-9 gap-1.5">
          {maxSlots.map((max, idx) => {
            const level = idx + 1;
            const used = currentSlots[level] || 0;
            if (max === 0) return <div key={level} />;
            return (
              <div key={level} className="text-center">
                <div className="text-xs font-fantasy mb-1" style={{ color: 'rgba(192,132,252,0.5)' }}>{level}</div>
                <div className="flex flex-col gap-1">
                  {Array.from({ length: max }).map((_, i) => (
                    <button key={i}
                      onClick={() => i < used ? restoreSlot(level) : useSpellSlot(level)}
                      className="h-4 rounded transition-all"
                      style={{
                        background: i < used ? 'rgba(30,15,50,0.6)' : 'rgba(140,80,220,0.5)',
                        border: `1px solid ${i < used ? 'rgba(100,60,180,0.3)' : 'rgba(192,132,252,0.6)'}`,
                        boxShadow: i >= used ? '0 0 8px rgba(192,132,252,0.3)' : 'none',
                      }} />
                  ))}
                </div>
                <div className="text-xs mt-1 font-fantasy" style={{ color: used > 0 ? 'rgba(180,140,90,0.4)' : '#c084fc' }}>
                  {max - used}/{max}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 flex gap-2 items-center flex-shrink-0 overflow-x-auto"
        style={{ background: 'rgba(10,6,3,0.8)', borderBottom: '1px solid rgba(180,140,90,0.08)' }}>
        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
          className="rounded-lg text-xs px-2 py-1.5 select-fantasy">
          <option value="all">All Levels</option>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => (
            <option key={l} value={l}>Level {l}</option>
          ))}
        </select>
        <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)}
          className="rounded-lg text-xs px-2 py-1.5 select-fantasy">
          <option value="all">All Schools</option>
          {schools.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowPreparedOnly(v => !v)}
          className="px-2.5 py-1.5 rounded-lg text-xs font-fantasy transition-all"
          style={showPreparedOnly ? {
            background: 'rgba(80,40,120,0.6)',
            border: '1px solid rgba(140,80,220,0.5)',
            color: '#c084fc',
          } : {
            background: 'rgba(15,10,5,0.5)',
            border: '1px solid rgba(180,140,90,0.12)',
            color: 'rgba(180,140,90,0.4)',
          }}>
          <Book className="w-3 h-3 inline mr-1" /> Prepared Only
        </button>
      </div>

      {/* Spell List */}
      <div className="flex-1 overflow-y-auto p-4">
        {Object.keys(spellsByLevel).length === 0 ? (
          <div className="text-center py-20">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-10" style={{ color: '#c084fc' }} />
            <div className="font-fantasy text-sm" style={{ color: 'rgba(192,132,252,0.25)' }}>No spells found</div>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.keys(spellsByLevel).sort((a, b) => parseInt(a) - parseInt(b)).map(lvl => (
              <div key={lvl}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="font-fantasy font-bold text-sm" style={{ color: '#c084fc' }}>
                    {lvl === '0' ? 'Cantrips' : `Level ${lvl}`}
                  </div>
                  <div className="flex-1 h-px" style={{ background: 'rgba(140,80,220,0.2)' }} />
                  <div className="text-xs font-fantasy" style={{ color: 'rgba(192,132,252,0.4)' }}>
                    {spellsByLevel[lvl].length} spell{spellsByLevel[lvl].length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {spellsByLevel[lvl].map(spell => {
                    const isPrepared = (character?.prepared_spells || []).includes(spell.name);
                    const schoolStyle = SCHOOL_COLORS[spell.school] || SCHOOL_COLORS.Abjuration;
                    return (
                      <motion.div key={spell.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-3 rounded-xl transition-all cursor-pointer"
                        onClick={() => togglePrepared(spell.name)}
                        style={{
                          background: isPrepared ? schoolStyle.bg : 'rgba(15,10,5,0.6)',
                          border: `1px solid ${isPrepared ? schoolStyle.border : 'rgba(180,140,90,0.12)'}`,
                          boxShadow: isPrepared ? `0 0 12px ${schoolStyle.border}` : 'none',
                        }}>
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-0.5">
                            {isPrepared ? (
                              <CheckCircle2 className="w-4 h-4" style={{ color: schoolStyle.color }} />
                            ) : (
                              <Circle className="w-4 h-4" style={{ color: 'rgba(180,140,90,0.2)' }} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-fantasy font-bold text-sm truncate"
                                style={{ color: isPrepared ? schoolStyle.color : 'rgba(201,169,110,0.7)' }}>
                                {spell.name}
                              </span>
                              {spell.concentration && (
                                <span className="text-xs" style={{ color: 'rgba(251,191,36,0.7)' }}>⚡</span>
                              )}
                              {spell.ritual && (
                                <span className="text-xs" style={{ color: 'rgba(168,85,247,0.7)' }}>📜</span>
                              )}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'rgba(180,140,90,0.5)' }}>
                              {spell.school} · {spell.casting_time}
                            </div>
                            {spell.description && (
                              <p className="text-xs mt-1 line-clamp-2" style={{ color: 'rgba(220,190,140,0.7)', fontFamily: 'EB Garamond, serif' }}>
                                {spell.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prepared Count Footer */}
      <div className="px-4 py-2 flex items-center justify-between flex-shrink-0"
        style={{ background: 'rgba(8,5,2,0.95)', borderTop: '1px solid rgba(140,80,220,0.2)' }}>
        <div className="text-xs" style={{ color: 'rgba(180,140,90,0.5)' }}>
          <Info className="w-3 h-3 inline mr-1" />
          Click spells to prepare/unprepare
        </div>
        <div className="text-xs font-fantasy" style={{ color: '#c084fc' }}>
          {(character?.prepared_spells || []).length} prepared
        </div>
      </div>
    </div>
  );
}