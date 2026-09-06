import React from 'react';
import { Search } from 'lucide-react';

export default function MarketFilters({ search, onSearch, categories, category, onCategory }) {
  return (
    <div className="space-y-3 border-b border-fantasy-brass bg-fantasy-wood-deep p-3">
      <label className="flex min-h-11 items-center gap-2 rounded-lg border border-fantasy-brass bg-fantasy-wood-dark px-3 text-fantasy-parchment">
        <Search className="h-4 w-4 shrink-0" />
        <span className="sr-only">Search market items</span>
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search name, category, or rarity…" className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-fantasy-parchment-dim focus-visible:ring-2 focus-visible:ring-fantasy-brass" />
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Item categories">
        {categories.map((name) => <button key={name} type="button" onClick={() => onCategory(name)} className={`min-h-11 shrink-0 rounded-lg border px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-fantasy-brass ${category === name ? 'border-fantasy-brass bg-fantasy-wood-mid text-fantasy-parchment' : 'border-fantasy-wood-mid bg-fantasy-wood-dark text-fantasy-parchment-dim'}`}>{name}</button>)}
      </div>
    </div>
  );
}