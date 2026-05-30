/**
 * Combat action economy helpers (client-side display).
 *
 * Mirrors the server-side `getActionsPerTurn` in functions/combatEngine.
 * Used by the combat UI to show how many attacks/actions a character has
 * this turn. The backend remains authoritative — this is for display only.
 *
 * D&D 5e Extra Attack rules. Note: Monk Flurry of Blows is a BONUS ACTION,
 * not an extra Attack action, so it is intentionally NOT counted here.
 */
export function getActionsPerTurn(character) {
  if (!character) return 1;
  const features  = (character.features || []).map(f => (typeof f === 'string' ? f : f.name || '').toLowerCase());
  const charClass = (character.class || '').toLowerCase();
  const subclass  = (character.subclass || '').toLowerCase();
  const level     = character.level || 1;
  let attacks = 1;

  if (['fighter','ranger','paladin','barbarian','monk'].includes(charClass) && level >= 5) attacks = 2;
  if (charClass === 'fighter' && level >= 11) attacks = 3;
  if (charClass === 'fighter' && level >= 20) attacks = 4;
  if (charClass === 'artificer' && level >= 5 && (subclass.includes('battle smith') || subclass.includes('armorer'))) attacks = Math.max(attacks, 2);
  // Bard College of Valor: Extra Attack at level 6 (PHB p.55)
  if (charClass === 'bard' && level >= 6 && subclass.includes('valor')) attacks = Math.max(attacks, 2);
  // Warlock Thirsting Blade invocation: Extra Attack at level 5
  if (charClass === 'warlock' && level >= 5 && features.some(f => f.includes('thirsting blade'))) attacks = Math.max(attacks, 2);
  if (features.some(f => f.includes('extra attack'))) attacks = Math.max(attacks, 2);

  return attacks;
}