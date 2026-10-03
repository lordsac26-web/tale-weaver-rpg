import React from 'react';
import { X } from 'lucide-react';
import StowReplyForm from '@/components/game/StowReplyForm';

export default function StowClarificationCard({ state, controller }) {
  if (!state?.data && !state?.error) return null;
  const refused = state.data?.stow_transaction?.reason_code === 'container_fit_unverified';
  const stored = state.data?.stow_transaction?.already_stowed?.[0]?.name;
  return <section className="stow-clarification-panel glass-panel-light flex min-h-0 min-w-0 w-full max-w-full flex-col gap-2 rounded-xl p-3 font-body text-sm text-fantasy-parchment" aria-label="Saved corpse-stow attempt">
    <div className="flex flex-shrink-0 items-center justify-between gap-2">
      <span className="tavern-section-label">{refused ? 'Stow refused — not enough room' : 'Saved stow attempt'}</span>
      <button type="button" onClick={() => controller.dismiss()} disabled={state.busy} aria-label="Close stow card" className="btn-fantasy inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs disabled:opacity-50"><X className="h-4 w-4" />Close</button>
    </div>
    <div className="max-h-[14dvh] flex-shrink-0 overflow-y-auto break-words">
      <p role="status" className="text-sm leading-relaxed">{state.data?.response_kind === 'clarification' ? state.data.clarification_message : state.data?.message}</p>
      {refused && <p className="mt-1 text-xs leading-relaxed">Make room first — for example, type "Leave {stored ? `the ${stored}'s corpse` : 'one body from the bag'} here in the tunnel" — then stow again. Close this card to keep playing; nothing has moved.</p>}
      {state.data && !state.finished && <p className="mt-1 text-xs">Saved {state.data.check_receipt?.skill} {state.data.check_receipt?.final_total} vs DC {state.data.check_receipt?.dc}; no new roll or scene advance.</p>}
      {state.error && <p role="alert" className="mt-2 text-sm leading-relaxed">{state.error}</p>}
    </div>
    {state.data && !state.finished && <StowReplyForm state={state} controller={controller} />}
  </section>;
}