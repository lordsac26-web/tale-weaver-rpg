import { resolveAttackRoll, rollDice, rollD20, applyDamageModifiers } from './helpers.ts';
import { rollWeaponBaseDamage } from './weaponDamage.ts';
import { rollHuntersMarkBonus } from './huntersMark.ts';
import { weaponAmmunitionRequirement } from '../ammunitionTransaction.ts';

export const MULTIPLYING_AMMO_VERSION = 'multiplying-ammunition-v1';
export const MAGIC_AMMO_RECEIPTS = '__magic_ammo_receipts';
const key = value => String(value || '').toLowerCase().trim();
// Trusted stored item data, never a client-supplied description or damage value.
export function multiplyingAmmoRule(item) {
  if (key(item?.name) === 'angry hornet') return { dice: '2d4', count: 2, sides: 4, retain_on_all_miss: true };
  const text = String(item?.description || '');
  const match = text.match(/(\d+)d(\d+) identical pieces of ammunition/i);
  if (!item?.is_magic || !match || !/Roll separate attack rolls/i.test(text) || !/all.*miss.*remains magical/is.test(text)) return null;
  const count = Number(match[1]), sides = Number(match[2]);
  return count >= 1 && count <= 4 && sides >= 2 && count * sides <= 20 ? { dice: `${count}d${sides}`, count, sides, retain_on_all_miss: true } : null;
}
export function selectMultiplyingAmmo({ inventory = [], weapon, actionText = '', selectedName = null }) {
  const explicit = key(selectedName), text = key(actionText);
  const entries = inventory.map((item, index) => ({ item, index, rule: multiplyingAmmoRule(item) }));
  const matches = entries.filter(x => x.rule && (explicit ? key(x.item.name) === explicit : text.includes(key(x.item.name))));
  const requested = explicit || /\bangry hornet\b/i.test(text);
  if (!matches.length) return requested ? { handled: true, ok: false, error: 'The selected magic ammunition is not available in your inventory.' } : { handled: false, ok: true };
  if (matches.length !== 1) return { handled: true, ok: false, error: 'Choose exactly one magic ammunition stack.' };
  const selected = matches[0], quantity = Number(selected.item.quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity <= 0) return { handled: true, ok: false, error: 'No units of that magic ammunition remain.' };
  if (!weaponAmmunitionRequirement(weapon).required) return { handled: true, ok: false, error: 'Magic ammunition must be fired from an equipped ammunition weapon.' };
  return { ...selected, handled: true, ok: true, quantity };
}
// Runs inside handlePlayerAttack, using its already-authoritative modifiers and
// the same d20, weapon damage, Hunter's Mark and mitigation implementations.
// Simultaneous projectiles inherit the shot's pre-release concealment; no extra
// actions, physical arrows, once-per-turn riders or consumable bonuses are spent.
export function rollAmmoDuplicates({ selection, target, attackMod, damageDice, damageBonus, advSources, disSources, advantageSources, disadvantageSources, modifierComponents, forceCrit = false, rerollOnes = false, critFloor = 20, huntersMark = null, rollD20Fn = rollD20, rollDie = rollDice }) {
  const countRolls = Array.from({ length: selection.rule.count }, () => rollDie(selection.rule.sides));
  const count = countRolls.reduce((a, b) => a + b, 0), shots = [];
  for (let i = 0; i < count; i++) {
    const roll = resolveAttackRoll({ advSources, disSources, forceCrit, rerollOnes, rollD20Fn });
    const critical = !roll.isMiss && (roll.isCritical || roll.roll >= critFloor);
    const hit = !roll.isMiss && (critical || roll.roll + attackMod >= target.ac);
    let damage = 0, damageRolls = [], mark = null, mitigation = null;
    if (hit) {
      const parsed = String(damageDice).match(/(\d+)d(\d+)/);
      const base = rollWeaponBaseDamage({ damageDice, damageBonus, diceCountOverride: critical ? Number(parsed?.[1] || 1) * 2 : null, rollDie });
      damageRolls = base.rolls; damage = Math.max(1, base.damage);
      if (huntersMark) { mark = rollHuntersMarkBonus(huntersMark, critical, rollDie); damage += mark.damage; }
      mitigation = applyDamageModifiers(damage, selection.damage_type || 'piercing', target);
      damage = mitigation.amount;
    }
    shots.push({ projectile_index: i + 1, duplicate: true, target_id: target.id, target: target.name, raw_d20: roll.roll, all_rolls: roll.rolls, attack_bonus: attackMod, attack_roll: roll.roll + attackMod, target_ac: target.ac, hit, critical, damage, damage_rolls: damageRolls, damage_dice: damageDice, damage_bonus: damageBonus, damage_modifier: mitigation?.applied || null, hunters_mark_bonus: mark?.damage || 0, advantage: roll.advantage, disadvantage: roll.disadvantage, advantage_sources: [...advantageSources], disadvantage_sources: [...disadvantageSources], roll_breakdown: { dice: { rolls: roll.rolls, selected: roll.roll, mode: roll.advantage ? 'advantage' : roll.disadvantage ? 'disadvantage' : 'normal', advantage_sources: advantageSources, disadvantage_sources: disadvantageSources }, modifiers: modifierComponents, modifier_total: attackMod, final_total: roll.roll + attackMod, target_ac: target.ac } });
  }
  return { version: MULTIPLYING_AMMO_VERSION, ammo_name: selection.item.name, duplicate_dice: selection.rule.dice, duplicate_count_rolls: countRolls, duplicate_count: count, shots, damage: shots.reduce((sum, shot) => sum + shot.damage, 0), any_hit: shots.some(shot => shot.hit) };
}
export async function commitMultiplyingAmmo({ base44, characterId, sessionId, combatId, requestId, selection, volley, original }) {
  const character = await base44.asServiceRole.entities.Character.get(characterId);
  const receipts = character.long_rest_abilities?.[MAGIC_AMMO_RECEIPTS] || [];
  const prior = receipts.find(x => x.request_id === requestId);
  if (prior) return { receipt: prior, already_processed: true, writes: 0 };
  const inventory = [...(character.inventory || [])];
  const current = inventory[selection.index];
  if (key(current?.name) !== key(selection.item.name) || Number(current?.quantity ?? 1) !== selection.quantity) throw new Error('Magic ammunition changed during resolution; refresh before retrying.');
  const anyHit = original.hit || volley.any_hit, consumed = anyHit ? 1 : 0;
  const receipt = { ...volley, request_id: requestId, character_id: characterId, session_id: sessionId, combat_id: combatId, original, shots: [original, ...volley.shots], consumed, destroyed: anyHit, retained: !anyHit, quantity_before: selection.quantity, quantity_after: selection.quantity - consumed, duplicates_persisted: false, at: new Date().toISOString() };
  inventory[selection.index] = { ...current, quantity: receipt.quantity_after };
  await base44.asServiceRole.entities.Character.update(characterId, { inventory, long_rest_abilities: { ...(character.long_rest_abilities || {}), [MAGIC_AMMO_RECEIPTS]: [...receipts.slice(-74), receipt] } });
  return { receipt, writes: 1, already_processed: false };
}