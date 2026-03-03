import React from 'react';
import { Check } from 'lucide-react';
import { CLASSES, BACKGROUNDS, calcStatMod, PROFICIENCY_BY_LEVEL, SKILL_STAT_MAP } from '@/components/game/gameData';

const STAT_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };

export default function StepSkillsFeatures({ character, set }) {
  const classData = CLASSES[character.class];
  const bgData = BACKGROUNDS.find(b => b.name === character.background);
  const bgSkills = bgData?.skills || [];
  const availableSkills = classData?.skills || Object.keys(SKILL_STAT_MAP);
  const maxSkills = classData?.skill_count || 2;
  const chosen = Object.keys(character.skills || {}).filter(s => character.skills[s] === 'proficient');
  const profBonus = PROFICIENCY_BY_LEVEL[(character.level || 1) - 1] || 2;

  // Auto-grant background skills
  const allProficientSkills = new Set([...chosen, ...bgSkills]);

  const toggleSkill = (skill) => {
    const current = { ...character.skills };
    if (current[skill] === 'proficient') {
      delete current[skill];
    } else if (chosen.length < maxSkills) {
      current[skill] = 'proficient';
    }
    set('skills', current);
  };

  // Class features at current level
  const classFeatures = [];
  const features = classData?.features || {};
  Object.entries(features).forEach(([lvl, feats]) => {
    if (parseInt(lvl) <= (character.level || 1)) {
      feats.forEach(f => classFeatures.push({ name: f, level: parseInt(lvl) }));
    }
  });

  return (
    <div className="space-y-8">
      {/* Skills */}
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">Skills & Proficiencies</h2>
        <p className="text-amber-400/50 text-sm mb-4">
          Choose <span className="text-amber-300 font-bold">{maxSkills}</span> class skills. Background skills are auto-granted.
          <span className="ml-2 text-green-400">({chosen.length}/{maxSkills} chosen)</span>
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(SKILL_STAT_MAP).map(([skill, stat]) => {
            const isChosen = !!character.skills?.[skill];
            const isBgSkill = bgSkills.includes(skill);
            const isClassSkill = availableSkills.includes(skill);
            const statMod = calcStatMod(character[stat] || 10);
            const total = statMod + (allProficientSkills.has(skill) ? profBonus : 0);
            const canSelect = isClassSkill && !isBgSkill;
            const disabled = !canSelect || (!isChosen && chosen.length >= maxSkills);

            return (
              <button key={skill}
                onClick={() => canSelect && toggleSkill(skill)}
                disabled={disabled}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isBgSkill ? 'border-blue-600/60 bg-blue-900/20 cursor-default' :
                  isChosen ? 'border-green-500 bg-green-900/20' :
                  disabled ? 'border-slate-700/30 bg-slate-800/20 opacity-40 cursor-not-allowed' :
                  'border-slate-700/50 bg-slate-800/30 hover:border-green-700/50 cursor-pointer'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-amber-200 truncate">{skill}</div>
                  {(isChosen || isBgSkill) && <Check className="w-3 h-3 text-green-400 flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-slate-400">{STAT_LABELS[stat]}</span>
                  <span className={`text-xs font-bold ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>{total >= 0 ? '+' : ''}{total}</span>
                  {isBgSkill && <span className="text-xs text-blue-400">(background)</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Class Features */}
      {classFeatures.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-purple-300 mb-3">Class Features at Level {character.level}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {classFeatures.map((feat, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-purple-900/10 border border-purple-700/30 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-purple-800/60 flex items-center justify-center text-purple-300 text-xs flex-shrink-0 mt-0.5">{feat.level}</div>
                <div>
                  <div className="text-purple-200 text-sm font-medium">{feat.name}</div>
                  <div className="text-purple-400/50 text-xs">Granted at level {feat.level}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}