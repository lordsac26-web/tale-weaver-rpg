import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const characterId = '6a6825cd07a490fa70a46852';
  const character = await base44.asServiceRole.entities.Character.get(characterId);
  if (!character || character.name !== "Craig's Ranger") return Response.json({ error: 'Scoped character not found' }, { status: 404 });
  const blocked = new Set(['silenced', 'none']);
  const before = Array.isArray(character.conditions) ? character.conditions : [];
  const after = before.filter(c => !blocked.has(String(typeof c === 'string' ? c : c?.name || '').trim().toLowerCase()));
  if (JSON.stringify(before) !== JSON.stringify(after)) await base44.asServiceRole.entities.Character.update(characterId, { conditions: after });
  return Response.json({ success: true, character_id: characterId, removed: before.length - after.length, conditions: after });
});
