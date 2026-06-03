import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const OPEN5E = 'https://api.open5e.com/v1';
const DND5E = 'https://www.dnd5eapi.co/api';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const existing = await base44.asServiceRole.entities.MagicItem.list();
    const existingNames = new Set((existing || []).map(item => normalizeName(item.name)));

    const [open5eItems, dnd5eItems] = await Promise.all([
      fetchOpen5eMagicItems(),
      fetchDnd5eMagicItems(),
    ]);

    const seen = new Set(existingNames);
    const transformed = [...open5eItems, ...dnd5eItems]
      .map(normalizeMagicItem)
      .filter(item => item.name && !seen.has(normalizeName(item.name)) && seen.add(normalizeName(item.name)));

    const created = transformed.length > 0
      ? await base44.asServiceRole.entities.MagicItem.bulkCreate(transformed)
      : [];

    return Response.json({
      success: true,
      imported: created.length,
      skipped_existing: existingNames.size,
      sources: {
        open5e: open5eItems.length,
        dnd5eapi: dnd5eItems.length,
      },
      message: `Added ${created.length} new magical and wondrous items.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function fetchOpen5eMagicItems() {
  const items = [];
  let nextUrl = `${OPEN5E}/magicitems/?limit=100`;

  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) break;
    const data = await res.json();
    items.push(...(data.results || []));
    nextUrl = data.next;
  }

  return items.map(item => ({ ...item, _source: 'open5e' }));
}

async function fetchDnd5eMagicItems() {
  const indexRes = await fetch(`${DND5E}/magic-items`);
  if (!indexRes.ok) return [];
  const index = await indexRes.json();
  const refs = index.results || [];
  const items = [];

  for (const ref of refs) {
    const detailRes = await fetch(`${DND5E}${ref.url}`);
    if (!detailRes.ok) continue;
    const detail = await detailRes.json();
    items.push({ ...detail, _source: 'dnd5eapi' });
  }

  return items;
}

function normalizeMagicItem(item) {
  const source = item._source || 'unknown';
  const description = Array.isArray(item.desc)
    ? item.desc.join('\n\n')
    : item.desc || item.description || item.text || '';
  const rarityText = item.rarity?.name || item.rarity || 'common';
  const categoryText = item.equipment_category?.name || item.type || item.category || item.name || '';
  const requiresAttunement = Boolean(item.requires_attunement) || /requires attunement/i.test(description);

  return {
    name: item.name || item.item_name,
    identified_name: item.name || item.item_name,
    category: categorizeItem(categoryText),
    rarity: parseRarity(rarityText),
    requires_attunement: requiresAttunement,
    description,
    unidentified_description: 'A magical item of unknown properties.',
    is_identified: true,
    charges: parseCharges(description),
    recharge: parseRecharge(description),
    modifiers: inferModifiers(item.name || '', description),
    raw_data: { source, item }
  };
}

function categorizeItem(typeStr) {
  const type = String(typeStr || '').toLowerCase();
  if (type.includes('weapon') || type.includes('sword') || type.includes('staff') || type.includes('wand')) return 'Weapon';
  if (type.includes('armor') || type.includes('chain') || type.includes('mail') || type.includes('plate')) return 'Armor';
  if (type.includes('shield')) return 'Shield';
  if (type.includes('helm') || type.includes('hat')) return 'Helmet';
  if (type.includes('cloak') || type.includes('cape') || type.includes('robe')) return 'Cloak';
  if (type.includes('glove') || type.includes('gauntlet')) return 'Gloves';
  if (type.includes('boot') || type.includes('shoe') || type.includes('slipper')) return 'Boots';
  if (type.includes('ring')) return 'Ring';
  if (type.includes('amulet') || type.includes('necklace') || type.includes('periapt')) return 'Amulet';
  if (type.includes('belt') || type.includes('girdle')) return 'Belt';
  if (type.includes('potion') || type.includes('elixir') || type.includes('oil')) return 'Potion';
  return 'Wondrous Item';
}

function parseRarity(rarityStr) {
  const rarity = String(rarityStr || '').toLowerCase();
  if (rarity.includes('artifact')) return 'artifact';
  if (rarity.includes('legendary')) return 'legendary';
  if (rarity.includes('very rare')) return 'epic';
  if (rarity.includes('rare')) return 'rare';
  if (rarity.includes('uncommon')) return 'uncommon';
  return 'common';
}

function parseCharges(description) {
  const match = String(description || '').match(/(\d+)\s+charges/i);
  return match ? Number(match[1]) : 0;
}

function parseRecharge(description) {
  const text = String(description || '');
  const match = text.match(/regains?[^.]*charges?[^.]*/i);
  return match ? match[0] : '';
}

function inferModifiers(name, description) {
  const text = `${name} ${description}`.toLowerCase();
  const modifiers = {};
  if (/\+1 bonus to ac|armor class increases by 1|\+1 to armor class/.test(text)) modifiers.ac_bonus = 1;
  if (/\+2 bonus to ac|armor class increases by 2|\+2 to armor class/.test(text)) modifiers.ac_bonus = 2;
  if (/\+3 bonus to ac|armor class increases by 3|\+3 to armor class/.test(text)) modifiers.ac_bonus = 3;
  if (/\+1 bonus to attack and damage|\+1 weapon/.test(text)) modifiers.weapon_bonus = 1;
  if (/\+2 bonus to attack and damage|\+2 weapon/.test(text)) modifiers.weapon_bonus = 2;
  if (/\+3 bonus to attack and damage|\+3 weapon/.test(text)) modifiers.weapon_bonus = 3;
  return modifiers;
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}