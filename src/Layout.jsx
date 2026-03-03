import React from 'react';

export default function Layout({ children, currentPageName }) {
  return (
    <div className="min-h-screen" style={{ background: '#0d0a07' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;900&family=IM+Fell+English:ital@0;1&family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap');

        :root {
          --parchment: #e8d5b7;
          --parchment-dark: #c9a96e;
          --gold: #c9a96e;
          --gold-bright: #f0c040;
          --gold-glow: rgba(201,169,110,0.4);
          --blood: #8b1a1a;
          --blood-bright: #c0392b;
          --arcane: #7c3aed;
          --arcane-glow: rgba(124,58,237,0.3);
          --dark-bg: #0d0a07;
          --panel-bg: rgba(20,14,8,0.85);
          --border-gold: rgba(180,140,90,0.35);
          --border-gold-bright: rgba(201,169,110,0.6);
        }

        body {
          background: #0d0a07;
          color: #e8d5b7;
        }

        .font-fantasy { font-family: 'Cinzel', 'Georgia', serif; }
        .font-fantasy-deco { font-family: 'Cinzel Decorative', 'Georgia', serif; }
        .font-serif { font-family: 'IM Fell English', 'Georgia', serif; }
        .font-body { font-family: 'EB Garamond', 'Georgia', serif; }

        /* Parchment texture overlay */
        .parchment-bg {
          background-color: #0d0a07;
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E"),
            radial-gradient(ellipse at 20% 50%, rgba(120,60,0,0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(160,80,0,0.06) 0%, transparent 50%),
            radial-gradient(ellipse at 60% 80%, rgba(80,30,120,0.05) 0%, transparent 50%);
        }

        /* Glass panels */
        .glass-panel {
          background: rgba(20,13,6,0.82);
          backdrop-filter: blur(14px) saturate(1.3);
          -webkit-backdrop-filter: blur(14px) saturate(1.3);
          border: 1px solid var(--border-gold);
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(201,169,110,0.1),
            0 8px 32px rgba(0,0,0,0.6);
        }

        .glass-panel-light {
          background: rgba(30,20,10,0.72);
          backdrop-filter: blur(12px) saturate(1.2);
          -webkit-backdrop-filter: blur(12px) saturate(1.2);
          border: 1px solid rgba(180,140,90,0.25);
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(201,169,110,0.08),
            0 4px 16px rgba(0,0,0,0.5);
        }

        /* Gold border glow effect */
        .border-glow-gold {
          border-color: rgba(201,169,110,0.5) !important;
          box-shadow: 0 0 12px rgba(201,169,110,0.15), inset 0 0 8px rgba(201,169,110,0.05);
        }

        /* Rune border decoration */
        .rune-border {
          position: relative;
        }
        .rune-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(201,169,110,0.5), rgba(100,60,20,0.2), rgba(201,169,110,0.4), rgba(80,40,120,0.3));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: destination-out;
          mask-composite: exclude;
          pointer-events: none;
        }

        /* Fantasy card hover */
        .fantasy-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .fantasy-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 24px rgba(201,169,110,0.12), 0 8px 32px rgba(0,0,0,0.6);
          border-color: rgba(201,169,110,0.5) !important;
        }

        /* Fantasy button */
        .btn-fantasy {
          background: linear-gradient(135deg, rgba(80,50,15,0.9), rgba(50,30,8,0.95));
          border: 1px solid rgba(201,169,110,0.45);
          color: var(--parchment);
          font-family: 'Cinzel', serif;
          letter-spacing: 0.05em;
          text-shadow: 0 1px 2px rgba(0,0,0,0.8);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.5);
          transition: all 0.2s ease;
        }
        .btn-fantasy:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(100,65,20,0.95), rgba(70,45,10,0.98));
          border-color: rgba(201,169,110,0.7);
          box-shadow: 0 0 16px rgba(201,169,110,0.2), inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.6);
          transform: translateY(-1px);
        }
        .btn-fantasy:active:not(:disabled) {
          transform: translateY(1px);
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.4);
        }

        /* Blood/combat button */
        .btn-combat {
          background: linear-gradient(135deg, rgba(100,10,10,0.9), rgba(60,5,5,0.95));
          border: 1px solid rgba(180,30,30,0.5);
          color: #ffb3b3;
          font-family: 'Cinzel', serif;
          box-shadow: inset 0 1px 0 rgba(255,80,80,0.1), 0 2px 8px rgba(0,0,0,0.5);
          transition: all 0.2s ease;
        }
        .btn-combat:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(130,15,15,0.95), rgba(80,8,8,0.98));
          border-color: rgba(220,50,50,0.7);
          box-shadow: 0 0 16px rgba(180,30,30,0.25), 0 4px 12px rgba(0,0,0,0.6);
          transform: translateY(-1px);
        }

        /* Arcane/spell button */
        .btn-arcane {
          background: linear-gradient(135deg, rgba(60,20,100,0.9), rgba(40,10,70,0.95));
          border: 1px solid rgba(140,80,220,0.45);
          color: #d4b3ff;
          font-family: 'Cinzel', serif;
          box-shadow: inset 0 1px 0 rgba(200,150,255,0.1), 0 2px 8px rgba(0,0,0,0.5);
          transition: all 0.2s ease;
        }
        .btn-arcane:hover:not(:disabled) {
          border-color: rgba(180,120,255,0.65);
          box-shadow: 0 0 16px rgba(130,60,220,0.25), 0 4px 12px rgba(0,0,0,0.6);
          transform: translateY(-1px);
        }

        /* Neumorphic inset elements */
        .neuro-inset {
          box-shadow: inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(80,50,15,0.1);
          background: rgba(12,8,3,0.6);
        }

        /* Stat box */
        .stat-box {
          background: rgba(15,10,5,0.8);
          border: 1px solid rgba(180,140,90,0.2);
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.3);
          transition: all 0.2s ease;
        }
        .stat-box:hover {
          border-color: rgba(201,169,110,0.4);
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.5), 0 0 12px rgba(201,169,110,0.08);
        }

        /* Gold text glow */
        .text-glow-gold {
          text-shadow: 0 0 20px rgba(201,169,110,0.6), 0 0 40px rgba(201,169,110,0.3);
        }

        /* Blood text glow */
        .text-glow-blood {
          text-shadow: 0 0 16px rgba(180,30,30,0.7), 0 0 32px rgba(180,30,30,0.4);
        }

        /* Arcane text glow */
        .text-glow-arcane {
          text-shadow: 0 0 16px rgba(160,100,255,0.6), 0 0 32px rgba(130,60,220,0.3);
        }

        /* HP bar gradient */
        .hp-bar-high { background: linear-gradient(90deg, #16a34a, #22c55e); }
        .hp-bar-mid { background: linear-gradient(90deg, #b45309, #d97706); }
        .hp-bar-low { background: linear-gradient(90deg, #7f1d1d, #dc2626); }

        /* XP bar */
        .xp-bar { background: linear-gradient(90deg, #78350f, #d97706, #f59e0b); }

        /* Section divider */
        .divider-rune {
          border: none;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(201,169,110,0.35) 30%, rgba(201,169,110,0.35) 70%, transparent);
          position: relative;
        }
        .divider-rune::after {
          content: '✦';
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          color: rgba(201,169,110,0.5);
          font-size: 10px;
          padding: 0 8px;
          background: inherit;
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: rgba(10,6,3,0.5); }
        ::-webkit-scrollbar-thumb { background: rgba(100,65,25,0.8); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(140,90,35,0.9); }
        * { scrollbar-width: thin; scrollbar-color: rgba(100,65,25,0.8) rgba(10,6,3,0.5); }

        /* Input fields */
        .input-fantasy {
          background: rgba(10,6,3,0.7);
          border: 1px solid rgba(180,140,90,0.2);
          color: #e8d5b7;
          font-family: 'EB Garamond', serif;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.5);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input-fantasy:focus {
          outline: none;
          border-color: rgba(201,169,110,0.5);
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.5), 0 0 8px rgba(201,169,110,0.1);
        }
        .input-fantasy::placeholder { color: rgba(180,150,100,0.35); }

        /* Select fantasy */
        .select-fantasy {
          background: rgba(10,6,3,0.7);
          border: 1px solid rgba(180,140,90,0.2);
          color: #e8d5b7;
          font-family: 'EB Garamond', serif;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.4);
        }
        .select-fantasy:focus { outline: none; border-color: rgba(201,169,110,0.45); }

        /* Combat glow pulse */
        @keyframes combat-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(180,30,30,0.3); }
          50% { box-shadow: 0 0 20px rgba(180,30,30,0.6), 0 0 40px rgba(180,30,30,0.2); }
        }
        .combat-active { animation: combat-pulse 2s ease-in-out infinite; }

        /* Arcane shimmer */
        @keyframes arcane-shimmer {
          0%, 100% { box-shadow: 0 0 8px rgba(130,60,220,0.3); }
          50% { box-shadow: 0 0 20px rgba(130,60,220,0.6), 0 0 40px rgba(130,60,220,0.2); }
        }
        .arcane-active { animation: arcane-shimmer 3s ease-in-out infinite; }

        /* Gold shimmer for special items */
        @keyframes gold-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .text-gold-shimmer {
          background: linear-gradient(90deg, #c9a96e, #f0c040, #e8b84b, #c9a96e, #f0c040);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gold-shimmer 4s linear infinite;
        }

        /* Critical hit flash */
        @keyframes crit-flash {
          0% { background: rgba(255,200,0,0.05); }
          25% { background: rgba(255,200,0,0.15); }
          50% { background: rgba(255,200,0,0.05); }
          75% { background: rgba(255,200,0,0.12); }
          100% { background: rgba(255,200,0,0.05); }
        }
        .crit-flash { animation: crit-flash 0.8s ease-in-out; }

        /* Dice roll animation */
        @keyframes dice-roll {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(180deg) scale(1.15); }
          75% { transform: rotate(270deg) scale(0.9); }
          100% { transform: rotate(360deg) scale(1); }
        }
        .dice-rolling { animation: dice-roll 0.45s ease-in-out; }

        /* Fade up entrance */
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fade-up 0.4s ease-out forwards; }

        /* Tab underline glow */
        .tab-active-glow {
          border-bottom: 2px solid #c9a96e;
          text-shadow: 0 0 12px rgba(201,169,110,0.5);
        }

        /* Badge glow */
        .badge-gold {
          background: rgba(100,65,15,0.7);
          border: 1px solid rgba(201,169,110,0.35);
          color: #e8c87a;
          font-family: 'Cinzel', serif;
          font-size: 0.65rem;
          letter-spacing: 0.05em;
        }
        .badge-blood {
          background: rgba(80,10,10,0.7);
          border: 1px solid rgba(180,30,30,0.4);
          color: #ffaaaa;
          font-family: 'Cinzel', serif;
          font-size: 0.65rem;
        }
        .badge-arcane {
          background: rgba(50,20,80,0.7);
          border: 1px solid rgba(140,80,220,0.4);
          color: #d4b3ff;
          font-family: 'Cinzel', serif;
          font-size: 0.65rem;
        }
        .badge-green {
          background: rgba(10,50,20,0.7);
          border: 1px solid rgba(40,160,80,0.4);
          color: #86efac;
          font-size: 0.65rem;
        }

        /* Tooltip */
        [title]:hover::after {
          background: rgba(15,10,5,0.95);
          border: 1px solid rgba(180,140,90,0.3);
          color: #e8d5b7;
          font-family: 'EB Garamond', serif;
        }
      `}</style>
      {children}
    </div>
  );
}