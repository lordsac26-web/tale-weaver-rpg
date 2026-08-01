import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
Deno.serve(async (req) => {
 try {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  if (body.action === 'setup') {
    const c = await base44.asServiceRole.entities.Character.create({
      name: 'QA Long Rest Conditions', class: 'Ranger', race: 'Human', level: 5,
      hp_current: 1, hp_max: 44, armor_class: 16, constitution: 14,
      spell_slots: { level_1: 3, level_2: 2 }, hit_dice_remaining: 1,
      conditions: [
        { name: 'Frostbitten Fingers', source: 'story', duration: 'scene' },
        { name: 'Exhausted', source: 'story', duration: 'persistent' },
        { name: 'Persistent Curse', source: 'story', duration: 'persistent' }
      ], exhaustion_level: 1,
    });
    return Response.json({ success: true, character_id: c.id });
  }
  if (body.action === 'cleanup') {
    const c = await base44.asServiceRole.entities.Character.get(body.character_id).catch(() => null);
    if (c?.name === 'QA Long Rest Conditions') await base44.asServiceRole.entities.Character.delete(c.id);
    return Response.json({ success: true });
  }
  if (body.action === 'repair_current') {
    const id = '6a6825cd07a490fa70a46852';
    const c = await base44.asServiceRole.entities.Character.get(id);
    if (!c || c.name !== "Craig's Ranger") return Response.json({ error: 'Scoped character not found' }, { status: 404 });
    const before = Array.isArray(c.conditions) ? c.conditions : [];
    const after = before.filter(condition => {
      const key = String(typeof condition === 'string' ? condition : condition?.name || '').trim().toLowerCase();
      const duration = typeof condition === 'object' ? String(condition?.duration || '').toLowerCase() : '';
      return !['scene','combat','rest','short_rest','long_rest'].includes(duration) && key !== 'exhausted' && key !== 'exhaustion';
    });
    if (JSON.stringify(before) !== JSON.stringify(after)) await base44.asServiceRole.entities.Character.update(id, { conditions: after });
    return Response.json({ success: true, removed: before.length - after.length, conditions: after });
  }
  return Response.json({ error: 'Invalid action' }, { status: 400 });
 } catch (error) { return Response.json({ error: error.message, stack: error.stack }, { status: 500 }); }
});
