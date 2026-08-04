import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { requireUser, characterBelongsToUser, storeReceipt } from '../../shared/combat/authGuard.ts';
import { parseDamageDice, rollDamageFromDice } from '../../shared/combat/helpers.ts';

const normalize = (value) => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

// Resolve the requested quantity from (in priority order) an explicit numeric
// param, a written-out word ("two"), or a bare digit in the action text.
function parseQuantity(actionText, explicitQty) {
  const n = Number(explicitQty);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  const normalized = normalize(actionText);
  const word = Object.keys(WORD_NUMBERS).find((w) => new RegExp(`\\b${w}\\b`).test(normalized));
  if (word) return WORD_NUMBERS[word];
  const numeric = normalized.match(/\b(\d+)\b/);
  if (numeric) return parseInt(numeric[1], 10);
  return 1;
}

// ─── Canonical healing potion aliases (PHB p.151) ──────────────────────────
// Exact normalized-name table, then keyword fallback (supreme before superior
// before greater before base — substring order matters).
const HEALING_POTIONS = {
  'potion of healing': '2d4+2',
  'healing potion': '2d4+2',
  'greater potion of healing': '4d4+4',
  'greater healing potion': '4d4+4',
  'superior potion of healing': '8d4+8',
  'superior healing potion': '8d4+8',
  'supreme potion of healing': '10d4+20',
  'supreme healing potion': '10d4+20',
};

function resolveHealingPotion(normalizedName) {
  if (HEALING_POTIONS[normalizedName]) return HEALING_POTIONS[normalizedName];
  if (normalizedName.includes('supreme')) return '10d4+20';
  if (normalizedName.includes('superior')) return '8d4+8';
  if (normalizedName.includes('greater')) return '4d4+4';
  if (normalizedName.includes('healing')) return '2d4+2';
  return null;
}

// Resolve a consumable into { kind, dice } — kind is 'goodberry' | 'potion' | null.
function resolveConsumable(itemName) {
  const target = normalize(itemName);
  if (target === 'goodberry' || target === 'goodberries') return { kind: 'goodberry', dice: null };
  const potionDice = resolveHealingPotion(target);
  if (potionDice) return { kind: 'potion', dice: potionDice };
  return { kind: null, dice: null };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const { session_id, character_id, item_name, action_text, quantity, use_token, request_id } = await req.json();
    if (!session_id || !character_id || !item_name)
      return Response.json({ error: 'session_id, character_id, and item_name are required' }, { status: 400 });

    // ── Auth (defect #4): all consumable use requires a logged-in user ──
    const { user, error: authError } = await requireUser(base44);
    if (authError) return authError;

    // ── Idempotency token: accept request_id (preferred) or legacy use_token ──
    const token = String(request_id || use_token || '').slice(0, 120);
    if (!token)
      return Response.json({ error: 'request_id or use_token is required for idempotent consumable use' }, { status: 400 });

    // ── Ownership chain: Character → caller, Session.character_id === Character.id ──
    const character = await base44.asServiceRole.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });
    if (!characterBelongsToUser(character, user))
      return Response.json({ error: 'Character does not belong to the authenticated user' }, { status: 403 });

    const session = await base44.asServiceRole.entities.GameSession.get(session_id);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    if (session.character_id !== character_id)
      return Response.json({ error: 'Session does not belong to this character' }, { status: 403 });

    // ── Idempotency receipt check (before any writes) ──
    const abilities = { ...(character.long_rest_abilities || {}) };
    const receipts = Array.isArray(abilities.__consumable_uses) ? abilities.__consumable_uses : [];
    const prior = receipts.find((r) => r?.token === token);
    if (prior) {
      return Response.json({
        success: true,
        already_processed: true,
        item_name: prior.item_name,
        quantity: prior.quantity,
        heal_amount: prior.heal_amount,
        hp_current: character.hp_current,
        inventory: character.inventory || [],
      });
    }

    // ── Resolve the consumable type ──
    const { kind, dice } = resolveConsumable(item_name);
    if (!kind)
      return Response.json({ error: `Unsupported consumable: ${item_name}`, invalid: true }, { status: 400 });

    // ── Locate the item in inventory (by normalized name match) ──
    const oldInventory = Array.isArray(character.inventory) ? [...character.inventory] : [];
    const targetName = normalize(item_name);
    const idx = oldInventory.findIndex((it) => {
      const n = normalize(it?.name);
      if (kind === 'goodberry') return n === 'goodberry' || n === 'goodberries';
      return n === targetName || resolveHealingPotion(n) === dice;
    });
    if (idx < 0)
      return Response.json({ error: `No ${item_name} found in inventory.`, invalid: true }, { status: 400 });

    const item = oldInventory[idx];
    const available = Number(item.quantity) || 1;
    if (available <= 0)
      return Response.json({ error: `No ${item_name} remaining.`, invalid: true }, { status: 400 });

    // ── Compute the heal amount server-side (never trust client totals) ──
    const hpMax = Number(character.hp_max) || 0;
    const hpBefore = Number(character.hp_current) || 0;

    let healRaw = 0;
    let qty = 1;
    let displayName = item.name || item_name;

    if (kind === 'goodberry') {
      // Goodberry (PHB p.236): each berry restores exactly 1 HP.
      qty = Math.max(1, Math.min(parseQuantity(action_text, quantity), available));
      healRaw = qty; // 1 HP per berry
      displayName = 'Goodberry';
    } else {
      // Healing potion: 1 dose, roll the canonical dice string server-side.
      qty = 1;
      const parsed = parseDamageDice(dice);
      if (!parsed)
        return Response.json({ error: `Unparseable heal dice: ${dice}`, invalid: true }, { status: 500 });
      const rolled = rollDamageFromDice(dice, { isCrit: false });
      if (!rolled.parsed)
        return Response.json({ error: `Unparseable heal dice: ${dice}`, invalid: true }, { status: 500 });
      healRaw = rolled.damage;
    }

    // Full-HP cap: no overheal
    const healAmount = Math.max(0, Math.min(healRaw, hpMax - hpBefore));
    const hpAfter = Math.min(hpMax, hpBefore + healAmount);

    if (hpMax > 0 && hpBefore >= hpMax && kind === 'potion')
      return Response.json({ error: 'Already at full HP.', invalid: true }, { status: 400 });

    // ── Decrement or remove the inventory stack ──
    const newInventory = [...oldInventory];
    const remaining = available - qty;
    if (remaining <= 0) {
      newInventory.splice(idx, 1);
    } else {
      newInventory[idx] = { ...item, quantity: remaining };
    }

    // ── Store the idempotency receipt in Character state ──
    const now = new Date().toISOString();
    const oldAbilities = { ...(character.long_rest_abilities || {}) };
    abilities.__consumable_uses = [
      ...receipts.filter((r) => r?.token !== token).slice(-24),
      { token, item_name: displayName, quantity: qty, heal_amount: healAmount, at: now },
    ];

    const characterUpdates = { inventory: newInventory, long_rest_abilities: abilities };
    if (healAmount > 0) characterUpdates.hp_current = hpAfter;

    // ── Determine if we are in combat and resolve the exact CombatLog ──
    const combatId = session.combat_state?.combat_id || null;
    let combat = null;
    if (combatId) {
      combat = await base44.asServiceRole.entities.CombatLog.get(combatId);
      if (!combat)
        return Response.json({ error: 'Referenced combat log not found', invalid: true }, { status: 404 });
      if (combat.session_id !== session_id)
        return Response.json({ error: 'Combat does not belong to this session' }, { status: 403 });
    }

    // ── Atomic-ish write: Character first, then CombatLog sync ──
    await base44.asServiceRole.entities.Character.update(character_id, characterUpdates);

    if (combat) {
      try {
        const combatants = (combat.combatants || []).map((c) => {
          const isPlayer = c?.type === 'player' && (c?.id === character_id || c?.character_id === character_id);
          if (!isPlayer) return c;
          return { ...c, hp_current: hpAfter };
        });
        const logEntry = {
          type: 'consumable',
          text: `Used ${displayName}: healed ${healAmount} HP (${hpBefore} → ${hpAfter}).`,
          round: combat.round || 0,
          timestamp: now,
          item: displayName,
          heal_amount: healAmount,
          hp_before: hpBefore,
          hp_after: hpAfter,
        };
        const updatedWorldState = storeReceipt(combat.world_state, token, 'use_consumable', {
          item_name: displayName, quantity: qty, heal_amount: healAmount, hp_before: hpBefore, hp_after: hpAfter,
        });
        await base44.asServiceRole.entities.CombatLog.update(combatId, {
          combatants,
          log_entries: [...(combat.log_entries || []), logEntry],
          world_state: updatedWorldState,
        });
      } catch (combatErr) {
        // ── Compensation: revert Character to pre-use state, remove receipt ──
        await base44.asServiceRole.entities.Character.update(character_id, {
          hp_current: hpBefore,
          inventory: oldInventory,
          long_rest_abilities: oldAbilities,
        });
        return Response.json({ error: `Combat sync failed and was rolled back: ${combatErr.message || combatErr}`, invalid: true }, { status: 500 });
      }
    }

    return Response.json({
      success: true,
      already_processed: false,
      item_name: displayName,
      quantity: qty,
      heal_amount: healAmount,
      hp_current: hpAfter,
      inventory: newInventory,
      combat_synced: !!combat,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Consumable use failed' }, { status: 500 });
  }
}