import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';

import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RACES } from '@/components/game/gameData';
import { finalizeCharacter, buildReviewCharacter } from '@/lib/characterBuilder';
 
import StepGenderRace from '@/components/creation/StepGenderRace';
import StepClassInfo from '@/components/creation/StepClassInfo';
import StepSubclass from '@/components/creation/StepSubclass';
import StepAbilityScores from '@/components/creation/StepAbilityScores';
import StepSkillsFeatures from '@/components/creation/StepSkillsFeatures';
import StepBackground from '@/components/creation/StepBackground';
import StepPortrait from '@/components/creation/StepPortrait';
import StepBackstory from '@/components/creation/StepBackstory';
import StepEquipmentSpells from '@/components/creation/StepEquipmentSpells';
import StepFeats from '@/components/creation/StepFeats';
import StepClassChoices from '@/components/creation/StepClassChoices';
import StepReview from '@/components/creation/StepReview';
import { getRequiredChoices } from '@/components/creation/classChoicesData';
 
const STEPS = [
  { id: 'identity', label: 'Identity', icon: '👤' },
  { id: 'class', label: 'Class', icon: '⚔️' },
  { id: 'stats', label: 'Stats', icon: '🎲' },
  { id: 'subclass', label: 'Subclass', icon: '✨' },
  { id: 'skills', label: 'Skills', icon: '📋' },
  { id: 'choices', label: 'Choices', icon: '🎯' },
  { id: 'background', label: 'Background', icon: '📖' },
  { id: 'portrait', label: 'Portrait', icon: '🎨' },
  { id: 'backstory', label: 'Backstory', icon: '✍️' },
  { id: 'equipment', label: 'Equipment', icon: '🎒' },
  { id: 'feats', label: 'Feats', icon: '⭐' },
  { id: 'review', label: 'Review', icon: '✅' },
];
 
const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
 
export default function CharacterCreation() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generatingBackstory, setGeneratingBackstory] = useState(false);
  const [backstoryPrompt, setBackstoryPrompt] = useState('');
 
  const [character, setCharacter] = useState({
    name: '', gender: 'male', age: 25, race: '', subrace: '', class: '', subclass: '', level: 1,
    background: '', backstory: '', alignment: 'True Neutral', alignment_mode: 'static',
    alignment_scores: { good_evil: 0, law_chaos: 0, sanity: 0 }, alignment_history: [],
    strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
    skills: {}, inventory: [], conditions: [], active_modifiers: [], features: [], feats: [],
    gold: 0, silver: 0, copper: 0, xp: 0, spell_slots: {}, spells_known: [],
    portrait: '', chosen_stat_bonuses: [], feat_stat_choices: {},
    class_choices: {}  // { favored_enemy, favored_terrain, fighting_style, expertise, draconic_ancestry, ... }
  });
 
  const set = (key, val) => setCharacter(prev => ({ ...prev, [key]: val }));

  const [backstoryError, setBackstoryError] = useState(null);

  const handleGenerateBackstory = async () => {
    setGeneratingBackstory(true);
    setBackstoryError(null);
    try {
      const result = await base44.functions.invoke('generateBackstory', {
        name: character.name || 'The Hero',
        race: character.race, class: character.class, age: character.age,
        background: character.background, level: character.level,
        prompt: backstoryPrompt,
        // Pass the full build so the backstory reflects the actual character
        skills: Object.keys(character.skills || {}).filter(s => character.skills[s]),
        feats: character.feats || [],
        ability_scores: {
          strength: character.strength, dexterity: character.dexterity,
          constitution: character.constitution, intelligence: character.intelligence,
          wisdom: character.wisdom, charisma: character.charisma,
        },
      });
      if (result.data?.backstory) set('backstory', result.data.backstory);
      else setBackstoryError('The storyteller paused. Please try generating again.');
    } catch (err) {
      console.error('Backstory generation failed:', err);
      setBackstoryError('Backstory generation failed. Please try again in a moment.');
    } finally {
      setGeneratingBackstory(false);
    }
  };
 
  const handleSave = async () => {
    setSaving(true);
    const finalChar = await finalizeCharacter(character);
    const saved = await base44.entities.Character.create(finalChar);
    navigate(`/NewGame?character_id=${saved.id}`);
  };

  const reviewChar = buildReviewCharacter(character);
 
  const canProceed = () => {
    switch (step) {
      case 0: {
        if (!character.race || !character.gender) return false;
        const race = RACES[character.race];
        const subrace = character.subrace && race?.subraces ? race.subraces.find(s => s.name === character.subrace) : null;
        const statChoicesNeeded = (subrace?.stat_choices || race?.stat_choices || 0);
        const chosenStats = character.chosen_stat_bonuses || [];
        return chosenStats.length === statChoicesNeeded;
      }
      case 1: return !!character.class && !!character.name;
      case 2: {
        const validRange = STATS.every(s => character[s] >= 3 && character[s] <= 20);
        if (character._stats_method === 'standard') {
          // Robust check: the six stats must exactly match the standard array
          // (15,14,13,12,10,8), so completion survives even if the transient
          // assignment flag is lost on remount.
          const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
          const assigned = STATS.map(s => character[s]).sort((a, b) => b - a);
          const matchesArray = STANDARD_ARRAY.every((v, i) => assigned[i] === v);
          return validRange && (character._standard_complete === true || matchesArray);
        }
        return validRange;
      }
      case 3: return true; // subclass (optional / level-gated)
      case 4: return true; // skills
      case 5: {
        // Every required class/race choice must be fully selected before continuing.
        // Single choices need a value; multi choices need exactly `max` selections.
        const required = getRequiredChoices(character);
        const cc = character.class_choices || {};
        return required.every(choice => {
          const val = cc[choice.id];
          if (choice.type === 'multi') {
            const arr = Array.isArray(val) ? val : [];
            // Expertise depends on proficient skills existing — allow as many as available up to max.
            if (choice.dynamic === 'proficient_skills') {
              const profCount = Object.values(character.skills || {}).filter(v => v === 'proficient' || v === true).length;
              return arr.length >= Math.min(choice.max || 1, profCount);
            }
            return arr.length >= (choice.max || 1);
          }
          return !!val;
        });
      }
      case 6: return !!character.background;
      case 7: return true; // portrait is optional
      case 8: return !!character.backstory;
      case 9: return true; // equipment
      case 10: return character._feat_choices_complete !== false; // feats
      case 11: return true;
      default: return true;
    }
  };
 
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-amber-100">
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0d0a1a] to-[#0a0a0f] pointer-events-none" />
 
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/Home')} className="text-amber-400/60 hover:text-amber-400 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-amber-300">Create Your Hero</h1>
            <p className="text-amber-400/50 text-sm">Step {step + 1} of {STEPS.length} — {STEPS[step].label}</p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-slate-500 mb-1">Progress</div>
            <div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
          </div>
        </div>
 
        {/* Step indicator */}
        <div className="flex gap-1.5 mb-8 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <button key={s.id}
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                i === step ? 'bg-amber-600/80 text-white border border-amber-500/60' :
                i < step ? 'bg-amber-900/30 text-amber-400 cursor-pointer border border-amber-700/30 hover:bg-amber-900/50' :
                'bg-slate-800/60 text-slate-600 cursor-default border border-slate-700/30'
              }`}>
              <span>{s.icon}</span>
              {i < step && <Check className="w-2.5 h-2.5" />}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
 
        {/* Step Content */}
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6 md:p-8 min-h-[420px]">
          {step === 0 && <StepGenderRace character={character} set={set} />}
          {step === 1 && <StepClassInfo character={character} set={set} />}
          {step === 2 && <StepAbilityScores character={character} set={set} />}
          {step === 3 && <StepSubclass character={character} set={set} />}
          {step === 4 && <StepSkillsFeatures character={character} set={set} />}
          {step === 5 && <StepClassChoices character={character} set={set} />}
          {step === 6 && <StepBackground character={character} set={set} />}
          {step === 7 && <StepPortrait character={character} set={set} />}
          {step === 8 && (
            <StepBackstory character={character} set={set}
              backstoryPrompt={backstoryPrompt} setBackstoryPrompt={setBackstoryPrompt}
              onGenerate={handleGenerateBackstory} generating={generatingBackstory} error={backstoryError} />
          )}
          {step === 9 && <StepEquipmentSpells character={character} set={set} />}
          {step === 10 && <StepFeats character={character} set={set} />}
          {step === 11 && <StepReview character={reviewChar} />}
        </div>
 
        {/* Navigation */}
        <div className="flex justify-between items-center mt-6">
          <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800"
            onClick={() => setStep(s => s - 1)} disabled={step === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
 
          <div className="flex items-center gap-2">
            {step === 7 && (
              <Button variant="ghost" className="text-slate-500 hover:text-slate-300 text-sm"
                onClick={() => setStep(s => s + 1)}>
                Skip Portrait
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button className="bg-amber-700 hover:bg-amber-600 text-white min-w-[100px]"
                onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button className="bg-green-700 hover:bg-green-600 text-white px-8 min-w-[140px]"
                onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                {saving ? 'Creating...' : 'Create Hero'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}