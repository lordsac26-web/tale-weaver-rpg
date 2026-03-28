import React, { useState } from 'react';
import { Star, Lock, Check, ChevronRight, Sparkles, TrendingUp, Award, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PROFICIENCY_BY_LEVEL } from './gameData';
import { FEATS as FEAT_LIST, canTakeFeat, CATEGORY_COLORS } from './featData';
import { computeFeatEffects, getFeatEffectSummary } from './featEffects';

// ASI/Feat levels: 4, 8, 12, 16, 19 (Fighter gets extra at 6, 14)
const getASILevels = (charClass) => {
  const base = [4, 8, 12, 16, 19];
  return charClass === 'Fighter' ? [4, 6, 8, 12, 14, 16, 19] : base;
};

// Category icons for display
const CATEGORY_ICONS = {
  General: '⭐', Combat: '⚔️', Magic: '🔮', Armor: '🛡️', Support: '💚',
  Utility: '🔧', Exploration: '🌍', Survival: '❤️', Social: '🎭', Stealth: '🥷', Racial: '🌟',
};

const SKILL_UPGRADES = {
  'Expertise: Athletics': { category: 'Skill', desc: 'Double proficiency bonus on Athletics checks.', cost: 1, skill: 'Athletics', icon: '💪' },
  'Expertise: Acrobatics': { category: 'Skill', desc: 'Double proficiency bonus on Acrobatics checks.', cost: 1, skill: 'Acrobatics', icon: '🤸' },
  'Expertise: Stealth': { category: 'Skill', desc: 'Double proficiency bonus on Stealth checks.', cost: 1, skill: 'Stealth', icon: '🥷' },
  'Expertise: Perception': { category: 'Skill', desc: 'Double proficiency bonus on Perception checks.', cost: 1, skill: 'Perception', icon: '👁️' },
  'Expertise: Investigation': { category: 'Skill', desc: 'Double proficiency bonus on Investigation checks.', cost: 1, skill: 'Investigation', icon: '🔍' },
  'Expertise: Persuasion': { category: 'Skill', desc: 'Double proficiency bonus on Persuasion checks.', cost: 1, skill: 'Persuasion', icon: '💬' },
  'Expertise: Deception': { category: 'Skill', desc: 'Double proficiency bonus on Deception checks.', cost: 1, skill: 'Deception', icon: '🎭' },
  'Expertise: Intimidation': { category: 'Skill', desc: 'Double proficiency bonus on Intimidation checks.', cost: 1, skill: 'Intimidation', icon: '😠' },
};

export default function CharacterGrowthTab({ character, onUpdate }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedUpgrade, setSelectedUpgrade] = useState(null);
  const [processingUpgrade, setProcessingUpgrade] = useState(false);

  const charLevel = character?.level || 1;
  const charClass = character?.class || '';
  const asiLevels = getASILevels(charClass);
  const takenFeats = character?.feats || [];
  const charSkills = character?.skills || {};

  // Calculate growth points: 1 per ASI level reached
  const earnedPoints = asiLevels.filter(lvl => charLevel >= lvl).length;
  const spentPoints = takenFeats.length;
  const availablePoints = earnedPoints - spentPoints;

  // Filter available feats from the canonical feat list
  const availableFeats = FEAT_LIST
    .filter(feat => !takenFeats.includes(feat.name) && canTakeFeat(feat, character || {}))
    .map(feat => [feat.name, feat]);

  // Available skill upgrades (only if proficient but not expert)
  const availableSkillUpgrades = Object.entries(SKILL_UPGRADES).filter(([name, upgrade]) => {
    const skillName = upgrade.skill;
    const skillLevel = charSkills[skillName];
    return (skillLevel === 'proficient' || skillLevel === true) && skillLevel !== 'expert';
  });

  const categories = ['all', 'Combat', 'Magic', 'General', 'Armor', 'Support', 'Utility', 'Social', 'Racial', 'Skill'];
  const filteredFeats = activeCategory === 'all' ? availableFeats : availableFeats.filter(([_, f]) => f.category === activeCategory);
  const filteredSkills = activeCategory === 'all' || activeCategory === 'Skill' ? availableSkillUpgrades : [];

  const handlePurchaseFeat = async (featName, feat) => {
    if (availablePoints < 1) return;
    setProcessingUpgrade(true);

    // Use the centralized feat effects engine
    const newFeats = [...takenFeats, featName];
    const effectUpdates = computeFeatEffects(character, [featName], {});
    const updates = { feats: newFeats, ...effectUpdates };

    // Apply feat AC bonus directly to armor_class
    if (updates._feat_ac_bonus) {
      updates.armor_class = (character.armor_class || 10) + updates._feat_ac_bonus;
      delete updates._feat_ac_bonus;
    }

    await onUpdate(updates);
    setSelectedUpgrade(null);
    setProcessingUpgrade(false);
  };

  const handlePurchaseSkillUpgrade = async (upgradeName, upgrade) => {
    if (availablePoints < upgrade.cost) return;
    setProcessingUpgrade(true);

    const skillName = upgrade.skill;
    const updatedSkills = { ...charSkills, [skillName]: 'expert' };

    await onUpdate({ skills: updatedSkills });
    setSelectedUpgrade(null);
    setProcessingUpgrade(false);
  };

  const handlePurchaseASI = async (stat1, stat2) => {
    if (availablePoints < 1) return;
    setProcessingUpgrade(true);

    const updates = { feats: [...takenFeats, `ASI: +${stat1}${stat2 ? `, +${stat2}` : ''}`] };
    updates[stat1] = Math.min(20, (character[stat1] || 10) + 1);
    if (stat2) updates[stat2] = Math.min(20, (character[stat2] || 10) + 1);

    await onUpdate(updates);
    setSelectedUpgrade(null);
    setProcessingUpgrade(false);
  };

  return (
    <div className="p-5 space-y-4">
      {/* Points Display */}
      <div className="rounded-xl p-4 text-center rune-border"
        style={{ background: 'rgba(80,50,10,0.5)', border: '1px solid rgba(201,169,110,0.35)' }}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Star className="w-5 h-5" style={{ color: '#f0c040' }} />
          <span className="font-fantasy text-lg font-bold text-glow-gold" style={{ color: '#f0c040' }}>
            {availablePoints} Growth Point{availablePoints !== 1 ? 's' : ''} Available
          </span>
        </div>
        <div className="text-xs" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
          Earned at levels: {asiLevels.filter(l => charLevel >= l).join(', ')} · Next at level {asiLevels.find(l => l > charLevel) || '—'}
        </div>
        <div className="text-xs mt-1" style={{ color: 'rgba(180,140,90,0.4)' }}>
          {spentPoints} point{spentPoints !== 1 ? 's' : ''} spent on {takenFeats.length} upgrade{takenFeats.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button key={cat}
            onClick={() => setActiveCategory(cat)}
            className="px-3 py-1.5 rounded-lg text-xs font-fantasy capitalize whitespace-nowrap transition-all flex-shrink-0"
            style={activeCategory === cat ? {
              background: 'rgba(80,50,10,0.6)',
              border: '1px solid rgba(201,169,110,0.45)',
              color: '#f0c040',
            } : {
              background: 'rgba(15,10,5,0.5)',
              border: '1px solid rgba(180,140,90,0.1)',
              color: 'rgba(180,150,100,0.45)',
            }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Ability Score Improvement Option */}
      {(activeCategory === 'all' || activeCategory === 'Utility') && availablePoints > 0 && (
        <div className="p-4 rounded-xl cursor-pointer transition-all border"
          style={{ background: 'rgba(60,30,120,0.2)', border: '1px solid rgba(140,80,220,0.25)' }}
          onClick={() => setSelectedUpgrade({ type: 'asi' })}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(160,100,240,0.45)'; e.currentTarget.style.background = 'rgba(80,40,140,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(140,80,220,0.25)'; e.currentTarget.style.background = 'rgba(60,30,120,0.2)'; }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(100,50,160,0.4)', border: '1px solid rgba(160,100,240,0.3)' }}>
              <TrendingUp className="w-5 h-5" style={{ color: '#c4b5fd' }} />
            </div>
            <div className="flex-1">
              <div className="font-fantasy font-bold text-sm mb-1" style={{ color: '#dfc8ff' }}>
                Ability Score Improvement
              </div>
              <div className="text-xs leading-relaxed" style={{ color: 'rgba(196,181,253,0.6)', fontFamily: 'EB Garamond, serif' }}>
                Increase two ability scores by 1 each (max 20), or increase one score by 2.
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full badge-arcane flex-shrink-0">
              <Star className="w-3 h-3" />
              <span className="text-xs font-bold">1 pt</span>
            </div>
          </div>
        </div>
      )}

      {/* Feats Grid */}
      <div className="space-y-2">
        {filteredFeats.map(([name, feat]) => {
          const effectSummary = getFeatEffectSummary(name);
          const icon = CATEGORY_ICONS[feat.category] || '⭐';
          return (
            <motion.div key={name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl cursor-pointer transition-all border"
              style={{ background: 'rgba(20,13,5,0.5)', border: '1px solid rgba(180,140,90,0.15)' }}
              onClick={() => availablePoints >= 1 && setSelectedUpgrade({ type: 'feat', name, data: feat })}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.35)'; e.currentTarget.style.background = 'rgba(30,18,7,0.6)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,140,90,0.15)'; e.currentTarget.style.background = 'rgba(20,13,5,0.5)'; }}>
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-fantasy font-bold text-sm mb-1" style={{ color: '#f0c040' }}>{name}</div>
                  <div className="text-xs leading-relaxed mb-1" style={{ color: 'rgba(201,169,110,0.65)', fontFamily: 'EB Garamond, serif' }}>
                    {feat.description?.slice(0, 150)}{feat.description?.length > 150 ? '...' : ''}
                  </div>
                  {effectSummary.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {effectSummary.map((line, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(10,40,15,0.5)', border: '1px solid rgba(40,160,80,0.2)', color: '#86efac', fontSize: '0.62rem' }}>
                          {line}
                        </span>
                      ))}
                    </div>
                  )}
                  {feat.prerequisite && (
                    <div className="text-xs mt-1" style={{ color: 'rgba(180,120,200,0.5)' }}>
                      Requires: {feat.prerequisite}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full badge-gold">
                    <Star className="w-3 h-3" />
                    <span className="text-xs font-bold">1 pt</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(60,30,8,0.5)', color: 'rgba(201,169,110,0.5)' }}>
                    {feat.category}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Skill Upgrades */}
      {filteredSkills.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mt-4">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.3))' }} />
            <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(201,169,110,0.5)' }}>SKILL EXPERTISE</span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(201,169,110,0.3), transparent)' }} />
          </div>
          {filteredSkills.map(([name, upgrade]) => (
            <motion.div key={name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl cursor-pointer transition-all border"
              style={{ background: 'rgba(8,38,15,0.3)', border: '1px solid rgba(40,160,80,0.2)' }}
              onClick={() => availablePoints >= upgrade.cost && setSelectedUpgrade({ type: 'skill', name, data: upgrade })}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(60,200,100,0.4)'; e.currentTarget.style.background = 'rgba(12,50,20,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(40,160,80,0.2)'; e.currentTarget.style.background = 'rgba(8,38,15,0.3)'; }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{upgrade.icon}</span>
                <div className="flex-1">
                  <div className="font-fantasy font-bold text-xs" style={{ color: '#86efac' }}>{name}</div>
                  <div className="text-xs" style={{ color: 'rgba(134,239,172,0.5)', fontFamily: 'EB Garamond, serif' }}>
                    {upgrade.desc}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full badge-green">
                  <Star className="w-3 h-3" />
                  <span className="text-xs font-bold">{upgrade.cost} pt</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredFeats.length === 0 && filteredSkills.length === 0 && (
        <div className="text-center py-12">
          <Lock className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgba(180,140,90,0.3)' }} />
          <p className="text-sm" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
            {availablePoints === 0 ? 'Gain more levels to unlock growth points' : 'No available upgrades in this category'}
          </p>
        </div>
      )}

      {/* Taken Feats */}
      {takenFeats.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.3))' }} />
            <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(201,169,110,0.5)' }}>ACQUIRED</span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(201,169,110,0.3), transparent)' }} />
          </div>
          {takenFeats.map((featName, i) => {
            const feat = FEAT_LIST.find(f => f.name === featName);
            const isASI = featName.startsWith('ASI:');
            return (
              <div key={i} className="p-3 rounded-lg flex items-center gap-3"
                style={{ background: 'rgba(10,40,15,0.4)', border: '1px solid rgba(40,160,80,0.2)' }}>
                <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#86efac' }} />
                <div className="flex-1">
                  <div className="font-fantasy font-bold text-xs" style={{ color: '#86efac' }}>{featName}</div>
                  {!isASI && feat && (
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(134,239,172,0.45)', fontFamily: 'EB Garamond, serif' }}>
                      {feat.description?.slice(0, 80)}{feat.description?.length > 80 ? '...' : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Purchase Modal */}
      <AnimatePresence>
        {selectedUpgrade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            onClick={() => !processingUpgrade && setSelectedUpgrade(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="glass-panel rune-border rounded-2xl p-6 max-w-md w-full">
              
              {selectedUpgrade.type === 'asi' ? (
                <ASISelector 
                  character={character}
                  onConfirm={handlePurchaseASI}
                  onCancel={() => setSelectedUpgrade(null)}
                  processing={processingUpgrade}
                />
              ) : selectedUpgrade.type === 'feat' ? (
                <>
                  <div className="text-center mb-4">
                    <div className="text-4xl mb-3">{CATEGORY_ICONS[selectedUpgrade.data.category] || '⭐'}</div>
                    <h3 className="font-fantasy text-xl font-bold text-glow-gold" style={{ color: '#f0c040' }}>
                      {selectedUpgrade.name}
                    </h3>
                  </div>

                  <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(15,10,5,0.6)', border: '1px solid rgba(180,140,90,0.15)' }}>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(232,213,183,0.8)', fontFamily: 'EB Garamond, serif' }}>
                      {selectedUpgrade.data.description}
                    </p>
                  </div>

                  {/* Show mechanical effects */}
                  {(() => {
                    const summary = getFeatEffectSummary(selectedUpgrade.name);
                    return summary.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {summary.map((line, i) => (
                          <span key={i} className="px-2 py-1 rounded-lg text-xs" style={{ background: 'rgba(10,40,15,0.5)', border: '1px solid rgba(40,160,80,0.25)', color: '#86efac' }}>
                            {line}
                          </span>
                        ))}
                      </div>
                    ) : null;
                  })()}

                  {selectedUpgrade.data.prerequisite && (
                    <div className="text-xs mb-4 p-2 rounded" style={{ background: 'rgba(80,30,120,0.2)', color: 'rgba(192,132,252,0.7)' }}>
                      ⚠️ Requires: {selectedUpgrade.data.prerequisite}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => setSelectedUpgrade(null)} disabled={processingUpgrade}
                      className="flex-1 py-2 rounded-lg text-sm font-fantasy"
                      style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}>
                      Cancel
                    </button>
                    <button onClick={() => handlePurchaseFeat(selectedUpgrade.name, selectedUpgrade.data)}
                      disabled={processingUpgrade || availablePoints < 1}
                      className="flex-1 py-2 rounded-lg text-sm font-fantasy btn-fantasy disabled:opacity-50 flex items-center justify-center gap-2">
                      {processingUpgrade ? <Zap className="w-4 h-4 animate-pulse" /> : <Star className="w-4 h-4" />}
                      {processingUpgrade ? 'Acquiring...' : 'Acquire (1 pt)'}
                    </button>
                  </div>
                </>
              ) : selectedUpgrade.type === 'skill' ? (
                <>
                  <div className="text-center mb-4">
                    <div className="text-4xl mb-3">{selectedUpgrade.data.icon}</div>
                    <h3 className="font-fantasy text-lg font-bold" style={{ color: '#86efac' }}>
                      {selectedUpgrade.name}
                    </h3>
                  </div>

                  <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(10,40,15,0.4)', border: '1px solid rgba(40,160,80,0.2)' }}>
                    <p className="text-sm" style={{ color: 'rgba(134,239,172,0.7)', fontFamily: 'EB Garamond, serif' }}>
                      {selectedUpgrade.data.desc}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setSelectedUpgrade(null)} disabled={processingUpgrade}
                      className="flex-1 py-2 rounded-lg text-sm font-fantasy"
                      style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}>
                      Cancel
                    </button>
                    <button onClick={() => handlePurchaseSkillUpgrade(selectedUpgrade.name, selectedUpgrade.data)}
                      disabled={processingUpgrade || availablePoints < selectedUpgrade.data.cost}
                      className="flex-1 py-2 rounded-lg text-sm font-fantasy btn-fantasy disabled:opacity-50 flex items-center justify-center gap-2">
                      {processingUpgrade ? <Zap className="w-4 h-4 animate-pulse" /> : <Star className="w-4 h-4" />}
                      {processingUpgrade ? 'Upgrading...' : `Acquire (${selectedUpgrade.data.cost} pt)`}
                    </button>
                  </div>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ASI Selection Component
function ASISelector({ character, onConfirm, onCancel, processing }) {
  const [stat1, setStat1] = useState('');
  const [stat2, setStat2] = useState('');
  const stats = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  const LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };

  const canConfirm = stat1 && (stat1 !== stat2 || !stat2);

  return (
    <>
      <div className="text-center mb-4">
        <div className="text-4xl mb-3">📈</div>
        <h3 className="font-fantasy text-xl font-bold text-glow-gold" style={{ color: '#f0c040' }}>
          Ability Score Improvement
        </h3>
        <p className="text-xs mt-2" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
          Choose two different stats to increase by +1 each (or the same stat twice for +2)
        </p>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <label className="text-xs font-fantasy tracking-widest mb-1.5 block" style={{ color: 'rgba(201,169,110,0.6)' }}>
            FIRST INCREASE
          </label>
          <select value={stat1} onChange={e => setStat1(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm select-fantasy">
            <option value="">Select ability...</option>
            {stats.map(s => (
              <option key={s} value={s} disabled={(character?.[s] || 10) >= 20}>
                {LABELS[s]} ({character?.[s] || 10}) {(character?.[s] || 10) >= 20 ? '(MAX)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-fantasy tracking-widest mb-1.5 block" style={{ color: 'rgba(201,169,110,0.6)' }}>
            SECOND INCREASE (OPTIONAL)
          </label>
          <select value={stat2} onChange={e => setStat2(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm select-fantasy"
            disabled={!stat1}>
            <option value="">Same as first (+2 total)</option>
            {stats.filter(s => s !== stat1).map(s => (
              <option key={s} value={s} disabled={(character?.[s] || 10) >= 20}>
                {LABELS[s]} ({character?.[s] || 10}) {(character?.[s] || 10) >= 20 ? '(MAX)' : ''}
              </option>
            ))}
          </select>
        </div>

        {stat1 && (
          <div className="p-3 rounded-lg" style={{ background: 'rgba(60,30,120,0.2)', border: '1px solid rgba(140,80,220,0.25)' }}>
            <div className="text-xs font-fantasy mb-1" style={{ color: '#dfc8ff' }}>PREVIEW:</div>
            <div className="text-sm" style={{ color: 'rgba(196,181,253,0.8)' }}>
              {LABELS[stat1]}: {character?.[stat1] || 10} → {Math.min(20, (character?.[stat1] || 10) + (stat2 && stat2 !== stat1 ? 1 : 2))}
              {stat2 && stat2 !== stat1 && (
                <span> · {LABELS[stat2]}: {character?.[stat2] || 10} → {Math.min(20, (character?.[stat2] || 10) + 1)}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} disabled={processing}
          className="flex-1 py-2 rounded-lg text-sm font-fantasy"
          style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}>
          Cancel
        </button>
        <button onClick={() => onConfirm(stat1, stat2 || null)}
          disabled={processing || !canConfirm}
          className="flex-1 py-2 rounded-lg text-sm font-fantasy btn-fantasy disabled:opacity-50 flex items-center justify-center gap-2">
          {processing ? <Zap className="w-4 h-4 animate-pulse" /> : <Award className="w-4 h-4" />}
          {processing ? 'Applying...' : 'Confirm (1 pt)'}
        </button>
      </div>
    </>
  );
}