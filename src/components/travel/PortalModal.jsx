import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Skull, AlertTriangle, Coins, CheckCircle, Zap } from 'lucide-react';
import { COMPLICATIONS_TABLE, WILD_MAGIC_EFFECTS } from './portalData';

function rollDie(sides) { return Math.floor(Math.random() * sides) + 1; }

function resolveComplication(roll) {
  return COMPLICATIONS_TABLE.find(c => roll >= c.roll_min && roll <= c.roll_max) || COMPLICATIONS_TABLE[0];
}

export default function PortalModal({ portal, type, character, onClose, onTravel }) {
  const [phase, setPhase] = useState('info'); // info | haggling | rolling | result
  const [rollValue, setRollValue] = useState(null);
  const [safetyRoll, setSafetyRoll] = useState(null);
  const [complication, setComplication] = useState(null);
  const [haggledCost, setHaggledCost] = useState(null);
  const [hagglerResult, setHagglerResult] = useState(null);
  const [outcome, setOutcome] = useState(null); // 'safe' | 'partial' | 'complication'
  const [selectedDest, setSelectedDest] = useState(
    type === 'sanctioned' ? portal.destination_hubs?.[0] : portal.destinations?.[0]
  );

  const cost = haggledCost ?? portal.cost_gp;
  const canAfford = (character?.gold || 0) >= cost;
  const isSanctioned = type === 'sanctioned';
  const guildMember = character?.guild_member || false;
  const effectiveCost = isSanctioned && guildMember ? (portal.guild_discount_cost || Math.floor(cost * 0.5)) : cost;

  const handleHaggle = () => {
    const charRoll = rollDie(20);
    const chaBonus = Math.floor(((character?.charisma || 10) - 10) / 2);
    const total = charRoll + chaBonus;
    let result, newCost;

    if (charRoll === 20 || total >= 20) {
      result = { label: 'CRITICAL SUCCESS!', color: '#f0c040', desc: 'You charm them completely. Free travel + reputation boost!', cost: 0 };
      newCost = 0;
    } else if (total >= 15) {
      const disc = Math.floor(portal.cost_gp * 0.4);
      result = { label: 'Success!', color: '#86efac', desc: `Smooth talking! 40% discount granted.`, cost: portal.cost_gp - disc };
      newCost = portal.cost_gp - disc;
    } else if (total >= 10) {
      const disc = Math.floor(portal.cost_gp * 0.2);
      result = { label: 'Partial Success', color: '#fde68a', desc: `Not bad. 20% off.`, cost: portal.cost_gp - disc };
      newCost = portal.cost_gp - disc;
    } else if (charRoll === 1) {
      result = { label: 'CRITICAL FAIL!', color: '#fca5a5', desc: 'You insult them. Price raised 25% — or you leave.', cost: Math.floor(portal.cost_gp * 1.25) };
      newCost = Math.floor(portal.cost_gp * 1.25);
    } else {
      result = { label: 'Failed', color: '#fca5a5', desc: 'They shrug. Price stands.', cost: portal.cost_gp };
      newCost = portal.cost_gp;
    }

    setHagglerResult({ ...result, roll: charRoll, total, chaBonus });
    setHaggledCost(newCost);
    setPhase('haggled');
  };

  const handleTravel = () => {
    if (isSanctioned) {
      setPhase('travelling');
      setTimeout(() => {
        setOutcome('safe');
        setPhase('result');
        onTravel({ type: 'safe', destination: selectedDest, cost: effectiveCost, portal });
      }, 1800);
    } else {
      setPhase('rolling');
      const roll = rollDie(100);
      setSafetyRoll(roll);
      setTimeout(() => {
        if (roll <= portal.safety_pct) {
          setOutcome('safe');
          setPhase('result');
          onTravel({ type: 'safe', destination: selectedDest, cost: effectiveCost, portal });
        } else {
          const compRoll = rollDie(100);
          const comp = resolveComplication(compRoll);
          setComplication(comp);
          // Wild magic: pick random effect
          if (comp.effect === 'wild_magic') {
            comp.wild_effect = WILD_MAGIC_EFFECTS[Math.floor(Math.random() * WILD_MAGIC_EFFECTS.length)];
          }
          if (comp.effect === 'lose_gold') {
            const lost = rollDie(20) + rollDie(20);
            comp.gold_lost = Math.min(lost, character?.gold || 0);
          }
          if (comp.effect === 'damage') {
            comp.damage_dealt = rollDie(6);
          }
          setOutcome('complication');
          setPhase('result');
          onTravel({ type: 'complication', destination: selectedDest, cost: effectiveCost, portal, complication: comp });
        }
      }, 1200);
    }
  };

  const destinations = isSanctioned ? portal.destination_hubs : portal.destinations;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={isSanctioned ? {
          background: 'rgba(12,9,3,0.97)', border: '1px solid rgba(201,169,110,0.4)',
          boxShadow: '0 0 60px rgba(201,169,110,0.15), 0 20px 60px rgba(0,0,0,0.8)'
        } : {
          background: 'rgba(8,4,14,0.97)', border: '1px solid rgba(140,60,220,0.4)',
          boxShadow: '0 0 60px rgba(120,40,200,0.15), 0 20px 60px rgba(0,0,0,0.8)'
        }}>

        {/* Header */}
        <div className="relative px-6 pt-5 pb-4"
          style={{ borderBottom: isSanctioned ? '1px solid rgba(201,169,110,0.15)' : '1px solid rgba(140,60,220,0.15)' }}>
          {/* Portal glow top bar */}
          <div className="absolute top-0 left-0 right-0 h-0.5"
            style={{ background: isSanctioned ? 'linear-gradient(90deg, transparent, rgba(201,169,110,0.6), transparent)' : 'linear-gradient(90deg, transparent, rgba(160,80,255,0.6), transparent)' }} />
          
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {isSanctioned ? (
                  <span className="text-xs px-2 py-0.5 rounded-full font-fantasy" style={{ background: 'rgba(60,40,5,0.7)', border: '1px solid rgba(201,169,110,0.35)', color: '#f0c040', fontSize: '0.62rem' }}>
                    ✦ MAGE GUILD SANCTIONED
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full font-fantasy flex items-center gap-1" style={{ background: 'rgba(40,10,70,0.7)', border: '1px solid rgba(140,60,220,0.35)', color: '#c084fc', fontSize: '0.62rem' }}>
                    <Skull className="w-2.5 h-2.5" /> UNAUTHORIZED
                  </span>
                )}
              </div>
              <h2 className="font-fantasy font-bold text-lg" style={{ color: isSanctioned ? '#f0c040' : '#c084fc' }}>
                {portal.name}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(180,150,100,0.5)', fontFamily: 'EB Garamond, serif' }}>
                {isSanctioned ? `${portal.city} · ${portal.region}` : portal.location_desc}
              </p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg transition-colors"
              style={{ color: 'rgba(180,140,90,0.4)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">

          {/* Phase: Info */}
          {(phase === 'info' || phase === 'haggled') && (
            <>
              {/* Description / flavor */}
              {isSanctioned && portal.flavor_text && (
                <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(40,28,5,0.5)', border: '1px solid rgba(201,169,110,0.12)' }}>
                  <p className="text-sm italic" style={{ color: 'rgba(232,213,183,0.65)', fontFamily: 'IM Fell English, serif', lineHeight: 1.6 }}>
                    "{portal.flavor_text}"
                  </p>
                </div>
              )}
              {!isSanctioned && (
                <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(30,10,50,0.5)', border: '1px solid rgba(140,60,220,0.12)' }}>
                  <div className="text-xs font-fantasy mb-1" style={{ color: 'rgba(192,132,252,0.6)' }}>OPERATOR</div>
                  <div className="text-sm font-semibold mb-1" style={{ color: '#e8d5b7', fontFamily: 'EB Garamond, serif' }}>{portal.operator_name}</div>
                  <p className="text-sm italic" style={{ color: 'rgba(200,170,230,0.65)', fontFamily: 'IM Fell English, serif', lineHeight: 1.6 }}>
                    "{portal.operator_greeting}"
                  </p>
                </div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(40,25,5,0.5)', border: '1px solid rgba(201,169,110,0.15)' }}>
                  <Coins className="w-4 h-4 mx-auto mb-1" style={{ color: '#f0c040' }} />
                  <div className="font-fantasy font-bold text-sm" style={{ color: phase === 'haggled' && haggledCost !== null ? (haggledCost < portal.cost_gp ? '#86efac' : '#fca5a5') : '#f0c040' }}>
                    {effectiveCost}gp
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>Cost</div>
                  {guildMember && isSanctioned && <div className="text-xs mt-0.5" style={{ color: '#86efac', fontSize: '0.6rem' }}>Guild rate</div>}
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(40,25,5,0.5)', border: '1px solid rgba(201,169,110,0.15)' }}>
                  {isSanctioned ? <Shield className="w-4 h-4 mx-auto mb-1" style={{ color: '#86efac' }} /> :
                    <AlertTriangle className="w-4 h-4 mx-auto mb-1" style={{ color: portal.safety_pct >= 70 ? '#86efac' : portal.safety_pct >= 50 ? '#fde68a' : '#fca5a5' }} />}
                  <div className="font-fantasy font-bold text-sm"
                    style={{ color: isSanctioned ? '#86efac' : portal.safety_pct >= 70 ? '#86efac' : portal.safety_pct >= 50 ? '#fde68a' : '#fca5a5' }}>
                    {isSanctioned ? '100%' : `${portal.safety_pct}%`}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>Safety</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(40,25,5,0.5)', border: '1px solid rgba(201,169,110,0.15)' }}>
                  <Zap className="w-4 h-4 mx-auto mb-1" style={{ color: '#93c5fd' }} />
                  <div className="font-fantasy font-bold text-sm" style={{ color: '#93c5fd' }}>Instant</div>
                  <div className="text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>Transit</div>
                </div>
              </div>

              {/* Destination selector */}
              {destinations?.length > 0 && (
                <div>
                  <div className="font-fantasy text-xs tracking-widest mb-2" style={{ color: 'rgba(180,140,90,0.45)', fontSize: '0.62rem' }}>DESTINATION</div>
                  <div className="space-y-1.5">
                    {destinations.map((dest, i) => (
                      <button key={i} onClick={() => setSelectedDest(dest)}
                        className="w-full text-left px-3 py-2 rounded-lg transition-all font-fantasy text-sm"
                        style={selectedDest === dest ? {
                          background: isSanctioned ? 'rgba(60,40,5,0.8)' : 'rgba(50,15,80,0.8)',
                          border: `1px solid ${isSanctioned ? 'rgba(201,169,110,0.5)' : 'rgba(160,80,240,0.5)'}`,
                          color: isSanctioned ? '#f0c040' : '#c084fc',
                        } : {
                          background: 'rgba(15,10,5,0.5)',
                          border: '1px solid rgba(180,140,90,0.12)',
                          color: 'rgba(201,169,110,0.55)',
                        }}>
                        {selectedDest === dest && '→ '}{dest}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Complications warning */}
              {!isSanctioned && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(50,5,5,0.3)', border: '1px solid rgba(180,30,30,0.2)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Skull className="w-3.5 h-3.5" style={{ color: '#fca5a5' }} />
                    <span className="font-fantasy text-xs" style={{ color: '#fca5a5', fontSize: '0.65rem' }}>POSSIBLE COMPLICATIONS ({100 - portal.safety_pct}% CHANCE)</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {['Wild Magic', 'Ambush', 'Pickpocketed', 'Wrong Dest', 'Fatigue', 'Damage'].map(c => (
                      <span key={c} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(80,10,10,0.5)', color: 'rgba(250,170,170,0.7)', fontSize: '0.6rem' }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Haggle result */}
              {phase === 'haggled' && hagglerResult && (
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(20,15,5,0.7)', border: `1px solid ${hagglerResult.color}40` }}>
                  <div className="font-fantasy font-bold text-sm mb-1" style={{ color: hagglerResult.color }}>{hagglerResult.label}</div>
                  <div className="text-xs mb-1" style={{ color: 'rgba(201,169,110,0.6)', fontFamily: 'EB Garamond, serif' }}>
                    Rolled {hagglerResult.roll} {hagglerResult.chaBonus >= 0 ? '+' : ''}{hagglerResult.chaBonus} CHA = {hagglerResult.total}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(232,213,183,0.55)', fontFamily: 'EM Garamond, serif' }}>{hagglerResult.desc}</div>
                </div>
              )}

              {/* Gold warning */}
              {!canAfford && (
                <div className="text-center text-xs py-2 rounded-lg" style={{ background: 'rgba(50,5,5,0.4)', border: '1px solid rgba(180,30,30,0.3)', color: '#fca5a5' }}>
                  ⚠️ Insufficient gold ({character?.gold || 0}gp / {effectiveCost}gp required)
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <button onClick={handleTravel} disabled={!canAfford || !selectedDest}
                  className="flex-1 py-3 rounded-xl font-fantasy font-bold text-sm disabled:opacity-40 transition-all"
                  style={isSanctioned ? {
                    background: canAfford ? 'linear-gradient(135deg, rgba(80,55,10,0.9), rgba(50,35,5,0.95))' : 'rgba(20,15,5,0.5)',
                    border: '1px solid rgba(201,169,110,0.45)',
                    color: '#f0c040',
                    letterSpacing: '0.05em',
                  } : {
                    background: canAfford ? 'linear-gradient(135deg, rgba(60,15,100,0.9), rgba(40,8,70,0.95))' : 'rgba(20,5,30,0.5)',
                    border: '1px solid rgba(140,60,220,0.4)',
                    color: '#c084fc',
                    letterSpacing: '0.05em',
                  }}>
                  {isSanctioned ? '✦ Pay & Travel' : '⚠ Step Through'}
                </button>
                {!isSanctioned && phase !== 'haggled' && (
                  <button onClick={handleHaggle}
                    className="px-4 py-3 rounded-xl font-fantasy text-sm transition-all"
                    style={{ background: 'rgba(30,20,5,0.6)', border: '1px solid rgba(201,169,110,0.2)', color: 'rgba(201,169,110,0.6)', letterSpacing: '0.05em' }}>
                    Haggle
                  </button>
                )}
              </div>
            </>
          )}

          {/* Phase: Travelling (sanctioned animation) */}
          {phase === 'travelling' && (
            <div className="py-8 text-center">
              <motion.div animate={{ rotate: 360, scale: [1, 1.2, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                className="text-5xl mx-auto w-16 h-16 flex items-center justify-center mb-4">✦</motion.div>
              <div className="font-fantasy text-sm" style={{ color: '#f0c040' }}>Transiting through the Guild Network...</div>
            </div>
          )}

          {/* Phase: Rolling */}
          {phase === 'rolling' && (
            <div className="py-8 text-center">
              <motion.div animate={{ rotate: [0, 180, 360, 540, 720], scale: [1, 1.3, 0.9, 1.2, 1] }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="text-5xl mx-auto w-16 h-16 flex items-center justify-center mb-4">🎲</motion.div>
              <div className="font-fantasy text-sm" style={{ color: '#c084fc' }}>Rolling for portal safety...</div>
              <div className="text-xs mt-1" style={{ color: 'rgba(192,132,252,0.5)', fontFamily: 'EB Garamond, serif' }}>
                Need ≤ {portal.safety_pct} on d100
              </div>
            </div>
          )}

          {/* Phase: Result */}
          {phase === 'result' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="py-2 space-y-3">
              {outcome === 'safe' ? (
                <div className="text-center py-4">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}
                    className="text-4xl mb-3">✅</motion.div>
                  <div className="font-fantasy font-bold text-lg" style={{ color: '#86efac' }}>Safe Arrival!</div>
                  {safetyRoll && <div className="text-xs mt-1" style={{ color: 'rgba(134,239,172,0.6)', fontFamily: 'EB Garamond, serif' }}>
                    Safety roll: {safetyRoll} / {portal.safety_pct} — Success
                  </div>}
                  <div className="text-sm mt-2" style={{ color: 'rgba(232,213,183,0.65)', fontFamily: 'IM Fell English, serif' }}>
                    You arrive in <span style={{ color: '#f0c040' }}>{selectedDest}</span>.
                  </div>
                </div>
              ) : complication && (
                <div className="space-y-3">
                  <div className="text-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}
                      className="text-4xl mb-2">{complication.icon}</motion.div>
                    <div className="font-fantasy font-bold text-base" style={{ color: complication.color }}>
                      ⚠ {complication.label}
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'rgba(180,140,90,0.5)', fontFamily: 'EB Garamond, serif' }}>
                      Safety roll: {safetyRoll} / {portal.safety_pct} — FAILED
                    </div>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(20,10,30,0.6)', border: `1px solid ${complication.color}30` }}>
                    <p className="text-sm" style={{ color: 'rgba(232,213,183,0.7)', fontFamily: 'IM Fell English, serif', lineHeight: 1.6 }}>
                      {complication.desc}
                    </p>
                    {complication.wild_effect && (
                      <p className="text-xs mt-2 italic" style={{ color: '#c084fc', fontFamily: 'EB Garamond, serif' }}>
                        Effect: {complication.wild_effect}
                      </p>
                    )}
                    {complication.gold_lost > 0 && (
                      <p className="text-xs mt-2" style={{ color: '#fb923c' }}>
                        You lose {complication.gold_lost} gold pieces.
                      </p>
                    )}
                    {complication.damage_dealt > 0 && (
                      <p className="text-xs mt-2" style={{ color: '#fca5a5' }}>
                        You take {complication.damage_dealt} {complication.damage_type} damage.
                      </p>
                    )}
                  </div>
                  <div className="text-center text-sm" style={{ color: 'rgba(232,213,183,0.55)', fontFamily: 'IM Fell English, serif' }}>
                    Despite the complication, you arrive in <span style={{ color: '#f0c040' }}>{selectedDest}</span>.
                  </div>
                </div>
              )}
              <button onClick={onClose}
                className="w-full py-2.5 rounded-xl font-fantasy text-sm btn-fantasy">
                Continue
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}