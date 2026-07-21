import React from 'react';
import { Sparkles, Shield, MessageCircleX, Music } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { calcStatMod } from '../gameData';
import { getFightingStyleDesc } from './abilityHelpers';
import { buildBardSubclassAbilities } from './bardSubclasses';

// Build Bard abilities: Bardic Inspiration + College subclass features.
// (Inspiration spending handled via spendBardic.)
export function buildBardAbilities(ctx) {
  const { character, level, combat, worldState = {}, bonusActionUsed, spendBardic, onMessage } = ctx;
  const abilities = [];

  const invokeSubclassAction = async (action, payload = {}) => {
    try {
      const res = await base44.functions.invoke('subclassActions', {
        action, combat_id: combat?.id, session_id: combat?.session_id,
        character_id: character?.id, payload,
      });
      if (res.data?.invalid) { onMessage?.(res.data.error); return; }
      if (res.data?.log_entry) onMessage?.(res.data.log_entry.text);
      window.dispatchEvent(new CustomEvent('reload-combat'));
    } catch (err) { console.error(`${action} failed:`, err); }
  };

  const dieMod = level < 5 ? 'd6' : level < 10 ? 'd8' : level < 15 ? 'd10' : 'd12';
  const chaBonus = calcStatMod(character.charisma || 10);
  const maxInspire = character.bardic_inspiration_max ?? (chaBonus > 0 ? chaBonus : 1);
  const inspireLeft = character.bardic_inspiration_remaining ?? maxInspire;
  abilities.push({
    id: 'bardic_inspiration',
    name: 'Bardic Inspiration',
    icon: <Sparkles className="w-4 h-4" />,
    color: '#fb923c',
    borderColor: 'rgba(250,140,50,0.4)',
    bgColor: 'rgba(40,20,5,0.65)',
    type: 'bonus_action',
    description: `Bonus Action: Grant an ally a ${dieMod} to add to one ability check, attack, or save. ${inspireLeft}/${maxInspire} remaining.`,
    shortDesc: `Grant ally ${dieMod} die (${inspireLeft} left)`,
    restType: level >= 5 ? 'short' : 'long',
    used: inspireLeft <= 0,
    usedLabel: `All uses spent (refills on ${level >= 5 ? 'short' : 'long'} rest)`,
    available: inspireLeft > 0,
    onUse: () => spendBardic(),
  });

  const subLower = (character.subclass || '').toLowerCase();
  const inCombat = !!combat?.id;

  // ── Cutting Words (College of Lore 3+, PHB p.54) — armed reaction (M-S fix) ──
  if (subLower.includes('lore') && level >= 3) {
    const armed = !!worldState.cutting_words_armed;
    abilities.push({
      id: 'cutting_words',
      name: 'Cutting Words',
      icon: <MessageCircleX className="w-4 h-4" />,
      color: '#f0abfc', borderColor: 'rgba(230,120,250,0.4)', bgColor: 'rgba(38,8,45,0.65)',
      activeBg: 'rgba(60,15,70,0.85)',
      type: 'passive_toggle',
      description: `Arm your reaction: when an enemy attack would hit you, automatically spend a Bardic Inspiration (${dieMod}) to subtract it from their roll — possibly turning the hit into a miss.`,
      shortDesc: armed ? `ARMED — will mock the next hit (-${dieMod})` : `Arm reaction (-${dieMod} to enemy attack)`,
      used: inspireLeft <= 0 && !armed,
      usedLabel: 'No inspiration left',
      available: inCombat && (armed || inspireLeft > 0),
      active: armed,
      onUse: async () => { await invokeSubclassAction('cutting_words_arm'); },
    });
  }

  // ── Combat Inspiration (College of Valor 3+, PHB p.55) — inspire companion (M-S fix) ──
  if (subLower.includes('valor') && level >= 3) {
    abilities.push({
      id: 'combat_inspiration',
      name: 'Combat Inspiration',
      icon: <Music className="w-4 h-4" />,
      color: '#fdba74', borderColor: 'rgba(250,160,80,0.4)', bgColor: 'rgba(42,22,5,0.65)',
      type: 'bonus_action',
      description: `Bonus Action: spend a Bardic Inspiration to grant your companion a ${dieMod} added to its next attack's damage.`,
      shortDesc: `Companion +${dieMod} damage (${inspireLeft} left)`,
      used: inspireLeft <= 0 || bonusActionUsed,
      usedLabel: inspireLeft <= 0 ? 'No inspiration left' : 'Bonus action used',
      available: inCombat && inspireLeft > 0 && !bonusActionUsed,
      onUse: async () => { await invokeSubclassAction('combat_inspiration'); },
    });
  }

  // College subclass features (Valor, Swords, Whispers, Glamour, Eloquence, Spirits, …)
  abilities.push(...buildBardSubclassAbilities(ctx));

  // Fighting Style reminder for College of Swords (passive info pill)
  if (character.fighting_style) {
    abilities.push({
      id: 'fighting_style',
      name: 'Fighting Style',
      icon: <Shield className="w-4 h-4" />,
      color: '#93c5fd',
      borderColor: 'rgba(100,160,255,0.3)',
      bgColor: 'rgba(8,20,50,0.5)',
      type: 'passive',
      shortDesc: character.fighting_style,
      description: getFightingStyleDesc(character.fighting_style),
      used: false,
      available: true,
    });
  }

  return abilities;
}