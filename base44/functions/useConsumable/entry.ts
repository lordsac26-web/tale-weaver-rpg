import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const normalize = (value: unknown) => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { session_id, character_id, item_name, action_text, quantity, use_token } = await req.json();
    if (!session_id || !character_id || !item_name) return Response.json({ error: 'session_id, character_id, and item_name are required' }, { status: 400 });

    const session = await base44.asServiceRole.entities.GameSession.get(session_id);
    const character = await base44.asServiceRole.entities.Character.get(character_id);
    if (!session || !character || session.character_id !== character_id) return Response.json({ error: 'Session and character do not match' }, { status: 403 });

    const canonical = normalize(item_name).replace(/s$/, '');
    if (canonical !== 'goodberry') return Response.json({ error: `The item '${item_name}' is not supported by the authoritative consumable handler yet.` }, { status: 400 });

    const requested = Number(quantity) || (() => {
      const text = normalize(action_text);
      const word = Object.keys(numberWords).find(w => new RegExp(`\\b${w}\\b`).test(text));
      const numeric = text.match(/\\b(\\d+)\\b/)?.[1];
      return word ? numberWords[word] : numeric ? Number(numeric) : 1;
    })();
    const useCount = Math.max(1, Math.min(10, Math.floor(requested)));

    const abilities = character.abilities && typeof character.abilities === 'object' ? character.abilities : {};
    const receipts = Array.isArray(abilities.__consumable_use_receipts) ? abilities.__consumable_use_receipts : [];
    if (use_token && receipts.some((r: any) => r?.token === use_token)) {
      const prior = receipts.find((r: any) => r?.token === use_token);
      return Response.json({ success: true, already_processed: true, item_name: 'Goodberry', quantity: prior.quantity, heal_amount: prior.heal_amount, hp_current: character.hp_current, inventory: character.inventory || [] });
    }

    const inventory = Array.isArray(character.inventory) ? character.inventory.map((item: any) => ({ ...item })) : [];
    const idx = inventory.findIndex((item: any) => normalize(item?.name).replace(/s$/, '') === 'goodberry');
    if (idx < 0) return Response.json({ error: 'No Goodberries remain.' }, { status: 409 });
    const available = Number(inventory[idx].quantity) || 0;
    if (available < useCount) return Response.json({ error: `Only ${available} Goodberr${available === 1 ? 'y' : 'ies'} remain.` }, { status: 409 });

    const healAmount = Math.min(useCount, Math.max(0, Number(character.hp_max || 0) - Number(character.hp_current || 0)));
    const remaining = available - useCount;
    if (remaining > 0) inventory[idx] = { ...inventory[idx], quantity: remaining };
    else inventory.splice(idx, 1);
    const hpCurrent = Math.min(Number(character.hp_max || 0), Number(character.hp_current || 0) + healAmount);
    const nextReceipts = use_token ? [...receipts.filter((r: any) => r?.token !== use_token).slice(-24), { token: use_token, item_name: 'Goodberry', quantity: useCount, heal_amount: healAmount, at: new Date().toISOString() }] : receipts;
    await base44.asServiceRole.entities.Character.update(character_id, {
      hp_current: hpCurrent,
      inventory,
      abilities: { ...abilities, __consumable_use_receipts: nextReceipts },
    });
    return Response.json({ success: true, item_name: 'Goodberry', quantity: useCount, heal_amount: healAmount, hp_current: hpCurrent, inventory });
  } catch (error) {
    console.error('Consumable use error:', error);
    return Response.json({ error: error?.message || 'Consumable use failed' }, { status: 500 });
  }
});
