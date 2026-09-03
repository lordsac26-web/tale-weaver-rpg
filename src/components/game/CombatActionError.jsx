import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function CombatActionError({ message, onClose }) {
  if (!message) return null;
  return <div role="alert" data-combat-error="ephemeral" className="fixed left-1/2 top-20 z-50 flex w-[min(92vw,34rem)] -translate-x-1/2 items-start gap-3 rounded-xl border border-red-500/60 bg-red-950/95 p-3 text-red-100 shadow-2xl">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
    <p className="flex-1 text-sm">{message} Refresh combat state and retry the same action safely.</p>
    <button type="button" onClick={onClose} aria-label="Dismiss combat error"><X className="h-4 w-4" /></button>
  </div>;
}