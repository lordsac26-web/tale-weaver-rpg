import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { Sword, Plus, Play, BookOpen, Skull, Sparkles, ChevronDown, User, Scroll, Library, Heart, Shield, Star, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CharacterSheet from '@/components/game/CharacterSheet';
import BackgroundEffects from '@/components/home/BackgroundEffects';

export default function Home() {
  const [characters, setCharacters] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCharMenu, setShowCharMenu] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [fxEnabled, setFxEnabled] = useState(() => localStorage.getItem('homeFx') !== 'off');

  useEffect(() => {
    Promise.all([
      base44.entities.Character.list('-updated_date', 10),
      base44.entities.GameSession.list('-updated_date', 10)
    ]).then(([chars, sess]) => {
      setCharacters(chars.filter(c => c.is_active));
      setSessions(sess.filter(s => s.is_active));
      setLoading(false);
    });
  }, []);

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
  const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } };

  return (
    <div className="min-h-screen parchment-bg" style={{ color: 'var(--text-bright)' }} onClick={() => setShowCharMenu(false)}>
      <BackgroundEffects enabled={fxEnabled} onToggle={() => setFxEnabled(v => { const n = !v; localStorage.setItem('homeFx', n ? 'on' : 'off'); return n; })} />

      {/* Top brass accent bar */}
      <div className="fixed top-0 left-0 right-0 z-40 h-0.5 pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(232,184,109,0.7) 25%, rgba(245,208,138,0.85) 50%, rgba(232,184,109,0.7) 75%, transparent)' }} />

      {/* Nav Bar */}
      {characters.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-5 py-2.5"
          style={{ background: 'rgba(10,5,2,0.95)', borderBottom: '1px solid rgba(184,115,51,0.3)', backdropFilter: 'blur(10px)' }}>
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #e8b86d, #b87333)' }} />
            <span className="font-fantasy text-xs tracking-widest" style={{ color: 'rgba(212,149,90,0.6)' }}>TALE WEAVER</span>
          </div>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowCharMenu(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-fantasy text-sm transition-all"
              style={{ background: 'rgba(45,22,8,0.8)', border: '1px solid rgba(184,115,51,0.35)', color: 'var(--brass-gold)' }}>
              <User className="w-3.5 h-3.5" />
              Heroes
              <ChevronDown className="w-3 h-3 transition-transform duration-200" style={{ transform: showCharMenu ? 'rotate(180deg)' : 'none' }} />
            </button>
            <AnimatePresence>
              {showCharMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }} transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden shadow-2xl"
                  style={{ background: 'rgba(15,8,3,0.99)', border: '1px solid rgba(184,115,51,0.35)', minWidth: '210px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 20px rgba(184,115,51,0.1)' }}>
                  {characters.map((char, i) => (
                    <button key={char.id}
                      onClick={() => { setSelectedCharacter(char); setShowCharMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                      style={{ borderBottom: i < characters.length-1 ? '1px solid rgba(184,115,51,0.1)' : 'none' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(60,30,10,0.6)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-fantasy font-bold text-xs flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #5c3318, #3d2010)', border: '1px solid rgba(212,149,90,0.4)', color: '#f0d090' }}>
                        {char.name?.slice(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-fantasy truncate" style={{ color: 'var(--parchment)' }}>{char.name}</div>
                        <div className="text-xs" style={{ color: 'rgba(212,149,90,0.55)', fontFamily: 'EB Garamond, serif' }}>Lv.{char.level} {char.class}</div>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <div className="relative max-w-5xl mx-auto px-4 py-12" style={{ paddingTop: characters.length > 0 ? '4.5rem' : '3rem' }}>

        {/* ── Hero Section ── */}
        <motion.div initial={{ opacity: 0, y: -28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center mb-14">
          <motion.div
            animate={{ rotate: [0, 3, -3, 0], filter: ['drop-shadow(0 0 18px rgba(184,115,51,0.4))','drop-shadow(0 0 36px rgba(184,115,51,0.75))','drop-shadow(0 0 18px rgba(184,115,51,0.4))'] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            className="flex justify-center mb-7">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a4e1720142630debaad046/abefd431f_06863a1f-51ae-4803-b0d7-34cb172e244a.jpg"
              alt="Tale Weaver" className="w-28 h-28 rounded-2xl object-cover"
              style={{ boxShadow: '0 0 0 2px rgba(212,149,90,0.4), 0 0 40px rgba(184,115,51,0.35), 0 8px 32px rgba(0,0,0,0.7)' }} />
          </motion.div>

          <h1 className="font-fantasy-deco font-bold mb-4 tracking-tight text-gold-shimmer"
            style={{ fontSize: 'clamp(1.9rem, 5.5vw, 3.4rem)', lineHeight: 1.2 }}>
            Tale Weaver<br />Chronicles of the Forgotten Realms
          </h1>

          <p className="max-w-xl mx-auto leading-relaxed mb-4 font-serif"
            style={{ color: 'var(--parchment-mid)', fontSize: '1.1rem', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
            An AI-driven high fantasy RPG. Every choice matters. Every roll is real.
          </p>

          <div className="flex items-center justify-center gap-3">
            <div className="h-px flex-1 max-w-16" style={{ background: 'linear-gradient(90deg, transparent, rgba(184,115,51,0.5))' }} />
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full"
              style={{ background: 'rgba(45,22,8,0.7)', border: '1px solid rgba(184,115,51,0.2)' }}>
              <Sparkles className="w-3 h-3" style={{ color: 'var(--brass-gold)' }} />
              <span className="font-fantasy tracking-widest text-xs" style={{ color: 'rgba(212,149,90,0.7)' }}>D&D 5E · REAL DICE ENGINE · LIVING WORLD</span>
              <Sparkles className="w-3 h-3" style={{ color: 'var(--brass-gold)' }} />
            </div>
            <div className="h-px flex-1 max-w-16" style={{ background: 'linear-gradient(90deg, rgba(184,115,51,0.5), transparent)' }} />
          </div>
        </motion.div>

        {/* ── Main Action Cards ── */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {[
            {
              to: createPageUrl('Encyclopedia'),
              icon: Library, iconColor: 'var(--brass-gold)',
              accentColor: 'rgba(184,115,51,0.22)', glowColor: 'rgba(184,115,51,0.08)',
              borderColor: 'rgba(184,115,51,0.3)',
              title: 'Lore Archives', titleColor: '#f0d090',
              desc: 'History, factions, figures, locations & your adventurer\'s logbook.',
              descColor: 'var(--parchment-dim)',
              iconBg: 'linear-gradient(135deg, #5c3318, #3d2010)',
              iconBorder: 'rgba(212,149,90,0.35)',
            },
            {
              to: createPageUrl('CharacterCreation'),
              icon: Plus, iconColor: 'var(--brass-shine)',
              accentColor: 'rgba(184,115,51,0.18)', glowColor: 'rgba(184,115,51,0.06)',
              borderColor: 'rgba(184,115,51,0.28)',
              title: 'New Hero', titleColor: '#f5d08a',
              desc: 'Forge your legend. Choose race, class, roll stats, shape destiny.',
              descColor: 'var(--parchment-dim)',
              iconBg: 'linear-gradient(135deg, #6b3d1a, #4a2510)',
              iconBorder: 'rgba(232,184,109,0.35)',
            },
            {
              to: createPageUrl('NewGame'),
              icon: BookOpen, iconColor: '#c4b5fd',
              accentColor: 'rgba(100,50,180,0.18)', glowColor: 'rgba(100,50,180,0.07)',
              borderColor: 'rgba(140,80,220,0.25)',
              title: 'New Campaign', titleColor: '#dfc8ff',
              desc: 'Begin a new adventure. Upload a story seed or let AI weave your fate.',
              descColor: 'rgba(196,181,253,0.55)',
              iconBg: 'linear-gradient(135deg, rgba(65,22,110,0.9), rgba(38,10,75,0.95))',
              iconBorder: 'rgba(150,90,230,0.35)',
            },
            {
              to: createPageUrl('ImageCreator'),
              icon: ImageIcon, iconColor: '#fbbf24',
              accentColor: 'rgba(251,191,36,0.18)', glowColor: 'rgba(251,191,36,0.07)',
              borderColor: 'rgba(251,191,36,0.28)',
              title: 'Image Forge', titleColor: '#fde68a',
              desc: 'AI-powered art creation. Describe your vision, choose a style, download.',
              descColor: 'rgba(251,191,36,0.55)',
              iconBg: 'linear-gradient(135deg, rgba(120,70,10,0.9), rgba(70,40,5,0.95))',
              iconBorder: 'rgba(251,191,36,0.35)',
            },
            sessions.length > 0 ? {
              to: createPageUrl('Game') + `?session_id=${sessions[0].id}`,
              icon: Play, iconColor: '#86efac',
              accentColor: 'rgba(34,197,94,0.15)', glowColor: 'rgba(34,197,94,0.06)',
              borderColor: 'rgba(40,160,80,0.25)',
              title: 'Continue', titleColor: '#a7f3c0',
              desc: 'Resume your last adventure where destiny left you.',
              descColor: 'rgba(134,239,172,0.55)',
              iconBg: 'linear-gradient(135deg, rgba(10,55,20,0.9), rgba(5,30,10,0.95))',
              iconBorder: 'rgba(40,180,80,0.35)',
            } : null,
          ].map((card, i) => card ? (
            <motion.div key={i} variants={fadeUp}>
              <Link to={card.to}>
                <div className="group relative overflow-hidden rounded-2xl p-6 text-center cursor-pointer fantasy-card h-full"
                  style={{ background: `linear-gradient(160deg, rgba(28,14,5,0.9), rgba(18,9,3,0.95))`, border: `1px solid ${card.borderColor}`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.6)` }}>
                  {/* Hover glow overlay */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at 50% 0%, ${card.glowColor} 0%, transparent 65%)` }} />
                  {/* Top accent line */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `linear-gradient(90deg, transparent, ${card.borderColor.replace('0.', '0.7)').slice(0,-1)}, transparent)` }} />

                  <motion.div whileHover={{ scale: 1.08, rotate: i % 2 === 0 ? -4 : 4 }} transition={{ type: 'spring', stiffness: 280 }}
                    className="mb-4 flex justify-center">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ background: card.iconBg, border: `1px solid ${card.iconBorder}`,
                        boxShadow: `inset 0 2px 8px rgba(0,0,0,0.65), 0 0 16px ${card.accentColor}` }}>
                      <card.icon className="w-7 h-7" style={{ color: card.iconColor }} />
                    </div>
                  </motion.div>

                  <h3 className="font-fantasy font-bold text-lg mb-2" style={{ color: card.titleColor, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                    {card.title}
                  </h3>
                  <p className="text-sm leading-relaxed font-body" style={{ color: card.descColor, fontSize: '0.9rem' }}>
                    {card.desc}
                  </p>
                </div>
              </Link>
            </motion.div>
          ) : (
            <motion.div key={i} variants={fadeUp}>
              <div className="rounded-2xl p-6 text-center h-full" style={{ background: 'rgba(12,6,2,0.6)', border: '1px solid rgba(90,50,18,0.15)', opacity: 0.35 }}>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(20,10,4,0.8)', border: '1px solid rgba(80,45,14,0.2)' }}>
                  <Play className="w-7 h-7" style={{ color: 'rgba(120,75,28,0.5)' }} />
                </div>
                <h3 className="font-fantasy font-bold text-lg mb-2" style={{ color: 'rgba(160,110,55,0.5)' }}>Continue</h3>
                <p className="text-sm font-body" style={{ color: 'rgba(120,85,40,0.4)' }}>No active campaigns yet.</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Characters Section ── */}
        <AnimatePresence>
          {!loading && characters.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-12">
              <SectionHeader icon={<Sword className="w-4 h-4" />} title="Your Heroes" color="#d4955a" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
                {characters.map((char, i) => (
                  <motion.div key={char.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.4 }}>
                    <CharacterCard character={char} sessions={sessions} onViewSheet={() => setSelectedCharacter(char)} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Sessions Section ── */}
        <AnimatePresence>
          {!loading && sessions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
              <SectionHeader icon={<BookOpen className="w-4 h-4" />} title="Active Campaigns" color="#c4b5fd" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                {sessions.map((session, i) => (
                  <motion.div key={session.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.4 }}>
                    <SessionCard session={session} characters={characters} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Character Sheet Modal */}
        <AnimatePresence>
          {selectedCharacter && (
            <CharacterSheet
              character={selectedCharacter}
              onClose={() => setSelectedCharacter(null)}
              onCharacterUpdate={(updated) => {
                setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c));
                setSelectedCharacter(updated);
              }} />
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!loading && characters.length === 0 && sessions.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="text-center py-24">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}>
              <Skull className="w-16 h-16 mx-auto mb-5" style={{ color: 'rgba(184,115,51,0.2)' }} />
            </motion.div>
            <p className="font-fantasy text-lg" style={{ color: 'rgba(212,149,90,0.35)', textShadow: '0 0 16px rgba(184,115,51,0.15)' }}>
              No heroes yet. Your legend begins now.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, color }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${color}44)` }} />
      <h2 className="font-fantasy font-bold text-lg flex items-center gap-2.5 px-1"
        style={{ color, textShadow: `0 0 18px ${color}55` }}>
        {icon} {title}
      </h2>
      <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${color}44, transparent)` }} />
    </div>
  );
}

// ─── Character Card ────────────────────────────────────────────────────────────
function CharacterCard({ character, sessions, onViewSheet }) {
  const navigate = useNavigate();
  const session = sessions.find(s => s.character_id === character.id);
  const hpPct = character.hp_max ? Math.max(0, Math.min(100, (character.hp_current / character.hp_max) * 100)) : 100;
  const hpBarStyle = hpPct > 60 ? { background: 'linear-gradient(90deg, #16a34a, #22c55e)' }
    : hpPct > 30 ? { background: 'linear-gradient(90deg, #b45309, #e8732a)' }
    : { background: 'linear-gradient(90deg, #7f1d1d, #dc2626)' };
  const hpTextColor = hpPct > 60 ? '#90f4b0' : hpPct > 30 ? '#fde68a' : '#fca5a5';
  const initials = character.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300 }}
      className="rounded-xl cursor-pointer fantasy-card overflow-hidden"
      style={{ background: 'linear-gradient(160deg, rgba(28,14,5,0.95), rgba(18,9,3,0.98))', border: '1px solid rgba(184,115,51,0.25)',
        boxShadow: 'inset 0 1px 0 rgba(232,184,109,0.06), 0 4px 20px rgba(0,0,0,0.6)' }}
      onClick={onViewSheet}>

      {/* Top bar with wood-grain feel */}
      <div className="px-4 py-3 flex items-center gap-3"
        style={{ background: 'linear-gradient(90deg, rgba(60,30,8,0.7), rgba(40,20,5,0.5))', borderBottom: '1px solid rgba(184,115,51,0.15)' }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center font-fantasy font-bold text-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6b3d1a, #3d2010)', border: '1px solid rgba(212,149,90,0.4)',
            color: '#f0d090', boxShadow: '0 0 12px rgba(184,115,51,0.15), inset 0 2px 4px rgba(0,0,0,0.6)' }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-fantasy font-bold text-sm truncate" style={{ color: 'var(--parchment)', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
            {character.name}
          </h3>
          <p className="text-xs truncate" style={{ color: 'rgba(212,149,90,0.6)', fontFamily: 'EB Garamond, serif' }}>
            {character.race} {character.class}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full font-fantasy text-xs badge-gold flex-shrink-0">Lv.{character.level}</span>
      </div>

      <div className="px-4 py-3">
        {/* HP Bar */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center gap-1.5">
              <Heart className="w-3 h-3" style={{ color: hpTextColor }} />
              <span className="text-xs font-fantasy" style={{ color: 'rgba(212,149,90,0.5)', fontSize: '0.62rem', letterSpacing: '0.08em' }}>HIT POINTS</span>
            </div>
            <span className="font-fantasy font-bold text-xs" style={{ color: hpTextColor }}>{character.hp_current}/{character.hp_max}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(8,4,1,0.8)', boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.8)' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${hpPct}%` }} transition={{ duration: 0.9, ease: 'easeOut' }}
              className="h-full rounded-full" style={{ ...hpBarStyle, boxShadow: `0 0 6px ${hpTextColor}55` }} />
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { icon: Shield, val: character.armor_class ?? '—', label: 'AC', color: '#93c5fd' },
            { icon: Star, val: character.xp ?? 0, label: 'XP', color: 'var(--brass-gold)' },
            { icon: Sparkles, val: `+${Math.floor((character.level||1)/4)+2}`, label: 'Prof', color: '#c4b5fd' },
          ].map(({ icon: Icon, val, label, color }) => (
            <div key={label} className="rounded-lg py-2 text-center"
              style={{ background: 'rgba(8,4,1,0.7)', border: '1px solid rgba(184,115,51,0.12)' }}>
              <Icon className="w-3 h-3 mx-auto mb-0.5" style={{ color }} />
              <div className="font-fantasy font-bold text-xs" style={{ color, textShadow: `0 0 8px ${color}55` }}>{val}</div>
              <div className="font-body text-xs" style={{ color: 'rgba(184,150,100,0.4)', fontSize: '0.6rem' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={onViewSheet}
            className="flex-1 py-1.5 rounded-lg text-xs font-fantasy transition-all flex items-center justify-center gap-1.5"
            style={{ background: 'rgba(60,30,8,0.6)', border: '1px solid rgba(184,115,51,0.3)', color: 'var(--brass-gold)',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(92,51,24,0.7)'; e.currentTarget.style.borderColor = 'rgba(212,149,90,0.55)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(60,30,8,0.6)'; e.currentTarget.style.borderColor = 'rgba(184,115,51,0.3)'; }}>
            <User className="w-3 h-3" /> View Sheet
          </button>
          <button onClick={() => navigate(createPageUrl('CharacterSheetPage') + `?character_id=${character.id}`)}
            className="py-1.5 px-2.5 rounded-lg text-xs transition-all"
            title="Full Character Sheet"
            style={{ background: 'rgba(38,10,70,0.5)', border: '1px solid rgba(130,70,210,0.25)', color: 'rgba(190,155,255,0.7)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(160,110,255,0.5)'; e.currentTarget.style.color = '#dfc8ff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(130,70,210,0.25)'; e.currentTarget.style.color = 'rgba(190,155,255,0.7)'; }}>
            <Scroll className="w-3 h-3" />
          </button>
          {session ? (
            <Link to={createPageUrl('Game') + `?session_id=${session.id}`} className="flex-1">
              <button className="w-full py-1.5 rounded-lg text-xs font-fantasy transition-all flex items-center justify-center gap-1.5"
                style={{ background: 'rgba(8,38,15,0.65)', border: '1px solid rgba(40,160,75,0.35)', color: '#90f4b0' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(12,55,22,0.75)'; e.currentTarget.style.borderColor = 'rgba(60,200,100,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(8,38,15,0.65)'; e.currentTarget.style.borderColor = 'rgba(40,160,75,0.35)'; }}>
                <Play className="w-3 h-3" /> Resume
              </button>
            </Link>
          ) : (
            <Link to={createPageUrl('NewGame') + `?character_id=${character.id}`} className="flex-1">
              <button className="w-full py-1.5 rounded-lg text-xs font-fantasy transition-all flex items-center justify-center gap-1.5"
                style={{ background: 'rgba(38,10,70,0.5)', border: '1px solid rgba(130,70,210,0.3)', color: '#dfc8ff' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(55,18,100,0.65)'; e.currentTarget.style.borderColor = 'rgba(160,110,255,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(38,10,70,0.5)'; e.currentTarget.style.borderColor = 'rgba(130,70,210,0.3)'; }}>
                <BookOpen className="w-3 h-3" /> Quest
              </button>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Session Card ──────────────────────────────────────────────────────────────
function SessionCard({ session, characters }) {
  const char = characters.find(c => c.id === session.character_id);
  return (
    <Link to={createPageUrl('Game') + `?session_id=${session.id}`}>
      <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300 }}
        className="rounded-xl cursor-pointer fantasy-card overflow-hidden"
        style={{ background: 'linear-gradient(160deg, rgba(22,10,35,0.95), rgba(14,6,22,0.98))', border: '1px solid rgba(140,80,220,0.22)',
          boxShadow: 'inset 0 1px 0 rgba(196,181,253,0.05), 0 4px 20px rgba(0,0,0,0.6)' }}>
        <div className="px-4 py-3 flex items-center justify-between"
          style={{ background: 'linear-gradient(90deg, rgba(50,20,80,0.5), rgba(30,12,50,0.4))', borderBottom: '1px solid rgba(140,80,220,0.15)' }}>
          <h3 className="font-fantasy font-bold text-sm" style={{ color: '#dfc8ff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
            {session.title || 'Unnamed Campaign'}
          </h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-fantasy ${session.in_combat ? 'badge-blood' : 'badge-arcane'}`}>
            {session.in_combat ? '⚔️ Combat' : '📖 Exploring'}
          </span>
        </div>
        <div className="px-4 py-3 space-y-1">
          <p className="text-sm italic font-serif" style={{ color: 'rgba(196,181,253,0.65)' }}>
            📍 {session.current_location || 'Unknown Location'}
          </p>
          {char && (
            <p className="text-xs font-body" style={{ color: 'rgba(212,149,90,0.55)' }}>
              Playing as <span style={{ color: 'var(--brass-gold)', fontWeight: 600 }}>{char.name}</span>
            </p>
          )}
          {(session.season || session.time_of_day) && (
            <p className="text-xs font-body" style={{ color: 'rgba(160,130,200,0.4)' }}>
              {[session.season, session.time_of_day].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </motion.div>
    </Link>
  );
}