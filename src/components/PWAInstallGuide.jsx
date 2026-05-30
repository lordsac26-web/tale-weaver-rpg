import React, { useState } from 'react';
import { Download, Monitor, Smartphone, X, Check, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export default function PWAInstallGuide({ onClose }) {
  const [installed, setInstalled] = useState(false);
  const [installError, setInstallError] = useState(null);

  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  const isEdge = /Edg/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);

  const handleInstall = async () => {
    try {
      // Dispatch custom event to trigger install prompt
      const installEvent = new CustomEvent('trigger-install-prompt');
      window.dispatchEvent(installEvent);
      setInstalled(true);
      setInstallError(null);
    } catch (error) {
      setInstallError('Install prompt not available. Please use your browser\'s install option.');
      console.error('Install error:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}>
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ 
          border: '1px solid rgba(201,169,110,0.3)', 
          background: 'linear-gradient(160deg, rgba(15,10,7,0.98), rgba(8,5,2,0.99))'
        }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(180,140,90,0.12)' }}>
          <div className="flex items-center gap-3">
            <Download className="w-6 h-6" style={{ color: '#fbbf24' }} />
            <div>
              <h2 className="font-fantasy text-lg" style={{ color: '#c9a96e' }}>Install Tale Weaver</h2>
              <p className="text-xs" style={{ color: 'rgba(212,149,90,0.5)' }}>
                Desktop & Mobile Installation Guide
              </p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'rgba(201,169,110,0.4)' }}>
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Benefits */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(20,15,10,0.5)' }}>
              <Monitor className="w-8 h-8 mx-auto mb-2" style={{ color: '#93c5fd' }} />
              <div className="text-xs font-fantasy" style={{ color: '#f0d090' }}>Desktop App</div>
              <div className="text-xs text-slate-500 mt-1">Runs like native app</div>
            </div>
            <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(20,15,10,0.5)' }}>
              <Smartphone className="w-8 h-8 mx-auto mb-2" style={{ color: '#86efac' }} />
              <div className="text-xs font-fantasy" style={{ color: '#f0d090' }}>Mobile Ready</div>
              <div className="text-xs text-slate-500 mt-1">Works on all devices</div>
            </div>
            <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(20,15,10,0.5)' }}>
              <Check className="w-8 h-8 mx-auto mb-2" style={{ color: '#fbbf24' }} />
              <div className="text-xs font-fantasy" style={{ color: '#f0d090' }}>Offline Mode</div>
              <div className="text-xs text-slate-500 mt-1">Cache for offline use</div>
            </div>
          </div>

          {/* Browser-specific instructions */}
          <div className="space-y-4">
            <h3 className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>
              INSTALLATION INSTRUCTIONS
            </h3>

            {/* Chrome/Edge */}
            {(isChrome || isEdge) && (
              <div className="p-4 rounded-xl" style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.15)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Monitor className="w-5 h-5" style={{ color: '#93c5fd' }} />
                  <span className="font-fantasy text-sm" style={{ color: '#f0d090' }}>
                    {isEdge ? 'Microsoft Edge' : 'Google Chrome'} (Desktop)
                  </span>
                </div>
                <ol className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-xs font-fantasy" style={{ color: '#c9a96e' }}>1.</span>
                    <span>Click the <strong>Install</strong> button when prompted</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-xs font-fantasy" style={{ color: '#c9a96e' }}>2.</span>
                    <span>Or click the <strong>+</strong> icon in the address bar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-xs font-fantasy" style={{ color: '#c9a96e' }}>3.</span>
                    <span>Select "Install" to add to desktop</span>
                  </li>
                </ol>
                <Button onClick={handleInstall} className="btn-fantasy mt-4 text-xs px-4 py-2 h-auto">
                  <Download className="w-3 h-3 mr-2" />
                  Install Now
                </Button>
              </div>
            )}

            {/* Safari */}
            {isSafari && (
              <div className="p-4 rounded-xl" style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.15)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Monitor className="w-5 h-5" style={{ color: '#93c5fd' }} />
                  <span className="font-fantasy text-sm" style={{ color: '#f0d090' }}>Safari (Mac)</span>
                </div>
                <ol className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-xs font-fantasy" style={{ color: '#c9a96e' }}>1.</span>
                    <span>Click <strong>File</strong> in the menu bar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-xs font-fantasy" style={{ color: '#c9a96e' }}>2.</span>
                    <span>Select <strong>"Add to Dock..."</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-xs font-fantasy" style={{ color: '#c9a96e' }}>3.</span>
                    <span>Name the app and click <strong>Add</strong></span>
                  </li>
                </ol>
              </div>
            )}

            {/* Firefox */}
            {isFirefox && (
              <div className="p-4 rounded-xl" style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.15)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Monitor className="w-5 h-5" style={{ color: '#93c5fd' }} />
                  <span className="font-fantasy text-sm" style={{ color: '#f0d090' }}>Firefox</span>
                </div>
                <p className="text-sm text-slate-400 mb-3">
                  Firefox has limited PWA support. You can still create a shortcut:
                </p>
                <ol className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-xs font-fantasy" style={{ color: '#c9a96e' }}>1.</span>
                    <span>Click the <strong>menu button</strong> (≡)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-xs font-fantasy" style={{ color: '#c9a96e' }}>2.</span>
                    <span>Select <strong>"More tools" → "Create shortcut"</strong></span>
                  </li>
                </ol>
              </div>
            )}

            {/* Generic instructions */}
            <div className="p-4 rounded-xl" style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.15)' }}>
              <div className="flex items-center gap-2 mb-3">
                <ExternalLink className="w-5 h-5" style={{ color: '#c4b5fd' }} />
                <span className="font-fantasy text-sm" style={{ color: '#f0d090' }}>Alternative Method</span>
              </div>
              <p className="text-sm text-slate-400">
                Most modern browsers support PWA installation. Look for an install icon in your address bar, 
                or check your browser's menu for "Install" or "Create shortcut" options.
              </p>
            </div>
          </div>

          {/* Success/Error messages */}
          {installed && !installError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl text-center"
              style={{ background: 'rgba(40,100,60,0.2)', border: '1px solid rgba(40,160,80,0.4)' }}>
              <Check className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <div className="font-fantasy text-sm" style={{ color: '#86efac' }}>Install prompt triggered!</div>
              <div className="text-xs text-slate-400 mt-1">Follow the browser prompts to complete installation</div>
            </motion.div>
          )}

          {installError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl text-center"
              style={{ background: 'rgba(120,40,40,0.2)', border: '1px solid rgba(220,80,80,0.4)' }}>
              <div className="font-fantasy text-sm" style={{ color: '#fca5a5' }}>Install Prompt Not Available</div>
              <div className="text-xs text-slate-400 mt-1">Please use your browser's menu to install this app</div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}