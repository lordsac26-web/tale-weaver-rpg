import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { Sword, Plus, Play, BookOpen, Skull, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const [characters, setCharacters] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
    Promise.all([
      base44.entities.Character.list('-updated_date', 10),
      base44.entities.GameSession.list('-updated_date', 10)
    ]).then(([chars, sess]) => {
      setCharacters(chars.filter(c => c.is_active));
      setSessions(sess.filter(s => s.is_active));
      setLoading(false);
    });
  }, []);

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-amber-100 overflow-hidden relative">
      {/* Layered background */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#0d0a1a] to-[#0a0a0f] pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(120,40,200,0.1) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(200,100,20,0.08) 0%, transparent 50%), radial-gradient(ellipse at 60% 80%, rgba(40,80,200,0.06) 0%, transparent 50%)'
      }} />
      {/* Subtle grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(#a78bfa 1px, transparent 1px), linear-gradient(90deg, #a78bfa 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-12">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }} className="text-center mb-16">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0], filter: ['drop-shadow(0 0 20px rgba(251,191,36,0.5))', 'drop-shadow(0 0 35px rgba(251,191,36,0.9))', 'drop-shadow(0 0 20px rgba(251,191,36,0.5))'] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="flex justify-center mb-6"
          >
            <Sword className="w-16 h-16 text-amber-400" />
          </motion.div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight" style={{
            background: 'linear-gradient(135deg, #fde68a, #fbbf24, #f59e0b, #d97706)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>
            Chronicles of the<br />Forgotten Realm
          </h1>
          <p className="text-amber-300/70 text-xl max-w-2xl mx-auto leading-relaxed mb-3">
            An AI-driven high fantasy RPG. Every choice matters. Every roll is real.
          </p>
          <div className="flex items-center justify-center gap-2 text-amber-400/40 text-xs">
            <Sparkles className="w-3 h-3" />
            <span>D&D 5E ruleset · Real dice engine · Living world</span>
            <Sparkles className="w-3 h-3" />
          </div>
        </motion.div>

        {/* Main Actions */}
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          <motion.div variants={itemVariants}>
            <Link to={createPageUrl('CharacterCreation')}>
              <div className="group relative overflow-hidden bg-gradient-to-br from-amber-900/20 to-amber-800/10 border border-amber-700/30 rounded-2xl p-8 hover:border-amber-500/70 transition-all duration-300 cursor-pointer hover:bg-amber-900/25 text-center">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600/0 to-amber-600/0 group-hover:from-amber-600/5 group-hover:to-transparent transition-all duration-500" />
                <motion.div whileHover={{ scale: 1.15, rotate: 5 }} transition={{ type: 'spring', stiffness: 300 }} className="mb-4 flex justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-900/40 border border-amber-700/40 flex items-center justify-center group-hover:border-amber-500/60 transition-all">
                    <Plus className="w-8 h-8 text-amber-400" />
                  </div>
                </motion.div>
                <h3 className="text-xl font-bold text-amber-200 mb-2">New Character</h3>
                <p className="text-amber-400/60 text-sm leading-relaxed">Create your hero. Choose race, class, roll stats, forge your destiny.</p>
              </div>
            </Link>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Link to={createPageUrl('NewGame')}>
              <div className="group relative overflow-hidden bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-700/30 rounded-2xl p-8 hover:border-purple-500/70 transition-all duration-300 cursor-pointer hover:bg-purple-900/25 text-center">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 to-purple-600/0 group-hover:from-purple-600/5 group-hover:to-transparent transition-all duration-500" />
                <motion.div whileHover={{ scale: 1.15, rotate: -5 }} transition={{ type: 'spring', stiffness: 300 }} className="mb-4 flex justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-900/40 border border-purple-700/40 flex items-center justify-center group-hover:border-purple-500/60 transition-all">
                    <BookOpen className="w-8 h-8 text-purple-400" />
                  </div>
                </motion.div>
                <h3 className="text-xl font-bold text-purple-200 mb-2">Start Adventure</h3>
                <p className="text-purple-400/60 text-sm leading-relaxed">Begin a new campaign. Upload a story seed or let the AI weave your fate.</p>
              </div>
            </Link>
          </motion.div>

          <motion.div variants={itemVariants}>
            {sessions.length > 0 ? (
              <Link to={createPageUrl('Game') + `?session_id=${sessions[0].id}`}>
                <div className="group relative overflow-hidden bg-gradient-to-br from-green-900/20 to-green-800/10 border border-green-700/30 rounded-2xl p-8 hover:border-green-500/70 transition-all duration-300 cursor-pointer hover:bg-green-900/25 text-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-600/0 to-green-600/0 group-hover:from-green-600/5 group-hover:to-transparent transition-all duration-500" />
                  <motion.div whileHover={{ scale: 1.15 }} transition={{ type: 'spring', stiffness: 300 }} className="mb-4 flex justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-green-900/40 border border-green-700/40 flex items-center justify-center group-hover:border-green-500/60 transition-all">
                      <Play className="w-8 h-8 text-green-400" />
                    </div>
                  </motion.div>
                  <h3 className="text-xl font-bold text-green-200 mb-2">Continue</h3>
                  <p className="text-green-400/60 text-sm leading-relaxed">Resume your last adventure where you left off.</p>
                </div>
              </Link>
            ) : (
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/30 to-slate-800/10 border border-slate-700/20 rounded-2xl p-8 text-center opacity-40">
                <div className="mb-4 flex justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/40 border border-slate-700/40 flex items-center justify-center">
                    <Play className="w-8 h-8 text-slate-500" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-400 mb-2">Continue</h3>
                <p className="text-slate-500 text-sm">No active sessions yet.</p>
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* Characters */}
        <AnimatePresence>
          {!loading && characters.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-12">
              <h2 className="text-2xl font-bold text-amber-300 mb-6 flex items-center gap-2">
                <Sword className="w-5 h-5" /> Your Heroes
              </h2>
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

        {/* Active Sessions */}
        <AnimatePresence>
          {!loading && sessions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
              <h2 className="text-2xl font-bold text-purple-300 mb-6 flex items-center gap-2">
                <BookOpen className="w-5 h-5" /> Active Campaigns
              </h2>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-center py-16 text-amber-400/40">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
              <Skull className="w-16 h-16 mx-auto mb-4 opacity-30" />
            </motion.div>
            <p className="text-lg">No heroes yet. Your legend begins now.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function CharacterCard({ character, sessions }) {
  const session = sessions.find(s => s.character_id === character.id);
  const hpPct = character.hp_max ? Math.max(0, Math.min(100, (character.hp_current / character.hp_max) * 100)) : 100;
  const hpColor = hpPct > 60 ? 'bg-green-500' : hpPct > 30 ? 'bg-yellow-500' : 'bg-red-500';
  const initials = character.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <motion.div whileHover={{ y: -3, boxShadow: '0 0 24px rgba(251,191,36,0.1)' }} transition={{ type: 'spring', stiffness: 300 }}
      className="group bg-gradient-to-br from-slate-900/90 to-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-amber-600/50 transition-colors cursor-pointer">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-700/60 to-amber-900/60 border border-amber-600/40 flex items-center justify-center text-amber-200 font-bold text-sm flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-amber-200 text-base truncate">{character.name}</h3>
          <p className="text-amber-400/60 text-xs">Lv.{character.level} {character.race} {character.class}</p>
        </div>
        <Badge className="bg-amber-900/50 text-amber-300 border-amber-700/50 text-xs">Lv.{character.level}</Badge>
      </div>

      {/* HP bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">HP</span>
          <span className={hpPct > 60 ? 'text-green-400' : hpPct > 30 ? 'text-yellow-400' : 'text-red-400'}>
            {character.hp_current}/{character.hp_max}
          </span>
        </div>
        <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${hpPct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${hpColor}`} />
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="text-center">
          <div className="text-blue-400 font-bold text-sm">{character.armor_class}</div>
          <div className="text-slate-500 text-xs">AC</div>
        </div>
        <div className="text-center">
          <div className="text-amber-400 font-bold text-sm">{character.xp || 0}</div>
          <div className="text-slate-500 text-xs">XP</div>
        </div>
      </div>

      {session ? (
        <Link to={createPageUrl('Game') + `?session_id=${session.id}`}>
          <Button size="sm" className="w-full bg-green-800/50 hover:bg-green-700/60 text-green-200 border border-green-700/40 transition-all">
            <Play className="w-3 h-3 mr-1.5" /> Resume Campaign
          </Button>
        </Link>
      ) : (
        <Link to={createPageUrl('NewGame') + `?character_id=${character.id}`}>
          <Button size="sm" className="w-full bg-purple-800/50 hover:bg-purple-700/60 text-purple-200 border border-purple-700/40 transition-all">
            <BookOpen className="w-3 h-3 mr-1.5" /> Start Quest
          </Button>
        </Link>
      )}
    </motion.div>
  );
}

function SessionCard({ session, characters }) {
  const char = characters.find(c => c.id === session.character_id);
  return (
    <Link to={createPageUrl('Game') + `?session_id=${session.id}`}>
      <motion.div whileHover={{ y: -3, boxShadow: '0 0 24px rgba(167,139,250,0.1)' }} transition={{ type: 'spring', stiffness: 300 }}
        className="group bg-gradient-to-br from-purple-900/20 to-slate-900/50 border border-purple-800/40 rounded-xl p-5 hover:border-purple-600/60 transition-colors cursor-pointer">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-bold text-purple-200 group-hover:text-purple-100 transition-colors">{session.title || 'Unnamed Campaign'}</h3>
          <Badge className={`text-xs ${session.in_combat ? 'bg-red-900/60 text-red-300 border-red-700/50' : 'bg-purple-900/50 text-purple-300 border-purple-700/50'}`}>
            {session.in_combat ? '⚔️ Combat' : '📖 Exploring'}
          </Badge>
        </div>
        <p className="text-purple-400/60 text-sm mb-1">{session.current_location || 'Unknown Location'}</p>
        {char && <p className="text-amber-400/50 text-xs">Playing as <span className="text-amber-400/80">{char.name}</span></p>}
        <p className="text-slate-500 text-xs mt-2">{session.season} · {session.time_of_day}</p>
      </motion.div>
    </Link>
  );
}