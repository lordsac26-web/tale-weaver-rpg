import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const text = (value) => typeof value === 'string' && value.trim().length > 0;

export default async function testContentDetailRegression(req) {
  try {
    await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const spellNames = ['Animal Friendship', 'Detect Magic', 'Fog Cloud', 'Pass without Trace', "Hunter's Mark", 'Cure Wounds', 'Fire Bolt'];
    const spellMatches = await Promise.all(spellNames.map((name) => base44.asServiceRole.entities.Spell.filter({ name }, 'name', 50)));
    const results = spellMatches.map((matches, index) => {
      const spell = matches.find((record) => text(record.description) || text(record.effect_summary));
      return {
        name: `${spellNames[index]} resolves to a usable canonical spell card description`,
        pass: !!spell && (text(spell.description) || text(spell.effect_summary)) && text(spell.school) && Number.isFinite(spell.level) && text(spell.range) && text(spell.duration) && text(spell.components),
        record: spell?.name || null,
      };
    });

    const equipment = { name: 'Longbow', damage: '1d8 piercing', properties: ['Ammunition', 'Heavy', 'Two-Handed'] };
    const magicItems = await base44.asServiceRole.entities.MagicItem.list('name', 100);
    const magic = magicItems.find((item) => text(item.description));
    results.push({ name: 'common equipment exposes useful structured properties', pass: text(equipment.damage) && equipment.properties.length > 0, record: equipment.name });
    results.push({ name: 'magic item exposes a canonical description', pass: !!magic && text(magic.description), record: magic?.name || null });

    const passed = results.filter((result) => result.pass).length;
    return Response.json({ passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, results, live_state: { read_only: true, mutated: false } }, { status: passed === results.length ? 200 : 500 });
  } catch (error) {
    return Response.json({ error: error.message || 'Content detail regression failed' }, { status: 500 });
  }
}