import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const OPEN5E = 'https://api.open5e.com/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all monsters from Open5e
    let monsters = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) { // Cap at 10 pages for performance
      const res = await fetch(`${OPEN5E}/monsters/?limit=100&page=${page}`);
      if (!res.ok) break;
      const data = await res.json();
      monsters = [...monsters, ...(data.results || [])];
      hasMore = !!data.next;
      page++;
    }

    // Transform to Monster entity schema
    const transformed = monsters.map(m => ({
      name: m.name,
      meta: m.meta || (m.size ? `${m.size} ${m.type || ''}, ${m.alignment || ''}`.trim() : ''),
      armor_class: String(Array.isArray(m.armor_class) ? m.armor_class[0]?.value || m.armor_class[0] : m.armor_class) || '10',
      hit_points: String(m.hit_points) || '1',
      speed: typeof m.speed === 'object' ? Object.entries(m.speed).map(([k, v]) => `${k} ${v}ft`).join(', ') : String(m.speed || ''),
      str: String(m.strength) || '10',
      str_mod: String(calcMod(m.strength)) || '0',
      dex: String(m.dexterity) || '10',
      dex_mod: String(calcMod(m.dexterity)) || '0',
      con: String(m.constitution) || '10',
      con_mod: String(calcMod(m.constitution)) || '0',
      int: String(m.intelligence) || '10',
      int_mod: String(calcMod(m.intelligence)) || '0',
      wis: String(m.wisdom) || '10',
      wis_mod: String(calcMod(m.wisdom)) || '0',
      cha: String(m.charisma) || '10',
      cha_mod: String(calcMod(m.charisma)) || '0',
      saving_throws: m.saving_throws || '',
      skills: m.skills || '',
      damage_immunities: m.damage_immunities || '',
      damage_resistances: m.damage_resistances || '',
      condition_immunities: m.condition_immunities || '',
      senses: m.senses || '',
      languages: m.languages || '',
      challenge: m.challenge || '0',
      traits: m.traits || '',
      actions: m.actions || '',
      legendary_actions: m.legendary_actions || '',
      reactions: m.reactions || '',
      biomes: m.biomes || '',
      loot: m.loot || ''
    }));

    // Bulk create
    const result = await base44.asServiceRole.entities.Monster.bulkCreate(transformed);
    
    return Response.json({ 
      success: true, 
      count: result.length,
      message: `Ingested ${result.length} monsters`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calcMod(score) {
  return Math.floor((score - 10) / 2);
}