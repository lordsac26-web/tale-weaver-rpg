import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Package, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import MarketCurrency from './MarketCurrency';
import MarketFilters from './MarketFilters';
import MarketItemRow from './MarketItemRow';
import { marketCategories, marketRequestId, mergeCatalogPages } from '../../../base44/shared/marketUxContract';

const errorMessage = (error) => error?.response?.data?.error || error?.data?.error || error?.message || 'The trade could not be completed.';

export default function VendorShop({ vendor, character, sessionId, visitId, onClose, onTransaction }) {
  const [mode, setMode] = useState('buy');
  const [catalog, setCatalog] = useState([]);
  const [currentCharacter, setCurrentCharacter] = useState(character);
  const [quotes, setQuotes] = useState({});
  const [haggles, setHaggles] = useState({});
  const [quantities, setQuantities] = useState({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState(null);
  const [error, setError] = useState('');
  const pendingRef = useRef(null);

  useEffect(() => setCurrentCharacter(character), [character]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    const pages = [];
    let page = 0;
    let eligibleCount = 0;
    do {
      const response = await base44.functions.invoke('vendorTrade', { action: 'catalog', vendor_id: vendor.id, page, page_size: 40 });
      pages.push(response.data);
      eligibleCount = Number(response.data?.eligible_count || 0);
      page += 1;
    } while (pages.flatMap((entry) => entry?.items || []).length < eligibleCount && page < 20);
    setCatalog(mergeCatalogPages(pages, eligibleCount).items);
    setLoading(false);
  }, [vendor.id]);

  useEffect(() => { loadCatalog().catch((nextError) => { setError(errorMessage(nextError)); setLoading(false); }); }, [loadCatalog]);

  const sellItems = currentCharacter?.inventory || [];
  useEffect(() => {
    if (mode !== 'sell' || !sellItems.length) return;
    let cancelled = false;
    Promise.all(sellItems.map(async (item) => {
      const response = await base44.functions.invoke('vendorTrade', { action: 'quote', vendor_id: vendor.id, character_id: currentCharacter.id, item_name: item.name, direction: 'sell_to_vendor' });
      return [item.name, response.data?.quote || null];
    })).then((entries) => { if (!cancelled) setQuotes((previous) => ({ ...previous, ...Object.fromEntries(entries) })); }).catch((nextError) => { if (!cancelled) setError(errorMessage(nextError)); });
    return () => { cancelled = true; };
  }, [mode, vendor.id, currentCharacter?.id, JSON.stringify(sellItems.map((item) => [item.name, item.quantity, item.base_price, item.cost, item.value]))]);

  const activeItems = mode === 'buy' ? catalog : sellItems;
  const categories = useMemo(() => marketCategories(activeItems), [activeItems]);
  useEffect(() => { if (!categories.includes(category)) setCategory('All'); }, [categories, category]);
  const filteredItems = activeItems.filter((item) => {
    const matchesSearch = `${item.name} ${item.category || ''} ${item.rarity || ''}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (category === 'All' || (item.category || 'Misc') === category);
  });

  const haggle = async (item) => {
    const key = `haggle:${item.name}`;
    if (pendingRef.current || haggles[item.name]) return;
    pendingRef.current = key; setPendingKey(key); setError('');
    try {
      const response = await base44.functions.invoke('vendorTrade', { action: 'haggle', vendor_id: vendor.id, character_id: currentCharacter.id, session_id: sessionId, item_name: item.name, visit_id: visitId, skill: 'Persuasion' });
      const receipt = response.data?.receipt;
      setHaggles((previous) => ({ ...previous, [item.name]: receipt }));
      setQuotes((previous) => ({ ...previous, [item.name]: response.data?.quote }));
    } catch (nextError) { setError(errorMessage(nextError)); }
    finally { pendingRef.current = null; setPendingKey(null); }
  };

  const trade = async (item) => {
    const direction = mode === 'buy' ? 'buy_from_vendor' : 'sell_to_vendor';
    const key = `${direction}:${item.name}`;
    if (pendingRef.current) return;
    const quote = mode === 'buy' ? (quotes[item.name] || item.quote) : quotes[item.name];
    if (quote?.status !== 'ok') return;
    pendingRef.current = key; setPendingKey(key); setError('');
    try {
      const response = await base44.functions.invoke('vendorTrade', { vendor_id: vendor.id, character_id: currentCharacter.id, session_id: sessionId, item_name: item.name, direction, quantity: quantities[item.name] || 1, quote_id: quote.quote_id, request_id: marketRequestId(direction, vendor.id, item.name) });
      const data = response.data;
      if (!data?.success) throw new Error(data?.error || 'Trade failed.');
      setCurrentCharacter((previous) => ({ ...previous, ...(data.character_after || {}), inventory: data.inventory || previous.inventory }));
      setQuantities((previous) => ({ ...previous, [item.name]: 1 }));
      if (mode === 'buy') setQuotes((previous) => { const next = { ...previous }; delete next[item.name]; return next; });
      await onTransaction();
      if (mode === 'buy') await loadCatalog();
    } catch (nextError) { setError(errorMessage(nextError)); }
    finally { pendingRef.current = null; setPendingKey(null); }
  };

  return (
    <div className="fixed inset-0 z-30 flex min-h-0 items-stretch justify-center bg-black/90 sm:p-4" onClick={onClose}>
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(event) => event.stopPropagation()} className="flex h-full min-h-0 w-full max-w-4xl flex-col overflow-hidden bg-fantasy-wood-deep text-fantasy-parchment sm:h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border sm:border-fantasy-brass" aria-label={`${vendor.name} market`}>
        <header className="flex shrink-0 items-start gap-3 border-b border-fantasy-brass bg-fantasy-wood-dark p-3 sm:p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-fantasy-brass bg-fantasy-wood-deep text-xl">{vendor.portrait_emoji || '🏪'}</div>
          <div className="min-w-0 flex-1"><h2 className="break-words font-fantasy text-lg font-bold text-fantasy-brass">{vendor.name}</h2><p className="text-sm text-fantasy-parchment-dim">{vendor.greeting || 'Welcome, traveler.'}</p></div>
          <button type="button" onClick={onClose} aria-label="Close market" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-fantasy-wood-mid focus-visible:ring-2 focus-visible:ring-fantasy-brass"><X className="h-5 w-5" /></button>
        </header>
        <div className="shrink-0 space-y-3 border-b border-fantasy-brass bg-fantasy-wood-deep p-3">
          <MarketCurrency character={currentCharacter} />
          <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { setMode('buy'); setSearch(''); setCategory('All'); }} className={`min-h-11 rounded-lg border font-semibold focus-visible:ring-2 focus-visible:ring-fantasy-brass ${mode === 'buy' ? 'border-fantasy-brass bg-fantasy-wood-mid' : 'border-fantasy-wood-mid bg-fantasy-wood-dark'}`}>Buy Stock</button><button type="button" onClick={() => { setMode('sell'); setSearch(''); setCategory('All'); }} className={`min-h-11 rounded-lg border font-semibold focus-visible:ring-2 focus-visible:ring-fantasy-brass ${mode === 'sell' ? 'border-fantasy-brass bg-fantasy-wood-mid' : 'border-fantasy-wood-mid bg-fantasy-wood-dark'}`}>Sell Items</button></div>
        </div>
        <MarketFilters search={search} onSearch={setSearch} categories={categories} category={category} onCategory={setCategory} />
        {error && <div className="shrink-0 border-b border-red-700 bg-red-950 p-3 text-sm text-red-100" role="alert">{error} Try refreshing the quote or choosing another item.</div>}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading && mode === 'buy' ? <p className="py-10 text-center text-fantasy-parchment-dim">Loading all stock…</p> : filteredItems.length ? <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{filteredItems.map((item) => <MarketItemRow key={item.id || item.name} item={item} mode={mode} quote={mode === 'buy' ? (quotes[item.name] || item.quote) : quotes[item.name]} quantity={quantities[item.name] || 1} onQuantity={(quantity) => setQuantities((previous) => ({ ...previous, [item.name]: quantity }))} onTrade={() => trade(item)} onHaggle={() => haggle(item)} pending={pendingKey === `${mode === 'buy' ? 'buy_from_vendor' : 'sell_to_vendor'}:${item.name}` || pendingKey === `haggle:${item.name}`} haggle={haggles[item.name]} />)}</div> : <div className="py-12 text-center text-fantasy-parchment-dim"><Package className="mx-auto mb-3 h-10 w-10" /><p>{search || category !== 'All' ? 'No items match these filters.' : mode === 'buy' ? 'No items in stock.' : 'You have nothing to sell.'}</p></div>}
        </div>
      </motion.section>
    </div>
  );
}