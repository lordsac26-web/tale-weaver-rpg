export const GROUNDED_CLARIFICATION_SUBMIT_VERSION = 'grounded-clarification-submit-v2';
export function clarificationReplyPayload({state,sessionId,characterId,reply,selectedId}) {
  return {session_id:sessionId,character_id:characterId,action:state.original.action,
    answer_text:reply,selected_source_id:selectedId || '',
    clarification_intent_id:state.data.clarification_intent_id || state.original.clarification_intent_id || null,
    expected_scene_revision:state.data.grounded_action?.scene_revision,
    request_id:state.original.request_id,clarification_submit_version:GROUNDED_CLARIFICATION_SUBMIT_VERSION};
}
export const clarificationNeedsReply = data => !!(data?.action_blocked || data?.clarification_required || data?.error);