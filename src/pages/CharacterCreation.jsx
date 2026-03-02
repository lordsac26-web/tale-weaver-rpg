import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Dice6, Wand2, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  RACES, CLASSES, BACKGROUNDS, ALIGNMENTS,
  calcStatMod, calcModDisplay, calcHP, roll4d6DropLowest,
  PROFICIENCY_BY_LEVEL, SKILL_STAT_MAP
} from '@/components/game/gameData';

const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const STAT_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };

const STEPS = ['Race', 'Class', 'Stats', 'Skills', 'Background', 'Backstory', 'Review'];

export default function CharacterCreation() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generatingBackstory, setGeneratingBackstory] = useState(false);
  const [backstoryPrompt, setBackstoryPrompt] = useState('');

  const [character, setCharacter] = useState({
    name: '', race: '', class: '', subclass: '', level: 1,
    background: '', backstory: '', alignment: 'True Neutral',
    strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
    skills: {}, inventory: [], conditions: [], active_modifiers: [], features: [],
    gold: 0, silver: 0, copper: 0, xp: 0, spell_slots: {}, spells_known: []
  });

  const set = (key, val) => setCharacter(prev => ({ ...prev, [key]: val }));

  const rollAllStats = () => {
    STATS.forEach(stat => set(stat, roll4d6DropLowest()));
  };

  const pointBuyStats = () => {
    setCharacter(prev => ({ ...prev, strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 }));
  };

  const updateDerivedStats = (char) => {
    const conMod = calcStatMod(char.constitution);
    const dexMod = calcStatMod(char.dexterity);
    const profBonus = PROFICIENCY_BY_LEVEL[(char.level || 1) - 1] || 2;
    const hp = calcHP(char.class, char.level || 1, conMod);
    return {
      ...char,
      hp_max: hp, hp_current: hp,
      armor_class: 10 + dexMod,
      initiative: dexMod,
      speed: RACES[char.race]?.speed || 30,
      proficiency_bonus: profBonus
    };
  };

  const applyRacialBonuses = (char) => {
    const raceBonuses = RACES[char.race]?.stat_bonuses || {};
    const updated = { ...char };
    STATS.forEach(stat => {
      updated[stat] = (updated[stat] || 10) + (raceBonuses[stat] || 0);
    });
    return updated;
  };

  const handleGenerateBackstory = async () => {
    setGeneratingBackstory(true);
    const result = await base44.functions.invoke('generateBackstory', {
      name: character.name || 'The Hero',
      race: character.race,
      class: character.class,
      background: character.background,
      level: character.level,
      prompt: backstoryPrompt
    });
    if (result.data?.backstory) {
      set('backstory', result.data.backstory);
    }
    setGeneratingBackstory(false);
  };

  const handleSave = async () => {
    setSaving(true);
    let finalChar = applyRacialBonuses(character);
    finalChar = updateDerivedStats(finalChar);
    const saved = await base44.entities.Character.create(finalChar);
    navigate(createPageUrl('NewGame') + `?character_id=${saved.id}`);
  };

  const canProceed = () => {
    if (step === 0) return !!character.race;
    if (step === 1) return !!character.class && !!character.name;
    if (step === 2) return STATS.every(s => character[s] >= 3);
    if (step === 3) return true;
    if (step === 4) return !!character.background;
    if (step === 5) return !!character.backstory;
    return true;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-amber-100">
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0d0a1a] to-[#0a0a0f] pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(createPageUrl('Home'))} className="text-amber-400/60 hover:text-amber-400 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold text-amber-300">Create Your Hero</h1>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-10 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => i < step && setStep(i)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                i === step ? 'bg-amber-600 text-white' :
                i < step ? 'bg-amber-900/40 text-amber-300 cursor-pointer' :
                'bg-slate-800/60 text-slate-500 cursor-default'
              }`}>
              {i < step && <Check className="w-3 h-3 inline mr-1" />}{s}
            </button>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-8 min-h-[400px]">
          {step === 0 && <StepRace character={character} set={set} />}
          {step === 1 && <StepClass character={character} set={set} />}
          {step === 2 && <StepStats character={character} set={set} rollAll={rollAllStats} pointBuy={pointBuyStats} />}
          {step === 3 && <StepSkills character={character} set={set} />}
          {step === 4 && <StepBackground character={character} set={set} />}
          {step === 5 && (
            <StepBackstory character={character} set={set}
              backstoryPrompt={backstoryPrompt} setBackstoryPrompt={setBackstoryPrompt}
              onGenerate={handleGenerateBackstory} generating={generatingBackstory}
            />
          )}
          {step === 6 && <StepReview character={applyRacialBonuses(updateDerivedStats(character))} />}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800"
            onClick={() => setStep(s => s - 1)} disabled={step === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button className="bg-amber-700 hover:bg-amber-600 text-white" onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button className="bg-green-700 hover:bg-green-600 text-white px-8" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Create Hero
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepRace({ character, set }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-amber-300 mb-6">Choose Your Race</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(RACES).map(([race, data]) => (
          <button key={race} onClick={() => set('race', race)}
            className={`p-4 rounded-xl border text-left transition-all ${
              character.race === race
                ? 'border-amber-500 bg-amber-900/30'
                : 'border-slate-700/50 bg-slate-800/30 hover:border-amber-700/50'
            }`}>
            <div className="font-bold text-amber-200 mb-1">{race}</div>
            <div className="text-amber-400/60 text-xs mb-2">{data.description}</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(data.stat_bonuses).map(([stat, val]) => (
                <span key={stat} className="bg-amber-900/40 text-amber-300 text-xs px-2 py-0.5 rounded-full">
                  {STAT_LABELS[stat]} {val > 0 ? '+' : ''}{val}
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {data.traits.slice(0, 2).map(t => (
                <span key={t} className="bg-slate-700/50 text-slate-300 text-xs px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepClass({ character, set }) {
  const selectedClass = CLASSES[character.class];
  return (
    <div>
      <h2 className="text-2xl font-bold text-amber-300 mb-2">Name & Class</h2>
      <div className="mb-6">
        <label className="text-amber-400/80 text-sm mb-2 block">Character Name</label>
        <Input value={character.name} onChange={e => set('name', e.target.value)}
          placeholder="Enter your hero's name..."
          className="bg-slate-800/60 border-slate-600 text-amber-100 placeholder-slate-500 max-w-xs" />
      </div>
      <div className="mb-6">
        <label className="text-amber-400/80 text-sm mb-2 block">Starting Level (1–20)</label>
        <div className="flex items-center gap-3">
          <input type="range" min={1} max={20} value={character.level}
            onChange={e => set('level', Number(e.target.value))}
            className="w-48 accent-amber-500" />
          <span className="text-amber-300 font-bold text-xl w-8">{character.level}</span>
        </div>
      </div>
      <div className="mb-4">
        <label className="text-amber-400/80 text-sm mb-2 block">Alignment</label>
        <div className="flex flex-wrap gap-2">
          {ALIGNMENTS.map(a => (
            <button key={a} onClick={() => set('alignment', a)}
              className={`px-3 py-1 rounded-lg text-xs border transition-all ${character.alignment === a ? 'border-purple-500 bg-purple-900/30 text-purple-200' : 'border-slate-700/50 text-slate-400 hover:border-slate-600'}`}>
              {a}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
        {Object.entries(CLASSES).map(([cls, data]) => (
          <button key={cls} onClick={() => set('class', cls)}
            className={`p-4 rounded-xl border text-left transition-all ${
              character.class === cls
                ? 'border-purple-500 bg-purple-900/20'
                : 'border-slate-700/50 bg-slate-800/30 hover:border-purple-700/50'
            }`}>
            <div className="font-bold text-purple-200 mb-1">{cls}</div>
            <div className="text-purple-400/60 text-xs mb-2">{data.description}</div>
            <div className="text-slate-400 text-xs">HD: d{data.hit_die} · Saves: {data.saves.map(s => STAT_LABELS[s]).join(', ')}</div>
          </button>
        ))}
      </div>
      {selectedClass && (
        <div className="mt-6">
          <label className="text-amber-400/80 text-sm mb-2 block">Subclass (optional)</label>
          <div className="flex flex-wrap gap-2">
            {selectedClass.subclasses.map(sub => (
              <button key={sub} onClick={() => set('subclass', sub)}
                className={`px-3 py-2 rounded-lg text-sm border transition-all ${character.subclass === sub ? 'border-amber-500 bg-amber-900/30 text-amber-200' : 'border-slate-700/50 text-slate-400 hover:border-amber-700/50'}`}>
                {sub}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StepStats({ character, set, rollAll, pointBuy }) {
  const [method, setMethod] = useState('roll');
  return (
    <div>
      <h2 className="text-2xl font-bold text-amber-300 mb-2">Ability Scores</h2>
      <div className="flex gap-3 mb-6">
        {['roll', 'pointbuy', 'manual'].map(m => (
          <button key={m} onClick={() => { setMethod(m); if (m === 'roll') rollAll(); if (m === 'pointbuy') pointBuy(); }}
            className={`px-4 py-2 rounded-lg text-sm border transition-all capitalize ${method === m ? 'border-amber-500 bg-amber-900/30 text-amber-200' : 'border-slate-700/50 text-slate-400'}`}>
            {m === 'roll' ? '🎲 Roll 4d6' : m === 'pointbuy' ? '📊 Point Buy' : '✏️ Manual'}
          </button>
        ))}
      </div>
      {method === 'roll' && (
        <Button onClick={rollAll} className="mb-6 bg-amber-800/60 hover:bg-amber-700 border border-amber-600/50">
          <Dice6 className="w-4 h-4 mr-2" /> Reroll All Stats
        </Button>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {STATS.map(stat => {
          const val = character[stat] || 10;
          const mod = calcStatMod(val);
          return (
            <div key={stat} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
              <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">{STAT_LABELS[stat]}</div>
              <div className="text-3xl font-bold text-amber-300 mb-1">{val}</div>
              <div className={`text-sm font-medium mb-2 ${mod >= 0 ? 'text-green-400' : 'text-red-400'}`}>{calcModDisplay(mod)}</div>
              {method !== 'roll' && (
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => set(stat, Math.max(3, val - 1))} className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-amber-300">-</button>
                  <button onClick={() => set(stat, Math.min(20, val + 1))} className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-amber-300">+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepSkills({ character, set }) {
  const classData = CLASSES[character.class];
  const availableSkills = classData?.skills || Object.keys(SKILL_STAT_MAP);
  const maxSkills = classData?.skill_count || 2;
  const chosen = Object.keys(character.skills || {});

  const toggleSkill = (skill) => {
    const current = { ...character.skills };
    if (current[skill]) {
      delete current[skill];
    } else if (chosen.length < maxSkills) {
      current[skill] = 'proficient';
    }
    set('skills', current);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-amber-300 mb-2">Choose Skills</h2>
      <p className="text-amber-400/60 text-sm mb-6">Select {maxSkills} skills to be proficient in. ({chosen.length}/{maxSkills} chosen)</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {availableSkills.map(skill => {
          const proficient = !!character.skills?.[skill];
          const stat = SKILL_STAT_MAP[skill];
          const mod = calcStatMod(character[stat] || 10);
          const profBonus = PROFICIENCY_BY_LEVEL[(character.level || 1) - 1] || 2;
          const total = mod + (proficient ? profBonus : 0);
          return (
            <button key={skill} onClick={() => toggleSkill(skill)}
              disabled={!proficient && chosen.length >= maxSkills}
              className={`p-3 rounded-xl border text-left transition-all ${
                proficient ? 'border-green-500 bg-green-900/20' :
                chosen.length >= maxSkills ? 'border-slate-700/30 bg-slate-800/20 opacity-40 cursor-not-allowed' :
                'border-slate-700/50 bg-slate-800/30 hover:border-green-700/50'
              }`}>
              <div className="text-sm font-medium text-amber-200">{skill}</div>
              <div className="text-xs text-slate-400">{STAT_LABELS[stat]} · {total >= 0 ? '+' : ''}{total}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepBackground({ character, set }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-amber-300 mb-6">Background</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {BACKGROUNDS.map(bg => (
          <button key={bg.name} onClick={() => set('background', bg.name)}
            className={`p-4 rounded-xl border text-left transition-all ${
              character.background === bg.name
                ? 'border-blue-500 bg-blue-900/20'
                : 'border-slate-700/50 bg-slate-800/30 hover:border-blue-700/50'
            }`}>
            <div className="font-bold text-blue-200 mb-1">{bg.name}</div>
            <div className="text-blue-400/60 text-xs mb-2">Feature: {bg.feature}</div>
            <div className="text-slate-400 text-xs">Skills: {bg.skills.join(', ')}</div>
            <div className="text-slate-500 text-xs mt-1">Gear: {bg.equipment.join(', ')}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepBackstory({ character, set, backstoryPrompt, setBackstoryPrompt, onGenerate, generating }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-amber-300 mb-6">Backstory</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="text-amber-400/80 text-sm mb-2 block flex items-center gap-2">
            <Wand2 className="w-4 h-4" /> AI-Generated Backstory
          </label>
          <Textarea value={backstoryPrompt} onChange={e => setBackstoryPrompt(e.target.value)}
            placeholder="Give the AI a prompt... e.g. 'A disgraced knight seeking redemption, haunted by a battle they fled from'"
            className="bg-slate-800/60 border-slate-600 text-amber-100 placeholder-slate-500 mb-3 h-24" />
          <Button onClick={onGenerate} disabled={generating}
            className="w-full bg-purple-800/60 hover:bg-purple-700 border border-purple-600/50">
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
            {generating ? 'Weaving your tale...' : 'Generate Backstory'}
          </Button>
        </div>
        <div>
          <label className="text-amber-400/80 text-sm mb-2 block">Your Backstory</label>
          <Textarea value={character.backstory} onChange={e => set('backstory', e.target.value)}
            placeholder="Write or edit your character's backstory here..."
            className="bg-slate-800/60 border-slate-600 text-amber-100 placeholder-slate-500 h-48" />
        </div>
      </div>
    </div>
  );
}

function StepReview({ character }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-amber-300 mb-6">Review Your Hero</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-3xl font-bold text-amber-200 mb-1">{character.name || 'Unnamed Hero'}</div>
          <div className="text-amber-400/70 mb-4">Level {character.level} {character.race} {character.class}{character.subclass ? ` (${character.subclass})` : ''}</div>
          <div className="text-purple-400/70 text-sm mb-4">{character.alignment} · {character.background}</div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {['hp_max', 'armor_class', 'speed'].map(attr => (
              <div key={attr} className="bg-slate-800/60 rounded-lg p-3 text-center">
                <div className="text-amber-300 font-bold text-lg">{character[attr]}</div>
                <div className="text-slate-400 text-xs">{attr.replace('_', ' ').toUpperCase()}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['strength','dexterity','constitution','intelligence','wisdom','charisma'].map(stat => (
              <div key={stat} className="bg-slate-800/60 rounded-lg p-2 text-center">
                <div className="text-amber-300 font-bold">{character[stat]}</div>
                <div className="text-slate-400 text-xs">{STAT_LABELS[stat]}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-amber-400/80 text-sm mb-2">Backstory Preview</div>
          <div className="bg-slate-800/40 rounded-xl p-4 text-amber-100/70 text-sm leading-relaxed max-h-48 overflow-y-auto">
            {character.backstory || 'No backstory written.'}
          </div>
          {Object.keys(character.skills || {}).length > 0 && (
            <div className="mt-4">
              <div className="text-amber-400/80 text-sm mb-2">Proficient Skills</div>
              <div className="flex flex-wrap gap-1">
                {Object.keys(character.skills).map(s => (
                  <span key={s} className="bg-green-900/30 text-green-300 text-xs px-2 py-1 rounded-full border border-green-700/50">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}