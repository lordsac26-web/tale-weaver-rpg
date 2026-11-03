const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Both images are durable before any Character write. A retry sets absolute
// targets, never adds HP/XP twice, and never overwrites an unrelated change.
export async function commitStoryConsequencePlan({ db, characterId, plan }) {
  if (!plan || !plan.before || !plan.after) return { ok: false, reason: 'missing_character_consequence_plan' };
  const keys = Object.keys(plan.after);
  if (!keys.length) return { ok: true, writes: 0 };
  let character = await db.entities.Character.get(characterId);
  if (keys.every(key => same(character[key], plan.after[key]))) return { ok: true, writes: 0, already_processed: true };
  if (!keys.every(key => same(character[key], plan.before[key]))) return { ok: false, reason: 'character_consequence_conflict' };
  await db.entities.Character.updateMany({ id: characterId, updated_date: character.updated_date }, { $set: plan.after });
  character = await db.entities.Character.get(characterId);
  return { ok: keys.every(key => same(character[key], plan.after[key])), writes: 1, reason: 'character_consequence_unconfirmed' };
}