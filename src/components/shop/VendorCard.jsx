import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Coins, ShoppingBag } from 'lucide-react';
import { VENDOR_TYPE_META } from './vendorData';

export default function VendorCard({ vendor, onEnter }) {
  const meta = VENDOR_TYPE_META[vendor.type] || VENDOR_TYPE_META.general;
  const itemCount = vendor.items?.filter(i => i.stock > 0).length || 0;

  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: `0 0 24px ${meta.borderColor}` }}
      transition={{ type: 'spring', stiffness: 300 }}
      className="rounded-2xl overflow-hidden cursor-pointer fantasy-card"
      style={{ background: meta.bg, border: `1px solid ${meta.borderColor}` }}
      onClick={onEnter}>

      {/* Top accent line */}
      <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />

      <div className="p-5">
        <div className="flex items-start gap-4 mb-3">
          <motion.div
            animate={{ filter: [`drop-shadow(0 0 6px ${meta.color}60)`, `drop-shadow(0 0 14px ${meta.color}90)`, `drop-shadow(0 0 6px ${meta.color}60)`] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="text-4xl flex-shrink-0 select-none">{vendor.portrait_emoji || meta.icon}</motion.div>
          <div className="flex-1 min-w-0">
            <h3 className="font-fantasy font-bold text-base mb-0.5" style={{ color: meta.color }}>{vendor.name}</h3>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full font-fantasy"
                style={{ background: `${meta.borderColor}`, border: `1px solid ${meta.borderColor}`, color: meta.color, fontSize: '0.6rem' }}>
                {meta.icon} {meta.label}
              </span>
              {vendor.is_traveling && (
                <span className="text-xs px-2 py-0.5 rounded-full font-fantasy"
                  style={{ background: 'rgba(140,60,220,0.2)', border: '1px solid rgba(140,60,220,0.3)', color: '#c084fc', fontSize: '0.6rem' }}>
                  🐪 Traveling
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs" style={{ color: 'rgba(180,140,90,0.4)' }}>
              <MapPin className="w-3 h-3" />
              <span style={{ fontFamily: 'EB Garamond, serif' }}>{vendor.location || 'Town Market'}</span>
            </div>
          </div>
        </div>

        <p className="text-sm leading-relaxed mb-4 line-clamp-2"
          style={{ color: 'rgba(232,213,183,0.55)', fontFamily: 'IM Fell English, serif', lineHeight: 1.6 }}>
          {vendor.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
            <ShoppingBag className="w-3 h-3" />
            {itemCount} items in stock
          </div>
          <button
            className="px-4 py-2 rounded-xl font-fantasy text-xs font-semibold transition-all"
            style={{
              background: `${meta.borderColor}`,
              border: `1px solid ${meta.color}80`,
              color: meta.color,
              letterSpacing: '0.05em',
            }}>
            Enter Shop →
          </button>
        </div>
      </div>
    </motion.div>
  );
}