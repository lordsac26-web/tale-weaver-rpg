import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, MessageCircle, Heart, Swords, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function NPCDialogueModal({ npc, character, session, onClose, onRelationshipChange }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!npc || !character) return null;

  const relationship = npc.relationship_with_player || 0;
  const relationshipLabel = 
    relationship > 50 ? 'Devoted Ally' :
    relationship > 10 ? 'Friendly' :
    relationship < -50 ? 'Hostile Enemy' :
    relationship < -10 ? 'Distrustful' : 'Neutral';
  
  const relationshipColor =
    relationship > 50 ? '#86efac' :
    relationship > 10 ? '#93c5fd' :
    relationship < -50 ? '#dc2626' :
    relationship < -10 ? '#fca5a5' : '#d4955a';

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMsg = inputMessage.trim();
    setMessages(prev => [...prev, { role: 'player', text: userMsg }]);
    setInputMessage('');
    setLoading(true);

    try {
      const result = await base44.functions.invoke('generateNPCDialogue', {
        npc_id: npc.id,
        player_message: userMsg,
        character_id: character.id,
        session_id: session?.id,
      });

      if (result.data?.npc_response) {
        setMessages(prev => [...prev, { 
          role: 'npc', 
          text: result.data.npc_response,
          mood: result.data.npc_mood,
        }]);

        // Update local relationship if changed
        if (result.data.relationship !== undefined && onRelationshipChange) {
          onRelationshipChange(result.data.relationship);
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'error', 
        text: 'The NPC seems distracted and does not respond...',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl rune-border"
        style={{
          background: 'rgba(12,8,4,0.98)',
          border: '1px solid rgba(180,140,90,0.35)',
          boxShadow: '0 0 60px rgba(0,0,0,0.9), 0 0 30px rgba(201,169,110,0.12)',
        }}
        onClick={e => e.stopPropagation()}>

        {/* Top accent */}
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.7) 30%, rgba(201,169,110,0.7) 70%, transparent)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ background: 'linear-gradient(90deg, rgba(60,40,8,0.6), rgba(20,13,4,0.5))', borderBottom: '1px solid rgba(180,140,90,0.15)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: 'rgba(80,50,10,0.6)', border: '2px solid rgba(201,169,110,0.4)' }}>
              {npc.portrait_emoji || '🧙'}
            </div>
            <div>
              <h2 className="font-fantasy font-bold text-lg" style={{ color: '#f0c040', textShadow: '0 0 20px rgba(201,169,110,0.4)' }}>
                {npc.name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {npc.title && (
                  <span className="text-xs italic" style={{ color: 'rgba(201,169,110,0.55)', fontFamily: 'EB Garamond, serif' }}>
                    {npc.title}
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded-full text-xs"
                  style={{ background: 'rgba(40,25,8,0.6)', border: `1px solid ${relationshipColor}40`, color: relationshipColor }}>
                  {relationshipLabel}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-lg transition-all"
            style={{ color: 'rgba(201,169,110,0.4)', background: 'rgba(20,13,5,0.5)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#c9a96e'; e.currentTarget.style.background = 'rgba(40,25,8,0.7)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(201,169,110,0.4)'; e.currentTarget.style.background = 'rgba(20,13,5,0.5)'; }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NPC Info Bar */}
        <div className="px-5 py-2 flex items-center gap-3 text-xs flex-shrink-0"
          style={{ background: 'rgba(8,5,2,0.7)', borderBottom: '1px solid rgba(180,140,90,0.1)' }}>
          <span style={{ color: 'rgba(180,140,90,0.5)' }}>
            {npc.race} · {npc.personality_archetype}
          </span>
          <span style={{ color: 'rgba(180,140,90,0.35)' }}>•</span>
          <span style={{ color: 'rgba(180,140,90,0.5)' }}>
            {npc.alignment}
          </span>
          {npc.current_mood && (
            <>
              <span style={{ color: 'rgba(180,140,90,0.35)' }}>•</span>
              <span style={{ color: 'rgba(180,140,90,0.5)' }}>
                Mood: {npc.current_mood}
              </span>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
          style={{ background: 'rgba(8,5,2,0.8)' }}>
          {messages.length === 0 && (
            <div className="text-center py-8">
              <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#c9a96e' }} />
              <p className="text-sm" style={{ color: 'rgba(180,140,90,0.4)', fontFamily: 'EB Garamond, serif' }}>
                {npc.name} awaits your words...
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'player' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] px-4 py-2.5 rounded-xl"
                style={msg.role === 'player' ? {
                  background: 'rgba(30,60,140,0.5)',
                  border: '1px solid rgba(60,100,220,0.35)',
                  color: '#e8d5b7',
                } : msg.role === 'error' ? {
                  background: 'rgba(80,20,10,0.4)',
                  border: '1px solid rgba(180,50,50,0.3)',
                  color: '#fca5a5',
                } : {
                  background: 'rgba(40,25,8,0.7)',
                  border: '1px solid rgba(201,169,110,0.3)',
                  color: '#e8d5b7',
                }}>
                <p className="text-sm leading-relaxed" style={{ fontFamily: 'EB Garamond, serif' }}>
                  {msg.text}
                </p>
              </div>
            </motion.div>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start">
              <div className="px-4 py-3 rounded-xl flex items-center gap-2"
                style={{ background: 'rgba(40,25,8,0.7)', border: '1px solid rgba(201,169,110,0.3)' }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#c9a96e' }} />
                <span className="text-sm italic" style={{ color: 'rgba(201,169,110,0.6)', fontFamily: 'EB Garamond, serif' }}>
                  {npc.name} is thinking...
                </span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 px-4 py-3"
          style={{ borderTop: '1px solid rgba(180,140,90,0.2)', background: 'rgba(10,6,3,0.9)' }}>
          <div className="flex gap-2">
            <input
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder={`Speak to ${npc.name}...`}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl input-fantasy disabled:opacity-50"
              style={{ fontFamily: 'EB Garamond, serif' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || loading}
              className="px-4 py-2.5 rounded-xl btn-fantasy disabled:opacity-50 flex items-center gap-2">
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span style={{ color: 'rgba(180,140,90,0.35)', fontFamily: 'EB Garamond, serif' }}>
              Press Enter to send
            </span>
            {npc.quest_giver && (
              <span className="px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(80,50,130,0.4)', border: '1px solid rgba(140,80,220,0.3)', color: '#c4b5fd' }}>
                Quest Giver
              </span>
            )}
          </div>
        </div>

        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.3) 40%, rgba(201,169,110,0.3) 60%, transparent)' }} />
      </motion.div>
    </div>
  );
}