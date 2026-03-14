import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronLeft, TrendingUp, Award, Star, Sparkles, Heart, Shield, Zap, User, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CLASSES, PROFICIENCY_BY_LEVEL, calcStatMod } from '@/components/game/gameData';
import LevelUpModal from '@/components/game/LevelUpModal';

const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

export default function Progression() {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const chars = await base44.entities.Character.list('-updated_date', 20);
      setCharacters(chars.filter(c => c.is_active));
      setLoading(false);
    }
    load();
  }, []);

  const handleLevelUp = async (character, updates, details) => {
    await base44.entities.Character.update(character.id, updates);
    setCharacters(prev => prev.map(c => c.id === character.id ? { ...c, ...updates } : c));
    setSelectedChar(null);
  };

  const canLevelUp = (char) => {
    const currentLevel = char.level || 1;
    if (currentLevel >= 20) return false;
    const xpNeeded = XP_THRESHOLDS[currentLevel];
    return (char.xp || 0) >= xpNeeded;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center parchment-bg">
      <div className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(201,169,110,0.5)' }}>Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen parchment-bg" style={{ color: '#e8d5b7' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(8,5,2,0.96)', borderBottom: '1px solid rgba(180,140,90,0.15)', backdropFilter: 'blur(8px)' }}>
        <button onClick={() => navigate(createPageUrl('Home'))}
          className="flex items-center gap-1.5 text-sm font-fantasy transition-all"
          style={{ color: 'rgba(201,169,110,0.5)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.5)'}>
          <ChevronLeft className="w-4 h-4" />
          Home
        </button>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: '#c9a96e' }} />
          <span className="font-fantasy font-bold text-sm" style={{ color: '#f0c040' }}>Character Progression</span>
        </div>
        <div className="w-20" />
      </div>

      <div className="max-w-5xl mx-auto p-4 py-8 space-y-6">
        
        {/* Info Banner */}
        <div className="rounded-xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(50,25,5,0.5)', border: '1px solid rgba(184,115,51,0.2)' }}>
          <Star className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#f0c040' }} />
          <div>
            <h3 className="font-fantasy font-bold text-sm mb-1" style={{ color: '#f0c040' }}>
              Character Advancement Dashboard
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--parchment-dim)', fontFamily: 'EB Garamond, serif' }}>
              Track XP progress, level up characters, and unlock new features following D&D 5E rules. HP increases are rolled or averaged, proficiency bonuses scale automatically, and subclass selection happens at level 3.
            </p>
          </div>
        </div>

        {/* Characters Grid */}
        {characters.length === 0 ? (
          <div className="text-center py-16">
            <User className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: 'var(--brass-gold)' }} />
            <p className="font-fantasy text-sm" style={{ color: 'rgba(201,169,110,0.35)' }}>
              No characters yet. Create one to begin!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {characters.map((char, i) => {
              const currentLevel = char.level || 1;
              const currentXP = char.xp || 0;
              const xpForNext = XP_THRESHOLDS[currentLevel] || XP_THRESHOLDS[XP_THRESHOLDS.length - 1];
              const xpForCurrent = XP_THRESHOLDS[currentLevel - 1] || 0;
              const xpProgress = xpForNext > xpForCurrent ? ((currentXP - xpForCurrent) / (xpForNext - xpForCurrent)) * 100 : 100;
              const readyToLevel = canLevelUp(char);
              const classData = CLASSES[char.class] || {};
              const profBonus = PROFICIENCY_BY_LEVEL[currentLevel - 1] || 2;
              const nextLevelFeatures = classData.features?.[currentLevel + 1] || [];
              
              return (
                <motion.div
                  key={char.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl overflow-hidden fantasy-card"
                  style={{
                    background: 'linear-gradient(160deg, rgba(28,14,5,0.95), rgba(18,9,3,0.98))',
                    border: readyToLevel ? '2px solid rgba(240,192,64,0.6)' : '1px solid rgba(184,115,51,0.25)',
                    boxShadow: readyToLevel ? '0 0 30px rgba(240,192,64,0.2)' : '0 4px 20px rgba(0,0,0,0.6)',
                  }}>
                  
                  {/* Header */}
                  <div className="px-4 py-3 flex items-center justify-between"
                    style={{
                      background: readyToLevel
                        ? 'linear-gradient(90deg, rgba(80,50,10,0.7), rgba(60,35,8,0.5))'
                        : 'linear-gradient(90deg, rgba(60,30,8,0.7), rgba(40,20,5,0.5))',
                      borderBottom: '1px solid rgba(184,115,51,0.15)'
                    }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center font-fantasy font-bold text-sm"
                        style={{
                          background: 'linear-gradient(135deg, #6b3d1a, #3d2010)',
                          border: '1px solid rgba(212,149,90,0.4)',
                          color: '#f0d090'
                        }}>
                        {char.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-fantasy font-bold text-sm" style={{ color: 'var(--parchment)' }}>
                          {char.name}
                        </h3>
                        <p className="text-xs" style={{ color: 'rgba(212,149,90,0.6)', fontFamily: 'EB Garamond, serif' }}>
                          {char.race} {char.class}{char.subclass ? ` · ${char.subclass}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-fantasy ${readyToLevel ? 'badge-gold text-glow-gold' : 'badge-gold'}`}>
                      Lv.{currentLevel}
                    </span>
                  </div>
                  
                  {/* Progress Section */}
                  <div className="p-4 space-y-4">
                    
                    {/* XP Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5" style={{ color: '#d97706' }} />
                          <span className="text-xs font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.5)', fontSize: '0.6rem' }}>
                            EXPERIENCE
                          </span>
                        </div>
                        <span className="text-xs font-fantasy" style={{ color: 'rgba(201,169,110,0.7)' }}>
                          {currentXP} / {xpForNext} XP
                        </span>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden neuro-inset">
                        <motion.div
                          className="h-full rounded-full xp-bar"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, xpProgress)}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                          style={{ boxShadow: '0 0 8px rgba(184,115,51,0.3)' }} />
                      </div>
                      {currentLevel < 20 && (
                        <div className="text-xs mt-1.5" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
                          {xpForNext - currentXP} XP needed for level {currentLevel + 1}
                        </div>
                      )}
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="stat-box rounded-lg p-2 text-center">
                        <Heart className="w-3 h-3 mx-auto mb-1" style={{ color: '#dc2626' }} />
                        <div className="font-fantasy font-bold text-xs" style={{ color: '#fca5a5' }}>
                          {char.hp_current}/{char.hp_max}
                        </div>
                        <div className="text-xs" style={{ color: 'rgba(180,140,90,0.35)', fontSize: '0.6rem' }}>HP</div>
                      </div>
                      <div className="stat-box rounded-lg p-2 text-center">
                        <Shield className="w-3 h-3 mx-auto mb-1" style={{ color: '#93c5fd' }} />
                        <div className="font-fantasy font-bold text-xs" style={{ color: '#93c5fd' }}>
                          {char.armor_class}
                        </div>
                        <div className="text-xs" style={{ color: 'rgba(180,140,90,0.35)', fontSize: '0.6rem' }}>AC</div>
                      </div>
                      <div className="stat-box rounded-lg p-2 text-center">
                        <Sparkles className="w-3 h-3 mx-auto mb-1" style={{ color: '#a78bfa' }} />
                        <div className="font-fantasy font-bold text-xs" style={{ color: '#a78bfa' }}>
                          +{profBonus}
                        </div>
                        <div className="text-xs" style={{ color: 'rgba(180,140,90,0.35)', fontSize: '0.6rem' }}>Prof</div>
                      </div>
                      <div className="stat-box rounded-lg p-2 text-center">
                        <Zap className="w-3 h-3 mx-auto mb-1" style={{ color: '#fbbf24' }} />
                        <div className="font-fantasy font-bold text-xs" style={{ color: '#fbbf24' }}>
                          {char.speed}
                        </div>
                        <div className="text-xs" style={{ color: 'rgba(180,140,90,0.35)', fontSize: '0.6rem' }}>Speed</div>
                      </div>
                    </div>
                    
                    {/* Next Level Preview */}
                    {currentLevel < 20 && nextLevelFeatures.length > 0 && (
                      <div className="rounded-lg p-3"
                        style={{ background: 'rgba(10,50,20,0.2)', border: '1px solid rgba(40,160,80,0.2)' }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Award className="w-3 h-3" style={{ color: '#86efac' }} />
                          <span className="text-xs font-fantasy tracking-widest" style={{ color: 'rgba(134,239,172,0.6)', fontSize: '0.6rem' }}>
                            AT LEVEL {currentLevel + 1}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {nextLevelFeatures.slice(0, 2).map((feat, i) => (
                            <div key={i} className="text-xs flex items-start gap-1.5"
                              style={{ color: 'rgba(134,239,172,0.7)', fontFamily: 'EB Garamond, serif' }}>
                              <span className="mt-0.5">✓</span>
                              <span>{feat}</span>
                            </div>
                          ))}
                          {nextLevelFeatures.length > 2 && (
                            <div className="text-xs" style={{ color: 'rgba(134,239,172,0.4)' }}>
                              +{nextLevelFeatures.length - 2} more...
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Action Button */}
                    {readyToLevel ? (
                      <motion.button
                        onClick={() => { setSelectedChar(char); setShowLevelUp(true); }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-3 rounded-xl font-fantasy font-bold text-sm btn-fantasy flex items-center justify-center gap-2"
                        style={{
                          boxShadow: '0 0 20px rgba(240,192,64,0.2)',
                          animation: 'pulse 2s ease-in-out infinite',
                        }}>
                        <Star className="w-4 h-4" />
                        Level Up to {currentLevel + 1}!
                      </motion.button>
                    ) : currentLevel >= 20 ? (
                      <div className="w-full py-3 rounded-xl text-center font-fantasy text-sm"
                        style={{ background: 'rgba(80,30,120,0.3)', border: '1px solid rgba(140,80,220,0.3)', color: '#c4b5fd' }}>
                        <Sparkles className="w-4 h-4 inline mr-2" />
                        Max Level Reached
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <div className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
                          Keep adventuring to gain more XP
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Level Up Modal */}
      <AnimatePresence>
        {showLevelUp && selectedChar && (
          <LevelUpModal
            character={selectedChar}
            onLevelUp={(updates, details) => handleLevelUp(selectedChar, updates, details)}
            onClose={() => { setShowLevelUp(false); setSelectedChar(null); }}
          />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(240,192,64,0.2); }
          50% { box-shadow: 0 0 35px rgba(240,192,64,0.4); }
        }
      `}</style>
    </div>
  );
}