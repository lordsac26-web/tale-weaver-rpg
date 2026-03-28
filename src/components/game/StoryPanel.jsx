import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Loader2, Scroll, Feather, Volume2, VolumeX, Pause, Play, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SkillCheckResult from './SkillCheckResult';
import { base44 } from '@/api/base44Client';
 
const RISK_STYLES = {
  low:     { border: 'rgba(40,160,80,0.35)',  bg: 'rgba(10,40,15,0.5)',  hover: 'rgba(40,160,80,0.5)',  badge: { bg: 'rgba(10,50,20,0.7)', color: '#86efac', border: 'rgba(40,160,80,0.4)' } },
  medium:  { border: 'rgba(200,150,20,0.35)', bg: 'rgba(40,30,5,0.5)',   hover: 'rgba(200,150,20,0.5)', badge: { bg: 'rgba(60,40,5,0.7)',  color: '#fde68a', border: 'rgba(200,150,20,0.4)' } },
  high:    { border: 'rgba(200,80,20,0.35)',  bg: 'rgba(40,15,5,0.5)',   hover: 'rgba(200,80,20,0.5)',  badge: { bg: 'rgba(60,20,5,0.7)',  color: '#fdba74', border: 'rgba(200,80,20,0.4)' } },
  extreme: { border: 'rgba(180,20,20,0.4)',   bg: 'rgba(40,5,5,0.5)',    hover: 'rgba(180,20,20,0.6)',  badge: { bg: 'rgba(60,5,5,0.7)',   color: '#fca5a5', border: 'rgba(180,20,20,0.45)' } },
};
 
// Truncate narration text to first N characters at a sentence boundary.
function truncateForNarration(text, maxChars = 800) {
  if (!text || text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  // Try to cut at the last sentence boundary within the slice
  const lastPeriod = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  return lastPeriod > 100 ? slice.slice(0, lastPeriod + 1) : slice;
}
 
export default function StoryPanel({ narrative, choices, loading, onChoice, customInput, setCustomInput, onCustomSubmit }) {
  const endRef = useRef(null);
  const [narrationEnabled, setNarrationEnabled] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('narratorVoice') || 'eloquent');
  const [volume, setVolume] = useState(() => parseFloat(localStorage.getItem('narratorVolume') ?? '1'));
  const lastNarratedIndex = useRef(-1);
  const currentUtterance = useRef(null);
  const cancelledRef = useRef(false);
 
  // Auto-scroll on new narrative entries
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [narrative, loading]);

  // Cleanup speech synthesis on unmount to prevent orphaned audio
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      currentUtterance.current = null;
      cancelledRef.current = true;
    };
  }, []);

  // Apply volume changes to the currently playing utterance in real-time
  useEffect(() => {
    if (currentUtterance.current) {
      currentUtterance.current.volume = volume;
    }
  }, [volume]);
 
  // Trigger narration on new narration entries — non-blocking
  useEffect(() => {
    if (!narrationEnabled || loading) return;
    const narrationEntries = narrative.filter(e => e.type === 'narration');
    const latestIndex = narrationEntries.length - 1;
    if (latestIndex > lastNarratedIndex.current) {
      lastNarratedIndex.current = latestIndex;
      // Fire and forget — don't await, text is already visible
      narrateText(narrationEntries[latestIndex].text);
    }
  }, [narrative, narrationEnabled, loading]);
 
  const VOICE_PRESETS = {
    eloquent: { name: 'Eloquent Scholar', filter: ['Daniel', 'Google UK', 'British'], rate: 0.92, pitch: 1.0, desc: 'Refined and scholarly' },
    heroic: { name: 'Heroic Narrator', filter: ['Alex', 'Microsoft David'], rate: 0.88, pitch: 0.95, desc: 'Bold and commanding' },
    mysterious: { name: 'Mysterious Sage', filter: ['Samantha', 'Google US'], rate: 0.85, pitch: 0.9, desc: 'Deep and enigmatic' },
    energetic: { name: 'Energetic Bard', filter: ['Karen', 'Zira'], rate: 1.05, pitch: 1.1, desc: 'Lively and dramatic' },
    ancient: { name: 'Ancient Elder', filter: ['Fred', 'Rishi'], rate: 0.80, pitch: 0.85, desc: 'Slow and wise' },
  };
 
  const narrateText = async (text) => {
    if (!text?.trim()) return;

    cancelledRef.current = false;
    setIsPaused(false);

    // Stop any currently playing speech
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    if (currentUtterance.current) {
      currentUtterance.current = null;
    }
 
    // Split text into chunks to prevent cutoff (Chrome has ~300 char limit for some voices)
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > 200 && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
 
    try {
      setAudioLoading(true);
      
      // Wait for voices to load
      let voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        await new Promise(resolve => {
          window.speechSynthesis.onvoiceschanged = () => {
            voices = window.speechSynthesis.getVoices();
            resolve();
          };
          setTimeout(resolve, 100); // fallback
        });
        voices = window.speechSynthesis.getVoices();
      }
 
      // Select voice based on preset
      const preset = VOICE_PRESETS[selectedVoice] || VOICE_PRESETS.eloquent;
      let voice = null;
      for (const filter of preset.filter) {
        voice = voices.find(v => v.name.includes(filter));
        if (voice) break;
      }
      if (!voice) voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
 
      setAudioLoading(false);
      setIsNarrating(true);
 
      // Speak chunks sequentially with resumption to prevent Chrome cutoff
      for (let i = 0; i < chunks.length; i++) {
        if (cancelledRef.current) break;
        await new Promise((resolve) => {
          if (cancelledRef.current) { resolve(); return; }
          
          const utterance = new SpeechSynthesisUtterance(chunks[i]);
          utterance.voice = voice;
          utterance.rate = preset.rate;
          utterance.pitch = preset.pitch;
          utterance.volume = volume;
          
          currentUtterance.current = utterance;

          // Workaround for Chrome bug: resume every 10 seconds to prevent silence cutoff
          const resumeInterval = setInterval(() => {
            if (window.speechSynthesis.speaking && window.speechSynthesis.paused && !isPaused) {
              window.speechSynthesis.resume();
            }
          }, 10000);

          utterance.onend = () => {
            clearInterval(resumeInterval);
            resolve();
          };
          utterance.onerror = (e) => {
            if (e.error !== 'canceled') console.error('Speech error:', e);
            clearInterval(resumeInterval);
            resolve(); // continue to next chunk
          };

          window.speechSynthesis.speak(utterance);
        });
      }
 
      setIsNarrating(false);
      currentUtterance.current = null;
    } catch (error) {
      console.error('Narration failed:', error);
      setAudioLoading(false);
      setIsNarrating(false);
    }
  };
 
  const toggleNarration = () => {
    const newState = !narrationEnabled;
    setNarrationEnabled(newState);
    if (!newState) {
      stopNarration();
    }
  };

  const stopNarration = useCallback(() => {
    cancelledRef.current = true;
    window.speechSynthesis.cancel();
    currentUtterance.current = null;
    setIsNarrating(false);
    setIsPaused(false);
    setAudioLoading(false);
  }, []);

  const togglePause = useCallback(() => {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isPaused]);

  const replayLast = useCallback(() => {
    const narrationEntries = narrative.filter(e => e.type === 'narration');
    if (narrationEntries.length === 0) return;
    narrateText(narrationEntries[narrationEntries.length - 1].text);
  }, [narrative, selectedVoice, volume]);
 
  const handleVoiceChange = (voiceKey) => {
    setSelectedVoice(voiceKey);
    localStorage.setItem('narratorVoice', voiceKey);
    setShowVoiceMenu(false);
  };
 
  // Narration button label
  const narrationLabel = audioLoading
    ? 'Loading...'
    : isNarrating && isPaused
    ? 'Paused'
    : isNarrating
    ? 'Playing ♪'
    : narrationEnabled
    ? 'Narration On'
    : 'Narration Off';
 
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Narration Toggle */}
      <div className="flex-shrink-0 px-4 py-2 flex items-center justify-end gap-2 relative"
        style={{ background: 'rgba(8,5,2,0.6)', borderBottom: '1px solid rgba(180,140,90,0.15)' }}>
        
        {/* Voice selector dropdown + playback controls + volume slider */}
        {narrationEnabled && (
          <div className="flex items-center gap-2">
            {/* Playback controls when narrating */}
            {isNarrating && (
              <div className="flex items-center gap-1">
                <button onClick={togglePause}
                  className="p-1.5 rounded-lg transition-all"
                  title={isPaused ? 'Resume' : 'Pause'}
                  style={{ background: 'rgba(30,20,8,0.6)', border: '1px solid rgba(180,140,90,0.25)', color: 'rgba(201,169,110,0.7)' }}>
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </button>
                <button onClick={stopNarration}
                  className="p-1.5 rounded-lg transition-all"
                  title="Stop"
                  style={{ background: 'rgba(30,20,8,0.6)', border: '1px solid rgba(180,140,90,0.25)', color: 'rgba(201,169,110,0.7)' }}>
                  <Square className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {/* Replay last narration when idle */}
            {!isNarrating && narrative.some(e => e.type === 'narration') && (
              <button onClick={replayLast}
                className="p-1.5 rounded-lg transition-all"
                title="Replay last narration"
                style={{ background: 'rgba(30,20,8,0.6)', border: '1px solid rgba(180,140,90,0.25)', color: 'rgba(201,169,110,0.7)' }}>
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setShowVoiceMenu(v => !v); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-fantasy transition-all"
                style={{ background: 'rgba(30,20,8,0.6)', border: '1px solid rgba(180,140,90,0.25)', color: 'rgba(201,169,110,0.6)' }}>
                🎭 {VOICE_PRESETS[selectedVoice]?.name || 'Voice'}
              </button>
              
              <AnimatePresence>
                {showVoiceMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[200px]"
                    style={{ background: 'rgba(15,8,3,0.98)', border: '1px solid rgba(180,140,90,0.3)' }}>
                    {Object.entries(VOICE_PRESETS).map(([key, preset], i) => (
                      <button key={key}
                        onClick={() => handleVoiceChange(key)}
                        className="w-full text-left px-3 py-2.5 transition-all"
                        style={{ 
                          borderBottom: i < Object.keys(VOICE_PRESETS).length - 1 ? '1px solid rgba(180,140,90,0.08)' : 'none',
                          background: selectedVoice === key ? 'rgba(80,50,10,0.5)' : 'transparent'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(60,35,10,0.5)'}
                        onMouseLeave={e => e.currentTarget.style.background = selectedVoice === key ? 'rgba(80,50,10,0.5)' : 'transparent'}>
                        <div className="text-xs font-fantasy" style={{ color: selectedVoice === key ? '#f0c040' : 'rgba(232,213,183,0.8)' }}>
                          {preset.name}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
                          {preset.desc}
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Volume slider */}
            <div className="flex items-center gap-1.5">
              <VolumeX className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(201,169,110,0.35)' }} />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  localStorage.setItem('narratorVolume', String(v));
                  // Apply to currently playing utterance immediately
                  if (currentUtterance.current) {
                    currentUtterance.current.volume = v;
                  }
                }}
                className="w-20 h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgba(201,169,110,0.7) ${volume * 100}%, rgba(60,40,15,0.5) ${volume * 100}%)`,
                  accentColor: '#c9a96e',
                }}
                title={`Volume: ${Math.round(volume * 100)}%`}
              />
              <Volume2 className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(201,169,110,0.35)' }} />
            </div>
          </div>
        )}
        
        <button onClick={toggleNarration}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-fantasy transition-all"
          style={narrationEnabled ? {
            background: 'rgba(80,50,10,0.7)',
            border: '1px solid rgba(201,169,110,0.5)',
            color: '#f0c040',
          } : {
            background: 'rgba(20,13,5,0.6)',
            border: '1px solid rgba(180,140,90,0.2)',
            color: 'rgba(201,169,110,0.5)',
          }}>
          {audioLoading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : narrationEnabled
            ? <Volume2 className="w-3.5 h-3.5" />
            : <VolumeX className="w-3.5 h-3.5" />
          }
          {narrationLabel}
        </button>
      </div>
 
      {/* Narrative Area */}
      <div className="flex-1 overflow-y-auto p-5 md:p-7 space-y-5 min-h-0" style={{ background: 'transparent' }}>
        <AnimatePresence initial={false}>
          {narrative.map((entry, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}>
 
              {entry.type === 'narration' && (
                <div className="relative">
                  <p className="leading-8 text-base md:text-lg whitespace-pre-wrap"
                    style={{
                      color: 'rgba(232,213,183,0.92)',
                      fontFamily: 'IM Fell English, Georgia, serif',
                      textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                      lineHeight: '1.9'
                    }}>
                    {entry.text}
                  </p>
                </div>
              )}
 
              {entry.type === 'player_action' && (
                <div className="flex justify-end">
                  <div className="rounded-xl px-4 py-3 max-w-md text-sm italic"
                    style={{
                      background: 'rgba(20,40,80,0.45)',
                      border: '1px solid rgba(80,120,220,0.3)',
                      color: '#93c5fd',
                      fontFamily: 'EB Garamond, serif',
                      boxShadow: '0 0 16px rgba(60,100,220,0.08), inset 0 1px 0 rgba(100,150,255,0.1)',
                    }}>
                    <span style={{ color: 'rgba(147,197,253,0.5)', marginRight: '0.5em' }}>You:</span>
                    {entry.text}
                  </div>
                </div>
              )}
 
              {entry.type === 'skill_check' && (
                <SkillCheckResult entry={entry} />
              )}
 
              {entry.type === 'roll_result' && (
                <div className="flex justify-center">
                  <motion.div
                    initial={{ scale: 0.75, y: 8 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold font-fantasy"
                    style={entry.success ? {
                      background: 'rgba(10,50,20,0.65)',
                      border: '1px solid rgba(40,160,80,0.45)',
                      color: '#86efac',
                      boxShadow: '0 0 12px rgba(40,160,80,0.12)',
                    } : {
                      background: 'rgba(50,5,5,0.65)',
                      border: '1px solid rgba(180,30,30,0.45)',
                      color: '#fca5a5',
                      boxShadow: '0 0 12px rgba(180,30,30,0.12)',
                    }}>
                    🎲 {entry.text}
                  </motion.div>
                </div>
              )}
 
              {entry.type === 'combat_start' && (
                <div className="text-center py-3">
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="inline-block px-8 py-3 rounded-xl font-fantasy font-bold text-sm tracking-widest uppercase combat-active"
                    style={{
                      background: 'rgba(80,5,5,0.8)',
                      border: '1px solid rgba(180,30,30,0.6)',
                      color: '#fca5a5',
                      textShadow: '0 0 12px rgba(220,50,50,0.5)',
                    }}>
                    ⚔️ &nbsp; Combat Begins! &nbsp; ⚔️
                  </motion.div>
                </div>
              )}
 
              {entry.type === 'xp_gain' && (
                <motion.div className="text-center"
                  initial={{ scale: 0.7, opacity: 0, y: -10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 400 }}>
                  <span className="font-fantasy text-sm font-semibold"
                    style={{ color: '#f0c040', textShadow: '0 0 16px rgba(201,169,110,0.6)' }}>
                    ✨ {entry.text}
                  </span>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
 
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-3 py-2">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'rgba(201,169,110,0.6)' }} />
            <span className="text-sm italic" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'IM Fell English, serif' }}>
              The story unfolds...
            </span>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>
 
      {/* Choices + Input — always rendered so player can type freely even while loading */}
      <div className="flex-shrink-0 p-4 space-y-2.5"
          style={{
            background: 'rgba(8,5,2,0.85)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(180,140,90,0.2)',
            boxShadow: 'inset 0 1px 0 rgba(201,169,110,0.08)'
          }}>
          {!loading && choices.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-2" style={{ color: 'rgba(201,169,110,0.5)' }}>
                <Scroll className="w-3 h-3" />
                <span className="font-fantasy text-xs tracking-widest uppercase">What do you do?</span>
              </div>
              <AnimatePresence>
                {choices.map((choice, i) => {
                  const riskStyle = RISK_STYLES[choice.risk_level] || RISK_STYLES['low'];
                  return (
                    <motion.button key={i}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07, duration: 0.3 }}
                      onClick={() => onChoice(i)}
                      className="w-full text-left p-4 rounded-xl transition-all duration-200 group"
                      style={{
                        background: riskStyle.bg,
                        border: `1px solid ${riskStyle.border}`,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = riskStyle.hover; e.currentTarget.style.boxShadow = `0 0 12px ${riskStyle.border}`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = riskStyle.border; e.currentTarget.style.boxShadow = 'none'; }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="font-fantasy font-bold text-sm flex-shrink-0 mt-0.5"
                            style={{ color: 'rgba(201,169,110,0.6)' }}>{i + 1}.</span>
                          <span className="text-sm leading-relaxed"
                            style={{ color: 'rgba(232,213,183,0.9)', fontFamily: 'EB Garamond, serif', fontSize: '1rem' }}>
                            {choice.text}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {choice.skill_check && choice.dc && (
                            <span className="px-2 py-1 rounded-full text-xs font-fantasy"
                              style={{ background: riskStyle.badge.bg, color: riskStyle.badge.color, border: `1px solid ${riskStyle.badge.border}` }}>
                              {choice.skill_check} DC{choice.dc}
                            </span>
                          )}
                          {choice.risk_level && (
                            <span className="px-2 py-1 rounded-full text-xs font-fantasy"
                              style={{ background: riskStyle.badge.bg, color: riskStyle.badge.color, border: `1px solid ${riskStyle.badge.border}` }}>
                              {choice.risk_level}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </>
          )}
 
          {/* Custom input */}
          <div className="flex gap-2 mt-3">
            <div className="flex-1 relative">
              <Feather className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'rgba(201,169,110,0.3)' }} />
              <input
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && customInput.trim() && onCustomSubmit()}
                placeholder={choices.length > 0 ? 'Or write your own action...' : 'Describe your action...'}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm input-fantasy"
                style={{ fontFamily: 'EB Garamond, serif', fontSize: '1rem' }}
              />
            </div>
            <button onClick={onCustomSubmit} disabled={!customInput.trim()}
              className="px-5 py-2.5 rounded-xl text-sm btn-fantasy disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontSize: '0.85rem', letterSpacing: '0.05em' }}>
              Act
            </button>
          </div>
      </div>
    </div>
  );
}