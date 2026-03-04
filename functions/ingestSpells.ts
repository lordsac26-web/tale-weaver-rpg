import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const OPEN5E = 'https://api.open5e.com/v2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all spells from Open5e v2
    let spells = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const res = await fetch(`${OPEN5E}/spells/?limit=100&page=${page}`);
      if (!res.ok) break;
      const data = await res.json();
      spells = [...spells, ...(data.results || [])];
      hasMore = !!data.next;
      page++;
    }

    // Transform to Spell entity schema
    // Note: Open5e v2 returns some fields as objects, not strings
    const transformed = spells.map(s => ({
      name: s.name,
      level: s.level || 0,
      school: s.school?.name || (typeof s.school === 'string' ? s.school : 'Evocation'),
      casting_time: s.casting_time || '1 action',
      range: typeof s.range === 'object' ? (s.range?.feet ? `${s.range.feet} feet` : String(s.range?.type || 'Self')) : String(s.range || 'Self'),
      components: Array.isArray(s.components) ? s.components.join(', ') : (s.components || ''),
      duration: s.duration || 'Instantaneous',
      description: s.description || '',
      classes: Array.isArray(s.classes) ? s.classes.map(c => c?.name || c) : [],
      ritual: s.ritual || false,
      concentration: s.concentration || false,
      damage_type: s.damage_type?.name || s.damage_type || '',
      damage_dice: s.damage_dice || '',
      save_type: s.save_type?.name || s.save_type || '',
      raw_data: s
    }));

    // Bulk create
    const result = await base44.asServiceRole.entities.Spell.bulkCreate(transformed);
    
    return Response.json({ 
      success: true, 
      count: result.length,
      message: `Ingested ${result.length} spells`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});