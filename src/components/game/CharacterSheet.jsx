import React, { useState } from 'react';
import { X, Shield, Heart, Zap, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import InventoryTab from './InventoryTab';
import { CLASSES, calcStatMod, calcModDisplay, PROFICIENCY_BY_LEVEL, SKILL_STAT_MAP, CONDITIONS } from './gameData';
import { base44 } from '@/api/base44Client';
import SpellbookTab from './SpellbookTab';

const SPELLCASTING_CLASSES = ['Wizard','Sorcerer','Warlock','Bard','Cleric','Druid','Paladin','Ranger'];
const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const STAT_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };
const STAT_ICONS = { strength: '💪', dexterity: '🏹', constitution: '❤️', intelligence: '📚', wisdom: '🔮', charisma: '✨' };

export default function CharacterSheet({ character: initialCharacter, onClose, onCharacterUpdate }) {
  const [tab, setTab] = useState('stats');
  const [character, setCharacter] = useState(initialCharacter);
  if (!character) return null;

  const isCaster = SPELLCASTING_CLASSES.includes(character.class);
  const profBonus = PROFICIENCY_BY_LEVEL[(character.level || 1) - 1] || 2;

  const handleUpdateCharacter = async (updates) => {
    const updated = { ...character, ...updates };
    setCharacter(updated);
    await base44.entities.Character.update(character.id, updates);
    onCharacterUpdate?.(updated);
  };

  const TABS = ['stats', 'skills', 'inventory', ...(isCaster ? ['spells'] : []), 'conditions', 'features'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl rune-border"
        style={{
          background: 'rgba(12,8,4,0.97)',
          border: '1px solid rgba(180,140,90,0.3)',
          boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(201,169,110,0.08)',
        }}
        onClick={e => e.stopPropagation()}>

        {/* Top gold accent line */}
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.6) 30%, rgba(201,169,110,0.6) 70%, transparent)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{
            background: 'linear-gradient(90deg, rgba(60,40,8,0.5), rgba(20,13,4,0.4))',
            borderBottom: '1px solid rgba(180,140,90,0.15)'
          }}>
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
        <div className="grid grid-cols-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(180,140,90,0.12)', background: 'rgba(10,6,3,0.6)' }}>
          {[
            { icon: Heart, color: '#dc2626', val: `${character.hp_current}/${character.hp_max}`, label: 'HP' },
            { icon: Shield, color: '#3b82f6', val: character.armor_class, label: 'AC' },
            { icon: Zap, color: '#d97706', val: character.speed || 30, label: 'Speed' },
            { icon: Star, color: '#c9a96e', val: character.xp || 0, label: 'XP' },
          ].map(({ icon: Icon, color, val, label }, i) => (
            <div key={label} className="p-3 text-center"
              style={{ borderRight: i < 3 ? '1px solid rgba(180,140,90,0.1)' : 'none' }}>
              <Icon className="w-3.5 h-3.5 mx-auto mb-1" style={{ color }} />
              <div className="font-fantasy font-bold text-sm" style={{ color: '#e8d5b7' }}>{val}</div>
              <div className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 overflow-x-auto"
          style={{ borderBottom: '1px solid rgba(180,140,90,0.12)', background: 'rgba(8,5,2,0.7)' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-3 text-xs font-fantasy capitalize whitespace-nowrap transition-all tracking-wide"
              style={tab === t ? {
                color: '#f0c040',
                borderBottom: '2px solid #c9a96e',
                background: 'rgba(80,50,10,0.2)',
                textShadow: '0 0 12px rgba(201,169,110,0.4)',
              } : {
                color: 'rgba(180,150,100,0.4)',
                borderBottom: '2px solid transparent',
              }}>
              {t === 'spells' ? '🔮 Spells' : t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'stats' && (
            <div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {STATS.map(stat => {
                  const val = character[stat] || 10;
                  const mod = calcStatMod(val);
                  const saveProf = CLASSES[character.class]?.saves?.includes(stat);
                  const saveMod = mod + (saveProf ? profBonus : 0);
                  return (
                    <div key={stat} className="stat-box rounded-xl p-4 text-center">
                      <div className="text-lg mb-1">{STAT_ICONS[stat]}</div>
                      <div className="font-fantasy text-xs tracking-widest mb-1" style={{ color: 'rgba(180,140,90,0.5)', fontSize: '0.65rem' }}>
                        {STAT_LABELS[stat]}
                      </div>
                      <div className="font-fantasy font-bold text-3xl mb-1" style={{ color: '#e8d5b7' }}>{val}</div>
                      <div className="font-fantasy font-bold text-sm mb-1"
                        style={{ color: mod >= 0 ? '#86efac' : '#fca5a5' }}>{calcModDisplay(mod)}</div>
                      <div className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
                        Save {calcModDisplay(saveMod)}
                        {saveProf && <span style={{ color: 'rgba(201,169,110,0.5)' }}> ●</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-xl p-3 text-center stat-box">
                <span style={{ color: 'rgba(180,150,100,0.5)', fontFamily: 'EB Garamond, serif', fontSize: '0.9rem' }}>Proficiency Bonus: </span>
                <span className="font-fantasy font-bold" style={{ color: '#f0c040' }}>+{profBonus}</span>
              </div>
            </div>
          )}

          {tab === 'skills' && (
            <div className="space-y-0.5">
              {Object.entries(SKILL_STAT_MAP).map(([skill, stat]) => {
                const statMod = calcStatMod(character[stat] || 10);
                const profLevel = character.skills?.[skill];
                // Support boolean true (legacy), 'proficient', and 'expert'
                const bonus = profLevel === 'expert' ? profBonus * 2 : (profLevel === 'proficient' || profLevel === true) ? profBonus : 0;
                const total = statMod + bonus;
                return (
                  <div key={skill}
                    className="flex items-center justify-between py-2 px-3 rounded-lg transition-all"
                    style={{ borderBottom: '1px solid rgba(180,140,90,0.06)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(30,20,8,0.5)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          background: profLevel === 'expert' ? '#f0c040' : profLevel === 'proficient' ? '#86efac' : 'rgba(80,60,30,0.4)',
                          border: '1px solid ' + (profLevel === 'expert' ? 'rgba(240,192,64,0.5)' : profLevel === 'proficient' ? 'rgba(134,239,172,0.5)' : 'rgba(80,60,30,0.3)'),
                          boxShadow: profLevel ? '0 0 4px ' + (profLevel === 'expert' ? 'rgba(240,192,64,0.3)' : 'rgba(134,239,172,0.3)') : 'none'
                        }} />
                      <span className="text-sm" style={{ color: 'rgba(232,213,183,0.85)', fontFamily: 'EB Garamond, serif', fontSize: '0.95rem' }}>{skill}</span>
                      <span className="text-xs" style={{ color: 'rgba(180,140,90,0.35)' }}>({STAT_LABELS[stat]})</span>
                    </div>
                    <span className="font-fantasy font-bold text-sm"
                      style={{ color: total >= 0 ? '#86efac' : '#fca5a5' }}>{calcModDisplay(total)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'inventory' && <InventoryTab character={character} onUpdate={handleUpdateCharacter} onIdentify={null} />}

          {tab === 'conditions' && (
            <div className="space-y-2">
              {(character.conditions || []).length === 0 ? (
                <div className="text-center py-10 font-fantasy text-sm"
                  style={{ color: '#86efac', textShadow: '0 0 12px rgba(134,239,172,0.3)' }}>
                  ✓ No active conditions
                </div>
              ) : (
                (character.conditions || []).map((cond, i) => {
                  const name = typeof cond === 'string' ? cond : cond.name;
                  const condData = CONDITIONS[name?.toLowerCase()] || {};
                  return (
                    <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(20,10,5,0.6)', border: '1px solid rgba(180,100,50,0.2)' }}>
                      <div className="font-fantasy text-sm" style={{ color: condData.color?.replace('text-', '') || '#e8d5b7' }}>
                        {condData.icon} {name}
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'rgba(180,150,100,0.5)', fontFamily: 'EB Garamond, serif' }}>{condData.description}</div>
                    </div>
                  );
                })
              )}
              {(character.active_modifiers || []).length > 0 && (
                <div className="mt-4">
                  <div className="font-fantasy text-xs tracking-widest mb-2" style={{ color: 'rgba(201,169,110,0.4)', fontSize: '0.65rem' }}>ACTIVE MODIFIERS</div>
                  {character.active_modifiers.map((mod, i) => (
                    <div key={i} className="p-2 rounded-lg mb-1 flex justify-between text-sm"
                      style={{ background: 'rgba(20,13,5,0.5)', border: '1px solid rgba(180,140,90,0.12)' }}>
                      <span style={{ color: '#e8d5b7', fontFamily: 'EB Garamond, serif' }}>{mod.source}</span>
                      <span className="font-fantasy font-bold" style={{ color: mod.value >= 0 ? '#86efac' : '#fca5a5' }}>
                        {mod.value >= 0 ? '+' : ''}{mod.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'spells' && <SpellbookTab character={character} onUpdateCharacter={handleUpdateCharacter} />}

          {tab === 'features' && (
            <div className="space-y-2">
              {(character.features || []).length === 0 ? (
                <div className="text-center py-10 text-sm" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>No features recorded</div>
              ) : (
                (character.features || []).map((feat, i) => (
                  <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(20,13,5,0.5)', border: '1px solid rgba(180,140,90,0.12)' }}>
                    <div className="text-sm" style={{ color: 'rgba(232,213,183,0.85)', fontFamily: 'EB Garamond, serif' }}>{feat}</div>
                  </div>
                ))
              )}
              {character.backstory && (
                <div className="mt-4">
                  <div className="font-fantasy text-xs tracking-widest mb-2" style={{ color: 'rgba(201,169,110,0.4)', fontSize: '0.65rem' }}>BACKSTORY</div>
                  <div className="p-4 rounded-xl leading-relaxed text-sm"
                    style={{
                      background: 'rgba(15,10,4,0.7)',
                      border: '1px solid rgba(180,140,90,0.12)',
                      color: 'rgba(232,213,183,0.7)',
                      fontFamily: 'IM Fell English, serif',
                      lineHeight: '1.8'
                    }}>
                    {character.backstory}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom gold accent line */}
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.3) 40%, rgba(201,169,110,0.3) 60%, transparent)' }} />
      </motion.div>
    </div>
  );
}