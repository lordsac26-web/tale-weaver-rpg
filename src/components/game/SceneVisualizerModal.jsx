import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SceneVisualizerModal({ narrative, session, character, onClose }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { generateScene(); }, []);

  const generateScene = async () => {
    setLoading(true);
    setError(null);

    const recentNarration = narrative
      .filter(e => e.type === 'narration')
      .slice(-3)
      .map(e => e.text)
      .join(' ')
      .slice(0, 600);

    const prompt = `Epic high fantasy digital oil painting, cinematic composition, dramatic lighting.
D&D adventure scene: ${recentNarration}
Location: ${session?.current_location || 'fantasy realm'}. Time: ${session?.time_of_day || 'day'}. Season: ${session?.season || 'Spring'}.
Hero: ${character?.name}, a ${character?.race} ${character?.class}.
Style: detailed, atmospheric, award-winning fantasy concept art, rich colors, painterly. No text or UI elements.`;

    try {
      const result = await base44.integrations.Core.GenerateImage({ prompt });
      setImageUrl(result.url);
    } catch (e) {
      setError('The vision was lost in the mists... try again.');
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="relative max-w-2xl w-full rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(201,169,110,0.3)', background: '#0d0a07', boxShadow: '0 0 60px rgba(201,169,110,0.08)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid rgba(180,140,90,0.12)', background: 'rgba(15,10,4,0.9)' }}>
          <span className="font-fantasy text-xs tracking-widest text-glow-gold" style={{ color: '#c9a96e' }}>
            ✦ SCENE VISION ✦
          </span>
          <div className="flex items-center gap-2">
            <button onClick={generateScene} disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg btn-fantasy disabled:opacity-40">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Casting...' : 'Regenerate'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'rgba(201,169,110,0.4)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="relative" style={{ minHeight: '420px', background: 'rgba(10,6,3,0.8)' }}>
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'rgba(201,169,110,0.6)' }} />
              <p className="font-fantasy text-sm" style={{ color: 'rgba(201,169,110,0.5)' }}>The vision materializes...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
              <p className="text-sm italic" style={{ color: 'rgba(255,100,100,0.6)', fontFamily: 'IM Fell English, serif' }}>{error}</p>
            </div>
          )}
          {imageUrl && (
            <img src={imageUrl} alt="Scene visualization"
              className="w-full object-cover" style={{ maxHeight: '520px', objectFit: 'cover' }} />
          )}
        </div>

        {/* Caption */}
        <div className="px-5 py-2.5" style={{ borderTop: '1px solid rgba(180,140,90,0.08)' }}>
          <p className="text-xs italic text-center"
            style={{ color: 'rgba(201,169,110,0.35)', fontFamily: 'IM Fell English, serif' }}>
            {session?.current_location || 'Unknown realm'} · {session?.time_of_day || 'Unknown hour'} · {session?.season || ''}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}