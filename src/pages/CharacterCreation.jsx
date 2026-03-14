import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  RACES, CLASSES, BACKGROUNDS, ALIGNMENTS,
  calcStatMod, calcHP, roll4d6DropLowest,
  PROFICIENCY_BY_LEVEL
} from '@/components/game/gameData';
import { getSpellSlotsForLevel } from '@/components/game/spellData';

import StepGenderRace from '@/components/creation/StepGenderRace';
import StepClassInfo from '@/components/creation/StepClassInfo';
import StepAbilityScores from '@/components/creation/StepAbilityScores';
import StepSkillsFeatures from '@/components/creation/StepSkillsFeatures';
import StepBackground from '@/components/creation/StepBackground';
import StepPortrait from '@/components/creation/StepPortrait';
import StepBackstory from '@/components/creation/StepBackstory';
import StepEquipmentSpells from '@/components/creation/StepEquipmentSpells';
import StepFeats from '@/components/creation/StepFeats';
import StepReview from '@/components/creation/StepReview';

const STEPS = [
  { id: 'identity', label: 'Identity', icon: '👤' },
  { id: 'class', label: 'Class', icon: '⚔️' },
  { id: 'stats', label: 'Stats', icon: '🎲' },
  { id: 'skills', label: 'Skills', icon: '📋' },
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
    name: '', gender: 'male', race: '', class: '', subclass: '', level: 1,
    background: '', backstory: '', alignment: 'True Neutral',
    strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
    skills: {}, inventory: [], conditions: [], active_modifiers: [], features: [], feats: [],
    gold: 0, silver: 0, copper: 0, xp: 0, spell_slots: {}, spells_known: [],
    portrait: ''
  });

  const set = (key, val) => setCharacter(prev => ({ ...prev, [key]: val }));

  const rollAllStats = () => {
    const updates = {};
    STATS.forEach(stat => { updates[stat] = roll4d6DropLowest(); });
    setCharacter(prev => ({ ...prev, ...updates }));
  };

  const pointBuyStats = () => {
    setCharacter(prev => ({ ...prev, strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 }));
  };

  const applyRacialBonuses = (char) => {
    const raceBonuses = RACES[char.race]?.stat_bonuses || {};
    const updated = { ...char };
    STATS.forEach(stat => { updated[stat] = (updated[stat] || 10) + (raceBonuses[stat] || 0); });
    return updated;
  };

  const updateDerivedStats = (char) => {
    const conMod = calcStatMod(char.constitution);
    const dexMod = calcStatMod(char.dexterity);
    const wisMod = calcStatMod(char.wisdom);
    const profBonus = PROFICIENCY_BY_LEVEL[(char.level || 1) - 1] || 2;
    const hp = calcHP(char.class, char.level || 1, conMod);
    
    // Calculate AC based on class — Unarmored Defense for Monk/Barbarian
    let armorClass = 10 + dexMod;
    if (char.class === 'Monk') {
      armorClass = 10 + dexMod + wisMod; // Monk: 10 + DEX + WIS
    } else if (char.class === 'Barbarian') {
      armorClass = 10 + dexMod + conMod; // Barbarian: 10 + DEX + CON
    }
    
    return {
      ...char,
      hp_max: hp, hp_current: hp,
      armor_class: armorClass,
      initiative: dexMod,
      speed: RACES[char.race]?.speed || 30,
      proficiency_bonus: profBonus
    };
  };

  const buildClassFeatures = (char) => {
    const classData = CLASSES[char.class];
    const features = [];
    Object.entries(classData?.features || {}).forEach(([lvl, feats]) => {
      if (parseInt(lvl) <= (char.level || 1)) feats.forEach(f => features.push(f));
    });
    return { ...char, features };
  };

  const buildSpellSlots = (char) => {
    const slots = getSpellSlotsForLevel(char.class, char.level || 1);
    const spell_slots = {};
    slots.forEach((max, i) => { if (max > 0) spell_slots[`level_${i + 1}`] = 0; }); // track used slots (start at 0 used)
    return { ...char, spell_slots };
  };

  const handleGenerateBackstory = async () => {
    setGeneratingBackstory(true);
    const result = await base44.functions.invoke('generateBackstory', {
      name: character.name || 'The Hero',
      race: character.race, class: character.class,
      background: character.background, level: character.level,
      prompt: backstoryPrompt
    });
    if (result.data?.backstory) set('backstory', result.data.backstory);
    setGeneratingBackstory(false);
  };

  const handleSave = async () => {
    setSaving(true);
    let finalChar = applyRacialBonuses(character);
    finalChar = updateDerivedStats(finalChar);
    finalChar = buildClassFeatures(finalChar);
    finalChar = buildSpellSlots(finalChar);
    // Apply background skills
    const bgData = BACKGROUNDS.find(b => b.name === finalChar.background);
    if (bgData) {
      const skills = { ...finalChar.skills };
      bgData.skills.forEach(s => { if (!skills[s]) skills[s] = 'proficient'; });
      finalChar = { ...finalChar, skills };
      // Background equipment if inventory empty
      if (!finalChar.inventory?.length) {
        finalChar.inventory = bgData.equipment.map(e => ({ name: e, type: 'gear', weight: 1 }));
      }
    }
    const saved = await base44.entities.Character.create(finalChar);
    navigate(createPageUrl('NewGame') + `?character_id=${saved.id}`);
  };

  const reviewChar = applyRacialBonuses(updateDerivedStats(character));

  const canProceed = () => {
    switch (step) {
      case 0: return !!character.race && !!character.gender;
      case 1: return !!character.class && !!character.name;
      case 2: return STATS.every(s => character[s] >= 3 && character[s] <= 20);
      case 3: return true;
      case 4: return !!character.background;
      case 5: return true; // portrait is optional
      case 6: return !!character.backstory;
      case 7: return true;
      case 8: return true; // feats
      case 9: return true;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-amber-100">
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0d0a1a] to-[#0a0a0f] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(createPageUrl('Home'))} className="text-amber-400/60 hover:text-amber-400 transition-colors">
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
          {step === 2 && <StepAbilityScores character={character} set={set} rollAll={rollAllStats} pointBuy={pointBuyStats} />}
          {step === 3 && <StepSkillsFeatures character={character} set={set} />}
          {step === 4 && <StepBackground character={character} set={set} />}
          {step === 5 && <StepPortrait character={character} set={set} />}
          {step === 6 && (
            <StepBackstory character={character} set={set}
              backstoryPrompt={backstoryPrompt} setBackstoryPrompt={setBackstoryPrompt}
              onGenerate={handleGenerateBackstory} generating={generatingBackstory} />
          )}
          {step === 7 && <StepEquipmentSpells character={character} set={set} />}
          {step === 8 && <StepFeats character={character} set={set} />}
          {step === 9 && <StepReview character={reviewChar} />}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6">
          <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800"
            onClick={() => setStep(s => s - 1)} disabled={step === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          <div className="flex items-center gap-2">
            {step === 5 && (
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