import React from 'react';
import { Zap, Sparkles, Waves, Dices } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Build Sorcerer abilities: Sorcery Points, Font of Magic (SP↔slot), Wild Magic.
export function buildSorcererAbilities(ctx) {
  const { character, level, onMessage, onCharacterUpdate } = ctx;
  const abilities = [];

  const spCurrent = character?.sorcery_points_current ?? level;
  const spMax = character?.sorcery_points_max ?? level;
  const isWildMagic = (character?.subclass || '').toLowerCase().includes('wild magic');
  const lra = character?.long_rest_abilities || {};
  const tidesUsed = !!lra.tides_of_chaos_used;

  // Helper: call the sorcererMagic backend function
  const invokeSorcererMagic = async (action, payload = {}) => {
    try {
      const res = await base44.functions.invoke('sorcererMagic', {
        action, character_id: character?.id, ...payload,
      });
      const data = res.data;
      if (data?.invalid) { onMessage?.(data.error || 'Action not available.'); return; }
      if (data?.message) onMessage?.(data.message);
      // Sync character from DB
      if (data?.sorcery_points_remaining !== undefined || data?.surge) {
        const updated = await base44.entities.Character.get(character?.id);
        onCharacterUpdate?.(() => updated);
      }
    } catch (err) { console.error('sorcererMagic failed:', err); }
  };

  // Sorcery Points (passive display)
  abilities.push({
    id: 'sorcery_points',
    name: 'Sorcery Points',
    icon: <Sparkles className="w-4 h-4" />,
    color: '#f0abfc', borderColor: 'rgba(230,100,255,0.4)', bgColor: 'rgba(40,5,50,0.7)',
    type: 'passive',
    description: `${spCurrent}/${spMax} SP. Power Metamagic and Font of Magic conversions. Recharge on long rest.`,
    shortDesc: `${spCurrent}/${spMax} SP`,
    used: false, available: true,
  });

  // Font of Magic: SP → Spell Slot (PHB p.101)
  if (level >= 2) {
    const SP_COSTS = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 };
    for (const slotLvl of [1, 2, 3]) {
      const cost = SP_COSTS[slotLvl];
      abilities.push({
        id: `create_slot_${slotLvl}`,
        name: `Create ${slotLvl}${slotLvl === 1 ? 'st' : slotLvl === 2 ? 'nd' : 'rd'}-Level Slot`,
        icon: <Zap className="w-4 h-4" />,
        color: '#c4b5fd', borderColor: 'rgba(160,120,255,0.35)', bgColor: 'rgba(28,10,55,0.65)',
        type: 'bonus_action',
        description: `Font of Magic: spend ${cost} SP to create a ${slotLvl}th-level spell slot (bonus action).`,
        shortDesc: `${cost} SP → ${slotLvl}th-level slot`,
        used: spCurrent < cost,
        usedLabel: 'Not enough SP',
        available: spCurrent >= cost,
        onUse: async () => { await invokeSorcererMagic('convert_sp_to_slot', { slot_level: slotLvl }); },
      });
    }
    // Slot → SP (reverse conversion)
    for (const slotLvl of [1, 2]) {
      abilities.push({
        id: `convert_slot_${slotLvl}`,
        name: `Convert ${slotLvl}${slotLvl === 1 ? 'st' : 'nd'}-Level Slot → SP`,
        icon: <Sparkles className="w-4 h-4" />,
        color: '#a78bfa', borderColor: 'rgba(160,120,255,0.3)', bgColor: 'rgba(20,8,45,0.6)',
        type: 'bonus_action',
        description: `Font of Magic: expend a ${slotLvl}th-level slot to gain ${slotLvl} sorcery point(s).`,
        shortDesc: `${slotLvl}th slot → ${slotLvl} SP`,
        used: false,
        available: true,
        onUse: async () => { await invokeSorcererMagic('convert_slot_to_sp', { slot_level: slotLvl }); },
      });
    }
  }

  // Tides of Chaos (Wild Magic, PHB p.103)
  if (isWildMagic) {
    abilities.push({
      id: 'tides_of_chaos',
      name: 'Tides of Chaos',
      icon: <Waves className="w-4 h-4" />,
      color: '#60a5fa', borderColor: 'rgba(96,165,250,0.4)', bgColor: 'rgba(8,20,50,0.7)',
      type: 'action',
      description: 'Gain advantage on one attack roll, ability check, or saving throw. After using, your next spell may trigger a Wild Magic Surge. Once per long rest.',
      shortDesc: 'Advantage on next roll (1/long rest)',
      used: tidesUsed,
      usedLabel: 'Used (long rest to regain)',
      available: !tidesUsed,
      onUse: async () => { await invokeSorcererMagic('tides_of_chaos'); },
    });
    // Wild Magic Surge check (call after casting a spell)
    abilities.push({
      id: 'wild_magic_surge',
      name: 'Wild Magic Surge',
      icon: <Dices className="w-4 h-4" />,
      color: '#fbbf24', borderColor: 'rgba(251,191,36,0.4)', bgColor: 'rgba(40,30,5,0.7)',
      type: 'action',
      description: 'After casting a sorcerer spell, roll a d20. On a 1 (or automatically if Tides of Chaos is active), roll on the Wild Magic Surge table for a random magical effect.',
      shortDesc: 'Auto-check after each spell',
      used: false, available: true,
      onUse: async () => { await invokeSorcererMagic('check_surge'); },
    });
  }

  // Metamagic (passive, L3+)
  if (level >= 3) {
    abilities.push({
      id: 'metamagic',
      name: 'Metamagic',
      icon: <Zap className="w-4 h-4" />,
      color: '#e879f9', borderColor: 'rgba(200,80,240,0.35)', bgColor: 'rgba(35,5,45,0.6)',
      type: 'passive',
      description: 'Apply Metamagic to spells by spending SP. Use the Metamagic panel in combat to toggle Quickened, Twinned, Heightened, etc.',
      shortDesc: 'Modify spells with SP',
      used: false, available: true,
    });
  }

  return abilities;
}