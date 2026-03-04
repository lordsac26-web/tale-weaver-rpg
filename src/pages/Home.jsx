import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { Sword, Plus, Play, BookOpen, Skull, Sparkles, Swords } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const [characters, setCharacters] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } };

  return (
    <div className="min-h-screen parchment-bg" style={{ color: '#e8d5b7' }}>
      {/* Atmospheric overlays */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(ellipse at 15% 40%, rgba(140,50,10,0.07) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(100,50,150,0.06) 0%, transparent 50%)',
      }} />

      {/* Subtle top rune accent */}
      <div className="fixed top-0 left-0 right-0 h-0.5 pointer-events-none" style={{
        background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.4) 30%, rgba(201,169,110,0.4) 70%, transparent)'
      }} />

      <div className="relative max-w-6xl mx-auto px-4 py-12">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center mb-16">
          <motion.div
            animate={{
              rotate: [0, 4, -4, 0],
              filter: ['drop-shadow(0 0 20px rgba(201,169,110,0.4))', 'drop-shadow(0 0 40px rgba(201,169,110,0.8))', 'drop-shadow(0 0 20px rgba(201,169,110,0.4))']
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="flex justify-center mb-6">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69a4e1720142630debaad046/abefd431f_06863a1f-51ae-4803-b0d7-34cb172e244a.jpg" alt="Tale Weaver Logo" className="w-24 h-24 rounded-2xl object-cover" style={{ boxShadow: '0 0 40px rgba(201,169,110,0.4)' }} />
          </motion.div>

          <h1 className="font-fantasy-deco font-bold mb-4 tracking-tight text-gold-shimmer"
            style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', lineHeight: 1.15 }}>
            Chronicles of the<br />Forgotten Realm
          </h1>
          <p className="max-w-2xl mx-auto leading-relaxed mb-3 text-lg"
            style={{ color: 'rgba(201,169,110,0.6)', fontFamily: 'IM Fell English, serif' }}>
            An AI-driven high fantasy RPG. Every choice matters. Every roll is real.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs" style={{ color: 'rgba(201,169,110,0.3)' }}>
            <Sparkles className="w-3 h-3" />
            <span className="font-fantasy tracking-widest">D&D 5E RULESET · REAL DICE ENGINE · LIVING WORLD</span>
            <Sparkles className="w-3 h-3" />
          </div>
        </motion.div>

        {/* Main Action Cards */}
        <motion.div variants={container} initial="hidden" animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">

          {/* New Character */}
          <motion.div variants={item}>
            <Link to={createPageUrl('CharacterCreation')}>
              <div className="group relative overflow-hidden rounded-2xl p-8 text-center cursor-pointer fantasy-card rune-border"
                style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(201,169,110,0.2)' }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse at center top, rgba(201,169,110,0.06) 0%, transparent 70%)' }} />
                <motion.div whileHover={{ scale: 1.1, rotate: 5 }} transition={{ type: 'spring', stiffness: 300 }}
                  className="mb-5 flex justify-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(40,25,5,0.8)', border: '1px solid rgba(201,169,110,0.25)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)' }}>
                    <Plus className="w-8 h-8" style={{ color: '#c9a96e' }} />
                  </div>
                </motion.div>
                <h3 className="font-fantasy font-bold text-xl mb-2" style={{ color: '#f0c040' }}>New Hero</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(201,169,110,0.45)', fontFamily: 'EB Garamond, serif', fontSize: '0.95rem' }}>
                  Forge your legend. Choose race, class, roll stats, and shape your destiny.
                </p>
              </div>
            </Link>
          </motion.div>

          {/* Start Adventure */}
          <motion.div variants={item}>
            <Link to={createPageUrl('NewGame')}>
              <div className="group relative overflow-hidden rounded-2xl p-8 text-center cursor-pointer fantasy-card rune-border"
                style={{ background: 'rgba(15,8,25,0.75)', border: '1px solid rgba(140,80,220,0.2)' }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse at center top, rgba(130,60,220,0.06) 0%, transparent 70%)' }} />
                <motion.div whileHover={{ scale: 1.1, rotate: -5 }} transition={{ type: 'spring', stiffness: 300 }}
                  className="mb-5 flex justify-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(30,10,50,0.8)', border: '1px solid rgba(140,80,220,0.25)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)' }}>
                    <BookOpen className="w-8 h-8" style={{ color: '#a78bfa' }} />
                  </div>
                </motion.div>
                <h3 className="font-fantasy font-bold text-xl mb-2" style={{ color: '#c4b5fd' }}>New Campaign</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(167,139,250,0.45)', fontFamily: 'EB Garamond, serif', fontSize: '0.95rem' }}>
                  Begin a new adventure. Upload a story seed or let the AI weave your fate.
                </p>
              </div>
            </Link>
          </motion.div>

          {/* Continue */}
          <motion.div variants={item}>
            {sessions.length > 0 ? (
              <Link to={createPageUrl('Game') + `?session_id=${sessions[0].id}`}>
                <div className="group relative overflow-hidden rounded-2xl p-8 text-center cursor-pointer fantasy-card rune-border"
                  style={{ background: 'rgba(5,20,8,0.75)', border: '1px solid rgba(40,160,80,0.2)' }}>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at center top, rgba(40,160,80,0.05) 0%, transparent 70%)' }} />
                  <motion.div whileHover={{ scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}
                    className="mb-5 flex justify-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(10,40,15,0.8)', border: '1px solid rgba(40,160,80,0.25)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)' }}>
                      <Play className="w-8 h-8" style={{ color: '#4ade80' }} />
                    </div>
                  </motion.div>
                  <h3 className="font-fantasy font-bold text-xl mb-2" style={{ color: '#86efac' }}>Continue</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(74,222,128,0.45)', fontFamily: 'EB Garamond, serif', fontSize: '0.95rem' }}>
                    Resume your last adventure where destiny left you.
                  </p>
                </div>
              </Link>
            ) : (
              <div className="rounded-2xl p-8 text-center opacity-30"
                style={{ background: 'rgba(10,8,5,0.5)', border: '1px solid rgba(100,80,50,0.15)' }}>
                <div className="mb-5 flex justify-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(15,12,8,0.6)', border: '1px solid rgba(80,60,30,0.2)' }}>
                    <Play className="w-8 h-8" style={{ color: 'rgba(140,110,60,0.4)' }} />
                  </div>
                </div>
                <h3 className="font-fantasy font-bold text-xl mb-2" style={{ color: 'rgba(180,150,80,0.4)' }}>Continue</h3>
                <p className="text-sm" style={{ color: 'rgba(140,110,60,0.3)', fontFamily: 'EB Garamond, serif' }}>No active campaigns yet.</p>
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* Characters */}
        <AnimatePresence>
          {!loading && characters.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.3))' }} />
                <h2 className="font-fantasy font-bold text-xl flex items-center gap-2" style={{ color: '#c9a96e' }}>
                  <Sword className="w-5 h-5" /> Your Heroes
                </h2>
                <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(201,169,110,0.3), transparent)' }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {characters.map((char, i) => (
                  <motion.div key={char.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.4 }}>
                    <CharacterCard character={char} sessions={sessions} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sessions */}
        <AnimatePresence>
          {!loading && sessions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(140,80,220,0.25))' }} />
                <h2 className="font-fantasy font-bold text-xl flex items-center gap-2" style={{ color: '#a78bfa' }}>
                  <BookOpen className="w-5 h-5" /> Active Campaigns
                </h2>
                <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(140,80,220,0.25), transparent)' }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sessions.map((session, i) => (
                  <motion.div key={session.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.4 }}>
                    <SessionCard session={session} characters={characters} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!loading && characters.length === 0 && sessions.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="text-center py-20">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
              <Skull className="w-16 h-16 mx-auto mb-5 opacity-20" style={{ color: '#c9a96e' }} />
            </motion.div>
            <p className="font-fantasy text-lg" style={{ color: 'rgba(201,169,110,0.3)' }}>
              No heroes yet. Your legend begins now.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function CharacterCard({ character, sessions }) {
  const session = sessions.find(s => s.character_id === character.id);
  const hpPct = character.hp_max ? Math.max(0, Math.min(100, (character.hp_current / character.hp_max) * 100)) : 100;
  const hpBarStyle = hpPct > 60 ? { background: 'linear-gradient(90deg, #16a34a, #22c55e)' } :
    hpPct > 30 ? { background: 'linear-gradient(90deg, #b45309, #d97706)' } :
    { background: 'linear-gradient(90deg, #7f1d1d, #dc2626)' };
  const initials = character.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300 }}
      className="rounded-xl p-5 cursor-pointer fantasy-card rune-border"
      style={{ background: 'rgba(16,11,5,0.85)', border: '1px solid rgba(180,140,90,0.15)' }}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center font-fantasy font-bold text-sm flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(80,50,10,0.8), rgba(40,25,5,0.9))',
            border: '1px solid rgba(201,169,110,0.3)',
            color: '#f0c040',
            boxShadow: '0 0 10px rgba(201,169,110,0.1), inset 0 2px 4px rgba(0,0,0,0.5)'
          }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-fantasy font-bold text-base truncate" style={{ color: '#e8d5b7' }}>{character.name}</h3>
          <p className="text-xs" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
            Lv.{character.level} {character.race} {character.class}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full font-fantasy text-xs badge-gold">Lv.{character.level}</span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>HP</span>
          <span className="font-fantasy" style={{ color: hpPct > 60 ? '#86efac' : hpPct > 30 ? '#fde68a' : '#fca5a5', fontSize: '0.7rem' }}>
            {character.hp_current}/{character.hp_max}
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden neuro-inset">
          <motion.div initial={{ width: 0 }} animate={{ width: `${hpPct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full" style={hpBarStyle} />
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="text-center">
          <div className="font-fantasy font-bold text-sm" style={{ color: '#93c5fd' }}>{character.armor_class}</div>
          <div className="text-xs" style={{ color: 'rgba(147,197,253,0.4)', fontFamily: 'EB Garamond, serif' }}>AC</div>
        </div>
        <div className="text-center">
          <div className="font-fantasy font-bold text-sm" style={{ color: '#c9a96e' }}>{character.xp || 0}</div>
          <div className="text-xs" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>XP</div>
        </div>
      </div>

      {session ? (
        <Link to={createPageUrl('Game') + `?session_id=${session.id}`} onClick={e => e.stopPropagation()}>
          <button className="w-full py-2 rounded-lg text-xs font-fantasy transition-all"
            style={{ background: 'rgba(10,40,15,0.6)', border: '1px solid rgba(40,160,80,0.3)', color: '#86efac', letterSpacing: '0.05em' }}>
            <Play className="w-3 h-3 inline mr-1.5" /> Resume Campaign
          </button>
        </Link>
      ) : (
        <Link to={createPageUrl('NewGame') + `?character_id=${character.id}`} onClick={e => e.stopPropagation()}>
          <button className="w-full py-2 rounded-lg text-xs font-fantasy transition-all"
            style={{ background: 'rgba(30,10,50,0.6)', border: '1px solid rgba(120,60,200,0.3)', color: '#c4b5fd', letterSpacing: '0.05em' }}>
            <BookOpen className="w-3 h-3 inline mr-1.5" /> Start Quest
          </button>
        </Link>
      )}
    </motion.div>
  );
}

function SessionCard({ session, characters }) {
  const char = characters.find(c => c.id === session.character_id);
  return (
    <Link to={createPageUrl('Game') + `?session_id=${session.id}`}>
      <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300 }}
        className="rounded-xl p-5 cursor-pointer fantasy-card rune-border"
        style={{ background: 'rgba(12,8,18,0.85)', border: '1px solid rgba(120,60,200,0.15)' }}>
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-fantasy font-bold" style={{ color: '#c4b5fd' }}>{session.title || 'Unnamed Campaign'}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-fantasy ${session.in_combat ? 'badge-blood' : 'badge-arcane'}`}>
            {session.in_combat ? '⚔️ Combat' : '📖 Exploring'}
          </span>
        </div>
        <p className="text-sm italic mb-1" style={{ color: 'rgba(167,139,250,0.5)', fontFamily: 'EB Garamond, serif' }}>
          {session.current_location || 'Unknown Location'}
        </p>
        {char && (
          <p className="text-xs" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
            Playing as <span style={{ color: 'rgba(201,169,110,0.7)' }}>{char.name}</span>
          </p>
        )}
        <p className="text-xs mt-2" style={{ color: 'rgba(140,100,200,0.35)', fontFamily: 'EB Garamond, serif' }}>
          {session.season} · {session.time_of_day}
        </p>
      </motion.div>
    </Link>
  );
}