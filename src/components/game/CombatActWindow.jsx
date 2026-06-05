import React, { useState } from 'react';
import { Feather, Loader2, Sparkles } from 'lucide-react';
import MicButton from './MicButton';

/**
 * CombatActWindow — a free-text "Act" input inside combat. The player describes
 * something they want to try (improvised, social, tactical), and it's sent to the
 * AI DM for adjudication (skill check / continue combat / de-escalate / narrative).
 *
 * Props:
 *  - onSubmit: (text) => void   — called with the typed action
 *  - loading: boolean           — DM is thinking
 *  - disabled: boolean          — not the player's turn / combat busy
 */
export default function CombatActWindow({ onSubmit, loading, disabled }) {
  const [text, setText] = useState('');

  const submit = () => {
    if (!text.trim() || loading || disabled) return;
    onSubmit(text.trim());
    setText('');
  };

  return (
    <div className="rounded-xl p-3"
      style={{ background: 'rgba(20,12,30,0.55)', border: '1px solid rgba(140,100,200,0.25)' }}>
      <div className="font-fantasy text-xs mb-2 flex items-center gap-1.5"
        style={{ color: 'rgba(180,150,230,0.7)', fontSize: '0.62rem', letterSpacing: '0.08em' }}>
        <Sparkles className="w-3 h-3" /> IMPROVISE — DESCRIBE A CUSTOM ACTION
      </div>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Feather className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: 'rgba(160,120,220,0.4)' }} />
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            disabled={disabled || loading}
            placeholder={disabled ? 'Wait for your turn…' : 'e.g. Kick the table at the goblin, or try to talk them down…'}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm disabled:opacity-50"
            style={{
              background: 'rgba(8,4,12,0.7)', border: '1px solid rgba(140,100,200,0.3)',
              color: '#d4b3ff', fontFamily: 'EB Garamond, serif', fontSize: '0.95rem',
            }}
          />
        </div>
        <MicButton value={text} onTranscript={setText} disabled={disabled || loading} />
        <button onClick={submit} disabled={!text.trim() || loading || disabled}
          className="px-4 py-2.5 rounded-lg text-sm font-fantasy flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, rgba(80,40,140,0.9), rgba(50,20,100,0.95))',
            border: '1px solid rgba(160,110,240,0.5)', color: '#e9d5ff', letterSpacing: '0.04em',
          }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'DM…' : 'Act'}
        </button>
      </div>
    </div>
  );
}