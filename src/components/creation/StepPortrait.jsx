import React, { useState } from 'react';
import { Wand2, Loader2, Download, RefreshCw, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';

const STYLE_PRESETS = [
  { label: 'Fantasy Oil Painting', value: 'fantasy oil painting, dramatic lighting, detailed, masterful brushwork' },
  { label: 'Epic Illustration', value: 'epic digital art illustration, vibrant colors, cinematic, highly detailed' },
  { label: 'Dark Fantasy', value: 'dark fantasy art, moody atmospheric, gritty, gothic aesthetic, painterly' },
  { label: 'Anime Style', value: 'anime art style, vibrant, expressive, clean lines, cel shading' },
  { label: 'Realistic Portrait', value: 'realistic portrait, photorealistic, dramatic lighting, hyper detailed' },
];

export default function StepPortrait({ character, set }) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState(STYLE_PRESETS[0].value);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState(character.portrait || null);
  const [error, setError] = useState(null);

  const buildFullPrompt = () => {
    const gender = character.gender || 'person';
    const race = character.race || 'human';
    const cls = character.class || 'adventurer';
    const customPart = prompt.trim() ? `, ${prompt.trim()}` : '';
    return `Character portrait of a ${gender} ${race} ${cls}${customPart}, ${style}, fantasy RPG character art, dramatic pose, full focus on face and upper body, highly detailed armor and clothing, professional artwork`;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    const fullPrompt = buildFullPrompt();
    const result = await base44.integrations.Core.GenerateImage({ prompt: fullPrompt });
    if (result?.url) {
      setGeneratedUrl(result.url);
      set('portrait', result.url);
    } else {
      setError('Generation failed. Please try again.');
    }
    setGenerating(false);
  };

  const handleDownload = async () => {
    if (!generatedUrl) return;
    const response = await fetch(generatedUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name || 'character'}-portrait.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">Character Portrait</h2>
        <p className="text-amber-400/50 text-sm">Generate an AI portrait for your hero. You can regenerate as many times as you like.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div>
            <label className="text-amber-400/80 text-xs uppercase tracking-widest mb-1.5 block">Art Style</label>
            <div className="flex flex-col gap-2">
              {STYLE_PRESETS.map(p => (
                <button key={p.label} onClick={() => setStyle(p.value)}
                  className={`px-3 py-2 rounded-lg text-sm border text-left transition-all ${style === p.value ? 'border-purple-500 bg-purple-900/20 text-purple-200' : 'border-slate-700/40 text-slate-400 hover:border-purple-600/40'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-amber-400/80 text-xs uppercase tracking-widest mb-1.5 block">Extra Details (optional)</label>
            <Textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. scarred face, silver hair, emerald eyes, wearing ancient elven armor, holding a glowing staff..."
              className="bg-slate-800/60 border-slate-600 text-amber-100 placeholder-slate-500 h-24 text-sm" />
          </div>

          <div className="bg-slate-800/40 rounded-lg p-3 text-xs text-slate-500">
            Auto-built from your character: <span className="text-slate-400">{character.gender} {character.race} {character.class}</span>
          </div>

          <Button onClick={handleGenerate} disabled={generating} className="w-full bg-purple-800/60 hover:bg-purple-700 border border-purple-600/50">
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
            {generating ? 'Painting your hero...' : generatedUrl ? 'Regenerate Portrait' : 'Generate Portrait'}
          </Button>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <p className="text-slate-600 text-xs">Portrait generation is optional — you can skip this step.</p>
        </div>

        {/* Preview */}
        <div className="flex flex-col items-center justify-start">
          <div className="w-full aspect-square max-w-xs rounded-2xl overflow-hidden border-2 border-slate-700/50 bg-slate-800/40 flex items-center justify-center relative">
            <AnimatePresence mode="wait">
              {generating ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3 text-center p-6">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-purple-700/40 border-t-purple-400 animate-spin" />
                    <Wand2 className="w-6 h-6 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-purple-400/70 text-sm">The artist paints your legend...</p>
                </motion.div>
              ) : generatedUrl ? (
                <motion.img key="portrait" src={generatedUrl} alt="Character portrait"
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="w-full h-full object-cover" />
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-3 text-slate-600">
                  <ImageIcon className="w-16 h-16 opacity-20" />
                  <p className="text-sm">Your portrait will appear here</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {generatedUrl && !generating && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex gap-2">
              <Button onClick={handleDownload} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 text-sm gap-2">
                <Download className="w-4 h-4" /> Download
              </Button>
              <Button onClick={handleGenerate} variant="outline" className="border-purple-700/50 text-purple-300 hover:bg-purple-900/20 text-sm gap-2">
                <RefreshCw className="w-4 h-4" /> Regenerate
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}