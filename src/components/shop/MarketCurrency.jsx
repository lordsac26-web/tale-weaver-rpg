import React from 'react';
import { Coins } from 'lucide-react';
import { formatCoinFields } from '@/lib/currencyFormat';

export default function MarketCurrency({ character }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-fantasy-brass bg-fantasy-wood-dark px-3 py-2 text-fantasy-parchment" aria-label={`Player funds: ${formatCoinFields(character)}`}>
      <Coins className="h-4 w-4 shrink-0 text-fantasy-brass" />
      <span className="min-w-0 break-words text-sm font-semibold tabular-nums">{formatCoinFields(character)}</span>
    </div>
  );
}