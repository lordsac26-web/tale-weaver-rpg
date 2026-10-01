import React from 'react';
import PlayerTextLimit from '@/components/game/PlayerTextLimit';

export default function StowReplyForm({ state, controller }) {
  const candidates = (state.data?.stow_transaction?.candidates || []).filter(x => x.id).slice(0, 24);
  return <form onSubmit={event => { event.preventDefault(); controller.submit(); }} className="flex min-h-0 flex-1 flex-col gap-2" aria-label="Reply to saved stow attempt">
    <div className="min-h-0 flex-1 overflow-y-auto">
      {candidates.map(candidate => <label key={candidate.id} className="flex min-h-11 cursor-pointer items-center gap-2 font-body text-sm">
        <input type="checkbox" disabled={state.busy || (!state.ids.includes(candidate.id) && state.ids.length >= 8)} checked={state.ids.includes(candidate.id)}
          onChange={() => controller.setIds(state.ids.includes(candidate.id) ? state.ids.filter(x => x !== candidate.id) : [...state.ids, candidate.id])} />{candidate.label}
      </label>)}
    </div>
    <label className="block font-body text-sm">Clarification reply
      <textarea value={state.reply} disabled={state.busy} rows={2} onChange={event => controller.setReply(event.target.value)} className="input-fantasy mt-1 min-h-11 max-h-32 w-full resize-y rounded-lg px-3 py-2 text-base sm:text-sm" />
      <PlayerTextLimit value={state.reply} />
    </label>
    <button type="submit" disabled={state.busy || (!state.ids.length && !state.reply.trim())} className="btn-fantasy min-h-11 self-start rounded-lg px-3 py-2 text-sm disabled:opacity-50">{state.busy ? 'Checking saved attempt…' : 'Confirm Reply'}</button>
  </form>;
}