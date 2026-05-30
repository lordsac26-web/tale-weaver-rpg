import React from 'react';
import { Shield, Swords } from 'lucide-react';

// Build Monk abilities: Flurry of Blows, Patient Defense. (Ki spending handled via spendKi.)
export function buildMonkAbilities(ctx) {
  const { character, level, bonusActionUsed, spendKi } = ctx;
  const abilities = [];

  const kiLeft = character.ki_points_remaining ?? level;
  if (level >= 2) {
    abilities.push({
      id: 'flurry_of_blows',
      name: 'Flurry of Blows',
      icon: <Swords className="w-4 h-4" />,
      color: '#818cf8',
      borderColor: 'rgba(130,110,255,0.4)',
      bgColor: 'rgba(15,12,45,0.7)',
      type: 'bonus_action',
      description: `Bonus Action after Attack: 2 unarmed strikes. Costs 1 Ki. (${kiLeft} Ki remaining)`,
      shortDesc: `2 unarmed strikes (1 Ki — ${kiLeft} left)`,
      used: kiLeft <= 0 || bonusActionUsed,
      usedLabel: kiLeft <= 0 ? 'No Ki remaining' : 'Bonus action used',
      available: kiLeft > 0 && !bonusActionUsed,
      onUse: () => spendKi('Flurry of Blows'),
    });

    abilities.push({
      id: 'patient_defense',
      name: 'Patient Defense',
      icon: <Shield className="w-4 h-4" />,
      color: '#67e8f9',
      borderColor: 'rgba(100,230,250,0.35)',
      bgColor: 'rgba(5,25,35,0.65)',
      type: 'bonus_action',
      description: `Bonus Action: Take the Dodge action. Attacks against you have disadvantage. Costs 1 Ki. (${kiLeft} Ki remaining)`,
      shortDesc: `Dodge (1 Ki — ${kiLeft} left)`,
      used: kiLeft <= 0 || bonusActionUsed,
      usedLabel: kiLeft <= 0 ? 'No Ki' : 'Bonus action used',
      available: kiLeft > 0 && !bonusActionUsed,
      onUse: () => spendKi('Patient Defense'),
    });
  }

  return abilities;
}