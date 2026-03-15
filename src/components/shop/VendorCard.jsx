import React from 'react';
import { ShoppingBag, Coins } from 'lucide-react';
import { motion } from 'framer-motion';

const VENDOR_TYPE_ICONS = {
  alchemist: '🧪',
  blacksmith: '⚒️',
  armorer: '🛡️',
  general: '🏪',
  tavern_inn: '🏨',
  tavern_pub: '🍺',
  brothel: '💋',
  traveling: '🎒',
};

export default function VendorCard({ vendor, onVisit }) {
  const icon = VENDOR_TYPE_ICONS[vendor.type] || '🏪';
  const itemCount = vendor.items?.length || 0;

  return (
    <motion.button
      onClick={() => onVisit(vendor)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full p-4 rounded-xl text-left fantasy-card"
      style={{
        background: 'rgba(20,13,5,0.8)',
        border: '1px solid rgba(180,140,90,0.25)',
      }}>
      
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: 'rgba(60,40,10,0.6)', border: '1px solid rgba(201,169,110,0.3)' }}>
          {vendor.portrait_emoji || icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-fantasy font-bold text-base truncate" style={{ color: '#f0c040' }}>
            {vendor.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'rgba(201,169,110,0.6)' }}>
            <span className="capitalize">{vendor.type.replace('_', ' ')}</span>
            {vendor.location && (
              <>
                <span>•</span>
                <span>{vendor.location}</span>
              </>
            )}
          </div>
          {vendor.greeting && (
            <p className="text-xs mt-2 italic line-clamp-2" 
              style={{ color: 'rgba(232,213,183,0.5)', fontFamily: 'EB Garamond, serif' }}>
              "{vendor.greeting}"
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-xs" style={{ color: 'rgba(251,191,36,0.7)' }}>
              <Coins className="w-3 h-3" />
              {vendor.gold_reserve || 0} gp
            </div>
            <div className="flex items-center gap-1 text-xs" style={{ color: 'rgba(180,140,90,0.5)' }}>
              <ShoppingBag className="w-3 h-3" />
              {itemCount} items
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}