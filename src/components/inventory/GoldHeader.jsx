import React from 'react';
import { Coins } from 'lucide-react';
import { formatCoinFields } from '@/lib/currencyFormat';

// Compact gold / silver / copper display for the inventory header.
export default function GoldHeader({ character }) {
  const display = formatCoinFields(character);
  return (
    <div className="rounded-xl p-3 flex items-center gap-4"
      style={{ background: 'rgba(15,10,5,0.7)', border: '1px solid rgba(180,140,90,0.2)' }}>
      <Coins className="w-4 h-4" style={{ color: '#f0c040' }} />
      <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>PURSE</span>
      <div className="ml-auto break-words text-right font-fantasy text-sm font-bold tabular-nums" style={{ color: '#f0c040' }}>{display}</div>
    </div>
  );
}