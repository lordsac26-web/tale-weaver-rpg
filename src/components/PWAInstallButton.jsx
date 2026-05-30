import React, { useState } from 'react';
import { Smartphone, Download, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PWAInstallGuide from './PWAInstallGuide';

/**
 * PWAInstallButton - Button to show PWA installation guide
 * Can be placed in settings, help section, or home page
 */
export default function PWAInstallButton() {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <>
      <Button 
        onClick={() => setShowGuide(true)}
        variant="outline"
        className="gap-2"
        style={{ 
          background: 'rgba(201,169,110,0.1)',
          border: '1px solid rgba(201,169,110,0.3)',
          color: '#c9a96e'
        }}
      >
        <Smartphone className="w-4 h-4" />
        Install App
      </Button>

      {showGuide && (
        <PWAInstallGuide onClose={() => setShowGuide(false)} />
      )}
    </>
  );
}