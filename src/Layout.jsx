import React from 'react';

export default function Layout({ children, currentPageName }) {
  return (
    <div className="min-h-screen tavern-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;900&family=IM+Fell+English:ital@0;1&family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap');

        :root {
          /* Tavern Palette */
          --wood-deep:    #1a0e06;
          --wood-dark:    #2a1608;
          --wood-mid:     #3d2010;
          --wood-light:   #5c3318;
          --wood-plank:   #7a4520;

          --brass:        #b87333;
          --brass-bright: #d4955a;
          --brass-gold:   #e8b86d;
          --brass-shine:  #f5d08a;
          --brass-glow:   rgba(184,115,51,0.5);

          --parchment:    #f5e8d0;
          --parchment-mid:#e4d0a8;
          --parchment-dim:#c8a880;

          --ember:        #c0452a;
          --ember-glow:   rgba(192,69,42,0.4);
          --hearth:       #e8732a;

          --arcane:       #7c3aed;
          --arcane-glow:  rgba(124,58,237,0.35);

          --text-bright:  #faecd8;
          --text-mid:     #e0c8a4;
          --text-dim:     #b89a72;
        }

        .tavern-root {
          background-color: var(--wood-deep);
          color: var(--text-bright);
        }

        body { background: var(--wood-deep); color: var(--text-bright); }

        /* Global text brightness boost */
        .tavern-root p, .tavern-root span, .tavern-root div, .tavern-root li {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* ── Fonts ── */
        .font-fantasy      { font-family: 'Cinzel', 'Georgia', serif; }
        .font-fantasy-deco { font-family: 'Cinzel Decorative', 'Georgia', serif; }
        .font-serif        { font-family: 'IM Fell English', 'Georgia', serif; }
        .font-body         { font-family: 'EB Garamond', 'Georgia', serif; }

        /* ── Tavern background ── */
        .parchment-bg {
          background-color: var(--wood-deep);
          background-image:
            /* Wood grain lines */
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 38px,
              rgba(0,0,0,0.07) 38px,
              rgba(0,0,0,0.07) 40px
            ),
            repeating-linear-gradient(
              180deg,
              transparent,
              transparent 90px,
              rgba(255,160,60,0.015) 90px,
              rgba(255,160,60,0.015) 92px
            ),
            radial-gradient(ellipse at 20% 50%, rgba(100,45,8,0.18) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 15%, rgba(140,65,10,0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 85%, rgba(80,30,5,0.14) 0%, transparent 55%);
        }

        /* ── Tavern panels ── */
        .glass-panel {
          background: linear-gradient(160deg, rgba(45,22,8,0.92), rgba(28,13,4,0.95));
          border: 1px solid rgba(184,115,51,0.35);
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.6),
            inset 0 1px 0 rgba(232,184,109,0.12),
            inset 0 -1px 0 rgba(0,0,0,0.4),
            0 8px 32px rgba(0,0,0,0.7);
        }

        .glass-panel-light {
          background: linear-gradient(160deg, rgba(55,28,10,0.85), rgba(38,18,6,0.9));
          border: 1px solid rgba(184,115,51,0.22);
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(232,184,109,0.08),
            0 4px 16px rgba(0,0,0,0.6);
        }

        /* ── Brass glow border ── */
        .border-glow-gold {
          border-color: rgba(212,149,90,0.6) !important;
          box-shadow: 0 0 14px rgba(184,115,51,0.25), inset 0 0 8px rgba(184,115,51,0.06);
        }

        /* ── Engraved border (replaces rune-border) ── */
        .rune-border { position: relative; }
        .rune-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg,
            rgba(232,184,109,0.55),
            rgba(140,70,20,0.15),
            rgba(212,149,90,0.45),
            rgba(90,45,10,0.2));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: destination-out;
          mask-composite: exclude;
          pointer-events: none;
        }

        /* ── Tavern card hover ── */
        .fantasy-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .fantasy-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 0 28px rgba(184,115,51,0.18), 0 10px 36px rgba(0,0,0,0.7);
          border-color: rgba(212,149,90,0.55) !important;
        }

        /* ── Brass button ── */
        .btn-fantasy {
          background: linear-gradient(160deg, #5c3318, #3d2010);
          border: 1px solid rgba(212,149,90,0.5);
          color: var(--parchment);
          font-family: 'Cinzel', serif;
          letter-spacing: 0.06em;
          text-shadow: 0 1px 3px rgba(0,0,0,0.9);
          box-shadow:
            inset 0 1px 0 rgba(245,208,138,0.1),
            inset 0 -1px 0 rgba(0,0,0,0.3),
            0 3px 10px rgba(0,0,0,0.6);
          transition: all 0.2s ease;
        }
        .btn-fantasy:hover:not(:disabled) {
          background: linear-gradient(160deg, #7a4520, #5c3318);
          border-color: rgba(232,184,109,0.75);
          box-shadow: 0 0 18px rgba(184,115,51,0.3), inset 0 1px 0 rgba(245,208,138,0.15), 0 4px 14px rgba(0,0,0,0.7);
          transform: translateY(-1px);
          color: var(--brass-shine);
        }
        .btn-fantasy:active:not(:disabled) {
          transform: translateY(1px);
          box-shadow: inset 0 3px 8px rgba(0,0,0,0.5);
        }

        /* ── Ember/combat button ── */
        .btn-combat {
          background: linear-gradient(160deg, rgba(120,20,10,0.92), rgba(70,8,4,0.97));
          border: 1px solid rgba(200,60,40,0.5);
          color: #ffcfb0;
          font-family: 'Cinzel', serif;
          box-shadow: inset 0 1px 0 rgba(255,100,60,0.1), 0 3px 10px rgba(0,0,0,0.6);
          transition: all 0.2s ease;
        }
        .btn-combat:hover:not(:disabled) {
          background: linear-gradient(160deg, rgba(155,28,12,0.96), rgba(90,10,5,0.99));
          border-color: rgba(240,80,50,0.75);
          box-shadow: 0 0 18px rgba(200,60,30,0.3), 0 4px 14px rgba(0,0,0,0.7);
          transform: translateY(-1px);
        }

        /* ── Arcane button ── */
        .btn-arcane {
          background: linear-gradient(160deg, rgba(65,22,110,0.92), rgba(38,10,75,0.97));
          border: 1px solid rgba(150,90,230,0.45);
          color: #dfc8ff;
          font-family: 'Cinzel', serif;
          box-shadow: inset 0 1px 0 rgba(210,160,255,0.1), 0 3px 10px rgba(0,0,0,0.6);
          transition: all 0.2s ease;
        }
        .btn-arcane:hover:not(:disabled) {
          border-color: rgba(190,140,255,0.7);
          box-shadow: 0 0 18px rgba(140,70,230,0.3), 0 4px 14px rgba(0,0,0,0.7);
          transform: translateY(-1px);
        }

        /* ── Inset ── */
        .neuro-inset {
          box-shadow: inset 3px 3px 8px rgba(0,0,0,0.75), inset -2px -2px 5px rgba(90,45,10,0.1);
          background: rgba(10,5,2,0.65);
        }

        /* ── Stat box ── */
        .stat-box {
          background: linear-gradient(160deg, rgba(30,15,5,0.9), rgba(20,10,3,0.95));
          border: 1px solid rgba(184,115,51,0.22);
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,0,0,0.4);
          transition: all 0.2s ease;
        }
        .stat-box:hover {
          border-color: rgba(212,149,90,0.45);
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.55), 0 0 14px rgba(184,115,51,0.1);
        }

        /* ── Text glows ── */
        .text-glow-gold   { text-shadow: 0 0 18px rgba(212,149,90,0.7), 0 0 35px rgba(184,115,51,0.35); }
        .text-glow-blood  { text-shadow: 0 0 16px rgba(200,65,40,0.75), 0 0 32px rgba(180,35,20,0.4); }
        .text-glow-arcane { text-shadow: 0 0 16px rgba(170,110,255,0.65), 0 0 32px rgba(130,65,225,0.35); }

        /* ── HP bars ── */
        .hp-bar-high { background: linear-gradient(90deg, #16a34a, #22c55e); }
        .hp-bar-mid  { background: linear-gradient(90deg, #b45309, #e8732a); }
        .hp-bar-low  { background: linear-gradient(90deg, #7f1d1d, #dc2626); }

        /* ── XP bar ── */
        .xp-bar { background: linear-gradient(90deg, #5c3318, #b87333, #e8b86d); }

        /* ── Divider ── */
        .divider-rune {
          border: none; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212,149,90,0.45) 25%, rgba(232,184,109,0.5) 50%, rgba(212,149,90,0.45) 75%, transparent);
          position: relative;
        }
        .divider-rune::after {
          content: '⚜';
          position: absolute; left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          color: rgba(212,149,90,0.65); font-size: 11px;
          padding: 0 10px; background: var(--wood-deep);
        }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(8,4,2,0.6); }
        ::-webkit-scrollbar-thumb { background: rgba(120,65,22,0.85); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(160,88,30,0.95); }
        * { scrollbar-width: thin; scrollbar-color: rgba(120,65,22,0.85) rgba(8,4,2,0.6); }

        /* ── Inputs ── */
        .input-fantasy {
          background: rgba(12,6,2,0.75);
          border: 1px solid rgba(184,115,51,0.3);
          color: var(--parchment);
          font-family: 'EB Garamond', serif;
          box-shadow: inset 0 2px 7px rgba(0,0,0,0.5);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input-fantasy:focus {
          outline: none;
          border-color: rgba(212,149,90,0.6);
          box-shadow: inset 0 2px 7px rgba(0,0,0,0.55), 0 0 10px rgba(184,115,51,0.15);
        }
        .input-fantasy::placeholder { color: rgba(200,175,130,0.4); }

        .select-fantasy {
          background: rgba(8,4,1,0.75);
          border: 1px solid rgba(184,115,51,0.22);
          color: var(--parchment);
          font-family: 'EB Garamond', serif;
          box-shadow: inset 0 2px 5px rgba(0,0,0,0.5);
        }
        .select-fantasy:focus { outline: none; border-color: rgba(212,149,90,0.55); }

        /* ── Animations ── */
        @keyframes combat-pulse {
          0%,100% { box-shadow: 0 0 8px rgba(192,65,40,0.3); }
          50%      { box-shadow: 0 0 22px rgba(192,65,40,0.65), 0 0 44px rgba(192,65,40,0.22); }
        }
        .combat-active { animation: combat-pulse 2s ease-in-out infinite; }

        @keyframes arcane-shimmer {
          0%,100% { box-shadow: 0 0 8px rgba(130,65,220,0.3); }
          50%      { box-shadow: 0 0 22px rgba(130,65,220,0.65), 0 0 44px rgba(130,65,220,0.22); }
        }
        .arcane-active { animation: arcane-shimmer 3s ease-in-out infinite; }

        @keyframes gold-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .text-gold-shimmer {
          background: linear-gradient(90deg, #b87333, #e8b86d, #f5d08a, #d4955a, #b87333, #e8b86d);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gold-shimmer 5s linear infinite;
        }

        @keyframes crit-flash {
          0%,100% { background: rgba(232,184,109,0.04); }
          40%     { background: rgba(232,184,109,0.18); }
        }
        .crit-flash { animation: crit-flash 0.7s ease-in-out; }

        @keyframes dice-roll {
          0%   { transform: rotate(0deg) scale(1); }
          25%  { transform: rotate(180deg) scale(1.15); }
          75%  { transform: rotate(270deg) scale(0.9); }
          100% { transform: rotate(360deg) scale(1); }
        }
        .dice-rolling { animation: dice-roll 0.45s ease-in-out; }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fade-up 0.4s ease-out forwards; }

        /* ── Tab glow ── */
        .tab-active-glow {
          border-bottom: 2px solid #d4955a;
          text-shadow: 0 0 14px rgba(212,149,90,0.6);
        }

        /* ── Badges ── */
        .badge-gold {
          background: rgba(92,51,24,0.85);
          border: 1px solid rgba(212,149,90,0.45);
          color: #f0d090;
          font-family: 'Cinzel', serif;
          font-size: 0.62rem;
          letter-spacing: 0.06em;
          text-shadow: 0 1px 2px rgba(0,0,0,0.8);
        }
        .badge-blood {
          background: rgba(80,12,8,0.85);
          border: 1px solid rgba(200,65,40,0.45);
          color: #ffbba0;
          font-family: 'Cinzel', serif;
          font-size: 0.62rem;
        }
        .badge-arcane {
          background: rgba(48,18,80,0.85);
          border: 1px solid rgba(150,90,230,0.45);
          color: #dfc8ff;
          font-family: 'Cinzel', serif;
          font-size: 0.62rem;
        }
        .badge-green {
          background: rgba(8,45,18,0.85);
          border: 1px solid rgba(40,170,80,0.45);
          color: #90f4b0;
          font-size: 0.62rem;
        }

        /* ── Brass horizontal rule ── */
        .brass-rule {
          height: 2px;
          background: linear-gradient(90deg,
            transparent,
            rgba(184,115,51,0.2) 10%,
            rgba(232,184,109,0.55) 35%,
            rgba(245,208,138,0.7) 50%,
            rgba(232,184,109,0.55) 65%,
            rgba(184,115,51,0.2) 90%,
            transparent);
          border: none;
        }

        /* ── Wood plank separator ── */
        .plank-divider {
          height: 4px;
          background: repeating-linear-gradient(
            90deg,
            rgba(90,45,14,0.5),
            rgba(60,28,8,0.4) 20px,
            rgba(90,45,14,0.5) 40px
          );
          border-top: 1px solid rgba(212,149,90,0.2);
          border-bottom: 1px solid rgba(0,0,0,0.4);
        }

        /* ── Tavern section header ── */
        .tavern-section-label {
          font-family: 'Cinzel', serif;
          font-size: 0.6rem;
          letter-spacing: 0.18em;
          color: rgba(220,165,100,0.72);
          text-transform: uppercase;
          text-shadow: 0 0 10px rgba(184,115,51,0.2);
        }
      `}</style>
      {children}
    </div>
  );
}