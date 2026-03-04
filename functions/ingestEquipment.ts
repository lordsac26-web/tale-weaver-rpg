import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const OPEN5E = 'https://api.open5e.com/v2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch armor
    let armor = [];
    let page = 1;
    while (page <= 5) {
      const res = await fetch(`${OPEN5E}/armor/?limit=100&page=${page}`);
      if (!res.ok) break;
      const data = await res.json();
      armor = [...armor, ...(data.results || [])];
      if (!data.next) break;
      page++;
    }

    // Fetch weapons
    let weapons = [];
    page = 1;
    while (page <= 5) {
      const res = await fetch(`${OPEN5E}/weapons/?limit=100&page=${page}`);
      if (!res.ok) break;
      const data = await res.json();
      weapons = [...weapons, ...(data.results || [])];
      if (!data.next) break;
      page++;
    }

    const equipment = [...armor, ...weapons];

    // Transform to Equipment entity schema
    const transformed = equipment.map(e => ({
      name: e.name,
      category: e.equipment_category?.name || (e.armor_category ? 'Armor' : 'Weapon'),
      cost: String(e.cost?.quantity || 0) + ' ' + (e.cost?.unit || 'gp'),
      weight: String(e.weight || '0'),
      damage: e.damage?.dice_notation || e.damage?.damage_dice || e.damage?.dice || '',
      damage_type: e.damage_type?.name || '',
      armor_class: String(e.armor_class?.base || e.base_ac || 0),
      properties: (e.properties || []).map(p => p?.name || p).filter(Boolean),
      description: e.description || '',
      raw_data: e
    }));

    // Bulk create
    const result = await base44.asServiceRole.entities.Equipment.bulkCreate(transformed);
    
    return Response.json({ 
      success: true, 
      count: result.length,
      message: `Ingested ${result.length} equipment items`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function parseCost(costStr) {
  if (!costStr) return 0;
  const match = costStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}