import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { acceptSequencedStoryPayload } from '@/lib/storyTransition';

export default function StowClarificationCard({ clarification, sessionId, characterId, onConfirmed }) {
  const [data, setData] = useState(clarification), [ids, setIds] = useState([]), [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [finished, setFinished] = useState(false);
  const candidates = (data.stow_transaction?.candidates || []).filter(x => x.id).slice(0, 24);
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await base44.functions.invoke('confirmStoryStowClarification', { session_id: sessionId, character_id: characterId,
        original_request_id: clarification.requested_request_id, ...(ids.length ? { selected_source_ids: ids } : { answer_text: answer }) });
      const next = response.data, verified = acceptSequencedStoryPayload(next, 1, 1);
      if (!verified.accepted || next.requested_request_id !== clarification.requested_request_id || next.response_payload_hash !== clarification.response_payload_hash
        || next.check_receipt?.request_id !== clarification.check_receipt?.request_id || JSON.stringify(next.check_receipt) !== JSON.stringify(clarification.check_receipt)) throw new Error('This answer could not be matched to the original saved attempt. Nothing is confirmed; keep the attempt paused.');
      if (next.response_kind === 'stow_confirmation' && next.committed && next.stow_transaction?.receipt?.token === clarification.requested_request_id) {
        setFinished(true); onConfirmed?.(next);
      }
      setData(next);
    } catch (err) { setError(err?.response?.data?.error || err.message); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="glass-panel-light rounded-xl p-4 space-y-3 text-fantasy-parchment" aria-label="Clarify the saved stow attempt">
    <p className="font-body text-base leading-relaxed" role="status">{data.message || data.clarification_message}</p>
    {!finished && <>
      <p className="font-body text-sm">Your saved {data.check_receipt?.skill || 'skill'} result stays unchanged; answering does not roll again or advance the scene.</p>
      {candidates.map(candidate => <label key={candidate.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-base font-body">
        <input type="checkbox" disabled={busy || (!ids.includes(candidate.id) && ids.length >= 8)} checked={ids.includes(candidate.id)}
          onChange={() => setIds(prev => prev.includes(candidate.id) ? prev.filter(x => x !== candidate.id) : [...prev, candidate.id])} />{candidate.label}
      </label>)}
      <label className="block text-base font-body">Or clarify which bodies you mean
        <input value={answer} disabled={busy} maxLength={160} onChange={event => { setAnswer(event.target.value); setIds([]); }} className="input-fantasy mt-1 w-full rounded-lg p-3" />
      </label>
      <button type="submit" disabled={busy || (!ids.length && !answer.trim())} className="btn-fantasy min-h-11 rounded-lg px-4 py-2 disabled:opacity-50">{busy ? 'Checking saved attempt…' : 'Confirm These Bodies'}</button>
    </>}
    {error && <p role="alert" className="font-body text-base">{error}</p>}
  </form>;
}