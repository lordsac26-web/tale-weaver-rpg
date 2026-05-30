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

    // Check browser support - Chrome/Edge/Safari all support PWA
    const userAgent = navigator.userAgent;
    const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    const hasInstallSupport = isChrome || isEdge || isSafari;
    setBrowserSupport(hasInstallSupport);
    logs.push(`Browser: ${isChrome ? 'Chrome' : isEdge ? 'Edge' : isSafari ? 'Safari' : 'Other'}`);
    logs.push(`Browser supports PWA: ${hasInstallSupport ? 'Yes (Chrome/Edge/Safari)' : 'No'}`);

    // Check manifest
    fetch('/manifest.json')
      .then(r => {
        console.log('[PWA] Manifest response:', r.status, r.ok);
        if (r.ok) {
          setManifestLoaded(true);
          logs.push('✓ Manifest loaded successfully');
          return r.json();
        } else {
          setManifestLoaded(false);
          logs.push(`✗ Manifest error: ${r.status}`);
        }
      })
      .catch(err => {
        setManifestLoaded(false);
        console.error('[PWA] Manifest fetch error:', err);
        logs.push(`✗ Manifest fetch failed: ${err.message}`);
      });

    // Check service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => {
          console.log('[PWA] Service worker registrations:', registrations);
          const hasActive = registrations.some(reg => reg.active);
          setServiceWorkerActive(hasActive);
          logs.push(`✓ Service worker: ${hasActive ? 'Active' : 'Registered (waiting)'}`);
          if (!hasActive) {
            logs.push('  (May take a few seconds to activate)');
          }
        })
        .catch(err => {
          console.error('[PWA] SW registration check failed:', err);
          logs.push(`✗ Service worker error: ${err.message}`);
        });
    } else {
      logs.push('✗ Service worker: Not supported by browser');
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      console.log('✅ beforeinstallprompt event fired!');
      setInstallReady(true);
      logs.push('Install prompt ready: Yes (event fired)');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check after delays (browser needs time to evaluate)
    setTimeout(() => {
      if (!installReady) {
        logs.push('Install prompt: Not ready yet (browser still evaluating)');
      }
      setDebugInfo(logs);
    }, 3000);

    // Second check at 30 seconds (browser minimum)
    setTimeout(() => {
      if (!installReady) {
        logs.push('Install prompt: Still not ready (need more user engagement)');
        logs.push('TIP: Click around the app, wait longer, or try manual install');
      }
      setDebugInfo(prev => [...prev, ...logs.filter(l => !prev.includes(l))]);
    }, 30000);

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
            {browserSupport ? 'Browser supports PWA (Chrome/Edge/Safari)' : 'Browser does not support PWA'}
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
            Install prompt: {installReady ? 'Ready! Click install button' : 'Waiting (need 30+ sec of interaction)'}
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

      {browserSupport && !installReady && (
        <div className="mt-4 p-3 rounded-lg" style={{ 
          background: 'rgba(120,80,40,0.2)', 
          border: '1px solid rgba(220,140,80,0.3)' 
        }}>
          <div className="text-xs text-yellow-400 font-fantasy mb-1">
            ⏳ Waiting for browser...
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div>Your browser (Chrome/Edge) supports PWA.</div>
            <div>The install prompt needs:</div>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              <li>30+ seconds of page interaction</li>
              <li>Service worker to fully activate</li>
              <li>Browser to evaluate the app</li>
            </ul>
            <div className="mt-2 text-green-400">
              💡 Try: Click around the app, then check back in 30 seconds
            </div>
            <div className="text-blue-400">
              📥 Or use manual install: Browser menu → "Install" or "Create shortcut"
            </div>
          </div>
        </div>
      )}
    </div>
  );
}