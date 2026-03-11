import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronLeft, Package, Coins, Search, ArrowDownToLine, ArrowUpFromLine, Loader2, Trash2, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProceduralItemCard from '@/components/game/ProceduralItemCard';
import { LOOT_RARITY } from '@/components/game/lootTables';

export default function PartyStash() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  const characterId = urlParams.get('character_id');

  const [stash, setStash] = useState(null);
  const [character, setCharacter] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [tab, setTab] = useState('stash'); // stash | log

  useEffect(() => { loadData(); }, [sessionId, characterId]);

  const loadData = async () => {
    if (!sessionId) return;
    setLoading(true);
    const [sessions, stashes] = await Promise.all([
      base44.entities.GameSession.filter({ id: sessionId }),
      base44.entities.PartyStash.filter({ session_id: sessionId }),
    ]);
    setSession(sessions[0] || null);
    if (stashes[0]) {
      setStash(stashes[0]);
    } else {
      // Create new stash for this session
      const created = await base44.entities.PartyStash.create({ session_id: sessionId, items: [], gold: 0, silver: 0, copper: 0, log: [] });
      setStash(created);
    }
    if (characterId) {
      const chars = await base44.entities.Character.filter({ id: characterId });
      setCharacter(chars[0] || null);
    }
    setLoading(false);
  };

  const addLogEntry = (action, itemName, characterName) => ({
    action, item: itemName, character: characterName || 'Unknown', timestamp: new Date().toISOString(),
  });

  // Take item from stash to character inventory
  const handleTakeItem = async (item) => {
    if (!character || !stash) return;
    setSaving(true);
    const newStashItems = (stash.items || []).filter(i => i.name !== item.name);
    const newLog = [...(stash.log || []), addLogEntry('withdrew', item.name, character.name)];
    await base44.entities.PartyStash.update(stash.id, { items: newStashItems, log: newLog });
    const newInventory = [...(character.inventory || []), item];
    await base44.entities.Character.update(character.id, { inventory: newInventory });
    setStash(prev => ({ ...prev, items: newStashItems, log: newLog }));
    setCharacter(prev => ({ ...prev, inventory: newInventory }));
    setSaving(false);
  };

  // Move item from character inventory to stash
  const handleStashItem = async (item) => {
    if (!character || !stash) return;
    setSaving(true);
    const idx = (character.inventory || []).findIndex(i => i.name === item.name);
    if (idx === -1) { setSaving(false); return; }
    const newInventory = [...(character.inventory || [])];
    newInventory.splice(idx, 1);
    const newStashItems = [...(stash.items || []), item];
    const newLog = [...(stash.log || []), addLogEntry('deposited', item.name, character.name)];
    await base44.entities.PartyStash.update(stash.id, { items: newStashItems, log: newLog });
    await base44.entities.Character.update(character.id, { inventory: newInventory });
    setStash(prev => ({ ...prev, items: newStashItems, log: newLog }));
    setCharacter(prev => ({ ...prev, inventory: newInventory }));
    setSaving(false);
  };

  // Remove item from stash permanently
  const handleDiscardItem = async (item) => {
    if (!stash) return;
    setSaving(true);
    const newStashItems = (stash.items || []).filter(i => i.name !== item.name);
    const newLog = [...(stash.log || []), addLogEntry('discarded', item.name, character?.name || 'Party')];
    await base44.entities.PartyStash.update(stash.id, { items: newStashItems, log: newLog });
    setStash(prev => ({ ...prev, items: newStashItems, log: newLog }));
    setSaving(false);
  };

  // Deposit/withdraw coins
  const handleCoinTransfer = async (type, amount, direction) => {
    if (!character || !stash) return;
    const coinKey = type; // gold, silver, copper
    const charCoins = character[coinKey] || 0;
    const stashCoins = stash[coinKey] || 0;
    if (direction === 'deposit') {
      const transfer = Math.min(amount, charCoins);
      if (transfer <= 0) return;
      setSaving(true);
      await base44.entities.PartyStash.update(stash.id, { [coinKey]: stashCoins + transfer });
      await base44.entities.Character.update(character.id, { [coinKey]: charCoins - transfer });
      setStash(prev => ({ ...prev, [coinKey]: stashCoins + transfer }));
      setCharacter(prev => ({ ...prev, [coinKey]: charCoins - transfer }));
    } else {
      const transfer = Math.min(amount, stashCoins);
      if (transfer <= 0) return;
      setSaving(true);
      await base44.entities.PartyStash.update(stash.id, { [coinKey]: stashCoins - transfer });
      await base44.entities.Character.update(character.id, { [coinKey]: charCoins + transfer });
      setStash(prev => ({ ...prev, [coinKey]: stashCoins - transfer }));
      setCharacter(prev => ({ ...prev, [coinKey]: charCoins + transfer }));
    }
    setSaving(false);
  };

  const filteredStashItems = (stash?.items || []).filter(item => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (rarityFilter !== 'all' && item.rarity !== rarityFilter) return false;
    return true;
  });

  const charItems = (character?.inventory || []).filter(item => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center parchment-bg">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#c9a96e' }} />
    </div>
  );

  const logEntries = [...(stash?.log || [])].reverse().slice(0, 30);

  return (
    <div className="min-h-screen parchment-bg pb-8">
      {/* Header */}
      <div className="px-4 py-4 flex items-center gap-3"
        style={{ background: 'rgba(8,5,2,0.9)', borderBottom: '1px solid rgba(180,140,90,0.15)' }}>
        <button onClick={() => navigate(createPageUrl('Game') + `?session_id=${sessionId}`)}
          className="p-1.5 rounded-lg" style={{ color: 'rgba(201,169,110,0.5)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Package className="w-5 h-5" style={{ color: '#c9a96e' }} />
        <div className="flex-1">
          <h1 className="font-fantasy-deco text-lg font-bold" style={{ color: '#f0c040' }}>Party Stash</h1>
          <p className="text-xs font-body" style={{ color: 'rgba(212,180,110,0.6)' }}>{session?.title || 'Campaign'}</p>
        </div>
        {character && (
          <div className="text-right">
            <p className="text-xs font-fantasy" style={{ color: 'rgba(212,180,110,0.8)' }}>{character.name}</p>
            <p className="text-xs" style={{ color: 'rgba(240,192,64,0.6)' }}>
              {character.gold || 0}g · {character.silver || 0}s · {character.copper || 0}c
            </p>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-4 space-y-4">
        {/* Coin Treasury */}
        <div className="glass-panel rounded-xl p-4">
          <div className="tavern-section-label mb-3">Party Treasury</div>
          <div className="grid grid-cols-3 gap-3">
            {[{ key: 'gold', color: '#f0c040', label: 'Gold' }, { key: 'silver', color: '#e2e8f0', label: 'Silver' }, { key: 'copper', color: '#fb923c', label: 'Copper' }].map(c => (
              <div key={c.key} className="text-center space-y-2">
                <div className="font-fantasy text-2xl font-bold" style={{ color: c.color }}>{stash?.[c.key] || 0}</div>
                <div className="text-xs font-fantasy" style={{ color: 'rgba(212,180,110,0.7)' }}>{c.label}</div>
                {character && (
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => handleCoinTransfer(c.key, 10, 'deposit')} disabled={saving}
                      className="p-1 rounded-lg transition-all" title={`Deposit 10 ${c.label}`}
                      style={{ border: '1px solid rgba(74,222,128,0.25)', color: 'rgba(74,222,128,0.6)' }}>
                      <ArrowDownToLine className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleCoinTransfer(c.key, 10, 'withdraw')} disabled={saving}
                      className="p-1 rounded-lg transition-all" title={`Withdraw 10 ${c.label}`}
                      style={{ border: '1px solid rgba(252,165,165,0.25)', color: 'rgba(252,165,165,0.6)' }}>
                      <ArrowUpFromLine className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2">
          {['stash', 'inventory', 'log'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 rounded-xl text-sm font-fantasy transition-all"
              style={tab === t ? {
                background: 'rgba(80,50,10,0.7)', border: '1px solid rgba(201,169,110,0.5)', color: '#f0c040',
              } : {
                background: 'rgba(20,13,5,0.5)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(201,169,110,0.5)',
              }}>
              {t === 'stash' ? `📦 Stash (${(stash?.items || []).length})` : t === 'inventory' ? `🎒 My Items (${(character?.inventory || []).length})` : '📜 Log'}
            </button>
          ))}
        </div>

        {/* Search + Filter */}
        {tab !== 'log' && (
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(184,115,51,0.35)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..."
                className="w-full input-fantasy rounded-xl pl-9 pr-3 py-2 text-sm" />
            </div>
            {tab === 'stash' && (
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" style={{ color: 'rgba(184,115,51,0.35)' }} />
                <select value={rarityFilter} onChange={e => setRarityFilter(e.target.value)}
                  className="select-fantasy rounded-lg px-2 py-2 text-xs">
                  <option value="all">All Rarities</option>
                  {Object.entries(LOOT_RARITY).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Stash Items */}
        {tab === 'stash' && (
          <div className="space-y-2">
            {filteredStashItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#c9a96e' }} />
                <p className="text-sm font-body" style={{ color: 'rgba(212,180,110,0.5)' }}>
                  {search || rarityFilter !== 'all' ? 'No items match your filters.' : 'The party stash is empty.'}
                </p>
              </div>
            ) : (
              <AnimatePresence>
                {filteredStashItems.map((item, i) => (
                  <ProceduralItemCard key={item.name + i} item={item} index={i}
                    onAction={character ? handleTakeItem : undefined}
                    actionLabel="Take" actionIcon="🎒"
                    secondaryAction={handleDiscardItem} secondaryLabel="Discard" />
                ))}
              </AnimatePresence>
            )}
          </div>
        )}

        {/* Character Inventory */}
        {tab === 'inventory' && (
          <div className="space-y-2">
            {!character ? (
              <p className="text-center text-sm py-8" style={{ color: 'rgba(212,180,110,0.5)' }}>No character linked.</p>
            ) : charItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#c9a96e' }} />
                <p className="text-sm font-body" style={{ color: 'rgba(212,180,110,0.5)' }}>Your inventory is empty.</p>
              </div>
            ) : (
              <AnimatePresence>
                {charItems.map((item, i) => (
                  <ProceduralItemCard key={item.name + i} item={item} index={i}
                    onAction={handleStashItem} actionLabel="To Stash" actionIcon="📦" />
                ))}
              </AnimatePresence>
            )}
          </div>
        )}

        {/* Transaction Log */}
        {tab === 'log' && (
          <div className="glass-panel rounded-xl p-4 space-y-2">
            <div className="tavern-section-label mb-3">Transaction History</div>
            {logEntries.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: 'rgba(212,180,110,0.5)' }}>No transactions yet.</p>
            ) : (
              logEntries.map((entry, i) => {
                const isDeposit = entry.action === 'deposited';
                const isDiscard = entry.action === 'discarded';
                return (
                  <div key={i} className="flex items-center gap-2 py-2 px-3 rounded-lg"
                    style={{ background: 'rgba(15,8,3,0.5)', borderBottom: '1px solid rgba(184,115,51,0.06)' }}>
                    <span className="text-sm">
                      {isDeposit ? '📥' : isDiscard ? '🗑️' : '📤'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-fantasy" style={{ color: isDeposit ? '#86efac' : isDiscard ? '#fca5a5' : '#93c5fd' }}>
                        {entry.character}
                      </span>
                      <span className="text-xs font-body mx-1" style={{ color: 'rgba(212,180,110,0.6)' }}>
                        {entry.action}
                      </span>
                      <span className="text-xs font-fantasy" style={{ color: 'rgba(240,220,170,0.9)' }}>
                        {entry.item}
                      </span>
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: 'rgba(180,140,90,0.4)' }}>
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : ''}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}