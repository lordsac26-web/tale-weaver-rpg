import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const { session_id, character_id, item_name, action_text, quantity, use_token } = await req.json();
    if (!session_id || !character_id)
      return Response.json({ error: 'session_id and character_id are required' }, { status: 400 });

    // ── Ownership validation: the session must belong to the supplied character ──
    const session = await base44.asServiceRole.entities.GameSession.get(session_id);
    if (!session || session.character_id !== character_id)
      return Response.json({ error: 'Session and character do not match' }, { status: 400 });
    const character = await base44.asServiceRole.entities.Character.get(character_id);
    if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });

    // ── Idempotency receipt: a replay with the same token returns the prior result ──
    const token = String(use_token || '').slice(0, 120);
    const abilities = { ...(character.long_rest_abilities || {}) };
    const receipts = Array.isArray(abilities.__consumable_uses) ? abilities.__consumable_uses : [];
    const prior = token && receipts.find((r) => r?.token === token);
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

    // ── Resolve the consumable (currently Goodberry-only) ──
    const targetName = normalize(item_name);
    if (targetName !== 'goodberry')
      return Response.json({ error: `Unsupported consumable: ${item_name}`, invalid: true }, { status: 400 });

    const inventory = Array.isArray(character.inventory) ? [...character.inventory] : [];
    const idx = inventory.findIndex((it) => normalize(it?.name) === 'goodberry');
    if (idx < 0)
      return Response.json({ error: `No ${item_name} found in inventory.`, invalid: true }, { status: 400 });

    const item = inventory[idx];
    const available = Number(item.quantity) || 1;
    const qty = Math.max(1, Math.min(parseQuantity(action_text, quantity), available));

    // Goodberry (PHB p.236): each berry restores 1 HP. Clamp to max HP.
    const hpMax = Number(character.hp_max) || 0;
    const hpBefore = Number(character.hp_current) || 0;
    const healRaw = qty; // 1 HP per berry
    const healAmount = Math.max(0, Math.min(healRaw, hpMax - hpBefore));
    const hpAfter = Math.min(hpMax, hpBefore + healAmount);

    // ── Decrement or remove the inventory stack ──
    const remaining = available - qty;
    if (remaining <= 0) {
      inventory.splice(idx, 1);
    } else {
      inventory[idx] = { ...item, quantity: remaining };
    }

    // ── Record the idempotency receipt ──
    const now = new Date().toISOString();
    if (token)
      abilities.__consumable_uses = [
        ...receipts.filter((r) => r?.token !== token).slice(-24),
        { token, item_name: 'Goodberry', quantity: qty, heal_amount: healAmount, at: now },
      ];

    const characterUpdates = { inventory, long_rest_abilities: abilities };
    if (healAmount > 0) characterUpdates.hp_current = hpAfter;
    await base44.asServiceRole.entities.Character.update(character_id, characterUpdates);

    return Response.json({
      success: true,
      already_processed: false,
      item_name: 'Goodberry',
      quantity: qty,
      heal_amount: healAmount,
      hp_current: hpAfter,
      inventory,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Consumable use failed' }, { status: 500 });
  }
}