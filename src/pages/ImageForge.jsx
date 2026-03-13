import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Wand2, Upload, Sparkles, Download, Loader2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const QUALITY_PRESETS = {
  '1k': { label: '1K (1024x1024)', size: '1024x1024', desc: 'Standard quality' },
  '2k': { label: '2K (2048x2048)', size: '2048x2048', desc: 'High quality' },
  '4k': { label: '4K (4096x4096)', size: '4096x4096', desc: 'Ultra quality' },
};

export default function ImageForge() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('describe'); // 'describe' | 'upload'
  const [prompt, setPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [quality, setQuality] = useState('2k');
  const [matureContent, setMatureContent] = useState(false);
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadedImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const enhancePrompt = async () => {
    if (!prompt.trim()) return;
    setEnhancingPrompt(true);
    setError(null);
    
    try {
      const result = await base44.functions.invoke('enhanceImagePrompt', {
        prompt: prompt.trim(),
        mature_content: matureContent,
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

        const result = await base44.functions.invoke('forgeDndImage', {
          prompt: prompt.trim(),
          quality,
          mature_content: matureContent,
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
        
        const result = await base44.functions.invoke('forgeDndImage', {
          reference_image_url: uploadResult.file_url,
          prompt: prompt.trim() || 'Transform this into a D&D fantasy art style',
          quality,
          mature_content: matureContent,
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

  const downloadImage = async (url, quality) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dnd-forge-${quality}-${Date.now()}.png`;
    link.click();
  };

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
                background: 'rgba(80,50,10,0.7)',
                border: '1px solid rgba(201,169,110,0.5)',
                color: '#f0c040',
              } : {
                background: 'rgba(15,10,5,0.5)',
                border: '1px solid rgba(180,140,90,0.12)',
                color: 'rgba(180,140,90,0.4)',
              }}>
              <Wand2 className="w-4 h-4 inline mr-1.5" />
              Describe Scene
            </button>
            <button onClick={() => setMode('upload')}
              className="flex-1 py-2.5 rounded-xl font-fantasy text-sm transition-all"
              style={mode === 'upload' ? {
                background: 'rgba(80,50,10,0.7)',
                border: '1px solid rgba(201,169,110,0.5)',
                color: '#f0c040',
              } : {
                background: 'rgba(15,10,5,0.5)',
                border: '1px solid rgba(180,140,90,0.12)',
                color: 'rgba(180,140,90,0.4)',
              }}>
              <Upload className="w-4 h-4 inline mr-1.5" />
              Transform Image
            </button>
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
                    placeholder="A noble elven ranger standing atop a misty mountain peak at dawn, bow in hand..."
                    rows={4}
                    className="w-full rounded-xl p-3 input-fantasy resize-none"
                    style={{ fontFamily: 'EB Garamond, serif' }}
                  />
                </label>
                <button onClick={enhancePrompt} disabled={!prompt.trim() || enhancingPrompt}
                  className="w-full py-2 rounded-xl font-fantasy text-sm transition-all disabled:opacity-50"
                  style={{ background: 'rgba(80,40,120,0.6)', border: '1px solid rgba(140,80,220,0.4)', color: '#c084fc' }}>
                  {enhancingPrompt ? <Loader2 className="w-4 h-4 inline animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 inline mr-1.5" />}
                  {enhancingPrompt ? 'Enhancing...' : 'AI Enhance Prompt'}
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
                        <div className="font-fantasy text-sm" style={{ color: 'rgba(201,169,110,0.5)' }}>
                          Click to upload image
                        </div>
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
            <div className="space-y-3">
              <div>
                <div className="tavern-section-label mb-2">Quality</div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(QUALITY_PRESETS).map(([key, { label, desc }]) => (
                    <button key={key} onClick={() => setQuality(key)}
                      className="py-2 rounded-lg font-fantasy text-xs transition-all"
                      style={quality === key ? {
                        background: 'rgba(60,40,10,0.8)',
                        border: '1px solid rgba(201,169,110,0.5)',
                        color: '#f0c040',
                      } : {
                        background: 'rgba(20,13,5,0.5)',
                        border: '1px solid rgba(180,140,90,0.15)',
                        color: 'rgba(180,140,90,0.5)',
                      }}>
                      <div>{label}</div>
                      <div className="text-xs opacity-60">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={matureContent} onChange={e => setMatureContent(e.target.checked)}
                  className="rounded" style={{ accentColor: '#f0c040' }} />
                <div className="flex-1">
                  <div className="font-fantasy text-sm" style={{ color: 'rgba(201,169,110,0.8)' }}>
                    18+ Content (Violence/Gore)
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(180,140,90,0.5)' }}>
                    Enable mature themes (no sexual content)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Error Display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-xl p-3 flex items-start gap-2"
                style={{ background: 'rgba(120,20,10,0.3)', border: '1px solid rgba(200,60,40,0.4)' }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#fca5a5' }} />
                <div className="text-sm" style={{ color: '#fca5a5', fontFamily: 'EB Garamond, serif' }}>{error}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generate Button */}
          <button onClick={generateImage} disabled={generating || (mode === 'describe' && !prompt.trim()) || (mode === 'upload' && !uploadedImage)}
            className="w-full py-3 rounded-xl font-fantasy font-bold text-base btn-fantasy disabled:opacity-50 flex items-center justify-center gap-2">
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Forging Image...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                Forge Image
              </>
            )}
          </button>

          {/* Generated Image Display */}
          <AnimatePresence>
            {generatedImage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-2xl p-5" style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(201,169,110,0.3)' }}>
                <div className="tavern-section-label mb-3">✨ Your Creation</div>
                <img src={generatedImage} alt="Generated" className="w-full rounded-xl mb-4"
                  style={{ border: '2px solid rgba(201,169,110,0.2)' }} />
                <div className="flex gap-2">
                  <button onClick={() => downloadImage(generatedImage, quality)}
                    className="flex-1 py-2.5 rounded-xl font-fantasy text-sm btn-fantasy flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />
                    Download ({QUALITY_PRESETS[quality].label})
                  </button>
                  <button onClick={() => { setGeneratedImage(null); setPrompt(''); setUploadedImage(null); setUploadPreview(null); }}
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