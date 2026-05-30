import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

/**
 * PWAInstallPrompt - Shows install prompt for PWA
 * Only displays when app is not installed and browser supports it
 */
export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Check if user hasn't dismissed before
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      const dismissedAt = dismissed ? parseInt(dismissed) : 0;
      const daysSinceDismissal = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      
      // Show prompt if not dismissed in last 7 days
      if (daysSinceDismissal > 7) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setShowPrompt(false);
      setDeferredPrompt(null);
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-4 right-4 z-50 max-w-sm"
      >
        <div 
          className="rounded-xl p-4"
          style={{ 
            background: 'linear-gradient(160deg, rgba(30,20,8,0.98), rgba(15,10,7,0.99))',
            border: '1px solid rgba(201,169,110,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 20px rgba(184,115,51,0.15)'
          }}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(184,115,51,0.15)' }}>
              <Download className="w-6 h-6" style={{ color: '#fbbf24' }} />
            </div>
            <div className="flex-1">
              <h3 className="font-fantasy font-bold text-sm mb-1" style={{ color: '#f0d090' }}>
                Install Tale Weaver
              </h3>
              <p className="text-xs text-slate-400 mb-3">
                Install the app for quick access and offline support. No app store required.
              </p>
              <div className="flex gap-2">
                <Button 
                  onClick={handleInstall}
                  className="btn-fantasy text-xs px-4 py-2 h-auto"
                >
                  Install
                </Button>
                <button
                  onClick={handleDismiss}
                  className="text-xs px-3 py-2 rounded-lg transition-colors"
                  style={{ color: 'rgba(201,169,110,0.4)', background: 'rgba(201,169,110,0.1)' }}
                >
                  Not Now
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 rounded"
              style={{ color: 'rgba(201,169,110,0.3)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}