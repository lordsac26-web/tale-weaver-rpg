import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Wand2, Upload, Sparkles, Download, Loader2, Image as ImageIcon, AlertCircle, User, Swords, MapPin, Scroll } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Quality presets ────────────────────────────────────────────────────────────
const QUALITY_PRESETS = {
  '1k': { label: '1K (1024x1024)', size: '1024x1024', desc: 'Standard quality' },
  '2k': { label: '2K (2048x2048)', size: '2048x2048', desc: 'High quality' },
  '4k': { label: '4K (4096x4096)', size: '4096x4096', desc: 'Ultra quality' },
};

// ── Art style presets ──────────────────────────────────────────────────────────
// Each suffix establishes artistic context so Claude treats the request as
// professional fantasy illustration rather than defaulting to conservative output.
const STYLE_PRESETS = {
  dark_fantasy: {
    label: 'Dark Fantasy',
    icon: '🌑',
    desc: 'Gothic, grim, shadowy tones',
    suffix: ', dark fantasy illustration, gothic atmosphere, dramatic chiaroscuro lighting, professional fantasy art, award-winning concept art, oil painting technique, rich moody palette',
  },
  high_fantasy: {
    label: 'High Fantasy',
    icon: '✨',
    desc: 'Epic, heroic, vibrant colors',
    suffix: ', high fantasy illustration, epic heroic composition, vibrant saturated colors, professional fantasy art in the style of Magic: The Gathering card art, masterful digital painting',
  },
  gritty_realism: {
    label: 'Gritty Realism',
    icon: '⚔️',
    desc: 'Weathered, battle-worn, harsh',
    suffix: ', gritty realistic fantasy illustration, weathered battle-worn details, harsh dramatic lighting, professional concept art, hyper-detailed rendering, cinematic composition',
  },
  ethereal: {
    label: 'Ethereal',
    icon: '🌙',
    desc: 'Dreamlike, mystical, soft glow',
    suffix: ', ethereal fantasy illustration, dreamlike mystical atmosphere, soft luminous glow, professional fantasy art, painterly style, atmospheric perspective',
  },
  biomechanical: {
    label: 'Biomechanical',
    icon: '🦾',
    desc: 'H.R. Giger inspired, dark organic machinery',
    suffix: ', biomechanical dark art inspired by H.R. Giger, intricate organic machinery, alien xenomorph aesthetic, dark surrealism, monochromatic with accents, intricate detail, gothic industrial',
  },
  cyberpunk: {
    label: 'Cyberpunk',
    icon: '🌆',
    desc: 'Neon, chrome, dystopian noir',
    suffix: ', cyberpunk noir illustration, neon-lit dystopian atmosphere, chrome and synthetic materials, rain-slicked reflections, professional concept art, cinematic lighting',
  },
  classic_tsr: {
    label: 'TSR Era (70s-80s)',
    icon: '📖',
    desc: 'Larry Elmore, Jeff Easley, Clyde Caldwell',
    suffix: ', classic TSR-era Dungeons & Dragons oil painting illustration, in the style of Larry Elmore and Jeff Easley, 1980s fantasy art, warm rich palette, dramatic heroic lighting, painterly brushwork, iconic D&D sourcebook cover art aesthetic, Basic Set and AD&D era, bold composition, slightly soft edges typical of 1980s printing',
  },
  classic_dnd: {
    label: 'Classic D&D',
    icon: '🎲',
    desc: 'Keith Parkinson, Elmore, Caldwell style',
    suffix: ', classic Advanced Dungeons and Dragons illustration, in the style of Keith Parkinson and Clyde Caldwell, 1980s-1990s TSR fantasy art, vivid storytelling composition, detailed armor and costume, dramatic fantasy lighting, painterly oil technique, Players Handbook and Monster Manual aesthetic',
  },
  frazetta: {
    label: 'Sword & Sorcery',
    icon: '🗡️',
    desc: 'Frazetta, Vallejo, classic S&S pulp',
    suffix: ', sword and sorcery fantasy illustration in the style of Frank Frazetta and Boris Vallejo, classic pulp fantasy art, powerful dynamic figures, dramatic shadow and light, rich earthy tones with vivid highlights, heroic fantasy composition, classic paperback cover art aesthetic',
  },
  beksinski: {
    label: 'Surreal Horror',
    icon: '🕯️',
    desc: 'Beksiński-inspired dark surrealism',
    suffix: ', dark surrealist fantasy art inspired by Zdzisław Beksiński, apocalyptic dreamscapes, muted earthy palette with accents, decayed grandeur, painterly texture',
  },
  none: {
    label: 'No Style',
    icon: '○',
    desc: 'Use prompt as-is',
    suffix: '',
  },
};

// ── Category presets — help users frame prompts the right way ──────────────────
const CATEGORY_PRESETS = {
  character: {
    label: 'Character Portrait',
    icon: <User className="w-4 h-4" />,
    placeholder: 'A battle-hardened female warrior in chainmail, red cape billowing, sword raised against a stormy sky — classic D&D cover art style...',
    contextPrefix: 'Fantasy character portrait: ',
    contextSuffix: ', fantasy RPG character art, detailed face and costume, dynamic heroic pose, professional fantasy illustration',
  },
  combat: {
    label: 'Combat Scene',
    icon: <Swords className="w-4 h-4" />,
    placeholder: 'A paladin and a thief back-to-back in a torchlit dungeon corridor, surrounded by closing skeletons, tense and dramatic...',
    contextPrefix: 'Epic fantasy combat scene: ',
    contextSuffix: ', dynamic action composition, dramatic lighting, battle energy, professional fantasy illustration',
  },
  location: {
    label: 'Location / Scene',
    icon: <MapPin className="w-4 h-4" />,
    placeholder: 'A party of adventurers approaching a vast dragon lair at the base of a volcanic mountain, molten rivers below, smoke above...',
    contextPrefix: 'Fantasy environment concept art: ',
    contextSuffix: ', establishing shot, adventuring party for scale, environmental storytelling, atmospheric depth, professional fantasy concept art',
  },
  creature: {
    label: 'Monster / Creature',
    icon: <Scroll className="w-4 h-4" />,
    placeholder: 'A beholder floating in a dark cavern, central eye glowing malevolently, eye stalks raised, classic Monster Manual style...',
    contextPrefix: 'Fantasy creature design: ',
    contextSuffix: ', creature concept art, detailed anatomy, menacing presence, professional monster design, fantasy RPG bestiary illustration',
  },
  custom: {
    label: 'Custom',
    icon: <Wand2 className="w-4 h-4" />,
    placeholder: 'Describe any scene, character, item, or moment from your campaign...',
    contextPrefix: '',
    contextSuffix: '',
  },
};

export default function ImageForge() {
  const navigate = useNavigate();
  const [mode, setMode]               = useState('describe');
  const [category, setCategory]       = useState('character');
  const [prompt, setPrompt]           = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [quality, setQuality]         = useState('2k');
  const [style, setStyle]             = useState('classic_tsr');
  const [useAiEnhance, setUseAiEnhance] = useState(true);
  const [matureContent, setMatureContent] = useState(false);
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [generating, setGenerating]   = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError]             = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  // Build the final prompt with category context and style suffix.
  // The category prefix/suffix establishes artistic intent so the AI treats
  // the request as professional fantasy illustration from the start.
  const buildFinalPrompt = (rawPrompt) => {
    const cat = CATEGORY_PRESETS[category];
    const styleSuffix = STYLE_PRESETS[style]?.suffix || '';
    const prefix = cat.contextPrefix || '';
    const catSuffix = cat.contextSuffix || '';
    return `${prefix}${rawPrompt.trim()}${catSuffix}${styleSuffix}`;
  };

  const enhancePrompt = async () => {
    if (!prompt.trim()) return;
    setEnhancingPrompt(true);
    setError(null);
    try {
      const result = await base44.functions.invoke('enhanceImagePrompt', {
        prompt: buildFinalPrompt(prompt),
        mature_content: matureContent,
        category,
      });
      if (result.data?.enhanced_prompt) {
        setPrompt(result.data.enhanced_prompt);
      }
    } catch (err) {
      setError('Failed to enhance prompt: ' + err.message);
    } finally {
      setEnhancingPrompt(false);
    }
  };

  const generateImage = async () => {
    setGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      if (mode === 'describe') {
        if (!prompt.trim()) {
          setError('Please provide a description');
          setGenerating(false);
          return;
        }

        const finalPrompt = buildFinalPrompt(prompt);

        const result = await base44.functions.invoke('forgeDndImage', {
          prompt: finalPrompt,
          quality,
          mature_content: matureContent,
          use_ai_enhance: useAiEnhance,
          category,
        });

        if (result.data?.image_url) {
          setGeneratedImage(result.data.image_url);
        } else {
          setError('Failed to generate image');
        }
      } else {
        if (!uploadedImage) {
          setError('Please upload an image first');
          setGenerating(false);
          return;
        }

        const uploadResult = await base44.integrations.Core.UploadFile({ file: uploadedImage });

        const basePrompt = prompt.trim() || 'Transform this into a D&D fantasy art style';
        const finalPrompt = buildFinalPrompt(basePrompt);

        const result = await base44.functions.invoke('forgeDndImage', {
          reference_image_url: uploadResult.file_url,
          prompt: finalPrompt,
          quality,
          mature_content: matureContent,
          use_ai_enhance: useAiEnhance,
          category,
        });

        if (result.data?.image_url) {
          setGeneratedImage(result.data.image_url);
        } else {
          setError('Failed to transform image');
        }
      }
    } catch (err) {
      setError(err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dnd-forge-${quality}-${Date.now()}.png`;
    link.click();
  };

  const currentCategory = CATEGORY_PRESETS[category];

  return (
    <div className="min-h-screen parchment-bg flex flex-col" style={{ color: '#e8d5b7' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: 'rgba(8,5,2,0.95)', borderBottom: '1px solid rgba(180,140,90,0.2)' }}>
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg" style={{ color: 'rgba(201,169,110,0.5)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Wand2 className="w-5 h-5" style={{ color: '#f0c040' }} />
        <div className="flex-1">
          <h1 className="font-fantasy-deco font-bold text-base text-glow-gold" style={{ color: '#f0c040' }}>
            🎨 Image Forge
          </h1>
          <p className="text-xs" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
            Create or transform images into D&D fantasy art
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Mode Selection */}
          <div className="flex gap-2">
            <button onClick={() => setMode('describe')}
              className="flex-1 py-2.5 rounded-xl font-fantasy text-sm transition-all"
              style={mode === 'describe' ? {
                background: 'rgba(80,50,10,0.7)', border: '1px solid rgba(201,169,110,0.5)', color: '#f0c040',
              } : {
                background: 'rgba(15,10,5,0.5)', border: '1px solid rgba(180,140,90,0.12)', color: 'rgba(180,140,90,0.4)',
              }}>
              <Wand2 className="w-4 h-4 inline mr-1.5" />Describe Scene
            </button>
            <button onClick={() => setMode('upload')}
              className="flex-1 py-2.5 rounded-xl font-fantasy text-sm transition-all"
              style={mode === 'upload' ? {
                background: 'rgba(80,50,10,0.7)', border: '1px solid rgba(201,169,110,0.5)', color: '#f0c040',
              } : {
                background: 'rgba(15,10,5,0.5)', border: '1px solid rgba(180,140,90,0.12)', color: 'rgba(180,140,90,0.4)',
              }}>
              <Upload className="w-4 h-4 inline mr-1.5" />Transform Image
            </button>
          </div>

          {/* Category Selection */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
            <div className="tavern-section-label mb-2">Image Category</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {Object.entries(CATEGORY_PRESETS).map(([key, cat]) => (
                <button key={key} onClick={() => { setCategory(key); setPrompt(''); }}
                  className="py-2.5 px-2 rounded-lg font-fantasy text-xs transition-all flex flex-col items-center gap-1"
                  style={category === key ? {
                    background: 'rgba(60,40,10,0.8)', border: '1px solid rgba(201,169,110,0.5)', color: '#f0c040',
                  } : {
                    background: 'rgba(20,13,5,0.5)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(180,140,90,0.5)',
                  }}>
                  {cat.icon}
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input Section */}
          <div className="rounded-2xl p-5" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
            {mode === 'describe' ? (
              <div className="space-y-3">
                <label className="block">
                  <div className="tavern-section-label mb-2">Describe Your Vision</div>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder={currentCategory.placeholder}
                    rows={4}
                    className="w-full rounded-xl p-3 input-fantasy resize-none"
                    style={{ fontFamily: 'EB Garamond, serif', fontSize: '1rem' }}
                  />
                </label>

                {/* Prompt preview */}
                {prompt.trim() && (
                  <div className="rounded-lg p-3 text-xs"
                    style={{ background: 'rgba(8,5,2,0.6)', border: '1px solid rgba(180,140,90,0.1)', color: 'rgba(180,140,90,0.5)', fontFamily: 'EB Garamond, serif' }}>
                    <span style={{ color: 'rgba(180,140,90,0.35)' }}>Final prompt preview: </span>
                    {buildFinalPrompt(prompt).slice(0, 200)}{buildFinalPrompt(prompt).length > 200 ? '...' : ''}
                  </div>
                )}

                <button onClick={enhancePrompt} disabled={!prompt.trim() || enhancingPrompt}
                  className="w-full py-2 rounded-xl font-fantasy text-sm transition-all disabled:opacity-50"
                  style={{ background: 'rgba(80,40,120,0.6)', border: '1px solid rgba(140,80,220,0.4)', color: '#c084fc' }}>
                  {enhancingPrompt
                    ? <><Loader2 className="w-4 h-4 inline animate-spin mr-1.5" />Enhancing...</>
                    : <><Sparkles className="w-4 h-4 inline mr-1.5" />AI Enhance Prompt</>}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="tavern-section-label mb-2">Upload Reference Image</div>
                <label className="block cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <div className="border-2 border-dashed rounded-xl p-8 text-center transition-all"
                    style={{ borderColor: 'rgba(180,140,90,0.2)', background: 'rgba(10,6,3,0.4)' }}>
                    {uploadPreview ? (
                      <div className="space-y-2">
                        <img src={uploadPreview} alt="Upload preview" className="max-h-48 mx-auto rounded-lg" />
                        <div className="text-xs" style={{ color: 'rgba(201,169,110,0.6)' }}>Click to change</div>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-12 h-12 mx-auto mb-2" style={{ color: 'rgba(180,140,90,0.3)' }} />
                        <div className="font-fantasy text-sm" style={{ color: 'rgba(201,169,110,0.5)' }}>Click to upload image</div>
                      </div>
                    )}
                  </div>
                </label>
                <label className="block">
                  <div className="text-xs mb-1.5" style={{ color: 'rgba(180,140,90,0.5)' }}>Additional Instructions (optional)</div>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Make it more dramatic, add magical effects, change the lighting..."
                    rows={2}
                    className="w-full rounded-xl p-3 input-fantasy resize-none text-sm"
                    style={{ fontFamily: 'EB Garamond, serif' }}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
            <div className="space-y-4">

              {/* Style Selection */}
              <div>
                <div className="tavern-section-label mb-2">Art Style</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(STYLE_PRESETS).map(([key, { label, icon, desc }]) => (
                    <button key={key} onClick={() => setStyle(key)}
                      className="py-2.5 px-2 rounded-lg font-fantasy text-xs transition-all"
                      style={style === key ? {
                        background: 'rgba(60,40,10,0.8)', border: '1px solid rgba(201,169,110,0.5)', color: '#f0c040',
                      } : {
                        background: 'rgba(20,13,5,0.5)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(180,140,90,0.5)',
                      }}>
                      <div className="text-base mb-0.5">{icon}</div>
                      <div className="font-semibold">{label}</div>
                      <div className="text-xs opacity-60 leading-tight" style={{ fontFamily: 'EB Garamond, serif' }}>{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Selection */}
              <div>
                <div className="tavern-section-label mb-2">Quality</div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(QUALITY_PRESETS).map(([key, { label, desc }]) => (
                    <button key={key} onClick={() => setQuality(key)}
                      className="py-2 rounded-lg font-fantasy text-xs transition-all"
                      style={quality === key ? {
                        background: 'rgba(60,40,10,0.8)', border: '1px solid rgba(201,169,110,0.5)', color: '#f0c040',
                      } : {
                        background: 'rgba(20,13,5,0.5)', border: '1px solid rgba(180,140,90,0.15)', color: 'rgba(180,140,90,0.5)',
                      }}>
                      <div>{label}</div>
                      <div className="text-xs opacity-60">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Enhancement Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={useAiEnhance} onChange={e => setUseAiEnhance(e.target.checked)}
                  className="rounded" style={{ accentColor: '#a78bfa' }} />
                <div className="flex-1">
                  <div className="font-fantasy text-sm flex items-center gap-1.5" style={{ color: 'rgba(201,169,110,0.8)' }}>
                    <Sparkles className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
                    AI Prompt Enhancement
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(180,140,90,0.5)' }}>
                    Automatically enrich prompt with vivid artistic details
                  </div>
                </div>
              </label>

              {/* Mature Content Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={matureContent} onChange={e => setMatureContent(e.target.checked)}
                  className="rounded" style={{ accentColor: '#f0c040' }} />
                <div className="flex-1">
                  <div className="font-fantasy text-sm" style={{ color: 'rgba(201,169,110,0.8)' }}>
                    Mature Fantasy Art
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(180,140,90,0.5)' }}>
                    Allow intense violence, gore, revealing fantasy costumes, dark themes
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Error Display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="rounded-xl p-3 flex items-start gap-2"
                style={{ background: 'rgba(120,20,10,0.3)', border: '1px solid rgba(200,60,40,0.4)' }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#fca5a5' }} />
                <div className="text-sm" style={{ color: '#fca5a5', fontFamily: 'EB Garamond, serif' }}>{error}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generate Button */}
          <button
            onClick={generateImage}
            disabled={generating || (mode === 'describe' && !prompt.trim()) || (mode === 'upload' && !uploadedImage)}
            className="w-full py-3 rounded-xl font-fantasy font-bold text-base btn-fantasy disabled:opacity-50 flex items-center justify-center gap-2">
            {generating ? (
              <><Loader2 className="w-5 h-5 animate-spin" />Forging Image...</>
            ) : (
              <><Wand2 className="w-5 h-5" />Forge Image</>
            )}
          </button>

          {/* Generated Image */}
          <AnimatePresence>
            {generatedImage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-2xl p-5"
                style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(201,169,110,0.3)' }}>
                <div className="tavern-section-label mb-3">✨ Your Creation</div>
                <img src={generatedImage} alt="Generated" className="w-full rounded-xl mb-4"
                  style={{ border: '2px solid rgba(201,169,110,0.2)' }} />
                <div className="flex gap-2">
                  <button onClick={() => downloadImage(generatedImage)}
                    className="flex-1 py-2.5 rounded-xl font-fantasy text-sm btn-fantasy flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />
                    Download ({QUALITY_PRESETS[quality].label})
                  </button>
                  <button onClick={() => { setGeneratedImage(null); setPrompt(''); setUploadedImage(null); setUploadPreview(null); setError(null); }}
                    className="px-4 py-2.5 rounded-xl font-fantasy text-sm transition-all"
                    style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}>
                    New Image
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}