import React from 'react';
import { Loader2, ShoppingCart, Tags } from 'lucide-react';
import { clampTradeQuantity } from '../../../base44/shared/marketUxContract';

const rarityMarks = { common: '○', uncommon: '●', rare: '◆', legendary: '★' };

export default function MarketItemRow({ item, mode, quote, quantity = 1, onQuantity, onTrade, onHaggle, pending, haggle }) {
  const available = Math.max(1, Number(item.quantity ?? item.stock ?? 1) || 1);
  const disabled = pending || quote?.status !== 'ok' || (mode === 'buy' && Number(item.stock) <= 0);
  return (
    <article className="rounded-xl border border-fantasy-wood-mid bg-fantasy-wood-dark p-3 text-fantasy-parchment">
      <div className="flex items-start gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-fantasy-brass bg-fantasy-wood-deep text-xl" aria-hidden="true">{item.icon || '📦'}<span className="absolute -bottom-1 -right-1 rounded-full bg-fantasy-wood-mid px-1 text-xs text-fantasy-brass">{rarityMarks[String(item.rarity || 'common').toLowerCase()] || '○'}</span></div>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-semibold leading-snug">{item.name}</h3>
          <p className="mt-1 text-sm text-fantasy-parchment-dim">{item.category || 'Misc'} · {item.rarity || 'common'}{mode === 'buy' ? ` · ${Number(item.stock) || 0} in stock` : ` · ${available} owned`}</p>
          <p className="mt-2 font-semibold tabular-nums text-fantasy-brass">{quote?.status === 'ok' ? quote.unit_display : 'Quote unavailable'}</p>
          {haggle && <p className={`mt-1 text-sm ${haggle.success ? 'text-green-300' : 'text-fantasy-parchment-dim'}`}>{haggle.success ? `${haggle.discount_percent}% discount applied` : 'Haggle used · listed price stands'}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {mode === 'sell' && available > 1 && <label className="min-w-24 text-sm text-fantasy-parchment-dim">Quantity<select value={quantity} onChange={(event) => onQuantity(clampTradeQuantity(event.target.value, available))} className="mt-1 min-h-11 w-full rounded-lg border border-fantasy-brass bg-fantasy-wood-deep px-2 text-fantasy-parchment focus-visible:ring-2 focus-visible:ring-fantasy-brass">{Array.from({ length: available }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>}
        {mode === 'buy' && <button type="button" onClick={onHaggle} disabled={pending || !!haggle || quote?.status !== 'ok'} className="min-h-11 rounded-lg border border-fantasy-brass bg-fantasy-wood-deep px-3 text-sm font-semibold text-fantasy-parchment disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-fantasy-brass"><Tags className="mr-1.5 inline h-4 w-4" />{haggle ? 'Haggled' : 'Haggle'}</button>}
        <button type="button" onClick={onTrade} disabled={disabled} className="min-h-11 flex-1 rounded-lg border border-fantasy-brass bg-fantasy-wood-mid px-4 text-sm font-semibold text-fantasy-parchment disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-fantasy-brass">{pending ? <><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />Processing…</> : <><ShoppingCart className="mr-1.5 inline h-4 w-4" />{mode === 'buy' ? 'Buy' : `Sell ${quantity}`}</>}</button>
      </div>
    </article>
  );
}