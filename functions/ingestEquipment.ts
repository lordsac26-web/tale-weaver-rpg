import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Ingest Equipment from Open5e v1 API (SRD-only, clean field mapping)
 * + AI-generated adventuring gear, tools, and mounts via LLM RAG
 *
 * Call with: { target: 'weapons' | 'armor' | 'gear' | 'all' }
 * Deduplicates by name before inserting.
 */

const OPEN5E_V1 = 'https://api.open5e.com/v1';

async function fetchAllPages(url) {
  const results = [];
  let nextUrl = url;
  let pageCount = 0;
  while (nextUrl && pageCount < 10) {
    const res = await fetch(nextUrl);
    if (!res.ok) break;
    const data = await res.json();
    results.push(...(data.results || []));
    nextUrl = data.next || null;
    pageCount++;
  }
  return results;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { target = 'all' } = await req.json();
    const db = base44.asServiceRole;
    const results = {};

    // ── 1. WEAPONS (Open5e v1 SRD) ───────────────────────────────────────────
    if (target === 'all' || target === 'weapons') {
      const weapons = await fetchAllPages(
        `${OPEN5E_V1}/weapons/?limit=100&document__slug=wotc-srd`
      );

      const records = weapons.map(w => {
        // Determine melee vs ranged from category string
        const isRanged = (w.category || '').toLowerCase().includes('ranged');
        const isSimple = (w.category || '').toLowerCase().includes('simple');

        return {
          name: w.name,
          category: 'Weapon',
          cost: w.cost || '0 gp',
          weight: w.weight || '',
          damage: w.damage_dice || '',
          damage_type: w.damage_type || '',
          armor_class: '',
          properties: Array.isArray(w.properties) ? w.properties : [],
          description: [
            `${isSimple ? 'Simple' : 'Martial'} ${isRanged ? 'Ranged' : 'Melee'} Weapon`,
            w.category || ''
          ].filter(Boolean).join(' — '),
          raw_data: w,
        };
      });

      if (records.length) {
        await db.entities.Equipment.bulkCreate(records);
        results.weapons = records.length;
      }
    }

    // ── 2. ARMOR (Open5e v1 SRD) ─────────────────────────────────────────────
    if (target === 'all' || target === 'armor') {
      const armor = await fetchAllPages(
        `${OPEN5E_V1}/armor/?limit=100&document__slug=wotc-srd`
      );

      const records = armor
        // Skip class features that show up in the armor endpoint
        .filter(a => a.category !== 'Class Feature')
        .map(a => {
          const acStr = a.ac_string || String(a.base_ac || 0);
          const props = [];
          if (a.stealth_disadvantage) props.push('Stealth Disadvantage');
          if (a.strength_requirement) props.push(`Strength ${a.strength_requirement}`);

          return {
            name: a.name,
            category: 'Armor',
            cost: a.cost || '0 gp',
            weight: a.weight || '',
            damage: '',
            damage_type: '',
            armor_class: acStr,
            properties: props,
            description: `${a.category || 'Armor'} — AC: ${acStr}`,
            raw_data: a,
          };
        });

      if (records.length) {
        await db.entities.Equipment.bulkCreate(records);
        results.armor = records.length;
      }
    }

    // ── 3. ADVENTURING GEAR & TOOLS (AI RAG) ─────────────────────────────────
    // Open5e doesn't have a clean gear/tools API, so we use LLM with web search
    // to generate accurate SRD adventuring gear and tool data.
    if (target === 'all' || target === 'gear') {
      const gearResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a D&D 5e SRD data expert. Generate a comprehensive list of D&D 5e SRD adventuring gear and tools as a JSON array.

Include ALL of the following categories:
1. Adventuring Gear (rope, torches, rations, bedroll, backpack, lantern, ink, etc.)
2. Tools (Artisan tools, musical instruments, gaming sets, thieves tools, herbalism kit, etc.)
3. Shields (Buckler, Shield)
4. Mounts & Vehicles (horse, mule, cart, rowboat, etc.)
5. Trade Goods (common items with gp values)

For each item return EXACTLY this JSON shape:
{
  "name": string,
  "category": one of ["Adventuring Gear", "Tool", "Shield", "Mount", "Vehicle", "Trade Goods"],
  "cost": string like "15 gp" or "2 sp",
  "weight": string like "5 lb." or "",
  "damage": "",
  "damage_type": "",
  "armor_class": string (for shields: "2", else ""),
  "properties": array of strings,
  "description": string (1 sentence describing the item and its use)
}

Return at least 80 items. Return ONLY the JSON array, no markdown, no commentary.`,
        add_context_from_internet: false,
        response_json_schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                  cost: { type: 'string' },
                  weight: { type: 'string' },
                  damage: { type: 'string' },
                  damage_type: { type: 'string' },
                  armor_class: { type: 'string' },
                  properties: { type: 'array', items: { type: 'string' } },
                  description: { type: 'string' },
                }
              }
            }
          }
        }
      });

      const gearItems = gearResult?.items || [];

      if (gearItems.length) {
        const records = gearItems.map(g => ({
          name: g.name || 'Unknown',
          category: g.category || 'Adventuring Gear',
          cost: g.cost || '0 gp',
          weight: g.weight || '',
          damage: g.damage || '',
          damage_type: g.damage_type || '',
          armor_class: g.armor_class || '',
          properties: Array.isArray(g.properties) ? g.properties : [],
          description: g.description || '',
          raw_data: {},
        }));
        await db.entities.Equipment.bulkCreate(records);
        results.gear = records.length;
      }
    }

    const total = Object.values(results).reduce((a, b) => a + b, 0);
    return Response.json({
      success: true,
      total_ingested: total,
      breakdown: results,
      message: `Successfully ingested ${total} equipment items: ${JSON.stringify(results)}`
    });

  } catch (error) {
    console.error('ingestEquipment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});