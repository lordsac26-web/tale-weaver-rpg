import React, { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Volume2, VolumeX, Loader2, Play, Pause, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * NarrationPlayer — generates and plays AI voice narration for story text.
 * Props:
 *   text       - narrative text to narrate
 *   setting    - campaign setting (e.g. "Dark Fantasy") for voice selection
 *   mood       - optional mood hint ("tense", "calm", or null)
 *   autoPlay   - whether to auto-generate on new text (default: false)
 *   enabled    - master toggle from parent (default: true)
 */
export default function NarrationPlayer({ text, setting, mood, autoPlay = false, enabled = true }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const lastTextRef = useRef('');

  // Generate voice narration
  const generate = useCallback(async () => {
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    setAudioUrl(null);

    const result = await base44.functions.invoke('generateVoiceNarration', {
      text,
      setting: setting || 'High Fantasy',
      mood: mood || null,
    });

    if (result.data?.audio_url) {
      setAudioUrl(result.data.audio_url);
    } else {
      setError(result.data?.error || 'Voice generation failed');
    }
    setLoading(false);
  }, [text, setting, mood, loading]);

  // Auto-play when new narration text arrives
  useEffect(() => {
    if (autoPlay && enabled && text && text !== lastTextRef.current) {
      lastTextRef.current = text;
      generate();
    }
  }, [text, autoPlay, enabled]);

  // Auto-play audio when URL is ready
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  if (!enabled) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
      )}

      {/* Generate / Play controls */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{
              background: 'rgba(20,13,5,0.8)',
              border: '1px solid rgba(201,169,110,0.25)',
            }}
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'rgba(201,169,110,0.6)' }} />
            <span className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.5)' }}>
              Generating voice...
            </span>
          </motion.div>
        ) : audioUrl ? (
          <motion.div
            key="player"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1"
          >
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg transition-all"
              style={{
                background: playing ? 'rgba(40,80,40,0.6)' : 'rgba(20,13,5,0.8)',
                border: `1px solid ${playing ? 'rgba(80,180,80,0.4)' : 'rgba(201,169,110,0.25)'}`,
                color: playing ? '#86efac' : 'rgba(201,169,110,0.6)',
              }}
              title={playing ? 'Pause narration' : 'Play narration'}
            >
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={generate}
              className="p-1.5 rounded-lg transition-all"
              style={{
                background: 'rgba(20,13,5,0.8)',
                border: '1px solid rgba(201,169,110,0.15)',
                color: 'rgba(201,169,110,0.4)',
              }}
              title="Regenerate narration"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="generate"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={generate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: 'rgba(20,13,5,0.8)',
              border: '1px solid rgba(201,169,110,0.25)',
              color: 'rgba(201,169,110,0.6)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(201,169,110,0.5)';
              e.currentTarget.style.color = '#c9a96e';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(201,169,110,0.25)';
              e.currentTarget.style.color = 'rgba(201,169,110,0.6)';
            }}
            title="Generate voice narration"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="text-xs font-fantasy">Narrate</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Error indicator */}
      {error && (
        <span className="text-xs" style={{ color: 'rgba(252,165,165,0.7)', fontFamily: 'EB Garamond, serif' }}>
          {error}
        </span>
      )}
    </div>
  );
}