import { canonicalAmmoName } from '../ammunition.ts';
import { RECOVERABLE_LEDGER_KEY } from './recoveryTransaction.ts';

export const SPENT_ITEM_LEDGER_KEY = '__spent_item_ledger';
const normalize = (value) => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const identity = (item) => String(item?.equipment_id || item?.item_id || '').trim() || null;
const props = (item) => (item?.properties || []).map(normalize);
const thrown = (item) => props(item).some((value) => value === 'thrown' || value.startsWith('thrown range '));

export function parseExplicitThrownWeapon(actionText) {
  const match = String(actionText || '').match(/\b(?:throw|throws|threw|hurl|hurls|hurled|toss|tosses|tossed)\s+(?:my|the|a|an)?\s*([a-z][a-z -]{1,40}?)(?:\s+(?:at|toward|towards|into)\b|$)/i);
  return match ? { explicit: true, item_name: match[1].trim() } : null;
}

export function resolveExplicitThrownWeapon({ actionText, inventory, selectedWeapon }) {
  const intent = parseExplicitThrownWeapon(actionText);
  if (!intent) return { handled: false };
  const named = (inventory || []).map((item, index) => ({ item, index })).filter(({ item }) => normalize(item?.name) === normalize(intent.item_name) && thrown(item));
  const selectedId = normalize(selectedWeapon?.name) === normalize(intent.item_name) ? identity(selectedWeapon) : null;
  const candidates = selectedId ? named.filter(({ item }) => identity(item) === selectedId) : named;
  if (candidates.length !== 1) return { handled: true, ok: false, status: 409, error: candidates.length ? 'Thrown weapon identity is ambiguous.' : 'The selected thrown weapon identity was not found uniquely.' };
  const selected = candidates[0];
  const canonicalId = identity(selected.item) || `canonical:${normalize(selected.item.name).replace(/ /g, '_')}`;
  const quantity = Number(selected.item.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) return { handled: true, ok: false, status: 409, error: 'The selected thrown weapon has no available quantity.' };
  const nextInventory = (inventory || []).map((item, index) => index === selected.index ? { ...item, quantity: quantity - 1 } : item);
  const damageDice = selected.item.damage_dice || String(selected.item.damage || '').match(/\d+d\d+/i)?.[0] || (normalize(selected.item.name) === 'dagger' ? '1d4' : '1d6');
  return { handled: true, ok: true, item: selected.item, item_id: canonicalId, quantity_before: quantity, quantity_after: quantity - 1, inventory: nextInventory, weapon: { ...selected.item, damage_dice: damageDice, canonical_item_id: canonicalId, type: 'ranged', attack_mode: 'thrown', recoverable: true } };
}

export function requestedProjectileNames(text) {
  if (!/\b(search|retrieve|recover|collect|find|get|pick up)\b/i.test(String(text || ''))) return [];
  const names = [];
  if (/\b(?:arrow|arrows|ammunition)\b/i.test(text)) names.push('Arrows');
  if (/\b(?:dagger|daggers)\b/i.test(text)) names.push('Dagger');
  return names;
}

export async function readLatestCompletedCombat(base44, sessionId) {
  const rows = await base44.asServiceRole.entities.CombatLog.filter({ session_id: sessionId }, '-created_date', 20);
  return (rows || []).find((combat) => !combat?.is_active && ['victory', 'defeat', 'fled', 'resolved'].includes(combat?.result)) || null;
}

export async function prepareProjectileRecoveryProposal({ base44, session, character, actionText }) {
  const names = requestedProjectileNames(actionText);
  if (!names.length) return { handled: false };
  const combat = await readLatestCompletedCombat(base44, session.id);
  if (!combat) return { handled: true, status: 409, error: 'No authoritative completed combat is available for recovery.', writes: 0 };
  const ledger = character.long_rest_abilities?.[RECOVERABLE_LEDGER_KEY] || [];
  const selected = ledger.filter((entry) => entry?.combat_id === combat.id && entry?.recovery_status === 'recoverable' && Number(entry?.quantity_remaining || 0) > 0 && names.some((name) => normalize(entry.canonical_item) === normalize(name)));
  const missing = names.filter((name) => !selected.some((entry) => normalize(entry.canonical_item) === normalize(name)));
  if (missing.length) return { handled: true, status: 409, error: `No combat-scoped spent-item receipt proves recoverable ${missing.join(' and ')}.`, writes: 0, combat_id: combat.id };
  const accessible = combat.result === 'victory' && selected.every((entry) => normalize(entry.location) === normalize(session.current_location));
  const recovery = { type: 'recover_owned_items', combat_id: combat.id, rule: accessible ? { type: 'automatic_recovery', reason: 'The victorious battlefield is accessible at the current location.' } : { type: 'uncertain_recovery', skill: 'Investigation', dc: 12, reason: 'The spent projectiles are not certainly accessible and require a search.' }, items: selected.map((entry) => ({ canonical_item: entry.canonical_item, quantity: Number(entry.quantity_remaining), origin_request_id: entry.origin_request_id })) };
  return { handled: true, status: 200, combat_id: combat.id, requires_check: !accessible, skill: accessible ? null : 'Investigation', dc: accessible ? null : 12, risk_level: accessible ? 'low' : 'medium', reasoning: recovery.rule.reason, recovery };
}

export function recoveryAnnotation({ recovery, resolution, applied, recoveredItems = [] }) {
  const items = recoveredItems.map((item) => `${item.quantity} ${item.canonical_item}`).join(' and ') || 'no items';
  if (recovery?.rule?.type === 'automatic_recovery') return applied ? `Automatic recovery: ${items} committed to inventory.` : 'Automatic recovery failed before inventory commit; no recovery occurred.';
  const check = resolution || {};
  return `Recovery check: ${recovery?.rule?.skill || check.skill || 'Investigation'} DC${recovery?.rule?.dc || check.dc}; ${check.success ? 'SUCCESS' : 'FAILURE'}${check.final_total != null ? ` (${check.final_total})` : ''}. ${applied ? `${items} committed to inventory.` : 'No items recovered.'}`;
}

export const projectileIdentity = identity;
export const canonicalProjectileName = (value) => canonicalAmmoName(value) || String(value || '').trim();