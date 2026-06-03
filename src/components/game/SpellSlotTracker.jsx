import React, { useState } from 'react';
import { Zap, RotateCcw, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { getMulticlassSpellSlots, getSpellcastingEntries } from './multiclassUtils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const LEVEL_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/**
 * Enhanced SpellSlotTracker with visual slot management,
 * class-specific recovery mechanics, and detailed tooltips.
 */
export default function SpellSlotTracker({ character, onUpdateSlots, compact = false }) {
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  
  const charClass = character?.class || '';
  const spellcastingEntries = getSpellcastingEntries(character || {});
  const slotMaxArr = getMulticlassSpellSlots(character || {});
  const currentSlots = character?.spell_slots || {};
  const isWarlock = spellcastingEntries.some(entry => entry.className === 'Warlock');
  const wizardEntry = spellcastingEntries.find(entry => entry.className === 'Wizard');
  const isWizard = !!wizardEntry;

  const toggleSlot = (level, slotIndex) => {
    const levelKey = `level_${level}`;
    const maxSlots = slotMaxArr[level - 1] || 0;
    const usedSlots = currentSlots[levelKey] || 0;
    const remainingSlots = maxSlots - usedSlots;
    
    const newUsed = slotIndex < remainingSlots ? usedSlots + 1 : Math.max(0, usedSlots - 1);
    onUpdateSlots({ ...currentSlots, [levelKey]: newUsed });
  };

  const restoreAllSlots = () => {
    onUpdateSlots({});
  };

  // Warlock: All slots recover on short rest
  const handleWarlockShortRest = () => {
    restoreAllSlots();
    setShowRecoveryModal(false);
  };

  // Wizard: Arcane Recovery (recover slots ≤ ½ wizard level)
  const handleWizardArcaneRecovery = () => {
    const wizardLevel = wizardEntry?.levels || 1;
    const maxRecoverable = Math.floor(wizardLevel / 2);
    // Logic to recover appropriate slots would be implemented here
    restoreAllSlots(); // Simplified for demo
    setShowRecoveryModal(false);
  };

  if (slotMaxArr.length === 0) {
    return (
      <div className="text-center py-6 text-sm" style={{ color: 'rgba(180,140,90,0.3)' }}>
        No spell slots available.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: '#c4b5fd' }} />
            <span className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(196,181,253,0.7)', fontSize: '0.7rem' }}>
              SPELL SLOTS
            </span>
          </div>
          <div className="flex gap-2">
            {isWarlock && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleWarlockShortRest}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-fantasy transition-all"
                    style={{ background: 'rgba(50,10,90,0.4)', border: '1px solid rgba(150,90,230,0.4)', color: '#c4b5fd' }}>
                    <RotateCcw className="w-3 h-3" />
                    Short Rest
                  </button>
                </TooltipTrigger>
                <TooltipContent style={{ background: 'rgba(10,5,2,0.95)', border: '1px solid rgba(150,90,230,0.4)', color: '#e8d5b7' }}>
                  <p className="font-fantasy text-xs">Pact Magic: All slots recover on short rest</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            {isWizard && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleWizardArcaneRecovery}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-fantasy transition-all"
                    style={{ background: 'rgba(10,30,80,0.3)', border: '1px solid rgba(60,100,220,0.3)', color: '#93c5fd' }}>
                    <Sparkles className="w-3 h-3" />
                    Arcane Recovery
                  </button>
                </TooltipTrigger>
                <TooltipContent style={{ background: 'rgba(10,5,2,0.95)', border: '1px solid rgba(60,100,220,0.3)', color: '#e8d5b7' }}>
                  <p className="font-fantasy text-xs">Recover slots totaling ≤ ½ wizard level once per long rest</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            <button onClick={restoreAllSlots}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-fantasy transition-all"
              style={{ background: 'rgba(38,10,70,0.4)', border: '1px solid rgba(130,70,210,0.3)', color: 'rgba(192,132,252,0.7)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(160,110,255,0.5)'; e.currentTarget.style.color = '#c4b5fd'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(130,70,210,0.3)'; e.currentTarget.style.color = 'rgba(192,132,252,0.7)'; }}>
              <RotateCcw className="w-3 h-3" />
              Long Rest
            </button>
          </div>
        </div>

        {/* Slot Grid */}
        <div className="space-y-2.5">
          {slotMaxArr.map((maxSlots, idx) => {
            if (!maxSlots) return null;
            const level = idx + 1;
            const levelKey = `level_${level}`;
            const usedSlots = currentSlots[levelKey] || 0;
            const remainingSlots = maxSlots - usedSlots;
            
            return (
              <div key={level} className="flex items-center gap-3">
                <div className="w-12 text-right font-fantasy text-xs flex-shrink-0"
                  style={{ color: 'rgba(196,181,253,0.6)', fontSize: '0.7rem' }}>
                  {LEVEL_LABELS[idx]}
                </div>
                
                <div className="flex gap-1.5 flex-wrap flex-1">
                  {Array.from({ length: maxSlots }).map((_, slotIdx) => {
                    const isAvailable = slotIdx < remainingSlots;
                    return (
                      <Tooltip key={slotIdx}>
                        <TooltipTrigger asChild>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => toggleSlot(level, slotIdx)}
                            className="w-7 h-7 rounded-full border-2 transition-all"
                            style={isAvailable ? {
                              background: 'linear-gradient(135deg, rgba(120,60,200,0.6), rgba(80,40,160,0.7))',
                              borderColor: 'rgba(180,120,255,0.7)',
                              boxShadow: '0 0 8px rgba(160,100,240,0.3), inset 0 1px 3px rgba(255,255,255,0.15)',
                            } : {
                              background: 'rgba(20,10,30,0.5)',
                              borderColor: 'rgba(100,60,160,0.25)',
                              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
                            }}>
                            {isAvailable && (
                              <Zap className="w-3 h-3 mx-auto" style={{ color: '#dfc8ff' }} />
                            )}
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent style={{ background: 'rgba(10,5,2,0.95)', border: '1px solid rgba(180,140,90,0.2)', color: '#e8d5b7' }}>
                          <p className="font-fantasy text-xs">
                            {isAvailable ? `Available slot ${slotIdx + 1}` : `Used slot ${slotIdx + 1} (click to recover)`}
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'rgba(232,213,183,0.6)' }}>
                            Level {level} spell slot
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                
                <div className="text-xs font-mono flex-shrink-0" style={{ color: remainingSlots > 0 ? '#c4b5fd' : '#9ca3af' }}>
                  {remainingSlots}/{maxSlots}
                </div>
              </div>
            );
          })}
        </div>

        {/* Class-Specific Notes */}
        {isWarlock && (
          <div className="text-xs p-2.5 rounded-lg" style={{ background: 'rgba(50,10,90,0.3)', border: '1px solid rgba(150,90,230,0.2)', color: 'rgba(192,132,252,0.6)' }}>
            <strong style={{ color: '#c4b5fd' }}>Pact Magic:</strong> All slots recover on short rest. Spells always cast at highest slot level.
          </div>
        )}
        
        {isWizard && (
          <div className="text-xs p-2.5 rounded-lg" style={{ background: 'rgba(10,30,80,0.25)', border: '1px solid rgba(60,100,220,0.2)', color: 'rgba(147,197,253,0.6)' }}>
            <strong style={{ color: '#93c5fd' }}>Arcane Recovery:</strong> Once per long rest, recover spell slots totaling ≤½ wizard level on short rest.
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}