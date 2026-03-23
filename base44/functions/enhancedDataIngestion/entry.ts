import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Enhanced Data Ingestion Function
 * Fetches D&D 5e data from multiple sources:
 * - Open5e API (monsters, spells, equipment)
 * - D&D 5e SRD GitHub (comprehensive data)
 * - D&D 5API (official SRD API)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { source, dataType } = await req.json();
    let results = { imported: 0, failed: 0, errors: [] };

    // Open5e API - Comprehensive 5e SRD data
    if (source === 'open5e' || !source) {
      results = { ...results, ...(await ingestOpen5e(base44, dataType)) };
    }

    // D&D 5e API - Official SRD data
    if (source === 'dnd5eapi' || !source) {
      results = { ...results, ...(await ingestD5eAPI(base44, dataType)) };
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// OPEN5E API Integration (https://open5e.com)
// ─────────────────────────────────────────────────────────────────────────

async function ingestOpen5e(base44, dataType) {
  const results = { imported: 0, failed: 0, errors: [] };
  const BASE_URL = 'https://api.open5e.com/v1';

  try {
    // Fetch Monsters
    if (!dataType || dataType === 'monsters') {
      console.log('Fetching monsters from Open5e...');
      const monsters = await fetchPaginatedData(`${BASE_URL}/monsters/`, 1000);
      const formattedMonsters = monsters.map(formatOpen5eMonster);
      
      for (const monster of formattedMonsters) {
        try {
          await base44.asServiceRole.entities.Monster.create(monster);
          results.imported++;
        } catch (e) {
          results.failed++;
          results.errors.push(`Monster ${monster.name}: ${e.message}`);
        }
      }
      console.log(`Imported ${results.imported} monsters`);
    }

    // Fetch Spells
    if (!dataType || dataType === 'spells') {
      console.log('Fetching spells from Open5e...');
      const spells = await fetchPaginatedData(`${BASE_URL}/spells/`, 1000);
      
      for (const rawSpell of spells) {
        try {
          const spell = await formatOpen5eSpell(rawSpell, base44);
          await base44.asServiceRole.entities.Spell.create(spell);
          results.imported++;
        } catch (e) {
          results.failed++;
          results.errors.push(`Open5e Spell ${rawSpell.name}: ${e.message}`);
        }
      }
      console.log(`Imported ${results.imported} spells`);
    }

    // Fetch Magic Items (from Open5e equipment/magic-items)
    if (!dataType || dataType === 'magic-items') {
      console.log('Fetching magic items from Open5e...');
      const items = await fetchPaginatedData(`${BASE_URL}/magicitems/`, 500);
      const formattedItems = items.map(formatOpen5eMagicItem);
      
      for (const item of formattedItems) {
        try {
          await base44.asServiceRole.entities.MagicItem.create(item);
          results.imported++;
        } catch (e) {
          results.failed++;
          results.errors.push(`Magic Item ${item.name}: ${e.message}`);
        }
      }
      console.log(`Imported ${results.imported} magic items`);
    }

  } catch (error) {
    results.errors.push(`Open5e ingestion error: ${error.message}`);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────
// D&D 5e API Integration (https://www.dnd5eapi.co)
// ─────────────────────────────────────────────────────────────────────────

async function ingestD5eAPI(base44, dataType) {
  const results = { imported: 0, failed: 0, errors: [] };
  const BASE_URL = 'https://www.dnd5eapi.co/api';

  try {
    // Fetch Monsters
    if (!dataType || dataType === 'monsters') {
      console.log('Fetching monsters from D&D 5e API...');
      const monstersIndex = await fetch(`${BASE_URL}/monsters`).then(r => r.json());
      
      for (const monsterRef of (monstersIndex.results || []).slice(0, 200)) {
        try {
          const monster = await fetch(`${BASE_URL}${monsterRef.index}`).then(r => r.json());
          const formatted = formatD5eApiMonster(monster);
          await base44.asServiceRole.entities.Monster.create(formatted);
          results.imported++;
        } catch (e) {
          results.failed++;
          results.errors.push(`Monster ${monsterRef.name}: ${e.message}`);
        }
      }
    }

    // Fetch Spells
    if (!dataType || dataType === 'spells') {
      console.log('Fetching spells from D&D 5e API...');
      const spellsIndex = await fetch(`${BASE_URL}/spells`).then(r => r.json());
      
      for (const spellRef of (spellsIndex.results || []).slice(0, 300)) {
        try {
          const spell = await fetch(`${BASE_URL}${spellRef.index}`).then(r => r.json());
          const formatted = await formatD5eApiSpell(spell, base44);
          await base44.asServiceRole.entities.Spell.create(formatted);
          results.imported++;
        } catch (e) {
          results.failed++;
          results.errors.push(`D&D 5e API Spell ${spellRef.name}: ${e.message}`);
        }
      }
    }

    // Fetch Equipment
    if (!dataType || dataType === 'equipment') {
      console.log('Fetching equipment from D&D 5e API...');
      const equipIndex = await fetch(`${BASE_URL}/equipment`).then(r => r.json());
      
      for (const equipRef of (equipIndex.results || []).slice(0, 150)) {
        try {
          const equipment = await fetch(`${BASE_URL}${equipRef.index}`).then(r => r.json());
          const formatted = formatD5eApiEquipment(equipment);
          await base44.asServiceRole.entities.Equipment.create(formatted);
          results.imported++;
        } catch (e) {
          results.failed++;
          results.errors.push(`Equipment ${equipRef.name}: ${e.message}`);
        }
      }
    }

  } catch (error) {
    results.errors.push(`D&D 5e API ingestion error: ${error.message}`);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────
// Utility: Fetch Paginated Data
// ─────────────────────────────────────────────────────────────────────────

async function fetchPaginatedData(url, limit = 1000) {
  let allData = [];
  let nextUrl = url;
  let count = 0;

  while (nextUrl && count < limit) {
    try {
      const response = await fetch(nextUrl);
      if (!response.ok) break;
      
      const data = await response.json();
      allData = allData.concat(data.results || data);
      nextUrl = data.next;
      count += (data.results || data).length;
    } catch (e) {
      console.error('Pagination error:', e.message);
      break;
    }
  }

  return allData;
}

// ─────────────────────────────────────────────────────────────────────────
// Format Functions - Open5e
// ─────────────────────────────────────────────────────────────────────────

function formatOpen5eMonster(data) {
  return {
    name: data.name,
    meta: `${data.type}, ${data.alignment}`,
    armor_class: String(data.armor_class),
    hit_points: String(data.hit_points),
    speed: data.speed,
    str: String(data.str),
    dex: String(data.dex),
    con: String(data.con),
    int: String(data.int),
    wis: String(data.wis),
    cha: String(data.cha),
    skills: data.skills || '',
    senses: data.senses || '',
    languages: data.languages || '',
    challenge: data.challenge_rating ? String(data.challenge_rating) : '0',
    traits: data.traits ? (Array.isArray(data.traits) ? data.traits.map(t => t.name).join(', ') : data.traits) : '',
    actions: data.actions ? (Array.isArray(data.actions) ? data.actions.map(a => a.name).join(', ') : data.actions) : '',
    description: data.desc || '',
    raw_data: { source: 'open5e', data }
  };
}

async function formatOpen5eSpell(data, base44) {
  const dmgType = data.damage?.damage_type || '';
  
  let visualSummary = '';
  let effectSummary = '';
  
  if (data.description || data.desc) {
    const desc = data.description || data.desc || '';
    try {
      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate TWO brief summaries for the D&D 5e spell "${data.name}":
1. VISUAL: Describe what this spell looks like visually when cast (1-2 sentences, vivid)
2. EFFECT: Explain the core mechanic/what it does (1-2 sentences, clear)
Based on: ${desc}`,
        response_json_schema: {
          type: "object",
          properties: {
            visual: { type: "string" },
            effect: { type: "string" }
          }
        }
      });
      visualSummary = aiResponse.visual || '';
      effectSummary = aiResponse.effect || '';
    } catch (e) {
      console.warn(`Failed to generate AI summary for spell ${data.name}: ${e.message}`);
    }
  }

  return {
    name: data.name,
    level: data.level || 0,
    school: data.school || 'Abjuration',
    casting_time: data.casting_time || 'Action',
    range: data.range || 'Self',
    components: data.components ? data.components.join(', ') : '',
    duration: data.duration || 'Instantaneous',
    description: data.description || data.desc || '',
    visual_summary: visualSummary,
    effect_summary: effectSummary,
    classes: data.classes ? data.classes.split(', ') : [],
    ritual: data.ritual === true,
    concentration: data.concentration === true,
    damage_type: dmgType,
    damage_dice: data.damage?.damage_at_slot_level?.[1] || '',
    attack_type: dmgType ? 'ranged_spell_attack' : 'utility',
    higher_level_scaling: data.higher_levels || '',
    conditions_caused: data.conditions ? (Array.isArray(data.conditions) ? data.conditions : [data.conditions]) : [],
    raw_data: { source: 'open5e', data }
  };
}

function formatOpen5eMagicItem(data) {
  return {
    name: data.name || data.item_name,
    category: data.type || 'Wondrous Item',
    rarity: data.rarity || 'Uncommon',
    requires_attunement: data.requires_attunement === true || data.requires_attunement === 'true',
    description: data.description || data.text || '',
    is_identified: true,
    raw_data: { source: 'open5e', data }
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Format Functions - D&D 5e API
// ─────────────────────────────────────────────────────────────────────────

function formatD5eApiMonster(data) {
  const parseAbility = (str) => {
    const match = str?.match(/(\d+)/);
    return match ? match[1] : '10';
  };

  return {
    name: data.name,
    meta: `${data.type}, ${data.alignment}`,
    armor_class: String(data.armor_class?.[0]?.value || 10),
    hit_points: String(data.hit_points),
    speed: data.speed ? JSON.stringify(data.speed) : '30 ft',
    str: parseAbility(data.strength),
    dex: parseAbility(data.dexterity),
    con: parseAbility(data.constitution),
    int: parseAbility(data.intelligence),
    wis: parseAbility(data.wisdom),
    cha: parseAbility(data.charisma),
    skills: data.skills ? Object.keys(data.skills).join(', ') : '',
    senses: data.senses ? Object.entries(data.senses).map(([k, v]) => `${k} ${v}`).join(', ') : '',
    languages: data.languages || '',
    challenge: String(data.challenge),
    traits: data.special_abilities ? data.special_abilities.map(t => t.name).join(', ') : '',
    actions: data.actions ? data.actions.map(a => a.name).join(', ') : '',
    description: '',
    raw_data: { source: 'd5eapi', data }
  };
}

async function formatD5eApiSpell(data, base44) {
  const description = data.desc ? data.desc.join(' ') : '';
  const dmgType = data.damage?.damage_type?.name || '';
  
  let visualSummary = '';
  let effectSummary = '';
  
  if (description) {
    try {
      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate TWO brief summaries for the D&D 5e spell "${data.name}":
1. VISUAL: Describe what this spell looks like visually when cast (1-2 sentences, vivid)
2. EFFECT: Explain the core mechanic/what it does (1-2 sentences, clear)
Based on: ${description}`,
        response_json_schema: {
          type: "object",
          properties: {
            visual: { type: "string" },
            effect: { type: "string" }
          }
        }
      });
      visualSummary = aiResponse.visual || '';
      effectSummary = aiResponse.effect || '';
    } catch (e) {
      console.warn(`Failed to generate AI summary for spell ${data.name}: ${e.message}`);
    }
  }

  return {
    name: data.name,
    level: data.level || 0,
    school: data.school?.name || 'Abjuration',
    casting_time: data.casting_time || 'Action',
    range: data.range || 'Self',
    components: data.components ? data.components.join(', ') : '',
    duration: data.duration || 'Instantaneous',
    description: description,
    visual_summary: visualSummary,
    effect_summary: effectSummary,
    classes: data.classes ? data.classes.map(c => c.name) : [],
    ritual: data.ritual === true,
    concentration: data.concentration === true,
    damage_type: dmgType,
    save_type: data.damage?.save_dc?.dc_type?.name || '',
    attack_type: dmgType ? 'ranged_spell_attack' : 'utility',
    higher_level_scaling: data.higher_level || '',
    raw_data: { source: 'd5eapi', data }
  };
}

function formatD5eApiEquipment(data) {
  return {
    name: data.name,
    category: data.equipment_category?.name || 'Gear',
    cost: data.cost?.quantity && data.cost?.unit ? `${data.cost.quantity} ${data.cost.unit}` : 'Unknown',
    weight: String(data.weight || 0),
    damage: data.damage ? `${data.damage.damage_dice} ${data.damage.damage_type.name}` : '',
    damage_type: data.damage?.damage_type?.name || '',
    armor_class: data.armor_class?.base ? String(data.armor_class.base) : '',
    description: data.desc?.join(' ') || '',
    raw_data: { source: 'd5eapi', data }
  };
}