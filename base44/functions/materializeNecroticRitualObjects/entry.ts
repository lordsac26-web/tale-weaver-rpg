import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { evidenceEntries, materializeSceneCandidates } from '../../shared/story/sceneEvidence.ts';
import { buildGroundedContext } from '../../shared/story/groundedSceneContext.ts';
import { resolveGroundedAction } from '../../shared/story/groundedAction.ts';

/**
 * Owner-authorized materialization of the final-necrosis ritual set, Oct 31.
 *
 * The narration established an ironwood tuning fork in the character's belt and a
 * hairline fracture in the monolith base, but neither was ever materialized, so the
 * player's own action ("place the ironwood tuning fork into the crack") could only
 * ever return a clarification naming unrelated objects. This rebuilds both from the
 * exact establishing sentences, idempotently, and then proves the action resolves.
 */

const FORK_NAME = 'Ironwood Tuning Fork';
const FORK_QUOTE = 'the final ironwood tuning fork in your belt pulses with a rhythmic, low-frequency warmth';
const FORK_REQUEST = 'story-choice:6a6825edd695bd65a4322256:ca5208ba-66c6-4d16-8631-3fc378cb2a23';
const CRACK_NAME = 'Hairline Fracture in the Obsidian Base';
const CRACK_QUOTE = 'you spot a hairline fracture along the base of the monolith';
const CRACK_ALIASES = ['hairline fracture'];
const CRACK_PLAYER_ALIASES = ['crack', 'fracture', 'wedge', 'seam'];
const ACTION = 'stealthily place the ironwood tuning fork into the crack and move back to cover';
const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export default async function materializeNecroticRitualObjects(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await req.json().catch(() => ({}));
    const characterId = payload.character_id || '6a6825cd07a490fa70a46852';
    const apply = payload.dry_run !== true;

    const character = await base44.asServiceRole.entities.Character.get(characterId);
    if (!character) return Response.json({ error: 'Character not found' }, { status: 404 });
    const session = await base44.asServiceRole.entities.GameSession.get(characterId === character.id ? (payload.session_id || (await base44.asServiceRole.entities.GameSession.filter({ character_id: character.id }, '-updated_date', 1))[0]?.id) : payload.session_id);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    // ---- A1. The carried tuning fork, provenanced to the sentence that created it.
    const forkPresent = [...(character.inventory || []), ...(character.stowed_items || [])].some((item) => norm(item?.name) === norm(FORK_NAME));
    const inventory = [...(character.inventory || [])];
    if (!forkPresent) inventory.push({
      name: FORK_NAME, quantity: 1, category: 'Wondrous Item', is_identified: true,
      description: 'The last ironwood tuning fork of the ritual set. It hums in sympathetic vibration with the final necrotic nexus and can be set into the hairline fracture in the obsidian base to invert the ritual flow.',
      provenance: { source: 'story_narration', request_id: FORK_REQUEST, quote: FORK_QUOTE, materialized_at: new Date().toISOString(), authorization: 'owner_authorized_2026_10_31' },
    });

    // ---- A2. The fracture, projected through the canonical validator so it survives
    // every later reconciliation instead of being re-derivable-only.
    const structured = [...(session.world_state?.scene_entities || []), ...inventory];
    const existing = (session.world_state?.scene_entities || []).find((entity) => norm(entity?.source_name || entity?.name) === norm(CRACK_NAME) || norm(entity?.name) === norm('hairline fracture'));
    let crackEntity = existing || null;
    const rejected = [];
    if (!crackEntity) {
      for (const entry of [...evidenceEntries(session)].reverse()) {
        if (!String(entry.text || '').includes(CRACK_QUOTE)) continue;
        const projection = await materializeSceneCandidates({ session, entry, structured, newlyGenerated: true, candidates: [{ name: CRACK_NAME, aliases: CRACK_ALIASES, type: 'container', quantity: 1, status: 'alive', source_request_id: entry.request_id, quote: CRACK_QUOTE }] });
        rejected.push(...projection.rejected);
        if (projection.accepted.length) { crackEntity = { ...projection.accepted[0], player_aliases: CRACK_PLAYER_ALIASES, affordances: ['inspect', 'stow', 'drop'] }; break; }
      }
    }
    const sceneEntities = crackEntity && !existing
      ? [...(session.world_state?.scene_entities || []), crackEntity]
      : (session.world_state?.scene_entities || []);

    const writes = [];
    if (apply && !forkPresent) { await base44.asServiceRole.entities.Character.update(character.id, { inventory }); writes.push('character.inventory+=Ironwood Tuning Fork'); }
    if (apply && crackEntity && !existing) { await base44.asServiceRole.entities.GameSession.update(session.id, { world_state: { ...(session.world_state || {}), scene_entities: sceneEntities } }); writes.push('session.world_state.scene_entities+=Hairline Fracture'); }

    // ---- A3/A4. Audit the rest of the ritual set + prove the owner's action resolves.
    const refreshedCharacter = await base44.asServiceRole.entities.Character.get(character.id);
    const refreshedSession = await base44.asServiceRole.entities.GameSession.get(session.id);
    const forkAfter = [...(refreshedCharacter.inventory || []), ...(refreshedCharacter.stowed_items || [])].find((item) => norm(item?.name) === norm(FORK_NAME));
    const crackAfter = (refreshedSession.world_state?.scene_entities || []).find((entity) => norm(entity?.source_name || entity?.name) === norm(CRACK_NAME));
    const placedForkMentions = (refreshedSession.story_log || []).filter((entry) => /tuning fork/i.test(String(entry.text || '')) && !String(entry.text || '').includes(FORK_QUOTE)).length;

    let verification = null;
    try {
      const grounded = await resolveGroundedAction({ base44, session: refreshedSession, character: refreshedCharacter, actionText: ACTION });
      verification = grounded?.handled ? {
        clarification_required: !!grounded.clarification_required,
        reasoning: grounded.reasoning,
        intent: grounded.grounded_action?.intent,
        targets: (grounded.grounded_action?.targets || []).map((target) => target.display_name || target.name),
        destination: grounded.grounded_action?.destination || null,
        offers: (grounded.clarification_options || []).map((option) => option.name),
      } : { handled: false };
    } catch (error) { verification = { error: error.message }; }

    return Response.json({
      function_version: 'materialize-necrotic-ritual-objects-v1.0.0',
      applied: apply, writes,
      fork: { present: !!forkAfter, name: forkAfter?.name || null, quantity: forkAfter?.quantity || 0, provenance: forkAfter?.provenance || null },
      crack: crackEntity ? { id: crackEntity.id, name: crackEntity.name, type: crackEntity.type, aliases: crackEntity.aliases, player_aliases: crackEntity.player_aliases || [], evidence_quote: crackEntity.evidence?.quote || null } : { missing: true, rejected },
      audit: { nexus_entities: (refreshedSession.world_state?.scene_entities || []).map((entity) => ({ name: entity.name, type: entity.type, status: entity.status })), other_tuning_fork_mentions: placedForkMentions, note: 'Forks already spent at the first two harmonic nodes are in scenes the character has left; they are not interactables here and were not fabricated into this scene.' },
      verification,
      scene_revision: (await buildGroundedContext({ base44, session: refreshedSession, character: refreshedCharacter })).revision,
    });
  } catch (error) { return Response.json({ error: error.message || 'Materialization failed' }, { status: 500 }); }
}