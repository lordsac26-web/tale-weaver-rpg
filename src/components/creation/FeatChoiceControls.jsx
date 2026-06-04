import React from 'react';
import {
  SPELL_FEAT_CONFIG,
  SKILL_FEAT_CONFIG,
  getSpellOptionsForFeat,
  getSpellcastingAbilityOptions,
} from '@/components/game/featChoiceConfig';

const STAT_LABELS = {
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  charisma: 'Charisma',
};

function toggleListValue(list, value, max) {
  if (list.includes(value)) return list.filter(item => item !== value);
  if (list.length >= max) return list;
  return [...list, value];
}

export default function FeatChoiceControls({ featName, character, set }) {
  const spellConfig = SPELL_FEAT_CONFIG[featName];
  const skillConfig = SKILL_FEAT_CONFIG[featName];

  const classChoices = character.class_choices || {};
  const featSpellChoices = classChoices.feat_spell_choices || {};
  const featSkillChoices = classChoices.feat_skill_choices || {};
  const spellChoice = featSpellChoices[featName] || { className: '', cantrips: [], spells: [], spellcastingAbility: '' };
  const skillChoice = featSkillChoices[featName] || { skills: [] };

  const updateClassChoices = (updates) => set('class_choices', { ...classChoices, ...updates });

  const updateSpellChoice = (updates) => {
    updateClassChoices({
      feat_spell_choices: {
        ...featSpellChoices,
        [featName]: { ...spellChoice, ...updates },
      },
    });
  };

  const updateSkillChoice = (updates) => {
    updateClassChoices({
      feat_skill_choices: {
        ...featSkillChoices,
        [featName]: { ...skillChoice, ...updates },
      },
    });
  };

  if (spellConfig) {
    const cantripOptions = spellChoice.className ? getSpellOptionsForFeat(featName, spellChoice.className, 'cantrips') : [];
    const spellOptions = spellChoice.className ? getSpellOptionsForFeat(featName, spellChoice.className, 1) : [];
    const abilityOptions = getSpellcastingAbilityOptions(featName, spellChoice.className);

    return (
      <div className="bg-purple-950/25 border border-purple-700/30 rounded-lg px-3 py-3 space-y-3">
        <div className="text-xs text-purple-300 font-medium">Choose feat spell options:</div>
        <select
          value={spellChoice.className}
          onChange={e => {
            const className = e.target.value;
            const abilities = getSpellcastingAbilityOptions(featName, className);
            updateSpellChoice({ className, cantrips: [], spells: [], spellcastingAbility: abilities.length === 1 ? abilities[0] : '' });
          }}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-amber-100"
        >
          <option value="">Select spell list...</option>
          {spellConfig.classes.map(cls => <option key={cls} value={cls}>{cls}</option>)}
        </select>

        {abilityOptions.length > 1 && (
          <select
            value={spellChoice.spellcastingAbility}
            onChange={e => updateSpellChoice({ spellcastingAbility: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-amber-100"
          >
            <option value="">Select spellcasting ability...</option>
            {abilityOptions.map(ability => <option key={ability} value={ability}>{STAT_LABELS[ability]}</option>)}
          </select>
        )}

        {abilityOptions.length === 1 && spellChoice.className && (
          <div className="text-xs text-purple-200/70">Spellcasting ability: {STAT_LABELS[abilityOptions[0]]}</div>
        )}

        {spellConfig.cantripCount > 0 && spellChoice.className && (
          <div>
            <div className="text-xs text-slate-400 mb-1.5">Cantrips ({(spellChoice.cantrips || []).length}/{spellConfig.cantripCount})</div>
            <div className="grid grid-cols-2 gap-1.5">
              {cantripOptions.map(spell => {
                const selected = (spellChoice.cantrips || []).includes(spell);
                return (
                  <button key={spell} onClick={() => updateSpellChoice({ cantrips: toggleListValue(spellChoice.cantrips || [], spell, spellConfig.cantripCount) })}
                    className={`px-2 py-1 rounded text-xs transition-all ${selected ? 'bg-purple-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                    {spell}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {spellConfig.levelOneCount > 0 && spellChoice.className && (
          <div>
            <div className="text-xs text-slate-400 mb-1.5">1st-level spell{spellConfig.levelOneCount > 1 ? 's' : ''} ({(spellChoice.spells || []).length}/{spellConfig.levelOneCount})</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {spellOptions.map(spell => {
                const selected = (spellChoice.spells || []).includes(spell);
                return (
                  <button key={spell} onClick={() => updateSpellChoice({ spells: toggleListValue(spellChoice.spells || [], spell, spellConfig.levelOneCount) })}
                    className={`px-2 py-1 rounded text-xs transition-all ${selected ? 'bg-purple-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                    {spell}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (skillConfig) {
    return (
      <div className="bg-emerald-950/20 border border-emerald-700/30 rounded-lg px-3 py-3">
        <div className="text-xs text-emerald-300 font-medium mb-2">
          Choose skill proficiencies ({(skillChoice.skills || []).length}/{skillConfig.count}):
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {skillConfig.options.map(skill => {
            const selected = (skillChoice.skills || []).includes(skill);
            return (
              <button key={skill} onClick={() => updateSkillChoice({ skills: toggleListValue(skillChoice.skills || [], skill, skillConfig.count) })}
                className={`px-2 py-1 rounded text-xs transition-all ${selected ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                {skill}
              </button>
            );
          })}
        </div>
        {featName === 'Prodigy' && (
          <p className="text-xs text-emerald-200/60 mt-2">The chosen skill becomes proficient; if already proficient, it becomes expertise.</p>
        )}
      </div>
    );
  }

  return null;
}