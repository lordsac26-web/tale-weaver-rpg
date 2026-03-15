import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Fetch monsters from Open5E API and populate the Monster entity
 * Filters for CR 0-5 creatures suitable for low-to-mid level play
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (user?.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    // Fetch monsters from Open5E, sorted by CR
    const response = await fetch('https://api.open5e.com/monsters/?limit=200&ordering=cr&document__slug=wotc-srd');
    const data = await response.json();

    // Filter for CR 0-5 and select diverse creatures
    const targetCRs = [0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5];
    const monstersToAdd = [];
    const addedNames = new Set();

    for (const cr of targetCRs) {
      const matches = data.results.filter(m => m.cr === cr && !addedNames.has(m.name));
      
      // Take more creatures per tier for variety
      const selected = matches.slice(0, cr <= 0.5 ? 4 : 3);
      
      for (const monster of selected) {
        if (monstersToAdd.length >= 50) break;
        
        // Parse attack info from actions
        let attackBonus = 2;
        let damageDice = '1d6';
        let damageBonus = 0;
        
        if (monster.actions && monster.actions.length > 0) {
          const firstAttack = monster.actions[0].desc || '';
          const hitMatch = firstAttack.match(/\+(\d+) to hit/);
          const dmgMatch = firstAttack.match(/(\d+) \((\d+d\d+)(?:\s*\+\s*(\d+))?\)/);
          
          if (hitMatch) attackBonus = parseInt(hitMatch[1]);
          if (dmgMatch) {
            damageDice = dmgMatch[2];
            damageBonus = parseInt(dmgMatch[3] || 0);
          }
        }

        // Build traits and actions strings
        const traits = (monster.special_abilities || [])
          .map(t => `${t.name}: ${t.desc}`)
          .join('\n\n');
        
        const actions = (monster.actions || [])
          .map(a => `${a.name}: ${a.desc}`)
          .join('\n\n');

        const legendary = (monster.legendary_actions || [])
          .map(l => `${l.name}: ${l.desc}`)
          .join('\n\n');

        const reactions = (monster.reactions || [])
          .map(r => `${r.name}: ${r.desc}`)
          .join('\n\n');

        monstersToAdd.push({
          name: monster.name,
          meta: `${monster.size} ${monster.type}${monster.subtype ? ` (${monster.subtype})` : ''}, ${monster.alignment || 'unaligned'}`,
          armor_class: `${monster.armor_class}${monster.armor_desc ? ` (${monster.armor_desc})` : ''}`,
          hit_points: `${monster.hit_points}${monster.hit_dice ? ` (${monster.hit_dice})` : ''}`,
          speed: Object.entries(monster.speed || {}).map(([k, v]) => `${k} ${v} ft.`).join(', '),
          str: String(monster.strength),
          str_mod: String(Math.floor((monster.strength - 10) / 2)),
          dex: String(monster.dexterity),
          dex_mod: String(Math.floor((monster.dexterity - 10) / 2)),
          con: String(monster.constitution),
          con_mod: String(Math.floor((monster.constitution - 10) / 2)),
          int: String(monster.intelligence),
          int_mod: String(Math.floor((monster.intelligence - 10) / 2)),
          wis: String(monster.wisdom),
          wis_mod: String(Math.floor((monster.wisdom - 10) / 2)),
          cha: String(monster.charisma),
          cha_mod: String(Math.floor((monster.charisma - 10) / 2)),
          saving_throws: Object.entries(monster.skills || {})
            .filter(([k]) => k.includes('save'))
            .map(([k, v]) => `${k}: ${v >= 0 ? '+' : ''}${v}`)
            .join(', ') || '—',
          skills: Object.entries(monster.skills || {})
            .filter(([k]) => !k.includes('save'))
            .map(([k, v]) => `${k}: ${v >= 0 ? '+' : ''}${v}`)
            .join(', ') || '—',
          damage_vulnerabilities: monster.damage_vulnerabilities || '',
          damage_resistances: monster.damage_resistances || '',
          damage_immunities: monster.damage_immunities || '',
          condition_immunities: monster.condition_immunities || '',
          senses: monster.senses || '—',
          languages: monster.languages || '—',
          challenge: monster.challenge_rating || '0',
          traits: traits || '—',
          actions: actions || '—',
          legendary_actions: legendary || '',
          reactions: reactions || '',
          biomes: (monster.environments || []).join(', ') || 'Various',
          loot: cr >= 1 ? 'Coins, possible magic item' : 'Coins, minor items',
        });

        addedNames.add(monster.name);
      }
    }

    // Bulk create monsters
    const created = await base44.asServiceRole.entities.Monster.bulkCreate(monstersToAdd);

    return Response.json({
      success: true,
      count: created.length,
      monsters: created.map(m => ({ name: m.name, cr: m.challenge }))
    });

  } catch (error) {
    console.error('Monster population error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});