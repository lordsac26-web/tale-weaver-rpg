import { acceptSequencedStoryPayload } from '@/lib/storyTransition';

export default async function applyStoryClarification({ data, requestId, sourceId, sequence, latestSequence, continuation, setNarrative, setChoices, onStowClarification }) {
  if (data?.response_kind !== 'clarification') return false;
  const accepted = acceptSequencedStoryPayload(data, sequence, latestSequence);
  const receipt = data.check_receipt;
  if (!accepted.accepted || data.persistence_scope !== 'existing_scene' || !data.preserve_scene || data.writes !== 0
    || data.requested_request_id !== requestId || data.story_entry?.request_id !== sourceId || !data.clarification_message
    || (receipt && (receipt.request_id !== requestId || receipt.source_story_request_id !== sourceId))) throw new Error('The clarification does not match the saved scene and attempted roll. Keep this action paused.');
  const entry = data.story_entry;
  const canonical = { request_id: entry.request_id || null, text: String(entry.text || ''), choices: entry.choices || [], skill_check: entry.skill_check || null };
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical))))).map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== data.response_payload_hash) throw new Error('The preserved scene checksum could not be verified. Keep this action paused.');
  setChoices(accepted.hydration.choices);
  if (data.stow_transaction?.contextual_stow && onStowClarification) {
    onStowClarification(data);
    // The source scene is accepted, not the attempted stow. Keep its continuation.
  } else {
    continuation.accepted(requestId);
    setNarrative(previous => [...previous, { type: 'action_error', text: data.clarification_message }]);
  }
  return true;
}