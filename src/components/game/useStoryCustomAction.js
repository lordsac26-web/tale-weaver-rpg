import { base44 } from '@/api/base44Client';

export default function useStoryCustomAction({ customInput, setCustomInput, stow, sessionId, character, session, narrative, setEvaluatingAction, setPendingProposal, setNarrative, buildCompositePreflightRequest, acceptCompositePreflightResponse }) {
  return async () => {
    if (!customInput.trim()) return;
    if (stow.pending) { const result = await stow.submit(customInput); if (result.finished) setCustomInput(''); return; }
    const text = customInput; setCustomInput(''); setEvaluatingAction(true);
    try {
      const composite = buildCompositePreflightRequest({ text, sessionId, characterId: character?.id, source: 'free_text' });
      const result = await base44.functions.invoke(composite?.endpoint || 'evaluatePlayerAction', {
        ...(composite?.payload || {}), action: text, request_id: composite?.request_id || `evaluate-action:${sessionId}:${crypto.randomUUID()}`,
        session_id: sessionId, character_id: character?.id, character,
        session_context: `${session?.current_location || ''} — ${narrative.filter(e => e.type === 'narration').slice(-1)[0]?.text?.slice(0, 200) || ''}`,
      });
      if (result.data?.action_type === 'composite_action') {
        const accepted = acceptCompositePreflightResponse(result.data, composite?.parent_key || result.data?.composite_plan?.plan?.parent_key);
        if (!accepted.accepted) throw new Error(`Composite preflight response rejected: ${accepted.reason}`);
      }
      setPendingProposal({ ...result.data, action: text, ...(composite ? { parent_key: composite.parent_key } : {}) });
    } catch (err) {
      setCustomInput(text);
      setNarrative(prev => [...prev, { type: 'action_error', text: `${err?.response?.data?.error || err.message || 'Your action could not be evaluated.'} Your input has been preserved.` }]);
    } finally { setEvaluatingAction(false); }
  };
}