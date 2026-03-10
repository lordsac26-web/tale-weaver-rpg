import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Wand2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StyleSelector, { getStylePromptPrefix } from '@/components/image/StyleSelector';
import ImageResult from '@/components/image/ImageResult';

export default function ImageCreator() {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('fantasy_art');
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [useEnhanced, setUseEnhanced] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [finalPrompt, setFinalPrompt] = useState('');
  const [history, setHistory] = useState([]);

  const handleEnhancePrompt = async () => {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    const stylePrefix = getStylePromptPrefix(selectedStyle);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert AI image prompt engineer. Take this user description and enhance it into a detailed, vivid image generation prompt that will produce stunning results. Keep the core idea but add artistic details, lighting, composition, and mood.

User description: "${prompt}"
${stylePrefix ? `Intended style: ${stylePrefix}` : ''}

Return ONLY the enhanced prompt text, nothing else. Keep it under 200 words.`,
    });
    setEnhancedPrompt(typeof result === 'string' ? result.trim() : result);
    setUseEnhanced(true);
    setEnhancing(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setImageUrl(null);

    const stylePrefix = getStylePromptPrefix(selectedStyle);
    const basePrompt = useEnhanced && enhancedPrompt ? enhancedPrompt : prompt;
    const fullPrompt = stylePrefix ? `${stylePrefix} ${basePrompt}` : basePrompt;
    setFinalPrompt(fullPrompt);

    const result = await base44.integrations.Core.GenerateImage({
      prompt: fullPrompt,
    });

    setImageUrl(result.url);
    setHistory(prev => [{ url: result.url, prompt: fullPrompt, ts: Date.now() }, ...prev.slice(0, 9)]);
    setGenerating(false);
  };

  return (
    <div className="min-h-screen parchment-bg" style={{ color: 'var(--text-bright)' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center gap-3 px-5 py-3"
        style={{ background: 'rgba(10,5,2,0.95)', borderBottom: '1px solid rgba(184,115,51,0.3)', backdropFilter: 'blur(10px)' }}>
        <Link to={createPageUrl('Home')} className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'rgba(212,149,90,0.5)' }}>
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #e8b86d, #b87333)' }} />
        <ImageIcon className="w-4 h-4" style={{ color: 'var(--brass-gold)' }} />
        <span className="font-fantasy text-sm tracking-widest" style={{ color: 'var(--brass-gold)' }}>Image Forge</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Prompt Input */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(160deg, rgba(28,14,5,0.92), rgba(18,9,3,0.96))', border: '1px solid rgba(184,115,51,0.3)' }}>
          
          <div className="text-xs font-fantasy mb-3" style={{ color: 'rgba(212,149,90,0.5)', letterSpacing: '0.12em' }}>
            DESCRIBE YOUR VISION
          </div>

          <textarea
            value={prompt}
            onChange={e => { setPrompt(e.target.value); setUseEnhanced(false); setEnhancedPrompt(''); }}
            placeholder="A dragon perched on a crumbling castle tower under a blood-red moon..."
            rows={3}
            className="w-full input-fantasy rounded-xl px-4 py-3 text-sm resize-none font-body"
            style={{ lineHeight: 1.6 }}
          />

          {/* Enhanced prompt display */}
          <AnimatePresence>
            {enhancedPrompt && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 rounded-xl p-3 overflow-hidden"
                style={{ background: 'rgba(65,22,110,0.15)', border: '1px solid rgba(150,90,230,0.25)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-fantasy" style={{ color: '#c4b5fd', letterSpacing: '0.1em' }}>
                    ✨ AI ENHANCED PROMPT
                  </span>
                  <button
                    onClick={() => { setUseEnhanced(!useEnhanced); }}
                    className="text-xs font-fantasy px-2 py-0.5 rounded-full transition-all"
                    style={{
                      background: useEnhanced ? 'rgba(100,50,180,0.3)' : 'rgba(60,30,8,0.5)',
                      border: `1px solid ${useEnhanced ? 'rgba(150,90,230,0.5)' : 'rgba(184,115,51,0.3)'}`,
                      color: useEnhanced ? '#dfc8ff' : 'var(--brass-gold)',
                    }}>
                    {useEnhanced ? 'Using Enhanced' : 'Use Original'}
                  </button>
                </div>
                <p className="text-xs font-body leading-relaxed" style={{ color: 'rgba(196,181,253,0.7)' }}>
                  {enhancedPrompt}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleEnhancePrompt}
              disabled={!prompt.trim() || enhancing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-fantasy text-xs transition-all btn-arcane disabled:opacity-30">
              {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {enhancing ? 'Enhancing...' : 'AI Enhance Prompt'}
            </button>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generating}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-fantasy text-sm transition-all btn-fantasy disabled:opacity-30">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Forging Image...' : 'Generate Image'}
            </button>
          </div>
        </motion.div>

        {/* Style Selector */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(160deg, rgba(28,14,5,0.92), rgba(18,9,3,0.96))', border: '1px solid rgba(184,115,51,0.25)' }}>
          <div className="text-xs font-fantasy mb-3" style={{ color: 'rgba(212,149,90,0.5)', letterSpacing: '0.12em' }}>
            ART STYLE
          </div>
          <StyleSelector selected={selectedStyle} onSelect={setSelectedStyle} />
        </motion.div>

        {/* Generating indicator */}
        <AnimatePresence>
          {generating && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-2xl p-12 text-center"
              style={{ background: 'linear-gradient(160deg, rgba(28,14,5,0.92), rgba(18,9,3,0.96))', border: '1px solid rgba(184,115,51,0.25)' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
                <Sparkles className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--brass-gold)' }} />
              </motion.div>
              <p className="font-fantasy text-lg" style={{ color: 'var(--brass-gold)', textShadow: '0 0 18px rgba(184,115,51,0.4)' }}>
                The forge burns bright...
              </p>
              <p className="font-body text-sm mt-2" style={{ color: 'rgba(212,149,90,0.45)' }}>
                Crafting your vision into art
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result */}
        <AnimatePresence>
          {imageUrl && !generating && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}>
              <ImageResult imageUrl={imageUrl} prompt={finalPrompt} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        {history.length > 1 && (
          <div>
            <div className="text-xs font-fantasy mb-3" style={{ color: 'rgba(212,149,90,0.4)', letterSpacing: '0.12em' }}>
              RECENT CREATIONS
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {history.slice(1).map((item, i) => (
                <button
                  key={item.ts}
                  onClick={() => { setImageUrl(item.url); setFinalPrompt(item.prompt); }}
                  className="rounded-xl overflow-hidden transition-all fantasy-card aspect-square"
                  style={{ border: '1px solid rgba(184,115,51,0.2)' }}>
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}