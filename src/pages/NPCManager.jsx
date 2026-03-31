import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, MessageCircle, Trash2, Users, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import NPCDialogueModal from '@/components/game/NPCDialogueModal';

const PERSONALITY_ARCHETYPES = [
  'Wise Mentor', 'Gruff Veteran', 'Cheerful Merchant', 'Cunning Rogue',
  'Noble Knight', 'Eccentric Mage', 'Humble Peasant', 'Mysterious Stranger',
  'Jovial Innkeeper', 'Stern Guard', 'Naive Youth', 'Cynical Mercenary'
];

const ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'
];

const MOODS = ['happy', 'neutral', 'anxious', 'angry', 'sad', 'excited', 'suspicious', 'friendly'];

export default function NPCManager() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedNPC, setSelectedNPC] = useState(null);
  const [showDialogue, setShowDialogue] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    race: 'Human',
    personality_archetype: 'Humble Peasant',
    personality_traits: '',
    alignment: 'True Neutral',
    current_mood: 'neutral',
    location: '',
    occupation: '',
    backstory: '',
    voice_style: '',
    quest_giver: false,
    portrait_emoji: '🧙',
    relationship_with_player: 0,
  });

  const { data: npcs = [], isLoading } = useQuery({
    queryKey: ['npcs'],
    queryFn: () => base44.entities.NPC.list('-created_date'),
    initialData: [],
  });

  const { data: characters = [] } = useQuery({
    queryKey: ['characters'],
    queryFn: () => base44.entities.Character.filter({ is_active: true }),
    initialData: [],
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => base44.entities.GameSession.filter({ is_active: true }),
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.NPC.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['npcs'] });
      setShowForm(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.NPC.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['npcs'] }),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      title: '',
      race: 'Human',
      personality_archetype: 'Humble Peasant',
      personality_traits: '',
      alignment: 'True Neutral',
      current_mood: 'neutral',
      location: '',
      occupation: '',
      backstory: '',
      voice_style: '',
      quest_giver: false,
      portrait_emoji: '🧙',
      relationship_with_player: 0,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleStartDialogue = (npc) => {
    setSelectedNPC(npc);
    setShowDialogue(true);
  };

  return (
    <div className="min-h-screen parchment-bg flex flex-col" style={{ color: '#e8d5b7' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: 'rgba(8,5,2,0.95)', borderBottom: '1px solid rgba(180,140,90,0.2)' }}>
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg" style={{ color: 'rgba(201,169,110,0.5)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Users className="w-5 h-5" style={{ color: '#f0c040' }} />
        <div className="flex-1">
          <h1 className="font-fantasy-deco font-bold text-base text-glow-gold" style={{ color: '#f0c040' }}>
            NPC Dialogue Manager
          </h1>
          <p className="text-xs" style={{ color: 'rgba(201,169,110,0.4)', fontFamily: 'EB Garamond, serif' }}>
            Create and converse with AI-powered NPCs
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-3 py-2 rounded-xl btn-fantasy text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New NPC
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-slate-700 border-t-amber-600 rounded-full animate-spin mx-auto" />
            </div>
          ) : npcs.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#c9a96e' }} />
              <p className="text-sm mb-4" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
                No NPCs created yet. Click "New NPC" to create your first character.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {npcs.map(npc => (
                <NPCCard
                  key={npc.id}
                  npc={npc}
                  onTalk={() => handleStartDialogue(npc)}
                  onDelete={() => deleteMutation.mutate(npc.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* NPC Creation Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.9)' }}
            onClick={() => { setShowForm(false); resetForm(); }}>
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl rune-border"
              style={{ background: 'rgba(12,8,4,0.98)', border: '1px solid rgba(180,140,90,0.35)' }}
              onClick={e => e.stopPropagation()}>
              
              <div className="sticky top-0 px-5 py-4 flex items-center justify-between"
                style={{ background: 'rgba(20,13,4,0.95)', borderBottom: '1px solid rgba(180,140,90,0.15)', backdropFilter: 'blur(8px)' }}>
                <h2 className="font-fantasy font-bold text-lg" style={{ color: '#f0c040' }}>Create New NPC</h2>
                <button onClick={() => { setShowForm(false); resetForm(); }}
                  className="p-2 rounded-lg" style={{ color: 'rgba(201,169,110,0.4)' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="col-span-2">
                    <div className="text-xs mb-1.5 font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>NAME</div>
                    <input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg input-fantasy" required />
                  </label>

                  <label>
                    <div className="text-xs mb-1.5 font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>TITLE/ROLE</div>
                    <input value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Village Elder, Mysterious Stranger..."
                      className="w-full px-3 py-2 rounded-lg input-fantasy" />
                  </label>

                  <label>
                    <div className="text-xs mb-1.5 font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>PORTRAIT</div>
                    <input value={formData.portrait_emoji} onChange={e => setFormData(prev => ({ ...prev, portrait_emoji: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg input-fantasy text-center text-2xl" maxLength={2} />
                  </label>

                  <label>
                    <div className="text-xs mb-1.5 font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>RACE</div>
                    <select value={formData.race} onChange={e => setFormData(prev => ({ ...prev, race: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg select-fantasy">
                      {['Human', 'Elf', 'Dwarf', 'Halfling', 'Gnome', 'Half-Elf', 'Half-Orc', 'Tiefling', 'Dragonborn', 'Other'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <div className="text-xs mb-1.5 font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>OCCUPATION</div>
                    <input value={formData.occupation} onChange={e => setFormData(prev => ({ ...prev, occupation: e.target.value }))}
                      placeholder="Blacksmith, Tavern Owner..."
                      className="w-full px-3 py-2 rounded-lg input-fantasy" />
                  </label>

                  <label className="col-span-2">
                    <div className="text-xs mb-1.5 font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>PERSONALITY ARCHETYPE</div>
                    <select value={formData.personality_archetype} onChange={e => setFormData(prev => ({ ...prev, personality_archetype: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg select-fantasy">
                      {PERSONALITY_ARCHETYPES.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </label>

                  <label className="col-span-2">
                    <div className="text-xs mb-1.5 font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>PERSONALITY TRAITS</div>
                    <textarea value={formData.personality_traits} onChange={e => setFormData(prev => ({ ...prev, personality_traits: e.target.value }))}
                      placeholder="Speaks in riddles, extremely talkative, paranoid about strangers..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg input-fantasy resize-none" />
                  </label>

                  <label>
                    <div className="text-xs mb-1.5 font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>ALIGNMENT</div>
                    <select value={formData.alignment} onChange={e => setFormData(prev => ({ ...prev, alignment: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg select-fantasy">
                      {ALIGNMENTS.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <div className="text-xs mb-1.5 font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>CURRENT MOOD</div>
                    <select value={formData.current_mood} onChange={e => setFormData(prev => ({ ...prev, current_mood: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg select-fantasy">
                      {MOODS.map(m => (
                        <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <div className="text-xs mb-1.5 font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>LOCATION</div>
                    <input value={formData.location} onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Waterdeep Tavern, Forest Hermitage..."
                      className="w-full px-3 py-2 rounded-lg input-fantasy" />
                  </label>

                  <label>
                    <div className="text-xs mb-1.5 font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>VOICE STYLE</div>
                    <input value={formData.voice_style} onChange={e => setFormData(prev => ({ ...prev, voice_style: e.target.value }))}
                      placeholder="formal, archaic, poetic, slang..."
                      className="w-full px-3 py-2 rounded-lg input-fantasy" />
                  </label>

                  <label className="col-span-2">
                    <div className="text-xs mb-1.5 font-fantasy tracking-widest" style={{ color: 'rgba(201,169,110,0.6)' }}>BACKSTORY</div>
                    <textarea value={formData.backstory} onChange={e => setFormData(prev => ({ ...prev, backstory: e.target.value }))}
                      placeholder="Their history, motivations, secrets..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg input-fantasy resize-none" />
                  </label>

                  <label className="col-span-2 flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.quest_giver} onChange={e => setFormData(prev => ({ ...prev, quest_giver: e.target.checked }))}
                      className="rounded" style={{ accentColor: '#f0c040' }} />
                    <div>
                      <div className="font-fantasy text-sm" style={{ color: 'rgba(201,169,110,0.8)' }}>Quest Giver</div>
                      <div className="text-xs" style={{ color: 'rgba(180,140,90,0.5)' }}>This NPC can offer quests</div>
                    </div>
                  </label>
                </div>

                <div className="flex gap-2 pt-3">
                  <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                    className="flex-1 py-2.5 rounded-xl font-fantasy text-sm"
                    style={{ background: 'rgba(20,13,5,0.7)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}>
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 py-2.5 rounded-xl btn-fantasy font-fantasy text-sm flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Create NPC
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialogue Modal */}
      <AnimatePresence>
        {showDialogue && selectedNPC && characters[0] && (
          <NPCDialogueModal
            npc={selectedNPC}
            character={characters[0]}
            session={sessions[0]}
            onClose={() => { setShowDialogue(false); setSelectedNPC(null); }}
            onRelationshipChange={(newRel) => {
              queryClient.setQueryData(['npcs'], (old) =>
                old.map(n => n.id === selectedNPC.id ? { ...n, relationship_with_player: newRel } : n)
              );
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NPCCard({ npc, onTalk, onDelete }) {
  const relationship = npc.relationship_with_player || 0;
  const relationshipColor =
    relationship > 50 ? '#86efac' :
    relationship > 10 ? '#93c5fd' :
    relationship < -50 ? '#dc2626' :
    relationship < -10 ? '#fca5a5' : '#d4955a';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4 fantasy-card"
      style={{ background: 'rgba(15,10,5,0.85)', border: '1px solid rgba(180,140,90,0.2)' }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-3xl flex-shrink-0"
          style={{ background: 'rgba(80,50,10,0.6)', border: '2px solid rgba(201,169,110,0.3)' }}>
          {npc.portrait_emoji || '🧙'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-fantasy font-bold text-base truncate" style={{ color: '#f0c040' }}>
            {npc.name}
          </h3>
          {npc.title && (
            <p className="text-xs italic truncate" style={{ color: 'rgba(201,169,110,0.55)', fontFamily: 'EB Garamond, serif' }}>
              {npc.title}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="px-1.5 py-0.5 rounded-full text-xs"
              style={{ background: 'rgba(40,25,8,0.6)', border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.6)' }}>
              {npc.personality_archetype}
            </span>
            {npc.quest_giver && (
              <span className="px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: 'rgba(80,50,130,0.4)', border: '1px solid rgba(140,80,220,0.3)', color: '#c4b5fd' }}>
                Quest Giver
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-3 text-xs" style={{ color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
        <div className="flex justify-between">
          <span>Race:</span>
          <span style={{ color: '#e8d5b7' }}>{npc.race}</span>
        </div>
        <div className="flex justify-between">
          <span>Alignment:</span>
          <span style={{ color: '#e8d5b7' }}>{npc.alignment}</span>
        </div>
        {npc.location && (
          <div className="flex justify-between">
            <span>Location:</span>
            <span className="truncate ml-2" style={{ color: '#e8d5b7' }}>{npc.location}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span>Relationship:</span>
          <span style={{ color: relationshipColor, fontWeight: 'bold' }}>
            {relationship > 0 ? '+' : ''}{relationship}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onTalk}
          className="flex-1 py-2 rounded-lg btn-fantasy text-sm flex items-center justify-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Talk
        </button>
        <button onClick={onDelete}
          className="px-3 py-2 rounded-lg transition-all"
          style={{ background: 'rgba(80,20,10,0.5)', border: '1px solid rgba(180,50,50,0.3)', color: '#fca5a5' }}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}