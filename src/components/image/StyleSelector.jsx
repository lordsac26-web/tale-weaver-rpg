import React from 'react';

const STYLES = [
  { id: 'fantasy_art', label: 'Fantasy Art', emoji: '🐉', desc: 'Epic fantasy illustration style' },
  { id: 'oil_painting', label: 'Oil Painting', emoji: '🎨', desc: 'Classical oil painting look' },
  { id: 'watercolor', label: 'Watercolor', emoji: '💧', desc: 'Soft watercolor aesthetic' },
  { id: 'digital_art', label: 'Digital Art', emoji: '💻', desc: 'Modern digital illustration' },
  { id: 'pixel_art', label: 'Pixel Art', emoji: '🕹️', desc: 'Retro pixel art style' },
  { id: 'comic_book', label: 'Comic Book', emoji: '💥', desc: 'Bold comic book style' },
  { id: 'photorealistic', label: 'Photorealistic', emoji: '📸', desc: 'Hyper-realistic rendering' },
  { id: 'anime', label: 'Anime', emoji: '✨', desc: 'Japanese anime style' },
  { id: 'dark_gothic', label: 'Dark Gothic', emoji: '🦇', desc: 'Dark and moody gothic art' },
  { id: 'stained_glass', label: 'Stained Glass', emoji: '🪟', desc: 'Medieval stained glass look' },
  { id: 'sketch', label: 'Pencil Sketch', emoji: '✏️', desc: 'Hand-drawn pencil sketch' },
  { id: 'none', label: 'No Style', emoji: '🔲', desc: 'Use your prompt as-is' },
];

export const STYLE_MAP = STYLES.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {});

export function getStylePromptPrefix(styleId) {
  const prefixes = {
    fantasy_art: 'Epic fantasy art illustration,',
    oil_painting: 'Classical oil painting style,',
    watercolor: 'Soft watercolor painting,',
    digital_art: 'High quality digital art illustration,',
    pixel_art: 'Detailed pixel art,',
    comic_book: 'Bold comic book style illustration,',
    photorealistic: 'Photorealistic, highly detailed,',
    anime: 'Anime style illustration,',
    dark_gothic: 'Dark gothic art, moody and atmospheric,',
    stained_glass: 'Medieval stained glass art style,',
    sketch: 'Detailed pencil sketch, hand-drawn,',
    none: '',
  };
  return prefixes[styleId] || '';
}

export default function StyleSelector({ selected, onSelect, accentColor = 'var(--brass-gold)' }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {STYLES.map(s => {
        const active = selected === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-center transition-all"
            style={{
              background: active ? 'rgba(92,51,24,0.55)' : 'rgba(12,7,2,0.7)',
              border: `1px solid ${active ? 'rgba(212,149,90,0.6)' : 'rgba(80,50,10,0.2)'}`,
              boxShadow: active ? `0 0 14px rgba(184,115,51,0.2)` : 'none',
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>{s.emoji}</span>
            <span className="font-fantasy text-xs" style={{ color: active ? accentColor : 'rgba(201,169,110,0.55)' }}>
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}