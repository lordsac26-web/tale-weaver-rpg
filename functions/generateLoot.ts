import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Generates random combat loot based on defeated enemy CR and party level.
 * Returns { gold, silver, copper, items[], flavor_text }
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { enemies = [], character_level = 1 } = await req.json();

  const roll = (sides) => Math.floor(Math.random() * sides) + 1;
  const rollN = (n, sides) => Array.from({ length: n }, () => roll(sides)).reduce((a, b) => a + b, 0);

  // ── Coin generation by CR ────────────────────────────────────────────────
  let gold = 0, silver = 0, copper = 0;

  for (const enemy of enemies) {
    const cr = parseFloat(enemy.cr) || 1;

    if (cr < 0.5) {
      copper += rollN(3, 6);
      silver  += rollN(1, 4);
    } else if (cr < 1) {
      copper += rollN(2, 6);
      silver  += rollN(2, 6);
      gold    += roll(3) > 2 ? roll(4) : 0; // 33% chance of some gold
    } else if (cr <= 2) {
      silver += rollN(3, 8);
      gold   += rollN(1, 6) + 1;
    } else if (cr <= 4) {
      gold   += rollN(2, 6) * 3;
      silver += rollN(1, 6);
    } else if (cr <= 8) {
      gold   += rollN(4, 6) * 5;
    } else if (cr <= 12) {
      gold   += rollN(5, 6) * 10;
    } else {
      gold   += rollN(6, 6) * 25;
    }

    // Small random bonus per kill
    if (Math.random() < 0.35) gold   += rollN(1, 8);
    if (Math.random() < 0.25) silver += rollN(1, 12);
  }

  // Scale by character level (higher-level adventurers expect better rewards)
  const levelMultiplier = 1 + (character_level - 1) * 0.12;
  gold   = Math.floor(gold   * levelMultiplier);
  silver = Math.floor(silver * levelMultiplier);
  copper = Math.floor(copper * levelMultiplier);

  // ── AI item generation ───────────────────────────────────────────────────
  const avgCR = enemies.reduce((s, e) => s + (parseFloat(e.cr) || 1), 0) / Math.max(enemies.length, 1);
  const maxItemRarity = avgCR < 1 ? 'common' : avgCR < 3 ? 'uncommon' : avgCR < 6 ? 'rare' : avgCR < 12 ? 'epic' : 'legendary';
  const maxItems = avgCR < 1 ? 1 : avgCR < 4 ? 2 : 3;

  let items = [];
  let flavor_text = '';

  try {
    const aiResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate looted items for a D&D 5e party (level ${character_level}) who defeated: ${enemies.map(e => `${e.name} (CR ${e.cr || 1})`).join(', ')}.

Rules:
- Generate ${maxItems === 1 ? '0 or 1 item' : `0 to ${maxItems} items`}
- Max item rarity: ${maxItemRarity}
- Items should make narrative sense for these enemies (e.g. a goblin might drop a rusty dagger; a vampire might have a signet ring)
- Include only items a defeated enemy would actually carry
- Also write a single vivid, atmospheric sentence describing the search (2nd person)`,
      response_json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name:             { type: 'string' },
                category:         { type: 'string', enum: ['Weapon','Armor','Shield','Potion','Adventuring Gear','Wondrous Item','Other','Ring','Amulet','Cloak','Helmet','Boots','Gloves','Belt'] },
                rarity:           { type: 'string', enum: ['common','uncommon','rare','epic','legendary'] },
                description:      { type: 'string' },
                quantity:         { type: 'number' },
                weight:           { type: 'number' },
                cost:             { type: 'number' },
                cost_unit:        { type: 'string' },
                damage:           { type: 'string' },
                armor_class:      { type: 'number' },
                armor_type:       { type: 'string' },
                attack_bonus:     { type: 'number' },
                is_magic:         { type: 'boolean' },
                magic_properties: { type: 'array', items: { type: 'string' } },
              }
            }
          },
          flavor_text: { type: 'string' }
        }
      }
    });

    items = (aiResult.items || []).map(item => ({
      name:             item.name || 'Unknown Item',
      category:         item.category || 'Other',
      rarity:           item.rarity || 'common',
      description:      item.description || '',
      quantity:         item.quantity || 1,
      weight:           item.weight || 0,
      cost:             item.cost || 0,
      cost_unit:        item.cost_unit || 'gp',
      damage:           item.damage || '',
      armor_class:      item.armor_class || 0,
      armor_type:       item.armor_type || 'light',
      attack_bonus:     item.attack_bonus || 0,
      is_magic:         item.is_magic || false,
      magic_properties: item.magic_properties || [],
      equip_slot:       null,
    }));
    flavor_text = aiResult.flavor_text || '';
  } catch (e) {
    console.warn('AI loot generation failed, returning coins only:', e.message);
    flavor_text = 'You search the bodies and gather what little remains.';
  }

  return Response.json({ gold, silver, copper, items, flavor_text });
});