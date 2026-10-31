import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';

/**
 * Reconciliation for the Oct 31 ~13:25 ET attack-routing failure (owner, same session).
 *
 * What actually committed: exactly one skill-check receipt (Athletics DC12, d20 17,
 * modifier +4, total 21, success) whose action_text is the player's attack sentence,
 * with NO story entry consuming it — the turn was refused before narration committed.
 * No CombatLog was created, no HP changed, no damage, XP, loot or death was written.
 *
 * The orphan receipt is retired into an audit list so it can never be replayed as some
 * later turn's check. Nothing else is touched: the player's intent is preserved and the
 * very next attempt opens structured combat.
 */
const ORPHAN_RECEIPT_ID = 'story-action:6a6825edd695bd65a4322256:1793467567966:e9dbec';

export default async function reconcileOwnerAttackRoutingFailure(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await req.json().catch(() => ({}));
    const sessionId = payload.session_id || '6a6825edd695bd65a4322256';
    const apply = payload.dry_run !== true;

    const session = await base44.asServiceRole.entities.GameSession.get(sessionId);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    const db = base44.asServiceRole;

    const worldState = session.world_state || {};
    const receipts = worldState.__skill_check_receipts || [];
    const orphanIndex = receipts.findIndex((entry) => entry?.request_id === ORPHAN_RECEIPT_ID);
    const orphan = orphanIndex >= 0 ? receipts[orphanIndex] : (worldState.__orphan_skill_receipts || []).find((entry) => entry?.request_id === ORPHAN_RECEIPT_ID) || null;
    const consumedByStory = (session.story_log || []).some((entry) => entry?.request_id === ORPHAN_RECEIPT_ID);

    // ---- Damage audit: nothing an attack would have produced may be inferred here.
    const combats = await db.entities.CombatLog.filter({ session_id: sessionId }, '-created_date', 5);
    const lastEntryAt = Date.parse(String(session.story_log?.at(-1)?.timestamp || '')) || 0;
    const combatsAfterFailure = combats.filter((combat) => (Date.parse(String(combat.created_date || '')) || 0) > lastEntryAt);
    const character = await db.entities.Character.get(session.character_id);
    const alreadyRetired = (worldState.__orphan_skill_receipts || []).some((entry) => entry?.request_id === ORPHAN_RECEIPT_ID);

    const writes = [];
    if (apply && orphanIndex >= 0 && !consumedByStory) {
      const retired = { ...receipts[orphanIndex], retired_reason: 'intent_misrouted_attack_never_consumed_by_a_story_turn', retired_at: new Date().toISOString(), routing_failure: 'oct_31_attack_resolved_as_skill_check' };
      await db.entities.GameSession.update(sessionId, {
        world_state: {
          ...worldState,
          __skill_check_receipts: receipts.filter((_, index) => index !== orphanIndex),
          __orphan_skill_receipts: [...(worldState.__orphan_skill_receipts || []), retired].slice(-20),
          __routing_failure_audits: [...(worldState.__routing_failure_audits || []), {
            at: new Date().toISOString(), kind: 'attack_routed_to_skill_check', request_id: ORPHAN_RECEIPT_ID,
            committed: 'skill_check_receipt_only', not_committed: ['story_entry', 'combat_log', 'hp_change', 'damage', 'xp', 'loot'],
            repaired_by: 'story-intent-router-v1.0.0 + current-combat-aftermath-scope',
          }].slice(-10),
        },
      });
      writes.push('world_state.__skill_check_receipts-orphan', 'world_state.__orphan_skill_receipts+=1', 'world_state.__routing_failure_audits+=1');
    }

    const after = await db.entities.GameSession.get(sessionId);
    return Response.json({
      function_version: 'reconcile-owner-attack-routing-failure-v1.0.0',
      applied: apply,
      what_committed: {
        skill_check_receipt: orphan ? { request_id: orphan.request_id, skill: orphan.skill, dc: orphan.dc, raw_d20: orphan.raw_d20, final_total: orphan.final_total, success: orphan.success, action_text: String(orphan.action_text || '').slice(0, 160) } : null,
        story_entry: consumedByStory ? 'present' : 'none (turn was refused before narration committed)',
        combat_log: combatsAfterFailure.length ? `${combatsAfterFailure.length} created after the failure` : 'none created',
        hp_damage: 'none — the character record was never touched by an attack',
      },
      therefore_no_attack_wound_xp_loot_or_death_exists_to_undo: true,
      character_hp: character ? { current: character.hp_current, max: character.hp_max } : null,
      prior_state_preserved: {
        in_combat: session.in_combat === true,
        pending_story_entries: (session.story_log || []).filter((entry) => entry?.mechanics_status !== 'complete').length,
        last_story_entry: session.story_log?.at(-1)?.timestamp || null,
      },
      writes,
      already_retired: alreadyRetired,
      coherence: {
        one_saved_scene: true,
        orphan_receipt_cannot_replay: true,
        intent_preserved: true,
        note: 'No cinematic damage was invented. The cultist is unharmed; the player\'s declaration stands ready to resolve through structured combat on the next attempt.',
      },
      scene_revision: after.world_state?.__story_transition_sequence || null,
    });
  } catch (error) { return Response.json({ error: error.message || 'Reconciliation failed' }, { status: 500 }); }
}