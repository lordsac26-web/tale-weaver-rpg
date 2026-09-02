import React from 'react';
import { motion } from 'framer-motion';
import { X, Moon, Coffee, Loader2, Heart, Zap, Flame, Shield, Plus, Minus, CheckCircle2, AlertTriangle } from 'lucide-react';
import CampfireRestAnimation from './CampfireRestAnimation';
import useCampRestFlow from './useCampRestFlow';
import { CAMP_REST_TRANSITION_VERSION } from '../../../base44/shared/rest/campRestFlow';

export default function RestModal({ character, sessionId, onClose, onRest, onBusyChange }) {
  const totalHitDice = character?.level || 1;
  const maxHitDice = character?.hit_dice_remaining ?? totalHitDice;
  const HIT_DIE = { Fighter: 10, Ranger: 10, Paladin: 10, Barbarian: 12, Monk: 8, Rogue: 8, Bard: 8, Cleric: 8, Druid: 8, Warlock: 8, Wizard: 6, Sorcerer: 6, Artificer: 8 };
  const hitDie = HIT_DIE[character?.class] || 8;
  const conMod = Math.floor(((character?.constitution || 10) - 10) / 2);
  const avgHealPerDie = Math.floor(hitDie / 2) + 1 + conMod;
  const flow = useCampRestFlow({ sessionId, maxHitDice, onRest, onClose, onBusyChange });
  const { state, busy, hitDiceToSpend, setHitDiceToSpend } = flow;
  const restType = state.restType;

  // Calculate what gets restored
  const calcRestoration = (type) => {
    const restoration = [];
    
    if (type === 'short') {
      // Short rest: hit dice, some class features
      restoration.push({ icon: <Heart className="w-4 h-4" />, text: 'Spend Hit Dice to heal', color: '#dc2626' });
      
      if (character.class === 'Warlock') {
        restoration.push({ icon: <Zap className="w-4 h-4" />, text: 'All spell slots restored', color: '#a78bfa' });
      }
      
      if (character.class === 'Fighter') {
        restoration.push({ icon: <Flame className="w-4 h-4" />, text: 'Action Surge restored', color: '#f59e0b' });
        restoration.push({ icon: <Shield className="w-4 h-4" />, text: 'Second Wind restored', color: '#3b82f6' });
      }
      
      if (character.class === 'Monk') {
        restoration.push({ icon: <Zap className="w-4 h-4" />, text: 'All Ki points restored', color: '#8b5cf6' });
      }
      
      if (character.class === 'Bard') {
        restoration.push({ icon: <Zap className="w-4 h-4" />, text: 'Bardic Inspiration restored', color: '#ec4899' });
      }
    } else if (type === 'long') {
      // Long rest: full HP, all spell slots, hit dice, all abilities
      restoration.push({ icon: <Heart className="w-4 h-4" />, text: 'Full HP restored', color: '#22c55e' });
      restoration.push({ icon: <Zap className="w-4 h-4" />, text: 'All spell slots restored', color: '#a78bfa' });
      restoration.push({ icon: <Shield className="w-4 h-4" />, text: 'All class abilities restored', color: '#3b82f6' });
      restoration.push({ icon: <Heart className="w-4 h-4" />, text: `½ Hit Dice restored (${Math.max(1, Math.floor((character.level || 1) / 2))})`, color: '#f59e0b' });
      
      if (character.class === 'Wizard') {
        restoration.push({ icon: <Zap className="w-4 h-4" />, text: 'Arcane Recovery available', color: '#6366f1' });
      }
    }
    
    return restoration;
  };

  const closeFromBackdrop = (event) => {
    if (event.target === event.currentTarget) flow.close(event);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      data-camp-rest-transition-version={CAMP_REST_TRANSITION_VERSION}
      className="fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center overflow-hidden p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={closeFromBackdrop}>
      <motion.section
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby="rest-flow-title"
        className="flex max-h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-none rune-border sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
        style={{ background: 'rgba(15,10,5,0.98)', border: '1px solid rgba(180,140,90,0.3)', boxShadow: '0 0 60px rgba(0,0,0,0.9)' }}>
        <header className="flex flex-shrink-0 items-center justify-between px-5 py-4" style={{ background: 'rgba(30,20,8,0.6)', borderBottom: '1px solid rgba(180,140,90,0.15)' }}>
          <div className="flex items-center gap-3"><Moon className="h-5 w-5" style={{ color: '#c9a96e' }} /><h2 id="rest-flow-title" className="font-fantasy text-lg font-bold" style={{ color: '#f0c040' }}>Take a Rest</h2></div>
          <button type="button" aria-label="Close rest" onClick={flow.close} disabled={busy} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40" style={{ color: 'rgba(232,213,183,0.75)' }}><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {state.step === 'choose_type' && <div className="space-y-4">
            <p className="text-base leading-relaxed" style={{ color: 'rgba(232,213,183,0.78)', fontFamily: 'EB Garamond, serif' }}>Choose how you wish to rest and recover your strength.</p>
            {[['short', Coffee, 'Short Rest (1 hour)', 'Spend Hit Dice to heal.', 'rgba(25,15,5,0.7)', '#fbbf24'], ['long', Moon, 'Long Rest (8 hours)', 'Restore HP, used spell slots, Hit Dice, and class resources.', 'rgba(15,8,25,0.7)', '#c4b5fd']].map(([type, Icon, title, description, background, color]) => (
              <button key={type} type="button" onClick={(event) => flow.selectRest(type, event)} className="fantasy-card min-h-11 w-full cursor-pointer rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" style={{ background, border: '1px solid rgba(180,140,90,0.3)' }}>
                <div className="mb-2 flex items-center gap-3"><Icon className="h-5 w-5" style={{ color }} /><h3 className="font-fantasy font-bold" style={{ color }}>{title}</h3></div>
                <p className="text-base leading-relaxed" style={{ color: 'rgba(232,213,183,0.72)', fontFamily: 'EB Garamond, serif' }}>{description}</p>
                <div className="mt-2 space-y-1">{calcRestoration(type).map((item, index) => <div key={index} className="flex items-center gap-2 text-sm" style={{ color: item.color }}>{item.icon}<span>{item.text}</span></div>)}</div>
              </button>
            ))}
          </div>}

          {(state.step === 'confirm_long_rest' || state.step === 'confirm_short_rest') && <div className="space-y-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'rgba(60,40,10,0.6)', border: '1px solid rgba(201,169,110,0.3)' }}>{restType === 'long' ? <Moon className="h-8 w-8" style={{ color: '#a78bfa' }} /> : <Coffee className="h-8 w-8" style={{ color: '#fbbf24' }} />}</div>
            <div><h3 className="font-fantasy text-lg font-bold" style={{ color: '#f0c040' }}>Confirm {restType === 'long' ? 'Long' : 'Short'} Rest</h3><p className="mt-2 text-base" style={{ color: 'rgba(232,213,183,0.72)', fontFamily: 'EB Garamond, serif' }}>The server will confirm all restoration and elapsed time.</p></div>
            <div className="space-y-2">{calcRestoration(restType).map((item, index) => <div key={index} className="flex items-center justify-center gap-2 text-sm" style={{ color: item.color }}>{item.icon}<span>{item.text}</span></div>)}</div>
            {restType === 'short' && maxHitDice > 0 && <div className="rounded-xl p-4" style={{ background: 'rgba(60,40,8,0.4)', border: '1px solid rgba(201,169,110,0.2)' }}><p className="mb-3 text-sm" style={{ color: 'rgba(232,213,183,0.75)' }}>Hit Dice (d{hitDie})</p><div className="flex items-center justify-center gap-4"><button type="button" aria-label="Spend fewer Hit Dice" onClick={() => setHitDiceToSpend((value) => Math.max(1, value - 1))} className="flex h-11 w-11 items-center justify-center rounded-full"><Minus className="h-4 w-4" /></button><div><div className="font-fantasy text-2xl font-bold" style={{ color: '#f0c040' }}>{Math.min(hitDiceToSpend, maxHitDice)}</div><div className="text-sm" style={{ color: 'rgba(232,213,183,0.72)' }}>~{Math.min(hitDiceToSpend, maxHitDice) * avgHealPerDie} HP</div></div><button type="button" aria-label="Spend more Hit Dice" onClick={() => setHitDiceToSpend((value) => Math.min(maxHitDice, value + 1))} className="flex h-11 w-11 items-center justify-center rounded-full"><Plus className="h-4 w-4" /></button></div></div>}
            <div className="grid grid-cols-2 gap-3 pb-1"><button type="button" onClick={flow.close} className="min-h-11 rounded-xl font-fantasy text-sm" style={{ border: '1px solid rgba(180,140,90,0.3)', color: '#dec8a4' }}>Cancel</button><button type="button" onClick={flow.submit} className="btn-fantasy min-h-11 rounded-xl font-fantasy text-sm">Confirm Rest</button></div>
          </div>}

          {state.step === 'submitting' && <div className="py-4 text-center" aria-live="polite"><CampfireRestAnimation restType={restType} /><h3 className="flex items-center justify-center gap-2 font-fantasy text-lg font-bold" style={{ color: '#f0c040' }}><Loader2 className="h-5 w-5 animate-spin" />Confirming with the server…</h3><p className="mt-2 text-base" style={{ color: 'rgba(232,213,183,0.75)' }}>Keep this window open. The controls are locked until the authoritative result returns.</p></div>}

          {state.step === 'error' && <div className="space-y-5 py-6 text-center" role="alert"><AlertTriangle className="mx-auto h-10 w-10 text-amber-400" /><div><h3 className="font-fantasy text-lg font-bold text-amber-200">Rest Not Confirmed</h3><p className="mt-2 break-words text-base leading-relaxed text-amber-100">{state.error}</p><p className="mt-2 text-sm" style={{ color: 'rgba(232,213,183,0.72)' }}>Retry uses the same request key, so a delayed success cannot apply twice.</p></div><div className="grid grid-cols-2 gap-3"><button type="button" onClick={flow.close} className="min-h-11 rounded-xl font-fantasy text-sm" style={{ border: '1px solid rgba(180,140,90,0.3)', color: '#dec8a4' }}>Close</button><button type="button" onClick={flow.submit} className="btn-fantasy min-h-11 rounded-xl font-fantasy text-sm">Retry Confirmation</button></div></div>}

          {state.step === 'success' && <div className="space-y-5 py-6 text-center" aria-live="polite"><CheckCircle2 className="mx-auto h-11 w-11 text-green-400" /><div><h3 className="font-fantasy text-lg font-bold text-green-200">{state.result?.title || 'Rest Confirmed'}</h3><p className="mt-3 text-base leading-relaxed text-green-100">{state.result?.message}</p>{state.result?.receiptId && <p className="mt-3 break-all text-xs" style={{ color: 'rgba(232,213,183,0.62)' }}>Receipt: {state.result.receiptId}</p>}</div><button type="button" onClick={flow.close} className="btn-fantasy min-h-11 w-full rounded-xl font-fantasy text-sm">Done</button></div>}
        </div>
      </motion.section>
    </motion.div>
  );
}