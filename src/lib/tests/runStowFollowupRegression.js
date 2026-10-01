import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import createStowFollowupState from '@/lib/stowFollowupState';
import useStoryCustomAction from '@/components/game/useStoryCustomAction';
import StowClarificationCard from '@/components/game/StowClarificationCard';
import { createStowFollowupFixture, quotedStowReply } from '@/lib/tests/stowFollowupFixture';

export default async function runStowFollowupRegression(base44, modes = ['ai', 'player']) {
  const tracked = [], checks = [], cleanup = [];
  const check = (name, pass) => checks.push({ name, pass: !!pass });
  const stateHash = x => JSON.stringify(x), read = f => Promise.all([base44.entities.Character.get(f.characterId), base44.entities.GameSession.get(f.sessionId)]);
  try {
    for (const mode of modes) for (const variant of ['success', 'missing-death', 'narrative-only', 'already-stowed']) {
      const f = await createStowFollowupFixture(base44, mode, variant, tracked), before = await read(f);
      const calls = [], invoke = async payload => { calls.push(payload); return base44.functions.invoke('confirmStoryStowClarification', payload); };
      const values = new Map(), storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
      let visibleBag = null;
      const make = () => createStowFollowupState({ sessionId: f.sessionId, invoke, storage, onConfirmed: data => { visibleBag = data.character_stowed_items; } });
      const original = await base44.functions.invoke('generateStory', { session_id: f.sessionId, action: 'choice', request_id: f.requestId, custom_input: f.action, choice_context: { action_type: 'skill_check', check: f.receipt } });
      check(`${mode}/${variant}: real original dispatch gives zero-write linked clarification`, original.data.response_kind === 'clarification' && original.data.writes === 0 && original.data.check_receipt.request_id === f.requestId);
      const first = make(); first.install(original.data); first.setReply(quotedStowReply);
      const reloaded = make(); await reloaded.restore(f.characterId);
      check(`${mode}/${variant}: reload restores original roll, source, and quoted reply`, reloaded.getState().reply === quotedStowReply && reloaded.getState().original.requested_request_id === f.requestId && reloaded.getState().original.check_receipt.final_total === 31);
      let proposalCalls = 0, mechanicsCalls = 0, input = quotedStowReply;
      const submit = useStoryCustomAction({ customInput: input, setCustomInput: value => { input = value; }, stow: { pending: true, submit: reloaded.submit }, sessionId: f.sessionId, character: before[0], session: before[1], narrative: [],
        setEvaluatingAction: () => { mechanicsCalls++; }, setPendingProposal: () => { proposalCalls++; }, setNarrative: () => {}, buildCompositePreflightRequest: () => { mechanicsCalls++; }, acceptCompositePreflightResponse: () => { mechanicsCalls++; } });
      await submit();
      const after = await read(f), state = reloaded.getState(), html = renderToStaticMarkup(React.createElement(StowClarificationCard, { state, controller: reloaded }));
      check(`${mode}/${variant}: main Act uses confirmation only, without evaluator or mechanics`, calls.at(-1).original_request_id === f.requestId && calls.at(-1).answer_text === quotedStowReply && proposalCalls === 0 && mechanicsCalls === 0);
      check(`${mode}/${variant}: scene, Investigation, choices, original roll and resources unchanged`, stateHash(before[1]) === stateHash(after[1]) && ['hp_current', 'hp_max', 'xp', 'spell_slots', 'active_modifiers', 'conditions', 'inventory'].every(k => stateHash(before[0][k]) === stateHash(after[0][k])));
      check(`${mode}/${variant}: compact visible UI leaves loading and displays result`, !state.busy && html.includes('role="status"') && html.includes('text-sm') && !html.includes('text-xl') && !html.includes('Checking saved attempt'));
      if (variant === 'success') {
        const newItems = after[0].stowed_items.filter(x => x.stow_request_id === f.requestId);
        check(`${mode}: quoted scene answer stows exactly linked two bodies, excluding old and other guard`, state.finished && state.data.authoritative_bag_reread && newItems.length === 2 && newItems.every(x => x.death_provenance.combat_id === f.combatId) && visibleBag.length === before[0].stowed_items.length + 2 && html.includes('Stowed'));
        const replay = await base44.functions.invoke('confirmStoryStowClarification', calls.at(-1)), afterReplay = await read(f);
        check(`${mode}: backend replay is confirmed, zero-write and byte-inert`, replay.data.committed && replay.data.writes === 0 && stateHash(after) === stateHash(afterReplay));
        const restoredResult = make(); await restoredResult.restore(f.characterId);
        check(`${mode}: reload after commit displays authoritative confirmed bag`, restoredResult.getState().finished && visibleBag.length === after[0].stowed_items.length);
      } else {
        check(`${mode}/${variant}: incomplete evidence yields named visible explanation, not a silent no-op`, !state.finished && !state.error && state.data.stow_transaction.reason_code && (html.includes('No bod') || html.includes('no body')) && stateHash(before[0]) === stateHash(after[0]) && state.reply === quotedStowReply && input === quotedStowReply);
      }
      // Response-shape failures and transport errors must preserve reply and identity.
      for (const failure of ['bad-2xx', 'transport', 'wrong-request', 'bad-hash']) {
        const badInvoke = async () => {
          if (failure === 'transport') throw new Error('Fixture connection interrupted');
          if (failure === 'bad-2xx') return { data: {} };
          return { data: { ...original.data, ...(failure === 'wrong-request' ? { requested_request_id: 'unrelated' } : { response_payload_hash: 'wrong' }) } };
        };
        const c = createStowFollowupState({ sessionId: f.sessionId, invoke: badInvoke, storage: { getItem: () => null, setItem: () => {} } }); c.install(original.data); await c.submit(quotedStowReply);
        const errorHtml = renderToStaticMarkup(React.createElement(StowClarificationCard, { state: c.getState(), controller: c }));
        check(`${mode}/${variant}/${failure}: visible error retains exact reply, original and no loading residue`, c.getState().error && !c.getState().busy && !c.getState().finished && c.getState().reply === quotedStowReply && c.getState().original.requested_request_id === f.requestId && errorHtml.includes('role="alert"'));
      }
      let release, duplicateCalls = 0;
      const duplicate = createStowFollowupState({ sessionId: f.sessionId, storage: { getItem: () => null, setItem: () => {} }, invoke: () => { duplicateCalls++; return new Promise(resolve => { release = resolve; }); } }); duplicate.install(original.data);
      const one = duplicate.submit(quotedStowReply); await duplicate.submit(quotedStowReply); release({ data: {} }); await one;
      check(`${mode}/${variant}: double-click is one dispatch and exits loading`, duplicateCalls === 1 && !duplicate.getState().busy);
    }
  } finally {
    for (const item of tracked.reverse()) { await base44.entities[item.entity].delete(item.id); cleanup.push(item); }
  }
  const remaining = await Promise.all(cleanup.map(x => base44.entities[x.entity].filter({ id: x.id }).then(rows => rows.length)));
  return { total: checks.length, passed: checks.filter(x => x.pass).length, failed: checks.filter(x => !x.pass), cleanup_verified: remaining.every(n => n === 0), fixtures_deleted: cleanup.length, checks };
}