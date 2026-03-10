import React, { useState, useRef } from 'react';
import { Download, Loader2, Check } from 'lucide-react';

const QUALITY_OPTIONS = [
  { label: '1K', w: 1024, h: 1024 },
  { label: '2K', w: 2048, h: 2048 },
  { label: '4K', w: 4096, h: 4096 },
];

export default function ImageResult({ imageUrl, prompt }) {
  const [downloading, setDownloading] = useState(null);
  const [downloaded, setDownloaded] = useState(null);
  const canvasRef = useRef(null);

  const handleDownload = async (quality) => {
    setDownloading(quality.label);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = quality.w;
      canvas.height = quality.h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, quality.w, quality.h);
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `taleweaver-art-${quality.label.toLowerCase()}-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setDownloading(null);
        setDownloaded(quality.label);
        setTimeout(() => setDownloaded(null), 2000);
      }, 'image/png');
    };
    img.onerror = () => {
      // Fallback: direct download without resize
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = `taleweaver-art-${quality.label.toLowerCase()}-${Date.now()}.png`;
      a.target = '_blank';
      a.click();
      setDownloading(null);
    };
    img.src = imageUrl;
  };

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'linear-gradient(160deg, rgba(28,14,5,0.95), rgba(18,9,3,0.98))', border: '1px solid rgba(184,115,51,0.3)' }}>
      
      {/* Image display */}
      <div className="relative group">
        <img
          src={imageUrl}
          alt={prompt || 'Generated image'}
          className="w-full object-contain"
          style={{ maxHeight: '520px', background: 'rgba(0,0,0,0.5)' }}
        />
      </div>

      {/* Download controls */}
      <div className="p-4">
        <div className="text-xs font-fantasy mb-3" style={{ color: 'rgba(212,149,90,0.5)', letterSpacing: '0.12em' }}>
          DOWNLOAD QUALITY
        </div>
        <div className="flex gap-2">
          {QUALITY_OPTIONS.map(q => {
            const isDownloading = downloading === q.label;
            const isDone = downloaded === q.label;
            return (
              <button
                key={q.label}
                onClick={() => handleDownload(q)}
                disabled={!!downloading}
                className="flex-1 py-2.5 rounded-xl font-fantasy text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{
                  background: 'rgba(60,30,8,0.6)',
                  border: '1px solid rgba(184,115,51,0.3)',
                  color: isDone ? '#86efac' : 'var(--brass-gold)',
                }}
              >
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> :
                 isDone ? <Check className="w-4 h-4" /> :
                 <Download className="w-4 h-4" />}
                {q.label}
              </button>
            );
          })}
        </div>
        {prompt && (
          <p className="mt-3 text-xs font-body italic" style={{ color: 'rgba(201,169,110,0.35)' }}>
            "{prompt.length > 120 ? prompt.slice(0, 120) + '...' : prompt}"
          </p>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}