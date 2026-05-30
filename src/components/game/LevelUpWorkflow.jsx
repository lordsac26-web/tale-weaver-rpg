import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, TrendingUp, Heart, Sparkles, Award, X, ArrowLeft, ArrowRight, Check } from 'lucide-react';

import StepClassChoice from './levelup/StepClassChoice';
import StepHP from './levelup/StepHP';
import StepSubclass from './levelup/StepSubclass';
import StepASI from './levelup/StepASI';
import StepSpells from './levelup/StepSpells';
import StepFeatures from './levelup/StepFeatures';
import StepSummary from './levelup/StepSummary';
import { calcStatMod, PROFICIENCY_BY_LEVEL, CLASSES } from './gameData';

/**
 * LevelUpWorkflow - A guided, multi-step workflow for character advancement
 * Replaces the monolithic LevelUpModal with a more intuitive and modular process
 */
export default function LevelUpWorkflow({ character, onLevelUp, onClose }) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState(() => {
    const classOptions = [
      { class: character.class, level: character.level || 1, isPrimary: true },
      ...(character.multiclass || []).map(mc => ({ class: mc.class, level: mc.levels || 1, isPrimary: false }))
    ];
    return {
      classOptions,
      isMulticlass: classOptions.length > 1,
      receivingClass: character.class,
      hpRoll: null,
      selectedSubclass: '',
      asiChoice: 'stats',
      statIncreases: { first: '', second: '' },
      selectedFeat: '',
      spellSelection: { cantrips: [], spells: [] },
    };
  });

  // Derived values based on state
  const { receivingClass, classOptions } = state;
  const receivingOption = classOptions.find(o => o.class === receivingClass) || classOptions[0];
  const receivingClassLevel = receivingOption.level;
  const newClassLevel = receivingClassLevel + 1;
  const totalLevel = classOptions.reduce((sum, o) => sum + o.level, 0);
  const newTotalLevel = totalLevel + 1;

  const classData = CLASSES[receivingClass] || {};
  const needsSubclass = receivingClass === character.class &&
    !character.subclass && newClassLevel >= 3 && classData.subclasses?.length > 0;

  const ASI_LEVELS = ['Fighter', 'Rogue'].includes(receivingClass) ? [4, 6, 8, 10, 12, 14, 16, 19] : [4, 8, 12, 16, 19];
  const grantsASI = ASI_LEVELS.includes(newClassLevel);

  // Build the workflow steps dynamically
  const steps = useMemo(() => {
    const wf = [];
    if (state.isMulticlass) wf.push({ id: 'class', component: StepClassChoice, title: 'Choose Class' });
    wf.push({ id: 'hp', component: StepHP, title: 'Increase Hit Points' });
    if (needsSubclass) wf.push({ id: 'subclass', component: StepSubclass, title: 'Choose Subclass' });
    if (grantsASI) wf.push({ id: 'asi', component: StepASI, title: 'Ability/Feat' });
    wf.push({ id: 'features', component: StepFeatures, title: 'New Features' });
    // Spell step is complex - might need its own sub-steps if many are learned
    wf.push({ id: 'spells', component: StepSpells, title: 'Learn Spells' });
    wf.push({ id: 'summary', component: StepSummary, title: 'Review & Confirm' });
    return wf;
  }, [state.isMulticlass, needsSubclass, grantsASI]);

  const CurrentStepComponent = steps[step]?.component;
  const currentStepIsValid = () => {
    // Add validation logic per step
    return true;
  };

  const handleNext = () => setStep(prev => Math.min(prev + 1, steps.length - 1));
  const handleBack = () => setStep(prev => Math.max(prev - 1, 0));

  const handleConfirm = async () => {
    const hpGain = state.hpRoll + calcStatMod(character.constitution);
    const updates = {
      hp_max: (character.hp_max || 0) + hpGain,
      hp_current: (character.hp_current || 0) + hpGain,
      proficiency_bonus: PROFICIENCY_BY_LEVEL[newTotalLevel - 1],
      level_into_class: receivingClass,
      ...(needsSubclass && { subclass: state.selectedSubclass }),
      ...(grantsASI && state.asiChoice === 'stats' && {
        [state.statIncreases.first]: (character[state.statIncreases.first] || 10) + 1,
        [state.statIncreases.second]: (character[state.statIncreases.second] || 10) + 1,
      }),
      ...(grantsASI && state.asiChoice === 'feat' && {
        feats: [...(character.feats || []), state.selectedFeat]
      }),
    };
    
    await onLevelUp(updates, { hpGain, newFeatures: [] });
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}>
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-3xl rounded-2xl overflow-hidden glass-panel">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(184,115,51,0.2)' }}>
          <h2 className="font-fantasy font-bold text-2xl text-glow-gold">Level Up: {character.name}</h2>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: 'rgba(201,169,110,0.5)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3" style={{ background: 'rgba(8,5,2,0.7)' }}>
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.id} className="flex-1 h-1.5 rounded-full transition-all"
                style={{
                  background: i <= step ? 'var(--brass-gold)' : 'rgba(201,169,110,0.15)',
                  boxShadow: i <= step ? '0 0 10px rgba(240,192,64,0.3)' : 'none'
                }} />
            ))}
          </div>
          <div className="text-center text-xs mt-2 font-fantasy" style={{ color: 'var(--parchment-mid)' }}>
            Step {step + 1} of {steps.length}: {steps[step]?.title}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6 min-h-[50vh] max-h-[60vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {CurrentStepComponent && <CurrentStepComponent character={character} workflowState={state} setWorkflowState={setState} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid rgba(184,115,51,0.2)', background: 'rgba(10,5,2,0.8)' }}>
          <button onClick={handleBack} disabled={step === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-fantasy btn-fantasy disabled:opacity-40">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          {step === steps.length - 1 ? (
            <button onClick={handleConfirm}
              className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-fantasy btn-combat">
              <Check className="w-4 h-4" />
              Confirm Level Up
            </button>
          ) : (
            <button onClick={handleNext} disabled={!currentStepIsValid()}
              className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-fantasy btn-fantasy">
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}