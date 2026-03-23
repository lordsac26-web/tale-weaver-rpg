import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const OPEN5E = 'https://api.open5e.com/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all classes from Open5e
    const res = await fetch(`${OPEN5E}/classes/?limit=100`);
    if (!res.ok) throw new Error('Failed to fetch classes');
    const data = await res.json();
    const classes = data.results || [];

    // Transform to DnDClass entity schema
    const transformed = classes.map(c => ({
      name: c.name,
      description: c.desc || '',
      hit_die: parseInt(c.hit_die) || 8,
      primary_ability: c.primary_ability || 'strength',
      saving_throw_proficiencies: c.saving_throws || [],
      armor_proficiencies: c.armor_proficiencies || [],
      weapon_proficiencies: c.weapon_proficiencies || [],
      skill_choices: c.skill_choices || [],
      skill_count: c.skill_count || 2,
      subclasses: c.subclasses || [],
      features_by_level: c.features_by_level || {},
      spell_slots_by_level: c.spell_slots_by_level || {},
      spellcasting_ability: c.spellcasting_ability || '',
      raw_data: c
    }));

    // Bulk create
    const result = await base44.asServiceRole.entities.DnDClass.bulkCreate(transformed);
    
    return Response.json({ 
      success: true, 
      count: result.length,
      message: `Ingested ${result.length} classes`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});