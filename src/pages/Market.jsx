import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ShoppingBag, Store } from 'lucide-react';
import VendorCard from '@/components/shop/VendorCard';
import VendorShop from '@/components/shop/VendorShop';
import MarketCurrency from '@/components/shop/MarketCurrency';
import { AnimatePresence } from 'framer-motion';
import { MARKET_UX_BUNDLE_VERSION } from '../../base44/shared/marketUxContract';

export default function Market() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const characterId = searchParams.get('character_id');
  const queryClient = useQueryClient();

  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [visitId] = useState(() => `visit:${sessionId || 'market'}:${crypto.randomUUID()}`);

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => base44.entities.Vendor.filter({ is_active: true }),
  });

  const { data: character, isLoading: charLoading } = useQuery({
    queryKey: ['character', characterId],
    queryFn: () => base44.entities.Character.get(characterId),
    enabled: !!characterId,
  });

  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => base44.entities.GameSession.get(sessionId),
    enabled: !!sessionId,
  });

  const handleTransaction = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['character', characterId] }),
      queryClient.invalidateQueries({ queryKey: ['vendors'] }),
    ]);
  };

  if (vendorsLoading || charLoading) {
    return (
      <div className="min-h-screen parchment-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  const localVendors = vendors.filter(v => 
    !v.location || v.location === session?.current_location || v.is_traveling
  );
  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId) || null;

  return (
    <div className="game-viewport min-h-0 overflow-hidden parchment-bg flex flex-col" data-market-ux-version={MARKET_UX_BUNDLE_VERSION} style={{ color: '#e8d5b7', height: '100dvh', maxHeight: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: 'rgba(8,5,2,0.95)', borderBottom: '1px solid rgba(180,140,90,0.2)' }}>
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg" style={{ color: 'rgba(201,169,110,0.5)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Store className="w-5 h-5" style={{ color: '#f0c040' }} />
        <div className="flex-1">
          <h1 className="font-fantasy-deco font-bold text-base text-glow-gold" style={{ color: '#f0c040' }}>
            Market Square
          </h1>
          <p className="text-xs" style={{ color: 'rgba(218,180,128,0.85)', fontFamily: 'EB Garamond, serif' }}>
            {session?.current_location || 'Local merchants'}
          </p>
        </div>
        {character && <MarketCurrency character={character} />}
      </div>

      {/* Vendors List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {localVendors.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#c9a96e' }} />
              <p className="text-sm" style={{ color: 'rgba(205,170,120,0.8)' }}>
                No merchants available in this area
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {localVendors.map(vendor => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  onVisit={(vendor) => setSelectedVendorId(vendor.id)}
                />
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Vendor Shop Modal */}
      <AnimatePresence>
        {selectedVendor && character && (
          <VendorShop
            vendor={selectedVendor}
            character={character}
            sessionId={sessionId}
            visitId={visitId}
            onClose={() => setSelectedVendorId(null)}
            onTransaction={handleTransaction}
          />
        )}
      </AnimatePresence>
    </div>
  );
}