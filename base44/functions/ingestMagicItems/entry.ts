import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const OPEN5E = 'https://api.open5e.com/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all magic items from Open5e
    let items = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const res = await fetch(`${OPEN5E}/magicitems/?limit=100&page=${page}`);
      if (!res.ok) break;
      const data = await res.json();
      items = [...items, ...(data.results || [])];
      hasMore = !!data.next;
      page++;
    }

    // Transform to MagicItem entity schema
    const transformed = items.map(item => ({
      name: item.name,
      identified_name: item.name,
      category: categorizeItem(item.type || ''),
      rarity: parseRarity(item.rarity || 'common'),
      requires_attunement: !!item.requires_attunement && item.requires_attunement !== '',
      description: item.desc || '',
      unidentified_description: 'A magical item of unknown properties.',
      is_identified: true,
      charges: 0,
      recharge: '',
      modifiers: {},
      raw_data: item
    }));

    // Bulk create
    const result = await base44.asServiceRole.entities.MagicItem.bulkCreate(transformed);
    
    return Response.json({ 
      success: true, 
      count: result.length,
      message: `Ingested ${result.length} magic items`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function categorizeItem(typeStr) {
  const type = typeStr.toLowerCase();
  if (type.includes('weapon')) return 'Weapon';
  if (type.includes('armor') || type.includes('chain') || type.includes('plate')) return 'Armor';
  if (type.includes('shield')) return 'Shield';
  if (type.includes('helm') || type.includes('hat')) return 'Helmet';
  if (type.includes('cloak') || type.includes('cape')) return 'Cloak';
  if (type.includes('gloves')) return 'Gloves';
  if (type.includes('boots')) return 'Boots';
  if (type.includes('ring')) return 'Ring';
  if (type.includes('amulet') || type.includes('necklace')) return 'Amulet';
  if (type.includes('belt')) return 'Belt';
  if (type.includes('potion')) return 'Potion';
  return 'Wondrous Item';
}

function parseRarity(rarityStr) {
  const rarity = rarityStr.toLowerCase();
  if (rarity === 'very rare') return 'epic';
  if (rarity === 'legendary') return 'legendary';
  if (rarity === 'rare') return 'rare';
  if (rarity === 'uncommon') return 'uncommon';
  return 'common';
}