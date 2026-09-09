import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const PLAYER_SPELLS = ["Hunter's Mark",'Cure Wounds','Ensnaring Strike','Pass without Trace','Silence','Detect Magic','Goodberry','Lesser Restoration','Animal Friendship','Speak with Animals','Longstrider','Locate Object','Spike Growth','Animal Messenger'];
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const completeness = row => ['description','components','casting_time','range','duration','school'].reduce((score, field) => score + Number(text(row?.[field])), 0) + Number(typeof row?.concentration === 'boolean');
const choose = (rows) => [...rows].sort((a, b) => Number(text(b.description)) - Number(text(a.description)) || completeness(b) - completeness(a) || String(a.id).localeCompare(String(b.id)))[0];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    const [spells, items] = await Promise.all([base44.asServiceRole.entities.Spell.list(), base44.asServiceRole.entities.MagicItem.list()]);
    const results = [];
    const emptySpells = spells.filter(row => !text(row.description));
    const emptyItems = items.filter(row => !text(row.description));
    results.push({ name: 'Spell catalog has zero empty descriptions', pass: emptySpells.length === 0, count: emptySpells.length });
    results.push({ name: 'MagicItem catalog has zero empty descriptions', pass: emptyItems.length === 0, count: emptyItems.length });
    for (const name of PLAYER_SPELLS) {
      const selected = choose(spells.filter(row => row.name === name));
      const fields = ['description','components','casting_time','range','duration','school'];
      const complete = selected && fields.every(field => text(selected[field])) && typeof selected.concentration === 'boolean';
      results.push({ name: `${name} resolves complete`, pass: !!complete, id: selected?.id || null, missing: selected ? fields.filter(field => !text(selected[field])).concat(typeof selected.concentration === 'boolean' ? [] : ['concentration']) : ['record'] });
    }
    const grouped = spells.reduce((map, row) => { (map[row.name] ||= []).push(row); return map; }, {});
    const duplicateGroups = Object.values(grouped).filter(rows => rows.length > 1 && rows.some(row => text(row.description)) && rows.some(row => !text(row.description)));
    results.push({ name: 'duplicate-name resolution prefers populated descriptions', pass: duplicateGroups.every(rows => text(choose(rows)?.description)), groups: duplicateGroups.length });
    const passed = results.filter(result => result.pass).length;
    return Response.json({ function_version: 'test-spell-catalog-data-quality-v1.0.0', passed, failed: results.length - passed, total: results.length, all_pass: passed === results.length, empty_spell_descriptions: emptySpells.length, empty_magic_item_descriptions: emptyItems.length, results, live_state: { read_or_mutated: false } }, { status: passed === results.length ? 200 : 500 });
  } catch (error) {
    return Response.json({ error: error.message || 'Spell data-quality regression failed', all_pass: false }, { status: 500 });
  }
}