import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      name, meta, armor_class, hit_points, speed,
      str, dex, con, int, wis, cha,
      saving_throws, skills, damage_immunities, damage_resistances,
      condition_immunities, senses, languages, challenge,
      traits, actions, legendary_actions, reactions,
      biomes, loot, description 
    } = await req.json();

    if (!name) {
      return Response.json({ error: 'Monster name is required' }, { status: 400 });
    }

    // Calculate modifiers
    const calcMod = (score) => Math.floor((parseInt(score) - 10) / 2);
    
    const monsterData = {
      name,
      meta: meta || '',
      armor_class: String(armor_class || '10'),
      hit_points: String(hit_points || '1'),
      speed: speed || '',
      str: String(str || '10'),
      str_mod: String(calcMod(parseInt(str) || 10)),
      dex: String(dex || '10'),
      dex_mod: String(calcMod(parseInt(dex) || 10)),
      con: String(con || '10'),
      con_mod: String(calcMod(parseInt(con) || 10)),
      int: String(int || '10'),
      int_mod: String(calcMod(parseInt(int) || 10)),
      wis: String(wis || '10'),
      wis_mod: String(calcMod(parseInt(wis) || 10)),
      cha: String(cha || '10'),
      cha_mod: String(calcMod(parseInt(cha) || 10)),
      saving_throws: saving_throws || '',
      skills: skills || '',
      damage_immunities: damage_immunities || '',
      damage_resistances: damage_resistances || '',
      condition_immunities: condition_immunities || '',
      senses: senses || '',
      languages: languages || '',
      challenge: challenge || '0',
      traits: traits || '',
      actions: actions || '',
      legendary_actions: legendary_actions || '',
      reactions: reactions || '',
      biomes: biomes || '',
      loot: loot || '',
      description: description || '',
      is_custom: true
    };

    // Check if monster with same name exists
    const existing = await base44.asServiceRole.entities.CustomMonster.filter({ name });
    
    let result;
    if (existing.length > 0) {
      // Update existing
      result = await base44.asServiceRole.entities.CustomMonster.update(existing[0].id, monsterData);
    } else {
      // Create new
      result = await base44.asServiceRole.entities.CustomMonster.create(monsterData);
    }

    return Response.json({ 
      success: true, 
      monster: result,
      message: existing.length > 0 ? 'Custom monster updated' : 'Custom monster created'
    });
  } catch (error) {
    console.error('Custom monster error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});