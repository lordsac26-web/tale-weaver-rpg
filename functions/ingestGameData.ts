import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const FILE_URLS = {
  races: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a4e1720142630debaad046/c2d2b73b1_01races.json",
  classes: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a4e1720142630debaad046/b34c0ea94_02classes.json",
  equipment: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a4e1720142630debaad046/e49756994_04equipment.json",
  conditions: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a4e1720142630debaad046/14f6f9af1_12conditions.json",
  magicItems: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a4e1720142630debaad046/d27bbee6d_10magicitems.json",
  monsters: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a4e1720142630debaad046/9a2ae6046_bestiary_200_cleaned.json",
  npcs: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a4e1720142630debaad046/b4fb8b572_16npcs.json",
  spells: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a4e1720142630debaad046/de387c1fd_full_spell_library.json",
};

function parseACNumber(acStr) {
  if (!acStr) return 10;
  const match = String(acStr).match(/\d+/);
  return match ? parseInt(match[0]) : 10;
}

function parseHPNumber(hpStr) {
  if (!hpStr) return 10;
  const match = String(hpStr).match(/\d+/);
  return match ? parseInt(match[0]) : 10;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target } = await req.json();
    const db = base44.asServiceRole;
    const results = {};

    // ── RACES ──────────────────────────────────────────────────────────────
    if (!target || target === 'races') {
      const raw = await (await fetch(FILE_URLS.races)).json();
      const racesData = raw.Races || {};
      const records = [];
      for (const [raceName, raceData] of Object.entries(racesData)) {
        if (raceName === 'Racial Traits' || typeof raceData !== 'object') continue;
        records.push({
          name: raceName,
          description: raceData.content || '',
          ability_score_increase: raceData['Ability Score Increase'] || {},
          age: typeof raceData.Age === 'string' ? raceData.Age : '',
          alignment: typeof raceData.Alignment === 'string' ? raceData.Alignment : '',
          size: typeof raceData.Size === 'string' ? raceData.Size : '',
          speed: 30,
          languages: [],
          traits: [],
          subraces: [],
          raw_data: raceData
        });
      }
      if (records.length) {
        await db.entities.Race.bulkCreate(records);
        results.races = records.length;
      }
    }

    // ── CLASSES ────────────────────────────────────────────────────────────
    if (!target || target === 'classes') {
      const raw = await (await fetch(FILE_URLS.classes)).json();
      const records = [];
      for (const [className, classData] of Object.entries(raw)) {
        if (typeof classData !== 'object') continue;
        records.push({
          name: className,
          description: Array.isArray(classData.content) ? classData.content[0] || '' : classData.content || '',
          hit_die: classData['Hit Die'] ? parseInt(String(classData['Hit Die']).replace('d', '')) : 8,
          primary_ability: classData['Primary Ability'] || '',
          saving_throw_proficiencies: classData['Saving Throw Proficiencies'] ? [classData['Saving Throw Proficiencies']] : [],
          armor_proficiencies: [],
          weapon_proficiencies: [],
          skill_choices: [],
          skill_count: 2,
          subclasses: [],
          features_by_level: {},
          spell_slots_by_level: {},
          spellcasting_ability: '',
          raw_data: classData
        });
      }
      if (records.length) {
        await db.entities.DnDClass.bulkCreate(records);
        results.classes = records.length;
      }
    }

    // ── SPELLS ─────────────────────────────────────────────────────────────
    if (!target || target === 'spells') {
      // The spell file contains JS comments, so we need to strip them first
      const rawText = await (await fetch(FILE_URLS.spells)).text();
      const cleanText = rawText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      const raw = JSON.parse(cleanText);
      const spellList = Array.isArray(raw) ? raw : (raw.spells || raw.Spells || Object.values(raw)[0] || []);
      const records = spellList.map(spell => ({
        name: spell.name || spell.Name || 'Unknown Spell',
        level: parseInt(spell.level ?? spell.Level ?? 0) || 0,
        school: spell.school || spell.School || '',
        casting_time: spell.casting_time || spell['Casting Time'] || '',
        range: spell.range || spell.Range || '',
        components: Array.isArray(spell.components) ? spell.components.join(', ') : (spell.components || spell.Components || ''),
        duration: spell.duration || spell.Duration || '',
        description: spell.description || spell.Description || spell.desc || '',
        classes: Array.isArray(spell.classes) ? spell.classes : (spell.classes ? [spell.classes] : []),
        ritual: !!(spell.ritual || spell.Ritual),
        concentration: !!(spell.concentration || spell.Concentration),
        damage_type: spell.damage_type || '',
        damage_dice: spell.damage_dice || '',
        save_type: spell.save_type || spell.save || '',
        raw_data: spell
      }));
      if (records.length) {
        await db.entities.Spell.bulkCreate(records);
        results.spells = records.length;
      }
    }

    // ── MONSTERS (bestiary) ────────────────────────────────────────────────
    if (!target || target === 'monsters') {
      const raw = await (await fetch(FILE_URLS.monsters)).json();
      const monsterList = Array.isArray(raw) ? raw : [];
      const records = monsterList.map(m => ({
        name: m.name || 'Unknown',
        meta: m.meta || '',
        armor_class: String(m.armor_class || '10'),
        hit_points: String(m.hit_points || '10'),
        speed: String(m.speed || '30 ft.'),
        str: String(m.str || '10'), str_mod: String(m.str_mod || '+0'),
        dex: String(m.dex || '10'), dex_mod: String(m.dex_mod || '+0'),
        con: String(m.con || '10'), con_mod: String(m.con_mod || '+0'),
        int: String(m.int || '10'), int_mod: String(m.int_mod || '+0'),
        wis: String(m.wis || '10'), wis_mod: String(m.wis_mod || '+0'),
        cha: String(m.cha || '10'), cha_mod: String(m.cha_mod || '+0'),
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
      if (records.length) {
        await db.entities.Monster.bulkCreate(records);
        results.monsters = records.length;
      }
    }

    // ── MAGIC ITEMS ────────────────────────────────────────────────────────
    if (!target || target === 'magicItems') {
      const raw = await (await fetch(FILE_URLS.magicItems)).json();
      const itemsData = raw['Magic Items'] || {};
      const records = [];
      for (const [itemName, itemData] of Object.entries(itemsData)) {
        if (itemName === 'content' || typeof itemData !== 'object') continue;
        const content = Array.isArray(itemData.content) ? itemData.content : (typeof itemData.content === 'string' ? [itemData.content] : []);
        const firstLine = typeof content[0] === 'string' ? content[0] : '';
        const rarityMatch = firstLine.match(/\*(.*?)\*/);
        const rarityStr = rarityMatch ? rarityMatch[1] : '';
        records.push({
          name: itemName,
          category: rarityStr.split(',')[0]?.trim() || '',
          rarity: rarityStr.split(',')[1]?.trim() || '',
          requires_attunement: rarityStr.toLowerCase().includes('attunement'),
          description: content.filter(c => typeof c === 'string').join('\n'),
          raw_data: itemData
        });
      }
      if (records.length) {
        await db.entities.MagicItem.bulkCreate(records);
        results.magicItems = records.length;
      }
    }

    // ── CONDITIONS ─────────────────────────────────────────────────────────
    if (!target || target === 'conditions') {
      const raw = await (await fetch(FILE_URLS.conditions)).json();
      const condData = raw['Appendix PH-A: Conditions'] || {};
      const records = [];
      for (const [condName, condInfo] of Object.entries(condData)) {
        if (condName === 'content') continue;
        const desc = Array.isArray(condInfo) ? condInfo : (condInfo.content ? (Array.isArray(condInfo.content) ? condInfo.content : [condInfo.content]) : [String(condInfo)]);
        records.push({
          name: condName,
          description: desc.filter(d => typeof d === 'string'),
          mechanical_effects: {}
        });
      }
      if (records.length) {
        await db.entities.DnDCondition.bulkCreate(records);
        results.conditions = records.length;
      }
    }

    // ── NPCs ───────────────────────────────────────────────────────────────
    if (!target || target === 'npcs') {
      const raw = await (await fetch(FILE_URLS.npcs)).json();
      const npcData = raw['Appendix MM-B: Nonplayer Characters'] || {};
      const records = [];
      for (const [npcName, npcInfo] of Object.entries(npcData)) {
        if (npcName === 'content' || npcName === 'Customizing NPCs' || typeof npcInfo !== 'object') continue;
        const content = Array.isArray(npcInfo.content) ? npcInfo.content : [];
        const statLine = content.find(c => typeof c === 'object' && c.table) || {};
        const table = statLine.table || {};
        records.push({
          name: npcName,
          meta: content[0] || '',
          armor_class: content.find(c => typeof c === 'string' && c.includes('Armor Class'))?.replace('**Armor Class** ', '') || '',
          hit_points: content.find(c => typeof c === 'string' && c.includes('Hit Points'))?.replace('**Hit Points** ', '') || '',
          speed: content.find(c => typeof c === 'string' && c.includes('Speed'))?.replace('**Speed** ', '') || '',
          challenge: content.find(c => typeof c === 'string' && c.includes('Challenge'))?.replace('**Challenge** ', '') || '',
          str: table.STR?.[0] || '', dex: table.DEX?.[0] || '', con: table.CON?.[0] || '',
          int: table.INT?.[0] || '', wis: table.WIS?.[0] || '', cha: table.CHA?.[0] || '',
          skills: content.find(c => typeof c === 'string' && c.includes('Skills'))?.replace('**Skills** ', '') || '',
          senses: content.find(c => typeof c === 'string' && c.includes('Senses'))?.replace('**Senses** ', '') || '',
          languages: content.find(c => typeof c === 'string' && c.includes('Languages'))?.replace('**Languages** ', '') || '',
          traits: '',
          actions: '',
          description: content.filter(c => typeof c === 'string').join('\n'),
          raw_data: npcInfo
        });
      }
      if (records.length) {
        await db.entities.NPC.bulkCreate(records);
        results.npcs = records.length;
      }
    }

    return Response.json({ success: true, ingested: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});