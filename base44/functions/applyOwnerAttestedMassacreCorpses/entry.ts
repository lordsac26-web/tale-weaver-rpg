import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { hashStoryValue } from '../../shared/story/storyTransition.ts';
import { characterBelongsToUser } from '../../shared/combat/authGuard.ts';
import { reconcileOwnerCultistScene } from '../../shared/repairs/ownerCultistScene.ts';

/**
 * Owner-attested scene repair.
 *
 * The Oct 31 massacre entry narrated three cultist deaths from an arrow volley but
 * was committed with no scene entities, so the bodies existed only as prose. The
 * strict narration validator correctly refuses to mint corpses from an
 * attack-shaped span with no mechanical receipt; the owner has authorized recording
 * these specific bodies by attestation instead. Entity shape, id scheme, evidence
 * and death provenance match what materializeSceneCandidates produces, so every
 * reader (corpse discovery, stow, grounding) treats them as ordinary narrated remains.
 *
 * Writes nothing when the narration no longer establishes the deaths, and nothing on
 * a second run.
 */
export const OWNER_ATTESTED_MASSACRE_VERSION = 'owner-attested-massacre-corpses-v1.0.0';
const SESSION_ID = '6a6825edd695bd65a4322256';
const STORY_REQUEST_ID = 'story-action:6a6825edd695bd65a4322256:1793153866100:r3qi7m';
const CORPSE_COUNT = 3;
const CORPSE_NAME = 'Obsidian Circle Cultist';

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await base44.asServiceRole.entities.GameSession.get(SESSION_ID);
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
  const character = await base44.asServiceRole.entities.Character.get(session.character_id);
  if (!characterBelongsToUser(character, user)) return Response.json({ error: 'This scene belongs to another character owner.', writes: 0 }, { status: 403 });
  const payload = await req.json().catch(() => ({}));
  if (payload.reconcile_current_scene === true) {
    const outcome = await reconcileOwnerCultistScene({ base44, session, user, apply: payload.apply === true });
    return Response.json(outcome.body, { status: outcome.status });
  }
  const entry = (session.story_log || []).find((item) => item?.request_id === STORY_REQUEST_ID);
  if (!entry?.text) return Response.json({ error: 'The massacre story entry was not found; nothing written.', writes: 0 }, { status: 404 });

  // Attestation guard: the narration must still establish the volley, the count and
  // the bodies. If any of that has changed, refuse rather than invent remains.
  const sentences = String(entry.text).split(/(?<=[.!?])\s+/);
  const deathSentence = sentences.find((line) => /mowed down/i.test(line)) || '';
  const bodiesSentence = sentences.find((line) => /bodies slump/i.test(line)) || '';
  const establishes = /three arrows/i.test(entry.text) && !!deathSentence && !!bodiesSentence && /\bcultists\b/i.test(deathSentence);
  if (!establishes) return Response.json({ error: 'The narration no longer establishes three cultist deaths; refusing to record bodies.', writes: 0 }, { status: 409 });

  const sourceHash = await hashStoryValue(entry.text);
  const spanStart = entry.text.indexOf(deathSentence);
  const spanEnd = spanStart + deathSentence.length;
  const stem = `scene:${(await hashStoryValue([session.id, STORY_REQUEST_ID, spanStart, spanEnd, 'corpse', CORPSE_NAME.toLowerCase()])).slice(0, 24)}`;
  const location = entry.scene_location || session.current_location || '';
  const existing = Array.isArray(session.world_state?.scene_entities) ? session.world_state.scene_entities : [];

  const additions = [];
  for (let ordinal = 1; ordinal <= CORPSE_COUNT; ordinal++) {
    const id = `${stem}:${ordinal}`;
    if (existing.some((entity) => entity?.id === id)) continue;
    additions.push({
      id,
      session_id: session.id,
      source_request_id: STORY_REQUEST_ID,
      location,
      name: `${CORPSE_NAME} ${ordinal}`,
      aliases: [CORPSE_NAME, 'cultist', 'cultists', 'Obsidian Circle Cultist'],
      type: 'corpse',
      quantity: 1,
      source_quantity: CORPSE_COUNT,
      source_name: CORPSE_NAME,
      source_ordinal: ordinal,
      status: 'dead',
      transfer_state: 'world',
      affordances: ['inspect', 'stow'],
      alive: false,
      evidence: {
        authority: 'owner_attested_dm_narration',
        narrative_derived: true,
        source_request_id: STORY_REQUEST_ID,
        source_hash: sourceHash,
        quote: deathSentence,
        supporting_quote: bodiesSentence,
        span_start: spanStart,
        span_end: spanEnd,
        attestation: { by: user.email, at: new Date().toISOString(), version: OWNER_ATTESTED_MASSACRE_VERSION },
      },
      death_provenance: {
        source: 'narrative_derived',
        scene_entity_id: id,
        source_request_id: STORY_REQUEST_ID,
        source_hash: sourceHash,
        quote: deathSentence,
        span_start: spanStart,
        span_end: spanEnd,
        status: 'dead',
        enemy_name: CORPSE_NAME,
        evidence_kind: 'narrated_arrow_volley',
      },
    });
  }

  if (!additions.length) {
    return Response.json({ applied: false, already_processed: true, version: OWNER_ATTESTED_MASSACRE_VERSION, existing_ids: existing.filter((entity) => String(entity?.source_request_id) === STORY_REQUEST_ID).map((entity) => entity.id) });
  }

  const worldState = session.world_state || {};
  await base44.asServiceRole.entities.GameSession.update(SESSION_ID, {
    world_state: {
      ...worldState,
      scene_entities: [...existing, ...additions],
      __owner_attested_entity_receipts: [
        ...(Array.isArray(worldState.__owner_attested_entity_receipts) ? worldState.__owner_attested_entity_receipts : []),
        {
          version: OWNER_ATTESTED_MASSACRE_VERSION,
          at: new Date().toISOString(),
          attested_by: user.email,
          story_request_id: STORY_REQUEST_ID,
          count: additions.length,
          ids: additions.map((entity) => entity.id),
          location,
          reason: 'Narration established three cultist deaths from an arrow volley with no mechanical receipt; owner authorized recording the bodies as searchable, stowable remains.',
        },
      ],
    },
  });

  const written = await base44.asServiceRole.entities.GameSession.get(SESSION_ID);
  const registry = (written?.world_state?.scene_entities || []).filter((entity) => String(entity?.source_request_id) === STORY_REQUEST_ID);
  return Response.json({
    applied: true,
    version: OWNER_ATTESTED_MASSACRE_VERSION,
    count: registry.length,
    location,
    corpses: registry.map((entity) => ({ id: entity.id, name: entity.name, status: entity.status, type: entity.type, transfer_state: entity.transfer_state, alive: entity.alive, province_source: entity.death_provenance?.source })),
  });
}