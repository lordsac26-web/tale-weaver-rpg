import React, { useState } from 'react';
import { X, Shield, Heart, Zap, Star, Swords, FlaskConical, BookOpen, Layers, Sparkles, ShieldCheck, CircleDot, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import InventoryTab from './InventoryTab';
import { CLASSES, calcStatMod, calcModDisplay, PROFICIENCY_BY_LEVEL, SKILL_STAT_MAP, CONDITIONS } from './gameData';
import { base44 } from '@/api/base44Client';
import SpellbookTab from './SpellbookTab';
import { SkillTooltip, FeatureTooltip, ConditionTooltip } from './GameTooltip';
 
const SPELLCASTING_CLASSES = ['Wizard','Sorcerer','Warlock','Bard','Cleric','Druid','Paladin','Ranger','Artificer'];
const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const STAT_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };
const STAT_ICONS = { strength: '💪', dexterity: '🏹', constitution: '❤️', intelligence: '📚', wisdom: '🔮', charisma: '✨' };
 
// Spell slots by class and level (simplified PHB table)
const SPELL_SLOTS_TABLE = {
  Wizard:    [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Sorcerer:  [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Bard:      [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Cleric:    [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Druid:     [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]],
  Warlock:   [[1],[2],[0,2],[0,2],[0,0,2],[0,0,2],[0,0,0,2],[0,0,0,2],[0,0,0,0,2],[0,0,0,0,2],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,3],[0,0,0,0,4],[0,0,0,0,4],[0,0,0,0,4],[0,0,0,0,4]],
  Paladin:   [[0],[2],[3],[3,0],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
  Ranger:    [[0],[2],[3],[3,0],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
  Artificer: [[0],[2],[3],[3,0],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]],
};
const SLOT_LEVEL_NAMES = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th'];
 
const EQUIP_SLOT_META = {
  head:      { label: 'Head',       icon: '🪖' },
  neck:      { label: 'Neck',       icon: '📿' },
  chest:     { label: 'Chest',      icon: '🛡️' },
  shoulders: { label: 'Shoulders',  icon: '🩱' },
  hands:     { label: 'Hands',      icon: '🧤' },
  feet:      { label: 'Feet',       icon: '👢' },
  ring:      { label: 'Ring 1',     icon: '💍' },
  ring2:     { label: 'Ring 2',     icon: '💍' },
  mainhand:  { label: 'Main Hand',  icon: '⚔️' },
  offhand:   { label: 'Off Hand',   icon: '🛡' },
  cloak:     { label: 'Cloak',      icon: '🧣' },
  trinket:   { label: 'Trinket',    icon: '🔮' },
};
 
const TABS = [
  { id: 'stats',      label: 'Stats',      icon: '⚔️' },
  { id: 'skills',     label: 'Skills',     icon: '🎯' },
  { id: 'combat',     label: 'Combat',     icon: '🛡️' },
  { id: 'inventory',  label: 'Gear',       icon: '🎒' },
  { id: 'spells',     label: 'Spells',     icon: '🔮' },
  { id: 'conditions', label: 'Status',     icon: '✨' },
  { id: 'features',   label: 'Features',   icon: '📜' },
];
 
export default function CharacterSheet({ character: initialCharacter, onClose, onCharacterUpdate }) {
  const [tab, setTab] = useState('stats');
  const [character, setCharacter] = useState(initialCharacter);
  if (!character) return null;
 
  const isCaster = SPELLCASTING_CLASSES.includes(character.class);
  const profBonus = PROFICIENCY_BY_LEVEL[(character.level || 1) - 1] || 2;
  const visibleTabs = TABS.filter(t => t.id !== 'spells' || isCaster);
 
  const handleUpdateCharacter = async (updates) => {
    const updated = { ...character, ...updates };
    setCharacter(updated);
    await base44.entities.Character.update(character.id, updates);
    onCharacterUpdate?.(updated);
  };
 
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col rounded-2xl"
        style={{
          background: 'rgba(12,8,4,0.98)',
          border: '1px solid rgba(180,140,90,0.3)',
          boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(201,169,110,0.08)',
        }}
        onClick={e => e.stopPropagation()}>
 
        {/* Top accent */}
        <div className="h-px w-full flex-shrink-0" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.7) 30%, rgba(201,169,110,0.7) 70%, transparent)' }} />
 
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ background: 'linear-gradient(90deg, rgba(60,40,8,0.5), rgba(20,13,4,0.4))', borderBottom: '1px solid rgba(180,140,90,0.15)' }}>
          <div>
            <h2 className="font-fantasy font-bold text-xl" style={{ color: '#f0c040', textShadow: '0 0 20px rgba(201,169,110,0.4)' }}>
              {character.name}
            </h2>
            <p className="text-sm italic mt-0.5" style={{ color: 'rgba(201,169,110,0.55)', fontFamily: 'EB Garamond, serif' }}>
              Level {character.level} {character.race} {character.class}
              {character.subclass ? ` · ${character.subclass}` : ''}
            </p>
            {character.alignment && (
              <p className="text-xs mt-0.5" style={{ color: 'rgba(180,150,100,0.35)', fontFamily: 'EB Garamond, serif' }}>
                {character.alignment}{character.background ? ` · ${character.background}` : ''}
              </p>
            )}
          </div>
          <button onClick={onClose}
            className="p-2 rounded-lg transition-all"
            style={{ color: 'rgba(201,169,110,0.4)', background: 'rgba(20,13,5,0.5)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#c9a96e'; e.currentTarget.style.background = 'rgba(40,25,8,0.7)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(201,169,110,0.4)'; e.currentTarget.style.background = 'rgba(20,13,5,0.5)'; }}>
            <X className="w-5 h-5" />
          </button>
        </div>
 
        {/* Quick Stats bar */}
        <QuickStatsBar character={character} />
 
        {/* Tabs */}
        <div className="flex flex-shrink-0 overflow-x-auto"
          style={{ borderBottom: '1px solid rgba(180,140,90,0.12)', background: 'rgba(8,5,2,0.7)' }}>
          {visibleTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-3 py-2.5 text-xs font-fantasy whitespace-nowrap transition-all tracking-wide flex items-center gap-1"
              style={tab === t.id ? {
                color: '#f0c040', borderBottom: '2px solid #c9a96e',
                background: 'rgba(80,50,10,0.2)', textShadow: '0 0 12px rgba(201,169,110,0.4)',
              } : {
                color: 'rgba(180,150,100,0.4)', borderBottom: '2px solid transparent',
              }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
 
        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {tab === 'stats' && <StatsTab character={character} profBonus={profBonus} />}
              {tab === 'skills' && <SkillsTab character={character} profBonus={profBonus} />}
              {tab === 'combat' && <CombatTab character={character} profBonus={profBonus} isCaster={isCaster} onUpdate={handleUpdateCharacter} />}
              {tab === 'inventory' && <InventoryTab character={character} onUpdate={handleUpdateCharacter} onIdentify={null} />}
              {tab === 'spells' && <SpellbookTab character={character} onUpdateCharacter={handleUpdateCharacter} />}
              {tab === 'conditions' && <ConditionsTab character={character} onUpdate={handleUpdateCharacter} />}
              {tab === 'features' && <FeaturesTab character={character} />}
            </motion.div>
          </AnimatePresence>
        </div>
 
        <div className="h-px w-full flex-shrink-0" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.3) 40%, rgba(201,169,110,0.3) 60%, transparent)' }} />
      </motion.div>
    </div>
  );
}
 
// ─── Quick Stats Bar ───────────────────────────────────────────────────────────
function QuickStatsBar({ character }) {
  const hpPct = character.hp_max ? Math.max(0, Math.min(100, (character.hp_current / character.hp_max) * 100)) : 100;
  const hpColor = hpPct > 60 ? '#22c55e' : hpPct > 30 ? '#d97706' : '#dc2626';
  return (
    <div className="flex-shrink-0 px-4 py-2 grid grid-cols-5 gap-2"
      style={{ borderBottom: '1px solid rgba(180,140,90,0.1)', background: 'rgba(10,6,3,0.6)' }}>
      {[
        { icon: Heart, color: hpColor, val: `${character.hp_current ?? '?'}/${character.hp_max ?? '?'}`, label: 'HP' },
        { icon: Shield, color: '#3b82f6', val: character.armor_class ?? '—', label: 'AC' },
        { icon: Zap, color: '#d97706', val: `${character.speed ?? 30}ft`, label: 'Speed' },
        { icon: CircleDot, color: '#a78bfa', val: `+${PROFICIENCY_BY_LEVEL[(character.level||1)-1]||2}`, label: 'Prof' },
        { icon: Star, color: '#c9a96e', val: character.xp ?? 0, label: 'XP' },
      ].map(({ icon: Icon, color, val, label }, i) => (
        <div key={label} className="text-center py-1">
          <Icon className="w-3 h-3 mx-auto mb-0.5" style={{ color }} />
          <div className="font-fantasy font-bold text-xs" style={{ color: '#e8d5b7' }}>{val}</div>
          <div className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif', fontSize: '0.6rem' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}
 
// ─── Stats Tab ─────────────────────────────────────────────────────────────────
function StatsTab({ character, profBonus }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5 mb-3">
        {STATS.map(stat => {
          const val = character[stat] || 10;
          const mod = calcStatMod(val);
          const saveProf = CLASSES[character.class]?.saves?.includes(stat);
          const saveMod = mod + (saveProf ? profBonus : 0);
          return (
            <div key={stat} className="stat-box rounded-xl p-3 text-center">
              <div className="text-base mb-0.5">{STAT_ICONS[stat]}</div>
              <div className="font-fantasy text-xs tracking-widest mb-0.5" style={{ color: 'rgba(180,140,90,0.5)', fontSize: '0.6rem' }}>{STAT_LABELS[stat]}</div>
              <div className="font-fantasy font-bold text-2xl mb-0.5" style={{ color: '#e8d5b7' }}>{val}</div>
              <div className="font-fantasy font-bold text-sm" style={{ color: mod >= 0 ? '#86efac' : '#fca5a5' }}>{calcModDisplay(mod)}</div>
              <div className="text-xs mt-1 pt-1" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif', borderTop: '1px solid rgba(180,140,90,0.1)', fontSize: '0.65rem' }}>
                Save {calcModDisplay(saveMod)}{saveProf && <span style={{ color: '#c9a96e' }}> ●</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl p-2.5 text-center stat-box">
        <span style={{ color: 'rgba(180,150,100,0.5)', fontFamily: 'EB Garamond, serif', fontSize: '0.9rem' }}>Proficiency Bonus </span>
        <span className="font-fantasy font-bold" style={{ color: '#f0c040' }}>+{profBonus}</span>
      </div>
      {/* Passive Scores */}
      <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.1)' }}>
        <div className="font-fantasy text-xs tracking-widest mb-2" style={{ color: 'rgba(201,169,110,0.4)', fontSize: '0.6rem' }}>PASSIVE SCORES</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Perception', stat: 'wisdom', skill: 'Perception' },
            { label: 'Insight', stat: 'wisdom', skill: 'Insight' },
            { label: 'Investigation', stat: 'intelligence', skill: 'Investigation' },
          ].map(({ label, stat, skill }) => {
            const mod = calcStatMod(character[stat] || 10);
            const prof = character.skills?.[skill];
            const bonus = prof === 'expert' ? profBonus * 2 : (prof === 'proficient' || prof === true) ? profBonus : 0;
            return (
              <div key={label} className="text-center py-2 rounded-lg" style={{ background: 'rgba(10,6,3,0.5)' }}>
                <div className="font-fantasy font-bold text-lg" style={{ color: '#f0c040' }}>{10 + mod + bonus}</div>
                <div className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif', fontSize: '0.65rem' }}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
 
// ─── Skills Tab ────────────────────────────────────────────────────────────────
function SkillsTab({ character, profBonus }) {
  return (
    <div className="space-y-0.5">
      {Object.entries(SKILL_STAT_MAP).map(([skill, stat]) => {
        const statMod = calcStatMod(character[stat] || 10);
        const profLevel = character.skills?.[skill];
        const bonus = profLevel === 'expert' ? profBonus * 2 : (profLevel === 'proficient' || profLevel === true) ? profBonus : 0;
        const total = statMod + bonus;
        return (
          <div key={skill}
            className="flex items-center justify-between py-1.5 px-3 rounded-lg transition-all"
            style={{ borderBottom: '1px solid rgba(180,140,90,0.06)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(30,20,8,0.5)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: profLevel === 'expert' ? '#f0c040' : (profLevel === 'proficient' || profLevel === true) ? '#86efac' : 'rgba(80,60,30,0.4)',
                  boxShadow: profLevel ? '0 0 4px ' + (profLevel === 'expert' ? 'rgba(240,192,64,0.3)' : 'rgba(134,239,172,0.3)') : 'none',
                }} />
              <SkillTooltip name={skill} position="right">
                <span className="text-sm" style={{ color: 'rgba(232,213,183,0.85)', fontFamily: 'EB Garamond, serif' }}>{skill}</span>
              </SkillTooltip>
              <span className="text-xs" style={{ color: 'rgba(180,140,90,0.35)' }}>({STAT_LABELS[stat]})</span>
            </div>
            <span className="font-fantasy font-bold text-sm" style={{ color: total >= 0 ? '#86efac' : '#fca5a5' }}>{calcModDisplay(total)}</span>
          </div>
        );
      })}
    </div>
  );
}
 
// ─── Combat Tab (Spell Slots + Equipped) ──────────────────────────────────────
function CombatTab({ character, profBonus, isCaster, onUpdate }) {
  const equipped = character.equipped || {};
 
  // Spell slots
  const slotTable = isCaster ? SPELL_SLOTS_TABLE[character.class] : null;
  const maxSlots = slotTable ? (slotTable[(character.level || 1) - 1] || []) : [];
  const usedSlots = character.spell_slots || {};
 
  const toggleSlot = (level, slotIdx) => {
    const levelKey = `level_${level + 1}`;
    const current = usedSlots[levelKey] || 0;
    const newUsed = slotIdx < current ? slotIdx : slotIdx + 1;
    onUpdate({ spell_slots: { ...usedSlots, [levelKey]: Math.min(newUsed, maxSlots[level]) } });
  };
 
  const restoreAllSlots = () => {
    onUpdate({ spell_slots: {} });
  };
 
  const equippedSlots = Object.entries(EQUIP_SLOT_META).filter(([slot]) => equipped[slot]);
  const emptySlots = Object.entries(EQUIP_SLOT_META).filter(([slot]) => !equipped[slot]);
 
  return (
    <div className="space-y-4">
      {/* Equipped Items */}
      <Section title="Equipped Items" icon="🛡️">
        {equippedSlots.length === 0 ? (
          <div className="text-center py-4 text-sm" style={{ color: 'rgba(180,140,90,0.3)', fontFamily: 'EB Garamond, serif' }}>Nothing equipped</div>
        ) : (
          <div className="space-y-1.5">
            {equippedSlots.map(([slot, meta]) => {
              const item = equipped[slot];
              return (
                <div key={slot} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(10,35,12,0.5)', border: '1px solid rgba(40,160,80,0.2)' }}>
                  <span className="text-base">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: '#e8d5b7', fontFamily: 'EB Garamond, serif' }}>{item?.name || '—'}</div>
                    <div className="text-xs" style={{ color: 'rgba(180,140,90,0.4)' }}>{meta.label}{item?.armor_class ? ` · AC ${item.armor_class}` : ''}{item?.damage ? ` · ${item.damage}` : ''}{item?.attack_bonus > 0 ? ` · +${item.attack_bonus}` : ''}</div>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 rounded-full badge-green">Equipped</span>
                </div>
              );
            })}
          </div>
        )}
        {emptySlots.length > 0 && equippedSlots.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-1">
            {emptySlots.map(([slot, meta]) => (
              <div key={slot} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg opacity-40"
                style={{ background: 'rgba(15,10,5,0.4)', border: '1px solid rgba(180,140,90,0.08)' }}>
                <span className="text-xs">{meta.icon}</span>
                <span className="text-xs truncate" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>{meta.label}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
 
      {/* Spell Slots */}
      {isCaster && maxSlots.length > 0 && (
        <Section title="Spell Slots" icon="🔮" action={<button onClick={restoreAllSlots} className="text-xs px-2 py-0.5 rounded-md font-fantasy transition-all" style={{ background: 'rgba(40,25,8,0.6)', border: '1px solid rgba(201,169,110,0.2)', color: 'rgba(201,169,110,0.6)' }}>Long Rest</button>}>
          <div className="space-y-2">
            {maxSlots.map((max, levelIdx) => {
              if (!max) return null;
              const levelKey = `level_${levelIdx + 1}`;
              const used = usedSlots[levelKey] || 0;
              return (
                <div key={levelIdx} className="flex items-center gap-3">
                  <div className="w-10 text-right font-fantasy text-xs" style={{ color: 'rgba(201,169,110,0.5)', fontSize: '0.65rem' }}>{SLOT_LEVEL_NAMES[levelIdx]}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {Array.from({ length: max }).map((_, i) => {
                      const isUsed = i < used;
                      return (
                        <button key={i} onClick={() => toggleSlot(levelIdx, i)}
                          className="w-6 h-6 rounded-full border-2 transition-all"
                          style={isUsed ? {
                            background: 'rgba(15,10,5,0.5)', borderColor: 'rgba(120,80,200,0.3)'
                          } : {
                            background: 'rgba(100,60,180,0.4)', borderColor: 'rgba(160,120,255,0.6)',
                            boxShadow: '0 0 6px rgba(140,80,220,0.3)'
                          }}
                          title={isUsed ? 'Restore slot' : 'Use slot'} />
                      );
                    })}
                  </div>
                  <div className="text-xs ml-auto" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>
                    {max - used}/{max}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}
 
      {/* Combat Stats */}
      <Section title="Combat Statistics" icon="⚔️">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Initiative', val: calcModDisplay(calcStatMod(character.dexterity || 10)), color: '#fde68a' },
            { label: 'Prof Bonus', val: `+${profBonus}`, color: '#c9a96e' },
            { label: 'Speed', val: `${character.speed || 30}ft`, color: '#86efac' },
            // All 6 saving throws — read from character.saving_throws (set at creation
            // from class proficiencies, and updated by feats like Resilient).
            // Fall back to CLASSES data for characters created before this fix.
            ...['strength','dexterity','constitution','intelligence','wisdom','charisma'].map(stat => {
              const abbr = { strength:'STR', dexterity:'DEX', constitution:'CON', intelligence:'INT', wisdom:'WIS', charisma:'CHA' }[stat];
              const fromChar = character.saving_throws?.[stat];
              const fromClass = CLASSES[character.class]?.saves?.includes(stat);
              const isProficient = fromChar ?? fromClass;
              const saveVal = calcStatMod(character[stat] || 10) + (isProficient ? profBonus : 0);
              return { label: `${abbr} Save`, val: calcModDisplay(saveVal), color: isProficient ? '#86efac' : '#fca5a5' };
            }),
          ].map(({ label, val, color }) => (
            <div key={label} className="text-center py-2 rounded-lg stat-box">
              <div className="font-fantasy font-bold text-sm" style={{ color }}>{val}</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif', fontSize: '0.65rem' }}>{label}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
 
// ─── Conditions Tab ────────────────────────────────────────────────────────────
function ConditionsTab({ character, onUpdate }) {
  const conditions = character.conditions || [];
  const modifiers = character.active_modifiers || [];
 
  const removeCondition = (idx) => {
    onUpdate({ conditions: conditions.filter((_, i) => i !== idx) });
  };
 
  return (
    <div className="space-y-4">
      <Section title="Active Conditions" icon="⚡">
        {conditions.length === 0 ? (
          <div className="text-center py-6 font-fantasy text-sm" style={{ color: '#86efac', textShadow: '0 0 12px rgba(134,239,172,0.3)' }}>
            ✓ No active conditions — fully healthy!
          </div>
        ) : (
          <div className="space-y-2">
            {conditions.map((cond, i) => {
              const name = typeof cond === 'string' ? cond : cond.name;
              const duration = typeof cond === 'object' ? cond.duration : null;
              const condData = CONDITIONS[name?.toLowerCase()] || {};
              return (
                <div key={i} className="p-3 rounded-xl flex items-start gap-3"
                  style={{ background: 'rgba(25,10,5,0.7)', border: '1px solid rgba(200,80,50,0.25)' }}>
                  <span className="text-xl flex-shrink-0">{condData.icon || '❓'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ConditionTooltip name={name} position="right">
                        <span className="font-fantasy text-sm capitalize" style={{ color: '#fca5a5' }}>{name}</span>
                      </ConditionTooltip>
                      {duration && <span className="text-xs px-1.5 py-0.5 rounded-full badge-blood">{duration}</span>}
                    </div>
                    {condData.description && (
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(200,160,120,0.55)', fontFamily: 'EB Garamond, serif' }}>
                        {condData.description}
                      </p>
                    )}
                  </div>
                  <button onClick={() => removeCondition(i)} className="p-1 rounded flex-shrink-0 transition-all"
                    style={{ color: 'rgba(200,80,60,0.4)' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fca5a5'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(200,80,60,0.4)'}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Section>
 
      <Section title="Active Buffs & Modifiers" icon="✨">
        {modifiers.length === 0 ? (
          <div className="text-center py-4 text-sm" style={{ color: 'rgba(180,140,90,0.3)', fontFamily: 'EB Garamond, serif' }}>No active buffs</div>
        ) : (
          <div className="space-y-1.5">
            {modifiers.map((mod, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'rgba(20,13,5,0.5)', border: '1px solid rgba(180,140,90,0.12)' }}>
                <div>
                  <span className="text-sm" style={{ color: '#e8d5b7', fontFamily: 'EB Garamond, serif' }}>{mod.source || mod.name}</span>
                  {mod.duration && <span className="text-xs ml-2" style={{ color: 'rgba(180,140,90,0.4)' }}>{mod.duration}</span>}
                </div>
                <span className="font-fantasy font-bold text-sm"
                  style={{ color: mod.value >= 0 ? '#86efac' : '#fca5a5' }}>
                  {mod.value >= 0 ? '+' : ''}{mod.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
 
      {/* Death Saves */}
      {(character.death_saves_success > 0 || character.death_saves_failure > 0 || character.hp_current <= 0) && (
        <Section title="Death Saves" icon="💀">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <div className="flex gap-1.5 mb-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-5 h-5 rounded-full border-2"
                    style={i < (character.death_saves_success || 0) ? { background: '#22c55e', borderColor: '#16a34a' } : { borderColor: 'rgba(40,180,80,0.3)' }} />
                ))}
              </div>
              <div className="text-xs font-fantasy" style={{ color: '#86efac' }}>Successes</div>
            </div>
            <div className="text-center">
              <div className="flex gap-1.5 mb-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-5 h-5 rounded-full border-2"
                    style={i < (character.death_saves_failure || 0) ? { background: '#dc2626', borderColor: '#7f1d1d' } : { borderColor: 'rgba(180,30,30,0.3)' }} />
                ))}
              </div>
              <div className="text-xs font-fantasy" style={{ color: '#fca5a5' }}>Failures</div>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
 
// ─── Features Tab ─────────────────────────────────────────────────────────────
function FeaturesTab({ character }) {
  const [expanded, setExpanded] = useState({});
  const classData = CLASSES[character.class] || {};
  const classFeatures = [];
  Object.entries(classData.features || {}).forEach(([lvl, feats]) => {
    if (parseInt(lvl) <= (character.level || 1)) {
      feats.forEach(f => classFeatures.push({ name: f, level: parseInt(lvl) }));
    }
  });
 
  return (
    <div className="space-y-4">
      {/* Character Features */}
      <Section title="Character Features" icon="⚡">
        {(character.features || []).length === 0 && classFeatures.length === 0 ? (
          <div className="text-center py-4 text-sm" style={{ color: 'rgba(180,140,90,0.3)', fontFamily: 'EB Garamond, serif' }}>No features recorded</div>
        ) : (
          <div className="space-y-1.5">
            {(character.features || []).map((feat, i) => {
              const featName = typeof feat === 'string' ? feat : (feat?.name || feat?.title || JSON.stringify(feat));
              const featDesc = typeof feat === 'object' ? (feat?.desc || feat?.description || '') : '';
              return (
                <div key={i} className="p-2.5 rounded-lg"
                  style={{ background: 'rgba(20,13,5,0.5)', border: '1px solid rgba(180,140,90,0.1)' }}>
                  <div className="text-sm" style={{ color: 'rgba(232,213,183,0.85)', fontFamily: 'EB Garamond, serif' }}>{featName}</div>
                  {featDesc && <div className="text-xs mt-1" style={{ color: 'rgba(180,150,100,0.5)', fontFamily: 'EB Garamond, serif' }}>{featDesc}</div>}
                </div>
              );
            })}
          </div>
        )}
      </Section>
 
      {/* Class Features by Level */}
      {classFeatures.length > 0 && (
        <Section title={`${character.class} Class Features`} icon="📖">
          <div className="space-y-1">
            {classFeatures.map((f, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2 px-3 rounded-lg"
                style={{ background: 'rgba(15,10,5,0.4)', borderBottom: '1px solid rgba(180,140,90,0.06)' }}>
                <span className="text-xs px-1.5 py-0.5 rounded font-fantasy flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(60,40,8,0.6)', border: '1px solid rgba(201,169,110,0.2)', color: 'rgba(201,169,110,0.6)', fontSize: '0.6rem' }}>
                  Lv.{f.level}
                </span>
                <FeatureTooltip featureName={f.name} className={character.class} position="right">
                  <span className="text-sm" style={{ color: 'rgba(232,213,183,0.8)', fontFamily: 'EB Garamond, serif' }}>{f.name}</span>
                </FeatureTooltip>
              </div>
            ))}
          </div>
        </Section>
      )}
 
      {/* Feats */}
      {(character.feats || []).length > 0 && (
        <Section title="Feats" icon="🏆">
          <div className="space-y-1.5">
            {character.feats.map((feat, i) => {
              const featName = typeof feat === 'string' ? feat : (feat?.name || feat?.title || JSON.stringify(feat));
              const featDesc = typeof feat === 'object' ? (feat?.desc || feat?.description || '') : '';
              return (
                <div key={i} className="p-2.5 rounded-lg"
                  style={{ background: 'rgba(30,10,50,0.4)', border: '1px solid rgba(120,60,200,0.15)' }}>
                  <div className="text-sm" style={{ color: '#c4b5fd', fontFamily: 'EB Garamond, serif' }}>{featName}</div>
                  {featDesc && <div className="text-xs mt-1" style={{ color: 'rgba(180,150,220,0.45)', fontFamily: 'EB Garamond, serif' }}>{featDesc}</div>}
                </div>
              );
            })}
          </div>
        </Section>
      )}
 
      {/* Backstory */}
      {character.backstory && (
        <Section title="Backstory" icon="📜">
          <div className="p-3 rounded-xl leading-relaxed text-sm"
            style={{ background: 'rgba(15,10,4,0.7)', border: '1px solid rgba(180,140,90,0.1)', color: 'rgba(232,213,183,0.65)', fontFamily: 'IM Fell English, serif', lineHeight: '1.8' }}>
            {character.backstory}
          </div>
        </Section>
      )}
    </div>
  );
}
 
// ─── Section Helper ────────────────────────────────────────────────────────────
function Section({ title, icon, children, action }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(180,140,90,0.12)' }}>
      <div className="flex items-center justify-between px-3 py-2"
        style={{ background: 'rgba(30,20,8,0.6)', borderBottom: '1px solid rgba(180,140,90,0.1)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(201,169,110,0.6)', fontSize: '0.65rem' }}>{title.toUpperCase()}</span>
        </div>
        {action}
      </div>
      <div className="p-3" style={{ background: 'rgba(12,8,4,0.5)' }}>{children}</div>
    </div>
  );
}