import React from 'react';
import StowReplyForm from '@/components/game/StowReplyForm';

export default function StowClarificationCard({ state, controller }) {
  if (!state?.data && !state?.error) return null;
  return <section className="stow-clarification-panel glass-panel-light flex min-h-0 min-w-0 w-full max-w-full flex-col gap-2 rounded-xl p-3 font-body text-sm text-fantasy-parchment" aria-label="Saved corpse-stow attempt">
    <div className="min-h-0 overflow-y-auto break-words">
      <p role="status" className="text-sm leading-relaxed">{state.data?.message || state.data?.clarification_message}</p>
      {state.data && !state.finished && <p className="mt-1 text-xs">Saved {state.data.check_receipt?.skill} {state.data.check_receipt?.final_total} vs DC {state.data.check_receipt?.dc}; no new roll or scene advance.</p>}
      {state.error && <p role="alert" className="mt-2 text-sm leading-relaxed">{state.error}</p>}
    </div>
    {state.data && !state.finished && <StowReplyForm state={state} controller={controller} />}
  </section>;
}