import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2, Download, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

const POSES = [
  { id: 'portrait',    label: 'Portrait',    icon: '🎨', desc: 'Classic face and shoulders portrait, heroic expression' },
  { id: 'battle',      label: 'Battle Ready', icon: '⚔️', desc: 'Armed and battle-ready, weapons drawn, fierce expression' },
  { id: 'triumphant',  label: 'Triumphant',  icon: '🏆', desc: 'Standing victorious, dramatic pose, confident gaze' },
  { id: 'stealth',     label: 'Stealth',     icon: '🌑', desc: 'Crouching in shadows, concealed, eyes alert' },
  { id: 'spellcasting',label: 'Casting',     icon: '✨', desc: 'Mid-spell, hands glowing, surrounded by arcane energy' },
  { id: 'tavern',      label: 'Tavern',      icon: '🍺', desc: 'Relaxed at a tavern, mug in hand, warm firelight' },
];

const CLASS_VISUAL = {
  Wizard:    'wearing ornate mage robes, magical staff, spellbook',
  Sorcerer:  'wearing dark flowing robes, arcane power crackling',
  Warlock:   'wearing dark pact-marked robes, eldritch symbols glowing',
  Cleric:    'wearing holy vestments, divine symbol, heavenly light',
  Druid:     'wearing natural leather and vines, nature motifs',
  Fighter:   'wearing chainmail or plate armor, sword or axe',
  Paladin:   'wearing shining plate armor, holy symbol, radiant light',
  Ranger:    'wearing leather ranger armor, bow slung across back',
  Rogue:     'wearing dark leather armor, daggers visible at belt',
  Barbarian: 'wearing furs and leather, large two-handed weapon',
  Bard:      'wearing colorful traveler clothes, instrument, charming smile',
  Monk:      'wearing simple robes, bare hands, calm focused expression',
};

const RACE_VISUAL = {
  Human:       'human features, versatile appearance',
  Elf:         'pointed ears, ageless features, graceful',
  Dwarf:       'stout and stocky, braided beard, sturdy',
  Halfling:    'small and nimble, curly hair, cheerful',
  Gnome:       'tiny and energetic, large curious eyes',
  'Half-Elf':  'slightly pointed ears, mixed heritage features',
  'Half-Orc':  'grey-green skin, prominent lower tusks, powerful build',
  Tiefling:    'small curved horns, tail, solid-colored eyes, slightly reddish or purple skin',
  Dragonborn:  'draconic scales, no hair, reptilian features, powerful frame',
};

export default function CharacterPortraitGenerator({ character, onClose, onSavePortrait }) {
  const [selectedPose, setSelectedPose] = useState('portrait');
  const [customPrompt, setCustomPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState(character?.portrait || null);
  const [loading, setLoading] = useState(false);

  const generatePortrait = async () => {
    setLoading(true);
    const pose = POSES.find(p => p.id === selectedPose);
    const classVisual = CLASS_VISUAL[character?.class] || '';
    const raceVisual = RACE_VISUAL[character?.race] || '';

    const prompt = customPrompt.trim()
      ? `Fantasy character portrait: ${customPrompt}. Character is a ${character?.race} ${character?.class} named ${character?.name}. ${raceVisual}. ${classVisual}. High fantasy digital oil painting, detailed, award-winning illustration, dramatic lighting. No text.`
      : `High fantasy character portrait: ${character?.name}, a ${character?.race} ${character?.class}. ${raceVisual}. ${classVisual}. Pose: ${pose?.desc}. Style: rich oil painting, cinematic lighting, highly detailed, heroic fantasy art. No text, no UI.`;

    try {
      const result = await base44.integrations.Core.GenerateImage({ prompt });
      setImageUrl(result.url);
    } catch (e) {
      console.error('Portrait generation failed:', e);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!imageUrl) return;
    await base44.entities.Character.update(character.id, { portrait: imageUrl });
    onSavePortrait?.(imageUrl);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.92 }} animate={{ scale: 1 }}
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden overflow-y-auto"
        style={{ border: '1px solid rgba(201,169,110,0.3)', background: '#0d0a07', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(180,140,90,0.12)', background: 'rgba(15,10,4,0.9)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div>
            <h2 className="font-fantasy text-sm tracking-wider" style={{ color: '#c9a96e' }}>Character Portrait</h2>
            <p className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
              {character?.name} · {character?.race} {character?.class} Lv.{character?.level}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(201,169,110,0.4)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Controls */}
          <div className="space-y-4">
            <div>
              <div className="text-xs font-fantasy mb-2 tracking-widest" style={{ color: 'rgba(201,169,110,0.45)' }}>POSE / SCENE</div>
              <div className="grid grid-cols-2 gap-1.5">
                {POSES.map(pose => (
                  <button key={pose.id} onClick={() => setSelectedPose(pose.id)}
                    className="text-left p-2.5 rounded-xl transition-all"
                    style={selectedPose === pose.id ? {
                      background: 'rgba(80,50,10,0.8)',
                      border: '1px solid rgba(201,169,110,0.5)',
                    } : {
                      background: 'rgba(15,10,5,0.6)',
                      border: '1px solid rgba(180,140,90,0.1)',
                    }}>
                    <div className="text-base mb-0.5">{pose.icon}</div>
                    <div className="text-xs font-fantasy" style={{ color: selectedPose === pose.id ? '#f0c040' : 'rgba(201,169,110,0.45)' }}>
                      {pose.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-fantasy mb-2 tracking-widest" style={{ color: 'rgba(201,169,110,0.45)' }}>CUSTOM DESCRIPTION (OPTIONAL)</div>
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Describe appearance, clothing, expression, scars, tattoos..."
                rows={3}
                className="w-full rounded-xl px-3 py-2.5 text-sm input-fantasy resize-none"
                style={{ fontFamily: 'EB Garamond, serif' }} />
            </div>

            <button onClick={generatePortrait} disabled={loading}
              className="w-full py-3 rounded-xl font-fantasy text-sm btn-fantasy disabled:opacity-40 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {loading ? 'Painting your likeness...' : 'Generate Portrait'}
            </button>

            {imageUrl && !loading && (
              <button onClick={handleSave}
                className="w-full py-3 rounded-xl font-fantasy text-sm flex items-center justify-center gap-2 transition-all"
                style={{ background: 'rgba(15,60,20,0.7)', border: '1px solid rgba(40,160,80,0.45)', color: '#86efac' }}>
                <Download className="w-4 h-4" />
                Save as Portrait
              </button>
            )}
          </div>

          {/* Image Preview */}
          <div className="rounded-2xl overflow-hidden flex items-center justify-center"
            style={{ minHeight: '320px', background: 'rgba(10,6,3,0.6)', border: '1px solid rgba(180,140,90,0.1)' }}>
            {loading ? (
              <div className="text-center space-y-3 p-8">
                <Loader2 className="w-10 h-10 animate-spin mx-auto" style={{ color: 'rgba(201,169,110,0.5)' }} />
                <p className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.4)' }}>Painting your likeness...</p>
              </div>
            ) : imageUrl ? (
              <img src={imageUrl} alt={character?.name} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-8">
                <div className="text-5xl mb-3 opacity-15">🎨</div>
                <p className="text-xs" style={{ color: 'rgba(180,140,90,0.3)', fontFamily: 'EB Garamond, serif' }}>
                  Select a pose and generate your portrait
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}