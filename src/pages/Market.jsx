import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, RefreshCw, Coins, Search, ShoppingBag } from 'lucide-react';
import VendorCard from '@/components/shop/VendorCard';
import VendorShop from '@/components/shop/VendorShop';
import { VENDOR_TYPE_META } from '@/components/shop/vendorData';

export default function Market() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const characterId = urlParams.get('character_id');
  const sessionId = urlParams.get('session_id');

  const [vendors, setVendors] = useState([]);
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [vends] = await Promise.all([
      base44.entities.Vendor.list('-created_date', 50),
    ]);
    setVendors(vends.filter(v => v.is_active));

    if (characterId) {
      const chars = await base44.entities.Character.filter({ id: characterId });
      if (chars[0]) setCharacter(chars[0]);
    }
    setLoading(false);
  };

  const handleCharacterUpdate = (updated) => {
    setCharacter(updated);
  };

  const filteredVendors = vendors.filter(v => {
    const matchType = filterType === 'all' || v.type === filterType;
    const matchSearch = !search || v.name?.toLowerCase().includes(search.toLowerCase()) ||
      v.description?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  // Group by type for display
  const vendorTypes = ['all', ...Object.keys(VENDOR_TYPE_META)];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0a07' }}>
      <div className="text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: '#c9a96e' }} />
        <div className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(201,169,110,0.5)' }}>Opening the market gates...</div>
      </div>
    </div>
  );

  // Full-screen vendor view
  if (selectedVendor && character) {
    return (
      <div className="min-h-screen" style={{ background: '#0d0a07' }}>
        <VendorShop
          vendor={selectedVendor}
          character={character}
          onBack={() => { setSelectedVendor(null); loadData(); }}
          onCharacterUpdate={handleCharacterUpdate}
        />
      </div>
    );
  }

  // Can browse without character but can't buy
  const hasCharacter = !!character;

  return (
    <div className="min-h-screen parchment-bg flex flex-col" style={{ color: '#e8d5b7' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: 'rgba(8,5,2,0.92)', borderBottom: '1px solid rgba(180,140,90,0.15)', backdropFilter: 'blur(8px)' }}>
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg" style={{ color: 'rgba(201,169,110,0.5)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-fantasy font-bold text-base text-glow-gold" style={{ color: '#c9a96e' }}>
            🏪 Town Market
          </h1>
          {hasCharacter ? (
            <p className="text-xs" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
              {character.name} · <span style={{ color: '#f0c040' }}>{character.gold || 0}gp</span>
            </p>
          ) : (
            <p className="text-xs italic" style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>
              No character selected — browsing only
            </p>
          )}
        </div>
        {hasCharacter && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(40,25,5,0.6)', border: '1px solid rgba(201,169,110,0.2)' }}>
            <Coins className="w-3.5 h-3.5" style={{ color: '#f0c040' }} />
            <span className="font-fantasy font-bold text-sm" style={{ color: '#f0c040' }}>{character.gold || 0}gp</span>
          </div>
        )}
      </div>

      {/* Market atmospheric banner */}
      <div className="px-4 py-5 flex-shrink-0" style={{ background: 'rgba(15,10,4,0.6)', borderBottom: '1px solid rgba(180,140,90,0.08)' }}>
        <p className="text-center italic text-sm" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'IM Fell English, serif', lineHeight: 1.7 }}>
          "The market hums with life — voices haggling, coins clinking, the smell of spiced meat and fresh leather on the morning air."
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2 items-center px-4 py-2.5 flex-shrink-0 overflow-x-auto"
        style={{ background: 'rgba(10,6,3,0.8)', borderBottom: '1px solid rgba(180,140,90,0.08)' }}>
        <div className="relative flex-shrink-0 w-44">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(180,140,90,0.3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search vendors..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs input-fantasy" />
        </div>
        {['all', 'alchemist', 'blacksmith', 'armorer', 'general', 'tavern_inn', 'traveling'].map(type => {
          const m = VENDOR_TYPE_META[type];
          return (
            <button key={type} onClick={() => setFilterType(type)}
              className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-fantasy transition-all"
              style={filterType === type ? {
                background: m ? m.bg : 'rgba(50,35,5,0.8)',
                border: `1px solid ${m ? m.borderColor : 'rgba(201,169,110,0.4)'}`,
                color: m ? m.color : '#f0c040',
              } : {
                background: 'rgba(15,10,5,0.5)',
                border: '1px solid rgba(180,140,90,0.12)',
                color: 'rgba(180,140,90,0.4)',
              }}>
              {type === 'all' ? '🏪 All' : `${m?.icon} ${m?.label}`}
            </button>
          );
        })}
      </div>

      {/* Vendor Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredVendors.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-10" style={{ color: '#c9a96e' }} />
            <div className="font-fantasy text-base" style={{ color: 'rgba(201,169,110,0.25)' }}>The market is quiet today.</div>
            <div className="text-xs mt-2" style={{ color: 'rgba(180,140,90,0.2)', fontFamily: 'EB Garamond, serif' }}>
              Vendors are seeded from the admin panel.
            </div>
          </div>
        ) : (
          <motion.div
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            initial="hidden" animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVendors.map((vendor, i) => (
              <motion.div key={vendor.id}
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}>
                <VendorCard vendor={vendor} onEnter={() => {
                  if (!hasCharacter) {
                    // Show a note but still allow browsing (the shop handles it)
                  }
                  setSelectedVendor(vendor);
                }} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}