// Shared helpers for class ability builders.

export function getFightingStyleDesc(style) {
  const styles = {
    'Archery': '+2 bonus to ranged attack rolls.',
    'Defense': '+1 AC while wearing armor.',
    'Dueling': '+2 damage when wielding a single one-handed weapon and no other weapon.',
    'Great Weapon Fighting': 'Reroll 1s and 2s on damage dice for two-handed weapons.',
    'Protection': 'Use reaction to impose disadvantage on an attack against an adjacent ally.',
    'Two-Weapon Fighting': 'Add ability modifier to the off-hand weapon attack damage.',
  };
  return styles[style] || `${style} fighting style active.`;
}