import React from 'react';
import PlayerTextLimit from '@/components/game/PlayerTextLimit';

export default function GroundedClarificationCard({ controller }) {
  const { state, busy, error } = controller;
  if (!state) return null;
  return <section className="stow-clarification-panel glass-panel-light flex min-h-0 flex-col gap-2 overflow-y-auto rounded-xl p-3 font-body text-sm text-fantasy-parchment" aria-label="Scene clarification">
    <p role="status" className="whitespace-pre-wrap break-words">{state.data.reasoning}</p>
    <p className="text-fantasy-parchment-dim">No action or new roll has been performed.</p>
    {Array.isArray(state.data.clarification_options) && state.data.clarification_options.length > 0 && <div className="flex flex-wrap gap-2">{state.data.clarification_options.map((option) => <button key={option.id} type="button" disabled={busy} onClick={() => controller.submit(option.name)} className="rounded-lg border px-2.5 py-1.5 text-left text-xs" style={{ borderColor: 'rgba(201,169,110,0.35)', color: 'var(--brass-gold)', background: 'rgba(30,17,6,0.6)' }}>{option.name}</button>)}</div>}
    {error && <p role="alert">{error}</p>}
    <form onSubmit={e => { e.preventDefault(); controller.submit(); }} className="space-y-2">
      <textarea aria-label="Scene clarification reply" rows={2} value={state.reply} disabled={busy} onChange={e => controller.setReply(e.target.value)} className="input-fantasy max-h-32 w-full resize-y rounded-lg p-2 text-sm" />
      <PlayerTextLimit value={state.reply} />
      <div className="flex flex-wrap gap-2"><button disabled={busy || !state.reply.trim()} className="btn-fantasy min-h-11 rounded-lg px-3">{busy ? 'Checking the saved scene…' : 'Reply'}</button><button type="button" disabled={busy} onClick={controller.cancel} className="min-h-11 rounded-lg px-3">Cancel clarification</button></div>
    </form>
  </section>;
}