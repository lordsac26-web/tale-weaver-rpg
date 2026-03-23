import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const IDENTIFICATION_FEE_BY_RARITY = {
  common: 10,
  uncommon: 25,
  rare: 100,
  'very rare': 500,
  legendary: 2500,
  artifact: 5000,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { character_id, item_id, vendor_id } = await req.json();

    if (!character_id || !item_id || !vendor_id) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Fetch character and item
    const chars = await base44.entities.Character.filter({ id: character_id });
    const character = chars[0];
    if (!character) {
      return Response.json({ error: 'Character not found' }, { status: 404 });
    }

    const items = await base44.entities.MagicItem.filter({ id: item_id });
    const item = items[0];
    if (!item) {
      return Response.json({ error: 'Item not found' }, { status: 404 });
    }

    // Check if already identified
    if (item.is_identified) {
      return Response.json({ 
        success: false, 
        message: 'This item is already identified.' 
      });
    }

    // Calculate fee based on rarity
    const fee = IDENTIFICATION_FEE_BY_RARITY[item.rarity] || 50;

    // Check if character has enough gold
    if ((character.gold || 0) < fee) {
      return Response.json({
        success: false,
        requiredGold: fee,
        characterGold: character.gold || 0,
        message: `You need ${fee}gp to identify this item. You only have ${character.gold || 0}gp.`
      });
    }

    // Deduct gold and identify the item
    const newGold = (character.gold || 0) - fee;
    await base44.entities.Character.update(character_id, { gold: newGold });
    await base44.entities.MagicItem.update(item_id, { is_identified: true });

    // Add gold to vendor
    const vendors = await base44.entities.Vendor.filter({ id: vendor_id });
    const vendor = vendors[0];
    if (vendor) {
      const newVendorGold = (vendor.gold_reserve || 200) + fee;
      await base44.entities.Vendor.update(vendor_id, { gold_reserve: newVendorGold });
    }

    return Response.json({
      success: true,
      fee,
      newGold,
      itemName: item.name,
      identifiedName: item.identified_name,
      message: `The vendor successfully identified your ${item.identified_name || 'item'} for ${fee}gp.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});