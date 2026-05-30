import { useEffect, useState } from 'react';
import { Smartphone, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * PWADebugger - Shows PWA installation status and debug info
 * Use this to diagnose PWA installation issues
 */
export default function PWADebugger() {
  const [installReady, setInstallReady] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [manifestLoaded, setManifestLoaded] = useState(false);
  const [serviceWorkerActive, setServiceWorkerActive] = useState(false);
  const [browserSupport, setBrowserSupport] = useState(false);
  const [debugInfo, setDebugInfo] = useState([]);

  useEffect(() => {
    const logs = [];

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsInstalled(isStandalone);
    logs.push(`Already installed: ${isStandalone ? 'Yes' : 'No'}`);

    // Check browser support
    const hasInstallSupport = 'beforeinstallprompt' in window;
    setBrowserSupport(hasInstallSupport);
    logs.push(`Browser supports PWA: ${hasInstallSupport ? 'Yes' : 'No'}`);

    // Check manifest
    fetch('/manifest.json')
      .then(r => {
        if (r.ok) {
          setManifestLoaded(true);
          logs.push('Manifest loaded: Yes');
          return r.json();
        } else {
          logs.push('Manifest loaded: No (404)');
        }
      })
      .catch(err => {
        logs.push(`Manifest error: ${err.message}`);
      });

    // Check service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => {
          const hasActive = registrations.some(reg => reg.active);
          setServiceWorkerActive(hasActive);
          logs.push(`Service worker active: ${hasActive ? 'Yes' : 'No'}`);
        })
        .catch(err => {
          logs.push(`Service worker error: ${err.message}`);
        });
    } else {
      logs.push('Service worker: Not supported');
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallReady(true);
      logs.push('Install prompt ready: Yes');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check after a delay (browser needs time to evaluate)
    setTimeout(() => {
      if (!installReady) {
        logs.push('Install prompt ready: No (not triggered yet)');
      }
      setDebugInfo(logs);
    }, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  return (
    <div className="p-4 rounded-xl" style={{ 
      background: 'rgba(20,15,10,0.8)', 
      border: '1px solid rgba(201,169,110,0.2)' 
    }}>
      <div className="flex items-center gap-2 mb-4">
        <Smartphone className="w-5 h-5" style={{ color: '#fbbf24' }} />
        <h3 className="font-fantasy text-sm" style={{ color: '#c9a96e' }}>PWA Installation Status</h3>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          {isInstalled ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <X className="w-4 h-4 text-slate-500" />
          )}
          <span style={{ color: isInstalled ? '#86efac' : '#94a3b8' }}>
            {isInstalled ? 'App is installed' : 'App not installed'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {browserSupport ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-yellow-500" />
          )}
          <span style={{ color: browserSupport ? '#86efac' : '#fbbf24' }}>
            Browser supports PWA: {browserSupport ? 'Yes' : 'No'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {manifestLoaded ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <X className="w-4 h-4 text-red-500" />
          )}
          <span style={{ color: manifestLoaded ? '#86efac' : '#fca5a5' }}>
            Manifest loaded: {manifestLoaded ? 'Yes' : 'No'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {serviceWorkerActive ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-yellow-500" />
          )}
          <span style={{ color: serviceWorkerActive ? '#86efac' : '#fbbf24' }}>
            Service worker active: {serviceWorkerActive ? 'Yes' : 'No (may load later)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {installReady ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-yellow-500" />
          )}
          <span style={{ color: installReady ? '#86efac' : '#fbbf24' }}>
            Install prompt ready: {installReady ? 'Yes' : 'No (needs user engagement)'}
          </span>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <div className="text-xs font-fantasy mb-2" style={{ color: 'rgba(201,169,110,0.6)' }}>DEBUG LOG:</div>
        <div className="text-xs text-slate-400 space-y-1">
          {debugInfo.map((log, i) => (
            <div key={i}>• {log}</div>
          ))}
        </div>
      </div>

      {!isInstalled && browserSupport && installReady && (
        <div className="mt-4 p-3 rounded-lg" style={{ 
          background: 'rgba(40,100,60,0.2)', 
          border: '1px solid rgba(40,160,80,0.3)' 
        }}>
          <div className="text-xs text-green-400 font-fantasy mb-1">
            ✅ Install is ready!
          </div>
          <div className="text-xs text-slate-400">
            Click the "Install App" button in the header or wait for the auto-prompt.
          </div>
        </div>
      )}

      {!browserSupport && (
        <div className="mt-4 p-3 rounded-lg" style={{ 
          background: 'rgba(120,40,40,0.2)', 
          border: '1px solid rgba(220,80,80,0.3)' 
        }}>
          <div className="text-xs text-red-400 font-fantasy mb-1">
            ⚠️ Browser doesn't support PWA
          </div>
          <div className="text-xs text-slate-400">
            Please use Chrome, Edge, or Safari for installation.
          </div>
        </div>
      )}
    </div>
  );
}