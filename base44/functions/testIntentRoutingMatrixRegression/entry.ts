import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { routePlayerIntent, dispositionAuditApplies, PLAYER_FACING_UNSAVED_ACTION, INTENT_ROUTER_VERSION } from '../../shared/story/intentRouter.ts';
import { classifyExplicitAttackIntent } from '../../shared/story/explicitAttackTransition.ts';
import { isCompletedCombatAftermath } from '../../shared/story/completedCombatContext.ts';

// Oct 31: an explicit attack was resolved as an Athletics check, then audited by the
// possession-disposal validator, and the owner read internal evidence wording. Each
// hop was plausible alone; the defect was that no single component owned the routing
// decision. This matrix pins one pipeline per intent, keeps the disposal validator
// out of combat intents, and checks that no internal vocabulary can reach the player.
const SESSION = { story_log: [{ text: 'Two cultists circle the monolith, and the nearest one panics as the hum breaks.' }], world_state: { scene_entities: [] } };
const route = (actionText) => routePlayerIntent({ actionText, session: SESSION, attackIntent: classifyExplicitAttackIntent({ actionText, session: SESSION }) });
const INTERNAL_TERMS = ['owned item', 'exact narration quote', 'item_ref', 'catalogue', 'catalog', 'validator', 'pipeline', 'receipt', 'disposition'];

export default async function testIntentRoutingMatrixRegression(req) {
  try {
    const base44 = createClientFromRequest(req); const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
    await req.json().catch(() => ({}));
    const results = []; const record = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });

    // ---- E. Routing matrix: exactly one correct pipeline per intent.
    const matrix = [
      ['attack the nearest cultist as he panics', 'combat_attack'],
      ['attack the cultists and put them down', 'combat_attack'],
      ['throw my dagger at the cultist', 'thrown_weapon'],
      ['cast silence on the ritualist', 'spell'],
      ['shove the cultist off the ledge', 'shove'],
      ['put the ironwood tuning fork in my bag', 'stow'],
      ['drop my shortsword', 'dispose'],
      ['look around the node', 'narrative'],
    ];
    for (const [text, expected] of matrix) {
      const routed = route(text);
      record(`routes to ${expected}: "${text.slice(0, 42)}"`, routed.pipeline === expected, JSON.stringify(routed));
    }
    record('every route is versioned', matrix.every(([text]) => route(text).version === INTENT_ROUTER_VERSION));
    record('an explicit attack outranks verbs that could reclassify it', route('attack the cultist and put him down').pipeline === 'combat_attack');

    // ---- B. Validator isolation: unreachable from every combat intent.
    const combatRoutes = matrix.filter(([, pipeline]) => ['combat_attack', 'thrown_weapon', 'spell', 'shove'].includes(pipeline)).map(([text]) => route(text));
    record('disposal validator never applies to a combat intent', combatRoutes.every((routed) => dispositionAuditApplies(routed) === false));
    record('disposal validator still applies to stow, dispose and prose turns', ['stow', 'dispose', 'narrative'].every((pipeline) => dispositionAuditApplies({ pipeline }) === true));

    // ---- Root cause: a stale victory must not stay "the current combat".
    const stale = isCompletedCombatAftermath({ session: { story_log: [{ timestamp: '2026-10-31T16:58:38.766Z', text: 'later turn' }] }, context: { ended_at: '2026-10-11T22:34:26.226Z' } });
    const fresh = isCompletedCombatAftermath({ session: { story_log: [] }, context: { ended_at: '2026-10-31T17:20:00.000Z' } });
    const immediate = isCompletedCombatAftermath({ session: { story_log: [{ timestamp: '2026-10-31T17:21:00.000Z', text: 'the blow lands' }] }, context: { ended_at: '2026-10-31T17:20:00.000Z' } });
    const undated = isCompletedCombatAftermath({ session: { story_log: [{ timestamp: '2026-10-31T17:21:00.000Z' }] }, context: {} });
    record('a victory eleven days old is not the current aftermath', stale === false);
    record('the turn right after a fight is its aftermath', fresh === true && immediate === true);
    record('an undated combat cannot claim to be current', undated === false);

    // ---- C. Error hygiene.
    record('player-facing error carries no internal validator vocabulary', !INTERNAL_TERMS.some((term) => PLAYER_FACING_UNSAVED_ACTION.toLowerCase().includes(term)), PLAYER_FACING_UNSAVED_ACTION);
    record('player-facing error is actionable and states nothing was written', /^Nothing was written/.test(PLAYER_FACING_UNSAVED_ACTION) && /Try describing it a different way/.test(PLAYER_FACING_UNSAVED_ACTION));

    // ---- D. The live session is coherent: one orphan receipt, no invented damage.
    const session = await base44.asServiceRole.entities.GameSession.get('6a6825edd695bd65a4322256');
    const receipts = session?.world_state?.__skill_check_receipts || [];
    const orphans = session?.world_state?.__orphan_skill_receipts || [];
    const athletics = [...receipts, ...orphans].filter((entry) => entry?.skill === 'Athletics' && /attack the nearest cultist/i.test(String(entry?.action_text || '')));
    record('the misrouted roll is recorded exactly once', athletics.length === 1);
    record('the misrouted roll was never consumed by a story turn', !(session?.story_log || []).some((entry) => entry?.request_id === athletics[0]?.request_id));
    record('it is retired and cannot replay as a later check', orphans.some((entry) => entry?.request_id === athletics[0]?.request_id) && !receipts.some((entry) => entry?.request_id === athletics[0]?.request_id));
    record('no story entry was left half-committed', (session?.story_log || []).every((entry) => entry?.mechanics_status === 'complete'));
    record('no combat was fabricated by the failure', session?.in_combat !== true);
    const combats = await base44.asServiceRole.entities.CombatLog.filter({ session_id: '6a6825edd695bd65a4322256' }, '-created_date', 1);
    const lastEntryAt = Date.parse(String(session?.story_log?.at(-1)?.timestamp || '')) || 0;
    record('no CombatLog was created after the failure point', !combats[0] || (Date.parse(String(combats[0].created_date || '')) || 0) <= lastEntryAt);

    const passed = results.filter((item) => item.pass).length, allPass = passed === results.length;
    return Response.json({ function_version: 'test-intent-routing-matrix-v1.0.0', intent_router_version: INTENT_ROUTER_VERSION, passed, failed: results.length - passed, total: results.length, all_pass: allPass, results }, { status: allPass ? 200 : 500 });
  } catch (error) { return Response.json({ error: error.message || 'Intent routing matrix failed' }, { status: 500 }); }
}