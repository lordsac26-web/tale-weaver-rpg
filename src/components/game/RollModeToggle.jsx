import React from 'react';
import { Sparkles, UserRound } from 'lucide-react';

export default function RollModeToggle({ value = 'ai', onChange, disabled = false }) {
  const player = value === 'player';
  return (
    <div className="flex items-center rounded-lg p-0.5 flex-shrink-0" role="group" aria-label="Roll mode" style={{ background: 'rgba(12,7,3,0.85)', border: '1px solid rgba(201,169,110,0.28)' }}>
      {[['ai', 'AI rolls', Sparkles], ['player', 'I roll', UserRound]].map(([mode, label, Icon]) => {
        const active = value === mode;
        return <button key={mode} type="button" disabled={disabled} onClick={() => onChange?.(mode)} aria-pressed={active} className="flex min-h-8 items-center gap-1 rounded-md px-2 text-[0.65rem] font-fantasy whitespace-nowrap disabled:opacity-50" style={{ color: active ? (mode === 'ai' ? '#ddd6fe' : '#fde68a') : 'rgba(201,169,110,0.45)', background: active ? (mode === 'ai' ? 'rgba(76,29,149,0.65)' : 'rgba(120,53,15,0.65)') : 'transparent' }}><Icon className="h-3 w-3" /><span className="hidden sm:inline">{label}</span><span className="sm:hidden">{mode === 'ai' ? 'AI' : 'Me'}</span></button>;
      })}
    </div>
  );
}