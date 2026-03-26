import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { Dices, Swords, Map, ShoppingBag, Eye, Paintbrush, Scroll, BookMarked, MoreHorizontal, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Mobile-friendly game toolbar.
 * Shows primary actions inline; overflow actions behind a "More" menu.
 */
export default function GameToolbar({
  sessionId, characterId, inCombat, started,
  showDiceRoller, setShowDiceRoller,
  showCompanions, setShowCompanions,
  setShowRestModal, setShowSceneVisualizer, setShowPortraitGen, setShowCharSheet,
}) {
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);
  const moreBtnRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (showMore && moreBtnRef.current) {
      const rect = moreBtnRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [showMore]);

  // Primary buttons (always visible)
  const primaryActions = [
    { icon: Dices, label: 'Dice', active: showDiceRoller, onClick: () => setShowDiceRoller(v => !v), color: 'rgba(201,169,110,0.6)', activeColor: '#f0c040' },
    { emoji: '🐾', label: 'Pets', active: showCompanions, onClick: () => setShowCompanions(v => !v), color: 'rgba(201,169,110,0.6)', activeColor: '#f0c040' },
    ...(!inCombat ? [{ icon: Moon, label: 'Rest', onClick: () => setShowRestModal(true), color: 'rgba(168,139,253,0.6)', activeColor: '#c4b5fd' }] : []),
    { icon: Scroll, label: 'Sheet', onClick: () => setShowCharSheet(true), color: 'rgba(201,169,110,0.6)', activeColor: '#c9a96e' },
  ];

  // Overflow menu items
  const overflowActions = [
    { icon: BookMarked, label: 'Combat History', onClick: () => navigate(createPageUrl('CombatHistory')), color: 'rgba(252,165,165,0.7)' },
    { icon: ShoppingBag, label: 'Market', onClick: () => navigate(createPageUrl('Market') + `?session_id=${sessionId}&character_id=${characterId}`), color: 'rgba(240,192,64,0.7)' },
    { icon: Map, label: 'Travel', onClick: () => navigate(createPageUrl('WorldMap') + `?session_id=${sessionId}&character_id=${characterId}`), color: 'rgba(192,132,252,0.7)' },
    ...(started && !inCombat ? [{ icon: Eye, label: 'Visualize Scene', onClick: () => { setShowSceneVisualizer(true); setShowMore(false); }, color: 'rgba(216,180,254,0.7)' }] : []),
    { icon: Paintbrush, label: 'Portrait', onClick: () => { setShowPortraitGen(true); setShowMore(false); }, color: 'rgba(201,169,110,0.7)' },
    { icon: Scroll, label: 'Full Character Sheet', onClick: () => navigate(createPageUrl('CharacterSheetPage') + `?character_id=${characterId}&session_id=${sessionId}`), color: 'rgba(180,140,255,0.7)' },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0 overflow-x-auto">
      {primaryActions.map((btn, i) => {
        const Icon = btn.icon;
        const isActive = btn.active;
        return (
          <button key={i} onClick={btn.onClick}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-fantasy whitespace-nowrap transition-all flex-shrink-0"
            style={isActive ? {
              background: 'rgba(80,50,10,0.7)', border: '1px solid rgba(201,169,110,0.5)', color: btn.activeColor,
            } : {
              background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: btn.color,
            }}>
            {btn.emoji ? <span className="text-sm">{btn.emoji}</span> : <Icon className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{btn.label}</span>
          </button>
        );
      })}

      {/* More button */}
      <div className="relative flex-shrink-0">
        <button ref={moreBtnRef} onClick={() => setShowMore(v => !v)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-fantasy transition-all"
          style={showMore ? {
            background: 'rgba(80,50,10,0.7)', border: '1px solid rgba(201,169,110,0.5)', color: '#f0c040',
          } : {
            background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.5)',
          }}>
          <MoreHorizontal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">More</span>
        </button>

        {showMore && createPortal(
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[9998]" onClick={() => setShowMore(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[9999] rounded-xl overflow-hidden shadow-2xl"
              style={{
                top: menuPos.top,
                right: menuPos.right,
                background: 'rgba(12,6,2,0.98)', border: '1px solid rgba(184,115,51,0.35)',
                minWidth: '200px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
              }}>
              {overflowActions.map((action, i) => (
                <button key={i} onClick={() => { action.onClick(); setShowMore(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-fantasy transition-all"
                  style={{ borderBottom: i < overflowActions.length - 1 ? '1px solid rgba(184,115,51,0.1)' : 'none', color: action.color }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(60,30,10,0.6)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <action.icon className="w-4 h-4 flex-shrink-0" />
                  {action.label}
                </button>
              ))}
            </motion.div>
          </>,
          document.body
        )}
      </div>
    </div>
  );
}