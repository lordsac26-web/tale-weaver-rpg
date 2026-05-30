import React from 'react';
import { Coins } from 'lucide-react';

// Compact gold / silver / copper display for the inventory header.
export default function GoldHeader({ character }) {
  const coins = [
    { key: 'gold', label: 'GP', value: character?.gold || 0, color: '#f0c040' },
    { key: 'silver', label: 'SP', value: character?.silver || 0, color: '#cbd5e1' },
    { key: 'copper', label: 'CP', value: character?.copper || 0, color: '#d97c4a' },
  ];
  return (
    <div className="rounded-xl p-3 flex items-center gap-4"
      style={{ background: 'rgba(15,10,5,0.7)', border: '1px solid rgba(180,140,90,0.2)' }}>
      <Coins className="w-4 h-4" style={{ color: '#f0c040' }} />
      <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>PURSE</span>
      <div className="flex items-center gap-4 ml-auto">
        {coins.map(c => (
          <div key={c.key} className="flex items-center gap-1.5">
            <span className="font-fantasy font-bold text-sm" style={{ color: c.color }}>{c.value}</span>
            <span className="text-xs" style={{ color: 'rgba(201,169,110,0.4)' }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}