import { reconcileStorySession, finishPendingStoryCommit, STORY_COMMIT_RECOVERY_VERSION } from '../story/storyCommitRecovery.ts';
import { confirmPersistedStoryPair } from '../story/storyPersistence.ts';
import { canonicalStoryResponsePayload, hashStoryValue, acceptSequencedStoryPayload } from '../story/storyTransition.ts';
import { resolveUnifiedStorySkillCheck } from '../story/unifiedStorySkillResolution.ts';
import { guardPlayerFacingStoryText } from '../story/playerFacingTextGuard.ts';
import { validatePlayerText } from '../story/playerText.ts';
import { routePlayerIntent, dispositionAuditApplies } from '../story/intentRouter.ts';
import { resolveStowResume } from '../story/stowResume.ts';
import { pendingCorpseReceipt } from '../story/pendingCorpseStow.ts';

const choices = ['Look at the doorway.', 'Listen to the corridor.', 'Examine the wall.', 'Wait beside the doorway.'].map(text => ({ text, action_type: 'utility' }));
const clone = value => structuredClone(value);
async function entry(requestId, { text = 'The route is inspected.', combat = false, plan = { before: {}, after: {} }, skill = null } = {}) {
  const value = { request_id: requestId, text, choices: combat ? choices.slice(0, 3) : clone(choices), mechanics_status: 'pending', transition_outcome: { combat_trigger: combat, enemies: combat ? [{ name: 'Guard', hp: 15, ac: 16 }] : [], hp_change: 0, xp_earned: 0 }, skill_check: skill, item_disposition_plan: { ok: true, plan: null }, mechanics_commit: { version: STORY_COMMIT_RECOVERY_VERSION, character_consequences: plan } };
  value.choice_evidence = { response_payload_hash: await hashStoryValue(canonicalStoryResponsePayload({ requestId, text, choices: value.choices, skillCheck: skill })) };
  return value;
}
function memory(session, character) {
  const records = { GameSession: clone(session), Character: clone(character) }, writes = { GameSession: 0, Character: 0 };
  const db = { entities: Object.fromEntries(Object.keys(records).map(name => [name, {
    async get(id) { if (records[name].id !== id) throw Error('Fixture scope mismatch'); return clone(records[name]); },
    async updateMany(query, update) {
      if (query.id !== records[name].id || (query.updated_date && query.updated_date !== records[name].updated_date)) return { matched_count: 0 };
      writes[name]++; records[name] = { ...records[name], ...clone(update.$set), updated_date: `fixture-${writes[name]}` };
      return { matched_count: 1 };
    },
  }])) };
  return { db, base44: { asServiceRole: db }, records, writes };
}
const character = () => ({ id: 'fixture-character', created_by_id: 'fixture-user', hp_current: 59, hp_max: 59, xp: 100, conditions: [], inventory: [], stowed_items: [], item_dispositions: [], updated_date: 'fixture-0' });
const session = entries => ({ id: 'fixture-session', character_id: 'fixture-character', story_log: entries, world_state: { __skill_check_receipts: [] }, updated_date: 'fixture-0', in_combat: false });

export default async function storyCommitRecoveryFixtures() {
  const results = [];
  const check = (name, pass) => results.push({ name, pass: !!pass });
  const plan = { before: { hp_current: 59, xp: 100, conditions: [] }, after: { hp_current: 54, xp: 125, conditions: [{ name: 'Prone', source: 'story' }] } };
  const pending = await entry('interrupted', { plan });
  const m = memory(session([pending]), character());
  const first = await reconcileStorySession({ base44: m.base44, sessionId: 'fixture-session' });
  check('mid-commit failure auto-recovers on next request', !first.blocked && first.session.story_log[0].mechanics_status === 'complete');
  check('missing HP XP and conditions finish exactly once', m.records.Character.hp_current === 54 && m.records.Character.xp === 125 && m.writes.Character === 1);
  const completedBytes = JSON.stringify(m.records), writes = { ...m.writes };
  const second = await reconcileStorySession({ base44: m.base44, sessionId: 'fixture-session' });
  check('guard cannot fire twice for the same recovered request', !second.blocked && !second.recovery && JSON.stringify(m.records) === completedBytes);
  check('second recovery makes zero writes', JSON.stringify(writes) === JSON.stringify(m.writes));
  const mid = memory(session([pending]), { ...character(), ...plan.after });
  const resumed = await reconcileStorySession({ base44: mid.base44, sessionId: 'fixture-session' });
  check('failure after character write does not duplicate damage XP or conditions', !resumed.blocked && mid.writes.Character === 0 && mid.records.Character.hp_current === 54);
  const combat = memory(session([await entry('combat-three', { combat: true })]), character());
  const combatRecovered = await reconcileStorySession({ base44: combat.base44, sessionId: 'fixture-session' });
  const confirmed = await confirmPersistedStoryPair({ readSession: () => combat.db.entities.GameSession.get('fixture-session'), requestId: 'combat-three' });
  check('three-choice combat handoff commits and confirms', !combatRecovered.blocked && confirmed.status === 200);
  check('combat handoff accepted by story response contract', acceptSequencedStoryPayload(confirmed.body, 1, 1).accepted);
  check('combat handoff recovery does not reroll skill or alter character', combat.writes.Character === 0 && confirmed.body.combat_trigger === true);
  const source = await entry('source'); source.mechanics_status = 'complete';
  const next = await entry('next'); next.mechanics_status = 'complete';
  const orphan = { request_id: 'retired-orphan', source_story_request_id: 'source', action_text: 'stow the corpses in the bag of holding', skill: 'Stealth', dc: 12, raw_d20: 19, final_total: 23, success: true, unified_story_skill_resolution: true };
  const o = memory({ ...session([source, next]), world_state: { __skill_check_receipts: [orphan] } }, character());
  const retired = await reconcileStorySession({ base44: o.base44, sessionId: 'fixture-session' });
  check('orphan is removed from resumable receipts', !retired.blocked && o.records.GameSession.world_state.__skill_check_receipts.length === 0);
  const savedRetired = o.records.GameSession.world_state.__orphan_skill_receipts[0];
  check('retirement keeps superseded non-resolving provenance', savedRetired.superseded === true && savedRetired.non_resolving === true);
  let rolls = 0;
  const retry = await resolveUnifiedStorySkillCheck({ db: o.db, user: { id: 'fixture-user' }, payload: { session_id: 'fixture-session', character_id: 'fixture-character', request_id: orphan.request_id, action_text: 'Inspect the wall', skill: 'Perception', dc: 12 }, rollD20Fn: () => { rolls++; return 20; } });
  check('orphan request cannot be rerolled or resumed', retry.status === 409 && retry.body.error_code === 'receipt_superseded' && rolls === 0);
  o.records.GameSession.world_state.__orphan_skill_receipts = [];
  const evicted = await resolveUnifiedStorySkillCheck({ db: o.db, user: { id: 'fixture-user' }, payload: { session_id: 'fixture-session', character_id: 'fixture-character', request_id: orphan.request_id }, rollD20Fn: () => { rolls++; return 20; } });
  check('compact tombstone remains terminal after detailed ledger pruning', evicted.body.error_code === 'receipt_superseded' && rolls === 0);
  const retiredStowSession = { ...session([source]), world_state: { __skill_check_receipts: [{ ...orphan, superseded: true, non_resolving: true }] } };
  check('all corpse stow resume paths reject retired receipts', !resolveStowResume({ session: retiredStowSession, character: character(), actionText: orphan.action_text }) && !pendingCorpseReceipt(retiredStowSession, character()));
  const conflict = memory(session([pending]), { ...character(), hp_current: 40 });
  const unsafe = await reconcileStorySession({ base44: conflict.base44, sessionId: 'fixture-session' });
  check('unrelated character changes are not overwritten', unsafe.blocked?.body.recovery_available === true && conflict.writes.Character === 0 && conflict.records.Character.hp_current === 40);
  const corruptEntry = await entry('corrupt'); corruptEntry.text = 'Changed after hashing.';
  const corrupt = memory(session([corruptEntry]), character());
  const bad = await reconcileStorySession({ base44: corrupt.base44, sessionId: 'fixture-session' });
  check('hash mismatch refuses replay and offers explicit recovery control', bad.blocked?.body.recovery_available === true && corrupt.writes.Character === 0 && corrupt.writes.GameSession === 0);
  for (const dialogue of ['You write "You were warned" on the wall.', 'You say, “I warned you.”', "The guard says, 'Don't touch the Magistrate’s door.'"]) {
    const guarded = guardPlayerFacingStoryText({ narrative: dialogue, choices });
    const id = `quoted-${results.length}`;
    const quoted = memory(session([await entry(id, { text: guarded.result.narrative })]), character());
    const saved = await finishPendingStoryCommit({ base44: quoted.base44, sessionId: 'fixture-session', requestId: id });
    check(`quoted dialogue commits unchanged: ${dialogue}`, validatePlayerText(dialogue).ok && guarded.repairs.length === 0 && saved.status === 200 && saved.body.narrative === dialogue);
  }
  const writing = routePlayerIntent({ actionText: 'scrawl on the wall in theives cant "You were warned"' });
  check('original wall scrawl bypasses disposal audit', writing.pipeline === 'narrative' && !dispositionAuditApplies(writing));
  return { all_pass: results.every(result => result.pass), passed: results.filter(result => result.pass).length, failed: results.filter(result => !result.pass).length, total: results.length, results, live_data_touched: false };
}