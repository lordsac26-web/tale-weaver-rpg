import React, { useState } from 'react';
import { Plus, Trash2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { CLASSES } from '@/components/game/gameData';
import { SubclassTooltip } from '@/components/game/GameTooltip';

const CLASS_ICONS = {
  Fighter: '⚔️', Rogue: '🗡️', Wizard: '🔮', Cleric: '✨', Ranger: '🏹',
  Paladin: '🛡️', Barbarian: '🪓', Bard: '🎵', Druid: '🌿', Monk: '👊',
  Sorcerer: '💫', Warlock: '👁️', Artificer: '⚙️',
};

const STAT_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };

// D&D 5e multiclass prerequisites
const MULTICLASS_PREREQS = {
  Barbarian: { strength: 13 },
  Bard: { charisma: 13 },
  Cleric: { wisdom: 13 },
  Druid: { wisdom: 13 },
  Fighter: { strength: 13 }, // or DEX 13
  Monk: { dexterity: 13, wisdom: 13 },
  Paladin: { strength: 13, charisma: 13 },
  Ranger: { dexterity: 13, wisdom: 13 },
  Rogue: { dexterity: 13 },
  Sorcerer: { charisma: 13 },
  Warlock: { charisma: 13 },
  Wizard: { intelligence: 13 },
  Artificer: { intelligence: 13 },
};

function meetsPrereqs(character, className) {
  const reqs = MULTICLASS_PREREQS[className];
  if (!reqs) return true;
  // Fighter is special: STR 13 OR DEX 13
  if (className === 'Fighter') {
    return (character.strength || 10) >= 13 || (character.dexterity || 10) >= 13;
  }
  return Object.entries(reqs).every(([stat, min]) => (character[stat] || 10) >= min);
}

export default function StepMulticlass({ character, set }) {
  const [adding, setAdding] = useState(false);
  const [newClass, setNewClass] = useState('');
  const [newSubclass, setNewSubclass] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  const multiclass = character.multiclass || [];
  const primaryLevel = character.level || 1;
  const totalLevel = primaryLevel + multiclass.reduce((sum, mc) => sum + (mc.levels || 1), 0);

  const usedClasses = [character.class, ...multiclass.map(mc => mc.class)].filter(Boolean);

  const availableClasses = Object.keys(CLASSES).filter(c =>
    !usedClasses.includes(c)
  );

  const handleAdd = () => {
    if (!newClass) return;
    const updated = [...multiclass, { class: newClass, subclass: newSubclass || '', levels: 1 }];
    set('multiclass', updated);
    setNewClass('');
    setNewSubclass('');
    setAdding(false);
  };

  const handleRemove = (index) => {
    set('multiclass', multiclass.filter((_, i) => i !== index));
  };

  const handleLevelChange = (index, newLevel) => {
    const updated = multiclass.map((mc, i) =>
      i === index ? { ...mc, levels: Math.max(1, Math.min(20, newLevel)) } : mc
    );
    set('multiclass', updated);
  };

  const handlePrimaryLevelChange = (newLevel) => {
    set('level', Math.max(1, Math.min(20, newLevel)));
  };

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-amber-300">Multiclass</h3>
          <span className="text-xs text-slate-500">(optional)</span>
        </div>
        <button onClick={() => setShowInfo(v => !v)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 transition-colors">
          <Info className="w-4 h-4" />
        </button>
      </div>

      {showInfo && (
        <div className="bg-purple-900/15 border border-purple-700/30 rounded-xl p-3 text-xs text-purple-300/70 leading-relaxed"
          style={{ fontFamily: 'EB Garamond, serif' }}>
          <p className="mb-1"><strong>Multiclassing</strong> lets you combine features from multiple classes.</p>
          <p className="mb-1">• Your <strong>primary class</strong> determines starting proficiencies and hit die at level 1.</p>
          <p className="mb-1">• Each class has stat prerequisites (usually 13+ in key abilities).</p>
          <p>• HP, proficiency bonus, and spell slots are based on <strong>total character level</strong> ({totalLevel}).</p>
        </div>
      )}

      {/* Total level display */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg"
        style={{ background: 'rgba(20,10,3,0.6)', border: '1px solid rgba(180,140,90,0.2)' }}>
        <span className="text-xs text-slate-400">Total Character Level</span>
        <span className="font-bold text-amber-300 text-lg">{totalLevel}</span>
      </div>

      {/* Primary class card */}
      {character.class && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(20,10,3,0.5)', border: '1px solid rgba(184,115,51,0.25)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{CLASS_ICONS[character.class] || '⚡'}</span>
              <span className="font-bold text-amber-200 text-sm">{character.class}</span>
              {character.subclass && <span className="text-xs text-slate-500">({character.subclass})</span>}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-600/40 text-amber-300">Primary</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Level:</span>
            <button onClick={() => handlePrimaryLevelChange(primaryLevel - 1)}
              disabled={primaryLevel <= 1}
              className="w-6 h-6 rounded text-xs flex items-center justify-center bg-slate-800 border border-slate-600 text-amber-200 disabled:opacity-30">
              −
            </button>
            <span className="font-bold text-amber-300 w-6 text-center">{primaryLevel}</span>
            <button onClick={() => handlePrimaryLevelChange(primaryLevel + 1)}
              disabled={primaryLevel >= 20}
              className="w-6 h-6 rounded text-xs flex items-center justify-center bg-slate-800 border border-slate-600 text-amber-200 disabled:opacity-30">
              +
            </button>
          </div>
        </div>
      )}

      {/* Secondary classes */}
      {multiclass.map((mc, idx) => {
        const classData = CLASSES[mc.class];
        const prereqMet = meetsPrereqs(character, mc.class);
        return (
          <div key={idx} className="rounded-xl p-3"
            style={{
              background: prereqMet ? 'rgba(10,20,35,0.5)' : 'rgba(40,10,10,0.4)',
              border: `1px solid ${prereqMet ? 'rgba(80,120,200,0.25)' : 'rgba(200,60,60,0.3)'}`,
            }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{CLASS_ICONS[mc.class] || '⚡'}</span>
                <span className="font-bold text-blue-200 text-sm">{mc.class}</span>
                {mc.subclass && <span className="text-xs text-slate-500">({mc.subclass})</span>}
              </div>
              <button onClick={() => handleRemove(idx)}
                className="p-1.5 rounded-lg text-red-400/60 hover:text-red-300 hover:bg-red-900/20 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-500">Level:</span>
              <button onClick={() => handleLevelChange(idx, mc.levels - 1)}
                disabled={mc.levels <= 1}
                className="w-6 h-6 rounded text-xs flex items-center justify-center bg-slate-800 border border-slate-600 text-blue-200 disabled:opacity-30">
                −
              </button>
              <span className="font-bold text-blue-300 w-6 text-center">{mc.levels}</span>
              <button onClick={() => handleLevelChange(idx, mc.levels + 1)}
                disabled={mc.levels >= 20}
                className="w-6 h-6 rounded text-xs flex items-center justify-center bg-slate-800 border border-slate-600 text-blue-200 disabled:opacity-30">
                +
              </button>
            </div>
            {/* Subclass picker */}
            {classData?.subclasses?.length > 0 && mc.levels >= 3 && (
              <div>
                <label className="text-xs text-slate-500 block mb-1">Subclass</label>
                <div className="flex flex-wrap gap-1.5">
                  {classData.subclasses.map((sub) => {
                    const subName = typeof sub === 'string' ? sub : sub.name;
                    const isSelected = mc.subclass === subName;
                    return (
                      <button key={subName}
                        onClick={() => {
                          const updated = multiclass.map((m, i) =>
                            i === idx ? { ...m, subclass: isSelected ? '' : subName } : m
                          );
                          set('multiclass', updated);
                        }}
                        className={`px-2 py-1 rounded text-xs border transition-all ${
                          isSelected ? 'border-blue-500 bg-blue-900/30 text-blue-200' : 'border-slate-700/50 text-slate-400 hover:border-blue-700/50'
                        }`}>
                        {subName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {!prereqMet && (
              <div className="text-xs text-red-400/80 mt-2">
                ⚠️ Prerequisites not met: {Object.entries(MULTICLASS_PREREQS[mc.class] || {}).map(([stat, min]) =>
                  `${STAT_LABELS[stat]} ${min}+ (you have ${character[stat] || 10})`
                ).join(', ')}
              </div>
            )}
            {classData && (
              <div className="text-xs text-slate-500 mt-2">
                d{classData.hit_die} hit die · {classData.saves.map(s => STAT_LABELS[s]).join('/')} saves
              </div>
            )}
          </div>
        );
      })}

      {/* Add button */}
      {adding ? (
        <div className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(10,10,25,0.6)', border: '1px solid rgba(80,120,200,0.25)' }}>
          <label className="text-xs text-slate-400 block">Add a secondary class</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {availableClasses.map(cls => {
              const prereqMet = meetsPrereqs(character, cls);
              return (
                <button key={cls}
                  onClick={() => setNewClass(cls)}
                  disabled={!prereqMet}
                  className={`p-2 rounded-lg border text-xs text-left transition-all ${
                    newClass === cls ? 'border-blue-500 bg-blue-900/20 text-blue-200' :
                    !prereqMet ? 'border-slate-800 text-slate-600 opacity-50 cursor-not-allowed' :
                    'border-slate-700/50 text-slate-300 hover:border-blue-700/50'
                  }`}>
                  <span className="mr-1">{CLASS_ICONS[cls] || '⚡'}</span>
                  {cls}
                  {!prereqMet && <span className="block text-red-400/60 text-[10px] mt-0.5">Prereq not met</span>}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!newClass}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-900/40 border border-blue-600/40 text-blue-200 disabled:opacity-40 transition-all">
              <Plus className="w-3.5 h-3.5 inline mr-1" /> Add {newClass || 'Class'}
            </button>
            <button onClick={() => { setAdding(false); setNewClass(''); }}
              className="px-4 py-2 rounded-lg text-sm text-slate-500 border border-slate-700/30 hover:text-slate-300 transition-all">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full py-2.5 rounded-xl border border-dashed text-sm transition-all flex items-center justify-center gap-2"
          style={{ borderColor: 'rgba(80,120,200,0.3)', color: 'rgba(140,170,230,0.6)' }}>
          <Plus className="w-4 h-4" /> Add Secondary Class
        </button>
      )}
    </div>
  );
}