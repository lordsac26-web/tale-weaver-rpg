import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function VendorDialogue({ vendor, character, context, itemName, itemDescription, autoLoad = false }) {
  const [dialogue, setDialogue] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const cacheRef = useRef({});

  const cacheKey = `${vendor.id}-${context}-${itemName || ''}`;

  const load = async () => {
    if (cacheRef.current[cacheKey]) {
      setDialogue(cacheRef.current[cacheKey]);
      setVisible(true);
      return;
    }
    setLoading(true);
    setVisible(true);
    try {
      const res = await base44.functions.invoke('generateVendorDialogue', {
        vendor_name: vendor.name,
        vendor_type: vendor.type,
        vendor_personality: vendor.personality || '',
        vendor_description: vendor.description || '',
        context,
        item_name: itemName || '',
        item_description: itemDescription || '',
        character_name: character?.name || '',
        character_class: character?.class || '',
        character_gold: character?.gold || 0,
      });
      const text = res.data?.dialogue || '';
      cacheRef.current[cacheKey] = text;
      setDialogue(text);
    } catch {
      setDialogue(vendor.greeting || '...');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (autoLoad) load();
  }, [context, itemName, autoLoad]);

  if (!visible && !autoLoad) {
    return (
      <button onClick={load}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all"
        style={{ background: 'rgba(20,14,5,0.6)', border: '1px solid rgba(180,140,90,0.18)', color: 'rgba(180,140,90,0.5)' }}>
        <MessageCircle className="w-3 h-3" /> Ask vendor
      </button>
    );
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          className="relative rounded-xl px-4 py-3"
          style={{ background: 'rgba(25,16,4,0.85)', border: '1px solid rgba(201,169,110,0.18)', boxShadow: '0 0 20px rgba(201,169,110,0.05)' }}>
          {/* Speech bubble tail */}
          <div className="absolute -top-1.5 left-6 w-3 h-3 rotate-45"
            style={{ background: 'rgba(25,16,4,0.85)', borderTop: '1px solid rgba(201,169,110,0.18)', borderLeft: '1px solid rgba(201,169,110,0.18)' }} />

          <div className="flex items-start gap-2">
            <span className="text-lg flex-shrink-0 mt-0.5">{vendor.portrait_emoji || '🧙'}</span>
            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'rgba(201,169,110,0.4)' }} />
                  <span className="text-xs italic" style={{ color: 'rgba(201,169,110,0.35)', fontFamily: 'EB Garamond, serif' }}>
                    {vendor.name?.split(' ')[0]} considers their words...
                  </span>
                </div>
              ) : (
                <p className="text-sm italic leading-relaxed" style={{ color: 'rgba(232,213,183,0.8)', fontFamily: 'IM Fell English, serif', lineHeight: 1.65 }}>
                  {dialogue}
                </p>
              )}
            </div>
            <div className="flex items-start gap-1 flex-shrink-0">
              <button onClick={load} title="Refresh"
                className="p-1 rounded transition-colors"
                style={{ color: 'rgba(180,140,90,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(201,169,110,0.6)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(180,140,90,0.3)'}>
                <RefreshCw className="w-3 h-3" />
              </button>
              <button onClick={() => setVisible(false)}
                className="p-1 rounded transition-colors text-xs"
                style={{ color: 'rgba(180,140,90,0.3)' }}>
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}