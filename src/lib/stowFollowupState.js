import { acceptSequencedStoryPayload } from '@/lib/storyTransition';

const fingerprint = r => JSON.stringify([r?.request_id, r?.source_story_request_id, r?.skill, r?.raw_d20, r?.all_rolls, r?.modifier_total, r?.final_total, r?.dc, r?.success, r?.roll_origin]);
export async function verifyStowFollowup(data, original) {
  if (!['clarification', 'stow_confirmation'].includes(data?.response_kind)) throw new Error('No stow result was returned. Your reply and original attempt are retained; retry this confirmation, not a new action.');
  const accepted = acceptSequencedStoryPayload(data, 1, 1);
  if (!accepted.accepted || data.persistence_scope !== 'existing_scene' || data.requested_request_id !== original.requested_request_id
    || data.story_entry?.request_id !== original.story_entry?.request_id || fingerprint(data.check_receipt) !== fingerprint(original.check_receipt)) throw new Error('The answer could not be linked to the saved attempt. Your reply is retained; keep this attempt paused.');
  const entry = data.story_entry, canonical = { request_id: entry.request_id, text: String(entry.text || ''), choices: entry.choices || [], skill_check: entry.skill_check || null };
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical))))).map(x => x.toString(16).padStart(2, '0')).join('');
  if (hash !== data.response_payload_hash || hash !== original.response_payload_hash) throw new Error('The saved scene changed or its checksum differs. Your reply is retained; keep this attempt paused.');
  if (data.response_kind === 'clarification' && (!data.clarification_message || !data.stow_transaction?.reason_code)) throw new Error('Your reply received no specific resolution. The original attempt and reply are retained; retry after the updated confirmation flow is published.');
  if (data.committed && (data.stow_transaction?.receipt?.token !== original.requested_request_id || !Array.isArray(data.character_stowed_items) || !Array.isArray(data.character_inventory))) throw new Error('The bag result is incomplete. Keep this same attempt paused; do not roll or stow again.');
  if (data.committed && data.stow_transaction.receipt.items?.some(source => !data.character_stowed_items.some(x => x.stow_request_id === original.requested_request_id && x.alive === false && x.death_provenance?.status === 'dead' && `corpse:${x.death_provenance.combat_id}:${x.death_provenance.combatant_id}` === source.item_id))) throw new Error('The committed source set is missing from the confirmed bag contents. Keep the original attempt paused.');
  return data;
}

export default function createStowFollowupState({ sessionId, invoke, storage, onChange = () => {}, onConfirmed = () => {} }) {
  const key = `pending-story-stow:${sessionId}`;
  let state = { data: null, original: null, reply: '', ids: [], busy: false, error: '', finished: false };
  try { const saved = JSON.parse(storage.getItem(key) || 'null'); if (saved?.original?.session_id === sessionId) state = { ...state, ...saved, busy: false }; } catch { state.error = 'The local saved reply could not be restored; the original roll can still be recovered from the campaign.'; }
  const update = patch => {
    state = { ...state, ...patch };
    try { storage.setItem(key, JSON.stringify({ ...state, busy: false })); } catch { state = { ...state, error: 'This browser could not save your reply for reload. Keep this screen open; the original roll remains saved.' }; }
    onChange(state); return state;
  };
  const install = data => update({ data, original: data, finished: false, error: '', ...(state.original?.requested_request_id === data.requested_request_id ? {} : { reply: '', ids: [] }) });
  const consume = async (data, original = state.original) => {
    await verifyStowFollowup(data, original);
    const finished = data.response_kind === 'stow_confirmation' && data.committed === true;
    update({ data, finished, error: '' });
    if (finished) onConfirmed(data);
    return state;
  };
  return {
    getState: () => state, install,
    setReply: reply => update({ reply, ids: [] }), setIds: ids => update({ ids }),
    async restore(characterId) {
      if (state.busy) return state;
      try {
        const result = await invoke({ session_id: sessionId, character_id: characterId, read_only: true, ...(state.original ? { original_request_id: state.original.requested_request_id } : {}) });
        const data = result.data;
        if (data?.response_kind === 'no_pending_stow') return update({ data: null, original: null, finished: false });
        if (!state.original) install(data);
        await consume(data);
      } catch (err) { update({ error: err?.response?.data?.error || err.message, busy: false }); }
      return state;
    },
    async submit(reply = state.reply) {
      if (state.busy || state.finished) return state;
      if (!state.original) return update({ error: 'No saved stow attempt is attached to this reply. Reload the saved scene before submitting another action.' });
      update({ reply, busy: true, error: '' });
      try {
        const result = await invoke({ session_id: sessionId, character_id: state.original.character_id, original_request_id: state.original.requested_request_id,
          ...(state.ids.length ? { selected_source_ids: state.ids } : { answer_text: reply }) });
        await consume(result.data);
      } catch (err) { update({ error: err?.response?.data?.error || err.message || 'Confirmation failed. Your reply and original attempt are retained.' }); }
      finally { update({ busy: false }); }
      return state;
    },
  };
}