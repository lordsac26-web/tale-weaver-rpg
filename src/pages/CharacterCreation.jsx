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
import { FEATS } from '@/components/game/featData';
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
    name: '', gender: 'male', race: '', subrace: '', class: '', subclass: '', level: 1,
    background: '', backstory: '', alignment: 'True Neutral',
    strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
    skills: {}, inventory: [], conditions: [], active_modifiers: [], features: [], feats: [],
    gold: 0, silver: 0, copper: 0, xp: 0, spell_slots: {}, spells_known: [],
    portrait: '', chosen_stat_bonuses: [], feat_stat_choices: {}  // { [featName]: chosenStat } for choice-based ASI feats
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
    const race = RACES[char.race];
    if (!race) return char;
    
    let bonuses = { ...race.stat_bonuses };
    
    // Apply subrace bonuses
    if (char.subrace && race.subraces?.length > 0) {
      const subrace = race.subraces.find(s => s.name === char.subrace);
      if (subrace?.stat_bonuses) {
        Object.entries(subrace.stat_bonuses).forEach(([stat, val]) => {
          bonuses[stat] = (bonuses[stat] || 0) + val;
        });
      }
      
      // Handle stat_choices for subraces (e.g., Variant Human)
      if (subrace?.stat_choices && char.chosen_stat_bonuses?.length > 0) {
        char.chosen_stat_bonuses.forEach(stat => {
          bonuses[stat] = (bonuses[stat] || 0) + 1;
        });
      }
    }
    
    // Handle stat_choices for main race (e.g., Half-Elf)
    if (race.stat_choices && char.chosen_stat_bonuses?.length > 0 && !char.subrace) {
      char.chosen_stat_bonuses.forEach(stat => {
        bonuses[stat] = (bonuses[stat] || 0) + 1;
      });
    }
    
    const updated = { ...char };
    STATS.forEach(stat => { updated[stat] = (updated[stat] || 10) + (bonuses[stat] || 0); });
    return updated;
  };
 
  const updateDerivedStats = (char) => {
    const conMod = calcStatMod(char.constitution);
    const dexMod = calcStatMod(char.dexterity);
    const wisMod = calcStatMod(char.wisdom);
    const profBonus = PROFICIENCY_BY_LEVEL[(char.level || 1) - 1] || 2;
    const hp = calcHP(char.class, char.level || 1, conMod);
 
    // ── Armor Class ────────────────────────────────────────────────────────
    // Priority: class Unarmored Defense > racial Natural Armor > default 10+DEX
    let armorClass = 10 + dexMod;
 
    if (char.class === 'Monk') {
      // Unarmored Defense: 10 + DEX + WIS (PHB p.78)
      armorClass = 10 + dexMod + wisMod;
    } else if (char.class === 'Barbarian') {
      // Unarmored Defense: 10 + DEX + CON (PHB p.48)
      armorClass = 10 + dexMod + conMod;
    } else if (char.race === 'Lizardfolk') {
      // Natural Armor: 13 + DEX mod (VGTM p.113)
      armorClass = 13 + dexMod;
    } else if (char.race === 'Tortle') {
      // Natural Armor: 17, no DEX bonus (Tortle Package p.2)
      armorClass = 17;
    } else if (char.race === 'Warforged') {
      // Integrated Protection: +1 to AC from any armor category (ERLW p.36)
      // Unarmored base is 11 + DEX + proficiency (set conservatively to 11+DEX)
      armorClass = 11 + dexMod;
    }
 
    // ── Saving Throw Proficiencies ─────────────────────────────────────────
    // Write class saving throw proficiencies so CharacterSheetFull can read
    // them correctly from character.saving_throws (PHB each class section)
    const classSaves = CLASSES[char.class]?.saves || [];
    const ALL_STATS = ['strength','dexterity','constitution','intelligence','wisdom','charisma'];
    const saving_throws = {};
    ALL_STATS.forEach(s => { saving_throws[s] = classSaves.includes(s); });
 
    return {
      ...char,
      hp_max: hp,
      hp_current: hp,
      armor_class: armorClass,
      initiative: dexMod,
      speed: RACES[char.race]?.speed || 30,
      proficiency_bonus: profBonus,
      saving_throws,
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
 
  // Apply racial skill proficiencies (e.g. Elf → Perception, Tortle → Survival)
  // Uses the structured skill_proficiencies field on each race entry.
  // Does not overwrite skills the player already chose.
  const buildRacialSkills = (char) => {
    const raceData = RACES[char.race];
    if (!raceData?.skill_proficiencies?.length) return char;
    const skills = { ...char.skills };
    raceData.skill_proficiencies.forEach(skill => {
      if (!skills[skill]) skills[skill] = 'proficient';
    });
    return { ...char, skills };
  };
 
  // Apply stat bonuses from selected feats (e.g. Actor +1 CHA, Athlete +1 STR or DEX).
  // Fixed bonuses come from feat.asi_bonus; player choices come from feat.asi_choices
  // stored in character.feat_stat_choices[featName].
  // Also handles Resilient's saving throw proficiency grant.
  const applyFeatBonuses = (char) => {
    const selectedFeats = char.feats || [];
    const statBonuses = {};
    const extraSaveProfs = {};
 
    selectedFeats.forEach(featName => {
      const feat = FEATS.find(f => f.name === featName);
      if (!feat) return;
 
      // Fixed ASI (e.g. Actor +1 CHA, Durable +1 CON, Grappler +1 STR)
      if (feat.asi_bonus) {
        Object.entries(feat.asi_bonus).forEach(([stat, val]) => {
          statBonuses[stat] = (statBonuses[stat] || 0) + val;
        });
      }
 
      // Choice-based ASI (e.g. Athlete +1 STR or DEX, Resilient +1 any)
      // Player's choice is stored in character.feat_stat_choices[featName]
      if (feat.asi_choices && char.feat_stat_choices?.[featName]) {
        const chosen = char.feat_stat_choices[featName];
        if (feat.asi_choices.includes(chosen)) {
          statBonuses[chosen] = (statBonuses[chosen] || 0) + 1;
        }
      }
 
      // Resilient: also grants saving throw proficiency in the chosen stat
      if (feat.grants_save_proficiency && char.feat_stat_choices?.[featName]) {
        extraSaveProfs[char.feat_stat_choices[featName]] = true;
      }
    });
 
    const updated = { ...char };
 
    // Apply stat bonuses — cap at 20 per D&D 5e rules (PHB p.173)
    STATS.forEach(stat => {
      if (statBonuses[stat]) {
        updated[stat] = Math.min(20, (updated[stat] || 10) + statBonuses[stat]);
      }
    });
 
    // Merge feat-granted saving throw proficiencies into saving_throws object
    if (Object.keys(extraSaveProfs).length > 0) {
      updated.saving_throws = { ...(updated.saving_throws || {}), ...extraSaveProfs };
    }
 
    return updated;
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
    finalChar = applyFeatBonuses(finalChar);      // feats before derived stats so HP/AC use final values
    finalChar = updateDerivedStats(finalChar);
    finalChar = buildClassFeatures(finalChar);
    finalChar = buildSpellSlots(finalChar);
    finalChar = buildRacialSkills(finalChar);
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
    // Remove temporary creation-only fields
    delete finalChar._gear_customized;
    const saved = await base44.entities.Character.create(finalChar);
    navigate(createPageUrl('NewGame') + `?character_id=${saved.id}`);
  };
 
  const reviewChar = updateDerivedStats(applyFeatBonuses(applyRacialBonuses(character)));
 
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