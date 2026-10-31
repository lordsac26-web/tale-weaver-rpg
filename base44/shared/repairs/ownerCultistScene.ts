import { hashStoryValue } from '../story/storyTransition.ts';
import { preflightStoryAttack } from '../story/sceneCombatTargets.ts';

export const OWNER_CULTIST_SCENE_VERSION = 'owner-cultist-scene-v1.0.0';
const SESSION_ID = '6a6825edd695bd65a4322256';
const MASSACRE_ID = 'story-action:6a6825edd695bd65a4322256:1793153866100:r3qi7m';
const CURRENT_ID = 'story-action:6a6825edd695bd65a4322256:1793465914307:hwe07y';
const INDIVIDUAL_ID = 'story-action:6a6825edd695bd65a4322256:1793358524574:hl0v9m';
const ORPHAN_ID = 'story-action:6a6825edd695bd65a4322256:1793471048199:oikwkc';
const EXACT_ACTION = 'attack the closest cultist with my long bow';

// Specific owner-authorized reconciliation, not an encounter generator. The old
// massacre is at the Spire; the living acolyte is at the third node. Never merge them.
export async function reconcileOwnerCultistScene({ base44, session, user, apply }) {
  const refuse = error => ({ status: 409, body: { error, writes: 0 } });
  const latest = session.story_log?.at(-1);
  const individual = (session.story_log || []).find(entry => entry.request_id === INDIVIDUAL_ID);
  const massacre = (session.story_log || []).find(entry => entry.request_id === MASSACRE_ID);
  if (session.id !== SESSION_ID || latest?.request_id !== CURRENT_ID || latest.mechanics_status !== 'complete' || session.in_combat)
    return refuse('The authorized held scene changed; nothing reconciled.');
  const liveQuote = String(individual?.text || '').split(/(?<=[.!?])\s+/).find(line => /One acolyte, marked by a ragged strip of grey silk/.test(line));
  const panickedQuote = String(latest.text).split(/(?<=[.!?])\s+/).find(line => /acolytes scramble in sudden, panicked realization/.test(line));
  if (!liveQuote || !panickedQuote || individual.scene_location !== session.current_location || massacre?.scene_location === session.current_location)
    return refuse('The saved evidence does not separate this living acolyte from the historical massacre.');
  const registry = session.world_state?.scene_entities || [];
  const corpses = registry.filter(entity => entity.type === 'corpse' && entity.source_request_id === MASSACRE_ID);
  if (corpses.length !== 3 || corpses.some(entity => entity.status !== 'dead' || !entity.death_provenance?.source_hash))
    return refuse('The three authorized massacre corpse identities must be present before reconciliation.');
  const monsters = await base44.asServiceRole.entities.Monster.filter({ name: 'Cultist' }, '-created_date', 1);
  const monster = monsters[0];
  const action = String(monster?.actions || '');
  const hit = action.match(/\+(\d+) to hit/), damage = action.match(/\((\d+d\d+)\s*\+\s*(\d+)\)/);
  const hp = parseInt(monster?.hit_points), ac = parseInt(monster?.armor_class), dexterity = parseInt(monster?.dex);
  if (!monster || !hit || !damage || !(hp > 0 && ac > 0 && dexterity > 0)) return refuse('The canonical Cultist catalog stat block is incomplete.');
  const sourceHash = await hashStoryValue(individual.text);
  const id = `scene:${(await hashStoryValue([session.id, INDIVIDUAL_ID, 'grey-silk-acolyte'])).slice(0, 24)}:1`;
  const existing = registry.find(entity => entity.id === id);
  if (existing && (existing.status !== 'alive' || existing.alive === false)) return refuse('This individual is no longer alive; reconciliation will not resurrect it.');
  const cultist = existing || { id, session_id: session.id, location: session.current_location,
    source_request_id: INDIVIDUAL_ID, name: 'Grey-silk Obsidian Circle Cultist',
    aliases: ['cultist', 'cultists', 'acolyte', 'ritualist', 'grey-silk acolyte'], type: 'creature',
    quantity: 1, source_quantity: 1, source_name: 'Grey-silk Obsidian Circle Cultist', source_ordinal: 1,
    status: 'alive', alive: true, transfer_state: 'world', affordances: ['inspect', 'attack'],
    combat_stats: { hp, current_hp: hp, ac, attack_bonus: Number(hit[1]), damage_dice: damage[1], damage_bonus: Number(damage[2]), dexterity, cr: 0.125, xp: 25 },
    stat_provenance: { source: 'Monster', monster_id: monster.id, name: monster.name, version: OWNER_CULTIST_SCENE_VERSION },
    evidence: { authority: 'owner_attested_dm_narration', narrative_derived: true, source_request_id: INDIVIDUAL_ID,
      source_hash: sourceHash, quote: liveQuote, span_start: individual.text.indexOf(liveQuote), span_end: individual.text.indexOf(liveQuote) + liveQuote.length,
      current_source_request_id: CURRENT_ID, current_quote: panickedQuote,
      attestation: { by: user.id, at: new Date().toISOString(), version: OWNER_CULTIST_SCENE_VERSION } } };
  const defeated = corpses.map(entity => ({ ...entity, hp_current: 0,
    defeat_id: entity.defeat_id || `attested-defeat:${entity.id}`,
    original_creature_id: entity.original_creature_id || `attested-creature:${entity.id}`,
    death_provenance: { ...entity.death_provenance, hp: 0, defeat_id: entity.defeat_id || `attested-defeat:${entity.id}`,
      enemy_id: entity.original_creature_id || `attested-creature:${entity.id}` } }));
  const byId = new Map(registry.map(entity => [entity.id, entity]));
  defeated.forEach(entity => byId.set(entity.id, entity)); byId.set(cultist.id, cultist);
  const receipts = session.world_state?.__skill_check_receipts || [];
  const orphan = receipts.find(receipt => receipt.request_id === ORPHAN_ID);
  if ((session.story_log || []).some(entry => entry.request_id === ORPHAN_ID)) return refuse('The failed retest now has a story entry; do not retire it automatically.');
  const retired = orphan ? { ...orphan, superseded: true, non_resolving: true, retired_at: new Date().toISOString(), retired_reason: 'explicit_weapon_attack_misrouted_as_perception' } : null;
  const worldState = { ...session.world_state, scene_entities: [...byId.values()],
    __skill_check_receipts: receipts.map(receipt => receipt.request_id === ORPHAN_ID ? retired : receipt),
    __orphan_skill_receipts: retired ? [...(session.world_state?.__orphan_skill_receipts || []).filter(receipt => receipt.request_id !== ORPHAN_ID), retired] : session.world_state?.__orphan_skill_receipts || [],
    __defeat_receipts: (session.world_state?.__defeat_receipts || []).map(receipt => receipt.request_id === MASSACRE_ID ? { ...receipt, defeated_identities: defeated.map(entity => ({ enemy_id: entity.original_creature_id, corpse_id: entity.id, defeat_id: entity.defeat_id, hp: 0, status: 'dead' })) } : receipt),
  };
  const planned = { ...session, world_state: worldState };
  const preflight = preflightStoryAttack({ session: planned, actionText: EXACT_ACTION });
  if (preflight.status !== 200) return refuse('The reconciled scene cannot bind the exact attack declaration.');
  const previous = session.world_state?.__owner_cultist_scene_reconciliation;
  const already = previous?.version === OWNER_CULTIST_SCENE_VERSION && existing && corpses.every(entity => entity.defeat_id) && (!orphan || orphan.non_resolving === true);
  if (apply && !already) {
    const fresh = await base44.asServiceRole.entities.GameSession.get(session.id);
    if (fresh.updated_date !== session.updated_date) return refuse('The held scene changed during reconciliation; nothing written.');
    worldState.__owner_cultist_scene_reconciliation = { version: OWNER_CULTIST_SCENE_VERSION, at: new Date().toISOString(), by: user.id,
      living_ids: [cultist.id], corpse_ids: defeated.map(entity => entity.id), retired_request_id: retired?.request_id || null,
      source_request_id: CURRENT_ID, uncounted_group_not_expanded: true, no_combat_started: true, no_hp_xp_inventory_changes: true };
    await base44.asServiceRole.entities.GameSession.update(session.id, { world_state: worldState });
  }
  return { status: 200, body: { version: OWNER_CULTIST_SCENE_VERSION, applied: apply && !already, already_processed: !!already,
    writes: apply && !already ? 1 : 0, dry_run: !apply, live_target: { id: cultist.id, name: cultist.name, location: cultist.location, stats: cultist.combat_stats },
    historical_corpses: defeated.map(entity => ({ id: entity.id, defeat_id: entity.defeat_id, status: entity.status, location: entity.location })),
    retired_receipt: retired?.request_id || null, uncounted_group_not_expanded: true, combat_started: false,
    exact_action: EXACT_ACTION, preflight: preflight.body } };
}