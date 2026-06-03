import React, { useState, useMemo } from 'react';
import { Search, BookOpen, Star, CheckCircle, Moon, RotateCcw, Flame } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SpellSlotTracker from './SpellSlotTracker';
import SpellCard from './SpellCard';
import { SPELL_DETAILS } from './spellData';
import {
  getCombinedSpellListWithSource,
  getMulticlassSpellSlots,
  getSpellcastingEntries,
  getTotalCharacterLevel,
  getTotalProficiencyBonus,
  getPreparationLimits,
} from './multiclassUtils';
import { calcStatMod } from './gameData';

const LEVEL_LABELS = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

export default function SpellbookTab({ character, onUpdateCharacter }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [activeSection, setActiveSection] = useState('prepared');
  const [castFlash, setCastFlash] = useState(null);

  // All hooks BEFORE any early returns
  const preparedSpells = new Set(character?.spells_prepared || []);
  const knownSpells = new Set(character?.spells_known || []);
  const currentSlots = character?.spell_slots || {};

  const spellcastingEntries = useMemo(() => character ? getSpellcastingEntries(character) : [], [character]);
  const totalLevel = character ? getTotalCharacterLevel(character) : 1;
  const profBonus = character ? getTotalProficiencyBonus(character) : 2;
  const slotMaxArr = useMemo(() => character ? getMulticlassSpellSlots(character) : [0,0,0,0,0,0,0,0,0], [character]);

  // Build per-entry stats for the multiclass stats panel
  const entryStats = useMemo(() => {
    return spellcastingEntries.map(entry => {
      const ability = entry.ability;
      const score = character?.[ability] || 10;
      const mod = calcStatMod(score);
      return {
        className: entry.className,
        subclass: entry.subclass,
        levels: entry.levels,
        ability,
        score,
        mod,
        saveDC: 8 + mod + profBonus,
        attackBonus: mod + profBonus,
      };
    });
  }, [spellcastingEntries, character, profBonus]);

  // Preparation limits per class
  const prepLimits = useMemo(() => character ? getPreparationLimits(character) : [], [character]);
  const totalMaxPrepared = prepLimits.reduce((sum, p) => sum + p.maxPrepared, 0);
  const isPreparationCaster = prepLimits.length > 0;

  // Combined spell list with source class tags
  const allAvailableSpells = useMemo(() => character ? getCombinedSpellListWithSource(character) : [], [character]);

  // Unique source classes for the filter dropdown
  const sourceClasses = useMemo(() => {
    const set = new Set(allAvailableSpells.map(s => s.sourceClass));
    return [...set];
  }, [allAvailableSpells]);

  const isMulticlass = sourceClasses.length > 1;
  const spellCardCharacter = character ? { ...character, level: totalLevel } : null;

  // Build source lookup for known/prepared spells (must be before early returns)
  const spellSourceMap = useMemo(() => {
    const map = {};
    allAvailableSpells.forEach(s => { if (!map[s.name]) map[s.name] = s.sourceClass; });
    return map;
  }, [allAvailableSpells]);

  if (!character) return null;

  const hasSpellcasting = spellcastingEntries.length > 0;

  if (!hasSpellcasting) {
    return (
      <div className="text-center py-12 text-slate-500">
        <BookOpen className="w-10 h-10 opacity-20 mx-auto mb-3" />
        <p className="text-sm">{character.class} cannot cast spells.</p>
      </div>
    );
  }

  // Slot helpers
  const getRemainingSlots = (level) => {
    if (level === 0) return Infinity;
    const max = slotMaxArr[level - 1] || 0;
    const used = currentSlots[`level_${level}`] || 0;
    return Math.max(0, max - used);
  };

  const findLowestAvailableSlot = (spellLevel) => {
    if (spellLevel === 0) return null;
    for (let lvl = spellLevel; lvl <= 9; lvl++) {
      if (getRemainingSlots(lvl) > 0) return lvl;
    }
    return null;
  };

  // Actions
  const toggleKnown = (spellName) => {
    const updated = knownSpells.has(spellName)
      ? [...knownSpells].filter(s => s !== spellName)
      : [...knownSpells, spellName];
    onUpdateCharacter({ spells_known: updated });
  };

  const togglePrepared = (spellName) => {
    const isPrepared = preparedSpells.has(spellName);
    if (!isPrepared && isPreparationCaster && totalMaxPrepared < 999 && preparedSpells.size >= totalMaxPrepared) {
      alert(`You can only prepare ${totalMaxPrepared} spells at once. Unprepare a spell first.`);
      return;
    }
    const updated = isPrepared
      ? [...preparedSpells].filter(s => s !== spellName)
      : [...preparedSpells, spellName];
    const finalKnown = knownSpells.has(spellName) ? [...knownSpells] : [...knownSpells, spellName];
    onUpdateCharacter({ spells_prepared: updated, spells_known: finalKnown });
  };

  const handleCastSpell = (spellName) => {
    const details = SPELL_DETAILS[spellName] || {};
    const spellLevel = details.level ?? 1;
    if (spellLevel === 0) return;
    const slotLevel = findLowestAvailableSlot(spellLevel);
    if (slotLevel === null) return;
    const slotKey = `level_${slotLevel}`;
    const newUsed = (currentSlots[slotKey] || 0) + 1;
    onUpdateCharacter({ spell_slots: { ...currentSlots, [slotKey]: newUsed } });
    setCastFlash(spellName);
    setTimeout(() => setCastFlash(null), 800);
  };

  // Filtering
  const filterSpell = (s) => {
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterLevel !== 'all' && s.level !== parseInt(filterLevel)) return false;
    if (filterSource !== 'all' && s.sourceClass !== filterSource) return false;
    if (filterType !== 'all') {
      const d = SPELL_DETAILS[s.name];
      if (filterType === 'damage' && !d?.damage_dice) return false;
      if (filterType === 'healing' && d?.attack_type !== 'healing') return false;
      if (filterType === 'utility' && !d?.is_utility) return false;
      if (filterType === 'concentration' && !(d?.requires_concentration || d?.concentration)) return false;
    }
    return true;
  };

  const preparedList = allAvailableSpells.filter(s => preparedSpells.has(s.name) && filterSpell(s));
  const knownList = allAvailableSpells.filter(s => knownSpells.has(s.name) && !preparedSpells.has(s.name) && filterSpell(s));
  const availableList = allAvailableSpells.filter(s => !knownSpells.has(s.name) && filterSpell(s));

  // Level range for rendering
  const levelRange = [];
  for (let i = 0; i <= 9; i++) {
    if (i === 0 || (slotMaxArr[i - 1] || 0) > 0) levelRange.push(i);
  }

  return (
    <div className="space-y-4">
      {/* Per-class spellcasting stats (multiclass shows each class) */}
      {entryStats.length === 1 ? (
        <SingleCasterStats entry={entryStats[0]} />
      ) : (
        <MultiCasterStats entries={entryStats} />
      )}

      {/* Spell source info */}
      {spellcastingEntries.length > 0 && (
        <div className="text-xs text-blue-300/70 bg-blue-900/10 border border-blue-700/20 rounded-lg px-3 py-2">
          Spell sources: {spellcastingEntries.map(entry => `${entry.className}${entry.subclass ? ` (${entry.subclass})` : ''} Lv.${entry.levels}`).join(' · ')}
        </div>
      )}

      {/* Preparation info */}
      {isPreparationCaster && (
        <div className="text-xs text-purple-400/70 bg-purple-900/10 border border-purple-700/20 rounded-lg px-3 py-2">
          📖 {prepLimits.map(p => `${p.className}: max ${p.maxPrepared} (Lv.${p.classLevel} + ${p.abilityMod >= 0 ? '+' : ''}${p.abilityMod} ${p.ability.slice(0,3).toUpperCase()})`).join(' · ')}
          {' '}— Total max prepared: {totalMaxPrepared}. Currently: {preparedSpells.size}
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-1 bg-slate-800/40 p-1 rounded-lg">
        {[
          ['prepared', `Prepared (${preparedSpells.size})`],
          ['known', `Known (${knownSpells.size})`],
          ['available', 'Spellbook'],
          ['slots', 'Spell Slots']
        ].map(([key, label]) => (
          <button key={key} onClick={() => setActiveSection(key)}
            className={`flex-1 py-1.5 text-xs rounded-md transition-all ${activeSection === key ? 'bg-purple-800/60 text-purple-200 border border-purple-700/40' : 'text-slate-400 hover:text-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Spell Slots Panel */}
      {activeSection === 'slots' && (
        <div className="space-y-3">
          <SpellSlotTracker character={character} onUpdateSlots={(newSlots) => onUpdateCharacter({ spell_slots: newSlots })} />
          <div className="flex gap-2 pt-2">
            <RestButton label="Short Rest" restType="short" character={character} onUpdateCharacter={onUpdateCharacter}
              style={{ background: 'rgba(60,30,8,0.4)', border: '1px solid rgba(184,115,51,0.25)', color: 'rgba(201,169,110,0.7)' }}
              icon={<RotateCcw className="w-3.5 h-3.5" />} />
            <RestButton label="Long Rest" restType="long" character={character} onUpdateCharacter={onUpdateCharacter}
              style={{ background: 'rgba(38,10,70,0.4)', border: '1px solid rgba(130,70,210,0.3)', color: 'rgba(192,132,252,0.7)' }}
              icon={<Moon className="w-3.5 h-3.5" />} />
          </div>
        </div>
      )}

      {/* Filters */}
      {activeSection !== 'slots' && (
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search spells..."
              className="w-full pl-7 pr-3 py-1.5 bg-slate-800/60 border border-slate-700/40 rounded-lg text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-purple-600/50" />
          </div>
          <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
            className="bg-slate-800/60 border border-slate-700/40 rounded-lg text-xs text-slate-400 px-2 py-1.5 outline-none">
            <option value="all">All Levels</option>
            {levelRange.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
          </select>
          {isMulticlass && (
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
              className="bg-slate-800/60 border border-slate-700/40 rounded-lg text-xs text-slate-400 px-2 py-1.5 outline-none">
              <option value="all">All Classes</option>
              {sourceClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="bg-slate-800/60 border border-slate-700/40 rounded-lg text-xs text-slate-400 px-2 py-1.5 outline-none">
            <option value="all">All Types</option>
            <option value="damage">Damage</option>
            <option value="healing">Healing</option>
            <option value="utility">Utility</option>
            <option value="concentration">Concentration</option>
          </select>
        </div>
      )}

      {/* Spell Lists */}
      {activeSection !== 'slots' && (
        <div className="space-y-3">
          {activeSection === 'prepared' && (
            <SpellLevelGroups
              spells={preparedList} icon={<CheckCircle className="w-3 h-3" />}
              colorClass="text-purple-400/70" levelRange={levelRange}
              slotMaxArr={slotMaxArr} getRemainingSlots={getRemainingSlots}
              renderCard={(s) => {
                const spellLvl = SPELL_DETAILS[s.name]?.level ?? s.level;
                const canCast = spellLvl === 0 || findLowestAvailableSlot(spellLvl) !== null;
                return (
                  <div key={s.name} className={`transition-all ${castFlash === s.name ? 'crit-flash rounded-xl' : ''}`}>
                    <SpellCard spellName={s.name} character={spellCardCharacter} isKnown isPrepared
                      onTogglePrepared={togglePrepared}
                      onCast={spellLvl > 0 ? handleCastSpell : undefined}
                      canCast={canCast}
                      sourceClass={isMulticlass ? s.sourceClass : undefined} />
                  </div>
                );
              }}
              emptyMsg={preparedSpells.size === 0 ? 'No spells prepared. Click the ✓ icon on spells to prepare them.' : 'No spells match your filters.'}
            />
          )}
          {activeSection === 'known' && (
            <SpellLevelGroups
              spells={knownList} icon={<Star className="w-3 h-3" />}
              colorClass="text-amber-400/70" levelRange={levelRange}
              renderCard={(s) => (
                <SpellCard key={s.name} spellName={s.name} character={spellCardCharacter}
                  isKnown isPrepared={false}
                  onTogglePrepared={togglePrepared}
                  sourceClass={isMulticlass ? s.sourceClass : undefined} />
              )}
              emptyMsg={knownSpells.size === 0 ? 'No spells known. Browse the Spellbook tab to learn spells.' : 'No spells match your filters.'}
            />
          )}
          {activeSection === 'available' && (
            <SpellLevelGroups
              spells={availableList} icon={<BookOpen className="w-3 h-3" />}
              colorClass="text-slate-400" levelRange={levelRange}
              renderCard={(s) => (
                <SpellCard key={s.name} spellName={s.name} character={spellCardCharacter}
                  isKnown={false} isPrepared={false}
                  onToggleKnown={toggleKnown}
                  sourceClass={isMulticlass ? s.sourceClass : undefined} />
              )}
              emptyMsg="No additional spells available for your filters."
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function SingleCasterStats({ entry }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-purple-900/10 border border-purple-700/30 rounded-xl">
      <StatCell label="Ability" value={entry.ability} capitalize />
      <StatCell label="Score / Mod" value={`${entry.score} / ${entry.mod >= 0 ? '+' : ''}${entry.mod}`} />
      <StatCell label="Save DC" value={entry.saveDC} />
      <StatCell label="Spell Attack" value={`+${entry.attackBonus}`} />
    </div>
  );
}

function MultiCasterStats({ entries }) {
  return (
    <div className="space-y-2">
      {entries.map(entry => (
        <div key={entry.className} className="p-3 bg-purple-900/10 border border-purple-700/30 rounded-xl">
          <div className="text-xs font-fantasy font-bold text-purple-200 mb-2">
            {entry.className}{entry.subclass ? ` (${entry.subclass})` : ''} — Lv.{entry.levels}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCell label="Ability" value={entry.ability} capitalize small />
            <StatCell label="Score / Mod" value={`${entry.score} / ${entry.mod >= 0 ? '+' : ''}${entry.mod}`} small />
            <StatCell label="Save DC" value={entry.saveDC} small />
            <StatCell label="Attack" value={`+${entry.attackBonus}`} small />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCell({ label, value, capitalize, small }) {
  return (
    <div className="text-center">
      <div className={`text-slate-500 mb-0.5 ${small ? 'text-[10px]' : 'text-xs'}`}>{label}</div>
      <div className={`font-bold text-purple-300 ${capitalize ? 'capitalize' : ''} ${small ? 'text-xs' : 'text-sm'}`}>{value}</div>
    </div>
  );
}

function RestButton({ label, restType, character, onUpdateCharacter, style, icon }) {
  return (
    <button onClick={async () => {
      const result = await base44.functions.invoke('recoverSpellSlots', {
        character_id: character.id,
        rest_type: restType
      });
      if (result.data?.character) {
        onUpdateCharacter({
          spell_slots: result.data.character.spell_slots,
          arcane_recovery_used: result.data.character.arcane_recovery_used
        });
      }
    }}
      className="flex-1 py-2 border text-xs rounded-xl transition-all flex items-center justify-center gap-2"
      style={style}>
      {icon}
      {label}
    </button>
  );
}

function SpellLevelGroups({ spells, icon, colorClass, levelRange, slotMaxArr, getRemainingSlots, renderCard, emptyMsg }) {
  if (spells.length === 0) {
    return <div className="text-center py-8 text-slate-500 text-sm">{emptyMsg}</div>;
  }

  return (
    <>
      {[0,1,2,3,4,5,6,7,8,9].map(level => {
        const levelSpells = spells.filter(s => s.level === level);
        if (levelSpells.length === 0) return null;
        const remaining = getRemainingSlots ? getRemainingSlots(level) : null;
        const maxForLevel = level === 0 ? Infinity : (slotMaxArr ? slotMaxArr[level - 1] || 0 : 0);
        return (
          <div key={level}>
            <div className={`text-xs ${colorClass} uppercase tracking-widest mb-2 flex items-center gap-2`}>
              {icon}
              {LEVEL_LABELS[level]} {level > 0 ? 'Level' : 's'}
              {level > 0 && maxForLevel > 0 && remaining !== null && (
                <span className={`ml-auto font-mono text-xs px-1.5 py-0.5 rounded-md ${
                  remaining === 0 ? 'text-red-400 bg-red-900/30 border border-red-700/30' :
                  remaining <= 1 ? 'text-amber-400 bg-amber-900/20 border border-amber-700/20' :
                  'text-purple-300 bg-purple-900/20 border border-purple-700/20'
                }`}>
                  {remaining}/{maxForLevel} slots
                </span>
              )}
            </div>
            <div className="space-y-2">
              {levelSpells.map(s => renderCard(s))}
            </div>
          </div>
        );
      })}
    </>
  );
}