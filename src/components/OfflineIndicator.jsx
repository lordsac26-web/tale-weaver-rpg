import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';

/**
 * Shows a toast when the user goes offline. Auto-hides when back online.
 */
export default function OfflineIndicator() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2 rounded-xl shadow-2xl"
          style={{
            background: 'rgba(60,20,20,0.95)',
            border: '1px solid rgba(220,50,50,0.5)',
            color: '#fca5a5',
            backdropFilter: 'blur(8px)',
            fontFamily: 'Cinzel, serif',
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
          }}>
          <WifiOff className="w-3.5 h-3.5" />
          You're offline — some features may not work
        </motion.div>
      )}
    </AnimatePresence>
  );
}