import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { validatePlayerText } from '@/lib/playerText';

export default function useGroundedClarification({ sessionId, characterId, onResolved }) {
  const key = `grounded-clarification:${sessionId}`;
  const [state, setState] = useState(() => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const inFlight = useRef(false);
  useEffect(() => { if (state) localStorage.setItem(key, JSON.stringify(state)); else localStorage.removeItem(key); }, [key, state]);
  const install = data => { setState({ original: data, data, reply: '' }); setError(''); };
  const submit = async (reply = state?.reply || '') => {
    if (!state || inFlight.current) return false;
    const checked = validatePlayerText(reply);
    setState(s => ({ ...s, reply }));
    if (!checked.ok) { setError(checked.error); return false; }
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await base44.functions.invoke('evaluatePlayerAction', { session_id: sessionId, character_id: characterId, action: state.original.action,
        answer_text: checked.text, expected_scene_revision: state.data.grounded_action?.scene_revision, request_id: state.original.request_id });
      if (result.data?.clarification_required) { setState(s => ({ ...s, data: result.data })); return false; }
      onResolved(result.data); setState(null); return true;
    } catch (err) { setError(err?.response?.data?.error || err.message || 'Your reply is preserved. Please retry.'); return false; }
    finally { inFlight.current = false; setBusy(false); }
  };
  return { state, busy, error, pending: !!state, install, submit, setReply: reply => setState(s => ({ ...s, reply })), cancel: () => { if (!inFlight.current) setState(null); } };
}