import { characterBelongsToUser } from '../combat/authGuard.ts';
import { resolveStorySkillCheck } from './storySkillCheck.ts';

const rollD20 = () => {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return (bytes[0] % 20) + 1;
};

const canonicalReceipt = (receipt) => ({
  ...receipt,
  resolution_id: receipt.resolution_id || `story-skill:${receipt.request_id}`,
  unified_story_skill_resolution: true,
});

export const resolutionFromReceipt = (receipt, replayed = false) => {
  const canonical = canonicalReceipt(receipt);
  return Object.freeze({
    ok: true,
    skill: canonical.skill,
    dc: Number(canonical.dc),
    raw: Number(canonical.raw_d20),
    all_rolls: canonical.all_rolls || [Number(canonical.raw_d20)],
    modifier: Number(canonical.modifier_total),
    final: Number(canonical.final_total),
    success: canonical.success === true,
    breakdown: canonical.modifier_breakdown,
    receipt: canonical,
    branch: canonical.success === true ? 'success' : 'failure',
    replayed,
  });
};

export async function resolveUnifiedStorySkillCheck({ db, user, payload }) {
  const sessionId = payload?.session_id;
  const characterId = payload?.character_id;
  const requestId = String(payload?.request_id || '').trim().slice(0, 120);
  if (!sessionId || !characterId || !requestId) return { status: 400, body: { error: 'session_id, character_id, and request_id are required', writes: 0 } };
  const [session, character] = await Promise.all([
    db.entities.GameSession.get(sessionId).catch(() => null),
    db.entities.Character.get(characterId).catch(() => null),
  ]);
  if (!session || !character || session.character_id !== character.id || (user && !characterBelongsToUser(character, user))) {
    return { status: 403, body: { error: 'Character and session linkage is invalid', writes: 0 } };
  }
  const receipts = Array.isArray(session.world_state?.__skill_check_receipts) ? session.world_state.__skill_check_receipts : [];
  const prior = receipts.find((entry) => entry?.request_id === requestId && entry?.unified_story_skill_resolution === true);
  if (prior) {
    if (String(prior.skill) !== String(payload.skill) || Number(prior.dc) !== Number(payload.dc)) return { status: 409, body: { error: 'Idempotent skill-check request conflicts with its stored resolution', writes: 0 } };
    return { status: 200, body: { ...resolutionFromReceipt(prior, true), writes: 0, already_processed: true } };
  }
  const preview = resolveStorySkillCheck({ character, session, skill: payload.skill, dc: payload.dc, requestId });
  if (!preview.ok) return { status: 409, body: { error: preview.error, breakdown: preview.breakdown, writes: 0 } };
  if (payload.prepare_only === true) return { status: 200, body: { ...preview, writes: 0, prepared: true } };

  const hasAdvantage = payload.advantage === true && payload.disadvantage !== true;
  const hasDisadvantage = payload.disadvantage === true && payload.advantage !== true;
  const serverRolls = payload.raw_d20 == null ? Array.from({ length: hasAdvantage || hasDisadvantage ? 2 : 1 }, () => {
    const first = rollD20();
    return payload.lucky_reroll === true && first === 1 ? rollD20() : first;
  }) : null;
  const raw = payload.raw_d20 == null ? (hasAdvantage ? Math.max(...serverRolls) : hasDisadvantage ? Math.min(...serverRolls) : serverRolls[0]) : Number(payload.raw_d20);
  const allRolls = Array.isArray(payload.all_rolls) && payload.all_rolls.length ? payload.all_rolls : (serverRolls || [raw]);
  const resolved = resolveStorySkillCheck({ character, session, skill: payload.skill, dc: payload.dc, requestId, raw, allRolls, advantageSources: payload.advantage_sources || [] });
  if (!resolved.ok) return { status: 409, body: { error: resolved.error, breakdown: resolved.breakdown, writes: 0 } };
  const receipt = canonicalReceipt({ ...resolved.receipt, had_advantage: hasAdvantage, had_disadvantage: hasDisadvantage, roll_origin: payload.raw_d20 == null ? 'server' : 'reused' });
  const immutable = resolutionFromReceipt(receipt);
  const nextReceipts = [...receipts.filter((entry) => entry?.request_id !== requestId).slice(-49), receipt];
  await db.entities.GameSession.update(sessionId, { world_state: { ...(session.world_state || {}), __skill_check_receipts: nextReceipts } });
  return { status: 200, body: { ...immutable, writes: 1, already_processed: false } };
}