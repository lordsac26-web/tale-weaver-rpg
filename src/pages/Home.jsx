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

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-amber-100 overflow-hidden relative">
      {/* Background atmosphere */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#0d0a1a] to-[#0a0a0f] pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(120,40,200,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(200,100,20,0.06) 0%, transparent 50%)'
      }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Sword className="w-16 h-16 text-amber-400" style={{ filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.6))' }} />
            </div>
          </div>
          <h1 className="text-6xl font-bold mb-4 tracking-tight" style={{
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>
            Chronicles of the<br />Forgotten Realm
          </h1>
          <p className="text-amber-300/70 text-xl max-w-2xl mx-auto leading-relaxed mb-2">
            An AI-driven high fantasy RPG. Every choice matters. Every roll is real.
          </p>
          <p className="text-amber-400/50 text-sm">Powered by D&D 5E ruleset · Backend dice engine · Living world</p>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <Link to={createPageUrl('CharacterCreation')}>
            <div className="group relative bg-gradient-to-br from-amber-900/20 to-amber-800/10 border border-amber-700/30 rounded-2xl p-8 hover:border-amber-500/60 transition-all duration-300 cursor-pointer hover:bg-amber-900/30 text-center">
              <div className="mb-4 flex justify-center">
                <Plus className="w-10 h-10 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="text-xl font-bold text-amber-200 mb-2">New Character</h3>
              <p className="text-amber-400/60 text-sm">Create your hero. Choose race, class, roll stats, forge your destiny.</p>
            </div>
          </Link>

          <Link to={createPageUrl('NewGame')}>
            <div className="group relative bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-700/30 rounded-2xl p-8 hover:border-purple-500/60 transition-all duration-300 cursor-pointer hover:bg-purple-900/30 text-center">
              <div className="mb-4 flex justify-center">
                <BookOpen className="w-10 h-10 text-purple-400 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="text-xl font-bold text-purple-200 mb-2">Start Adventure</h3>
              <p className="text-purple-400/60 text-sm">Begin a new campaign. Upload a story seed or let the AI weave your fate.</p>
            </div>
          </Link>

          {sessions.length > 0 && (
            <Link to={createPageUrl('Game') + `?session_id=${sessions[0].id}`}>
              <div className="group relative bg-gradient-to-br from-green-900/20 to-green-800/10 border border-green-700/30 rounded-2xl p-8 hover:border-green-500/60 transition-all duration-300 cursor-pointer hover:bg-green-900/30 text-center">
                <div className="mb-4 flex justify-center">
                  <Play className="w-10 h-10 text-green-400 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="text-xl font-bold text-green-200 mb-2">Continue</h3>
                <p className="text-green-400/60 text-sm">Resume your last adventure where you left off.</p>
              </div>
            </Link>
          )}
        </div>

        {/* Characters */}
        {!loading && characters.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-amber-300 mb-6 flex items-center gap-2">
              <Sword className="w-5 h-5" /> Your Heroes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {characters.map(char => (
                <CharacterCard key={char.id} character={char} sessions={sessions} />
              ))}
            </div>
          </div>
        )}

        {/* Active Sessions */}
        {!loading && sessions.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-purple-300 mb-6 flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> Active Campaigns
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sessions.map(session => (
                <SessionCard key={session.id} session={session} characters={characters} />
              ))}
            </div>
          </div>
        )}

        {!loading && characters.length === 0 && sessions.length === 0 && (
          <div className="text-center py-16 text-amber-400/40">
            <Skull className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No heroes yet. Your legend begins now.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CharacterCard({ character, sessions }) {
  const session = sessions.find(s => s.character_id === character.id);
  return (
    <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:border-amber-600/40 transition-all">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-amber-200 text-lg">{character.name}</h3>
          <p className="text-amber-400/60 text-sm">Level {character.level} {character.race} {character.class}</p>
        </div>
        <Badge className="bg-amber-900/50 text-amber-300 border-amber-700/50">Lv.{character.level}</Badge>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-center">
          <div className="text-red-400 font-bold text-sm">{character.hp_current}/{character.hp_max}</div>
          <div className="text-slate-500 text-xs">HP</div>
        </div>
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
          <Button size="sm" className="w-full bg-green-800/60 hover:bg-green-700/60 text-green-200 border border-green-700/50">
            <Play className="w-3 h-3 mr-1" /> Resume
          </Button>
        </Link>
      ) : (
        <Link to={createPageUrl('NewGame') + `?character_id=${character.id}`}>
          <Button size="sm" className="w-full bg-purple-800/60 hover:bg-purple-700/60 text-purple-200 border border-purple-700/50">
            <BookOpen className="w-3 h-3 mr-1" /> Start Quest
          </Button>
        </Link>
      )}
    </div>
  );
}

function SessionCard({ session, characters }) {
  const char = characters.find(c => c.id === session.character_id);
  return (
    <Link to={createPageUrl('Game') + `?session_id=${session.id}`}>
      <div className="bg-gradient-to-br from-purple-900/20 to-slate-900/40 border border-purple-800/40 rounded-xl p-5 hover:border-purple-600/60 transition-all cursor-pointer">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-purple-200">{session.title || 'Unnamed Campaign'}</h3>
          <Badge className={`text-xs ${session.in_combat ? 'bg-red-900/60 text-red-300 border-red-700/50' : 'bg-purple-900/50 text-purple-300 border-purple-700/50'}`}>
            {session.in_combat ? '⚔️ In Combat' : '📖 Exploring'}
          </Badge>
        </div>
        <p className="text-purple-400/60 text-sm">{session.current_location || 'Unknown Location'}</p>
        {char && <p className="text-amber-400/50 text-xs mt-1">Playing as {char.name}</p>}
        <p className="text-slate-500 text-xs mt-2">{session.season} · {session.time_of_day}</p>
      </div>
    </Link>
  );
}