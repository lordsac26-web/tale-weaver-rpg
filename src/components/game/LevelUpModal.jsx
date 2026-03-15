import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, TrendingUp, Heart, Shield, Sparkles, Award, X, ChevronRight } from 'lucide-react';
import { CLASSES, calcStatMod, PROFICIENCY_BY_LEVEL } from './gameData';

const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

const ASI_LEVELS = [4, 8, 12, 16, 19]; // Standard ASI levels for most classes
const FIGHTER_ROGUE_ASI = [4, 6, 8, 10, 12, 14, 16, 19]; // Fighter/Rogue get extra ASIs

export default function LevelUpModal({ character, onLevelUp, onClose }) {
  const [selectedSubclass, setSelectedSubclass] = useState('');
  const [hpRoll, setHpRoll] = useState(null);
  const [asiChoice, setAsiChoice] = useState('stats'); // 'stats' or 'feat'
  const [statIncreases, setStatIncreases] = useState({ first: '', second: '' });
  const [selectedFeat, setSelectedFeat] = useState('');
  
  const currentLevel = character.level || 1;
  const newLevel = currentLevel + 1;
  const classData = CLASSES[character.class] || {};
  const hitDie = classData.hit_die || 8;
  const conMod = calcStatMod(character.constitution || 10);
  const oldProfBonus = PROFICIENCY_BY_LEVEL[currentLevel - 1] || 2;
  const newProfBonus = PROFICIENCY_BY_LEVEL[newLevel - 1] || 2;
  
  // Check if this level grants subclass selection
  const needsSubclass = !character.subclass && newLevel >= 3 && classData.subclasses?.length > 0;
  
  // Check if this level grants ASI/Feat
  const asiLevels = ['Fighter', 'Rogue'].includes(character.class) ? FIGHTER_ROGUE_ASI : ASI_LEVELS;
  const grantsASI = asiLevels.includes(newLevel);
  
  // Get new features for this level
  const newFeatures = classData.features?.[newLevel] || [];
  
  // Simple feat options (most common)
  const COMMON_FEATS = [
    { name: 'Lucky', desc: '3 luck points per long rest - reroll d20s or force enemy rerolls' },
    { name: 'Alert', desc: '+5 Initiative, cannot be surprised, hidden attackers get no advantage' },
    { name: 'Tough', desc: '+2 HP per level (retroactive)' },
    { name: 'War Caster', desc: 'Advantage on Concentration saves, cast spells as opportunity attacks' },
    { name: 'Mobile', desc: '+10 speed, Dash ignores difficult terrain, no opportunity attacks after melee' },
    { name: 'Sharpshooter', desc: '-5 attack / +10 damage, ignore half/¾ cover, no long range disadvantage' },
    { name: 'Great Weapon Master', desc: '-5 attack / +10 damage, bonus attack on crit/kill' },
    { name: 'Resilient', desc: 'Pick a stat: +1 to that stat and gain saving throw proficiency' },
    { name: 'Observant', desc: '+5 passive Perception/Investigation, read lips, +1 INT or WIS' },
  ];
  
  // Roll HP or take average
  const rollHP = () => {
    const roll = Math.floor(Math.random() * hitDie) + 1;
    setHpRoll(roll);
  };
  
  const takeAverage = () => {
    const avg = Math.floor(hitDie / 2) + 1;
    setHpRoll(avg);
  };
  
  const confirmLevelUp = async () => {
    if (needsSubclass && !selectedSubclass) {
      alert('Please select a subclass to continue.');
      return;
    }
    
    if (hpRoll === null) {
      alert('Please roll for HP or take the average.');
      return;
    }
    
    if (grantsASI) {
      if (asiChoice === 'stats' && (!statIncreases.first || !statIncreases.second)) {
        alert('Please select two ability scores to increase.');
        return;
      }
      if (asiChoice === 'feat' && !selectedFeat) {
        alert('Please select a feat.');
        return;
      }
    }
    
    const hpGain = hpRoll + conMod;
    const updates = {
      level: newLevel,
      hp_max: (character.hp_max || 0) + hpGain,
      hp_current: (character.hp_current || 0) + hpGain,
      proficiency_bonus: newProfBonus,
    };
    
    if (needsSubclass) {
      updates.subclass = selectedSubclass;
    }
    
    // Apply ASI
    if (grantsASI && asiChoice === 'stats') {
      updates[statIncreases.first] = (character[statIncreases.first] || 10) + 1;
      updates[statIncreases.second] = (character[statIncreases.second] || 10) + 1;
    }
    
    // Apply Feat
    if (grantsASI && asiChoice === 'feat') {
      updates.feats = [...(character.feats || []), selectedFeat];
      
      // Apply feat bonuses
      if (selectedFeat === 'Tough') {
        const toughBonus = newLevel * 2; // +2 HP per level (retroactive)
        updates.hp_max = (character.hp_max || 0) + hpGain + toughBonus;
        updates.hp_current = (character.hp_current || 0) + hpGain + toughBonus;
      } else if (selectedFeat === 'Resilient' && statIncreases.first) {
        updates[statIncreases.first] = (character[statIncreases.first] || 10) + 1;
      } else if (selectedFeat === 'Observant' && statIncreases.first) {
        updates[statIncreases.first] = (character[statIncreases.first] || 10) + 1;
      }
    }
    
    // Add new features to character
    if (newFeatures.length > 0) {
      updates.features = [...(character.features || []), ...newFeatures];
    }
    
    await onLevelUp(updates, { hpGain, newFeatures, asi: grantsASI });
    onClose();
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-2xl rounded-2xl overflow-hidden rune-border"
        style={{
          background: 'linear-gradient(160deg, rgba(28,14,5,0.98), rgba(18,9,3,0.99))',
          border: '2px solid rgba(184,115,51,0.4)',
          boxShadow: '0 0 60px rgba(184,115,51,0.25), 0 20px 60px rgba(0,0,0,0.8)',
        }}
        onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="relative overflow-hidden px-6 py-8 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(80,45,10,0.6), rgba(50,25,5,0.8))',
            borderBottom: '2px solid rgba(184,115,51,0.3)',
          }}>
          <motion.div
            animate={{
              rotate: [0, 5, -5, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-4 left-1/2 -translate-x-1/2 text-6xl opacity-20">
            ⭐
          </motion.div>
          
          <button onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(201,169,110,0.4)', background: 'rgba(20,13,5,0.6)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(201,169,110,0.4)'}>
            <X className="w-4 h-4" />
          </button>
          
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}>
            <Star className="w-16 h-16 mx-auto mb-4 text-gold-shimmer" style={{ filter: 'drop-shadow(0 0 20px rgba(240,192,64,0.6))' }} />
          </motion.div>
          
          <h2 className="font-fantasy-deco font-bold text-3xl text-gold-shimmer mb-2">
            Level Up!
          </h2>
          <p className="font-serif text-lg" style={{ color: 'var(--parchment-mid)' }}>
            {character.name} advances to <span className="font-bold" style={{ color: '#f0c040' }}>Level {newLevel}</span>
          </p>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          
          {/* HP Gain */}
          <div className="rounded-xl p-4 rune-border"
            style={{ background: 'rgba(15,10,5,0.7)', border: '1px solid rgba(184,115,51,0.25)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4" style={{ color: '#dc2626' }} />
              <span className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>HIT POINTS</span>
            </div>
            
            {hpRoll === null ? (
              <div className="space-y-3">
                <p className="text-sm mb-3" style={{ color: 'var(--parchment-dim)', fontFamily: 'EB Garamond, serif' }}>
                  Roll 1d{hitDie} + {conMod} (CON), or take the average of {Math.floor(hitDie / 2) + 1} + {conMod}
                </p>
                <div className="flex gap-3">
                  <button onClick={rollHP}
                    className="flex-1 py-3 rounded-xl font-fantasy font-bold text-sm btn-fantasy flex items-center justify-center gap-2">
                    🎲 Roll 1d{hitDie}
                  </button>
                  <button onClick={takeAverage}
                    className="flex-1 py-3 rounded-xl font-fantasy font-bold text-sm"
                    style={{ background: 'rgba(60,30,8,0.6)', border: '1px solid rgba(184,115,51,0.3)', color: 'var(--brass-gold)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(92,51,24,0.7)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(60,30,8,0.6)'; }}>
                    📊 Take Average ({Math.floor(hitDie / 2) + 1})
                  </button>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-3">
                <div className="text-3xl font-fantasy font-bold text-glow-gold mb-2" style={{ color: '#f0c040' }}>
                  +{hpRoll + conMod} HP
                </div>
                <p className="text-xs" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
                  Rolled {hpRoll} + {conMod} (CON modifier)
                </p>
              </motion.div>
            )}
          </div>
          
          {/* Proficiency Bonus */}
          {newProfBonus > oldProfBonus && (
            <div className="rounded-xl p-4"
              style={{ background: 'rgba(10,25,60,0.3)', border: '1px solid rgba(60,100,220,0.25)' }}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4" style={{ color: '#93c5fd' }} />
                <span className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(147,197,253,0.7)' }}>PROFICIENCY BONUS</span>
              </div>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl font-fantasy" style={{ color: 'rgba(147,197,253,0.5)' }}>+{oldProfBonus}</span>
                <ChevronRight className="w-5 h-5" style={{ color: 'rgba(147,197,253,0.4)' }} />
                <span className="text-2xl font-fantasy font-bold" style={{ color: '#93c5fd' }}>+{newProfBonus}</span>
              </div>
            </div>
          )}
          
          {/* Subclass Selection */}
          {needsSubclass && (
            <div className="rounded-xl p-4 rune-border"
              style={{ background: 'rgba(50,10,90,0.3)', border: '1px solid rgba(150,90,230,0.3)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4" style={{ color: '#c4b5fd' }} />
                <span className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(196,181,253,0.7)' }}>CHOOSE YOUR PATH</span>
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--parchment-dim)', fontFamily: 'EB Garamond, serif' }}>
                At 3rd level, all {character.class}s must choose their specialization:
              </p>
              <div className="space-y-2">
                {classData.subclasses?.map(sub => (
                  <button key={sub.name} onClick={() => setSelectedSubclass(sub.name)}
                    className="w-full text-left p-3 rounded-lg transition-all"
                    style={selectedSubclass === sub.name ? {
                      background: 'rgba(80,30,120,0.6)',
                      border: '1px solid rgba(160,100,240,0.6)',
                      color: '#dfc8ff',
                    } : {
                      background: 'rgba(20,10,35,0.5)',
                      border: '1px solid rgba(120,70,200,0.2)',
                      color: 'rgba(192,132,252,0.6)',
                    }}>
                    <div className="font-fantasy font-bold text-sm mb-1">{sub.name}</div>
                    <div className="text-xs" style={{ color: 'rgba(196,181,253,0.5)', fontFamily: 'EB Garamond, serif' }}>
                      {sub.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* ASI / Feat Selection */}
          {grantsASI && (
            <div className="rounded-xl p-4 rune-border"
              style={{ background: 'rgba(60,30,80,0.3)', border: '1px solid rgba(180,100,255,0.3)' }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4" style={{ color: '#c4b5fd' }} />
                <span className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(196,181,253,0.7)' }}>ABILITY SCORE IMPROVEMENT</span>
              </div>
              
              <div className="flex gap-2 mb-4">
                <button onClick={() => setAsiChoice('stats')}
                  className="flex-1 py-2 rounded-lg text-xs font-fantasy transition-all"
                  style={asiChoice === 'stats' ? {
                    background: 'rgba(100,50,150,0.6)', border: '1px solid rgba(180,100,255,0.6)', color: '#dfc8ff'
                  } : {
                    background: 'rgba(30,15,40,0.5)', border: '1px solid rgba(140,80,200,0.2)', color: 'rgba(192,132,252,0.5)'
                  }}>
                  +2 Ability Scores
                </button>
                <button onClick={() => setAsiChoice('feat')}
                  className="flex-1 py-2 rounded-lg text-xs font-fantasy transition-all"
                  style={asiChoice === 'feat' ? {
                    background: 'rgba(100,50,150,0.6)', border: '1px solid rgba(180,100,255,0.6)', color: '#dfc8ff'
                  } : {
                    background: 'rgba(30,15,40,0.5)', border: '1px solid rgba(140,80,200,0.2)', color: 'rgba(192,132,252,0.5)'
                  }}>
                  Take a Feat
                </button>
              </div>
              
              {asiChoice === 'stats' ? (
                <div className="space-y-2">
                  <p className="text-xs mb-2" style={{ color: 'rgba(196,181,253,0.6)', fontFamily: 'EB Garamond, serif' }}>
                    Choose two ability scores to increase by +1 each (max 20):
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(stat => (
                      <button key={stat}
                        onClick={() => {
                          if (!statIncreases.first) setStatIncreases(p => ({ ...p, first: stat }));
                          else if (!statIncreases.second && stat !== statIncreases.first) setStatIncreases(p => ({ ...p, second: stat }));
                          else if (statIncreases.first === stat) setStatIncreases(p => ({ ...p, first: '' }));
                          else if (statIncreases.second === stat) setStatIncreases(p => ({ ...p, second: '' }));
                        }}
                        disabled={(character[stat] || 10) >= 20}
                        className="py-2 px-3 rounded-lg text-sm font-fantasy transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        style={statIncreases.first === stat || statIncreases.second === stat ? {
                          background: 'rgba(120,60,180,0.6)', border: '1px solid rgba(180,100,255,0.6)', color: '#dfc8ff'
                        } : {
                          background: 'rgba(20,10,30,0.5)', border: '1px solid rgba(140,80,200,0.2)', color: 'rgba(192,132,252,0.6)'
                        }}>
                        {stat.toUpperCase()} ({character[stat] || 10})
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs mb-2" style={{ color: 'rgba(196,181,253,0.6)', fontFamily: 'EB Garamond, serif' }}>
                    Select a feat to gain:
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {COMMON_FEATS.map(feat => (
                      <button key={feat.name}
                        onClick={() => setSelectedFeat(feat.name)}
                        className="w-full text-left p-2.5 rounded-lg text-sm transition-all"
                        style={selectedFeat === feat.name ? {
                          background: 'rgba(120,60,180,0.6)', border: '1px solid rgba(180,100,255,0.6)', color: '#dfc8ff'
                        } : {
                          background: 'rgba(20,10,30,0.5)', border: '1px solid rgba(140,80,200,0.2)', color: 'rgba(192,132,252,0.6)'
                        }}>
                        <div className="font-fantasy font-bold mb-0.5">{feat.name}</div>
                        <div className="text-xs" style={{ color: 'rgba(196,181,253,0.5)', fontFamily: 'EB Garamond, serif' }}>
                          {feat.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                  {(selectedFeat === 'Resilient' || selectedFeat === 'Observant') && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(140,80,200,0.2)' }}>
                      <p className="text-xs mb-2" style={{ color: 'rgba(196,181,253,0.6)' }}>
                        {selectedFeat === 'Resilient' ? 'Choose stat for +1 and save proficiency:' : 'Choose INT or WIS for +1:'}
                      </p>
                      <div className="grid grid-cols-6 gap-2">
                        {(selectedFeat === 'Resilient' 
                          ? ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
                          : ['intelligence', 'wisdom']
                        ).map(stat => (
                          <button key={stat}
                            onClick={() => setStatIncreases({ first: stat, second: '' })}
                            className="py-1.5 rounded text-xs font-fantasy transition-all"
                            style={statIncreases.first === stat ? {
                              background: 'rgba(120,60,180,0.6)', border: '1px solid rgba(180,100,255,0.6)', color: '#dfc8ff'
                            } : {
                              background: 'rgba(20,10,30,0.5)', border: '1px solid rgba(140,80,200,0.2)', color: 'rgba(192,132,252,0.6)'
                            }}>
                            {stat.slice(0, 3).toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* New Features */}
          {newFeatures.length > 0 && (
            <div className="rounded-xl p-4"
              style={{ background: 'rgba(10,50,20,0.3)', border: '1px solid rgba(40,160,80,0.25)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4" style={{ color: '#86efac' }} />
                <span className="font-fantasy text-sm tracking-widest" style={{ color: 'rgba(134,239,172,0.7)' }}>NEW FEATURES</span>
              </div>
              <div className="space-y-2">
                {newFeatures.map((feat, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm"
                    style={{ color: 'rgba(134,239,172,0.8)', fontFamily: 'EB Garamond, serif' }}>
                    <span className="text-xs mt-0.5">✓</span>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3 text-center stat-box">
              <div className="text-xs mb-1" style={{ color: 'rgba(180,140,90,0.5)' }}>Current XP</div>
              <div className="font-fantasy font-bold text-lg" style={{ color: '#f0c040' }}>
                {character.xp || 0}
              </div>
            </div>
            <div className="rounded-lg p-3 text-center stat-box">
              <div className="text-xs mb-1" style={{ color: 'rgba(180,140,90,0.5)' }}>Next Level</div>
              <div className="font-fantasy font-bold text-lg" style={{ color: 'rgba(201,169,110,0.6)' }}>
                {XP_THRESHOLDS[newLevel] || '—'}
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-6 pt-4 flex gap-3"
          style={{ borderTop: '1px solid rgba(184,115,51,0.2)', background: 'rgba(10,5,2,0.8)' }}>
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl font-fantasy text-sm"
            style={{ background: 'rgba(40,20,8,0.6)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}>
            Cancel
          </button>
          <button onClick={confirmLevelUp}
            disabled={
              hpRoll === null || 
              (needsSubclass && !selectedSubclass) ||
              (grantsASI && asiChoice === 'stats' && (!statIncreases.first || !statIncreases.second)) ||
              (grantsASI && asiChoice === 'feat' && !selectedFeat)
            }
            className="flex-1 py-3 rounded-xl font-fantasy font-bold text-sm btn-fantasy flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            <Star className="w-4 h-4" />
            Advance to Level {newLevel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}