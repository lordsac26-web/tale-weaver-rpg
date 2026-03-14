import React, { useState } from 'react';
import { Zap, Info, Search, BookOpen, Star, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SPELLS_BY_CLASS, SPELL_DETAILS, SCHOOL_COLORS, DAMAGE_TYPE_COLORS,
  getSpellSlotsForLevel, calcSpellSaveDC, calcSpellAttackBonus,
  getSpellcastingAbility
} from './spellData';

const LEVEL_LABELS = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
// Classes that prepare spells from their full list vs classes that have a fixed known spells list
const PREPARATION_CLASSES = ['Wizard', 'Cleric', 'Druid', 'Paladin'];
const ATTACK_ICONS = {
  ranged_spell_attack: '🎯',
  melee_spell_attack: '⚔️',
  saving_throw: '🎲',
  healing: '💚',
  auto_hit: '✨',
  utility: '🔧',
};

function SpellCard({ spell, spellName, character, isKnown, onToggleKnown, compact = false }) {
  const [showDetail, setShowDetail] = useState(false);
  const details = SPELL_DETAILS[spellName] || spell || {};
  const schoolColor = SCHOOL_COLORS[details.school] || 'text-slate-400';
  const dmgColor = DAMAGE_TYPE_COLORS[details.damage_type] || 'text-amber-300';
  const attackIcon = ATTACK_ICONS[details.attack_type || 'utility'];
  
  // Check for concentration and ritual from multiple sources
  const isConcentration = details.requires_concentration || details.concentration;
  const isRitual = details.is_reaction || details.ritual;

  return (
    <div className={`rounded-xl border transition-all ${isKnown ? 'border-amber-600/50 bg-amber-900/10' : 'border-slate-700/40 bg-slate-800/30'}`}>
      <div className="flex items-start gap-2 p-3">
        <span className="text-lg flex-shrink-0 mt-0.5">{attackIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${isKnown ? 'text-amber-200' : 'text-slate-300'}`}>{spellName}</span>
            {details.school && <span className={`text-xs ${schoolColor} opacity-70`}>{details.school}</span>}
            {isConcentration && <span className="text-xs text-blue-400 opacity-70">Conc.</span>}
            {isRitual && <span className="text-xs text-yellow-400 opacity-70">Ritual</span>}
            {details.damage_type && <span className={`text-xs ${dmgColor} opacity-70`}>{details.damage_type}</span>}
          </div>
          {!compact && (
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {details.casting_time && <span className="text-xs text-slate-500">{details.casting_time}</span>}
              {details.range && <span className="text-xs text-slate-500">📍 {details.range}</span>}
              {details.damage_dice && details.damage_dice !== '0' && (
                <span className={`text-xs font-mono ${dmgColor}`}>{details.damage_dice}</span>
              )}
              {details.attack_type === 'healing' && details.heal_dice && (
                <span className="text-xs font-mono text-green-400">{details.heal_dice} heal</span>
              )}
              {details.save_type && <span className="text-xs text-yellow-400">{details.save_type} save</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => setShowDetail(v => !v)} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
            <Info className="w-3.5 h-3.5" />
          </button>
          {onToggleKnown && (
            <button onClick={() => onToggleKnown(spellName)}
              className={`p-1 rounded transition-colors ${isKnown ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-amber-400'}`}>
              <Star className={`w-3.5 h-3.5 ${isKnown ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showDetail && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-700/30 px-3 pb-3 pt-2">
            {details.visual_summary && (
              <p className="text-xs text-purple-400/80 leading-relaxed italic mb-2">✨ {details.visual_summary}</p>
            )}
            {details.effect_summary && (
              <p className="text-xs text-blue-300/80 leading-relaxed font-medium mb-2">⚡ {details.effect_summary}</p>
            )}
            <p className="text-xs text-slate-400 leading-relaxed">{details.description || 'No description available.'}</p>
            {details.higher_level_scaling && (
              <p className="text-xs text-amber-400/70 mt-1.5 italic">At higher levels: {details.higher_level_scaling}</p>
            )}
            {details.components && <p className="text-xs text-slate-500 mt-1">Components: {details.components}</p>}
            {details.duration && <p className="text-xs text-slate-500">Duration: {details.duration}</p>}
            {details.conditions_caused && details.conditions_caused.length > 0 && (
              <p className="text-xs text-red-400/70 mt-1">Conditions: {details.conditions_caused.join(', ')}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SpellbookTab({ character, onUpdateCharacter }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [activeSection, setActiveSection] = useState('prepared'); // 'prepared' | 'available' | 'slots'
  const preparedSpells = new Set(character.spells_prepared || []);

  if (!character) return null;

  const charClass = character.class;
  const charLevel = character.level || 1;
  const spellcastingAbility = getSpellcastingAbility(charClass);
  const spellSaveDC = calcSpellSaveDC(character);
  const spellAttackBonus = calcSpellAttackBonus(character);
  const slotArray = getSpellSlotsForLevel(charClass, charLevel);
  const currentSlots = character.spell_slots || {};
  const knownSpells = new Set(character.spells_known || []);
  const isPreparation = PREPARATION_CLASSES.includes(charClass);
  const profBonus = Math.floor((charLevel - 1) / 4) + 2;
  const spellcastingAbilityScore = character[spellcastingAbility] || 10;
  const spellcastingMod = Math.floor((spellcastingAbilityScore - 10) / 2);

  const classSpells = SPELLS_BY_CLASS[charClass] || {};
  const allAvailableSpells = [];
  Object.entries(classSpells).forEach(([lvl, spells]) => {
    const numLevel = lvl === 'cantrips' ? 0 : parseInt(lvl);
    spells.forEach(name => allAvailableSpells.push({ name, level: numLevel }));
  });

  const toggleKnown = (spellName) => {
    const updated = knownSpells.has(spellName)
      ? [...knownSpells].filter(s => s !== spellName)
      : [...knownSpells, spellName];
    onUpdateCharacter({ spells_known: updated });
  };

  const togglePrepared = (spellName) => {
    const isPrepared = preparedSpells.has(spellName);
    const maxPrepared = isPreparation ? Math.max(1, charLevel + spellcastingMod) : 999;
    
    if (!isPrepared && preparedSpells.size >= maxPrepared && isPreparation) {
      alert(`You can only prepare ${maxPrepared} spells at once. Unprepare a spell first.`);
      return;
    }
    
    const updated = isPrepared
      ? [...preparedSpells].filter(s => s !== spellName)
      : [...preparedSpells, spellName];
    
    // Auto-add to known if not already
    const finalKnown = knownSpells.has(spellName) ? [...knownSpells] : [...knownSpells, spellName];
    
    onUpdateCharacter({ spells_prepared: updated, spells_known: finalKnown });
  };

  const filterSpell = ({ name, level: lvl }) => {
    if (searchQuery && !name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterLevel !== 'all' && lvl !== parseInt(filterLevel)) return false;
    if (filterType !== 'all') {
      const d = SPELL_DETAILS[name];
      if (filterType === 'damage' && !d?.damage_dice) return false;
      if (filterType === 'healing' && d?.attack_type !== 'healing') return false;
      if (filterType === 'utility' && !d?.is_utility) return false;
      if (filterType === 'concentration' && !d?.requires_concentration) return false;
    }
    return true;
  };

  const preparedList = allAvailableSpells.filter(s => preparedSpells.has(s.name) && filterSpell(s));
  const knownList = allAvailableSpells.filter(s => knownSpells.has(s.name) && !preparedSpells.has(s.name) && filterSpell(s));
  const availableList = allAvailableSpells.filter(s => !knownSpells.has(s.name) && filterSpell(s));

  const hasSpellcasting = !!spellcastingAbility;

  if (!hasSpellcasting) {
    return (
      <div className="text-center py-12 text-slate-500">
        <BookOpen className="w-10 h-10 opacity-20 mx-auto mb-3" />
        <p className="text-sm">{charClass} cannot cast spells.</p>
      </div>
    );
  }

  const handleToggleSlot = (level, slotIndex, maxSlots) => {
    const used = currentSlots[`level_${level}`] || 0;
    const remaining = maxSlots - used;
    // clicking a filled slot expends it, clicking empty slot recovers it
    const newUsed = slotIndex < remaining ? used + 1 : Math.max(0, used - 1);
    onUpdateCharacter({ spell_slots: { ...currentSlots, [`level_${level}`]: newUsed } });
  };

  return (
    <div className="space-y-4">
      {/* Spellcasting Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-purple-900/10 border border-purple-700/30 rounded-xl">
        <div className="text-center">
          <div className="text-xs text-slate-500 mb-0.5">Ability</div>
          <div className="text-sm font-bold text-purple-300 capitalize">{spellcastingAbility}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-500 mb-0.5">Score / Mod</div>
          <div className="text-sm font-bold text-purple-300">{spellcastingAbilityScore} / {spellcastingMod >= 0 ? '+' : ''}{spellcastingMod}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-500 mb-0.5">Save DC</div>
          <div className="text-sm font-bold text-purple-300">{spellSaveDC}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-500 mb-0.5">Spell Attack</div>
          <div className="text-sm font-bold text-purple-300">+{spellAttackBonus}</div>
        </div>
      </div>
      {isPreparation && (
        <div className="text-xs text-purple-400/70 bg-purple-900/10 border border-purple-700/20 rounded-lg px-3 py-2">
          📖 <strong>{charClass}</strong> prepares spells daily. Max prepared: {Math.max(1, charLevel + spellcastingMod)} spells. Currently prepared: {preparedSpells.size}
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
          <SpellSlotTracker 
            character={character}
            onUpdateSlots={(newSlots) => onUpdateCharacter({ spell_slots: newSlots })}
          />
          
          <div className="flex gap-2 pt-2">
            <button onClick={async () => {
              const result = await base44.functions.invoke('recoverSpellSlots', {
                character_id: character.id,
                rest_type: 'short'
              });
              if (result.data?.character) {
                onUpdateCharacter({ 
                  spell_slots: result.data.character.spell_slots,
                  arcane_recovery_used: result.data.character.arcane_recovery_used
                });
              }
            }}
              className="flex-1 py-2 border text-xs rounded-xl transition-all flex items-center justify-center gap-2"
              style={{ background: 'rgba(60,30,8,0.4)', border: '1px solid rgba(184,115,51,0.25)', color: 'rgba(201,169,110,0.7)' }}>
              <RotateCcw className="w-3.5 h-3.5" />
              Short Rest
            </button>
            <button onClick={async () => {
              const result = await base44.functions.invoke('recoverSpellSlots', {
                character_id: character.id,
                rest_type: 'long'
              });
              if (result.data?.character) {
                onUpdateCharacter({ 
                  spell_slots: result.data.character.spell_slots,
                  arcane_recovery_used: result.data.character.arcane_recovery_used
                });
              }
            }}
              className="flex-1 py-2 border text-xs rounded-xl transition-all flex items-center justify-center gap-2"
              style={{ background: 'rgba(38,10,70,0.4)', border: '1px solid rgba(130,70,210,0.3)', color: 'rgba(192,132,252,0.7)' }}>
              <Moon className="w-3.5 h-3.5" />
              Long Rest
            </button>
          </div>
        </div>
      )}

      {/* Filters (only for known/available) */}
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
            {[0,1,2,3,4,5].map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
          </select>
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
        {activeSection === 'prepared' ? (
          preparedList.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              {preparedSpells.size === 0 ? 'No spells prepared. Click the star icon on spells to prepare them.' : 'No spells match your filters.'}
            </div>
          ) : (
            [0,1,2,3,4,5].map(level => {
              const levelSpells = preparedList.filter(s => s.level === level);
              if (levelSpells.length === 0) return null;
              return (
                <div key={level}>
                  <div className="text-xs text-purple-400/70 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <CheckCircle className="w-3 h-3" />
                    {LEVEL_LABELS[level]} {level > 0 ? 'Level' : 's'}
                  </div>
                  <div className="space-y-2">
                    {levelSpells.map(({ name }) => (
                      <SpellCard key={name} spellName={name} character={character} isKnown={true} onToggleKnown={togglePrepared} />
                    ))}
                  </div>
                </div>
              );
            })
          )
        ) : activeSection === 'known' ? (
          knownList.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              {knownSpells.size === 0 ? 'No spells known. Browse the Spellbook tab to learn spells.' : 'No spells match your filters.'}
            </div>
          ) : (
            [0,1,2,3,4,5].map(level => {
              const levelSpells = knownList.filter(s => s.level === level);
              if (levelSpells.length === 0) return null;
              return (
                <div key={level}>
                  <div className="text-xs text-amber-400/70 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Star className="w-3 h-3" />
                    {LEVEL_LABELS[level]} {level > 0 ? 'Level' : 's'}
                  </div>
                  <div className="space-y-2">
                    {levelSpells.map(({ name }) => (
                      <SpellCard key={name} spellName={name} character={character} isKnown={true} onToggleKnown={togglePrepared} />
                    ))}
                  </div>
                </div>
              );
            })
          )
        ) : (
          [0,1,2,3,4,5].map(level => {
            const levelSpells = availableList.filter(s => s.level === level);
            if (levelSpells.length === 0) return null;
            return (
              <div key={level}>
                <div className="text-xs text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <BookOpen className="w-3 h-3" />
                  {LEVEL_LABELS[level]} {level > 0 ? 'Level' : 's'}
                </div>
                <div className="space-y-2">
                  {levelSpells.map(({ name }) => (
                    <SpellCard key={name} spellName={name} character={character} isKnown={false} onToggleKnown={toggleKnown} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
      )}
    </div>
  );
}