import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function StoryRecoveryCard({ controller }) {
  if (!controller?.blocked) return null;
  return (
    <section role="alert" className="mx-4 my-3 shrink-0 rounded-lg border border-fantasy-brass bg-fantasy-wood-dark p-4 text-fantasy-parchment">
      <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 shrink-0" /><h2 className="font-fantasy">Your saved action needs recovery</h2></div>
      <p className="mt-2 text-base">Your last confirmed scene is preserved. Resolve the saved action before continuing; no new roll will be made.</p>
      {controller.error && <p className="mt-2 break-words text-sm">{controller.error}</p>}
      <button type="button" onClick={controller.resolve} disabled={controller.busy} className="btn-fantasy mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fantasy-brass">
        {controller.busy && <Loader2 className="h-4 w-4 animate-spin" />}{controller.busy ? 'Resolving…' : 'Resolve and continue'}
      </button>
    </section>
  );
}