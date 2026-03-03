import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins } from 'lucide-react';

export default function TransactionToast({ transaction, onDone }) {
  if (!transaction) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={transaction.id}
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        onAnimationComplete={() => setTimeout(onDone, 2200)}
        className="fixed bottom-6 left-1/2 z-50 rounded-2xl px-5 py-3.5 max-w-sm w-full"
        style={{
          transform: 'translateX(-50%)',
          background: transaction.type === 'buy' ? 'rgba(10,6,3,0.97)' : 'rgba(5,20,8,0.97)',
          border: transaction.type === 'buy'
            ? '1px solid rgba(201,169,110,0.4)'
            : '1px solid rgba(40,160,80,0.4)',
          boxShadow: transaction.type === 'buy'
            ? '0 0 30px rgba(201,169,110,0.12), 0 8px 32px rgba(0,0,0,0.7)'
            : '0 0 30px rgba(40,160,80,0.12), 0 8px 32px rgba(0,0,0,0.7)',
        }}>
        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
          style={{ background: transaction.type === 'buy'
            ? 'linear-gradient(90deg, transparent, rgba(201,169,110,0.6), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(40,160,80,0.6), transparent)' }} />

        <div className="flex items-start gap-3">
          <div className="text-2xl flex-shrink-0">{transaction.type === 'buy' ? '🛍️' : '💰'}</div>
          <div className="flex-1 min-w-0">
            <div className="font-fantasy font-bold text-sm mb-0.5"
              style={{ color: transaction.type === 'buy' ? '#f0c040' : '#86efac' }}>
              {transaction.type === 'buy' ? 'Purchased' : 'Sold'}: {transaction.itemName}
            </div>
            <p className="text-xs italic leading-relaxed mb-1.5"
              style={{ color: 'rgba(232,213,183,0.55)', fontFamily: 'IM Fell English, serif', lineHeight: 1.5 }}>
              {transaction.flavor}
            </p>
            <div className="flex items-center gap-1.5 text-xs">
              <Coins className="w-3 h-3" style={{ color: transaction.type === 'buy' ? '#fca5a5' : '#86efac' }} />
              <span style={{ color: transaction.type === 'buy' ? '#fca5a5' : '#86efac' }}>
                {transaction.type === 'buy' ? '-' : '+'}{transaction.amount}gp
              </span>
              <span style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
                · Balance: {transaction.newBalance}gp
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}