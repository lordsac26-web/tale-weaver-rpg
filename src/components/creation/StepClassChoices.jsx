import React from 'react';
import { Check } from 'lucide-react';
import { getRequiredChoices } from './classChoicesData';

/**
 * StepClassChoices — handles all class/race features that require player selection:
 * Favored Enemy, Natural Explorer, Fighting Style, Draconic Ancestry,
 * Expertise, Totem Spirit, Pact Boon, Eldritch Invocations, Metamagic, etc.
 *
 * Stores all selections in character.class_choices: { [choiceId]: value }
 * where value is a string (single) or string[] (multi).
 */
export default function StepClassChoices({ character, set }) {
  const choices = getRequiredChoices(character);
  const classChoices = character.class_choices || {};

  const setChoice = (id, value) => {
    set('class_choices', { ...classChoices, [id]: value });
  };

  // For expertise, build dynamic options from proficient skills
  const proficientSkills = Object.entries(character.skills || {})
    .filter(([, v]) => v === 'proficient' || v === true)
    .map(([skill]) => skill);

  if (choices.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-amber-300 mb-1">Class & Race Choices</h2>
          <p className="text-amber-400/50 text-sm">No additional choices required for your current build.</p>
        </div>
        <div className="text-center py-12 text-slate-500">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-sm">Your {character.race} {character.class} doesn't have any mandatory selections at level {character.level}.</p>
          <p className="text-xs text-slate-600 mt-1">Proceed to the next step.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">Class & Race Choices</h2>
        <p className="text-amber-400/50 text-sm">
          Your build has {choices.length} feature{choices.length > 1 ? 's' : ''} that require a selection.
        </p>
      </div>

      {choices.map(choice => (
        <ChoiceSection
          key={choice.id}
          choice={choice}
          value={classChoices[choice.id]}
          onChange={(val) => setChoice(choice.id, val)}
          proficientSkills={proficientSkills}
        />
      ))}
    </div>
  );
}

function ChoiceSection({ choice, value, onChange, proficientSkills }) {
  const isSingle = choice.type === 'single';
  const isMulti = choice.type === 'multi';
  const max = choice.max || 1;

  // Build options — dynamic for expertise
  let options = choice.options;
  if (choice.dynamic === 'proficient_skills') {
    options = proficientSkills.map(s => ({ id: s, name: s, desc: '' }));
  }

  // Current multi-selection as array
  const multiValue = Array.isArray(value) ? value : [];

  const handleSingleSelect = (optId) => {
    onChange(value === optId ? null : optId);
  };

  const handleMultiToggle = (optId) => {
    if (multiValue.includes(optId)) {
      onChange(multiValue.filter(v => v !== optId));
    } else if (multiValue.length < max) {
      onChange([...multiValue, optId]);
    }
  };

  const selectedCount = isSingle ? (value ? 1 : 0) : multiValue.length;
  const totalNeeded = isSingle ? 1 : max;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/30"
        style={{ background: 'linear-gradient(90deg, rgba(80,50,10,0.15), transparent)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-amber-200 text-sm">{choice.label}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            selectedCount >= totalNeeded
              ? 'border-green-600/50 bg-green-900/20 text-green-300'
              : 'border-slate-600 text-slate-400'
          }`}>
            {selectedCount}/{totalNeeded}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{choice.description}</p>
      </div>

      {/* Options */}
      <div className="p-3 space-y-1.5">
        {options.length === 0 && (
          <p className="text-xs text-slate-500 py-2 text-center">
            No options available. Make sure you've selected skill proficiencies first.
          </p>
        )}
        {options.map(opt => {
          const isSelected = isSingle
            ? value === opt.id
            : multiValue.includes(opt.id);
          const isDisabled = !isSelected && isMulti && multiValue.length >= max;

          return (
            <button
              key={opt.id}
              onClick={() => isSingle ? handleSingleSelect(opt.id) : handleMultiToggle(opt.id)}
              disabled={isDisabled}
              className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                isSelected
                  ? 'border-amber-500/60 bg-amber-900/20'
                  : isDisabled
                  ? 'border-slate-700/20 bg-slate-800/20 opacity-40 cursor-not-allowed'
                  : 'border-slate-700/40 bg-slate-800/20 hover:border-amber-700/40 cursor-pointer'
              }`}>
              {/* Checkbox / Radio */}
              <div className={`w-5 h-5 rounded${isSingle ? '-full' : ''} border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                isSelected
                  ? 'bg-amber-600 border-amber-500'
                  : 'border-slate-600'
              }`}>
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-amber-100">{opt.name}</div>
                {opt.desc && (
                  <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{opt.desc}</div>
                )}
                {opt.prereq && (
                  <div className="text-xs text-purple-400/60 mt-0.5">Prerequisite: {opt.prereq}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}