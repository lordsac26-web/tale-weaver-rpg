import React from 'react';
import PlayerTextLimit from '@/components/game/PlayerTextLimit';

export default function GroundedClarificationCard({ controller }) {
  const { state, busy, error } = controller;
  if (!state) return null;
  return <section className="stow-clarification-panel glass-panel-light flex min-h-0 flex-col gap-2 overflow-y-auto rounded-xl p-3 font-body text-sm text-fantasy-parchment" aria-label="Scene clarification">
    <p role="status" className="whitespace-pre-wrap break-words">{state.data.reasoning}</p>
    <p className="text-fantasy-parchment-dim">No action or new roll has been performed.</p>
    {error && <p role="alert">{error}</p>}
    <form onSubmit={e => { e.preventDefault(); controller.submit(); }} className="space-y-2">
      <textarea aria-label="Scene clarification reply" rows={2} value={state.reply} disabled={busy} onChange={e => controller.setReply(e.target.value)} className="input-fantasy max-h-32 w-full resize-y rounded-lg p-2 text-sm" />
      <PlayerTextLimit value={state.reply} />
      <div className="flex flex-wrap gap-2"><button disabled={busy || !state.reply.trim()} className="btn-fantasy min-h-11 rounded-lg px-3">{busy ? 'Checking the saved scene…' : 'Reply'}</button><button type="button" disabled={busy} onClick={controller.cancel} className="min-h-11 rounded-lg px-3">Cancel clarification</button></div>
    </form>
  </section>;
}